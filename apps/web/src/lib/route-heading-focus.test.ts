import { describe, expect, it, vi } from 'vitest';

import {
  consumeRouteHeadingFocusMark,
  markRouteHeadingForFocus,
  shouldFocusInitialHeading,
} from './route-heading-focus';

/**
 * FE03 "Completion: Focus result heading": a committed command that navigates
 * to the result leaves a one-shot, identifier-free mark so the destination
 * route's h1 takes focus on its initial load.
 */

const memory = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => void values.delete(key),
    setItem: (key: string, value: string) => void values.set(key, value),
    size: () => values.size,
  };
};

describe('[P2-S09-AC-1232] one-shot result heading focus', () => {
  it('[P2-S09-AC-1232] does not focus the heading on an ordinary initial load', () => {
    expect(
      shouldFocusInitialHeading({
        search: new URLSearchParams(),
        hash: '',
        storage: memory(),
      }),
    ).toBe(false);
  });

  it('[P2-S09-AC-1232] focuses the heading once after a marked commit and then forgets the mark', () => {
    const storage = memory();
    markRouteHeadingForFocus(storage);
    const input = { search: new URLSearchParams(), hash: '', storage };
    expect(shouldFocusInitialHeading(input)).toBe(true);
    expect(storage.size()).toBe(0);
    expect(shouldFocusInitialHeading(input)).toBe(false);
  });

  it('[P2-S09-AC-1232] never focuses the heading over a fragment navigation, and still consumes the mark', () => {
    const storage = memory();
    markRouteHeadingForFocus(storage);
    expect(
      shouldFocusInitialHeading({
        search: new URLSearchParams(),
        hash: '#details',
        storage,
      }),
    ).toBe(false);
    expect(storage.size()).toBe(0);
  });

  it('[P2-S09-AC-1232] keeps the existing tab and selected search triggers', () => {
    for (const query of ['tab=evidence', 'selected=abc'])
      expect(
        shouldFocusInitialHeading({
          search: new URLSearchParams(query),
          hash: '',
          storage: memory(),
        }),
      ).toBe(true);
  });

  it('[P2-S09-AC-1232] treats blocked storage as no mark', () => {
    const blocked = {
      getItem: vi.fn(() => {
        throw new Error('blocked');
      }),
      removeItem: vi.fn(),
      setItem: vi.fn(() => {
        throw new Error('blocked');
      }),
    };
    expect(() => markRouteHeadingForFocus(blocked)).not.toThrow();
    expect(consumeRouteHeadingFocusMark(blocked)).toBe(false);
    expect(consumeRouteHeadingFocusMark(null)).toBe(false);
  });
});
