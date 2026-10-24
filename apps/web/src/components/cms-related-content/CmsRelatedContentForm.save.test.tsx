// @vitest-environment jsdom
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { act } from 'react';

import {
  buttonNamed,
  byLabel,
  click,
  disableReactAct,
  enableReactAct,
  typeInto,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import type { RelatedContentRuleRequest } from '@wejammin/contracts';
import {
  ENTRY_ID,
  id,
  mount,
  savedOf,
  submitStub,
  text,
} from './related-content.test-support';

beforeAll(enableReactAct);
afterAll(disableReactAct);

const name = (n: number): string => `entry ${id(n).slice(-12)}`;
const save = (container: HTMLElement) =>
  click(buttonNamed(container, 'Save related content'));
const sent = (stub: ReturnType<typeof submitStub>, call = 0) =>
  stub.mock.calls[call] as unknown as [
    RelatedContentRuleRequest,
    string,
    string,
  ];
const heading = (container: HTMLElement): string =>
  container.querySelector('#cms-related-result-heading')?.textContent ?? '';

describe('CmsRelatedContentForm: saving', () => {
  it('sends the ordered pins, exclusions and chosen rule with the entry version, csrf token and a fresh key', async () => {
    const submit = submitStub({ kind: 'saved', saved: savedOf() });
    const { container } = mount({ submit });
    await click(buttonNamed(container, `Pin ${name(2)}`));
    await click(buttonNamed(container, `Pin ${name(1)}`));
    await click(buttonNamed(container, `Exclude ${name(3)}`));
    await click(byLabel(container, /Shared terms/u));
    await typeInto(
      byLabel(container, /Most entries the rule may choose/u),
      '12',
    );
    await save(container);
    const [request, csrf, key] = sent(submit);
    expect(request).toEqual({
      entryId: ENTRY_ID,
      pins: [id(2), id(1)],
      exclusions: [id(3)],
      derivedRule: {
        key: 'shared-terms',
        version: '1',
        reasonCode: 'shared_terms',
        maxCandidates: 12,
      },
      expectedVersion: '4',
    });
    expect(csrf).toBe('csrf-token');
    expect(key).toMatch(/^[0-9a-f-]{36}$/u);
  });

  it('announces the saved rule set and eligible count in the focused result heading, and moves to the next version', async () => {
    const submit = submitStub({
      kind: 'saved',
      saved: savedOf({
        version: '5',
        eligibleCount: 3,
        pins: [id(1)],
        derivedRule: { key: 'same-type-recent', version: '1' },
      }),
    });
    const { container } = mount({ submit });
    await click(buttonNamed(container, `Pin ${name(1)}`));
    await save(container);
    expect(heading(container)).toBe('Related content saved');
    expect(document.activeElement?.id).toBe('cms-related-result-heading');
    expect(text(container)).toContain(
      '1 pinned, 0 excluded, the Same type, most recent rule. 3 entries are eligible to be shown now.',
    );
    expect(text(container)).toContain('Entry version5');
    await save(container);
    expect(sent(submit, 1)[0].expectedVersion).toBe('5');
  });

  it('says one entry is eligible, and no rule, in the singular', async () => {
    const submit = submitStub({
      kind: 'saved',
      saved: savedOf({ eligibleCount: 1 }),
    });
    const { container } = mount({ submit });
    await save(container);
    expect(text(container)).toContain(
      '0 pinned, 0 excluded, no derived rule. 1 entry is eligible to be shown now.',
    );
  });

  it('can save an empty set: it clears the saved rule', async () => {
    const submit = submitStub();
    const { container } = mount({ submit });
    await save(container);
    expect(sent(submit)[0]).toMatchObject({
      pins: [],
      exclusions: [],
      derivedRule: null,
    });
  });

  it('refuses a rule without a bound before sending, linking to the field, and sends nothing', async () => {
    const submit = submitStub();
    const { container } = mount({ submit });
    await click(byLabel(container, /Same type, most recent/u));
    await save(container);
    expect(submit).not.toHaveBeenCalled();
    expect(heading(container)).toBe('Check the related content');
    expect(text(container)).toContain(
      'Enter how many entries the rule may choose, from 1 to 128.',
    );
    const link = container.querySelector(
      '.cms-related-status a',
    ) as HTMLAnchorElement;
    await click(link);
    expect(document.activeElement?.id).toBe('cms-related-max-candidates');
    expect(document.activeElement?.getAttribute('aria-invalid')).toBe('true');
  });

  it('hides the bound until a rule is chosen and never sends it without one', async () => {
    const submit = submitStub();
    const { container } = mount({ submit });
    expect(() =>
      byLabel(container, /Most entries the rule may choose/u),
    ).toThrow();
    await click(byLabel(container, /Shared terms/u));
    await typeInto(
      byLabel(container, /Most entries the rule may choose/u),
      '9',
    );
    await click(byLabel(container, 'No derived rule'));
    await save(container);
    expect(sent(submit)[0].derivedRule).toBeNull();
  });

  it('disables the button while pending and ignores a second submit', async () => {
    let release: (() => void) | undefined;
    const submit = submitStub();
    const slow = (async (...args: Parameters<typeof submit>) => {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      return submit(...args);
    }) as unknown as typeof submit;
    const { container } = mount({ submit: slow as never });
    await save(container);
    expect(buttonNamed(container, 'Saving…').disabled).toBe(true);
    expect(text(container)).toContain('Saving related content…');
    expect(container.querySelector('fieldset')?.disabled).toBe(true);
    release?.();
  });

  it('needs a security token: without one the button is off and says why', () => {
    const { container } = mount({ csrfToken: '' });
    expect(buttonNamed(container, 'Save related content').disabled).toBe(true);
    expect(text(container)).toContain('this page has no security token');
  });
});

describe('CmsRelatedContentForm: submission', () => {
  it('handles the native submit itself: the browser default is prevented', async () => {
    const { container } = mount({ submit: submitStub() });
    const form = container.querySelector('form') as HTMLFormElement;
    const event = new Event('submit', { bubbles: true, cancelable: true });
    await act(async () => {
      form.dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(true);
  });

  it('sends one request when submit fires twice before the answer arrives', async () => {
    const releases: Array<() => void> = [];
    const submit = submitStub();
    const slow = (async (...args: Parameters<typeof submit>) => {
      await new Promise<void>((resolve) => {
        releases.push(resolve);
      });
      return submit(...args);
    }) as unknown as typeof submit;
    const { container } = mount({ submit: slow as never });
    const form = container.querySelector('form') as HTMLFormElement;
    await act(async () => {
      form.dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true }),
      );
      form.dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true }),
      );
    });
    expect(releases).toHaveLength(1);
    await act(async () => {
      for (const release of releases) release();
    });
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it('announces a saved result politely and every failure as an alert', async () => {
    const saved = mount({ submit: submitStub() });
    await save(saved.container);
    expect(
      saved.container
        .querySelector('.cms-related-status')
        ?.getAttribute('role'),
    ).toBe('status');
    saved.unmount();
    const failed = mount({
      submit: submitStub({ kind: 'rejected', status: 503 }),
    });
    await save(failed.container);
    expect(
      failed.container
        .querySelector('.cms-related-status')
        ?.getAttribute('role'),
    ).toBe('alert');
  });

  it('clears the saved result as soon as the rule changes, since it no longer describes the form', async () => {
    const { container } = mount({ submit: submitStub() });
    await save(container);
    expect(heading(container)).toBe('Related content saved');
    await click(byLabel(container, /Shared terms/u));
    expect(heading(container)).toBe('');
  });

  it('clears an invalid summary when the rule changes', async () => {
    const { container } = mount({ submit: submitStub() });
    await click(byLabel(container, /Shared terms/u));
    await save(container);
    expect(heading(container)).toBe('Check the related content');
    await click(byLabel(container, 'No derived rule'));
    expect(heading(container)).toBe('');
  });
});

describe('CmsRelatedContentForm: idempotency', () => {
  it('replays the identical request with the same key after an unknown outcome', async () => {
    const submit = submitStub((call) =>
      call === 0 ? { kind: 'uncertain' } : { kind: 'saved', saved: savedOf() },
    );
    const { container } = mount({ submit });
    await save(container);
    expect(heading(container)).toBe('Save not confirmed');
    await save(container);
    expect(sent(submit, 1)[2]).toBe(sent(submit, 0)[2]);
    expect(sent(submit, 1)[0]).toEqual(sent(submit, 0)[0]);
  });

  it('uses a new key once the request changed, and after a definite answer', async () => {
    const submit = submitStub((call) =>
      call === 0 ? { kind: 'uncertain' } : { kind: 'saved', saved: savedOf() },
    );
    const { container } = mount({ submit });
    await save(container);
    await click(buttonNamed(container, `Exclude ${name(2)}`));
    await save(container);
    expect(sent(submit, 1)[2]).not.toBe(sent(submit, 0)[2]);
    await click(buttonNamed(container, `Exclude ${name(3)}`));
    await save(container);
    await save(container);
    expect(sent(submit, 3)[2]).not.toBe(sent(submit, 2)[2]);
  });
});
