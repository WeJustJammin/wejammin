import { describe, expect, it, vi } from 'vitest';

import {
  CSRF,
  ORIGIN,
  REQUEST_ID,
  bindings,
  session,
} from '../authentication/phase-02-slice-02.test-fixtures';
import {
  createApp,
  failure,
  success,
} from '../authentication/phase-02-slice-02.test-support';

const ALIAS_ID = '66666666-6666-4666-8666-666666666666';
const OFFER_ID = '77777777-7777-4777-8777-777777777777';
const PARTY_ID = '88888888-8888-4888-8888-888888888888';
const CONTEXT_ID = '99999999-9999-4999-8999-999999999999';
const MISSING_ID = '00000000-0000-4000-8000-000000000000';

type RouteCase = Readonly<{
  criterion: string;
  authCriterion: string;
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  body?: Readonly<Record<string, unknown>>;
  ifMatch?: boolean;
  invalidPath?: string;
  invalidBody?: Readonly<Record<string, unknown>>;
  authPath?: string;
  authBody?: Readonly<Record<string, unknown>>;
  authStatus: 401 | 403 | 404;
  authCode: string;
}>;

const cases: readonly RouteCase[] = [
  {
    criterion: 'P2-S03-AC-004 BE01b-01 rejects caller-owned identity fields',
    authCriterion: 'P2-S03-AC-005 BE01b-01 derives server authority',
    method: 'POST',
    path: '/api/v1/me/identity',
    body: {},
    invalidBody: { ownerPersonId: PARTY_ID },
    authStatus: 401,
    authCode: 'UNAUTHENTICATED',
  },
  {
    criterion: 'P2-S03-AC-010 BE01b-02 rejects query authority hints',
    authCriterion: 'P2-S03-AC-011 BE01b-02 limits reads to self',
    method: 'GET',
    path: '/api/v1/me/identity',
    invalidPath: `/api/v1/me/identity?personId=${PARTY_ID}`,
    authStatus: 401,
    authCode: 'UNAUTHENTICATED',
  },
  {
    criterion: 'P2-S03-AC-016 BE01b-03 rejects forged actor and source fields',
    authCriterion: 'P2-S03-AC-017 BE01b-03 denies alias authority',
    method: 'POST',
    path: '/api/v1/me/facets',
    body: { facetCode: 'performer', source: 'self_asserted' },
    invalidBody: {
      facetCode: 'performer',
      source: 'self_asserted',
      actorPersonId: PARTY_ID,
    },
    authStatus: 403,
    authCode: 'FORBIDDEN',
  },
  {
    criterion: 'P2-S03-AC-022 BE01b-04 rejects query and owner hints',
    authCriterion: 'P2-S03-AC-023 BE01b-04 enforces subject authority',
    method: 'DELETE',
    path: '/api/v1/me/facets/performer',
    body: {},
    ifMatch: true,
    invalidPath: `/api/v1/me/facets/performer?actingPartyId=${PARTY_ID}`,
    invalidBody: { ownerPersonId: PARTY_ID },
    authStatus: 403,
    authCode: 'FORBIDDEN',
  },
  {
    criterion: 'P2-S03-AC-028 BE01b-05 rejects client-selected ownership',
    authCriterion: 'P2-S03-AC-029 BE01b-05 requires an active owner',
    method: 'POST',
    path: '/api/v1/aliases',
    body: {
      displayName: 'Neon Harbor',
      handle: 'neon.harbor',
      publicLinkState: 'private',
    },
    invalidBody: {
      displayName: 'Neon Harbor',
      handle: 'neon.harbor',
      publicLinkState: 'private',
      ownerPersonId: PARTY_ID,
    },
    authStatus: 401,
    authCode: 'UNAUTHENTICATED',
  },
  {
    criterion: 'P2-S03-AC-034 BE01b-06 rejects owner and handle injection',
    authCriterion: 'P2-S03-AC-035 BE01b-06 conceals foreign aliases',
    method: 'PATCH',
    path: `/api/v1/aliases/${ALIAS_ID}`,
    body: { displayName: 'Harbor Live' },
    ifMatch: true,
    invalidBody: { displayName: 'Harbor Live', ownerPersonId: PARTY_ID },
    authPath: `/api/v1/aliases/${MISSING_ID}`,
    authBody: { displayName: 'Harbor Live' },
    authStatus: 404,
    authCode: 'ALIAS_NOT_FOUND',
  },
  {
    criterion: 'P2-S03-AC-040 BE01b-07 rejects client-normalized handles',
    authCriterion: 'P2-S03-AC-041 BE01b-07 requires current ownership',
    method: 'POST',
    path: `/api/v1/aliases/${ALIAS_ID}/handle-changes`,
    body: { handle: 'neon-harbor-live' },
    ifMatch: true,
    invalidBody: {
      handle: 'neon-harbor-live',
      normalizedHandle: 'neon-harbor-live',
    },
    authStatus: 403,
    authCode: 'FORBIDDEN',
  },
  {
    criterion:
      'P2-S03-AC-046 BE01b-08 rejects caller-selected retirement owner',
    authCriterion: 'P2-S03-AC-047 BE01b-08 denies foreign retirement',
    method: 'POST',
    path: `/api/v1/aliases/${ALIAS_ID}/retire`,
    body: {},
    ifMatch: true,
    invalidBody: { ownerPersonId: PARTY_ID },
    authStatus: 403,
    authCode: 'FORBIDDEN',
  },
  {
    criterion: 'P2-S03-AC-052 BE01b-09 rejects transfer owner injection',
    authCriterion: 'P2-S03-AC-053 BE01b-09 requires current ownership',
    method: 'POST',
    path: `/api/v1/aliases/${ALIAS_ID}/transfer-offers`,
    body: { recipientPersonId: PARTY_ID },
    invalidBody: { recipientPersonId: PARTY_ID, ownerPersonId: PARTY_ID },
    authStatus: 403,
    authCode: 'FORBIDDEN',
  },
  {
    criterion: 'P2-S03-AC-058 BE01b-10 rejects caller-selected recipient',
    authCriterion: 'P2-S03-AC-059 BE01b-10 requires the named recipient',
    method: 'POST',
    path: `/api/v1/alias-transfer-offers/${OFFER_ID}/accept`,
    body: {},
    ifMatch: true,
    invalidBody: { recipientPersonId: PARTY_ID },
    authStatus: 403,
    authCode: 'FORBIDDEN',
  },
  {
    criterion: 'P2-S03-AC-064 BE01b-11 rejects caller-selected decliner',
    authCriterion: 'P2-S03-AC-065 BE01b-11 limits decline to named parties',
    method: 'POST',
    path: `/api/v1/alias-transfer-offers/${OFFER_ID}/decline`,
    body: {},
    ifMatch: true,
    invalidBody: { actorPersonId: PARTY_ID },
    authStatus: 403,
    authCode: 'FORBIDDEN',
  },
  {
    criterion: 'P2-S03-AC-070 BE01b-12 rejects query-selected acting context',
    authCriterion: 'P2-S03-AC-071 BE01b-12 derives candidates server-side',
    method: 'GET',
    path: '/api/v1/me/acting-contexts',
    invalidPath: `/api/v1/me/acting-contexts?actingPartyId=${PARTY_ID}`,
    authStatus: 401,
    authCode: 'UNAUTHENTICATED',
  },
  {
    criterion: 'P2-S03-AC-076 BE01b-13 rejects caller-built grants',
    authCriterion: 'P2-S03-AC-077 BE01b-13 rejects unheld contexts',
    method: 'POST',
    path: '/api/v1/me/acting-context-bindings',
    body: {
      contextId: CONTEXT_ID,
      deliberateConfirmation: true,
      clientBindingId: 'tab-a',
    },
    invalidBody: {
      contextId: CONTEXT_ID,
      deliberateConfirmation: true,
      clientBindingId: 'tab-a',
      organizationId: PARTY_ID,
    },
    authBody: {
      contextId: MISSING_ID,
      deliberateConfirmation: true,
      clientBindingId: 'tab-a',
    },
    authStatus: 404,
    authCode: 'CONTEXT_NOT_FOUND',
  },
  {
    criterion: 'P2-S03-AC-082 BE01b-18 rejects owner disclosure hints',
    authCriterion: 'P2-S03-AC-083 BE01b-18 preserves public redaction',
    method: 'GET',
    path: `/api/v1/identity/parties/${PARTY_ID}/projection`,
    invalidPath: `/api/v1/identity/parties/${PARTY_ID}/projection?ownerPersonId=${PARTY_ID}`,
    authPath: `/api/v1/identity/parties/${MISSING_ID}/projection`,
    authStatus: 404,
    authCode: 'NOT_FOUND',
  },
];

