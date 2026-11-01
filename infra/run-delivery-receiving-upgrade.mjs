import {
  assertCommittedReceivingCatalog,
  assertUpgradePlan,
  buildPsqlInvocation,
  classifyMigrationOutcome,
  compareRollback,
} from './database-upgrades/delivery-receiving-upgrade-plan.mjs';
import {
  assertHistoricalWorld,
  requireDocument,
  snapshotSha256,
  stableText,
} from './database-upgrades/delivery-receiving-upgrade-snapshot.mjs';
import {
  assertAttestation,
  assertEnvelope,
  assertIdentity,
  assertResetTransition,
  exactKeys,
  positivePid,
  requireFact,
} from './database-upgrades/delivery-receiving-upgrade-target.mjs';

const STEPS = [
  'preparePrefix',
  'resetBefore',
  'setupWorld',
  'observe',
  'executeMigration',
  'restoreBaseline',
  'writeReceipt',
];

function ownedData(value) {
  const copy = JSON.parse(stableText(value));
  const freeze = (item) => {
    if (item !== null && typeof item === 'object') {
      Object.values(item).forEach(freeze);
      Object.freeze(item);
    }
    return item;
  };
  return freeze(copy);
}

function observer(value, plan, first, reset) {
  assertEnvelope(value, plan, first, reset);
  requireDocument(value.document);
  requireFact(
    value.document.observer.database === plan.target.database,
    'observer database mismatch',
  );
  return value.document;
}

function uniqueSessions(...pids) {
  requireFact(
    pids.every(positivePid) && new Set(pids).size === pids.length,
    'setup, observers and migration require distinct backend sessions',
  );
}

const identity = ({ target, containerId, clusterId, databaseOid, owner }) => ({
  target,
  containerId,
  clusterId,
  databaseOid,
  owner,
});

function recoveryPrevious(restored, plan, initial) {
  const attempt = restored.recoveryAttempt;
  requireFact(
    exactKeys(attempt, [
      'purpose',
      'sequence',
      'from',
      'to',
      'acceptedEpoch',
    ]) &&
      attempt.purpose === 'prefix' &&
      attempt.sequence === 1 &&
      attempt.acceptedEpoch === null &&
      exactKeys(attempt.from, Object.keys(identity(initial))) &&
      exactKeys(attempt.to, Object.keys(identity(initial))),
    'missing failed-reset recovery diagnostic',
  );
  assertIdentity(attempt.from, plan.target, initial);
  requireFact(attempt.from.owner === initial.owner, 'recovery owner mismatch');
  return { ...attempt.to, resetEpoch: null };
}

/**
 * Injected orchestration only. There is intentionally no CLI/default adapter,
 * filesystem, process, environment, network or database access in this module.
 */
export async function runReceivingUpgrade({ io, plan: supplied } = {}) {
  const plan = assertUpgradePlan(supplied);
  requireFact(
    io && STEPS.every((step) => typeof io[step] === 'function'),
    'complete injected I/O required',
  );
  // The first read-only attestation pins identity; no planned/caller ID is authority.
  const attestation = ownedData(await io.preparePrefix(plan));
  assertAttestation(attestation, plan);
  assertUpgradePlan(plan);
  let attemptedReset = false;
  let reset;
  let receipt;
  let primary;
  try {
    // Mark BEFORE awaiting: a thrown reset can have changed the target already.
    attemptedReset = true;
    const candidate = ownedData(await io.resetBefore(plan, attestation));
    assertResetTransition(candidate, {
      plan,
      initial: attestation,
      previous: attestation,
      purpose: 'prefix',
      sequence: 1,
      inventorySha256: plan.prefixSha256,
    });
    reset = candidate;
    assertUpgradePlan(plan);
    const setup = ownedData(await io.setupWorld(plan, reset));
    assertEnvelope(setup, plan, reset, reset);
    assertUpgradePlan(plan);
    const before = observer(
      ownedData(await io.observe('before', plan, reset)),
      plan,
      reset,
      reset,
    );
    assertHistoricalWorld(before, setup, plan.mode);
    uniqueSessions(setup.backendPid, before.observer.backendPid);
    assertUpgradePlan(plan);
    const invocation = buildPsqlInvocation({ ...plan, script: plan.witness });
    const execution = ownedData(
      await io.executeMigration(invocation, plan, reset),
    );
    assertEnvelope(execution, plan, reset, reset);
    const outcome = classifyMigrationOutcome({ ...execution, mode: plan.mode });
    requireFact(outcome.expected, 'unexpected migration transcript/outcome');
    const session = outcome.session;
    requireFact(
      session.database === plan.target.database &&
        session.databaseOid === attestation.databaseOid &&
        session.applicationName === plan.applicationName,
      'migration session identity mismatch',
    );
    uniqueSessions(
      setup.backendPid,
      before.observer.backendPid,
      session.backendPid,
    );
    assertUpgradePlan(plan);
    const after = observer(
      ownedData(await io.observe('after', plan, reset)),
      plan,
      reset,
      reset,
    );
    uniqueSessions(
      setup.backendPid,
      before.observer.backendPid,
      session.backendPid,
      after.observer.backendPid,
    );
    if (plan.mode === 'negative') compareRollback({ before, after });
    else assertCommittedReceivingCatalog({ before, after });
    assertUpgradePlan(plan);
    receipt = {
      status: 'passed',
      mode: plan.mode,
      target: plan.target,
      containerId: attestation.containerId,
      clusterId: attestation.clusterId,
      databaseOid: attestation.databaseOid,
      resetEpoch: reset.resetEpoch,
      initialIdentity: identity(attestation),
      caseIdentity: identity(reset),
      resetTransitions: [reset.transition],
      sourceSha256: plan.sourceSha256,
      witnessSha256: plan.witnessSha256,
      prefixSha256: plan.prefixSha256,
      baselineSha256: attestation.baselineSha256,
      setupBackendPid: setup.backendPid,
      beforeBackendPid: before.observer.backendPid,
      migrationBackendPid: session.backendPid,
      afterBackendPid: after.observer.backendPid,
      beforeSnapshotSha256: snapshotSha256(before),
      afterSnapshotSha256: snapshotSha256(after),
    };
  } catch (error) {
    primary = { error };
  } finally {
    if (attemptedReset) {
      try {
        // Never replace initial authority with a reset/setup/execution output.
        const restored = ownedData(await io.restoreBaseline(plan, attestation));
        requireFact(reset || primary, 'restoration has no prior reset attempt');
        if (reset)
          requireFact(
            !Object.hasOwn(restored, 'recoveryAttempt'),
            'unexpected recovery after accepted reset',
          );
        const previous = reset ?? recoveryPrevious(restored, plan, attestation);
        assertResetTransition(restored, {
          plan,
          initial: attestation,
          previous,
          purpose: 'baseline',
          sequence: 2,
          inventorySha256: attestation.baselineSha256,
        });
        assertUpgradePlan(plan);
        if (receipt) {
          receipt.restoredResetEpoch = restored.resetEpoch;
          receipt.restoredIdentity = identity(restored);
          receipt.resetTransitions.push(restored.transition);
          receipt.cleanup = { baselineRestored: true };
        }
      } catch (error) {
        primary ??= { error };
      }
    }
  }
  if (primary) throw primary.error;
  requireFact(
    receipt?.cleanup?.baselineRestored === true,
    'restoration receipt missing',
  );
  const passing = ownedData(receipt);
  await io.writeReceipt(passing);
  return passing;
}
