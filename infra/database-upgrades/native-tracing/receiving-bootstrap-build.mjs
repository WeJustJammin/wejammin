import { readlinkSync, statSync } from 'node:fs';
import * as artifacts from './receiving-bootstrap-artifacts.mjs';
import { startOwnerCompiler } from './receiving-bootstrap-compiler.mjs';
import { diagnosticFailureSignal } from './receiving-bootstrap-diagnostics.mjs';
import { captureProcess } from './receiving-bootstrap-processes.mjs';
import { createInputDecoder } from './receiving-bootstrap-protocol.mjs';
import {
  before,
  compilerStreamsClosed,
  watchChild,
  watchReadable,
} from './receiving-bootstrap-resources.mjs';
import {
  assertWorkspace,
  sealWorkspace,
  workspaceInfo,
} from './receiving-bootstrap-workspaces.mjs';

const { ensure } = artifacts;

export {
  before,
  watchChild,
  watchReadable,
  watchWritable,
} from './receiving-bootstrap-resources.mjs';

const retained = new Set();

export function assertPrecompile() {
  artifacts.ensure(arguments.length === 0, 'DEC203_SUPERVISOR_REFUSED');
  for (let number = 3; number <= 10; number += 1) {
    const path = `/proc/self/fd/${number}`;
    const before = statSync(path, { bigint: true });
    const target = readlinkSync(path);
    const info = artifacts.kernelText(`/proc/self/fdinfo/${number}`);
    const flags = /^flags:\s*([0-7]+)$/m.exec(info)?.[1];
    const ino = /^ino:\s*(0|[1-9][0-9]*)$/m.exec(info)?.[1];
    artifacts.ensure(
      flags !== undefined && ino !== undefined && BigInt(ino) === before.ino,
    );
    artifacts.ensure((BigInt(`0o${flags}`) & 0o2000000n) !== 0n);
    artifacts.ensure(
      artifacts.stamp(statSync(path, { bigint: true })) ===
        artifacts.stamp(before) && readlinkSync(path) === target,
    );
  }
}

