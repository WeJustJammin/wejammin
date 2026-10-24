import { join } from 'node:path';
import {
  COMPILER,
  DIRECTORY,
  ERRORS,
  HEADERS,
  LOCK_PATHS,
  NODE,
  PHASES,
  PROFILE,
  SOURCE_NAMES,
} from './receiving-bootstrap-profile.mjs';
import {
  exactKeys as exact,
  protocol as ensure,
  validateFrame,
  validateWait,
} from './receiving-bootstrap-protocol.mjs';

const integer = (value) => Number.isSafeInteger(value) && value >= 0;
const positive = (value) => integer(value) && value > 0;
const decimal = (value) =>
  typeof value === 'string' && /^(0|[1-9][0-9]*)$/.test(value);
const member = (value, choices) => ensure(choices.includes(value));

export const diagnosticFailureCode = (failure) =>
  failure === null
    ? 'DEC203_SUPERVISOR_CANCELLED'
    : ERRORS.includes(failure.error?.code)
      ? failure.error.code
      : 'DEC203_SUPERVISOR_FAILED';

export function bootstrapTargetAllowed(target, root) {
  const paths = [
    ...PROFILE.map((value) => value.path),
    ...LOCK_PATHS,
    ...SOURCE_NAMES.map((name) => join(DIRECTORY, name)),
  ];
  return (
    typeof target === 'string' &&
    Buffer.byteLength(target) <= 512 &&
    !/[\0\r\n]/.test(target) &&
    (paths.includes(target) ||
      target === root ||
      target.startsWith(`${root}/`) ||
      target === '/proc/locks' ||
      target === '/dev/null' ||
      /^pipe:\[[0-9]+\]$|^socket:\[[0-9]+\]$|^anon_inode:\[?(?:eventpoll|eventfd|pidfd|signalfd|timerfd|io_uring)\]?$/.test(
        target,
      ))
  );
}

export function bootstrapDescriptorAllowed(value, root) {
  return (
    bootstrapTargetAllowed(value.target, root) &&
    (value.target !== '/proc/locks' ||
      (value.mode === 0o100444 &&
        value.uid === 0 &&
        value.gid === 0 &&
        ['02400000', '02500000'].includes(value.flags) &&
        value.pidfd === null))
  );
}

export function bootstrapMetadataMatches(fds, named) {
  for (const value of fds) {
    if (value.target !== '/proc/locks') continue;
    if (
      String(value.device) !== String(named.dev) ||
      String(value.inode) !== String(named.ino) ||
      String(value.mode) !== String(named.mode) ||
      String(value.uid) !== String(named.uid) ||
      String(value.gid) !== String(named.gid)
    )
      return false;
  }
  return true;
}

function artifact(value, paths) {
  exact(value, ['path', 'sha256', 'device', 'inode', 'size', 'mode', 'uid']);
  member(value.path, paths);
  ensure(
    typeof value.sha256 === 'string' && /^[0-9a-f]{64}$/.test(value.sha256),
  );
  ensure(decimal(value.device) && decimal(value.inode));
  ensure([value.size, value.mode, value.uid].every(integer));
}

function processRecord(value, paths) {
  exact(value, ['pid', 'ppid', 'startTime', 'session', 'uid', 'executable']);
  ensure([value.pid, value.ppid, value.session].every(positive));
  ensure(decimal(value.startTime) && integer(value.uid));
  artifact(value.executable, paths);
}

