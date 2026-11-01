// @vitest-environment jsdom
import * as React from 'react';
import { act } from 'react';
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
  choose,
  click,
  disableReactAct,
  enableReactAct,
  flush,
  mountElement,
  typeInto,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import { rateLimitMessage } from '../../lib/safe-read-retry';
import CmsPatternVersionDesigner from './CmsPatternVersionDesigner';
import {
  CSRF_TOKEN,
  designerContext,
  latestDetail,
  submitStub,
} from './pattern-designer.test-support';
import type { PatternLatestResult } from './pattern-latest-read';
import {
  firstVersionDetail,
  mountEditHeldRead,
  mountNewHeldRead,
} from './pattern-uncertain-reconcile.test-support';

beforeAll(enableReactAct);
afterAll(disableReactAct);
beforeEach(() =>
  window.history.replaceState(
    null,
    '',
    '/app/cms-content-modeling/patterns/new',
  ),
);
afterEach(() => window.history.replaceState(null, '', '/'));

/*
 * RED for the inherited unknown-outcome race (FE03 :1047, :1050, :1108, :1175, :1223).
 * Defect (use-pattern-designer.ts :135-159, read-only): a POST answered `uncertain`
 * clears `inFlightRef` (:136) and `setStatus(result)` (:149) BEFORE the latest read
 * settles (:159), and `blocked` (:104) never covers the reconcile, so a repeated native
 * submit sends a SECOND command while the first attempt is still reconciled.
 */
const status = (container: HTMLElement): string =>
  container.querySelector('#cms-pattern-status')?.textContent ?? '';
interface Attempt {
  readonly patternKey: string;
  readonly expectedVersion: string | null;
}
const requestOf = (
  submit: ReturnType<typeof submitStub>,
  call: number,
): Attempt => (submit.mock.calls[call] as unknown as [Attempt])[0];
const committed = (container: HTMLElement): boolean =>
  container.querySelector<HTMLFieldSetElement>('form > fieldset')?.disabled ===
  true;

