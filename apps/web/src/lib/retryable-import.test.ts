import { afterEach, describe, expect, it, vi } from 'vitest';

import { retryable, retryableImportSeam } from './retryable-import';

/*
 * A browser keeps a FAILED dynamic import in its module map: importing the same URL again rejects
 * without a request, so a retry that repeats `import('./chunk')` never reaches the network once the
 * connection is back (real Chrome: tests/performance/retryable-import.chrome... and the governed
 * real-route spec T5). The retry has to name a URL the map has not seen: the failed URL, which the
 * browser's error message carries, with a retry marker.
 */
const real = { ...retryableImportSeam };
afterEach(() => {
  Object.assign(retryableImportSeam, real);
});

const URL_A = 'https://app.example/_astro/chunk.AbCd1234.js';
const chrome = (url = URL_A): TypeError =>
  new TypeError(`Failed to fetch dynamically imported module: ${url}`);
const firefox = (url = URL_A): TypeError =>
  new TypeError(`error loading dynamically imported module: ${url}`);
const module_ = { value: 1 };

describe('retryable', () => {
  it('imports once and remembers the module', async () => {
    const importUrl = vi.fn();
    retryableImportSeam.importUrl = importUrl;
    const load = vi.fn(async () => module_);
    const get = retryable(load);
    expect(await get()).toBe(module_);
    expect(await get()).toBe(module_);
    expect(load).toHaveBeenCalledTimes(1);
    expect(importUrl).not.toHaveBeenCalled();
  });

  it.each([
    ['Chrome', chrome],
    ['Firefox', firefox],
  ])(
    'after a failed import (%s message) retries the failed URL with a retry marker, not the same import',
    async (_name, failure) => {
      const importUrl = vi.fn(async () => module_);
      retryableImportSeam.importUrl = importUrl;
      const load = vi.fn(async () => {
        throw failure();
      });
      const get = retryable(load);
      await expect(get()).rejects.toBeInstanceOf(TypeError);
      expect(await get()).toBe(module_);
      expect(load).toHaveBeenCalledTimes(1);
      expect(importUrl).toHaveBeenCalledWith(`${URL_A}?wj_retry=1`);
      // Remembered: the failed plain URL is never asked again.
      expect(await get()).toBe(module_);
      expect(load).toHaveBeenCalledTimes(1);
      expect(importUrl).toHaveBeenCalledTimes(1);
    },
  );

  it('uses a new marker after a retry fails too, and replaces the old one', async () => {
    const importUrl = vi
      .fn<(url: string) => Promise<unknown>>()
      .mockRejectedValueOnce(chrome(`${URL_A}?wj_retry=1`))
      .mockResolvedValue(module_);
    retryableImportSeam.importUrl = importUrl;
    const get = retryable(async () => {
      throw chrome();
    });
    await expect(get()).rejects.toBeDefined();
    await expect(get()).rejects.toBeDefined();
    expect(await get()).toBe(module_);
    expect(importUrl.mock.calls.map((call) => call[0])).toEqual([
      `${URL_A}?wj_retry=1`,
      `${URL_A}?wj_retry=2`,
    ]);
  });

  it('imports the same specifier again when the failure names no URL (nothing better is possible)', async () => {
    const importUrl = vi.fn();
    retryableImportSeam.importUrl = importUrl;
    const load = vi
      .fn<() => Promise<unknown>>()
      .mockRejectedValueOnce(new TypeError('Importing a module script failed.'))
      .mockResolvedValue(module_);
    const get = retryable(load);
    await expect(get()).rejects.toBeDefined();
    expect(await get()).toBe(module_);
    expect(load).toHaveBeenCalledTimes(2);
    expect(importUrl).not.toHaveBeenCalled();
  });

  it('shares one attempt between callers that ask while it is in flight', async () => {
    let finish: (value: unknown) => void = () => undefined;
    const load = vi.fn(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const get = retryable(load);
    const first = get();
    const second = get();
    finish(module_);
    expect(await Promise.all([first, second])).toEqual([module_, module_]);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('gives each retryable its own state', async () => {
    const importUrl = vi.fn(async () => module_);
    retryableImportSeam.importUrl = importUrl;
    const a = retryable(async () => {
      throw chrome();
    });
    const b = retryable(async () => ({ other: true }));
    await expect(a()).rejects.toBeDefined();
    expect(await b()).toEqual({ other: true });
    expect(importUrl).not.toHaveBeenCalled();
  });
});
