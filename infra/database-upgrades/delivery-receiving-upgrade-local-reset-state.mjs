import { Buffer } from 'node:buffer';

import {
  assertIdentity,
  assertResetTransition,
  exactKeys,
  isRecord,
  requireFact,
} from './delivery-receiving-upgrade-target.mjs';
import {
  createResetCandidateObserver,
  createTargetGuard,
  requireOwnedResetPorts,
  SUPABASE,
} from './delivery-receiving-upgrade-local-target.mjs';
import { verifyApplied } from './delivery-receiving-upgrade-local-inventory.mjs';

export const resetIdentity = ({
  target,
  containerId,
  clusterId,
  databaseOid,
  owner,
}) => ({
  target,
  containerId,
  clusterId,
  databaseOid,
  owner,
});

export function freezeResetValue(value) {
  for (const child of Object.values(value))
    if (!Buffer.isBuffer(child) && (isRecord(child) || Array.isArray(child)))
      freezeResetValue(child);
  return Object.freeze(value);
}

export function createResetState({
  deps,
  plan,
  initial,
  first,
  snapshot,
  source,
  validate,
}) {
  const guard = createTargetGuard(deps);
  const candidate = createResetCandidateObserver(deps, first);
  const handles = new WeakSet();
  let current = first;
  let currentEntries = snapshot.baseline;
  let pending;
  let phase = 'ready';
  let recoveryAttempt;

  async function beforeMutation() {
    validate();
    const actual = await guard(plan, current);
    requireFact(
      JSON.stringify(actual.metadata) === JSON.stringify(current.metadata),
      'changed DB metadata envelope',
    );
  }

  async function begin(purpose) {
    const ports = requireOwnedResetPorts(deps.process);
    requireFact(!pending, 'owned reset already pending');
    requireFact(
      purpose === 'prefix'
        ? phase === 'ready'
        : ['case', 'recovery'].includes(phase),
      'invalid owned reset lifecycle',
    );
    await beforeMutation();
    await source();
    const entries = purpose === 'prefix' ? snapshot.prefix : snapshot.baseline;
    await verifyApplied(deps.process, plan, currentEntries);
    const request = freezeResetValue({
      command: {
        command: SUPABASE,
        args: ['db', 'reset', '--local', '--workdir', plan.target.workdir],
      },
      target: initial.target,
      priorIdentity: resetIdentity(current),
      fromEpoch: current.resetEpoch ?? null,
      purpose,
      sequence: purpose === 'prefix' ? 1 : 2,
      inventory: entries.map((entry) =>
        Object.freeze({
          ...entry,
          bytes: Buffer.from(entry.bytes),
        }),
      ),
      inventorySha256:
        purpose === 'prefix' ? snapshot.prefixSha256 : snapshot.baselineSha256,
      sourceSha256: plan.sourceSha256,
      witnessSha256: plan.witnessSha256,
      lease: initial.lease,
    });
    const handle = ports.beginOwnedReset(request);
    requireFact(
      isRecord(handle) &&
        typeof handle.then !== 'function' &&
        !handles.has(handle),
      'native reset must return an opaque registered handle',
    );
    handles.add(handle);
    pending = {
      request,
      handle,
      ports,
      entries,
      previous: current,
      priorEntries: currentEntries,
    };
    phase = 'pending';
    return pending;
  }

  async function observe(record, raw, staging, recovery = false) {
    validate();
    const identityKeys = [
      'target',
      'containerId',
      'clusterId',
      'databaseOid',
      'owner',
    ];
    requireFact(
      pending === record &&
        exactKeys(raw, [
          'status',
          'stdout',
          'stderr',
          'before',
          'after',
          'inventorySha256',
        ]) &&
        Number.isSafeInteger(raw.status) &&
        typeof raw.stdout === 'string' &&
        typeof raw.stderr === 'string' &&
        exactKeys(raw.before, identityKeys) &&
        exactKeys(raw.after, identityKeys) &&
        raw.inventorySha256 === record.request.inventorySha256,
      'unbound native reset completion',
    );
    assertIdentity(raw.before, plan.target, record.previous);
    requireFact(
      raw.before.owner === initial.owner,
      'changed prior reset owner',
    );
    const actual = await candidate(plan);
    assertIdentity(raw.after, plan.target, actual);
    requireFact(raw.after.owner === initial.owner, 'changed candidate owner');
    await source();
    if (record.stage) await staging.verify(record.stage);
    const unchanged =
      actual.containerId === record.previous.containerId &&
      actual.clusterId === record.previous.clusterId;
    await verifyApplied(
      deps.process,
      plan,
      recovery && unchanged ? record.priorEntries : record.entries,
    );
    return actual;
  }

  async function run(purpose, staging) {
    const record = await begin(purpose);
    try {
      record.stage = await staging.build(record.entries);
      await staging.install(record.stage);
      await beforeMutation();
      await source();
      await staging.verify(record.stage);
      const raw = await record.ports.completeOwnedReset(record.handle);
      requireFact(raw?.status === 0, 'owned CLI reset failed');
      const actual = await observe(record, raw, staging);
      const now = deps.clock.now();
      requireFact(
        Number.isSafeInteger(now) && now >= 0,
        'invalid injected clock',
      );
      const resetEpoch = `dec197-${plan.runId}-${plan.mode}-${now}-${record.request.sequence}`;
      const result = {
        ...resetIdentity(actual),
        resetEpoch,
        [purpose === 'prefix' ? 'prefixSha256' : 'baselineSha256']:
          record.request.inventorySha256,
        transition: {
          kind: 'DEC197_OWNED_RESET_V1',
          purpose,
          sequence: record.request.sequence,
          from: record.request.priorIdentity,
          to: resetIdentity(actual),
          fromEpoch: record.request.fromEpoch,
          toEpoch: resetEpoch,
          inventorySha256: record.request.inventorySha256,
          sourceSha256: plan.sourceSha256,
          witnessSha256: plan.witnessSha256,
        },
      };
      assertResetTransition(result, {
        plan,
        initial,
        previous: record.previous,
        purpose,
        sequence: record.request.sequence,
        inventorySha256: record.request.inventorySha256,
      });
      current = freezeResetValue({ ...actual, resetEpoch });
      currentEntries = record.entries;
      pending = undefined;
      phase = purpose === 'prefix' ? 'case' : 'baseline-complete';
      return freezeResetValue(result);
    } catch (error) {
      record.failed = true;
      record.failure = error;
      throw error;
    }
  }

  async function recover(staging) {
    const record = pending;
    requireFact(
      record?.request.purpose === 'prefix' &&
        record.failed &&
        !record.recoveryConsumed,
      'no failed owned prefix reset to recover',
    );
    record.recoveryConsumed = true;
    const raw = await record.ports.proveRecoveryOwnership(record.handle);
    const actual = await observe(record, raw, staging, true);
    recoveryAttempt = freezeResetValue({
      purpose: 'prefix',
      sequence: 1,
      from: record.request.priorIdentity,
      to: resetIdentity(actual),
      acceptedEpoch: null,
    });
    current = freezeResetValue({ ...actual, resetEpoch: null });
    currentEntries =
      actual.containerId === record.previous.containerId &&
      actual.clusterId === record.previous.clusterId
        ? record.priorEntries
        : record.entries;
    pending = undefined;
    phase = 'recovery';
  }

  async function restoreBaseline(staging) {
    requireFact(
      phase === 'case' || (phase === 'pending' && pending?.failed),
      'no outstanding validated reset attempt',
    );
    if (pending) await recover(staging);
    let result;
    let failure;
    let failed = false;
    const remember = (error) => {
      if (!failed) failure = error;
      failed = true;
    };
    try {
      result = await run('baseline', staging);
    } catch (error) {
      remember(error);
    }
    // Never mutate staging while an uncertain native operation remains pending.
    if (!pending) {
      try {
        await staging.restoreLink();
      } catch (error) {
        remember(error);
      }
      try {
        await staging.cleanup();
      } catch (error) {
        remember(error);
      }
    }
    if (failed) throw failure;
    phase = 'restored';
    return recoveryAttempt
      ? freezeResetValue({ ...result, recoveryAttempt })
      : result;
  }

  return {
    beforeMutation,
    resetBefore: (staging) => run('prefix', staging),
    restoreBaseline,
    restored: () => phase === 'restored',
  };
}
