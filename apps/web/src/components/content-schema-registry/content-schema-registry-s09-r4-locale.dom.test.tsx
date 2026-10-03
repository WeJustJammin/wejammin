// @vitest-environment jsdom

import * as React from 'react';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ContentSchemaRegistryCreateForm from './ContentSchemaRegistryCreateForm';
import { ContentSchemaRegistrySuccessorForm } from './ContentSchemaRegistryVersionForms';
import { installContentSchemaRegistryCommandEnhancement } from './content-schema-registry-runtime-dom-mutations';
import {
  blur,
  buttonNamed,
  click,
  hiddenValue,
  inputByLabel,
  mount,
  type,
  type Mounted,
} from './content-schema-registry-locale-fields.test-support';

/**
 * FE03 "Locale configuration fields (OD-4)": the canonical-case suggestion
 * replaces draft text only when activated, and a server 409 offers Reapply only
 * when the server disclosed a newer version. Both run on the real forms, the
 * real island controls and the real enhancement runtime.
 */

const CANONICAL = 'locale tag must be a canonical-case BCP 47 tag';
const REQUEST_ID = '6a3173d9-f113-4aa4-91c3-3fbc137ea258';
const ACTION = '/app/cms-content-modeling/content-types/t/versions/v';

let mounted: Mounted | null = null;
let cleanup: (() => void) | null = null;
afterEach(() => {
  cleanup?.();
  cleanup = null;
  mounted?.unmount();
  mounted = null;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const renderCreate = (): Mounted => {
  mounted = mount(
    React.createElement(ContentSchemaRegistryCreateForm, {
      action: '/app/cms-content-modeling',
      csrfToken: 'csrf-token-value',
      idempotencyKey: 'cms-schema-cms-03a-01-support',
    }),
  );
  return mounted;
};

const tagInput = (view: Mounted): HTMLInputElement =>
  inputByLabel(view.container, 'Add a language tag');
const supported = (view: Mounted): string[] =>
  JSON.parse(hiddenValue(view.form, 'supportedLocales')) as string[];
const message = (view: Mounted): string =>
  view.container.querySelector('[data-locale-tags-field]')?.textContent ?? '';

describe('canonical-case suggestion', () => {
  it('[P2-S09-AC-1211] on Add shows the exact message and leaves the typed draft text exactly as typed until Use is activated', () => {
    const view = renderCreate();
    type(tagInput(view), 'EN-us');
    click(buttonNamed(view.container, 'Add'));
    expect(message(view)).toContain(CANONICAL);
    // No silent correction: the text, the tag list and the hidden value are untouched.
    expect(tagInput(view).value).toBe('EN-us');
    expect(supported(view)).toStrictEqual([]);
    click(buttonNamed(view.container, 'Use en-US'));
    expect(tagInput(view).value).toBe('en-US');
    expect(supported(view)).toStrictEqual([]);
    click(buttonNamed(view.container, 'Add'));
    expect(supported(view)).toStrictEqual(['en-US']);
  });

  it('[P2-S09-AC-1211] on blur shows the exact message with its Use button and never rewrites the typed text', () => {
    const view = renderCreate();
    type(tagInput(view), 'EN-us');
    // Nothing is shown before the blur.
    expect(message(view)).not.toContain(CANONICAL);
    blur(tagInput(view));
    expect(message(view)).toContain(CANONICAL);
    expect(tagInput(view).value).toBe('EN-us');
    expect(supported(view)).toStrictEqual([]);
    buttonNamed(view.container, 'Use en-US');
  });

  it('[P2-S09-AC-1211] on blur a canonical tag shows no message and stays pending until Add', () => {
    const view = renderCreate();
    type(tagInput(view), 'en-US');
    blur(tagInput(view));
    expect(message(view)).not.toContain(CANONICAL);
    expect(tagInput(view).value).toBe('en-US');
    expect(supported(view)).toStrictEqual([]);
  });

  it('[P2-S09-AC-1211] editing the text after the message clears the suggestion', () => {
    const view = renderCreate();
    type(tagInput(view), 'EN-us');
    blur(tagInput(view));
    type(tagInput(view), 'EN-u');
    expect(
      [...view.container.querySelectorAll('button')].some((button) =>
        button.textContent?.startsWith('Use '),
      ),
    ).toBe(false);
  });
});

const SOURCE = {
  sourceLocale: 'en-US',
  defaultLocale: 'en-US',
  supportedLocales: ['en-US', 'fr'],
  fallbackChains: { fr: ['en-US'] },
} as const;

/** The real successor form with the replacement choice open (locale fields shown). */
const renderSuccessor = (): Mounted => {
  mounted = mount(
    React.createElement(ContentSchemaRegistrySuccessorForm, {
      action: ACTION,
      contentTypeId: '30000000-0000-4000-8000-000000000003',
      versionId: '40000000-0000-4000-8000-000000000004',
      csrfToken: 'csrf-token-value',
      idempotencyKey: 'cms-schema-cms-03a-09-support',
      ifMatch: '"4"',
      expectedVersion: '4',
      sourceLocaleConfig: SOURCE,
    }),
  );
  const change = mounted.container.querySelector<HTMLInputElement>(
    'input[type="radio"][name="localeChoice"][value="change"]',
  );
  if (change === null) throw new Error('change radio missing');
  click(change);
  return mounted;
};

interface Sent {
  readonly ifMatch: string | null;
  readonly expectedVersion: string | null;
  readonly key: string | null;
  readonly supportedLocales: string | null;
}

const conflictThenSuccess = (details: Record<string, string>) => {
  const sent: Sent[] = [];
  const fetchStub = vi.fn(
    async (_input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      const body = init?.body instanceof FormData ? init.body : null;
      sent.push({
        ifMatch:
          headers.get('if-match') ?? (body?.get('if-match') as string | null),
        expectedVersion:
          (body?.get('expectedVersion') as string | null) ?? null,
        key:
          headers.get('idempotency-key') ??
          (body?.get('idempotency-key') as string | null) ??
          null,
        supportedLocales:
          (body?.get('supportedLocales') as string | null) ?? null,
      });
      return sent.length === 1
        ? new Response(
            JSON.stringify({
              code: 'CONFLICT',
              details,
              message: 'stale',
              requestId: REQUEST_ID,
            }),
            { status: 409, headers: { 'content-type': 'application/json' } },
          )
        : new Response(null, { status: 500 });
    },
  );
  vi.stubGlobal('fetch', fetchStub);
  return { sent, fetchStub };
};

const openConflict = async (
  view: Mounted,
  navigate: (target: string) => void,
): Promise<HTMLElement> => {
  cleanup = installContentSchemaRegistryCommandEnhancement(document, {
    navigate,
  });
  await act(async () => {
    view.form.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
    await Promise.resolve();
  });
  await vi.waitFor(() =>
    expect(view.form.querySelector('[data-cms-sync-conflict]')).not.toBeNull(),
  );
  return view.form.querySelector<HTMLElement>('[data-cms-sync-conflict]')!;
};

const press = async (button: HTMLElement): Promise<void> => {
  await act(async () => {
    button.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true }),
    );
    await Promise.resolve();
  });
};

