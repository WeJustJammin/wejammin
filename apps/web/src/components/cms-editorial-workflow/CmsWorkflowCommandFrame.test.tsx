// @vitest-environment jsdom
import * as React from 'react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  buttonNamed,
  click,
  disableReactAct,
  enableReactAct,
  mountElement,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import type { CommandState } from './cms-workflow-command-controller';
import type { ClassifiedRefusal } from './cms-workflow-refusal';
import CmsWorkflowCommandFrame, {
  workflowStatusText,
} from './CmsWorkflowCommandFrame';

beforeAll(enableReactAct);
afterAll(disableReactAct);

const state = (
  overrides: Partial<CommandState<{ id: string }>> = {},
): CommandState<{ id: string }> => ({
  phase: 'idle',
  idempotencyKey: 'key-0000000001',
  committed: null,
  refusal: null,
  stepUpIssue: null,
  signInHref: null,
  requestId: null,
  reconciled: false,
  restoredValues: null,
  conflict: null,
  ...overrides,
});

const refusal = (
  overrides: Partial<ClassifiedRefusal> = {},
): ClassifiedRefusal => ({
  kind: 'refetch',
  message: 'The checks changed. Review the updated results.',
  rotateKey: true,
  refetch: true,
  fields: [],
  preflight: null,
  alternatives: null,
  foldAlternatives: null,
  window: null,
  requestId: null,
  ...overrides,
});

const controller = () => ({
  retry: vi.fn(() => Promise.resolve()),
  reconcile: vi.fn(() => Promise.resolve()),
  dismiss: vi.fn(),
  acknowledgeConflict: vi.fn(),
});

const mount = (
  commandState: CommandState<{ id: string }>,
  extra: Partial<
    Pick<
      React.ComponentProps<typeof CmsWorkflowCommandFrame>,
      'disabledReason' | 'localErrors' | 'result'
    >
  > = {},
  actions = controller(),
) => {
  const mounted = mountElement(
    <CmsWorkflowCommandFrame
      headingId="form-title"
      title="Record a decision"
      state={commandState}
      controller={actions}
      pendingLabel="Recording decision…"
      committedLabel={(resource: { id: string }) => `Recorded ${resource.id}.`}
      fieldIds={{ reason: { id: 'reason-field', label: 'Reason' } }}
      {...extra}
    >
      <input id="reason-field" aria-label="Reason" />
    </CmsWorkflowCommandFrame>,
  );
  return { ...mounted, actions };
};

