import * as React from 'react';

import { emptyParagraphBlock, type EditorBlock } from './cms-rich-text-blocks';
import type { RichTextV1Document } from './cms-rich-text-contracts';
import { CMS_EDITORIAL_REASON_COPY } from '../cms-editorial/cms-editorial-reason-copy';
import CmsRichTextEditorBlock from './CmsRichTextEditorBlock';
import CmsRichTextRenderer from './CmsRichTextRenderer';
import { useCmsRichTextBlocks } from './use-cms-rich-text-blocks';

/**
 * FE03 constrained native editor for DEC-112 rich_text.v1
 * (.memory/wiki/specs/fe/03-cms-content-modeling.md, CmsRichTextEditor row).
 *
 * Native block controls: a type select, level / list / depth selects, and one
 * textarea per block. Inline marks and links are authored with the documented
 * constrained markup subset (**bold**, _italic_, backtick-code, [text](href))
 * and parsed deterministically to canonical spans, with a live preview through
 * CmsRichTextRenderer. Non-canonical input is refused inline before any submit
 * and mapped to the server 422 reason rich_text_not_canonical; unsafe link
 * schemes (javascript:, data:, protocol-relative, malformed internal routes)
 * are refused with the offending href. HTTPS, mailto, and same-origin internal
 * links round-trip through the canonical AST. Only the canonical rich_text.v1
 * AST reaches onChange.
 * Block reordering is by explicit labelled controls, never pointer-only drag.
 */

export interface CmsRichTextEditorProps {
  readonly value: unknown;
  readonly onChange?: (value: unknown) => void;
  readonly label?: string;
}

const CmsRichTextEditor = ({
  value,
  onChange,
  label = 'Body',
}: CmsRichTextEditorProps): React.ReactElement => {
  const {
    valid,
    blocks,
    assembled,
    update,
    newBlockId,
    staleValue,
    loadLatest,
  } = useCmsRichTextBlocks(value, onChange);

  const patch = (id: string, changes: Partial<EditorBlock>): void =>
    update((current) =>
      current.map((block) =>
        block.id === id ? { ...block, ...changes } : block,
      ),
    );

  const setMarkup = (id: string, markup: string): void => patch(id, { markup });

  const move = (index: number, delta: number): void =>
    update((current) => {
      const target = index + delta;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      const [item] = next.splice(index, 1);
      if (item === undefined) return current;
      next.splice(target, 0, item);
      return next;
    });

  const addBlock = (): void => {
    const id = newBlockId();
    update((current) => [...current, emptyParagraphBlock(id)]);
  };

  const removeBlock = (id: string): void =>
    update((current) =>
      current.length <= 1
        ? current
        : current.filter((block) => block.id !== id),
    );

  const previewValue: RichTextV1Document = assembled.ok
    ? assembled.document
    : { format: 'rich_text.v1', blocks: [{ type: 'paragraph', spans: [] }] };

  const error = assembled.ok ? null : assembled.error;

  if (!valid)
    return (
      <div className="cms-rich-text-editor cms-rich-text-editor-invalid">
        <p role="alert">This rich text could not be edited.</p>
      </div>
    );

  return (
    <div className="cms-rich-text-editor">
      <fieldset role="group" aria-label={label}>
        <legend>{label}</legend>
        {staleValue === null ? null : (
          <p role="status" data-rich-text-stale="">
            This text changed elsewhere. Your unfinished edit is kept.{' '}
            <button type="button" onClick={loadLatest}>
              Load the latest text (discard my unfinished edit)
            </button>
          </p>
        )}
        {blocks.map((block, index) => (
          <CmsRichTextEditorBlock
            key={block.id}
            block={block}
            index={index}
            count={blocks.length}
            invalid={error !== null}
            onPatch={patch}
            onMarkup={setMarkup}
            onMove={move}
            onRemove={removeBlock}
          />
        ))}
        <button type="button" onClick={addBlock}>
          Add block
        </button>
        {error !== null ? (
          <p role="alert" data-reason={error.code}>
            {error.code === 'rich_text_unsafe_link'
              ? 'That link is not allowed. ' + (error.detail ?? '')
              : `${CMS_EDITORIAL_REASON_COPY.rich_text_not_canonical} (${error.code})`}
          </p>
        ) : null}
      </fieldset>
      <section aria-label={`${label} preview`} role="region">
        <CmsRichTextRenderer value={previewValue} />
      </section>
    </div>
  );
};

export default CmsRichTextEditor;
export { CmsRichTextEditor };
