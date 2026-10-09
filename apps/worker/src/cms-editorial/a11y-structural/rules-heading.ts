import { NO_POSITION, type FindingCollector } from './findings';
import { richTextBlockLocation } from './locations';
import type { ParsedField } from './rules-structure';
import { hasNonWhitespace } from './text';

/**
 * BE05c heading group over the rich_text.v1 blocks in document order.
 * `heading.empty`: no non-whitespace text. `heading.first_level`: the first
 * heading in the whole document (across fields, in node order) is not level 2.
 * `heading.level_skipped`: a level exceeds the previous heading's level by more
 * than one; decreases are allowed. The previous level carries across fields and
 * over non-heading blocks, and an empty heading still counts as a heading.
 */

const FIRST_HEADING_LEVEL = 2;
const MAX_LEVEL_STEP = 1;

export type HeadingRule = Readonly<{ evaluate: (field: ParsedField) => void }>;

export const createHeadingRule = (collector: FindingCollector): HeadingRule => {
  let previousLevel: number | null = null;
  return {
    evaluate: (field) => {
      field.document.blocks.forEach((block, blockIndex) => {
        if (block.type !== 'heading') return;
        const location = richTextBlockLocation(field.fieldId, blockIndex);
        const position = [field.nodeIndex, blockIndex, NO_POSITION] as const;
        if (!block.spans.some((span) => hasNonWhitespace(span.text)))
          collector.add('heading.empty', location, position);
        if (previousLevel === null) {
          if (block.level !== FIRST_HEADING_LEVEL)
            collector.add('heading.first_level', location, position);
        } else if (block.level > previousLevel + MAX_LEVEL_STEP) {
          collector.add('heading.level_skipped', location, position);
        }
        previousLevel = block.level;
      });
    },
  };
};
