// @vitest-environment jsdom

import * as React from 'react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ContentSchemaRegistryWorkbench from './ContentSchemaRegistryWorkbench';
import {
  DETAIL,
  RESOURCE,
  mountView,
  unmountMountedViews,
  workbenchProps as props,
} from './content-schema-registry-island-refetch.test-support';

const confirmationCheckbox = (
  container: HTMLElement,
): HTMLInputElement | null =>
  container.querySelector<HTMLInputElement>(
    '#content-schema-registry-confirmed',
  );

const click = (element: Element): void => {
  act(() => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
};

const mount = mountView;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
});

afterEach(() => {
  unmountMountedViews();
  vi.restoreAllMocks();
});

describe('[P2-S09-AC-250] confirmation ownership across canonical refresh', () => {
  it('preserves acknowledgement across a same-projection refresh', () => {
    const view = mount(<ContentSchemaRegistryWorkbench {...props()} />);
    const checkbox = confirmationCheckbox(view.container);
    expect(checkbox).not.toBeNull();
    click(checkbox as HTMLInputElement);
    expect(confirmationCheckbox(view.container)?.checked).toBe(true);

    act(() => {
      view.root.render(<ContentSchemaRegistryWorkbench {...props()} />);
    });
    expect(confirmationCheckbox(view.container)?.checked).toBe(true);
  });

  it('resets acknowledgement when the displayed acting context changes', () => {
    const view = mount(<ContentSchemaRegistryWorkbench {...props()} />);
    const checkbox = confirmationCheckbox(view.container);
    click(checkbox as HTMLInputElement);
    expect(confirmationCheckbox(view.container)?.checked).toBe(true);

    act(() => {
      view.root.render(
        <ContentSchemaRegistryWorkbench
          {...props({ actingContextLabel: 'Other Collective' })}
        />,
      );
    });
    expect(confirmationCheckbox(view.container)?.checked).toBe(false);
  });

  it('resets acknowledgement on a trusted context-change epoch with no identifier', () => {
    const view = mount(<ContentSchemaRegistryWorkbench {...props()} />);
    click(confirmationCheckbox(view.container) as HTMLInputElement);
    expect(confirmationCheckbox(view.container)?.checked).toBe(true);

    act(() => {
      view.root.render(
        <ContentSchemaRegistryWorkbench {...props({ contextEpoch: 1 })} />,
      );
    });
    expect(confirmationCheckbox(view.container)?.checked).toBe(false);
  });

  it('resets acknowledgement when the expected version changes', () => {
    const view = mount(<ContentSchemaRegistryWorkbench {...props()} />);
    const checkbox = confirmationCheckbox(view.container);
    click(checkbox as HTMLInputElement);
    expect(confirmationCheckbox(view.container)?.checked).toBe(true);

    const nextDetail = {
      status: 'success' as const,
      data: {
        ...DETAIL,
        resource: { ...RESOURCE, version: '2' },
      },
      version: '2',
      stale: false,
    };
    act(() => {
      view.root.render(
        <ContentSchemaRegistryWorkbench
          {...props({ expectedVersion: '2', initialDetail: nextDetail })}
        />,
      );
    });
    expect(confirmationCheckbox(view.container)?.checked).toBe(false);
  });

  it('resets acknowledgement when the step-up window changes', () => {
    const view = mount(<ContentSchemaRegistryWorkbench {...props()} />);
    const checkbox = confirmationCheckbox(view.container);
    click(checkbox as HTMLInputElement);
    expect(confirmationCheckbox(view.container)?.checked).toBe(true);

    const { stepUpFreshUntil, ...withoutFresh } = props();
    void stepUpFreshUntil;
    act(() => {
      view.root.render(
        <ContentSchemaRegistryWorkbench
          {...withoutFresh}
          stepUpState="required"
        />,
      );
    });
    expect(confirmationCheckbox(view.container)?.checked).toBe(false);
  });
});
