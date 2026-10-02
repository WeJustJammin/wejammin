import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const read = (relative: string): string =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

/*
 * Astro pages are read as text, as the other route tests do: the structural
 * guarantees (no-store, redirect, heading focus, island wiring, no secrets in
 * props) fail loudly if a page is weakened, without a Cloudflare runtime.
 */
describe('/step-up page', () => {
  const source = read('../pages/step-up.astro');

  it('is a non-prerendered, no-store, noindex page with one focusable heading', () => {
    expect(source).toContain('export const prerender = false');
    expect(source).toMatch(/Astro\.response\.headers\.set\(\s*'Cache-Control',\s*'no-store'/u);
    expect(source).toContain('name="robots" content="noindex"');
    expect(source).toContain('lang="en"');
    expect(source).toContain('<title>Verify it');
    expect(source).toMatch(/<h1 id="page-title" tabindex="-1">/u);
    expect(source).toContain('id="main-content"');
    expect(source).toContain('aria-label="Skip navigation"');
    expect(source).toContain('focus-page-heading');
  });

  it('resolves on the server, validates returnTo there and 303s a missing session', () => {
    expect(source).toContain('resolveStepUpPage');
    expect(source).toContain("Astro.url.searchParams.get('returnTo')");
    expect(source).toMatch(/Astro\.redirect\([^)]*303/su);
    expect(source).toContain("kind === 'unauthenticated'");
  });

  it('renders the island with the server-validated return target, hydrated on load', () => {
    expect(source).toContain('StepUpChallengeForm');
    expect(source).toContain('variant="authPage"');
    expect(source).toContain('client:load');
    expect(source).toMatch(/returnTo=\{[^}]*returnTo[^}]*\}/u);
  });

  it('shows the disclosure-safe degraded states with the request id', () => {
    expect(source).toContain('No verification method is available');
    expect(source).toContain('Request ID');
  });

  it('never reads the return target, a code or a secret on the client', () => {
    expect(source).not.toMatch(/location\.search|URLSearchParams\(window/u);
    expect(source).not.toMatch(/otpauth|manualEntryKey|csrf/iu);
  });
});

describe('/settings/security/mfa page', () => {
  const source = read('../pages/settings/security/mfa.astro');

  it('is a non-prerendered, no-store, noindex page with one focusable heading', () => {
    expect(source).toContain('export const prerender = false');
    expect(source).toMatch(/Astro\.response\.headers\.set\(\s*'Cache-Control',\s*'no-store'/u);
    expect(source).toContain('name="robots" content="noindex"');
    expect(source).toContain('<title>Two-step verification');
    expect(source).toMatch(/<h1 id="page-title" tabindex="-1">\s*Two-step verification/u);
    expect(source).toContain('focus-page-heading');
  });

  it('resolves on the server and 303s a missing session', () => {
    expect(source).toContain('resolveMfaSettingsPage');
    expect(source).toMatch(/Astro\.redirect\([^)]*303/su);
  });

  it('hydrates the wizard on load with only server-derived props', () => {
    expect(source).toContain('MfaEnrollmentWizard');
    expect(source).toContain('variant="authPage"');
    expect(source).toContain('client:load');
    expect(source).toContain('expectedVersion=');
    expect(source).toContain('allowedMethods=');
    expect(source).not.toMatch(/otpauth|manualEntryKey/iu);
  });

  it('links back to the security settings', () => {
    expect(source).toContain('href="/settings/security"');
  });
});

describe('account/security navigation', () => {
  const source = read('../pages/settings/security.astro');

  it('links the two-step verification page from the security settings', () => {
    expect(source).toContain('href="/settings/security/mfa"');
    expect(source).toContain('Two-step verification');
  });
});
