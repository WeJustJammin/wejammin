// @vitest-environment jsdom
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  buttonNamed,
  click,
  disableReactAct,
  enableReactAct,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import {
  candidate,
  id,
  listItems,
  mount,
  text,
} from './related-content.test-support';

beforeAll(enableReactAct);
afterAll(disableReactAct);

const pins = (container: HTMLElement): string[] =>
  listItems(container, 'ol.cms-related-rows');
const exclusions = (container: HTMLElement): string[] =>
  listItems(container, 'ul.cms-related-rows');
const name = (n: number): string => `entry ${id(n).slice(-12)}`;

describe('CmsRelatedContentForm: the first render', () => {
  it('starts from an empty saved rule with the save control available', () => {
    const { container } = mount();
    expect(pins(container)).toEqual([]);
    expect(exclusions(container)).toEqual([]);
    expect(buttonNamed(container, 'Save related content').disabled).toBe(false);
    expect(text(container)).toContain('0 of 32 pins used');
    expect(text(container)).toContain('0 of 64 exclusions used');
  });

  it('states exclusions win beside the lists', () => {
    const { container } = mount();
    const section = container.querySelector(
      'section[aria-labelledby="cms-related-exclusions-heading"]',
    );
    expect(section?.textContent).toContain('Exclusions win.');
    expect(section?.textContent).toContain(
      'Excluding a pinned entry removes its pin.',
    );
  });

  it('lists only the entries it was given, never the source entry, one row each', () => {
    const { container } = mount();
    const rows = Array.from(
      container.querySelectorAll('table tbody th code'),
    ).map((code) => code.textContent);
    expect(rows).toEqual([id(1), id(2), id(3), id(4)]);
    expect(rows).not.toContain('018f0c45-73fe-7dc2-9c09-68f7ecf132dc');
  });

  it('offers a pin only for an active entry and an exclusion for every entry', () => {
    const { container } = mount();
    expect(() => buttonNamed(container, `Pin ${name(1)}`)).not.toThrow();
    expect(() => buttonNamed(container, `Pin ${name(4)}`)).toThrow();
    expect(() => buttonNamed(container, `Exclude ${name(4)}`)).not.toThrow();
  });
});

describe('CmsRelatedContentForm: pins', () => {
  it('pins in the order chosen and states each row choice in text', async () => {
    const { container } = mount();
    await click(buttonNamed(container, `Pin ${name(2)}`));
    await click(buttonNamed(container, `Pin ${name(1)}`));
    expect(pins(container)).toEqual([id(2), id(1)]);
    const choices = Array.from(
      container.querySelectorAll('table tbody tr'),
    ).map(
      (row) => row.querySelector('td[data-label="Chosen as"]')?.textContent,
    );
    expect(choices).toEqual([
      'Pinned, position 2',
      'Pinned, position 1',
      'Not chosen',
      'Not chosen',
    ]);
    expect(text(container)).toContain('2 of 32 pins used');
    expect(container.querySelector('.cms-related-live')?.textContent).toBe(
      'Pinned at position 2.',
    );
  });

  it('moves a pin up and down with explicit controls and announces the new position', async () => {
    const { container } = mount();
    for (const n of [1, 2, 3])
      await click(buttonNamed(container, `Pin ${name(n)}`));
    await click(buttonNamed(container, new RegExp(`^Move up ${name(3)}`, 'u')));
    expect(pins(container)).toEqual([id(1), id(3), id(2)]);
    expect(container.querySelector('.cms-related-live')?.textContent).toBe(
      'Moved to position 2 of 3.',
    );
    await click(
      buttonNamed(container, new RegExp(`^Move down ${name(1)}`, 'u')),
    );
    expect(pins(container)).toEqual([id(3), id(1), id(2)]);
  });

  it('disables Move up on the first pin and Move down on the last, and names the position', () => {
    const { container } = mount({
      rule: { pins: [id(1), id(2)], exclusions: [], derivedRule: null },
    });
    expect(
      buttonNamed(container, new RegExp(`^Move up ${name(1)}`, 'u')).disabled,
    ).toBe(true);
    expect(
      buttonNamed(container, new RegExp(`^Move down ${name(2)}`, 'u')).disabled,
    ).toBe(true);
    expect(
      buttonNamed(
        container,
        new RegExp(`^Move down ${name(1)}`, 'u'),
      ).getAttribute('aria-label'),
    ).toBe(`Move down ${name(1)}, now position 1 of 2`);
  });

  it('keeps focus on the moved row, on the same control while it stays available', async () => {
    const { container } = mount({
      rule: { pins: [id(1), id(2), id(3)], exclusions: [], derivedRule: null },
    });
    await click(buttonNamed(container, new RegExp(`^Move up ${name(3)}`, 'u')));
    expect(document.activeElement?.getAttribute('data-move')).toBe('up');
    expect(
      document.activeElement?.closest('li')?.getAttribute('data-entry-id'),
    ).toBe(id(3));
  });

  it('moves focus to the other control when the move reaches an end', async () => {
    const { container } = mount({
      rule: { pins: [id(1), id(2), id(3)], exclusions: [], derivedRule: null },
    });
    await click(buttonNamed(container, new RegExp(`^Move up ${name(2)}`, 'u')));
    expect(
      buttonNamed(container, new RegExp(`^Move up ${name(2)}`, 'u')).disabled,
    ).toBe(true);
    expect(document.activeElement?.getAttribute('data-move')).toBe('down');
    expect(
      document.activeElement?.closest('li')?.getAttribute('data-entry-id'),
    ).toBe(id(2));
  });

  it('keeps focus on the Move down control while the row can still move down', async () => {
    const { container } = mount({
      rule: { pins: [id(1), id(2), id(3)], exclusions: [], derivedRule: null },
    });
    await click(
      buttonNamed(container, new RegExp(`^Move down ${name(1)}`, 'u')),
    );
    expect(document.activeElement?.getAttribute('data-move')).toBe('down');
    expect(
      document.activeElement?.closest('li')?.getAttribute('data-entry-id'),
    ).toBe(id(1));
  });

  it('names the position on Move up as well as Move down', () => {
    const { container } = mount({
      rule: { pins: [id(1), id(2)], exclusions: [], derivedRule: null },
    });
    expect(
      buttonNamed(
        container,
        new RegExp(`^Move up ${name(2)}`, 'u'),
      ).getAttribute('aria-label'),
    ).toBe(`Move up ${name(2)}, now position 2 of 2`);
  });

  it('removes a pin and returns focus to the list heading', async () => {
    const { container } = mount({
      rule: { pins: [id(1), id(2)], exclusions: [], derivedRule: null },
    });
    await click(buttonNamed(container, `Remove pin ${name(1)}`));
    expect(pins(container)).toEqual([id(2)]);
    expect(document.activeElement?.id).toBe('cms-related-pins-heading');
  });

  it('stops at 32 pins: the 33rd cannot be chosen', async () => {
    const items = Array.from({ length: 34 }, (_, n) => candidate(n + 1));
    const { container } = mount({ candidates: { items, nextCursor: null } });
    for (let n = 1; n <= 32; n += 1)
      await click(buttonNamed(container, `Pin ${name(n)}`));
    expect(pins(container)).toHaveLength(32);
    expect(text(container)).toContain('32 of 32 pins used');
    expect(
      buttonNamed(container, `Pin ${name(33)}`).getAttribute('aria-disabled'),
    ).toBe('true');
    await click(buttonNamed(container, `Pin ${name(33)}`));
    expect(pins(container)).toHaveLength(32);
    expect(container.querySelector('.cms-related-live')?.textContent).toBe(
      'You can pin at most 32 entries.',
    );
  });
});

