import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { token } from './dec203-peer-harness.mjs';
import {
  childrenNow,
  compilerRecord,
  sameCompiler,
  sessionAbsent,
} from './dec203-peer-process-observer.mjs';

async function until(observe, milliseconds, label) {
  const deadline = performance.now() + milliseconds;
  do {
    if (observe()) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  } while (performance.now() < deadline);
  assert.fail(label);
}

async function within(promise, milliseconds, label) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(label)), milliseconds);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function terminalDiagnostics(error) {
  assert.ok(error instanceof Error);
  token('DEC203_COMPILER_FAILED')(error);
  assert.equal(error.cleanupFailed, undefined);
  const diagnostics = error.diagnostics;
  assert.deepEqual(Object.keys(diagnostics).sort(), [
    'drainProven',
    'exitCode',
    'exitSignal',
    'signalled',
    'spawnFailed',
    'stderr',
    'stdout',
    'timedOut',
  ]);
  assert.ok(Object.isFrozen(diagnostics));
  assert.equal(diagnostics.timedOut, true);
  assert.equal(diagnostics.signalled, true);
  assert.equal(diagnostics.drainProven, true);
  assert.equal(diagnostics.spawnFailed, false);
  assert.equal(diagnostics.exitCode, null);
  assert.equal(diagnostics.exitSignal, 'SIGKILL');
  for (const name of ['stdout', 'stderr']) {
    const stream = diagnostics[name];
    assert.deepEqual(Object.keys(stream).sort(), ['bytes', 'sha256']);
    assert.ok(Object.isFrozen(stream));
    assert.ok(Number.isSafeInteger(stream.bytes) && stream.bytes >= 0);
    assert.match(stream.sha256, /^[0-9a-f]{64}$/);
    if (stream.bytes === 0) {
      assert.equal(
        stream.sha256,
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      );
    }
  }
}

export function registerProcessCases(native) {
  native(
    'DEC203-B008 actual compiler timeout kills and drains its owned session',
    async (f) => {
      const before = new Set(childrenNow());
      const started = performance.now();
      const errors = [];
      let fence;
      let paused = false;
      let settlement;
      let finalization;

      async function finishOnce() {
        const failures = [];
        if (paused && fence) {
          try {
            const actual = compilerRecord(fence.pid, f.options.compilerPath);
            sameCompiler(fence, actual);
            if (actual.state === 'T' || actual.state === 't') {
              process.kill(fence.pid, 'SIGCONT');
            }
            paused = false;
          } catch (error) {
            if (error.code !== 'ENOENT' && error.code !== 'ESRCH')
              failures.push(error);
          }
        }
        let outcome;
        try {
          outcome = await within(
            settlement,
            45_000,
            'actual compiler settlement unproved',
          );
        } catch (error) {
          failures.push(error);
        }
        if (!fence) {
          failures.push(
            new Error(
              'compiler identity unavailable; cleanup ownership unproved',
            ),
          );
        }
        if (fence) {
          try {
            await until(
              () => sessionAbsent(fence.session),
              5_000,
              'owned compiler session absence unproved',
            );
          } catch (error) {
            failures.push(error);
          }
        }
        if (
          outcome &&
          Object.hasOwn(outcome, 'error') &&
          outcome.error?.diagnostics?.drainProven !== true
        ) {
          failures.push(
            new Error('actual compiler stream/session drain unproved'),
          );
        }
        if (outcome?.reader && failures.length === 0) {
          try {
            await outcome.reader.close();
          } catch (error) {
            failures.push(error);
          }
        }
        if (failures.length)
          throw new AggregateError(failures, 'owned compiler cleanup refused');
      }

      function finish() {
        finalization ??= finishOnce();
        return finalization;
      }
      f.defer(finish);
      try {
        settlement = f.build().then(
          (reader) => {
            const index = f.readers.indexOf(reader);
            assert.ok(
              index >= 0,
              'adopt only the exact returned fixture reader',
            );
            f.readers.splice(index, 1);
            return { reader };
          },
          (error) => ({ error }),
        );
        const added = childrenNow().filter((pid) => !before.has(pid));
        assert.equal(
          added.length,
          1,
          'sole new direct compiler child required',
        );
        fence = compilerRecord(added[0], f.options.compilerPath);
        const actual = compilerRecord(fence.pid, f.options.compilerPath);
        sameCompiler(fence, actual);
        assert.ok(!['T', 't', 'Z', 'X', 'x'].includes(actual.state));
        // Final live fence and positive-PID pause are synchronous: no await here.
        process.kill(fence.pid, 'SIGSTOP');
        paused = true;
        await until(
          () => {
            const stopped = compilerRecord(fence.pid, f.options.compilerPath);
            sameCompiler(fence, stopped);
            return stopped.state === 'T' || stopped.state === 't';
          },
          1_000,
          'owned compiler stop not observed',
        );
        const outcome = await within(
          settlement,
          40_000,
          'compiler deadline did not settle',
        );
        const elapsed = performance.now() - started;
        assert.deepEqual(
          Object.keys(outcome),
          ['error'],
          'timeout returns no capability',
        );
        terminalDiagnostics(outcome.error);
        assert.ok(
          elapsed >= 29_900 && elapsed < 40_000,
          'real monotonic thirty-second timeout',
        );
        assert.ok(
          sessionAbsent(fence.session),
          'independent owned-session absence',
        );
        assert.equal(f.readers.length, 0, 'no reader registered after timeout');
      } catch (error) {
        errors.push(error);
      } finally {
        try {
          await finish();
        } catch (error) {
          errors.push(error);
        }
      }
      if (errors.length === 1) throw errors[0];
      if (errors.length > 1)
        throw new AggregateError(errors, 'actual compiler timeout case failed');
      await assert.rejects(fs.lstat(`${f.run}/peer-credentials.node`), {
        code: 'ENOENT',
      });
      if ((await fs.readdir(f.run)).length) await f.retainRunResidue();
    },
  );
}
