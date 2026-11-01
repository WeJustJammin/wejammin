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
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import CmsPatternVersionDesigner from './CmsPatternVersionDesigner';
import {
  CSRF_TOKEN,
  createdResult,
  designerContext,
  latestDetail,
  submitStub,
} from './pattern-designer.test-support';
import { PATTERN_REFUSAL_COPY } from './pattern-designer-reasons';
import type { PatternSubmitResult } from './pattern-designer-submit';
import { mountEditHeldRead } from './pattern-uncertain-reconcile.test-support';

beforeAll(async () => {
  enableReactAct();
  await import('../cms-composition/cms-registry-read');
});
afterAll(disableReactAct);
afterEach(() => vi.unstubAllGlobals());
// A saved pattern rewrites the address bar (showSavedPatternAddress); each test starts clean.
beforeEach(() =>
  window.history.replaceState(
    null,
    '',
    '/app/cms-content-modeling/patterns/new',
  ),
);
afterEach(() => window.history.replaceState(null, '', '/'));

/**
 * Slice 12 definition governance states, `commandState` column (FE03 1043-1049), for the pattern version
 * designer (CMS-03C-12). `empty` is "Not applicable" in the spec (no test).
 */
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
const region = (container: HTMLElement): HTMLElement =>
  container.querySelector<HTMLElement>('#cms-pattern-status')!;
const text = (container: HTMLElement): string => container.textContent ?? '';
const commit = (container: HTMLElement): HTMLButtonElement =>
  container.querySelector<HTMLButtonElement>('form button[type="submit"]')!;
const answered = async (result: PatternSubmitResult) => {
  const submit = submitStub(result);
  const view = mount({ submit });
  await click(commit(view.container));
  await flush();
  return { submit, ...view };
};
const heldSubmit = () => {
  let answer: (result: PatternSubmitResult) => void = () => undefined;
  const submit = vi.fn(
    () =>
      new Promise<PatternSubmitResult>((resolve) => {
        answer = resolve;
      }),
  );
  return { submit, answer: (result: PatternSubmitResult) => answer(result) };
};
const disabledControls = (container: HTMLElement): string[] =>
  Array.from(
    container.querySelectorAll<HTMLElement>(
      'form input, form select, form textarea, form button',
    ),
  )
    .filter((control) => control.matches(':disabled'))
    .map((control) => (control.textContent ?? '') || control.id);

