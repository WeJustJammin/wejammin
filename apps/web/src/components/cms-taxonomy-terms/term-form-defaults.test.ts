import { afterEach, describe, expect, it, vi } from 'vitest';

import { defaultNavigate, defaultReplaceUrl } from './term-form-defaults';

/** The two browser defaults of the term island's test seams: a no-op without a window, the real call with one. */
afterEach(() => vi.unstubAllGlobals());

describe('term form defaults', () => {
  it('do nothing where there is no window', () => {
    expect(() => defaultNavigate('/elsewhere')).not.toThrow();
    expect(() => defaultReplaceUrl('/base')('active')).not.toThrow();
  });

  it('navigate assigns the location', () => {
    const assign = vi.fn();
    vi.stubGlobal('window', { location: { assign } });
    defaultNavigate('/elsewhere');
    expect(assign).toHaveBeenCalledWith('/elsewhere');
  });

  it('replace the URL with the bare base path or the lifecycle filter', () => {
    const replaceState = vi.fn();
    vi.stubGlobal('window', { history: { replaceState } });
    defaultReplaceUrl('/base')(null);
    defaultReplaceUrl('/base')('deprecated');
    expect(replaceState.mock.calls).toEqual([
      [null, '', '/base'],
      [null, '', '/base?lifecycle=deprecated'],
    ]);
  });
});
