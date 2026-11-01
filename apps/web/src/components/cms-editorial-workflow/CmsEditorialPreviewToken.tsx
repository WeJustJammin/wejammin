import type { PreviewTokenResource } from '@wejammin/contracts';
import * as React from 'react';

export interface CmsEditorialPreviewTokenProps {
  readonly preview: PreviewTokenResource;
  readonly copyText: (text: string) => Promise<void>;
  readonly onHide: () => void;
}

const COPIED = 'Token copied.';
const NOT_COPIED = 'Copying failed. Select the token and copy it yourself.';

/**
 * The one disclosure of a preview token (BE03b "Preview token"): the plaintext,
 * the exact binding it is valid for and its expiry, as text in a named polite
 * region. The token lives only in this component's memory: it is never put in a
 * URL, a history entry, storage, an analytics event, a log or a live status
 * message, and hiding it discards it.
 */
export default function CmsEditorialPreviewToken({
  preview,
  copyText,
  onHide,
}: CmsEditorialPreviewTokenProps): React.ReactElement {
  const [copied, setCopied] = React.useState<string>('');
  return (
    <section
      aria-labelledby="preview-token-title"
      aria-live="polite"
      data-cms-preview-disclosure=""
    >
      <h4 id="preview-token-title" tabIndex={-1}>
        Preview token
      </h4>
      <p>
        This token is shown once. Copy it now; it cannot be shown again after
        you leave this page.
      </p>
      <p>
        <code data-cms-preview-token="">{preview.token}</code>
      </p>
      <p>
        Valid for audience {preview.audience}, locale {preview.locale}, route{' '}
        <code>{preview.route}</code>, until{' '}
        <time dateTime={preview.expiresAt}>{preview.expiresAt}</time>.
      </p>
      {preview.revoked ? <p>This token is revoked.</p> : null}
      <p>
        <button
          type="button"
          onClick={() => {
            copyText(preview.token).then(
              () => setCopied(COPIED),
              () => setCopied(NOT_COPIED),
            );
          }}
        >
          Copy token
        </button>{' '}
        <button type="button" onClick={onHide}>
          Hide token and create another
        </button>
      </p>
      <p role="status" data-cms-preview-copy-status="">
        {copied}
      </p>
    </section>
  );
}
