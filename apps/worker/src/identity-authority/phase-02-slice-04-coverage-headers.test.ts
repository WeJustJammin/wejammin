import { describe, expect, it, vi } from 'vitest';

import {
  CSRF,
  ORIGIN,
  REQUEST_ID,
  bindings,
} from '../authentication/phase-02-slice-02.test-fixtures';
import {
  createApp,
  success,
} from '../authentication/phase-02-slice-02.test-support';

const ORGANIZATION_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ASSIGNMENT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const TENURE_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const TERMS_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const PERSON_ID = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

const organization = {
  organizationId: ORGANIZATION_ID,
  ownershipState: 'owned',
  lifecycle: 'active',
  typeCodes: ['band'],
  version: '2',
  etag: '"2"',
  createdAt: '2026-09-01T05:00:00Z',
  updatedAt: '2026-09-01T05:00:00Z',
};

type HeaderCase = Readonly<{
  name: string;
  method?: 'DELETE' | 'POST';
  path: string;
  body: Readonly<Record<string, unknown>>;
  includeIdempotency: boolean;
}>;

const headerCases: readonly HeaderCase[] = [
  {
    name: 'ORG-01',
    path: '/api/v1/organizations',
    body: { mode: 'self_member', typeCodes: ['band'] },
    includeIdempotency: false,
  },
  {
    name: 'TYPE-01',
    path: `/api/v1/organizations/${ORGANIZATION_ID}/type-assignments`,
    body: { typeCode: 'label' },
    includeIdempotency: true,
  },
  {
    name: 'TYPE-02',
    method: 'DELETE',
    path: `/api/v1/organizations/${ORGANIZATION_ID}/type-assignments/${ASSIGNMENT_ID}`,
    body: {},
    includeIdempotency: true,
  },
  {
    name: 'MEM-01',
    path: `/api/v1/organizations/${ORGANIZATION_ID}/membership-invitations`,
    body: {
      personId: PERSON_ID,
      startsOn: '2026-09-01',
      termsVersionId: TERMS_ID,
      governanceMode: 'governed',
      capacity: 'permanent',
      inviteExpiresAt: '2026-09-03T05:00:00Z',
    },
    includeIdempotency: true,
  },
  {
    name: 'MEM-02',
    path: `/api/v1/organizations/${ORGANIZATION_ID}/membership-assertions`,
    body: {
      personId: PERSON_ID,
      startsOn: '2024-01-01',
      provenance: 'historical_assertion',
      evidenceRef: TERMS_ID,
    },
    includeIdempotency: true,
  },
  {
    name: 'MEM-03',
    path: `/api/v1/membership-tenures/${TENURE_ID}/accept`,
    body: {
      termsVersionId: TERMS_ID,
      termsHash: 'a'.repeat(64),
      decision: 'accept',
    },
    includeIdempotency: true,
  },
  {
    name: 'MEM-04',
    path: `/api/v1/membership-tenures/${TENURE_ID}/end`,
    body: { mode: 'now', reasonCode: 'AUTHORITY_WITHDRAWN' },
    includeIdempotency: true,
  },
  {
    name: 'MEM-05',
    path: `/api/v1/membership-tenures/${TENURE_ID}/capacity-periods`,
    body: {
      capacity: 'touring',
      startsOn: '2026-09-01',
      endsOn: '2026-10-01',
    },
    includeIdempotency: true,
  },
];

const requestWithoutRequiredHeader = (testCase: HeaderCase): Request => {
  const headers = new Headers({
    accept: 'application/json',
    origin: ORIGIN,
    cookie: `wj_session_ref=slice02-session-ref; wj_csrf=${CSRF}`,
    'x-csrf-token': CSRF,
    'x-request-id': REQUEST_ID,
    'content-type': 'application/json',
  });
  if (testCase.includeIdempotency)
    headers.set('idempotency-key', `slice04-${testCase.name}`);
  return new Request(`${ORIGIN}${testCase.path}`, {
    method: testCase.method ?? 'POST',
    headers,
    body: JSON.stringify(testCase.body),
  });
};

