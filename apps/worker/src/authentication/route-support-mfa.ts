import type { ApiError } from '@wejammin/contracts';

import type { WorkerContext } from '../index';
import {
  authError,
  parseIdempotencyKey,
  parseIfMatch,
  parseJsonBody,
  verifySameOriginCsrf,
} from './boundary';
import { responseForMfaError } from './mfa-error-boundary';
import { enforceRate, requireSession } from './route-support';
import type {
  AuthenticationDependencies,
  AuthenticationError,
  AuthenticationResult,
  AuthenticationSession,
} from './types';
import type { AuthOperationId } from '@wejammin/contracts';

type SchemaLike<T> = Readonly<{
  safeParse: (value: unknown) =>
    | Readonly<{ success: true; data: T }>
    | Readonly<{
        success: false;
        error: Readonly<{
          issues: readonly Readonly<{
            message: string;
            path: readonly PropertyKey[];
          }>[];
        }>;
      }>;
}>;

const SPEC_CODE = /^[a-z][a-z0-9_]*$/u;

const FIELD_CODES: Readonly<Record<string, string>> = {
  '/method': 'method_not_available',
  '/factorId': 'factor_id_invalid',
  '/reason': 'reason_invalid',
  '/code': 'code_invalid',
  '/friendlyName': 'friendly_name_invalid',
};

type Violation = Readonly<{ path: string; code: string; message: string }>;

/**
 * Zod emits spec reason codes for constraints that carry one; closed-enum and
 * format failures carry a generic message, so they are named by field here.
 */
const normalizeViolations = (
  error: AuthenticationError,
): AuthenticationError => {
  const violations = (error.details as { violations?: readonly Violation[] })
    ?.violations;
  if (error.status !== 422 || violations === undefined) return error;
  const details: ApiError['details'] = {
    violations: violations.map((violation) => ({
      ...violation,
      code: SPEC_CODE.test(violation.code)
        ? violation.code
        : (FIELD_CODES[violation.path] ?? 'value_invalid'),
    })),
  };
  return { ...error, details };
};

export const parseMfaBody = async <T>(
  request: Request,
  schema: SchemaLike<T>,
): Promise<AuthenticationResult<T>> => {
  const parsed = await parseJsonBody(request, schema);
  return parsed.ok ? parsed : normalizeViolations(parsed);
};

export const parsePathId = (
  context: WorkerContext,
  schema: Readonly<{
    safeParse: (value: unknown) => Readonly<{ success: boolean }>;
  }>,
  value: string,
): AuthenticationResult<string> =>
  schema.safeParse(value).success
    ? { ok: true, value }
    : authError(400, 'INVALID_REQUEST', 'The path identifier is invalid.');

type MutationOptions<B> = Readonly<{
  schema: SchemaLike<B>;
  idempotency: boolean;
  ifMatch: boolean;
  /** Bucket id for the rate limiter; defaults to the operation id. */
  rateOperation?: AuthOperationId;
}>;

export type AdmittedMutation<B> = Readonly<{
  body: B;
  session: AuthenticationSession;
  idempotencyKey: string;
  ifMatch: string;
}>;

/**
 * Shared admission for the DEC-111 mutations: body shape, headers, CSRF,
 * session and rate limit, in the same order as the existing auth routes.
 */
export const admitMfaMutation = async <B>(
  context: WorkerContext,
  dependencies: AuthenticationDependencies,
  operationId: AuthOperationId,
  options: MutationOptions<B>,
): Promise<AdmittedMutation<B> | Response> => {
  const body = await parseMfaBody(context.req.raw, options.schema);
  if (!body.ok) return responseForMfaError(context, operationId, body);
  let idempotencyKey = '';
  if (options.idempotency) {
    const key = parseIdempotencyKey(context.req.raw);
    if (!key.ok) return responseForMfaError(context, operationId, key);
    idempotencyKey = key.value;
  }
  let ifMatch = '';
  if (options.ifMatch) {
    const version = parseIfMatch(context.req.raw);
    if (!version.ok) return responseForMfaError(context, operationId, version);
    ifMatch = version.value;
  }
  const csrfError = await verifySameOriginCsrf(context.req.raw);
  if (csrfError !== null)
    return responseForMfaError(context, operationId, csrfError);
  const resolved = await requireSession(context, dependencies);
  if (!resolved.ok) return responseForMfaError(context, operationId, resolved);
  const rateError = await enforceRate(
    context,
    dependencies,
    options.rateOperation ?? operationId,
    resolved.value,
    null,
    (target, error) => responseForMfaError(target, operationId, error),
  );
  if (rateError !== null) return rateError;
  return {
    body: body.value,
    session: resolved.value,
    idempotencyKey,
    ifMatch,
  };
};
