import { describe, expect, it } from 'vitest';

import {
  RelatedContentHeadersSchema,
  RelatedContentPathSchema,
  RelatedContentRuleRequestSchema,
  RelatedContentResourceSchema,
} from './related-content';

const ENTRY_ID = '10000000-0000-4000-8000-000000000001';
const TARGET_A = '20000000-0000-4000-8000-000000000002';
const TARGET_B = '30000000-0000-4000-8000-000000000003';
const RULE_ID = '40000000-0000-4000-8000-000000000004';
const HASH = 'a'.repeat(64);
const request = {
  entryId: ENTRY_ID,
  pins: [TARGET_A],
  exclusions: [TARGET_B],
  derivedRule: {
    key: 'similar-genre',
    version: '2',
    reasonCode: 'genre_match',
    maxCandidates: 20,
  },
  expectedVersion: '1',
};
const resource = {
  id: RULE_ID,
  version: '2',
  contentHash: HASH,
  createdAt: '2026-09-27T12:00:00Z',
  updatedAt: '2026-09-27T12:00:00Z',
  state: 'active',
  sourceEntryId: ENTRY_ID,
  pins: [TARGET_A],
  exclusions: [TARGET_B],
  derivedRule: { key: 'similar-genre', version: '2' },
  eligibleCount: 1,
};

describe('CMS-03C-05 related-content wire contract', () => {
  it('accepts the addressed rule and an explicit no-derived-rule command', () => {
    expect(RelatedContentPathSchema.parse({ entryId: ENTRY_ID })).toEqual({
      entryId: ENTRY_ID,
    });
    expect(RelatedContentRuleRequestSchema.parse(request)).toEqual(request);
    expect(
      RelatedContentRuleRequestSchema.safeParse({
        ...request,
        pins: [],
        exclusions: [],
        derivedRule: null,
      }).success,
    ).toBe(true);
  });

  it('rejects malformed addressing, caller authority, version, and rule input', () => {
    for (const path of [
      { entryId: 'private' },
      { entryId: ENTRY_ID, ownerId: ENTRY_ID },
    ])
      expect(RelatedContentPathSchema.safeParse(path).success).toBe(false);
    for (const candidate of [
      { ...request, ownerId: ENTRY_ID },
      { ...request, entryId: 'private' },
      { ...request, expectedVersion: '0' },
      {
        ...request,
        derivedRule: { ...request.derivedRule, key: 'Invalid.Key' },
      },
      { ...request, derivedRule: { ...request.derivedRule, version: '0' } },
      {
        ...request,
        derivedRule: { ...request.derivedRule, reasonCode: 'Private reason' },
      },
      { ...request, derivedRule: { ...request.derivedRule, maxCandidates: 0 } },
      {
        ...request,
        derivedRule: { ...request.derivedRule, maxCandidates: 129 },
      },
      {
        ...request,
        derivedRule: { ...request.derivedRule, privateQuery: 'private' },
      },
    ])
      expect(RelatedContentRuleRequestSchema.safeParse(candidate).success).toBe(
        false,
      );
  });

  it('bounds and deduplicates pins and exclusions with no ambiguous overlap', () => {
    for (const candidate of [
      { ...request, pins: Array.from({ length: 33 }, () => TARGET_A) },
      { ...request, pins: [TARGET_A, TARGET_A] },
      { ...request, pins: ['private'] },
      { ...request, exclusions: Array.from({ length: 65 }, () => TARGET_B) },
      { ...request, exclusions: [TARGET_B, TARGET_B] },
      { ...request, exclusions: ['private'] },
      { ...request, exclusions: [TARGET_A] },
    ])
      expect(RelatedContentRuleRequestSchema.safeParse(candidate).success).toBe(
        false,
      );
  });

  it('requires idempotent JSON and a strong source-entry validator', () => {
    expect(
      RelatedContentHeadersSchema.parse({
        contentType: 'application/json',
        idempotencyKey: 'related-content-0001',
        ifMatch: '"1"',
      }),
    ).toMatchObject({ ifMatch: '"1"' });
    for (const headers of [
      {
        contentType: 'text/plain',
        idempotencyKey: 'related-content-0001',
        ifMatch: '"1"',
      },
      {
        contentType: 'application/json',
        idempotencyKey: 'short',
        ifMatch: '"1"',
      },
      {
        contentType: 'application/json',
        idempotencyKey: 'related-content-0001',
      },
      {
        contentType: 'application/json',
        idempotencyKey: 'related-content-0001',
        ifMatch: 'W/"1"',
      },
    ])
      expect(RelatedContentHeadersSchema.safeParse(headers).success).toBe(
        false,
      );
  });

  it('exposes only the closed browser-safe rule and eligible count', () => {
    expect(RelatedContentResourceSchema.parse(resource)).toEqual(resource);
    expect(
      RelatedContentResourceSchema.safeParse({
        ...resource,
        state: 'revoked',
        derivedRule: null,
        eligibleCount: 0,
      }).success,
    ).toBe(true);
    for (const candidate of [
      { ...resource, ownerId: ENTRY_ID },
      { ...resource, state: 'hidden' },
      { ...resource, sourceEntryId: 'private' },
      {
        ...resource,
        derivedRule: { ...resource.derivedRule, reasonCode: 'private' },
      },
      { ...resource, eligibleCount: -1 },
      { ...resource, eligibleCount: 129 },
      { ...resource, pins: Array.from({ length: 33 }, () => TARGET_A) },
      { ...resource, exclusions: Array.from({ length: 65 }, () => TARGET_B) },
    ])
      expect(RelatedContentResourceSchema.safeParse(candidate).success).toBe(
        false,
      );
  });
});
