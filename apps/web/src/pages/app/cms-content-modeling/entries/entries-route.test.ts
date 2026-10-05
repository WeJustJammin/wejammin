import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const fromHere = (relative: string): string =>
  fileURLToPath(new URL(relative, import.meta.url));

/*
 * These routes are read as text, not rendered. The guarantees that matter
 * here are structural — a heading focus target, a skip link, an explicit
 * status code, a real protected proxy call, and a native authoring form — so
 * asserting on the source keeps the test free of a Cloudflare runtime while
 * still failing if a route is weakened or starts fabricating data.
 *
 * Slice 10 WP-S10-2c rewrites this suite from the fail-closed create shell to
 * the planned CMS-05 authoring surfaces: an active create form on new.astro and
 * a protected draft-detail load plus editor island on [entryId].astro. It is
 * expected to be RED until WP-S10-5 lands those surfaces.
 */
const documentShell = readFileSync(
  fromHere('../../../../components/cms-editorial/CmsEditorialDocument.astro'),
  'utf8',
);

/*
 * The document shell is processed Astro markup, so its script tags are
 * bundled. A page that rebuilt the shell as a runtime HTML string would ship
 * unbuilt .ts URLs, so no entry route may carry a script tag or an HTML string
 * of its own.
 */
const expectSharedBundledShell = (source: string): void => {
  expect(source).toContain('export const prerender = false');
  expect(source).toContain(
    "Astro.response.headers.set('Cache-Control', 'no-store')",
  );
  expect(source).toContain('<CmsEditorialDocument');
  expect(source).not.toContain('<script');
  expect(source).not.toContain('<!doctype');
  expect(source).not.toContain('new Response(');
  expect(documentShell).toContain('lang="en"');
  expect(documentShell).toContain('id="page-title"');
  expect(documentShell).toContain('tabindex="-1"');
  expect(documentShell).toContain('id="cms-editorial-main"');
  expect(documentShell).toContain('aria-label="Skip navigation"');
  expect(documentShell).toContain('src="../../lib/route-heading-focus.ts"');
  expect(documentShell).toContain('src="../../lib/auth-scope-sync.ts"');
};

describe('cms editorial entries routes', () => {
  describe('new.astro (CMS-03B-10 create surface)', () => {
    const source = readFileSync(fromHere('./new.astro'), 'utf8');

    it('serves a no-store, non-prerendered shell with one accessible heading', () => {
      expectSharedBundledShell(source);
    });

    it('renders the native create form instead of a fail-closed 503', () => {
      expect(source).toContain('<form');
      expect(source).toContain('method="post"');
      expect(source).not.toContain('Astro.response.status = 503');
      expect(source).not.toContain('Entry creation is unavailable');
    });

    it('prefills the frozen request evidence from the authoring-context read', () => {
      expect(source).toContain('/api/v1/cms/entries/authoring-context');
      expect(source).toContain('workflowPolicy');
      expect(source).toMatch(/AuthoringContext/u);
      expect(source).not.toContain('set:html');
      expect(source.toLowerCase()).not.toContain('raw json');
    });

    it('names a focus target for create results and validation recovery', () => {
      expect(source).toContain('id="entry-create-title"');
      expect(source).toContain('tabindex="-1"');
    });
  });

  describe('[entryId].astro (CMS-03B-11 draft-detail surface)', () => {
    const source = readFileSync(fromHere('./[entryId].astro'), 'utf8');

    it('serves a no-store, non-prerendered shell with one accessible heading', () => {
      expectSharedBundledShell(source);
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
      expect(source).not.toContain('data-entry-id');
      expect(source).not.toMatch(/entryId\}<\/p>/u);
    });

    it('mounts the bounded authoring editor island so the draft is editable', () => {
      expect(source).toContain('client:load');
      expect(source).toMatch(/WorkbenchIsland/u);
      expect(source).not.toContain('CMS_EDITORIAL_ENTRY_LOADER_BOUNDARY');
    });
  });
});
