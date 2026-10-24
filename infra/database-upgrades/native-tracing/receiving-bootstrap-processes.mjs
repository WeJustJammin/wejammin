import {
  lstatSync,
  readdirSync,
  readlinkSync,
  realpathSync,
  statSync,
} from 'node:fs';
import { join } from 'node:path';
import {
  ensure,
  failure,
  kernelText,
  stamp,
} from './receiving-bootstrap-artifacts.mjs';
import {
  bootstrapDescriptorAllowed,
  bootstrapMetadataMatches,
} from './receiving-bootstrap-diagnostic-values.mjs';
import { anchored } from './receiving-bootstrap-protocol.mjs';
import {
  COMPILER,
  COORDINATOR,
  ENVIRONMENT,
  LAUNCHER,
  NODE,
  REPOSITORY,
  UID,
  VERSION,
} from './receiving-bootstrap-profile.mjs';

const positive = (value) => Number.isSafeInteger(value) && value > 0;
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function incomplete() {
  const error = failure('DEC203_SUPERVISOR_HISTORY_GAP');
  error.incompleteSnapshot = true;
  throw error;
}

export function entry(phase) {
  ensure(phase === 'owner' || phase === 'lease', 'DEC203_SUPERVISOR_REFUSED');
  ensure(
    process.platform === 'linux' && process.version === VERSION,
    'DEC203_SUPERVISOR_UNAVAILABLE',
  );
  ensure(process.getuid() === UID && realpathSync(process.execPath) === NODE);
  ensure(
    equal(Object.keys(process.env).sort(), Object.keys(ENVIRONMENT).sort()),
    'DEC203_SUPERVISOR_REFUSED',
  );
  for (const [key, value] of Object.entries(ENVIRONMENT))
    ensure(process.env[key] === value, 'DEC203_SUPERVISOR_REFUSED');
  const argv = kernelText('/proc/self/cmdline').split('\0');
  ensure(argv.pop() === '');
  const expected =
    phase === 'owner'
      ? [NODE, '--', LAUNCHER]
      : [NODE, '--', COORDINATOR, argv[3]];
  ensure(equal(argv, expected), 'DEC203_SUPERVISOR_REFUSED');
  if (phase === 'owner') ensure(process.cwd() === REPOSITORY);
  else
    ensure(
      typeof argv[3] === 'string' &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
          argv[3],
        ),
      'DEC203_SUPERVISOR_REFUSED',
    );
  return argv[3];
}

export function facts(pid) {
  ensure(positive(pid), 'DEC203_SUPERVISOR_REFUSED');
  const raw = kernelText(`/proc/${pid}/stat`);
  const prefix = `${pid} (`;
  const boundary = raw.lastIndexOf(') ');
  ensure(raw.startsWith(prefix) && boundary >= prefix.length);
  const fields = raw
    .slice(boundary + 2)
    .trim()
    .split(/\s+/);
  ensure(fields.length >= 20 && /^[A-Za-z]$/.test(fields[0]));
  for (const value of fields.slice(1))
    ensure(/^(0|-?[1-9][0-9]*)$/.test(value));
  ensure(/^[1-9][0-9]*$/.test(fields[19]));
  if (['Z', 'X'].includes(fields[0])) {
    ensure(fields.slice(1, 4).every((value) => positive(Number(value))));
    incomplete();
  }
  const value = {
    pid,
    ppid: Number(fields[1]),
    group: Number(fields[2]),
    session: Number(fields[3]),
    startTime: fields[19],
    uid: Number(lstatSync(`/proc/${pid}`).uid),
    image: readlinkSync(`/proc/${pid}/exe`),
    namespace: readlinkSync(`/proc/${pid}/ns/pid`),
  };
  ensure(
    [value.ppid, value.group, value.session].every(positive) &&
      value.uid === UID,
  );
  return value;
}

export function children(pid) {
  ensure(positive(pid), 'DEC203_SUPERVISOR_REFUSED');
  const values = kernelText(`/proc/${pid}/task/${pid}/children`)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((value) => {
      ensure(/^[1-9][0-9]*$/.test(value) && positive(Number(value)));
      return Number(value);
    });
  ensure(values.length <= 64 && new Set(values).size === values.length);
  return values;
}

export function captureProcess(pid, root, inputs) {
  const before = facts(pid);
  const image = statSync(`/proc/${pid}/exe`, { bigint: true });
  const raw = kernelText(`/proc/${pid}/cmdline`);
  const cwd = readlinkSync(`/proc/${pid}/cwd`);
  const rawAfter = kernelText(`/proc/${pid}/cmdline`);
  const cwdAfter = readlinkSync(`/proc/${pid}/cwd`);
  const imageAfter = statSync(`/proc/${pid}/exe`, { bigint: true });
  const after = facts(pid);
  anchored(before, after);
  ensure(
    [before.image, after.image].every((path) =>
      [NODE, COMPILER, join(root, 'owner/receiving-lease-owner')].includes(
        path,
      ),
    ),
  );
  if (before.image !== after.image) incomplete();
  const executable = inputs.find((value) => value.path === before.image);
  ensure(executable !== undefined);
  ensure(
    image.isFile() &&
      String(image.dev) === executable.device &&
      String(image.ino) === executable.inode,
  );
  ensure(
    Number(image.size) === executable.size &&
      Number(image.mode) === executable.mode &&
      Number(image.uid) === executable.uid,
  );
  ensure(stamp(imageAfter) === stamp(image));
  if (!equal(before, after) || raw !== rawAfter || cwd !== cwdAfter)
    incomplete();
  const argv = raw.split('\0');
  ensure(argv.pop() === '');
  return Object.freeze({
    process: Object.freeze({
      pid,
      ppid: before.ppid,
      startTime: before.startTime,
      session: before.session,
      uid: before.uid,
      executable,
    }),
    argv: Object.freeze(argv),
    cwd,
    group: before.group,
    namespace: before.namespace,
  });
}

