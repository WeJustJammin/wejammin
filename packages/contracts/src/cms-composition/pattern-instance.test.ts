import { describe, expect, it } from 'vitest';

import {
  CompositionInstanceResourceSchema,
  PatternInstanceHeadersSchema,
  PatternInstanceRequestSchema,
} from './pattern-instance';

const REVISION_ID = '10000000-0000-4000-8000-000000000001';
const PATTERN_ID = '20000000-0000-4000-8000-000000000002';
const INSTANCE_ID = '30000000-0000-4000-8000-000000000003';
const HASH = 'a'.repeat(64);

const request = {
  revisionId: REVISION_ID,
  patternId: PATTERN_ID,
  patternVersion: 2,
  linkMode: 'linked',
  slotPath: '/header/0',
  overrides: { title: { text: 'Example' } },
  blockRegistryDigest: HASH,
  expectedVersion: '3',
};
const resource = {
  id: INSTANCE_ID,
  version: '4',
  contentHash: HASH,
  createdAt: '2026-09-27T12:00:00Z',
  updatedAt: '2026-09-27T12:00:00Z',
  state: 'draft',
  revisionId: REVISION_ID,
  path: '/header/0',
  blockKey: 'profile.header',
  blockVersion: 2,
  patternId: PATTERN_ID,
  patternVersion: 2,
  blockRegistryDigest: HASH,
  linkMode: 'linked',
  conflictState: null,
};

describe('CMS-03C-02 pattern-instance wire contract', () => {
  it('accepts a bounded linked request and optional digest omission', () => {
    expect(PatternInstanceRequestSchema.parse(request)).toEqual(request);
    expect(
      PatternInstanceRequestSchema.safeParse({
        ...request,
        overrides: { optional: null, items: [1, { title: 'Safe' }] },
      }).success,
    ).toBe(true);
    const withoutDigest = { ...request, linkMode: 'detached' };
    delete (withoutDigest as Partial<typeof withoutDigest>).blockRegistryDigest;
    expect(PatternInstanceRequestSchema.parse(withoutDigest)).toEqual(
      withoutDigest,
    );
  });

  it('rejects caller authority, unknown fields, bad ids, versions, mode, path, and digest', () => {
    for (const candidate of [
      { ...request, actorId: REVISION_ID },
      { ...request, revisionId: 'not-a-uuid' },
      { ...request, patternId: 'not-a-uuid' },
      { ...request, patternVersion: 0 },
      { ...request, patternVersion: 1.5 },
      { ...request, linkMode: 'implicit' },
      { ...request, slotPath: 'header/0' },
      { ...request, slotPath: '/header\nprivate' },
      { ...request, slotPath: `/${'x'.repeat(512)}` },
      { ...request, blockRegistryDigest: HASH.toUpperCase() },
      { ...request, expectedVersion: '0' },
    ])
      expect(PatternInstanceRequestSchema.safeParse(candidate).success).toBe(
        false,
      );
  });

  it('bounds override key count, names, JSON depth, and non-JSON values', () => {
    const tooMany = Object.fromEntries(
      Array.from({ length: 65 }, (_, index) => [`field${index}`, index]),
    );
    let tooDeep: unknown = 'leaf';
    for (let index = 0; index < 9; index += 1) tooDeep = { child: tooDeep };
    for (const overrides of [
      tooMany,
      { ['x'.repeat(129)]: true },
      { nested: tooDeep },
      { bad: Number.NaN },
    ])
      expect(
        PatternInstanceRequestSchema.safeParse({ ...request, overrides })
          .success,
      ).toBe(false);
  });

  it('counts the override root when enforcing the locked depth-eight limit', () => {
    let allowed: unknown = 'leaf';
    for (let index = 0; index < 7; index += 1) allowed = { child: allowed };
    expect(
      PatternInstanceRequestSchema.safeParse({
        ...request,
        overrides: { nested: allowed },
      }).success,
    ).toBe(true);
    const oneLevelTooDeep = { child: allowed };
    expect(
      PatternInstanceRequestSchema.safeParse({
        ...request,
        overrides: { nested: oneLevelTooDeep },
      }).success,
    ).toBe(false);
  });

  it('requires canonical JSON, idempotency, and a strong successor validator', () => {
    expect(
      PatternInstanceHeadersSchema.parse({
        contentType: 'application/json',
        idempotencyKey: 'pattern-insert-0001',
        ifMatch: '"3"',
      }),
    ).toMatchObject({ ifMatch: '"3"' });
    for (const headers of [
      {
        contentType: 'text/plain',
        idempotencyKey: 'pattern-insert-0001',
        ifMatch: '"3"',
      },
      {
        contentType: 'application/json',
        idempotencyKey: 'short',
        ifMatch: '"3"',
      },
      {
        contentType: 'application/json',
        idempotencyKey: 'pattern-insert-0001',
      },
      {
        contentType: 'application/json',
        idempotencyKey: 'pattern-insert-0001',
        ifMatch: 'W/"3"',
      },
      {
        contentType: 'application/json',
        idempotencyKey: 'pattern-insert-0001',
        ifMatch: '"0"',
      },
    ])
      expect(PatternInstanceHeadersSchema.safeParse(headers).success).toBe(
        false,
      );
  });

  it('accepts only the closed browser-safe composition resource', () => {
    expect(CompositionInstanceResourceSchema.parse(resource)).toEqual(resource);
    for (const candidate of [
      { ...resource, ownerId: PATTERN_ID },
      { ...resource, state: 'published' },
      { ...resource, version: '0' },
      { ...resource, path: '/header\nprivate' },
      { ...resource, blockKey: 'unregistered block' },
      { ...resource, blockVersion: 0 },
      { ...resource, patternVersion: 0 },
      { ...resource, conflictState: 'overwritten' },
      { ...resource, linkMode: 'implicit' },
      { ...resource, blockRegistryDigest: 'private' },
    ])
      expect(
        CompositionInstanceResourceSchema.safeParse(candidate).success,
      ).toBe(false);
  });
});
