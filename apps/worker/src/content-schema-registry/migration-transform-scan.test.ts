/** Default code-owned registry driven through the worker over the read RPC. */
import { describe, expect, it } from 'vitest';

import {
  createSchemaMigrationWorker,
  SCHEMA_MIGRATION_RPC,
  type SchemaMigrationWorkerDependencies,
} from './migration-worker';
import { NOW, job } from './migration-worker-test-support';
import {
  makeRows,
  makeScanDatabase,
  READ_SOURCE_ROWS_RPC,
} from './migration-worker-scan-transform-test-support';

const targetField = {
  fieldKey: 'subtitle',
  kind: 'short_text',
  required: true,
  defaultMode: 'literal',
  defaultValue: 'none',
  constraints: {},
};

const runDefault = (
  database: ReturnType<typeof makeScanDatabase>,
): ReturnType<ReturnType<typeof createSchemaMigrationWorker>['process']> =>
  createSchemaMigrationWorker({
    port: database,
    workerId: 'default-registry',
    now: () => NOW,
  } as SchemaMigrationWorkerDependencies).process(job);

const withTarget = (database: ReturnType<typeof makeScanDatabase>) => {
  const read = database.call;
  return {
    ...database,
    call: async (
      rpc: Parameters<typeof read>[0],
      request: unknown,
      signal: AbortSignal,
    ) => {
      const value = await read(rpc, request, signal);
      return rpc === READ_SOURCE_ROWS_RPC
        ? {
            ...(value as Record<string, unknown>),
            targetFields: [targetField],
            retiredFields: [],
          }
        : value;
    },
  };
};

describe('default registry through the worker', () => {
  it('identity.revalidate carries source hashes and blocks on a violating row', async () => {
    const database = makeScanDatabase({
      rows: makeRows(3),
      plan: { transformKey: 'identity.revalidate', transformVersion: '1' },
    });
    await runDefault(withTarget(database) as typeof database);
    const [first] = database.evidenceBatches(
      SCHEMA_MIGRATION_RPC.processDryRunBatch,
    );
    expect(first?.map((entry) => entry.errorCode)).toEqual([
      'TRANSFORM_TARGET_VIOLATION',
      'TRANSFORM_TARGET_VIOLATION',
      'TRANSFORM_TARGET_VIOLATION',
    ]);
    expect(database.requests(SCHEMA_MIGRATION_RPC.processBatch)).toHaveLength(
      0,
    );
    expect(
      database.requests(SCHEMA_MIGRATION_RPC.finalizeDryRun)[0],
    ).toMatchObject({ sourceCount: '3', targetCount: '0', rowErrorCount: '3' });
  });

  it('default.fill_literal fills absent values and passes the scan', async () => {
    const database = makeScanDatabase({
      rows: makeRows(3),
      plan: { transformKey: 'default.fill_literal', transformVersion: '1' },
    });
    const result = await runDefault(withTarget(database) as typeof database);
    const evidence = database.evidenceBatches(
      SCHEMA_MIGRATION_RPC.processDryRunBatch,
    )[0];
    expect(evidence?.every((entry) => entry.errorCode === null)).toBe(true);
    expect(
      evidence?.every((entry) =>
        /^[a-f0-9]{64}$/u.test(entry.outputHash ?? ''),
      ),
    ).toBe(true);
    expect(result.outcome).toBe('completed');
  });

  it('refuses a target field kind the member does not accept before posting evidence', async () => {
    const database = makeScanDatabase({
      rows: makeRows(2),
      plan: { transformKey: 'default.fill_literal', transformVersion: '1' },
    });
    const wrapped = withTarget(database);
    const result = await createSchemaMigrationWorker({
      port: {
        call: async (rpc, request, signal) => {
          const value = await wrapped.call(rpc, request, signal);
          return rpc === READ_SOURCE_ROWS_RPC
            ? {
                ...(value as Record<string, unknown>),
                targetFields: [{ ...targetField, kind: 'relation' }],
              }
            : value;
        },
      },
      workerId: 'kind-mismatch',
      now: () => NOW,
    }).process(job);
    expect(result).toMatchObject({
      outcome: 'failed_terminal',
      reasonCode: 'TRANSFORM_FIELD_KIND_MISMATCH',
    });
    expect(
      database.requests(SCHEMA_MIGRATION_RPC.processDryRunBatch),
    ).toHaveLength(0);
  });

  it('refuses a malformed targetFields entry on the read page', async () => {
    const database = makeScanDatabase({
      rows: makeRows(1),
      plan: {
        transformKey: null,
        transformVersion: null,
        classification: 'additive',
      },
    });
    const result = await createSchemaMigrationWorker({
      port: {
        call: async (rpc, request, signal) => {
          const value = await database.call(rpc, request, signal);
          return rpc === READ_SOURCE_ROWS_RPC
            ? {
                ...(value as Record<string, unknown>),
                targetFields: [{ fieldKey: 'x' }],
              }
            : value;
        },
      },
      workerId: 'bad-target',
      now: () => NOW,
    }).process(job);
    expect(result).toMatchObject({
      outcome: 'failed_terminal',
      reasonCode: 'DEPENDENCY_INVALID_RESPONSE',
    });
    expect(
      database.requests(SCHEMA_MIGRATION_RPC.processDryRunBatch),
    ).toHaveLength(0);
  });
});