const requestFor = (
  testCase: RouteCase,
  variant: 'invalid' | 'auth',
): Request => {
  const isMutation = testCase.method !== 'GET';
  const path =
    variant === 'invalid'
      ? (testCase.invalidPath ?? testCase.path)
      : (testCase.authPath ?? testCase.path);
  const headers = new Headers({
    accept: 'application/json',
    origin: ORIGIN,
    cookie: `wj_session_ref=slice02-session-ref; wj_csrf=${CSRF}`,
    'x-csrf-token': CSRF,
    'x-request-id': REQUEST_ID,
  });
  if (isMutation) {
    headers.set('content-type', 'application/json');
    headers.set('idempotency-key', `slice03-${variant}-${path.slice(-16)}`);
    if (testCase.ifMatch) headers.set('if-match', '"1"');
  }
  const body =
    variant === 'invalid'
      ? testCase.invalidBody
      : (testCase.authBody ?? testCase.body);
  return new Request(`${ORIGIN}${path}`, {
    method: testCase.method,
    headers,
    ...(isMutation ? { body: JSON.stringify(body ?? {}) } : {}),
  });
};

const expectApiError = async (
  response: Response,
  status: number,
  code: string,
): Promise<void> => {
  expect(response.status).toBe(status);
  expect(response.headers.get('x-request-id')).toBe(REQUEST_ID);
  const payload = (await response.json()) as {
    code?: string;
    details?: { violations?: unknown };
    requestId?: string;
  };
  expect(payload).toMatchObject({ code, requestId: REQUEST_ID });
  if (status === 400) {
    expect(payload.details).toEqual(
      expect.objectContaining({ violations: expect.any(Array) }),
    );
  }
};

