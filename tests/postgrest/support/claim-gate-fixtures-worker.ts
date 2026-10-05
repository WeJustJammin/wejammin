/**
 * Valid requests for the service-role-only worker functions.
 *
 * The migration worker functions open with `cms_require_release_worker()`
 * (the role claim, read from `request.jwt.claims`) and only then validate the
 * request, so a valid request is what lets a real service-role call reach the
 * database lookup (an unknown plan is NOT_FOUND). The release-principal pair
 * (`cms_register_block`, `cms_advance_block_lifecycle`) additionally resolves a
 * registered release key.
 */
import { randomUUID } from 'node:crypto';

import {
  HEX64,
  IDEMPOTENCY_KEY,
  NOW,
  id,
  type FixtureTable,
} from './claim-gate-fixtures-types';

const PLAN = id(40);
const VERSION = id(41);
const TOKEN = id(42);
const WORKER = 'api-gate-worker';
const FINGERPRINT = {
  transformKey: 'identity',
  transformVersion: '1',
  compilerHash: HEX64,
  sourceHash: HEX64,
  targetHash: HEX64,
};
const EVENT = {
  eventId: id(43),
  eventType: 'cms.schema.migration.requested',
  schemaVersion: '1',
  aggregateType: 'cms_schema_migration',
  aggregateId: id(44),
  aggregateVersion: '1',
  migrationPlanId: PLAN,
  claimToken: TOKEN,
};
const COUNTS = {
  sourceCount: '0',
  targetCount: '0',
  rowErrorCount: '0',
};

export const WORKER_FIXTURES: FixtureTable = {
  cms_acknowledge_schema_migration_event: {
    request: { ...EVENT, outcome: 'success' },
    real: '400:CONFLICT',
  },
  cms_activate_schema_migration: {
    request: {
      migrationPlanId: PLAN,
      contentTypeId: id(1),
      schemaVersionId: VERSION,
      expectedVersion: '1',
      expectedActiveVersionId: id(45),
      ...FINGERPRINT,
      idempotencyKey: IDEMPOTENCY_KEY,
      switchOnlyOnce: true,
    },
    real: '400:NOT_FOUND',
  },
  cms_begin_schema_migration_verification: {
    request: {
      migrationPlanId: PLAN,
      expectedVersion: '1',
      cursor: '0',
      ...COUNTS,
      migratedCount: '0',
      failedCount: '0',
      ...FINGERPRINT,
    },
    real: '400:NOT_FOUND',
  },
  cms_claim_schema_migration_event: {
    request: { ...EVENT, replay: false },
    real: '400:NOT_FOUND',
  },
  cms_claim_schema_migration_lease: {
    request: {
      migrationPlanId: PLAN,
      schemaVersionId: VERSION,
      expectedVersion: '1',
      cursor: '0',
      leaseOwner: WORKER,
      workerId: WORKER,
      leaseDurationMs: '1000',
      now: NOW,
      ...FINGERPRINT,
    },
    real: '400:NOT_FOUND',
  },
  cms_complete_schema_migration: {
    request: { migrationPlanId: PLAN, expectedVersion: '1', leaseToken: TOKEN },
    real: '400:NOT_FOUND',
  },
  // A dead letter for an unknown event creates its own record, so each call
  // names a fresh event: a repeat of one id would answer CONFLICT.
  cms_dead_letter_schema_migration_event: {
    request: () => ({
      eventId: randomUUID(),
      claimToken: TOKEN,
      reasonCode: 'API_GATE_PROBE',
    }),
    real: '200:',
  },
  cms_finalize_schema_migration_dry_run: {
    request: {
      migrationPlanId: PLAN,
      expectedVersion: '1',
      cursor: '0',
      ...COUNTS,
      ...FINGERPRINT,
    },
    real: '400:NOT_FOUND',
  },
  cms_get_schema_migration_plan: {
    request: {
      migrationPlanId: PLAN,
      schemaVersionId: VERSION,
      expectedVersion: '1',
    },
    real: '400:NOT_FOUND',
  },
  cms_heartbeat_schema_migration_lease: {
    request: {
      migrationPlanId: PLAN,
      expectedVersion: '1',
      cursor: '0',
      leaseToken: 'api-gate-lease-token',
      workerId: WORKER,
      now: NOW,
      leaseDurationMs: '1000',
    },
    real: '400:NOT_FOUND',
  },
  cms_process_schema_migration_batch: {
    request: {
      migrationPlanId: PLAN,
      schemaVersionId: VERSION,
      expectedVersion: '1',
      cursor: '0',
      limit: '1',
      leaseToken: 'api-gate-lease-token',
      rowEvidence: [],
      ...FINGERPRINT,
      correlationId: id(46),
      causationId: null,
    },
    real: '400:NOT_FOUND',
  },
  cms_process_schema_migration_dry_run_batch: {
    request: {
      migrationPlanId: PLAN,
      schemaVersionId: VERSION,
      expectedVersion: '1',
      cursor: '0',
      limit: '1',
      leaseToken: 'api-gate-lease-token',
      rowEvidence: [],
      ...FINGERPRINT,
      correlationId: id(46),
      causationId: null,
    },
    real: '400:NOT_FOUND',
  },
  cms_read_schema_migration_source_rows: {
    request: {
      migrationPlanId: PLAN,
      expectedVersion: '1',
      cursor: '0',
      limit: '1',
      leaseToken: 'api-gate-lease-token',
    },
    real: '400:NOT_FOUND',
  },
  cms_reconcile_schema_activation: {
    request: {
      migrationPlanId: PLAN,
      schemaVersionId: VERSION,
      expectedActiveVersionId: id(45),
      idempotencyKey: IDEMPOTENCY_KEY,
    },
    real: '400:NOT_FOUND',
  },
  cms_release_schema_migration_event: {
    request: EVENT,
    real: '400:CONFLICT',
  },
  cms_rollback_schema_migration: {
    request: {
      migrationPlanId: PLAN,
      schemaVersionId: VERSION,
      expectedVersion: '1',
      cursor: '0',
      leaseToken: 'api-gate-lease-token',
      reasonCode: 'API_GATE_PROBE',
      retryable: false,
      fallbackVersionId: id(45),
      preserveOldActive: true,
      deleteRows: false,
      ...FINGERPRINT,
    },
    real: '400:NOT_FOUND',
  },
  cms_verify_schema_migration: {
    request: {
      migrationPlanId: PLAN,
      schemaVersionId: VERSION,
      expectedVersion: '1',
      cursor: '0',
      leaseToken: 'api-gate-lease-token',
      ...COUNTS,
      migratedCount: '0',
      failedCount: '0',
      ...FINGERPRINT,
    },
    real: '400:NOT_FOUND',
  },
};

/** Release-principal functions: the request is validated only after the key resolves. */
export const RELEASE_PRINCIPAL_FIXTURES: FixtureTable = {
  cms_register_block: {
    request: {
      blockKey: 'api-gate-block',
      blockVersion: '1',
      idempotencyKey: IDEMPOTENCY_KEY,
      correlationId: id(48),
    },
    real: '400:VALIDATION_FAILED',
  },
  cms_advance_block_lifecycle: {
    request: {
      blockDefinitionVersionId: id(47),
      fromLifecycle: 'unknown',
      toLifecycle: 'deprecated',
      expectedVersion: '1',
      releaseDigest: HEX64,
      idempotencyKey: IDEMPOTENCY_KEY,
      correlationId: id(48),
    },
    real: '400:VALIDATION_FAILED',
  },
};
