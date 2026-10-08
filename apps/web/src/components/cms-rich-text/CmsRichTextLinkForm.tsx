import * as React from 'react';

export interface CmsRichTextLinkFormProps {
  /** A `useId` prefix, so the hint and error ids are hydration-safe and unique. */
  readonly ids: string;
  readonly inputRef: React.RefObject<HTMLInputElement | null>;
  readonly address: string;
  readonly error: string | null;
  /** The selection is already a link: offer to remove it. */
  readonly hasLink: boolean;
  readonly onAddress: (address: string) => void;
  /** Apply the address, or remove the link when null. */
  readonly onApply: (address: string | null) => void;
  readonly onCancel: () => void;
}

/**
 * The inline link address field of the rich-text toolbar. Native label, input
 * and buttons: Enter applies and never submits the surrounding form, Escape
 * cancels (the toolbar returns focus to Link), and a refused address is shown in
 * a linked alert on the field, which keeps focus.
 */
export default function CmsRichTextLinkForm({
  ids,
  inputRef,
  address,
  error,
  hasLink,
  onAddress,
  onApply,
  onCancel,
}: CmsRichTextLinkFormProps): React.ReactElement {
  const errorId = `${ids}-link-error`;
  const hintId = `${ids}-link-hint`;
  return (
    <div role="group" aria-label="Link" data-rich-text-link-form="">
      <label>
        Link address
        <input
          ref={inputRef}
          data-rich-text-link-address=""
          type="text"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          value={address}
          aria-invalid={error === null ? undefined : true}
          aria-describedby={error === null ? hintId : errorId}
          onChange={(event) => onAddress(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              onApply(address);
            } else if (event.key === 'Escape') {
              event.preventDefault();
              event.stopPropagation();
              onCancel();
            }
          }}
        />
      </label>
      <small id={hintId}>
        An https:// address, a mailto: address, or a path in this app that
        starts with /.
      </small>
      {error === null ? null : (
        <p id={errorId} role="alert" data-rich-text-link-error="">
          {error}
        </p>
      )}
      <button type="button" onClick={() => onApply(address)}>
        Apply link
      </button>
      {hasLink ? (
        <button type="button" onClick={() => onApply(null)}>
          Remove link
        </button>
      ) : null}
      <button type="button" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}
