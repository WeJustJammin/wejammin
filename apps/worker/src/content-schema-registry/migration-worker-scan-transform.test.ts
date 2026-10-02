/**
 * DEC-108 real scanner and registered pure transform executor.
 * Spec: BE03a "dry-run report", "per-row scan evidence" and "transform
 * registry" paragraphs; IA03 deep dive migration items 2-3. The persistence
 * seam is documented in `migration-worker-scan-transform-test-support.ts`.
 */
import { describe, expect, it, vi } from 'vitest';

import {
  createSchemaMigrationWorker,
  SCHEMA_MIGRATION_RPC,
  type MigrationWorkerResult,
  type MigrationWorkerTelemetryEvent,
  type SchemaMigrationWorkerDependencies,
} from './migration-worker';
import { job, NOW, PLAN_ID } from './migration-worker-test-support';
import {
  ERROR_CODE,
  HEX64,
  READ_SOURCE_ROWS_RPC,
  makeRows,
  makeScanDatabase,
  registryEntry,
  upperTitle,
  type RegistryEntry,
  type ScanDatabase,
  type SourceRow,
} from './migration-worker-scan-transform-test-support';

const DRY = SCHEMA_MIGRATION_RPC.processDryRunBatch;
const BACKFILL = SCHEMA_MIGRATION_RPC.processBatch;

const run = async (
  database: ScanDatabase,
  extra: Readonly<{
    registry?: readonly RegistryEntry[];
    maxBatchesPerInvocation?: number;
    maxBatchRows?: number;
    telemetry?: (event: MigrationWorkerTelemetryEvent) => void;
  }> = {},
): Promise<MigrationWorkerResult> =>
  createSchemaMigrationWorker({
    port: database,
    workerId: 'scan-worker',
    now: () => NOW,
    transformRegistry: extra.registry ?? [registryEntry()],
    ...(extra.maxBatchesPerInvocation === undefined
      ? {}
      : { maxBatchesPerInvocation: extra.maxBatchesPerInvocation }),
    ...(extra.maxBatchRows === undefined
      ? {}
      : { maxBatchRows: extra.maxBatchRows }),
    ...(extra.telemetry === undefined ? {} : { telemetry: extra.telemetry }),
  } as unknown as SchemaMigrationWorkerDependencies).process(job);

const order = (database: ScanDatabase): string[] =>
  database.calls.map((entry) => entry.rpc);

describe('dry-run scan reads the real affected rows (IA03 deep dive item 3)', () => {
  it('reads source rows through the read RPC with the plan, lease, cursor and a bounded limit before any batch write', async () => {
    const database = makeScanDatabase({ rows: makeRows(3) });
    await run(database);
    const reads = database.requests(READ_SOURCE_ROWS_RPC);
    expect(reads.length).toBeGreaterThanOrEqual(1);
    expect(reads[0]).toMatchObject({
      migrationPlanId: PLAN_ID,
      cursor: '0',
      leaseToken: 'lease-1',
    });
    expect(Number(reads[0]?.limit)).toBeGreaterThanOrEqual(1);
    expect(Number(reads[0]?.limit)).toBeLessThanOrEqual(128);
    expect(order(database).indexOf(READ_SOURCE_ROWS_RPC)).toBeLessThan(
      order(database).indexOf(DRY),
    );
  });

  it('posts one evidence entry per scanned row with exactly the allowed keys, in source order', async () => {
    const rows = makeRows(3);
    const database = makeScanDatabase({ rows });
    await run(database);
    const [evidence] = database.evidenceBatches(DRY);
    expect(evidence).toHaveLength(3);
    evidence?.forEach((entry, index) => {
      expect(Object.keys(entry).sort()).toEqual([
        'errorCode',
        'outputHash',
        'sourceHash',
        'sourceRowId',
        'sourceTable',
      ]);
      expect(entry.sourceRowId).toBe(rows[index]?.sourceRowId);
      expect(entry.sourceTable).toBe(rows[index]?.sourceTable);
      expect(entry.sourceHash).toBe(rows[index]?.sourceHash);
      expect(entry.outputHash).toMatch(HEX64);
      expect(entry.errorCode).toBeNull();
    });
  });

  it('keeps row content out of the dry-run write path and out of telemetry', async () => {
    const telemetry = vi.fn();
    const database = makeScanDatabase({ rows: makeRows(3) });
    await run(database, { telemetry });
    const written = JSON.stringify([
      database.requests(DRY),
      database.requests(SCHEMA_MIGRATION_RPC.finalizeDryRun),
      telemetry.mock.calls,
    ]);
    expect(database.evidenceBatches(DRY).flat()).toHaveLength(3);
    expect(written).not.toContain('title-secret');
    expect(JSON.stringify(telemetry.mock.calls)).not.toContain(
      'b0000000-0000-4000',
    );
  });

  it('derives every sealed counter from the scanned evidence, not from the plan', async () => {
    const database = makeScanDatabase({
      rows: makeRows(3),
      plan: { sourceCount: '0', targetCount: '0', rowErrorCount: '0' },
    });
    await run(database);
    expect(
      database.requests(SCHEMA_MIGRATION_RPC.finalizeDryRun)[0],
    ).toMatchObject({
      sourceCount: '3',
      targetCount: '3',
      rowErrorCount: '0',
    });
  });

  it('pages a large source in batches of at most 128 evidence entries and seals the full count', async () => {
    const database = makeScanDatabase({ rows: makeRows(300) });
    await run(database, { maxBatchesPerInvocation: 3 });
    expect(database.evidenceBatches(DRY).map((batch) => batch.length)).toEqual([
      128, 128, 44,
    ]);
    expect(
      database
        .requests(READ_SOURCE_ROWS_RPC)
        .slice(0, 3)
        .map((read) => read.cursor),
    ).toEqual(['0', '128', '256']);
    expect(
      database.requests(SCHEMA_MIGRATION_RPC.finalizeDryRun)[0],
    ).toMatchObject({
      sourceCount: '300',
      targetCount: '300',
      rowErrorCount: '0',
    });
  });

  it('honors a smaller configured batch size on both the read and the write', async () => {
    const database = makeScanDatabase({ rows: makeRows(5) });
    await run(database, { maxBatchRows: 2, maxBatchesPerInvocation: 3 });
    expect(database.requests(READ_SOURCE_ROWS_RPC)[0]?.limit).toBe(2);
    expect(database.evidenceBatches(DRY).map((batch) => batch.length)).toEqual([
      2, 2, 1,
    ]);
  });
});

