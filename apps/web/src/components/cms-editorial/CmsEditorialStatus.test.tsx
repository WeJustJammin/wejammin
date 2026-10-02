// @vitest-environment jsdom

import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, describe, expect, it } from 'vitest';

import CmsEditorialStatus, {
  type CmsEditorialStatusProps,
} from './CmsEditorialStatus';

const reactActGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};
reactActGlobal.IS_REACT_ACT_ENVIRONMENT = true;

const REGION_ID = 'cms-editorial-status';

const mount = (
  props: CmsEditorialStatusProps,
): { readonly container: HTMLDivElement; readonly root: Root } => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(<CmsEditorialStatus {...props} />));
  return { container, root };
};

afterEach(() => {
  document.body.replaceChildren();
});

afterAll(() => {
  delete reactActGlobal.IS_REACT_ACT_ENVIRONMENT;
});

describe('CmsEditorialStatus live region', () => {
  it('is one polite atomic status region addressed by id', () => {
    const { container } = mount({
      regionId: REGION_ID,
      message: 'All changes saved.',
    });
    const regions = container.querySelectorAll('[aria-live]');
    expect(regions).toHaveLength(1);
    const region = container.querySelector<HTMLElement>('#' + REGION_ID);
    expect(region?.tagName).toBe('P');
    expect(region?.getAttribute('role')).toBe('status');
    expect(region?.getAttribute('aria-live')).toBe('polite');
    expect(region?.getAttribute('aria-atomic')).toBe('true');
    expect(region?.getAttribute('data-cms-editorial-status')).toBe('true');
    expect(region?.textContent).toBe('All changes saved.');
  });

  it('escalates only to an assertive alert when explicitly requested', () => {
    const { container } = mount({
      regionId: REGION_ID,
      message: 'Saving failed unexpectedly.',
      alert: true,
    });
    const region = container.querySelector<HTMLElement>('#' + REGION_ID);
    expect(region?.getAttribute('role')).toBe('alert');
    expect(region?.getAttribute('aria-live')).toBe('assertive');
    expect(region?.getAttribute('aria-atomic')).toBe('true');
  });

  it('defaults to polite when alert is omitted', () => {
    const { container } = mount({
      regionId: REGION_ID,
      message: 'Unsaved changes. Autosave runs shortly.',
    });
    const region = container.querySelector<HTMLElement>('#' + REGION_ID);
    expect(region?.getAttribute('role')).toBe('status');
    expect(region?.getAttribute('aria-live')).toBe('polite');
  });

  it('is programmatically focusable without an extra tab stop', () => {
    const { container } = mount({
      regionId: REGION_ID,
      message: 'Save status unknown. Your unsent edits are kept.',
    });
    const region = container.querySelector<HTMLElement>('#' + REGION_ID);
    expect(region?.getAttribute('tabindex')).toBe('-1');
    expect(region?.tabIndex).toBe(-1);
  });

  it('replaces the message text instead of appending on re-render', () => {
    const { container, root } = mount({
      regionId: REGION_ID,
      message: 'Saving changes.',
    });
    act(() =>
      root.render(
        <CmsEditorialStatus
          regionId={REGION_ID}
          message="Too many saves. Retry in 7 seconds. Your unsent edits are kept."
        />,
      ),
    );
    const region = container.querySelector<HTMLElement>('#' + REGION_ID);
    expect(region?.textContent).toBe(
      'Too many saves. Retry in 7 seconds. Your unsent edits are kept.',
    );
    expect(container.querySelectorAll('[aria-live]')).toHaveLength(1);
  });
});
