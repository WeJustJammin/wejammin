import {
  createRequestId,
  PatternVersionRequestSchema,
  PatternVersionHeadersSchema,
  type PatternVersionRequest,
  type PatternVersionResource,
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
  patternSession,
  patternAdmission,
  validEnvelope,
  validPatternDraft,
  patternResponseLimit,
  type CmsPatternDefinitionDependencies,
  type PatternResult,
} from './pattern-definition-ports';
import {
  patternHeaders,
  patternErrorResponse,
  patternSuccess,
  runPatternRoute,
} from './pattern-definition-response';

import { instrumentComposition } from './observability-instrument';

const PATH = '/api/v1/cms/patterns/versions';
const OPERATION = 'CMS-03C-12';

export const registerCmsPatternDefinitionRoutes = <E extends Env>(
  app: Hono<E>,
  registered: CmsPatternDefinitionDependencies,
): void => {
  // BE03c Observability: the request event lists only the stages the request reached.
  const dependencies = instrumentComposition(registered, {
    writes: ['definePattern'],
  });
  patternResponseLimit(dependencies.maxResponseBytes);
  app.options(PATH, (context) => {
    const request = context.req.raw;
    const requestId = createRequestId(
      request.headers.get('x-request-id') ?? undefined,
    );
    if (
      request.headers.get('origin') === null ||
      checkOrigin(request, dependencies.humanOrigins) !== null
    )
      return patternErrorResponse(
        request,
        dependencies,
        requestId,
        OPERATION,
        failure(403),
      );
    const headers = patternHeaders(request, dependencies, requestId);
    headers.set('access-control-allow-methods', 'POST, OPTIONS');
    headers.set(
      'access-control-allow-headers',
      'Content-Type, Idempotency-Key, If-Match, X-CSRF-Token, X-Request-Id',
    );
    return new Response(null, { status: 204, headers });
  });
  app.post(PATH, (context) => {
    const request = context.req.raw;
    const requestId = createRequestId(
      request.headers.get('x-request-id') ?? undefined,
    );
    const reject = (
      error: import('./pattern-definition-ports').PatternError,
    ): Response =>
      patternErrorResponse(request, dependencies, requestId, OPERATION, error);
    return runPatternRoute(
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
        const session = await patternSession(dependencies, request, signal);
        if (!session.ok) return reject(session);
        if (new URL(request.url).search !== '') return reject(failure(400));
        const body = decodeJsonBody<PatternVersionRequest>(
          bytes.value,
          PatternVersionRequestSchema,
        );
        if (!body.ok) return reject(body);
        // Header parse precedes capability and quota (BE03c 408, 1502).
        const headers = PatternVersionHeadersSchema.safeParse({
          contentType: 'application/json',
          idempotencyKey: request.headers.get('idempotency-key') ?? undefined,
          ifMatch: request.headers.get('if-match') ?? undefined,
        });
        if (!headers.success) return reject(failure(400));
        const ifMatch = headers.data.ifMatch?.slice(1, -1) ?? null;
        if (
          (body.value.expectedVersion === null) !== (ifMatch === null) ||
          (ifMatch !== null && ifMatch !== body.value.expectedVersion)
        )
          return reject(failure(400));
        const admission = await patternAdmission(
          dependencies,
          OPERATION,
          request,
          session.value,
          signal,
        );
        if (admission !== null) return reject(admission);
        if (signal.aborted) return reject(failure(504, {}, 15));
        let result: PatternResult<PatternVersionResource>;
        try {
          result = await dependencies.definePattern(
            {
              operationId: OPERATION,
              request,
              requestId,
              session: session.value,
              body: body.value,
              idempotencyKey: headers.data.idempotencyKey,
              ifMatch,
            },
            signal,
          );
        } catch {
          return reject(failure(503, {}, 15));
        }
        if (!validEnvelope<PatternVersionResource>(result))
          return reject(failure(502));
        if (!result.ok) return reject(result);
        if (!validPatternDraft(result.value, body.value))
          return reject(failure(502));
        return patternSuccess(
          request,
          dependencies,
          requestId,
          OPERATION,
          result.value,
        );
      },
    );
  });
};
