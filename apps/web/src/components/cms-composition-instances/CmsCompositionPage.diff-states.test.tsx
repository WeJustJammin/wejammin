// @vitest-environment jsdom
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
  click,
  disableReactAct,
  enableReactAct,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import {
  ENTRY,
  UPDATE,
  diffPath,
  entryDetail,
  json,
  mountPage,
  refusal,
  settle,
} from './composition-page.test-support';
import { diffOf, id, propsPath, row } from './composition.test-support';
import { expectListRefetches } from './composition-refetch.test-support';

/**
 * [P2-S12-AC-271] FE03 1042 to 1048, `diffState` (CMS-03C-14), the seven states of the state table in
 * order: idle, loading, success, empty, error, degraded, disabled. Each cell is one test over the real
 * composition island.
 */
beforeAll(enableReactAct);
afterAll(disableReactAct);
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const open = async (page: ReturnType<typeof mountPage>) => {
  await click(buttonNamed(page.container, 'Review update for /main/row-1'));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
  await settle();
};
const pending = () => [row(1, { state: 'pending_diff', version: '3' })];
const diff = diffOf(1, [propsPath('/a')]);
const reply = (value = diff) => json(value, 200, `"${value.instance.version}"`);
const offered = (container: HTMLElement, name: string): boolean => {
  try {
    return !buttonNamed(container, name).disabled;
  } catch {
    return false;
  }
};

describe('diffState (CMS-03C-14)', () => {
  it('[P2-S12-AC-271] diffState idle: no pending_diff instance selected renders no diff and reads nothing', () => {
    const page = mountPage({}, { instances: pending() });
    expect(page.container.textContent).toContain('Update available');
    expect(page.container.querySelector('.cms-diff')).toBeNull();
    expect(page.container.querySelector('.cms-loading-region')).toBeNull();
    expect(page.calls).toEqual([]);
  });

  it('[P2-S12-AC-271] diffState loading: a skeleton after 250 ms (not before) and no enabled accept or detach for the diff', async () => {
    let answer: (value: Response) => void = () => undefined;
    const held = new Promise<Response>((resolve) => (answer = resolve));
    const page = mountPage(
      { [diffPath(id(1))]: [(() => held) as unknown as () => Response] },
      { instances: pending() },
    );
    await click(buttonNamed(page.container, 'Review update for /main/row-1'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(249);
    });
    expect(page.container.querySelector('.cms-loading-region')).toBeNull();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(
      page.container.querySelector('.cms-loading-region')?.textContent,
    ).toContain('Reading the update');
    expect(offered(page.container, 'Accept update')).toBe(false);
    expect(offered(page.container, 'Detach as a local copy')).toBe(false);
    await act(async () => {
      answer(reply());
      await vi.advanceTimersByTimeAsync(0);
    });
  });

  it('[P2-S12-AC-271] diffState success: a 200 diff states its paths and collisions, and a version that changes no path shows "No changes to this block" with its new roots and an accept', async () => {
    const page = mountPage(
      { [diffPath(id(1))]: [reply()] },
      { instances: pending() },
    );
    await open(page);
    expect(page.container.querySelector('[data-diff-count]')?.textContent).toBe(
      '1 changed path, 1 collision',
    );
    const unchanged = diffOf(1, [], {
      newRoots: [
        { rootPath: '/new-root', blockKey: 'profile.header', blockVersion: 1 },
      ],
    });
    const second = mountPage(
      { [diffPath(id(1))]: [reply(unchanged)] },
      { instances: pending() },
    );
    await open(second);
    expect(second.container.textContent).toContain('No changes to this block');
    expect(second.container.textContent).toContain('1 new block');
    expect(second.container.textContent).toContain('/new-root');
    expect(offered(second.container, 'Accept update')).toBe(true);
  });

  it('[P2-S12-AC-271] diffState empty: an instance with no newer compatible version shows no-update', async () => {
    const none = diffOf(1, [], {
      targetPatternVersion: 1,
      bulkEligible: false,
    });
    const page = mountPage(
      { [diffPath(id(1))]: [reply(none)] },
      { instances: pending() },
    );
    await open(page);
    expect(page.container.textContent).toContain(
      'No newer compatible pattern version',
    );
    expect(page.container.querySelector('[data-diff-count]')).toBeNull();
  });

  it.each([
    [
      '422 diff_too_large renders the typed refusal',
      () =>
        refusal(422, 'COMPOSITION_VALIDATION_FAILED', {
          reasonCode: 'diff_too_large',
        }),
      'too large to compare here',
    ],
    [
      'a 404 renders the fixed not-available copy',
      () => refusal(404, 'COMPOSITION_NOT_FOUND'),
      'not available to this account',
    ],
    [
      'a 403 renders the fixed capability copy',
      () => refusal(403, 'COMPOSITION_FORBIDDEN'),
      'cannot edit the composition',
    ],
  ])(
    '[P2-S12-AC-271] diffState error: %s and offers no accept',
    async (_label, answer, copy) => {
      const page = mountPage(
        { [diffPath(id(1))]: [answer()] },
        { instances: pending() },
      );
      await open(page);
      expect(page.container.textContent).toContain(copy);
      expect(page.container.querySelector('.cms-diff')).toBeNull();
      expect(offered(page.container, 'Accept update')).toBe(false);
    },
  );

  it('[P2-S12-AC-271] diffState degraded: a diff whose later read is unavailable is never kept, and is read again on the next open', async () => {
    const page = mountPage(
      {
        [diffPath(id(1))]: [
          reply(),
          refusal(503, 'DEPENDENCY_UNAVAILABLE'),
          reply(),
        ],
        [UPDATE]: [
          refusal(409, 'COMPOSITION_VERSION_CONFLICT', {
            reasonCode: 'diff_has_collisions',
          }),
        ],
        [ENTRY]: [entryDetail('11')],
      },
      { instances: pending() },
    );
    await open(page);
    await click(
      page.container.querySelector<HTMLInputElement>(
        'input[name="choice-/a"][value="yours"]',
      )!,
    );
    await click(buttonNamed(page.container, 'Accept update'));
    await settle();
    expect(page.container.querySelector('.cms-diff')).toBeNull();
    expect(page.container.querySelector('input[name^="choice-"]')).toBeNull();
    await open(page);
    expect(page.container.querySelector('.cms-diff')).not.toBeNull();
    expect(
      page.calls.filter((call) => call.path.endsWith('/update-diff')),
    ).toHaveLength(3);
    expectListRefetches(page, 1);
  });

  it('[P2-S12-AC-271] diffState disabled: the accept control is off and its description names the unavailable newer version', async () => {
    const none = diffOf(1, [], {
      targetPatternVersion: 1,
      bulkEligible: false,
    });
    const page = mountPage(
      { [diffPath(id(1))]: [reply(none)] },
      { instances: pending() },
    );
    await open(page);
    const accept = buttonNamed(page.container, 'Accept update');
    expect(accept.disabled).toBe(true);
    const describedBy = accept.getAttribute('aria-describedby');
    expect(describedBy).not.toBeNull();
    expect(document.getElementById(describedBy ?? '')?.textContent).toBe(
      'No newer compatible pattern version.',
    );
  });
});
