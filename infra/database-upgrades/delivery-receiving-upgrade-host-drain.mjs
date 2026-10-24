import { Buffer } from 'node:buffer';

import {
  exactKeys,
  positivePid,
  requireFact,
} from './delivery-receiving-upgrade-target.mjs';

export function launchReset(deps, request) {
  const child = deps.process.spawn(
    request.command.command,
    [...request.command.args],
    {
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...deps.binding.environment },
      cwd: request.target.workdir,
    },
  );
  requireFact(
    positivePid(child?.pid) &&
      typeof child?.on === 'function' &&
      typeof child?.once === 'function' &&
      child.stdin &&
      child.stdout &&
      child.stderr &&
      typeof child.kill === 'function',
    'invalid injected native child',
  );
  const capture = {
    child,
    closed: false,
    status: null,
    signal: null,
    failure: undefined,
  };
  const stdout = [];
  const stderr = [];
  const timers = new Set();
  let size = 0;
  function timer(callback, delay) {
    const id = deps.clock.setTimeout(() => {
      timers.delete(id);
      callback();
    }, delay);
    timers.add(id);
  }
  function abort(error) {
    capture.failure ??= error;
    if (capture.closed) return;
    try {
      child.kill('SIGTERM');
      timer(() => {
        if (capture.closed) return;
        try {
          child.kill('SIGKILL');
        } catch (error) {
          capture.failure ??= error;
        }
      }, 2000);
    } catch (killError) {
      capture.failure ??= killError;
    }
  }
  function output(chunks, bytes) {
    if (capture.closed || capture.failure) return;
    try {
      const copied = Buffer.from(bytes);
      size += copied.length;
      if (size > 8 * 1024 * 1024)
        abort(new Error('DEC197: reset output limit'));
      else chunks.push(copied);
    } catch (error) {
      abort(error);
    }
  }
  capture.completion = new Promise((resolve) => {
    child.stdout.on('data', (bytes) => output(stdout, bytes));
    child.stderr.on('data', (bytes) => output(stderr, bytes));
    for (const emitter of [child, child.stdin, child.stdout, child.stderr])
      emitter.on('error', abort);
    child.once('close', (status, signal) => {
      capture.closed = true;
      capture.status = status;
      capture.signal = signal;
      for (const id of timers) {
        try {
          deps.clock.clearTimeout(id);
        } catch (error) {
          capture.failure ??= error;
        }
      }
      timers.clear();
      capture.stdout = Buffer.concat(stdout).toString('utf8');
      capture.stderr = Buffer.concat(stderr).toString('utf8');
      resolve(capture);
    });
    try {
      timer(() => abort(new Error('DEC197: owned reset timeout')), 60000);
      child.stdin.end();
    } catch (error) {
      abort(error);
    }
  });
  return capture;
}

async function missingProcess(fs, pid) {
  try {
    await fs.lstat(`/proc/${pid}/status`);
  } catch (error) {
    if (error?.code === 'ENOENT' || /^ENOENT /.test(error?.message ?? ''))
      return;
    throw error;
  }
  requireFact(false, 'owned historical PID still present; absence not proved');
}

export async function proveDrain(deps, capture, attribution) {
  requireFact(capture.closed, 'CLI has not closed');
  const child = capture.child;
  const descendants = await deps.process.observeProcessTree(child);
  requireFact(
    Array.isArray(descendants) && descendants.length === 0,
    'native descendants have not drained',
  );
  for (const process of attribution.processes)
    await missingProcess(deps.fs, process.pid);
  const daemon = await deps.process.observeDaemonWork(child);
  requireFact(
    exactKeys(daemon, ['execs', 'jobs']) &&
      Array.isArray(daemon.execs) &&
      daemon.execs.length === attribution.execs.length &&
      Array.isArray(daemon.jobs),
    'incomplete daemon drain observation',
  );
  attribution.execs.forEach((expected, index) => {
    const actual = daemon.execs[index];
    requireFact(
      exactKeys(actual, ['Id', 'ContainerID', 'Running', 'ExitCode', 'Pid']) &&
        actual.Id === expected.Id &&
        actual.ContainerID === expected.ContainerID &&
        actual.Running === false &&
        actual.ExitCode === 0 &&
        actual.Pid === 0,
      'owned Docker exec has not drained',
    );
  });
  const jobs = new Set();
  for (const job of daemon.jobs) {
    requireFact(
      exactKeys(job, ['Id', 'Running', 'ExitCode']) &&
        typeof job.Id === 'string' &&
        job.Id.length > 0 &&
        !jobs.has(job.Id) &&
        job.Running === false &&
        job.ExitCode === 0,
      'daemon init work has not drained',
    );
    jobs.add(job.Id);
  }
  const backends = await deps.process.observeBackends(child);
  // Absence of the entire independently observed superset, not ownership by appname.
  requireFact(
    Array.isArray(backends) && backends.length === 0,
    'PostgreSQL backend absence not proved',
  );
}
