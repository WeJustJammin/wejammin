import {
  createRequestId,
  RelatedContentReadApiRequestSchema,
  type RelatedContentRuleRead,
} from '@wejammin/contracts';
import type { Env, Hono } from 'hono';

import { checkOrigin } from '../cms-editorial/admission-headers';
import { validHumanSession } from '../cms-editorial/admission-identity';
import type { CmsEditorialSession } from '../cms-editorial/types';
import { validEnvelope, validRuleRead } from './related-content-envelope';
import {
  chargeRelatedContentQuota,
  RELATED_READ_QUOTA,
} from './related-content-rate';
import { commonHeaders, errorResponse } from './related-content-route-helpers';
import { runRelatedContentRoute } from './related-content-run';
import { failure, statusOf } from './related-content-response';
import type {
  CmsRelatedContentDependencies,
  CmsRelatedContentError,
  CmsRelatedContentResult,
  CmsRelatedContentStatus,
} from './related-content-types';
import {
  templateReadHeadersError,
  templateReadMediaError,
} from './template-shared';

const PATH = '/api/v1/cms/entries/:entryId/related-content';
const OPERATION_ID = 'cmsRelatedContentRead';
/** Registry deadline of a Tier 1 read (BE03c route registry, cmsRelatedContentRead). */
const DEADLINE_MS = 8_000;

/**
 * BE03c error matrix, `cmsRelatedContentRead`: a bounded read answers 400, 401, 403, 404, 415, 429, 500 and the
 * dependency statuses. 409 and 422 are "not applicable", so a port that raises one has broken its contract.
 */
const READ_STATUSES: ReadonlySet<CmsRelatedContentStatus> = new Set([
  400, 401, 403, 404, 415, 429, 500, 502, 503, 504,
]);

/**
 * `GET /api/v1/cms/entries/{entryId}/related-content` (DEC-195): the protected read of the source entry's current
 * related-content rule, authorized as CMS-03C-05. The order is BE00's: origin and request media, verified human
 * session, strict path and query, no precondition headers or body, the route capability, the user then party quota,
 * the port (which re-proves the source edit assignment in the database), then the response contract.
 * The strong ETag is the entry version the rule carries; no rule has no ETag. The answer is never cached.
 */
export const registerCmsRelatedContentReadRoute = <E extends Env>(
  app: Hono<E>,
  dependencies: CmsRelatedContentDependencies,
): void => {
  app.get(PATH, (context) => {
    const request = context.req.raw;
    const requestId = createRequestId(
      request.headers.get('x-request-id') ?? undefined,
    );
    const reject = (error: CmsRelatedContentError, extra?: Headers): Response =>
      errorResponse(request, dependencies, requestId, error, extra);
    const execute = async (signal: AbortSignal): Promise<Response> => {
      const originError = checkOrigin(request, dependencies.humanOrigins);
      if (originError !== null)
        return reject(failure(statusOf(originError.status)));
      const mediaError = templateReadMediaError(request);
      if (mediaError !== null)
        return reject(failure(statusOf(mediaError.status), mediaError.details));

      let session: CmsRelatedContentResult<CmsEditorialSession>;
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

      // BE00 step 6: strict path (a UUID), no query key at all, no precondition, no body.
      const path = RelatedContentReadApiRequestSchema.safeParse({
        entryId: context.req.param('entryId'),
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
      const refusal = await chargeRelatedContentQuota(
        dependencies,
        request,
        { ...session.value, actingPartyId },
        signal,
        RELATED_READ_QUOTA,
      );
      if (refusal !== null) return reject(refusal.error, refusal.headers);

      let result: CmsRelatedContentResult<RelatedContentRuleRead>;
      try {
        result = await dependencies.readRelatedContent(
          {
            operationId: OPERATION_ID,
            request,
            requestId,
            session: session.value,
            path: { entryId: path.data.entryId },
          },
          signal,
        );
      } catch {
        return reject(failure(503, {}, 15));
      }
      if (!validEnvelope<RelatedContentRuleRead>(result))
        return reject(failure(502));
      if (!result.ok) {
        const status = statusOf(result.status);
        return READ_STATUSES.has(status)
          ? reject(failure(status, result.details, result.retryAfterSeconds))
          : reject(failure(500));
      }
      if (!validRuleRead(result.value, path.data.entryId))
        return reject(failure(502));
      const headers = commonHeaders(request, dependencies, requestId);
      headers.set('content-type', 'application/json; charset=UTF-8');
      if (result.value.rule !== null)
        headers.set('etag', `"${result.value.rule.version}"`);
      return new Response(JSON.stringify(result.value), {
        status: 200,
        headers,
      });
    };
    return runRelatedContentRoute(
      request,
      dependencies,
      requestId,
      OPERATION_ID,
      DEADLINE_MS,
      execute,
    );
  });
};
