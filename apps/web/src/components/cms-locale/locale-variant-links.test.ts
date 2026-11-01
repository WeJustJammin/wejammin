import { describe, expect, it } from 'vitest';

import { localeVariantLinks } from './locale-variant-links';
import { ENTRY_ID } from './locale-variant.test-support';

describe('localeVariantLinks (the entry page reaches the locale page, FE03 :1073)', () => {
  it('links every supported language except the source, in the version’s order', () => {
    expect(
      localeVariantLinks(
        ENTRY_ID,
        ['en-US', 'fr', 'fr-CA', 'zh-Hans-CN'],
        'en-US',
      ),
    ).toEqual([
      {
        locale: 'fr',
        href: `/app/cms-content-modeling/entries/${ENTRY_ID}/locales/fr`,
      },
      {
        locale: 'fr-CA',
        href: `/app/cms-content-modeling/entries/${ENTRY_ID}/locales/fr-CA`,
      },
      {
        locale: 'zh-Hans-CN',
        href: `/app/cms-content-modeling/entries/${ENTRY_ID}/locales/zh-Hans-CN`,
      },
    ]);
  });

  it('compares the source language without regard to case and drops malformed tags and duplicates', () => {
    expect(
      localeVariantLinks(ENTRY_ID, ['EN-us', 'fr_CA', 'fr', 'FR'], 'en-US').map(
        (link) => link.locale,
      ),
    ).toEqual(['fr']);
  });

  it('links nothing for a malformed entry id', () => {
    expect(localeVariantLinks('nope', ['fr'], 'en-US')).toEqual([]);
  });
});
