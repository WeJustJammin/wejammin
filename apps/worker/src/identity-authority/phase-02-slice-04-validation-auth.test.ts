import { describe, expect, it, vi } from 'vitest';

import {
  CSRF,
  ORIGIN,
  REQUEST_ID,
  bindings,
} from '../authentication/phase-02-slice-02.test-fixtures';
import {
  createApp,
  failure,
} from '../authentication/phase-02-slice-02.test-support';

const ORGANIZATION_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ASSIGNMENT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const TENURE_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const TERMS_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const PERSON_ID = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const INVITE_EXPIRES_AT = new Date(
  Date.now() + 24 * 60 * 60 * 1_000,
).toISOString();

type ValidationCase = Readonly<{
  criterion: string;
  method: 'GET' | 'POST' | 'DELETE';
  path: string;
  body?: Readonly<Record<string, unknown>>;
  idempotency?: boolean;
  ifMatch?: boolean;
}>;

const validBodies: Readonly<Record<string, Readonly<Record<string, unknown>>>> =
  {
    'ORG-01': { mode: 'self_member', typeCodes: ['band'] },
    'TYPE-01': { typeCode: 'label' },
    'TYPE-02': {},
    'MEM-01': {
      personId: PERSON_ID,
      startsOn: '2026-09-01',
      termsVersionId: TERMS_ID,
      governanceMode: 'governed',
      capacity: 'permanent',
      inviteExpiresAt: INVITE_EXPIRES_AT,
    },
    'MEM-02': {
      personId: PERSON_ID,
      startsOn: '2024-01-01',
      provenance: 'historical_assertion',
      evidenceRef: TERMS_ID,
    },
    'MEM-03': {
      termsVersionId: TERMS_ID,
      termsHash:
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      decision: 'accept',
    },
    'MEM-04': { mode: 'now', reasonCode: 'AUTHORITY_WITHDRAWN' },
    'MEM-05': {
      capacity: 'touring',
      startsOn: '2026-09-01',
      endsOn: '2026-10-01',
    },
  };

const validationCases: readonly ValidationCase[] = [
  {
    criterion: 'P2-S04-AC-063 ORG-01 rejects caller-selected ownership',
    method: 'POST',
    path: '/api/v1/organizations',
    body: { ...validBodies['ORG-01'], ownerPartyId: PERSON_ID },
    idempotency: true,
  },
  {
    criterion: 'P2-S04-AC-064 TYPE-01 rejects an unknown registry code',
    method: 'POST',
    path: `/api/v1/organizations/${ORGANIZATION_ID}/type-assignments`,
    body: { typeCode: 'not_registered' },
    idempotency: true,
    ifMatch: true,
  },
  {
    criterion: 'P2-S04-AC-064 TYPE-02 rejects a malformed assignment path',
    method: 'DELETE',
    path: `/api/v1/organizations/${ORGANIZATION_ID}/type-assignments/not-a-uuid`,
    body: {},
    idempotency: true,
    ifMatch: true,
  },
  {
    criterion: 'P2-S04-AC-065 MEM-01 rejects a fabricated person identifier',
    method: 'POST',
    path: `/api/v1/organizations/${ORGANIZATION_ID}/membership-invitations`,
    body: { ...validBodies['MEM-01'], personId: 'not-a-uuid' },
    idempotency: true,
    ifMatch: true,
  },
  {
    criterion:
      'P2-S04-AC-066 MEM-02 rejects a malformed protected evidence reference',
    method: 'POST',
    path: `/api/v1/organizations/${ORGANIZATION_ID}/membership-assertions`,
    body: { ...validBodies['MEM-02'], evidenceRef: 'not-a-uuid' },
    idempotency: true,
    ifMatch: true,
  },
  {
    criterion: 'P2-S04-AC-067 MEM-03 rejects a non-hex terms hash',
    method: 'POST',
    path: `/api/v1/membership-tenures/${TENURE_ID}/accept`,
    body: { ...validBodies['MEM-03'], termsHash: 'not-a-hash' },
    idempotency: true,
    ifMatch: true,
  },
  {
    criterion: 'P2-S04-AC-068 MEM-04 requires confirmation for retroactive end',
    method: 'POST',
    path: `/api/v1/membership-tenures/${TENURE_ID}/end`,
    body: {
      mode: 'retroactive',
      endsOn: '2025-12-31',
      reasonCode: 'DATE_CORRECTION',
    },
    idempotency: true,
    ifMatch: true,
  },
  {
    criterion: 'P2-S04-AC-069 MEM-05 rejects a reversed capacity interval',
    method: 'POST',
    path: `/api/v1/membership-tenures/${TENURE_ID}/capacity-periods`,
    body: { capacity: 'touring', startsOn: '2026-10-01', endsOn: '2026-09-01' },
    idempotency: true,
    ifMatch: true,
  },
  {
    criterion: 'P2-S04-AC-058 MEM-06 rejects an unknown collection filter',
    method: 'GET',
    path: `/api/v1/organizations/${ORGANIZATION_ID}/memberships?partyId=${PERSON_ID}`,
  },
  {
    criterion: 'P2-S04-AC-010 ORG-02 rejects an authority query hint',
    method: 'GET',
    path: `/api/v1/organizations/${ORGANIZATION_ID}?ownerPartyId=${PERSON_ID}`,
  },
];

