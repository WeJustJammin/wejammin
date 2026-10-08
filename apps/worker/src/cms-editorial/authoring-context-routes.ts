import {
  AuthoringContextQuerySchema,
  AuthoringContextReadSchema,
  cmsEditorialRoutePolicies,
  createRequestId,
} from '@wejammin/contracts';
import { type Env, Hono } from 'hono';

import { invalid, issues, unsupportedMediaType } from './admission-common';
import {
  dependencyUnavailable,
  createRouteDeadline,
} from './admission-deadline';
import { checkOrigin } from './admission-headers';
import {
  requireEditorialCapability,
  validHumanSession,
} from './admission-identity';
import { rateCheck } from './route-execution';
import { createRouteFinish } from './route-telemetry';
import {
  commonHeaders,
  errorResponse,
  publishedError,
  sanitizeReadError,
} from './routes';
import {
  CMS_EDITORIAL_AUTHORING_CONTEXT_OPERATION_ID,
  type CmsEditorialAuthoringContextPortInput,
  type CmsEditorialDependencies,
  type CmsEditorialError,
} from './types';

const PATH = '/api/v1/cms/entries/authoring-context';
const policy = cmsEditorialRoutePolicies.find(
  (item) => item.operationId === CMS_EDITORIAL_AUTHORING_CONTEXT_OPERATION_ID,
) as (typeof cmsEditorialRoutePolicies)[number];

const QUERY_KEYS = new Set(['contentTypeVersionId']);

const queryViolation = (key: string, code = 'invalid_value') => ({
  violations: [
    {
      path: `/${key.replaceAll('~', '~0').replaceAll('/', '~1')}`,
      code,
      message: 'The value is invalid.',
    },
  ],
});

/**
 * CMS-03B-14 accepts exactly one optional active compiled version. Every other
 * selector -- schema artifact, workflow policy, approval evidence, ownership --
 * is caller-supplied authority and is refused as an unknown field.
 */
const parseContextQuery = (request: Request) => {
  const query: Record<string, unknown> = {};
  for (const [key, value] of new URL(request.url).searchParams) {
    if (!QUERY_KEYS.has(key))
      return invalid(
        'The authoring-context query is invalid.',
        queryViolation(key, 'unknown_field'),
      );
    if (Object.hasOwn(query, key))
      return invalid(
        'The authoring-context query is invalid.',
        queryViolation(key, 'duplicate_field'),
      );
    query[key] = value;
  }
  const parsed = AuthoringContextQuerySchema.safeParse(query);
  return parsed.success
    ? { ok: true as const, value: parsed.data }
    : invalid(
        'The authoring-context query failed validation.',
        issues(parsed.error),
      );
};

/** BE00 step 2: a read accepts no request media, so the allowlist is empty. */
const readMediaError = (request: Request): CmsEditorialError | null =>
  request.headers.has('content-type') ? unsupportedMediaType([]) : null;

const readHeadersError = (request: Request): CmsEditorialError | null => {
  if (request.headers.has('idempotency-key') || request.headers.has('if-match'))
    return invalid('The authoring-context request headers are invalid.');
  const contentLength = request.headers.get('content-length');
  if (
    request.body !== null ||
    request.headers.has('transfer-encoding') ||
    (contentLength !== null && contentLength !== '0')
  )
    return invalid('An authoring-context read has no request body.');
  return null;
};

/**
 * CMS-03B-14 authoring-context preparation read. The private RPC derives the
 * creatable active types and the selected compiled version from the acting
 * principal; the route never grants a registry-wide read. An inaccessible or
 * absent target schema is concealed as an empty-detail 404, and a projection
 * that omits the required preparation evidence fails closed as 502.
 */
