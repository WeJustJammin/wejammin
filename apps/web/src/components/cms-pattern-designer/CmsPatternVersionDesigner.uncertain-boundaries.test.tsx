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

import type { PatternVersionRequest } from '@wejammin/contracts';
import { rateLimitMessage } from '../../lib/safe-read-retry';
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
import CmsPatternVersionDesigner from './CmsPatternVersionDesigner';
import {
  CSRF_TOKEN,
  createdResult,
  designerContext,
  latestDetail,
  submitStub,
} from './pattern-designer.test-support';
import type { PatternSubmitResult } from './pattern-designer-submit';
import type { PatternLatestResult } from './pattern-latest-read';
import { firstVersionDetail } from './pattern-uncertain-reconcile.test-support';

beforeAll(enableReactAct);
afterAll(disableReactAct);
beforeEach(() =>
  window.history.replaceState(
    null,
    '',
    '/app/cms-content-modeling/patterns/new',
  ),
);
afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/');
});

const status = (container: HTMLElement): string =>
  container.querySelector('#cms-pattern-status')?.textContent ?? '';
const propsField = (container: HTMLElement): HTMLTextAreaElement =>
  byLabel<HTMLTextAreaElement>(container, 'Node 1 props (JSON object)');
const nativeSubmit = async (container: HTMLElement): Promise<void> => {
  const form = container.querySelector('form');
  if (form === null) throw new Error('Pattern form is missing');
  await act(async () => form.requestSubmit());
};
const fillFirstVersion = async (container: HTMLElement): Promise<void> => {
  await typeInto(
    byLabel<HTMLInputElement>(container, 'Pattern key'),
    'pattern-a',
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

describe('pattern unknown-outcome admission boundaries (FE03 :1047, :1223)', () => {
  it('ignores native submits of invalid edited JSON throughout the held POST and canonical GET', async () => {
    let settlePost: (result: PatternSubmitResult) => void = () => undefined;
    let settleRead: (result: PatternLatestResult) => void = () => undefined;
    const submit = vi.fn(
      () =>
        new Promise<PatternSubmitResult>((resolve) => (settlePost = resolve)),
    );
    const readLatest = vi.fn(
      () =>
        new Promise<PatternLatestResult>((resolve) => (settleRead = resolve)),
    );
    const { container } = mountElement(
      <CmsPatternVersionDesigner
        context={designerContext}
        latest={latestDetail()}
        csrfToken={CSRF_TOKEN}
        submit={submit}
        readLatest={readLatest}
      />,
    );
    await click(buttonNamed(container, 'Save successor draft'));
    const nativeEvents = vi.fn();
    container.querySelector('form')?.addEventListener('submit', nativeEvents);
    await typeInto(propsField(container), '{');
    await nativeSubmit(container);
    expect(nativeEvents).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledTimes(1);
    expect(readLatest).not.toHaveBeenCalled();
    expect(propsField(container).value).toBe('{');
    expect(buttonNamed(container, 'Saving…').disabled).toBe(true);
    expect(status(container)).toContain('Saving the pattern draft…');
    expect(status(container)).not.toContain('Check the pattern');
    settlePost({ kind: 'uncertain' });
    await flush();
    expect(readLatest).toHaveBeenCalledTimes(1);
    expect(readLatest).toHaveBeenCalledWith('profile-hero');
    await typeInto(propsField(container), '{"broken":');
    await nativeSubmit(container);
    expect(nativeEvents).toHaveBeenCalledTimes(2);
    expect(submit).toHaveBeenCalledTimes(1);
    expect(readLatest).toHaveBeenCalledTimes(1);
    expect(propsField(container).value).toBe('{"broken":');
    expect(buttonNamed(container, 'Saving…').getAttribute('aria-busy')).toBe(
      'true',
    );
    expect(status(container)).toContain('Saving the pattern draft…');
    expect(status(container)).not.toContain('Check the pattern');
    settleRead({ kind: 'loaded', detail: latestDetail() });
    await flush();
    expect(status(container)).toContain('Nothing was saved');
    expect(submit).toHaveBeenCalledTimes(1);
    expect(readLatest).toHaveBeenCalledTimes(1);
  });
});

describe('an explicit adoption binds the original key to its canonical parent', () => {
  it.each(['rebase', 'discard'] as const)(
    'keeps A lineage after local key B and explicit %s',
    async (action) => {
      let settleRead: (response: Response) => void = () => undefined;
      const fetcher = vi.fn<typeof fetch>(
        () => new Promise<Response>((resolve) => (settleRead = resolve)),
      );
      vi.stubGlobal('fetch', fetcher);
      const submit = submitStub(
        { kind: 'uncertain' },
        createdResult({
          patternKey: 'pattern-a',
          version: '2',
          patternVersion: 2,
        }),
      );
      const { container } = mountElement(
        <CmsPatternVersionDesigner
          context={designerContext}
          latest={null}
          csrfToken={CSRF_TOKEN}
          submit={submit}
          // The picker's own read (DEC-196) must not share the stubbed global fetch this test counts.
          readNestable={async () => ({ kind: 'unavailable' })}
        />,
      );
      await fillFirstVersion(container);
      await click(buttonNamed(container, 'Create draft'));
      await flush();
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(fetcher.mock.calls[0]?.[0]).toBe('/api/v1/cms/patterns/pattern-a');
      expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ method: 'GET' });
      await typeInto(
        byLabel<HTMLInputElement>(container, 'Pattern key'),
        'pattern-b',
      );
      await typeInto(
        byLabel<HTMLInputElement>(container, 'Node 1 key'),
        'local',
      );
      const canonical = latestDetail({
        ...firstVersionDetail('pattern-a'),
        blockTree: [
          {
            kind: 'block',
            key: 'server',
            blockKey: 'profile.header',
            blockVersion: 1,
            props: {},
            children: [],
          },
        ],
      });
      settleRead(
        new Response(JSON.stringify(canonical), {
          status: 200,
          headers: { 'content-type': 'application/json', etag: '"1"' },
        }),
      );
      await flush();
      expect(status(container)).toContain('The result is unknown');
      expect(byLabel<HTMLInputElement>(container, 'Pattern key').value).toBe(
        'pattern-b',
      );
      const choice =
        action === 'rebase'
          ? 'Keep my edits and base them on version 1'
          : 'Discard my edits and load version 1';
      await click(buttonNamed(container, choice));
      const key = byLabel<HTMLInputElement>(container, 'Pattern key');
      expect(key.value).toBe('pattern-a');
      expect(key.readOnly).toBe(true);
      expect(byLabel<HTMLInputElement>(container, 'Node 1 key').value).toBe(
        action === 'rebase' ? 'local' : 'server',
      );
      await nativeSubmit(container);
      await flush();
      type Command = [PatternVersionRequest, string, string];
      const first = submit.mock.calls[0] as unknown as Command;
      const next = submit.mock.calls[1] as unknown as Command;
      expect(first[0]).toMatchObject({
        patternKey: 'pattern-a',
        expectedVersion: null,
      });
      expect(next[0]).toMatchObject({
        patternKey: 'pattern-a',
        expectedVersion: '1',
      });
      expect(next[0].blockTree[0]?.key).toBe(
        action === 'rebase' ? 'local' : 'server',
      );
      expect(next[2]).not.toBe(first[2]);
      expect(submit).toHaveBeenCalledTimes(2);
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(status(container)).toContain('Pattern draft saved');
      expect(window.location.pathname).toBe(
        '/app/cms-content-modeling/patterns/pattern-a',
      );
    },
  );
});

