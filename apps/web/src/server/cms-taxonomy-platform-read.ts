import {
  CmsLineageIdSchema,
  TaxonomySelectorPageSchema,
  TaxonomySelectorQuerySchema,
  TaxonomyTermLifecycleSchema,
  TaxonomyTermListPageSchema,
  TaxonomyVersionsPageSchema,
} from '@wejammin/contracts';

import { cmsEditorialBoundedResponseJson } from './cms-editorial-platform-bounded';
import { readAdmissionStatus } from './cms-editorial-platform-read-admission';
import {
  CMS_EDITORIAL_PLATFORM_API_ORIGIN,
  cmsEditorialCopyResponseHeaders,
  cmsEditorialForwardHeaders,
  cmsEditorialSameOriginRequest,
  isCmsEditorialPlatformBinding,
} from './cms-editorial-platform-shared';
import {
  taxonomyViolationsOf,
  type TaxonomyProxyOperation,
} from './cms-taxonomy-platform-details';
import {
  relayTaxonomyError,
  taxonomyLocalError,
} from './cms-taxonomy-platform-errors';

/**
 * Server-only first-party proxies for the vocabulary reads: `cmsTaxonomyVersionsRead`
 * (`GET .../taxonomies/{taxonomyId}/versions`), `cmsTaxonomyTermsRead` (`.../terms`) and
 * CMS-03C-17 (`GET .../taxonomies/selector`, BE03c). A safe read has no body,
 * `Idempotency-Key`, `If-Match` or media type; the path id and the allowlisted query are
 * validated here and re-serialized in one fixed order, so nothing the browser invented
 * reaches the Worker. A 200 is relayed only as the strict page of THIS request whose
 * strong ETag is its page version. The Worker owns capability, concealment and the
 * signed-cursor check.
 */
const API = `${CMS_EDITORIAL_PLATFORM_API_ORIGIN}/api/v1/cms/taxonomies`;
const MAX_CURSOR = 512;
const CANONICAL_INTEGER = /^[1-9]\d{0,3}$/u;

/** The single value of each allowlisted query key, or null for an unknown, repeated or empty one. */
const queryValues = (
  request: Request,
  allowed: readonly string[],
): ReadonlyMap<string, string> | null => {
  const found = new Map<string, string>();
  for (const [key, value] of new URL(request.url).searchParams) {
    if (!allowed.includes(key) || found.has(key) || value === '') return null;
    found.set(key, value);
  }
  return found;
};

const cursorOf = (
  query: ReadonlyMap<string, string>,
): string | null | undefined => {
  const cursor = query.get('cursor');
  return cursor !== undefined && cursor.length > MAX_CURSOR ? null : cursor;
};

