// @vitest-environment jsdom

import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ContentSchemaRegistrySuccessorForm } from './ContentSchemaRegistryVersionForms';
import { installContentSchemaRegistryCommandEnhancement } from './content-schema-registry-runtime-dom-mutations';
import {
  click,
  hiddenValue,
  mount,
  submit,
  type Mounted,
} from './content-schema-registry-locale-fields.test-support';

/**
 * DEC-123 completion, FE03 "Successor template choice (CMS-03A-09)": the form
 * keeps the source default template and bindings (both members submit null) or
 * replaces them (both present, prefilled from the source). A brand-new type has
 * none, so the first successor is where a template is chosen. Each field shows
 * its own validation message before anything is posted.
 */

const A = '018f0c45-73fe-4dc2-9c09-68f7ecf132da';
const B = '028f0c45-73fe-4dc2-9c09-68f7ecf132db';
const LOCALE = {
  sourceLocale: 'en-US',
  defaultLocale: 'en-US',
  supportedLocales: ['en-US'],
  fallbackChains: {},
} as const;

let mounted: Mounted | null = null;
let cleanup: (() => void) | null = null;
afterEach(() => {
  cleanup?.();
  cleanup = null;
  vi.unstubAllGlobals();
  mounted?.unmount();
  mounted = null;
  vi.restoreAllMocks();
});

const render = (
  templates: {
    defaultTemplateVersionId: string | null;
    bindings: readonly { templateVersionId: string; position: number }[];
  } = { defaultTemplateVersionId: null, bindings: [] },
): Mounted => {
  mounted = mount(
    React.createElement(ContentSchemaRegistrySuccessorForm, {
      action: '/app/cms-content-modeling/content-types/t/versions/v',
      contentTypeId: '30000000-0000-4000-8000-000000000003',
      versionId: '40000000-0000-4000-8000-000000000004',
      csrfToken: 'csrf-token-value',
      idempotencyKey: 'cms-schema-cms-03a-09-template',
      ifMatch: '"3"',
      expectedVersion: '3',
      sourceLocaleConfig: LOCALE,
      sourceTemplateConfig: templates,
    }),
  );
  return mounted;
};

const radio = (view: Mounted, value: string): HTMLInputElement =>
  view.container.querySelector(
    `input[type="radio"][name="templateChoice"][value="${value}"]`,
  ) as HTMLInputElement;
const field = (
  view: Mounted,
  name: string,
): HTMLInputElement | HTMLTextAreaElement =>
  view.container.querySelector(`[data-template-field="${name}"]`) as
    HTMLInputElement | HTMLTextAreaElement;
