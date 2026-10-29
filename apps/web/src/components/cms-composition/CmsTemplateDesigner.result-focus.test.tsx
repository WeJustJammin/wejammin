// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { loadCmsValidators } from '../../lib/cms-contract-validators';
import { templateSurfaces } from './cms-template-result-heading.test-support';

/**
 * [P2-S12-AC-042] FE03 CMS-11 row (1110): "focus stays until named result heading". A verified
 * success is a named heading whose accessible name is the result; it takes focus when the 201
 * arrives, stays focused until the person navigates, and sits in the polite status region that
 * announces the result. A refusal keeps the existing summary-region focus ("focus summary/field").
 */
let root: Root | null = null;
beforeAll(async () => {
  await loadCmsValidators();
});
afterEach(async () => {
  if (root !== null)
    await act(async () => {
      root!.unmount();
    });
  root = null;
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

const mountAndSubmit = async (
  surface: (typeof templateSurfaces)[number],
  response: () => Response,
): Promise<HTMLElement> => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => response()),
  );
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(surface.element);
  });
  await surface.prepare(container);
  await act(async () => {
    container
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
  return container;
};

describe.each(templateSurfaces)('template result focus: $name', (surface) => {
  it('[P2-S12-AC-042] a verified success is a named result heading that takes focus and stays focused', async () => {
    const container = await mountAndSubmit(surface, surface.response);
    const heading = container.querySelector('h3');
    expect(heading?.textContent).toBe(surface.success);
    expect(document.activeElement).toBe(heading);
    expect(heading?.getAttribute('tabindex')).toBe('-1');
    // The polite announcement is kept: the heading lives in the status region that states the result.
    const region = heading?.closest('[aria-live="polite"]');
    expect(region?.getAttribute('role')).toBe('status');
    expect(region?.textContent).toContain('This is not a published template.');
    // Nothing moves focus again until the person navigates.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(document.activeElement).toBe(heading);
  });

  it('[P2-S12-AC-042] a refusal keeps focus on the summary region, not on a result heading', async () => {
    const container = await mountAndSubmit(surface, () =>
      Response.json({ code: 'TEMPLATE_FORBIDDEN' }, { status: 403 }),
    );
    expect(container.querySelector('h3')).toBeNull();
    const region = container.querySelector('[role="alert"]');
    expect(document.activeElement).toBe(region);
  });
});
