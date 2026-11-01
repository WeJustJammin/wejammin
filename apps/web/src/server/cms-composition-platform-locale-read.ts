import {
  createRequestId,
  LocaleVariantReadApiRequestSchema,
  LocaleVariantReadSchema,
  localeVariantReadAnswers,
} from '@wejammin/contracts';

import {
  forwardedLocaleError,
  localeError,
} from './cms-composition-platform-locale';
import { cmsEditorialBoundedResponseJson } from './cms-editorial-platform-bounded';
import { readAdmissionStatus } from './cms-editorial-platform-read-admission';
import {
  CMS_EDITORIAL_PLATFORM_API_ORIGIN,
  cmsEditorialForwardHeaders,
  cmsEditorialSameOriginRequest,
  isCmsEditorialPlatformBinding,
} from './cms-editorial-platform-shared';

/**
 * BE03c error matrix, `cmsLocaleVariantRead`: a bounded read declares 400, 401, 403, 404, 415, 429, 500 and the
 * dependency statuses. 409 and 422 are "not applicable", so an upstream answer on either has broken its contract.
 */
const UNDECLARED: ReadonlySet<number> = new Set([409, 422]);

/**
 * Server-only first-party proxy for `cmsLocaleVariantRead` (`GET /api/v1/cms/entries/{entryId}/locales/{locale}`,
 * DEC-205, BE03c): the entry's current locale variant, its stored values, the CMS-03C-20 resolution of each
 * localizable field and the active fallback order, for the translation form and its page. The entry and the locale
 * are addressed by path only, so a query (even an empty one), a body, an `Idempotency-Key`, an `If-Match`, a media
 * type and a malformed id or tag are refused here and never reach the Worker; the forwarded headers are the session
 * allowlist, so a browser's conditional headers cannot turn the read into a 304. A 200 is relayed only as the strict
 * `LocaleVariantRead` of THIS entry and locale. The Worker owns capability (403, a visible entry without edit) and
 * concealment (404, a hidden entry or an unsupported locale).
 */
export const readCmsLocaleVariant = async (
  request: Request,
  entryId: string | undefined,
  locale: string | undefined,
  binding: unknown,
): Promise<Response> => {
  if (!isCmsEditorialPlatformBinding(binding)) return localeError(request, 503);
  if (request.method !== 'GET' || request.url.includes('?'))
    return localeError(request, 400);
  const admission = readAdmissionStatus(request);
  if (admission !== null) return localeError(request, admission);
  const path = LocaleVariantReadApiRequestSchema.safeParse({ entryId, locale });
  if (!path.success) return localeError(request, 400);
  if (!cmsEditorialSameOriginRequest(request)) return localeError(request, 403);

  let upstream: Response;
  try {
    const answer = await binding.fetch(
      new Request(
        `${CMS_EDITORIAL_PLATFORM_API_ORIGIN}/api/v1/cms/entries/${path.data.entryId}/locales/${encodeURIComponent(path.data.locale)}`,
        {
          method: 'GET',
          headers: cmsEditorialForwardHeaders(request),
          signal: request.signal,
        },
      ),
    );
    if (!(answer instanceof Response)) return localeError(request, 503);
    upstream = answer;
  } catch {
    return localeError(request, 503);
  }
  if (upstream.status !== 200)
    return UNDECLARED.has(upstream.status)
      ? localeError(request, 502)
      : forwardedLocaleError(request, upstream);

  const body = await cmsEditorialBoundedResponseJson(upstream);
  const parsed = body.ok ? LocaleVariantReadSchema.safeParse(body.value) : null;
  if (
    parsed === null ||
    !parsed.success ||
    !localeVariantReadAnswers(parsed.data, path.data.entryId, path.data.locale)
  )
    return localeError(request, 502);
  return new Response(JSON.stringify(parsed.data), {
    status: 200,
    headers: {
      'cache-control': 'no-store',
      'content-type': 'application/json; charset=UTF-8',
      'x-request-id': createRequestId(
        upstream.headers.get('x-request-id') ?? undefined,
      ),
    },
  });
};