const enter = (
  element: HTMLInputElement | HTMLTextAreaElement,
  value: string,
): void => {
  const proto =
    element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  React.act(() => {
    setter?.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
};
const messages = (view: Mounted): string[] =>
  [...view.container.querySelectorAll('[data-template-error]')].map(
    (node) => node.textContent ?? '',
  );

describe('CMS-03A-09 successor template choice', () => {
  it('[P2-S09-AC-003] defaults to keeping the source template and submits both members null', () => {
    const view = render();
    const group = view.container.querySelector(
      'fieldset[data-template-choice]',
    ) as HTMLFieldSetElement;
    expect(group.querySelector('legend')?.textContent).toBe(
      'Template for the new version',
    );
    expect(radio(view, 'keep').checked).toBe(true);
    expect(view.container.textContent).toContain(
      'Keep the current template and template list',
    );
    expect(view.container.textContent).toContain(
      'Choose the template and template list',
    );
    expect(hiddenValue(view.form, 'defaultTemplateVersionId')).toBe('');
    expect(hiddenValue(view.form, 'templateBindings')).toBe('null');
    expect(view.container.querySelector('[data-template-fields]')).toBeNull();
    expect(submit(view.form)).toBe(true);
  });

  it('[P2-S09-AC-045] reveals empty controls for a type that has no template yet', () => {
    const view = render();
    click(radio(view, 'change'));
    expect(
      view.container.querySelector('[data-template-fields]'),
    ).not.toBeNull();
    expect(field(view, 'defaultTemplateVersionId').value).toBe('');
    expect(field(view, 'templateBindings').value).toBe('');
    expect(view.container.textContent).toContain(
      'The server checks that each template names this content type',
    );
  });

  it('[P2-S09-AC-049] prefills the source default and bindings when changing', () => {
    const view = render({
      defaultTemplateVersionId: A,
      bindings: [
        { templateVersionId: B, position: 1 },
        { templateVersionId: A, position: 0 },
      ],
    });
    click(radio(view, 'change'));
    expect(field(view, 'defaultTemplateVersionId').value).toBe(A);
    expect(field(view, 'templateBindings').value).toBe(`${A}\n${B}`);
    expect(hiddenValue(view.form, 'defaultTemplateVersionId')).toBe(A);
    expect(JSON.parse(hiddenValue(view.form, 'templateBindings'))).toEqual([
      { templateVersionId: A },
      { templateVersionId: B },
    ]);
  });

  it('[P2-S09-AC-045] submits the chosen pair and nothing else named', () => {
    const view = render();
    click(radio(view, 'change'));
    enter(field(view, 'defaultTemplateVersionId'), A);
    enter(field(view, 'templateBindings'), `${A}\n${B}`);
    expect(hiddenValue(view.form, 'defaultTemplateVersionId')).toBe(A);
    expect(JSON.parse(hiddenValue(view.form, 'templateBindings'))).toEqual([
      { templateVersionId: A },
      { templateVersionId: B },
    ]);
    expect(submit(view.form)).toBe(true);
    const named = [...view.form.elements]
      .map((element) => (element as HTMLInputElement).name)
      .filter((name) => name !== '');
    expect(named).toEqual(
      expect.arrayContaining(['defaultTemplateVersionId', 'templateBindings']),
    );
    expect(named).not.toContain('templateBindingsText');
  });

  it('[P2-S09-AC-049] blocks the post and names each invalid field before submit', () => {
    const view = render();
    click(radio(view, 'change'));
    enter(field(view, 'defaultTemplateVersionId'), 'nope');
    enter(field(view, 'templateBindings'), `${A}\nnope\n${A}`);
    expect(submit(view.form)).toBe(false);
    expect(messages(view)).toEqual([
      'Enter the default template version ID as a lowercase UUID, for example 018f0c45-73fe-4dc2-9c09-68f7ecf132da.',
      'Line 2: enter a lowercase template version ID.',
      'Line 3: this template version is already listed on line 1.',
    ]);
    const control = field(view, 'defaultTemplateVersionId');
    expect(control.getAttribute('aria-invalid')).toBe('true');
    expect(control.getAttribute('aria-describedby')).toContain(
      'content-schema-registry-successor-form-template-default-error',
    );
    expect(document.activeElement).toBe(control);
  });

  it('[P2-S09-AC-045] requires a default when choosing a template and returns to keep without leaving a half pair', () => {
    const view = render();
    click(radio(view, 'change'));
    expect(submit(view.form)).toBe(false);
    expect(messages(view)).toEqual(['Enter the default template version ID.']);
    click(radio(view, 'keep'));
    expect(hiddenValue(view.form, 'defaultTemplateVersionId')).toBe('');
    expect(hiddenValue(view.form, 'templateBindings')).toBe('null');
    expect(view.container.querySelector('[data-template-fields]')).toBeNull();
    expect(submit(view.form)).toBe(true);
  });
});

describe('CMS-03A-09 server refusal of a chosen template', () => {
  const refuse = async (
    violations: readonly { path: string; message: string }[],
  ): Promise<HTMLElement> => {
    const view = render();
    click(radio(view, 'change'));
    enter(field(view, 'defaultTemplateVersionId'), A);
    enter(field(view, 'templateBindings'), `${A}\n${B}`);
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              code: 'VALIDATION_FAILED',
              details: { violations },
            }),
            { status: 422, headers: { 'content-type': 'application/json' } },
          ),
      ),
    );
    cleanup = installContentSchemaRegistryCommandEnhancement(document, {
      navigate: vi.fn(),
    });
    React.act(() => {
      view.form.dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true }),
      );
    });
    await vi.waitFor(() =>
      expect(
        view.form.querySelector('[data-cms-validation-summary]'),
      ).not.toBeNull(),
    );
    return view.form.querySelector<HTMLElement>(
      '[data-cms-validation-summary]',
    ) as HTMLElement;
  };

  it('[P2-S09-AC-049] names the incompatible binding with the server message and links to the list field', async () => {
    const summary = await refuse([
      {
        path: '/templateBindings/1/templateVersionId',
        message: 'template version is not compatible with this content type',
      },
    ]);
    expect(summary.textContent).toContain(
      'templateBindings / 1 / templateVersionId: template version is not compatible with this content type',
    );
    const link = summary.querySelector('a') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe(
      '#content-schema-registry-successor-form-template-bindings',
    );
    expect(
      mounted?.container
        .querySelector(
          '#content-schema-registry-successor-form-template-bindings',
        )
        ?.getAttribute('aria-invalid'),
    ).toBe('true');
  });

  it('[P2-S09-AC-045] names the incompatible default template and links to the default field', async () => {
    const summary = await refuse([
      {
        path: '/defaultTemplateVersionId',
        message: 'template version is not compatible with this content type',
      },
    ]);
    expect(summary.textContent).toContain(
      'defaultTemplateVersionId: template version is not compatible with this content type',
    );
    expect(
      (summary.querySelector('a') as HTMLAnchorElement).getAttribute('href'),
    ).toBe('#content-schema-registry-successor-form-template-default');
    expect(
      field(mounted as Mounted, 'defaultTemplateVersionId').getAttribute(
        'aria-invalid',
      ),
    ).toBe('true');
  });
});