const SIGNATURE = 'This version changed while you were editing.';

describe('locale 409 Reapply when permitted', () => {
  it('[P2-S09-AC-1231] with a newer server version Reapply is enabled and resubmits the unchanged draft on that version with a new Idempotency-Key', async () => {
    const view = renderSuccessor();
    const draft = supported(view);
    const { sent } = conflictThenSuccess({
      expectedVersion: '4',
      currentVersion: '5',
    });
    const conflict = await openConflict(view, vi.fn());
    expect(conflict.textContent).toContain(SIGNATURE);
    const reapply = buttonNamed(conflict as unknown as HTMLElement, 'Reapply');
    expect(reapply.disabled).toBe(false);
    expect(sent).toHaveLength(1);
    // The preserved draft is untouched by the conflict itself.
    expect(supported(view)).toStrictEqual(draft);
    await press(reapply);
    await vi.waitFor(() => expect(sent).toHaveLength(2));
    expect(sent[1]?.ifMatch).toBe('"5"');
    expect(sent[1]?.expectedVersion).toBe('5');
    expect(sent[1]?.supportedLocales).toBe(sent[0]?.supportedLocales);
    expect(sent[1]?.key).not.toBe(sent[0]?.key);
    expect(sent[1]?.key).toMatch(/^cms-reapply-/u);
    expect(supported(view)).toStrictEqual(draft);
  });

  it.each([
    ['no version is disclosed', {}],
    ['the server version equals the form version', { currentVersion: '4' }],
    ['the disclosed version is malformed', { currentVersion: 'later' }],
  ])(
    '[P2-S09-AC-1231] when %s Reapply is disabled with a visible linked reason and activating it sends nothing',
    async (_name, details) => {
      const view = renderSuccessor();
      const { sent } = conflictThenSuccess(details);
      const conflict = await openConflict(view, vi.fn());
      const reapply = buttonNamed(
        conflict as unknown as HTMLElement,
        'Reapply',
      );
      expect(reapply.disabled).toBe(true);
      expect(reapply.getAttribute('aria-disabled')).toBe('true');
      const reason = conflict.querySelector(
        `#${reapply.getAttribute('aria-describedby') ?? 'missing'}`,
      );
      expect(reason?.textContent).toContain('Reapply is not available');
      await press(reapply);
      expect(sent).toHaveLength(1);
    },
  );

  it('[P2-S09-AC-1231] Review changes goes to the current version and Discard clears only on request, never overwriting the draft first', async () => {
    const view = renderSuccessor();
    conflictThenSuccess({ expectedVersion: '4', currentVersion: '5' });
    const navigate = vi.fn();
    const draft = supported(view);
    const conflict = await openConflict(view, navigate);
    expect(supported(view)).toStrictEqual(draft);
    await press(
      buttonNamed(conflict as unknown as HTMLElement, 'Review changes'),
    );
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate.mock.calls[0]?.[0]).toBe(ACTION);
    expect(supported(view)).toStrictEqual(draft);
  });
});
