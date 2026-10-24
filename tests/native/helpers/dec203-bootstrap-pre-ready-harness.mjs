import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import {
  Artifacts,
  input,
  launcher,
  node,
  repository,
} from './dec203-bootstrap-pre-ready-artifacts.mjs';
import { Diagnostics } from './dec203-bootstrap-pre-ready-diagnostics.mjs';
import {
  assertAbsent,
  assertSessionAbsent,
  observer,
} from './dec203-bootstrap-pre-ready-observe.mjs';

// Uncertainty keeps the actual ChildProcess, streams, observations and first error.
const retained = new Set();

function failure(record, error) {
  record.failure ??= error;
  if (record.errors.length < 16) record.errors.push(error);
}

function observeStream(record, stream, name) {
  const state = {
    available: stream !== null && stream !== undefined,
    ended: false,
    closed: false,
    failed: false,
    bytes: 0,
  };
  if (!state.available) return state;
  stream.on('error', (error) => {
    state.failed = true;
    failure(record, error);
  });
  stream.once('end', () => {
    state.ended = true;
  });
  stream.once('close', () => {
    state.closed = true;
  });
  stream.on('data', (bytes) => {
    state.bytes += bytes.length;
    if (name === 'stderr') return;
    if (record.diagnosticFailure) return;
    try {
      for (const value of record.diagnostics.push(bytes)) {
        if (value.kind === 'frame' && value.body.frame.kind === 'CANCEL') {
          record.closeDeadline ??= performance.now() + 5_000;
        }
      }
    } catch (error) {
      record.diagnosticFailure = true;
      failure(record, error);
    }
  });
  return state;
}

function attach(record) {
  const child = record.child;
  record.spawned = false;
  child.once('spawn', () => {
    record.spawned = true;
  });
  child.on('error', (error) => {
    record.spawnError ??= error;
    failure(record, error);
  });
  child.once('exit', (code, signal) => {
    record.exit = { code, signal };
  });
  child.once('close', (code, signal) => {
    record.actualClose = { code, signal };
    record.closed = true;
  });
  record.stdout = observeStream(record, child.stdout, 'stdout');
  record.stderr = observeStream(record, child.stderr, 'stderr');
  record.stdin = {
    available: child.stdin !== null && child.stdin !== undefined,
    finished: false,
    closed: false,
    failed: false,
  };
  if (!record.stdin.available) return;
  child.stdin.on('error', (error) => {
    record.stdin.failed = true;
    failure(record, error);
  });
  child.stdin.once('finish', () => {
    record.stdin.finished = true;
  });
  child.stdin.once('close', () => {
    record.stdin.closed = true;
  });
}

function failedBeforeSpawn(record) {
  const pid = record.child?.pid;
  return (
    record.closed &&
    !record.spawned &&
    record.spawnError !== undefined &&
    (!Number.isSafeInteger(pid) || pid <= 0)
  );
}

function closed(record) {
  const unallocated = failedBeforeSpawn(record);
  return (
    record.closed &&
    [record.stdout, record.stderr, record.stdin].every((state) =>
      state?.available
        ? state.closed
        : state?.available === false && unallocated,
    )
  );
}

