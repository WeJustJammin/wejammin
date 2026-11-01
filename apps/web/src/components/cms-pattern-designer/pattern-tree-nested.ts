import type { EditableNode, EditableTree, MakeId } from './pattern-tree-state';

/** What a nested-pattern node is authored from: a chosen active version (DEC-196, `cmsPatternNestableRead`). */
export interface NestedPatternChoice {
  readonly patternId: string;
  readonly patternKey: string;
  readonly patternVersion: number;
}

/**
 * A new nested `pattern` node referencing the chosen version, keyed by its pattern key (both share one grammar), made
 * unique among `siblings` with a numeric suffix that never pushes the key past 64 characters.
 */
export const newPatternNode = (
  siblings: EditableTree,
  makeId: MakeId,
  choice: NestedPatternChoice,
): EditableNode => {
  const used = new Set(siblings.map((sibling) => sibling.key));
  let key = choice.patternKey;
  for (let number = 2; used.has(key); number += 1) {
    const suffix = `-${number}`;
    key = `${choice.patternKey.slice(0, 64 - suffix.length)}${suffix}`;
  }
  return {
    uiId: makeId(),
    kind: 'pattern',
    key,
    blockRef: '',
    propsText: '{}',
    patternId: choice.patternId,
    patternVersion: choice.patternVersion,
    children: [],
  };
};
