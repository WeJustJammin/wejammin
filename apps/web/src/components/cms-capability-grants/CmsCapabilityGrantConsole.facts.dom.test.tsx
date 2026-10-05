// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/client-binding', () => ({
  addClientBindingIdHeader: async (_input: unknown, init?: RequestInit) => init,
}));

import {
  consoleProps,
  names,
} from './cms-capability-grant-console.test-support';
import {
  click,
  mountConsole,
  query,
  type Mounted,
} from './cms-capability-grant-dom.test-support';

/**
 * FE03 mobile contract for the grant console: capability, state and
 * valid-through lead each row and the remaining facts sit behind a per-row
 * disclosure. CSS decides what is hidden at 375 px (Chrome spec); this file
 * proves the disclosure control and the single copy of each fact.
 */

let mounted: Mounted | null = null;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
});

afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

const rowSelector = `tr[data-grant-id="${names.GRANT_ID}"]`;

describe('[P2-S09-AC-1036] mobile expandable facts', () => {
  it('[P2-S09-AC-1036] renders a collapsed facts disclosure that controls the person and last-updated cells', () => {
    mounted = mountConsole(consoleProps());
    const row = query(mounted.container, rowSelector);
    const toggle = query(row, 'button[data-facts-toggle]');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(row.hasAttribute('data-facts-open')).toBe(false);
    const controls = (toggle.getAttribute('aria-controls') ?? '').split(' ');
    const personCell = query(row, '[data-person-cell]');
    const updatedCell = query(row, '[data-updated-cell]');
    expect(controls).toEqual([personCell.id, updatedCell.id]);
  });

  it('[P2-S09-AC-1036] opens and closes the facts on the row toggle and names the grant in the toggle label', () => {
    mounted = mountConsole(consoleProps());
    const row = query(mounted.container, rowSelector);
    const toggle = query(row, 'button[data-facts-toggle]');
    expect(toggle.textContent).toMatch(/^Show details for .* grant ending /u);
    click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(row.getAttribute('data-facts-open')).toBe('true');
    expect(toggle.textContent).toMatch(/^Hide details for /u);
    click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(row.hasAttribute('data-facts-open')).toBe(false);
  });

  it('[P2-S09-AC-1036] keeps exactly one copy of the person ID and last-updated per row', () => {
    mounted = mountConsole(consoleProps());
    const row = query(mounted.container, rowSelector);
    expect(row.querySelectorAll('[data-person-cell]')).toHaveLength(1);
    expect(row.querySelectorAll('[data-updated-cell]')).toHaveLength(1);
  });
});