describe('dry-run zero-source proof (additive result only after proving zero rows)', () => {
  it('proves zero rows by an actual empty read and an explicit empty evidence batch, ignoring a plan that claims rows', async () => {
    const database = makeScanDatabase({
      rows: [],
      plan: { sourceCount: '100' },
    });
    const result = await run(database);
    expect(
      database.requests(READ_SOURCE_ROWS_RPC).length,
    ).toBeGreaterThanOrEqual(1);
    expect(database.evidenceBatches(DRY)).toEqual([[]]);
    expect(
      database.requests(SCHEMA_MIGRATION_RPC.finalizeDryRun)[0],
    ).toMatchObject({
      sourceCount: '0',
      targetCount: '0',
      rowErrorCount: '0',
    });
    expect(result.outcome).toBe('completed');
  });

  it('never seals a zero-source result from a plan that claims zero when the scan finds rows', async () => {
    const database = makeScanDatabase({
      rows: makeRows(3),
      plan: { sourceCount: '0' },
    });
    await run(database);
    const finalize = database.requests(SCHEMA_MIGRATION_RPC.finalizeDryRun)[0];
    expect(finalize).toMatchObject({ sourceCount: '3' });
    expect(finalize?.sourceCount).not.toBe('0');
  });

  it('does not finalize before the scan read happened', async () => {
    const database = makeScanDatabase({ rows: [] });
    await run(database);
    expect(
      order(database).indexOf(READ_SOURCE_ROWS_RPC),
    ).toBeGreaterThanOrEqual(0);
    expect(order(database).indexOf(READ_SOURCE_ROWS_RPC)).toBeLessThan(
      order(database).indexOf(SCHEMA_MIGRATION_RPC.finalizeDryRun),
    );
  });

  it('scans an additive plan with no transform and no registry entry', async () => {
    const database = makeScanDatabase({
      rows: makeRows(2),
      plan: {
        transformKey: null,
        transformVersion: null,
        classification: 'additive',
      },
    });
    await run(database, { registry: [] });
    const [evidence] = database.evidenceBatches(DRY);
    expect(evidence).toHaveLength(2);
    expect(evidence?.every((entry) => entry.errorCode === null)).toBe(true);
    expect(
      database.requests(SCHEMA_MIGRATION_RPC.finalizeDryRun)[0],
    ).toMatchObject({
      sourceCount: '2',
      rowErrorCount: '0',
    });
  });
});

