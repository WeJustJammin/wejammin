import { describe, expect, it } from 'vitest';

import {
  NOW,
  USER,
  build,
  jwt,
  reference,
  type Provider,
} from './phase-02-slice-09-expired-session.test-support';
import {
  opFor,
  requestFor,
  type EvidenceOperationId,
} from './phase-02-slice-09-be03a-evidence-support';
import {
  API_ORIGIN,
  CMS_ORIGIN,
  REQUEST_ID,
  TYPE_ID,
  VERSION_ID,
  validActivation,
  validDraft,
  validField,
  validRelation,
} from './phase-02-slice-09-test-values';

/**
 * Every CMS registry operation that names a missing or EXPIRED session answers
 * 401 UNAUTHENTICATED through the production session resolver (production
 * authentication -> CMS session resolver -> app). The expired session is
 * produced in the access token (`exp` past) and in the provider answer, never
 * by a stub that answers 401 on request. Cookie-authenticated mutations carry
 * a matching double-submit CSRF token so the 401 can only come from the
 * session (BE00 step 2 precedes step 4).
 */
const CSRF = 'csrf-token';

type Case = Readonly<{
  label: string;
  criterion: number;
  request: (cookie: string) => Request;
}>;

const cookieHeaders = (cookie: string, mutation: boolean) => ({
  cookie: mutation ? `${cookie}; wj_csrf=${CSRF}` : cookie,
  ...(mutation ? { 'x-csrf-token': CSRF } : {}),
});

const evidence = (id: EvidenceOperationId, criterion: number): Case => {
  const op = opFor(id);
  return {
    label: id,
    criterion,
    request: (cookie) =>
      requestFor(op, {
        headers: {
          authorization: null,
          ...cookieHeaders(cookie, op.method === 'POST'),
        },
      }),
  };
};

const original = (
  label: string,
  path: string,
  body: unknown,
  ifMatch: boolean,
): Case => ({
  label,
  criterion: 33,
  request: (cookie) =>
    new Request(`${API_ORIGIN}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: CMS_ORIGIN,
        'idempotency-key': 'cms-test-key-001',
        'x-request-id': REQUEST_ID,
        ...(ifMatch ? { 'if-match': '"1"' } : {}),
        ...cookieHeaders(cookie, true),
      },
      body: JSON.stringify(body),
    }),
});

const versionPath = `/api/v1/cms/content-types/${TYPE_ID}/versions/${VERSION_ID}`;
const read = (label: string, path: string): Case => ({
  label,
  criterion: 33,
  request: (cookie) =>
    new Request(`${API_ORIGIN}${path}`, {
      headers: {
        origin: CMS_ORIGIN,
        'x-request-id': REQUEST_ID,
        ...cookieHeaders(cookie, false),
      },
    }),
});

const CASES: readonly Case[] = [
  original('CMS-03A-01', '/api/v1/cms/content-types', validDraft, false),
  original('CMS-03A-02', `${versionPath}/fields`, validField, true),
  original('CMS-03A-03', `${versionPath}/relations`, validRelation, true),
  original('CMS-03A-04', `${versionPath}/activate`, validActivation, true),
  read('CMS-03A-06', '/api/v1/cms/content-types'),
  read('CMS-03A-07', versionPath),
  evidence('CMS-03A-09', 305),
  evidence('CMS-03A-10', 351),
  evidence('CMS-03A-11', 393),
  evidence('CMS-03A-12', 430),
  evidence('CMS-03A-13', 456),
  evidence('CMS-03A-14', 492),
  evidence('CMS-03A-15', 534),
  evidence('CMS-03A-16', 563),
  evidence('CMS-03A-17', 591),
  evidence('CMS-03A-18', 620),
];

const cmsCalls = (fetchImpl: ReturnType<typeof build>['fetchImpl']) =>
  fetchImpl.mock.calls
    .map(([input]) => String(input))
    .filter((url) => url.includes('/rpc/cms_') || url.includes('rate'));

const expectUnauthenticated = async (response: Response): Promise<void> => {
  expect(response.status).toBe(401);
  expect(response.headers.get('cache-control')).toBe('no-store');
  const body = (await response.json()) as Record<string, unknown>;
  expect(Object.keys(body).sort()).toStrictEqual([
    'code',
    'details',
    'message',
    'requestId',
  ]);
  expect(body.code).toBe('UNAUTHENTICATED');
  expect(body.details).toStrictEqual({ recoveryAction: 'reauthenticate' });
  expect(body.requestId).toBe(REQUEST_ID);
  expect(JSON.stringify(body)).not.toMatch(
    new RegExp(`${USER}|jwt|expired`, 'iu'),
  );
};

const expiredCookie = async (provider: Provider): Promise<string> =>
  `wj_access=${jwt(provider === 'valid' ? { exp: Math.floor(NOW / 1000) - 60 } : {})}; wj_session_ref=${await reference()}`;

describe('CMS registry 401 UNAUTHENTICATED for an expired session (production session resolver)', () => {
  for (const { label, criterion, request } of CASES) {
    const marker = `[P2-S09-AC-${String(criterion).padStart(3, '0')}]`;
    it(`${marker} ${label} an access token past its exp is a 401 reauthenticate with no CMS RPC and no rate bucket`, async () => {
      const { app, fetchImpl } = build('valid');
      await expectUnauthenticated(
        await app.request(request(await expiredCookie('valid'))),
      );
      expect(cmsCalls(fetchImpl)).toStrictEqual([]);
    });

    it(`${marker} ${label} a token the provider rejects as expired is a 401 reauthenticate with no CMS RPC`, async () => {
      const { app, fetchImpl } = build('jwt-expired-401');
      await expectUnauthenticated(
        await app.request(request(await expiredCookie('jwt-expired-401'))),
      );
      expect(cmsCalls(fetchImpl)).toStrictEqual([]);
    });

    it(`${marker} ${label} control: an unexpired token is not refused as UNAUTHENTICATED, so the 401 above is the expiry`, async () => {
      const { app } = build('valid');
      const cookie = `wj_access=${jwt()}; wj_session_ref=${await reference()}`;
      const response = await app.request(request(cookie));
      const body = (await response.json()) as { code: string };
      expect(body.code).not.toBe('UNAUTHENTICATED');
    });
  }
});