export const registerCmsEditorialAuthoringContextRoutes = <E extends Env>(
  app: Hono<E>,
  dependencies: CmsEditorialDependencies,
): void => {
  app.get(PATH, async (context) => {
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
      finish(
        errorResponse(request, dependencies, requestId, error, headers, policy),
        { error: publishedError(error, policy) },
      );

    // BE00 step 2: CORS origin and request media.
    const originFailure = checkOrigin(request, dependencies.humanOrigins);
    if (originFailure !== null) return fail(originFailure);
    const mediaError = readMediaError(request);
    if (mediaError !== null) return fail(mediaError);
    // BE00 step 6: reject structural input before session/dependency work.
    const headersFailure = readHeadersError(request);
    if (headersFailure !== null) return fail(headersFailure);
    const query = parseContextQuery(request);
    if (!query.ok) return fail(query);
    // BE00 steps 4 and 5: verified session, then acting context.
    const identity = await withinDeadline((signal) =>
      dependencies.resolveSession(request, signal),
    );
    if (!identity.ok) return fail(identity);
    const invalidSession = validHumanSession(identity.value);
    if (invalidSession !== null) return fail(invalidSession);
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
        const limit = rate.details?.limit;
        rateHeaders.set(
          'ratelimit-limit',
          String(typeof limit === 'number' ? limit : policy.rateLimit),
        );
        rateHeaders.set('ratelimit-remaining', '0');
      }
      return fail(rate, rateHeaders);
    }

    const getAuthoringContext = dependencies.ports.getAuthoringContext;
    if (typeof getAuthoringContext !== 'function')
      return fail(dependencyUnavailable());
    const input: CmsEditorialAuthoringContextPortInput = {
      operationId: CMS_EDITORIAL_AUTHORING_CONTEXT_OPERATION_ID,
      requestId,
      request,
      session: identity.value,
      query: query.value,
    };
    const result = await withinDeadline((signal) =>
      getAuthoringContext(input, signal),
    );
    if (!result.ok) return fail(sanitizeReadError(result, policy));
    const parsed = AuthoringContextReadSchema.safeParse({
      query: query.value,
      resource: result.value,
    });
    if (!parsed.success)
      return fail({
        ok: false,
        status: 502,
        code: 'BAD_GATEWAY',
        message: 'The CMS editorial dependency returned invalid data.',
      });
    const resource = parsed.data.resource;
    const selectedVersionId = resource.selectedType?.contentTypeVersionId;
    if (
      selectedVersionId !== undefined &&
      !resource.creatableTypes.some(
        (type) => type.contentTypeVersionId === selectedVersionId,
      )
    )
      return fail({
        ok: false,
        status: 502,
        code: 'BAD_GATEWAY',
        message: 'The CMS editorial dependency returned invalid data.',
      });
    const allTypes = [
      ...resource.creatableTypes,
      ...(resource.selectedType === null ? [] : [resource.selectedType]),
    ];
    if (
      allTypes.some((type) =>
        [
          ...type.workflowPolicy.requiredCapabilities,
          ...type.activationEvidence.requiredCapabilities,
        ].includes('cms.schema_registry.read'),
      )
    )
      return fail({
        ok: false,
        status: 502,
        code: 'BAD_GATEWAY',
        message: 'The CMS editorial dependency returned invalid data.',
      });
    const body = JSON.stringify(resource);
    let digest: string;
    try {
      const hash = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(body),
      );
      digest = [...new Uint8Array(hash)]
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
    } catch {
      return fail({
        ok: false,
        status: 500,
        code: 'INTERNAL_ERROR',
        message: 'The CMS editorial response could not be prepared.',
      });
    }
    const headers = commonHeaders(request, dependencies, requestId);
    headers.set('content-type', 'application/json; charset=UTF-8');
    // Strong representation validator: SHA-256 of the exact JSON response
    // bytes (canonical JSON.stringify order after strict schema parsing).
    headers.set('etag', `"sha256:${digest}"`);
    return finish(new Response(body, { status: 200, headers }), {
      counts: { types_returned: resource.creatableTypes.length },
    });
  });
};
