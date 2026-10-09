import { createRequestId } from '@wejammin/contracts';
import type { Env, Hono } from 'hono';

import { decodeJsonBody, jsonBodyPreflight, readBytes } from './admission-body';
import {
  rejectCommandQuery,
  type Result,
  type UnknownSchema,
} from './admission-common';
import {
  createRouteDeadline,
  dependencyUnavailable,
} from './admission-deadline';
import {
  checkOrigin,
  csrfErrorIfCookie,
  parseEditorialHeaders,
} from './admission-headers';
import { validHumanSession } from './admission-identity';
import { rateCheck } from './route-execution';
import { commonHeaders, errorResponse, publishedError } from './route-errors';
import { createRouteFinish, entryFacts } from './route-telemetry';
import {
  expectedVersionDisagreement,
  registerPreflight,
  requireFreshStepUp,
  requireWorkflowCapability,
} from './workflow-admission';
import {
  BAD_GATEWAY,
  parsedResource,
  type RegistryRoute,
} from './workflow-support';
import type { WorkflowLabels } from './workflow-telemetry';
import type {
  CmsEditorialDependencies,
  CmsEditorialError,
  CmsEditorialPorts,
  CmsEditorialResult,
  CmsEditorialSession,
} from './types';

/**
 * The shared pipeline of a Slice 11 browser command (BE00 middleware order):
 * origin, media and size, CSRF, body bytes, session, strict query/path/body,
 * capability gate, step-up (E6), quota, then the exact Idempotency-Key and
 * strong If-Match. A refusal at any step is the whole response and the port is
 * never reached. Each operation supplies only what differs: its path binding,
 * cross-checks, optional pre-RPC stage, port and response invariants.
 */

type Headers_ = Parameters<typeof parseEditorialHeaders>[1];

/** What a command shares in the input it hands its port. */
export type WorkflowBaseInput = Readonly<{
  requestId: string;
  request: Request;
  session: CmsEditorialSession;
  idempotencyKey: string;
  ifMatch: string;
}>;

/** What the pre-RPC stage may use; it never sees a raw browser member. */
export type WorkflowPrepareContext<Path, Body> = Readonly<{
  dependencies: CmsEditorialDependencies;
  request: Request;
  requestId: string;
  session: CmsEditorialSession;
  path: Path;
  body: Body;
  /** The server clock of this request, in epoch milliseconds. */
  nowMs: number;
  withinDeadline: <T>(
    invoke: (signal: AbortSignal) => Promise<CmsEditorialResult<T>>,
  ) => Promise<CmsEditorialResult<T>>;
}>;

/** The verified success: status, validators and the facts telemetry may log. */
export type WorkflowAcceptance = Readonly<{
  status: 200 | 201 | 202;
  etag: string | null;
  location: string | null;
  /** The entry the response is about; only its hash reaches telemetry. */
  entryId: string | null;
  labels?: WorkflowLabels;
}>;

export type WorkflowCommandSpec<
  Path extends object,
  Body extends object,
  Resource,
  Input,
  Prepared,
> = Readonly<{
  policy: RegistryRoute;
  honoPath: string;
  bodySchema: UnknownSchema;
  headersSchema: Headers_;
  path: (param: (name: string) => string | undefined) => Result<Path>;
  /** Path/body agreement; a disagreement is 422 at the named pointer. */
  agree: (path: Path, body: Body) => CmsEditorialError | null;
  /** The body member that must equal the If-Match operand, when it has one. */
  expectedVersion?: (body: Body) => string;
  port: (
    ports: CmsEditorialPorts,
  ) =>
    | ((
        input: Input,
        signal: AbortSignal,
      ) => Promise<CmsEditorialResult<Resource>>)
    | undefined;
  prepare: (
    context: WorkflowPrepareContext<Path, Body>,
  ) => Promise<CmsEditorialResult<Prepared>>;
  build: (
    base: WorkflowBaseInput,
    path: Path,
    body: Body,
    prepared: Prepared,
  ) => Input;
  resourceSchema: UnknownSchema;
  accept: (
    resource: Resource,
    path: Path,
    body: Body,
  ) => WorkflowAcceptance | null;
  labels?: (body: Body) => WorkflowLabels;
}>;

const ALLOW_HEADERS =
  'Content-Type, Idempotency-Key, If-Match, X-CSRF-Token, X-Request-Id';

/** Register one Slice 11 browser command and its CORS preflight. */
export const registerWorkflowCommand = <
  E extends Env,
  Path extends object,
  Body extends object,
  Resource,
  Input,
  Prepared,
