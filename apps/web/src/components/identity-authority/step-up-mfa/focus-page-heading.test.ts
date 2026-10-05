// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';

import { focusPageHeading } from './focus-page-heading';

afterEach(() => {
  document.body.innerHTML = '';
  window.location.hash = '';
});

/** FE01: one h1 receives focus on route load. */
describe('focusPageHeading', () => {
  it('[P2-S09-AC-1101] focuses the page heading', () => {
    document.body.innerHTML = '<h1 id="page-title" tabindex="-1">Title</h1>';
    focusPageHeading(document, window.location);
    expect(document.activeElement?.id).toBe('page-title');
  });

  it('leaves focus alone when something else already has it', () => {
    document.body.innerHTML =
      '<h1 id="page-title" tabindex="-1">Title</h1><input id="other">';
    document.getElementById('other')?.focus();
    focusPageHeading(document, window.location);
    expect(document.activeElement?.id).toBe('other');
  });

  it('preserves fragment navigation', () => {
    document.body.innerHTML = '<h1 id="page-title" tabindex="-1">Title</h1>';
    window.location.hash = '#section';
    focusPageHeading(document, window.location);
    expect(document.activeElement?.id).not.toBe('page-title');
  });

  it('does nothing without a heading', () => {
    expect(() => focusPageHeading(document, window.location)).not.toThrow();
  });
});
