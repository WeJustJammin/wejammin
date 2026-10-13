import type { SchemaMigrationJobPayload } from './migration-worker-input-schemas';
import type { MigrationPlanRecord } from './migration-worker-plan-schemas';
import type { CmsSchemaDryRunClaimRequest } from './schema-dry-run-claim-request';

/**
 * The trusted job payload the worker stages take, derived from the claim receipt's original event and the
 * plan the Job-fenced read returned. It never comes from a queue body.
 */
export const claimedJobPayload = (
  claimRequest: CmsSchemaDryRunClaimRequest,
  plan: MigrationPlanRecord,
): SchemaMigrationJobPayload => ({
  schemaVersionId: plan.toVersionId,
  migrationPlanId: plan.id,
  expectedVersion: plan.version,
  correlationId: claimRequest.requestedEvent.correlationId,
  causationId: claimRequest.requestedEvent.causationId,
});
