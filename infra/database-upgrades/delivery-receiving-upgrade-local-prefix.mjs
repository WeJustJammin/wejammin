import {
  requireFact,
  assertIdentity,
} from './delivery-receiving-upgrade-target.mjs';
import {
  createTargetGuard,
  dependencies,
  SUPABASE,
} from './delivery-receiving-upgrade-local-target.mjs';
import {
  discover,
  readRegular,
  validatePlan,
  verifyApplied,
} from './delivery-receiving-upgrade-local-inventory.mjs';
import { createStaging } from './delivery-receiving-upgrade-local-staging.mjs';
import {
  createResetState,
  freezeResetValue,
  resetIdentity,
} from './delivery-receiving-upgrade-local-reset-state.mjs';
const planKey = (plan) =>
  JSON.stringify([
    plan.repository,
    plan.runId,
    plan.mode,
    plan.applicationName,
    plan.source.path,
    plan.sourceSha256,
    plan.witnessSha256,
    plan.prefixSha256,
  ]);

export function createLocalPrefixAdapter(options) {
  const deps = dependencies(options);
  const guard = createTargetGuard(deps);
  let state;
  let busy = false;

  function exclusive(operation) {
    return async (...args) => {
      requireFact(!busy, 'local prefix operation already active');
      busy = true;
      try {
        return await operation(...args);
      } finally {
        busy = false;
      }
    };
  }

  function authority(plan, attestation) {
    validatePlan(plan);
    requireFact(
      state && state.key === planKey(plan),
      'unknown preflight authority',
    );
    assertIdentity(attestation, plan.target, state.first);
    requireFact(
      attestation.owner === state.first.owner &&
        attestation.prefixSha256 === state.snapshot.prefixSha256 &&
        attestation.baselineSha256 === state.snapshot.baselineSha256 &&
        attestation.lease?.ownerPid === deps.lease.ownerPid,
      'forged attestation',
    );
    const keys = ['ownerPid', 'path', 'fd', 'dev', 'inode', 'mode'];
    requireFact(
      attestation.lease.locks?.length === 4 &&
        deps.lease.locks.every((lock, index) =>
          keys.every(
            (key) => attestation.lease.locks[index]?.[key] === lock[key],
          ),
        ),
      'forged lease authority',
    );
  }

  async function recheckSource(plan) {
    validatePlan(plan);
    requireFact(state?.key === planKey(plan), 'changed case plan');
    const actual = await discover(deps.fs, plan);
    requireFact(
      actual.fingerprint === state.snapshot.fingerprint,
      'source/seed/config inventory drift',
    );
    return actual;
  }

  async function preparePrefix(plan) {
    validatePlan(plan);
    requireFact(
      !state || state.renewal.restored(),
      'case already has active preflight',
    );
    const observed = await guard(plan);
    const first = freezeResetValue({
      ...observed,
      metadata: JSON.parse(JSON.stringify(observed.metadata)),
    });
    const snapshot = await discover(deps.fs, plan);
    await readRegular(deps.fs, SUPABASE);
    await verifyApplied(deps.process, plan, snapshot.baseline);
    const initial = freezeResetValue({
      ...resetIdentity(first),
      prefixSha256: snapshot.prefixSha256,
      baselineSha256: snapshot.baselineSha256,
      lease: deps.lease,
    });
    state = { key: planKey(plan), first, snapshot, initial };
    state.renewal = createResetState({
      deps,
      plan,
      initial,
      first,
      snapshot,
      source: () => recheckSource(plan),
      validate: () => {
        validatePlan(plan);
        requireFact(state?.key === planKey(plan), 'changed case plan');
      },
    });
    state.staging = await createStaging(
      deps.fs,
      plan,
      state.renewal.beforeMutation,
    );
    return initial;
  }

  async function resetBefore(plan, attestation) {
    authority(plan, attestation);
    return state.renewal.resetBefore(state.staging);
  }

  async function restoreBaseline(plan, attestation) {
    authority(plan, attestation);
    return state.renewal.restoreBaseline(state.staging);
  }

  return {
    preparePrefix: exclusive(preparePrefix),
    resetBefore: exclusive(resetBefore),
    restoreBaseline: exclusive(restoreBaseline),
  };
}
