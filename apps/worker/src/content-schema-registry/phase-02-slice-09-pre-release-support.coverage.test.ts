import { describe, expect, it } from 'vitest';

import {
  makeSignedHarness,
  NOW,
} from './phase-02-slice-09-pre-release-support';
import { validBlock, validLifecycle } from './phase-02-slice-09-test-values';

describe('signed release harness defaults', () => {
  it('generates its own signing key and uses the fixed clock when given no options', async () => {
    const harness = await makeSignedHarness();
    const registered = await harness.send('CMS-03A-05', validBlock);
    expect(registered.status).toBe(201);
    expect(harness.registerBlock).toHaveBeenCalledTimes(1);
    const advanced = await harness.send('CMS-03A-08', validLifecycle);
    expect(advanced.status).toBeLessThan(300);
    expect(harness.advanceBlockLifecycle).toHaveBeenCalledTimes(1);
    expect(harness.resolveSession).not.toHaveBeenCalled();
    expect(harness.rateLimit).toHaveBeenCalledTimes(2);
  });

  it('verifies a signature against an injected clock instead of the fixed one', async () => {
    const harness = await makeSignedHarness({ now: () => NOW + 1_000 });
    const response = await harness.send('CMS-03A-05', validBlock);
    expect(response.status).toBe(201);
  });
});
