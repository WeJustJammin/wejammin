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
  buttonNamed,
  byLabel,
  click,
  disableReactAct,
  enableReactAct,
  flush,
  mountElement,
  typeInto,
} from './cms-editorial-fields/cms-editor-dom.test-support';
import {
  mount as mountLocale,
  savedResult,
} from './cms-locale/locale-variant-form.test-support';
import { localeSubmitImporters } from './cms-locale/use-locale-variant-form';
import {
  fillValid,
  mount as mountDesigner,
} from './cms-taxonomy-designer/taxonomy-designer-form.test-support';
import {
  createdFacts,
  loadedVersions,
  readStub,
  submitStub,
  versionFacts,
} from './cms-taxonomy-designer/taxonomy-designer.test-support';
import { taxonomySubmitImporters } from './cms-taxonomy-designer/use-taxonomy-designer';
import CmsTaxonomyTermForm from './cms-taxonomy-terms/CmsTaxonomyTermForm';
import {
  formProps as termProps,
  readTermsStub,
  readVersionsStub,
  termsLoaded,
} from './cms-taxonomy-terms/term-form.test-support';
import { termSubmitImporters } from './cms-taxonomy-terms/use-term-form';

/*
 * The taxonomy, term and locale stems of the exemption list of the bundle gate
 * (`CMS_ON_DEMAND_CHUNKS`), one test each: the real form is mounted, nothing is requested by the
 * mount, by a scroll or by the passing of time, and the named person's action requests it. No test
 * support that preloads the modules is imported, so a request is a request.
 */
const spy = vi.hoisted(() => {
  const calls: Record<string, number> = {};
  return { calls };
});
vi.mock('./cms-locale/locale-source-refresh', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('./cms-locale/locale-source-refresh')>();
  return {
    ...actual,
    refreshLocaleSource: (
      ...args: Parameters<typeof actual.refreshLocaleSource>
    ) => {
      spy.calls.refresh = (spy.calls.refresh ?? 0) + 1;
      return actual.refreshLocaleSource(...args);
    },
  };
});

const real = {
  taxonomy: { ...taxonomySubmitImporters },
  term: { ...termSubmitImporters },
  locale: { ...localeSubmitImporters },
};
const asked: string[] = [];
const wrap = <T extends Record<string, () => Promise<unknown>>>(
  prefix: string,
  seam: T,
  original: T,
): void => {
  for (const key of Object.keys(original) as Array<keyof T & string>)
    seam[key] = (() => {
      asked.push(`${prefix}.${key}`);
      return original[key]!();
    }) as T[typeof key];
};

beforeAll(enableReactAct);
afterAll(disableReactAct);
beforeEach(() => {
  asked.length = 0;
  delete spy.calls.refresh;
  wrap('taxonomy', taxonomySubmitImporters, real.taxonomy);
  wrap('term', termSubmitImporters, real.term);
  wrap('locale', localeSubmitImporters, real.locale);
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('{}', { status: 500 })),
  );
});
afterEach(() => {
  Object.assign(taxonomySubmitImporters, real.taxonomy);
  Object.assign(termSubmitImporters, real.term);
  Object.assign(localeSubmitImporters, real.locale);
  vi.unstubAllGlobals();
});

const idle = async (): Promise<void> => {
  vi.useFakeTimers();
  document.dispatchEvent(new Event('scroll'));
  await vi.advanceTimersByTimeAsync(120_000);
  vi.useRealTimers();
  await flush();
};

describe('the vocabulary designer', () => {
  it('taxonomy-designer-submit: not requested by the mount or by filling the form; requested when the person saves', async () => {
    const { container } = mountDesigner();
    await fillValid(container);
    await idle();
    expect(asked).toEqual([]);
    await click(buttonNamed(container, 'Create draft'));
    await vi.waitFor(() => expect(asked).toContain('taxonomy.submit'), {
      timeout: 15_000,
    });
  });

  it('taxonomy-outcome-reconcile: not requested by a save that is answered; requested after a write whose outcome is unknown', async () => {
    const base = versionFacts({
      version: '2',
      taxonomyVersion: 2,
      state: 'active',
    });
    const { container } = mountDesigner({
      latest: base,
      submit: submitStub({ kind: 'created', resource: createdFacts() }),
      readVersions: readStub(loadedVersions([base])),
    });
    await idle();
    await click(buttonNamed(container, 'Save successor draft'));
    await flush();
    expect(asked).not.toContain('taxonomy.reconcile');
    container.remove();
    const unknown = mountDesigner({
      latest: base,
      submit: submitStub({ kind: 'uncertain' }),
      readVersions: readStub(loadedVersions([base])),
    });
    await idle();
    expect(asked).not.toContain('taxonomy.reconcile');
    await click(buttonNamed(unknown.container, 'Save successor draft'));
    await vi.waitFor(() => expect(asked).toContain('taxonomy.reconcile'), {
      timeout: 15_000,
    });
  });
});

describe('the term form', () => {
  it('term-action-submit: not requested by the mount or by editing a label; requested when the person acts on a term', async () => {
    const { container } = mountElement(
      <CmsTaxonomyTermForm
        {...termProps({
          readTerms: readTermsStub(termsLoaded()),
          readVersions: readVersionsStub(),
        })}
      />,
    );
    await click(buttonNamed(container, 'Rename term guitar'));
    await typeInto(byLabel<HTMLInputElement>(container, 'Label 1'), 'Electric');
    await idle();
    expect(asked).toEqual([]);
    await click(buttonNamed(container, 'Rename term'));
    await vi.waitFor(() => expect(asked).toContain('term.submit'), {
      timeout: 15_000,
    });
  });
});

describe('the translation form', () => {
  it('locale-variant-submit: not requested by the mount or by typing; requested when the person saves', async () => {
    const { container } = mountLocale();
    await typeInto(byLabel(container, 'Title'), 'Un titre');
    await idle();
    expect(asked).toEqual([]);
    await click(buttonNamed(container, 'Save translation'));
    await vi.waitFor(() => expect(asked).toContain('locale.submit'), {
      timeout: 15_000,
    });
  });

  it('locale-source-refresh: not requested by the mount or a save that is accepted; requested when a save finds the source changed', async () => {
    const accepted = mountLocale({
      submit: vi.fn(async () => savedResult()),
    });
    await typeInto(byLabel(accepted.container, 'Title'), 'Un titre');
    await click(buttonNamed(accepted.container, 'Save translation'));
    await flush();
    await idle();
    expect(spy.calls.refresh ?? 0).toBe(0);
    accepted.container.remove();
    const changed = mountLocale({
      submit: vi.fn(async () => ({
        kind: 'conflict' as const,
        currentVersion: '9',
      })),
    });
    await typeInto(byLabel(changed.container, 'Title'), 'Un titre');
    await click(buttonNamed(changed.container, 'Save translation'));
    await vi.waitFor(() => expect(spy.calls.refresh).toBe(1), {
      timeout: 15_000,
    });
  });
});