/** The shared fetch, error relay and ETag-bound page verification of a read. */
const forwardRead = async (
  request: Request,
  binding: unknown,
  operation: TaxonomyProxyOperation,
  target: string,
  verify: (value: unknown) => string | null,
): Promise<Response> => {
  if (!isCmsEditorialPlatformBinding(binding))
    return taxonomyLocalError(request, operation, 503);
  let upstream: Response;
  try {
    const answer = await binding.fetch(
      new Request(target, {
        method: 'GET',
        headers: cmsEditorialForwardHeaders(request),
        signal: request.signal,
      }),
    );
    if (!(answer instanceof Response))
      return taxonomyLocalError(request, operation, 503);
    upstream = answer;
  } catch {
    return taxonomyLocalError(request, operation, 503);
  }
  if (upstream.status !== 200)
    return upstream.ok
      ? taxonomyLocalError(request, operation, 502)
      : relayTaxonomyError(request, upstream, operation);
  const body = await cmsEditorialBoundedResponseJson(upstream);
  const version = body.ok ? verify(body.value) : null;
  if (
    !body.ok ||
    version === null ||
    upstream.headers.get('etag') !== `"${version}"`
  )
    return taxonomyLocalError(request, operation, 502);
  const headers = cmsEditorialCopyResponseHeaders(upstream);
  headers.set('content-type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(body.value), { status: 200, headers });
};

/** Method, admission and same-origin checks shared by the three reads; null when admitted. */
const refusal = (
  request: Request,
  operation: TaxonomyProxyOperation,
): Response | null => {
  if (request.method !== 'GET')
    return taxonomyLocalError(request, operation, 400);
  const admission = readAdmissionStatus(request);
  if (admission !== null)
    return taxonomyLocalError(request, operation, admission);
  return cmsEditorialSameOriginRequest(request)
    ? null
    : taxonomyLocalError(request, operation, 403);
};

const unique = (values: readonly string[]): boolean =>
  new Set(values).size === values.length;

export const readCmsTaxonomyVersions = (
  request: Request,
  binding: unknown,
  taxonomyId: string | undefined,
): Promise<Response> | Response => {
  const operation = 'cmsTaxonomyVersionsRead';
  if (!isCmsEditorialPlatformBinding(binding))
    return taxonomyLocalError(request, operation, 503);
  if (request.method !== 'GET' || new URL(request.url).search !== '')
    return taxonomyLocalError(request, operation, 400);
  const early = refusal(request, operation);
  if (early !== null) return early;
  const id = CmsLineageIdSchema.safeParse(taxonomyId);
  if (!id.success) return taxonomyLocalError(request, operation, 400);
  return forwardRead(
    request,
    binding,
    operation,
    `${API}/${id.data}/versions`,
    (value) => {
      const page = TaxonomyVersionsPageSchema.safeParse(value);
      return page.success &&
        page.data.items.every(
          (row) =>
            row.taxonomyId === id.data &&
            row.version === String(row.taxonomyVersion),
        )
        ? page.data.pageVersion
        : null;
    },
  );
};

export const readCmsTaxonomyTerms = (
  request: Request,
  binding: unknown,
  taxonomyId: string | undefined,
): Promise<Response> | Response => {
  const operation = 'cmsTaxonomyTermsRead';
  if (!isCmsEditorialPlatformBinding(binding))
    return taxonomyLocalError(request, operation, 503);
  const early = refusal(request, operation);
  if (early !== null) return early;
  const id = CmsLineageIdSchema.safeParse(taxonomyId);
  const query = queryValues(request, ['lifecycle', 'cursor', 'limit']);
  const lifecycle = TaxonomyTermLifecycleSchema.safeParse(
    query?.get('lifecycle'),
  );
  const cursor = query === null ? null : cursorOf(query);
  const limit = query?.get('limit');
  if (
    !id.success ||
    query === null ||
    cursor === null ||
    (query.has('lifecycle') && !lifecycle.success) ||
    (limit !== undefined &&
      (!CANONICAL_INTEGER.test(limit) ||
        Number(limit) < 1 ||
        Number(limit) > 50))
  )
    return taxonomyLocalError(request, operation, 400);
  const forwarded = new URLSearchParams();
  if (lifecycle.success) forwarded.set('lifecycle', lifecycle.data);
  if (cursor !== undefined) forwarded.set('cursor', cursor);
  if (limit !== undefined) forwarded.set('limit', limit);
  const search = forwarded.size === 0 ? '' : `?${forwarded}`;
  const bound = limit === undefined ? 25 : Number(limit);
  return forwardRead(
    request,
    binding,
    operation,
    `${API}/${id.data}/terms${search}`,
    (value) => {
      const page = TaxonomyTermListPageSchema.safeParse(value);
      return page.success &&
        page.data.items.length <= bound &&
        unique(page.data.items.map((row) => row.termId)) &&
        (!lifecycle.success ||
          page.data.items.every((row) => row.lifecycle === lifecycle.data))
        ? page.data.pageVersion
        : null;
    },
  );
};

export const readCmsTaxonomySelector = (
  request: Request,
  binding: unknown,
): Promise<Response> | Response => {
  const operation = 'CMS-03C-17';
  if (!isCmsEditorialPlatformBinding(binding))
    return taxonomyLocalError(request, operation, 503);
  const early = refusal(request, operation);
  if (early !== null) return early;
  const query = queryValues(request, [
    'typeKey',
    'fieldKey',
    'locale',
    'cursor',
    'limit',
  ]);
  const cursor = query === null ? null : cursorOf(query);
  if (
    query === null ||
    cursor === null ||
    !(['typeKey', 'fieldKey', 'locale'] as const).every((key) => query.has(key))
  )
    return taxonomyLocalError(request, operation, 400);
  const limit = query.get('limit');
  const parsed = TaxonomySelectorQuerySchema.safeParse({
    typeKey: query.get('typeKey'),
    fieldKey: query.get('fieldKey'),
    locale: query.get('locale'),
    ...(cursor === undefined ? {} : { cursor }),
    ...(limit === undefined
      ? {}
      : { limit: CANONICAL_INTEGER.test(limit) ? Number(limit) : Number.NaN }),
  });
  if (!parsed.success)
    return taxonomyLocalError(request, operation, 422, {
      violations: taxonomyViolationsOf(operation, parsed.error.issues),
    });
  const forwarded = new URLSearchParams({
    typeKey: parsed.data.typeKey,
    fieldKey: parsed.data.fieldKey,
    locale: parsed.data.locale,
  });
  if (cursor !== undefined) forwarded.set('cursor', cursor);
  if (limit !== undefined) forwarded.set('limit', String(parsed.data.limit));
  return forwardRead(
    request,
    binding,
    operation,
    `${API}/selector?${forwarded}`,
    (value) => {
      const page = TaxonomySelectorPageSchema.safeParse(value);
      return page.success &&
        page.data.items.length <= parsed.data.limit &&
        unique(page.data.items.map((row) => `${row.taxonomyId}:${row.termId}`))
        ? page.data.pageVersion
        : null;
    },
  );
};
