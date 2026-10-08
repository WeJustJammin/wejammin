import * as React from 'react';

import {
  RichTextV1DocumentSchema,
  type RichTextV1Document,
} from './cms-rich-text-contracts';

/**
 * FE03 renderer for the canonical DEC-112 rich_text.v1 AST
 * (.memory/wiki/specs/fe/03-cms-content-modeling.md, CmsRichTextRenderer row;
 * .memory/wiki/specs/be/03b-editorial-workflow-publication.md, "Rich text
 * fields (DEC-112)").
 *
 * Structural obligations:
 * - typed SSR-capable elements only: <p>, <h2>-<h4>, grouped <ul>/<ol><li>,
 *   <blockquote>, <strong>/<em>/<code>;
 * - https links render <a rel="noopener noreferrer"> with non-empty text and
 *   every other link variant renders a safe typed href;
 * - correct heading order (no skipped levels) is a producer obligation, and
 *   the renderer adds no interactive control;
 * - no dangerouslySetInnerHTML, ever.
 *
 * Untrusted-input safety: the value is never trusted. The document never
 * reaches a DOM element until RichTextV1DocumentSchema (the shared canonical
 * grammar, which admits only absolute https, mailto and internal links) has
 * accepted it, so a javascript:, data: or protocol-relative link cannot
 * render. On refusal the component emits an inert accessibility-exposed notice
 * and no document markup. Every member must satisfy the shared grammar exactly;
 * invalid or legacy values are refused, not repaired into a different document.
 *
 * Grouped lists are emitted as maximal runs of consecutive list_item blocks
 * with the same list kind at the same depth, matching the flat BE03b
 * representation.
 */

const HeadingTag = {
  2: 'h2',
  3: 'h3',
  4: 'h4',
} as const;

type Blocks = RichTextV1Document['blocks'];
type Block = Blocks[number];
type ListItemBlock = Extract<Block, { type: 'list_item' }>;
type Span = Extract<Block, { type: 'paragraph' }>['spans'][number];

const isListBlock = (block: Block): block is ListItemBlock =>
  block.type === 'list_item';

type ListRun = {
  readonly ordered: boolean;
  readonly items: ListItemBlock[];
};

/**
 * Maximal-run grouping: a run ends when the next block is not a list item or
 * changes list kind or depth. Runs may restart with the same kind (for example
 * at a different depth), which is a new grouped list.
 */
const groupListRuns = (blocks: Blocks): ListRun[] => {
  const runs: ListRun[] = [];
  let current: ListRun | null = null;
  for (const block of blocks) {
    if (
      isListBlock(block) &&
      current !== null &&
      (current.ordered
        ? block.list === 'numbered'
        : block.list === 'bulleted') &&
      block.depth === current.items[0]!.depth
    ) {
      current.items.push(block);
      continue;
    }
    if (isListBlock(block)) {
      current = { ordered: block.list === 'numbered', items: [block] };
      runs.push(current);
      continue;
    }
    current = null;
  }
  return runs;
};

interface SpanRenderProps {
  readonly span: Span;
}

const CmsRichTextSpan = ({ span }: SpanRenderProps): React.ReactElement => {
  let content: React.ReactNode = span.text;
  for (const mark of [...(span.marks ?? [])].reverse()) {
    content =
      mark === 'bold' ? (
        <strong>{content}</strong>
      ) : mark === 'italic' ? (
        <em>{content}</em>
      ) : (
        <code>{content}</code>
      );
  }
  const link = span.link;
  if (link === undefined) return <React.Fragment>{content}</React.Fragment>;
  if (link.kind === 'https')
    return (
      <a href={link.href} rel="noopener noreferrer">
        {content}
      </a>
    );
  if (link.kind === 'mailto')
    return <a href={'mailto:' + link.address}>{content}</a>;
  return <a href={link.route}>{content}</a>;
};

const renderSpans = (spans: readonly Span[]): React.ReactNode[] =>
  spans.map((span, spanIndex) => (
    <CmsRichTextSpan key={spanIndex} span={span} />
  ));

const renderBlocks = (blocks: Blocks): React.ReactNode[] => {
  const content: React.ReactNode[] = [];
  let index = 0;
  while (index < blocks.length) {
    const block = blocks[index]!;
    if (isListBlock(block)) {
      const run = groupListRuns(blocks.slice(index)).find(
        (candidate) => candidate.items[0] === block,
      );
      if (run === undefined) break;
      const tag = run.ordered ? 'ol' : 'ul';
      content.push(
        React.createElement(
          tag,
          { key: 'list-' + String(index) },
          run.items.map((item, itemIndex) => (
            <li key={'item-' + String(itemIndex)}>{renderSpans(item.spans)}</li>
          )),
        ),
      );
      index += run.items.length;
      continue;
    }
    if (block.type === 'paragraph')
      content.push(
        <p key={'p-' + String(index)}>{renderSpans(block.spans)}</p>,
      );
    else if (block.type === 'heading')
      content.push(
        React.createElement(
          HeadingTag[block.level],
          { key: 'h-' + String(index) },
          renderSpans(block.spans),
        ),
      );
    else
      content.push(
        <blockquote key={'q-' + String(index)}>
          {renderSpans(block.spans)}
        </blockquote>,
      );
    index += 1;
  }
  return content;
};

export interface CmsRichTextRendererProps {
  readonly value: unknown;
}

const CmsRichTextRenderer = ({
  value,
}: CmsRichTextRendererProps): React.ReactElement => {
  const parsed = RichTextV1DocumentSchema.safeParse(value);
  if (!parsed.success) {
    return (
      <div className="cms-rich-text cms-rich-text-invalid" role="note">
        This rich text could not be displayed.
      </div>
    );
  }
  return (
    <div className="cms-rich-text">{renderBlocks(parsed.data.blocks)}</div>
  );
};

export default CmsRichTextRenderer;
export { CmsRichTextRenderer };
