import {
  createRequestId,
  LocaleVariantReadApiRequestSchema,
  LocaleVariantReadSchema,
  localeVariantReadAnswers,
  type LocaleVariantRead,
} from '@wejammin/contracts';
import type { Env, Hono } from 'hono';

import { checkOrigin } from '../cms-editorial/admission-headers';
import { validHumanSession } from '../cms-editorial/admission-identity';
import type { CmsEditorialSession } from '../cms-editorial/types';
import { commonHeaders, errorResponse } from './locale-routes-responses';
import { chargeLocaleQuota, LOCALE_READ_QUOTA } from './locale-routes-quota';
import { runLocaleRoute } from './locale-routes-run';
import { failure, statusOf, validEnvelope } from './locale-routes-support';
import type {
  CmsLocaleDependencies,
  CmsLocaleError,
  CmsLocaleResult,
  CmsLocaleStatus,
} from './locale-routes-types';
import {
  templateReadHeadersError,
  templateReadMediaError,
} from './template-shared';

const PATH = '/api/v1/cms/entries/:entryId/locales/:locale';
const OPERATION_ID = 'cmsLocaleVariantRead';
/** Registry deadline of a Tier 1 read (BE03c route registry, cmsLocaleVariantRead). */
const DEADLINE_MS = 8_000;

/**
 * BE03c error matrix, `cmsLocaleVariantRead`: a bounded read answers 400, 401, 403, 404, 415, 429, 500 and the
 * dependency statuses. 409 and 422 are "not applicable", so a port that raises one has broken its contract.
 */
const READ_STATUSES: ReadonlySet<CmsLocaleStatus> = new Set([
  400, 401, 403, 404, 415, 429, 500, 502, 503, 504,
]);

/**
 * `GET /api/v1/cms/entries/{entryId}/locales/{locale}` (DEC-205): the protected read of one entry's locale variant,
 * authorized as CMS-03C-04. The order is BE00's: origin and request media, verified human session, strict path and no
 * query, no precondition headers or body, the route capability, the user then party quota, the port (which re-proves
 * the entry edit assignment and the supported locale in the database), then the response contract. The answer is never
 * cached and carries no ETag: the form's `If-Match` is the entry version, which the draft detail serves.
 */
export const registerCmsLocaleReadRoute = <E extends Env>(
  app: Hono<E>,
  dependencies: CmsLocaleDependencies,
): void => {
  app.options(PATH, (context) => {
    const request = context.req.raw;
    const requestId = createRequestId(
      request.headers.get('x-request-id') ?? undefined,
    );
    const origin = request.headers.get('origin');
    if (origin === null || !dependencies.humanOrigins.includes(origin))
      return errorResponse(request, dependencies, requestId, failure(403));
    const headers = commonHeaders(request, dependencies, requestId);
    headers.set('access-control-allow-methods', 'GET, OPTIONS');
    headers.set('access-control-allow-headers', 'X-Request-Id');
    return new Response(null, { status: 204, headers });
  });

  app.get(PATH, (context) => {
    const request = context.req.raw;
    const requestId = createRequestId(
      request.headers.get('x-request-id') ?? undefined,
    );
    const reject = (error: CmsLocaleError, extra?: Headers): Response =>
      errorResponse(request, dependencies, requestId, error, extra);
    const execute = async (signal: AbortSignal): Promise<Response> => {
      const originError = checkOrigin(request, dependencies.humanOrigins);
      if (originError !== null)
        return reject(failure(statusOf(originError.status)));
      const mediaError = templateReadMediaError(request);
      if (mediaError !== null)
        return reject(failure(statusOf(mediaError.status), mediaError.details));

      let session: CmsLocaleResult<CmsEditorialSession>;
      try {
        session = await dependencies.resolveSession(request, signal);
      } catch {
        return reject(failure(503, {}, 15));
      }
      if (!validEnvelope(session)) return reject(failure(502));
      if (!session.ok)
        return reject(
          failure(
            statusOf(session.status),
            session.details,
            session.retryAfterSeconds,
          ),
        );
      const invalidSession = validHumanSession(session.value);
      if (invalidSession !== null)
        return reject(failure(statusOf(invalidSession.status)));

      // BE00 step 6: strict path (a UUID and a BCP 47 tag), no query key at all, no precondition, no body.
      const path = LocaleVariantReadApiRequestSchema.safeParse({
        entryId: context.req.param('entryId'),
        locale: context.req.param('locale'),
      });
      if (!path.success || request.url.includes('?'))
        return reject(failure(400));
      const headersError = templateReadHeadersError(request);
      if (headersError !== null) return reject(failure(400));

      // BE00 step 7: the route capability, then both quota buckets.
      const actingPartyId = session.value.actingPartyId;
      if (
        actingPartyId === null ||
        !session.value.capabilities.some(
          (value) => value === 'cms.author' || value === 'cms.editor',
        )
      )
        return reject(failure(403, { reasonCode: 'capability_missing' }));
      const refusal = await chargeLocaleQuota(
        dependencies,
        request,
        { ...session.value, actingPartyId },
        signal,
        LOCALE_READ_QUOTA,
      );
      if (refusal !== null) return reject(refusal.error, refusal.headers);

      let result: CmsLocaleResult<LocaleVariantRead>;
      try {
        result = await dependencies.readLocaleVariant(
          {
            operationId: OPERATION_ID,
            request,
            requestId,
            session: session.value,
            path: path.data,
          },
          signal,
        );
      } catch {
        return reject(failure(503, {}, 15));
      }
      if (!validEnvelope<LocaleVariantRead>(result))
        return reject(failure(502));
      if (!result.ok) {
        const status = statusOf(result.status);
        return READ_STATUSES.has(status)
          ? reject(failure(status, result.details, result.retryAfterSeconds))
          : reject(failure(500));
      }
      const read = LocaleVariantReadSchema.safeParse(result.value);
      if (
        !read.success ||
        !localeVariantReadAnswers(
          read.data,
          path.data.entryId,
          path.data.locale,
        )
      )
        return reject(failure(502));
      const headers = commonHeaders(request, dependencies, requestId);
      headers.set('content-type', 'application/json; charset=UTF-8');
      return new Response(JSON.stringify(read.data), {
        status: 200,
        headers,
      });
    };
    return runLocaleRoute(
      request,
      dependencies,
      requestId,
      OPERATION_ID,
      DEADLINE_MS,
      execute,
    );
  });
};