describe('Phase 2 Slice 04 command-header coverage', () => {
  it('rejects a missing If-Match header for a valid membership invitation', async () => {
    const { app, auth } = createApp();
    const response = await app.fetch(
      new Request(
        `${ORIGIN}/api/v1/organizations/${ORGANIZATION_ID}/membership-invitations`,
        {
          method: 'POST',
          headers: {
            accept: 'application/json',
            origin: ORIGIN,
            cookie: `wj_session_ref=slice02-session-ref; wj_csrf=${CSRF}`,
            'x-csrf-token': CSRF,
            'x-request-id': REQUEST_ID,
            'content-type': 'application/json',
            'idempotency-key': 'slice04-membership-invite-missing-if-match',
          },
          body: JSON.stringify({
            personId: PERSON_ID,
            startsOn: '2026-09-01',
            termsVersionId: TERMS_ID,
            governanceMode: 'governed',
            capacity: 'permanent',
            inviteExpiresAt: new Date(
              Date.now() + 24 * 60 * 60 * 1_000,
            ).toISOString(),
          }),
        },
      ),
      bindings,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: 'INVALID_REQUEST',
      requestId: REQUEST_ID,
    });
    // BE00: the session is verified (step 4) before strict validation (step 6)
    // and the idempotency headers (step 8).
    expect(auth.resolveSession).toHaveBeenCalledTimes(1);
  });

  it.each(headerCases)(
    '$name rejects its missing idempotency or conditional header before authority',
    async (testCase) => {
      const { app, auth } = createApp();
      const response = await app.fetch(
        requestWithoutRequiredHeader(testCase),
        bindings,
      );

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        code: 'INVALID_REQUEST',
        requestId: REQUEST_ID,
      });
      // BE00: the session is verified (step 4) before strict validation (step 6)
      // and the idempotency headers (step 8).
      expect(auth.resolveSession).toHaveBeenCalledTimes(1);
    },
  );

  it('rejects an unknown TYPE-02 body field before command headers', async () => {
    const { app, auth } = createApp();
    const request = new Request(
      `${ORIGIN}/api/v1/organizations/${ORGANIZATION_ID}/type-assignments/${ASSIGNMENT_ID}`,
      {
        method: 'DELETE',
        headers: {
          accept: 'application/json',
          origin: ORIGIN,
          cookie: `wj_session_ref=slice02-session-ref; wj_csrf=${CSRF}`,
          'x-csrf-token': CSRF,
          'x-request-id': REQUEST_ID,
          'content-type': 'application/json',
          'idempotency-key': 'slice04-type-delete-body',
          'if-match': '"1"',
        },
        body: JSON.stringify({ typeCode: 'label' }),
      },
    );

    const response = await app.fetch(request, bindings);
    expect(response.status).toBe(400);
    // BE00: the session is verified (step 4) before strict validation (step 6)
    // and the idempotency headers (step 8).
    expect(auth.resolveSession).toHaveBeenCalledTimes(1);
  });

  it('invokes the direct authenticated organization-read port', async () => {
    const { app, identity } = createApp();
    const port = vi.fn(async () => success(organization));
    (identity as unknown as Record<string, unknown>).readOrganization = port;

    const response = await app.fetch(
      new Request(`${ORIGIN}/api/v1/organizations/${ORGANIZATION_ID}`, {
        headers: {
          accept: 'application/json',
          origin: ORIGIN,
          cookie: 'wj_session_ref=slice02-session-ref',
          'x-request-id': REQUEST_ID,
        },
      }),
      bindings,
    );

    expect(response.status).toBe(200);
    expect(port).toHaveBeenCalledOnce();
  });

  it('fails closed when direct ORG-01 persistence cannot satisfy Location', async () => {
    const { app, identity } = createApp();
    (identity as unknown as Record<string, unknown>).createOrganization = vi.fn(
      async () => success({ privateData: true }),
    );

    const response = await app.fetch(
      new Request(`${ORIGIN}/api/v1/organizations`, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          origin: ORIGIN,
          cookie: `wj_session_ref=slice02-session-ref; wj_csrf=${CSRF}`,
          'x-csrf-token': CSRF,
          'x-request-id': REQUEST_ID,
          'content-type': 'application/json',
          'idempotency-key': 'slice04-invalid-direct-organization',
        },
        body: JSON.stringify({ mode: 'self_member', typeCodes: ['band'] }),
      }),
      bindings,
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({
      code: 'DEPENDENCY_INVALID_RESPONSE',
    });
  });

  it('fails closed when the public organization-read port is absent', async () => {
    const { app } = createApp();
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

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      code: 'DEPENDENCY_UNAVAILABLE',
    });
  });
});
