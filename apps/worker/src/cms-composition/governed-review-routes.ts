import {
  createRequestId,
  GovernedReviewSubmissionHeadersSchema,
  GovernedReviewSubmissionRequestSchema,
  type GovernedReviewResource,
  type GovernedReviewSubmissionRequest,
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
import {
  failure,
  governedAdmission,
  governedResponseLimit,
  governedSession,
  validEnvelope,
  type CmsGovernedReviewDependencies,
  type GovernedError,
  type GovernedResult,
} from './governed-review-ports';
import { registerGovernedActivationRoute } from './governed-activation-routes';
import { registerGovernedCommandRoutes } from './governed-review-command-routes';
import { registerGovernedPreflights } from './governed-review-preflight';
import { noteFacts } from './observability-facts';
import { instrumentComposition } from './observability-instrument';
import { registerGovernedReadRoutes } from './governed-review-read-routes';
import { validGovernedSubmission } from './governed-review-validate';
import {
  governedErrorResponse,
  governedSuccess,
  runGovernedRoute,
} from './governed-review-response';

export const GOVERNED_REVIEWS_PATH = '/api/v1/cms/governed-reviews';
const OPERATION = 'CMS-03C-06';

/**
 * The governed-review routes: CMS-03C-06 `POST /api/v1/cms/governed-reviews` (BE03c
 * row 168) below, then the decision and assignment commands and the two safe reads.
 */
export const registerCmsGovernedReviewRoutes = <E extends Env>(
  app: Hono<E>,
  registered: CmsGovernedReviewDependencies,
): void => {
  // BE03c Observability: the request event lists only the stages the request reached.
  const dependencies = instrumentComposition(registered, {
    writes: [
      'submitReview',
      'recordDecision',
      'assignReviewer',
      'activateReview',
    ],
    reads: ['readReview', 'listReviews'],
  });
  governedResponseLimit(dependencies.maxResponseBytes);
  registerGovernedPreflights(app, dependencies);
  app.post(GOVERNED_REVIEWS_PATH, (context) => {
    const request = context.req.raw;
    const requestId = createRequestId(
      request.headers.get('x-request-id') ?? undefined,
    );
    const reject = (error: GovernedError): Response =>
      governedErrorResponse(request, dependencies, requestId, OPERATION, error);
    return runGovernedRoute(
      request,
      dependencies,
      requestId,
      OPERATION,
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
        if (new URL(request.url).search !== '') return reject(failure(400));
        const body = decodeJsonBody<GovernedReviewSubmissionRequest>(
          bytes.value,
          GovernedReviewSubmissionRequestSchema,
        );
        if (!body.ok) return reject(body);
        noteFacts(request, { subjectKind: body.value.subjectKind });
        // Header parse precedes capability and quota (BE03c 408, 1502).
        // The review names its subject by id and hash: no If-Match applies.
        const headers = GovernedReviewSubmissionHeadersSchema.safeParse({
          contentType: 'application/json',
          idempotencyKey: request.headers.get('idempotency-key') ?? undefined,
        });
        if (!headers.success || request.headers.has('if-match'))
          return reject(failure(400));
        const admission = await governedAdmission(
          dependencies,
          OPERATION,
          request,
          session.value,
          signal,
        );
        if (admission !== null) return reject(admission);
        if (signal.aborted) return reject(failure(504, {}, 15));
        let result: GovernedResult<GovernedReviewResource>;
        try {
          result = await dependencies.submitReview(
            {
              operationId: OPERATION,
              request,
              requestId,
              session: session.value,
              body: body.value,
              idempotencyKey: headers.data.idempotencyKey,
            },
            signal,
          );
        } catch {
          return reject(failure(503, {}, 15));
        }
        if (!validEnvelope<GovernedReviewResource>(result))
          return reject(failure(502));
        if (!result.ok) return reject(result);
        if (!validGovernedSubmission(result.value, body.value))
          return reject(failure(502));
        return governedSuccess(
          request,
          dependencies,
          requestId,
          OPERATION,
          result.value,
        );
      },
    );
  });
  registerGovernedCommandRoutes(app, dependencies);
  registerGovernedActivationRoute(app, dependencies);
  registerGovernedReadRoutes(app, dependencies);
};
