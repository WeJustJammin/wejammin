import { CONTENT_SCHEMA_REGISTRY_PRESENTATION_VARIANTS } from '@wejammin/contracts';
import type { ServerEnvironment } from '@wejammin/config/environment';

import type {
  AuthenticationDependencies,
  AuthenticationSession,
} from '../authentication/types';
import type {
  ContentSchemaRegistryDependencies,
  ReleasePrincipal,
} from './types';

export const MAX_DEFAULT_RESPONSE_BYTES = 256 * 1024;
export const DEFAULT_DEADLINE_MS = 15_000;
export const MAX_ORIGIN_LENGTH = 2048;
export const HASH_PATTERN = /^[a-f0-9]{64}$/u;
export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export type CapabilityResolver = (
  session: AuthenticationSession,
  request: Request,
  env: ServerEnvironment,
  signal: AbortSignal,
) => ReadonlyArray<string> | Promise<ReadonlyArray<string>>;

/** Server-only presentation scope resolver; browser role labels never enter this seam. */
export type PresentationVariantResolver = (
  session: AuthenticationSession,
  request: Request,
  env: ServerEnvironment,
  signal: AbortSignal,
) =>
  | (typeof CONTENT_SCHEMA_REGISTRY_PRESENTATION_VARIANTS)[number]
  | null
  | Promise<
      (typeof CONTENT_SCHEMA_REGISTRY_PRESENTATION_VARIANTS)[number] | null
    >;

export type ContentSchemaRegistryProductionOptions = Readonly<{
  environment: ServerEnvironment;
  fetchImpl?: typeof fetch;
  auth?: Pick<AuthenticationDependencies, 'resolveSession'> &
    Partial<Pick<AuthenticationDependencies, 'rateLimit'>>;
  /** Direct server session seam for focused composition tests. */
  resolveSession?: ContentSchemaRegistryDependencies['resolveSession'];
  resolveRequestContext?: (
    request: Request,
    env: ServerEnvironment,
    signal?: AbortSignal,
    session?: AuthenticationSession,
  ) => unknown | Promise<unknown>;
  resolveCapabilities?: CapabilityResolver;
  resolvePresentationVariant?: PresentationVariantResolver;
  verifyRelease?: ContentSchemaRegistryDependencies['verifyRelease'];
  /** Alias used by deployments that name this seam as a verifier. */
  releaseVerifier?: ContentSchemaRegistryDependencies['verifyRelease'];
  rateLimit?: ContentSchemaRegistryDependencies['rateLimit'];
  humanOrigins?: readonly string[];
  releaseOrigins?: readonly string[];
  maxResponseBytes?: number;
  deadlineMs?: number;
  now?: () => number;
  telemetry?: ContentSchemaRegistryDependencies['telemetry'];
  logger?: import('@wejammin/observability/logging').Logger;
}>;

export type ProductionConfiguration = Readonly<{
  auth: import('../authentication/production-configuration').AuthProductionConfiguration;
  deadlineMs: number;
  maxResponseBytes: number;
  now: () => number;
}>;

export class ContentSchemaRegistryProductionConfigurationError extends Error {
  constructor(
    message = 'Invalid content schema registry production configuration',
  ) {
    super(message);
    this.name = 'ContentSchemaRegistryProductionConfigurationError';
  }
}

export type ServerSessionContext = Readonly<{
  authUserId: string;
  sessionId: string;
  actorPersonId: string | null;
  actingPartyId: string | null;
  stepUpAt: string | null;
  /**
   * Private validated acting-context binding id from the service-role session
   * projection. Internal only: activation alone carries it to the private RPC
   * for binding authority checks. Other RPCs, public responses, headers, logs,
   * and telemetry never receive it.
   */
  actingContextId: string | null;
}>;

export type ReleaseVerifierFactory = (
  input: import('./types').VerifiedReleaseInput,
  signal: AbortSignal,
) => Promise<import('./types').ContentSchemaRegistryResult<ReleasePrincipal>>;
