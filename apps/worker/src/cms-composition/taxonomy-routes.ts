import type {
  TaxonomyTermActionRequest,
  TaxonomyTermResource,
} from '@wejammin/contracts';
import {
  CmsUuidSchema,
  createRequestId,
  TaxonomyTermActionHeadersSchema,
  TaxonomyTermActionRequestSchema,
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

import {
  failure,
  statusOf,
  validEnvelope,
  validRate,
  validTerm,
  type CmsTaxonomyDependencies,
  type CmsTaxonomyError,
  type CmsTaxonomyRateDecision,
  type CmsTaxonomyResult,
} from './taxonomy-contracts';
import { commonHeaders, errorResponse } from './taxonomy-responses';

export type {
  CmsTaxonomyDependencies,
  CmsTaxonomyError,
  CmsTaxonomyPortInput,
  CmsTaxonomyRateDecision,
  CmsTaxonomyRateInput,
  CmsTaxonomyResult,
  CmsTaxonomyTelemetry,
} from './taxonomy-contracts';

const PATH = '/api/v1/cms/taxonomies/:taxonomyId/terms/actions';
const OPERATION_ID = 'CMS-03C-03';
const DEADLINE_MS = 15_000;

export const registerCmsTaxonomyRoutes = <E extends Env>(
  app: Hono<E>,
  dependencies: CmsTaxonomyDependencies,
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
    const reject = (error: CmsTaxonomyError, extra?: Headers): Response =>
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

      let session: CmsTaxonomyResult<CmsEditorialSession>;
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
      const taxonomyId = context.req.param('taxonomyId');
      if (
        !CmsUuidSchema.safeParse(taxonomyId).success ||
        new URL(request.url).search !== ''
      )
        return reject(failure(400));
      const parsed = decodeJsonBody<TaxonomyTermActionRequest>(
        bytes.value,
        TaxonomyTermActionRequestSchema,
      );
      if (!parsed.ok)
        return reject(failure(statusOf(parsed.status), parsed.details));
      const body = parsed.value;
      if (body.taxonomyId !== taxonomyId) return reject(failure(400));
      // BE00 step 7: capability, then quota.
      if (
        session.value.actingPartyId === null ||
        !session.value.capabilities.includes('cms.taxonomy_curator')
      )
        return reject(failure(403, { reasonCode: 'CAPABILITY_REQUIRED' }));

      for (const rateScope of ['user', 'party'] as const) {
        if (signal.aborted) return reject(failure(504, {}, 15));
        const limit = rateScope === 'user' ? 60 : 120;
        let rate: CmsTaxonomyResult<CmsTaxonomyRateDecision>;
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
              rateClass: 'cms-taxonomy-write',
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
            Math.ceil(rate.value.resetAt - dependencies.now() / 1000),
          );
          const resetAtLiteral = String(rate.value.resetAt);
          return reject(
            failure(
              429,
              {
                retryAfterSeconds,
                limit,
                resetAt: resetAtLiteral,
              },
              retryAfterSeconds,
            ),
            new Headers({
              'ratelimit-limit': String(limit),
              'ratelimit-remaining': '0',
              'ratelimit-reset': String(rate.value.resetAt),
            }),
          );
        }
      }

      // BE00 step 8: exact Idempotency-Key and quoted If-Match.
      const headers = TaxonomyTermActionHeadersSchema.safeParse({
        contentType: 'application/json',
        idempotencyKey: request.headers.get('idempotency-key') ?? undefined,
        ifMatch: request.headers.get('if-match') ?? undefined,
      });
      if (!headers.success) return reject(failure(400));
      const ifMatch = headers.data.ifMatch.slice(1, -1);
      if (body.expectedVersion !== ifMatch) return reject(failure(400));

      let result: CmsTaxonomyResult<TaxonomyTermResource>;
      try {
        result = await dependencies.actTerm(
          {
            operationId: OPERATION_ID,
            request,
            requestId,
            session: session.value,
            path: { taxonomyId },
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
      if (!validTerm(result.value, body)) return reject(failure(502));
      const successHeaders = commonHeaders(request, dependencies, requestId);
      successHeaders.set('content-type', 'application/json; charset=UTF-8');
      successHeaders.set('etag', `"${result.value.version}"`);
      return new Response(JSON.stringify(result.value), {
        status: 200,
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

export const createCmsTaxonomyApp = (
  dependencies: CmsTaxonomyDependencies,
): Hono => {
  const app = new Hono();
  registerCmsTaxonomyRoutes(app, dependencies);
  return app;
};
