import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const fromHere = (relative: string): string =>
  fileURLToPath(new URL(relative, import.meta.url));

/*
 * Structural route guard for the planned CMS-03B-13 entry-list page
 * `entries/index.astro` (Slice 10 WP-S10-2c / WP-S10-5). It is read as text so
 * the check needs no Cloudflare runtime; it is expected to be RED until the
 * page exists.
 */
const source = (): string => readFileSync(fromHere('./index.astro'), 'utf8');

const documentShell = (): string =>
  readFileSync(
    fromHere('../../../../components/cms-editorial/CmsEditorialDocument.astro'),
    'utf8',
  );

describe('CMS-03B-13 protected entry-list SSR page', () => {
  it('uses the first-party list read and a no-store accessible document', () => {
    const page = source();
    expect(page).toContain('export const prerender = false');
    expect(page).toContain(
      "Astro.response.headers.set('Cache-Control', 'no-store')",
    );
    expect(page).toContain('<CmsEditorialDocument');
    expect(page).not.toContain('<script');
    expect(page).not.toContain('<!doctype');
    expect(page).not.toContain('new Response(');
    expect(page).toContain('EntryListPageSchema');
    const shell = documentShell();
    expect(shell).toContain('aria-label="Skip navigation"');
    expect(shell).toContain('id="cms-editorial-main"');
    expect(shell).toContain('id="page-title"');
  });

  it('authenticates, separates denial from concealment, and owns the query in the URL', () => {
    const page = source();
    expect(page).toContain('Astro.redirect');
    expect(page).toMatch(/status === 403/u);
    expect(page).toMatch(/status === 404/u);
    expect(page).toContain('URLSearchParams');
    expect(page).toMatch(/\bcursor\b/u);
    expect(page).toMatch(/\blimit\b/u);
    expect(page).toMatch(/\bstate\b/u);
    expect(page).toContain('escapeHtml');
  });

  it('lists only authorized summaries with a URL-owned continuation and no mutation', () => {
    const page = source();
    expect(page).toContain('EntryListPageSchema.safeParse');
    expect(page).toMatch(/item\.revisionNumber/u);
    expect(page).toContain('nextCursor');
    expect(page).not.toContain('<form method="post"');
    expect(page).not.toContain('dangerouslySetInnerHTML');
    expect(page).toContain('id="entry-list-title"');
    expect(page).toContain('tabindex="-1"');
  });
});
