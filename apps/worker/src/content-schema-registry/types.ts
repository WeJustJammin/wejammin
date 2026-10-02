import type {
  BlockLifecycleAdvanceRequest,
  BlockLifecycleEventResource,
  BlockRegistrationRequest,
  ContentSchemaRegistryDetail,
  ContentSchemaRegistryListPage,
  ContentSchemaRegistryListQuery,
  ContentTypeDraftRequest,
  ContentTypeVersionResource,
  FieldSchemaChangeRequest,
  RelationBindingRequest,
  RelationDefinitionResource,
  ReleaseEnvelopeHeaders,
  SchemaActivationRequest,
  SchemaActivationResource,
} from './contracts';
import type { CONTENT_SCHEMA_REGISTRY_PRESENTATION_VARIANTS } from '@wejammin/contracts';

export type ContentSchemaRegistryOperationId =
  | 'CMS-03A-01'
  | 'CMS-03A-02'
  | 'CMS-03A-03'
  | 'CMS-03A-04'
  | 'CMS-03A-05'
  | 'CMS-03A-06'
  | 'CMS-03A-07'
  | 'CMS-03A-08';

/** Stable scrubbed identifier for the operational runbook. */
export const CONTENT_SCHEMA_REGISTRY_RUNBOOK =
  'content-schema-registry' as const;

export type ContentSchemaRegistrySession = Readonly<{
  userId: string;
  actingPartyId: string | null;
  capabilities: readonly string[];
  mfaFresh: boolean;
  /**
   * Server-derived expiry of the verified step-up window. Present only when
   * verified step-up is currently fresh; the browser may disclose but never
   * authorize from it. Derived from the authenticated step-up time only.
   */
  stepUpFreshUntil?: string;
  /** Optional server-selected UI scope; never read from browser input. */
  presentationVariant?: (typeof CONTENT_SCHEMA_REGISTRY_PRESENTATION_VARIANTS)[number];
}>;

export type ReleasePrincipal = Readonly<{
  principalId: string;
  keyId: string;
  capabilities: readonly string[];
  verifiedAt: string;
  rawBodyHash: string;
  signatureHash: string;
  nonceHash: string;
}>;

export type ContentSchemaRegistryError = Readonly<{
  ok: false;
  status:
    400 | 401 | 403 | 404 | 409 | 413 | 415 | 422 | 429 | 500 | 502 | 503 | 504;
  code: string;
  message: string;
  details?: Readonly<Record<string, unknown>>;
  retryAfterSeconds?: number;
}>;

export type ContentSchemaRegistryResult<T> =
  Readonly<{ ok: true; value: T }> | ContentSchemaRegistryError;

export type VerifiedReleaseInput = Readonly<{
  operationId: 'CMS-03A-05' | 'CMS-03A-08';
  requestId: string;
  request: Request;
  rawBody: Uint8Array;
  headers: ReleaseEnvelopeHeaders;
}>;

export type ContentSchemaRegistryPortInput = Readonly<{
  operationId: ContentSchemaRegistryOperationId;
  requestId: string;
  request: Request;
  session?: ContentSchemaRegistrySession;
  principal?: ReleasePrincipal;
  path?: Readonly<Record<string, string>>;
  body?:
    | ContentTypeDraftRequest
    | FieldSchemaChangeRequest
    | RelationBindingRequest
    | SchemaActivationRequest
    | BlockRegistrationRequest
    | BlockLifecycleAdvanceRequest;
  query?: ContentSchemaRegistryListQuery;
  idempotencyKey?: string;
  ifMatch?: string;
  rawBody?: Uint8Array;
  release?: Readonly<{
    headers: ReleaseEnvelopeHeaders;
    rawBody: Uint8Array;
  }>;
}>;

export type ContentSchemaRegistryPorts = Readonly<{
  createTypeDraft: (
    input: ContentSchemaRegistryPortInput,
    signal: AbortSignal,
  ) => Promise<ContentSchemaRegistryResult<ContentTypeVersionResource>>;
  addFieldDefinition: (
    input: ContentSchemaRegistryPortInput,
    signal: AbortSignal,
  ) => Promise<
    ContentSchemaRegistryResult<
      import('./contracts').FieldDefinitionVersionResource
    >
  >;
  bindRelation: (
    input: ContentSchemaRegistryPortInput,
    signal: AbortSignal,
  ) => Promise<ContentSchemaRegistryResult<RelationDefinitionResource>>;
  activateSchema: (
    input: ContentSchemaRegistryPortInput,
    signal: AbortSignal,
  ) => Promise<ContentSchemaRegistryResult<SchemaActivationResource>>;
  registerBlock: (
    input: ContentSchemaRegistryPortInput,
    signal: AbortSignal,
  ) => Promise<
    ContentSchemaRegistryResult<
      import('./contracts').BlockDefinitionVersionResource
    >
  >;
  advanceBlockLifecycle: (
    input: ContentSchemaRegistryPortInput,
    signal: AbortSignal,
  ) => Promise<ContentSchemaRegistryResult<BlockLifecycleEventResource>>;
  listContentTypes: (
    input: ContentSchemaRegistryPortInput,
    signal: AbortSignal,
  ) => Promise<ContentSchemaRegistryResult<ContentSchemaRegistryListPage>>;
  getContentTypeVersion: (
    input: ContentSchemaRegistryPortInput,
    signal: AbortSignal,
  ) => Promise<ContentSchemaRegistryResult<ContentSchemaRegistryDetail>>;
}>;

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
