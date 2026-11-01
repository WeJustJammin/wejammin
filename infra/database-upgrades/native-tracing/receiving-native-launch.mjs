import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import * as artifacts from './receiving-bootstrap-artifacts.mjs';
import * as build from './receiving-bootstrap-build.mjs';
import { createDiagnostics } from './receiving-bootstrap-diagnostics.mjs';
import { diagnosticFailureCode } from './receiving-bootstrap-diagnostic-values.mjs';
import { createOwnerObserver } from './receiving-bootstrap-observe.mjs';
import * as owner from './receiving-bootstrap-owner.mjs';
import { entry } from './receiving-bootstrap-processes.mjs';
import * as profile from './receiving-bootstrap-profile.mjs';
import { cancelledOwnerTerminal } from './receiving-bootstrap-protocol.mjs';
import * as workspaces from './receiving-bootstrap-workspaces.mjs';

const retained = new Set();
let spent = false;
const turn = () =>
  new Promise((resolve) => {
    setImmediate(resolve);
  });
const fail = (record, error) => {
  record.failure ??= { error };
  record.closeDeadline ??= performance.now() + profile.SETTLEMENT_MILLISECONDS;
};

function emitTerminal(record, state) {
  record.diagnostics.terminal(
    state,
    state === 'uncertain'
      ? 'DEC203_SUPERVISOR_DRAIN_UNCERTAIN'
      : diagnosticFailureCode(record.failure),
    record.observer?.process('owner')?.process ?? null,
    record.input?.readable?.status() ?? 'pending',
    record.view?.snapshot() ?? null,
  );
}

async function hold(record) {
  record.uncertain = true;
  if (record.diagnostics !== null && !record.terminalEmitted) {
    record.terminalEmitted = true;
    try {
      emitTerminal(record, 'uncertain');
    } catch (error) {
      record.secondary.push(error);
    }
  }
  return new Promise(() => {});
}

function frames(record, closing = false) {
  const pending = record.pendingFrame !== null;
  const value = record.pendingFrame ?? owner.takeOwnerFrame(record.channel);
  if (value === null) return false;
  if (!pending) {
    record.pendingFrame = value;
    try {
      record.diagnostics.emit('frame', value);
    } catch (error) {
      fail(record, error);
    }
  }
  if (value.direction !== 'O_TO_C') {
    const frame = value.frame;
    if (closing) {
      if (frame.kind === 'CANCEL_ACK' && !record.cancelAcknowledged)
        record.cancelAcknowledged = true;
      else if (
        frame.kind === 'TERMINAL' &&
        record.cancelAcknowledged &&
        record.terminal === null
      )
        record.terminal = frame.body;
      else fail(record, artifacts.failure('DEC203_SUPERVISOR_PROTOCOL'));
    } else if (record.failure === null) {
      workspaces.assertWorkspace(record.workspace);
      if (frame.kind === 'HELLO' && record.stage === 0) {
        if (!record.view.present()) return false;
        record.observer ??= createOwnerObserver(
          record.view.child,
          record.info,
          record.output,
          record.id,
        );
        if (!record.observer.sample()) return false;
        record.diagnostics.observations(record.observer.take());
        record.stage = 1;
        owner.sendOwnerInit(record.channel);
      } else if (frame.kind === 'LEASE_READY' && record.stage === 1) {
        if (
          !record.view.initWritten() ||
          !record.observer.sample() ||
          record.observer.phase('owner-leased') === undefined
        )
          return false;
        record.diagnostics.observations(record.observer.take());
        record.stage = 2;
        record.startSpent = true;
        owner.sendOwnerStart(record.channel);
      } else if (frame.kind === 'ADOPTION_ACK' && record.stage === 2) {
        if (!record.view.startWritten()) return false;
        if (!record.observer.postAdoption()) return false;
        record.diagnostics.observations(record.observer.take());
        record.diagnostics.artifacts(
          'lease',
          record.info.inputs,
          artifacts.artifact(`${record.info.root}/lease/receiving-lease.node`),
        );
        record.stage = 3;
        record.normal = true;
      } else fail(record, artifacts.failure('DEC203_SUPERVISOR_PROTOCOL'));
    }
  }
  record.pendingFrame = null;
  return true;
}

function inspect(record) {
  const diagnosticFailure = record.diagnostics.failed();
  if (diagnosticFailure !== null) fail(record, diagnosticFailure);
  const channelFailure = record.view?.failure();
  if (channelFailure !== null && channelFailure !== undefined)
    fail(record, channelFailure.error);
}

