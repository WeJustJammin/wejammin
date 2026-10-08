import * as React from 'react';

import {
  assembleRichTextDocument,
  richTextKey,
  toEditorBlocks,
  type AssembledDocument,
  type EditorBlock,
} from './cms-rich-text-blocks';
import { RichTextV1DocumentSchema } from './cms-rich-text-contracts';

export interface CmsRichTextBlocks {
  /** False when the value is not a canonical rich_text.v1 document. */
  readonly valid: boolean;
  readonly blocks: EditorBlock[];
  readonly assembled: AssembledDocument;
  /** Change the blocks from the current ones (never from a stale render). */
  readonly update: (change: (current: EditorBlock[]) => EditorBlock[]) => void;
  /** An id for a block the author adds; unique within this editor instance. */
  readonly newBlockId: () => string;
  /** A canonical document the parent adopted while an unfinished edit is open. */
  readonly staleValue: unknown;
  readonly loadLatest: () => void;
}

/**
 * The editor's block state, kept in step with the canonical value its parent
 * owns (Codex review s10-ts-2, H4). The editor emits a document on every valid
 * edit, so a `value` equal to what it holds or last emitted is only an echo.
 * Any other `value` is a canonical document the parent adopted (conflict
 * reconciliation, "discard and load current"): the blocks are rebuilt from it so
 * the next edit never overwrites it from stale text. The one exception is an
 * unfinished edit the parent has never seen (markup that is not yet a valid
 * document): that is the author's unsent work, so it is kept, the adopted value
 * is parked, and the author chooses to load it.
 */
export const useCmsRichTextBlocks = (
  value: unknown,
  onChange: ((value: unknown) => void) | undefined,
): CmsRichTextBlocks => {
  const valid = RichTextV1DocumentSchema.safeParse(value).success;
  const incoming = valid ? richTextKey(value) : null;
  // Ids are deterministic (see `BlockIdFor`): the first hydration is positional
  // and identical on the server and the client; a later hydration (an adopted
  // document) takes a new generation so its ids never collide with live blocks.
  const generation = React.useRef(0);
  const added = React.useRef(0);
  const hydrate = (document: unknown): EditorBlock[] =>
    toEditorBlocks(
      document,
      (index) => 'rtb-' + String(generation.current) + '-' + String(index),
    );
  const [blocks, setBlocks] = React.useState<EditorBlock[]>(() =>
    valid ? hydrate(value) : [],
  );
  const [dirty, setDirty] = React.useState(false);
  const [staleValue, setStaleValue] = React.useState<unknown>(null);
  // The key of the document the editor holds: hydrated from, or last emitted.
  const synced = React.useRef<string | null>(incoming);

  const assembled = React.useMemo(
    () => assembleRichTextDocument(blocks),
    [blocks],
  );
  const latest = React.useRef({ dirty, assembled, value });
  React.useEffect(() => {
    latest.current = { dirty, assembled, value };
  });

  React.useEffect(() => {
    if (!dirty || !assembled.ok || onChange === undefined) return;
    const key = richTextKey(assembled.document);
    if (synced.current === key) return;
    synced.current = key;
    onChange(assembled.document);
  }, [assembled, dirty, onChange]);

  React.useEffect(() => {
    if (incoming === null) return;
    if (incoming === synced.current) {
      setStaleValue(null);
      return;
    }
    const {
      dirty: edited,
      assembled: current,
      value: adopted,
    } = latest.current;
    const unfinished =
      edited &&
      (!current.ok || richTextKey(current.document) !== synced.current);
    if (unfinished) {
      setStaleValue(adopted);
      return;
    }
    generation.current += 1;
    setBlocks(hydrate(adopted));
    setDirty(false);
    setStaleValue(null);
    synced.current = incoming;
  }, [incoming]);

  const update = (change: (current: EditorBlock[]) => EditorBlock[]): void => {
    setBlocks(change);
    setDirty(true);
  };
  const newBlockId = (): string => {
    const id = 'rtb-a' + String(added.current);
    added.current += 1;
    return id;
  };
  const loadLatest = (): void => {
    if (staleValue === null) return;
    generation.current += 1;
    setBlocks(hydrate(staleValue));
    setDirty(false);
    synced.current = richTextKey(staleValue);
    setStaleValue(null);
  };
  return {
    valid,
    blocks,
    assembled,
    update,
    newBlockId,
    staleValue,
    loadLatest,
  };
};
