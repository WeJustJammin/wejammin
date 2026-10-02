/**
 * Stateful fake of the migration persistence seam for the real-scanner RED
 * suite.
 *
 * Seam under test (BE03a dry-run/backfill paragraphs; IA03 deep dive):
 * - `cms_read_schema_migration_source_rows` returns at most 128 actual source
 *   rows (`sourceTable`, `sourceRowId`, DB-computed `sourceHash`, `document`)
 *   at the plan cursor, plus `targetFields[]` (every changed field with its
 *   compiled constraints) and `retiredFields[]` (removed field keys).
 * - The Worker applies the code-owned registered pure transform to each
 *   `document` and posts per-row evidence (`rowEvidence`, at most 128 entries)
 *   on the existing batch RPCs. The DB derives every counter from that evidence;
 *   no counter arithmetic and no plan-supplied count is trusted.
 * - Backfill re-applies the same transform and posts the same evidence shape.
 */
import { vi } from 'vitest';

import {
  type MigrationPlanRecord,
  type MigrationWorkerPort,
  type SchemaMigrationRpcName,
} from './migration-worker';
import { SCHEMA_MIGRATION_RPC } from './migration-worker';
import { basePlan } from './migration-worker-test-support';

export const READ_SOURCE_ROWS_RPC = 'cms_read_schema_migration_source_rows';
export const HEX64 = /^[a-f0-9]{64}$/u;
export const ERROR_CODE = /^[A-Z][A-Z0-9_]{0,63}$/u;

export type SourceRow = Readonly<{
  sourceTable: string;
  sourceRowId: string;
  sourceHash: string;
  document: Readonly<Record<string, unknown>>;
}>;

export type RowEvidence = Readonly<{
  sourceTable: string;
  sourceRowId: string;
  sourceHash: string;
  outputHash: string | null;
  errorCode: string | null;
}>;

export type RegistryEntry = Readonly<{
  key: string;
  version: number;
  digest: string;
  sourceConstraints: Readonly<Record<string, unknown>>;
  targetConstraints: Readonly<Record<string, unknown>>;
  acceptedFieldKinds: readonly string[];
  apply: (row: Readonly<Record<string, unknown>>) => unknown;
}>;

/** The two field members of an empty candidate diff on a read page. */
export const NO_FIELDS = { targetFields: [], retiredFields: [] } as const;

