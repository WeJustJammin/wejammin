// @vitest-environment jsdom

import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { focusPageHeading } from '../identity-authority/step-up-mfa/focus-page-heading';
import ContentSchemaRegistryActionBar, {
  OPERATION_LABELS,
} from './ContentSchemaRegistryActionBar';
import CapabilityGate from '../infrastructure/CapabilityGate';
import ContentSchemaRegistryConfirmationStep from './ContentSchemaRegistryConfirmationStep';
import ContentSchemaRegistryFilterBar from './ContentSchemaRegistryFilterBar';
import { completeContentSchemaRegistryMutation } from './content-schema-registry-runtime-dom-mutation-complete';
import type { ContentSchemaRegistryCommandState } from './content-schema-registry-types';

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
const rerender = (view: Mounted, element: React.ReactElement): void => {
  act(() => view.root.render(element));
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
const click = (element: Element): void => {
  act(() => {
    element.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true }),
    );
  });
};
const keydown = (element: Element, key: string): boolean => {
  let notCanceled = true;
  act(() => {
    notCanceled = element.dispatchEvent(
      new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key }),
    );
  });
  return notCanceled;
};

describe('[P2-S09-AC-236] [P2-S09-AC-263] ActionBar', () => {
  const bar = (
    state: ContentSchemaRegistryCommandState,
    extra: Partial<
      React.ComponentProps<typeof ContentSchemaRegistryActionBar>
    > = {},
  ) => (
    <ContentSchemaRegistryActionBar
      formId="form-a"
      operationId="CMS-03A-02"
      expectedVersion="4"
      state={state}
      consequence="The draft field schema changes; no active version is affected."
      {...extra}
    />
  );

  it('uses native buttons owned by the form, names the operation, expected version and consequence', () => {
    const { container } = mount(
      <>
        <form id="form-a" />
        {bar('idle')}
      </>,
    );
    const [save, cancel] = [...container.querySelectorAll('button')];
    expect(save?.type).toBe('submit');
    expect(save?.getAttribute('form')).toBe('form-a');
    expect(cancel?.type).toBe('button');
    expect(container.textContent).toContain('CMS-03A-02');
    expect(container.querySelector('code')?.textContent).toBe('4');
    const consequence = container.querySelector('#cms-03a-02-consequence');
    expect(consequence?.textContent).toContain(
      'The draft field schema changes',
    );
    expect(save?.getAttribute('aria-describedby')).toBe(
      'cms-03a-02-consequence',
    );
    for (const operationId of Object.keys(OPERATION_LABELS))
      expect(
        OPERATION_LABELS[operationId as keyof typeof OPERATION_LABELS].length,
      ).toBeGreaterThan(3);
  });

  it('keeps one stable label per state: Saving while pending (busy and not clickable), Save otherwise', () => {
    const labels = (state: ContentSchemaRegistryCommandState) => {
      const view = mount(bar(state, { instanceKey: state }));
      const save = view.container.querySelector<HTMLButtonElement>(
        'button[type="submit"]',
      );
      return {
        text: save?.textContent,
        disabled: save?.disabled,
        busy: save?.getAttribute('aria-busy'),
      };
    };
    expect(labels('pending')).toEqual({
      text: 'Saving field schema',
      disabled: true,
      busy: 'true',
    });
    expect(labels('idle')).toEqual({
      text: 'Save field schema',
      disabled: false,
      busy: null,
    });
    expect(labels('error')).toEqual({
      text: 'Save field schema',
      disabled: false,
      busy: null,
    });
    expect(labels('success').text).toBe('Save field schema');
    expect(labels('disabled').disabled).toBe(true);
    const noForm = mount(bar('idle', { formId: undefined } as never));
    expect(
      noForm.container.querySelector<HTMLButtonElement>('button[type="submit"]')
        ?.disabled,
    ).toBe(true);
  });

  it('returns focus to the trigger when a pending command settles and only then', () => {
    const trigger = document.createElement('button');
    (document.body as unknown as HTMLElement).appendChild(trigger);
    const triggerRef = { current: trigger };
    const view = mount(bar('idle', { triggerRef }));
    rerender(view, bar('pending', { triggerRef }));
    expect(document.activeElement).not.toBe(trigger);
    rerender(view, bar('success', { triggerRef }));
    expect(document.activeElement).toBe(trigger);
    trigger.blur();
    rerender(view, bar('pending', { triggerRef }));
    rerender(view, bar('error', { triggerRef }));
    expect(document.activeElement).toBe(trigger);
    trigger.blur();
    rerender(view, bar('idle', { triggerRef }));
    expect(document.activeElement).not.toBe(trigger);
  });

  it('submits only the form that owns the button', () => {
    const submitted: string[] = [];
    const { container } = mount(
      <>
        <form
          id="form-a"
          onSubmit={(event) => {
            event.preventDefault();
            submitted.push('a');
          }}
        />
        <form
          id="form-b"
          onSubmit={(event) => {
            event.preventDefault();
            submitted.push('b');
          }}
        />
        {bar('idle', { instanceKey: 'a' })}
        {bar('idle', { formId: 'form-b', instanceKey: 'b' })}
      </>,
    );
    const buttons = [
      ...container.querySelectorAll<HTMLButtonElement>('button[type="submit"]'),
    ];
    click(buttons[1] as HTMLButtonElement);
    expect(submitted).toEqual(['b']);
    click(buttons[0] as HTMLButtonElement);
    expect(submitted).toEqual(['b', 'a']);
  });
});

