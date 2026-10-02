import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const source = (): string =>
  readFileSync(
    fileURLToPath(new URL('./[entryId]/revisions.astro', import.meta.url)),
    'utf8',
  );

describe('CMS-07 protected revision-history SSR page', () => {
  it('uses the first-party history read and a no-store accessible document', () => {
    const page = source();
    expect(page).toContain('export const prerender = false');
    expect(page).toContain("'cache-control': 'no-store'");
    expect(page).toContain('forwardCmsEditorialRevisionHistoryRead');
    expect(page).toContain('env.PLATFORM_API');
    expect(page).toContain('RevisionHistoryPageSchema.safeParse');
    expect(page).toContain('aria-label="Skip navigation"');
    expect(page).toContain('id="cms-editorial-main"');
    expect(page).toContain('id="page-title"');
    expect(page).toContain('tabindex="-1"');
    expect(page).toContain('lang="en"');
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
