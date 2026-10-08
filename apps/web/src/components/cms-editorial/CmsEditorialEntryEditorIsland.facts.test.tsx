// @vitest-environment jsdom

import { act } from 'react';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';

import {
  byLabel,
  disableReactAct,
  enableReactAct,
  typeInto,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import { fieldUuid } from '../cms-editorial-fields/cms-field-fixtures.test-support';
import {
  BLURB,
  ENTRY_ID,
  RATING,
  TITLE,
  apiError,
  draftDetail,
  editorInit,
  revisionCreated,
} from './cms-editorial-editor-fixtures.test-support';
import { saveCmsEditorialResult } from './cms-editorial-result-handoff';
import {
  setup,
  unmountAll,
} from './CmsEditorialEntryEditorIsland.test-support';

beforeAll(enableReactAct);
afterAll(disableReactAct);
beforeEach(() => {
  document.cookie = 'wj_csrf=csrf-token';
});
afterEach(() => {
  unmountAll();
  document.body.replaceChildren();
  document.cookie = 'wj_csrf=; max-age=0';
  window.sessionStorage.clear();
});

const facts = (container: HTMLElement): HTMLElement => {
  const found = container.querySelector<HTMLElement>(
    '[data-cms-editorial-facts]',
  );
  if (found === null) throw new Error('no canonical facts section');
  return found;
};

const provenanceOf = (container: HTMLElement, label: string): string | null => {
  const row = Array.from(
    container.querySelectorAll('[data-cms-editorial-provenance] [data-field]'),
  ).find((item) => item.getAttribute('data-field-label') === label);
  return row?.querySelector('[data-provenance]')?.textContent ?? null;
};

/**
 * FE03 success state (:910): "Canonical facts, state, version, provenance,
 * allowed actions"; Completion (:1219): "update URL/version ... and expose exact
 * next action". The editor page is where create, save, resolve and restore land,
 * so it states the canonical facts of the draft it holds.
 */
describe('editor island: canonical facts of the draft', () => {
  it('states the lifecycle, state, locale, validation, revision and ENTRY version', () => {
    const { container } = setup([]);
    const text = facts(container).textContent ?? '';
    for (const expected of [
      'Lifecycle',
      'active',
      'Revision state',
      'draft',
      'en-US',
      'valid',
    ])
      expect(text).toContain(expected);
    expect(
      facts(container).querySelector('[data-fact="revision"]')?.textContent,
    ).toBe('2');
    expect(
      facts(container).querySelector('[data-fact="entry-version"]')
        ?.textContent,
    ).toBe('4');
  });

  it('lists the per-field provenance the server reported, in words, for every authored field', () => {
    const { container } = setup(
      [],
      editorInit({
        provenance: {
          [TITLE]: 'authored',
          [BLURB]: 'default',
          [RATING]: 'explicit_null',
        },
      }),
    );
    expect(provenanceOf(container, 'Title')).toBe('Authored');
    expect(provenanceOf(container, 'Blurb')).toBe('Default value');
    expect(provenanceOf(container, 'Rating')).toBe('Explicitly empty');
  });

  it('says "Not set" for a field the draft holds no value for and names inherited and fallback sources', () => {
    const { container } = setup(
      [],
      editorInit({
        provenance: { [TITLE]: 'inherited', [BLURB]: 'localized_fallback' },
      }),
    );
    expect(provenanceOf(container, 'Title')).toBe('Inherited');
    expect(provenanceOf(container, 'Blurb')).toBe('Localized fallback');
    expect(provenanceOf(container, 'Rating')).toBe('Not set');
  });

  it('never lists a relation field in the provenance list', () => {
    const { container } = setup([]);
    expect(provenanceOf(container, 'Related entries')).toBeNull();
  });

  it('moves the revision, the entry version and the saved fields provenance after a verified save', async () => {
    const { container, advance } = setup(
      [revisionCreated({ revisionNumber: '3', entryVersion: '5' })],
      editorInit({ provenance: { [TITLE]: 'default' } }),
    );
    await typeInto(
      byLabel<HTMLInputElement>(container, 'Title (required)'),
      'Saved title',
    );
    await advance(3_000);
    expect(
      facts(container).querySelector('[data-fact="revision"]')?.textContent,
    ).toBe('3');
    expect(
      facts(container).querySelector('[data-fact="entry-version"]')
        ?.textContent,
    ).toBe('5');
    // CMS-03B-01 writes a value as `authored` (cms_create_revision).
    expect(provenanceOf(container, 'Title')).toBe('Authored');
  });

  it('reports a cleared field as explicitly empty after the save (a JSON null is written as explicit_null)', async () => {
    const { container, advance } = setup(
      [revisionCreated({ revisionNumber: '3', entryVersion: '5' })],
      editorInit({
        values: {
          [TITLE]: 'Release notes',
          [BLURB]: 'Some blurb',
          [RATING]: null,
          [fieldUuid(4)]: { targets: [] },
        },
        provenance: { [BLURB]: 'authored' },
      }),
    );
    await typeInto(byLabel<HTMLTextAreaElement>(container, 'Blurb'), '');
    await advance(3_000);
    expect(provenanceOf(container, 'Blurb')).toBe('Explicitly empty');
  });

  it('takes the provenance of an adopted canonical draft from that draft', async () => {
    const { container, advance } = setup(
      [
        apiError(409, 'CONFLICT', { conflict: 'VERSION_MISMATCH' }),
        draftDetail({
          entryVersion: '6',
          revisionNumber: '3',
          values: { [TITLE]: 'Release notes', [BLURB]: 'Theirs' },
          provenance: { [BLURB]: 'inherited' },
        }),
        revisionCreated({ revisionNumber: '4', entryVersion: '7' }),
      ],
      editorInit({ provenance: {} }),
    );
    await typeInto(
      byLabel<HTMLInputElement>(container, 'Title (required)'),
      'Mine',
    );
    await advance(3_000);
    expect(provenanceOf(container, 'Blurb')).toBe('Inherited');
    expect(
      facts(container).querySelector('[data-fact="entry-version"]')
        ?.textContent,
    ).toBe('7');
  });
});

const PARENT_A = '018f0c45-73fe-7dc2-9c09-68f7ecf132a1';
const PARENT_B = '018f0c45-73fe-7dc2-9c09-68f7ecf132a2';
const CHAIN = '018f0c45-73fe-7dc2-9c09-68f7ecf132c1';

const summary = (over: Record<string, unknown> = {}) => ({
  kind: 'restored',
  entryId: ENTRY_ID,
  revisionNumber: '5',
  entryVersion: '9',
  state: 'draft',
  parentRevisionIds: [PARENT_A, PARENT_B],
  migrationChainId: CHAIN,
  edgeCount: 2,
  ...over,
});

const result = (container: HTMLElement): HTMLElement | null =>
  container.querySelector<HTMLElement>('[data-cms-editorial-result]');

describe('editor island: the result of the command that opened it (create, resolve, restore)', () => {
  it('states a restore: new draft, version, the lineage (parents and migration chain) and the next action', () => {
    saveCmsEditorialResult(window.sessionStorage, summary() as never);
    const { container } = setup([]);
    const panel = result(container);
    expect(panel).not.toBeNull();
    expect(panel?.getAttribute('role')).toBe('status');
    expect(panel?.querySelector('h2')?.textContent).toBe('Revision restored');
    const text = panel?.textContent ?? '';
    expect(text).toContain('revision 5');
    expect(text).toContain('entry version 9');
    expect(text).toContain('The source revision is unchanged');
    expect(
      panel?.querySelector('[data-fact="parent-revisions"]')?.textContent,
    ).toContain(PARENT_A);
    expect(
      panel?.querySelector('[data-fact="parent-revisions"]')?.textContent,
    ).toContain(PARENT_B);
    expect(
      panel?.querySelector('[data-fact="migration-chain"]')?.textContent,
    ).toContain(CHAIN);
    expect(
      panel?.querySelector('[data-fact="migration-chain"]')?.textContent,
    ).toContain('2 edges');
    const next = Array.from(panel?.querySelectorAll('a') ?? []).map((a) =>
      a.getAttribute('href'),
    );
    expect(next).toContain(
      `/app/cms-content-modeling/entries/${ENTRY_ID}/revisions`,
    );
  });

  it('states a resolved conflict with its two parent revisions and a created entry with none', () => {
    saveCmsEditorialResult(
      window.sessionStorage,
      summary({
        kind: 'resolved',
        migrationChainId: null,
        edgeCount: null,
      }) as never,
    );
    let view = setup([]);
    expect(result(view.container)?.querySelector('h2')?.textContent).toBe(
      'Conflict resolved',
    );
    expect(
      result(view.container)?.querySelector('[data-fact="migration-chain"]'),
    ).toBeNull();
    expect(
      result(view.container)?.querySelector('[data-fact="parent-revisions"]'),
    ).not.toBeNull();
    unmountAll();
    document.body.replaceChildren();
    saveCmsEditorialResult(
      window.sessionStorage,
      summary({
        kind: 'created',
        revisionNumber: '1',
        entryVersion: '1',
        parentRevisionIds: [],
        migrationChainId: null,
        edgeCount: null,
      }) as never,
    );
    view = setup([]);
    expect(result(view.container)?.querySelector('h2')?.textContent).toBe(
      'Entry created',
    );
    expect(
      result(view.container)?.querySelector('[data-fact="parent-revisions"]'),
    ).toBeNull();
  });

  it('is shown once: the one-shot is consumed on the first load', () => {
    saveCmsEditorialResult(window.sessionStorage, summary() as never);
    const first = setup([]);
    expect(result(first.container)).not.toBeNull();
    unmountAll();
    document.body.replaceChildren();
    const second = setup([]);
    expect(result(second.container)).toBeNull();
  });

  it('ignores a result for another entry, an expired one and a malformed one', () => {
    saveCmsEditorialResult(
      window.sessionStorage,
      summary({ entryId: '018f0c45-73fe-7dc2-9c09-68f7ecf132ff' }) as never,
    );
    expect(result(setup([]).container)).toBeNull();
    unmountAll();
    document.body.replaceChildren();
    saveCmsEditorialResult(
      window.sessionStorage,
      summary() as never,
      Date.now() - 10 * 60_000,
    );
    expect(result(setup([]).container)).toBeNull();
    unmountAll();
    document.body.replaceChildren();
    saveCmsEditorialResult(
      window.sessionStorage,
      summary({ revisionNumber: 'nope' }) as never,
    );
    expect(result(setup([]).container)).toBeNull();
  });

  const nextFrame = (): Promise<void> =>
    new Promise((resolve) => {
      requestAnimationFrame(() => resolve());
    });

  it('moves focus to the result heading (FE03 Completion, :1219), even when the route heading took it first', async () => {
    document.body.insertAdjacentHTML(
      'afterbegin',
      '<h1 id="page-title" tabindex="-1">Edit entry</h1>',
    );
    document.getElementById('page-title')?.focus();
    saveCmsEditorialResult(window.sessionStorage, summary() as never);
    const { container } = setup([]);
    await act(async () => {
      await nextFrame();
      await nextFrame();
    });
    const heading = container.querySelector<HTMLElement>(
      '#cms-editorial-result-heading',
    );
    expect(heading?.getAttribute('tabindex')).toBe('-1');
    expect(document.activeElement).toBe(heading);
  });

  it('leaves focus alone when no command handed a result to this page', async () => {
    document.body.insertAdjacentHTML(
      'afterbegin',
      '<h1 id="page-title" tabindex="-1">Edit entry</h1>',
    );
    document.getElementById('page-title')?.focus();
    const { container } = setup([]);
    await act(async () => {
      await nextFrame();
    });
    expect(container.querySelector('#cms-editorial-result-heading')).toBeNull();
    expect(document.activeElement?.id).toBe('page-title');
  });
});
