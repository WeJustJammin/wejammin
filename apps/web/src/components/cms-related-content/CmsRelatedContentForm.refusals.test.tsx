// @vitest-environment jsdom
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  buttonNamed,
  click,
  disableReactAct,
  enableReactAct,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import { TARGET_REFUSED_MESSAGE } from './related-content-copy';
import type { RelatedSubmitResult } from './related-content-submit';
import {
  PAGE_PATH,
  id,
  mount,
  submitStub,
  text,
} from './related-content.test-support';

beforeAll(enableReactAct);
afterAll(disableReactAct);

const name = (n: number): string => `entry ${id(n).slice(-12)}`;
const heading = (container: HTMLElement): string =>
  container.querySelector('#cms-related-result-heading')?.textContent ?? '';
const submitWith = async (
  result: RelatedSubmitResult,
  choose: number[] = [1, 2],
) => {
  const view = mount({ submit: submitStub(result) });
  for (const n of choose)
    await click(buttonNamed(view.container, `Pin ${name(n)}`));
  await click(buttonNamed(view.container, `Exclude ${name(3)}`));
  await click(buttonNamed(view.container, 'Save related content'));
  return view;
};
const ineligible = (
  ...rows: { list: 'pins' | 'exclusions'; index: number }[]
): RelatedSubmitResult => ({
  kind: 'refused',
  status: 422,
  reason: 'related_target_ineligible',
  rows,
});
const refusalsIn = (container: HTMLElement): string[] =>
  Array.from(container.querySelectorAll('.cms-related-refusal')).map(
    (node) => node.textContent ?? '',
  );

describe('an ineligible target (422 related_target_ineligible)', () => {
  it('marks the offending pin row with the one fixed message and no other row', async () => {
    const { container } = await submitWith(
      ineligible({ list: 'pins', index: 1 }),
    );
    expect(refusalsIn(container)).toEqual([TARGET_REFUSED_MESSAGE]);
    const rows = Array.from(
      container.querySelectorAll('ol.cms-related-rows > li'),
    );
    expect(rows[0]?.querySelector('.cms-related-refusal')).toBeNull();
    expect(rows[1]?.querySelector('.cms-related-refusal')?.textContent).toBe(
      TARGET_REFUSED_MESSAGE,
    );
    expect(heading(container)).toBe('Some entries cannot be used');
    expect(document.activeElement?.id).toBe('cms-related-result-heading');
  });

  it('shows the identical message for a pin and an exclusion, so the cause cannot be inferred', async () => {
    const { container } = await submitWith(
      ineligible({ list: 'pins', index: 0 }, { list: 'exclusions', index: 0 }),
    );
    expect(refusalsIn(container)).toEqual([
      TARGET_REFUSED_MESSAGE,
      TARGET_REFUSED_MESSAGE,
    ]);
  });

  it('describes the marked row to assistive technology', async () => {
    const { container } = await submitWith(
      ineligible({ list: 'pins', index: 0 }),
    );
    const row = container.querySelector(
      'ol.cms-related-rows > li',
    ) as HTMLElement;
    expect(row.getAttribute('aria-describedby')).toBe(
      'cms-related-pin-refusal-0',
    );
    expect(
      container.querySelector('#cms-related-pin-refusal-0'),
    ).not.toBeNull();
  });

  it('never explains the cause: no mention of inactive, hidden, owner, readable, absent or self', async () => {
    const { container } = await submitWith(
      ineligible({ list: 'pins', index: 0 }),
    );
    expect(text(container).toLowerCase()).not.toMatch(
      /inactive|hidden|owner|permission|exist|absent|itself|self|private|archived\b.*cannot/u,
    );
    expect(TARGET_REFUSED_MESSAGE).not.toMatch(/because|since|as it/u);
  });

  it('falls back to one form-level message when no pointer arrives', async () => {
    const { container } = await submitWith(ineligible());
    expect(refusalsIn(container)).toEqual([]);
    expect(text(container)).toContain(TARGET_REFUSED_MESSAGE);
  });

  it('ignores a pointer past the end of its list', async () => {
    const { container } = await submitWith(
      ineligible({ list: 'pins', index: 7 }),
    );
    expect(refusalsIn(container)).toEqual([]);
  });

  it('clears a mark that would otherwise land on a different entry after the list shifts', async () => {
    const { container } = await submitWith(
      ineligible({ list: 'pins', index: 1 }),
    );
    await click(buttonNamed(container, `Remove pin ${name(1)}`));
    // Entry 2 moved to row 0; a stale mark at row 1 would now point at nothing or at the wrong entry.
    expect(refusalsIn(container)).toEqual([]);
    expect(container.querySelector('[aria-describedby]')).toBeNull();
  });

  it('drops a mark for an unrelated change: the marked row would no longer be the refused entry', async () => {
    const { container } = mount({
      submit: submitStub(ineligible({ list: 'pins', index: 1 })),
    });
    for (const n of [1, 2, 3])
      await click(buttonNamed(container, `Pin ${name(n)}`));
    await click(buttonNamed(container, 'Save related content'));
    expect(refusalsIn(container)).toEqual([TARGET_REFUSED_MESSAGE]);
    await click(buttonNamed(container, `Remove pin ${name(3)}`));
    expect(refusalsIn(container)).toEqual([]);
  });

  it('says the marked entries are in the lists when rows are known, and the form message when not', async () => {
    const withRows = await submitWith(ineligible({ list: 'pins', index: 0 }));
    expect(text(withRows.container)).toContain(
      'The entries marked in the lists cannot be used',
    );
    withRows.unmount();
    const without = await submitWith(ineligible());
    expect(text(without.container)).not.toContain('marked in the lists');
  });

  it('announces a refusal as an alert', async () => {
    const { container } = await submitWith(
      ineligible({ list: 'pins', index: 0 }),
    );
    expect(
      container.querySelector('.cms-related-status')?.getAttribute('role'),
    ).toBe('alert');
  });

  it('clears the marks as soon as the lists change, since the indexes would be stale', async () => {
    const { container } = await submitWith(
      ineligible({ list: 'pins', index: 1 }),
    );
    await click(buttonNamed(container, `Remove pin ${name(2)}`));
    expect(refusalsIn(container)).toEqual([]);
    expect(heading(container)).toBe('');
  });
});

