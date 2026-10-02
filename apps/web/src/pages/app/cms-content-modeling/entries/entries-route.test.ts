import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const fromHere = (relative: string): string =>
  fileURLToPath(new URL(relative, import.meta.url));

/*
 * These routes are read as text, not rendered. The guarantees that matter
 * here are structural — a heading focus target, a skip link, an explicit
 * status code, a real protected proxy call, and the absence of any form — so
 * asserting on the source keeps the test free of a Cloudflare runtime while
 * still failing if a route is weakened or starts fabricating data.
 */
describe('cms editorial entries routes', () => {
  describe('new.astro (CMS-03B-10 create surface)', () => {
    const source = readFileSync(fromHere('./new.astro'), 'utf8');

    it('serves a no-store, non-prerendered shell with one accessible heading', () => {
      expect(source).toContain('export const prerender = false');
      expect(source).toContain("'cache-control': 'no-store'");
      expect(source).toContain('lang="en"');
      expect(source).toContain('id="page-title"');
      expect(source).toContain('tabindex="-1"');
      expect(source).toContain('id="cms-editorial-main"');
      expect(source).toContain('aria-label="Skip navigation"');
      expect(source).toContain('src="../../../../lib/route-heading-focus.ts"');
    });

    it('stays fail-closed and fabricates no write path', () => {
      expect(source).toContain('status: 503');
      expect(source).not.toContain('<form');
      expect(source).not.toContain('<input');
      expect(source.toLowerCase()).not.toContain('idempotency');
      // No submission can be attempted while the surface is disabled.
      expect(source).not.toContain('forwardCmsEditorialEntryCreateMutation');
    });

    it('traces the disabled reason to the owning boundary', () => {
      expect(source).toContain('CMS_EDITORIAL_ENTRY_CREATE_BOUNDARY');
      expect(source).toContain('CMS_EDITORIAL_ENTRY_CREATE_BOUNDARY.blocker');
      expect(source).toContain('CMS_EDITORIAL_ENTRY_CREATE_DISABLED_REASON');
      expect(source).toContain('escapeHtml');
    });
  });

  describe('[entryId].astro (CMS-03B-11 draft-detail surface)', () => {
    const source = readFileSync(fromHere('./[entryId].astro'), 'utf8');

    it('serves a no-store, non-prerendered shell with one accessible heading', () => {
      expect(source).toContain('export const prerender = false');
      expect(source).toContain("'cache-control': 'no-store'");
      expect(source).toContain('lang="en"');
      expect(source).toContain('id="page-title"');
      expect(source).toContain('tabindex="-1"');
      expect(source).toContain('id="cms-editorial-main"');
      expect(source).toContain('aria-label="Skip navigation"');
      expect(source).toContain('src="../../../../lib/route-heading-focus.ts"');
    });

    it('performs the real protected read through the first-party proxy', () => {
      expect(source).toContain("from 'cloudflare:workers'");
      expect(source).toContain('{ env }');
      expect(source).toContain('forwardCmsEditorialEntryDraftDetailRead');
      expect(source).toContain('env.PLATFORM_API');
      expect(source).toContain('resolveCmsEditorialEntryDraftDetailPageState');
    });

    it('answers a malformed id with 404 without an upstream call', () => {
      expect(source).toMatch(/kind === 'not-found'/u);
      expect(source).toContain('status: 404');
    });

    it('preserves visible denial as 403 while concealing absent entries as 404', () => {
      expect(source).toMatch(
        /if \(upstream\.status === 403\)[\s\S]*?status: 403/u,
      );
      expect(source).toMatch(
        /if \(upstream\.status === 404\)[\s\S]*?status: 404/u,
      );
      expect(source).toContain('This entry is not available.');
    });

    it('redirects an unauthenticated read to sign-in instead of erroring', () => {
      expect(source).toContain('upstream.status === 401');
      expect(source).toContain('Astro.redirect');
    });

    it('verifies the returned body against the shared resource schema', () => {
      expect(source).toContain('CmsEditorialEntryDraftDetailResourceSchema');
      expect(source).toContain('.safeParse(');
      expect(source).toContain('status: 502');
    });

    it('never echoes the requested entry id into the document', () => {
      expect(source).not.toContain('${entryId}</');
      expect(source).not.toContain('data-entry-id');
    });
  });
});
