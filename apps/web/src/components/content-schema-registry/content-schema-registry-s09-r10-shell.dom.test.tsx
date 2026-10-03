// @vitest-environment jsdom

import * as React from 'react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ContentSchemaRegistryWorkbench from './ContentSchemaRegistryWorkbench';
import { approvedReviewPreparation } from './content-schema-registry-activation-preparation.test-support';
import {
  DETAIL,
  RESOURCE,
  TYPE_ID,
  VERSION_ID,
  mountView,
  unmountMountedViews,
  workbenchProps as props,
} from './content-schema-registry-island-refetch.test-support';
import { CONTENT_SCHEMA_REGISTRY_SIDEBAR_STORAGE_KEY } from './ContentSchemaRegistrySidebar';
import type { ContentSchemaRegistryWorkbenchProps } from './content-schema-registry-types';

const LIST_URL = '/app/cms-content-modeling?limit=25&sort=key&direction=asc';

const sidebar = (container: HTMLElement): HTMLElement | null =>
  container.querySelector<HTMLElement>('aside[aria-label="Registry sidebar"]');
const toggle = (container: HTMLElement): HTMLButtonElement | null =>
  sidebar(container)?.querySelector<HTMLButtonElement>('button') ?? null;
const rail = (container: HTMLElement): HTMLElement | null =>
  container.querySelector<HTMLElement>(
    '.content-schema-registry-detail aside[aria-label="Version actions"]',
  );

const click = (element: Element): void => {
  act(() => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
};

const withActions = (
  actions: readonly ('start_dry_run' | 'create_successor' | 'activate')[],
): Partial<ContentSchemaRegistryWorkbenchProps> => ({
  initialDetail: {
    status: 'success',
    data: {
      ...DETAIL,
      activationPreparation: {
        ...approvedReviewPreparation,
        permittedNextActions: [...actions],
      },
    },
    version: '7',
    stale: false,
  },
});

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  window.sessionStorage.clear();
});

