import { requireFact } from './delivery-receiving-upgrade-target.mjs';
import {
  hostDependencies,
  sameValue,
  sealRequest,
  snapshot,
} from './delivery-receiving-upgrade-host-request.mjs';
import { assertBinding } from './delivery-receiving-upgrade-host-executables.mjs';
import { observeBoundary } from './delivery-receiving-upgrade-host-boundary.mjs';
import { validateTrace } from './delivery-receiving-upgrade-host-trace.mjs';
import {
  launchReset,
  proveDrain,
} from './delivery-receiving-upgrade-host-drain.mjs';

// No default/native OS adapter is supplied here. These independent observation
// ports must be bound and authenticated separately before any real host use.
export function createOwnedResetPort(options) {
  const deps = hostDependencies(options);
  assertBinding(deps.binding);
  const handles = new WeakMap();
  let active;
  let accepted;
  let initial;

  function beginOwnedReset(input) {
    requireFact(!active, 'owned reset operation already pending');
    const request = sealRequest(input, deps.lease);
    if (accepted) {
      requireFact(
        sameValue(request.priorIdentity, accepted.identity) &&
          request.sourceSha256 === accepted.sourceSha256 &&
          request.witnessSha256 === accepted.witnessSha256 &&
          request.purpose !== accepted.purpose,
        'stale or foreign next reset',
      );
    } else
      requireFact(request.purpose === 'prefix', 'prefix reset must be first');
    const handle = Object.freeze(Object.create(null));
    const record = { request, state: 'registered' };
    handles.set(handle, record);
    active = record;
    return handle;
  }

  function admit(handle, state) {
    const record = handles.get(handle);
    requireFact(
      record && record === active && record.state === state,
      'unknown, concurrent or consumed owned reset handle',
    );
    record.state = 'running';
    return record;
  }

  function result(record) {
    return snapshot({
      status: Number.isInteger(record.capture.status)
        ? record.capture.status
        : -1,
      stdout: record.capture.stdout,
      stderr: record.capture.stderr,
      before: record.before.identity,
      after: record.after.identity,
      inventorySha256: record.request.inventorySha256,
    });
  }

  function consume(record) {
    accepted = snapshot({
      identity: record.after.identity,
      purpose: record.request.purpose,
      sourceSha256: record.request.sourceSha256,
      witnessSha256: record.request.witnessSha256,
      inventory: record.request.inventory,
    });
    record.state = 'consumed';
    active = undefined;
    return result(record);
  }

  async function checkCompleted(record) {
    const trace = await deps.process.readResetTrace(record.capture.child);
    const attribution = validateTrace(
      trace,
      deps,
      record.request,
      record.capture.child,
    );
    await proveDrain(deps, record.capture, attribution);
    record.after = await observeBoundary(deps, record.request, {
      before: record.before,
      createdId: attribution.createdId,
      initial,
    });
  }

  async function completeOwnedReset(handle) {
    // Admission occurs synchronously before the first await; a refusal cannot
    // release another operation's slot or enter a second spawn.
    const record = admit(handle, 'registered');
    try {
      record.before = await observeBoundary(deps, record.request, {
        initial,
        applied: accepted?.inventory,
      });
      initial ??= record.before;
      record.capture = launchReset(deps, record.request);
      await record.capture.completion;
      await checkCompleted(record);
      if (record.capture.failure) throw record.capture.failure;
      requireFact(
        record.capture.status === 0 && record.capture.signal === null,
        'owned reset did not exit successfully',
      );
      return consume(record);
    } catch (error) {
      record.state = 'uncertain';
      record.failure = error;
      throw error;
    }
  }

  async function proveRecoveryOwnership(handle) {
    const record = admit(handle, 'uncertain');
    try {
      requireFact(
        record.before && record.capture?.closed,
        'no owned closed reset to recover',
      );
      // Reobserve every authority and drain fact even on the first recovery.
      // Failed drain attempts retain the pending handle, not a success anchor.
      await checkCompleted(record);
      return consume(record);
    } catch (error) {
      record.state = 'uncertain';
      throw error;
    }
  }

  return Object.freeze({
    beginOwnedReset,
    completeOwnedReset,
    proveRecoveryOwnership,
  });
}
