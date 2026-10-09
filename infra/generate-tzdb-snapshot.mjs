// Generates the pinned IANA tz snapshot of the CMS Time authority (BE03b E8, DEC-153).
//
// The snapshot is a content-addressed build asset: the same two IANA release
// tarballs always produce the same bytes, so its SHA-256 (`CMS_TZDB_SHA256`) pins
// the schedule time rules. The script
//   1. verifies both tarballs against the SHA-256 digests pinned in tzdb-pin.ts,
//   2. builds `zic` from the release's own tzcode,
//   3. compiles the release's region data and link names into TZif files, and
//   4. reduces every distinct zone to what local-time resolution needs: the UT
//      offset sequence, the instants it changes at, and the POSIX TZ footer that
//      governs the instants after the last explicit transition.
//
// Usage:
//   node infra/generate-tzdb-snapshot.mjs --download            write the asset
//   node infra/generate-tzdb-snapshot.mjs --download --check    fail on drift
//   node infra/generate-tzdb-snapshot.mjs --tzdata F --tzcode F  use local tarballs
//
// Requires `tar` and a C compiler (`cc`).
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CMS_TZDB_SHA256,
  CMS_TZDB_SOURCE,
  CMS_TZDB_VERSION,
} from '../packages/contracts/src/cms-editorial/time-authority/tzdb-pin.ts';

export const SNAPSHOT_FORMAT = 'cms.tzdb.v1';

/** The region files and link names compiled from the release (the default `make` set, minus `factory`). */
const DATA_FILES = [
  'africa',
  'antarctica',
  'asia',
  'australasia',
  'etcetera',
  'europe',
  'northamerica',
  'southamerica',
  'backward',
];

const outputUrl = new URL(
  '../packages/contracts/src/cms-editorial/time-authority/tzdb-snapshot-data.ts',
  import.meta.url,
);

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

/** Parses the version 2+ block of a TZif file down to what time resolution needs. */
export const parseTzif = (buffer, name) => {
  if (buffer.subarray(0, 4).toString('latin1') !== 'TZif')
    throw new Error(`${name} is not a TZif file`);
  if (buffer[4] < 0x32)
    throw new Error(`${name} has no 64-bit data block (TZif version 1)`);
  const counts = (offset) => ({
    isut: buffer.readUInt32BE(offset + 20),
    isstd: buffer.readUInt32BE(offset + 24),
    leap: buffer.readUInt32BE(offset + 28),
    time: buffer.readUInt32BE(offset + 32),
    type: buffer.readUInt32BE(offset + 36),
    char: buffer.readUInt32BE(offset + 40),
  });
  const first = counts(0);
  const firstSize =
    first.time * 5 +
    first.type * 6 +
    first.char +
    first.leap * 8 +
    first.isstd +
    first.isut;
  const secondHeader = 44 + firstSize;
  const second = counts(secondHeader);
  let cursor = secondHeader + 44;
  const times = [];
  for (let index = 0; index < second.time; index += 1) {
    const value = buffer.readBigInt64BE(cursor);
    cursor += 8;
    // zic -b slim emits no big-bang sentinel; refuse anything unrepresentable.
    if (value < -(2n ** 53n) || value > 2n ** 53n)
      throw new Error(`${name} has a transition outside the safe range`);
    times.push(Number(value));
  }
  const typeIndexes = [...buffer.subarray(cursor, cursor + second.time)];
  cursor += second.time;
  const offsets = [];
  for (let index = 0; index < second.type; index += 1) {
    offsets.push(buffer.readInt32BE(cursor));
    cursor += 6;
  }
  cursor += second.char + second.leap * 12 + second.isstd + second.isut;
  const tail = buffer.subarray(cursor).toString('latin1');
  const footerMatch = /^\n([^\n]*)\n$/u.exec(tail);
  if (footerMatch === null) throw new Error(`${name} has no TZif footer`);
  if (second.leap !== 0) throw new Error(`${name} carries leap seconds`);
  return {
    initialOffset: offsets[0],
    times,
    offsets: typeIndexes.map((typeIndex) => offsets[typeIndex]),
    footer: footerMatch[1],
  };
};

const listFiles = (directory) =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  });

/** Builds the snapshot object from compiled TZif files. */
export const buildSnapshot = (compiledDirectory) => {
  const zonesByDigest = new Map();
  const zones = [];
  const names = {};
  const files = listFiles(compiledDirectory)
    .map((path) => ({
      name: relative(compiledDirectory, path).split('\\').join('/'),
      path,
    }))
    .sort((left, right) => (left.name < right.name ? -1 : 1));
  for (const { name, path } of files) {
    const bytes = readFileSync(path);
    if (bytes.subarray(0, 4).toString('latin1') !== 'TZif') continue;
    const digest = sha256(bytes);
    let index = zonesByDigest.get(digest);
    if (index === undefined) {
      const parsed = parseTzif(bytes, name);
      const distinct = [];
      const indexOfOffset = (offset) => {
        const found = distinct.indexOf(offset);
        if (found >= 0) return found;
        distinct.push(offset);
        return distinct.length - 1;
      };
      const initial = indexOfOffset(parsed.initialOffset);
      const deltas = [];
      const indexes = [];
      let previous = 0;
      for (const [position, time] of parsed.times.entries()) {
        deltas.push(time - previous);
        previous = time;
        indexes.push(indexOfOffset(parsed.offsets[position]));
      }
      index = zones.length;
      // [distinct offsets, initial offset index, transition deltas, offset index per transition, footer]
      zones.push([distinct, initial, deltas, indexes, parsed.footer]);
      zonesByDigest.set(digest, index);
    }
    names[name] = index;
  }
  return { format: SNAPSHOT_FORMAT, release: CMS_TZDB_VERSION, names, zones };
};