describe('CmsRelatedContentForm: exclusions win', () => {
  it('excludes an entry and removes its pin, saying so', async () => {
    const { container } = mount();
    await click(buttonNamed(container, `Pin ${name(1)}`));
    await click(buttonNamed(container, `Pin ${name(2)}`));
    await click(buttonNamed(container, `Exclude ${name(1)}`));
    expect(pins(container)).toEqual([id(2)]);
    expect(exclusions(container)).toEqual([id(1)]);
    expect(container.querySelector('.cms-related-live')?.textContent).toBe(
      'Excluded. Its pin was removed because exclusions win.',
    );
  });

  it('will not pin an excluded entry until the exclusion is removed', async () => {
    const { container } = mount();
    await click(buttonNamed(container, `Exclude ${name(1)}`));
    const pin = buttonNamed(container, `Pin ${name(1)}`);
    expect(pin.getAttribute('aria-disabled')).toBe('true');
    expect(
      buttonNamed(container, `Exclude ${name(1)}`).getAttribute(
        'aria-disabled',
      ),
    ).toBe('true');
    pin.focus();
    await click(pin);
    expect(pins(container)).toEqual([]);
    expect(document.activeElement).toBe(pin);
    expect(container.querySelector('.cms-related-live')?.textContent).toBe(
      'This entry is excluded. Remove the exclusion first, because exclusions win.',
    );
    await click(buttonNamed(container, `Remove exclusion ${name(1)}`));
    expect(document.activeElement?.id).toBe('cms-related-exclusions-heading');
    expect(
      buttonNamed(container, `Pin ${name(1)}`).getAttribute('aria-disabled'),
    ).toBe('false');
  });

  it('keeps focus on a Pin button that has just been used and says it is already pinned if used again', async () => {
    const { container } = mount();
    const pin = buttonNamed(container, `Pin ${name(1)}`);
    pin.focus();
    await click(pin);
    expect(document.activeElement).toBe(pin);
    await click(pin);
    expect(pins(container)).toEqual([id(1)]);
    expect(container.querySelector('.cms-related-live')?.textContent).toBe(
      'This entry is already pinned.',
    );
  });

  it('allows excluding an entry that is not active', async () => {
    const { container } = mount();
    await click(buttonNamed(container, `Exclude ${name(4)}`));
    expect(exclusions(container)).toEqual([id(4)]);
  });
});
