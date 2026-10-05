import { rmSync } from 'node:fs';

import {
  type MigrationWorkerPort,
  type SchemaMigrationRpcName,
  SCHEMA_MIGRATION_RPC,
} from '../../apps/worker/src/content-schema-registry/migration-worker';
import { emptySourcePage } from '../../apps/worker/src/content-schema-registry/migration-worker-test-support';
import {
  createDurableStore,
  incrementVersion,
  planWith,
  readState,
  requestRecord,
  stringValue,
  temporaryStores,
  writeState,
} from './phase-02-slice-09-recovery-durable-state';

export { createSchemaMigrationWorker } from '../../apps/worker/src/content-schema-registry/migration-worker';
export { createDurableStore };

/**
 * A file-backed RPC boundary. Every call reads and commits the JSON record so
 * a fresh worker observes persisted state after a process crash. No handler
 * result is compared with an in-memory fixture.
 */
export const createDurablePort = (path: string): MigrationWorkerPort => ({
  call: async (
    rpc: SchemaMigrationRpcName,
    request: unknown,
    signal: AbortSignal,
  ): Promise<unknown> => {
    if (signal.aborted)
      throw Object.assign(new Error('RPC aborted'), {
        code: 'DEPENDENCY_DEADLINE_EXCEEDED',
        retryable: true,
      });
    const input = requestRecord(request);
    let state = readState(path);
    switch (rpc) {
      case SCHEMA_MIGRATION_RPC.readPlan:
        return state.plan;
      case SCHEMA_MIGRATION_RPC.claimLease: {
        if (input.expectedVersion !== state.plan.version)
          return {
            acquired: false,
            leaseToken: null,
            plan: null,
            reasonCode: 'LEASE_VERSION_CONFLICT',
          };
        const workerId = stringValue(input.workerId, 'worker id missing');
        const leaseToken = `lease-${workerId}-${state.plan.version}`;
        state = {
          ...state,
          plan: planWith(state, {
            state: 'running',
            version: incrementVersion(state.plan.version),
            leaseOwner: workerId,
            leaseToken,
          }),
          leaseToken,
          leaseOwner: workerId,
        };
        writeState(path, state);
        return {
          acquired: true,
          leaseToken,
          plan: state.plan,
          reasonCode: null,
        };
      }
      case SCHEMA_MIGRATION_RPC.heartbeatLease:
        return input.leaseToken === state.leaseToken
          ? { renewed: true }
          : { renewed: false };
      case SCHEMA_MIGRATION_RPC.readSourceRows:
        // The worker reads one source page before every batch RPC. The durable
        // record models the plan cursor, not source rows, so the page is empty.
        return emptySourcePage(request);
      case SCHEMA_MIGRATION_RPC.processBatch: {
        if (input.expectedVersion !== state.plan.version)
          throw Object.assign(new Error('durable cursor version conflict'), {
            code: 'MIGRATION_VERSION_CONFLICT',
            retryable: true,
          });
        if (input.cursor !== state.plan.cursor)
          throw Object.assign(new Error('durable cursor conflict'), {
            code: 'MIGRATION_CURSOR_CONFLICT',
            retryable: true,
          });
        const firstBatch = state.plan.cursor === '0';
        const nextCursor = firstBatch ? '2' : '4';
        const nextPlan = planWith(state, {
          cursor: nextCursor,
          progress: firstBatch ? 0.5 : 1,
          targetCount: firstBatch ? '2' : '4',
          migratedCount: firstBatch ? '2' : '4',
          failedCount: '0',
          rowErrorCount: '0',
        });
        state = { ...state, plan: nextPlan };
        if (firstBatch && state.crashAfterFirstBatch) {
          state = { ...state, crashAfterFirstBatch: false };
          writeState(path, state);
          throw Object.assign(
            new Error('worker process crashed after commit'),
            {
              code: 'WORKER_CRASH_AFTER_COMMIT',
              retryable: true,
            },
          );
        }
        writeState(path, state);
        return {
          done: nextCursor === '4',
          cursor: nextCursor,
          progress: nextPlan.progress,
          sourceCount: nextPlan.sourceCount,
          targetCount: nextPlan.targetCount,
          rowErrorCount: nextPlan.rowErrorCount,
          migratedCount: nextPlan.migratedCount,
          failedCount: nextPlan.failedCount,
        };
      }
      case SCHEMA_MIGRATION_RPC.beginVerification:
        state = {
          ...state,
          plan: planWith(state, {
            state: 'verifying',
            version: incrementVersion(state.plan.version),
          }),
        };
        writeState(path, state);
        return state.plan;
      case SCHEMA_MIGRATION_RPC.verify:
        return { valid: true };
      case SCHEMA_MIGRATION_RPC.complete:
        state = {
          ...state,
          plan: planWith(state, {
            state: 'completed',
            version: incrementVersion(state.plan.version),
          }),
        };
        writeState(path, state);
        return state.plan;
      case SCHEMA_MIGRATION_RPC.activate:
        if (state.activationShouldFail)
          return { activated: false, status: 'not_committed' };
        if (state.activeVersionId === state.plan.toVersionId)
          return { activated: false, status: 'already_active' };
        state = {
          ...state,
          activeVersionId: state.plan.toVersionId,
          plan: planWith(state, { activeVersionId: state.plan.toVersionId }),
          activationSwitches: state.activationSwitches + 1,
          outboxEvents: state.outboxEvents + 1,
        };
        writeState(path, state);
        return { activated: true, status: 'committed' };
      case SCHEMA_MIGRATION_RPC.reconcileActivation:
        return { activated: false, status: 'not_committed' };
      case SCHEMA_MIGRATION_RPC.rollback: {
        state = {
          ...state,
          activeVersionId: state.plan.fromVersionId,
          plan: planWith(state, {
            state:
              input.retryable === true ? 'failed_retryable' : 'failed_terminal',
            version: incrementVersion(state.plan.version),
            activeVersionId: state.plan.fromVersionId,
            leaseOwner: null,
            leaseToken: null,
          }),
          leaseOwner: null,
          leaseToken: null,
          rollbackCount: state.rollbackCount + 1,
          rollbackReason:
            typeof input.reasonCode === 'string' ? input.reasonCode : null,
        };
        writeState(path, state);
        return { plan: state.plan };
      }
      case SCHEMA_MIGRATION_RPC.claimEvent: {
        const eventId = stringValue(input.eventId, 'event id missing');
        const current = state.eventStates[eventId];
        if (current === 'completed') return { status: 'duplicate' };
        if (current === 'in_progress') return { status: 'in_progress' };
        if (input.replay === true && current === 'dead_letter')
          return { status: 'replayable' };
        state = {
          ...state,
          eventStates: { ...state.eventStates, [eventId]: 'in_progress' },
        };
        writeState(path, state);
        return { status: 'new' };
      }
      case SCHEMA_MIGRATION_RPC.acknowledgeEvent: {
        const eventId = stringValue(input.eventId, 'event id missing');
        state = {
          ...state,
          eventStates: { ...state.eventStates, [eventId]: 'completed' },
          acknowledgedEvents: state.acknowledgedEvents + 1,
        };
        writeState(path, state);
        return { accepted: true };
      }
      case SCHEMA_MIGRATION_RPC.deadLetter: {
        const eventId = stringValue(
          input.eventId,
          'dead-letter event id missing',
        );
        if (state.deadLetterEventIds.includes(eventId))
          return { accepted: true };
        state = {
          ...state,
          eventStates: { ...state.eventStates, [eventId]: 'dead_letter' },
          deadLetterEventIds: [...state.deadLetterEventIds, eventId],
        };
        writeState(path, state);
        return { accepted: true };
      }
      default:
        return {};
    }
  },
});

export const cleanupTemporaryStores = (): void => {
  while (temporaryStores.length > 0) {
    const path = temporaryStores.pop();
    if (path !== undefined) rmSync(path, { recursive: true, force: true });
  }
};
