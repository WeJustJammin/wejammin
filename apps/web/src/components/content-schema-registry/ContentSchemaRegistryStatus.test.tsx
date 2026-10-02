// @vitest-environment jsdom

import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ContentSchemaRegistryStatus from './ContentSchemaRegistryStatus';

const supportReference = 'SR-0A1B-2C3D-4E5F-6A7B';

const mount = (
  state: React.ComponentProps<typeof ContentSchemaRegistryStatus>['state'],
) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() =>
    root.render(
      <ContentSchemaRegistryStatus
        state={state}
        regionLabel="Registry list"
        supportReference={supportReference}
        canonicalUrl="/app/cms-content-modeling"
      />,
    ),
  );
  return { container, root };
};

afterEach(() => {
  document.body.replaceChildren();
  vi.useRealTimers();
});

describe('ContentSchemaRegistryStatus recovery controls', () => {
  it('keeps a 429 retry disabled until Retry-After expires', () => {
    vi.useFakeTimers();
    const { container, root }: { container: HTMLDivElement; root: Root } =
      mount({
        status: 'error',
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many registry requests.',
        },
        retryable: true,
        httpStatus: 429,
        retryAfterSeconds: 2,
      });

    expect(container.textContent).toContain('Retry available in 2 seconds.');
    const retry = container.querySelector<HTMLButtonElement>(
      '[data-cms-retry-control="disabled"]',
    );
    expect(retry).not.toBeNull();
    expect(retry?.disabled).toBe(true);
    expect(
      container.querySelector('a[data-cms-retry-control="enabled"]'),
    ).toBeNull();

    act(() => vi.advanceTimersByTime(1_000));
    expect(container.textContent).toContain('Retry available in 1 second.');
    act(() => vi.advanceTimersByTime(1_000));
    expect(container.textContent).toContain('Retry is available now.');
    expect(
      container.querySelector('a[data-cms-retry-control="enabled"]'),
    ).not.toBeNull();
    root.unmount();
  });
});
