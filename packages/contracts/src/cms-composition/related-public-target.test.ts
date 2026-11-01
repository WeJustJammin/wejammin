import { describe, expect, it } from 'vitest';

import {
  isRefused,
  issuePaths,
  uid,
  without,
} from './composition-fixtures.test-support';
import {
  CMS_RELATED_RULES,
  RelatedPublicTargetSchema,
  RelatedPublicTargetsRequestSchema,
  RelatedPublicTargetsSchema,
  findRelatedRule,
} from './related-public-target';

const pin = (index: number, position = index) => ({
  entryId: uid(200 + index),
  source: 'pin',
  reasonCode: null,
  position,
});
const derived = (index: number, position = index) => ({
  entryId: uid(200 + index),
  source: 'derived',
  reasonCode: 'shared_terms',
  position,
});

describe('CMS-03C-21 related public targets (D11, OD-5)', () => {
  it('[P2-S12-AC-153] takes the source entry, the locale and the audience of the RPC', () => {
    const request = {
      sourceEntryId: uid(1),
      locale: 'fr-CA',
      audience: 'public',
    };
    expect(RelatedPublicTargetsRequestSchema.parse(request)).toEqual(request);
    for (const candidate of [
      without(request, 'audience'),
      without(request, 'locale'),
      without(request, 'sourceEntryId'),
      { ...request, audience: 'Members' },
      { ...request, audience: ' public' },
      { ...request, audience: '' },
      { ...request, audience: 'a'.repeat(49) },
      { ...request, locale: 'fr_CA' },
      { ...request, sourceEntryId: 'x' },
      { ...request, actorId: uid(2) },
    ])
      expect(isRefused(RelatedPublicTargetsRequestSchema, candidate)).toBe(
        true,
      );
    expect(
      RelatedPublicTargetsRequestSchema.safeParse({
        ...request,
        audience: 'a'.repeat(48),
      }).success,
    ).toBe(true);
  });

  it('[P2-S12-AC-153] accepts a pin without a reason and a derived target with its rule reason', () => {
    expect(RelatedPublicTargetSchema.parse(pin(0))).toEqual(pin(0));
    expect(RelatedPublicTargetSchema.parse(derived(1))).toEqual(derived(1));
    expect(
      RelatedPublicTargetSchema.safeParse({ ...pin(0), reasonCode: 'curated' })
        .success,
    ).toBe(true);
  });

  it('[P2-S12-AC-153] bounds position 0 to 127 and the reason code grammar and refuses any other member', () => {
    for (const position of [0, 127])
      expect(
        RelatedPublicTargetSchema.safeParse({ ...pin(0), position }).success,
      ).toBe(true);
    for (const candidate of [
      { ...pin(0), position: -1 },
      { ...pin(0), position: 128 },
      { ...pin(0), position: 1.5 },
      { ...pin(0), position: '0' },
      { ...pin(0), source: 'exclusion' },
      { ...pin(0), source: 'recommended' },
      { ...pin(0), entryId: 'x' },
      { ...pin(0), reasonCode: 'Shared Terms' },
      { ...pin(0), reasonCode: 'a'.repeat(65) },
      { ...pin(0), reasonCode: '' },
      { ...pin(0), title: 'Hidden entry' },
      { ...pin(0), score: 3 },
      { ...pin(0), ownerId: uid(1) },
      without(pin(0), 'reasonCode'),
      without(pin(0), 'position'),
      without(pin(0), 'source'),
    ])
      expect(isRefused(RelatedPublicTargetSchema, candidate)).toBe(true);
    expect(
      RelatedPublicTargetSchema.safeParse({
        ...derived(0),
        reasonCode: `a${'b'.repeat(63)}`,
      }).success,
    ).toBe(true);
  });

  it('[P2-S12-AC-154] returns at most 128 targets, pins first in position order and then derived candidates in rank order', () => {
    expect(RelatedPublicTargetsSchema.safeParse([]).success).toBe(true);
    expect(
      RelatedPublicTargetsSchema.safeParse([
        pin(0),
        pin(1),
        derived(2),
        derived(3),
      ]).success,
    ).toBe(true);
    const full = Array.from({ length: 128 }, (_, index) => derived(index));
    expect(RelatedPublicTargetsSchema.safeParse(full).success).toBe(true);
    expect(
      isRefused(RelatedPublicTargetsSchema, [...full, derived(128, 127)]),
    ).toBe(true);
    // A derived target before a pin, and pins out of position order.
    expect(
      issuePaths(RelatedPublicTargetsSchema, [derived(0), pin(1)]),
    ).toEqual(['1']);
    expect(
      issuePaths(RelatedPublicTargetsSchema, [pin(0, 2), pin(1, 1)]),
    ).toEqual(['1.position']);
    expect(
      issuePaths(RelatedPublicTargetsSchema, [derived(0, 3), derived(1, 3)]),
    ).toEqual(['1.position']);
  });

  it('[P2-S12-AC-154] lists an entry once, so an exclusion removed it and a pin never duplicates a derived candidate', () => {
    expect(
      issuePaths(RelatedPublicTargetsSchema, [
        pin(0),
        { ...derived(1), entryId: pin(0).entryId },
      ]),
    ).toEqual(['1.entryId']);
    expect(
      issuePaths(RelatedPublicTargetsSchema, [
        pin(0),
        { ...pin(1), entryId: pin(0).entryId.toUpperCase() },
      ]),
    ).toEqual(['1.entryId']);
  });

  it('[P2-S12-AC-229] holds the code-owned rule registry to shared-terms and same-type-recent at version 1', () => {
    expect(CMS_RELATED_RULES).toEqual({
      'shared-terms': { version: '1', reasonCode: 'shared_terms' },
      'same-type-recent': { version: '1', reasonCode: 'same_type_recent' },
    });
    expect(findRelatedRule('shared-terms', '1')).toEqual({
      key: 'shared-terms',
      version: '1',
      reasonCode: 'shared_terms',
    });
    expect(findRelatedRule('same-type-recent', '1')?.reasonCode).toBe(
      'same_type_recent',
    );
  });

  it('[P2-S12-AC-229] resolves an unknown rule key or version to nothing and never inherits a prototype member', () => {
    for (const [key, version] of [
      ['shared-tags', '1'],
      ['shared-terms', '2'],
      ['shared-terms', '01'],
      ['shared-terms', ''],
      ['', '1'],
      ['same-type-recent', '0'],
      ['constructor', '1'],
      ['__proto__', '1'],
      ['toString', '1'],
    ] as const)
      expect(findRelatedRule(key, version), `${key}@${version}`).toBeNull();
  });
});
