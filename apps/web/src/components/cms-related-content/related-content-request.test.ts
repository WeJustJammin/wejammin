import { RelatedContentRuleRequestSchema } from '@wejammin/contracts';
import { describe, expect, it } from 'vitest';

import { MAX_EXCLUSIONS, MAX_PINS } from './related-content-lists';
import {
  buildRelatedContentRequest,
  type RelatedContentFields,
} from './related-content-request';

const ENTRY = '018f0c45-73fe-7dc2-9c09-68f7ecf132dc';
const id = (n: number): string =>
  `018f0c45-73fe-7dc2-9c09-${String(n).padStart(12, '0')}`;
const context = { entryId: ENTRY, entryVersion: '4' };
const fields = (
  extra: Partial<RelatedContentFields> = {},
): RelatedContentFields => ({
  lists: { pins: [id(2), id(1)], exclusions: [id(3)] },
  ruleKey: '',
  maxCandidates: '',
  ...extra,
});

describe('buildRelatedContentRequest', () => {
  it('builds the strict wire request: ordered pins, exclusions, no rule, the entry version', () => {
    const built = buildRelatedContentRequest(fields(), context);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.value).toEqual({
      entryId: ENTRY,
      pins: [id(2), id(1)],
      exclusions: [id(3)],
      derivedRule: null,
      expectedVersion: '4',
    });
    expect(RelatedContentRuleRequestSchema.safeParse(built.value).success).toBe(
      true,
    );
    expect(JSON.parse(built.body)).toEqual(built.value);
  });

  it('fills the derived rule from the registry: version and reason are never typed', () => {
    const built = buildRelatedContentRequest(
      fields({ ruleKey: 'shared-terms', maxCandidates: '12' }),
      context,
    );
    expect(built.ok && built.value.derivedRule).toEqual({
      key: 'shared-terms',
      version: '1',
      reasonCode: 'shared_terms',
      maxCandidates: 12,
    });
    expect(
      built.ok &&
        RelatedContentRuleRequestSchema.safeParse(built.value).success,
    ).toBe(true);
  });

  it('accepts the 1 and 128 boundaries and the full 32 pins and 64 exclusions', () => {
    for (const maxCandidates of ['1', '128']) {
      const built = buildRelatedContentRequest(
        fields({ ruleKey: 'same-type-recent', maxCandidates }),
        context,
      );
      expect(built.ok, maxCandidates).toBe(true);
    }
    const full = buildRelatedContentRequest(
      fields({
        lists: {
          pins: Array.from({ length: MAX_PINS }, (_, n) => id(n)),
          exclusions: Array.from({ length: MAX_EXCLUSIONS }, (_, n) =>
            id(100 + n),
          ),
        },
      }),
      context,
    );
    expect(
      full.ok && RelatedContentRuleRequestSchema.safeParse(full.value).success,
    ).toBe(true);
  });

  it.each([
    '',
    ' ',
    '0',
    '129',
    '-1',
    '1.5',
    '1e2',
    '0x10',
    'twelve',
    '0012',
    '012',
    '007',
  ])(
    'refuses max candidates %j when a rule is chosen, at the field',
    (maxCandidates) => {
      const built = buildRelatedContentRequest(
        fields({ ruleKey: 'shared-terms', maxCandidates }),
        context,
      );
      expect(built.ok).toBe(false);
      if (built.ok) return;
      expect(built.issues).toEqual([
        expect.objectContaining({
          code:
            maxCandidates.trim() === ''
              ? 'max_candidates_required'
              : 'max_candidates_range',
          target: 'maxCandidates',
        }),
      ]);
    },
  );

  it('ignores the candidate count when no rule is chosen (it is never sent)', () => {
    const built = buildRelatedContentRequest(
      fields({ ruleKey: '', maxCandidates: '999' }),
      context,
    );
    expect(built.ok && built.value.derivedRule).toBeNull();
  });

  it('fills the registry reason of each rule, not one shared value', () => {
    const built = buildRelatedContentRequest(
      fields({ ruleKey: 'same-type-recent', maxCandidates: '3' }),
      context,
    );
    expect(built.ok && built.value.derivedRule).toEqual({
      key: 'same-type-recent',
      version: '1',
      reasonCode: 'same_type_recent',
      maxCandidates: 3,
    });
  });

  it('refuses 65 exclusions as the wire contract would', () => {
    const built = buildRelatedContentRequest(
      fields({
        lists: {
          pins: [],
          exclusions: Array.from({ length: MAX_EXCLUSIONS + 1 }, (_, n) =>
            id(n),
          ),
        },
      }),
      context,
    );
    expect(!built.ok && built.issues[0]?.code).toBe('exclusions_limit');
  });

  it('refuses a rule key that is not in the registry', () => {
    const built = buildRelatedContentRequest(
      fields({ ruleKey: 'top-rated' as never, maxCandidates: '5' }),
      context,
    );
    expect(built.ok).toBe(false);
    expect(!built.ok && built.issues[0]).toMatchObject({
      code: 'rule_unknown',
      target: 'rule',
    });
  });

  it('refuses a malformed entry id or version before any send', () => {
    for (const bad of [
      { entryId: 'nope', entryVersion: '4' },
      { entryId: ENTRY, entryVersion: '0' },
      { entryId: ENTRY, entryVersion: '04' },
      { entryId: ENTRY, entryVersion: '' },
    ]) {
      const built = buildRelatedContentRequest(fields(), bad);
      expect(built.ok, JSON.stringify(bad)).toBe(false);
      expect(!built.ok && built.issues[0]).toMatchObject({ target: 'form' });
    }
  });

  it('refuses an overlong or overlapping list as the wire contract would', () => {
    const tooManyPins = buildRelatedContentRequest(
      fields({
        lists: {
          pins: Array.from({ length: MAX_PINS + 1 }, (_, n) => id(n)),
          exclusions: [],
        },
      }),
      context,
    );
    expect(!tooManyPins.ok && tooManyPins.issues[0]?.code).toBe('pins_limit');
    const overlap = buildRelatedContentRequest(
      fields({ lists: { pins: [id(1)], exclusions: [id(1)] } }),
      context,
    );
    expect(!overlap.ok && overlap.issues[0]?.code).toBe(
      'pin_exclusion_overlap',
    );
  });

  it('is deterministic: the same fields give the same body (the identity of an attempt)', () => {
    const a = buildRelatedContentRequest(fields(), context);
    const b = buildRelatedContentRequest(fields(), context);
    expect(a.ok && b.ok && a.body === b.body).toBe(true);
    const moved = buildRelatedContentRequest(
      fields({ lists: { pins: [id(1), id(2)], exclusions: [id(3)] } }),
      context,
    );
    expect(a.ok && moved.ok && a.body !== moved.body).toBe(true);
  });
});
