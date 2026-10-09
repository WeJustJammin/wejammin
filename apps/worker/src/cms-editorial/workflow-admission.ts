import {
  cmsEditorialRouteAdmitsPrincipal,
  createRequestId,
  type CmsEditorialRoutePolicy,
} from '@wejammin/contracts';
import type { Hono, Env } from 'hono';

import { invalid } from './admission-common';
import { checkOrigin } from './admission-headers';
import { commonHeaders, errorResponse } from './route-errors';
import type {
  CmsEditorialDependencies,
  CmsEditorialError,
  CmsEditorialSession,
} from './types';

/**
 * Admission steps shared by every Slice 11 browser route. The registry row
 * (`cmsEditorialRoutePolicies`) decides each of them: nothing here restates a
 * capability, quota or status, so a row change is the only edit a policy needs.
 */

/**
 * BE03b E6: the coarse Worker gate of a `gate: 'capability'` row. A row whose
 * scope the RPC derives itself (`rpc_scope`) has no Worker gate, so a denied
 * caller there is answered 403/404 by the database.
 */
export const requireWorkflowCapability = (
  session: CmsEditorialSession,
  policy: CmsEditorialRoutePolicy,
): CmsEditorialError | null =>
  cmsEditorialRouteAdmitsPrincipal(policy, session.capabilities)
    ? null
    : {
        ok: false,
        status: 403,
        code: 'FORBIDDEN',
        message: 'The required CMS editorial capability is not granted.',
        details: { reasonCode: 'capability_missing' },
      };

/**
 * BE03b E6: recent binding-bound MFA, evaluated before the idempotency
 * reservation and before any domain read. The proof is derived from the verified
 * session (`mfaFresh`, the shared DEC-111 window), never from the request.
 */
export const requireFreshStepUp = (
  session: CmsEditorialSession,
  policy: CmsEditorialRoutePolicy,
): CmsEditorialError | null =>
  policy.stepUp === 'required' && !session.mfaFresh
    ? {
        ok: false,
        status: 401,
        code: 'STEP_UP_REQUIRED',
        message: 'Recent verification is required.',
        details: { recoveryAction: 'step_up' },
      }
    : null;

/**
 * BE03b If-Match operands: wherever the body carries `expectedVersion`, the
 * strong `If-Match` must name the same operand (400, never a silent winner).
 */
export const expectedVersionDisagreement = (
  expectedVersion: string | undefined,
  ifMatch: string,
): CmsEditorialError | null =>
  expectedVersion === undefined || expectedVersion === ifMatch
    ? null
    : invalid('The expected version does not match If-Match.', {
        violations: [
          {
            path: '/expectedVersion',
            code: 'mismatch',
            message: 'The value is invalid.',
          },
        ],
      });

/** The path/body identifier disagreement of a route that binds one (422). */
export const identifierDisagreement = (member: string): CmsEditorialError =>
  invalid(
    `The ${member} path and body do not match.`,
    {
      violations: [
        {
          path: `/${member}`,
          code: 'mismatch',
          message: 'The value is invalid.',
        },
      ],
    },
    422,
  );

/**
 * CORS preflight of a cms-console route: the allowlisted origin only, and an
 * origin is required (same-origin calls never preflight).
 */
export const registerPreflight = <E extends Env>(
  app: Hono<E>,
  dependencies: CmsEditorialDependencies,
  path: string,
  policy: CmsEditorialRoutePolicy,
  allowHeaders: string,
): void => {
  app.options(path, (context) => {
    const request = context.req.raw;
    const requestId = createRequestId(
      request.headers.get('x-request-id') ?? undefined,
    );
    const originError = checkOrigin(request, dependencies.humanOrigins);
    if (originError !== null || request.headers.get('origin') === null)
      return errorResponse(
        request,
        dependencies,
        requestId,
        originError ?? {
          ok: false,
          status: 403,
          code: 'FORBIDDEN',
          message: 'A request origin is required.',
        },
      );
    const headers = commonHeaders(request, dependencies, requestId);
    headers.set('access-control-allow-methods', `${policy.method}, OPTIONS`);
    headers.set('access-control-allow-headers', allowHeaders);
    return new Response(null, { status: 204, headers });
  });
};
