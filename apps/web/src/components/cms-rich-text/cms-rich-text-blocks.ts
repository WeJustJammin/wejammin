import {
  RichTextV1DocumentSchema,
  type RichTextV1Document,
} from './cms-rich-text-contracts';
import {
  inlineError,
  parseInlineMarkup,
  serializeSpans,
  type InlineError,
} from './cms-rich-text-markup';

/**
 * Block model of the DEC-112 rich_text.v1 editor: the editable block shape, the
 * deterministic build from constrained markup to a canonical block, the
 * hydration of a server-validated document, and the assembly of every block
 * into one document that the shared schema must accept before it can be
 * emitted. Pure functions only; the component owns state and rendering.
 */

export type BlockType = 'paragraph' | 'heading' | 'quote' | 'list_item';
export type HeadingLevel = 2 | 3 | 4;
export type ListKind = 'bulleted' | 'numbered';
export type ListDepth = 1 | 2 | 3;

export type EditorBlock = {
  readonly id: string;
  readonly type: BlockType;
  readonly level: HeadingLevel;
  readonly list: ListKind;
  readonly depth: ListDepth;
  readonly markup: string;
};

/**
 * Block ids are never drawn from module state: the server render and the
 * hydrating client each run in their own module instance, so a module counter
 * gives them different ids (the server HTML would carry `rtb-25` while the
 * client state held `rtb-1`). An id is derived from the block's position when a
 * document is hydrated, and from the editor instance's own counter for a block
 * the author adds, so a render is a pure function of its input.
 */
export type BlockIdFor = (index: number) => string;

const positionalBlockId: BlockIdFor = (index) => 'rtb-0-' + String(index);

type BlockBuild =
  | { readonly ok: true; readonly block: RichTextV1Document['blocks'][number] }
  | { readonly ok: false; readonly error: InlineError };

/**
 * A block is refused when its markup is non-canonical, when a heading or quote
 * has no text, or when a list depth jumps more than one within a run. Paragraph
 * and list_item may be empty; heading and quote may not.
 */
const buildBlock = (block: EditorBlock, previousDepth: number): BlockBuild => {
  const parsed = parseInlineMarkup(block.markup);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const spans = [...parsed.spans];
  if (block.type === 'paragraph')
    return { ok: true, block: { type: 'paragraph', spans } };
  if (block.type === 'heading') {
    if (spans.length === 0)
      return { ok: false, error: inlineError('rich_text_not_canonical') };
    return { ok: true, block: { type: 'heading', level: block.level, spans } };
  }
  if (block.type === 'quote') {
    if (spans.length === 0)
      return { ok: false, error: inlineError('rich_text_not_canonical') };
    return { ok: true, block: { type: 'quote', spans } };
  }
  const startsRun = previousDepth === 0;
  if (startsRun ? block.depth !== 1 : block.depth > previousDepth + 1)
    return { ok: false, error: inlineError('rich_text_not_canonical') };
  return {
    ok: true,
    block: {
      type: 'list_item',
      list: block.list,
      depth: block.depth,
      spans,
    },
  };
};

export const emptyParagraphBlock = (id: string): EditorBlock => ({
  id,
  type: 'paragraph',
  level: 2,
  list: 'bulleted',
  depth: 1,
  markup: '',
});

/** Hydrate the editor from a server-validated rich_text.v1 value. */
export const toEditorBlocks = (
  value: unknown,
  idFor: BlockIdFor = positionalBlockId,
): EditorBlock[] => {
  const parsed = RichTextV1DocumentSchema.safeParse(value);
  if (!parsed.success) return [];
  const blocks: EditorBlock[] = [];
  for (const raw of parsed.data.blocks) {
    const spans = raw.spans;
    const markup = serializeSpans(spans);
    if (raw.type === 'heading') {
      blocks.push({
        id: idFor(blocks.length),
        type: 'heading',
        level: (raw.level === 3 ? 3 : raw.level === 4 ? 4 : 2) as HeadingLevel,
        list: 'bulleted',
        depth: 1,
        markup,
      });
      continue;
    }
    if (raw.type === 'quote') {
      blocks.push({
        id: idFor(blocks.length),
        type: 'quote',
        level: 2,
        list: 'bulleted',
        depth: 1,
        markup,
      });
      continue;
    }
    if (raw.type === 'list_item') {
      blocks.push({
        id: idFor(blocks.length),
        type: 'list_item',
        level: 2,
        list: raw.list === 'numbered' ? 'numbered' : 'bulleted',
        depth: (raw.depth === 2 ? 2 : raw.depth === 3 ? 3 : 1) as ListDepth,
        markup,
      });
      continue;
    }
    blocks.push({
      id: idFor(blocks.length),
      type: 'paragraph',
      level: 2,
      list: 'bulleted',
      depth: 1,
      markup,
    });
  }
  if (blocks.length === 0) blocks.push(emptyParagraphBlock(idFor(0)));
  return blocks;
};

export type AssembledDocument =
  | { readonly ok: true; readonly document: RichTextV1Document }
  | { readonly ok: false; readonly error: InlineError };

/**
 * Build every block in order, tracking list runs so a depth jump is refused, and
 * accept the document only when the shared canonical schema does.
 */
export const assembleRichTextDocument = (
  blocks: readonly EditorBlock[],
): AssembledDocument => {
  const outputs: RichTextV1Document['blocks'] = [];
  let previousList: ListKind | null = null;
  let previousDepth = 0;
  for (const block of blocks) {
    const depthForBuild = previousList === block.list ? previousDepth : 0;
    const built = buildBlock(block, depthForBuild);
    if (!built.ok) return { ok: false, error: built.error };
    outputs.push(built.block);
    if (block.type === 'list_item') {
      previousList = block.list;
      previousDepth = block.depth;
    } else {
      previousList = null;
      previousDepth = 0;
    }
  }
  if (outputs.length === 0)
    return { ok: false, error: inlineError('rich_text_not_canonical') };
  const document: RichTextV1Document = {
    format: 'rich_text.v1',
    blocks: outputs,
  };
  if (!RichTextV1DocumentSchema.safeParse(document).success)
    return { ok: false, error: inlineError('rich_text_not_canonical') };
  return { ok: true, document };
};

/**
 * A key-order independent identity of a rich_text document, so a document the
 * editor emitted and the same document handed back by its parent (re-parsed,
 * keys in another order) are recognised as one.
 */
export const richTextKey = (value: unknown): string => {
  const sorted = (node: unknown): unknown =>
    Array.isArray(node)
      ? node.map(sorted)
      : typeof node === 'object' && node !== null
        ? Object.fromEntries(
            Object.entries(node)
              .sort(([left], [right]) =>
                left < right ? -1 : left > right ? 1 : 0,
              )
              .map(([key, entry]) => [key, sorted(entry)]),
          )
        : node;
  return JSON.stringify(sorted(value));
};
