// @vitest-environment jsdom

import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ContentSchemaRegistryConfirmationStep from './ContentSchemaRegistryConfirmationStep';

type Mounted = Readonly<{ container: HTMLDivElement; root: Root }>;

const mounted: Mounted[] = [];

const mount = (element: React.ReactElement): Mounted => {
  const container = document.createElement('div');
  (document.body as unknown as HTMLElement).appendChild(container);
  const root = createRoot(container);
  act(() => root.render(element));
  const view = { container, root };
  mounted.push(view);
  return view;
};

const NOW = Date.parse('2026-10-01T12:00:00.000Z');
const FRESH_UNTIL = '2026-10-01T12:05:00.000Z';
const PAST_UNTIL = '2026-10-01T11:59:00.000Z';

const props = (overrides: Record<string, unknown> = {}) => ({
  consequence: 'Activation affects the selected content type version.',
  affectedScope: 'Content type release_note, version 4',
  expectedVersion: '4',
  stepUpState: 'verified' as const,
  idempotencyKey: 'cms-schema-activation-250',
  ...overrides,
});

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  while (mounted.length > 0) {
    const view = mounted.pop();
    if (view === undefined) continue;
    act(() => view.root.unmount());
    view.container.remove();
  }
  document.body.replaceChildren();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('[P2-S09-AC-250] activation confirmation disclosure', () => {
  it('shows the resolved human acting-context label and never an identifier', () => {
    const { container } = mount(
      <ContentSchemaRegistryConfirmationStep
        {...props({ actingContextLabel: 'Northwind Collective' })}
      />,
    );
    const text = container.textContent ?? '';
    expect(text).toContain('Northwind Collective');
    expect(text).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/iu);
  });

  it('states plainly when no verified acting context is available', () => {
    const { container } = mount(
      <ContentSchemaRegistryConfirmationStep {...props()} />,
    );
    expect(container.textContent).toContain(
      'Server-verified acting context unavailable',
    );
    const empty = mount(
      <ContentSchemaRegistryConfirmationStep
        {...props({ actingContextLabel: '' })}
      />,
    );
    expect(empty.container.textContent).toContain(
      'Server-verified acting context unavailable',
    );
  });

  it('states a bounded verification time instead of an indefinite claim', () => {
    const { container } = mount(
      <ContentSchemaRegistryConfirmationStep
        {...props({
          actingContextLabel: 'Northwind Collective',
          stepUpFreshUntil: FRESH_UNTIL,
        })}
      />,
    );
    const text = container.textContent ?? '';
    expect(text).toContain('Verified until 12:05 UTC');
  });

  it('expires a stale verification on the mounted UI without a reload', () => {
    const { container } = mount(
      <ContentSchemaRegistryConfirmationStep
        {...props({ stepUpFreshUntil: FRESH_UNTIL })}
      />,
    );
    expect(container.textContent).toContain('Verified until');
    act(() => {
      vi.setSystemTime(NOW + 6 * 60 * 1000);
      vi.advanceTimersByTime(60 * 1000);
    });
    expect(container.textContent).not.toContain('Verified until');
    expect(container.textContent).toContain('Step-up required before commit');
  });

  it('re-derives on window focus and visibility return', () => {
    const { container } = mount(
      <ContentSchemaRegistryConfirmationStep
        {...props({ stepUpFreshUntil: FRESH_UNTIL })}
      />,
    );
    act(() => {
      vi.setSystemTime(NOW + 6 * 60 * 1000);
      window.dispatchEvent(new Event('focus'));
    });
    expect(container.textContent).toContain('Step-up required before commit');
  });

  it('never claims verification from an expired, malformed, or absent expiry', () => {
    for (const stepUpFreshUntil of [
      undefined,
      '',
      'not-a-timestamp',
      PAST_UNTIL,
    ] as const) {
      const { container } = mount(
        <ContentSchemaRegistryConfirmationStep
          {...props({ stepUpFreshUntil })}
        />,
      );
      const text = container.textContent ?? '';
      expect(text, String(stepUpFreshUntil)).not.toContain('Verified until');
      expect(text).toContain('Step-up required before commit');
      act(() => container.remove());
    }
  });

  it('drops acknowledgement when the verified window expires while mounted', () => {
    const { container } = mount(
      <ContentSchemaRegistryConfirmationStep
        {...props({ stepUpFreshUntil: FRESH_UNTIL })}
      />,
    );
    const checkbox = container.querySelector<HTMLInputElement>(
      'input[type="checkbox"]',
    );
    expect(checkbox).not.toBeNull();
    act(() => {
      checkbox?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(
      container.querySelector<HTMLInputElement>('input[type="checkbox"]')
        ?.checked,
    ).toBe(true);

    act(() => {
      vi.setSystemTime(NOW + 6 * 60 * 1000);
      vi.advanceTimersByTime(60 * 1000);
    });
    expect(container.textContent).toContain('Step-up required before commit');
    expect(
      container.querySelector<HTMLInputElement>('input[type="checkbox"]')
        ?.checked,
    ).toBe(false);
  });
});
