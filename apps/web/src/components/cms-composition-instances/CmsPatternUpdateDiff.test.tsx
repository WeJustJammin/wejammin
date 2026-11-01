// @vitest-environment jsdom
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  buttonNamed,
  click,
  disableReactAct,
  enableReactAct,
  mountElement,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import CmsPatternUpdateDiff from './CmsPatternUpdateDiff';
import type { ChoiceMap, UpdateDiff } from './composition-types';
import {
  diffOf,
  plainPath,
  propsPath,
  removedPath,
  structurePath,
} from './composition.test-support';

/*
 * FE03 887, 1115, 2708; P2-S12-AC-117: the three-way diff, each collision marked by kind with a radio pair that is
 * never preselected, fixed consequence copy, the new-in-this-version list with its Place command, and the focus on the
 * first unanswered collision.
 */
beforeAll(enableReactAct);
afterAll(disableReactAct);

const mount = (
  diff: UpdateDiff,
  props: Partial<React.ComponentProps<typeof CmsPatternUpdateDiff>> = {},
) => {
  const handlers = {
    onChoose: vi.fn(),
    onAccept: vi.fn(),
    onDetach: vi.fn(),
    onPlaceNewRoots: vi.fn(),
  };
  const mounted = mountElement(
    <CmsPatternUpdateDiff
      diff={diff}
      choices={{}}
      busy={false}
      disabled={false}
      {...handlers}
      {...props}
    />,
  );
  return { ...mounted, ...handlers };
};
const radios = (container: HTMLElement, path: string) =>
  Array.from(
    container.querySelectorAll<HTMLInputElement>(
      `input[type="radio"][name="choice-${path}"]`,
    ),
  );
const all = diffOf(1, [
  propsPath('/a'),
  plainPath('/b'),
  structurePath('/c'),
  removedPath('/d'),
]);

describe('CmsPatternUpdateDiff: the three-way list', () => {
  it('lists base, theirs and yours per path, each node value as its block, props and sub-blocks', () => {
    const { container } = mount(all);
    const items = container.querySelectorAll('ul.cms-diff-paths > li');
    expect(items).toHaveLength(4);
    const first = items[0]!.textContent ?? '';
    expect(first).toContain('/a');
    expect(first).toContain('Base (pinned version)');
    expect(first).toContain('Theirs (new version)');
    expect(first).toContain('Yours (your override)');
    expect(first).toContain('profile.header version 1');
    expect(first).toContain('"text":"a"');
    expect(first).toContain('"text":"b"');
    expect(first).toContain('"text":"mine"');
    const structure = items[2]!.textContent ?? '';
    expect(structure).toContain('/body/one');
    expect(structure).toContain('/body/two');
    expect(structure).toContain('profile.footer version 1');
  });

  it('states an absent node and a missing override in words', () => {
    const { container } = mount(diffOf(1, [removedPath('/d')]));
    const text = container.textContent ?? '';
    expect(text).toContain('Not in the new version');
    expect(text).toContain('No local override');
  });

  it('announces the number of changed paths and collisions politely', () => {
    const { container } = mount(all);
    const status = container.querySelector('[data-diff-count]');
    expect(status?.getAttribute('aria-live')).toBe('polite');
    expect(status?.textContent).toBe('4 changed paths, 3 collisions');
  });
});

describe('CmsPatternUpdateDiff: collisions and choices', () => {
  it('marks each collision by kind with its fixed legend and shows a plain change without choices', () => {
    const { container } = mount(all);
    const text = container.textContent ?? '';
    expect(text).toContain('Text changed in the pattern');
    expect(text).toContain(
      "The pattern changed this block's type or its sub-blocks",
    );
    expect(text).toContain('The pattern no longer has this block');
    expect(radios(container, '/b')).toHaveLength(0);
    expect(container.querySelectorAll('fieldset')).toHaveLength(3);
  });

  it('never preselects: two radios per collision, none checked', () => {
    const { container } = mount(all);
    for (const path of ['/a', '/c', '/d']) {
      const pair = radios(container, path);
      expect(pair.map((radio) => radio.value)).toEqual(['yours', 'theirs']);
      expect(pair.every((radio) => !radio.checked)).toBe(true);
    }
  });

  it('names the consequence of keeping mine before the command', () => {
    const { container } = mount(all);
    const labels = (path: string) =>
      radios(container, path).map(
        (radio) => radio.closest('label')?.textContent,
      );
    expect(labels('/a')).toEqual(['Keep my override', 'Take the new value']);
    expect(labels('/c')[0]).toMatch(
      /local copy that no longer receives updates/u,
    );
    expect(labels('/d')).toEqual([
      expect.stringMatching(/local copy that no longer receives updates/u),
      'Remove it from the entry',
    ]);
  });

  it('reports the chosen answer and renders the held choices as checked', async () => {
    const choices: ChoiceMap = { '/c': 'theirs' };
    const { container, onChoose } = mount(all, { choices });
    expect(radios(container, '/c').map((radio) => radio.checked)).toEqual([
      false,
      true,
    ]);
    await click(radios(container, '/a')[0]!);
    expect(onChoose).toHaveBeenCalledWith('/a', 'yours');
  });
});

