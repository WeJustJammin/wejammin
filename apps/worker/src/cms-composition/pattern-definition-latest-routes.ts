import {
  createRequestId,
  PatternLatestApiRequestSchema,
  type PatternVersionDetail,
} from '@wejammin/contracts';
import type { Env, Hono } from 'hono';
import { checkOrigin } from '../cms-editorial/admission-headers';
import {
  templateReadHeadersError,
  templateReadMediaError,
} from './template-shared';
import {
  failure,
  patternSession,
  patternAdmission,
  validEnvelope,
  validPatternDetail,
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

const PATH = '/api/v1/cms/patterns/:patternKey';
const OPERATION = 'cmsPatternLatestRead';

export const registerCmsPatternLatestRoutes = <E extends Env>(
  app: Hono<E>,
  registered: CmsPatternDefinitionDependencies,
): void => {
  // BE03c Observability: the request event lists only the stages the request reached.
  const dependencies = instrumentComposition(registered, {
    reads: ['readLatest'],
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
    if (
      !PatternLatestApiRequestSchema.safeParse({
        patternKey: context.req.param('patternKey'),
      }).success
    )
      return patternErrorResponse(
        request,
        dependencies,
        requestId,
        OPERATION,
        failure(400),
      );
    const headers = patternHeaders(request, dependencies, requestId);
    headers.set('access-control-allow-methods', 'GET, OPTIONS');
    headers.set('access-control-allow-headers', 'X-Request-Id');
    return new Response(null, { status: 204, headers });
  });
  app.get(PATH, (context) => {
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
          templateReadMediaError(request);
        if (preflight !== null) return reject(preflight);
        const session = await patternSession(dependencies, request, signal);
        if (!session.ok) return reject(session);
        const key = PatternLatestApiRequestSchema.safeParse({
          patternKey: context.req.param('patternKey'),
        });
        if (!key.success || new URL(request.url).search !== '')
          return reject(failure(400));
        const headersError = templateReadHeadersError(request);
        if (headersError !== null) return reject(headersError);
        const admission = await patternAdmission(
          dependencies,
          OPERATION,
          request,
          session.value,
          signal,
        );
        if (admission !== null) return reject(admission);
        let result: PatternResult<PatternVersionDetail>;
        try {
          result = await dependencies.readLatest(
            {
              operationId: OPERATION,
              request,
              requestId,
              session: session.value,
              patternKey: key.data.patternKey,
            },
            signal,
          );
        } catch {
          return reject(failure(503, {}, 15));
        }
        if (!validEnvelope<PatternVersionDetail>(result))
          return reject(failure(502));
        if (!result.ok) return reject(result);
        if (!validPatternDetail(result.value, key.data.patternKey))
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
