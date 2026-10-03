import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  ADMIN_MFA_RESET_ROUTE,
  showsAdminMfaResetEntry,
} from './admin-mfa-reset-page-context';

const here = (relative: string): string =>
  fileURLToPath(new URL(relative, import.meta.url));
const read = (relative: string): string => readFileSync(here(relative), 'utf8');

const index = read('../pages/app/platform-configuration-admin/index.astro');
const shell = read(
  '../components/platform-configuration/PlatformConfigurationAdminRoute.astro',
);
const tab = read(
  '../components/platform-configuration/PlatformConfigurationMfaResetTab.astro',
);
const route = `${shell}\n${tab}`;
const header = read(
  '../components/platform-configuration/PlatformConfigurationPageHeader.astro',
);

/**
 * FE05: the admin MFA factor reset is a TAB (`tab=mfa-reset`) of the admin
 * workbench, not a route of its own (spec governs, AC1108). Structural
 * guarantees of that tab.
 */
describe('/app/platform-configuration-admin?tab=mfa-reset', () => {
  it('[P2-S09-AC-1108] is the tab=mfa-reset of the workbench, with no dedicated route of its own', () => {
    expect(ADMIN_MFA_RESET_ROUTE).toBe(
      '/app/platform-configuration-admin?tab=mfa-reset',
    );
    expect(
      existsSync(
        here('../pages/app/platform-configuration-admin/mfa-reset.astro'),
      ),
    ).toBe(false);
    expect(index).toContain("'mfa-reset'");
    expect(index).toMatch(/requestedAdminTab\s*===\s*'mfa-reset'/u);
  });

  it('[P2-S09-AC-1108] resolves capability and step-up on the server before rendering the tab', () => {
    expect(index).toContain('resolveAdminMfaResetTab');
    expect(index).toContain("kind === 'unauthenticated'");
    expect(index).toMatch(/Astro\.redirect\([^)]*303/su);
  });

  it('[P2-S09-AC-1108] answers every actor without the capability with a bare 404, never the form', () => {
    expect(index).toMatch(/new Response\('Not found',\s*\{\s*status:\s*404/u);
    expect(index).toContain("kind === 'not_found'");
    expect(index).not.toContain('forbiddenHidden');
  });

  it('[P2-S09-AC-1108] hydrates the form island with only the server projection, inside the workbench shell', () => {
    expect(route).toContain('AdminMfaFactorResetForm');
    expect(shell).toContain("tab === 'mfa-reset'");
    expect(shell).toContain('PlatformConfigurationMfaResetTab');
    expect(route).toMatch(/variant=\{mfaReset\.variant\}/u);
    expect(route).toMatch(/stepUp=\{mfaReset\.stepUp\}/u);
    expect(route).toContain('PlatformConfigurationPageHeader');
  });

  it('[P2-S09-AC-1108] shows a request-id degraded state instead of an empty tab', () => {
    expect(route).toContain("mfaReset.kind === 'degraded'");
    expect(route).toContain('Request ID');
  });

  it('[P2-S09-AC-1108] adds the navigation entry only for the exact capability, pointing at the tab', () => {
    expect(header).toContain('showsAdminMfaResetEntry(capabilitySnapshot)');
    expect(header).toContain('ADMIN_MFA_RESET_ROUTE');
    expect(header).toMatch(/aria-current=\{tab === 'mfa-reset'/u);
    expect(showsAdminMfaResetEntry(['admin.identity.mfa_reset'])).toBe(true);
    expect(showsAdminMfaResetEntry(['admin.identity.mfa_reset.view'])).toBe(
      false,
    );
    expect(showsAdminMfaResetEntry([])).toBe(false);
  });
});
