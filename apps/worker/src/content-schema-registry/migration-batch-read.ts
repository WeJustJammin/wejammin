/** Reads one source page for a batch and scans it into per-row evidence. */
import { scanSourcePage } from './migration-scan-executor';
import { parseSourcePage, READ_SOURCE_ROWS_RPC } from './migration-source-read';
import type {
  RowEvidenceEntry,
  TransformRegistryEntry,
} from './migration-transform-types';
import type { MigrationPlanRecord } from './migration-worker-plan-schemas';
import type { MigrationWorkerRuntime } from './migration-worker-runtime';

export type BatchScan =
  | Readonly<{ ok: true; evidence: readonly RowEvidenceEntry[] }>
  | Readonly<{ ok: false; retryable: boolean; reasonCode: string }>;

export const readAndScanBatch = async (
  runtime: MigrationWorkerRuntime,
  plan: MigrationPlanRecord,
  leaseToken: string | null,
  entry: TransformRegistryEntry | null,
  signal: AbortSignal,
): Promise<BatchScan> => {
  const read = await runtime.call(
    READ_SOURCE_ROWS_RPC,
    {
      migrationPlanId: plan.id,
      expectedVersion: plan.version,
      cursor: plan.cursor,
      limit: runtime.maxBatchRows,
      leaseToken,
    },
    signal,
  );
  if (!read.ok)
    return {
      ok: false,
      retryable: read.failure.retryable,
      reasonCode: read.failure.code,
    };
  try {
    const page = parseSourcePage(read.value, runtime.maxBatchRows);
    if (
      entry !== null &&
      page.targetField !== null &&
      !entry.acceptedFieldKinds.includes(page.targetField.kind)
    )
      return {
        ok: false,
        retryable: false,
        reasonCode: 'TRANSFORM_FIELD_KIND_MISMATCH',
      };
    return { ok: true, evidence: await scanSourcePage(page, entry) };
  } catch {
    return {
      ok: false,
      retryable: false,
      reasonCode: 'DEPENDENCY_INVALID_RESPONSE',
    };
  }
};
