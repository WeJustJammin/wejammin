import { expect, test, type Browser } from '@playwright/test';

import { newTestId, closeLaneContexts } from './support/s09-lane-browser';
import { LANE_PERSONA_VARIANTS, type LaneRole } from './support/s09-lane-ids';
import { REGISTRY } from './support/s09-lane-flows';
import { actor } from './support/s09-lane-scenarios';

/**
 * FE03 conditional rendering matrix, "CMS capability grant console (owner
 * only)" row, for each persona column: not-rendered, meaning no navigation
 * entry, no route content and no grant controls. Each persona is a session of
 * its own (an adult test session carrying that persona's presentation scope and
 * the registry authority the matrix gives it), driven through the production
 * built routes in Google Chrome against the real Worker routes. The lane is a
 * loopback stateful fixture, so this is browser evidence, not hosted evidence.
 */

test.use({ trace: 'retain-on-failure', screenshot: 'only-on-failure' });

test.afterEach(closeLaneContexts);

const CONSOLE = `${REGISTRY}/capability-grants`;

type Persona = keyof typeof LANE_PERSONA_VARIANTS;

/** Which personas the registry projects to (the rest are denied the registry). */
const REGISTRY_ACCESS: Readonly<Record<Persona, 'read-only' | 'full' | null>> =
  {
    free: null,
    paid: 'read-only',
    creator: 'full',
    guardian: null,
    junior: null,
    business: null,
    staff: 'read-only',
  };

const proveNotRendered = async (
  browser: Browser,
  persona: Persona,
): Promise<void> => {
  const session = await actor(browser, persona as LaneRole, newTestId());
  const page = session.page;
  const variant = LANE_PERSONA_VARIANTS[persona];
  const access = REGISTRY_ACCESS[persona];

  // The persona is real in this session: where the matrix gives it registry
  // authority the server projects exactly its variant and access, and where it
  // does not, the registry answers the same bare refusal as the console.
  const registry = await page.goto(REGISTRY, { waitUntil: 'networkidle' });
  if (access === null) {
    expect(registry?.status()).toBe(403);
    expect(await registry?.text()).toBe('Forbidden');
  } else {
    expect(registry?.status()).toBe(200);
    const workbench = page.locator(
      '[data-workbench="content-schema-registry"]',
    );
    await expect(workbench).toHaveAttribute('data-variant', variant);
    await expect(workbench).toHaveAttribute('data-access', access);
    // No navigation entry on any page the persona can open.
    await expect(
      page
        .getByRole('navigation', { name: 'Primary navigation' })
        .getByRole('link', { name: 'CMS access' }),
    ).toHaveCount(0);
    await expect(page.locator('a[href$="/capability-grants"]')).toHaveCount(0);
  }

  // No route content and no grant controls, whatever the persona's authority.
  const refused = await page.goto(CONSOLE);
  expect(refused?.status()).toBe(403);
  expect(await refused?.text()).toBe('Forbidden');
  expect(refused?.headers()['cache-control'] ?? '').toContain('no-store');
  await expect(
    page.getByRole('heading', { level: 1, name: 'CMS access' }),
  ).toHaveCount(0);
  await expect(
    page.locator('[data-workbench="cms-capability-grants"]'),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Grant capability' }),
  ).toHaveCount(0);
  await expect(page.locator('form')).toHaveCount(0);
};

test('[P2-S09-AC-1050] a Free persona session gets no CMS access navigation, route content or grant controls', async ({
  browser,
}) => {
  await proveNotRendered(browser, 'free');
});

test('[P2-S09-AC-1051] a Paid persona session gets no CMS access navigation, route content or grant controls', async ({
  browser,
}) => {
  await proveNotRendered(browser, 'paid');
});

test('[P2-S09-AC-1052] a Creator persona session gets no CMS access navigation, route content or grant controls', async ({
  browser,
}) => {
  await proveNotRendered(browser, 'creator');
});

test('[P2-S09-AC-1053] a Guardian persona session gets no CMS access navigation, route content or grant controls', async ({
  browser,
}) => {
  await proveNotRendered(browser, 'guardian');
});

test('[P2-S09-AC-1054] a Junior persona session gets no CMS access navigation, route content or grant controls', async ({
  browser,
}) => {
  await proveNotRendered(browser, 'junior');
});

test('[P2-S09-AC-1055] a Business persona session gets no CMS access navigation, route content or grant controls', async ({
  browser,
}) => {
  await proveNotRendered(browser, 'business');
});

test('[P2-S09-AC-1056] a Staff persona session gets no CMS access navigation, route content or grant controls', async ({
  browser,
}) => {
  await proveNotRendered(browser, 'staff');
});
