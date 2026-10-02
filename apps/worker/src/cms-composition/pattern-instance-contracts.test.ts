import type { PatternInstanceRequest } from '@wejammin/contracts';
import { describe, expect, it } from 'vitest';

import {
  failure,
  statusOf,
  validEnvelope,
  validInstance,
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
const resource = {
  id: 'd4000000-0000-4000-8000-000000000013',
  version: '1',
  contentHash: 'a'.repeat(64),
  createdAt: '2026-09-28T14:00:00.000Z',
  updatedAt: '2026-09-28T14:00:00.000Z',
  state: 'draft',
  revisionId: body.revisionId,
  path: body.slotPath,
  blockKey: 'profile.header',
  blockVersion: 1,
  patternId: body.patternId,
  patternVersion: 1,
  blockRegistryDigest: 'b'.repeat(64),
  linkMode: 'linked',
  conflictState: 'none',
};

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
    expect(validEnvelope({ ok: true, value: resource })).toBe(true);
    expect(validEnvelope({ ok: false, status: 409 })).toBe(true);
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

  it('rejects malformed or unrelated private instance resources', () => {
    expect(validInstance({ ...resource, ownerId: body.patternId }, body)).toBe(
      false,
    );
    for (const value of [
      { ...resource, revisionId: body.patternId },
      { ...resource, path: '/other' },
      { ...resource, patternId: body.revisionId },
      { ...resource, patternVersion: 2 },
      { ...resource, linkMode: 'copied' },
    ])
      expect(validInstance(value, body)).toBe(false);
    expect(
      validInstance(resource, { ...body, blockRegistryDigest: 'c'.repeat(64) }),
    ).toBe(false);
    expect(validInstance(resource, body)).toBe(true);
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
