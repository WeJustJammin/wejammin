// @vitest-environment jsdom
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  buttonNamed,
  click,
  disableReactAct,
  enableReactAct,
  flush,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import { TARGET_REFUSED_MESSAGE } from './related-content-copy';
import {
  DRAFT_PATH,
  RULE_PATH,
  canonicalReads,
  draftAnswer,
  noRuleAnswer,
  reads,
  ruleAnswer,
} from './related-conflict.test-support';
import type { RelatedSubmitResult } from './related-content-submit';
import {
  PAGE_PATH,
  id,
  listItems,
  mount,
  savedOf,
  submitStub,
  text,
} from './related-content.test-support';

beforeAll(enableReactAct);
afterAll(disableReactAct);

/**
 * Slice 12 definition governance states, `commandState` column (FE03 1043-1049), for the related content
 * form (CMS-03C-05). `empty` is "Not applicable" in the spec (no test).
 */
const name = (n: number): string => `entry ${id(n).slice(-12)}`;
const heading = (container: HTMLElement): string =>
  container.querySelector('#cms-related-result-heading')?.textContent ?? '';
const regionOf = (container: HTMLElement): HTMLElement | null =>
  container.querySelector<HTMLElement>('.cms-related-status');
const commit = (container: HTMLElement): HTMLButtonElement =>
  container.querySelector<HTMLButtonElement>('button[type="submit"]')!;
const version = (container: HTMLElement): string | null =>
  Array.from(container.querySelectorAll('form > dl dt')).find(
    (term) => term.textContent === 'Entry version',
  )?.nextElementSibling?.textContent ?? null;
const sentOf = (stub: ReturnType<typeof submitStub>, call = 0) =>
  stub.mock.calls[call] as unknown as [
    { expectedVersion: string; pins: string[]; exclusions: string[] },
    string,
    string,
  ];
const draftThenSave = async (
  result: RelatedSubmitResult | ((call: number) => RelatedSubmitResult),
) => {
  const submit = submitStub(result);
  const view = mount({ submit });
  await click(buttonNamed(view.container, `Pin ${name(1)}`));
  await click(buttonNamed(view.container, `Exclude ${name(3)}`));
  await click(buttonNamed(view.container, 'Save related content'));
  await flush();
  return { submit, ...view };
};
const heldSubmit = () => {
  let answer: (result: RelatedSubmitResult) => void = () => undefined;
  const submit = vi.fn(
    () =>
      new Promise<RelatedSubmitResult>((resolve) => {
        answer = resolve;
      }),
  );
  return { submit, answer: (result: RelatedSubmitResult) => answer(result) };
};
const disabledControls = (container: HTMLElement): string[] =>
  Array.from(
    container.querySelectorAll<HTMLElement>(
      'form input, form select, form textarea, form button',
    ),
  )
    .filter((control) => control.matches(':disabled'))
    .map((control) => (control.textContent ?? '') || control.id);