describe('[P2-S09-AC-237] CapabilityGate', () => {
  const markup = (props: React.ComponentProps<typeof CapabilityGate>) =>
    renderToStaticMarkup(
      <CapabilityGate surface="content-schema-registry" {...props} />,
    );

  it('emits no protected label, code or disclosure for not-rendered and nothing for full access', () => {
    expect(
      markup({
        variant: 'not-rendered',
        reasonCode: 'SCHEMA_DESIGNER_REQUIRED',
        disclosure: 'release_note registry',
        recoveryHref: '/app/x',
      }),
    ).toBe('');
    expect(markup({ variant: 'full', reasonCode: 'ownerFull' })).toBe('');
  });

  it('states a reason and a recovery link for a disabled gate and never more than the server disclosed', () => {
    const disabled = markup({
      variant: 'disabled',
      reasonCode: 'SCHEMA_REGISTRY_UNAVAILABLE',
      recoveryHref: '/app/cms-content-modeling',
      disclosure: 'A server capability prerequisite is not satisfied.',
    });
    expect(disabled).toContain('SCHEMA_REGISTRY_UNAVAILABLE');
    expect(disabled).toContain('href="/app/cms-content-modeling"');
    expect(disabled).toContain(
      'A server capability prerequisite is not satisfied.',
    );
    expect(disabled).toContain('tabindex="-1"');
    const readOnly = markup({ variant: 'read-only' });
    expect(readOnly).toContain('Read-only registry access');
    expect(readOnly).not.toContain('tabindex');
    expect(disabled).not.toMatch(/release_note|cms\.schema_designer|ownerId/u);
  });

  it('renders the gate a refused mutation opens with a reason and a recovery link back to the canonical read', () => {
    document.body.innerHTML =
      '<form id="content-schema-registry-field-form" action="/app/cms-content-modeling/t/versions/v"><input name="key" value="draft input"></form>';
    const form = document.querySelector('form') as HTMLFormElement;
    completeContentSchemaRegistryMutation(
      form,
      { outcome: 'forbidden' } as never,
      window,
      new Set(),
    );
    const gate = form.querySelector('[data-cms-capability-gate="true"]');
    expect(gate?.textContent).toContain('Reason: FORBIDDEN');
    expect(gate?.querySelector('a')?.getAttribute('href')).toBe(
      '/app/cms-content-modeling/t/versions/v',
    );
    expect(document.activeElement).toBe(gate?.querySelector('h3'));
    expect(
      form.querySelector<HTMLInputElement>('input[name="key"]')?.value,
    ).toBe('draft input');
    expect(gate?.textContent).not.toMatch(/CMS-03A|schema_designer|ownerId/u);
  });

  it('never renders a gate for a 401 step-up: it navigates to /step-up and the step-up page heading takes focus', () => {
    document.body.innerHTML =
      '<form id="content-schema-registry-field-form" action="/app/cms-content-modeling/t/versions/v"><input name="key" value="x"></form>';
    const form = document.querySelector('form') as HTMLFormElement;
    const navigate = vi.fn();
    completeContentSchemaRegistryMutation(
      form,
      {
        outcome: 'step-up-required',
        formData: new FormData(form),
        requestId: null,
      } as never,
      window,
      new Set(),
      navigate,
    );
    expect(form.querySelector('[data-cms-capability-gate]')).toBeNull();
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(String(navigate.mock.calls[0]?.[0])).toMatch(
      /^\/step-up\?returnTo=/u,
    );
    document.body.innerHTML =
      '<main><h1 id="page-title" tabindex="-1">Verify it&#39;s you</h1><input id="other"></main>';
    focusPageHeading(document, { hash: '' });
    expect(document.activeElement?.id).toBe('page-title');
    (document.querySelector('#other') as HTMLElement).focus();
    focusPageHeading(document, { hash: '' });
    expect(document.activeElement?.id).toBe('other');
  });
});