const protectedCases: readonly ValidationCase[] = [
  {
    criterion: 'P2-S04-AC-004 ORG-01 requires an authenticated human',
    method: 'POST',
    path: '/api/v1/organizations',
    body: validBodies['ORG-01']!,
    idempotency: true,
  },
  {
    criterion:
      'P2-S04-AC-016 TYPE-01 requires current owner or admin authority',
    method: 'POST',
    path: `/api/v1/organizations/${ORGANIZATION_ID}/type-assignments`,
    body: validBodies['TYPE-01']!,
    idempotency: true,
    ifMatch: true,
  },
  {
    criterion: 'P2-S04-AC-022 TYPE-02 requires assignment authority',
    method: 'DELETE',
    path: `/api/v1/organizations/${ORGANIZATION_ID}/type-assignments/${ASSIGNMENT_ID}`,
    body: validBodies['TYPE-02']!,
    idempotency: true,
    ifMatch: true,
  },
  {
    criterion: 'P2-S04-AC-028 MEM-01 requires invitation authority',
    method: 'POST',
    path: `/api/v1/organizations/${ORGANIZATION_ID}/membership-invitations`,
    body: validBodies['MEM-01']!,
    idempotency: true,
    ifMatch: true,
  },
  {
    criterion: 'P2-S04-AC-034 MEM-02 requires protected assertion authority',
    method: 'POST',
    path: `/api/v1/organizations/${ORGANIZATION_ID}/membership-assertions`,
    body: validBodies['MEM-02']!,
    idempotency: true,
    ifMatch: true,
  },
  {
    criterion: 'P2-S04-AC-040 MEM-03 requires the invited person self context',
    method: 'POST',
    path: `/api/v1/membership-tenures/${TENURE_ID}/accept`,
    body: validBodies['MEM-03']!,
    idempotency: true,
    ifMatch: true,
  },
  {
    criterion:
      'P2-S04-AC-046 MEM-04 requires a confirmed counterparty or capable actor',
    method: 'POST',
    path: `/api/v1/membership-tenures/${TENURE_ID}/end`,
    body: validBodies['MEM-04']!,
    idempotency: true,
    ifMatch: true,
  },
  {
    criterion:
      'P2-S04-AC-052 MEM-05 requires owner, admin, or current subject authority',
    method: 'POST',
    path: `/api/v1/membership-tenures/${TENURE_ID}/capacity-periods`,
    body: validBodies['MEM-05']!,
    idempotency: true,
    ifMatch: true,
  },
  {
    criterion:
      'P2-S04-AC-058 MEM-06 requires an allowed membership-read context',
    method: 'GET',
    path: `/api/v1/organizations/${ORGANIZATION_ID}/memberships`,
  },
];

const requestFor = (testCase: ValidationCase): Request => {
  const headers = new Headers({
    accept: 'application/json',
    origin: ORIGIN,
    cookie: `wj_session_ref=slice02-session-ref; wj_csrf=${CSRF}`,
    'x-csrf-token': CSRF,
    'x-request-id': REQUEST_ID,
  });
  if (testCase.method !== 'GET') {
    headers.set('content-type', 'application/json');
    if (testCase.idempotency)
      headers.set('idempotency-key', 'slice04-validation');
    if (testCase.ifMatch) headers.set('if-match', '"1"');
  }
  return new Request(`${ORIGIN}${testCase.path}`, {
    method: testCase.method,
    headers,
    ...(testCase.method === 'GET'
      ? {}
      : { body: JSON.stringify(testCase.body ?? {}) }),
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
    details?: unknown;
    requestId?: string;
  };
  expect(payload).toMatchObject({ code, requestId: REQUEST_ID });
};

describe('Phase 2 Slice 04 strict validation boundaries', () => {
  it.each(validationCases)('$criterion', async (testCase) => {
    const { app, auth } = createApp();
    const response = await app.fetch(requestFor(testCase), bindings);

    await expectApiError(response, 400, 'INVALID_REQUEST');
    // BE00: the session is verified (step 4) before strict validation (step 6)
    // and the idempotency headers (step 8).
    // ORG-02 reads with an optional session and resolves none for a request
    // carrying no credential.
    expect(auth.resolveSession).toHaveBeenCalledTimes(
      testCase.criterion.includes('ORG-02') ? 0 : 1,
    );
  });
});

describe('Phase 2 Slice 04 authentication and authority boundaries', () => {
  it.each(protectedCases)('$criterion', async (testCase) => {
    const { app, auth } = createApp({
      resolveSession: vi.fn(async () =>
        failure(401, 'UNAUTHENTICATED', 'Sign in is required.'),
      ),
    });
    const response = await app.fetch(requestFor(testCase), bindings);

    await expectApiError(response, 401, 'UNAUTHENTICATED');
    expect(auth.resolveSession).toHaveBeenCalledOnce();
  });
});

describe('Phase 2 Slice 04 concealed organization reads', () => {
  it('P2-S04-AC-010 returns the same 404 for an unreadable organization', async () => {
    const { app, identity } = createApp();
    const readOrganization = vi.fn(async () =>
      failure(404, 'NOT_FOUND', 'The requested resource was not found.'),
    );
    (identity as unknown as Record<string, unknown>).readOrganization =
      readOrganization;

    const response = await app.fetch(
      new Request(`${ORIGIN}/api/v1/organizations/${ORGANIZATION_ID}`, {
        headers: {
          accept: 'application/json',
          origin: ORIGIN,
          'x-request-id': REQUEST_ID,
        },
      }),
      bindings,
    );

    expect(response.status).toBe(404);
    const payload = await response.json();
    expect(payload).toMatchObject({ code: 'NOT_FOUND' });
    expect(readOrganization).toHaveBeenCalledOnce();
    expect(JSON.stringify(payload)).not.toContain(PERSON_ID);
  });
});
