/** Shared constants and RPC names for the CMS migration worker. */
export const MAX_MIGRATION_QUEUE_BYTES = 16 * 1024;
export const MAX_MIGRATION_BATCH_ROWS = 128;
export const DEFAULT_MIGRATION_BATCH_ROWS = 128;
export const DEFAULT_MIGRATION_LEASE_MS = 30_000;
export const DEFAULT_MAX_BATCHES_PER_INVOCATION = 1;

export const MIGRATION_RETRY_DELAYS_MS = [15_000, 60_000, 300_000] as const;

export const MIGRATION_STATES = [
  'draft',
  'dry_running',
  'ready',
  'blocked',
  'running',
  'verifying',
  'completed',
  'failed_retryable',
  'failed_terminal',
] as const;

export type MigrationState = (typeof MIGRATION_STATES)[number];

/**
 * This table is intentionally closed.  No worker path may reopen a terminal
 * plan or skip the verification gate.
 */
export const MIGRATION_STATE_TRANSITIONS: Readonly<
  Record<MigrationState, readonly MigrationState[]>
> = {
  draft: ['dry_running'],
  dry_running: ['ready', 'blocked'],
  ready: ['running', 'blocked'],
  blocked: ['draft'],
  running: ['verifying', 'failed_retryable', 'failed_terminal'],
  verifying: ['completed', 'failed_retryable', 'failed_terminal'],
  completed: [],
  failed_retryable: ['running'],
  failed_terminal: [],
};

/** Names are part of the persistence boundary; callers cannot issue table SQL. */
export const SCHEMA_MIGRATION_RPC = {
  readPlan: 'cms_get_schema_migration_plan',
  claimLease: 'cms_claim_schema_migration_lease',
  heartbeatLease: 'cms_heartbeat_schema_migration_lease',
  readSourceRows: 'cms_read_schema_migration_source_rows',
  processDryRunBatch: 'cms_process_schema_migration_dry_run_batch',
  finalizeDryRun: 'cms_finalize_schema_migration_dry_run',
  processBatch: 'cms_process_schema_migration_batch',
  beginVerification: 'cms_begin_schema_migration_verification',
  verify: 'cms_verify_schema_migration',
  complete: 'cms_complete_schema_migration',
  activate: 'cms_activate_schema_migration',
  reconcileActivation: 'cms_reconcile_schema_activation',
  rollback: 'cms_rollback_schema_migration',
  claimEvent: 'cms_claim_schema_migration_event',
  releaseEvent: 'cms_release_schema_migration_event',
  acknowledgeEvent: 'cms_acknowledge_schema_migration_event',
  deadLetter: 'cms_dead_letter_schema_migration_event',
} as const;

export type SchemaMigrationRpcName =
  (typeof SCHEMA_MIGRATION_RPC)[keyof typeof SCHEMA_MIGRATION_RPC];