afterEach(() => {
  unmountMountedViews();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('[P2-S09-AC-245] the registry route renders a keyboard-operable collapsible sidebar', () => {
  it('renders a named complementary region whose toggle discloses a named navigation', () => {
    const { container } = mountView(
      <ContentSchemaRegistryWorkbench {...props({ listUrl: LIST_URL })} />,
    );
    const region = sidebar(container);
    expect(region).not.toBeNull();
    const button = toggle(container);
    expect(button).not.toBeNull();
    expect(button?.tagName).toBe('BUTTON');
    expect(button?.getAttribute('type')).toBe('button');
    expect(button?.getAttribute('aria-expanded')).toBe('true');
    const controlled = button?.getAttribute('aria-controls') ?? '';
    expect(controlled).not.toBe('');
    const nav = container.querySelector<HTMLElement>(`#${controlled}`);
    expect(nav).not.toBeNull();
    expect(nav?.tagName).toBe('NAV');
    expect(nav?.getAttribute('aria-label')).toBe('Registry section links');
    expect(region?.contains(nav)).toBe(true);
    expect(button?.textContent?.trim()).toBe('Registry sections');
  });

  it('links the list and the selected version, marking the current page', () => {
    const { container } = mountView(
      <ContentSchemaRegistryWorkbench {...props({ listUrl: LIST_URL })} />,
    );
    const links = [
      ...(sidebar(container)?.querySelectorAll<HTMLAnchorElement>('a') ?? []),
    ];
    const byName = (name: string): HTMLAnchorElement | undefined =>
      links.find((link) => link.textContent?.trim() === name);
    expect(byName('Registry overview')?.getAttribute('href')).toBe(LIST_URL);
    const version = byName(`Selected version: ${RESOURCE.label}`);
    expect(version?.getAttribute('href')).toBe(
      `/app/cms-content-modeling/${TYPE_ID}/versions/${VERSION_ID}`,
    );
    expect(version?.getAttribute('aria-current')).toBe('page');
    expect(byName('Registry overview')?.hasAttribute('aria-current')).toBe(
      false,
    );
  });

  it('cites the verified context label and never an identifier in visible text', () => {
    const { container } = mountView(
      <ContentSchemaRegistryWorkbench {...props()} />,
    );
    const text = sidebar(container)?.textContent ?? '';
    expect(text).toContain('Context: Northwind Collective');
    expect(text).not.toContain(TYPE_ID);
    expect(text).not.toContain(VERSION_ID);
  });

  it('collapses and expands through the toggle and keeps focus on it', () => {
    const { container } = mountView(
      <ContentSchemaRegistryWorkbench {...props()} />,
    );
    const button = toggle(container) as HTMLButtonElement;
    act(() => button.focus());
    click(button);
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(sidebar(container)?.getAttribute('data-collapsed')).toBe('true');
    expect(document.activeElement).toBe(button);
    click(button);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(sidebar(container)?.getAttribute('data-collapsed')).toBe('false');
    expect(document.activeElement).toBe(button);
  });

  it('Escape inside the expanded navigation collapses it and returns focus to the toggle', () => {
    const { container } = mountView(
      <ContentSchemaRegistryWorkbench {...props()} />,
    );
    const link = sidebar(container)?.querySelector<HTMLAnchorElement>(
      'nav a',
    ) as HTMLAnchorElement;
    act(() => link.focus());
    expect(document.activeElement).toBe(link);
    act(() => {
      link.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      );
    });
    expect(toggle(container)?.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(toggle(container));
  });

  it('ignores Escape when the sidebar is not a tablet disclosure (persistent desktop sidebar)', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    const { container } = mountView(
      <ContentSchemaRegistryWorkbench {...props()} />,
    );
    const link = sidebar(container)?.querySelector<HTMLAnchorElement>(
      'nav a',
    ) as HTMLAnchorElement;
    act(() => link.focus());
    act(() => {
      link.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      );
    });
    expect(toggle(container)?.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(link);
  });

  it('remembers the choice for the tab and survives blocked storage', () => {
    const first = mountView(<ContentSchemaRegistryWorkbench {...props()} />);
    click(toggle(first.container) as HTMLButtonElement);
    expect(
      window.sessionStorage.getItem(
        CONTENT_SCHEMA_REGISTRY_SIDEBAR_STORAGE_KEY,
      ),
    ).toBe('collapsed');
    unmountMountedViews();

    const second = mountView(<ContentSchemaRegistryWorkbench {...props()} />);
    expect(toggle(second.container)?.getAttribute('aria-expanded')).toBe(
      'false',
    );
    unmountMountedViews();

    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const third = mountView(<ContentSchemaRegistryWorkbench {...props()} />);
    expect(toggle(third.container)?.getAttribute('aria-expanded')).toBe('true');
    click(toggle(third.container) as HTMLButtonElement);
    expect(toggle(third.container)?.getAttribute('aria-expanded')).toBe(
      'false',
    );
  });

  it('shows a review-only reader no link to a list or version they cannot read', () => {
    const { container } = mountView(
      <ContentSchemaRegistryWorkbench
        {...props({
          variant: 'schemaReviewAssigned',
          access: 'read-only',
          reviewId: '70000000-0000-4000-8000-000000000007',
          initialDetail: null,
        })}
      />,
    );
    expect(sidebar(container)).not.toBeNull();
    expect(sidebar(container)?.querySelectorAll('a')).toHaveLength(0);
    expect(sidebar(container)?.textContent).toContain('Schema review');
  });
});

describe('[P2-S09-AC-246] the grid never reserves an empty list column', () => {
  const grid = (container: HTMLElement): HTMLElement =>
    container.querySelector<HTMLElement>(
      '.content-schema-registry-grid',
    ) as HTMLElement;

  it('starts the version page grid at the detail when there is no list content', () => {
    const { container } = mountView(
      <ContentSchemaRegistryWorkbench {...props()} />,
    );
    const first = grid(container).firstElementChild;
    expect(first?.classList.contains('content-schema-registry-detail')).toBe(
      true,
    );
    expect(
      container.querySelector('.content-schema-registry-list-column'),
    ).toBeNull();
  });

  it('starts the registry page grid at the list column when there is a list or a create form', () => {
    const { container } = mountView(
      <ContentSchemaRegistryWorkbench
        {...props({ initialDetail: null, initialReview: null })}
      />,
    );
    const first = grid(container).firstElementChild;
    expect(
      first?.classList.contains('content-schema-registry-list-column'),
    ).toBe(true);
    expect(first?.textContent?.trim()).not.toBe('');
  });

  it('gives the version side and command stack their own classes for the desktop spans', () => {
    const { container } = mountView(
      <ContentSchemaRegistryWorkbench
        {...props(withActions(['start_dry_run']))}
      />,
    );
    expect(
      container.querySelector(
        '.content-schema-registry-grid > .content-schema-registry-version-side',
      ),
    ).not.toBeNull();
    expect(
      container.querySelector(
        '.content-schema-registry-grid > .content-schema-registry-command-stack',
      ),
    ).not.toBeNull();
  });
});

describe('[P2-S09-AC-246] the detail owns the heading and an action rail citing context, version and permitted actions', () => {
  it('renders the rail inside the detail, after the detail heading and before its facts', () => {
    const { container } = mountView(
      <ContentSchemaRegistryWorkbench
        {...props(withActions(['start_dry_run']))}
      />,
    );
    const detail = container.querySelector<HTMLElement>(
      '.content-schema-registry-detail',
    ) as HTMLElement;
    const heading = detail.querySelector('h3') as HTMLElement;
    const region = rail(container) as HTMLElement;
    expect(region).not.toBeNull();
    expect(detail.contains(region)).toBe(true);
    expect(
      heading.compareDocumentPosition(region) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    const facts = detail.querySelector('.content-schema-registry-summary');
    expect(facts).not.toBeNull();
    expect(
      region.compareDocumentPosition(facts as Element) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(detail.querySelectorAll('h1, h2, h3')).toHaveLength(1);
    expect(region.querySelectorAll('h1, h2, h3')).toHaveLength(0);
  });

  it('cites the acting context label and the cited version', () => {
    const { container } = mountView(
      <ContentSchemaRegistryWorkbench
        {...props(withActions(['start_dry_run']))}
      />,
    );
    const text = rail(container)?.textContent ?? '';
    expect(text).toContain('Context: Northwind Collective');
    expect(text).toContain('Version cited: 7');
  });

  it('lists exactly the server-permitted next actions in plain language', () => {
    const { container } = mountView(
      <ContentSchemaRegistryWorkbench
        {...props(withActions(['start_dry_run', 'create_successor']))}
      />,
    );
    const items = [...(rail(container)?.querySelectorAll('li') ?? [])].map(
      (item) => item.textContent?.trim(),
    );
    expect(items).toEqual(['Dry-run request', 'Successor draft']);
    expect(rail(container)?.textContent).not.toMatch(/activation/iu);
  });

  it('says so when the server permits no next action and invents none', () => {
    const { container } = mountView(
      <ContentSchemaRegistryWorkbench {...props(withActions([]))} />,
    );
    expect(rail(container)?.querySelectorAll('li')).toHaveLength(0);
    expect(rail(container)?.textContent).toContain(
      'The server permits no next action for this version.',
    );
  });

  it('renders no rail while no version detail is selected and exposes no identifiers', () => {
    const none = mountView(
      <ContentSchemaRegistryWorkbench
        {...props({ initialDetail: null, initialReview: null })}
      />,
    );
    expect(rail(none.container)).toBeNull();
    unmountMountedViews();

    const withDetail = mountView(
      <ContentSchemaRegistryWorkbench {...props(withActions(['activate']))} />,
    );
    const text = rail(withDetail.container)?.textContent ?? '';
    expect(text).not.toContain(TYPE_ID);
    expect(text).not.toContain(VERSION_ID);
    expect(rail(withDetail.container)?.querySelectorAll('dl, dd')).toHaveLength(
      0,
    );
  });
});
