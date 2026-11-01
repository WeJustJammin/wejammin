import { createRequire } from 'node:module';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import {
  assertInspectionLedgerClear,
  ensure,
  failure,
  finishInspectionLedger,
  reserveInspectionLedger,
} from './receiving-bootstrap-artifacts.mjs';
import {
  before,
  readEntryInput,
  watchChild,
  watchReadable,
} from './receiving-bootstrap-build.mjs';
import { startLeaseCompiler } from './receiving-bootstrap-compiler.mjs';
import { assertPrecompile } from './receiving-bootstrap-observe.mjs';
import { entry } from './receiving-bootstrap-processes.mjs';
import {
  DIRECTORY,
  SETTLEMENT_MILLISECONDS,
} from './receiving-bootstrap-profile.mjs';
import { validateNativeSettlement } from './receiving-bootstrap-protocol.mjs';
import { compilerStreamsClosed } from './receiving-bootstrap-resources.mjs';
import {
  assertWorkspace,
  closeWorkspace,
  initializeWorkspace,
  reserveLeaseWorkspace,
  sealWorkspace,
  workspaceInfo,
} from './receiving-bootstrap-workspaces.mjs';

const retained = new Set();
let spent = false;
const fail = (record, error) => {
  record.failure ??= { error };
};

function hold(record) {
  record.uncertain = true;
  record.secondary.push(failure('DEC203_SUPERVISOR_DRAIN_UNCERTAIN'));
  return new Promise(() => {});
}

function compilerClosed(record) {
  if (record.compiler === null) return !record.compilerAttempted;
  return (
    record.compilerSettled &&
    record.diagnostics?.drainProven === true &&
    compilerStreamsClosed(record.child, record.stdout, record.stderr)
  );
}

