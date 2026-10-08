import type { CmsEditorialResultSummary } from './cms-editorial-result-handoff';
import { type JsonValue } from '@wejammin/contracts';

import { CmsEditorialEntryCreateRequestSchema } from './cms-editorial-entry-create';
import {
  CmsEditorialCreateFormPrefillSchema,
  buildCmsEditorialEntryCreateFormRequest,
  type CmsEditorialCreateFormPrefill,
} from './cms-editorial-entry-create-form';
import { executeCmsEditorialEntryCreate } from './cms-editorial-entry-create-transport';
import { cmsEditorialReasonMessage } from './cms-editorial-reason-copy';

/**
 * Submission of the CMS-03B-10 create from the create form's typed state. The
 * form is a React island that owns the field values, so this takes the values
 * directly (no DOM scraping) and sends the real command through the locked
 * transport: application/json, the session CSRF token, an Idempotency-Key, and
 * no If-Match (the create is the documented exception).
 *
 * `changedPaths` are `/fields/{stableFieldId}`: the only pointer SQL accepts
 * (BE03b "Pointers"). The prefilled evidence is re-verified against the strict
 * projection before anything is sent, so a tampered prefill fails closed.
 */
type Fetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export const READ_CSRF_COOKIE_FROM_DOCUMENT = (documentRef: {
  readonly cookie: string;
}): string | null => {
  const entry = documentRef.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('wj_csrf='));
  const value = entry?.slice('wj_csrf='.length);
  return value === undefined || value === '' ? null : value;
};

export const newCmsEditorialIdempotencyKey = (): string | null => {
  try {
    const api = globalThis.crypto;
    if (typeof api?.randomUUID === 'function') return api.randomUUID();
    const bytes = api.getRandomValues(new Uint8Array(16));
    return [...bytes]
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    return null;
  }
};

const FIELD_PATH = /^\/(?:values|fields)\/([0-9a-f]{8}-[0-9a-f-]{27})(?:\/|$)/u;

/** One server violation: its request pointer and, when it names one, the field. */
export interface CmsEditorialViolation {
  readonly path: string;
  readonly fieldId: string | null;
}

export const cmsEditorialViolationsFrom = (
  paths: readonly string[],
): readonly CmsEditorialViolation[] =>
  paths.map((path) => ({ path, fieldId: FIELD_PATH.exec(path)?.[1] ?? null }));

export interface CmsEditorialEntryCreateSubmitInput {
  readonly prefill: CmsEditorialCreateFormPrefill;
  /** The values to create with, keyed by stable field id; never empty. */
  readonly values: Readonly<Record<string, JsonValue>>;
  readonly csrfToken: string | null;
  /** The key of an attempt whose outcome is still unknown, else null. */
  readonly idempotencyKey: string | null;
  readonly fetcher?: Fetcher;
}

export type CmsEditorialEntryCreateSubmitResult =
  | { readonly status: 'refused'; readonly message: string }
  | {
      readonly status: 'invalid';
      readonly message: string;
      readonly reasonCode: string | null;
      readonly violations: readonly CmsEditorialViolation[];
      readonly idempotencyKey: string;
    }
  | {
      readonly status: 'error';
      readonly message: string;
      readonly retryable: boolean;
      readonly outcomeUnknown: boolean;
      readonly unauthenticated: boolean;
      readonly retryAfterSeconds: number | null;
      readonly idempotencyKey: string;
    }
  | {
      readonly status: 'created';
      /** The verified API `Location`: proof only, never a navigation target. */
      readonly location: string;
      readonly entryId: string;
      /** The canonical result, handed to the entry page the create opens. */
      readonly summary: CmsEditorialResultSummary;
    };

const refused = (message: string): CmsEditorialEntryCreateSubmitResult => ({
  status: 'refused',
  message,
});

const STATUS_COPY: Readonly<Record<string, string>> = {
  UNAUTHENTICATED: 'Your session expired. Sign in again to create this entry.',
  FORBIDDEN: 'You cannot create entries of this type.',
  NOT_FOUND: 'This content type is not available.',
  CONFLICT:
    'This content type changed after the form loaded. Reload the page and try again.',
  UNSUPPORTED_MEDIA_TYPE: 'The create request format is not supported.',
};

export const submitCmsEditorialEntryCreate = async (
  input: CmsEditorialEntryCreateSubmitInput,
): Promise<CmsEditorialEntryCreateSubmitResult> => {
  if (input.csrfToken === null)
    return refused(
      'Your session is missing its CSRF token. Reload the page before creating.',
    );
  const fieldIds = Object.keys(input.values).sort();
  if (fieldIds.length === 0)
    return refused('Enter at least one value before creating the entry.');
  const prefill = CmsEditorialCreateFormPrefillSchema.safeParse(input.prefill);
  if (!prefill.success)
    return refused('This create form is invalid. Nothing was created.');
  const idempotencyKey =
    input.idempotencyKey ?? newCmsEditorialIdempotencyKey();
  if (idempotencyKey === null)
    return refused(
      'The browser could not create a safe create key. Nothing was created.',
    );
  const request = buildCmsEditorialEntryCreateFormRequest({
    prefill: prefill.data,
    values: input.values,
    changedPaths: fieldIds.map((fieldId) => `/fields/${fieldId}`),
  });
  if (!CmsEditorialEntryCreateRequestSchema.safeParse(request).success)
    return refused('This create form is invalid. Nothing was created.');

  const result = await executeCmsEditorialEntryCreate({
    path: '/api/v1/cms/entries',
    request,
    csrfToken: input.csrfToken,
    idempotencyKey,
    ...(input.fetcher === undefined ? {} : { fetcher: input.fetcher }),
  });
  if (
    result.outcome === 'success' &&
    result.location !== null &&
    result.resource !== null
  )
    return {
      status: 'created',
      location: result.location,
      entryId: result.resource.entry.id,
      summary: {
        kind: 'created',
        entryId: result.resource.entry.id,
        revisionNumber: result.resource.revisionNumber,
        entryVersion: result.resource.entry.version,
        state: result.resource.state,
        parentRevisionIds: [],
        migrationChainId: null,
        edgeCount: null,
      },
    };
  if (result.outcome === 'validation')
    return {
      status: 'invalid',
      message:
        cmsEditorialReasonMessage(result.reasonCode) ??
        'Check the highlighted fields.',
      reasonCode: result.reasonCode,
      violations: cmsEditorialViolationsFrom(result.errorDetails),
      idempotencyKey: result.idempotencyKey,
    };
  const retained = result.idempotencyKey === idempotencyKey;
  return {
    status: 'error',
    message:
      result.errorCode === 'RATE_LIMITED'
        ? result.retryAfterSeconds === null
          ? 'Too many creates. Try again shortly.'
          : `Too many creates. Try again in ${result.retryAfterSeconds} seconds.`
        : result.outcomeUnknown
          ? 'The create could not be confirmed. Retrying sends the same request, so it cannot create a duplicate.'
          : result.outcome === 'degraded'
            ? 'Creating is unavailable right now. Nothing was created; try again shortly.'
            : (STATUS_COPY[result.errorCode ?? ''] ??
              'The create could not be completed. Nothing was created.'),
    retryable: result.retryable,
    outcomeUnknown: result.outcomeUnknown,
    unauthenticated: result.errorCode === 'UNAUTHENTICATED',
    retryAfterSeconds: result.retryAfterSeconds,
    idempotencyKey: retained ? idempotencyKey : result.idempotencyKey,
  };
};
