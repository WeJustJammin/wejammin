import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const source = readFileSync(
  fileURLToPath(
    new URL(
      '../pages/app/platform-configuration-admin/mfa-reset.astro',
      import.meta.url,
    ),
  ),
  'utf8',
);

/** Structural guarantees of the FE05 admin MFA factor-reset route. */
describe('/app/platform-configuration-admin/mfa-reset page', () => {
  it('is a non-prerendered, no-store, noindex page with one focusable heading', () => {
    expect(source).toContain('export const prerender = false');
    expect(source).toMatch(
      /Astro\.response\.headers\.set\(\s*'Cache-Control',\s*'no-store'/u,
    );
    expect(source).toContain('name="robots" content="noindex"');
    expect(source).toContain('lang="en"');
    expect(source).toMatch(/<h1 id="page-title" tabindex="-1">/u);
    expect(source).toContain('id="main-content"');
    expect(source).toContain('aria-label="Skip navigation"');
    expect(source).toContain('focus-page-heading');
  });

  it('resolves capability and step-up on the server before rendering', () => {
    expect(source).toContain('resolveAdminMfaResetPage');
    expect(source).toMatch(/Astro\.redirect\([^)]*303/su);
    expect(source).toContain("kind === 'unauthenticated'");
  });

  it('[P2-S09-AC-1108] answers every actor without the capability with a bare 404, never the form', () => {
    expect(source).toMatch(/new Response\('Not found',\s*\{\s*status:\s*404/u);
    expect(source).toContain("kind === 'not_found'");
    expect(source).not.toContain('forbiddenHidden');
  });

  it('hydrates the form island with only the server projection', () => {
    expect(source).toContain('AdminMfaFactorResetForm');
    expect(source).toContain('client:load');
    expect(source).toMatch(/variant=\{resolved\.variant\}/u);
    expect(source).toMatch(/stepUp=\{resolved\.stepUp\}/u);
    expect(source).not.toMatch(
      /actorId|actingPartyId|capabilitySnapshot|csrf/iu,
    );
  });

  it('shows a request-id degraded state instead of an empty page', () => {
    expect(source).toContain("kind === 'degraded'");
    expect(source).toContain('Request ID');
  });
});
