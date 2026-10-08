// @vitest-environment jsdom

import { ConflictDetailResourceSchema } from '@wejammin/contracts';
import * as React from 'react';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  buttonNamed,
  byLabel,
  click,
  disableReactAct,
  enableReactAct,
  flush,
  mountElement,
  typeInto,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import CmsEditorialConflictResolveIsland from './CmsEditorialConflictResolveIsland';
import {
  conflictDetailBody,
  type ConflictPathOptions,
} from './cms-editorial-conflict-fixtures.test-support';
import { conflictInitFrom } from './cms-editorial-conflict-state';
import {
  BLURB,
  CONFLICT_ID,
  ENTRY_ID,
  HASH,
  INSTANT,
  TITLE,
  apiError,
  editorFields,
  json,
} from './cms-editorial-editor-fixtures.test-support';
import { fieldUuid } from '../cms-editorial-fields/cms-field-fixtures.test-support';
import { takeCmsEditorialResult } from './cms-editorial-result-handoff';

beforeAll(enableReactAct);
afterAll(disableReactAct);
beforeEach(() => {
  document.cookie = 'wj_csrf=csrf-token';
});
afterEach(() => {
  document.body.replaceChildren();
  document.cookie = 'wj_csrf=; max-age=0';
  window.sessionStorage.clear();
});

const paths: readonly ConflictPathOptions[] = [
  {
    fieldId: TITLE,
    base: { value: 'Base title' },
    theirs: { value: 'Their title' },
    yours: { value: 'My title' },
  },
  {
    fieldId: BLURB,
    base: { value: null },
    theirs: { value: 'Their blurb' },
    yours: { value: 'My blurb', provenance: 'authored' },
  },
];

const init = () =>
  conflictInitFrom(
    ConflictDetailResourceSchema.parse(conflictDetailBody({ paths })),
    editorFields(),
  );

const resolved = () =>
  json(
    201,
    {
      id: fieldUuid(0x703),
      version: '1',
      entryVersion: '7',
      createdAt: INSTANT,
      updatedAt: INSTANT,
      state: 'draft',
      entryId: ENTRY_ID,
      revisionNumber: '4',
      schemaVersionId: fieldUuid(0x710),
      templateVersionId: null,
      taxonomyVersionIds: [],
      locale: 'en-US',
      contentHash: HASH,
      parentRevisionIds: [fieldUuid(0x701), fieldUuid(0x702)],
      validationState: 'valid',
      conflictId: CONFLICT_ID,
    },
    { etag: '"7"', 'cache-control': 'no-store' },
  );

const setup = (steps: readonly Response[]) => {
  const queue = [...steps];
  const calls: Array<{ url: string; method: string; body: string | null }> = [];
  const navigate = vi.fn();
  const mounted = mountElement(
    <CmsEditorialConflictResolveIsland
      init={init()}
      navigate={navigate}
      fetcher={async (input, requestInit) => {
        calls.push({
          url: String(input),
          method: requestInit?.method ?? 'GET',
          body: typeof requestInit?.body === 'string' ? requestInit.body : null,
        });
        const step = queue.shift();
        if (step === undefined) throw new Error(`unexpected ${String(input)}`);
        return step;
      }}
    />,
  );
  return { ...mounted, calls, navigate };
};

const submit = async (container: HTMLElement): Promise<void> => {
  await click(buttonNamed(container, 'Resolve conflict'));
  await flush();
};

const radio = (container: HTMLElement, fieldLabel: string, name: string) => {
  const group = Array.from(container.querySelectorAll('fieldset')).find(
    (fieldset) => fieldset.querySelector('legend')?.textContent === fieldLabel,
  );
  const found = Array.from(group?.querySelectorAll('label') ?? []).find(
    (label) => label.textContent?.trim() === name,
  );
  const input = found?.querySelector('input') ?? null;
  if (input === null) throw new Error(`No radio ${name} for ${fieldLabel}`);
  return input;
};