const expectNoAuthMutation = (auth: ReturnType<typeof createApp>['auth']) => {
  expect(auth.startEmail).not.toHaveBeenCalled();
  expect(auth.startOAuth).not.toHaveBeenCalled();
  expect(auth.completeCallback).not.toHaveBeenCalled();
  expect(auth.bootstrap).not.toHaveBeenCalled();
  expect(auth.logout).not.toHaveBeenCalled();
  expect(auth.startLoginMethodLink).not.toHaveBeenCalled();
  expect(auth.unlinkLoginMethod).not.toHaveBeenCalled();
  expect(auth.createAccountMerge).not.toHaveBeenCalled();
  expect(auth.startAccountMergeProof).not.toHaveBeenCalled();
  expect(auth.confirmAccountMerge).not.toHaveBeenCalled();
};

describe('Phase 2 Slice 03 endpoint invalid-input boundaries', () => {
  it.each(cases)(
    '$criterion returns 400 without mutation',
    async (testCase) => {
      const { app, auth } = createApp();
      const response = await app.fetch(
        requestFor(testCase, 'invalid'),
        bindings,
      );

      await expectApiError(response, 400, 'INVALID_REQUEST');
      // BE00: the session is verified (step 4) before strict validation (step 6);
      // a public read (BE01b-18) has no session step.
      expect(auth.resolveSession).toHaveBeenCalledTimes(
        testCase.criterion.includes('BE01b-18') ? 0 : 1,
      );
      expectNoAuthMutation(auth);
    },
  );
});

describe('Phase 2 Slice 03 endpoint authorization boundaries', () => {
  it.each(cases)('$authCriterion', async (testCase) => {
    const unauthenticated = testCase.authStatus === 401;
    const { app, auth } = createApp(
      unauthenticated
        ? {
            resolveSession: vi.fn(async () =>
              failure(401, 'UNAUTHENTICATED', 'Sign in is required.'),
            ),
          }
        : {
            resolveSession: vi.fn(async () =>
              success({ ...session, actingPartyId: ALIAS_ID }),
            ),
          },
    );
    const response = await app.fetch(requestFor(testCase, 'auth'), bindings);

    await expectApiError(response, testCase.authStatus, testCase.authCode);
    expectNoAuthMutation(auth);
    if (unauthenticated) expect(auth.resolveSession).toHaveBeenCalledTimes(1);
  });
});
