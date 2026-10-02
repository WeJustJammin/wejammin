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

import { parseJsonBody } from '../cms-editorial/admission-body';
import {
  checkOrigin,
  csrfErrorIfCookie,
} from '../cms-editorial/admission-headers';
import { validHumanSession } from '../cms-editorial/admission-identity';
import type { CmsEditorialSession } from '../cms-editorial/types';
import {
  validEnvelope,
  validRate,
  validResource,
} from './related-content-envelope';
import { commonHeaders, errorResponse } from './related-content-route-helpers';
import { failure, statusOf } from './related-content-response';
import type {
  CmsRelatedContentDependencies,
  CmsRelatedContentError,
  CmsRelatedContentRateDecision,
  CmsRelatedContentResult,
} from './related-content-types';

export type {
  CmsRelatedContentDependencies,
  CmsRelatedContentError,
  CmsRelatedContentPortInput,
  CmsRelatedContentRateDecision,
  CmsRelatedContentRateInput,
  CmsRelatedContentResult,
  CmsRelatedContentTelemetry,
} from './related-content-types';

const PATH = '/api/v1/cms/entries/:entryId/related-content';
const OPERATION_ID = 'CMS-03C-05';
const DEADLINE_MS = 15_000;

export const registerCmsRelatedContentRoutes = <E extends Env>(
  app: Hono<E>,
  dependencies: CmsRelatedContentDependencies,
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
    headers.set('access-control-allow-methods', 'POST, OPTIONS');
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
    const startedAt = dependencies.now();
    const reject = (error: CmsRelatedContentError, extra?: Headers): Response =>
      errorResponse(request, dependencies, requestId, error, extra);
    const execute = async (signal: AbortSignal): Promise<Response> => {
      const originError = checkOrigin(request, dependencies.humanOrigins);
      if (originError !== null)
        return reject(failure(statusOf(originError.status)));
      const pathParse = RelatedContentPathSchema.safeParse({
        entryId: context.req.param('entryId'),
      });
      if (!pathParse.success || new URL(request.url).search !== '')
        return reject(failure(400));
      const media = request.headers.get('content-type')?.split(';')[0]?.trim();
      if (media !== 'application/json') return reject(failure(415));
      const headers = RelatedContentHeadersSchema.safeParse({
        contentType: media,
        idempotencyKey: request.headers.get('idempotency-key') ?? undefined,
        ifMatch: request.headers.get('if-match') ?? undefined,
      });
      if (!headers.success) return reject(failure(400));
      const csrf = csrfErrorIfCookie(request);
      if (csrf !== null) return reject(failure(statusOf(csrf.status)));
      const parsed = await parseJsonBody<RelatedContentRuleRequest>(
        request,
        RelatedContentRuleRequestSchema,
        signal,
      );
      if (!parsed.ok)
        return reject(failure(statusOf(parsed.status), parsed.details));
      const body = parsed.value;
      const ifMatch = headers.data.ifMatch.slice(1, -1);
      if (
        body.entryId !== pathParse.data.entryId ||
        body.expectedVersion !== ifMatch
      )
        return reject(failure(400));

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
      if (
        session.value.actingPartyId === null ||
        !session.value.capabilities.includes('cms.author')
      )
        return reject(failure(403, { reasonCode: 'CAPABILITY_REQUIRED' }));

      for (const rateScope of ['user', 'party'] as const) {
        if (signal.aborted) return reject(failure(504, {}, 15));
        const limit = rateScope === 'user' ? 60 : 120;
        let rate: CmsRelatedContentResult<CmsRelatedContentRateDecision>;
        try {
          rate = await dependencies.rateLimit(
            {
              operationId: OPERATION_ID,
              request,
              actorId:
                rateScope === 'user'
                  ? session.value.userId
                  : session.value.actingPartyId,
              actingPartyId: session.value.actingPartyId,
              principalClass: 'human',
              rateClass: 'cms-related-content-write',
              rateScope,
              limit,
              windowSeconds: 60,
            },
            signal,
          );
        } catch {
          return reject(failure(503, {}, 15));
        }
        if (!validEnvelope(rate)) return reject(failure(502));
        if (!rate.ok)
          return reject(
            failure(
              statusOf(rate.status),
              rate.details,
              rate.retryAfterSeconds,
            ),
          );
        if (!validRate(rate.value, limit)) return reject(failure(502));
        if (!rate.value.allowed) {
          const retryAfterSeconds = Math.max(
            1,
            Math.ceil((rate.value.resetAt - dependencies.now()) / 1000),
          );
          return reject(
            failure(
              429,
              { retryAfterSeconds, limit, resetAt: rate.value.resetAt },
              retryAfterSeconds,
            ),
            new Headers({
              'ratelimit-limit': String(limit),
              'ratelimit-remaining': '0',
            }),
          );
        }
      }

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

    const controller = new AbortController();
    let timer!: ReturnType<typeof setTimeout>;
    const timeout = new Promise<Response>((resolve) => {
      timer = setTimeout(() => {
        controller.abort();
        resolve(reject(failure(504, {}, 15)));
      }, DEADLINE_MS);
    });
    let response: Response;
    try {
      response = await Promise.race([execute(controller.signal), timeout]);
    } catch {
      response = reject(failure(500));
    } finally {
      clearTimeout(timer);
    }
    try {
      void Promise.resolve(
        dependencies.telemetry({
          operationId: OPERATION_ID,
          requestId,
          status: response.status,
          outcome:
            response.status < 400
              ? 'success'
              : response.status < 500
                ? 'rejected'
                : 'failure',
          actorClass: 'human',
          durationMs: Math.max(0, dependencies.now() - startedAt),
        }),
      ).catch(() => undefined);
    } catch {
      /* Telemetry cannot change the response. */
    }
    return response;
  });
};

export const createCmsRelatedContentApp = (
  dependencies: CmsRelatedContentDependencies,
): Hono => {
  const app = new Hono();
  registerCmsRelatedContentRoutes(app, dependencies);
  return app;
};
