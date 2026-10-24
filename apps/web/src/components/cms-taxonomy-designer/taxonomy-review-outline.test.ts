import { describe, expect, it } from 'vitest';

import { versionsPageFixture } from '../../server/cms-taxonomy-platform.test-support';
import { reviewRows, type DraftRules } from './taxonomy-review-outline';
import type { TaxonomyVersionFacts } from './taxonomy-versions-read';

const latest = (
  versionsPageFixture().items as unknown as TaxonomyVersionFacts[]
)[0] as TaxonomyVersionFacts;
const draft = (overrides: Partial<DraftRules> = {}): DraftRules => ({
  shape: 'hierarchical',
  typeKeys: ['article', 'profile'],
  fieldKeys: ['tags'],
  domains: ['role'],
  ...overrides,
});
const byName = (rows: ReturnType<typeof reviewRows>, name: string) =>
  rows.find((row) => row.setting === name);

describe('reviewRows', () => {
  it('says Same for every setting when the draft equals the latest version', () => {
    const rows = reviewRows(draft(), latest);
    expect(rows.map((row) => row.setting)).toEqual([
      'Shape',
      'Content type keys',
      'Field keys',
      'Canonical domains declared',
    ]);
    for (const row of rows) expect(row.difference).toBe('Same');
  });

  it('shows the two sides as text', () => {
    const row = byName(reviewRows(draft({ shape: 'flat' }), latest), 'Shape');
    expect(row).toEqual({
      setting: 'Shape',
      yours: 'Flat',
      latest: 'Hierarchical',
      difference: 'Changed',
    });
  });

  it('names the keys that are only on one side', () => {
    const row = byName(
      reviewRows(draft({ typeKeys: ['article', 'release'] }), latest),
      'Content type keys',
    );
    expect(row?.difference).toBe(
      'Only in your draft: release. Only in the latest version: profile.',
    );
    expect(row?.yours).toBe('article, release');
    expect(row?.latest).toBe('article, profile');
  });

  it('says the order differs when the keys are the same', () => {
    expect(
      byName(
        reviewRows(
          draft({ fieldKeys: ['tags'], typeKeys: ['profile', 'article'] }),
          latest,
        ),
        'Content type keys',
      )?.difference,
    ).toBe('Same keys in a different order.');
  });

  it('describes the declared domains by name and an empty declaration in words', () => {
    const row = byName(
      reviewRows(draft({ domains: [] }), latest),
      'Canonical domains declared',
    );
    expect(row).toEqual({
      setting: 'Canonical domains declared',
      yours: 'None',
      latest: 'Role',
      difference: 'Only in the latest version: Role.',
    });
    expect(
      byName(
        reviewRows(draft({ domains: ['role', 'gear'] }), latest),
        'Canonical domains declared',
      )?.difference,
    ).toBe('Only in your draft: Gear.');
  });
});
