// @vitest-environment jsdom
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

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
  noStrayRequests,
  refusal,
  settle,
} from './composition-page.test-support';
import { diffOf, id, propsPath, row } from './composition.test-support';
import { expectListRefetches } from './composition-refetch.test-support';

/*
 * FE03 1042 and 1048 (Slice 12 `diffState`, degraded: "The diff is never kept: it is re-required"; P2-S12-AC-117): when the
 * page's read of the diff is degraded after the diff was held, the held diff is dropped, none of its values or commands stay
 * on screen, and opening the update again reads the diff again.
 */
beforeAll(enableReactAct);
afterAll(disableReactAct);

const diff = diffOf(1, [propsPath('/a')]);
const diffResponse = () => json(diff, 200, `"${diff.instance.version}"`);
const conflict = () =>
  refusal(409, 'COMPOSITION_VERSION_CONFLICT', {
    reasonCode: 'diff_has_collisions',
  });
const radio = (container: HTMLElement) =>
  container.querySelector<HTMLInputElement>(
    'input[name="choice-/a"][value="yours"]',
  ) as HTMLInputElement;

describe('a diff whose later read is degraded', () => {
  it.each([
    ['unavailable', () => refusal(503, 'DEPENDENCY_UNAVAILABLE')],
    ['unverifiable', () => json({ not: 'a diff' }, 200, '"1"')],
  ])(
    'drops the held diff when the re-read after a conflict is %s, and reads it again on the next open',
    async (_label, degraded) => {
      const page = mountPage(
        {
          [diffPath(id(1))]: [diffResponse(), degraded(), diffResponse()],
          [UPDATE]: [conflict()],
          [ENTRY]: [entryDetail('11')],
        },
        { instances: [row(1, { state: 'pending_diff', version: '3' })] },
      );
      await click(buttonNamed(page.container, 'Review update for /main/row-1'));
      await settle();
      await click(radio(page.container));
      await click(buttonNamed(page.container, 'Accept update'));
      await settle();
      // The held diff is gone: no value, no choice and no accept or detach command of it remain.
      expect(page.container.querySelector('.cms-diff')).toBeNull();
      expect(page.container.querySelector('input[name^="choice-"]')).toBeNull();
      expect(() => buttonNamed(page.container, 'Accept update')).toThrow();
      expect(
        page.container.querySelector('.cms-composition-error'),
      ).not.toBeNull();
      // Opening the update again is a fresh read; nothing was cached.
      await click(buttonNamed(page.container, 'Review update for /main/row-1'));
      await settle();
      expect(
        page.calls.filter(
          (call) => call.method === 'GET' && call.path.endsWith('/update-diff'),
        ),
      ).toHaveLength(3);
      expect(page.container.querySelector('.cms-diff')).not.toBeNull();
      expect(radio(page.container).checked).toBe(false);
      expectListRefetches(page, 1);
      noStrayRequests(page.unexpected);
    },
  );
});
