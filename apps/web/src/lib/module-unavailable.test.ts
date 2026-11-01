import { describe, expect, it, vi } from 'vitest';

import {
  MODULE_UNAVAILABLE_COPY,
  ModuleUnavailableError,
  importModule,
  isModuleUnavailable,
} from './module-unavailable';

describe('importModule', () => {
  it('returns the module', async () => {
    expect(await importModule(async () => ({ ok: true }))).toEqual({
      ok: true,
    });
  });

  it('turns a rejected import into ModuleUnavailableError carrying the reason', async () => {
    const reason = new TypeError('Failed to fetch dynamically imported module');
    const failure = await importModule(async () => {
      throw reason;
    }).catch((error: unknown) => error);
    expect(isModuleUnavailable(failure)).toBe(true);
    expect((failure as ModuleUnavailableError).reason).toBe(reason);
  });

  it('does not remember a rejection: the next call imports again', async () => {
    const importer = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce('loaded');
    await expect(importModule(importer)).rejects.toBeInstanceOf(
      ModuleUnavailableError,
    );
    expect(await importModule(importer)).toBe('loaded');
    expect(importer).toHaveBeenCalledTimes(2);
  });

  it('is told apart from any other error', () => {
    expect(isModuleUnavailable(new Error('x'))).toBe(false);
    expect(isModuleUnavailable('x')).toBe(false);
  });

  it('says that nothing was sent and what to do', () => {
    expect(MODULE_UNAVAILABLE_COPY).toContain('nothing was sent');
    expect(MODULE_UNAVAILABLE_COPY).toContain('try again');
  });
});