describe('registered pure transform executor (BE03a transform registry)', () => {
  it('applies the registered transform once per row and records distinct output hashes for distinct outputs', async () => {
    const apply = vi.fn(upperTitle);
    const database = makeScanDatabase({ rows: makeRows(3) });
    await run(database, { registry: [registryEntry(apply)] });
    const documents = makeRows(3).map((row) => row.document);
    expect(apply.mock.calls.slice(0, 3).map(([row]) => row)).toEqual(documents);
    const [evidence] = database.evidenceBatches(DRY);
    expect(new Set(evidence?.map((entry) => entry.outputHash)).size).toBe(3);
  });

  it('records identical output hashes for identical outputs and different ones when the transform differs', async () => {
    const twin = (index: number): SourceRow => ({
      ...makeRows(2)[index]!,
      document: { title: 'same', rank: 1 },
    });
    const sameRows = [twin(0), twin(1)];
    const first = makeScanDatabase({ rows: sameRows });
    await run(first);
    const [pair] = first.evidenceBatches(DRY);
    expect(pair?.[0]?.outputHash).toBe(pair?.[1]?.outputHash);
    const other = makeScanDatabase({ rows: sameRows });
    await run(other, {
      registry: [registryEntry((row) => ({ ...row, title: 'different' }))],
    });
    expect(other.evidenceBatches(DRY)[0]?.[0]?.outputHash).not.toBe(
      pair?.[0]?.outputHash,
    );
  });

  it('is deterministic across a fresh run over the same rows (resume and replay safe)', async () => {
    const first = makeScanDatabase({ rows: makeRows(4) });
    const second = makeScanDatabase({ rows: makeRows(4) });
    await run(first);
    await run(second);
    expect(first.evidenceBatches(DRY).flat()).toHaveLength(4);
    expect(second.evidenceBatches(DRY)).toEqual(first.evidenceBatches(DRY));
  });

  it('records a per-row error for a row the transform cannot handle and keeps scanning', async () => {
    const rows = makeRows(3).map((row, index) =>
      index === 1
        ? { ...row, document: { title: 'title-secret-bad', rank: 1 } }
        : row,
    );
    const database = makeScanDatabase({ rows });
    const result = await run(database);
    const [evidence] = database.evidenceBatches(DRY);
    expect(evidence).toHaveLength(3);
    expect(evidence?.[1]?.outputHash).toBeNull();
    expect(evidence?.[1]?.errorCode).toMatch(ERROR_CODE);
    expect(evidence?.[0]?.errorCode).toBeNull();
    expect(evidence?.[2]?.errorCode).toBeNull();
    expect(
      database.requests(SCHEMA_MIGRATION_RPC.finalizeDryRun)[0],
    ).toMatchObject({
      sourceCount: '3',
      targetCount: '2',
      rowErrorCount: '1',
    });
    expect(result.outcome).toBe('blocked');
    expect(database.requests(BACKFILL)).toHaveLength(0);
  });

  it.each([
    [
      'an unregistered key',
      { transformKey: 'unregistered.key', transformVersion: '1' },
    ],
    [
      'an unregistered version of a registered key',
      { transformKey: 'article.v2', transformVersion: '2' },
    ],
  ] as const)(
    'refuses %s before reading or writing any row',
    async (_label, plan) => {
      const database = makeScanDatabase({ rows: makeRows(3), plan });
      const result = await run(database);
      expect(result).toMatchObject({
        outcome: 'failed_terminal',
        reasonCode: 'TRANSFORM_NOT_REGISTERED',
      });
      expect(database.requests(READ_SOURCE_ROWS_RPC)).toHaveLength(0);
      expect(database.requests(DRY)).toHaveLength(0);
      expect(database.requests(SCHEMA_MIGRATION_RPC.rollback)).toHaveLength(1);
    },
  );

  it('refuses a read page above the 128-row bound without posting any evidence', async () => {
    const database = makeScanDatabase({
      rows: makeRows(3),
      readPageOverride: () => ({
        rows: makeRows(129),
        nextCursor: '129',
        done: false,
      }),
    });
    const result = await run(database);
    expect(result).toMatchObject({
      outcome: 'failed_terminal',
      reasonCode: 'DEPENDENCY_INVALID_RESPONSE',
    });
    expect(database.requests(DRY)).toHaveLength(0);
  });

  it.each([
    [
      'a malformed source hash',
      (rows: readonly SourceRow[]) => [{ ...rows[0]!, sourceHash: 'nothex' }],
    ],
    [
      'a duplicated source row',
      (rows: readonly SourceRow[]) => [rows[0]!, rows[0]!],
    ],
  ] as const)('refuses a read page with %s', async (_label, page) => {
    const rows = makeRows(2);
    const database = makeScanDatabase({
      rows,
      readPageOverride: () => ({
        rows: page(rows),
        nextCursor: '2',
        done: true,
      }),
    });
    const result = await run(database);
    expect(result).toMatchObject({
      outcome: 'failed_terminal',
      reasonCode: 'DEPENDENCY_INVALID_RESPONSE',
    });
    expect(database.requests(DRY)).toHaveLength(0);
  });

  it('retries without posting evidence when the source read is transiently unavailable', async () => {
    const failure = Object.assign(new Error('offline'), {
      code: 'DEPENDENCY_UNAVAILABLE',
      retryable: true,
    });
    const database = makeScanDatabase({
      rows: makeRows(3),
      readFailure: failure,
    });
    const result = await run(database);
    expect(result).toMatchObject({
      outcome: 'retry',
      reasonCode: 'DEPENDENCY_UNAVAILABLE',
    });
    expect(database.requests(READ_SOURCE_ROWS_RPC).length).toBeGreaterThan(0);
    expect(database.requests(DRY)).toHaveLength(0);
  });
});

describe('backfill executes the same registered transform as the dry run', () => {
  it('re-reads the source and posts evidence identical to the sealed dry run', async () => {
    const database = makeScanDatabase({ rows: makeRows(3) });
    const result = await run(database);
    expect(result.outcome).toBe('completed');
    const dry = database.evidenceBatches(DRY).flat();
    const backfill = database.evidenceBatches(BACKFILL).flat();
    expect(dry).toHaveLength(3);
    expect(backfill).toEqual(dry);
    expect(
      database.requests(READ_SOURCE_ROWS_RPC).length,
    ).toBeGreaterThanOrEqual(2);
  });
});
