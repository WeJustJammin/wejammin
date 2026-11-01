import { performance } from 'node:perf_hooks';
import { join } from 'node:path';
import { ensure, failure } from './receiving-bootstrap-artifacts.mjs';
import {
  diagnosticPaths,
  validateDiagnostic,
} from './receiving-bootstrap-diagnostic-values.mjs';
import {
  COMPILER,
  DIAGNOSTIC_RECORD_BYTES,
  DIAGNOSTIC_RECORD_COUNT,
  DIAGNOSTIC_TOTAL_BYTES,
  DIRECTORY,
  HEADERS,
  NODE,
  PHASES,
} from './receiving-bootstrap-profile.mjs';

const retained = new Set();
const records = new WeakMap();
let attempted = false;

export function diagnosticFailureSignal(view) {
  const record = records.get(view);
  ensure(
    arguments.length === 1 && record !== undefined,
    'DEC203_SUPERVISOR_REFUSED',
  );
  return record.signal;
}

export function createDiagnostics(bootstrapId, root) {
  ensure(!attempted, 'DEC203_SUPERVISOR_REFUSED');
  attempted = true;
  ensure(
    typeof bootstrapId === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
        bootstrapId,
      ),
  );
  const paths = diagnosticPaths(root);
  let rejectFailure;
  const signal = new Promise((_, reject) => {
    rejectFailure = reject;
  });
  signal.catch(() => {});
  const record = {
    seq: 0n,
    bytes: 0,
    count: 0,
    pending: new Set(),
    failure: null,
    closing: false,
    settlement: null,
    signal,
  };
  retained.add(record);
  const fail = (cause) => {
    if (record.failure === null) {
      record.failure = failure('DEC203_SUPERVISOR_HISTORY_GAP', cause);
      rejectFailure(record.failure);
    }
    return record.failure;
  };
  process.stdout.on('error', fail);
  process.stdout.on('close', () => {
    if (record.pending.size) fail(failure('DEC203_SUPERVISOR_DRAIN_UNCERTAIN'));
  });
  const emit = (kind, body) => {
    ensure(
      !record.closing && record.failure === null,
      'DEC203_SUPERVISOR_HISTORY_GAP',
    );
    try {
      validateDiagnostic(kind, body, bootstrapId, paths, root);
      const seq = record.seq + 1n;
      const bytes = Buffer.from(
        `${JSON.stringify({ v: 1, bootstrapId, seq: String(seq), kind, body })}\n`,
      );
      ensure(
        bytes.length <= DIAGNOSTIC_RECORD_BYTES &&
          record.count < DIAGNOSTIC_RECORD_COUNT &&
          record.bytes + bytes.length <= DIAGNOSTIC_TOTAL_BYTES,
        'DEC203_SUPERVISOR_HISTORY_GAP',
      );
      record.seq = seq;
      record.count += 1;
      record.bytes += bytes.length;
      const pending = new Promise((resolve, reject) => {
        process.stdout.write(bytes, (error) =>
          error ? reject(fail(error)) : resolve(),
        );
      });
      record.pending.add(pending);
      pending.then(
        () => record.pending.delete(pending),
        (error) => {
          fail(error);
        },
      );
    } catch (error) {
      throw fail(error);
    }
  };
  const view = Object.freeze({
    emit,
    artifacts(phase, inputs, output) {
      const source = PHASES[phase];
      const selected = [
        ['node', NODE],
        ['compiler', COMPILER],
        ['source', source.source],
        ...source.support.map((name) => ['support', join(DIRECTORY, name)]),
        ...(phase === 'lease' ? HEADERS.map((path) => ['header', path]) : []),
      ];
      for (const [role, path] of selected) {
        const observed = inputs.find((value) => value.path === path);
        ensure(observed !== undefined);
        emit('artifact', { phase, role, artifact: observed });
      }
      emit('artifact', { phase, role: 'output', artifact: output });
    },
    observations(values) {
      for (const value of values) emit(value.kind, value.body);
    },
    terminal(state, failureCode, owner, input, snapshot) {
      const wait = snapshot?.wait;
      emit('local-terminal', {
        state,
        failureCode,
        ownerWait:
          owner && wait?.closed
            ? {
                pid: owner.pid,
                startTime: owner.startTime,
                exitCode: wait.code,
                signal: wait.signal,
              }
            : null,
        input,
        channels: snapshot?.channels ?? {
          ownerInput: 'pending',
          ownerStdout: 'pending',
          ownerStderr: 'pending',
          commands: 'pending',
          events: 'pending',
        },
      });
    },
    failed: () => record.failure,
    settle(deadline) {
      if (record.settlement !== null) return record.settlement;
      record.closing = true;
      record.settlement = (async () => {
        ensure(Number.isFinite(deadline), 'DEC203_SUPERVISOR_REFUSED');
        let timer;
        try {
          const complete = await Promise.race([
            Promise.all([...record.pending]).then(() => true),
            new Promise((resolve) => {
              timer = setTimeout(
                () => resolve(false),
                Math.max(0, deadline - performance.now()),
              );
            }),
          ]);
          ensure(complete, 'DEC203_SUPERVISOR_DRAIN_UNCERTAIN');
          if (record.failure !== null) throw record.failure;
          retained.delete(record);
        } finally {
          clearTimeout(timer);
        }
      })();
      record.settlement.catch(() => {});
      return record.settlement;
    },
  });
  records.set(view, record);
  return view;
}
