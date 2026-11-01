// @vitest-environment jsdom
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  buttonNamed,
  byLabel,
  choose,
  click,
  disableReactAct,
  enableReactAct,
  typeInto,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import {
  PLACE,
  UPDATE,
  diffPath,
  json,
  mountPage,
  settle,
} from './composition-page.test-support';
import {
  diffOf,
  id,
  propsPath,
  row,
  selectorItem,
} from './composition.test-support';

/*
 * FE03 Testing Obligations (Slice 12 governance): no diff value, canonical id or person id in the URL, storage, logs
 * or telemetry. The island keeps choices and rows in component state only and writes no history entry.
 */
beforeAll(enableReactAct);
afterAll(disableReactAct);

describe('composition island: no state outside the component', () => {
  it('leaves the URL, history, storage, cookies and console untouched through a full journey', async () => {
    const consoles = (['log', 'info', 'warn', 'error', 'debug'] as const).map(
      (level) => vi.spyOn(console, level).mockImplementation(() => undefined),
    );
    const href = window.location.href;
    const length = window.history.length;
    const cookie = document.cookie;
    const hero = selectorItem('hero-block', 2);
    const diff = diffOf(1, [propsPath('/secret-path')]);
    const page = mountPage(
      {
        [PLACE]: [
          json(
            {
              items: [
                row(5, {
                  path: '/main/hero',
                  patternVersion: 2,
                  state: 'draft',
                }),
              ],
            },
            201,
            '"10"',
          ),
        ],
        [diffPath(id(1))]: [json(diff, 200, '"3"')],
        [UPDATE]: [
          json(
            { items: [row(1, { version: '4', patternVersion: 2 })] },
            200,
            '"11"',
          ),
        ],
      },
      { instances: [row(1, { state: 'pending_diff', version: '3' })] },
    );

    await choose(
      byLabel<HTMLSelectElement>(page.container, 'Pattern'),
      hero.patternVersionId,
    );
    await click(byLabel<HTMLInputElement>(page.container, /^Linked/u));
    await typeInto(
      byLabel<HTMLTextAreaElement>(
        page.container,
        'Overrides (JSON, optional)',
      ),
      '{"/hero": {"secret": "value"}}',
    );
    await click(buttonNamed(page.container, 'Place pattern'));
    await settle();
    await click(buttonNamed(page.container, 'Review update for /main/row-1'));
    await settle();
    await click(
      page.container.querySelector<HTMLInputElement>(
        'input[name="choice-/secret-path"][value="yours"]',
      )!,
    );
    await click(buttonNamed(page.container, 'Accept update'));
    await settle();

    expect(window.location.href).toBe(href);
    expect(window.location.search).toBe('');
    expect(window.location.hash).toBe('');
    expect(window.history.length).toBe(length);
    expect(window.history.state).toBeNull();
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
    expect(document.cookie).toBe(cookie);
    expect(document.title).not.toContain('secret');
    for (const spy of consoles) expect(spy).not.toHaveBeenCalled();
    for (const call of page.calls)
      expect(
        call.search === '' || call.search.startsWith('?contentTypeId='),
      ).toBe(true);
    for (const spy of consoles) spy.mockRestore();
  });
});
