import { cmsJsonEqual } from '@wejammin/contracts/client';

import type {
  Choice,
  ChoiceMap,
  DiffPath,
  UpdateDiff,
} from './composition-types';

type CollisionKind = NonNullable<DiffPath['collisionKind']>;

/**
 * The fixed copy of each collision kind and of its two answers (FE03 887; DEC-193). Keeping mine on a `structure` or a
 * `removed_root` collision names its consequence before the command: the block becomes a local copy that no longer
 * receives updates.
 */
export const COLLISION_COPY: Readonly<
  Record<CollisionKind, { legend: string; yours: string; theirs: string }>
> = {
  props: {
    legend: 'Text changed in the pattern',
    yours: 'Keep my override',
    theirs: 'Take the new value',
  },
  structure: {
    legend: "The pattern changed this block's type or its sub-blocks",
    yours:
      'Keep mine: the block becomes a local copy that no longer receives updates',
    theirs: 'Take the new structure',
  },
  removed_root: {
    legend: 'The pattern no longer has this block',
    yours:
      'Keep it: the block becomes a local copy that no longer receives updates',
    theirs: 'Remove it from the entry',
  },
};

export const collisions = (diff: UpdateDiff): DiffPath[] =>
  diff.paths.filter((entry) => entry.collision);

/** The first collision, in diff order, that has no answer yet; nothing is ever preselected. */
export const firstUnanswered = (
  diff: UpdateDiff,
  choices: ChoiceMap,
): string | null =>
  collisions(diff).find((entry) => choices[entry.path] === undefined)?.path ??
  null;

export const isComplete = (diff: UpdateDiff, choices: ChoiceMap): boolean =>
  firstUnanswered(diff, choices) === null;

/** The request `choices`: one per collision in diff order, and none for a path that merely changed. */
export const choicesFor = (
  diff: UpdateDiff,
  choices: ChoiceMap,
): Array<{ path: string; choice: Choice }> =>
  collisions(diff).flatMap((entry) => {
    const choice = choices[entry.path];
    return choice === undefined ? [] : [{ path: entry.path, choice }];
  });

const sameCollision = (before: DiffPath, after: DiffPath): boolean =>
  after.collision &&
  before.collisionKind === after.collisionKind &&
  cmsJsonEqual(before.base, after.base) &&
  cmsJsonEqual(before.theirs, after.theirs) &&
  cmsJsonEqual(before.yours, after.yours);

/** A refetched diff keeps an answer only for a path that is the same collision with the same three values. */
export const retainChoices = (
  previous: UpdateDiff,
  next: UpdateDiff,
  choices: ChoiceMap,
): ChoiceMap => {
  const kept: Record<string, Choice> = {};
  for (const [path, choice] of Object.entries(choices)) {
    const before = previous.paths.find((entry) => entry.path === path);
    const after = next.paths.find((entry) => entry.path === path);
    if (
      before !== undefined &&
      after !== undefined &&
      sameCollision(before, after)
    )
      kept[path] = choice;
  }
  return kept;
};
