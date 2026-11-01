/*
 * The stable location identity of a render-plan node (BE05c "Document order").
 *
 * PostgreSQL `platform_private.cms_revision_render_plan` is the one derivation
 * of the document order and of these identities; the Worker never derives
 * either, it only names what it was handed:
 *
 *   a whole rich_text value      { kind: 'field', fieldId }
 *   a rich_text object property  { kind: 'field', fieldId, propertyKey }  (DEC-133, depth 1)
 *   a composition instance       { kind: 'block', pointer, blockKey, blockVersion }
 *
 * An identity holds ids, keys and a version only, never content, so it can sit
 * in a finding location and in the render-plan hash. `render-plan.test.ts` pins
 * the hash PostgreSQL computes over these identities.
 */

type FieldSource = Readonly<{
  kind: 'field';
  fieldId: string;
  propertyKey?: string | undefined;
}>;

type BlockSource = Readonly<{
  kind: 'block';
  pointer: string;
  blockKey: string;
  blockVersion: number;
}>;

export type RenderIdentity =
  | Readonly<{ kind: 'field'; fieldId: string; propertyKey?: string }>
  | BlockSource;

/** The identity of a node: the node without its payload. */
export const renderIdentityOf = (
  node: FieldSource | BlockSource,
): RenderIdentity => {
  if (node.kind === 'block')
    return {
      kind: 'block',
      pointer: node.pointer,
      blockKey: node.blockKey,
      blockVersion: node.blockVersion,
    };
  return node.propertyKey === undefined
    ? { kind: 'field', fieldId: node.fieldId }
    : { kind: 'field', fieldId: node.fieldId, propertyKey: node.propertyKey };
};

/** One string per location: equal exactly when two nodes address the same place. */
export const renderIdentityKey = (identity: RenderIdentity): string => {
  if (identity.kind === 'block') return `block:${identity.pointer}`;
  return identity.propertyKey === undefined
    ? `field:${identity.fieldId}`
    : `field:${identity.fieldId}#${identity.propertyKey}`;
};