async function awaitAutomaticClosure(record) {
  while (!closed(record)) {
    if (!record.observerFailed && Number.isSafeInteger(record.child?.pid)) {
      try {
        record.observer.sample();
      } catch (error) {
        record.observerFailed = true;
        failure(record, error);
      }
    }
    const deadline = Math.min(
      record.deadline,
      record.closeDeadline ?? Infinity,
    );
    if (performance.now() >= deadline) {
      const uncertain = new Error('DEC203_SUPERVISOR_DRAIN_UNCERTAIN');
      uncertain.code = 'DEC203_SUPERVISOR_DRAIN_UNCERTAIN';
      const primary = record.failure;
      failure(record, uncertain);
      if (primary) {
        throw new AggregateError(
          [primary, uncertain],
          'owned O closure unproved',
          { cause: primary },
        );
      }
      throw uncertain;
    }
    // Scheduling yield only; every accepted premise is an actual bracketed sample.
    await new Promise((resolve) => setImmediate(resolve));
  }
  try {
    if (!failedBeforeSpawn(record)) {
      assert.equal(record.spawned, true, 'actual successful O spawn');
      for (const state of [record.stdout, record.stderr, record.stdin])
        assert.equal(state.available, true);
      assert.equal(record.stdout.ended, true, 'actual O stdout EOF');
      assert.equal(record.stderr.ended, true, 'actual O stderr EOF');
      assert.equal(
        record.stdin.finished,
        true,
        'actual selected input write/end',
      );
      assert.equal(record.stdin.failed, false);
      for (const role of [
        'outer',
        'owner-compiler',
        'owner',
        'coordinator',
        'lease-compiler',
      ]) {
        assert.ok(
          record.observer.seen.processes.has(role),
          `owned ${role} absence premise required`,
        );
      }
    }
    record.observer.assertComplete();
    for (const info of record.observer.seen.processes.values())
      assertAbsent(info.process);
    for (const role of ['owner-compiler', 'lease-compiler']) {
      const value = record.observer.seen.processes.get(role);
      if (value) assertSessionAbsent(value.process.session);
    }
    record.provedClosed = true;
    retained.delete(record);
  } catch (error) {
    failure(record, error);
  }
  if (record.failure) throw record.failure;
}

export async function invoke(context) {
  const artifacts = new Artifacts();
  artifacts.preflight();
  const record = {
    artifacts,
    diagnostics: new Diagnostics(),
    errors: [],
    failure: null,
    closed: false,
    provedClosed: false,
    started: performance.now(),
  };
  record.deadline = record.started + 120_000;
  retained.add(record); // Reserve ownership before spawn or await.
  context.after(async () => {
    if (!record.provedClosed && record.settlement) await record.settlement;
  });
  let primary;
  try {
    record.child = spawn(node, ['--', launcher], {
      cwd: repository,
      env: { PATH: '/usr/bin:/bin', LANG: 'C', LC_ALL: 'C', TZ: 'UTC' },
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    attach(record);
    record.observer = observer(record.child, artifacts);
    if (record.stdin.available) {
      record.child.stdin.end(input, (error) => {
        if (error) failure(record, error);
      });
    }
    record.settlement = awaitAutomaticClosure(record);
    record.settlement.catch(() => {}); // Own rejection before any further await.
    await record.settlement;
    assert.deepEqual(record.actualClose, { code: 0, signal: null });
    assert.deepEqual(record.exit, { code: 0, signal: null });
    assert.equal(record.stdout.failed, false);
    assert.equal(record.stderr.failed, false);
    assert.equal(
      record.stderr.bytes,
      0,
      'stderr is drained, never used as raw evidence',
    );
    record.records = record.diagnostics.end();
    artifacts.recheckInputs();
  } catch (error) {
    primary = record.failure ?? error;
  } finally {
    // No TEST cancel command, signal, stream destruction, detach, unref or deletion.
    if (record.settlement) {
      try {
        await record.settlement;
      } catch (error) {
        primary ??= error;
      }
    } else if (record.child) {
      try {
        record.observer ??= observer(record.child, artifacts);
        record.settlement = awaitAutomaticClosure(record);
        record.settlement.catch(() => {});
        await record.settlement;
      } catch (error) {
        primary ??= error;
      }
    } else {
      retained.delete(record); // A synchronous no-ChildProcess failure allocated no child.
    }
  }
  if (primary) {
    try {
      const prefix = record.diagnostics.records;
      const compiler = prefix.findLast(
        (entry) => entry.kind === 'compiler-terminal',
      )?.body;
      context.diagnostic(
        JSON.stringify({
          debugOnly: true,
          validatedPrefixOnly: true,
          exit: record.exit ?? null,
          actualClose: record.actualClose ?? null,
          roles: [...(record.observer?.seen.processes.keys() ?? [])],
          kinds: prefix.map((entry) => entry.kind),
          localTerminal:
            prefix.findLast((entry) => entry.kind === 'local-terminal')?.body ??
            null,
          compilerTerminal: compiler
            ? {
                phase: compiler.phase,
                exitCode: compiler.exitCode,
                signal: compiler.signal,
                stdout: compiler.stdout,
                stderr: compiler.stderr,
                session: compiler.session,
              }
            : null,
        }),
      );
    } catch (error) {
      failure(record, error);
    }
    throw primary;
  }
  return record;
}
