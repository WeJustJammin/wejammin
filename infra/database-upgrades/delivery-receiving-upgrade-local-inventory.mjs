import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { basename, isAbsolute, join, normalize, resolve } from 'node:path';

import {
  hashText,
  identifier,
  isRecord,
  requireFact,
  sealTarget,
} from './delivery-receiving-upgrade-target.mjs';
import {
  APPLIED_HISTORY_SQL,
  MIGRATION,
  probe,
} from './delivery-receiving-upgrade-local-target.mjs';

export const sha256 = (bytes) =>
  createHash('sha256').update(bytes).digest('hex');
export const manifestHash = (entries) =>
  sha256(
    entries
      .map((entry) => `${basename(entry.path)}\t${entry.sha256}\n`)
      .join(''),
  );

export async function readRegular(fs, path) {
  const stat = await fs.lstat(path);
  requireFact(
    stat.isFile() && !stat.isSymbolicLink(),
    `regular file required: ${path}`,
  );
  const bytes = await fs.readFile(path);
  requireFact(Buffer.isBuffer(bytes), 'filesystem must return Buffer bytes');
  return Buffer.from(bytes);
}

async function optional(fs, path) {
  try {
    return await readRegular(fs, path);
  } catch (error) {
    if (error?.code === 'ENOENT' || /^ENOENT /.test(error?.message ?? ''))
      return undefined;
    throw error;
  }
}

export function validatePlan(plan) {
  requireFact(
    isRecord(plan) &&
      typeof plan.repository === 'string' &&
      isAbsolute(plan.repository) &&
      normalize(plan.repository) === plan.repository &&
      !/[\0\r\n]/.test(plan.repository),
    'absolute source repository required',
  );
  sealTarget(plan.target);
  requireFact(
    plan.targetMigration === MIGRATION &&
      ['negative', 'positive'].includes(plan.mode) &&
      typeof plan.runId === 'string' &&
      /^[A-Za-z0-9][A-Za-z0-9_-]{0,31}$/.test(plan.runId) &&
      identifier(plan.applicationName),
    'invalid local plan',
  );
  requireFact(
    isRecord(plan.source) &&
      Buffer.isBuffer(plan.source.bytes) &&
      plan.source.bytes.length > 0 &&
      Buffer.isBuffer(plan.witness) &&
      plan.source.bytes.equals(plan.witness) &&
      plan.source.sha256 === sha256(plan.source.bytes) &&
      plan.sourceSha256 === plan.source.sha256 &&
      plan.witnessSha256 === sha256(plan.witness) &&
      hashText(plan.prefixSha256),
    'source/copy binding drift',
  );
}

export async function discover(fs, plan) {
  validatePlan(plan);
  const directory = join(plan.repository, 'supabase/migrations');
  requireFact(
    (await fs.realpath(directory)) === resolve(directory),
    'foreign promoted directory',
  );
  const names = (await fs.readdir(directory))
    .filter((name) => name.endsWith('.sql'))
    .sort();
  requireFact(names.length > 0, 'empty promoted inventory');
  const versions = new Set();
  const baseline = [];
  for (const name of names) {
    const version = /^([0-9]{14})_[A-Za-z0-9_]+\.sql$/.exec(name)?.[1];
    requireFact(
      version &&
        !versions.has(version) &&
        (version !== MIGRATION.slice(0, 14) || name === MIGRATION),
      'ambiguous migration inventory',
    );
    versions.add(version);
    const path = join(directory, name);
    const bytes = await readRegular(fs, path);
    requireFact(bytes.length > 0, 'empty migration source');
    baseline.push({ path, bytes, sha256: sha256(bytes) });
  }
  const prefix = baseline.filter(
    (entry) =>
      basename(entry.path) < MIGRATION &&
      basename(entry.path).slice(0, 14) < MIGRATION.slice(0, 14),
  );
  const declared = plan.prefixManifest;
  requireFact(
    Array.isArray(declared?.entries) &&
      Array.isArray(declared.expectedPaths) &&
      prefix.length === declared.entries.length &&
      prefix.length === declared.expectedPaths.length,
    'caller omitted actual prefix inventory',
  );
  prefix.forEach((entry, index) => {
    const claimed = declared.entries[index];
    requireFact(
      claimed?.path === entry.path &&
        declared.expectedPaths[index] === entry.path &&
        Buffer.isBuffer(claimed.bytes) &&
        claimed.bytes.equals(entry.bytes) &&
        claimed.sha256 === entry.sha256,
      'actual prefix byte/inventory mismatch',
    );
  });
  requireFact(
    prefix.length > 0 && manifestHash(prefix) === plan.prefixSha256,
    'actual prefix digest mismatch',
  );
  const sourcePath = join(directory, MIGRATION);
  requireFact(plan.source.path === sourcePath, 'foreign target source path');
  const source = await optional(fs, sourcePath);
  requireFact(source, 'target source missing');
  requireFact(
    source.equals(plan.source.bytes),
    'actual target source drift/divergence',
  );
  const witness = await readRegular(
    fs,
    join(
      plan.repository,
      'supabase/tests/phase_02_slice_11_delivery_receiving/080-forward-migration.sqlinc',
    ),
  );
  requireFact(witness.equals(plan.witness), 'actual complete 080 copy drift');
  const seed = join(plan.repository, 'supabase/seed.sql');
  requireFact(
    (await fs.realpath(join(plan.target.workdir, 'supabase/seed.sql'))) ===
      resolve(seed) &&
      (await fs.realpath(join(plan.target.workdir, 'supabase/tests'))) ===
        resolve(plan.repository, 'supabase/tests'),
    'foreign ALT fixture/seed link',
  );
  const config = await readRegular(
    fs,
    join(plan.target.workdir, 'supabase/config.toml'),
  );
  const seedBytes = await readRegular(fs, seed);
  const prefixSha256 = manifestHash(prefix);
  const baselineSha256 = manifestHash(baseline);
  return {
    prefix,
    baseline,
    prefixSha256,
    baselineSha256,
    fingerprint: sha256(
      [
        prefixSha256,
        baselineSha256,
        sha256(config),
        sha256(seedBytes),
        sha256(witness),
        plan.sourceSha256,
      ].join('\n'),
    ),
  };
}

export async function verifyApplied(process, plan, entries) {
  const document = await probe(process, plan, APPLIED_HISTORY_SQL);
  const rows = document?.appliedMigrations;
  requireFact(
    document?.witness === 'DEC197_APPLIED_HISTORY_V1' &&
      Array.isArray(rows) &&
      rows.length === entries.length,
    'applied inventory incomplete',
  );
  entries.forEach((entry, index) => {
    const name = basename(entry.path);
    const row = rows[index];
    requireFact(
      isRecord(row) &&
        Object.keys(row).length === 2 &&
        row.version === name.slice(0, 14) &&
        row.name === name.slice(15, -4),
      'applied version/name mismatch',
    );
  });
  return manifestHash(entries);
}
