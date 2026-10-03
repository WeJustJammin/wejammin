import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { cmsCapabilityGrantRefusalResponse } from './cms-capability-grant-page-response';

/**
 * FE03 Page and Route Definitions for the owner-only grant console and the
 * navigation entries that make it (and the review route) reachable. Astro
 * pages are asserted as source, the repository convention, because the page
 * shell cannot run outside the Astro runtime.
 */

const fromHere = (relative: string): string =>
  fileURLToPath(new URL(relative, import.meta.url));
const read = (relative: string): string => {
  try {
    return readFileSync(fromHere(relative), 'utf8');
  } catch {
    throw new Error(`RED: expected ${relative} (FE03 DEC-119)`);
  }
};

const GRANTS_PAGE = '../pages/app/cms-content-modeling/capability-grants.astro';
const REGISTRY_PAGE = '../pages/app/cms-content-modeling/index.astro';

describe('[DEC-119] capability grant console page', () => {
  const source = read(GRANTS_PAGE);

  it('is server-rendered, no-store and rendered through the bounded grant island', () => {
    expect(source).toContain('export const prerender = false');
    expect(source).toContain(
      "Astro.response.headers.set('Cache-Control', 'no-store')",
    );
    expect(source).toContain('resolveCmsCapabilityGrantPage');
    expect(source).toContain('CmsCapabilityGrantConsoleIsland');
    expect(source).toContain('client:load');
    expect(source).not.toContain('client:visible');
  });

  it('[P2-S09-AC-1022] redirects an unauthenticated visitor with a safe relative returnTo', () => {
    expect(source).toContain('Astro.redirect');
    expect(source).toContain('/auth/sign-in?returnTo=');
    expect(source).toContain('303');
  });

  it('[P2-S09-AC-991] the page returns the shared refusal response before rendering anything', () => {
    expect(source).toMatch(
      /if \(isCmsCapabilityGrantRefusal\(result\)\)\s+return cmsCapabilityGrantRefusalResponse\(result\);/u,
    );
  });

  it('[P2-S09-AC-991] answers forbidden with 403 and a no-store header', () => {
    const response = cmsCapabilityGrantRefusalResponse({ kind: 'forbidden' });
    expect(response.status).toBe(403);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('[P2-S09-AC-991] answers not_found with 404 and a no-store header', () => {
    const response = cmsCapabilityGrantRefusalResponse({ kind: 'not_found' });
    expect(response.status).toBe(404);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('keeps a single h1 focused by the shared route-heading script', () => {
    expect(source).toContain('id="page-title"');
    expect(source).toContain('tabindex="-1"');
    expect(source).toContain('route-heading-focus.ts');
    expect(source.match(/<h1\b/gu)).toHaveLength(1);
  });

  it('accepts only the three grant commands as native POSTs', () => {
    expect(source).toContain("Astro.request.method === 'POST'");
    expect(source).toContain(
      'contentSchemaRegistryMutationOperationFromRequest',
    );
    expect(source).toContain('forwardContentSchemaRegistryMutation');
    for (const operation of ['CMS-03A-15', 'CMS-03A-16', 'CMS-03A-17'])
      expect(source).toContain(operation);
    for (const foreign of [
      'CMS-03A-01',
      'CMS-03A-04',
      'CMS-03A-09',
      'CMS-03A-12',
      'CMS-03A-14',
    ])
      expect(source).not.toContain(foreign);
  });

  it('binds the grant id for row commands from the form, never from the browser path alone', () => {
    expect(source).toContain('grantId');
  });

  it('routes a native 401 STEP_UP_REQUIRED to the step-up page and redirects success back', () => {
    expect(source).toContain('STEP_UP_REQUIRED');
    expect(source).toContain('/step-up?returnTo=');
    expect(source).toContain('/app/cms-content-modeling/capability-grants');
  });

  it('never references an actor, party, grantor or binding identifier', () => {
    expect(source).not.toMatch(/actorId|actingPartyId|grantorId|bindingId/u);
  });
});

describe('[DEC-119] navigation reachability (vertical slice)', () => {
  const registry = read(REGISTRY_PAGE);

  it('[P2-S09-AC-991] offers the grant console from the registry shell only when the owner probe succeeds', () => {
    expect(registry).toContain('/app/cms-content-modeling/capability-grants');
    expect(registry).toContain('probeCmsCapabilityGrantOwner');
    const link = registry.indexOf(
      '/app/cms-content-modeling/capability-grants',
    );
    const guard = registry.lastIndexOf('ownerNav ?', link);
    expect(guard).toBeGreaterThan(-1);
  });

  it('keeps the owner probe from ever failing the registry page', () => {
    expect(registry).toContain('probeCmsCapabilityGrantOwner(');
  });

  it('links the console back to the registry', () => {
    expect(read(GRANTS_PAGE)).toContain('href="/app/cms-content-modeling"');
  });
});
