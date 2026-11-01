// @vitest-environment jsdom
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
import CmsPatternVersionDesigner from './cms-pattern-designer/CmsPatternVersionDesigner';
import { patternLatestImporters } from './cms-pattern-designer/pattern-latest-read';
import {
  CSRF_TOKEN,
  designerContext,
  latestDetail,
  submitStub,
} from './cms-pattern-designer/pattern-designer.test-support';
import CmsTaxonomyTermForm from './cms-taxonomy-terms/CmsTaxonomyTermForm';
import { termsReadImporters } from './cms-taxonomy-terms/taxonomy-terms-read';
import './cms-taxonomy-terms/term-action-preload.test-support';
import {
  formProps as termProps,
  readVersionsStub,
} from './cms-taxonomy-terms/term-form.test-support';

/*
 * The `pattern-latest-fetch` and `taxonomy-terms-fetch` stems of the exemption list of the bundle gate
 * (`CMS_ON_DEMAND_CHUNKS`), DEC-246(1): both readers carry the shared read deadline and are re-reads after a command, a
 * lost answer or a 409, so their modules load when the island asks, not with the route (P2-S11-AC-106, the initial-route
 * budget). The real islands are mounted; nothing is requested by the mount, a scroll or the passing of time; a chunk that
 * cannot be fetched is the unavailable read the island already shows, with the control that repeats it. No test support
 * that preloads the modules is imported, so a request is a request.
 */
const real = {
  latest: patternLatestImporters.read,
  terms: termsReadImporters.read,
};
const asked: string[] = [];
const wrapped = (): void => {
  patternLatestImporters.read = (() => {
    asked.push('pattern.latest');
    return real.latest();
  }) as typeof real.latest;
  termsReadImporters.read = (() => {
    asked.push('terms.read');
    return real.terms();
  }) as typeof real.terms;
};

beforeAll(enableReactAct);
afterAll(disableReactAct);
beforeEach(() => {
  asked.length = 0;
  wrapped();
  vi.stubGlobal(
    'fetch',
    vi
      .fn<typeof fetch>()
      .mockImplementation(() =>
        Promise.resolve(Response.json({ code: 'X' }, { status: 503 })),
      ),
  );
});
afterEach(() => {
  patternLatestImporters.read = real.latest;
  termsReadImporters.read = real.terms;
  vi.unstubAllGlobals();
  vi.useRealTimers();
  document.body.replaceChildren();
});

const idle = async (): Promise<void> => {
  vi.useFakeTimers();
  document.dispatchEvent(new Event('scroll'));
  await vi.advanceTimersByTimeAsync(120_000);
  vi.useRealTimers();
  await flush();
};
const text = (container: HTMLElement): string => container.textContent ?? '';
const patternMount = () =>
  mountElement(
    <CmsPatternVersionDesigner
      context={designerContext}
      latest={latestDetail()}
      csrfToken={CSRF_TOKEN}
      submit={submitStub({ kind: 'conflict', currentVersion: '5' })}
    />,
  );
const termMount = () =>
  mountElement(
    <CmsTaxonomyTermForm
      {...termProps({
        readVersions: readVersionsStub(),
        submit: vi.fn(async () => ({ kind: 'uncertain' as const })),
      })}
    />,
  );
const lostTermAction = async (container: HTMLElement): Promise<void> => {
  await click(buttonNamed(container, 'Create a term'));
  await flush();
  await typeInto(byLabel<HTMLInputElement>(container, 'Term key'), 'cello');
  await typeInto(byLabel<HTMLInputElement>(container, 'Label 1'), 'Cello');
  await click(buttonNamed(container, 'Create term'));
  await flush();
};

describe('the latest pattern version read', () => {
  it('pattern-latest-fetch: not requested by the mount, a scroll or the passing of time; requested when a 409 asks for the latest version', async () => {
    const { container } = patternMount();
    await idle();
    expect(asked).toEqual([]);
    await click(
      container.querySelector<HTMLButtonElement>('form button[type="submit"]')!,
    );
    await vi.waitFor(() => expect(asked).toContain('pattern.latest'), {
      timeout: 15_000,
    });
  });

  it('pattern-latest-fetch: a chunk that cannot be fetched is the unavailable read, with the control that repeats it', async () => {
    patternLatestImporters.read = (() =>
      Promise.reject(new TypeError('Failed to fetch'))) as typeof real.latest;
    const { container } = patternMount();
    await click(
      container.querySelector<HTMLButtonElement>('form button[type="submit"]')!,
    );
    await vi.waitFor(
      () =>
        expect(text(container)).toContain('The latest version is unavailable.'),
      { timeout: 15_000 },
    );
    expect(buttonNamed(container, 'Check latest version').disabled).toBe(false);
  });
});

describe('the vocabulary terms read', () => {
  it('taxonomy-terms-fetch: not requested by the mount, a scroll or the passing of time; requested when the list is read again after a lost term action', async () => {
    const { container } = termMount();
    await idle();
    expect(asked).toEqual([]);
    await lostTermAction(container);
    await vi.waitFor(() => expect(asked).toContain('terms.read'), {
      timeout: 15_000,
    });
  });

  it('taxonomy-terms-fetch: a chunk that cannot be fetched is the unavailable read, with the control that repeats it', async () => {
    termsReadImporters.read = (() =>
      Promise.reject(new TypeError('Failed to fetch'))) as typeof real.terms;
    const { container } = termMount();
    await lostTermAction(container);
    await vi.waitFor(
      () =>
        expect(text(container)).toContain('The list could not be refreshed'),
      { timeout: 15_000 },
    );
    expect(buttonNamed(container, 'Refresh the list').disabled).toBe(false);
  });
});
