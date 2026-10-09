import { createRequestId } from '@wejammin/contracts';
import type { Env, Hono } from 'hono';

import {
  invalid,
  unsupportedMediaType,
  type Result,
  type UnknownSchema,
} from './admission-common';
import {
  createRouteDeadline,
  dependencyUnavailable,
} from './admission-deadline';
import { checkOrigin } from './admission-headers';
import { validHumanSession } from './admission-identity';
import { rateCheck } from './route-execution';
import { commonHeaders, errorResponse, publishedError } from './route-errors';
import { createRouteFinish, entryFacts } from './route-telemetry';
import { registerPreflight } from './workflow-admission';
import type { WorkflowPrepareContext } from './workflow-command';
import {
  BAD_GATEWAY,
  parsedResource,
  type RegistryRoute,
} from './workflow-support';
import type { WorkflowPreflightFact } from './workflow-telemetry';
import type {
  CmsEditorialDependencies,
  CmsEditorialError,
  CmsEditorialPorts,
  CmsEditorialResult,
  CmsEditorialSession,
} from './types';

/**
 * The shared pipeline of a Slice 11 safe read (BE00 middleware order): origin,
 * request media, session, strict path, headers and body absence, strict query,
 * quota, then the port. Every Slice 11 read row declares `gate: 'rpc_scope'`
 * (the database resolves the full read scope and answers 403/404 itself), so
 * the Worker applies no coarse capability gate; a registry test pins that.
 * A read is no-store and mutation-free and carries a strong validator.
 */

/** What a read shares in the input it hands its port. */
export type WorkflowReadBaseInput = Readonly<{
  requestId: string;
  request: Request;
  session: CmsEditorialSession;
}>;

/** The verified success of a read: its validator and the safe facts to log. */
export type WorkflowReadAcceptance = Readonly<{
  etag: string;
  entryId: string | null;
  counts: Readonly<Record<string, number>>;
  preflight?: readonly WorkflowPreflightFact[];
}>;

export type WorkflowReadSpec<
  Path extends object,
  Query extends object,
  Resource,
  Input,
  Prepared,
> = Readonly<{
  policy: RegistryRoute;
  honoPath: string;
  path: (param: (name: string) => string | undefined) => Result<Path>;
  query: (request: Request, path: Path) => Result<Query>;
  port: (
    ports: CmsEditorialPorts,
  ) =>
    | ((
        input: Input,
        signal: AbortSignal,
      ) => Promise<CmsEditorialResult<Resource>>)
    | undefined;
  /** The pre-RPC stage; `context.body` is the validated query. */
  prepare: (
    context: WorkflowPrepareContext<Path, Query>,
  ) => Promise<CmsEditorialResult<Prepared>>;
  build: (
    base: WorkflowReadBaseInput,
    path: Path,
    query: Query,
    prepared: Prepared,
  ) => Input;
  resourceSchema: UnknownSchema;
  accept: (
    resource: Resource,
    path: Path,
    query: Query,
    session: CmsEditorialSession,
  ) => Promise<WorkflowReadAcceptance | null>;
}>;

/** BE00 step 2: a read accepts no request media, so the allowlist is empty. */
const readMediaError = (request: Request): CmsEditorialError | null =>
  request.headers.has('content-type') ? unsupportedMediaType([]) : null;

/** A read takes neither an Idempotency-Key, an If-Match nor a body. */
const readHeadersError = (request: Request): CmsEditorialError | null => {
  if (request.headers.has('idempotency-key') || request.headers.has('if-match'))
    return invalid('The read request headers are invalid.');
  const contentLength = request.headers.get('content-length');
  if (
    request.body !== null ||
    request.headers.has('transfer-encoding') ||
    (contentLength !== null && contentLength !== '0')
  )
    return invalid('A read has no request body.');
  return null;
};

/** Register one Slice 11 safe read and its CORS preflight. */
export const registerWorkflowRead = <
  E extends Env,
  Path extends object,
  Query extends object,
  Resource,
  Input,
  Prepared,
>(
  app: Hono<E>,
  dependencies: CmsEditorialDependencies,
  spec: WorkflowReadSpec<Path, Query, Resource, Input, Prepared>,
): void => {
  const { policy } = spec;
  registerPreflight(
    app,
    dependencies,
    spec.honoPath,
    policy,
    'Authorization, X-Request-Id',
  );

  app.get(spec.honoPath, async (context) => {
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

    // BE00 step 2: CORS origin (middleware: the BE00 403 on every row) and media.
    const originError = checkOrigin(request, dependencies.humanOrigins);
    if (originError !== null)
      return finish(
        errorResponse(request, dependencies, requestId, originError),
        {
          error: publishedError(originError),
        },
      );
    const mediaError = readMediaError(request);
    if (mediaError !== null) return fail(mediaError);
    // BE00 steps 4 and 5: verified session, then acting context.
    const identity = await withinDeadline((signal) =>
      dependencies.resolveSession(request, signal),
    );
    if (!identity.ok) return fail(identity);
    const invalidSession = validHumanSession(identity.value);
    if (invalidSession !== null) return fail(invalidSession);
    // BE00 step 6: strict path, headers and body absence, then query.
    const path = spec.path((name) => context.req.param(name));
    if (!path.ok) return fail(path);
    const headersError = readHeadersError(request);
    if (headersError !== null) return fail(headersError);
    const query = spec.query(request, path.value);
    if (!query.ok) return fail(query);
    // BE00 step 7: quota (the read scope itself is the RPC's).
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

    const port = spec.port(dependencies.ports);
    if (typeof port !== 'function') return fail(dependencyUnavailable());
    const prepared = await spec.prepare({
      dependencies,
      request,
      requestId,
      session: identity.value,
      path: path.value,
      body: query.value,
      nowMs: dependencies.now?.() ?? Date.now(),
      withinDeadline,
    });
    if (!prepared.ok) return fail(prepared);
    const input = spec.build(
      { requestId, request, session: identity.value },
      path.value,
      query.value,
      prepared.value,
    );
    const result = await withinDeadline((signal) => port(input, signal));
    if (!result.ok) return fail(result);
    const resource = parsedResource<Resource>(
      spec.resourceSchema,
      result.value,
    );
    const accepted =
      resource === null
        ? null
        : await spec.accept(resource, path.value, query.value, identity.value);
    if (accepted === null) return fail(BAD_GATEWAY);
    const headers = commonHeaders(request, dependencies, requestId);
    headers.set('content-type', 'application/json; charset=UTF-8');
    headers.set('etag', accepted.etag);
    return finish(
      new Response(JSON.stringify(resource), { status: 200, headers }),
      {
        counts: accepted.counts,
        ...(accepted.entryId === null
          ? {}
          : { entry: await entryFacts(accepted.entryId) }),
        ...(accepted.preflight === undefined
          ? {}
          : { preflight: accepted.preflight }),
      },
    );
  });
};
