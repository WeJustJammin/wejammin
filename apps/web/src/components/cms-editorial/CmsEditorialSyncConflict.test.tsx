// @vitest-environment jsdom

import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, describe, expect, it } from 'vitest';

import CmsEditorialSyncConflict, {
  type CmsEditorialSyncConflictProps,
} from './CmsEditorialSyncConflict';

const reactActGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};
reactActGlobal.IS_REACT_ACT_ENVIRONMENT = true;

const HEADING_ID = 'cms-editorial-conflict-heading';

const mount = (
  props: CmsEditorialSyncConflictProps,
): { readonly container: HTMLDivElement; readonly root: Root } => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(<CmsEditorialSyncConflict {...props} />));
  return { container, root };
};

afterEach(() => {
  document.body.replaceChildren();
});

afterAll(() => {
  delete reactActGlobal.IS_REACT_ACT_ENVIRONMENT;
});

describe('CmsEditorialSyncConflict', () => {
  it('is labelled by its heading and names the divergence', () => {
    const { container } = mount({
      headingId: HEADING_ID,
      expectedVersion: '12',
      currentVersion: '14',
      unsentChangeCount: 2,
    });
    const section = container.querySelector<HTMLElement>(
      '[data-cms-editorial-sync-conflict]',
    );
    expect(section?.getAttribute('aria-labelledby')).toBe(HEADING_ID);
    expect(document.getElementById(HEADING_ID)?.textContent).toBe(
      'This entry changed in another tab or session',
    );
    expect(section?.textContent).toContain('12');
    expect(section?.textContent).toContain('14');
  });

  it('states plainly that nothing was overwritten', () => {
    const { container } = mount({
      headingId: HEADING_ID,
      expectedVersion: '12',
      currentVersion: '14',
      unsentChangeCount: 1,
    });
    expect(container.textContent).toContain('Nothing was overwritten.');
    expect(container.textContent).toContain('Review the current version');
  });

  it('keeps unsent local values with singular and plural copy', () => {
    const single = mount({
      headingId: HEADING_ID,
      expectedVersion: '1',
      currentVersion: '2',
      unsentChangeCount: 1,
    });
    expect(single.container.textContent).toContain(
      '1 unsent change is kept in this browser only.',
    );
    act(() => single.root.unmount());
    document.body.replaceChildren();
    const many = mount({
      headingId: HEADING_ID,
      expectedVersion: '1',
      currentVersion: '2',
      unsentChangeCount: 3,
    });
    expect(many.container.textContent).toContain(
      '3 unsent changes are kept in this browser only.',
    );
  });

  it('says so when there is nothing unsent', () => {
    const { container } = mount({
      headingId: HEADING_ID,
      expectedVersion: '1',
      currentVersion: '2',
      unsentChangeCount: 0,
    });
    expect(container.textContent).toContain('You have no unsent changes.');
  });

  it('never claims a silent or automatic last-write-wins baseline', () => {
    const { container } = mount({
      headingId: HEADING_ID,
      expectedVersion: '1',
      currentVersion: '2',
      unsentChangeCount: 1,
    });
    const text = container.textContent?.toLowerCase() ?? '';
    expect(text).not.toContain('last write');
    expect(text).not.toContain('last-write');
    expect(text).not.toContain('overwrote');
  });

  it('reports an unknown local baseline without inventing one', () => {
    const { container } = mount({
      headingId: HEADING_ID,
      expectedVersion: null,
      currentVersion: '2',
      unsentChangeCount: 0,
    });
    expect(container.textContent).toContain('Loaded version unknown');
  });
});
