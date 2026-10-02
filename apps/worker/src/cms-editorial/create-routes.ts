import {
  EntryCreateHeadersSchema,
  EntryCreateRequestSchema,
  EntryCreateResourceSchema,
  cmsEditorialRoutePolicies,
  createRequestId,
} from '@wejammin/contracts';
import { Hono, type Env } from 'hono';

import { parseJsonBody } from './admission-body';
import { invalid, issues, rejectCommandQuery } from './admission-common';
import {
  dependencyDeadline,
  dependencyTimedOut,
  dependencyUnavailable,
} from './admission-deadline';
import { checkOrigin, csrfErrorIfCookie } from './admission-headers';
import {
  requireEditorialCapability,
  validHumanSession,
} from './admission-identity';
import { emitTelemetry, rateCheck } from './route-execution';
import { commonHeaders, errorResponse } from './routes';
import {
  CMS_EDITORIAL_CREATE_OPERATION_ID,
  CMS_EDITORIAL_RUNBOOK,
  type CmsEditorialCreatePortInput,
  type CmsEditorialDependencies,
  type CmsEditorialError,
  type CmsEditorialResult,
} from './types';

const PATH = '/api/v1/cms/entries';
const policy = cmsEditorialRoutePolicies.find(
  (item) => item.operationId === CMS_EDITORIAL_CREATE_OPERATION_ID,
) as (typeof cmsEditorialRoutePolicies)[number];

/** Initial create has an idempotency key, but no previous version to match. */
export const registerCmsEditorialCreateRoutes = <E extends Env>(
  app: Hono<E>,
  dependencies: CmsEditorialDependencies,
): void => {
  app.options(PATH, (context) => {
    const request = context.req.raw;
    const requestId = createRequestId(
      request.headers.get('x-request-id') ?? undefined,
    );
    const originError = checkOrigin(request, dependencies.humanOrigins);
    if (originError !== null || request.headers.get('origin') === null)
      return errorResponse(
        request,
        dependencies,
        requestId,
        originError ?? {
          ok: false,
          status: 403,
          code: 'FORBIDDEN',
          message: 'A request origin is required.',
        },
      );
    const headers = commonHeaders(request, dependencies, requestId);
    headers.set('access-control-allow-methods', 'POST, OPTIONS');
    headers.set(
      'access-control-allow-headers',
      'Content-Type, Idempotency-Key, X-CSRF-Token, X-Request-Id',
    );
    return new Response(null, { status: 204, headers });
  });

  app.post(PATH, async (context) => {
    const request = context.req.raw;
    const requestId = createRequestId(
      request.headers.get('x-request-id') ?? undefined,
    );
    const deadlineAt =
      performance.now() + (dependencies.deadlineMs ?? policy.timeoutMs);
    const withinDeadline = <T>(
      invoke: (signal: AbortSignal) => Promise<CmsEditorialResult<T>>,
    ): Promise<CmsEditorialResult<T>> => {
      const remainingMs = Math.ceil(deadlineAt - performance.now());
      return remainingMs <= 0
        ? Promise.resolve(dependencyTimedOut())
        : dependencyDeadline(invoke, remainingMs);
    };
    const startedAt = dependencies.now?.() ?? Date.now();
    const finish = async (response: Response): Promise<Response> => {
      void emitTelemetry(dependencies, {
        operationId: CMS_EDITORIAL_CREATE_OPERATION_ID,
        requestId,
        outcome:
          response.status < 400
            ? 'success'
            : response.status < 500
              ? 'rejected'
              : 'failure',
        status: response.status,
        durationMs: Math.max(
          0,
          (dependencies.now?.() ?? Date.now()) - startedAt,
        ),
        actorClass: 'human',
        runbook: CMS_EDITORIAL_RUNBOOK,
      });
      return response;
    };
    const fail = (error: CmsEditorialError, headers?: Headers) =>
      finish(errorResponse(request, dependencies, requestId, error, headers));

    const originError = checkOrigin(request, dependencies.humanOrigins);
    if (originError !== null) return fail(originError);
    const queryError = rejectCommandQuery(request);
    if (queryError !== null) return fail(queryError);
    if (request.headers.has('if-match'))
      return fail(invalid('Initial entry creation has no If-Match header.'));
    const media = request.headers.get('content-type')?.split(';')[0]?.trim();
    if (media !== 'application/json')
      return fail(invalid('Use application/json.', {}, 415));
    const parsedHeaders = EntryCreateHeadersSchema.safeParse({
      contentType: media,
      idempotencyKey: request.headers.get('idempotency-key') ?? undefined,
    });
    if (!parsedHeaders.success)
      return fail(
        invalid(
          'The request headers are invalid.',
          issues(parsedHeaders.error),
        ),
      );
    const csrfError = csrfErrorIfCookie(request);
    if (csrfError !== null) return fail(csrfError);
    const body = await withinDeadline((signal) =>
      parseJsonBody<ReturnType<typeof EntryCreateRequestSchema.parse>>(
        request,
        EntryCreateRequestSchema,
        signal,
      ),
    );
    if (!body.ok) return fail(body);

    const identity = await withinDeadline((signal) =>
      dependencies.resolveSession(request, signal),
    );
    if (!identity.ok) return fail(identity);
    const invalidSession = validHumanSession(identity.value);
    if (invalidSession !== null) return fail(invalidSession);
    const capabilityError = requireEditorialCapability(
      identity.value,
      policy.capabilities,
      policy.capabilityMode,
    );
    if (capabilityError !== null) return fail(capabilityError);
    const rate = await rateCheck(
      request,
      dependencies,
      identity.value,
      policy,
      deadlineAt,
    );
    if (!rate.ok) {
      const rateHeaders = new Headers();
      if (rate.status === 429) {
        rateHeaders.set('ratelimit-limit', String(policy.rateLimit));
        rateHeaders.set('ratelimit-remaining', '0');
      }
      return fail(rate, rateHeaders);
    }

    const createEntry = dependencies.ports.createEntry;
    if (typeof createEntry !== 'function') return fail(dependencyUnavailable());
    const input: CmsEditorialCreatePortInput = {
      operationId: CMS_EDITORIAL_CREATE_OPERATION_ID,
      requestId,
      request,
      session: identity.value,
      body: body.value,
      idempotencyKey: parsedHeaders.data.idempotencyKey,
    };
    const result = await withinDeadline((signal) => createEntry(input, signal));
    if (!result.ok) return fail(result);
    const parsed = EntryCreateResourceSchema.safeParse(result.value);
    if (
      !parsed.success ||
      parsed.data.lifecycle !== 'active' ||
      parsed.data.state !== 'draft' ||
      parsed.data.revisionNumber !== '1' ||
      parsed.data.entry.id === parsed.data.revision.id ||
      parsed.data.locale !== body.value.locale
    )
      return fail({
        ok: false,
        status: 502,
        code: 'BAD_GATEWAY',
        message: 'The CMS editorial dependency returned invalid data.',
      });
    const headers = commonHeaders(request, dependencies, requestId);
    headers.set('content-type', 'application/json; charset=UTF-8');
    headers.set('etag', `"${parsed.data.entry.version}"`);
    headers.set('location', `/api/v1/cms/entries/${parsed.data.entry.id}`);
    return finish(
      new Response(JSON.stringify(parsed.data), { status: 201, headers }),
    );
  });
};
