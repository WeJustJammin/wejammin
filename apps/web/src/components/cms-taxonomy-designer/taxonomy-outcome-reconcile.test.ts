import type { TaxonomyVersionRequest } from '@wejammin/contracts';
import { describe, expect, it } from 'vitest';

import {
  TAXONOMY_ID,
  ROW_ID,
  versionRequestBody,
  versionsPageFixture,
} from '../../server/cms-taxonomy-platform.test-support';
import {
  isNewerThanBase,
  reconcileUnknownVersionOutcome,
  versionIdentityValid,
} from './taxonomy-outcome-reconcile';
import type {
  TaxonomyVersionFacts,
  TaxonomyVersionsResult,
} from './taxonomy-versions-read';

const items = versionsPageFixture().items as unknown as TaxonomyVersionFacts[];
const loaded = (
  list: readonly TaxonomyVersionFacts[],
): TaxonomyVersionsResult => ({
  kind: 'loaded',
  page: { items: list, pageVersion: '9' },
});
const attempt = (overrides: Readonly<Record<string, unknown>> = {}) =>
  versionRequestBody({
    expectedVersion: '2',
    ...overrides,
  }) as unknown as TaxonomyVersionRequest;
/** The version 3 of the fixture: draft, hierarchical, article+profile, tags, role. */
const own = items[0] as TaxonomyVersionFacts;

describe('reconcileUnknownVersionOutcome', () => {
  it('reads an equal next version as the attempt having committed', () => {
    expect(reconcileUnknownVersionOutcome(attempt(), loaded(items))).toEqual({
      kind: 'created',
      resource: {
        id: own.id,
        taxonomyId: TAXONOMY_ID,
        taxonomyKey: 'instruments',
        taxonomyVersion: 3,
        version: '3',
      },
    });
  });

  it.each([
    ['another shape', { shape: 'flat' }],
    ['other type keys', { allowedTypeKeys: ['article'] }],
    ['type keys in another order', { allowedTypeKeys: ['profile', 'article'] }],
    ['other field keys', { allowedFieldKeys: ['topics'] }],
    ['other domains', { canonicalOverlapDomains: [] }],
  ])('does not read a next version with %s as the attempt', (_name, change) => {
    expect(
      reconcileUnknownVersionOutcome(attempt(change), loaded(items)).kind,
    ).toBe('undetermined');
  });

  it('reads the version the attempt was based on as still the latest: nothing was saved', () => {
    const [, second] = items as [TaxonomyVersionFacts, TaxonomyVersionFacts];
    expect(reconcileUnknownVersionOutcome(attempt(), loaded([second]))).toEqual(
      { kind: 'not-saved' },
    );
  });

  it('is undetermined for a newer or foreign latest, an empty page, a refusal and an unavailable read', () => {
    expect(
      reconcileUnknownVersionOutcome(
        attempt({ expectedVersion: '1' }),
        loaded(items),
      ).kind,
    ).toBe('undetermined');
    expect(reconcileUnknownVersionOutcome(attempt(), loaded([])).kind).toBe(
      'undetermined',
    );
    expect(
      reconcileUnknownVersionOutcome(attempt(), {
        kind: 'rejected',
        status: 404,
      }).kind,
    ).toBe('undetermined');
    expect(
      reconcileUnknownVersionOutcome(attempt(), { kind: 'unavailable' }).kind,
    ).toBe('undetermined');
  });

  it('never reads a first version as saved from another key', () => {
    const first = versionRequestBody({
      expectedVersion: null,
      taxonomyKey: 'moods',
    }) as unknown as TaxonomyVersionRequest;
    const onlyOne = { ...(items.at(-1) as TaxonomyVersionFacts) };
    expect(reconcileUnknownVersionOutcome(first, loaded([onlyOne])).kind).toBe(
      'undetermined',
    );
  });
});

describe('version identity', () => {
  const base = { id: ROW_ID, version: '2', contentHash: 'a'.repeat(64) };
  it('is comparable when newer, or when it is that very row', () => {
    expect(
      versionIdentityValid(base, {
        ...base,
        version: '3',
        id: 'other',
        contentHash: 'b'.repeat(64),
      }),
    ).toBe(true);
    expect(versionIdentityValid(base, base)).toBe(true);
  });

  it('is not comparable when older, or a foreign row of the same number', () => {
    expect(versionIdentityValid(base, { ...base, version: '1' })).toBe(false);
    expect(versionIdentityValid(base, { ...base, id: 'other' })).toBe(false);
    expect(
      versionIdentityValid(base, { ...base, contentHash: 'b'.repeat(64) }),
    ).toBe(false);
  });

  it('compares versions as integers, not text', () => {
    expect(isNewerThanBase({ version: '10' }, { version: '9' })).toBe(true);
    expect(isNewerThanBase({ version: '9' }, { version: '10' })).toBe(false);
    expect(isNewerThanBase({ version: '2' }, { version: '2' })).toBe(false);
    expect(isNewerThanBase({ version: '1' }, null)).toBe(true);
  });
});
