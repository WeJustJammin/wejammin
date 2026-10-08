import {
  EntryRevisionResourceSchema,
  RevisionRestoreVerificationSchema,
  RevisionRestoreHeadersSchema,
  RevisionRestoreRequestSchema,
  cmsEditorialRoutePolicies,
  createRequestId,
} from '@wejammin/contracts';
import { Hono, type Env } from 'hono';

import {
  decodeJsonBody,
  jsonBodyPreflight,
  parseRequestPathId,
  readBytes,
} from './admission-body';
import { invalid, rejectCommandQuery } from './admission-common';
import {
  dependencyUnavailable,
  createRouteDeadline,
} from './admission-deadline';
import {
  checkOrigin,
  csrfErrorIfCookie,
  parseEditorialHeaders,
  versionDisagreement,
} from './admission-headers';
import {
  requireEditorialCapability,
  validHumanSession,
} from './admission-identity';
import { rateCheck } from './route-execution';
import { createRouteFinish, entryFacts } from './route-telemetry';
import { commonHeaders, errorResponse, publishedError } from './routes';
import {
  CMS_EDITORIAL_RESTORE_OPERATION_ID,
  type CmsEditorialDependencies,
  type CmsEditorialError,
  type CmsEditorialRestorePortInput,
} from './types';

const PATH = '/api/v1/cms/entries/:entryId/revisions/:revisionId/restore';
const policy = cmsEditorialRoutePolicies.find(
  (item) => item.operationId === CMS_EDITORIAL_RESTORE_OPERATION_ID,
) as (typeof cmsEditorialRoutePolicies)[number];

/**
 * A restore creates a new draft only. The private persistence port must prove
 * source readability and the ordered migration chain; an absent port is 503.
 */
export const registerCmsEditorialRestoreRoutes = <E extends Env>(
  app: Hono<E>,
  dependencies: CmsEditorialDependencies,
): void => {
  app.options(PATH, (context) => {
    const request = context.req.raw;
    const requestId = createRequestId(
      request.headers.get('x-request-id') ?? undefined,
    );
    const origin = request.headers.get('origin');
    if (origin === null || !dependencies.humanOrigins.includes(origin))
      return errorResponse(request, dependencies, requestId, {
        ok: false,
        status: 403,
        code: 'FORBIDDEN',
        message: 'The request origin is not allowed.',
      });
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
    const startedAt = dependencies.now?.() ?? Date.now();
    const { deadlineAt, withinDeadline } = createRouteDeadline(
      request,
      dependencies.deadlineMs,
      policy.timeoutMs,
    );
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
    // BE00 step 6: strict query, paths and body.
    const queryError = rejectCommandQuery(request);
    if (queryError !== null) return fail(queryError);
    const entryId = parseRequestPathId(context.req.param('entryId'));
    if (!entryId.ok) return fail(entryId);
    const revisionId = parseRequestPathId(context.req.param('revisionId'));
    if (!revisionId.ok) return fail(revisionId);
    const body = decodeJsonBody<
      ReturnType<typeof RevisionRestoreRequestSchema.parse>
    >(bytes.value, RevisionRestoreRequestSchema);
    if (!body.ok) return fail(body);
    if (
      body.value.entryId !== entryId.value ||
      body.value.revisionId !== revisionId.value
    )
      return fail(
        invalid(
          'The restore path and body do not match.',
          {
            violations: [
              {
                path:
                  body.value.entryId !== entryId.value
                    ? '/entryId'
                    : '/revisionId',
                code: 'mismatch',
                message: 'The value is invalid.',
              },
            ],
          },
          422,
        ),
      );
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
    // BE00 step 8: exact Idempotency-Key and quoted If-Match.
    const headers = parseEditorialHeaders(
      request,
      RevisionRestoreHeadersSchema,
    );
    if (!headers.ok) return fail(headers);
    const disagreement = versionDisagreement(
      body.value.expectedVersion,
      headers.value.ifMatch,
    );
    if (disagreement !== null) return fail(disagreement);

    const restoreRevision = dependencies.ports.restoreRevision;
    if (typeof restoreRevision !== 'function')
      return fail(dependencyUnavailable());
    const input: CmsEditorialRestorePortInput = {
      operationId: CMS_EDITORIAL_RESTORE_OPERATION_ID,
      requestId,
      request,
      session: identity.value,
      path: { entryId: entryId.value, revisionId: revisionId.value },
      body: body.value,
      idempotencyKey: headers.value.idempotencyKey,
      ifMatch: headers.value.ifMatch,
    };
    const result = await withinDeadline((signal) =>
      restoreRevision(input, signal),
    );
    if (!result.ok) return fail(result);
    const { resource: restoredResource, restoreVerification } = result.value;
    const evidence =
      RevisionRestoreVerificationSchema.safeParse(restoreVerification);
    if (
      !evidence.success ||
      evidence.data.request.entryId !== entryId.value ||
      evidence.data.request.revisionId !== revisionId.value ||
      evidence.data.request.migrationChainId !== body.value.migrationChainId ||
      evidence.data.request.expectedVersion !== headers.value.ifMatch ||
      evidence.data.registry.migrationChainId !== body.value.migrationChainId
    )
      return fail(dependencyUnavailable());
    const parsed = EntryRevisionResourceSchema.safeParse(restoredResource);
    if (
      !parsed.success ||
      parsed.data.entryId !== entryId.value ||
      parsed.data.id === revisionId.value ||
      parsed.data.state !== 'draft' ||
      parsed.data.conflictId !== null
    )
      return fail({
        ok: false,
        status: 502,
        code: 'BAD_GATEWAY',
        message: 'The CMS editorial dependency returned invalid data.',
      });
    const responseHeaders = commonHeaders(request, dependencies, requestId);
    responseHeaders.set('content-type', 'application/json; charset=UTF-8');
    responseHeaders.set('etag', `"${parsed.data.entryVersion}"`);
    responseHeaders.set(
      'location',
      `/api/v1/cms/entries/${entryId.value}/revisions/${parsed.data.id}`,
    );
    return finish(
      new Response(JSON.stringify(parsed.data), {
        status: 201,
        headers: responseHeaders,
      }),
      {
        counts: {
          restore_edge_count:
            evidence.data.registry.chainSchemaVersionIds.length - 1,
        },
        entry: await entryFacts(entryId.value, parsed.data.entryVersion),
        replayed: result.replayed === true,
      },
    );
  });
};
