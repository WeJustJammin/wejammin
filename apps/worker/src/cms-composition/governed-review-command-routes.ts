import {
  CmsUuidSchema,
  cmsEditorialIfMatchOperand,
  createRequestId,
  GovernedDecisionHeadersSchema,
  GovernedDecisionRequestSchema,
  GovernedReviewAssignmentHeadersSchema,
  GovernedReviewAssignmentRequestSchema,
  governedAssignmentSuccessStatus,
  type GovernedDecisionRequest,
  type GovernedReviewAssignmentRequest,
  type GovernedReviewAssignmentResource,
  type GovernedReviewResource,
} from '@wejammin/contracts';
import type { Env, Hono } from 'hono';
import {
  checkOrigin,
  csrfErrorIfCookie,
} from '../cms-editorial/admission-headers';
import {
  decodeJsonBody,
  jsonBodyPreflight,
  readBytes,
} from '../cms-editorial/admission-body';
import { policyOf } from './governed-review-policy';
import { noteFacts, type RequestFacts } from './observability-facts';
import {
  failure,
  governedAdmission,
  governedSession,
  validEnvelope,
  type CmsGovernedReviewDependencies,
  type GovernedActivationFacts,
  type GovernedAssignmentInput,
  type GovernedDecisionInput,
  type GovernedError,
  type GovernedPortContext,
  type GovernedResult,
  type GovernedRouteFacts,
} from './governed-review-ports';
import {
  governedErrorResponse,
  governedSuccess,
  runGovernedRoute,
  type GovernedSuccessOptions,
} from './governed-review-response';
import {
  validGovernedAssignment,
  validGovernedDecision,
} from './governed-review-validate';

/** A strict parse of the transport headers shared by CMS-03C-07 and -08. */
type CommandHeaders = Readonly<{ idempotencyKey: string; ifMatch: string }>;
type HeaderSchema = Readonly<{
  safeParse: (
    value: unknown,
  ) => { success: true; data: CommandHeaders } | { success: false };
}>;
type BodySchema = Parameters<typeof decodeJsonBody>[1];

export type CommandSpec<
  Body extends { expectedVersion: string },
  Resource,
  Input,
> = Readonly<{
  operation: 'CMS-03C-07' | 'CMS-03C-08' | 'CMS-03C-09';
  bodySchema: BodySchema;
  headersSchema: HeaderSchema;
  /** Path and body name the same review (422 at /reviewId); the assignment body has no reviewId. */
  agree: (reviewId: string, body: Body) => boolean;
  build: (
    base: GovernedPortContext,
    reviewId: string,
    body: Body,
    headers: CommandHeaders & { ifMatchOperand: string },
  ) => Input;
  /**
   * Rules that need the admitted caller, after the gate and both quotas and before the port
   * (CMS-03C-09: the Worker Time authority). A refusal here burned the quotas, like any 422 after them.
   */
  prepare?: (
    context: Readonly<{
      dependencies: CmsGovernedReviewDependencies;
      body: Body;
      nowMs: number;
    }>,
  ) => Promise<GovernedError | null>;
  port: (
    dependencies: CmsGovernedReviewDependencies,
  ) => (input: Input, signal: AbortSignal) => Promise<GovernedResult<Resource>>;
  /**
   * The closed telemetry facts of the request (CMS-03C-09's activation metric): called with the
   * decoded body and no resource, then again with the verified resource of a success.
   */
  activation?: (
    body: Body,
    resource: Resource | null,
  ) => GovernedActivationFacts;
  /** The closed members of the decoded body a request counter is labelled with (BE03c Observability). */
  facts?: (body: Body) => Partial<Omit<RequestFacts, 'stages' | 'refusal'>>;
  /** The verified success: its status, validator and Location, or null for a 502. */
  accept: (
    resource: unknown,
    reviewId: string,
    body: Body,
  ) => (GovernedSuccessOptions & { resource: Resource }) | null;
}>;

/**
 * One governed command (BE00 order): origin, media, size and CSRF, body bytes, session,
 * no query, the path review, strict body (422), path/body agreement (422), exact
 * Idempotency-Key and strong If-Match (400), the capability gate, recent MFA, then both
 * quotas; only then the port. Header and body faults burn no quota (BE03c 408, 1502).
 */
export const registerGovernedCommand = <
  E extends Env,
  Body extends { expectedVersion: string },
  Resource,
  Input,
