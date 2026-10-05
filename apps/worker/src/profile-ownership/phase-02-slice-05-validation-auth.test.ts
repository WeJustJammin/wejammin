import { describe, expect, it, vi } from 'vitest';

import {
  CLAIM_ID,
  CHALLENGE_ID,
  CONTACT_ROUTE_ID,
  PARTY_ID,
  PERSON_ID,
  SHADOW_ID,
  bindings,
  commandRequest,
  createProfileApp,
  failure,
  readRequest,
  responses,
} from './phase-02-slice-05.test-support';

type RequestCase = Readonly<{
  name: string;
  path: string;
  body: Readonly<Record<string, unknown>>;
  anonymous?: boolean;
  ifMatch?: string;
}>;

const requestCases: readonly RequestCase[] = [
  {
    name: 'PRF-API-01',
    path: '/api/v1/shadow-party-matches',
    body: {
      partyId: PARTY_ID,
      sourceDomain: 'projects',
      sourceEntityId: 'work-812',
      sourceVersion: '3',
      roleCode: 'performer',
    },
  },
  {
    name: 'PRF-API-02',
    path: `/api/v1/shadow-parties/${SHADOW_ID}/invitations`,
    body: { contactRouteId: CONTACT_ROUTE_ID, trigger: 'initial' },
    ifMatch: '"1"',
  },
  {
    name: 'PRF-API-03',
    path: '/api/v1/shadow-remedies',
    anonymous: true,
    body: {
      pointerToken: 'rM8p2V6q9Yw4aBcDeFgHiJkLmNoPqRsTuVwXyZ1AbCdEfGhIjKlMn',
      action: 'suppress',
      scope: 'both',
      proof: { kind: 'route_code', code: '482901' },
    },
  },
  {
    name: 'PRF-API-04',
    path: '/api/v1/party-claims',
    body: { targetPartyId: PARTY_ID, claimKind: 'self' },
    ifMatch: '"1"',
  },
  {
    name: 'PRF-API-06',
    path: `/api/v1/party-claims/${CLAIM_ID}/challenges`,
    body: { method: 'attester_route', attesterPersonId: PERSON_ID },
    ifMatch: '"2"',
  },
  {
    name: 'PRF-API-07',
    path: `/api/v1/party-claims/${CLAIM_ID}/proofs`,
    body: {
      kind: 'challenge_code',
      challengeId: CHALLENGE_ID,
      code: '482901',
      reasonCode: 'claim_proof',
    },
    ifMatch: '"2"',
  },
  {
    name: 'PRF-API-08',
    path: `/api/v1/party-claims/${CLAIM_ID}/convert`,
    body: { reasonCode: 'claim_conversion' },
    ifMatch: '"3"',
  },
];

const expectError = async (
  response: Response,
  status: number,
  code: string,
  details?: Record<string, unknown>,
): Promise<void> => {
  expect(response.status).toBe(status);
  expect(response.headers.get('cache-control')).toBe('no-store');
  const payload = (await response.json()) as Record<string, unknown>;
  if (details !== undefined) expect(payload.details).toEqual(details);
  expect(Object.keys(payload).sort()).toEqual([
    'code',
    'details',
    'message',
    'requestId',
  ]);
  expect(payload).toMatchObject({ code, requestId: expect.any(String) });
};

