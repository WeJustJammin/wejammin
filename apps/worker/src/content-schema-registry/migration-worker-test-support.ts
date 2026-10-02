import { vi } from 'vitest';

import {
  SCHEMA_MIGRATION_RPC,
  type MigrationPlanRecord,
  type MigrationWorkerPort,
  type SchemaMigrationRpcName,
} from './migration-worker';

export const CONTENT_TYPE_ID = '10000000-0000-4000-8000-000000000001';
export const OLD_VERSION_ID = '20000000-0000-4000-8000-000000000002';
export const TARGET_VERSION_ID = '30000000-0000-4000-8000-000000000003';
export const PLAN_ID = '40000000-0000-4000-8000-000000000004';
export const EVENT_ID = '50000000-0000-4000-8000-000000000005';
export const CORRELATION_ID = '60000000-0000-4000-8000-000000000006';
export const CAUSATION_ID = '70000000-0000-4000-8000-000000000007';
export const HASH = 'a'.repeat(64);
export const TARGET_HASH = 'b'.repeat(64);
export const NOW = Date.parse('2026-09-02T12:00:00.000Z');

export const job = {
  schemaVersionId: TARGET_VERSION_ID,
  migrationPlanId: PLAN_ID,
  expectedVersion: '7',
  correlationId: CORRELATION_ID,
  causationId: CAUSATION_ID,
} as const;

export const event = {
  eventId: EVENT_ID,
  eventType: 'cms.schema.activated.v1' as const,
  schemaVersion: 1 as const,
  occurredAt: '2026-09-02T11:59:00.000Z',
  producer: 'cms.schema_registry',
  correlationId: CORRELATION_ID,
  causationId: CAUSATION_ID,
  aggregateType: 'cms_schema_migration',
  aggregateId: PLAN_ID,
  aggregateVersion: '7',
  payload: {
    contentTypeId: CONTENT_TYPE_ID,
    schemaVersionId: TARGET_VERSION_ID,
    migrationPlanId: PLAN_ID,
    activationEvidence: {
      key: 'editorial.default',
      version: '1',
      policyHash: HASH,
      riskClass: 'ordinary',
      requiredDecisionCount: 1,
      requiredCapabilities: ['cms.schema_designer'],
      approvalEvidenceHash: HASH,
    },
  },
} as const;

export const basePlan = (
  overrides: Partial<MigrationPlanRecord> = {},
): MigrationPlanRecord => ({
  id: PLAN_ID,
  contentTypeId: CONTENT_TYPE_ID,
  fromVersionId: OLD_VERSION_ID,
  toVersionId: TARGET_VERSION_ID,
  state: 'ready',
  version: '7',
  cursor: '0',
  progress: 0,
  sourceCount: '100',
  targetCount: '0',
  rowErrorCount: '0',
  migratedCount: '0',
  failedCount: '0',
  classification: 'breaking',
  transformKey: 'identity.revalidate',
  transformVersion: '1',
  compilerHash: HASH,
  sourceHash: HASH,
  targetHash: TARGET_HASH,
  activeVersionId: OLD_VERSION_ID,
  leaseOwner: null,
  leaseToken: null,
  leaseExpiresAt: null,
  ...overrides,
});

type Handler = (
  request: unknown,
  signal: AbortSignal,
) => unknown | Promise<unknown>;

/** The worker reads source rows before every batch; a port without rows serves an empty finished page. */
export const emptySourcePage = (
  request: unknown,
): Readonly<{ rows: []; nextCursor: string; done: true }> => ({
  rows: [],
  nextCursor: String((request as { cursor?: unknown }).cursor ?? '0'),
  done: true,
});

export const makePort = (
  handlers: Partial<Record<SchemaMigrationRpcName, Handler>> = {},
): MigrationWorkerPort & {
  calls: Array<{ rpc: string; request: unknown }>;
} => {
  const calls: Array<{ rpc: string; request: unknown }> = [];
  const call = vi.fn(
    async (
      rpc: SchemaMigrationRpcName,
      request: unknown,
      signal: AbortSignal,
    ) => {
      calls.push({ rpc, request });
      const handler = handlers[rpc];
      if (handler === undefined)
        return rpc === SCHEMA_MIGRATION_RPC.readSourceRows
          ? emptySourcePage(request)
          : {};
      return handler(request, signal);
    },
  );
  return { call, calls };
};
