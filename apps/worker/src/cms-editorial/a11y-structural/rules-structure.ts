import {
  validateRichTextV1,
  type RichTextV1Document,
} from '@wejammin/contracts';

import { NO_POSITION, type FindingCollector } from './findings';
import type { AccessibilityNode } from './input-schema';
import { blockNodeLocation, fieldValueLocation } from './locations';

/**
 * BE05c structure group, evaluated first. A rich_text value is validated with
 * the shared rich_text.v1 validator (DEC-112); a failing value yields
 * `structure.rich_text_invalid` and the field is skipped by the heading and
 * link groups. A block that is withdrawn or absent from the registry yields
 * `structure.block_unregistered`.
 */

/** A rich_text field whose value passed the shared validator. */
export type ParsedField = Readonly<{
  nodeIndex: number;
  fieldId: string;
  document: RichTextV1Document;
}>;

export const evaluateStructure = (
  node: AccessibilityNode,
  nodeIndex: number,
  collector: FindingCollector,
): ParsedField | null => {
  const position = [nodeIndex, NO_POSITION, NO_POSITION] as const;
  if (node.kind === 'block') {
    if (node.lifecycle === 'withdrawn' || node.lifecycle === 'unregistered')
      collector.add(
        'structure.block_unregistered',
        blockNodeLocation(node),
        position,
      );
    return null;
  }
  const verdict = validateRichTextV1(node.value);
  if (verdict.ok)
    return { nodeIndex, fieldId: node.fieldId, document: verdict.document };
  collector.add(
    'structure.rich_text_invalid',
    fieldValueLocation(node.fieldId),
    position,
  );
  return null;
};