describe('CmsEditorialConflictResolveIsland: the three-way form', () => {
  it('shows base, their version and your version per field as typed values with native radio choices and none preselected', () => {
    const { container } = setup([]);
    const titleFieldset = Array.from(
      container.querySelectorAll('fieldset'),
    ).find(
      (fieldset) => fieldset.querySelector('legend')?.textContent === 'Title',
    );
    for (const name of ['Base', 'Their version', 'Your version'])
      expect(
        titleFieldset?.querySelector(`[role="group"][aria-label="${name}"]`),
      ).not.toBeNull();
    expect(titleFieldset?.textContent).toContain('Base title');
    expect(titleFieldset?.textContent).toContain('Their title');
    expect(titleFieldset?.textContent).toContain('My title');
    for (const name of [
      'Keep base',
      'Keep their version',
      'Keep your version',
      'Use a new value',
    ])
      expect(radio(container, 'Title', name).type).toBe('radio');
    for (const input of Array.from(
      container.querySelectorAll('input[type="radio"]'),
    ))
      expect((input as HTMLInputElement).checked).toBe(false);
    // No JSON anywhere: the blurb base has no value and says so in words.
    expect(container.textContent).toContain('No value');
    expect(container.textContent).not.toContain('{"');
  });

  it('refuses to resolve with a field left undecided, links the summary to it and focuses the summary', async () => {
    const { container, calls } = setup([]);
    await click(radio(container, 'Title', 'Keep their version'));
    await submit(container);
    expect(calls).toHaveLength(0);
    const summary = container.querySelector<HTMLElement>(
      '[data-cms-editorial-validation-summary]',
    );
    expect(document.activeElement).toBe(summary);
    const link = summary?.querySelector('a');
    expect(link?.getAttribute('href')).toBe(`#field-${BLURB}`);
    await click(link!);
    expect(document.activeElement).toBe(radio(container, 'Blurb', 'Keep base'));
  });

  it('resolves with the explicit choices, announces it and opens the entry on its APP route', async () => {
    const { container, calls, navigate } = setup([resolved()]);
    await click(radio(container, 'Title', 'Keep your version'));
    await click(radio(container, 'Blurb', 'Use a new value'));
    await typeInto(
      byLabel<HTMLTextAreaElement>(container, 'Blurb'),
      'A merged blurb',
    );
    await submit(container);
    const body = JSON.parse(calls[0]?.body ?? '{}') as {
      choices: Array<Record<string, unknown>>;
    };
    expect(body.choices).toEqual([
      { path: `/fields/${TITLE}`, choice: 'yours' },
      { path: `/fields/${BLURB}`, choice: 'explicit', value: 'A merged blurb' },
    ]);
    expect(container.querySelector('[role="status"]')?.textContent).toContain(
      'Conflict resolved',
    );
    expect(navigate).toHaveBeenCalledWith(
      `/app/cms-content-modeling/entries/${ENTRY_ID}`,
    );
    expect(window.sessionStorage.getItem('wj:focus-route-heading')).toBe('1');
  });

  it('keeps every choice and offers a retry of the same request after a lost response', async () => {
    const calls: string[] = [];
    const queue: Array<Response | Error> = [
      new TypeError('Failed to fetch'),
      resolved(),
    ];
    const navigate = vi.fn();
    const { container } = mountElement(
      <CmsEditorialConflictResolveIsland
        init={init()}
        navigate={navigate}
        fetcher={async (_input, requestInit) => {
          calls.push(String(requestInit?.body));
          const step = queue.shift();
          if (step instanceof Error) throw step;
          return step as Response;
        }}
      />,
    );
    await click(radio(container, 'Title', 'Keep their version'));
    await click(radio(container, 'Blurb', 'Keep their version'));
    await submit(container);
    expect(container.querySelector('[role="status"]')?.textContent).toContain(
      'could not be confirmed',
    );
    expect(radio(container, 'Title', 'Keep their version').checked).toBe(true);
    await click(buttonNamed(container, 'Retry resolve'));
    await flush();
    expect(calls).toHaveLength(2);
    expect(calls[1]).toBe(calls[0]);
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('after a 409 re-reads the conflict, keeps choices for unchanged fields and marks the reset one', async () => {
    const changed = json(
      200,
      conflictDetailBody({
        entryVersion: '8',
        paths: [
          paths[0]!,
          { ...paths[1]!, theirs: { value: 'Their blurb, edited again' } },
        ],
      }),
      { 'cache-control': 'no-store' },
    );
    const { container } = setup([apiError(409, 'CONFLICT'), changed]);
    await click(radio(container, 'Title', 'Keep your version'));
    await click(radio(container, 'Blurb', 'Keep their version'));
    await submit(container);
    expect(radio(container, 'Title', 'Keep your version').checked).toBe(true);
    expect(radio(container, 'Blurb', 'Keep their version').checked).toBe(false);
    expect(container.textContent).toContain('Their blurb, edited again');
    expect(container.textContent).toContain('changed while you were choosing');
    expect(
      container
        .querySelector('[data-cms-editorial-validation-summary] a')
        ?.getAttribute('href'),
    ).toBe(`#field-${BLURB}`);
  });

  it('says the conflict is no longer open, without saying why, and links back to the entry', async () => {
    const { container } = setup([
      apiError(409, 'CONFLICT'),
      apiError(404, 'NOT_FOUND'),
      json(200, { ignored: true }),
    ]);
    await click(radio(container, 'Title', 'Keep your version'));
    await click(radio(container, 'Blurb', 'Keep your version'));
    await submit(container);
    const alert = container.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('no longer open');
    const back = Array.from(container.querySelectorAll('a')).find((anchor) =>
      anchor.textContent?.includes('Return to the entry'),
    );
    expect(back?.getAttribute('href')).toBe(
      `/app/cms-content-modeling/entries/${ENTRY_ID}`,
    );
    expect(
      Array.from(container.querySelectorAll('button')).find(
        (button) => button.textContent === 'Resolve conflict',
      )?.disabled,
    ).toBe(true);
  });
});

describe('CmsEditorialConflictResolveIsland: the canonical result', () => {
  it('leaves the resolved revision, entry version and both parents for the entry page', async () => {
    const { container, navigate } = setup([resolved()]);
    await click(radio(container, 'Title', 'Keep their version'));
    await click(radio(container, 'Blurb', 'Keep your version'));
    await submit(container);
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(takeCmsEditorialResult(window.sessionStorage, ENTRY_ID)).toEqual({
      kind: 'resolved',
      entryId: ENTRY_ID,
      revisionNumber: '4',
      entryVersion: '7',
      state: 'draft',
      parentRevisionIds: [fieldUuid(0x701), fieldUuid(0x702)],
      migrationChainId: null,
      edgeCount: null,
    });
  });

  it('leaves no result behind when the resolve is refused', async () => {
    const { container } = setup([apiError(409, 'CONFLICT')]);
    await click(radio(container, 'Title', 'Keep their version'));
    await click(radio(container, 'Blurb', 'Keep your version'));
    await submit(container);
    expect(takeCmsEditorialResult(window.sessionStorage, ENTRY_ID)).toBeNull();
  });
});
