import type { CmsLeaseControl, JobEffectInput } from '@wejammin/application';

import {
  rollBackExhaustedPlan,
  type PreparationExhaustion,
} from './claimed-schema-migration-preparation-exhaustion';
import { claimedJobPayload } from './claimed-schema-migration-preparation-job-payload';
import { withJobLeaseCheckpoints } from './claimed-schema-migration-preparation-lease-fence';
import { SCHEMA_MIGRATION_RPC } from './migration-worker-constants';
import { processAdmittedMigration } from './migration-worker-execution';
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
      options: Readonly<{
        signal: AbortSignal;
        attempt: number;
        /**
         * The private BE00 lease control of the verified delivery. When present, every state-advancing worker
         * RPC is preceded by one checkpoint and a lost checkpoint stops the invocation (stage fence 2C).
         */
        control?: CmsLeaseControl;
      }>,
    ): Promise<ClaimedSchemaMigrationPreparationResult> => {
      const claimRequest = buildCmsSchemaDryRunClaimRequest(input);
      if (claimRequest === null) return { kind: 'invalid_claim' };

      const startedAt = runtime.now();
      const { signal, attempt } = options;
      const stages =
        options.control === undefined
          ? runtime
          : withJobLeaseCheckpoints(runtime, options.control);
      const read = await stages.call(
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

      const job = claimedJobPayload(claimRequest, resolved.plan);
      const admitted = await admitResolvedMigrationInput(
        stages,
        { event: null, job },
        resolved.plan,
        signal,
        attempt,
        startedAt,
      );
      const result =
        'outcome' in admitted
          ? admitted
          : await processAdmittedMigration(stages, admitted, signal, attempt);

      return {
        kind: 'processed',
        claimRequest,
        reportId: resolved.report.id,
        result,
      };
    },

    /**
     * The last-delivery rollback (DEC-184): rolls an in-flight plan back to its terminal failure so a new
     * CMS-03A-10 attempt is admitted. It never throws; the Job is failed whatever it reports. The fenced
     * runtime checkpoints the lease claim and the rollback like every other state-advancing RPC.
     */
    exhaust: async (
      input: JobEffectInput,
      options: Readonly<{
        signal: AbortSignal;
        attempt?: number;
        control?: CmsLeaseControl;
      }>,
    ): Promise<PreparationExhaustion> => {
      const claimRequest = buildCmsSchemaDryRunClaimRequest(input);
      if (claimRequest === null) return 'unavailable';
      const stages =
        options.control === undefined
          ? runtime
          : withJobLeaseCheckpoints(runtime, options.control);
      try {
        return await rollBackExhaustedPlan(
          stages,
          claimRequest,
          options.signal,
          options.attempt ?? 4,
        );
      } catch {
        return 'unavailable';
      }
    },
  };
};
