import * as React from 'react';

import CmsRichTextToolbar from './CmsRichTextToolbar';
import type {
  BlockType,
  EditorBlock,
  HeadingLevel,
  ListDepth,
  ListKind,
} from './cms-rich-text-blocks';

export interface CmsRichTextEditorBlockProps {
  readonly block: EditorBlock;
  readonly index: number;
  readonly count: number;
  /** True while the assembled document is refused, so the text is aria-invalid. */
  readonly invalid: boolean;
  readonly onPatch: (id: string, changes: Partial<EditorBlock>) => void;
  readonly onMarkup: (id: string, markup: string) => void;
  readonly onMove: (index: number, delta: number) => void;
  readonly onRemove: (id: string) => void;
}

/**
 * One block of the constrained rich_text.v1 editor: native, labelled controls
 * only (type select, level / list style / depth selects, the block text and
 * explicit move and remove buttons), so reordering is never pointer-only. The
 * text area also carries its own native `input` listener, bound by closure to
 * this block (never to a DOM attribute), so the typed text reaches the editor
 * state however the value was assigned and whatever ids the server rendered.
 */
export default function CmsRichTextEditorBlock({
  block,
  index,
  count,
  invalid,
  onPatch,
  onMarkup,
  onMove,
  onRemove,
}: CmsRichTextEditorBlockProps): React.ReactElement {
  const textarea = React.useRef<HTMLTextAreaElement>(null);
  const latest = React.useRef({ id: block.id, onMarkup });
  React.useEffect(() => {
    latest.current = { id: block.id, onMarkup };
  });
  React.useEffect(() => {
    const node = textarea.current;
    if (node === null) return undefined;
    const listener = (): void =>
      latest.current.onMarkup(latest.current.id, node.value);
    node.addEventListener('input', listener);
    return () => node.removeEventListener('input', listener);
  }, []);
  return (
    <div className="cms-rich-text-editor-block">
      <label>
        Block type
        <select
          value={block.type}
          onChange={(event) =>
            onPatch(block.id, { type: event.target.value as BlockType })
          }
        >
          <option value="paragraph">Paragraph</option>
          <option value="heading">Heading</option>
          <option value="quote">Quote</option>
          <option value="list_item">List item</option>
        </select>
      </label>
      {block.type === 'heading' ? (
        <label>
          Heading level
          <select
            value={String(block.level)}
            onChange={(event) =>
              onPatch(block.id, {
                level: Number(event.target.value) as HeadingLevel,
              })
            }
          >
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
          </select>
        </label>
      ) : null}
      {block.type === 'list_item' ? (
        <React.Fragment>
          <label>
            List style
            <select
              value={block.list}
              onChange={(event) =>
                onPatch(block.id, { list: event.target.value as ListKind })
              }
            >
              <option value="bulleted">Bulleted</option>
              <option value="numbered">Numbered</option>
            </select>
          </label>
          <label>
            List depth
            <select
              value={String(block.depth)}
              onChange={(event) =>
                onPatch(block.id, {
                  depth: Number(event.target.value) as ListDepth,
                })
              }
            >
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
            </select>
          </label>
        </React.Fragment>
      ) : null}
      <CmsRichTextToolbar
        markup={block.markup}
        textarea={textarea}
        onMarkup={(markup) => onMarkup(block.id, markup)}
      />
      <label>
        Block text
        <textarea
          ref={textarea}
          data-block-id={block.id}
          value={block.markup}
          aria-invalid={invalid || undefined}
          onChange={(event) => onMarkup(block.id, event.target.value)}
        />
      </label>
      <button
        type="button"
        disabled={index === 0}
        data-rich-text-move-up=""
        onClick={() => onMove(index, -1)}
      >
        Move block up
      </button>
      <button
        type="button"
        disabled={index === count - 1}
        data-rich-text-move-down=""
        onClick={() => onMove(index, 1)}
      >
        Move block down
      </button>
      <button
        type="button"
        disabled={count <= 1}
        onClick={() => onRemove(block.id)}
      >
        Remove block
      </button>
    </div>
  );
}
