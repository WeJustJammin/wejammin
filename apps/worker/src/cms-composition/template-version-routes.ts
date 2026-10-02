import type {
  TemplateVersionRequest,
  TemplateVersionResource,
} from '@wejammin/contracts';
import {
  createRequestId,
  TemplateVersionHeadersSchema,
  TemplateVersionRequestSchema,
  TemplateVersionResourceSchema,
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
  DEADLINE_MS,
  dependencyUnavailable,
  failure,
  invalidDependency,
  validEnvelope,
  validRateDecision,
  type CmsTemplateDependencies,
  type CmsTemplateError,
  type CmsTemplateRateDecision,
  type CmsTemplateResult,
} from './template-shared';
import { commonHeaders, errorResponse } from './template-respond';

const PATH = '/api/v1/cms/templates/versions';
const OPERATION_ID = 'CMS-03C-01';

const validDraft = (
  value: unknown,
  body: TemplateVersionRequest,
): value is TemplateVersionResource => {
  const parsed = TemplateVersionResourceSchema.safeParse(value);
  if (!parsed.success) return false;
  const draft = parsed.data;
  return (
    draft.state === 'draft' &&
    draft.templateKey === body.templateKey &&
    draft.version === String(draft.templateVersion) &&
    BigInt(draft.version) === BigInt(body.expectedVersion ?? '0') + 1n &&
    draft.compatibleTypeIds.join('\u0000') ===
      body.compatibleTypeIds.join('\u0000') &&
    draft.reservedRegions.join('\u0000') ===
      body.reservedRegions.join('\u0000') &&
    (body.blockRegistryDigest === undefined ||
      draft.blockRegistryDigest === body.blockRegistryDigest)
  );
};

export const registerCmsTemplateVersionRoutes = <E extends Env>(
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
    const respondError = (
      error: CmsTemplateError,
      headers?: Headers,
    ): Response =>
      errorResponse(request, dependencies, requestId, error, headers);
    const execute = async (signal: AbortSignal): Promise<Response> => {
      const originError = checkOrigin(request, dependencies.humanOrigins);
      if (originError !== null) return respondError(originError);
      const media = request.headers.get('content-type')?.split(';')[0]?.trim();
      if (media !== 'application/json') return respondError(failure(415));
      const parsedHeaders = TemplateVersionHeadersSchema.safeParse({
        contentType: media,
        idempotencyKey: request.headers.get('idempotency-key') ?? undefined,
        ifMatch: request.headers.get('if-match') ?? undefined,
      });
      if (!parsedHeaders.success) return respondError(failure(400));
      const csrfError = csrfErrorIfCookie(request);
      if (csrfError !== null) return respondError(csrfError);
      const parsedBody = await parseJsonBody<TemplateVersionRequest>(
        request,
        TemplateVersionRequestSchema,
        signal,
      );
      if (!parsedBody.ok) return respondError(parsedBody);
      const body = parsedBody.value;
      const quoted = parsedHeaders.data.ifMatch;
      const ifMatch = quoted === undefined ? null : quoted.slice(1, -1);
      if (
        (body.expectedVersion === null) !== (ifMatch === null) ||
        (ifMatch !== null && body.expectedVersion !== ifMatch)
      )
        return respondError(failure(400));

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
      if (
        session.value.actingPartyId === null ||
        !session.value.capabilities.includes('cms.template_designer')
      )
        return respondError(
          failure(403, { reasonCode: 'CAPABILITY_REQUIRED' }),
        );

      for (const rateScope of ['user', 'party'] as const) {
        if (signal.aborted) return respondError(failure(504, {}, 15));
        const limit = rateScope === 'user' ? 30 : 60;
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
              rateClass: 'cms-template-write',
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
        if (!rate.value.allowed) {
          const retryAfterSeconds = Math.max(
            1,
            rate.value.resetAt - Math.floor(dependencies.now() / 1000),
          );
          return respondError(
            failure(
              429,
              { retryAfterSeconds, limit, resetAt: String(rate.value.resetAt) },
              retryAfterSeconds,
            ),
          );
        }
      }

      if (signal.aborted) return respondError(failure(504, {}, 15));
      let result: CmsTemplateResult<TemplateVersionResource>;
      try {
        result = await dependencies.defineTemplate(
          {
            operationId: OPERATION_ID,
            request,
            requestId,
            session: session.value,
            body,
            idempotencyKey: parsedHeaders.data.idempotencyKey,
            ifMatch,
          },
          signal,
        );
      } catch {
        return respondError(dependencyUnavailable());
      }
      if (!validEnvelope(result)) return respondError(invalidDependency());
      if (!result.ok) return respondError(result);
      if (!validDraft(result.value, body))
        return respondError(invalidDependency());
      const headers = commonHeaders(request, dependencies, requestId);
      headers.set('content-type', 'application/json; charset=UTF-8');
      headers.set('etag', `"${result.value.version}"`);
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
      /* Telemetry cannot change an already decided response. */
    }
    return response;
  });
};
