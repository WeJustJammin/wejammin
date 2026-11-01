/**
 * The draft page's two reachability links (vertical-slices rule): Composition (web-composition report request 1) and
 * the Translate navigation (web-locale report request 1). The markup of the Translate navigation is rendered for real;
 * the Astro file is guarded for what only its source can show.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import CmsEntryTranslateLinks from '../../../../components/cms-locale/CmsEntryTranslateLinks';

const fromHere = (relative: string): string =>
  fileURLToPath(new URL(relative, import.meta.url));
const ENTRY = '018f0c45-73fe-7dc2-9c09-68f7ecf132dc';

describe('CmsEntryTranslateLinks', () => {
  it('renders one native link per language in a labelled navigation', () => {
    const html = renderToStaticMarkup(
      <CmsEntryTranslateLinks
        links={[
          { locale: 'fr-FR', href: `/app/x/${ENTRY}/locales/fr-FR` },
          { locale: 'de-DE', href: `/app/x/${ENTRY}/locales/de-DE` },
        ]}
      />,
    );
    expect(html).toContain('<nav aria-label="Translate">');
    expect(html).toContain(
      `<a href="/app/x/${ENTRY}/locales/fr-FR">Translate to fr-FR</a>`,
    );
    expect(html).toContain(
      `<a href="/app/x/${ENTRY}/locales/de-DE">Translate to de-DE</a>`,
    );
    expect(html.match(/<li>/gu)).toHaveLength(2);
  });

  it('renders nothing without a link', () => {
    expect(renderToStaticMarkup(<CmsEntryTranslateLinks links={[]} />)).toBe(
      '',
    );
  });

  it('escapes a locale tag it is handed', () => {
    const html = renderToStaticMarkup(
      <CmsEntryTranslateLinks links={[{ locale: '<b>', href: '/x' }]} />,
    );
    expect(html).not.toContain('<b>');
  });
});

describe('the entry page reaches the composition and locale pages', () => {
  const source = readFileSync(fromHere('./[entryId].astro'), 'utf8');

  it('links to the composition page from the draft editor, only for a valid entry id', () => {
    expect(source).toContain('compositionPagePath(Astro.params.entryId');
    expect(source).toContain('<a href={compositionPath}>Composition</a>');
    expect(source).toContain('compositionPath !== null');
  });

  it('renders the Translate navigation from the loader view and hydrates only the editor island', () => {
    expect(source).toContain(
      '<CmsEntryTranslateLinks links={outcome.view.translateLinks} />',
    );
    expect(source.match(/client:load/gu)).toHaveLength(1);
  });

  it('stays within the 200-line file budget', () => {
    expect(source.split('\n').length).toBeLessThanOrEqual(200);
  });
});
