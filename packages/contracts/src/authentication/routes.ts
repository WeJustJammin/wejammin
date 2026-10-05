import { z } from 'zod';

import { AUTH_MFA_ROUTE_POLICIES } from './routes-mfa.ts';

export const AuthOperationIdSchema = z.enum([
  'AUTH-API-01',
  'AUTH-API-02',
  'AUTH-API-03',
  'AUTH-API-04',
  'AUTH-API-05',
  'AUTH-API-06',
  'AUTH-API-07',
  'AUTH-API-08',
  'AUTH-API-09',
  'AUTH-API-10',
  'AUTH-API-11',
  'AUTH-API-12',
  'AUTH-API-13',
  'AUTH-API-14',
  'AUTH-API-15',
  'AUTH-API-16',
  'AUTH-API-17',
  'AUTH-API-18',
  'AUTH-API-19',
  'AUTH-API-20',
  'AUTH-API-21',
]);

export type AuthOperationId = z.infer<typeof AuthOperationIdSchema>;

export type AuthRoutePolicy = Readonly<{
  operationId: AuthOperationId;
  method: 'GET' | 'POST' | 'DELETE';
  path: string;
  /**
   * `session_conditional_step_up` needs a fresh step-up proof only when the
   * account already holds a verified factor (AUTH-API-17) or the target
   * factor is verified (AUTH-API-19).
   */
  auth:
    | 'public'
    | 'callback_state'
    | 'session'
    | 'session_step_up'
    | 'session_conditional_step_up';
  rateLimit: number;
  rateWindowSeconds: number;
  /**
   * Bucket identity of the BE01a Route Registry rate column: `user` for the
   * "per user" rows (operation plus the server-derived Auth UUID only, never
   * the client address), `client` for the "per IP", "IP+identifier",
   * "IP+session" and "IP+account" rows (operation plus client address plus the
   * identity named by the row).
   */
  rateScope: 'client' | 'user';
  timeoutMs: number;
  cacheControl: 'public, max-age=60' | 'no-store';
  idempotency: 'none' | 'required';
  ifMatch: 'none' | 'required';
}>;

export const AUTH_ROUTE_POLICIES = [
  [
    'AUTH-API-01',
    'GET',
    '/api/v1/auth/providers',
    'public',
    120,
    60,
    8_000,
    'public, max-age=60',
    'none',
    'none',
  ],
  [
    'AUTH-API-02',
    'POST',
    '/api/v1/auth/email/start',
    'public',
    5,
    900,
    8_000,
    'no-store',
    'none',
    'none',
  ],
  [
    'AUTH-API-03',
    'POST',
    '/api/v1/auth/oauth/start',
    'public',
    10,
    900,
    8_000,
    'no-store',
    'none',
    'none',
  ],
  [
    'AUTH-API-04',
    'GET',
    '/auth/callback',
    'callback_state',
    10,
    900,
    5_000,
    'no-store',
    'none',
    'none',
  ],
  [
    'AUTH-API-05',
    'GET',
    '/api/v1/auth/session',
    'session',
    300,
    60,
    8_000,
    'no-store',
    'none',
    'none',
  ],
  [
    'AUTH-API-06',
    'POST',
    '/api/v1/auth/session/refresh',
    'session',
    60,
    60,
    8_000,
    'no-store',
    'none',
    'none',
  ],
  [
    'AUTH-API-07',
    'POST',
    '/api/v1/auth/bootstrap',
    'session',
    10,
    60,
    15_000,
    'no-store',
    'required',
    'none',
  ],
  [
    'AUTH-API-08',
    'POST',
    '/api/v1/auth/logout',
    'session',
    60,
    60,
    15_000,
    'no-store',
    'required',
    'none',
  ],
  [
    'AUTH-API-09',
    'GET',
    '/api/v1/account/login-methods',
    'session',
    300,
    60,
    8_000,
    'no-store',
    'none',
    'none',
  ],
  [
    'AUTH-API-10',
    'POST',
    '/api/v1/account/login-methods/:provider/link-intents',
    'session_step_up',
    5,
    3600,
    15_000,
    'no-store',
    'required',
    'required',
  ],
  [
    'AUTH-API-11',
    'DELETE',
    '/api/v1/account/login-methods/:identityId',
    'session_step_up',
    5,
    3600,
    15_000,
    'no-store',
    'required',
    'required',
  ],
  [
    'AUTH-API-12',
    'POST',
    '/api/v1/account-merges',
    'session_step_up',
    2,
    86_400,
    15_000,
    'no-store',
    'required',
    'required',
  ],
  [
    'AUTH-API-13',
    'GET',
    '/api/v1/account-merges/:mergeId',
    'session',
    300,
    60,
    8_000,
    'no-store',
    'none',
    'none',
  ],
  [
    'AUTH-API-14',
    'POST',
    '/api/v1/account-merges/:mergeId/prove-duplicate',
    'session_step_up',
    5,
    3600,
    15_000,
    'no-store',
    'required',
    'required',
  ],
  [
    'AUTH-API-15',
    'POST',
    '/api/v1/account-merges/:mergeId/confirm',
    'session_step_up',
    10,
    60,
    15_000,
    'no-store',
    'required',
    'required',
  ],
  ...AUTH_MFA_ROUTE_POLICIES,
] as const satisfies readonly (readonly [
  AuthOperationId,
  AuthRoutePolicy['method'],
  string,
  AuthRoutePolicy['auth'],
  number,
  number,
  number,
  AuthRoutePolicy['cacheControl'],
  AuthRoutePolicy['idempotency'],
  AuthRoutePolicy['ifMatch'],
])[];

/**
 * BE01a Route Registry rate column. Every "/user" row is `user`; AUTH-API-01
 * (per IP), 02 (IP+identifier), 03 (login limits), 04 and 20 (IP+account), 06
 * (IP+session) and 18 and 21 (failed attempts per IP+account) are `client`.
 */
const AUTH_RATE_SCOPES: Readonly<Record<AuthOperationId, 'client' | 'user'>> = {
  'AUTH-API-01': 'client',
  'AUTH-API-02': 'client',
  'AUTH-API-03': 'client',
  'AUTH-API-04': 'client',
  'AUTH-API-05': 'user',
  'AUTH-API-06': 'client',
  'AUTH-API-07': 'user',
  'AUTH-API-08': 'user',
  'AUTH-API-09': 'user',
  'AUTH-API-10': 'user',
  'AUTH-API-11': 'user',
  'AUTH-API-12': 'user',
  'AUTH-API-13': 'user',
  'AUTH-API-14': 'user',
  'AUTH-API-15': 'user',
  'AUTH-API-16': 'user',
  'AUTH-API-17': 'user',
  'AUTH-API-18': 'client',
  'AUTH-API-19': 'user',
  'AUTH-API-20': 'client',
  'AUTH-API-21': 'client',
};

export const authRoutePolicies: readonly AuthRoutePolicy[] =
  AUTH_ROUTE_POLICIES.map((policy) => ({
    operationId: policy[0],
    method: policy[1],
    path: policy[2],
    auth: policy[3],
    rateLimit: policy[4],
    rateWindowSeconds: policy[5],
    rateScope: AUTH_RATE_SCOPES[policy[0]],
    timeoutMs: policy[6],
    cacheControl: policy[7],
    idempotency: policy[8],
    ifMatch: policy[9],
  }));
