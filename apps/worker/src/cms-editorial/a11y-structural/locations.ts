import type { FindingLocation } from './findings';
import type { BlockNode } from './input-schema';

/*
 * Finding locations are RFC 6901 pointers into the revision values using the
 * stable field id and indexes (`/fields/{fieldId}/blocks/{i}/spans/{j}`), or
 * the block node's own composition pointer. A rich_text property of an object
 * field (DEC-133) adds its property key as the next segment
 * (`/fields/{fieldId}/{propertyKey}/blocks/{i}`), and `blockPath` is the
 * pointer inside the field's value. They are built only from ids, keys and
 * indexes, never from content, so a location can never carry author text.
 */

/** The field, and the property of an object field when the value is one. */
export type FieldReference = Readonly<{
  fieldId: string;
  propertyKey: string | null;
}>;

/** The pointer of the rich_text value inside the field's value; null for the whole value. */
const valuePath = (field: FieldReference): string | null =>
  field.propertyKey === null ? null : `/${field.propertyKey}`;

/** The whole rich_text value of a field or of one of its properties. */
export const fieldValueLocation = (field: FieldReference): FindingLocation => ({
  kind: 'field',
  pointer: `/fields/${field.fieldId}${valuePath(field) ?? ''}`,
  fieldId: field.fieldId,
  blockPath: valuePath(field),
});

/** One block of a rich_text value (a heading, for example). */
export const richTextBlockLocation = (
  field: FieldReference,
  blockIndex: number,
): FindingLocation => {
  const blockPath = `${valuePath(field) ?? ''}/blocks/${blockIndex}`;
  return {
    kind: 'field',
    pointer: `/fields/${field.fieldId}${blockPath}`,
    fieldId: field.fieldId,
    blockPath,
  };
};

/** One span of a rich_text block (a link, for example). */
export const richTextSpanLocation = (
  field: FieldReference,
  blockIndex: number,
  spanIndex: number,
): FindingLocation => {
  const block = richTextBlockLocation(field, blockIndex);
  return { ...block, pointer: `${block.pointer}/spans/${spanIndex}` };
};

/** A block instance, addressed by the composition pointer the input carries. */
export const blockNodeLocation = (node: BlockNode): FindingLocation => ({
  kind: 'block',
  pointer: node.pointer,
  fieldId: null,
  blockPath: node.pointer,
});
