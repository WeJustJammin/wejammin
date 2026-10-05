import type {
  TemplateDesignerContext,
  TemplateVersionDetail,
  TemplateVersionRequest,
  TemplateVersionResource,
} from '@wejammin/contracts';

import type { CmsEditorialSession } from '../cms-editorial/types';

/** Deadline shared by every CMS template route. */
export const DEADLINE_MS = 15_000;

export type CmsTemplateError = Readonly<{
  ok: false;
  status: 400 | 401 | 403 | 404 | 409 | 415 | 422 | 429 | 500 | 502 | 503 | 504;
  code: string;
  message: string;
  details?: Readonly<Record<string, unknown>>;
  retryAfterSeconds?: number;
}>;

export type CmsTemplateResult<T> =
  Readonly<{ ok: true; value: T }> | CmsTemplateError;

export type CmsTemplatePortInput = Readonly<{
  operationId: 'CMS-03C-01';
  request: Request;
  requestId: string;
  session: CmsEditorialSession;
  body: TemplateVersionRequest;
  idempotencyKey: string;
  ifMatch: string | null;
}>;

export type CmsTemplateContextPortInput = Readonly<{
  operationId: 'cmsTemplateContextRead';
  request: Request;
  requestId: string;
  session: CmsEditorialSession;
}>;

export type CmsTemplateDetailPortInput = Readonly<{
  operationId: 'cmsTemplateLatestRead';
  request: Request;
  requestId: string;
  session: CmsEditorialSession;
  templateKey: string;
}>;

export type CmsTemplateRateInput = Readonly<{
  operationId:
    'CMS-03C-01' | 'cmsTemplateContextRead' | 'cmsTemplateLatestRead';
  request: Request;
  actorId: string;
  actingPartyId: string;
  principalClass: 'human';
  rateClass: 'cms-template-write' | 'cms-template-read';
  rateScope: 'user' | 'party';
  limit: 30 | 60;
  windowSeconds: 60;
}>;

export type CmsTemplateRateDecision = Readonly<{
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
}>;

export type CmsTemplateTelemetry = Readonly<{
  operationId:
    'CMS-03C-01' | 'cmsTemplateContextRead' | 'cmsTemplateLatestRead';
  requestId: string;
  status: number;
  outcome: 'success' | 'rejected' | 'failure';
  actorClass: 'human';
  durationMs: number;
}>;

export type CmsTemplateDependencies = Readonly<{
  humanOrigins: readonly string[];
  now: () => number;
  resolveSession: (
    request: Request,
    signal: AbortSignal,
  ) => Promise<CmsTemplateResult<CmsEditorialSession>>;
  rateLimit: (
    input: CmsTemplateRateInput,
    signal: AbortSignal,
  ) => Promise<CmsTemplateResult<CmsTemplateRateDecision>>;
  defineTemplate: (
    input: CmsTemplatePortInput,
    signal: AbortSignal,
  ) => Promise<CmsTemplateResult<TemplateVersionResource>>;
  readContext: (
    input: CmsTemplateContextPortInput,
    signal: AbortSignal,
  ) => Promise<CmsTemplateResult<TemplateDesignerContext>>;
  readLatest: (
    input: CmsTemplateDetailPortInput,
    signal: AbortSignal,
  ) => Promise<CmsTemplateResult<TemplateVersionDetail>>;
  telemetry: (event: CmsTemplateTelemetry) => void | Promise<void>;
}>;

export type Status = CmsTemplateError['status'];

export const ERROR_CODES: Readonly<Record<Status, string>> = {
  400: 'INVALID_REQUEST',
  401: 'UNAUTHENTICATED',
  403: 'TEMPLATE_FORBIDDEN',
  404: 'TEMPLATE_NOT_FOUND',
  409: 'TEMPLATE_VERSION_CONFLICT',
  415: 'UNSUPPORTED_MEDIA_TYPE',
  422: 'TEMPLATE_VALIDATION_FAILED',
  429: 'RATE_LIMITED',
  500: 'INTERNAL_ERROR',
  502: 'DEPENDENCY_INVALID_RESPONSE',
  503: 'DEPENDENCY_UNAVAILABLE',
  504: 'DEPENDENCY_DEADLINE_EXCEEDED',
};

export const failure = (
  status: Status,
  details: Readonly<Record<string, unknown>> = {},
  retryAfterSeconds?: number,
): CmsTemplateError => ({
  ok: false,
  status,
  code: ERROR_CODES[status],
  message: `${ERROR_CODES[status]}: template operation rejected or unavailable.`,
  details,
  ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }),
});

/**
 * BE00 step 2: a template read accepts no request media, so the 415 carries an
 * empty allowlist.
 */
export const templateReadMediaError = (
  request: Request,
): CmsTemplateError | null =>
  request.headers.has('content-type')
    ? failure(415, { allowedMediaTypes: [] })
    : null;

/** BE00 step 6: template reads carry no write precondition, idempotency key or body. */
export const templateReadHeadersError = (
  request: Request,
): CmsTemplateError | null => {
  if (request.headers.has('idempotency-key') || request.headers.has('if-match'))
    return failure(400);
  const contentLength = request.headers.get('content-length');
  if (
    request.body !== null ||
    request.headers.has('transfer-encoding') ||
    (contentLength !== null && contentLength !== '0')
  )
    return failure(400);
  return null;
};

export const statusOf = (value: number): Status =>
  Object.hasOwn(ERROR_CODES, value) ? (value as Status) : 500;

export const dependencyUnavailable = (): CmsTemplateError =>
  failure(503, {}, 15);
export const invalidDependency = (): CmsTemplateError => failure(502);

export const validEnvelope = <T>(
  value: unknown,
): value is CmsTemplateResult<T> =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  'ok' in value &&
  typeof value.ok === 'boolean' &&
  (value.ok
    ? 'value' in value
    : 'status' in value && typeof value.status === 'number');

export const validRateDecision = (
  decision: unknown,
  limit: 30 | 60,
): decision is CmsTemplateRateDecision =>
  typeof decision === 'object' &&
  decision !== null &&
  !Array.isArray(decision) &&
  'allowed' in decision &&
  'limit' in decision &&
  'remaining' in decision &&
  'resetAt' in decision &&
  typeof decision.allowed === 'boolean' &&
  decision.limit === limit &&
  typeof decision.remaining === 'number' &&
  Number.isSafeInteger(decision.remaining) &&
  decision.remaining >= 0 &&
  decision.remaining <= limit &&
  typeof decision.resetAt === 'number' &&
  Number.isSafeInteger(decision.resetAt) &&
  decision.resetAt >= 0;
