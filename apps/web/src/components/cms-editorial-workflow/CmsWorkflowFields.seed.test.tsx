// @vitest-environment jsdom
import * as React from 'react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import CmsWorkflowCommandFrame from './CmsWorkflowCommandFrame';
import {
  WorkflowRadioGroup,
  WorkflowSelect,
  WorkflowTextArea,
  WorkflowTextField,
} from './CmsWorkflowFields';
import {
  installLazyIntent,
  resetLazyIntentForTest,
  whenRegionIntent,
} from './cms-lazy-intent';

/*
 * A form that loads on intent shows native, enabled controls before it hydrates (so keyboard,
 * pointer and assistive technology work as in any server-rendered form). React keeps a value typed
 * before hydration in the DOM but not in state, so the field primitives start their state from
 * what the person already entered (cms-lazy-intent.ts `takePreHydrationValue`). Nothing typed,
 * chosen or pressed before hydration is lost, and nothing is disabled or read-only.
 */
const tick = (ms = 0): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const idle = {
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
} as const;

const controller = {
  retry: async () => undefined,
  reconcile: async () => undefined,
  dismiss: () => undefined,
  acknowledgeConflict: () => undefined,
};

interface Values {
  readonly reason: string;
  readonly expiry: string;
  readonly who: string;
  readonly decision: string;
}

function Form({
  onSubmit,
  initial,
}: {
  onSubmit: (values: Values) => void;
  initial?: Partial<Values>;
}): React.ReactElement {
  const [reason, setReason] = React.useState(initial?.reason ?? '');
  const [expiry, setExpiry] = React.useState(initial?.expiry ?? '');
  const [who, setWho] = React.useState(initial?.who ?? 'a');
  const [decision, setDecision] = React.useState(initial?.decision ?? '');
  return (
    <CmsWorkflowCommandFrame
      headingId="seed-title"
      title="Seed"
      state={idle as never}
      controller={controller as never}
      pendingLabel="…"
      committedLabel={() => 'ok'}
      fieldIds={{}}
      lazyRegion="seed"
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit({ reason, expiry, who, decision });
        }}
      >
        <WorkflowTextArea
          id="seed-reason"
          label="Reason"
          value={reason}
          onChange={setReason}
        />
        <WorkflowTextField
          id="seed-expiry"
          label="Expiry"
          value={expiry}
          onChange={setExpiry}
        />
        <WorkflowSelect
          id="seed-who"
          label="Who"
          value={who}
          options={[
            { value: 'a', label: 'A' },
            { value: 'b', label: 'B' },
          ]}
          onChange={setWho}
        />
        <WorkflowRadioGroup
          id="seed-decision"
          legend="Decision"
          name="seed-decision"
          value={decision}
          options={[
            { value: 'approve', label: 'Approve' },
            { value: 'reject', label: 'Reject' },
          ]}
          onChange={setDecision}
        />
        <button type="submit">Send</button>
      </form>
    </CmsWorkflowCommandFrame>
  );
}

describe('hydrating a region that loads on intent', () => {
  const roots: Root[] = [];
  beforeEach(installLazyIntent);
  afterEach(() => {
    for (const root of roots.splice(0)) root.unmount();
    resetLazyIntentForTest();
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  const mount = (onSubmit: (values: Values) => void) => {
    const Lazy = React.lazy(async () => {
      await whenRegionIntent('seed');
      return { default: Form };
    });
    const host = document.createElement('div');
    host.innerHTML = renderToString(
      <React.Suspense fallback={null}>
        <Form onSubmit={onSubmit} />
      </React.Suspense>,
    );
    document.body.appendChild(host);
    roots.push(
      hydrateRoot(
        host,
        <React.Suspense fallback={null}>
          <Lazy onSubmit={onSubmit} />
        </React.Suspense>,
      ),
    );
    return host;
  };

  const enter = (host: HTMLElement): void => {
    const reason = host.querySelector<HTMLTextAreaElement>('#seed-reason')!;
    reason.value = 'typed before hydration';
    reason.dispatchEvent(new Event('input', { bubbles: true }));
    const expiry = host.querySelector<HTMLInputElement>('#seed-expiry')!;
    expiry.value = '2026-12-01T10:00';
    expiry.dispatchEvent(new Event('input', { bubbles: true }));
    const who = host.querySelector('#seed-who') as unknown as HTMLSelectElement;
    who.value = 'b';
    who.dispatchEvent(new Event('change', { bubbles: true }));
    const reject = host.querySelector<HTMLInputElement>(
      '#seed-decision-reject',
    )!;
    reject.checked = true;
    reject.dispatchEvent(new Event('change', { bubbles: true }));
  };

  it('writes native, enabled, editable controls into the server markup', () => {
    const host = document.createElement('div');
    vi.stubGlobal('document', undefined);
    host.innerHTML = renderToString(<Form onSubmit={() => undefined} />);
    vi.unstubAllGlobals();
    expect(host.querySelector('[disabled]')).toBeNull();
    expect(host.querySelector('[readonly]')).toBeNull();
    expect(host.querySelector('[data-cms-prehydration-lock]')).toBeNull();
    expect(host.querySelector('section')?.getAttribute('aria-busy')).toBeNull();
  });

  it('starts the state from what was typed, chosen and selected before hydration', async () => {
    const onSubmit = vi.fn();
    const host = mount(onSubmit);
    await tick(20);
    expect(host.querySelector('#seed-reason')).not.toBeNull();
    enter(host);
    await tick(80);
    host.querySelector('form')!.requestSubmit();
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({
      reason: 'typed before hydration',
      expiry: '2026-12-01T10:00',
      who: 'b',
      decision: 'reject',
    });
  });

  it('delivers what was typed through a submit pressed before hydration, once', async () => {
    const onSubmit = vi.fn();
    const host = mount(onSubmit);
    await tick(20);
    enter(host);
    // The change events armed the region, so hydration may already be under way: submit at once.
    host
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await tick(100);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]?.[0]).toEqual({
      reason: 'typed before hydration',
      expiry: '2026-12-01T10:00',
      who: 'b',
      decision: 'reject',
    });
  });

  it('leaves a control the person did not touch at its server value', async () => {
    const onSubmit = vi.fn();
    const host = mount(onSubmit);
    await tick(20);
    const reason = host.querySelector<HTMLTextAreaElement>('#seed-reason')!;
    reason.value = 'only this';
    reason.dispatchEvent(new Event('input', { bubbles: true }));
    await tick(80);
    host.querySelector('form')!.requestSubmit();
    expect(onSubmit).toHaveBeenCalledWith({
      reason: 'only this',
      expiry: '',
      who: 'a',
      decision: '',
    });
  });

  it('keeps typing after hydration working', async () => {
    const onSubmit = vi.fn();
    const host = mount(onSubmit);
    await tick(20);
    enter(host);
    await tick(80);
    const reason = host.querySelector<HTMLTextAreaElement>('#seed-reason')!;
    const setter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      'value',
    )!.set!;
    setter.call(reason, 'edited after');
    reason.dispatchEvent(new Event('input', { bubbles: true }));
    await tick(10);
    host.querySelector('form')!.requestSubmit();
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      reason: 'edited after',
    });
  });
});
