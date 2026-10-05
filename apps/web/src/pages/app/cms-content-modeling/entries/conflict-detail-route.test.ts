import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const fromHere = (relative: string): string =>
  fileURLToPath(new URL(relative, import.meta.url));

/*
 * Structural route guard for the planned CMS-03B-12 three-way conflict-detail
 * page `[entryId]/conflicts/[conflictId].astro` (Slice 10 WP-S10-2c /
 * WP-S10-5). Read as text so no Cloudflare runtime is needed; expected to be
 * RED until the page exists.
 */
const source = (): string =>
  readFileSync(fromHere('./[entryId]/conflicts/[conflictId].astro'), 'utf8');

const documentShell = (): string =>
  readFileSync(
    fromHere('../../../../components/cms-editorial/CmsEditorialDocument.astro'),
    'utf8',
  );

describe('CMS-03B-12 protected conflict-detail SSR page', () => {
  it('uses the first-party conflict read and a no-store accessible document', () => {
    const page = source();
    expect(page).toContain('export const prerender = false');
    expect(page).toContain(
      "Astro.response.headers.set('Cache-Control', 'no-store')",
    );
    expect(page).toContain('<CmsEditorialDocument');
    expect(page).not.toContain('<script');
    expect(page).not.toContain('<!doctype');
    expect(page).not.toContain('new Response(');
    expect(page).toContain('ConflictDetailResourceSchema');
    const shell = documentShell();
    expect(shell).toContain('id="cms-editorial-main"');
    expect(shell).toContain('id="page-title"');
  });

  it('addresses both UUIDs, rejecting malformed ones without an upstream call', () => {
    const page = source();
    expect(page).toContain('Astro.params.entryId');
    expect(page).toContain('Astro.params.conflictId');
    expect(page).toContain('CmsUuidSchema');
    expect(page).toMatch(/status: 400|status = 400|status: 404/u);
  });

  it('conceals absent conflicts as 404 and visible denial as 403 without preimages', () => {
    const page = source();
    expect(page).toMatch(/status === 403/u);
    expect(page).toMatch(/status === 404/u);
    expect(page).toContain('This entry is not available.');
    expect(page).not.toContain('resolvedByPersonId');
    expect(page).not.toContain('ownerId');
  });

  it('renders the three sides by named controls with a focus target and no raw HTML', () => {
    const page = source();
    expect(page).toContain('ConflictDetailResourceSchema.safeParse');
    expect(page).toMatch(/base/u);
    expect(page).toMatch(/theirs/u);
    expect(page).toMatch(/yours/u);
    expect(page).toContain('escapeHtml');
    expect(page).not.toContain('dangerouslySetInnerHTML');
    expect(page).toContain('id="conflict-detail-title"');
    expect(page).toContain('tabindex="-1"');
  });
});