function createPreReadyLeaseConstruction() {
  const record = {
    guard: null,
    ledger: null,
    input: null,
    workspace: null,
    compiler: null,
    child: null,
    stdout: null,
    stderr: null,
    compilerAttempted: false,
    compilerSettled: false,
    diagnostics: null,
    nativeAttempted: false,
    native: null,
    closeMethod: null,
    nativeClose: null,
    nativeWork: null,
    closing: false,
    closeDeadline: null,
    closePromise: null,
    workPromise: null,
    failure: null,
    secondary: [],
    uncertain: false,
  };
  const own = (promise) => {
    promise.catch((error) => {
      fail(record, error);
    });
    return promise;
  };
  retained.add(record);
  record.guard = setInterval(() => {}, 2_147_483_647);
  record.ledger = reserveInspectionLedger();
  const issue = () => {
    ensure(
      !record.closing && !record.nativeAttempted,
      'DEC203_SUPERVISOR_CANCELLED',
    );
    assertWorkspace(record.workspace);
    assertPrecompile();
    const info = workspaceInfo(record.workspace, 'lease');
    const addon = createRequire(import.meta.url)(info.output.path);
    ensure(
      Reflect.ownKeys(addon).length === 1 &&
        Object.hasOwn(addon, 'adoptReceivingLease'),
    );
    const constructor = Object.getOwnPropertyDescriptor(
      addon,
      'adoptReceivingLease',
    );
    ensure(
      constructor !== undefined &&
        typeof constructor.value === 'function' &&
        constructor.value.length === 0,
    );
    assertWorkspace(record.workspace);
    record.nativeAttempted = true;
    record.native = Reflect.apply(constructor.value, addon, []);
    const descriptors = Object.getOwnPropertyDescriptors(record.native);
    record.closeMethod = descriptors.close?.value;
    if (descriptors.adopted?.value instanceof Promise)
      own(descriptors.adopted.value);
    ensure(
      Object.isFrozen(record.native) &&
        JSON.stringify(Reflect.ownKeys(record.native).sort()) ===
          JSON.stringify(['adopted', 'close', 'settle']),
    );
    for (const value of Object.values(descriptors))
      ensure(
        Object.hasOwn(value, 'value') &&
          value.writable === false &&
          value.configurable === false,
      );
    ensure(descriptors.adopted.value instanceof Promise);
    ensure(
      typeof record.closeMethod === 'function' &&
        record.closeMethod.length === 0,
    );
    ensure(
      typeof descriptors.settle.value === 'function' &&
        descriptors.settle.value.length === 0,
    );
    record.nativeWork = Reflect.apply(
      descriptors.settle.value,
      record.native,
      [],
    );
    ensure(record.nativeWork instanceof Promise);
    own(record.nativeWork);
    return descriptors;
  };
  const adopted = own(
    (async () => {
      ensure(
        fileURLToPath(import.meta.url) === `${DIRECTORY}/receiving-lease.mjs`,
        'DEC203_SUPERVISOR_REFUSED',
      );
      entry('lease');
      record.input = readEntryInput();
      assertPrecompile();
      await record.input.settlement;
      record.workspace = reserveLeaseWorkspace();
      initializeWorkspace(record.workspace);
      assertPrecompile();
      ensure(!record.closing, 'DEC203_SUPERVISOR_CANCELLED');
      record.compilerAttempted = true;
      record.compiler = startLeaseCompiler(record.workspace);
      record.child = watchChild(record.compiler.child);
      record.stdout = watchReadable(record.compiler.stdout);
      record.stderr = watchReadable(record.compiler.stderr);
      try {
        record.diagnostics = await record.compiler.settlement;
      } catch (error) {
        record.diagnostics = error?.diagnostics ?? null;
        throw error;
      } finally {
        record.compilerSettled = true;
      }
      ensure(
        compilerClosed(record) &&
          record.stdout?.status() === 'eof' &&
          record.stderr?.status() === 'eof',
      );
      assertPrecompile();
      assertWorkspace(record.workspace);
      sealWorkspace(record.workspace);
      const methods = issue();
      ensure(
        (await methods.adopted.value) === undefined,
        'DEC203_SUPERVISOR_PROTOCOL',
      );
      assertWorkspace(record.workspace);
    })(),
  );
  const settle = () => {
    if (record.workPromise !== null) return record.workPromise;
    record.workPromise = own(
      (async () => {
        await adopted;
        const value = await record.nativeWork;
        record.closeDeadline ??= performance.now() + SETTLEMENT_MILLISECONDS;
        ensure(
          Object.isFrozen(value) &&
            JSON.stringify(Reflect.ownKeys(value).sort()) ===
              JSON.stringify(['failure', 'state']),
        );
        validateNativeSettlement(value);
        if (
          value.failure !== null &&
          (value.state === 'uncertain' ||
            value.failure.code !== 'DEC203_SUPERVISOR_CANCELLED')
        )
          throw value.failure;
        ensure(
          value.state === 'work-terminal' &&
            value.failure?.code === 'DEC203_SUPERVISOR_CANCELLED',
          'DEC203_SUPERVISOR_PROTOCOL',
        );
        return value;
      })(),
    );
    return record.workPromise;
  };
  const close = () => {
    if (record.closePromise !== null) return record.closePromise;
    record.closing = true;
    record.closeDeadline ??= performance.now() + SETTLEMENT_MILLISECONDS;
    if (record.native !== null && typeof record.closeMethod === 'function') {
      try {
        record.nativeClose = Reflect.apply(
          record.closeMethod,
          record.native,
          [],
        );
        if (record.nativeClose instanceof Promise)
          record.nativeClose.catch((error) => {
            record.secondary.push(error);
          });
      } catch (error) {
        record.secondary.push(error);
      }
    }
    record.closePromise = own(
      (async () => {
        let nativeClosed = false;
        try {
          if (
            !(await before(
              adopted.catch(() => {}),
              record.closeDeadline,
            ))
          )
            return await hold(record);
          if (record.nativeClose instanceof Promise) {
            const closed = record.nativeClose.then((value) =>
              ensure(value === undefined),
            );
            closed.catch(() => {});
            nativeClosed = await before(closed, record.closeDeadline);
          }
          if (!compilerClosed(record)) return await hold(record);
          if (record.nativeAttempted && !nativeClosed)
            return await hold(record);
          if (!nativeClosed) return await hold(record);
          ensure(
            record.input?.readable !== null && record.input?.readable?.closed(),
            'DEC203_SUPERVISOR_DRAIN_UNCERTAIN',
          );
          assertInspectionLedgerClear(record.ledger);
          if (record.workspace !== null) closeWorkspace(record.workspace);
          finishInspectionLedger(record.ledger);
          clearInterval(record.guard);
          record.guard = null;
          retained.delete(record);
        } catch (error) {
          record.secondary.push(error);
          return await hold(record);
        }
        if (record.failure !== null) throw record.failure.error;
      })(),
    );
    return record.closePromise;
  };
  return (async () => {
    try {
      await adopted;
      await settle();
    } catch (error) {
      fail(record, error);
    }
    await close();
  })();
}

export async function runPreReadyLeaseConstruction() {
  ensure(!spent, 'DEC203_SUPERVISOR_REFUSED');
  spent = true;
  ensure(arguments.length === 0, 'DEC203_SUPERVISOR_REFUSED');
  await createPreReadyLeaseConstruction();
}
