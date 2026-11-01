// @vitest-environment jsdom
import { act } from 'react';
import {
  afterAll,
  afterEach,
  beforeAll,
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
  typeInto,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import {
  id,
  listItems,
  mount,
  savedOf,
  submitStub,
} from './related-content.test-support';
import {
  DRAFT_PATH,
  RULE_PATH,
  boundField,
  canonicalReads,
  dependencyFailure,
  draftAnswer,
  heading,
  localVersion,
  name,
  noRuleAnswer,
  ruleAnswer,
} from './related-conflict.test-support';

/*
 * [P2-S12-AC-271] commandState degraded (FE03 1050; review V19 m6, m9): "Check again" is one control for the whole
 * unconfirmed episode, it keeps focus while its read runs, and an edit never lifts a save that is still unreconciled.
 */
beforeAll(enableReactAct);
afterAll(disableReactAct);
afterEach(() => vi.unstubAllGlobals());

const matching = (version: string) =>
  ruleAnswer({
    version,
    pins: [id(1)],
    exclusions: [],
    derivedRule: { key: 'shared-terms', version: '1' },
  });
const saving = async (submit: ReturnType<typeof submitStub>) => {
  const { container } = mount({ submit });
  await click(buttonNamed(container, `Pin ${name(1)}`));
  await click(byLabel(container, /Shared terms/u));
  await typeInto(boundField(container), '12');
  await click(buttonNamed(container, 'Save related content'));
  await flush();
  return container;
};
const save = (container: HTMLElement) =>
  buttonNamed(container, 'Save related content');

/** A wire that fails until `heal`, holding the next draft read while `hold` is set. */
const wire = () => {
  const state = {
    healthy: false,
    release: ((response: Response) => void response) as (r: Response) => void,
    held: false,
  };
  const fetcher = vi.fn(async (input: RequestInfo | URL) => {
    if (!state.healthy) return dependencyFailure(false);
    const path = new URL(String(input), 'https://web.test').pathname;
    if (path === DRAFT_PATH && state.held) {
      state.held = false;
      return new Promise<Response>((resolve) => (state.release = resolve));
    }
    return path === RULE_PATH ? matching('5') : draftAnswer('5');
  });
  return { state, fetcher };
};

describe('Check again keeps focus while it reads', () => {
  it('[P2-S12-AC-271] commandState degraded: the control stays the same focused element through the read, and the verified outcome moves focus to the result heading', async () => {
    const { state, fetcher } = wire();
    vi.stubGlobal('fetch', fetcher);
    const container = await saving(submitStub({ kind: 'uncertain' }));
    expect(heading(container)).toBe('Save not confirmed');
    const check = buttonNamed(container, 'Check again');
    check.focus();
    state.healthy = true;
    state.held = true;
    await click(check);
    expect(buttonNamed(container, 'Check again')).toBe(check);
    expect(document.activeElement).toBe(check);
    expect(check.getAttribute('aria-disabled')).toBe('true');
    expect(
      container.querySelector('.cms-related-status[role="status"]')
        ?.textContent,
    ).toBe('Checking whether the save went through…');
    await click(check);
    expect(fetcher).toHaveBeenCalledTimes(2);
    await act(async () => state.release(draftAnswer('5')));
    await flush();
    expect(() => buttonNamed(container, 'Check again')).toThrow();
    expect(heading(container)).toBe('Related content saved');
    expect(document.activeElement?.id).toBe('cms-related-result-heading');
  });

  it('[P2-S12-AC-271] commandState degraded: a check that still cannot verify keeps focus on the control and says so again', async () => {
    const { fetcher } = wire();
    vi.stubGlobal('fetch', fetcher);
    const container = await saving(submitStub({ kind: 'uncertain' }));
    const check = buttonNamed(container, 'Check again');
    check.focus();
    await click(check);
    await flush();
    expect(buttonNamed(container, 'Check again')).toBe(check);
    expect(document.activeElement).toBe(check);
    expect(heading(container)).toBe('Save not confirmed');
    expect(
      container.querySelector('.cms-related-status')?.getAttribute('role'),
    ).toBe('alert');
  });
});

describe('an edit never lifts an unreconciled save', () => {
  it('[P2-S12-AC-271] commandState degraded: choosing an entry or a rule while the read runs keeps Save off and the pending label', async () => {
    let release: (response: Response) => void = () => undefined;
    const held = new Promise<Response>((resolve) => (release = resolve));
    vi.stubGlobal(
      'fetch',
      canonicalReads({
        [DRAFT_PATH]: () => held,
        [RULE_PATH]: () => noRuleAnswer(),
      }),
    );
    const container = await saving(submitStub({ kind: 'uncertain' }));
    expect(save(container).disabled).toBe(true);
    await click(buttonNamed(container, `Pin ${name(3)}`));
    await click(byLabel(container, /No derived rule/u));
    expect(save(container).disabled).toBe(true);
    expect(
      container.querySelector('.cms-related-status[role="status"]')
        ?.textContent,
    ).toBe('Checking whether the save went through…');
    release(draftAnswer('4'));
    await flush();
  });

  it('[P2-S12-AC-271] commandState degraded: choosing an entry after a read that did not verify keeps Save off and Check again offered', async () => {
    const { fetcher } = wire();
    vi.stubGlobal('fetch', fetcher);
    const container = await saving(submitStub({ kind: 'uncertain' }));
    await click(buttonNamed(container, `Pin ${name(3)}`));
    await click(byLabel(container, /No derived rule/u));
    expect(heading(container)).toBe('Save not confirmed');
    expect(save(container).disabled).toBe(true);
    buttonNamed(container, 'Check again');
    expect(listItems(container, 'ol.cms-related-rows')).toContain(id(3));
  });

  it('[P2-S12-AC-271] commandState degraded: once a read found the save not recorded, an edit clears the notice and Save is offered', async () => {
    vi.stubGlobal(
      'fetch',
      canonicalReads({
        [DRAFT_PATH]: () => draftAnswer('4'),
        [RULE_PATH]: () => noRuleAnswer(),
      }),
    );
    const container = await saving(submitStub({ kind: 'uncertain' }));
    expect(heading(container)).toBe('Save not recorded');
    await click(buttonNamed(container, `Pin ${name(3)}`));
    expect(heading(container)).toBe('');
    expect(save(container).disabled).toBe(false);
  });
});

describe('the success refetch never lowers the version', () => {
  it('[P2-S12-AC-271] commandState success: a refetch that answers an older entry token keeps the saved version, an equal one adopts it', async () => {
    vi.stubGlobal(
      'fetch',
      canonicalReads({
        [DRAFT_PATH]: () => draftAnswer('3'),
        [RULE_PATH]: () => matching('3'),
      }),
    );
    const older = await saving(
      submitStub({ kind: 'saved', saved: savedOf({ version: '5' }) }),
    );
    expect(heading(older)).toBe('Related content saved');
    expect(localVersion(older)).toBe('5');
  });
});