>(
  app: Hono<E>,
  dependencies: CmsEditorialDependencies,
  spec: WorkflowCommandSpec<Path, Body, Resource, Input, Prepared>,
): void => {
  const { policy } = spec;
  registerPreflight(app, dependencies, spec.honoPath, policy, ALLOW_HEADERS);

  app.post(spec.honoPath, async (context) => {
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
    let labels: WorkflowLabels = {};
    const fail = (error: CmsEditorialError, headers?: Headers) =>
      finish(
        errorResponse(request, dependencies, requestId, error, headers, policy),
        { error: publishedError(error, policy), labels },
      );

    // The CORS origin and CSRF refusals are middleware, not operation errors:
    // they publish the BE00 403 on every row, declared or not.
    const refuseMiddleware = (error: CmsEditorialError) =>
      finish(errorResponse(request, dependencies, requestId, error), {
        error: publishedError(error),
      });

    // BE00 step 2: CORS origin, body ceiling, content type, session-bound CSRF.
    const originError = checkOrigin(request, dependencies.humanOrigins);
    if (originError !== null) return refuseMiddleware(originError);
    const preflight = jsonBodyPreflight(request);
    if (preflight !== null) return fail(preflight);
    const csrfError = csrfErrorIfCookie(request);
    if (csrfError !== null) return refuseMiddleware(csrfError);
    const bytes = await withinDeadline((signal) => readBytes(request, signal));
    if (!bytes.ok) return fail(bytes);
    // BE00 steps 4 and 5: verified session, then acting context.
    const identity = await withinDeadline((signal) =>
      dependencies.resolveSession(request, signal),
    );
    if (!identity.ok) return fail(identity);
    const invalidSession = validHumanSession(identity.value);
    if (invalidSession !== null) return fail(invalidSession);
    // BE00 step 6: strict query, path and body.
    const queryError = rejectCommandQuery(request);
    if (queryError !== null) return fail(queryError);
    const path = spec.path((name) => context.req.param(name));
    if (!path.ok) return fail(path);
    const body = decodeJsonBody<Body>(bytes.value, spec.bodySchema);
    if (!body.ok) return fail(body);
    labels = spec.labels?.(body.value) ?? {};
    const disagreement = spec.agree(path.value, body.value);
    if (disagreement !== null) return fail(disagreement);
    // BE00 step 7: capability, recent MFA (E6), then quota.
    const capabilityError = requireWorkflowCapability(identity.value, policy);
    if (capabilityError !== null) return fail(capabilityError);
    const stepUpError = requireFreshStepUp(identity.value, policy);
    if (stepUpError !== null) return fail(stepUpError);
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
    const headers = parseEditorialHeaders(request, spec.headersSchema);
    if (!headers.ok) return fail(headers);
    const versionError = expectedVersionDisagreement(
      spec.expectedVersion?.(body.value),
      headers.value.ifMatch,
    );
    if (versionError !== null) return fail(versionError);

    const port = spec.port(dependencies.ports);
    if (typeof port !== 'function') return fail(dependencyUnavailable());
    const prepared = await spec.prepare({
      dependencies,
      request,
      requestId,
      session: identity.value,
      path: path.value,
      body: body.value,
      nowMs: dependencies.now?.() ?? Date.now(),
      withinDeadline,
    });
    if (!prepared.ok) return fail(prepared);
    const input = spec.build(
      {
        requestId,
        request,
        session: identity.value,
        idempotencyKey: headers.value.idempotencyKey,
        ifMatch: headers.value.ifMatch,
      },
      path.value,
      body.value,
      prepared.value,
    );
    const result = await withinDeadline((signal) => port(input, signal));
    if (!result.ok) return fail(result);
    const resource = parsedResource<Resource>(
      spec.resourceSchema,
      result.value,
    );
    const accepted =
      resource === null ? null : spec.accept(resource, path.value, body.value);
    if (accepted === null) return fail(BAD_GATEWAY);
    const responseHeaders = commonHeaders(request, dependencies, requestId);
    responseHeaders.set('content-type', 'application/json; charset=UTF-8');
    if (accepted.etag !== null) responseHeaders.set('etag', accepted.etag);
    if (accepted.location !== null)
      responseHeaders.set('location', accepted.location);
    return finish(
      new Response(JSON.stringify(resource), {
        status: accepted.status,
        headers: responseHeaders,
      }),
      {
        ...(accepted.entryId === null
          ? {}
          : { entry: await entryFacts(accepted.entryId) }),
        labels: { ...labels, ...accepted.labels },
        replayed: result.replayed === true,
      },
    );
  });
};
