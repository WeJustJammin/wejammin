// @vitest-environment jsdom

import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ActionBar from './ActionBar';
import CapabilityGate from '../infrastructure/CapabilityGate';
import ConfirmationStep from './ConfirmationStep';
import DataTable from './DataTable';
import FilterBar from './FilterBar';
import OfflineStatus from './OfflineStatus';
import PlatformConfigurationAsync from './platform-configuration-async';
import SyncConflict from './SyncConflict';
import type { PlatformConfigurationAsyncState } from './platform-configuration-workbench-types';

type MountedView = Readonly<{
  container: HTMLDivElement;
  root: Root;
}>;

const mounted: MountedView[] = [];

const mount = (element: React.ReactElement): MountedView => {
  const container = document.createElement('div');
  (document.body as unknown as HTMLElement).appendChild(container);
  const root = createRoot(container);
  act(() => root.render(element));
  const view = { container, root };
  mounted.push(view);
  return view;
};

const click = (element: Element): void => {
  act(() => element.dispatchEvent(new MouseEvent('click', { bubbles: true })));
};

const keydown = (element: Element, key: string): void => {
  act(() =>
    element.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key })),
  );
};

const changeInput = (input: HTMLInputElement, value: string): void => {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )?.set;
  act(() => {
    setter?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
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
  vi.restoreAllMocks();
});

