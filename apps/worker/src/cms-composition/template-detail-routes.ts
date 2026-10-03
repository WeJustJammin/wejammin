import {
  CmsTemplateKeySchema,
  createRequestId,
  TemplateVersionDetailSchema,
  type TemplateVersionDetail,
} from '@wejammin/contracts';
import { Hono, type Env } from 'hono';

import { checkOrigin } from '../cms-editorial/admission-headers';
import { validHumanSession } from '../cms-editorial/admission-identity';
import type { CmsEditorialSession } from '../cms-editorial/types';
import {
  templateReadHeadersError,
  templateReadMediaError,
} from './template-shared';
import {
  commonHeaders,
  DEADLINE_MS,
  dependencyUnavailable,
  errorResponse,
  failure,
  invalidDependency,
  validEnvelope,
  validRateDecision,
  type CmsTemplateDependencies,
  type CmsTemplateError,
  type CmsTemplateRateDecision,
  type CmsTemplateResult,
} from './template-routes';

const PATH = '/api/v1/cms/templates/:templateKey';
const OPERATION_ID = 'cmsTemplateLatestRead';

/** Current editable snapshot; no query, owner claim, or browser RPC selection. */
export const registerCmsTemplateDetailRoutes = <E extends Env>(
  app: Hono<E>,
  dependencies: CmsTemplateDependencies,
): void => {
  app.options(PATH, (context) => {
    const request = context.req.raw;
    const requestId = createRequestId(
      request.headers.get('x-request-id') ?? undefined,
    );
    const origin = request.headers.get('origin');
    if (origin === null || !dependencies.humanOrigins.includes(origin))
      return errorResponse(request, dependencies, requestId, failure(403));
    if (
      !CmsTemplateKeySchema.safeParse(context.req.param('templateKey')).success
    )
      return errorResponse(request, dependencies, requestId, failure(400));
    const headers = commonHeaders(request, dependencies, requestId);
    headers.set('access-control-allow-methods', 'GET, OPTIONS');
    headers.set('access-control-allow-headers', 'X-Request-Id');
    return new Response(null, { status: 204, headers });
  });

  app.get(PATH, async (context) => {
    const request = context.req.raw;
    const requestId = createRequestId(
      request.headers.get('x-request-id') ?? undefined,
    );
    const startedAt = dependencies.now();
    const respondError = (error: CmsTemplateError): Response =>
      errorResponse(request, dependencies, requestId, error);
    const execute = async (signal: AbortSignal): Promise<Response> => {
      const originError = checkOrigin(request, dependencies.humanOrigins);
      if (originError !== null) return respondError(originError);
      // BE00 step 2: a read accepts no request media.
      const mediaError = templateReadMediaError(request);
      if (mediaError !== null) return respondError(mediaError);

      let session: CmsTemplateResult<CmsEditorialSession>;
      try {
        session = await dependencies.resolveSession(request, signal);
      } catch {
        return respondError(dependencyUnavailable());
      }
      if (!validEnvelope(session)) return respondError(invalidDependency());
      if (!session.ok) return respondError(session);
      const malformed = validHumanSession(session.value);
      if (malformed !== null) return respondError(malformed);
      // BE00 step 6: strict query, path, headers and body absence.
      if (new URL(request.url).search !== '') return respondError(failure(400));
      const parsedKey = CmsTemplateKeySchema.safeParse(
        context.req.param('templateKey'),
      );
      if (!parsedKey.success) return respondError(failure(400));
      const headersError = templateReadHeadersError(request);
      if (headersError !== null) return respondError(headersError);
      // BE00 step 7: capability, then quota.
      if (
        session.value.actingPartyId === null ||
        !session.value.capabilities.includes('cms.template_designer')
      )
        return respondError(
          failure(403, { reasonCode: 'CAPABILITY_REQUIRED' }),
        );

      for (const rateScope of ['user', 'party'] as const) {
        if (signal.aborted) return respondError(failure(504, {}, 15));
        const limit = 60;
        let rate: CmsTemplateResult<CmsTemplateRateDecision>;
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
              rateClass: 'cms-template-read',
              rateScope,
              limit,
              windowSeconds: 60,
            },
            signal,
          );
        } catch {
          return respondError(dependencyUnavailable());
        }
        if (!validEnvelope(rate)) return respondError(invalidDependency());
        if (!rate.ok) return respondError(rate);
        if (!validRateDecision(rate.value, limit))
          return respondError(invalidDependency());
        if (!rate.value.allowed)
          return respondError(
            failure(
              429,
              {
                retryAfterSeconds: Math.max(
                  1,
                  rate.value.resetAt - Math.floor(dependencies.now() / 1000),
                ),
                limit,
                resetAt: String(rate.value.resetAt),
              },
              Math.max(
                1,
                rate.value.resetAt - Math.floor(dependencies.now() / 1000),
              ),
            ),
          );
      }

      let result: CmsTemplateResult<TemplateVersionDetail>;
      try {
        result = await dependencies.readLatest(
          {
            operationId: OPERATION_ID,
            request,
            requestId,
            session: session.value,
            templateKey: parsedKey.data,
          },
          signal,
        );
      } catch {
        return respondError(dependencyUnavailable());
      }
      if (!validEnvelope(result)) return respondError(invalidDependency());
      if (!result.ok) return respondError(result);
      const parsed = TemplateVersionDetailSchema.safeParse(result.value);
      if (
        !parsed.success ||
        parsed.data.templateKey !== parsedKey.data ||
        parsed.data.version !== String(parsed.data.templateVersion)
      )
        return respondError(invalidDependency());
      const headers = commonHeaders(request, dependencies, requestId);
      headers.set('content-type', 'application/json; charset=UTF-8');
      headers.set('etag', `"${parsed.data.version}"`);
      return new Response(JSON.stringify(parsed.data), {
        status: 200,
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
      /* Telemetry cannot change the decided response. */
    }
    return response;
  });
};
