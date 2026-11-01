import { TaxonomySelectorPageSchema } from '@wejammin/contracts';
import { describe, expect, it } from 'vitest';

import { verifiedTaxonomySelectorPage } from './cms-taxonomy-selector-read';
import {
  PARENT_ID,
  SURVIVOR_ID,
  at,
  mutate,
  rows,
  selectorPage,
  selectorTerm,
} from './cms-taxonomy-selector-read.test-support';

/*
 * `verifiedTaxonomySelectorPage` (CMS-03C-17, FE03 :1618/:1747): the browser repeats the strict
 * `TaxonomySelectorPage` structurally (zod-free, AC261) and accepts only the page of THIS request
 * whose quoted ETag is its `pageVersion`. Every fixture is checked against the REAL contract.
 */

const etagOf = (candidate: unknown): string | null => {
  const pageVersion = (candidate as { readonly pageVersion?: unknown } | null)
    ?.pageVersion;
  return typeof pageVersion === 'string' ? `"${pageVersion}"` : null;
};

const ACCEPTED: ReadonlyArray<readonly [string, unknown]> = [
  ['the page of this request', selectorPage()],
  [
    'a hierarchical term with a parent',
    selectorPage({ items: [selectorTerm({ parentId: PARENT_ID })] }),
  ],
  [
    'a flat term without a parent',
    selectorPage({ items: [selectorTerm({ shape: 'flat', parentId: null })] }),
  ],
  [
    'a term without a label for the locale',
    selectorPage({ items: [selectorTerm({ label: null })] }),
  ],
  [
    'a label at the 160-character limit',
    selectorPage({ items: [selectorTerm({ label: 'a'.repeat(160) })] }),
  ],
  [
    'two distinct terms',
    selectorPage({
      items: [
        selectorTerm(),
        selectorTerm({ termId: SURVIVOR_ID, termKey: 'organ', label: 'Organ' }),
      ],
    }),
  ],
  ['a continuation cursor', selectorPage({ nextCursor: 'abc.def' })],
  ['an empty continuation cursor', selectorPage({ nextCursor: '' })],
  [
    'a continuation cursor at the exact 512-character limit',
    selectorPage({ nextCursor: 'a'.repeat(512) }),
  ],
  [
    'an empty page with its own version',
    selectorPage({ items: [], pageVersion: '1' }),
  ],
  ['the full hundred rows', selectorPage({ items: rows(100) })],
];

const REFUSED: ReadonlyArray<readonly [string, unknown]> = [
  ['a non-object body', 'x'],
  ['an extra top-level member', mutate((page) => (page.owner = 'x'))],
  ['a missing cursor member', mutate((page) => delete page.nextCursor)],
  ['a missing items member', mutate((page) => delete page.items)],
  ['a missing version member', mutate((page) => delete page.pageVersion)],
  ['a non-string cursor', mutate((page) => (page.nextCursor = 4))],
  [
    'a cursor that is explicitly undefined',
    mutate((page) => (page.nextCursor = undefined)),
  ],
  [
    'a cursor over 512 characters',
    mutate((page) => (page.nextCursor = 'a'.repeat(513))),
  ],
  ['a version of zero', mutate((page) => (page.pageVersion = '0'))],
  [
    'a version outside the signed range',
    mutate((page) => (page.pageVersion = '9223372036854775808')),
  ],
  ['a numeric version', mutate((page) => (page.pageVersion = 7))],
  ['items that are not a list', mutate((page) => (page.items = 'x'))],
  ['more than a hundred rows', mutate((page) => (page.items = rows(101)))],
  ['an extra member of a term', mutate((page) => (at(page, 0).owner = 'x'))],
  ['a term without an id', mutate((page) => delete at(page, 0).termId)],
  ['a term without a label', mutate((page) => delete at(page, 0).label)],
  ['a malformed term id', mutate((page) => (at(page, 0).termId = 'x'))],
  [
    'a malformed vocabulary id',
    mutate((page) => (at(page, 0).taxonomyId = 'x')),
  ],
  [
    'a malformed version id',
    mutate((page) => (at(page, 0).taxonomyVersionId = 'x')),
  ],
  ['a malformed parent id', mutate((page) => (at(page, 0).parentId = 'x'))],
  [
    'a malformed vocabulary key',
    mutate((page) => (at(page, 0).taxonomyKey = 'Bad')),
  ],
  ['a malformed term key', mutate((page) => (at(page, 0).termKey = 'Bad'))],
  [
    'a shape outside the grammar',
    mutate((page) => (at(page, 0).shape = 'round')),
  ],
  ['an empty label', mutate((page) => (at(page, 0).label = ''))],
  [
    'a label over 160 characters',
    mutate((page) => (at(page, 0).label = 'a'.repeat(161))),
  ],
  ['a non-string label', mutate((page) => (at(page, 0).label = 4))],
  [
    'a flat term with a parent',
    mutate((page) =>
      Object.assign(at(page, 0), { shape: 'flat', parentId: PARENT_ID }),
    ),
  ],
];

describe('verifiedTaxonomySelectorPage', () => {
  it('returns the whole page of THIS request whose ETag is its version', () => {
    const verified = verifiedTaxonomySelectorPage(selectorPage(), '"7"');
    expect(verified).toEqual(selectorPage());
    expect(verified?.pageVersion).toBe('7');
    expect(verified?.nextCursor).toBeNull();
    expect(verified?.items.map((item) => item.termKey)).toEqual(['guitar']);
  });

  it.each(ACCEPTED)('accepts %s', (_name, candidate) => {
    expect(
      verifiedTaxonomySelectorPage(candidate, etagOf(candidate)),
    ).not.toBeNull();
  });

  it.each(REFUSED)('refuses %s', (_name, candidate) => {
    expect(
      verifiedTaxonomySelectorPage(candidate, etagOf(candidate)),
    ).toBeNull();
  });

  const WRONG_ETAGS: ReadonlyArray<readonly [string, unknown, string | null]> =
    [
      ['a wrong ETag', selectorPage(), '"8"'],
      ['a missing ETag', selectorPage(), null],
      ['a weak ETag', selectorPage(), 'W/"7"'],
      ['a bare version as ETag', selectorPage(), '7'],
      [
        'an ETag of another page',
        mutate((page) => (page.pageVersion = '8')),
        '"7"',
      ],
    ];

  it.each(WRONG_ETAGS)('refuses %s', (_name, candidate, etag) => {
    expect(verifiedTaxonomySelectorPage(candidate, etag)).toBeNull();
  });

  it('is stricter than the contract on a repeated term id', () => {
    const repeated = mutate((page) => {
      const items = page.items as Array<Record<string, unknown>>;
      items[1] = items[0] as Record<string, unknown>;
    });
    expect(TaxonomySelectorPageSchema.safeParse(repeated).success).toBe(true);
    expect(verifiedTaxonomySelectorPage(repeated, '"7"')).toBeNull();
  });

  it('agrees with the real TaxonomySelectorPageSchema on every fixture', () => {
    const parity: ReadonlyArray<readonly [string, unknown, boolean]> = [
      ...ACCEPTED.map((entry) => [...entry, true] as const),
      ...REFUSED.map((entry) => [...entry, false] as const),
    ];
    for (const [name, candidate, expected] of parity) {
      expect(
        TaxonomySelectorPageSchema.safeParse(candidate).success,
        `${name} (contract)`,
      ).toBe(expected);
      expect(
        verifiedTaxonomySelectorPage(candidate, etagOf(candidate)) !== null,
        `${name} (browser)`,
      ).toBe(expected);
    }
  });
});