export function startOwnerBuild(workspace) {
  const info = workspaceInfo(workspace, 'owner');
  const record = {
    workspace,
    compiler: null,
    child: null,
    stdout: null,
    stderr: null,
    process: null,
    failure: null,
    secondary: [],
    diagnostics: null,
    settled: false,
    ready: null,
    closing: null,
  };
  retained.add(record);
  record.compiler = startOwnerCompiler(workspace);
  record.child = watchChild(record.compiler.child);
  record.stdout = watchReadable(record.compiler.stdout);
  record.stderr = watchReadable(record.compiler.stderr);
  try {
    record.process = captureProcess(
      record.compiler.child.pid,
      info.root,
      info.inputs,
    );
    ensure(
      record.process.process.ppid === process.pid &&
        record.process.group === record.process.process.pid &&
        record.process.process.session === record.process.process.pid,
    );
  } catch (error) {
    record.failure = { error };
  }
  const settlement = (async () => {
    try {
      try {
        record.diagnostics = await record.compiler.settlement;
      } catch (error) {
        record.diagnostics = error?.diagnostics ?? null;
        if (record.failure !== null) {
          record.secondary.push(error);
          throw record.failure.error;
        }
        record.failure = { error };
        throw error;
      }
      ensure(
        record.stdout?.status() === 'eof' && record.stderr?.status() === 'eof',
      );
      ensure(
        record.child.snapshot().closed &&
          record.child.snapshot().code === 0 &&
          record.child.snapshot().signal === null,
      );
      if (record.failure !== null) throw record.failure.error;
      assertWorkspace(workspace);
      return Object.freeze({
        output: sealWorkspace(workspace),
        process: record.process.process,
        diagnostics: record.diagnostics,
      });
    } finally {
      record.settled = true;
    }
  })();
  settlement.catch(() => {});
  const closed = () => {
    const complete =
      record.settled &&
      record.diagnostics?.drainProven === true &&
      compilerStreamsClosed(record.child, record.stdout, record.stderr);
    if (complete) retained.delete(record);
    return complete;
  };
  const view = Object.freeze({
    compiler: record.compiler,
    child: record.child,
    stdout: record.stdout,
    stderr: record.stderr,
    process: record.process,
    settlement,
    readyBefore(diagnostics, deadline) {
      ensure(arguments.length === 2, 'DEC203_SUPERVISOR_REFUSED');
      const failed = diagnosticFailureSignal(diagnostics);
      if (record.ready !== null) return record.ready;
      record.ready = (async () => {
        if (record.process !== null)
          diagnostics.emit('process', {
            role: 'owner-compiler',
            process: record.process.process,
          });
        const ready = Promise.race([settlement, failed]);
        ready.catch(() => {});
        ensure(await before(ready, deadline), 'DEC203_SUPERVISOR_TIMEOUT');
        const output = (await ready).output;
        diagnostics.emit('compiler-terminal', view.terminal());
        diagnostics.artifacts('owner', info.inputs, output);
        assertWorkspace(workspace);
        return output;
      })();
      record.ready.catch(() => {});
      return record.ready;
    },
    closedBefore(deadline) {
      ensure(arguments.length === 1, 'DEC203_SUPERVISOR_REFUSED');
      if (record.closing !== null) return record.closing;
      record.closing = (async () =>
        (await before(
          settlement.catch(() => {}),
          deadline,
        )) && closed())();
      record.closing.catch(() => {});
      return record.closing;
    },
    terminal() {
      ensure(
        record.settled && record.process !== null,
        'DEC203_SUPERVISOR_DRAIN_UNCERTAIN',
      );
      const child = record.child.snapshot();
      return Object.freeze({
        phase: 'owner',
        process: record.process.process,
        exitCode: child.code,
        signal: child.signal,
        stdout: record.stdout?.status() ?? 'pending',
        stderr: record.stderr?.status() ?? 'pending',
        session:
          record.diagnostics?.drainProven === true ? 'absent' : 'unavailable',
      });
    },
    closed,
  });
  return view;
}

let inputAttempted = false;

export function readEntryInput() {
  ensure(
    arguments.length === 0 && !inputAttempted,
    'DEC203_SUPERVISOR_REFUSED',
  );
  inputAttempted = true;
  const record = { stream: null, ended: false, failure: null, closing: null };
  retained.add(record);
  record.stream = process.stdin;
  const readable = watchReadable(record.stream);
  const decoder = createInputDecoder();
  const fail = (error) => {
    record.failure ??= { error };
  };
  const settlement = new Promise((resolve, reject) => {
    record.stream.on('error', (error) => {
      fail(error);
      reject(record.failure.error);
    });
    record.stream.once('end', () => {
      record.ended = true;
      if (record.failure === null) {
        try {
          decoder.end();
        } catch (error) {
          fail(error);
        }
      }
      if (record.failure !== null) reject(record.failure.error);
      else resolve();
    });
    record.stream.once('close', () => {
      if (!record.ended) {
        try {
          ensure(false, 'DEC203_SUPERVISOR_HISTORY_GAP');
        } catch (error) {
          fail(error);
        }
        reject(record.failure.error);
      }
      retained.delete(record);
    });
    record.stream.on('data', (bytes) => {
      if (record.failure !== null) return;
      try {
        decoder.feed(bytes);
      } catch (error) {
        fail(error);
      }
    });
  });
  settlement.catch(() => {});
  return Object.freeze({
    stream: record.stream,
    readable,
    settlement,
    closedBefore(deadline) {
      ensure(arguments.length === 1, 'DEC203_SUPERVISOR_REFUSED');
      if (record.closing !== null) return record.closing;
      record.closing = (async () =>
        (await before(readable.done, deadline)) && readable.closed())();
      record.closing.catch(() => {});
      return record.closing;
    },
  });
}
