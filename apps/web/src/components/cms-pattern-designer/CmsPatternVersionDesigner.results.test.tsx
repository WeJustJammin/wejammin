// @vitest-environment jsdom
import * as React from 'react';
import { act } from 'react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

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
import CmsPatternVersionDesigner from './CmsPatternVersionDesigner';
import {
  CSRF_TOKEN,
  createdResult,
  designerContext,
  latestDetail,
  nestedReferenceTree,
  submitStub,
} from './pattern-designer.test-support';
import type { PatternSubmitResult } from './pattern-designer-submit';
import type { PatternLatestResult } from './pattern-latest-read';

beforeAll(enableReactAct);
afterAll(disableReactAct);

type Props = React.ComponentProps<typeof CmsPatternVersionDesigner>;
const mount = (props: Partial<Props> = {}) =>
  mountElement(
    <CmsPatternVersionDesigner
      context={designerContext}
      latest={latestDetail()}
      csrfToken={CSRF_TOKEN}
      {...props}
    />,
  );
const text = (container: HTMLElement): string => container.textContent ?? '';
const save = async (container: HTMLElement): Promise<void> => {
  await click(buttonNamed(container, 'Save successor draft'));
  await flush();
};
const status = (container: HTMLElement): HTMLElement =>
  container.querySelector('#cms-pattern-status') as HTMLElement;

describe('CmsPatternVersionDesigner: editing a saved pattern', () => {
  it('prefills from the latest version, keeps the key read-only and sends the read version', async () => {
    const submit = submitStub(
      createdResult({ patternVersion: 3, version: '3' }),
    );
    const { container } = mount({ submit });
    expect(container.querySelector('h2')?.textContent).toBe(
      'Edit profile-hero',
    );
    const key = byLabel<HTMLInputElement>(container, 'Pattern key');
    expect(key.value).toBe('profile-hero');
    expect(key.readOnly).toBe(true);
    expect(
      (
        container.querySelector(
          'fieldset input[type="checkbox"]',
        ) as HTMLInputElement
      ).checked,
    ).toBe(true);
    expect(text(container)).toContain('Editing from version 2.');
    await save(container);
    const [request] = submit.mock.calls[0] as unknown as [
      { expectedVersion: string; patternKey: string },
    ];
    expect(request.expectedVersion).toBe('2');
    expect(request.patternKey).toBe('profile-hero');
    expect(text(status(container))).toContain('Pattern draft saved');
    expect(status(container).querySelector('dl')?.textContent).toContain(
      'Version3',
    );
  });
});

