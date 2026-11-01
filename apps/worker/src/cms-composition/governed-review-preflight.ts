import { createRequestId } from '@wejammin/contracts';
import type { Env, Hono } from 'hono';

import { checkOrigin } from '../cms-editorial/admission-headers';
import {
  GOVERNED_POLICIES,
  type GovernedOperation,
  type GovernedPolicy,
} from './governed-review-policy';
import {
  failure,
  type CmsGovernedReviewDependencies,
} from './governed-review-ports';
import {
  governedErrorResponse,
  governedHeaders,
} from './governed-review-response';

const METHOD_ORDER: readonly GovernedPolicy['method'][] = ['GET', 'POST'];
const HEADER_ORDER = [
  'Authorization',
  'Content-Type',
  'Idempotency-Key',
  'If-Match',
  'X-CSRF-Token',
  'X-Request-Id',
] as const;

/** The request headers one operation's browser call may carry. */
const headersOf = (policy: GovernedPolicy): readonly string[] =>
  policy.method === 'GET'
    ? ['Authorization', 'X-Request-Id']
    : [
        'Content-Type',
        'Idempotency-Key',
        ...(policy.ifMatch ? ['If-Match'] : []),
        'X-CSRF-Token',
        'X-Request-Id',
      ];

/**
 * One `OPTIONS` handler per distinct governed path. CMS-03C-06 (POST) and CMS-03C-11 (GET) share
 * `/api/v1/cms/governed-reviews`; Hono answers a path with its first handler, so a per-operation
 * preflight would leave the second one dead. The methods and request headers are therefore the
 * union over every operation on the path (03b precedent: `cms-editorial/routes.ts:71` advertises
 * `GET, POST, OPTIONS` for its shared path). The origin refusal is middleware (BE00 step 2): its
 * 403 is published whichever operations the path serves.
 */
export const registerGovernedPreflights = <E extends Env>(
  app: Hono<E>,
  dependencies: CmsGovernedReviewDependencies,
): void => {
  const paths = new Map<string, GovernedOperation[]>();
  for (const operation of Object.keys(
    GOVERNED_POLICIES,
  ) as GovernedOperation[]) {
    const path = GOVERNED_POLICIES[operation].honoPath;
    paths.set(path, [...(paths.get(path) ?? []), operation]);
  }
  for (const [path, operations] of paths) {
    const policies = operations.map(
      (operation) => GOVERNED_POLICIES[operation],
    );
    const methods = METHOD_ORDER.filter((method) =>
      policies.some((policy) => policy.method === method),
    );
    const allowed = new Set(policies.flatMap(headersOf));
    const allowHeaders = HEADER_ORDER.filter((name) => allowed.has(name));
    const [owner] = operations as [GovernedOperation];
    app.options(path, (context) => {
      const request = context.req.raw;
      const requestId = createRequestId(
        request.headers.get('x-request-id') ?? undefined,
      );
      if (
        request.headers.get('origin') === null ||
        checkOrigin(request, dependencies.humanOrigins) !== null
      )
        return governedErrorResponse(
          request,
          dependencies,
          requestId,
          owner,
          failure(403),
          true,
        );
      const headers = governedHeaders(request, dependencies, requestId);
      headers.set(
        'access-control-allow-methods',
        [...methods, 'OPTIONS'].join(', '),
      );
      headers.set('access-control-allow-headers', allowHeaders.join(', '));
      return new Response(null, { status: 204, headers });
    });
  }
};
