import type { PatternInstanceRequest } from '@wejammin/contracts';
import { describe, expect, it } from 'vitest';

import {
  failure,
  statusOf,
  validEnvelope,
  validPlacement,
  validPlacementResult,
  validRate,
} from './pattern-instance-contracts';
import { errorResponse } from './pattern-instance-responses';

const body: PatternInstanceRequest = {
  revisionId: 'd4000000-0000-4000-8000-000000000011',
  patternId: 'd4000000-0000-4000-8000-000000000012',
  patternVersion: 1,
  linkMode: 'linked',
  slotPath: '/primary',
  overrides: {},
  expectedVersion: '1',
};
const row = {
  id: 'd4000000-0000-4000-8000-000000000013',
  version: '1',
  contentHash: 'a'.repeat(64),
  createdAt: '2026-09-28T14:00:00.000Z',
  updatedAt: '2026-09-28T14:00:00.000Z',
  state: 'draft',
  revisionId: body.revisionId,
  path: body.slotPath + '/header',
  position: 0,
  blockKey: 'profile.header',
  blockVersion: 1,
  patternId: body.patternId,
  patternVersion: 1,
  blockRegistryDigest: 'b'.repeat(64),
  linkMode: 'linked',
  conflictState: 'none',
};
const placement = { items: [row] };
const entryEtag = '"7"';

describe('CMS-03C-02 port result guards and error responses', () => {
  it('rejects unknown result and rate envelopes without trusting provider fields', () => {
    expect(statusOf(418)).toBe(500);
    expect(failure(429, {}, 12)).toHaveProperty('retryAfterSeconds', 12);
    for (const value of [
      null,
      [],
      {},
      { ok: 'true' },
      { ok: true },
      { ok: false },
    ])
      expect(validEnvelope(value)).toBe(false);
    expect(validEnvelope({ ok: true, value: placement })).toBe(true);
    expect(validEnvelope({ ok: false, status: 409 })).toBe(true);
    expect(
      validPlacementResult({ ok: true, value: placement, etag: entryEtag }),
    ).toBe(true);
    for (const value of [
      { ok: true, value: placement },
      { ok: true, value: placement, etag: '7' },
      { ok: true, value: placement, etag: 'W/"7"' },
    ])
      expect(validPlacementResult(value)).toBe(false);
    for (const value of [
      null,
      [],
      {},
      { allowed: 'yes' },
      { allowed: true, limit: 120, remaining: -1, resetAt: 1 },
      { allowed: true, limit: 120, remaining: 121, resetAt: 1 },
      { allowed: true, limit: 120, remaining: 1, resetAt: -1 },
      { allowed: true, limit: 240, remaining: 1, resetAt: 1 },
    ])
      expect(validRate(value, 120)).toBe(false);
    expect(
      validRate({ allowed: true, limit: 120, remaining: 1, resetAt: 1 }, 120),
    ).toBe(true);
  });

  it('rejects a placement that does not bind the request or the forwarded ETag', () => {
    expect(
      validPlacement(
        { items: [{ ...row, ownerId: body.patternId }] },
        body,
        entryEtag,
      ),
    ).toBe(false);
    for (const value of [
      { items: [{ ...row, revisionId: body.patternId }] },
      { items: [{ ...row, path: '/other' }] },
      { items: [{ ...row, patternId: body.revisionId }] },
      { items: [{ ...row, patternVersion: 2 }] },
      { items: [{ ...row, linkMode: 'detached' }] },
      { items: [] },
      { items: [row, { ...row, position: 2 }] },
    ])
      expect(validPlacement(value, body, entryEtag)).toBe(false);
    expect(
      validPlacement(
        { items: [{ ...row, blockRegistryDigest: 'c'.repeat(64) }] },
        { ...body, blockRegistryDigest: 'b'.repeat(64) },
        entryEtag,
      ),
    ).toBe(false);
    for (const etag of ['7', 'W/"7"', '"0"', undefined])
      expect(validPlacement(placement, body, etag)).toBe(false);
    expect(validPlacement(placement, body, entryEtag)).toBe(true);
  });

  it('emits only typed public error fields and bounded retry headers', async () => {
    const request = new Request('https://api.example.test/pattern', {
      headers: { origin: 'https://cms.example.test' },
    });
    const dependencies = {
      humanOrigins: ['https://cms.example.test'],
    } as unknown as Parameters<typeof errorResponse>[1];
    const response = errorResponse(
      request,
      dependencies,
      'd4000000-0000-4000-8000-000000000014',
      failure(429, { secret: 'private' }, 12),
      new Headers({ 'ratelimit-limit': '120' }),
    );
    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('12');
    expect(response.headers.get('ratelimit-limit')).toBe('120');
    expect(response.headers.get('access-control-allow-origin')).toBe(
      'https://cms.example.test',
    );
    expect(JSON.stringify(await response.json())).not.toContain('private');
  });
});
