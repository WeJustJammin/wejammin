import {
  normalizeAuthProductionOptions,
  type AuthProductionOptions,
} from '../authentication/production-configuration';
import type {
  ContentSchemaRegistryDependencies,
  ContentSchemaRegistryPortInput,
  ContentSchemaRegistryResult,
} from './types';
import {
  correlationFor,
  configuredOriginList,
  rpcBodyFor,
  validateOriginList,
} from './production-context';
import { mapRpcFailure } from './production-errors';
import {
  fetchWithDeadline,
  parseJsonResponse,
  readRpcError,
} from './production-transport';
import { createSessionResolver } from './production-auth';
import { createRateLimiter } from './production-rate';
import { createReleaseVerification } from './production-release';
import { supabaseRpcHeaders } from '../supabase-rpc-headers';
import {
  ContentSchemaRegistryProductionConfigurationError,
  DEFAULT_DEADLINE_MS,
  MAX_DEFAULT_RESPONSE_BYTES,
  type ContentSchemaRegistryProductionOptions,
  type ProductionConfiguration,
  type ServerSessionContext,
} from './production-types';
import {
  defaultProductionLogger,
  productionTelemetry,
} from './production-telemetry';

export const CMS_SCHEMA_REGISTRY_RPC = {
  createTypeDraft: 'cms_create_type_draft',
  addFieldDefinition: 'cms_add_field_definition',
  bindRelation: 'cms_bind_relation',
  activateSchema: 'cms_activate_schema',
  registerBlock: 'cms_register_block',
  listContentTypes: 'cms_list_content_types',
  getContentTypeVersion: 'cms_get_content_type_version',
  advanceBlockLifecycle: 'cms_advance_block_lifecycle',
  createSchemaSuccessor: 'cms_create_schema_successor',
  startSchemaDryRun: 'cms_start_schema_dry_run',
  submitSchemaReview: 'cms_submit_schema_review',
  decideSchemaReview: 'cms_decide_schema_review',
  getSchemaReview: 'cms_get_schema_review',
  assignSchemaReview: 'cms_assign_schema_review',
  grantCapability: 'cms_grant_capability',
  renewCapabilityGrant: 'cms_renew_capability_grant',
  revokeCapabilityGrant: 'cms_revoke_capability_grant',
  listCapabilityGrants: 'cms_list_capability_grants',
} as const satisfies Readonly<
  Record<keyof ContentSchemaRegistryDependencies['ports'], string>
>;

export const createProductionContentSchemaRegistryDependencies = (
  options: ContentSchemaRegistryProductionOptions,
): ContentSchemaRegistryDependencies => {
  let authConfiguration: ProductionConfiguration['auth'];
  try {
    const authOptions: AuthProductionOptions = {
      environment: options.environment,
      ...(options.fetchImpl === undefined
        ? {}
        : { fetchImpl: options.fetchImpl }),
    };
    authConfiguration = normalizeAuthProductionOptions(authOptions);
  } catch (error) {
    throw new ContentSchemaRegistryProductionConfigurationError(
      error instanceof Error ? error.message : undefined,
    );
  }

  const deadlineMs = options.deadlineMs ?? DEFAULT_DEADLINE_MS;
  const maxResponseBytes =
    options.maxResponseBytes ?? MAX_DEFAULT_RESPONSE_BYTES;
  if (
    !Number.isSafeInteger(deadlineMs) ||
    deadlineMs < 1 ||
    deadlineMs > DEFAULT_DEADLINE_MS ||
    !Number.isSafeInteger(maxResponseBytes) ||
    maxResponseBytes < 1
  )
    throw new ContentSchemaRegistryProductionConfigurationError();

  const configuration: ProductionConfiguration = {
    auth: authConfiguration,
    deadlineMs,
    maxResponseBytes,
    now: options.now ?? Date.now,
  };
  const telemetry =
    options.telemetry ??
    productionTelemetry(
      options.logger ?? defaultProductionLogger(options.environment),
    );
  const humanOrigins = validateOriginList(
    options.humanOrigins ??
      configuredOriginList(options.environment.CMS_HUMAN_ORIGINS),
    ContentSchemaRegistryProductionConfigurationError,
  );
  const releaseOrigins = validateOriginList(
    options.releaseOrigins ??
      configuredOriginList(options.environment.CMS_RELEASE_ORIGINS),
    ContentSchemaRegistryProductionConfigurationError,
  );
  if (humanOrigins.some((origin) => releaseOrigins.includes(origin)))
    throw new ContentSchemaRegistryProductionConfigurationError(
      'Human and release origin allowlists must not overlap.',
    );

  const sessionContexts = new WeakMap<Request, ServerSessionContext>();
  const resolveSession = createSessionResolver(
    options,
    configuration,
    sessionContexts,
  );

  const callRpc = async (
    input: ContentSchemaRegistryPortInput,
    signal: AbortSignal,
    rpc: string,
  ): Promise<ContentSchemaRegistryResult<unknown>> => {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Accept-Profile': 'platform_api',
      ...supabaseRpcHeaders(configuration.auth.secret),
      'Content-Profile': 'platform_api',
      'Content-Type': 'application/json',
      'X-Operation-Id': input.operationId,
      'X-Request-Id': input.requestId,
      'X-Correlation-Id': correlationFor(input),
    };
    if (input.idempotencyKey !== undefined)
      headers['X-Idempotency-Key'] = input.idempotencyKey;
    if (input.ifMatch !== undefined) headers['If-Match'] = `"${input.ifMatch}"`;
    const response = await fetchWithDeadline(
      configuration,
      `${configuration.auth.baseUrl}/rest/v1/rpc/${rpc}`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          p_request: rpcBodyFor(input, sessionContexts, configuration.now),
        }),
      },
      signal,
    );
    if (!response.ok) return response;
    if (!response.value.ok)
      return mapRpcFailure(
        response.value.status,
        await readRpcError(
          response.value,
          configuration.maxResponseBytes,
          signal,
        ),
      );
    return parseJsonResponse(
      response.value,
      configuration.maxResponseBytes,
      signal,
    );
  };

  const port =
    (rpc: string) =>
    (
      input: ContentSchemaRegistryPortInput,
      signal: AbortSignal,
    ): Promise<ContentSchemaRegistryResult<unknown>> =>
      callRpc(input, signal, rpc);

  // One adapter per named RPC; the response schema is enforced by the port runner.
  const ports = Object.fromEntries(
    Object.entries(CMS_SCHEMA_REGISTRY_RPC).map(([name, rpc]) => [
      name,
      port(rpc),
    ]),
  ) as unknown as ContentSchemaRegistryDependencies['ports'];

  return {
    ports,
    resolveSession,
    verifyRelease: createReleaseVerification(options, configuration),
    rateLimit: createRateLimiter(options),
    humanOrigins,
    releaseOrigins,
    deadlineMs,
    now: configuration.now,
    telemetry,
  };
};

export type { ContentSchemaRegistryProductionOptions } from './production-types';
export { ContentSchemaRegistryProductionConfigurationError } from './production-types';
export type { ContentSchemaRegistryDependencies } from './types';
