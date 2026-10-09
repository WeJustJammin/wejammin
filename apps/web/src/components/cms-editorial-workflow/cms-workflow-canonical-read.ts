import {
  ApiErrorSchema,
  EditorialReviewDetailResourceSchema,
  EntryWorkflowResourceSchema,
  type EditorialReviewDetailResource,
  type EntryWorkflowResource,
} from '@wejammin/contracts';

import { addClientBindingIdHeader } from '../../lib/client-binding';

/**
 * The browser's canonical refetch of a workflow or review (FE03 Slice 11 states:
 * "the workflow, review and queue are refetched" after every command and before
 * any retry of an unknown outcome). A read is no-store, carries no mutation
 * header and is never cached; the strict resource, its identity and a strong
 * validator are all required, otherwise the surface is `degraded` and keeps its
 * last verified content with every command disabled until a read verifies.
 */
type Fetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export type CanonicalReadResult<T> =
  | { readonly kind: 'ok'; readonly resource: T }
  | { readonly kind: 'signed-out' }
  /** 403 or 404: one identical non-disclosing state; protected data is removed. */
  | { readonly kind: 'gone' }
  | { readonly kind: 'degraded'; readonly requestId: string | null };

const STRONG_ETAG = /^"[\x21\x23-\x7e]{1,256}"$/u;

const read = async <T>(
  path: string,
  verify: (body: unknown, etag: string) => T | null,
  fetcher: Fetcher,
): Promise<CanonicalReadResult<T>> => {
  let response: Response;
  try {
    response = await fetcher(
      path,
      await addClientBindingIdHeader(path, {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
        redirect: 'manual',
        headers: { accept: 'application/json' },
      }),
    );
  } catch {
    return { kind: 'degraded', requestId: null };
  }
  if (response.status === 401) return { kind: 'signed-out' };
  if (response.status === 403 || response.status === 404)
    return { kind: 'gone' };
  let body: unknown = null;
  try {
    body = await response.clone().json();
  } catch {
    // An unreadable body is degraded below.
  }
  if (response.status === 200) {
    const etag = response.headers.get('etag');
    const resource =
      etag !== null && STRONG_ETAG.test(etag) ? verify(body, etag) : null;
    if (resource !== null) return { kind: 'ok', resource };
  }
  const error = ApiErrorSchema.safeParse(body);
  return {
    kind: 'degraded',
    requestId: error.success ? error.data.requestId : null,
  };
};

/** CMS-03B-15 through the first-party proxy; `revisionId` null reads the current draft. */
export const readCanonicalWorkflow = (
  entryId: string,
  revisionId: string | null,
  fetcher: Fetcher = fetch,
): Promise<CanonicalReadResult<EntryWorkflowResource>> =>
  read(
    `/api/v1/cms/entries/${encodeURIComponent(entryId)}/workflow${
      revisionId === null ? '' : `?revisionId=${encodeURIComponent(revisionId)}`
    }`,
    (body) => {
      const resource = EntryWorkflowResourceSchema.safeParse(body);
      return resource.success &&
        resource.data.entry.id === entryId &&
        (revisionId === null || resource.data.revision.id === revisionId)
        ? resource.data
        : null;
    },
    fetcher,
  );

/** CMS-03B-16 through the first-party proxy. */
export const readCanonicalReview = (
  reviewId: string,
  fetcher: Fetcher = fetch,
): Promise<CanonicalReadResult<EditorialReviewDetailResource>> =>
  read(
    `/api/v1/cms/reviews/${encodeURIComponent(reviewId)}`,
    (body, etag) => {
      const resource = EditorialReviewDetailResourceSchema.safeParse(body);
      return resource.success &&
        resource.data.id === reviewId &&
        etag === `"${resource.data.version}"`
        ? resource.data
        : null;
    },
    fetcher,
  );