describe('Phase 2 Slice 05 Worker validation and authorization RED acceptance', () => {
  it.each(requestCases)(
    '[P2-S05-AC-005,011,017,023,029,035,041,047] $name rejects unknown body fields before authorization or mutation',
    async (testCase) => {
      const harness = createProfileApp();
      const response = await harness.app.fetch(
        commandRequest(
          testCase.path,
          { ...testCase.body, unknownField: 'mass-assignment' },
          {
            authenticated: !testCase.anonymous,
            ifMatch: testCase.ifMatch,
          },
        ),
        bindings,
      );

      await expectError(response, 422, 'VALIDATION_FAILED');
      expect(
        Object.values(harness.profile).filter(
          (value) => typeof value === 'function' && 'mock' in value,
        ),
      ).toHaveLength(17);
      for (const method of Object.values(harness.profile)) {
        if (typeof method === 'function' && 'mock' in method)
          expect(method).not.toHaveBeenCalled();
      }
    },
  );

  it.each(requestCases)(
    '[P2-S05-AC-052,053,054,055] $name rejects pagination or arbitrary query parameters',
    async (testCase) => {
      const harness = createProfileApp();
      const response = await harness.app.fetch(
        commandRequest(testCase.path, testCase.body, {
          authenticated: !testCase.anonymous,
          ifMatch: testCase.ifMatch,
          query: 'cursor=attacker-controlled&limit=999',
        }),
        bindings,
      );

      await expectError(response, 400, 'INVALID_REQUEST');
    },
  );

  it.each(requestCases)(
    '[P2-S05-AC-054,055] $name rejects missing or malformed idempotency and version headers',
    async (testCase) => {
      const missingKey = createProfileApp();
      const missingKeyRequest = commandRequest(testCase.path, testCase.body, {
        authenticated: !testCase.anonymous,
        ifMatch: testCase.ifMatch,
      });
      missingKeyRequest.headers.delete('idempotency-key');
      await expectError(
        await missingKey.app.fetch(missingKeyRequest, bindings),
        400,
        'INVALID_REQUEST',
      );

      const malformedKey = createProfileApp();
      await expectError(
        await malformedKey.app.fetch(
          commandRequest(testCase.path, testCase.body, {
            authenticated: !testCase.anonymous,
            ifMatch: testCase.ifMatch,
            key: 'short',
          }),
          bindings,
        ),
        400,
        'INVALID_REQUEST',
      );

      if (testCase.ifMatch !== undefined) {
        const malformedVersion = createProfileApp();
        await expectError(
          await malformedVersion.app.fetch(
            commandRequest(testCase.path, testCase.body, {
              authenticated: !testCase.anonymous,
              ifMatch: 'W/"01", "2"',
            }),
            bindings,
          ),
          400,
          'INVALID_REQUEST',
        );
      }
    },
  );

  it('[P2-S05-AC-052] rejects unsupported media, malformed JSON, and oversized JSON before a port call', async () => {
    const unsupported = createProfileApp();
    const mediaRequest = commandRequest(
      '/api/v1/party-claims',
      { targetPartyId: PARTY_ID, claimKind: 'self' },
      { ifMatch: '"1"', contentType: 'text/plain' },
    );
    await expectError(
      await unsupported.app.fetch(mediaRequest, bindings),
      415,
      'UNSUPPORTED_MEDIA_TYPE',
      { allowedMediaTypes: ['application/json'] },
    );

    const malformed = createProfileApp();
    const malformedRequest = commandRequest(
      '/api/v1/party-claims',
      { targetPartyId: PARTY_ID, claimKind: 'self' },
      { ifMatch: '"1"' },
    );
    const malformedBody = new Request(malformedRequest, { body: '{' });
    await expectError(
      await malformed.app.fetch(malformedBody, bindings),
      400,
      'INVALID_REQUEST',
    );

    const oversized = createProfileApp();
    const oversizedRequest = commandRequest(
      '/api/v1/party-claims',
      { targetPartyId: PARTY_ID, claimKind: 'self' },
      { ifMatch: '"1"' },
    );
    const oversizedBody = new Request(oversizedRequest, {
      body: JSON.stringify({ data: 'x'.repeat(256 * 1024 + 1) }),
    });
    await expectError(
      await oversized.app.fetch(oversizedBody, bindings),
      413,
      'PAYLOAD_TOO_LARGE',
    );
  });

  it('[P2-S05-AC-006,012,018,024,030,036,042,048] derives claimant and acting party from the verified session, never from request-controlled context', async () => {
    const startClaim = vi.fn(async (input: Record<string, unknown>) => {
      expect(input).toMatchObject({
        session: expect.objectContaining({
          personId: PERSON_ID,
          actingPartyId: PERSON_ID,
        }),
      });
      expect(input).not.toHaveProperty('claimantPersonId');
      expect(input).not.toHaveProperty('actingPartyId');
      return { ok: true, value: responses.startClaim } as const;
    });
    const harness = createProfileApp({ startClaim });
    const request = commandRequest(
      '/api/v1/party-claims',
      { targetPartyId: PARTY_ID, claimKind: 'self' },
      { ifMatch: '"1"' },
    );
    request.headers.set(
      'x-acting-party-id',
      '99999999-9999-4999-8999-999999999999',
    );

    const response = await harness.app.fetch(request, bindings);
    expect(response.status).toBe(201);
    expect(startClaim).toHaveBeenCalledOnce();
  });

  it('[P2-S05-AC-002,003,016,018] allows account-free remedy while invitation-link possession remains non-authenticating', async () => {
    const harness = createProfileApp();
    const remedy = await harness.app.fetch(
      commandRequest(
        '/api/v1/shadow-remedies',
        {
          pointerToken: 'rM8p2V6q9Yw4aBcDeFgHiJkLmNoPqRsTuVwXyZ1AbCdEfGhIjKlMn',
          action: 'suppress',
          scope: 'both',
          proof: { kind: 'route_code', code: '482901' },
        },
        { authenticated: false },
      ),
      bindings,
    );
    expect(remedy.status).toBe(200);
    await expect(remedy.json()).resolves.toEqual(responses.submitRemedy);

    const linkOnly = await harness.app.fetch(
      commandRequest(
        `/api/v1/shadow-parties/${SHADOW_ID}/invitations`,
        { contactRouteId: CONTACT_ROUTE_ID, trigger: 'initial' },
        { authenticated: false, ifMatch: '"1"' },
      ),
      bindings,
    );
    await expectError(linkOnly, 401, 'UNAUTHENTICATED');
  });

  it('[P2-S05-AC-028,029,030,072] conceals a private claim from an unauthorized reader without returning a target or opposing evidence', async () => {
    const harness = createProfileApp({
      readClaim: vi.fn(async () =>
        failure(404, 'NOT_FOUND', 'The requested resource was not found.'),
      ),
    });
    const response = await harness.app.fetch(
      readRequest(`/api/v1/party-claims/${CLAIM_ID}`),
      bindings,
    );

    const responseBody = response.clone();
    await expectError(response, 404, 'NOT_FOUND');
    const body = JSON.stringify(await responseBody.json());
    expect(body).not.toContain(PARTY_ID);
    expect(body).not.toContain('attester');
  });
});