describe('CmsPatternUpdateDiff: Accept and the first unanswered collision', () => {
  it('does not send while a collision is unanswered: it names the count and focuses the first one', async () => {
    const { container, onAccept } = mount(all, { choices: { '/a': 'yours' } });
    await click(buttonNamed(container, 'Accept update'));
    expect(onAccept).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      '2 collisions need an answer before this update can be accepted.',
    );
    expect(document.activeElement).toBe(radios(container, '/c')[0]);
  });

  it('sends once every collision has an answer', async () => {
    const { container, onAccept } = mount(all, {
      choices: { '/a': 'yours', '/c': 'theirs', '/d': 'yours' },
    });
    await click(buttonNamed(container, 'Accept update'));
    expect(onAccept).toHaveBeenCalledTimes(1);
  });

  it('states that an unanswered update leaves the instance on its pinned version and accepts nothing automatically', () => {
    const { container } = mount(all);
    expect(container.textContent).toContain(
      'An unanswered update leaves this instance on its pinned version. Nothing is accepted automatically.',
    );
  });

  it('detaches with the consequence stated', async () => {
    const { container, onDetach } = mount(all);
    expect(container.textContent).toContain('no longer receives updates');
    await click(buttonNamed(container, 'Detach as a local copy'));
    expect(onDetach).toHaveBeenCalledTimes(1);
  });

  it('disables both commands while busy or unavailable', () => {
    const busy = mount(all, { busy: true });
    expect(buttonNamed(busy.container, 'Accept update').disabled).toBe(true);
    expect(buttonNamed(busy.container, 'Detach as a local copy').disabled).toBe(
      true,
    );
    const off = mount(all, { disabled: true });
    expect(buttonNamed(off.container, 'Accept update').disabled).toBe(true);
  });
});

describe('CmsPatternUpdateDiff: other diff states', () => {
  it('shows the no-update state when the instance has no newer compatible version', () => {
    const none = diffOf(1, [], {
      targetPatternVersion: 1,
      bulkEligible: false,
    });
    const { container } = mount(none);
    expect(container.textContent).toContain(
      'No newer compatible pattern version',
    );
    const accept = buttonNamed(container, 'Accept update');
    expect(accept.disabled).toBe(true);
    expect(
      document.getElementById(accept.getAttribute('aria-describedby') ?? '')
        ?.textContent,
    ).toBe('No newer compatible pattern version.');
    expect(buttonNamed(container, 'Detach as a local copy').disabled).toBe(
      false,
    );
  });

  it('shows "No changes to this block" with a plain accept when a newer version changes none of the paths', async () => {
    const same = diffOf(1, [], { targetPatternVersion: 2 });
    const { container, onAccept } = mount(same);
    expect(container.textContent).toContain('No changes to this block');
    await click(buttonNamed(container, 'Accept update'));
    expect(onAccept).toHaveBeenCalledTimes(1);
  });
});

describe('CmsPatternUpdateDiff: new in this version', () => {
  const withRoots = diffOf(1, [plainPath('/n')], {
    newRoots: [
      { rootPath: '/extra', blockKey: 'profile.header', blockVersion: 2 },
      { rootPath: '/shared/more', blockKey: 'profile.footer', blockVersion: 1 },
    ],
  });

  it('lists the new roots with a polite count and says accepting never adds them', () => {
    const { container } = mount(withRoots);
    const section = container.querySelector(
      'section[aria-labelledby="cms-diff-new-roots-heading"]',
    );
    expect(section?.textContent).toContain('New in this version');
    expect(section?.textContent).toContain(
      'Accepting the update never adds these blocks.',
    );
    expect(section?.querySelector('[role="status"]')?.textContent).toBe(
      '2 new blocks',
    );
    expect(
      Array.from(section!.querySelectorAll('li code')).map(
        (c) => c.textContent,
      ),
    ).toEqual(['/extra', '/shared/more']);
  });

  it('places only the chosen roots through the Place command', async () => {
    const { container, onPlaceNewRoots } = mount(withRoots);
    expect(buttonNamed(container, 'Place selected blocks').disabled).toBe(true);
    const boxes = container.querySelectorAll<HTMLInputElement>(
      'section input[type="checkbox"]',
    );
    await click(boxes[1]!);
    await click(buttonNamed(container, 'Place selected blocks'));
    expect(onPlaceNewRoots).toHaveBeenCalledWith(['/shared/more']);
  });

  it('shows no new-roots section when the diff has none', () => {
    const { container } = mount(all);
    expect(container.textContent).not.toContain('New in this version');
  });
});
