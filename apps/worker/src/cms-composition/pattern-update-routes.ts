import {
  CompositionUpdateHeadersSchema,
  CompositionUpdateRequestSchema,
  createRequestId,
  type CompositionUpdateRequest,
} from '@wejammin/contracts';
import type { Env, Hono } from 'hono';

import {
  decodeJsonBody,
  jsonBodyPreflight,
  readBytes,
} from '../cms-editorial/admission-body';
import {
  checkOrigin,
  csrfErrorIfCookie,
} from '../cms-editorial/admission-headers';
import { registerCmsCompositionInstancesRoute } from './composition-instances-routes';
import { registerCmsPatternUpdateDiffRoute } from './pattern-update-diff-routes';
import { validUpdateResource } from './pattern-update-answers';
import {
  failure,
  patternUpdateAdmission,
  patternUpdateSession,
  validUpdateOutcome,
  type CmsPatternUpdateDependencies,
  type PatternUpdateError,
  type PatternUpdateOutcome,
} from './pattern-update-ports';
import {
  patternUpdateError,
  patternUpdatePreflight,
  patternUpdateSuccess,
  runPatternUpdateRoute,
} from './pattern-update-response';
import { noteFacts } from './observability-facts';
import { instrumentComposition } from './observability-instrument';
import { registerCmsPatternSelectorRoute } from './pattern-selector-routes';

const PATH = '/api/v1/cms/compositions/pattern-updates';
const OPERATION = 'CMS-03C-15';

/**
 * CMS-03C-15 `POST /api/v1/cms/compositions/pattern-updates` (BE03c 177, 215, 400): accept the latest active compatible
 * pattern version for, or detach, 1-32 linked instances, all-or-nothing, under the Idempotency-Key and a strong
 * `If-Match` equal to the entry aggregate version (each instance also carries its own `expectedVersion`). The BE00
 * order is the placement's: origin, body ceiling and media, session-bound CSRF, bytes, verified session, empty query,
 * strict body, headers (before authorization, so a malformed key consumes no quota), capability, quota, port. The 200
 * body is exactly `{ items }` and the response ETag is the committed entry version.
 */
export const registerCmsPatternUpdateCommandRoute = <E extends Env>(
  app: Hono<E>,
  dependencies: CmsPatternUpdateDependencies,
): void => {
  const requestIdOf = (request: Request): string =>
    createRequestId(request.headers.get('x-request-id') ?? undefined);
  app.options(PATH, (context) =>
    patternUpdatePreflight(
      context.req.raw,
      dependencies,
      requestIdOf(context.req.raw),
      OPERATION,
      'Content-Type, Idempotency-Key, If-Match, X-CSRF-Token, X-Request-Id',
    ),
  );
  app.post(PATH, (context) => {
    const request = context.req.raw;
    const requestId = requestIdOf(request);
    const refuse = (error: PatternUpdateError): Response =>
      patternUpdateError(request, dependencies, requestId, OPERATION, error);
    return runPatternUpdateRoute(
      request,
      dependencies,
      requestId,
      OPERATION,
      async (signal) => {
        const early =
          checkOrigin(request, dependencies.humanOrigins) ??
          jsonBodyPreflight(request) ??
          csrfErrorIfCookie(request);
        if (early !== null) return refuse(early);
        const bytes = await readBytes(request, signal);
        if (!bytes.ok) return refuse(bytes);
        const session = await patternUpdateSession(
          dependencies,
          request,
          signal,
        );
        if (!session.ok) return refuse(session);
        if (new URL(request.url).search !== '') return refuse(failure(400));
        const parsed = decodeJsonBody<CompositionUpdateRequest>(
          bytes.value,
          CompositionUpdateRequestSchema,
        );
        if (!parsed.ok) return refuse(parsed);
        const body = parsed.value;
        noteFacts(request, { updateAction: body.action });
        // BE00 386 and BE03c 408: the key and the strong If-Match are validated before authorization.
        const headers = CompositionUpdateHeadersSchema.safeParse({
          contentType: 'application/json',
          idempotencyKey: request.headers.get('idempotency-key') ?? undefined,
          ifMatch: request.headers.get('if-match') ?? undefined,
        });
        if (!headers.success) return refuse(failure(400));
        const ifMatch = headers.data.ifMatch.slice(1, -1);
        if (body.expectedVersion !== ifMatch) return refuse(failure(400));
        const admission = await patternUpdateAdmission(
          dependencies,
          OPERATION,
          request,
          session.value,
          signal,
        );
        if (admission !== null) return refuse(admission);
        let outcome: PatternUpdateOutcome;
        try {
          outcome = await dependencies.applyUpdate(
            {
              operationId: OPERATION,
              request,
              requestId,
              session: session.value,
              body,
              idempotencyKey: headers.data.idempotencyKey,
              ifMatch,
            },
            signal,
          );
        } catch {
          return refuse(failure(503, {}, 15));
        }
        if (!validUpdateOutcome(outcome)) return refuse(failure(502));
        if (!outcome.ok) return refuse(outcome);
        if (!validUpdateResource(outcome.value, outcome.etag, body))
          return refuse(failure(502));
        return patternUpdateSuccess(
          request,
          dependencies,
          requestId,
          outcome.value,
          outcome.etag,
        );
      },
    );
  });
};

/** The three linked-update routes and the composition-instance list read (DEC-206). The selector is registered first so `selector` never reaches `:patternKey`. */
export const registerCmsPatternUpdateRoutes = <E extends Env>(
  app: Hono<E>,
  registered: CmsPatternUpdateDependencies,
): void => {
  // BE03c Observability: the request event lists only the stages the request reached.
  const dependencies = instrumentComposition(registered, {
    writes: ['applyUpdate'],
    reads: ['readSelector', 'readUpdateDiff', 'readInstances'],
  });
  registerCmsPatternSelectorRoute(app, dependencies);
  registerCmsPatternUpdateDiffRoute(app, dependencies);
  registerCmsCompositionInstancesRoute(app, dependencies);
  registerCmsPatternUpdateCommandRoute(app, dependencies);
};
