import {
  EntryCreateHeadersSchema,
  EntryCreateRequestSchema,
  EntryCreateResourceSchema,
  cmsEditorialRoutePolicies,
  createRequestId,
} from '@wejammin/contracts';
import { Hono, type Env } from 'hono';

import { decodeJsonBody, jsonBodyPreflight, readBytes } from './admission-body';
import { invalid, issues, rejectCommandQuery } from './admission-common';
import {
  dependencyUnavailable,
  createRouteDeadline,
} from './admission-deadline';
import { checkOrigin, csrfErrorIfCookie } from './admission-headers';
import {
  requireEditorialCapability,
  validHumanSession,
} from './admission-identity';
import { rateCheck } from './route-execution';
import { createRouteFinish, entryFacts } from './route-telemetry';
import { commonHeaders, errorResponse, publishedError } from './routes';
import {
  CMS_EDITORIAL_CREATE_OPERATION_ID,
  type CmsEditorialCreatePortInput,
  type CmsEditorialDependencies,
  type CmsEditorialError,
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
    const { deadlineAt, withinDeadline } = createRouteDeadline(
      request,
      dependencies.deadlineMs,
      policy.timeoutMs,
    );
    const startedAt = dependencies.now?.() ?? Date.now();
    const finish = createRouteFinish(
      dependencies,
      request,
      requestId,
      policy,
      startedAt,
    );
    const fail = (error: CmsEditorialError, headers?: Headers) =>
      finish(errorResponse(request, dependencies, requestId, error, headers), {
        error: publishedError(error),
      });

    // BE00 step 2: CORS origin, body ceiling, content type, session-bound CSRF.
    const originError = checkOrigin(request, dependencies.humanOrigins);
    if (originError !== null) return fail(originError);
    const preflight = jsonBodyPreflight(request);
    if (preflight !== null) return fail(preflight);
    const csrfError = csrfErrorIfCookie(request);
    if (csrfError !== null) return fail(csrfError);
    const bytes = await withinDeadline((signal) => readBytes(request, signal));
    if (!bytes.ok) return fail(bytes);
    // BE00 steps 4 and 5: verified session, then acting context.
    const identity = await withinDeadline((signal) =>
      dependencies.resolveSession(request, signal),
    );
    if (!identity.ok) return fail(identity);
    const invalidSession = validHumanSession(identity.value);
    if (invalidSession !== null) return fail(invalidSession);
    // BE00 step 6: strict query and body.
    const queryError = rejectCommandQuery(request);
    if (queryError !== null) return fail(queryError);
    const body = decodeJsonBody<
      ReturnType<typeof EntryCreateRequestSchema.parse>
    >(bytes.value, EntryCreateRequestSchema);
    if (!body.ok) return fail(body);
    // BE00 step 7: capability, then quota.
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
    // BE00 step 8: exact Idempotency-Key; creation names no existing version.
    if (request.headers.has('if-match'))
      return fail(invalid('Initial entry creation has no If-Match header.'));
    const parsedHeaders = EntryCreateHeadersSchema.safeParse({
      contentType: 'application/json',
      idempotencyKey: request.headers.get('idempotency-key') ?? undefined,
    });
    if (!parsedHeaders.success)
      return fail(
        invalid(
          'The request headers are invalid.',
          issues(parsedHeaders.error),
        ),
      );

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
      {
        counts: { changed_paths: body.value.changedPaths.length },
        entry: await entryFacts(
          parsed.data.entry.id,
          parsed.data.entry.version,
        ),
        replayed: result.replayed === true,
      },
    );
  });
};