async function close(record) {
  record.closeDeadline ??= performance.now() + profile.SETTLEMENT_MILLISECONDS;
  try {
    if (record.channel !== null) {
      try {
        owner.sendOwnerCancel(
          record.channel,
          record.normal
            ? 'close'
            : diagnosticFailureCode(record.failure) ===
                'DEC203_SUPERVISOR_TIMEOUT'
              ? 'timeout'
              : 'protocol',
        );
      } catch (error) {
        record.secondary.push(error);
      }
      owner.finishOwnerChannel(record.channel);
      const closed = await owner.awaitOwnerChannel(
        record.channel,
        record.closeDeadline,
      );
      if (record.view !== null) {
        while (frames(record, true)) {
          /* bounded actual frame queue */
        }
        inspect(record);
      }
      if (!closed) return await hold(record);
      if (record.startSpent && record.terminal?.state !== 'drained')
        return await hold(record);
      const wait = record.view?.wait.snapshot();
      if (record.normal) {
        if (
          !cancelledOwnerTerminal(
            record.cancelAcknowledged,
            record.terminal,
            wait,
          )
        )
          fail(
            record,
            artifacts.failure(
              record.terminal?.failure ?? 'DEC203_SUPERVISOR_FAILED',
            ),
          );
      } else if (wait?.spawned)
        artifacts.ensure(
          (wait.code === 1 && wait.signal === null) ||
            record.terminal?.state === 'drained',
        );
    }
    if (record.buildAttempted && record.build === null)
      return await hold(record);
    if (record.build !== null) {
      if (!(await record.build.closedBefore(record.closeDeadline)))
        return await hold(record);
    }
    if (
      record.inputAttempted &&
      (record.input === null ||
        !(await record.input.closedBefore(record.closeDeadline)))
    )
      return await hold(record);
    if (record.diagnostics !== null && record.diagnostics.failed() !== null)
      return await hold(record);
    if (record.ledger !== null)
      artifacts.assertInspectionLedgerClear(record.ledger);
    if (record.workspace !== null) workspaces.closeWorkspace(record.workspace);
    if (record.ledger !== null) artifacts.finishInspectionLedger(record.ledger);
    if (record.diagnostics !== null) {
      record.terminalEmitted = true;
      emitTerminal(record, 'closed');
      await record.diagnostics.settle(record.closeDeadline);
    }
    clearInterval(record.guard);
    record.guard = null;
    retained.delete(record);
  } catch (error) {
    fail(record, error);
    record.secondary.push(error);
    return await hold(record);
  }
  if (record.failure !== null) throw record.failure.error;
}

async function boot(record) {
  try {
    record.workspace = workspaces.reserveOwnerWorkspace();
    workspaces.initializeWorkspace(record.workspace);
    record.info = workspaces.workspaceInfo(record.workspace, 'owner');
    record.diagnostics = createDiagnostics(record.id, record.info.root);
    record.buildAttempted = true;
    record.build = build.startOwnerBuild(record.workspace);
    record.output = await record.build.readyBefore(
      record.diagnostics,
      record.deadline,
    );
    record.channel = owner.reserveOwnerChannel();
    owner.initializeOwnerChannel(record.channel, record.workspace, record.id);
    record.view = owner.ownerChannelView(record.channel);
    while (
      !record.normal &&
      record.failure === null &&
      performance.now() < record.deadline
    ) {
      inspect(record);
      if (record.failure !== null) break;
      if (record.observer !== null && record.stage === 2) {
        record.observer.sample();
        record.diagnostics.observations(record.observer.take());
      }
      frames(record);
      if (record.view.wait.snapshot().closed && !record.normal)
        fail(
          record,
          record.view.wait.snapshot().error ??
            artifacts.failure('DEC203_SUPERVISOR_FAILED'),
        );
      await turn();
    }
    if (record.failure === null)
      artifacts.ensure(record.normal, 'DEC203_SUPERVISOR_TIMEOUT');
  } catch (error) {
    fail(record, error);
  }
  await close(record);
}

async function main() {
  artifacts.ensure(!spent, 'DEC203_SUPERVISOR_REFUSED');
  spent = true;
  const record = artifacts.reservedEntryState();
  retained.add(record);
  record.guard = setInterval(() => {}, 2_147_483_647);
  let transferred = false;
  try {
    record.ledger = artifacts.reserveInspectionLedger();
    entry('owner');
    record.inputAttempted = true;
    record.input = build.readEntryInput();
    await record.input.settlement;
    const owned = {
      ...record,
      id: randomUUID(),
      deadline: performance.now() + profile.CONSTRUCTION_MILLISECONDS,
      info: null,
      output: null,
      pendingFrame: null,
      stage: 0,
      startSpent: false,
      normal: false,
      cancelAcknowledged: false,
      terminal: null,
    };
    retained.add(owned);
    record.guard = null;
    retained.delete(record);
    transferred = true;
    await boot(owned);
  } catch (error) {
    if (transferred) throw error;
    fail(record, error);
    await close(record);
  }
}

if (
  fileURLToPath(import.meta.url) === profile.LAUNCHER &&
  process.argv[1] === profile.LAUNCHER
) {
  main().catch(() => {
    process.exitCode = 1;
  });
}
