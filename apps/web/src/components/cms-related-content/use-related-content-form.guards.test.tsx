// @vitest-environment jsdom
import * as React from 'react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  disableReactAct,
  enableReactAct,
  flush,
  mountElement,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import { LIST_REFUSAL_COPY } from './related-content-copy';
import {
  formProps,
  id,
  savedOf,
  submitStub,
} from './related-content.test-support';
import { useRelatedContentForm } from './use-related-content-form';
import {
  DRAFT_PATH,
  RULE_PATH,
  canonicalReads,
  dependencyFailure,
  draftAnswer,
  noRuleAnswer,
  reads,
} from './related-conflict.test-support';

/**
 * [P2-S12-AC-271] The guards of the related-content form's own commands: a list command the lists refuse says why and
 * changes nothing, a move that is not possible changes nothing, and a re-read is only for an unknown attempt.
 */
beforeAll(enableReactAct);
afterAll(disableReactAct);

type Form = ReturnType<typeof useRelatedContentForm>;
const mountHook = (submit = submitStub()) => {
  let form: Form | null = null;
  function Harness(): React.ReactElement {
    const props = formProps({ submit });
    form = useRelatedContentForm({
      entry: props.entry,
      rule: props.rule,
      candidates: props.candidates,
      csrfToken: props.csrfToken,
      submit,
    });
    return <p>{form.note}</p>;
  }
  const mounted = mountElement(<Harness />);
  return { mounted, now: (): Form => form as unknown as Form, submit };
};
const note = (container: HTMLElement): string => container.textContent ?? '';

describe('useRelatedContentForm: guards', () => {
  it('[P2-S12-AC-271] says why a list refuses a pin or an exclusion and changes nothing', async () => {
    const { mounted, now } = mountHook();
    const { act } = await import('react');
    await act(async () => now().pin(id(1)));
    await act(async () => now().pin(id(1)));
    expect(note(mounted.container)).toBe(LIST_REFUSAL_COPY.already_pinned);
    expect(now().lists.pins).toEqual([id(1)]);
    await act(async () => now().exclude(id(2)));
    await act(async () => now().exclude(id(2)));
    expect(note(mounted.container)).toBe(LIST_REFUSAL_COPY.already_excluded);
    expect(now().lists.exclusions).toEqual([id(2)]);
  });

  it('[P2-S12-AC-271] changes nothing when a pin cannot move, and moves one that can', async () => {
    const { mounted, now } = mountHook();
    const { act } = await import('react');
    await act(async () => now().pin(id(1)));
    await act(async () => now().pin(id(3)));
    const before = note(mounted.container);
    await act(async () => now().move(0, -1));
    expect(note(mounted.container)).toBe(before);
    expect(now().lists.pins).toEqual([id(1), id(3)]);
    await act(async () => now().move(0, 1));
    expect(now().lists.pins).toEqual([id(3), id(1)]);
  });

  it('[P2-S12-AC-271] reads nothing again when there is no unknown attempt to reconcile', async () => {
    const fetcher = canonicalReads({
      [DRAFT_PATH]: () => draftAnswer('4'),
      [RULE_PATH]: () => noRuleAnswer(),
    });
    vi.stubGlobal('fetch', fetcher);
    try {
      const { now } = mountHook(
        submitStub({ kind: 'saved', saved: savedOf() }),
      );
      await now().recheck();
      await flush();
      expect(reads(fetcher)).toEqual([]);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('[P2-S12-AC-271] holds Check again for the stated wait when the reconciling read is limited', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => dependencyFailure(false)),
    );
    try {
      const { now } = mountHook(submitStub({ kind: 'uncertain' }));
      const { act } = await import('react');
      await act(async () => {
        await now().save();
      });
      await flush();
      expect(now().status).toEqual({
        kind: 'result',
        result: { kind: 'uncertain' },
      });
      expect(now().blocked).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('[P2-S12-AC-271] commandState degraded (V19 m9): a reconciling read that a newer one superseded changes nothing while the newer one is still reading', async () => {
    const { act } = await import('react');
    let releaseSecond: (response: Response) => void = () => undefined;
    let draftReads = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const path = new URL(String(input), 'https://web.test').pathname;
        if (path !== DRAFT_PATH) return noRuleAnswer();
        draftReads += 1;
        // Reads of the draft: the save's own check (fails), the first check (held), the second check (held).
        if (draftReads === 1) return dependencyFailure(false);
        return new Promise<Response>((resolve) => {
          if (draftReads === 3) releaseSecond = resolve;
        });
      }),
    );
    try {
      const { now } = mountHook(submitStub({ kind: 'uncertain' }));
      await act(async () => {
        await now().save();
      });
      await flush();
      expect(now().status.kind).toBe('result');
      await act(async () => {
        void now().recheck();
      });
      await act(async () => {
        void now().recheck();
      });
      await flush();
      // The first check was superseded and has ended; the second is still reading, so the page still says so.
      expect(now().status).toEqual({ kind: 'reconciling', again: true });
      await act(async () => releaseSecond(draftAnswer('4')));
      await flush();
      expect(now().status).toEqual({ kind: 'not_recorded' });
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