const fetchTarball = async (url, destination) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`GET ${url} answered ${response.status}`);
  writeFileSync(destination, Buffer.from(await response.arrayBuffer()));
};

const requireDigest = (path, expected, label) => {
  const actual = sha256(readFileSync(path));
  if (actual !== expected)
    throw new Error(
      `${label} digest ${actual} differs from the pinned ${expected}`,
    );
};

/** Generates the snapshot text from the two tarballs inside a scratch directory. */
export const generateSnapshotText = async ({
  tzdataPath,
  tzcodePath,
  download,
}) => {
  const work = mkdtempSync(join(tmpdir(), 'wejammin-tzdb-'));
  try {
    const dataTar = tzdataPath ?? join(work, 'tzdata.tar.gz');
    const codeTar = tzcodePath ?? join(work, 'tzcode.tar.gz');
    if (download) {
      await fetchTarball(CMS_TZDB_SOURCE.tzdataUrl, dataTar);
      await fetchTarball(CMS_TZDB_SOURCE.tzcodeUrl, codeTar);
    }
    requireDigest(dataTar, CMS_TZDB_SOURCE.tzdataSha256, 'tzdata tarball');
    requireDigest(codeTar, CMS_TZDB_SOURCE.tzcodeSha256, 'tzcode tarball');
    const dataDirectory = join(work, 'data');
    const codeDirectory = join(work, 'code');
    const compiled = join(work, 'compiled');
    for (const directory of [dataDirectory, codeDirectory, compiled])
      mkdirSync(directory);
    execFileSync('tar', ['-xzf', dataTar, '-C', dataDirectory]);
    execFileSync('tar', ['-xzf', codeTar, '-C', codeDirectory]);
    // zic.c needs only the two generated headers the release Makefile writes
    // (the version it reports and the two default paths it never uses here).
    writeFileSync(
      join(codeDirectory, 'version.h'),
      `static char const PKGVERSION[]="(tzcode) ";\nstatic char const TZVERSION[]="${CMS_TZDB_VERSION}";\nstatic char const REPORT_BUGS_TO[]="tz@iana.org";\n`,
    );
    writeFileSync(
      join(codeDirectory, 'tzdir.h'),
      '#ifndef TZDEFAULT\n# define TZDEFAULT "/etc/localtime"\n#endif\n#ifndef TZDIR\n# define TZDIR "/usr/share/zoneinfo"\n#endif\n',
    );
    execFileSync('cc', ['-O2', '-o', 'zic', 'zic.c'], {
      cwd: codeDirectory,
      stdio: 'pipe',
    });
    execFileSync(
      join(codeDirectory, 'zic'),
      ['-b', 'slim', '-d', compiled, ...DATA_FILES],
      { cwd: dataDirectory, stdio: 'pipe' },
    );
    const snapshot = buildSnapshot(compiled);
    const text = JSON.stringify(snapshot);
    if (/[`\\]|\$\{/u.test(text))
      throw new Error('snapshot text is not safe inside a template literal');
    return text;
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
};

/** The TypeScript module that holds the exact snapshot text. */
export const renderModule = (text) =>
  `/*
 * GENERATED by infra/generate-tzdb-snapshot.mjs from IANA tzdata ${CMS_TZDB_VERSION}.
 * DO NOT EDIT. The SHA-256 of the exact text below is CMS_TZDB_SHA256 (tzdb-pin.ts).
 * Reduced format ${SNAPSHOT_FORMAT}: names map to zone indexes; a zone is
 * [distinct UT offsets, initial offset index, transition deltas (s), offset index per transition, POSIX footer].
 */
export const CMS_TZDB_SNAPSHOT_JSON = \`${text}\`;
`;

const parseArguments = (argv) => ({
  check: argv.includes('--check'),
  download: argv.includes('--download'),
  tzdataPath: argv.includes('--tzdata')
    ? resolve(argv[argv.indexOf('--tzdata') + 1])
    : undefined,
  tzcodePath: argv.includes('--tzcode')
    ? resolve(argv[argv.indexOf('--tzcode') + 1])
    : undefined,
});

const isEntrypoint =
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isEntrypoint) {
  const options = parseArguments(process.argv.slice(2));
  if (!options.download && (!options.tzdataPath || !options.tzcodePath)) {
    console.error('Pass --download or both --tzdata and --tzcode.');
    process.exit(2);
  }
  const text = await generateSnapshotText(options);
  const digest = sha256(Buffer.from(text, 'utf8'));
  const module = renderModule(text);
  if (options.check) {
    let committed = '';
    try {
      committed = readFileSync(outputUrl, 'utf8');
    } catch {
      // A missing asset is drift and uses the same failure path as a stale one.
    }
    if (committed !== module || digest !== CMS_TZDB_SHA256) {
      console.error(
        `tzdb snapshot drift: generated ${digest}, pinned ${CMS_TZDB_SHA256}.`,
      );
      process.exitCode = 1;
    } else console.log(`tzdb snapshot ${CMS_TZDB_VERSION} matches ${digest}`);
  } else {
    writeFileSync(outputUrl, module, 'utf8');
    console.log(
      `Wrote ${fileURLToPath(outputUrl)} (${statSync(outputUrl).size} bytes)`,
    );
    console.log(`CMS_TZDB_SHA256 = ${digest}`);
  }
}
