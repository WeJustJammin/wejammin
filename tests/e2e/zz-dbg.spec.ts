import { test } from '@playwright/test';
import { actor } from './support/s09-lane-scenarios';
import { enrollFactorViaUi } from './support/s09-lane-flows';
import { newTestId } from './support/s09-lane-browser';
test('dbg', async ({ browser }) => {
  const t = newTestId();
  const owner = await actor(browser, 'owner', t);
  const page = owner.page;
  await enrollFactorViaUi(page, 'Owner phone');
  await page.goto('/app/cms-content-modeling/capability-grants?capability=cms.author', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  console.log((await page.locator('main').ariaSnapshot()).split('\n').filter(l => !/option "/.test(l)).slice(0, 40).join('\n'));
});