describe('CmsPatternVersionDesigner (CMS-03C-12) commandState', () => {
  it('[P2-S12-AC-271] commandState idle: no result is shown, the unsent scoped draft is kept and nothing is sent (CMS-03C-12)', async () => {
    const submit = submitStub();
    const { container } = mount({ latest: null, submit });
    expect(region(container).textContent).toBe('');
    expect(commit(container).textContent).toBe('Create draft');
    expect(commit(container).disabled).toBe(false);
    await typeInto(byLabel(container, 'Pattern key'), 'profile-hero');
    expect(byLabel<HTMLInputElement>(container, 'Pattern key').value).toBe(
      'profile-hero',
    );
    expect(region(container).textContent).toBe('');
    expect(submit).not.toHaveBeenCalled();
  });

  it('[P2-S12-AC-271] commandState loading: the pending label is stable, only the commit control is disabled, the fields stay editable and a second activation sends nothing (CMS-03C-12)', async () => {
    const held = heldSubmit();
    const { container } = mount({ submit: held.submit });
    const before = disabledControls(container);
    await click(commit(container));
    await flush();
    expect(held.submit).toHaveBeenCalledTimes(1);
    expect(commit(container).textContent).toBe('Saving…');
    expect(commit(container).getAttribute('aria-busy')).toBe('true');
    expect(region(container).textContent).toContain(
      'Saving the pattern draft…',
    );
    expect(region(container).getAttribute('role')).toBe('status');
    expect(disabledControls(container)).toEqual([...before, 'Saving…']);
    expect(container.querySelectorAll('fieldset:disabled')).toHaveLength(0);
    // An edit made while the save is in flight neither lifts the pending state nor re-enables the commit.
    const typeBox = container.querySelector<HTMLInputElement>(
      'fieldset input[type="checkbox"]',
    )!;
    await click(typeBox);
    expect(commit(container).textContent).toBe('Saving…');
    expect(commit(container).disabled).toBe(true);
    await click(commit(container));
    expect(held.submit).toHaveBeenCalledTimes(1);
    held.answer({ kind: 'rejected', status: 422 });
    await flush();
    expect(commit(container).textContent).toBe('Save successor draft');
    expect(commit(container).disabled).toBe(false);
  });

  it('[P2-S12-AC-271] commandState success: names the saved draft with its version and node count, links its page, closes the form and sends only the one write (CMS-03C-12)', async () => {
    const submit = submitStub(
      createdResult({ patternVersion: 3, version: '3', nodeCount: 2 }),
    );
    const { container } = mount({ submit });
    await click(commit(container));
    await flush();
    expect(region(container).querySelector('h3')?.textContent).toBe(
      'Pattern draft saved',
    );
    expect(region(container).getAttribute('role')).toBe('status');
    expect(region(container).querySelector('dl')?.textContent).toContain(
      'Version3',
    );
    expect(region(container).querySelector('a')?.getAttribute('href')).toBe(
      '/app/cms-content-modeling/patterns/profile-hero',
    );
    expect(document.activeElement?.id).toBe('cms-pattern-result-heading');
    expect(
      container.querySelector<HTMLFieldSetElement>('form > fieldset')?.disabled,
    ).toBe(true);
    expect(commit(container).disabled).toBe(true);
    await click(commit(container));
    expect(submit).toHaveBeenCalledTimes(1);
  });

  describe('commandState error', () => {
    it('[P2-S12-AC-271] commandState error: a 401 offers sign-in returning to the pattern page and never a step-up route (CMS-03C-12 lists no STEP_UP_REQUIRED row)', async () => {
      const { container } = await answered({ kind: 'rejected', status: 401 });
      expect(region(container).getAttribute('role')).toBe('alert');
      expect(text(region(container))).toContain('Your session expired.');
      expect(region(container).querySelector('a')?.getAttribute('href')).toBe(
        '/auth/sign-in?returnTo=%2Fapp%2Fcms-content-modeling%2Fpatterns%2Fprofile-hero',
      );
      expect(container.querySelector('a[href*="step-up"]')).toBeNull();
    });

    it('[P2-S12-AC-271] commandState error: a 403 capability_missing renders the CapabilityGate with the fixed designer-access copy as an alert, no step-up route (CMS-03C-12)', async () => {
      const { container } = await answered({
        kind: 'refused',
        status: 403,
        reason: 'capability_missing',
      });
      expect(region(container).getAttribute('role')).toBe('alert');
      expect(text(region(container))).toContain(
        'Template designer access is required for this acting context. Nothing was saved.',
      );
      expect(
        region(container).querySelector('[data-cms-editorial-capability-gate]'),
      ).not.toBeNull();
      // FE03 "focus summary/field": the gate's heading is the focused named result.
      expect(document.activeElement).toBe(
        document.querySelector('[data-cms-editorial-capability-gate] h2'),
      );
      expect(container.querySelector('a[href*="step-up"]')).toBeNull();
      expect(commit(container).disabled).toBe(false);
    });

    it('[P2-S12-AC-271] commandState error: a 409 version conflict renders its fixed copy, keeps the tree and refetches the latest version by itself (CMS-03C-12)', async () => {
      const view = mountEditHeldRead({ kind: 'conflict', currentVersion: '5' });
      await click(commit(view.container));
      await flush();
      expect(region(view.container).getAttribute('role')).toBe('alert');
      expect(text(region(view.container))).toContain(
        'Another version of this pattern was saved after the one you started from.',
      );
      expect(text(view.container)).toContain('Node 1 · Level 1 of 8');
      expect(view.readLatest).toHaveBeenCalledTimes(1);
      // The automatic read is in flight (held by the harness): the control shows it and is off.
      expect(
        buttonNamed(view.container, 'Checking latest version…').disabled,
      ).toBe(true);
    });

    it('[P2-S12-AC-271] commandState error: a 409 registry-digest refusal renders its fixed copy, keeps the tree and reads the designer context again, not the latest version (V20 m7, DEC-245(1)) (CMS-03C-12)', async () => {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockImplementation((url) =>
          Promise.resolve(
            String(url) === '/api/v1/cms/templates/context'
              ? Response.json(
                  { contentTypes: [], registeredBlocks: [] },
                  { status: 200 },
                )
              : Response.json({ code: 'X' }, { status: 503 }),
          ),
        );
      vi.stubGlobal('fetch', fetcher);
      const view = mountEditHeldRead({
        kind: 'refused',
        status: 409,
        reason: 'block_registry_digest_mismatch',
      });
      await click(commit(view.container));
      await flush();
      expect(region(view.container).getAttribute('role')).toBe('alert');
      expect(text(region(view.container))).toContain(
        PATTERN_REFUSAL_COPY.block_registry_digest_mismatch,
      );
      expect(text(view.container)).toContain('Node 1 · Level 1 of 8');
      expect(view.readLatest).not.toHaveBeenCalled();
      const contextReads = fetcher.mock.calls.filter(
        ([url]) => String(url) === '/api/v1/cms/templates/context',
      );
      expect(contextReads).toHaveLength(1);
      expect(contextReads[0]![1]).toMatchObject({
        method: 'GET',
        cache: 'no-store',
      });
    });

    it.each(['key_reserved', 'block_rules_violated'] as const)(
      '[P2-S12-AC-271] commandState error: a 422 %s renders its fixed copy as an alert and links it to its control, keeping the tree (CMS-03C-12)',
      async (reason) => {
        const { container } = await answered({
          kind: 'refused',
          status: 422,
          reason,
        });
        expect(region(container).getAttribute('role')).toBe('alert');
        expect(text(region(container))).toContain(PATTERN_REFUSAL_COPY[reason]);
        const link = region(container).querySelector('a');
        expect(link).not.toBeNull();
        expect(text(container)).toContain('Node 1 · Level 1 of 8');
        if (reason === 'key_reserved') {
          const key = byLabel<HTMLInputElement>(container, 'Pattern key');
          expect(key.getAttribute('aria-invalid')).toBe('true');
          expect(
            container.querySelector('#cms-pattern-key-errors')?.textContent,
          ).toContain('reserved');
        } else {
          expect(link?.getAttribute('href')).toBe('#cms-pattern-tree');
        }
      },
    );
  });

  describe('commandState degraded', () => {
    it('[P2-S12-AC-271] commandState degraded: an unknown outcome renders pending, refetches the latest version before any retry, claims no success and replays the same Idempotency-Key after a verified not-saved (CMS-03C-12)', async () => {
      const view = mountEditHeldRead({ kind: 'uncertain' }, createdResult());
      await click(commit(view.container));
      await flush();
      // Pending while the canonical read is held; the read ran by itself, the write was sent once.
      expect(view.submit).toHaveBeenCalledTimes(1);
      expect(view.readLatest).toHaveBeenCalledTimes(1);
      expect(commit(view.container).textContent).toBe('Saving…');
      expect(commit(view.container).disabled).toBe(true);
      expect(text(region(view.container))).toContain(
        'Saving the pattern draft…',
      );
      expect(text(view.container)).not.toContain('Pattern draft saved');
      view.settleFirst({ kind: 'loaded', detail: latestDetail() });
      await flush();
      expect(region(view.container).querySelector('h3')?.textContent).toBe(
        'Nothing was saved',
      );
      await click(commit(view.container));
      await flush();
      expect(view.submit).toHaveBeenCalledTimes(2);
      const calls = view.submit.mock.calls as unknown as [
        unknown,
        string,
        string,
      ][];
      expect(calls[1]?.[2]).toBe(calls[0]?.[2]);
      expect(region(view.container).querySelector('h3')?.textContent).toBe(
        'Pattern draft saved',
      );
    });

    it('[P2-S12-AC-271] commandState degraded: when the refetch cannot settle the outcome the result stays unknown, no success is claimed and every send stays blocked (CMS-03C-12)', async () => {
      const view = mountEditHeldRead({ kind: 'uncertain' }, createdResult());
      await click(commit(view.container));
      await flush();
      view.settleFirst({ kind: 'unavailable' });
      await flush();
      expect(region(view.container).querySelector('h3')?.textContent).toBe(
        'The result is unknown',
      );
      expect(text(view.container)).not.toContain('Pattern draft saved');
      expect(commit(view.container).disabled).toBe(true);
      await click(commit(view.container));
      expect(view.submit).toHaveBeenCalledTimes(1);
    });
  });

  describe('commandState disabled', () => {
    it('[P2-S12-AC-271] commandState disabled: without a protected form session the reason is stated and the commit control is off; the island takes no permittedNextActions (CMS-03C-12)', async () => {
      const submit = submitStub();
      const { container } = mount({ csrfToken: '', submit });
      expect(text(container)).toContain(
        'Reload to restore the protected form session.',
      );
      expect(commit(container).disabled).toBe(true);
      await click(commit(container));
      expect(submit).not.toHaveBeenCalled();
    });

    it('[P2-S12-AC-271] commandState disabled: with no active content type the reason is stated and the commit control is off (CMS-03C-12)', async () => {
      const submit = submitStub();
      const { container } = mount({
        context: { ...designerContext, contentTypes: [] },
        submit,
      });
      expect(text(container)).toContain(
        'No active content types are available to this designer.',
      );
      expect(commit(container).disabled).toBe(true);
      await click(commit(container));
      expect(submit).not.toHaveBeenCalled();
    });

    it('[P2-S12-AC-271] commandState disabled: after a 429 the commit control stays off for the stated wait and the copy states it (CMS-03C-12)', async () => {
      const { container } = await answered({
        kind: 'rejected',
        status: 429,
        retryAfterSeconds: 30,
      });
      expect(text(region(container))).toContain('Wait at least 30 seconds');
      expect(commit(container).disabled).toBe(true);
    });
  });
});
