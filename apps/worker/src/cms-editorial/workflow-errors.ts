import {
  CmsPreflightUnavailableDetailsSchema,
  type CmsEditorialOperationId,
  type CmsEditorialRoutePolicy,
} from '@wejammin/contracts';

import { MFA_METHOD_REGISTRY } from '../authentication/step-up';
import { clampRetryAfterSeconds } from './route-error-details';
import type { CmsEditorialError } from './types';
import {
  conflictDetails,
  forbiddenDetails,
  rateDetails,
  recordOf,
  validationDetails,
  withViolations,
  type Source,
} from './workflow-error-details';

/**
 * The Slice 11 error boundary (BE03b "Contract and error matrix"). A port is
 * untrusted: the published status must be a cell the operation declares, the
 * reason token must be one of the operation's closed `reasonCodes` whose status
 * matches, and the detail members are rebuilt from the contract's strict detail
 * schemas, never copied from dependency output.
 */

export const WORKFLOW_OPERATION_IDS = [
  'CMS-03B-05',
  'CMS-03B-06',
  'CMS-03B-07',
  'CMS-03B-08',
  'CMS-03B-09',
  'CMS-03B-15',
  'CMS-03B-16',
  'CMS-03B-17',
  'CMS-03B-18',
] as const satisfies readonly CmsEditorialOperationId[];

const WORKFLOW_OPERATIONS: ReadonlySet<string> = new Set(
  WORKFLOW_OPERATION_IDS,
);

export const isWorkflowPolicy = (policy: CmsEditorialRoutePolicy): boolean =>
  WORKFLOW_OPERATIONS.has(policy.operationId);

const CODE_BY_STATUS: Readonly<Record<number, string>> = {
  400: 'INVALID_REQUEST',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  415: 'UNSUPPORTED_MEDIA_TYPE',
  422: 'VALIDATION_FAILED',
  429: 'RATE_LIMITED',
  500: 'INTERNAL_ERROR',
  502: 'BAD_GATEWAY',
  503: 'DEPENDENCY_UNAVAILABLE',
  504: 'GATEWAY_TIMEOUT',
};

const MESSAGES: Readonly<Record<number, string>> = {
  400: 'The CMS editorial request is invalid.',
  401: 'Sign in again to continue.',
  403: 'The CMS editorial action is not allowed.',
  404: 'The requested CMS editorial resource was not found.',
  409: 'The CMS editorial resource changed; reload and try again.',
  415: 'The request media type is unsupported.',
  422: 'The CMS editorial request failed validation.',
  429: 'Too many CMS editorial requests.',
  500: 'An unexpected error occurred.',
  502: 'The CMS editorial dependency returned invalid data.',
  503: 'The CMS editorial dependency is temporarily unavailable.',
  504: 'The CMS editorial dependency exceeded its deadline.',
};

const STEP_UP_MESSAGE = 'Recent verification is required.';

const DEFAULT_RETRY_AFTER_SECONDS = 5;

const declaredStatuses = (policy: CmsEditorialRoutePolicy): Set<number> =>
  new Set(Object.values(policy.errors) as readonly number[]);

const published = (
  status: number,
  details: Record<string, unknown>,
  extra: Readonly<{
    code?: string;
    message?: string;
    retryAfterSeconds?: number;
  }> = {},
): CmsEditorialError =>
  ({
    ok: false,
    status,
    code: extra.code ?? (CODE_BY_STATUS[status] as string),
    message: extra.message ?? (MESSAGES[status] as string),
    details,
    ...(extra.retryAfterSeconds === undefined
      ? {}
      : { retryAfterSeconds: extra.retryAfterSeconds }),
  }) as CmsEditorialError;

/** 503: the registered preflight outage, or the generic dependency outage. */
const unavailable = (
  source: Source,
  policy: CmsEditorialRoutePolicy,
): CmsEditorialError => {
  const evaluatesPreflight = (
    (policy.reasonCodes ?? []) as readonly string[]
  ).includes('preflight_failed');
  if (evaluatesPreflight && source.dependencyClass === 'preflight') {
    const hint =
      source.retryAfterSeconds === undefined
        ? undefined
        : clampRetryAfterSeconds(source.retryAfterSeconds);
    const details = CmsPreflightUnavailableDetailsSchema.parse({
      dependencyClass: 'preflight',
      retryable: true,
      ...(hint === undefined ? {} : { retryAfterSeconds: hint }),
    }) as Record<string, unknown>;
    return published(503, details, {
      retryAfterSeconds: hint ?? DEFAULT_RETRY_AFTER_SECONDS,
    });
  }
  return published(
    503,
    { dependencyClass: 'cms_editorial', retryable: true },
    { retryAfterSeconds: DEFAULT_RETRY_AFTER_SECONDS },
  );
};

/**
 * The error exactly as it is published for a Slice 11 operation. A status the
 * row does not declare is a scrubbed 500, a 404 stays concealed, and 401 is
 * `STEP_UP_REQUIRED` only on a row that declares step-up (BE03b E6).
 */
export const normalizedWorkflowError = (
  error: CmsEditorialError,
  policy: CmsEditorialRoutePolicy,
): CmsEditorialError => {
  const status = declaredStatuses(policy).has(error.status)
    ? error.status
    : 500;
  const source = recordOf(error.details);
  switch (status) {
    case 400:
      return published(400, withViolations({}, source));
    case 401:
      return error.code === 'STEP_UP_REQUIRED' &&
        'STEP_UP_REQUIRED' in policy.errors
        ? published(
            401,
            {
              recoveryAction: 'step_up',
              allowedMethods: [...MFA_METHOD_REGISTRY],
            },
            { code: 'STEP_UP_REQUIRED', message: STEP_UP_MESSAGE },
          )
        : published(401, { recoveryAction: 'reauthenticate' });
    case 403:
      return published(403, forbiddenDetails(source, policy));
    case 404:
      return published(404, {});
    case 409:
      return published(409, conflictDetails(source, policy));
    case 415:
      return published(415, {
        allowedMediaTypes: policy.method === 'GET' ? [] : ['application/json'],
      });
    case 422:
      return published(422, validationDetails(source, policy));
    case 429:
      return published(429, rateDetails(error, source), {
        retryAfterSeconds: clampRetryAfterSeconds(
          error.retryAfterSeconds ?? source.retryAfterSeconds,
        ),
      });
    case 502:
      return published(502, {
        dependencyClass: 'cms_editorial',
        retryable: false,
      });
    case 503:
      return unavailable(source, policy);
    case 504:
      return published(
        504,
        { dependencyClass: 'cms_editorial', retryable: true },
        { retryAfterSeconds: DEFAULT_RETRY_AFTER_SECONDS },
      );
    default:
      return published(500, {});
  }
};