describe('CmsPatternVersionDesigner: what the server answered', () => {
  const answer = async (result: PatternSubmitResult) => {
    const view = mount({ submit: submitStub(result) });
    await save(view.container);
    return view;
  };

  it('says a typed refusal in fixed words and keeps the tree', async () => {
    const { container } = await answer({
      kind: 'refused',
      status: 409,
      reason: 'pattern_cycle',
    });
    expect(status(container).getAttribute('role')).toBe('alert');
    expect(document.activeElement?.textContent).toBe(
      'The pattern was not saved',
    );
    expect(text(status(container))).toContain('leads back to this pattern');
    const link = status(container).querySelector('a') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('#cms-pattern-tree');
    expect(text(container)).toContain('Node 1 · Level 1 of 8');
    expect(buttonNamed(container, 'Save successor draft').disabled).toBe(false);
  });

  it('links a nested pattern as a possible cause, since the server names no node', async () => {
    const view = mount({
      latest: latestDetail({ blockTree: nestedReferenceTree(), nodeCount: 1 }),
      submit: submitStub({
        kind: 'refused',
        status: 409,
        reason: 'pattern_cycle',
      }),
    });
    await save(view.container);
    const links = Array.from(status(view.container).querySelectorAll('a'));
    expect(links.map((link) => link.textContent)).toEqual([
      expect.stringContaining('leads back to this pattern'),
      'Node 1: This nested pattern may be the cause; the server did not say which nested pattern it is. Remove it, or check its state.',
    ]);
    await click(links[1] as HTMLElement);
    expect(document.activeElement?.id).toMatch(/^cms-pattern-node-.+$/u);
    expect(document.activeElement?.tagName).toBe('LI');
  });

  it('names an unknown outcome and a conflict in their own heading', async () => {
    const unknown = await answer({ kind: 'uncertain' });
    expect(document.activeElement?.textContent).toBe('The result is unknown');
    unknown.unmount();
    await answer({ kind: 'conflict', currentVersion: '5' });
    expect(document.activeElement?.textContent).toBe(
      'Another version was saved',
    );
  });

  it('puts a reserved key at the key field', async () => {
    const { container } = await answer({
      kind: 'refused',
      status: 422,
      reason: 'key_reserved',
    });
    const key = byLabel<HTMLInputElement>(container, 'Pattern key');
    expect(key.getAttribute('aria-invalid')).toBe('true');
    expect(
      container.querySelector('#cms-pattern-key-errors')?.textContent,
    ).toContain('reserved');
  });

  it('shows a missing capability without a link', async () => {
    const { container } = await answer({
      kind: 'refused',
      status: 403,
      reason: 'capability_missing',
    });
    expect(text(status(container))).toContain(
      'Template designer access is required',
    );
    expect(status(container).querySelector('a')).toBeNull();
  });

  it('offers sign-in on a 401 and keeps the form', async () => {
    const { container } = await answer({ kind: 'rejected', status: 401 });
    expect(text(status(container))).toContain('Your session expired.');
    expect(status(container).querySelector('a')?.getAttribute('href')).toBe(
      '/auth/sign-in?returnTo=%2Fapp%2Fcms-content-modeling%2Fpatterns%2Fprofile-hero',
    );
  });

  it('waits out a rate limit before another submit', async () => {
    const { container } = await answer({
      kind: 'rejected',
      status: 429,
      retryAfterSeconds: 30,
    });
    expect(text(status(container))).toContain('Wait at least 30 seconds');
    expect(buttonNamed(container, 'Save successor draft').disabled).toBe(true);
  });

  it('says nothing was saved for a rejection and a service failure', async () => {
    const rejected = await answer({ kind: 'rejected', status: 422 });
    expect(text(status(rejected.container))).toContain('Nothing was saved.');
    rejected.unmount();
    const down = await answer({ kind: 'rejected', status: 503 });
    expect(text(status(down.container))).toContain(
      'remains here for a later retry',
    );
  });
});

describe('CmsPatternVersionDesigner: the idempotency key', () => {
  const keyOf = (submit: ReturnType<typeof submitStub>, call: number): string =>
    (submit.mock.calls[call] as unknown as [unknown, string, string])[2];
  // FE03 :1175: reconcile status first. The default seam has no network in jsdom, so its
  // relative fetch failure is not a verified not-saved answer; inject a verified unchanged-base
  // latest read (a valid detail equal to the base) so the reconcile verdict is a definite not-saved.
  const notSavedRead = async (): Promise<PatternLatestResult> => ({
    kind: 'loaded',
    detail: latestDetail(),
  });

  it('reuses the key for the unchanged body while the outcome is unknown, then drops it', async () => {
    const submit = submitStub(
      { kind: 'uncertain' },
      { kind: 'rejected', status: 422 },
      { kind: 'rejected', status: 422 },
    );
    const { container } = mount({ submit, readLatest: notSavedRead });
    await save(container);
    await save(container);
    expect(keyOf(submit, 1)).toBe(keyOf(submit, 0));
    expect(text(status(container))).toContain('Nothing was saved.');
    await save(container);
    expect(keyOf(submit, 2)).not.toBe(keyOf(submit, 0));
  });

  it('uses a new key when the body changed', async () => {
    const submit = submitStub({ kind: 'uncertain' }, { kind: 'uncertain' });
    const { container } = mount({ submit, readLatest: notSavedRead });
    await save(container);
    await typeInto(
      container.querySelector(
        'input[id^="cms-pattern-node-"][id$="-key"]',
      ) as HTMLInputElement,
      'renamed',
    );
    await save(container);
    expect(keyOf(submit, 1)).not.toBe(keyOf(submit, 0));
  });

  it('ignores a second activation while a submit is in flight', async () => {
    let release: (value: PatternSubmitResult) => void = () => undefined;
    const submit = vi.fn(
      () => new Promise<PatternSubmitResult>((resolve) => (release = resolve)),
    );
    const { container } = mount({ submit });
    await click(buttonNamed(container, 'Save successor draft'));
    // FE03 :1043, :898, :1257: the commit control shows the stable pending label while it is disabled.
    const pending = buttonNamed(container, 'Saving…');
    expect(pending.matches(':disabled')).toBe(true);
    // Enter in a field submits the form without the button: that second activation is ignored too.
    await act(async () => {
      container
        .querySelector('form')
        ?.dispatchEvent(
          new Event('submit', { bubbles: true, cancelable: true }),
        );
    });
    expect(submit).toHaveBeenCalledTimes(1);
    release(createdResult({ patternVersion: 3, version: '3' }));
    await flush();
    expect(text(status(container))).toContain('Pattern draft saved');
  });
});

