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
  restoreActionImporters,
  restoreDraftImporters,
} from '../../lib/cms-editorial-page-actions-dom';
import { installCmsEditorialPageActions } from '../../lib/cms-editorial-page-actions-core';
import {
  buttonNamed,
  click,
  disableReactAct,
  enableReactAct,
  flush,
  mountElement,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import { describeCmsAuthoringFields } from '../cms-editorial-fields/cms-field-descriptor-decode';
import {
  authoringField,
  selectedType,
} from '../cms-editorial-fields/cms-field-fixtures.test-support';
import CmsEditorialEntryCreateIsland from './CmsEditorialEntryCreateIsland';
import { created } from './cms-editorial-create-island-responses.test-support';
import { createCmsEditorialConflictController } from './cms-editorial-conflict-controller';
import { conflictDetailBody } from './cms-editorial-conflict-fixtures.test-support';
import { conflictInitFrom } from './cms-editorial-conflict-state';
import {
  TITLE,
  apiError,
  draftDetail,
  editorFields,
  editorInit,
  revisionCreated,
} from './cms-editorial-editor-fixtures.test-support';
import { createFakeClock } from './cms-editorial-fake-clock.test-support';
import {
  createCmsEditorialEntryEditorController,
  saveFlowImporters,
} from './cms-editorial-entry-editor-controller';

/*
 * The editor, create and conflict stems of the exemption list of the bundle gate
 * (`CMS_ON_DEMAND_CHUNKS`), one test each: the real controller or island is created, nothing is
 * requested by creating it, by an edit, by a scroll or by the passing of time, and the named
 * person's action requests it. The modules are wrapped where they are called (the first call
 * follows the import straight away), and no test support that preloads them is imported.
 */
const spy = vi.hoisted(() => {
  const calls: Record<string, number> = {};
  const wrap = <F extends (...args: never[]) => unknown>(
    key: string,
    fn: F,
  ): F =>
    ((...args: Parameters<F>) => {
      calls[key] = (calls[key] ?? 0) + 1;
      return fn(...args);
    }) as F;
  return { calls, wrap };
});
const count = (key: string): number => spy.calls[key] ?? 0;

vi.mock('./cms-editorial-runtime', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('./cms-editorial-runtime')>();
  return {
    ...actual,
    executeCmsEditorialRevisionMutation: spy.wrap(
      'runtime',
      actual.executeCmsEditorialRevisionMutation,
    ),
  };
});
vi.mock(
  './cms-editorial-entry-draft-detail-transport',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import('./cms-editorial-entry-draft-detail-transport')
      >();
    return {
      ...actual,
      executeCmsEditorialEntryDraftDetailRead: spy.wrap(
        'draftDetail',
        actual.executeCmsEditorialEntryDraftDetailRead,
      ),
    };
  },
);
vi.mock('./cms-editorial-conflict-detail-transport', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('./cms-editorial-conflict-detail-transport')
    >();
  return {
    ...actual,
    executeCmsEditorialConflictDetailRead: spy.wrap(
      'conflictDetail',
      actual.executeCmsEditorialConflictDetailRead,
    ),
  };
});
vi.mock('./cms-editorial-conflict-resolve', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('./cms-editorial-conflict-resolve')>();
  return {
    ...actual,
    executeCmsEditorialConflictResolve: spy.wrap(
      'conflictResolve',
      actual.executeCmsEditorialConflictResolve,
    ),
  };
});
vi.mock('./cms-editorial-entry-create-submit', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('./cms-editorial-entry-create-submit')
    >();
  return {
    ...actual,
    submitCmsEditorialEntryCreate: spy.wrap(
      'createSubmit',
      actual.submitCmsEditorialEntryCreate,
    ),
  };
});

const seams = {
  save: { ...saveFlowImporters },
  restoreActions: { ...restoreActionImporters },
  restoreDraft: { ...restoreDraftImporters },
};
const requested = { save: 0, restoreActions: 0, restoreDraft: 0 };

beforeAll(enableReactAct);
afterAll(disableReactAct);
beforeEach(() => {
  for (const key of Object.keys(spy.calls)) delete spy.calls[key];
  requested.save = 0;
  requested.restoreActions = 0;
  requested.restoreDraft = 0;
  saveFlowImporters.flow = () => {
    requested.save += 1;
    return seams.save.flow();
  };
  restoreActionImporters.load = () => {
    requested.restoreActions += 1;
    return seams.restoreActions.load();
  };
  restoreDraftImporters.load = () => {
    requested.restoreDraft += 1;
    return seams.restoreDraft.load();
  };
  document.cookie = 'wj_csrf=csrf-token';
});
afterEach(() => {
  Object.assign(saveFlowImporters, seams.save);
  Object.assign(restoreActionImporters, seams.restoreActions);
  Object.assign(restoreDraftImporters, seams.restoreDraft);
  document.body.replaceChildren();
  document.cookie = 'wj_csrf=; max-age=0';
  window.sessionStorage.clear();
});

const idle = async (): Promise<void> => {
  vi.useFakeTimers();
  document.dispatchEvent(new Event('scroll'));
  await vi.advanceTimersByTimeAsync(120_000);
  vi.useRealTimers();
  await flush();
};

const editor = (answers: readonly Response[]) => {
  const queue = [...answers];
  const controller = createCmsEditorialEntryEditorController({
    init: editorInit(),
    clock: createFakeClock(),
    csrfToken: () => 'csrf-token',
    newKey: () => 'key-1',
    fetcher: async () => queue.shift() ?? new Response('{}', { status: 500 }),
  });
  return controller;
};