const submitForm = async (container: HTMLElement): Promise<void> => {
  await act(async () => {
    container
      .querySelector('form')
      ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
};

const addFirstVersionFields = async (
  container: HTMLElement,
  patternKey: string,
): Promise<void> => {
  await typeInto(
    byLabel<HTMLInputElement>(container, 'Pattern key'),
    patternKey,
  );
  await click(
    container.querySelector('fieldset input[type="checkbox"]') as HTMLElement,
  );
  await click(buttonNamed(container, 'Add a top-level block'));
  await typeInto(byLabel<HTMLInputElement>(container, 'Node 1 key'), 'hero');
  await choose(
    byLabel(container, 'Node 1 block') as unknown as HTMLSelectElement,
    'profile.header@1',
  );
};

describe('CmsPatternVersionDesigner: an unknown outcome stays pending until the reconcile read settles', () => {
  it('holds the commit control in flight and shows the read as pending until the deferred read answers', async () => {
    const view = mountEditHeldRead({ kind: 'uncertain' });
    await click(buttonNamed(view.container, 'Save successor draft'));
    await flush();
    expect(view.submit).toHaveBeenCalledTimes(1);
    expect(view.readLatest).toHaveBeenCalledWith('profile-hero');
    const button = buttonNamed(view.container, 'Saving…');
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(status(view.container)).toContain('Saving the pattern draft…');
    expect(status(view.container)).not.toContain('The result is unknown');
    view.settleFirst({
      kind: 'loaded',
      detail: latestDetail({ version: '3', patternVersion: 3 }),
    });
    await flush();
    expect(status(view.container)).toContain('Pattern draft saved');
  });

  it('sends no second command when the form is submitted again while the read is held', async () => {
    const view = mountEditHeldRead(
      { kind: 'uncertain' },
      { kind: 'uncertain' },
    );
    await click(buttonNamed(view.container, 'Save successor draft'));
    await flush();
    await submitForm(view.container);
    await flush();
    expect(view.submit).toHaveBeenCalledTimes(1);
    view.settleFirst({ kind: 'loaded', detail: latestDetail() });
    await flush();
    expect(status(view.container)).toContain('Nothing was saved');
  });

  it('keeps the pending state through a valid content edit and a repeated submit', async () => {
    const view = mountEditHeldRead(
      { kind: 'uncertain' },
      { kind: 'uncertain' },
    );
    await click(buttonNamed(view.container, 'Save successor draft'));
    await flush();
    await typeInto(
      byLabel<HTMLTextAreaElement>(
        view.container,
        'Node 1 props (JSON object)',
      ),
      '{"title":"Edited"}',
    );
    await submitForm(view.container);
    expect(view.submit).toHaveBeenCalledTimes(1);
    const button = buttonNamed(view.container, 'Saving…');
    expect(button.disabled).toBe(true);
    expect(committed(view.container)).toBe(false);
    view.settleFirst({
      kind: 'loaded',
      detail: latestDetail({ version: '3', patternVersion: 3 }),
    });
    await flush();
    expect(status(view.container)).toContain('Pattern draft saved');
  });
});

describe('CmsPatternVersionDesigner: the first attempt owns the outcome, not the current form', () => {
  it('keeps one attempt and reuses its identity across a repeated submit of a valid edit', async () => {
    const view = mountEditHeldRead(
      { kind: 'uncertain' },
      { kind: 'uncertain' },
    );
    await click(buttonNamed(view.container, 'Save successor draft'));
    await flush();
    expect(requestOf(view.submit, 0)).toMatchObject({
      patternKey: 'profile-hero',
      expectedVersion: '2',
    });
    await typeInto(
      byLabel<HTMLTextAreaElement>(
        view.container,
        'Node 1 props (JSON object)',
      ),
      '{"title":"Edited"}',
    );
    await submitForm(view.container);
    await flush();
    expect(view.submit).toHaveBeenCalledTimes(1);
    view.settleFirst({
      kind: 'loaded',
      detail: latestDetail({ version: '3', patternVersion: 3 }),
    });
    await flush();
    expect(status(view.container)).toContain('Pattern draft saved');
  });

  it('settles a new pattern A to B key edit against the original attempt and its address', async () => {
    const view = mountNewHeldRead({ kind: 'uncertain' }, { kind: 'uncertain' });
    await addFirstVersionFields(view.container, 'pattern-a');
    await click(buttonNamed(view.container, 'Create draft'));
    await flush();
    expect(view.submit).toHaveBeenCalledTimes(1);
    expect(requestOf(view.submit, 0)).toMatchObject({
      patternKey: 'pattern-a',
      expectedVersion: null,
    });
    await typeInto(
      byLabel<HTMLInputElement>(view.container, 'Pattern key'),
      'pattern-b',
    );
    await submitForm(view.container);
    await flush();
    expect(view.submit).toHaveBeenCalledTimes(1);
    view.settleFirst({
      kind: 'loaded',
      detail: firstVersionDetail('pattern-a'),
    });
    await flush();
    expect(status(view.container)).toContain('Pattern draft saved');
    expect(window.location.pathname).toBe(
      '/app/cms-content-modeling/patterns/pattern-a',
    );
  });
});

describe('CmsPatternVersionDesigner: an unavailable reconcile read leaves the outcome unresolved', () => {
  it('refuses a new command and keeps the manual check available when the read is unavailable', async () => {
    const view = mountEditHeldRead({ kind: 'uncertain' });
    await click(buttonNamed(view.container, 'Save successor draft'));
    await flush();
    view.settleFirst({ kind: 'unavailable' });
    await flush();
    expect(status(view.container)).toContain('The result is unknown');
    expect(buttonNamed(view.container, 'Save successor draft').disabled).toBe(
      true,
    );
    expect(committed(view.container)).toBe(false);
    expect(buttonNamed(view.container, 'Check latest version').disabled).toBe(
      false,
    );
  });

  it('lets the manual check resolve the original attempt without losing the local draft', async () => {
    let settleSecond: (value: PatternLatestResult) => void = () => undefined;
    const seen: string[] = [];
    const readLatest = vi.fn(
      (patternKey: string): Promise<PatternLatestResult> => {
        seen.push(patternKey);
        if (seen.length === 1) return Promise.resolve({ kind: 'unavailable' });
        return new Promise<PatternLatestResult>(
          (resolve) => (settleSecond = resolve),
        );
      },
    );
    const submit = submitStub({ kind: 'uncertain' });
    const mounted = mountElement(
      <CmsPatternVersionDesigner
        context={designerContext}
        latest={null}
        csrfToken={CSRF_TOKEN}
        submit={submit}
        readLatest={readLatest}
      />,
    );
    await addFirstVersionFields(mounted.container, 'pattern-a');
    await click(buttonNamed(mounted.container, 'Create draft'));
    await flush();
    expect(status(mounted.container)).toContain('The result is unknown');
    const key = byLabel<HTMLInputElement>(mounted.container, 'Pattern key');
    await typeInto(key, 'pattern-b');
    expect(key.value).toBe('pattern-b');
    await click(buttonNamed(mounted.container, 'Check latest version'));
    await flush();
    expect(seen).toHaveLength(2);
    // The manual check belongs to the unknown attempt, so it reads attempt A's key, not the edited B.
    expect(seen[1]).toBe('pattern-a');
    expect(submit).toHaveBeenCalledTimes(1);
    settleSecond({
      kind: 'loaded',
      detail: firstVersionDetail('pattern-a'),
    });
    await flush();
    // The manual check settles the original attempt exactly as the automatic one would.
    expect(status(mounted.container)).toContain('Pattern draft saved');
    expect(window.location.pathname).toBe(
      '/app/cms-content-modeling/patterns/pattern-a',
    );
    expect(committed(mounted.container)).toBe(true);
    expect(key.value).toBe('pattern-b');
    expect(submit).toHaveBeenCalledTimes(1);
  });
});

describe('CmsPatternVersionDesigner: a 429 reconcile read blocks the commit without an author command', () => {
  it('announces the wait, keeps the input, and sends no author request POST', async () => {
    const readLatest = vi.fn(async (): Promise<PatternLatestResult> => ({
      kind: 'rejected',
      status: 429,
      retryAfterSeconds: 30,
    }));
    const submit = submitStub({ kind: 'uncertain' });
    const mounted = mountElement(
      <CmsPatternVersionDesigner
        context={designerContext}
        latest={null}
        csrfToken={CSRF_TOKEN}
        submit={submit}
        readLatest={readLatest}
      />,
    );
    await addFirstVersionFields(mounted.container, 'pattern-a');
    await click(buttonNamed(mounted.container, 'Create draft'));
    await flush();
    const notice =
      mounted.container.querySelector(
        '.cms-pattern-conflict [data-cms-pattern-rate-limit]',
      )?.textContent ?? '';
    expect(notice).toBe(rateLimitMessage(30));
    expect(
      byLabel<HTMLInputElement>(mounted.container, 'Pattern key').value,
    ).toBe('pattern-a');
    expect(
      byLabel<HTMLInputElement>(mounted.container, 'Node 1 key').value,
    ).toBe('hero');
    expect(
      buttonNamed(mounted.container, 'Check latest version').disabled,
    ).toBe(true);
    await submitForm(mounted.container);
    await flush();
    expect(submit).toHaveBeenCalledTimes(1);
    expect(committed(mounted.container)).toBe(false);
  });
});

describe('CmsPatternVersionDesigner: a stale reconcile continuation after unmount is inert', () => {
  it('keeps the address and sends no new command when the held read resolves after unmount', async () => {
    const view = mountEditHeldRead({ kind: 'uncertain' });
    await click(buttonNamed(view.container, 'Save successor draft'));
    await flush();
    expect(view.submit).toHaveBeenCalledTimes(1);
    expect(requestOf(view.submit, 0)).toMatchObject({
      patternKey: 'profile-hero',
      expectedVersion: '2',
    });
    const originalPath = window.location.pathname;
    const originalSearch = window.location.search;
    view.unmount();
    // The own commit (version 3) resolves after unmount: a stale continuation must not navigate.
    view.settleFirst({
      kind: 'loaded',
      detail: latestDetail({ version: '3', patternVersion: 3 }),
    });
    await flush();
    expect(window.location.pathname).toBe(originalPath);
    expect(window.location.search).toBe(originalSearch);
    expect(view.submit).toHaveBeenCalledTimes(1);
  });
});
