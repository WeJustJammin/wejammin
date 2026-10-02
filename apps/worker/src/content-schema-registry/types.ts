import type {
  ContentSchemaRegistryOperationId,
  ContentSchemaRegistryResult,
  ContentSchemaRegistrySession,
  ReleasePrincipal,
  VerifiedReleaseInput,
} from './types-core';
import type { ContentSchemaRegistryPorts } from './types-ports';

export * from './types-core';
export * from './types-ports';

export type RateLimitDecision = Readonly<{
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
}>;

export type TelemetryEvent = Readonly<{
  operationId: ContentSchemaRegistryOperationId;
  requestId: string;
  correlationId?: string;
  outcome: 'success' | 'rejected' | 'failure';
  status: number;
  errorCode?: string;
  durationMs: number;
  actorClass: 'human' | 'release-worker' | 'anonymous';
  rateClass?: string;
  rateLimit?: number;
  rateWindowSeconds?: number;
  deadlineMs?: number;
  slo?: Readonly<{
    tier: 2;
    commandP95Ms: 1_200;
    protectedRpcP95Ms: 300;
    acceptanceP99Ms: 1_000;
  }>;
  alertClass?: string;
  alertRoute?: string;
  runbook?: string;
  traceSteps?: readonly string[];
  metrics?: Readonly<Record<string, number>>;
}>;

export type ContentSchemaRegistryDependencies = Readonly<{
  ports: ContentSchemaRegistryPorts;
  resolveSession: (
    request: Request,
    signal: AbortSignal,
  ) => Promise<ContentSchemaRegistryResult<ContentSchemaRegistrySession>>;
  verifyRelease: (
    input: VerifiedReleaseInput,
    signal: AbortSignal,
  ) => Promise<ContentSchemaRegistryResult<ReleasePrincipal>>;
  rateLimit: (
    input: Readonly<{
      operationId: ContentSchemaRegistryOperationId;
      request: Request;
      actorId: string;
      actingPartyId: string | null;
      principalClass: 'human' | 'release-worker';
      rateClass: string;
      limit: number;
      /**
       * Per-acting-party quota for the same window (BE03a rate rows). Present
       * on every human operation; absent for the signed release worker, which
       * has no acting party.
       */
      partyLimit?: number;
      windowSeconds: number;
    }>,
    signal: AbortSignal,
  ) => Promise<ContentSchemaRegistryResult<RateLimitDecision>>;
  humanOrigins: readonly string[];
  releaseOrigins: readonly string[];
  now?: () => number;
  deadlineMs?: number;
  telemetry?: (event: TelemetryEvent) => void | Promise<void>;
}>;