describe('the other outcomes', () => {
  it('names an unavailable rule and keeps every choice', async () => {
    const { container } = await submitWith({
      kind: 'refused',
      status: 422,
      reason: 'derived_rule_unknown',
      rows: [],
    });
    expect(heading(container)).toBe('That rule is not available');
    expect(container.querySelectorAll('ol.cms-related-rows > li')).toHaveLength(
      2,
    );
  });

  it('shows the missing capability once, without a step-up route', async () => {
    const { container } = await submitWith({
      kind: 'refused',
      status: 403,
      reason: 'capability_missing',
      rows: [],
    });
    expect(heading(container)).toBe(
      'You cannot change related content for this entry',
    );
    expect(container.querySelector('a[href^="/step-up"]')).toBeNull();
  });

  it('links to sign-in, returning to this page, on a 401', async () => {
    const { container } = await submitWith({ kind: 'rejected', status: 401 });
    const link = container.querySelector(
      '.cms-related-status a',
    ) as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe(
      `/auth/sign-in?returnTo=${encodeURIComponent(PAGE_PATH)}`,
    );
    expect(container.querySelector('a[href^="/step-up"]')).toBeNull();
  });

  it.each([
    [400, 'Invalid request'],
    [403, 'Not allowed'],
    [404, 'Entry not available'],
    [422, 'Could not save'],
    [500, 'Could not save'],
    [503, 'Temporarily unavailable'],
  ] as const)(
    'renders a rejected %i as a fixed state',
    async (status, expected) => {
      const { container } = await submitWith({ kind: 'rejected', status });
      expect(heading(container)).toBe(expected);
    },
  );

  it('waits for the stated seconds after a 429 and offers no save meanwhile', async () => {
    const { container } = await submitWith({
      kind: 'rejected',
      status: 429,
      retryAfterSeconds: 30,
    });
    expect(heading(container)).toBe('Too many requests');
    expect(text(container)).toContain('Try again in 30 seconds.');
    expect(buttonNamed(container, 'Save related content').disabled).toBe(true);
    expect(text(container)).toContain('Waiting before you can save again.');
  });

  it('never prints a provider detail, a request id or a response body', async () => {
    const { container } = await submitWith({ kind: 'rejected', status: 503 });
    expect(text(container)).not.toMatch(/req|DEPENDENCY|request id/iu);
  });
});