describe('CmsWorkflowCommandFrame', () => {
  it('names its form by a focusable heading and keeps one persistent polite status region', () => {
    const { container } = mount(state());
    const section = container.querySelector('section[data-cms-workflow-form]');
    expect(section?.getAttribute('aria-labelledby')).toBe('form-title');
    const heading = container.querySelector('#form-title');
    expect(heading?.tagName).toBe('H3');
    expect(heading?.getAttribute('tabindex')).toBe('-1');
    const status = container.querySelector('[data-cms-workflow-status]');
    expect(status?.getAttribute('role')).toBe('status');
    expect(status?.getAttribute('aria-live')).toBe('polite');
    expect(status?.getAttribute('aria-atomic')).toBe('true');
    expect(status?.textContent).toBe('');
    expect(container.querySelectorAll('[role="alert"]')).toHaveLength(0);
    expect(container.querySelector('#reason-field')).not.toBeNull();
  });

  it.each([
    [state({ phase: 'pending' }), 'Recording decision…'],
    [state({ phase: 'committed', committed: { id: 'r1' } }), 'Recorded r1.'],
    [state({ phase: 'step-up-leaving' }), 'Opening verification…'],
    [
      state({ phase: 'restored', restoredValues: { reason: 'x' } }),
      'Your entries were restored. Review them, then confirm.',
    ],
    [
      state({ phase: 'unknown', reconciled: false }),
      'The result could not be confirmed. Checking the current state before you retry.',
    ],
    [
      state({ phase: 'unknown', reconciled: true }),
      'The current state is loaded. You can retry the same request.',
    ],
  ])('announces %#', (commandState, expected) => {
    const { container } = mount(commandState);
    expect(
      container.querySelector('[data-cms-workflow-status]')?.textContent,
    ).toBe(expected);
    expect(
      workflowStatusText(
        commandState,
        'Recording decision…',
        () => 'Recorded r1.',
      ),
    ).toBe(expected);
  });

  it('renders a refusal as an alert that takes focus, with a link to each named field', () => {
    const { container } = mount(
      state({
        phase: 'refused',
        refusal: refusal({
          kind: 'field',
          message: 'Check the highlighted fields.',
          fields: ['reason', 'unknownField'],
          requestId: '0195b6f0-0000-7000-8000-000000000001',
        }),
      }),
    );
    const alert = container.querySelector('[role="alert"]') as HTMLElement;
    expect(alert.textContent).toContain('Check the highlighted fields.');
    expect(alert.textContent).toContain(
      'Reference: 0195b6f0-0000-7000-8000-000000000001',
    );
    const links = alert.querySelectorAll('a');
    expect(links).toHaveLength(1);
    expect(links[0]?.getAttribute('href')).toBe('#reason-field');
    expect(links[0]?.textContent).toBe('Reason');
    expect(document.activeElement).toBe(alert);
  });

  it('renders the capability gate copy for a 403 with no step-up link', () => {
    const { container } = mount(
      state({
        phase: 'refused',
        refusal: refusal({
          kind: 'gate',
          message:
            'A second person with the publisher capability must publish this revision.',
        }),
      }),
    );
    const gate = container.querySelector(
      '[data-cms-editorial-capability-gate]',
    );
    expect(gate?.textContent).toContain(
      'A second person with the publisher capability must publish this revision.',
    );
    expect(container.querySelector('a[href*="step-up"]')).toBeNull();
  });

  it('lists only the checks that did not pass for a preflight refusal', () => {
    const { container } = mount(
      state({
        phase: 'refused',
        refusal: refusal({
          kind: 'preflight',
          message: 'Some checks did not pass. Nothing was submitted.',
          preflight: [
            {
              category: 'contract',
              outcome: 'failed',
              reasonCode: 'value_invalid',
            },
          ],
        }),
      }),
    );
    const alert = container.querySelector('[role="alert"]');
    expect(alert?.querySelectorAll('li')).toHaveLength(1);
    expect(alert?.textContent).toContain('Content contract');
    expect(alert?.textContent).toContain('A field value is invalid.');
  });

  it('states the degraded step-up case with the request id and no way to continue', () => {
    const { container } = mount(
      state({
        phase: 'step-up-unavailable',
        stepUpIssue: { kind: 'no-method', requestId: 'req-9' },
      }),
    );
    const alert = container.querySelector('[role="alert"]') as HTMLElement;
    expect(alert.textContent).toContain('No verification method is available');
    expect(alert.textContent).toContain('Reference: req-9');
    expect(document.activeElement).toBe(alert);
    const malformed = mount(
      state({
        phase: 'step-up-unavailable',
        stepUpIssue: { kind: 'malformed', requestId: null },
      }),
    );
    expect(
      malformed.container.querySelector('[role="alert"]')?.textContent,
    ).toContain('Verification could not be started.');
  });

  it('offers a native sign-in link to the exact page when the session ended', () => {
    const { container } = mount(
      state({
        phase: 'signed-out',
        signInHref: '/auth/sign-in?returnTo=%2Fapp',
        requestId: 'req-3',
      }),
    );
    const alert = container.querySelector('[role="alert"]') as HTMLElement;
    expect(alert.textContent).toContain(
      'Your session expired. Your entries were not saved.',
    );
    expect(alert.querySelector('a')?.getAttribute('href')).toBe(
      '/auth/sign-in?returnTo=%2Fapp',
    );
    expect(alert.textContent).toContain('Reference: req-3');
  });

  it('gates the retry of an unknown outcome behind the reconciling read', async () => {
    const waiting = mount(state({ phase: 'unknown', reconciled: false }));
    const retry = buttonNamed(waiting.container, 'Retry the same request');
    expect(retry.getAttribute('aria-disabled')).toBe('true');
    await click(retry);
    expect(waiting.actions.retry).not.toHaveBeenCalled();
    await click(buttonNamed(waiting.container, 'Check the current state'));
    expect(waiting.actions.reconcile).toHaveBeenCalledTimes(1);

    const ready = mount(state({ phase: 'unknown', reconciled: true }));
    const enabled = buttonNamed(ready.container, 'Retry the same request');
    expect(enabled.getAttribute('aria-disabled')).toBe('false');
    await click(enabled);
    expect(ready.actions.retry).toHaveBeenCalledTimes(1);
  });

  it('opens the sync conflict after a step-up return with a changed version', async () => {
    const { container, actions } = mount(
      state({
        phase: 'conflict',
        conflict: { draftVersion: '4', currentVersion: '9' },
      }),
    );
    const conflict = container.querySelector(
      '[data-cms-editorial-sync-conflict]',
    );
    expect(conflict?.textContent).toContain(
      'This record changed while you were verifying',
    );
    expect(conflict?.textContent).toContain('version 4');
    expect(conflict?.textContent).toContain('version 9');
    await click(
      buttonNamed(container, 'Review the current version and continue'),
    );
    expect(actions.acknowledgeConflict).toHaveBeenCalledTimes(1);
  });

  it('withholds the commands with the stated reason when the read is not verified', () => {
    const { container } = mount(state(), {
      disabledReason:
        'The last read could not be verified. Commands are off until it is.',
    });
    expect(
      container.querySelector('[data-cms-workflow-disabled]')?.textContent,
    ).toBe(
      'The last read could not be verified. Commands are off until it is.',
    );
  });

  it('puts field errors found before sending into one alert with a link to each control', () => {
    const { container } = mount(state(), {
      localErrors: [
        { id: 'reason-field', label: 'Reason', message: 'Enter a reason.' },
      ],
    });
    const alert = container.querySelector(
      '[data-cms-workflow-local-errors]',
    ) as HTMLElement;
    expect(alert.getAttribute('role')).toBe('alert');
    expect(alert.textContent).toContain(
      'Check these fields before continuing.',
    );
    expect(alert.querySelector('a')?.getAttribute('href')).toBe(
      '#reason-field',
    );
    expect(alert.textContent).toContain('Reason: Enter a reason.');
    expect(document.activeElement).toBe(alert);
  });

  it('shows the committed result in its slot beside the status', () => {
    const { container } = mount(
      state({ phase: 'committed', committed: { id: 'r1' } }),
      { result: <p id="result">Done</p> },
    );
    expect(container.querySelector('#result')?.textContent).toBe('Done');
  });
});
