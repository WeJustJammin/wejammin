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
  /*
   * Behavior lives in the tested page loaders and views (load-entry-*-page.test.ts,
   * the island tests and the rendered-markup tests). What a text guard can still
   * prove, and nothing else can, are the response invariants of the Astro file
   * itself: it is never prerendered, never cached, uses the one bundled shell,
   * and maps a sign-in outcome to the allowlisted 303.
   */
  describe.each([
    ['new.astro', './new.astro'],
    ['[entryId].astro', './[entryId].astro'],
  ])('%s', (_name, relative) => {
    const source = readFileSync(fromHere(relative), 'utf8');

    it('serves a no-store, non-prerendered shell with one accessible heading', () => {
      expectSharedBundledShell(source);
    });

    it('turns a sign-in outcome into the allowlisted 303 redirect and nothing else', () => {
      expect(source).toContain('Astro.redirect(outcome.location, 303)');
      expect(source).not.toContain('Astro.redirect(`');
    });

    it('never echoes the requested entry id into the document', () => {
      expect(source).not.toContain('data-entry-id');
    });
  });
});

describe('the draft page links to its workflow', () => {
  const source = readFileSync(fromHere('./[entryId].astro'), 'utf8');

  it('offers a native link to the review and publish workflow beside the editor', () => {
    expect(source).toContain('cmsEditorialAppWorkflowPath(');
    expect(source).toContain('Review and publish');
    expect(source).toContain('<CmsEditorialEntryEditorIsland');
  });
});