describe('[P2-S09-AC-238] FilterBar', () => {
  const query = { limit: 25, sort: 'key', direction: 'asc' } as const;

  it('keeps a persistent label on every control and commits only on Apply through the URL', () => {
    const { container } = mount(
      <ContentSchemaRegistryFilterBar
        query={query as never}
        canonicalUrl="/app/cms-content-modeling"
      />,
    );
    const controls = [
      ...container.querySelectorAll<HTMLElement>(
        'select, input:not([type="hidden"])',
      ),
    ];
    expect(controls.length).toBe(7);
    for (const control of controls) {
      const id = control.getAttribute('id') ?? '';
      expect(container.querySelector(`label[for="${id}"]`), id).not.toBeNull();
    }
    const form = container.querySelector('form') as HTMLFormElement;
    expect(form.getAttribute('method')).toBe('get');
    const apply = [...form.querySelectorAll('button')].filter(
      (button) => button.type === 'submit',
    );
    expect(apply.map((button) => button.textContent)).toEqual([
      'Apply filters',
    ]);
    expect(
      form.querySelector('a[href="/app/cms-content-modeling"]')?.textContent,
    ).toBe('Reset filters');
    const submitted: string[] = [];
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      submitted.push('submit');
    });
    const key = form.querySelector<HTMLInputElement>(
      'input[name="keyPrefix"]',
    ) as HTMLInputElement;
    act(() => {
      key.value = 'rel';
      key.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(submitted).toEqual([]);
    click(apply[0] as HTMLButtonElement);
    expect(submitted).toEqual(['submit']);
  });

  it('lets Escape act only on the control that is open: it never clears or resets the other filters', () => {
    const { container } = mount(
      <ContentSchemaRegistryFilterBar
        query={
          { ...query, resourceKind: 'content_type', keyPrefix: 'rel' } as never
        }
        canonicalUrl="/app/cms-content-modeling"
      />,
    );
    const kind = container.querySelector(
      'select[name="resourceKind"]',
    ) as unknown as HTMLSelectElement;
    const prefix = container.querySelector<HTMLInputElement>(
      'input[name="keyPrefix"]',
    ) as HTMLInputElement;
    expect(keydown(prefix, 'Escape')).toBe(true);
    expect(keydown(kind as unknown as Element, 'Escape')).toBe(true);
    expect(prefix.value).toBe('rel');
    expect(kind.value).toBe('content_type');
    expect(
      container.querySelector('form')?.getAttribute('data-escape-clears'),
    ).toBeNull();
  });

  it('announces the result count and the active filters in a polite atomic status region', () => {
    const doc = new DOMParser().parseFromString(
      `<body>${renderToStaticMarkup(<ContentSchemaRegistryFilterBar query={{ ...query, resourceKind: 'content_type', state: 'draft' } as never} canonicalUrl="/app/cms-content-modeling" />)}</body>`,
      'text/html',
    );
    const summary = doc.querySelector(
      '#content-schema-registry-filter-summary',
    );
    expect(summary?.textContent).toBe(
      'Active filters: resource kind content_type; state draft.',
    );
    expect(
      doc.querySelector('form')?.getAttribute('aria-describedby'),
    ).toContain('content-schema-registry-filter-summary');
    expect(
      doc.querySelector('#content-schema-registry-sort-summary')?.textContent,
    ).toBe('Sorted by Key, ascending.');
  });
});

