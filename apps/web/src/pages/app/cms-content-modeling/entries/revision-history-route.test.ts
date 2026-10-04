import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const source = (): string =>
  readFileSync(
    fileURLToPath(new URL('./[entryId]/revisions.astro', import.meta.url)),
    'utf8',
  );

const documentShell = (): string =>
  readFileSync(
    fileURLToPath(
      new URL(
        '../../../../components/cms-editorial/CmsEditorialDocument.astro',
        import.meta.url,
      ),
    ),
    'utf8',
  );

describe('CMS-07 protected revision-history SSR page', () => {
  it('uses the first-party history read and a no-store accessible document', () => {
    const page = source();
    expect(page).toContain('export const prerender = false');
    expect(page).toContain(
      "Astro.response.headers.set('Cache-Control', 'no-store')",
    );
    expect(page).toContain('<CmsEditorialDocument');
    // The shell is processed markup, so its scripts are bundled; the page never
    // rebuilds a document as a runtime string that would ship unbuilt .ts URLs.
    expect(page).not.toContain('<script');
    expect(page).not.toContain('<!doctype');
    expect(page).not.toContain('new Response(');
    expect(page).toContain('forwardCmsEditorialRevisionHistoryRead');
    expect(page).toContain('env.PLATFORM_API');
    expect(page).toContain('RevisionHistoryPageSchema.safeParse');
    const shell = documentShell();
    expect(shell).toContain('aria-label="Skip navigation"');
    expect(shell).toContain('id="cms-editorial-main"');
    expect(shell).toContain('id="page-title"');
    expect(shell).toContain('tabindex="-1"');
    expect(shell).toContain('lang="en"');
    expect(shell).toContain('src="../../lib/route-heading-focus.ts"');
    expect(shell).toContain('src="../../lib/auth-scope-sync.ts"');
  });

  it('keeps history read-only, separates visible denial from concealment, and handles expired sessions', () => {
    const page = source();
    expect(page).toContain('Astro.redirect');
    expect(page).toMatch(/if \(upstream\.status === 403\)[\s\S]*?status: 403/u);
    expect(page).toMatch(/if \(upstream\.status === 404\)[\s\S]*?status: 404/u);
    expect(page).not.toContain('<form method="post"');
    expect(page).not.toContain('restoreRevision');
    expect(page).not.toContain('dangerouslySetInnerHTML');
  });

  it('renders only safe revision summaries and a URL-owned continuation', () => {
    const page = source();
    expect(page).toContain('item.authorClass');
    expect(page).toContain('item.revisionNumber');
    expect(page).toContain("selection.set('compareRevisionId', item.id)");
    expect(page).toContain("selection.delete('cursor')");
    expect(page).toContain('page.nextCursor');
    expect(page).toContain('URLSearchParams');
    expect(page).toContain('escapeHtml');
    expect(page).toContain('action="${routePath}#history-list-title"');
    expect(page).toContain('id="history-list-title" tabindex="-1"');
    expect(page).toContain('id="history-compare-title" tabindex="-1"');
    expect(page).toContain('#history-compare-title');
  });
});
