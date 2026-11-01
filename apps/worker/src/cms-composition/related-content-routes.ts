import type {
  RelatedContentResource,
  RelatedContentRuleRequest,
} from '@wejammin/contracts';
import {
  createRequestId,
  RelatedContentHeadersSchema,
  RelatedContentPathSchema,
  RelatedContentRuleRequestSchema,
} from '@wejammin/contracts';
import { Hono, type Env } from 'hono';

import {
  decodeJsonBody,
  jsonBodyPreflight,
  readBytes,
} from '../cms-editorial/admission-body';
import {
  checkOrigin,
  csrfErrorIfCookie,
} from '../cms-editorial/admission-headers';
import { validHumanSession } from '../cms-editorial/admission-identity';
import type { CmsEditorialSession } from '../cms-editorial/types';
import { validEnvelope, validResource } from './related-content-envelope';
import {
  chargeRelatedContentQuota,
  RELATED_WRITE_QUOTA,
} from './related-content-rate';
import { registerCmsRelatedContentReadRoute } from './related-content-read-routes';
import { instrumentComposition } from './observability-instrument';
import { commonHeaders, errorResponse } from './related-content-route-helpers';
import { runRelatedContentRoute } from './related-content-run';
import { failure, statusOf } from './related-content-response';
import type {
  CmsRelatedContentDependencies,
  CmsRelatedContentError,
  CmsRelatedContentResult,
} from './related-content-types';

export type {
  CmsRelatedContentDependencies,
  CmsRelatedContentError,
  CmsRelatedContentPortInput,
  CmsRelatedContentRateDecision,
  CmsRelatedContentRateInput,
  CmsRelatedContentReadInput,
  CmsRelatedContentResult,
  CmsRelatedContentTelemetry,
} from './related-content-types';

const PATH = '/api/v1/cms/entries/:entryId/related-content';
const OPERATION_ID = 'CMS-03C-05';
const DEADLINE_MS = 15_000;

export const registerCmsRelatedContentRoutes = <E extends Env>(
  app: Hono<E>,
  registered: CmsRelatedContentDependencies,
): void => {
  // BE03c Observability: the request event lists only the stages the request reached.
  const dependencies = instrumentComposition(registered, {
    writes: ['actRelatedContent'],
    reads: ['readRelatedContent'],
  });
  app.options(PATH, (context) => {
    const request = context.req.raw;
    const requestId = createRequestId(
      request.headers.get('x-request-id') ?? undefined,
    );
    const origin = request.headers.get('origin');
    if (origin === null || !dependencies.humanOrigins.includes(origin))
      return errorResponse(request, dependencies, requestId, failure(403));
    const headers = commonHeaders(request, dependencies, requestId);
    headers.set('access-control-allow-methods', 'GET, POST, OPTIONS');
    headers.set(
      'access-control-allow-headers',
      'Content-Type, Idempotency-Key, If-Match, X-CSRF-Token, X-Request-Id',
    );
    return new Response(null, { status: 204, headers });
  });

  app.post(PATH, async (context) => {
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
      // BE00 step 2: body ceiling, content type, session-bound CSRF.
      const preflight = jsonBodyPreflight(request);
      if (preflight !== null)
        return reject(failure(statusOf(preflight.status), preflight.details));
      const csrf = csrfErrorIfCookie(request);
      if (csrf !== null) return reject(failure(statusOf(csrf.status)));
      const bytes = await readBytes(request, signal);
      if (!bytes.ok)
        return reject(failure(statusOf(bytes.status), bytes.details));

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
      // BE00 step 6: strict path, query and body.
      const pathParse = RelatedContentPathSchema.safeParse({
        entryId: context.req.param('entryId'),
      });
      if (!pathParse.success || new URL(request.url).search !== '')
        return reject(failure(400));
      const parsed = decodeJsonBody<RelatedContentRuleRequest>(
        bytes.value,
        RelatedContentRuleRequestSchema,
      );
      if (!parsed.ok)
        return reject(failure(statusOf(parsed.status), parsed.details));
      const body = parsed.value;
      if (body.entryId !== pathParse.data.entryId) return reject(failure(400));
      // BE00 step 6 (line 386) and BE03c 408: the exact Idempotency-Key and quoted If-Match are
      // validated before authorization, so a malformed header consumes no quota.
      const headers = RelatedContentHeadersSchema.safeParse({
        contentType: 'application/json',
        idempotencyKey: request.headers.get('idempotency-key') ?? undefined,
        ifMatch: request.headers.get('if-match') ?? undefined,
      });
      if (!headers.success) return reject(failure(400));
      const ifMatch = headers.data.ifMatch.slice(1, -1);
      if (body.expectedVersion !== ifMatch) return reject(failure(400));

      // BE00 step 7: capability, then quota.
      if (
        session.value.actingPartyId === null ||
        !session.value.capabilities.some(
          (value) => value === 'cms.author' || value === 'cms.editor',
        )
      )
        return reject(failure(403, { reasonCode: 'capability_missing' }));

      const refusal = await chargeRelatedContentQuota(
        dependencies,
        request,
        { ...session.value, actingPartyId: session.value.actingPartyId },
        signal,
        RELATED_WRITE_QUOTA,
      );
      if (refusal !== null) return reject(refusal.error, refusal.headers);

      let result: CmsRelatedContentResult<RelatedContentResource>;
      try {
        result = await dependencies.actRelatedContent(
          {
            operationId: OPERATION_ID,
            request,
            requestId,
            session: session.value,
            path: { entryId: pathParse.data.entryId },
            body,
            idempotencyKey: headers.data.idempotencyKey,
            ifMatch,
          },
          signal,
        );
      } catch {
        return reject(failure(503, {}, 15));
      }
      if (!validEnvelope(result)) return reject(failure(502));
      if (!result.ok)
        return reject(
          failure(
            statusOf(result.status),
            result.details,
            result.retryAfterSeconds,
          ),
        );
      if (!validResource(result.value, body)) return reject(failure(502));
      const successHeaders = commonHeaders(request, dependencies, requestId);
      successHeaders.set('content-type', 'application/json; charset=UTF-8');
      successHeaders.set('etag', '"' + String(result.value.version) + '"');
      return new Response(JSON.stringify(result.value), {
        status: 201,
        headers: successHeaders,
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

  registerCmsRelatedContentReadRoute(app, dependencies);
};

export const createCmsRelatedContentApp = (
  dependencies: CmsRelatedContentDependencies,
): Hono => {
  const app = new Hono();
  registerCmsRelatedContentRoutes(app, dependencies);
  return app;
};
