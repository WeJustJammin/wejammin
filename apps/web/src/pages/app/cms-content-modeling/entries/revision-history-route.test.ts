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

  it('separates visible denial from concealment and handles expired sessions', () => {
    const page = source();
    expect(page).toContain('Astro.redirect');
    expect(page).toMatch(/status === 403/u);
    expect(page).toMatch(/status === 404/u);
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

  it('groups the D5 comparison by domain for field, block, and relation changes', () => {
    const page = source();
    expect(page).toMatch(/change\.domain/u);
    expect(page).toMatch(/\bblock\b/u);
    expect(page).toMatch(/\brelation\b/u);
    // Relation diffs expose a keyed token, never a resolvable target UUID.
    expect(page).toMatch(/targetToken/u);
  });

  it('offers the D6 restore confirmation form gated on chain availability', () => {
    const page = source();
    expect(page).toContain('revisionId');
    expect(page).toContain('migrationChainId');
    expect(page).toContain('edgeCount');
    expect(page).toMatch(/availability/u);
    expect(page).toMatch(/chain_unavailable|transform_missing/u);
    // The restore is a real mutation form, not a read-only summary.
    expect(page).toContain('<form');
    expect(page).toMatch(/Restore/u);
  });
});
