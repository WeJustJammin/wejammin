// @vitest-environment jsdom

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
  OBJECT_STRUCTURE,
  authoringField,
  fieldUuid,
  selectedType,
} from '../cms-editorial-fields/cms-field-fixtures.test-support';
import {
  buttonNamed,
  byLabel,
  choose,
  click,
  disableReactAct,
  enableReactAct,
  flush,
  mountElement,
  typeInto,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import CmsEditorialEntryCreateIsland from './CmsEditorialEntryCreateIsland';
import {
  ENTRY_ID,
  REQUEST_ID,
  TITLE,
  apiError,
  draftDetail,
  editorInit,
  json,
} from './cms-editorial-editor-fixtures.test-support';
import {
  posts,
  setup,
  unmountAll,
} from './CmsEditorialEntryEditorIsland.test-support';

/**
 * Slice 10 evidence lane EC (P2-S10-AC-081). The native DEC-133 object editor keeps
 * what the author typed across a typed server refusal and a conflict, puts focus where
 * the failure is announced and lets a keyboard user reach the object's controls from
 * that announcement, and never offers a JSON box. Each flow drives the REAL island
 * over a scripted fetch.
 */

beforeAll(enableReactAct);
afterAll(disableReactAct);

const META = fieldUuid(2);
const fields = () => [
  authoringField({
    n: 1,
    key: 'title',
    kind: 'short_text',
    label: 'Title',
    required: true,
    constraints: { minLength: 2, maxLength: 40 },
  }),
  authoringField({
    n: 2,
    key: 'meta',
    kind: 'object',
    label: 'Meta',
    constraints: { objectStructure: OBJECT_STRUCTURE },
  }),
];

beforeEach(() => {
  document.cookie = 'wj_csrf=csrf-token';
});
afterEach(() => {
  unmountAll();
  document.body.replaceChildren();
  document.cookie = 'wj_csrf=; max-age=0';
  window.sessionStorage.clear();
});

const created = (): Response =>
  json(
    201,
    {
      entry: {
        id: ENTRY_ID,
        version: '1',
        createdAt: '2026-10-05T00:00:00+00:00',
        updatedAt: '2026-10-05T00:00:00+00:00',
      },
      revision: {
        id: '018f0c45-73fe-7dc2-9c09-68f7ecf132dd',
        version: '1',
        createdAt: '2026-10-05T00:00:00+00:00',
        updatedAt: '2026-10-05T00:00:00+00:00',
      },
      revisionNumber: '1',
      lifecycle: 'active',
      state: 'draft',
      locale: 'en-US',
      contentHash: 'a'.repeat(64),
      validationState: 'valid',
    },
    {
      location: `/api/v1/cms/entries/${ENTRY_ID}`,
      etag: '"1"',
      'cache-control': 'no-store',
    },
  );

const property = (container: HTMLElement, label: RegExp) =>
  byLabel<HTMLInputElement | HTMLSelectElement>(container, label);

const fillMeta = async (container: HTMLElement): Promise<void> => {
  await typeInto(
    property(container, /^Headline/u) as HTMLInputElement,
    'Launch',
  );
  await choose(property(container, /^Tone/u) as HTMLSelectElement, 'casual');
  await typeInto(property(container, /^Priority/u) as HTMLInputElement, '3');
};

const metaValues = (container: HTMLElement) => ({
  headline: property(container, /^Headline/u).value,
  tone: property(container, /^Tone/u).value,
  priority: property(container, /^Priority/u).value,
});

describe('EC-081 the object editor after a typed refusal on create', () => {
  it('keeps every typed property, announces the refusal on the object, and reaches its first control from the summary link', async () => {
    const queue: Response[] = [
      apiError(422, 'VALIDATION_FAILED', {
        reasonCode: 'object_property_invalid',
        violations: [
          { path: `/fields/${META}`, code: 'invalid_value', message: 'x' },
        ],
      }),
      created(),
    ];
    const fetcher = vi.fn(async () => queue.shift() as Response);
    const navigate = vi.fn();
    const { container } = mountElement(
      <CmsEditorialEntryCreateIsland
        type={selectedType()}
        fields={fields()}
        fetcher={fetcher as unknown as typeof fetch}
        navigate={navigate}
      />,
    );
    await typeInto(
      byLabel<HTMLInputElement>(container, 'Title (required)'),
      'Launch notes',
    );
    await fillMeta(container);
    await click(buttonNamed(container, 'Create entry'));
    await flush();

    // Values: every property control still shows what the author typed.
    expect(metaValues(container)).toEqual({
      headline: 'Launch',
      tone: 'casual',
      priority: '3',
    });
    expect(byLabel<HTMLInputElement>(container, 'Title (required)').value).toBe(
      'Launch notes',
    );

    // Focus: the refusal lands on the summary, never on a lost control, and the
    // summary names the object field with a native link to it.
    const summary = container.querySelector<HTMLElement>(
      '[data-cms-editorial-validation-summary]',
    );
    expect(summary).not.toBeNull();
    expect(document.activeElement).toBe(summary);
    const link = Array.from(summary?.querySelectorAll('a') ?? []).find(
      (anchor) => anchor.textContent?.startsWith('Meta'),
    );
    expect(link?.getAttribute('href')).toBe(`#field-${META}`);
    expect(link?.textContent).toContain('object properties are invalid');
    expect(link?.textContent).not.toContain('Safe.');

    // The group says so too, and the keyboard can reach the object from the link.
    const group = container.querySelector<HTMLElement>(`#field-${META}-group`);
    expect(group?.textContent).toContain('object properties are invalid');
    await click(link as HTMLElement);
    expect(group?.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).toBe(property(container, /^Headline/u));

    // Recovery: the identical values are what the next attempt sends.
    await click(buttonNamed(container, 'Create entry'));
    await flush();
    const second = fetcher.mock.calls[1] as unknown as [string, RequestInit];
    const body = JSON.parse(String(second[1].body)) as {
      values: Record<string, unknown>;
    };
    expect(body.values[META]).toEqual({
      headline: 'Launch',
      tone: 'casual',
      priority: 3,
    });
    expect(navigate).toHaveBeenCalledWith(
      `/app/cms-content-modeling/entries/${ENTRY_ID}`,
    );
  });

  it('never offers a JSON or raw-object box, before or after the refusal', async () => {
    const fetcher = vi.fn(async () =>
      apiError(422, 'VALIDATION_FAILED', {
        reasonCode: 'object_property_invalid',
        violations: [
          { path: `/fields/${META}`, code: 'invalid_value', message: 'x' },
        ],
      }),
    );
    const { container } = mountElement(
      <CmsEditorialEntryCreateIsland
        type={selectedType()}
        fields={fields()}
        fetcher={fetcher as unknown as typeof fetch}
      />,
    );
    const inspect = (): void => {
      for (const area of Array.from(container.querySelectorAll('textarea')))
        expect(area.value.trim().startsWith('{')).toBe(false);
      expect(container.textContent).not.toMatch(/\{\s*"headline"/u);
      expect(
        container.querySelectorAll('[contenteditable="true"]'),
      ).toHaveLength(0);
    };
    inspect();
    await typeInto(
      byLabel<HTMLInputElement>(container, 'Title (required)'),
      'Launch notes',
    );
    await fillMeta(container);
    await click(buttonNamed(container, 'Create entry'));
    await flush();
    inspect();
  });
});

describe('EC-081 the object editor on the edit surface', () => {
  const init = () =>
    editorInit({
      fields: fields(),
      values: {
        [TITLE]: 'Release notes',
        [META]: { headline: 'Original', tone: 'formal' },
      },
    });

  it('keeps the typed property and the focus on it when the response is lost, and replays the identical object', async () => {
    const { container, advance, calls } = setup(
      [
        new TypeError('network down'),
        // The identical replay is the committed revision.
        json(
          201,
          {
            id: '018f0c45-73fe-7dc2-9c09-68f7ecf132d1',
            version: '1',
            entryVersion: '5',
            createdAt: '2026-10-05T00:00:00+00:00',
            updatedAt: '2026-10-05T00:00:00+00:00',
            state: 'draft',
            entryId: ENTRY_ID,
            revisionNumber: '3',
            schemaVersionId: '018f0c45-73fe-7dc2-9c09-68f7ecf132db',
            templateVersionId: null,
            taxonomyVersionIds: [],
            locale: 'en-US',
            contentHash: 'a'.repeat(64),
            parentRevisionIds: ['018f0c45-73fe-7dc2-9c09-68f7ecf10700'],
            validationState: 'valid',
            conflictId: null,
          },
          { etag: '"5"', 'cache-control': 'no-store' },
        ),
      ],
      init(),
    );
    const headline = property(container, /^Headline/u) as HTMLInputElement;
    headline.focus();
    await typeInto(headline, 'Mine');
    await advance(3_000);
    // The write may have happened: nothing is cleared and focus has not moved.
    expect(property(container, /^Headline/u).value).toBe('Mine');
    expect(property(container, /^Tone/u).value).toBe('formal');
    expect(document.activeElement).toBe(headline);
    expect(posts(calls)).toHaveLength(1);
    const first = posts(calls)[0];
    await advance(10_000);
    const replay = posts(calls)[1];
    expect(replay?.body).toBe(first?.body);
    expect(
      (JSON.parse(String(first?.body)) as { values: Record<string, unknown> })
        .values[META],
    ).toEqual({ headline: 'Mine', tone: 'formal' });
    expect(replay?.headers.get('idempotency-key')).toBe(
      first?.headers.get('idempotency-key'),
    );
    expect(property(container, /^Headline/u).value).toBe('Mine');
  });

  it('keeps every unsent object property when a conflict is reported, and puts focus on the conflict announcement', async () => {
    const { container, advance } = setup(
      [
        apiError(409, 'CONFLICT', { conflict: 'VERSION_MISMATCH' }),
        draftDetail({
          entryVersion: '6',
          revisionNumber: '3',
          values: {
            [TITLE]: 'Release notes',
            [META]: { headline: 'Theirs', tone: 'formal' },
          },
          openConflict: {
            conflictId: '018f0c45-73fe-7dc2-9c09-68f7ecf132ee',
            version: '1',
          },
        }),
      ],
      init(),
    );
    await typeInto(
      property(container, /^Headline/u) as HTMLInputElement,
      'Mine',
    );
    await choose(property(container, /^Tone/u) as HTMLSelectElement, 'casual');
    await advance(3_000);
    const alert = container.querySelector<HTMLElement>(
      '[data-cms-editorial-sync-conflict]',
    );
    expect(alert).not.toBeNull();
    expect(alert?.textContent).toContain('Nothing was overwritten');
    expect(
      alert?.parentElement?.contains(document.activeElement) === true ||
        document.activeElement === alert,
    ).toBe(true);
    expect(property(container, /^Headline/u).value).toBe('Mine');
    expect(property(container, /^Tone/u).value).toBe('casual');
    expect(REQUEST_ID).toBeDefined();
  });
});