describe('[P2-S09-AC-240] ConfirmationStep', () => {
  const props = {
    consequence:
      'Activation affects the selected content type version and future entry validation.',
    affectedScope: 'Content type 018f0c45, version 018f0c46',
    expectedVersion: '4',
    stepUpState: 'verified' as const,
    idempotencyKey: 'cms-schema-activation-240',
    actingContextLabel: 'Studio Owner',
    stepUpFreshUntil: new Date(Date.now() + 5 * 60_000).toISOString(),
  };

  it('is inline, names its consequence, scope, version, acting context, step-up and idempotency key and takes the heading focus', () => {
    const { container } = mount(
      <ContentSchemaRegistryConfirmationStep {...props} />,
    );
    const section = container.querySelector('section') as HTMLElement;
    expect(section.getAttribute('role')).toBeNull();
    expect(section.getAttribute('aria-modal')).toBeNull();
    expect(container.querySelector('dialog')).toBeNull();
    const terms = Object.fromEntries(
      [...container.querySelectorAll('dt')].map((term) => [
        term.textContent,
        term.nextElementSibling?.textContent,
      ]),
    );
    expect(terms.Consequence).toBe(props.consequence);
    expect(terms['Affected scope']).toBe(props.affectedScope);
    expect(terms['Expected version']).toBe('4');
    expect(terms['Acting context']).toBe('Studio Owner');
    expect(String(terms['Step-up'])).toMatch(/verified|until/iu);
    expect(terms['Idempotency key']).toBe('cms-schema-activation-240');
    expect(document.activeElement).toBe(container.querySelector('h3'));
    for (const [state, text] of [
      ['required', 'Step-up required before commit'],
      ['pending', 'Verification pending'],
    ] as const) {
      const other = mount(
        <ContentSchemaRegistryConfirmationStep
          {...props}
          stepUpState={state}
        />,
      );
      expect(
        [...other.container.querySelectorAll('dt')].find(
          (term) => term.textContent === 'Step-up',
        )?.nextElementSibling?.textContent,
      ).toBe(text);
    }
  });

  it('requires an explicit acknowledgement and clears it on Escape, before any commit can happen', () => {
    const onCancel = vi.fn();
    const { container } = mount(
      <ContentSchemaRegistryConfirmationStep {...props} onCancel={onCancel} />,
    );
    const box = container.querySelector<HTMLInputElement>(
      'input[type="checkbox"]',
    ) as HTMLInputElement;
    expect(box.required).toBe(true);
    expect(box.checked).toBe(false);
    click(box);
    expect(box.checked).toBe(true);
    expect(
      keydown(container.querySelector('section') as HTMLElement, 'Escape'),
    ).toBe(false);
    expect(box.checked).toBe(false);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

describe('[P2-S09-AC-250] high-risk activation confirmation never needs a modal', () => {
  it('is rendered inline in the page flow and no registry surface opens a modal dialog, so containment never applies', () => {
    const { container } = mount(
      <ContentSchemaRegistryConfirmationStep
        consequence="c"
        affectedScope="s"
        expectedVersion="4"
        stepUpState="required"
        idempotencyKey="cms-key-12345"
      />,
    );
    expect(
      container.querySelector('[role="dialog"], [aria-modal="true"], dialog'),
    ).toBeNull();
    expect(
      container.querySelector('section')?.getAttribute('aria-labelledby'),
    ).toBe('content-schema-registry-confirmation-heading');
  });
});
