import { Buffer } from 'node:buffer';

import {
  assertIdentity,
  assertReset,
  requireFact,
  sealTarget,
} from './delivery-receiving-upgrade-target.mjs';
import { createChildRunner } from './delivery-receiving-upgrade-local-child.mjs';
import {
  discover,
  validatePlan,
} from './delivery-receiving-upgrade-local-inventory.mjs';
import {
  committedSetup,
  expandFixture,
  observerDocument,
  READY,
  sessionMarker,
  setupReady,
} from './delivery-receiving-upgrade-local-observer.mjs';
import {
  createTargetGuard,
  dependencies,
  invocation,
} from './delivery-receiving-upgrade-local-target.mjs';

export function createLocalSessionAdapter(options) {
  const deps = dependencies(options);
  const guard = createTargetGuard(deps);
  const clients = createChildRunner(deps);
  const active = new Set();
  const pids = new Set();
  let accepting = true;
  let busy = false;
  let bound;

  function admitted() {
    requireFact(accepting, 'local session admission closed');
  }
  function key(plan, reset) {
    return JSON.stringify([
      plan.repository,
      plan.runId,
      plan.mode,
      plan.applicationName,
      plan.sourceSha256,
      plan.witnessSha256,
      reset.resetEpoch,
    ]);
  }
  function envelope(plan, reset) {
    requireFact(
      bound && bound.key === key(plan, reset),
      'changed session case',
    );
    assertIdentity(reset, plan.target, bound.reset);
    requireFact(
      reset.owner === 'postgres' &&
        reset.prefixSha256 === bound.reset.prefixSha256,
      'changed reset binding',
    );
    const { target, containerId, clusterId, databaseOid, resetEpoch } =
      bound.reset;
    return { target, containerId, clusterId, databaseOid, resetEpoch };
  }
  async function scope(plan, reset) {
    admitted();
    validatePlan(plan);
    assertReset(reset, plan, bound?.reset);
    if (bound) envelope(plan, reset);
    const actual = await guard(plan, bound?.reset ?? reset);
    const source = await discover(deps.fs, plan);
    if (!bound)
      bound = {
        key: key(plan, reset),
        fingerprint: source.fingerprint,
        metadata: JSON.stringify(actual.metadata),
        reset: Object.freeze({ ...reset, target: sealTarget(reset.target) }),
      };
    requireFact(
      JSON.stringify(actual.metadata) === bound.metadata,
      'session DB metadata drift',
    );
    requireFact(
      source.fingerprint === bound.fingerprint,
      'session source/seed/config drift',
    );
    admitted();
    return bound.reset;
  }
  function fresh(marker) {
    requireFact(
      !pids.has(marker.backendPid),
      'client backend reused across case phases',
    );
    pids.add(marker.backendPid);
  }
  function tracked(operation) {
    admitted();
    requireFact(!busy, 'overlapping local session operation');
    busy = true;
    const pending = Promise.resolve().then(operation);
    active.add(pending);
    void pending
      .finally(() => {
        active.delete(pending);
        busy = false;
      })
      .catch(() => {});
    return pending;
  }

  function setupWorld(plan, reset) {
    return tracked(async () => {
      const pinned = await scope(plan, reset);
      const jwt = await expandFixture(
        deps.fs,
        plan.repository,
        'support/jwt-claims.sqlinc',
      );
      const name =
        plan.mode === 'negative'
          ? '060-upgrade-world.sqlinc'
          : '065-upgrade-empty-world.sqlinc';
      const world = await expandFixture(
        deps.fs,
        plan.repository,
        `phase_02_slice_11_delivery_receiving/${name}`,
      );
      const script = `${jwt}\ncreate extension if not exists pgtap with schema extensions;\nbegin;\nselect no_plan();\n${world}\nselect * from finish();\n\\echo ${READY}\n`;
      await scope(plan, reset);
      const command = invocation(plan, 'setup', Buffer.from(script));
      const applicationName = `${plan.applicationName}-setup`;
      let committing = false;
      let sent = false;
      const result = await clients.run(command, {
        interactive: true,
        onOutput({ stdout, stderr, finishInput, isClosed }) {
          if (committing || !stdout.split(/\r?\n/).slice(0, -1).includes(READY))
            return;
          const { marker } = setupReady(
            stdout,
            stderr,
            plan,
            pinned,
            applicationName,
          );
          requireFact(
            !pids.has(marker.backendPid),
            'setup reused a prior backend',
          );
          committing = true;
          return (async () => {
            await scope(plan, reset);
            requireFact(
              !isClosed(),
              'setup client closed before validated COMMIT',
            );
            finishInput(Buffer.from('commit;\n'));
            sent = true;
          })();
        },
      });
      await scope(plan, reset);
      const { marker, world: document } = committedSetup(
        result,
        plan,
        pinned,
        applicationName,
        sent,
      );
      fresh(marker);
      return {
        ...envelope(plan, reset),
        committed: true,
        tapPassed: true,
        database: document.database,
        backendPid: marker.backendPid,
        publications: document.publications,
        consumerCount: document.consumerCount,
      };
    });
  }

  function observe(phase, plan, reset) {
    return tracked(async () => {
      requireFact(
        ['before', 'after'].includes(phase),
        'invalid observer phase',
      );
      const pinned = await scope(plan, reset);
      const snapshot = await expandFixture(
        deps.fs,
        plan.repository,
        'phase_02_slice_11_delivery_receiving/070-upgrade-snapshot.sqlinc',
      );
      await scope(plan, reset);
      const result = await clients.run(
        invocation(
          plan,
          phase,
          Buffer.from(`begin read only;\n${snapshot}\nrollback;\n`),
        ),
      );
      await scope(plan, reset);
      const { marker, document } = observerDocument(
        result,
        pinned,
        `${plan.applicationName}-${phase}`,
      );
      fresh(marker);
      return { ...envelope(plan, reset), document };
    });
  }

  function executeMigration(command, plan, reset) {
    return tracked(async () => {
      validatePlan(plan);
      const expected = invocation(plan, 'migration', plan.witness);
      requireFact(
        command?.command === expected.command &&
          JSON.stringify(command.args) === JSON.stringify(expected.args) &&
          Buffer.isBuffer(command.input) &&
          command.input.equals(expected.input),
        'nonliteral migration invocation',
      );
      const copied = {
        command: expected.command,
        args: [...expected.args],
        input: Buffer.from(command.input),
      };
      const pinned = await scope(plan, reset);
      const result = await clients.run(copied);
      await scope(plan, reset);
      fresh(sessionMarker(result.stdout, plan.applicationName, pinned));
      // Outcome semantics belong to the pure classifier; never turn a transport
      // exit or unrelated SQLSTATE into a successful controlled FK refusal.
      return { ...envelope(plan, reset), ...result };
    });
  }

  async function cancel(error) {
    accepting = false;
    await clients.cancel(error);
    await Promise.allSettled([...active]);
  }

  return { setupWorld, observe, executeMigration, cancel };
}
