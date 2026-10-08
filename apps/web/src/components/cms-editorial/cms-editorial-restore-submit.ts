import {
  EntryRevisionResourceSchema,
  RevisionRestoreRequestSchema,
} from '@wejammin/contracts';

import { addClientBindingIdHeader } from '../../lib/client-binding';
import {
  cmsEditorialRestoreCommitCopy,
  CmsEditorialRestoreCarrierSchema,
  type CmsEditorialRestoreCarrier,
} from './cms-editorial-restore';
import {
  canonicalRestoreLocation,
  errorFromResponse,
  hasNoStore,
  type CmsEditorialRestoreSubmitResult,
} from './cms-editorial-restore-response';

export type { CmsEditorialRestoreSubmitResult } from './cms-editorial-restore-response';

/**
 * Browser submission for the locked CMS-03B-04 restore. The native form
 * cannot express the contract's JSON body or its required headers, so this
 * submitter intercepts the confirmation form and sends the real command:
 * application/json, the matching session CSRF token, a fresh Idempotency-Key,
 * and the strong If-Match version the caller already holds.
 *
 * The carrier is re-verified against the strict projection before anything is
 * sent, so a tampered hidden control fails closed before the fetch.
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

const newIdempotencyKey = (): string | null => {
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

export interface CmsEditorialRestoreSubmitInput {
  readonly form: HTMLFormElement;
  readonly expectedVersion?: string | null;
  readonly csrfToken?: string | null;
  /** Reuse this key when replaying an outcome that could not be confirmed. */
  readonly idempotencyKey?: string | null;
  readonly documentRef: { readonly cookie: string };
  readonly fetcher?: Fetcher;
}

export const submitCmsEditorialRestoreForm = async (
  input: CmsEditorialRestoreSubmitInput,
): Promise<CmsEditorialRestoreSubmitResult> => {
  const form = input.form;
  const read = (name: string): string | null =>
    form.querySelector<HTMLInputElement>(`input[type="hidden"][name="${name}"]`)
      ?.value ?? null;
  const entryId = read('entryId');
  const revisionId = read('revisionId');
  const migrationChainId = read('migrationChainId');
  const availability = read('availability');
  const rawEdgeCount = Number(read('edgeCount') ?? NaN);
  const carrierParse = CmsEditorialRestoreCarrierSchema.safeParse({
    migrationChainId,
    edgeCount: rawEdgeCount,
    availability,
  });
  const carrier: CmsEditorialRestoreCarrier | null = carrierParse.success
    ? carrierParse.data
    : null;
  if (entryId === null || revisionId === null || carrier === null)
    return {
      status: 'refused',
      message: 'This restore confirmation is invalid. Nothing was changed.',
    };
  const copy = cmsEditorialRestoreCommitCopy(carrier);
  if (!copy.commitAllowed) return { status: 'refused', message: copy.message };

  const expectedVersion = input.expectedVersion ?? read('expectedVersion');
  if (expectedVersion === null || !/^[1-9][0-9]{0,18}$/u.test(expectedVersion))
    return {
      status: 'refused',
      message:
        'The current entry version is unavailable. Reload the page before restoring.',
    };

  const csrfToken =
    input.csrfToken ?? READ_CSRF_COOKIE_FROM_DOCUMENT(input.documentRef);
  if (csrfToken === null)
    return {
      status: 'refused',
      message:
        'Your session is missing its CSRF token. Reload the page before restoring.',
    };

  const idempotencyKey =
    input.idempotencyKey ??
    form.dataset.cmsEditorialRestoreIdempotencyKey ??
    newIdempotencyKey();
  if (idempotencyKey === null)
    return {
      status: 'refused',
      message:
        'The browser could not create a safe restore key. Nothing was changed.',
    };

  const request = RevisionRestoreRequestSchema.safeParse({
    entryId,
    revisionId,
    migrationChainId: carrier.migrationChainId,
    expectedVersion,
  });
  if (!request.success)
    return {
      status: 'refused',
      message: 'This restore confirmation is invalid. Nothing was changed.',
    };

  const baseFetcher = input.fetcher ?? fetch;
  const fetcher: Fetcher = async (target, init) =>
    baseFetcher(target, await addClientBindingIdHeader(target, init));
  let response: Response;
  try {
    response = await fetcher(
      `/api/v1/cms/entries/${encodeURIComponent(entryId)}/revisions/${encodeURIComponent(revisionId)}/restore`,
      {
        method: 'POST',
        credentials: 'same-origin',
        redirect: 'manual',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'x-csrf-token': csrfToken,
          'idempotency-key': idempotencyKey,
          'if-match': `"${expectedVersion}"`,
        },
        body: JSON.stringify(request.data),
      },
    );
  } catch {
    form.dataset.cmsEditorialRestoreIdempotencyKey = idempotencyKey;
    return {
      status: 'error',
      error: {
        code: 'DEPENDENCY_UNAVAILABLE',
        message:
          'The restore could not be confirmed. Reload the entry before retrying.',
        requestId: 'unknown',
        details: null,
      },
      retryable: true,
      outcomeUnknown: true,
      idempotencyKey,
    };
  }
  if (response.status === 201) {
    const etag = response.headers.get('etag');
    const rawLocation = response.headers.get('location');
    let body: unknown = null;
    try {
      body = await response.clone().json();
    } catch {
      // Keep the initialized null so the strict schema rejects this response.
    }
    const resource = EntryRevisionResourceSchema.safeParse(body);
    const location =
      resource.success &&
      resource.data.entryId === entryId &&
      resource.data.id !== revisionId &&
      resource.data.state === 'draft' &&
      resource.data.conflictId === null &&
      rawLocation !== null
        ? canonicalRestoreLocation(rawLocation, entryId, resource.data.id)
        : null;
    // The strong ETag of a restore 201 is the committed ENTRY version, the
    // only valid next If-Match; `version` is the immutable snapshot's (always 1).
    const expectedEtag = resource.success
      ? `"${resource.data.entryVersion}"`
      : null;
    if (
      resource.success &&
      location !== null &&
      etag !== null &&
      etag === expectedEtag &&
      hasNoStore(response)
    ) {
      delete form.dataset.cmsEditorialRestoreIdempotencyKey;
      return {
        status: 'created',
        location,
        resource: resource.data,
        etag,
        idempotencyKey,
      };
    }
    form.dataset.cmsEditorialRestoreIdempotencyKey = idempotencyKey;
    return {
      status: 'error',
      error: {
        code: 'DEPENDENCY_UNAVAILABLE',
        message:
          'The restore result could not be verified. Reload the entry before retrying.',
        requestId: 'unknown',
        details: null,
      },
      retryable: true,
      outcomeUnknown: true,
      idempotencyKey,
    };
  }
  const error = await errorFromResponse(response, idempotencyKey);
  if (error.outcomeUnknown || error.retryable)
    form.dataset.cmsEditorialRestoreIdempotencyKey = idempotencyKey;
  else delete form.dataset.cmsEditorialRestoreIdempotencyKey;
  return error;
};