describe('Phase 2 Slice 07 global primitive behavior', () => {
  it('[P2-S07-AC-081] binds actions to their owner and holds a stable pending label', () => {
    const primary = vi.fn();
    const { container } = mount(
      <ActionBar
        primary="Save change"
        secondary="Review later"
        destructive="Roll back value"
        state="pending"
        expectedVersion="7"
        operationId="operation-7"
        primaryFormId="proposal-form"
        onPrimary={primary}
        onSecondary={vi.fn()}
        onDestructive={vi.fn()}
      />,
    );

    const buttons = container.querySelectorAll('button');
    expect(buttons).toHaveLength(3);
    expect(buttons[0]?.getAttribute('form')).toBe('proposal-form');
    expect(buttons[0]?.getAttribute('aria-busy')).toBe('true');
    expect(buttons[0]?.textContent).toBe('Saving draft…');
    expect(buttons[2]?.getAttribute('aria-describedby')).toBe(
      'platform-configuration-destructive-consequence',
    );
    click(buttons[0] as HTMLButtonElement);
    expect(primary).not.toHaveBeenCalled();
  });

  it('[P2-S07-AC-082] conceals protected labels and explains recoverable denial', () => {
    const hidden = mount(
      <CapabilityGate
        surface="platform-configuration"
        variant="not-rendered"
        reasonCode="FORBIDDEN"
      />,
    );
    expect(hidden.container.innerHTML).toBe('');

    const disabled = mount(
      <CapabilityGate
        surface="platform-configuration"
        variant="disabled"
        reasonCode="STEP_UP_REQUIRED"
        recoveryHref="/app/security"
        disclosure="Recent verification is required."
      />,
    );
    expect(disabled.container.querySelector('[role="status"]')).not.toBeNull();
    expect(disabled.container.textContent).toContain('Recent verification');
    expect(disabled.container.querySelector('a')?.getAttribute('href')).toBe(
      '/app/security',
    );
  });

  it('[P2-S07-AC-083] applies URL-bound filters and Escape preserves non-combobox input', () => {
    const onApply = vi.fn();
    const onReset = vi.fn();
    const { container } = mount(
      <FilterBar
        schema={{ query: { type: 'string' } }}
        values={{ query: 'flags' }}
        resultCount={3}
        resetHref="/app/platform-configuration-admin"
        onApply={onApply}
        onReset={onReset}
      />,
    );
    const input = container.querySelector('input');
    const form = container.querySelector('form');
    expect(input?.value).toBe('flags');
    expect(input?.labels?.[0]?.textContent).toContain('Search configuration');
    expect(
      container.querySelector('[aria-live="polite"]')?.textContent,
    ).toContain('3 records shown');

    changeInput(input as HTMLInputElement, 'runtime');
    act(() =>
      form?.dispatchEvent(
        new SubmitEvent('submit', { bubbles: true, cancelable: true }),
      ),
    );
    expect(onApply).toHaveBeenCalledWith({ query: 'runtime' });
    keydown(input as HTMLInputElement, 'Escape');
    expect(input?.value).toBe('runtime');
    expect(onReset).not.toHaveBeenCalled();
    click(
      container.querySelector('button[type="button"]') as HTMLButtonElement,
    );
    expect(onReset).toHaveBeenCalledOnce();
    expect(input?.value).toBe('');
  });

  it('[P2-S07-AC-084] provides semantic sorting, stable selection, and a narrow priority list', () => {
    const onSort = vi.fn();
    const onSelect = vi.fn();
    const { container } = mount(
      <DataTable
        caption="Configuration records"
        columns={[
          { key: 'key', label: 'Key', priority: 'primary' },
          { key: 'state', label: 'State', priority: 'secondary' },
        ]}
        rows={[
          { id: 'record-a', key: 'web.theme', state: 'effective' },
          { id: 'record-b', key: 'web.locale', state: 'draft' },
        ]}
        sort={{ key: 'key', direction: 'ascending' }}
        selection={{ selectedId: 'record-b', onSelect }}
        density="compact"
        onSort={onSort}
      />,
    );

    expect(container.querySelector('caption')?.textContent).toBe(
      'Configuration records',
    );
    expect(container.querySelector('th[aria-sort="ascending"]')).not.toBeNull();
    click(container.querySelector('th button') as HTMLButtonElement);
    expect(onSort).toHaveBeenCalledWith('key');
    const rowLink = container.querySelector('a[href="?selected=record-a"]');
    click(rowLink as HTMLAnchorElement);
    expect(onSelect).toHaveBeenCalledWith('record-a');
    expect(
      container.querySelector('tr[aria-selected="true"]')?.textContent,
    ).toContain('web.locale');
    expect(
      container.querySelector(
        '[aria-label="Configuration records on narrow screens"]',
      ),
    ).not.toBeNull();
  });

  it('[P2-S07-AC-147,P2-S07-AC-174] bounds lists over 100 rows to the server cursor window', () => {
    const rows = Array.from({ length: 101 }, (_, index) => ({
      id: `record-${String(index).padStart(3, '0')}`,
      key: `web.setting_${String(index).padStart(3, '0')}`,
    }));
    const { container } = mount(
      <DataTable
        columns={[{ key: 'key', label: 'Key', priority: 'primary' }]}
        rows={rows}
      />,
    );

    expect(container.querySelectorAll('tbody tr')).toHaveLength(100);
    expect(
      container.querySelectorAll('.platform-configuration-priority-list li'),
    ).toHaveLength(100);
    expect(container.querySelector('[role="status"]')?.textContent).toContain(
      'server-provided cursor',
    );
    expect(container.textContent).not.toContain('web.setting_100');
  });

  it('[P2-S07-AC-085, P2-S07-AC-139] traps confirmation, returns focus, and names the irreversible consequence', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const trigger = document.createElement('button');
    (document.body as unknown as HTMLElement).appendChild(trigger);
    const triggerRef = { current: trigger };
    const { container } = mount(
      <ConfirmationStep
        consequence="The current value will be replaced."
        affectedScope="platform"
        expectedVersion="7"
        stepUpState="verified"
        idempotencyKey="operation-7"
        actingContext="WeJammin Operations"
        onConfirm={onConfirm}
        onCancel={onCancel}
        triggerRef={triggerRef}
      />,
    );
    const dialog = container.querySelector('[role="dialog"]');
    const heading = container.querySelector('h3');
    const checkbox = container.querySelector('input[type="checkbox"]');
    const submit = container.querySelector('button[type="submit"]');
    expect(document.activeElement).toBe(heading);
    expect(dialog?.textContent).toContain('The current value will be replaced');
    expect(dialog?.textContent).toContain('WeJammin Operations');
    expect(dialog?.textContent).toContain('Verified');
    expect(submit?.hasAttribute('disabled')).toBe(true);
    click(checkbox as HTMLInputElement);
    expect(submit?.hasAttribute('disabled')).toBe(false);
    click(submit as HTMLButtonElement);
    expect(onConfirm).toHaveBeenCalledOnce();
    const cancel = container.querySelector('button[type="button"]');
    (cancel as HTMLButtonElement).focus();
    keydown(dialog as HTMLElement, 'Tab');
    expect(document.activeElement).toBe(checkbox);
    keydown(dialog as HTMLElement, 'Escape');
    expect(onCancel).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });

  it('[P2-S07-AC-086] retains refused intents and names every conflict outcome', () => {
    const retry = vi.fn();
    const review = vi.fn();
    const reapply = vi.fn();
    const discard = vi.fn();
    const offline = mount(
      <OfflineStatus
        connectivity="offline"
        intents={2}
        serverVersion="8"
        localVersion="7"
        requestId="request-7"
        onRetry={retry}
      />,
    );
    expect(offline.container.textContent).toContain(
      'Refused intents remain visible',
    );
    expect(offline.container.textContent).toContain('Retained intents2');
    expect(offline.container.textContent).toContain('Server version8');
    click(offline.container.querySelector('button') as HTMLButtonElement);
    expect(retry).toHaveBeenCalledOnce();

    const conflict = mount(
      <SyncConflict
        serverVersion="8"
        localVersion="7"
        retainedInput={{ typedValue: 'jam' }}
        onReview={review}
        onReapply={reapply}
        onDiscard={discard}
      />,
    );
    expect(conflict.container.querySelector('[role="alert"]')).not.toBeNull();
    const labels = [...conflict.container.querySelectorAll('button')].map(
      (button) => button.textContent,
    );
    expect(labels).toEqual([
      'Review differences',
      'Reapply retained draft',
      'Discard draft',
    ]);
    conflict.container.querySelectorAll('button').forEach(click);
    expect([
      review.mock.calls.length,
      reapply.mock.calls.length,
      discard.mock.calls.length,
    ]).toEqual([1, 1, 1]);
  });
});

