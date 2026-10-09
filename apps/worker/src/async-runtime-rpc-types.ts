import type {
  AsyncWorkerBindings,
  PlatformJobsMessage,
} from './async-entrypoint';
import type { CmsPublicationScheduleRpcName } from './cms-publication-schedule-rpc-names';
import type { SchemaMigrationRpcName } from './content-schema-registry/migration-worker';
import type { EventConsumerRpcName } from './event-consumers/rpc-names';

export type AsyncRpcOperation =
  | 'claim_outbox_batch'
  | 'complete_outbox_event'
  | 'idempotency_expiry_sweep'
  | 'cms_sweep_expired_review_authority'
  | 'cms_expire_edit_presence_leases'
  | 'read_canonical_job'
  | 'read_restore_fence'
  | 'claim_job'
  | 'heartbeat_job_lease'
  | 'apply_job_outcome'
  | 'record_processed_event'
  | 'ac265_prepare_hosted_run'
  | CmsPublicationScheduleRpcName
  | EventConsumerRpcName
  | SchemaMigrationRpcName;

export const PLATFORM_API_PROFILE = 'platform_api' as const;

export type AsyncRpcEnvironment = Pick<
  AsyncWorkerBindings,
  'SUPABASE_URL' | 'SUPABASE_SECRET_KEY'
>;

export type AsyncRpcClient = <T>(
  env: AsyncRpcEnvironment,
  operation: AsyncRpcOperation,
  input: Record<string, unknown>,
  signal?: AbortSignal,
) => Promise<T>;

export type AsyncJobRuntimeDependencies = Readonly<{
  rpc?: AsyncRpcClient;
  fetch?: typeof fetch;
  effect?: import('@wejammin/application').JobEffectPort['execute'];
  leaseToken?: (message: PlatformJobsMessage) => string;
  outboxLeaseToken?: () => string;
  leaseSeconds?: number;
  maxOutboxClaims?: number;
  now?: () => number;
}>;

/** BE00 caps every ordinary JSON response at 256 KiB. */
export const ASYNC_RPC_MAX_RESPONSE_BYTES = 256 * 1024;
/** Async RPCs are bounded by the protected-command deadline. */
export const ASYNC_RPC_DEADLINE_MS = 15_000;

export type AsyncRpcClientOptions = Readonly<{
  deadlineMs?: number;
  maxResponseBytes?: number;
}>;
