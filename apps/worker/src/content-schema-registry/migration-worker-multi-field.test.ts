/**
 * Worker-level multi-field scan: several changed fields plus retired fields on
 * one read page, one shared page limit per read/batch request, the evidence
 * count expectation, and the rule that source documents are never logged.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createSchemaMigrationWorker,
  SCHEMA_MIGRATION_RPC,
  type MigrationWorkerTelemetryEvent,
  type SchemaMigrationWorkerDependencies,
} from './migration-worker';
import { canonicalHash } from './migration-transform-jcs';
import { NOW, job } from './migration-worker-test-support';
import {
  makeScanDatabase,
  NO_FIELDS,
  READ_SOURCE_ROWS_RPC,
  registryEntry,
  type ScanDatabase,
  type SourceRow,
} from './migration-worker-scan-transform-test-support';

const DRY = SCHEMA_MIGRATION_RPC.processDryRunBatch;
const BACKFILL = SCHEMA_MIGRATION_RPC.processBatch;

const TITLE = {
  fieldKey: 'title',
  kind: 'short_text',
  required: true,
  defaultMode: 'literal',
  defaultValue: 'untitled',
  constraints: { maxLength: 8 },
};
const RANK = {
  fieldKey: 'rank',
  kind: 'integer',
  required: false,
  defaultMode: 'literal',
  defaultValue: 1,
  constraints: { minimum: 1 },
};

const rowFor = (index: number, document: SourceRow['document']): SourceRow => ({
  sourceTable: 'cms_entry_revisions',
  sourceRowId: `c0000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
  sourceHash: (index + 1).toString(16).padStart(64, '0'),
  document,
});

const run = (
  database: ScanDatabase,
  extra: Readonly<Record<string, unknown>> = {},
) =>
  createSchemaMigrationWorker({
    port: database,
    workerId: 'multi-field',
    now: () => NOW,
    ...extra,
  } as unknown as SchemaMigrationWorkerDependencies).process(job);

afterEach(() => vi.restoreAllMocks());

describe('identity.revalidate through the worker with several fields', () => {
  it('validates every changed field, carries retired values, and posts per-row evidence', async () => {
    const rows = [
      rowFor(0, { title: 'ok', rank: 2, legacy: { junk: true } }),
      rowFor(1, { title: 'ok', rank: 0, legacy: 'x' }),
      rowFor(2, { title: 'far-too-long-title', rank: 5 }),
      rowFor(3, { title: 'fine' }),
    ];
    const database = makeScanDatabase({
      rows,
      plan: { transformKey: 'identity.revalidate', transformVersion: '1' },
      targetFields: [TITLE, RANK],
      retiredFields: ['legacy'],
    });
    await run(database);
    const [first] = database.evidenceBatches(DRY);
    expect(first?.map((entry) => entry.errorCode)).toEqual([
      null,
      'TRANSFORM_TARGET_VIOLATION',
      'TRANSFORM_TARGET_VIOLATION',
      null,
    ]);
    expect(first?.[0]?.outputHash).toBe(rows[0]?.sourceHash);
    expect(first?.[3]?.outputHash).toBe(rows[3]?.sourceHash);
    expect(database.requests(BACKFILL)).toHaveLength(0);
  });

  it('refuses the whole page when any target field kind is not accepted', async () => {
    const database = makeScanDatabase({
      rows: [rowFor(0, { title: 'a' })],
      plan: { transformKey: 'default.fill_literal', transformVersion: '1' },
      targetFields: [TITLE, { ...RANK, kind: 'relation' }],
    });
    const result = await run(database);
    expect(result).toMatchObject({
      outcome: 'failed_terminal',
      reasonCode: 'TRANSFORM_FIELD_KIND_MISMATCH',
    });
    expect(database.requests(DRY)).toHaveLength(0);
  });
});

describe('default.fill_literal through the worker with several fields', () => {
  it('fills each changed field and hashes the filled document', async () => {
    const rows = [
      rowFor(0, { other: 'x' }),
      rowFor(1, { title: 't', rank: 4 }),
    ];
    const database = makeScanDatabase({
      rows,
      plan: { transformKey: 'default.fill_literal', transformVersion: '1' },
      targetFields: [TITLE, RANK],
      retiredFields: ['legacy'],
    });
    const result = await run(database);
    expect(result.outcome).toBe('completed');
    const [batch] = database.evidenceBatches(DRY);
    expect(batch?.[0]?.outputHash).toBe(
      await canonicalHash({ other: 'x', title: 'untitled', rank: 1 }),
    );
    expect(batch?.[1]?.outputHash).toBe(
      await canonicalHash({ title: 't', rank: 4 }),
    );
    expect(database.evidenceBatches(BACKFILL)).toEqual(
      database.evidenceBatches(DRY),
    );
  });
});

describe('one page limit per request and the evidence-count expectation', () => {
  it('sends the same limit on every read and its batch, with evidence equal to the page size', async () => {
    const rows = Array.from({ length: 5 }, (_, index) =>
      rowFor(index, { title: `t${index}` }),
    );
    const database = makeScanDatabase({ rows });
    await run(database, {
      maxBatchRows: 2,
      maxBatchesPerInvocation: 6,
      transformRegistry: [registryEntry()],
    });
    for (const rpc of [DRY, BACKFILL]) {
      const batches = database.requests(rpc);
      expect(batches.map((request) => request.limit)).toEqual([2, 2, 2]);
      expect(
        database.evidenceBatches(rpc).map((evidence) => evidence.length),
      ).toEqual([2, 2, 1]);
    }
    const reads = database.requests(READ_SOURCE_ROWS_RPC);
    expect(reads.map((request) => request.limit)).toEqual([2, 2, 2, 2, 2, 2]);
    const order = database.calls
      .filter((entry) => [READ_SOURCE_ROWS_RPC, DRY].includes(entry.rpc))
      .map((entry) => [entry.rpc, entry.request.limit]);
    expect(order.slice(0, 2)).toEqual([
      [READ_SOURCE_ROWS_RPC, 2],
      [DRY, 2],
    ]);
  });

  it('fails closed on a short page that claims more rows remain, posting no evidence', async () => {
    const rows = [rowFor(0, { title: 'a' }), rowFor(1, { title: 'b' })];
    const database = makeScanDatabase({
      rows,
      readPageOverride: () => ({
        rows: [rows[0]],
        nextCursor: '1',
        done: false,
        ...NO_FIELDS,
      }),
    });
    const result = await run(database, {
      maxBatchRows: 2,
      transformRegistry: [registryEntry()],
    });
    expect(result).toMatchObject({
      outcome: 'failed_terminal',
      reasonCode: 'DEPENDENCY_INVALID_RESPONSE',
    });
    expect(database.requests(DRY)).toHaveLength(0);
  });
});

describe('source documents are never logged', () => {
  const MARKER = 'DOC-CONTENT-MARKER';

  it('keeps document content out of telemetry, console output, results and non-read RPC requests', async () => {
    const consoleSpies = (
      ['log', 'info', 'warn', 'error', 'debug'] as const
    ).map((method) => vi.spyOn(console, method).mockImplementation(() => {}));
    const rows = [
      rowFor(0, { title: `${MARKER}-ok`, rank: 2, legacy: `${MARKER}-old` }),
      rowFor(1, { title: `${MARKER}-bad`, rank: 0 }),
      rowFor(2, { title: `${MARKER}-way-too-long`, rank: 3 }),
    ];
    const events: MigrationWorkerTelemetryEvent[] = [];
    const throwing = registryEntry(
      (row) => {
        throw new Error(`cannot transform ${JSON.stringify(row)}`);
      },
      { key: 'identity.revalidate', digest: 'd'.repeat(64) },
    );
    const outputs: unknown[] = [];
    for (const registry of [undefined, [throwing]]) {
      const database = makeScanDatabase({
        rows,
        plan: { transformKey: 'identity.revalidate', transformVersion: '1' },
        targetFields: [TITLE, RANK],
        retiredFields: ['legacy'],
      });
      outputs.push(
        await run(database, {
          telemetry: (event: MigrationWorkerTelemetryEvent) => {
            events.push(event);
          },
          ...(registry === undefined ? {} : { transformRegistry: registry }),
        }),
      );
      outputs.push(
        database.calls
          .filter((entry) => entry.rpc !== READ_SOURCE_ROWS_RPC)
          .map((entry) => entry.request),
      );
    }
    expect(events.length).toBeGreaterThan(0);
    expect(JSON.stringify(events)).not.toContain(MARKER);
    expect(JSON.stringify(outputs)).not.toContain(MARKER);
    for (const spy of consoleSpies) expect(spy).not.toHaveBeenCalled();
  });

  it('keeps document content out of telemetry when the page is malformed', async () => {
    const events: MigrationWorkerTelemetryEvent[] = [];
    const database = makeScanDatabase({
      rows: [rowFor(0, { title: `${MARKER}-x` })],
      readPageOverride: () => ({
        rows: [rowFor(0, { title: `${MARKER}-x` })],
        nextCursor: 'not-a-counter',
        done: true,
        ...NO_FIELDS,
      }),
    });
    const result = await run(database, {
      telemetry: (event: MigrationWorkerTelemetryEvent) => {
        events.push(event);
      },
      transformRegistry: [registryEntry()],
    });
    expect(result.reasonCode).toBe('DEPENDENCY_INVALID_RESPONSE');
    expect(JSON.stringify([events, result])).not.toContain(MARKER);
  });
});
