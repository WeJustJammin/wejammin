import {
  ActingContextQuerySchema,
  IdentityCasCommandHeadersSchema,
  IdentityCommandHeadersSchema,
  type IdentityOperationId,
  identityRoutePolicies,
} from '@wejammin/contracts';

import type { WorkerContext } from '../index';
import {
  authError,
  parseJsonBody,
  quotedVersion,
  type JsonMutationTransport,
  responseForAuthError,
} from '../authentication/boundary';
import type {
  AuthenticationError,
  AuthenticationResult,
} from '../authentication/types';

export { quotedVersion };

export const identityPolicy = (operationId: IdentityOperationId) => {
  const policy = identityRoutePolicies.find(
    (item) => item.operationId === operationId,
  );
  if (policy === undefined)
    throw new Error(`Missing identity policy ${operationId}`);
  return policy;
};

export const configureIdentityRoute = (
  context: WorkerContext,
  operationId: IdentityOperationId,
): void => {
  const policy = identityPolicy(operationId);
  context.set('operation', operationId);
  context.header('cache-control', policy.cacheControl);
  context.header('vary', 'Origin');
};

export const identityError = (
  status: AuthenticationError['status'],
  code: string,
  message: string,
  details: AuthenticationError['details'] = {},
): AuthenticationError => authError(status, code, message, details);

export const invalidPersistence = (context: WorkerContext): Response =>
  responseForAuthError(
    context,
    identityError(
      502,
      'DEPENDENCY_INVALID_RESPONSE',
      'Identity persistence returned an invalid response.',
    ),
  );

const mapBodyValidation = <T>(
  result: AuthenticationResult<T>,
): AuthenticationResult<T> => {
  if (
    result.ok ||
    (result.code !== 'VALIDATION_FAILED' && result.code !== 'INVALID_REQUEST')
  )
    return result;
  return identityError(
    400,
    'INVALID_REQUEST',
    'The request contains an invalid value.',
    result.details,
  );
};

/** BE00 step 6: strict identity body on the transport read at step 2. */
export const decodeIdentityBody = <T>(
  transport: JsonMutationTransport,
  schema: Parameters<typeof parseJsonBody<T>>[1],
): AuthenticationResult<T> => mapBodyValidation(transport.decode(schema));

export const parseIdentityJsonBody = async <T>(
  request: Request,
  schema: Parameters<typeof parseJsonBody<T>>[1],
): Promise<AuthenticationResult<T>> =>
  mapBodyValidation(await parseJsonBody(request, schema));

export const rejectUnexpectedIdentityQuery = (
  request: Request,
  allowCursor = false,
): AuthenticationResult<Readonly<{ cursor: string | null }>> => {
  const params = new URL(request.url).searchParams;
  const entries = [...params.entries()];
  if (
    entries.some(([key]) => !allowCursor || key !== 'cursor') ||
    new Set(entries.map(([key]) => key)).size !== entries.length
  ) {
    return identityError(
      400,
      'INVALID_REQUEST',
      'Query parameters are invalid.',
      {
        violations: [
          {
            path: '/query',
            code: 'unknown_field',
            message: 'The value is invalid.',
          },
        ],
      },
    );
  }
  const parsed = ActingContextQuerySchema.safeParse(
    Object.fromEntries(entries),
  );
  if (!parsed.success) {
    return identityError(
      400,
      'INVALID_REQUEST',
      'Query parameters are invalid.',
      {
        violations: parsed.error.issues.slice(0, 16).map((issue) => ({
          path: `/query/${issue.path.join('/')}`,
          code: issue.message,
          message: 'The value is invalid.',
        })),
      },
    );
  }
  return { ok: true, value: { cursor: parsed.data.cursor ?? null } };
};

const headerError = (path: string, code: string): AuthenticationError =>
  identityError(
    400,
    'INVALID_REQUEST',
    'Required command headers are invalid.',
    { violations: [{ path, code, message: 'The value is invalid.' }] },
  );

export const parseIdentityCommandHeaders = (
  request: Request,
  ifMatch: boolean,
): AuthenticationResult<
  Readonly<{ idempotencyKey: string; xCsrfToken: string; ifMatch?: string }>
> => {
  const input = {
    idempotencyKey: request.headers.get('idempotency-key'),
    xCsrfToken: request.headers.get('x-csrf-token'),
    ...(ifMatch ? { ifMatch: request.headers.get('if-match') } : {}),
  };
  const parsed = (
    ifMatch ? IdentityCasCommandHeadersSchema : IdentityCommandHeadersSchema
  ).safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return headerError(
      `/${String(issue?.path[0] ?? 'headers')}`,
      issue?.message ?? 'header_invalid',
    );
  }
  return { ok: true, value: parsed.data };
};