function inventory(body, paths, root) {
  exact(body, ['phase', 'process', 'fds', 'locks']);
  member(body.phase, [
    'owner-leased',
    'coordinator-precompile',
    'lease-compiler-live',
    'coordinator-adopted',
  ]);
  processRecord(body.process, paths);
  ensure(Array.isArray(body.fds) && body.fds.length <= 64);
  let prior = -1;
  for (const value of body.fds) {
    exact(value, [
      'fd',
      'target',
      'device',
      'inode',
      'mode',
      'uid',
      'gid',
      'flags',
      'pos',
      'pidfd',
    ]);
    ensure(integer(value.fd) && value.fd > prior);
    prior = value.fd;
    ensure(bootstrapDescriptorAllowed(value, root));
    if (value.target === '/proc/locks')
      ensure(body.phase !== 'lease-compiler-live');
    ensure(decimal(value.device) && decimal(value.inode) && decimal(value.pos));
    ensure([value.mode, value.uid, value.gid].every(integer));
    ensure(
      typeof value.flags === 'string' && /^(0|0[1-7][0-7]*)$/.test(value.flags),
    );
    if (value.pidfd !== null) {
      exact(value.pidfd, ['pid', 'nspid']);
      ensure(Number.isSafeInteger(value.pidfd.pid) && value.pidfd.pid >= -1);
      ensure(
        Array.isArray(value.pidfd.nspid) &&
          value.pidfd.nspid.length <= 16 &&
          value.pidfd.nspid.every(positive),
      );
    }
  }
  ensure(Array.isArray(body.locks) && body.locks.length <= 4);
  prior = 2;
  for (const value of body.locks) {
    exact(value, ['fd', 'ownerPid', 'mode', 'device', 'inode', 'start', 'end']);
    ensure(integer(value.fd) && value.fd > prior && value.fd <= 6);
    prior = value.fd;
    ensure(
      positive(value.ownerPid) && decimal(value.device) && decimal(value.inode),
    );
    member(value.mode, ['READ', 'WRITE']);
    ensure(value.start === '0' && value.end === 'EOF');
  }
}

export function diagnosticPaths(root) {
  ensure(
    typeof root === 'string' &&
      /^\/tmp\/dec203-bootstrap-[A-Za-z0-9]{6}$/.test(root),
  );
  return Object.freeze([
    ...PROFILE.map((value) => value.path),
    ...SOURCE_NAMES.map((name) => join(DIRECTORY, name)),
    join(root, 'owner/receiving-lease-owner'),
    join(root, 'lease/receiving-lease.node'),
  ]);
}

export function validateDiagnostic(kind, body, id, paths, root) {
  if (kind === 'artifact') {
    exact(body, ['phase', 'role', 'artifact']);
    member(body.phase, ['owner', 'lease']);
    member(body.role, [
      'node',
      'compiler',
      'source',
      'support',
      'header',
      'output',
    ]);
    artifact(body.artifact, paths);
    const phase = PHASES[body.phase];
    const permitted = {
      node: [NODE],
      compiler: [COMPILER],
      source: [phase.source],
      support: SOURCE_NAMES.map((name) => join(DIRECTORY, name)).filter(
        (path) => path !== phase.source,
      ),
      header: body.phase === 'lease' ? HEADERS : [],
      output: [join(root, phase.directory, phase.basename)],
    };
    member(body.artifact.path, permitted[body.role]);
  } else if (kind === 'process') {
    exact(body, ['role', 'process']);
    member(body.role, [
      'owner-compiler',
      'owner',
      'coordinator',
      'lease-compiler',
    ]);
    processRecord(body.process, paths);
  } else if (kind === 'inventory') inventory(body, paths, root);
  else if (kind === 'compiler-terminal') {
    exact(body, [
      'phase',
      'process',
      'exitCode',
      'signal',
      'stdout',
      'stderr',
      'session',
    ]);
    ensure(body.phase === 'owner');
    processRecord(body.process, paths);
    validateWait({ exitCode: body.exitCode, signal: body.signal });
    member(body.stdout, ['eof', 'error', 'pending']);
    member(body.stderr, ['eof', 'error', 'pending']);
    member(body.session, ['absent', 'present', 'unavailable']);
  } else if (kind === 'frame') {
    exact(body, ['direction', 'frame']);
    validateFrame(body.frame, id, body.direction);
  } else {
    ensure(kind === 'local-terminal');
    exact(body, ['state', 'failureCode', 'ownerWait', 'input', 'channels']);
    member(body.state, ['closed', 'uncertain']);
    ensure(body.failureCode === null || ERRORS.includes(body.failureCode));
    if (body.state === 'uncertain') ensure(body.failureCode !== null);
    if (body.ownerWait !== null) validateWait(body.ownerWait, true);
    member(body.input, ['eof', 'error', 'pending']);
    exact(body.channels, [
      'ownerInput',
      'ownerStdout',
      'ownerStderr',
      'commands',
      'events',
    ]);
    for (const [key, value] of Object.entries(body.channels)) {
      member(
        value,
        key === 'ownerInput' || key === 'commands'
          ? ['finished', 'error', 'pending']
          : ['eof', 'error', 'pending'],
      );
    }
  }
}
