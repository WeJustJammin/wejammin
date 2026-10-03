import {
  Cfg05a01RegisterDefinitionRequestSchema,
  Cfg05a02EffectiveValueQuerySchema,
  Cfg05a03ProposeChangeRequestSchema,
  Cfg05a04ChangeActionRequestSchema,
  ConfigurationKeySchema,
  ConfigurationUuidSchema,
} from '@wejammin/contracts';
import type { ApiError } from '@wejammin/contracts';

import type { WorkerContext } from '../index';
import {
  authError,
  decodeJsonBodyText,
  jsonBodyPreflight,
  parseIdempotencyKey,
  parseJsonBody,
  readJsonBodyText,
  type JsonMutationTransport,
} from '../authentication/boundary';
import type { AuthenticationResult } from '../authentication/types';
import {
  checkConfigurationSameOrigin,
  csrfIfCookie,
} from './admin-route-support';
import type { PlatformConfigurationOperationId } from './types';
import type { ConfigurationPortName } from './runtime-helpers';

export type SchemaLike<T> = Readonly<{
  safeParse: (value: unknown) =>
    | Readonly<{ success: true; data: T }>
    | Readonly<{
        success: false;
        error: Readonly<{
          issues: readonly Readonly<{
            path: readonly PropertyKey[];
            message: string;
          }>[];
        }>;
      }>;
}>;

const issueDetails = (
  issues: readonly Readonly<{
    path: readonly PropertyKey[];
    message: string;
  }>[],
): ApiError['details'] => ({
  violations: issues.slice(0, 16).map((issue) => ({
    path: `/${issue.path.map(String).join('/')}`,
    code: issue.message,
    message: 'The value is invalid.',
  })),
});

const invalid = (
  message = 'The request is invalid.',
): AuthenticationResult<never> => authError(400, 'INVALID_REQUEST', message);

export const configurationOperation = (
  context: WorkerContext,
  operationId: PlatformConfigurationOperationId,
): void => context.set('operation', operationId);

export const parseConfigurationBody = async <T>(
  request: Request,
  schema: SchemaLike<T>,
  signal?: AbortSignal,
): Promise<AuthenticationResult<T>> => {
  const parsed = await parseJsonBody(request, schema, signal);
  if (!parsed.ok) return parsed;
  return parsed;
};

/**
 * BE00 step 2 for a configuration JSON mutation: the same-origin check, the
 * body ceiling, the content type and, for a cookie session, the session-bound
 * CSRF token, then the raw body. JSON syntax and strict Zod validation are
 * BE00 step 6 and run later through `decode`, after the caller is verified.
 */
export const admitConfigurationTransport = async (
  context: WorkerContext,
  signal?: AbortSignal,
): Promise<AuthenticationResult<JsonMutationTransport>> => {
  const origin = checkConfigurationSameOrigin(context);
  if (!origin.ok) return origin;
  const preflight = jsonBodyPreflight(context.req.raw);
  if (preflight !== null) return preflight;
  const csrf = await csrfIfCookie(context);
  if (!csrf.ok) return csrf;
  const text = await readJsonBodyText(context.req.raw, signal);
  if (!text.ok) return text;
  return {
    ok: true,
    value: { decode: (schema) => decodeJsonBodyText(text.value, schema) },
  };
};

export const parseConfigurationPath = <T>(
  schema: SchemaLike<T>,
  value: unknown,
): AuthenticationResult<T> => {
  const parsed = schema.safeParse(value);
  return parsed.success
    ? { ok: true, value: parsed.data }
    : authError(
        400,
        'INVALID_REQUEST',
        'The path parameters are invalid.',
        issueDetails(parsed.error.issues),
      );
};

const queryValue = (
  params: URLSearchParams,
  key: string,
): string | undefined => {
  const values = params.getAll(key);
  return values.length === 1 ? values[0] : undefined;
};

export const parseEffectiveQuery = (
  request: Request,
  pathKey: string,
): AuthenticationResult<unknown> => {
  const params = new URL(request.url).searchParams;
  const values: Record<string, unknown> = { key: pathKey };
  const allowed = new Set([
    'environment',
    'partyId',
    'siteId',
    'route',
    'feature',
    'userId',
    'consumerKey',
    'supportedDefinitionVersions',
    'at',
  ]);
  for (const key of new Set(params.keys())) {
    if (!allowed.has(key)) return invalid('The query parameters are invalid.');
    const all = params.getAll(key);
    if (key === 'supportedDefinitionVersions') {
      if (all.length === 0 || all.some((value) => value.length === 0))
        return invalid('The query parameters are invalid.');
      values[key] = all;
    } else {
      if (all.length !== 1) return invalid('The query parameters are invalid.');
      values[key] = queryValue(params, key);
    }
  }
  const parsed = Cfg05a02EffectiveValueQuerySchema.safeParse(values);
  return parsed.success
    ? { ok: true, value: parsed.data }
    : authError(
        400,
        'INVALID_REQUEST',
        'The query parameters are invalid.',
        issueDetails(parsed.error.issues),
      );
};

export const parseConfigurationCommandHeaders = (
  request: Request,
  ifMatchRequired = false,
): AuthenticationResult<
  Readonly<{ idempotencyKey: string; ifMatch?: string }>
> => {
  const idempotency = parseIdempotencyKey(request);
  if (!idempotency.ok) return idempotency;
  const rawIfMatch = request.headers.get('if-match');
  if (rawIfMatch === null && !ifMatchRequired)
    return { ok: true, value: { idempotencyKey: idempotency.value } };
  if (rawIfMatch === null || !/^"[1-9][0-9]{0,17}"$/u.test(rawIfMatch))
    return authError(
      400,
      'INVALID_REQUEST',
      'A valid If-Match version is required.',
    );
  return {
    ok: true,
    value: {
      idempotencyKey: idempotency.value,
      ifMatch: rawIfMatch.slice(1, -1),
    },
  };
};

export { bindEffectiveQueryScope, bindMutationScope } from './scope-support';
export {
  checkConfigurationSameOrigin,
  csrfIfCookie,
  enforceConfigurationRate,
  isConfigurationStepUpFresh,
  requireConfigurationSession,
} from './admin-route-support';
export {
  hasServiceConsumerHeaders,
  releasePrincipalFromRequest,
  releasePrincipalHeadersValid,
  resolveReleasePrincipal,
  resolveServiceConsumer,
  serviceConsumerHeaders,
} from './service-credentials';

export const configurationBodySchemas = {
  register: Cfg05a01RegisterDefinitionRequestSchema,
  propose: Cfg05a03ProposeChangeRequestSchema,
  action: Cfg05a04ChangeActionRequestSchema,
};

export const configurationPathSchemas = {
  key: ConfigurationKeySchema,
  definitionId: ConfigurationUuidSchema,
  reviewId: ConfigurationUuidSchema,
};

export type ConfigurationRoutePortName = ConfigurationPortName;
