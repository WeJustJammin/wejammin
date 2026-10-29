import type { CompositionInstanceResource } from '@wejammin/contracts';
import { describe, expect, it, vi } from 'vitest';

import {
  createCmsPatternInstanceApp,
  type CmsPatternInstanceDependencies,
} from './pattern-instance-routes';

/**
 * [P2-S12-AC-026] CMS-03C-02 body ids (BE03c 382, DEC-227 Q1): `revisionId` and `patternId` are UUIDs, and a malformed one
 * fails body validation like every other body id: 422 COMPOSITION_VALIDATION_FAILED at the member, before any session lookup
 * consequence, rate bucket or port call.
 */
const origin = 'https://cms.example.test';
const revisionId = 'd1200000-0000-4000-8000-000000000011';
const patternId = 'd1200000-0000-4000-8000-000000000012';
const path = '/api/v1/cms/compositions/pattern-instances';
const body = {
  revisionId,
  patternId,
  patternVersion: 1,
  linkMode: 'linked',
  slotPath: '/primary',
  overrides: {},
  expectedVersion: '1',
} as const;
const row: CompositionInstanceResource = {
  id: 'd1200000-0000-4000-8000-000000000013',
  version: '1',
  contentHash: 'a'.repeat(64),
  createdAt: '2026-09-28T14:00:00.000Z',
  updatedAt: '2026-09-28T14:00:00.000Z',
  state: 'draft',
  revisionId,
  path: '/primary/header',
  position: 0,
  blockKey: 'profile.header',
  blockVersion: 1,
  patternId,
  patternVersion: 1,
  blockRegistryDigest: 'b'.repeat(64),
  linkMode: 'linked',
  conflictState: 'none',
};

const request = (payload: unknown): Request =>
  new Request(`https://api.example.test${path}`, {
    method: 'POST',
    headers: {
      origin,
      'content-type': 'application/json',
      'idempotency-key': 'pattern-instance-malformed-0001',
      'if-match': '"1"',
    },
    body: JSON.stringify(payload),
  });

const deps = (
  insertPattern: CmsPatternInstanceDependencies['insertPattern'],
): CmsPatternInstanceDependencies => ({
  humanOrigins: [origin],
  now: () => 1_000,
  resolveSession: async () => ({
    ok: true,
    value: {
      userId: 'd1200000-0000-4000-8000-000000000014',
      actingPartyId: 'd1200000-0000-4000-8000-000000000015',
      capabilities: ['cms.author'],
      mfaFresh: true,
    },
  }),
  rateLimit: async (input) => ({
    ok: true,
    value: {
      allowed: true,
      limit: input.limit,
      remaining: input.limit - 1,
      resetAt: 2_000,
    },
  }),
  insertPattern,
  telemetry: () => undefined,
});

describe('[P2-S12-AC-026] CMS-03C-02 malformed body ids', () => {
  // Each case names its malformation so every case has its own full test name (an evidence identity).
  const cases = [
    ['revisionId', 'not-a-uuid', { ...body, revisionId: 'not-a-uuid' }],
    ['patternId', 'not-a-uuid', { ...body, patternId: 'not-a-uuid' }],
    ['revisionId', 'a number', { ...body, revisionId: 42 }],
    [
      'patternId',
      'a 37-character uuid',
      { ...body, patternId: `${patternId}0` },
    ],
  ] as const;

  it.each(cases)(
    'a malformed %s (%s) is 422 COMPOSITION_VALIDATION_FAILED at that member and never reaches the port',
    async (member, _malformation, payload) => {
      const insertPattern = vi.fn<
        CmsPatternInstanceDependencies['insertPattern']
      >(async () => ({ ok: true, value: { items: [row] }, etag: '"7"' }));
      const response = await createCmsPatternInstanceApp(
        deps(insertPattern),
      ).request(request(payload));
      expect(response.status).toBe(422);
      expect(response.headers.get('cache-control')).toBe('no-store');
      const answer = (await response.json()) as {
        code: string;
        details?: { violations?: { path: string }[] };
      };
      expect(answer.code).toBe('COMPOSITION_VALIDATION_FAILED');
      expect(
        answer.details?.violations?.map((violation) => violation.path),
      ).toEqual([`/${member}`]);
      expect(insertPattern).not.toHaveBeenCalled();
    },
  );

  it('control: the same request with well-formed ids is accepted by the route', async () => {
    const insertPattern = vi.fn<
      CmsPatternInstanceDependencies['insertPattern']
    >(async () => ({ ok: true, value: { items: [row] }, etag: '"7"' }));
    const response = await createCmsPatternInstanceApp(
      deps(insertPattern),
    ).request(request(body));
    expect(response.status).toBe(201);
    expect(insertPattern).toHaveBeenCalledTimes(1);
  });
});
