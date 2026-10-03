// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createMemoryLockManager } from '../../lib/test-support/memory-lock-manager';
import { MemoryStorage } from '../../lib/test-support/memory-storage';
import {
  activationPreparation,
  approvedReviewPreparation,
  passedDryRunPreparation,
  startDryRunPreparation,
} from './content-schema-registry-activation-preparation.test-support';
import { BLUR_RULES } from './content-schema-registry-blur-rules';
import { installContentSchemaRegistryCommandEnhancement } from './content-schema-registry-runtime-dom-mutations';
import { installLazyCommandEnhancement } from './content-schema-registry-runtime-dom-lazy';
import {
  approvedProtectedReview,
  draftDetail,
} from './content-schema-review-dec108.test-support';
import {
  renderDocument,
  requireForm,
  reviewSuccess,
  successDetail,
  versionPageProps,
} from './content-schema-review-dec108-render.test-support';

/**
 * FE03 form contract: "Syntax and safe local constraints on blur; cross-field
 * on review/submit; server remains authoritative." Every registry command form
 * that has no blur feedback of its own gets it from the rule table, and the
 * server's answer after a blur is still the authority. The forms here are the
 * REAL rendered production forms, with the real enhancement installed.
 */

const locks = createMemoryLockManager();

const page = (
  preparation: Parameters<typeof draftDetail>[0],
  extra: Parameters<typeof versionPageProps>[0] = {},
): string =>
  renderDocument(
    versionPageProps({
      initialDetail: successDetail(draftDetail(preparation)),
      ...extra,
    }),
  ).body.innerHTML;

const listPage = (): string =>
  renderDocument(
    versionPageProps({
      contentTypeId: null,
      versionId: null,
      initialDetail: null,
      expectedVersion: null,
    }),
  ).body.innerHTML;

const mount = (html: string, operationId: string): HTMLFormElement => {
  window.history.replaceState({}, '', '/app/cms-content-modeling');
  document.body.innerHTML = html;
  return requireForm(document, operationId);
};

const control = (
  form: HTMLFormElement,
  name: string,
): HTMLInputElement | HTMLTextAreaElement => {
  const element = form.elements.namedItem(name);
  if (
    !(element instanceof HTMLInputElement) &&
    !(element instanceof HTMLTextAreaElement)
  )
    throw new Error(`the real form has no ${name} control`);
  return element;
};

const blur = (element: HTMLElement): void => {
  element.focus();
  element.blur();
};

const type = (
  element: HTMLInputElement | HTMLTextAreaElement,
  value: string,
) => {
  element.value = value;
  element.dispatchEvent(new Event('input', { bubbles: true }));
};

const errorOf = (element: HTMLElement): HTMLElement | null =>
  document.getElementById(`${element.id}-blur-error`);