describe('CmsRelatedContentForm (CMS-03C-05) commandState', () => {
  it('[P2-S12-AC-271] commandState idle: no result region is shown, the unsent scoped draft is kept and nothing is sent (CMS-03C-05)', async () => {
    const submit = submitStub();
    const { container } = mount({ submit });
    expect(regionOf(container)).toBeNull();
    await click(buttonNamed(container, `Pin ${name(1)}`));
    await click(buttonNamed(container, `Exclude ${name(3)}`));
    expect(listItems(container, 'ol.cms-related-rows')).toContain(id(1));
    expect(regionOf(container)).toBeNull();
    expect(commit(container).disabled).toBe(false);
    expect(submit).not.toHaveBeenCalled();
  });

  it('[P2-S12-AC-271] commandState loading: the pending label is stable and only the commit control is disabled, the Derived rule fieldset included; an edit neither lifts the pending label nor is blocked (CMS-03C-05)', async () => {
    const held = heldSubmit();
    const { container } = mount({ submit: held.submit });
    await click(buttonNamed(container, `Exclude ${name(3)}`));
    await click(buttonNamed(container, 'Save related content'));
    await flush();
    expect(held.submit).toHaveBeenCalledTimes(1);
    expect(commit(container).textContent).toBe('Saving…');
    expect(regionOf(container)?.textContent).toBe('Saving related content…');
    // FE03 1048: the commit control is the one disabled control, the Derived rule fieldset included.
    expect(disabledControls(container)).toEqual(['Saving…']);
    expect(
      container.querySelector('.cms-related-rule')?.matches(':disabled'),
    ).toBe(false);
    // An edit while the command is in flight keeps the stable pending label.
    await click(buttonNamed(container, `Pin ${name(1)}`));
    expect(regionOf(container)?.textContent).toBe('Saving related content…');
    expect(commit(container).textContent).toBe('Saving…');
    // Choosing a derived rule during the command neither lifts the label nor re-enables the commit control.
    const rule = Array.from(
      container.querySelectorAll<HTMLInputElement>(
        '.cms-related-rule input[type="radio"]',
      ),
    ).find((radio) => !radio.checked)!;
    await click(rule);
    expect(regionOf(container)?.textContent).toBe('Saving related content…');
    expect(commit(container).textContent).toBe('Saving…');
    expect(commit(container).disabled).toBe(true);
    // A second activation sends nothing.
    await click(commit(container));
    expect(held.submit).toHaveBeenCalledTimes(1);
    held.answer({ kind: 'saved', saved: savedOf() });
    await flush();
    expect(heading(container)).toBe('Related content saved');
    expect(commit(container).textContent).toBe('Save related content');
  });

  it('[P2-S12-AC-271] commandState success: names the saved rule and eligible count, raises the entry version for the next save and sends only the one write (CMS-03C-05)', async () => {
    const { submit, container } = await draftThenSave({
      kind: 'saved',
      saved: savedOf({
        version: '5',
        eligibleCount: 3,
        pins: [id(1)],
        exclusions: [id(3)],
      }),
    });
    expect(heading(container)).toBe('Related content saved');
    expect(regionOf(container)?.getAttribute('role')).toBe('status');
    expect(text(regionOf(container)!)).toContain(
      '1 pinned, 1 excluded, no derived rule. 3 entries are eligible to be shown now.',
    );
    expect(version(container)).toBe('5');
    expect(document.activeElement?.id).toBe('cms-related-result-heading');
    await click(buttonNamed(container, 'Save related content'));
    await flush();
    expect(sentOf(submit, 1)[0].expectedVersion).toBe('5');
    expect(submit).toHaveBeenCalledTimes(2);
  });

  describe('commandState error', () => {
    it('[P2-S12-AC-271] commandState error: a 401 offers sign-in returning to this page and never a step-up route (CMS-03C-05 lists no STEP_UP_REQUIRED row)', async () => {
      const { container } = await draftThenSave({
        kind: 'rejected',
        status: 401,
      });
      expect(heading(container)).toBe('Sign in again');
      expect(
        regionOf(container)?.querySelector('a')?.getAttribute('href'),
      ).toBe(`/auth/sign-in?returnTo=${encodeURIComponent(PAGE_PATH)}`);
      expect(container.querySelector('a[href*="step-up"]')).toBeNull();
      expect(listItems(container, 'ol.cms-related-rows')).toContain(id(1));
    });

    it.each([
      [
        {
          kind: 'refused',
          status: 403,
          reason: 'capability_missing',
          rows: [],
        } as const,
        'You cannot change related content for this entry',
        'This account does not have edit access to this entry. Nothing was saved.',
      ],
      [
        { kind: 'rejected', status: 403 } as const,
        'Not allowed',
        'This account cannot change related content for this entry, or the page is out of date. Reload the page and try again.',
      ],
    ])(
      '[P2-S12-AC-271] commandState error: a 403 %j renders the CapabilityGate with fixed capability copy as an alert, no step-up route (CMS-03C-05)',
      async (result, expectedHeading, copy) => {
        const { container } = await draftThenSave(result);
        expect(heading(container)).toBe(expectedHeading);
        expect(regionOf(container)?.getAttribute('role')).toBe('alert');
        expect(text(container)).toContain(copy);
        expect(
          regionOf(container)?.querySelector(
            '[data-cms-editorial-capability-gate]',
          ),
        ).not.toBeNull();
        // FE03 "focus summary/field": the gate's heading is the focused named result.
        expect(document.activeElement).toBe(
          document.querySelector('[data-cms-editorial-capability-gate] h2'),
        );
        expect(container.querySelector('a[href*="step-up"]')).toBeNull();
        expect(listItems(container, 'ol.cms-related-rows')).toContain(id(1));
      },
    );

    it('[P2-S12-AC-271] commandState error (test correction, FE03 1049, DEC-242): a 409 renders fixed conflict copy, keeps the draft, refetches the draft and the saved rule by itself and withholds the save until the person reapplies (CMS-03C-05)', async () => {
      const fetchSpy = canonicalReads({
        [DRAFT_PATH]: () => draftAnswer('9'),
        [RULE_PATH]: () => ruleAnswer({ version: '10' }),
      });
      vi.stubGlobal('fetch', fetchSpy);
      const { container } = await draftThenSave({
        kind: 'conflict',
        currentVersion: '9',
      });
      expect(heading(container)).toBe('This entry changed');
      expect(regionOf(container)?.getAttribute('role')).toBe('alert');
      expect(text(container)).toContain(
        'The entry changed after this page loaded. Your choices are kept. Review the current server state before you reapply them, or reload the page.',
      );
      expect(buttonNamed(container, 'Review changes').disabled).toBe(false);
      expect(commit(container).disabled).toBe(true);
      expect(listItems(container, 'ol.cms-related-rows')).toContain(id(1));
      expect(reads(fetchSpy).map((call) => call.path)).toEqual([
        DRAFT_PATH,
        RULE_PATH,
      ]);
      buttonNamed(container, /^Reapply/u);
      // Choosing a rule does not lift the conflict the person still has to review.
      await click(
        Array.from(
          container.querySelectorAll<HTMLInputElement>(
            '.cms-related-rule input[type="radio"]',
          ),
        ).find((radio) => !radio.checked)!,
      );
      expect(heading(container)).toBe('This entry changed');
      expect(commit(container).disabled).toBe(true);
      vi.unstubAllGlobals();
    });

    it('[P2-S12-AC-271] commandState error: a 422 related_target_ineligible renders the one fixed copy at the refused row and a derived_rule_unknown names the rule, entries kept (CMS-03C-05)', async () => {
      const marked = await draftThenSave({
        kind: 'refused',
        status: 422,
        reason: 'related_target_ineligible',
        rows: [{ list: 'pins', index: 0 }],
      });
      expect(heading(marked.container)).toBe('Some entries cannot be used');
      expect(regionOf(marked.container)?.getAttribute('role')).toBe('alert');
      const row = marked.container.querySelector('ol.cms-related-rows > li');
      expect(row?.querySelector('.cms-related-refusal')?.textContent).toBe(
        TARGET_REFUSED_MESSAGE,
      );
      expect(row?.getAttribute('aria-describedby')).toBe(
        'cms-related-pin-refusal-0',
      );
      marked.unmount();
      const rule = await draftThenSave({
        kind: 'refused',
        status: 422,
        reason: 'derived_rule_unknown',
        rows: [],
      });
      expect(heading(rule.container)).toBe('That rule is not available');
      expect(text(rule.container)).toContain(
        'Choose another rule, or none, and save again.',
      );
      expect(listItems(rule.container, 'ol.cms-related-rows')).toContain(id(1));
    });
  });

  it('[P2-S12-AC-271] commandState degraded (test correction, FE03 1050, DEC-242): an unknown outcome claims no success, is reconciled by a read of the saved rule before any retry, and the retry replays the same Idempotency-Key (CMS-03C-05)', async () => {
    const fetchSpy = canonicalReads({
      [DRAFT_PATH]: () => draftAnswer('4'),
      [RULE_PATH]: () => noRuleAnswer(),
    });
    vi.stubGlobal('fetch', fetchSpy);
    const { submit, container } = await draftThenSave((call) =>
      call === 0 ? { kind: 'uncertain' } : { kind: 'saved', saved: savedOf() },
    );
    expect(reads(fetchSpy).map((call) => call.path)).toEqual([
      DRAFT_PATH,
      RULE_PATH,
    ]);
    expect(heading(container)).toBe('Save not recorded');
    expect(text(container)).toContain(
      'The save was not recorded. Your choices are kept. Saving again is safe: the same request is never applied twice.',
    );
    expect(text(container)).not.toContain('Related content saved');
    expect(commit(container).disabled).toBe(false);
    await click(buttonNamed(container, 'Save related content'));
    await flush();
    expect(submit).toHaveBeenCalledTimes(2);
    expect(submit.mock.calls[1]?.[2]).toBe(submit.mock.calls[0]?.[2]);
    expect(submit.mock.calls[1]?.[0]).toEqual(submit.mock.calls[0]?.[0]);
    expect(heading(container)).toBe('Related content saved');
    vi.unstubAllGlobals();
  });

  describe('commandState disabled', () => {
    it('[P2-S12-AC-271] commandState disabled: without a security token the reason is stated and the commit control is off; the island takes no permittedNextActions (CMS-03C-05)', async () => {
      const submit = submitStub();
      const { container } = mount({ csrfToken: '', submit });
      expect(text(container)).toContain(
        'Saving is unavailable because this page has no security token. Reload the page.',
      );
      expect(commit(container).disabled).toBe(true);
      await click(commit(container));
      expect(submit).not.toHaveBeenCalled();
    });

    it('[P2-S12-AC-271] commandState disabled: after a 409 the commit control is off until the conflict is reviewed, and a 429 holds it for the stated wait (CMS-03C-05)', async () => {
      const conflict = await draftThenSave({
        kind: 'conflict',
        currentVersion: '9',
      });
      expect(commit(conflict.container).disabled).toBe(true);
      expect(text(conflict.container)).toContain('Review changes');
      conflict.unmount();
      const limited = await draftThenSave({
        kind: 'rejected',
        status: 429,
        retryAfterSeconds: 30,
      });
      expect(commit(limited.container).disabled).toBe(true);
      expect(text(limited.container)).toContain(
        'Waiting before you can save again.',
      );
    });
  });
});
