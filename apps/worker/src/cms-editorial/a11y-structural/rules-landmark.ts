import {
  NO_POSITION,
  type FindingCollector,
  type RenderPosition,
} from './findings';
import type { BlockNode } from './input-schema';
import { blockNodeLocation } from './locations';
import { normalizeIdentity } from './text';

/**
 * BE05c landmark group over the block instances in render order.
 *
 * `landmark.name_missing`: the manifest requires a name (nameRequired true)
 * and the instance lacks an accessibleName of 1 to 160 characters after
 * trimming. If the manifest defines no accessibleName short_text field at all,
 * every instance fails: a registry defect fails closed.
 *
 * `landmark.name_duplicate` (warning): two or more instances of the same
 * blockKey share a normalized accessibleName. Every member of such a group is
 * flagged, so the result does not depend on which instance came first. The
 * input carries no separate landmark flag, so each instance with a usable name
 * takes part, whether or not its manifest requires one.
 */

const NAME_MAX_CHARACTERS = 160;
/** blockKey is `[a-z0-9._-]`, so NUL cannot occur and the group key is unambiguous. */
const GROUP_SEPARATOR = '\u0000';

type NamedInstance = Readonly<{ node: BlockNode; position: RenderPosition }>;

const hasValidName = (node: BlockNode): boolean => {
  if (!node.accessibleNameFieldDefined || node.accessibleName === null)
    return false;
  const trimmed = node.accessibleName.trim();
  return (
    trimmed.length > 0 && Array.from(trimmed).length <= NAME_MAX_CHARACTERS
  );
};

export type LandmarkRule = Readonly<{
  evaluate: (node: BlockNode, nodeIndex: number) => void;
  /** Call once after the last block: raises the duplicate-name warnings. */
  finish: () => void;
}>;

export const createLandmarkRule = (
  collector: FindingCollector,
): LandmarkRule => {
  const groups = new Map<string, NamedInstance[]>();
  return {
    evaluate: (node, nodeIndex) => {
      const position: RenderPosition = [nodeIndex, NO_POSITION, NO_POSITION];
      if (node.nameRequired && !hasValidName(node))
        collector.add(
          'landmark.name_missing',
          blockNodeLocation(node),
          position,
        );
      const identity =
        node.accessibleName === null
          ? ''
          : normalizeIdentity(node.accessibleName);
      if (identity === '') return;
      const key = `${node.blockKey}${GROUP_SEPARATOR}${identity}`;
      groups.set(key, [...(groups.get(key) ?? []), { node, position }]);
    },
    finish: () => {
      for (const members of groups.values()) {
        if (members.length < 2) continue;
        for (const { node, position } of members)
          collector.add(
            'landmark.name_duplicate',
            blockNodeLocation(node),
            position,
          );
      }
    },
  };
};
