import {
  assertIdentity,
  exactKeys,
  requireFact,
} from './delivery-receiving-upgrade-target.mjs';
import { proveLease } from './delivery-receiving-upgrade-local-child.mjs';
import {
  assertObservedBinding,
  verifyExecutables,
} from './delivery-receiving-upgrade-host-executables.mjs';
import {
  assertInventory,
  observeSource,
} from './delivery-receiving-upgrade-host-source.mjs';
import {
  sameValue,
  snapshot,
} from './delivery-receiving-upgrade-host-request.mjs';

function metadata(value, identity, prior) {
  requireFact(
    exactKeys(value, [
      'witness',
      'clusterId',
      'databaseOid',
      'owner',
      'encoding',
      'collation',
      'connectionLimit',
      'databaseAcl',
      'configurationRows',
      'configurationKeys',
    ]) &&
      value.witness === 'DEC197_ALT_TARGET_V1' &&
      value.clusterId === identity.clusterId &&
      value.databaseOid === identity.databaseOid &&
      value.owner === identity.owner &&
      value.owner === 'postgres' &&
      value.encoding === 'UTF8' &&
      value.collation === 'en_US.UTF-8' &&
      value.connectionLimit === -1 &&
      Number.isSafeInteger(value.configurationRows) &&
      value.configurationRows >= 0 &&
      Array.isArray(value.configurationKeys) &&
      value.configurationKeys.every(
        (key) => typeof key === 'string' && /^[a-z][a-z0-9_.-]*$/.test(key),
      ) &&
      (value.databaseAcl === null ||
        (Array.isArray(value.databaseAcl) &&
          value.databaseAcl.every((entry) => typeof entry === 'string'))),
    'invalid independent nonsecret database envelope',
  );
  if (prior) {
    const unchanged = (envelope) =>
      Object.fromEntries(
        Object.entries(envelope).filter(([key]) => key !== 'clusterId'),
      );
    requireFact(
      sameValue(unchanged(value), unchanged(prior)),
      'changed database owner/OID/ACL/settings-key envelope',
    );
  }
}

// This consumes independent raw observations; it never authenticates their producer.
export async function observeBoundary(deps, request, context = {}) {
  const { before, createdId, initial, applied } = context;
  await proveLease(deps, request.target);
  await verifyExecutables(deps.fs, deps.binding);
  const raw = await deps.process.observeBoundary();
  assertObservedBinding(raw, deps.binding);
  const identity = raw.identity;
  requireFact(
    exactKeys(identity, [
      'target',
      'containerId',
      'clusterId',
      'databaseOid',
      'owner',
    ]),
    'observed identity shape',
  );
  assertIdentity(
    identity,
    request.target,
    createdId ? undefined : request.priorIdentity,
  );
  requireFact(
    identity.owner === request.priorIdentity.owner &&
      identity.databaseOid === request.priorIdentity.databaseOid,
    'reset changed owner or database OID',
  );
  if (createdId)
    requireFact(
      identity.containerId === createdId,
      'unattributed replacement container',
    );
  metadata(raw.metadata, identity, before?.metadata ?? initial?.metadata);
  const source = await observeSource(deps.fs, request, raw, before?.source);
  if (initial) {
    for (const key of [
      'repository',
      'baseline',
      'prefix',
      'source',
      'witness',
      'seed',
      'config',
    ]) {
      requireFact(
        sameValue(source[key], initial.source[key]),
        'changed initial source authority',
      );
    }
  }
  assertInventory(
    raw.appliedInventory,
    before ? source.selected : (applied ?? source.baseline),
    'independent applied',
  );
  // Recheck after asynchronous observations, before granting any next mutation.
  await proveLease(deps, request.target);
  return snapshot({ identity, metadata: raw.metadata, source });
}