beforeEach(() => {
  Object.defineProperty(window, 'sessionStorage', {
    configurable: true,
    value: new MemoryStorage(),
  });
  Object.defineProperty(navigator, 'locks', {
    configurable: true,
    value: locks.manager,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  locks.releaseAll();
  document.body.replaceChildren();
});

const MISSING_UUID = 'not-a-uuid';
const UUID = '018f0c45-73fe-7dc2-9c09-68f7ecf132da';

/** [operation, rendered page, field, a value the rule refuses, one it accepts]. */
const CASES: readonly (readonly [
  string,
  () => string,
  string,
  string,
  string,
])[] = [
  ['CMS-03A-01', listPage, 'typeKey', 'Bad Key', 'release_note'],
  ['CMS-03A-01', listPage, 'label', 'a', 'Release note'],
  ['CMS-03A-01', listPage, 'ownerCapability', 'Bad Cap', 'cms.content.article'],
  ['CMS-03A-01', listPage, 'workflowKey', 'Bad Key', 'editorial.default'],
  ['CMS-03A-01', listPage, 'workflowVersion', '0', '1'],
  ['CMS-03A-01', listPage, 'fields', '{', '[]'],
  ['CMS-03A-01', listPage, 'relations', '{}', '[]'],
  ['CMS-03A-01', listPage, 'capabilityBindings', 'null', '[]'],
  [
    'CMS-03A-02',
    () => page(startDryRunPreparation),
    'stableFieldId',
    MISSING_UUID,
    UUID,
  ],
  [
    'CMS-03A-02',
    () => page(startDryRunPreparation),
    'key',
    'Bad Key',
    'headline',
  ],
  [
    'CMS-03A-02',
    () => page(startDryRunPreparation),
    'constraints',
    '[]',
    '{"maxLength":8}',
  ],
  [
    'CMS-03A-02',
    () => page(startDryRunPreparation),
    'validatorKey',
    'Bad Key',
    'cms.validator',
  ],
  [
    'CMS-03A-02',
    () => page(startDryRunPreparation),
    'validatorVersion',
    '0',
    '3',
  ],
  [
    'CMS-03A-02',
    () => page(startDryRunPreparation),
    'defaultValue',
    '{',
    '"x"',
  ],
  [
    'CMS-03A-02',
    () => page(startDryRunPreparation),
    'editorConfig',
    '[]',
    '{"label":"x","order":0}',
  ],
  [
    'CMS-03A-02',
    () => page(startDryRunPreparation),
    'migrationPlanId',
    MISSING_UUID,
    UUID,
  ],
  [
    'CMS-03A-03',
    () => page(startDryRunPreparation),
    'fieldId',
    MISSING_UUID,
    UUID,
  ],
  [
    'CMS-03A-03',
    () => page(startDryRunPreparation),
    'targetType',
    'Bad Type',
    'article',
  ],
  [
    'CMS-03A-03',
    () => page(startDryRunPreparation),
    'projectionKey',
    'Bad Key',
    'summary',
  ],
  ['CMS-03A-03', () => page(startDryRunPreparation), 'min', '129', '2'],
  ['CMS-03A-03', () => page(startDryRunPreparation), 'max', '0', '5'],
  [
    'CMS-03A-10',
    () => page(startDryRunPreparation),
    'transformKey',
    'Bad Key',
    'cms.rename',
  ],
  [
    'CMS-03A-10',
    () => page(startDryRunPreparation),
    'transformVersion',
    '0',
    '2',
  ],
  [
    'CMS-03A-04',
    () =>
      page(approvedReviewPreparation, {
        initialReview: reviewSuccess(approvedProtectedReview()),
      }),
    'expectedActivationEvidenceHash',
    'zz',
    'a'.repeat(64),
  ],
  [
    'CMS-03A-04',
    () =>
      page(approvedReviewPreparation, {
        initialReview: reviewSuccess(approvedProtectedReview()),
      }),
    'migrationPlanId',
    MISSING_UUID,
    UUID,
  ],
];

describe('[P2-S09-AC-248] blur feedback on every registry command form', () => {
  it('[P2-S09-AC-248] the table covers exactly the fields of the rule table, 25 of 25', () => {
    const tabled = Object.entries(BLUR_RULES).flatMap(([operation, rules]) =>
      Object.keys(rules).map((name) => `${operation}/${name}`),
    );
    const tested = CASES.map(([operation, , name]) => `${operation}/${name}`);
    expect(tested.sort()).toEqual(tabled.sort());
    expect(tabled).toHaveLength(25);
  });

  for (const [operation, render, name, bad, good] of CASES) {
    it(`[P2-S09-AC-248] ${operation} ${name}: no error before blur, an inline linked error after, cleared when corrected`, () => {
      const form = mount(render(), operation);
      const cleanup = installContentSchemaRegistryCommandEnhancement(document);
      const field = control(form, name);
      const describedBefore = field.getAttribute('aria-describedby');
      // No pre-visit error.
      expect(errorOf(field)).toBeNull();
      expect(field.hasAttribute('aria-invalid')).toBe(false);
      type(field, bad);
      // Typing never raises a new error; only leaving the field does.
      expect(errorOf(field)).toBeNull();
      blur(field);
      const error = errorOf(field);
      expect(error?.textContent).toBe(BLUR_RULES[operation]?.[name]?.message);
      expect(error?.textContent?.length).toBeGreaterThan(10);
      expect(field.getAttribute('aria-invalid')).toBe('true');
      expect(field.getAttribute('aria-describedby')?.split(' ')).toContain(
        error?.id,
      );
      // The persistent label and help stay linked.
      expect(field.getAttribute('aria-describedby')).toContain(
        describedBefore ?? '',
      );
      expect(form.querySelector(`label[for="${field.id}"]`)).not.toBeNull();
      type(field, good);
      expect(errorOf(field)).toBeNull();
      expect(field.hasAttribute('aria-invalid')).toBe(false);
      expect(field.getAttribute('aria-describedby') ?? '').toBe(
        describedBefore ?? '',
      );
      cleanup();
    });
  }

  it('[P2-S09-AC-248] an optional field may be left blank, a required one may not', () => {
    const form = mount(page(startDryRunPreparation), 'CMS-03A-10');
    const cleanup = installContentSchemaRegistryCommandEnhancement(document);
    const key = control(form, 'transformKey');
    blur(key);
    expect(errorOf(key)).toBeNull();
    cleanup();
    const create = mount(listPage(), 'CMS-03A-01');
    const cleanupCreate =
      installContentSchemaRegistryCommandEnhancement(document);
    const typeKey = control(create, 'typeKey');
    blur(typeKey);
    expect(errorOf(typeKey)?.textContent).toContain('lowercase letters');
    cleanupCreate();
  });

  it('[P2-S09-AC-248] a blur error never blocks the submit, and the server answer after it is authoritative', async () => {
    const form = mount(listPage(), 'CMS-03A-01');
    const calls: FormData[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        calls.push(init?.body as FormData);
        return new Response(
          JSON.stringify({
            code: 'VALIDATION_FAILED',
            details: { violations: [{ path: '/typeKey' }] },
          }),
          { status: 422, headers: { 'content-type': 'application/json' } },
        );
      }),
    );
    const cleanup = installContentSchemaRegistryCommandEnhancement(document);
    const typeKey = control(form, 'typeKey');
    type(typeKey, 'Bad Key');
    blur(typeKey);
    expect(errorOf(typeKey)).not.toBeNull();
    form.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
    await vi.waitFor(() =>
      expect(
        form.querySelector('[data-cms-validation-summary]'),
      ).not.toBeNull(),
    );
    // The invalid draft still reached the server, which answered; the blur
    // message and the server's linked summary are both on the page.
    expect(calls).toHaveLength(1);
    expect(calls[0]?.get('typeKey')).toBe('Bad Key');
    const link = form.querySelector<HTMLAnchorElement>(
      '[data-cms-validation-summary] a',
    );
    expect(link?.getAttribute('href')).toBe(`#${typeKey.id}`);
    expect(typeKey.getAttribute('aria-invalid')).toBe('true');
    expect(typeKey.value).toBe('Bad Key');
    cleanup();
  });

  it('[P2-S09-AC-248] a value the blur rule accepts is still refused when the server says so', async () => {
    const form = mount(listPage(), 'CMS-03A-01');
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              code: 'VALIDATION_FAILED',
              details: { violations: [{ path: '/ownerCapability' }] },
            }),
            { status: 422, headers: { 'content-type': 'application/json' } },
          ),
      ),
    );
    const cleanup = installContentSchemaRegistryCommandEnhancement(document);
    const capability = control(form, 'ownerCapability');
    type(capability, 'cms.not.a.held.capability');
    blur(capability);
    // Locally acceptable: no blur error.
    expect(errorOf(capability)).toBeNull();
    form.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
    await vi.waitFor(() =>
      expect(
        form.querySelector('[data-cms-validation-summary]'),
      ).not.toBeNull(),
    );
    expect(capability.getAttribute('aria-invalid')).toBe('true');
    expect(capability.value).toBe('cms.not.a.held.capability');
    cleanup();
  });

  it('[P2-S09-AC-248] a field left before the lazily loaded enhancement is ready gets its feedback once it loads', async () => {
    const form = mount(listPage(), 'CMS-03A-01');
    const lazy = installLazyCommandEnhancement(document);
    const typeKey = control(form, 'typeKey');
    typeKey.value = 'Bad Key';
    expect(lazy.loaded()).toBe(false);
    typeKey.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    await vi.waitFor(() => expect(errorOf(typeKey)).not.toBeNull());
    expect(lazy.loaded()).toBe(true);
    lazy.dispose();
  });

  it('[P2-S09-AC-248] controls with their own blur feedback or no local syntax rule are not given a second one', () => {
    const form = mount(page(passedDryRunPreparation), 'CMS-03A-11');
    const cleanup = installContentSchemaRegistryCommandEnhancement(document);
    for (const element of form.querySelectorAll<HTMLInputElement>('input')) {
      element.value = 'anything';
      blur(element);
      expect(document.querySelector('[data-cms-field-error]')).toBeNull();
    }
    const successor = mount(
      page(
        activationPreparation({ permittedNextActions: ['create_successor'] }),
      ),
      'CMS-03A-09',
    );
    for (const element of successor.querySelectorAll<HTMLInputElement>(
      'input',
    )) {
      blur(element);
      expect(document.querySelector('[data-cms-field-error]')).toBeNull();
    }
    cleanup();
  });

  it('[P2-S09-AC-248] removes its listeners with the enhancement', () => {
    const form = mount(listPage(), 'CMS-03A-01');
    const cleanup = installContentSchemaRegistryCommandEnhancement(document);
    cleanup();
    const typeKey = control(form, 'typeKey');
    type(typeKey, 'Bad Key');
    blur(typeKey);
    expect(errorOf(typeKey)).toBeNull();
  });
});