describe('CmsPatternVersionDesigner: reconciling with the latest version', () => {
  const newer = latestDetail({
    version: '5',
    patternVersion: 5,
    nodeCount: 1,
    compatibleTypeIds: [designerContext.contentTypes[1]!.id],
    blockTree: [
      {
        kind: 'block',
        key: 'other',
        blockKey: 'profile.text',
        blockVersion: 3,
        props: {},
        children: [],
      },
    ],
  });
  const readLatest = (result: PatternLatestResult) => vi.fn(async () => result);

  it('compares with the latest version and rebases explicitly, keeping the unsent tree', async () => {
    const submit = submitStub(
      { kind: 'conflict', currentVersion: '5' },
      createdResult({ patternVersion: 6, version: '6' }),
    );
    const read = readLatest({ kind: 'loaded', detail: newer });
    const { container } = mount({ submit, readLatest: read });
    await save(container);
    expect(text(status(container))).toContain('Nothing was overwritten.');
    expect(read).not.toHaveBeenCalled();
    await click(buttonNamed(container, 'Check latest version'));
    await flush();
    expect(read).toHaveBeenCalledWith('profile-hero');
    expect(text(container)).toContain(
      'Latest saved version: 5, 1 node, draft.',
    );
    expect(text(container)).toContain(
      'based on version 2 and is still in the form',
    );
    await click(
      buttonNamed(container, 'Keep my edits and base them on version 5'),
    );
    expect(text(container)).toContain('Editing from version 5.');
    expect(container.querySelector('#cms-pattern-status')?.textContent).toBe(
      '',
    );
    await save(container);
    const first = submit.mock.calls[0] as unknown as [
      { expectedVersion: string; blockTree: { key: string }[] },
      string,
      string,
    ];
    const second = submit.mock.calls[1] as unknown as typeof first;
    expect(second[0].expectedVersion).toBe('5');
    expect(second[0].blockTree[0]?.key).toBe('hero');
    expect(second[2]).not.toBe(first[2]);
  });

  it('can discard the unsent edits for the latest version', async () => {
    const { container } = mount({
      submit: submitStub({ kind: 'conflict', currentVersion: '5' }),
      readLatest: readLatest({ kind: 'loaded', detail: newer }),
    });
    await save(container);
    await click(buttonNamed(container, 'Check latest version'));
    await flush();
    await click(buttonNamed(container, 'Discard my edits and load version 5'));
    const keyInputs = container.querySelectorAll<HTMLInputElement>(
      'input[id^="cms-pattern-node-"][id$="-key"]',
    );
    expect(Array.from(keyInputs, (input) => input.value)).toEqual(['other']);
    expect(text(container)).toContain('Editing from version 5.');
  });

  it('says the version is still the latest when nothing newer exists', async () => {
    const { container } = mount({
      submit: submitStub({ kind: 'conflict', currentVersion: null }),
      readLatest: readLatest({ kind: 'loaded', detail: latestDetail() }),
    });
    await save(container);
    await click(buttonNamed(container, 'Check latest version'));
    await flush();
    expect(text(container)).toContain(
      'The version you started from is still the latest.',
    );
    expect(() => buttonNamed(container, /Keep my edits/u)).toThrow();
  });

  it('reports why the latest version cannot be read and offers the check again', async () => {
    const { container } = mount({
      submit: submitStub({ kind: 'uncertain' }),
      readLatest: readLatest({ kind: 'rejected', status: 403 }),
    });
    await save(container);
    expect(text(status(container))).toContain('The result is unknown.');
    await click(buttonNamed(container, 'Check latest version'));
    await flush();
    expect(
      container.querySelector('[role="alert"]:not(#cms-pattern-status)')
        ?.textContent,
    ).toContain('Template designer access is required');
    expect(buttonNamed(container, 'Check latest version').disabled).toBe(false);
  });
});