>(
  app: Hono<E>,
  dependencies: CmsGovernedReviewDependencies,
  spec: CommandSpec<Body, Resource, Input>,
): void => {
  const { operation } = spec;
  const path = policyOf(operation).honoPath;
  app.post(path, (context) => {
    const request = context.req.raw;
    const requestId = createRequestId(
      request.headers.get('x-request-id') ?? undefined,
    );
    const reject = (error: GovernedError): Response =>
      governedErrorResponse(request, dependencies, requestId, operation, error);
    const facts: GovernedRouteFacts = {};
    return runGovernedRoute(
      request,
      dependencies,
      requestId,
      operation,
      async (signal) => {
        const preflight =
          checkOrigin(request, dependencies.humanOrigins) ??
          jsonBodyPreflight(request) ??
          csrfErrorIfCookie(request);
        if (preflight !== null) return reject(preflight);
        const bytes = await readBytes(request, signal);
        if (!bytes.ok) return reject(bytes);
        const session = await governedSession(dependencies, request, signal);
        if (!session.ok) return reject(session);
        const reviewId = CmsUuidSchema.safeParse(context.req.param('reviewId'));
        if (new URL(request.url).search !== '' || !reviewId.success)
          return reject(failure(400));
        const body = decodeJsonBody<Body>(bytes.value, spec.bodySchema);
        if (!body.ok) return reject(body);
        if (spec.activation !== undefined)
          facts.activation = spec.activation(body.value, null);
        if (spec.facts !== undefined)
          noteFacts(request, spec.facts(body.value));
        if (!spec.agree(reviewId.data, body.value))
          return reject(
            failure(422, {
              violations: [{ path: '/reviewId', code: 'mismatch' }],
            }),
          );
        const headers = spec.headersSchema.safeParse({
          contentType: 'application/json',
          idempotencyKey: request.headers.get('idempotency-key') ?? undefined,
          ifMatch: request.headers.get('if-match') ?? undefined,
        });
        const operand = headers.success
          ? cmsEditorialIfMatchOperand(headers.data.ifMatch)
          : null;
        if (!headers.success || operand !== body.value.expectedVersion)
          return reject(failure(400));
        const admission = await governedAdmission(
          dependencies,
          operation,
          request,
          session.value,
          signal,
        );
        if (admission !== null) return reject(admission);
        const prepared = await spec.prepare?.({
          dependencies,
          body: body.value,
          nowMs: dependencies.now(),
        });
        if (prepared !== null && prepared !== undefined)
          return reject(prepared);
        if (signal.aborted) return reject(failure(504, {}, 15));
        let result: GovernedResult<Resource>;
        try {
          result = await spec.port(dependencies)(
            spec.build(
              { request, requestId, session: session.value },
              reviewId.data,
              body.value,
              { ...headers.data, ifMatchOperand: operand as string },
            ),
            signal,
          );
        } catch {
          return reject(failure(503, {}, 15));
        }
        if (!validEnvelope<Resource>(result)) return reject(failure(502));
        if (!result.ok) return reject(result);
        const accepted = spec.accept(result.value, reviewId.data, body.value);
        if (accepted === null) return reject(failure(502));
        if (spec.activation !== undefined)
          facts.activation = spec.activation(body.value, accepted.resource);
        return governedSuccess(
          request,
          dependencies,
          requestId,
          operation,
          accepted.resource as { version: string },
          accepted,
        );
      },
      facts,
    );
  });
};

/** CMS-03C-07 and CMS-03C-08 (BE03c rows 169, 170). */
export const registerGovernedCommandRoutes = <E extends Env>(
  app: Hono<E>,
  dependencies: CmsGovernedReviewDependencies,
): void => {
  registerGovernedCommand<
    E,
    GovernedDecisionRequest,
    GovernedReviewResource,
    GovernedDecisionInput
  >(app, dependencies, {
    operation: 'CMS-03C-07',
    bodySchema: GovernedDecisionRequestSchema,
    headersSchema: GovernedDecisionHeadersSchema,
    agree: (reviewId, body) =>
      reviewId.toLowerCase() === body.reviewId.toLowerCase(),
    port: (deps) => deps.recordDecision,
    facts: (body) => ({ decision: body.decision }),
    build: (base, reviewId, body, headers) => ({
      ...base,
      operationId: 'CMS-03C-07',
      reviewId,
      body,
      idempotencyKey: headers.idempotencyKey,
      ifMatch: headers.ifMatchOperand,
    }),
    accept: (resource, reviewId, body) =>
      validGovernedDecision(resource, reviewId, body)
        ? { resource, status: 200, etag: resource.version }
        : null,
  });
  registerGovernedCommand<
    E,
    GovernedReviewAssignmentRequest,
    GovernedReviewAssignmentResource,
    GovernedAssignmentInput
  >(app, dependencies, {
    operation: 'CMS-03C-08',
    bodySchema: GovernedReviewAssignmentRequestSchema,
    headersSchema: GovernedReviewAssignmentHeadersSchema,
    agree: () => true,
    port: (deps) => deps.assignReviewer,
    build: (base, reviewId, body, headers) => ({
      ...base,
      operationId: 'CMS-03C-08',
      reviewId,
      body,
      idempotencyKey: headers.idempotencyKey,
      ifMatch: headers.ifMatchOperand,
    }),
    accept: (resource, reviewId, body) =>
      validGovernedAssignment(resource, reviewId, body)
        ? {
            resource,
            status: governedAssignmentSuccessStatus(body.action),
            // BE03c row 176 defines no Location and AC-272 keeps every assignment id out of a URL (DEC-239).
            etag: resource.version,
          }
        : null,
  });
};