describe('Phase 2 Slice 07 typed async states', () => {
  const renderState = (state: PlatformConfigurationAsyncState): HTMLElement =>
    mount(
      <PlatformConfigurationAsync
        state={state}
        requestId="request-7"
        onRetry={vi.fn()}
      />,
    ).container;

  it('[P2-S07-AC-087..P2-S07-AC-095, P2-S07-AC-170] renders distinct, recoverable state semantics', () => {
    expect(renderState({ status: 'idle' }).textContent).toContain(
      'Current platform configuration is ready to read',
    );
    expect(
      renderState({
        status: 'loading',
        startedAt: '2026-09-02T00:00:00.000Z',
        preserveSafePriorContent: true,
      }).textContent,
    ).toContain('Loading current records');
    expect(
      renderState({
        status: 'error',
        error: {
          code: 'RATE_LIMITED',
          message: 'Wait before retrying.',
          requestId: 'request-7',
          details: { retryAfterSeconds: 30 },
        },
        retryable: true,
      }).textContent,
    ).toContain('RATE_LIMITED: Wait before retrying');
    expect(
      renderState({ status: 'empty', reason: 'filter-miss' }).textContent,
    ).toContain('No records match the current filter');
    expect(
      renderState({ status: 'success', data: [], version: '7' }).textContent,
    ).toContain('0 canonical records available');
    expect(
      renderState({ status: 'optimistic-pending', operationId: 'operation-7' })
        .textContent,
    ).toContain('awaiting canonical confirmation');
    expect(
      renderState({
        status: 'optimistic-rollback',
        error: {
          code: 'VERSION_CONFLICT',
          message: 'The command was refused.',
          requestId: 'request-7',
        },
      }).textContent,
    ).toContain('rolled back to the canonical preimage');
    expect(
      renderState({ status: 'disabled', disabledReason: 'Step-up required.' })
        .textContent,
    ).toContain('Step-up required');
    expect(
      renderState({
        status: 'degraded',
        stale: true,
        lastVerifiedAt: '2026-09-02T00:00:00.000Z',
        retryable: true,
      }).textContent,
    ).toContain('Last-known-good');
  });
});
