import { describe, expect, it } from 'vitest';

import {
  COLLISION_COPY,
  choicesFor,
  collisions,
  firstUnanswered,
  isComplete,
  retainChoices,
} from './composition-choices';
import {
  diffOf,
  plainPath,
  propsPath,
  removedPath,
  structurePath,
} from './composition.test-support';

/*
 * The per-collision choice rules (FE03 887, 1115, 2708; DEC-193): a choice is never preselected, every collision of
 * each kind needs one, and a choice survives a refetch only for a path whose three values did not change.
 */
const diff = diffOf(1, [
  propsPath('/a'),
  plainPath('/b'),
  structurePath('/c'),
  removedPath('/d'),
]);

describe('collisions and the first unanswered one', () => {
  it('lists only the colliding paths, in diff order, and never preselects an answer', () => {
    expect(collisions(diff).map((entry) => entry.path)).toEqual([
      '/a',
      '/c',
      '/d',
    ]);
    expect(firstUnanswered(diff, {})).toBe('/a');
    expect(isComplete(diff, {})).toBe(false);
  });

  it('moves the first unanswered collision as answers arrive and completes at the last', () => {
    expect(firstUnanswered(diff, { '/a': 'yours' })).toBe('/c');
    expect(firstUnanswered(diff, { '/a': 'yours', '/c': 'theirs' })).toBe('/d');
    const all = { '/a': 'yours', '/c': 'theirs', '/d': 'yours' } as const;
    expect(firstUnanswered(diff, all)).toBeNull();
    expect(isComplete(diff, all)).toBe(true);
  });

  it('is complete with no choice when nothing collides', () => {
    const clean = diffOf(2, [plainPath('/x')]);
    expect(isComplete(clean, {})).toBe(true);
    expect(choicesFor(clean, {})).toEqual([]);
  });
});

describe('choicesFor: the request choices cover exactly the collisions', () => {
  it('sends a choice for every collision in diff order and none for a plain change', () => {
    const picks = {
      '/a': 'yours',
      '/b': 'theirs',
      '/c': 'theirs',
      '/d': 'yours',
    } as const;
    expect(choicesFor(diff, picks)).toEqual([
      { path: '/a', choice: 'yours' },
      { path: '/c', choice: 'theirs' },
      { path: '/d', choice: 'yours' },
    ]);
  });

  it('ignores a stale choice for a path the diff no longer lists', () => {
    expect(
      choicesFor(diff, {
        '/gone': 'yours',
        '/a': 'theirs',
        '/c': 'theirs',
        '/d': 'theirs',
      }),
    ).toHaveLength(3);
  });
});

describe('retainChoices: choices are kept across a refetch only for unchanged paths', () => {
  const picks = { '/a': 'yours', '/c': 'theirs', '/d': 'yours' } as const;

  it('keeps every choice when the refetched diff is identical', () => {
    expect(retainChoices(diff, structuredClone(diff), picks)).toEqual(picks);
  });

  it('drops the choice of a path whose yours, base or kind changed, and keeps an untouched one', () => {
    const changed = structuredClone(diff);
    changed.paths[0] = {
      ...propsPath('/a'),
      yours: { text: 'edited elsewhere' },
    };
    changed.paths[3] = { ...removedPath('/d'), base: null };
    expect(retainChoices(diff, changed, picks)).toEqual({ '/c': 'theirs' });
  });

  it('drops the choice of a path whose target value changed or whose kind changed', () => {
    const changed = structuredClone(diff);
    changed.paths[2] = {
      ...structurePath('/c'),
      collisionKind: 'removed_root',
      theirs: null,
    };
    changed.paths[0] = {
      ...propsPath('/a'),
      theirs: { ...propsPath('/a').theirs!, props: { text: 'c' } },
    };
    expect(retainChoices(diff, changed, picks)).toEqual({ '/d': 'yours' });
  });

  it('drops the choice of a path that vanished from the refetched diff', () => {
    const vanished = structuredClone(diff);
    vanished.paths.splice(0, 1);
    expect(retainChoices(diff, vanished, picks)).toEqual({
      '/c': 'theirs',
      '/d': 'yours',
    });
  });

  it('drops the choice of a path that stopped colliding', () => {
    const resolved = structuredClone(diff);
    resolved.paths[0] = {
      ...propsPath('/a'),
      collision: false,
      collisionKind: null,
    };
    expect(retainChoices(diff, resolved, picks)).not.toHaveProperty('/a');
  });
});

describe('fixed collision copy (DEC-193)', () => {
  it('names each kind and the consequence of keeping mine', () => {
    expect(COLLISION_COPY.props.legend).toBe('Text changed in the pattern');
    expect(COLLISION_COPY.props.yours).toBe('Keep my override');
    expect(COLLISION_COPY.props.theirs).toBe('Take the new value');
    expect(COLLISION_COPY.structure.legend).toBe(
      "The pattern changed this block's type or its sub-blocks",
    );
    expect(COLLISION_COPY.structure.yours).toMatch(
      /local copy that no longer receives updates/u,
    );
    expect(COLLISION_COPY.structure.theirs).toBe('Take the new structure');
    expect(COLLISION_COPY.removed_root.legend).toBe(
      'The pattern no longer has this block',
    );
    expect(COLLISION_COPY.removed_root.yours).toMatch(
      /local copy that no longer receives updates/u,
    );
    expect(COLLISION_COPY.removed_root.theirs).toBe('Remove it from the entry');
  });
});
