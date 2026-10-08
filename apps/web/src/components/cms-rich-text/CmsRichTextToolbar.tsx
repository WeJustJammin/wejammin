import * as React from 'react';

import type { RichTextMark } from './cms-rich-text-contracts';
import CmsRichTextLinkForm from './CmsRichTextLinkForm';
import { hrefOfLink } from './cms-rich-text-links';
import {
  formatAtSelection,
  setLinkInMarkup,
  toggleMarkInMarkup,
  type FormatResult,
  type MarkupSelection,
} from './cms-rich-text-selection';

const MARKS: ReadonlyArray<{
  readonly mark: RichTextMark;
  readonly label: string;
}> = [
  { mark: 'bold', label: 'Bold' },
  { mark: 'italic', label: 'Italic' },
  { mark: 'code', label: 'Code' },
];

const REFUSALS: Readonly<Record<string, string>> = {
  rich_text_selection_empty: 'Select the text to format first.',
  rich_text_not_canonical:
    'Fix the highlighted text before formatting it or adding a link.',
};

interface LinkForm {
  readonly selection: MarkupSelection;
  readonly address: string;
  readonly hasLink: boolean;
  readonly error: string | null;
}

export interface CmsRichTextToolbarProps {
  readonly markup: string;
  readonly textarea: React.RefObject<HTMLTextAreaElement | null>;
  readonly onMarkup: (markup: string) => void;
}

/**
 * The semantic mark and link controls of one block (AC-086, FE03
 * CmsRichTextEditor): native buttons for Bold, Italic and Code (`aria-pressed`
 * says what the selection has) and for Link, which opens an inline address
 * field. Tab, Enter and Space are the native behavior; Enter in the field
 * applies (and never submits the surrounding form), Escape closes it and
 * returns focus to Link, an unsafe address is refused inline and named, and
 * after a change focus returns to the text with the same text selected. The
 * controls act through the canonical spans, so the markup stays lossless.
 */
export default function CmsRichTextToolbar({
  markup,
  textarea,
  onMarkup,
}: CmsRichTextToolbarProps): React.ReactElement {
  const ids = React.useId();
  const [selection, setSelection] = React.useState<MarkupSelection>({
    start: 0,
    end: 0,
  });
  const [message, setMessage] = React.useState('');
  const [form, setForm] = React.useState<LinkForm | null>(null);
  const [restoreTick, setRestoreTick] = React.useState(0);
  const pending = React.useRef<MarkupSelection | null>(null);
  const linkButton = React.useRef<HTMLButtonElement>(null);
  const addressInput = React.useRef<HTMLInputElement>(null);
  const formOpen = form !== null;

  React.useEffect(() => {
    const node = textarea.current;
    if (node === null) return undefined;
    const read = (): void =>
      setSelection({ start: node.selectionStart, end: node.selectionEnd });
    const events = ['select', 'keyup', 'mouseup', 'focus'] as const;
    for (const name of events) node.addEventListener(name, read);
    return () => {
      for (const name of events) node.removeEventListener(name, read);
    };
  }, [textarea]);

  React.useEffect(() => {
    const node = textarea.current;
    const restore = pending.current;
    if (node === null || restore === null) return;
    pending.current = null;
    node.focus();
    node.setSelectionRange(restore.start, restore.end);
  }, [restoreTick, markup, textarea]);

  React.useEffect(() => {
    if (formOpen) addressInput.current?.focus();
  }, [formOpen]);

  const current = (): MarkupSelection => {
    const node = textarea.current;
    return node === null
      ? selection
      : { start: node.selectionStart, end: node.selectionEnd };
  };

  const commit = (result: FormatResult): string | null => {
    if (!result.ok) return result.error.code;
    pending.current = result.selection;
    setSelection(result.selection);
    onMarkup(result.markup);
    setRestoreTick((tick) => tick + 1);
    setMessage('');
    return null;
  };

  const toggle = (mark: RichTextMark): void => {
    const refusal = commit(toggleMarkInMarkup(markup, current(), mark));
    if (refusal !== null)
      setMessage(REFUSALS[refusal] ?? REFUSALS.rich_text_not_canonical!);
  };

  const openLink = (): void => {
    const at = current();
    if (at.start === at.end) {
      setMessage('Select the text to link first.');
      return;
    }
    const link = formatAtSelection(markup, at).link;
    setMessage('');
    setForm({
      selection: at,
      address: link === null ? '' : hrefOfLink(link),
      hasLink: link !== null,
      error: null,
    });
  };

  const closeLink = (): void => {
    setForm(null);
    linkButton.current?.focus();
  };

  const applyLink = (address: string | null): void => {
    if (form === null) return;
    const result = setLinkInMarkup(markup, form.selection, address);
    if (result.ok) {
      setForm(null);
      commit(result);
      return;
    }
    const { code, detail } = result.error;
    setForm({
      ...form,
      error:
        code === 'rich_text_unsafe_link'
          ? `That link is not allowed. ${detail ?? ''}`.trim()
          : code === 'rich_text_link_empty'
            ? 'Enter a link address.'
            : (REFUSALS[code] ?? REFUSALS.rich_text_not_canonical!),
    });
    addressInput.current?.focus();
  };

  const format = formatAtSelection(markup, selection);
  return (
    <div role="toolbar" aria-label="Text formatting">
      {MARKS.map(({ mark, label }) => (
        <button
          key={mark}
          type="button"
          aria-pressed={format.marks.includes(mark)}
          onClick={() => toggle(mark)}
        >
          {label}
        </button>
      ))}
      <button
        ref={linkButton}
        type="button"
        aria-pressed={format.link !== null}
        onClick={openLink}
      >
        Link
      </button>
      <span role="status" data-rich-text-message="">
        {message}
      </span>
      {form === null ? null : (
        <CmsRichTextLinkForm
          ids={ids}
          inputRef={addressInput}
          address={form.address}
          error={form.error}
          hasLink={form.hasLink}
          onAddress={(address) => setForm({ ...form, address, error: null })}
          onApply={applyLink}
          onCancel={closeLink}
        />
      )}
    </div>
  );
}
