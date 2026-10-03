import type { ApiError } from '@wejammin/contracts';

import type { WorkerContext } from '../index';
import {
  authError,
  parseIdempotencyKey,
  parseIfMatch,
  admitJsonMutationTransport,
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

export const parsePathId = (
  context: WorkerContext,
  schema: Readonly<{
    safeParse: (value: unknown) => Readonly<{ success: boolean }>;
  }>,
  value: string | undefined,
): AuthenticationResult<string> =>
  typeof value === 'string' && schema.safeParse(value).success
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
 * Shared admission for the DEC-111 mutations, in BE00 "Hono Middleware Order":
 * origin, body ceiling, content type and session-bound CSRF (step 2); the
 * verified session and acting context (steps 4 and 5); strict body (step 6);
 * the quota (step 7); then the exact Idempotency-Key and If-Match (step 8).
 * The step-up decision of these operations depends on persisted factor state,
 * so each service makes it inside its own transaction.
 */
export const admitMfaMutation = async <B>(
  context: WorkerContext,
  dependencies: AuthenticationDependencies,
  operationId: AuthOperationId,
  options: MutationOptions<B>,
): Promise<AdmittedMutation<B> | Response> => {
  const transport = await admitJsonMutationTransport(context.req.raw);
  if (!transport.ok)
    return responseForMfaError(context, operationId, transport);
  const resolved = await requireSession(context, dependencies);
  if (!resolved.ok) return responseForMfaError(context, operationId, resolved);
  const decoded = transport.value.decode(options.schema);
  if (!decoded.ok)
    return responseForMfaError(
      context,
      operationId,
      normalizeViolations(decoded),
    );
  const rateError = await enforceRate(
    context,
    dependencies,
    options.rateOperation ?? operationId,
    resolved.value,
    null,
    (target, error) => responseForMfaError(target, operationId, error),
  );
  if (rateError !== null) return rateError;
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
  return {
    body: decoded.value,
    session: resolved.value,
    idempotencyKey,
    ifMatch,
  };
};