describe('the entry editor', () => {
  it('cms-editorial-entry-editor-save: not requested by creating the controller or by an edit; requested by the first save', async () => {
    const controller = editor([
      revisionCreated({ revisionNumber: '3', entryVersion: '5' }),
    ]);
    controller.setValue(TITLE, 'Release notes v2');
    await idle();
    expect(requested.save).toBe(0);
    await controller.saveNow();
    expect(requested.save).toBeGreaterThanOrEqual(1);
  });

  it('cms-editorial-runtime: not requested by creating the controller or by an edit; requested when the first save sends', async () => {
    const controller = editor([
      revisionCreated({ revisionNumber: '3', entryVersion: '5' }),
    ]);
    controller.setValue(TITLE, 'Release notes v2');
    await idle();
    expect(count('runtime')).toBe(0);
    await controller.saveNow();
    expect(count('runtime')).toBe(1);
  });

  it('cms-editorial-entry-draft-detail-transport: not requested by creating the controller; requested when the author asks for the current version', async () => {
    const controller = editor([
      draftDetail({ entryVersion: '6', revisionNumber: '4', values: {} }),
    ]);
    controller.setValue(TITLE, 'Release notes v2');
    await idle();
    expect(count('draftDetail')).toBe(0);
    await controller.discardUnsentAndLoadCurrent();
    expect(count('draftDetail')).toBe(1);
  });
});

describe('the create island', () => {
  it('cms-editorial-entry-create-submit: not requested by rendering the form or by a scroll; requested by the first submit', async () => {
    const fields = [
      authoringField({
        n: 1,
        key: 'title',
        kind: 'short_text',
        label: 'Title',
        defaultValue: 'Untitled',
      }),
    ];
    const fetcher = vi.fn(async () => created());
    const { container } = mountElement(
      <CmsEditorialEntryCreateIsland
        type={selectedType()}
        fields={fields}
        descriptors={describeCmsAuthoringFields(fields)}
        fetcher={fetcher}
        navigate={vi.fn()}
      />,
    );
    await idle();
    expect(count('createSubmit')).toBe(0);
    await click(buttonNamed(container, 'Create entry'));
    await flush();
    await flush();
    // The first import of the create transport carries the contract schemas: slow in a test runner.
    await vi.waitFor(() => expect(count('createSubmit')).toBe(1), {
      timeout: 15_000,
    });
  });
});

const conflict = (answers: readonly Response[]) => {
  const queue = [...answers];
  const init = conflictInitFrom(
    ConflictDetailResourceSchema.parse(conflictDetailBody({})),
    describeCmsAuthoringFields(editorFields()),
  );
  const controller = createCmsEditorialConflictController({
    init,
    csrfToken: () => 'csrf-token',
    newKey: () => 'key-1',
    onResolved: vi.fn(),
    fetcher: async () => queue.shift() ?? new Response('{}', { status: 500 }),
  });
  for (const descriptor of controller.descriptors.values())
    controller.choose(descriptor.fieldId, 'yours');
  return controller;
};

describe('the conflict page', () => {
  it('cms-editorial-conflict-resolve: not requested by opening the page or by a choice; requested by the first resolution', async () => {
    const controller = conflict([apiError(409, 'CONFLICT')]);
    await idle();
    expect(count('conflictResolve')).toBe(0);
    await controller.submit();
    expect(count('conflictResolve')).toBe(1);
  });

  it('cms-editorial-conflict-detail-transport: not requested by opening the page; requested when a resolution finds the conflict changed', async () => {
    const controller = conflict([
      apiError(409, 'CONFLICT'),
      apiError(404, 'NOT_FOUND'),
    ]);
    await idle();
    expect(count('conflictDetail')).toBe(0);
    await controller.submit();
    expect(count('conflictDetail')).toBe(1);
  });
});

const restorePage = (): void => {
  document.body.innerHTML =
    '<details data-cms-editorial-restore-review><summary>Restore</summary>' +
    '<form data-cms-editorial-restore action="#"><button type="submit">Restore</button></form></details>';
};

describe('the restore review', () => {
  it('cms-editorial-page-actions-restore: not requested by a page load or by time; requested when the restore review opens', async () => {
    restorePage();
    const abort = new AbortController();
    installCmsEditorialPageActions(document, { signal: abort.signal });
    await idle();
    expect(requested.restoreActions).toBe(0);
    const review = document.querySelector(
      'details[data-cms-editorial-restore-review]',
    ) as HTMLDetailsElement;
    review.open = true;
    await vi.waitFor(() => expect(requested.restoreActions).toBe(1));
    abort.abort();
  });

  it('cms-editorial-restore-draft: not requested by a page without a restore form; requested at load by the page that holds one', async () => {
    const abort = new AbortController();
    document.body.innerHTML = '<main><h1>Editor</h1></main>';
    installCmsEditorialPageActions(document, { signal: abort.signal });
    await idle();
    expect(requested.restoreDraft).toBe(0);
    abort.abort();
    // The revision history holds the restore form, so it recovers a kept confirmation on load:
    // that is why the gate charges this chunk to that route (`chargedOn`).
    restorePage();
    const history = new AbortController();
    installCmsEditorialPageActions(document, { signal: history.signal });
    await flush();
    expect(requested.restoreDraft).toBe(1);
    history.abort();
  });
});
