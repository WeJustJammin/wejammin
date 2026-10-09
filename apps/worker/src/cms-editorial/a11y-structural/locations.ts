import type { FindingLocation } from './findings';
import type { BlockNode } from './input-schema';

/*
 * Finding locations are RFC 6901 pointers into the revision values using the
 * stable field id and indexes (`/fields/{fieldId}/blocks/{i}/spans/{j}`), or
 * the block node's own composition pointer. They are built only from ids and
 * indexes, never from content, so a location can never carry author text.
 */

const fieldPointer = (fieldId: string): string => `/fields/${fieldId}`;

/** The whole rich_text value of a field. */
export const fieldValueLocation = (fieldId: string): FindingLocation => ({
  kind: 'field',
  pointer: fieldPointer(fieldId),
  fieldId,
  blockPath: null,
});

/** One block of a rich_text value (a heading, for example). */
export const richTextBlockLocation = (
  fieldId: string,
  blockIndex: number,
): FindingLocation => {
  const blockPath = `/blocks/${blockIndex}`;
  return {
    kind: 'field',
    pointer: `${fieldPointer(fieldId)}${blockPath}`,
    fieldId,
    blockPath,
  };
};

/** One span of a rich_text block (a link, for example). */
export const richTextSpanLocation = (
  fieldId: string,
  blockIndex: number,
  spanIndex: number,
): FindingLocation => {
  const block = richTextBlockLocation(fieldId, blockIndex);
  return { ...block, pointer: `${block.pointer}/spans/${spanIndex}` };
};

/** A block instance, addressed by the composition pointer the input carries. */
export const blockNodeLocation = (node: BlockNode): FindingLocation => ({
  kind: 'block',
  pointer: node.pointer,
  fieldId: null,
  blockPath: node.pointer,
});