describe('the automatic unknown-outcome 429 announcement', () => {
  it('mounts an empty polite region before an immediate read response and fills the same node', async () => {
    let container: HTMLElement | null = null;
    const observations: {
      node: Element | null;
      text: string | null;
      connected: boolean;
      role: string | null;
      live: string | null;
      atomic: string | null;
    }[] = [];
    const readLatest = vi.fn(async (): Promise<PatternLatestResult> => {
      const node =
        container?.querySelector('[data-cms-pattern-rate-limit]') ?? null;
      observations.push({
        node,
        text: node?.textContent ?? null,
        connected: node?.isConnected ?? false,
        role: node?.getAttribute('role') ?? null,
        live: node?.getAttribute('aria-live') ?? null,
        atomic: node?.getAttribute('aria-atomic') ?? null,
      });
      return { kind: 'rejected', status: 429, retryAfterSeconds: 5 };
    });
    const mounted = mountElement(
      <CmsPatternVersionDesigner
        context={designerContext}
        latest={latestDetail()}
        csrfToken={CSRF_TOKEN}
        submit={submitStub({ kind: 'uncertain' })}
        readLatest={readLatest}
      />,
    );
    container = mounted.container;
    await click(buttonNamed(container, 'Save successor draft'));
    await flush();
    expect(readLatest).toHaveBeenCalledTimes(1);
    const observed = observations[0];
    expect(observations).toHaveLength(1);
    expect(observed?.node).not.toBeNull();
    expect(observed?.text).toBe('');
    expect(observed?.connected).toBe(true);
    expect(observed?.role).toBe('status');
    expect(observed?.live).toBe('polite');
    expect(observed?.atomic).toBe('true');
    const region = container.querySelector('[data-cms-pattern-rate-limit]');
    expect(region).toBe(observed?.node);
    expect(region?.textContent).toBe(rateLimitMessage(5));
    expect(region?.getAttribute('role')).toBe('status');
    expect(region?.getAttribute('aria-live')).toBe('polite');
    expect(region?.getAttribute('aria-atomic')).toBe('true');
  });
});
