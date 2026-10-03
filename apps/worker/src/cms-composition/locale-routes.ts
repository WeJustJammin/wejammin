import type {
  LocaleVariantRequest,
  LocaleVariantResource,
} from '@wejammin/contracts';
import {
  createRequestId,
  LocaleVariantHeadersSchema,
  LocaleVariantPathSchema,
  LocaleVariantRequestSchema,
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
import { commonHeaders, errorResponse } from './locale-routes-responses';
import {
  failure,
  statusOf,
  validDraft,
  validEnvelope,
  validRate,
} from './locale-routes-support';
import type {
  CmsLocaleDependencies,
  CmsLocaleError,
  CmsLocaleRateDecision,
  CmsLocaleResult,
} from './locale-routes-types';

export type {
  CmsLocaleDependencies,
  CmsLocaleError,
  CmsLocalePortInput,
  CmsLocaleRateDecision,
  CmsLocaleRateInput,
  CmsLocaleResult,
  CmsLocaleTelemetry,
} from './locale-routes-types';

const PATH = '/api/v1/cms/entries/:entryId/locales/:locale/variants';
const OPERATION_ID = 'CMS-03C-04';
const DEADLINE_MS = 15_000;

export const registerCmsLocaleRoutes = <E extends Env>(
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
    const respondError = (error: CmsLocaleError, headers?: Headers): Response =>
      errorResponse(request, dependencies, requestId, error, headers);
    const execute = async (signal: AbortSignal): Promise<Response> => {
      const originError = checkOrigin(request, dependencies.humanOrigins);
      if (originError !== null)
        return respondError(failure(statusOf(originError.status)));
      // BE00 step 2: body ceiling, content type, session-bound CSRF.
      const preflight = jsonBodyPreflight(request);
      if (preflight !== null)
        return respondError(
          failure(statusOf(preflight.status), preflight.details),
        );
      const csrf = csrfErrorIfCookie(request);
      if (csrf !== null) return respondError(failure(statusOf(csrf.status)));
      const bytes = await readBytes(request, signal);
      if (!bytes.ok)
        return respondError(failure(statusOf(bytes.status), bytes.details));

      let session: CmsLocaleResult<CmsEditorialSession>;
      try {
        session = await dependencies.resolveSession(request, signal);
      } catch {
        return respondError(failure(503, {}, 15));
      }
      if (!validEnvelope(session)) return respondError(failure(502));
      if (!session.ok)
        return respondError(
          failure(
            statusOf(session.status),
            session.details,
            session.retryAfterSeconds,
          ),
        );
      const malformed = validHumanSession(session.value);
      if (malformed !== null)
        return respondError(failure(statusOf(malformed.status)));
      // BE00 step 6: strict path, query and body.
      const parsedPath = LocaleVariantPathSchema.safeParse({
        entryId: context.req.param('entryId'),
        locale: context.req.param('locale'),
      });
      if (!parsedPath.success || new URL(request.url).search !== '')
        return respondError(failure(400));
      const parsedBody = decodeJsonBody<LocaleVariantRequest>(
        bytes.value,
        LocaleVariantRequestSchema,
      );
      if (!parsedBody.ok)
        return respondError(failure(statusOf(parsedBody.status)));
      const body = parsedBody.value;
      if (
        body.entryId !== parsedPath.data.entryId ||
        body.locale !== parsedPath.data.locale
      )
        return respondError(failure(400));
      // BE00 step 7: capability, then quota.
      if (
        session.value.actingPartyId === null ||
        !session.value.capabilities.some(
          (value) => value === 'cms.author' || value === 'cms.editor',
        )
      )
        return respondError(
          failure(403, { reasonCode: 'CAPABILITY_REQUIRED' }),
        );

      for (const rateScope of ['user', 'party'] as const) {
        if (signal.aborted) return respondError(failure(504, {}, 15));
        const limit = rateScope === 'user' ? 60 : 120;
        let rate: CmsLocaleResult<CmsLocaleRateDecision>;
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
              rateClass: 'cms-locale-write',
              rateScope,
              limit,
              windowSeconds: 60,
            },
            signal,
          );
        } catch {
          return respondError(failure(503, {}, 15));
        }
        if (!validEnvelope(rate)) return respondError(failure(502));
        if (!rate.ok)
          return respondError(
            failure(
              statusOf(rate.status),
              rate.details,
              rate.retryAfterSeconds,
            ),
          );
        if (!validRate(rate.value, limit)) return respondError(failure(502));
        if (!rate.value.allowed) {
          const retryAfterSeconds = Math.max(
            1,
            Math.ceil(rate.value.resetAt - dependencies.now() / 1000),
          );
          const resetAtLiteral = String(rate.value.resetAt);
          return respondError(
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
      const parsedHeaders = LocaleVariantHeadersSchema.safeParse({
        contentType: 'application/json',
        idempotencyKey: request.headers.get('idempotency-key') ?? undefined,
        ifMatch: request.headers.get('if-match') ?? undefined,
      });
      if (!parsedHeaders.success) return respondError(failure(400));
      const ifMatch = parsedHeaders.data.ifMatch.slice(1, -1);
      if (body.expectedVersion !== ifMatch) return respondError(failure(400));

      let result: CmsLocaleResult<LocaleVariantResource>;
      try {
        result = await dependencies.authorLocale(
          {
            operationId: OPERATION_ID,
            request,
            requestId,
            session: session.value,
            path: parsedPath.data,
            body,
            idempotencyKey: parsedHeaders.data.idempotencyKey,
            ifMatch,
          },
          signal,
        );
      } catch {
        return respondError(failure(503, {}, 15));
      }
      if (!validEnvelope(result)) return respondError(failure(502));
      if (!result.ok)
        return respondError(
          failure(
            statusOf(result.status),
            result.details,
            result.retryAfterSeconds,
          ),
        );
      if (!validDraft(result.value, body)) return respondError(failure(502));
      const headers = commonHeaders(request, dependencies, requestId);
      headers.set('content-type', 'application/json; charset=UTF-8');
      headers.set('etag', `"${BigInt(body.expectedVersion) + 1n}"`);
      return new Response(JSON.stringify(result.value), {
        status: 201,
        headers,
      });
    };

    const controller = new AbortController();
    let timer!: ReturnType<typeof setTimeout>;
    const timeout = new Promise<Response>((resolve) => {
      timer = setTimeout(() => {
        controller.abort();
        resolve(respondError(failure(504, {}, 15)));
      }, DEADLINE_MS);
    });
    let response: Response;
    try {
      response = await Promise.race([execute(controller.signal), timeout]);
    } catch {
      response = respondError(failure(500));
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

export const createCmsLocaleApp = (
  dependencies: CmsLocaleDependencies,
): Hono => {
  const app = new Hono();
  registerCmsLocaleRoutes(app, dependencies);
  return app;
};