export const makeRows = (count: number): readonly SourceRow[] =>
  Array.from({ length: count }, (_, index) => ({
    sourceTable: 'cms_entry_revisions',
    sourceRowId: `b0000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    sourceHash: index.toString(16).padStart(64, '0'),
    document: { title: `title-secret-${index}`, rank: index },
  }));

export const upperTitle: RegistryEntry['apply'] = (row) => {
  if (row.title === 'title-secret-bad')
    throw new Error('row cannot be transformed');
  return { ...row, title: String(row.title).toUpperCase() };
};

export const registryEntry = (
  apply: RegistryEntry['apply'] = upperTitle,
  overrides: Partial<RegistryEntry> = {},
): RegistryEntry => ({
  key: 'article.v2',
  version: 1,
  digest: 'c'.repeat(64),
  sourceConstraints: {},
  targetConstraints: {},
  acceptedFieldKinds: ['short_text'],
  apply,
  ...overrides,
});

type DbOptions = Readonly<{
  rows: readonly SourceRow[];
  plan?: Partial<MigrationPlanRecord>;
  /** Field specs the read page carries (the DB's compiled candidate fields). */
  targetFields?: readonly Record<string, unknown>[];
  retiredFields?: readonly string[];
  readPageOverride?: (cursor: number, limit: number) => unknown;
  readFailure?: Error;
}>;

export type ScanDatabase = MigrationWorkerPort & {
  calls: Array<{ rpc: string; request: Record<string, unknown> }>;
  evidenceBatches: (rpc: string) => RowEvidence[][];
  requests: (rpc: string) => Array<Record<string, unknown>>;
};

export const makeScanDatabase = (options: DbOptions): ScanDatabase => {
  const calls: Array<{ rpc: string; request: Record<string, unknown> }> = [];
  const totals = { source: 0, target: 0, errors: 0 };
  let cursor = 0;
  const plan = (overrides: Partial<MigrationPlanRecord>): MigrationPlanRecord =>
    basePlan({
      transformKey: 'article.v2',
      transformVersion: '1',
      ...options.plan,
      ...overrides,
    });
  const batch = (request: Record<string, unknown>) => {
    const evidence = request.rowEvidence as RowEvidence[];
    totals.source += evidence.length;
    totals.target += evidence.filter(
      (entry) => entry.outputHash !== null,
    ).length;
    totals.errors += evidence.filter(
      (entry) => entry.errorCode !== null,
    ).length;
    cursor = Number(request.cursor) + evidence.length;
    const done = cursor >= options.rows.length;
    return {
      done,
      cursor: String(cursor),
      progress:
        options.rows.length === 0
          ? 1
          : Math.min(1, cursor / options.rows.length),
      sourceCount: String(totals.source),
      targetCount: String(totals.target),
      rowErrorCount: String(totals.errors),
      migratedCount: String(totals.target),
      failedCount: String(totals.errors),
    };
  };
  const handlers: Partial<
    Record<string, (request: Record<string, unknown>) => unknown>
  > = {
    [SCHEMA_MIGRATION_RPC.readPlan]: () => plan({ state: 'draft' }),
    [SCHEMA_MIGRATION_RPC.claimLease]: () => ({
      acquired: true,
      leaseToken: 'lease-1',
      plan: plan({ state: 'dry_running', version: '8' }),
    }),
    [SCHEMA_MIGRATION_RPC.heartbeatLease]: () => ({ renewed: true }),
    [READ_SOURCE_ROWS_RPC]: (request) => {
      if (options.readFailure !== undefined) throw options.readFailure;
      const start = Number(request.cursor);
      const limit = Number(request.limit);
      if (options.readPageOverride !== undefined)
        return options.readPageOverride(start, limit);
      const page = options.rows.slice(start, start + limit);
      const next = start + page.length;
      return {
        rows: page,
        nextCursor: String(next),
        done: next >= options.rows.length,
        targetFields: options.targetFields ?? [],
        retiredFields: options.retiredFields ?? [],
      };
    },
    [SCHEMA_MIGRATION_RPC.processDryRunBatch]: batch,
    [SCHEMA_MIGRATION_RPC.finalizeDryRun]: (request) => {
      cursor = 0;
      const next = {
        sourceCount: String(request.sourceCount),
        targetCount: String(request.targetCount),
        rowErrorCount: String(request.rowErrorCount),
      };
      totals.source = 0;
      totals.target = 0;
      totals.errors = 0;
      return plan({
        ...next,
        state: next.rowErrorCount === '0' ? 'ready' : 'blocked',
        cursor: '0',
        version: '9',
      });
    },
    [SCHEMA_MIGRATION_RPC.processBatch]: batch,
    [SCHEMA_MIGRATION_RPC.beginVerification]: () =>
      plan({
        state: 'verifying',
        cursor: String(cursor),
        version: '10',
        progress: 1,
      }),
    [SCHEMA_MIGRATION_RPC.verify]: () => ({ valid: true }),
    [SCHEMA_MIGRATION_RPC.complete]: () =>
      plan({
        state: 'completed',
        cursor: String(cursor),
        version: '11',
        progress: 1,
      }),
    [SCHEMA_MIGRATION_RPC.activate]: () => ({ activated: true }),
    [SCHEMA_MIGRATION_RPC.rollback]: () => ({
      plan: plan({ state: 'failed_terminal', version: '12' }),
    }),
  };
  const call = vi.fn(async (rpc: SchemaMigrationRpcName, request: unknown) => {
    const body = request as Record<string, unknown>;
    calls.push({ rpc, request: body });
    return handlers[rpc]?.(body);
  });
  return {
    call,
    calls,
    requests: (rpc) =>
      calls.filter((entry) => entry.rpc === rpc).map((entry) => entry.request),
    evidenceBatches: (rpc) =>
      calls
        .filter((entry) => entry.rpc === rpc)
        .map((entry) => entry.request.rowEvidence as RowEvidence[]),
  };
};
