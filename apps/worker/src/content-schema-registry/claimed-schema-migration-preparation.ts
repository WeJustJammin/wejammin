import type { JobEffectInput } from '@wejammin/application';

import { SCHEMA_MIGRATION_RPC } from './migration-worker-constants';
import { processAdmittedMigration } from './migration-worker-execution';
import type { SchemaMigrationJobPayload } from './migration-worker-input-schemas';
import { admitResolvedMigrationInput } from './migration-worker-resolved-admission';
import { createMigrationWorkerRuntime } from './migration-worker-runtime';
import type {
  MigrationWorkerResult,
  MigrationWorkerRpcFailure,
  SchemaMigrationWorkerDependencies,
} from './migration-worker-types';
import { decodeCmsSchemaDryRunClaimResponse } from './schema-dry-run-claim-binding';
import { buildCmsSchemaDryRunClaimRequest } from './schema-dry-run-claim-input';
import type { CmsSchemaDryRunClaimRequest } from './schema-dry-run-claim-request';

export type ClaimedSchemaMigrationPreparationResult =
  | Readonly<{ kind: 'invalid_claim' }>
  | Readonly<{
      kind: 'resolution_failed';
      failure: MigrationWorkerRpcFailure;
    }>
  | Readonly<{ kind: 'invalid_resolution' }>
  | Readonly<{
      kind: 'processed';
      claimRequest: CmsSchemaDryRunClaimRequest;
      reportId: string;
      result: MigrationWorkerResult;
    }>;

export const createClaimedSchemaMigrationPreparation = (
  dependencies: Omit<SchemaMigrationWorkerDependencies, 'executionPurpose'>,
) => {
  const runtime = createMigrationWorkerRuntime({
    ...dependencies,
    executionPurpose: 'dry_run',
  });

  return {
    process: async (
      input: JobEffectInput,
      options: Readonly<{ signal: AbortSignal; attempt: number }>,
    ): Promise<ClaimedSchemaMigrationPreparationResult> => {
      const claimRequest = buildCmsSchemaDryRunClaimRequest(input);
      if (claimRequest === null) return { kind: 'invalid_claim' };

      const startedAt = runtime.now();
      const { signal, attempt } = options;
      const read = await runtime.call(
        SCHEMA_MIGRATION_RPC.readPlan,
        claimRequest,
        signal,
      );
      if (!read.ok) return { kind: 'resolution_failed', failure: read.failure };

      const resolved = decodeCmsSchemaDryRunClaimResponse(
        claimRequest,
        read.value,
      );
      if (resolved === null) return { kind: 'invalid_resolution' };

      const job: SchemaMigrationJobPayload = {
        schemaVersionId: resolved.plan.toVersionId,
        migrationPlanId: resolved.plan.id,
        expectedVersion: resolved.plan.version,
        correlationId: claimRequest.requestedEvent.correlationId,
        causationId: claimRequest.requestedEvent.causationId,
      };
      const admitted = await admitResolvedMigrationInput(
        runtime,
        { event: null, job },
        resolved.plan,
        signal,
        attempt,
        startedAt,
      );
      const result =
        'outcome' in admitted
          ? admitted
          : await processAdmittedMigration(runtime, admitted, signal, attempt);

      return {
        kind: 'processed',
        claimRequest,
        reportId: resolved.report.id,
        result,
      };
    },
  };
};
