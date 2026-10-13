import { afterEach, describe, expect, it, vi } from 'vitest';

import type { CmsValidators } from './cms-contract-validators';
import {
  loadCmsValidators,
  loadedCmsValidators,
  resetCmsValidatorsForTest,
  settleCmsValidatorsForTest,
  warmCmsValidators,
  withCmsValidators,
} from './cms-contract-validators';

const FAKE = { CmsUuidSchema: {} } as unknown as CmsValidators;

afterEach(() => {
  resetCmsValidatorsForTest();
});

describe('lazy CMS editorial validators', () => {
  it('loads nothing until a need, then loads the module once for every caller', async () => {
    const loader = vi.fn(() => Promise.resolve(FAKE));
    resetCmsValidatorsForTest(loader);
    expect(loadedCmsValidators()).toBeNull();
    expect(loader).not.toHaveBeenCalled();

    const [first, second] = await Promise.all([
      loadCmsValidators(),
      loadCmsValidators(),
    ]);

    expect(first).toBe(FAKE);
    expect(second).toBe(FAKE);
    expect(loadedCmsValidators()).toBe(FAKE);
    expect(await loadCmsValidators()).toBe(FAKE);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('retries a failed load on the next need instead of caching the failure', async () => {
    const loader = vi
      .fn<() => Promise<CmsValidators>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(FAKE);
    resetCmsValidatorsForTest(loader);

    await expect(loadCmsValidators()).rejects.toThrow('offline');
    expect(loadedCmsValidators()).toBeNull();
    await expect(loadCmsValidators()).resolves.toBe(FAKE);
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('warms on intent without reporting a failure, and starts at most one load', async () => {
    const loader = vi
      .fn<() => Promise<CmsValidators>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(FAKE);
    resetCmsValidatorsForTest(loader);

    warmCmsValidators();
    warmCmsValidators();
    await vi.waitFor(() => expect(loader).toHaveBeenCalledTimes(1));
    await Promise.resolve();
    expect(loadedCmsValidators()).toBeNull();

    warmCmsValidators();
    await vi.waitFor(() => expect(loadedCmsValidators()).toBe(FAKE));
    warmCmsValidators();
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('runs a form check synchronously once the validators are loaded, and as soon as they load otherwise', async () => {
    resetCmsValidatorsForTest(() => Promise.resolve(FAKE));
    const calls: string[] = [];
    withCmsValidators(
      () => calls.push('first'),
      () => calls.push('unavailable'),
    );
    expect(calls).toEqual([]);
    await vi.waitFor(() => expect(calls).toEqual(['first']));
    withCmsValidators(
      (validators) => calls.push(validators === FAKE ? 'second' : 'other'),
      () => calls.push('unavailable'),
    );
    expect(calls).toEqual(['first', 'second']);
  });

  it('reports the validators as unavailable, and runs no check, when they cannot be fetched', async () => {
    resetCmsValidatorsForTest(() => Promise.reject(new Error('offline')));
    const calls: string[] = [];
    withCmsValidators(
      () => calls.push('used'),
      () => calls.push('unavailable'),
    );
    await vi.waitFor(() => expect(calls).toEqual(['unavailable']));
  });

  it('keeps a load that settles after a reset from leaking into the next loader, and settles in-flight loads for tests', async () => {
    let finish: (module: CmsValidators) => void = () => undefined;
    let fail: (error: Error) => void = () => undefined;
    resetCmsValidatorsForTest(
      () =>
        new Promise<CmsValidators>((resolve) => {
          finish = resolve;
        }),
    );
    const stale = loadCmsValidators();
    resetCmsValidatorsForTest(() => Promise.reject(new Error('offline')));
    finish(FAKE);
    await expect(stale).resolves.toBe(FAKE);
    expect(loadedCmsValidators()).toBeNull();
    await expect(loadCmsValidators()).rejects.toThrow('offline');

    resetCmsValidatorsForTest(
      () =>
        new Promise<CmsValidators>((_resolve, reject) => {
          fail = reject;
        }),
    );
    const failing = loadCmsValidators();
    resetCmsValidatorsForTest(async () => FAKE);
    const fresh = loadCmsValidators();
    fail(new Error('late'));
    await expect(failing).rejects.toThrow('late');
    await expect(fresh).resolves.toBe(FAKE);
    expect(loadedCmsValidators()).toBe(FAKE);

    await expect(settleCmsValidatorsForTest()).resolves.toBeUndefined();
    resetCmsValidatorsForTest(() => Promise.reject(new Error('down')));
    void loadCmsValidators().catch(() => undefined);
    await expect(settleCmsValidatorsForTest()).resolves.toBeUndefined();
    resetCmsValidatorsForTest();
    await expect(settleCmsValidatorsForTest()).resolves.toBeUndefined();
  });
});
