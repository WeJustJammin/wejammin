import type {
  ApiError,
  TemplateVersionRequest,
  TemplateVersionResource,
} from '@wejammin/contracts';

import type { CmsValidators } from '../../lib/cms-contract-validators';

/**
 * The schemas the transport uses, from the lazily loaded validators. The
 * designer loads them before it builds the request, so a send never waits on
 * (or fails to fetch) a schema chunk.
 */
export type CmsTemplateSubmitValidators = Pick<
  CmsValidators,
  | 'ApiErrorSchema'
  | 'TemplateVersionRequestSchema'
  | 'TemplateVersionResourceSchema'
>;

export type CmsTemplateSubmitResult =
  | { readonly kind: 'created'; readonly resource: TemplateVersionResource }
  | {
      readonly kind: 'conflict';
      readonly status: 409;
      /** Present only for the closed CMS-03C-01 token (BE03c 1273, DEC-186 item 2). */
      readonly reasonCode?: typeof DIGEST_MISMATCH_REASON;
    }
  | {
      readonly kind: 'rejected';
      readonly status:
        400 | 401 | 403 | 404 | 415 | 422 | 429 | 500 | 502 | 503 | 504;
      readonly retryAfterSeconds?: number;
    }
  | { readonly kind: 'uncertain' };

/** The one 409 reason CMS-03C-01 publishes; the browser reads it by exact match and never loads zod for it. */
export const DIGEST_MISMATCH_REASON = 'block_registry_digest_mismatch';
const REJECTED_STATUSES = new Set([
  400, 401, 403, 404, 415, 422, 429, 500, 502, 503, 504,
]);
const ERROR_CODES: Readonly<Record<number, string>> = {
  400: 'INVALID_REQUEST',
  401: 'UNAUTHENTICATED',
  403: 'TEMPLATE_FORBIDDEN',
  404: 'TEMPLATE_NOT_FOUND',
  409: 'TEMPLATE_VERSION_CONFLICT',
  415: 'UNSUPPORTED_MEDIA_TYPE',
  422: 'TEMPLATE_VALIDATION_FAILED',
  429: 'RATE_LIMITED',
  500: 'INTERNAL_ERROR',
  502: 'DEPENDENCY_UNAVAILABLE',
  503: 'DEPENDENCY_UNAVAILABLE',
  504: 'DEPENDENCY_UNAVAILABLE',
};

const readExpectedApiError = async (
  validators: CmsTemplateSubmitValidators,
  response: Response,
): Promise<ApiError | null> => {
  let candidate: unknown;
  try {
    candidate = await response.json();
  } catch {
    return null;
  }
  const parsed = validators.ApiErrorSchema.safeParse(candidate);
  return parsed.success && parsed.data.code === ERROR_CODES[response.status]
    ? parsed.data
    : null;
};

/** The browser never sends authority claims; the protected Worker owns them. */
const submitCmsTemplateVersion = async (
  validators: CmsTemplateSubmitValidators,
  draft: TemplateVersionRequest,
  csrfToken: string,
  idempotencyKey: string,
  mode: 'create' | 'successor',
  fetcher: typeof fetch,
): Promise<CmsTemplateSubmitResult> => {
  const checked = validators.TemplateVersionRequestSchema.safeParse(draft);
  if (
    !checked.success ||
    (mode === 'create') !== (checked.data.expectedVersion === null)
  )
    return { kind: 'rejected', status: 422 };
  let response: Response;
  try {
    response = await fetcher('/api/v1/cms/templates/versions', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      redirect: 'error',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': csrfToken,
        'idempotency-key': idempotencyKey,
        ...(mode === 'successor'
          ? { 'if-match': `"${checked.data.expectedVersion}"` }
          : {}),
      },
      body: JSON.stringify(checked.data),
    });
  } catch {
    return { kind: 'uncertain' };
  }
  if (response.status === 409 || REJECTED_STATUSES.has(response.status)) {
    const error = await readExpectedApiError(validators, response);
    if (error === null) return { kind: 'uncertain' };
    if (response.status === 409)
      return error.details.reasonCode === DIGEST_MISMATCH_REASON
        ? { kind: 'conflict', status: 409, reasonCode: DIGEST_MISMATCH_REASON }
        : { kind: 'conflict', status: 409 };
    if (response.status === 429) {
      const retryAfter = response.headers.get('retry-after');
      if (retryAfter === null || !/^[1-9]\d{0,4}$/u.test(retryAfter))
        return { kind: 'uncertain' };
      const seconds = Number(retryAfter);
      if (seconds > 86_400 || error.details.retryAfterSeconds !== seconds)
        return { kind: 'uncertain' };
      return { kind: 'rejected', status: 429, retryAfterSeconds: seconds };
    }
    return {
      kind: 'rejected',
      status: response.status as Extract<
        CmsTemplateSubmitResult,
        { kind: 'rejected' }
      >['status'],
    };
  }
  if (response.status !== 201) return { kind: 'uncertain' };
  let candidate: unknown;
  try {
    candidate = await response.json();
  } catch {
    return { kind: 'uncertain' };
  }
  const resource =
    validators.TemplateVersionResourceSchema.safeParse(candidate);
  if (
    !resource.success ||
    resource.data.state !== 'draft' ||
    resource.data.templateKey !== checked.data.templateKey ||
    resource.data.compatibleTypeIds.join('\u0000') !==
      checked.data.compatibleTypeIds.join('\u0000') ||
    resource.data.version !== String(resource.data.templateVersion) ||
    (mode === 'successor' &&
      BigInt(resource.data.version) <= BigInt(checked.data.expectedVersion!)) ||
    response.headers.get('etag') !== `"${resource.data.version}"`
  )
    return { kind: 'uncertain' };
  return { kind: 'created', resource: resource.data };
};

export const submitCmsTemplateDraft = (
  validators: CmsTemplateSubmitValidators,
  draft: TemplateVersionRequest,
  csrfToken: string,
  idempotencyKey: string,
  fetcher: typeof fetch = fetch,
): Promise<CmsTemplateSubmitResult> =>
  submitCmsTemplateVersion(
    validators,
    draft,
    csrfToken,
    idempotencyKey,
    'create',
    fetcher,
  );

export const submitCmsTemplateSuccessorDraft = (
  validators: CmsTemplateSubmitValidators,
  draft: TemplateVersionRequest,
  csrfToken: string,
  idempotencyKey: string,
  fetcher: typeof fetch = fetch,
): Promise<CmsTemplateSubmitResult> =>
  submitCmsTemplateVersion(
    validators,
    draft,
    csrfToken,
    idempotencyKey,
    'successor',
    fetcher,
  );
