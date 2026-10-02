import type {
  MigrationState,
  SchemaMigrationRpcName,
} from './migration-worker-constants';
import type { TransformRegistry } from './migration-transform-types';
import type {
  SchemaMigrationJobPayload,
  SchemaMigrationQueueEnvelope,
} from './migration-worker-input-schemas';
export type MigrationWorkerTelemetryEvent = Readonly<{
  operation: 'migration.consume' | 'migration.batch' | 'migration.recovery';
  outcome:
    | 'success'
    | 'progress'
    | 'retry'
    | 'duplicate'
    | 'stale'
    | 'blocked'
    | 'dead_letter'
    | 'failure';
  migrationPlanId: string | null;
  schemaVersionId: string | null;
  eventId: string | null;
  correlationId: string | null;
  cursor: string | null;
  progress: number | null;
  attempt: number;
  retryable: boolean;
  reasonCode: string | null;
  durationMs: number;
}>;

export type MigrationWorkerResult = Readonly<{
  outcome:
    | 'completed'
    | 'progress'
    | 'retry'
    | 'duplicate'
    | 'stale'
    | 'blocked'
    | 'failed_retryable'
    | 'failed_terminal'
    | 'dead_letter';
  migrationPlanId: string | null;
  schemaVersionId: string | null;
  eventId: string | null;
  state: MigrationState | null;
  cursor: string | null;
  progress: number | null;
  retryAfterMs: number | null;
  reasonCode: string | null;
  activationSwitched: boolean;
}>;

export type MigrationWorkerRpcFailure = Readonly<{
  code: string;
  retryable: boolean;
}>;

export type MigrationWorkerPort = Readonly<{
  call: (
    rpc: SchemaMigrationRpcName,
    request: unknown,
    signal: AbortSignal,
  ) => Promise<unknown>;
}>;

export type SchemaMigrationWorkerDependencies = Readonly<{
  port: MigrationWorkerPort;
  workerId: string;
  now?: () => number;
  leaseDurationMs?: number;
  maxBatchRows?: number;
  maxBatchesPerInvocation?: number;
  /** Code-owned transform registry; defaults to the built-in members. */
  transformRegistry?: TransformRegistry;
  eventClaimTokenFactory?: () => string;
  telemetry?: (event: MigrationWorkerTelemetryEvent) => void | Promise<void>;
}>;

export type SchemaMigrationWorker = Readonly<{
  process: (
    input: unknown,
    options?: Readonly<{
      signal?: AbortSignal;
      attempt?: number;
      replay?: boolean;
    }>,
  ) => Promise<MigrationWorkerResult>;
  replayDlq: (
    input: unknown,
    options?: Readonly<{ signal?: AbortSignal; attempt?: number }>,
  ) => Promise<MigrationWorkerResult>;
}>;

export type NormalizedInput = Readonly<{
  job: SchemaMigrationJobPayload | null;
  event: SchemaMigrationQueueEnvelope | null;
}>;

type RpcSuccess = Readonly<{ ok: true; value: unknown }>;
type RpcFailure = Readonly<{ ok: false; failure: MigrationWorkerRpcFailure }>;
export type RpcResult = RpcSuccess | RpcFailure;
export type RpcCaller = (
  rpc: SchemaMigrationRpcName,
  request: unknown,
  signal: AbortSignal,
) => Promise<RpcResult>;
