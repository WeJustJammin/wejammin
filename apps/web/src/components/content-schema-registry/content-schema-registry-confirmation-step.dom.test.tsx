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
  // The web tsconfig also loads Cloudflare worker globals, which type
  // document.body as the worker Body interface; cast to the DOM element.
  (document.body as unknown as HTMLElement).appendChild(container);
  const root = createRoot(container);
  act(() => root.render(element));
  const view = { container, root };
  mounted.push(view);
  return view;
};

const TYPE_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132da';
const VERSION_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132db';

const confirmationProps = {
  consequence:
    'Activation affects the selected content type version and future entry validation.',
  affectedScope: `Content type ${TYPE_ID}, version ${VERSION_ID}`,
  expectedVersion: '4',
  stepUpState: 'verified' as const,
  idempotencyKey: 'cms-schema-activation-250',
};

const click = (element: Element): void => {
  act(() => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
};

const keydown = (element: Element, key: string): boolean => {
  let notCanceled = false;
  act(() => {
    notCanceled = element.dispatchEvent(
      new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key }),
    );
  });
  return notCanceled;
};

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
});

afterEach(() => {
  while (mounted.length > 0) {
    const view = mounted.pop();
    if (view === undefined) continue;
    act(() => view.root.unmount());
    view.container.remove();
  }
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe('[P2-S09-AC-250] content schema registry activation confirmation DOM behavior', () => {
  it('moves focus to the confirmation heading on mount', () => {
    const { container } = mount(
      <ContentSchemaRegistryConfirmationStep {...confirmationProps} />,
    );

    const heading = container.querySelector('h3');
    expect(heading).not.toBeNull();
    expect(heading?.textContent).toBe('Confirm schema activation');
    expect(document.activeElement).toBe(heading);
  });

  it('cancels an acknowledged confirmation on Escape before any commit', () => {
    const onCancel = vi.fn();
    const trigger = document.createElement('button');
    (document.body as unknown as HTMLElement).appendChild(trigger);
    const { container } = mount(
      <ContentSchemaRegistryConfirmationStep
        {...confirmationProps}
        stepUpState="verified"
        onCancel={onCancel}
        triggerRef={{ current: trigger }}
      />,
    );

    const section = container.querySelector('section');
    const checkbox = container.querySelector<HTMLInputElement>(
      'input[type="checkbox"]',
    );
    expect(section).not.toBeNull();
    expect(checkbox?.checked).toBe(false);

    click(checkbox as HTMLInputElement);
    expect(checkbox?.checked).toBe(true);

    const notCanceled = keydown(section as HTMLElement, 'Escape');
    expect(notCanceled).toBe(false);
    expect(onCancel).toHaveBeenCalledOnce();
    expect(checkbox?.checked).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });

  it('leaves the acknowledgment and focus untouched for keys other than Escape', () => {
    const onCancel = vi.fn();
    const { container } = mount(
      <ContentSchemaRegistryConfirmationStep
        {...confirmationProps}
        onCancel={onCancel}
      />,
    );

    const section = container.querySelector('section');
    const checkbox = container.querySelector<HTMLInputElement>(
      'input[type="checkbox"]',
    );
    click(checkbox as HTMLInputElement);
    expect(checkbox?.checked).toBe(true);

    const notCanceled = keydown(section as HTMLElement, 'Enter');
    expect(notCanceled).toBe(true);
    expect(onCancel).not.toHaveBeenCalled();
    expect(checkbox?.checked).toBe(true);
  });
});
