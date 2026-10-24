// @vitest-environment jsdom
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  buttonNamed,
  click,
  disableReactAct,
  enableReactAct,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import { TARGET_REFUSED_MESSAGE } from './related-content-copy';
import { submitRelatedContent } from './related-content-submit';
import { error, throughProxy } from './related-content-submit.test-support';
import { id, mount } from './related-content.test-support';

beforeAll(enableReactAct);
afterAll(disableReactAct);

/*
 * FE03 :890, :2665, :2678 through the REAL chain: form -> browser transport -> same-origin proxy ->
 * (stubbed Worker answer). The earlier refusal tests inject the outcome after the proxy; these prove the
 * offending row is marked from what the proxy actually relays (BE03c 385-387, 1417).
 */
const name = (n: number): string => `entry ${id(n).slice(-12)}`;
const mountThrough = (upstream: () => Response) =>
  mount({
    csrfToken: 'csrf-1',
    submit: (request, csrfToken, key) =>
      submitRelatedContent(request, csrfToken, key, throughProxy(upstream)),
  });
const choose = async (container: HTMLElement): Promise<void> => {
  await click(buttonNamed(container, `Pin ${name(1)}`));
  await click(buttonNamed(container, `Pin ${name(2)}`));
  await click(buttonNamed(container, `Exclude ${name(3)}`));
  await click(buttonNamed(container, 'Save related content'));
};
const marked = (container: HTMLElement): string[] =>
  Array.from(container.querySelectorAll('.cms-related-rows > li'))
    .filter((row) => row.querySelector('.cms-related-refusal') !== null)
    .map((row) => row.querySelector('code')?.textContent ?? '');
const heading = (container: HTMLElement): string =>
  container.querySelector('#cms-related-result-heading')?.textContent ?? '';

describe('an ineligible target relayed by the real proxy', () => {
  it('marks exactly the pin and the exclusion the Worker pointers name, with the one fixed message', async () => {
    const { container } = mountThrough(() =>
      error(422, {
        reasonCode: 'related_target_ineligible',
        violations: [
          { path: '/pins/1', code: 'related_target_ineligible' },
          { path: '/exclusions/0', code: 'related_target_ineligible' },
        ],
      }),
    );
    await choose(container);
    expect(marked(container)).toEqual([id(2), id(3)]);
    expect(
      Array.from(container.querySelectorAll('.cms-related-refusal')).map(
        (node) => node.textContent,
      ),
    ).toEqual([TARGET_REFUSED_MESSAGE, TARGET_REFUSED_MESSAGE]);
    expect(heading(container)).toBe('Some entries cannot be used');
  });

  it('names the unavailable rule from the relayed derived_rule_unknown', async () => {
    const { container } = mountThrough(() =>
      error(422, {
        reasonCode: 'derived_rule_unknown',
        violations: [
          { path: '/derivedRule/key', code: 'derived_rule_unknown' },
        ],
      }),
    );
    await choose(container);
    expect(heading(container)).toBe('That rule is not available');
    expect(marked(container)).toEqual([]);
  });

  it('shows the plain failure, and marks no row, when the Worker sent an untyped 422', async () => {
    const { container } = mountThrough(() =>
      error(422, { violations: [{ path: '/pins/0', code: 'invalid_value' }] }),
    );
    await choose(container);
    expect(marked(container)).toEqual([]);
    expect(heading(container)).toBe('Could not save');
  });
});