export function fdSnapshot(observed, root) {
  const pid = observed.process.pid;
  const before = facts(pid);
  ensure(
    before.startTime === observed.process.startTime &&
      before.ppid === observed.process.ppid &&
      before.uid === observed.process.uid &&
      before.namespace === observed.namespace &&
      before.image === observed.process.executable.path,
  );
  const names = () =>
    readdirSync(`/proc/${pid}/fd`)
      .map((value) => {
        ensure(
          /^(0|[1-9][0-9]*)$/.test(value) &&
            Number.isSafeInteger(Number(value)),
        );
        return Number(value);
      })
      .sort((a, b) => a - b);
  const first = names();
  ensure(first.length <= 64);
  const global = kernelText('/proc/locks', 1_048_576)
    .split('\n')
    .map((line) =>
      line
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/^\d+: /, ''),
    );
  const locks = [];
  const fds = first.map((fd) => {
    const path = `/proc/${pid}/fd/${fd}`;
    const target = readlinkSync(path);
    ensure(Buffer.byteLength(target) <= 512 && !/[\0\r\n]/.test(target));
    const stat = statSync(path, { bigint: true });
    const info = kernelText(`/proc/${pid}/fdinfo/${fd}`);
    const flags = /^flags:\s*([0-7]+)$/m.exec(info)?.[1];
    const pos = /^pos:\s*(0|[1-9][0-9]*)$/m.exec(info)?.[1];
    const ino = /^ino:\s*(0|[1-9][0-9]*)$/m.exec(info)?.[1];
    if (
      !flags ||
      pos === undefined ||
      ino === undefined ||
      BigInt(ino) !== stat.ino
    )
      incomplete();
    const rawPid = /^Pid:\s*(-1|0|[1-9][0-9]*)$/m.exec(info)?.[1];
    let pidfd = null;
    if (rawPid !== undefined) {
      const raw = /^NSpid:\s*([^\r\n]*)$/m.exec(info)?.[1];
      if (raw === undefined) incomplete();
      const nspid = raw
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((value) => {
          ensure(/^[1-9][0-9]*$/.test(value) && positive(Number(value)));
          return Number(value);
        });
      ensure(Number.isSafeInteger(Number(rawPid)) && nspid.length <= 16);
      pidfd = { pid: Number(rawPid), nspid };
    }
    const rows = [...info.matchAll(/^lock:\s*(.+)$/gm)].map((value) =>
      value[1].trim().replace(/\s+/g, ' '),
    );
    ensure(rows.length <= 1);
    if (rows.length) {
      const match =
        /^(\d+): FLOCK ADVISORY (READ|WRITE) ([1-9][0-9]*) ([0-9a-f]+):([0-9a-f]+):(\d+) 0 EOF$/i.exec(
          rows[0],
        );
      ensure(
        match !== null && fd >= 3 && fd <= 6 && positive(Number(match[3])),
      );
      const major =
        ((stat.dev >> 8n) & 0xfffn) | ((stat.dev >> 32n) & 0xfffff000n);
      const minor = (stat.dev & 0xffn) | ((stat.dev >> 12n) & 0xffffff00n);
      if (
        BigInt(`0x${match[4]}`) !== major ||
        BigInt(`0x${match[5]}`) !== minor ||
        BigInt(match[6]) !== stat.ino ||
        !global.includes(rows[0].replace(/^\d+: /, ''))
      )
        incomplete();
      locks.push({
        fd,
        ownerPid: Number(match[3]),
        mode: match[2],
        device: String(stat.dev),
        inode: String(stat.ino),
        start: '0',
        end: 'EOF',
      });
    }
    if (
      stamp(statSync(path, { bigint: true })) !== stamp(stat) ||
      readlinkSync(path) !== target
    )
      incomplete();
    const octal = BigInt(`0o${flags}`).toString(8);
    return {
      fd,
      target,
      device: String(stat.dev),
      inode: String(stat.ino),
      mode: Number(stat.mode),
      uid: Number(stat.uid),
      gid: Number(stat.gid),
      flags: octal === '0' ? '0' : `0${octal}`,
      pos,
      pidfd,
    };
  });
  const after = facts(pid);
  anchored(before, after);
  if (!equal(first, names()) || !equal(before, after)) incomplete();
  ensure(fds.every((value) => bootstrapDescriptorAllowed(value, root)));
  if (fds.some((value) => value.target === '/proc/locks')) {
    const named = lstatSync('/proc/locks', { bigint: true });
    ensure(named.isFile() && !named.isSymbolicLink());
    ensure(bootstrapMetadataMatches(fds, named));
  }
  return Object.freeze({
    process: observed.process,
    fds: Object.freeze(fds),
    locks: Object.freeze(locks),
  });
}
