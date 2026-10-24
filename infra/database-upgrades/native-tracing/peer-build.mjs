import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readdirSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { failure } from './peer-artifacts.mjs';

const BUILD_MILLISECONDS = 30_000;
const SETTLEMENT_MILLISECONDS = 5_000;
const SOURCE = fileURLToPath(new URL('./peer-credentials.c', import.meta.url));
// Unproved settlement retains the actual child, streams, fence and owned artifacts.
const pendingCompilers = new Set();

function processIdentity(pid) {
  const text = readFileSync('/proc/' + pid + '/stat', 'utf8');
  const boundary = text.lastIndexOf(')');
  const fields = text
    .slice(boundary + 2)
    .trim()
    .split(/\s+/);
  if (
    boundary < 0 ||
    Number(text.slice(0, text.indexOf(' '))) !== pid ||
    fields.length < 20 ||
    !/^[0-9]+$/.test(fields[19]) ||
    [1, 2, 3].some(
      (index) =>
        !/^[0-9]+$/.test(fields[index]) ||
        !Number.isSafeInteger(Number(fields[index])),
    )
  ) {
    throw failure('DEC203_COMPILER_FAILED');
  }
  return {
    pid,
    parent: Number(fields[1]),
    group: Number(fields[2]),
    session: Number(fields[3]),
    start: fields[19],
    uid: lstatSync('/proc/' + pid).uid,
  };
}

function sameCompiler(expected, actual) {
  return (
    expected !== null &&
    /^[1-9][0-9]*$/.test(expected.start) &&
    actual.pid === expected.pid &&
    actual.parent === process.pid &&
    actual.group === expected.pid &&
    actual.session === expected.pid &&
    actual.start === expected.start &&
    actual.uid === process.getuid()
  );
}

function sessionAbsent(session) {
  for (const name of readdirSync('/proc')) {
    if (!/^[1-9][0-9]*$/.test(name)) continue;
    try {
      if (processIdentity(Number(name)).session === session) return false;
    } catch (error) {
      if (error.code !== 'ENOENT' && error.code !== 'ESRCH') throw error;
    }
  }
  return true;
}

function observeStream(stream) {
  const hash = createHash('sha256');
  const state = { bytes: 0, failed: stream === null || stream === undefined };
  state.done = new Promise((resolve) => {
    if (!stream) {
      resolve();
      return;
    }
    stream.on('data', (bytes) => {
      state.bytes += bytes.length;
      hash.update(bytes);
    });
    stream.on('error', () => {
      state.failed = true;
    });
    stream.once('close', resolve);
  });
  state.evidence = () =>
    Object.freeze({
      bytes: state.bytes,
      sha256: hash.copy().digest('hex'),
    });
  return state;
}

async function within(promise, milliseconds) {
  let timer;
  try {
    return await Promise.race([
      promise.then(() => true),
      new Promise((resolve) => {
        timer = setTimeout(() => resolve(false), Math.max(0, milliseconds));
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function absenceBefore(session, deadline) {
  while (performance.now() < deadline) {
    if (sessionAbsent(session)) return true;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  return false;
}

function killFencedCompiler(child, fence, exited) {
  if (exited || fence === null) return false;
  try {
    if (!sameCompiler(fence, processIdentity(child.pid))) return false;
    process.kill(-child.pid, 'SIGKILL');
    return true;
  } catch {
    return false;
  }
}

function spawnCompiler({ compiler, includeDirectory, output, run }) {
  const args = [
    '-std=c11',
    '-O2',
    '-fPIC',
    '-shared',
    '-DNAPI_VERSION=8',
    '-Wall',
    '-Wextra',
    '-Werror',
    '-I',
    includeDirectory,
    SOURCE,
    '-o',
    output.path,
  ];
  try {
    return spawn(compiler, args, {
      cwd: run.path,
      detached: true,
      shell: false,
      env: {
        PATH: '/usr/bin:/bin',
        LANG: 'C',
        LC_ALL: 'C',
        TZ: 'UTC',
        TMPDIR: run.path,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch {
    const error = failure('DEC203_COMPILER_FAILED');
    error.diagnostics = Object.freeze({ drainProven: true, spawnFailed: true });
    throw error;
  }
}

function observeCompiler(child, run, output) {
  const stdout = observeStream(child.stdout);
  const stderr = observeStream(child.stderr);
  const state = { exited: false, spawnFailed: false, code: null, signal: null };
  const closed = new Promise((resolve) => {
    child.on('error', () => {
      state.spawnFailed = true;
    });
    child.once('exit', () => {
      state.exited = true;
    });
    child.once('close', (code, signal) => {
      state.code = code;
      state.signal = signal;
      resolve();
    });
  });
  let fence = null;
  try {
    if (Number.isSafeInteger(child.pid)) {
      const observed = processIdentity(child.pid);
      if (sameCompiler(observed, observed)) fence = observed;
    }
  } catch {
    // No signal is authorized without an observed live session/start identity.
  }
  const pending = { child, stdout, stderr, state, fence, closed, run, output };
  pendingCompilers.add(pending);
  return pending;
}

async function drainCompiler(pending) {
  const { child, closed, stdout, stderr, fence, state } = pending;
  const completed = await within(closed, BUILD_MILLISECONDS);
  const signalled =
    !completed && killFencedCompiler(child, fence, state.exited);
  const deadline = performance.now() + SETTLEMENT_MILLISECONDS;
  let drainProven = false;
  try {
    const settled = await within(
      Promise.all([closed, stdout.done, stderr.done]),
      deadline - performance.now(),
    );
    if (settled) {
      drainProven =
        fence !== null
          ? await absenceBefore(fence.session, deadline)
          : state.spawnFailed && !Number.isSafeInteger(child.pid);
    }
  } catch {
    drainProven = false;
  }
  if (drainProven) pendingCompilers.delete(pending);
  return Object.freeze({
    timedOut: !completed,
    signalled,
    drainProven,
    spawnFailed: state.spawnFailed,
    exitCode: state.code,
    exitSignal: state.signal,
    stdout: stdout.evidence(),
    stderr: stderr.evidence(),
  });
}

export async function compilePeer(options) {
  const pending = observeCompiler(
    spawnCompiler(options),
    options.run,
    options.output,
  );
  const diagnostics = await drainCompiler(pending);
  if (
    diagnostics.timedOut ||
    !diagnostics.drainProven ||
    diagnostics.spawnFailed ||
    diagnostics.exitCode !== 0 ||
    diagnostics.exitSignal !== null ||
    pending.stdout.failed ||
    pending.stderr.failed
  ) {
    const error = failure('DEC203_COMPILER_FAILED');
    error.diagnostics = diagnostics;
    throw error;
  }
  return diagnostics;
}
