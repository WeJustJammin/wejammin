import * as React from 'react';

export interface CmsTemplateLatestCheckProps {
  /** The control is offered after a conflict or an unknown outcome only. */
  readonly offered: boolean;
  readonly checking: boolean;
  /** A 429's stated wait has not elapsed (FE03 :1172): the check stays off. */
  readonly waiting: boolean;
  readonly error: string;
  readonly rateLimited: boolean;
  readonly onCheck: () => void;
}

/**
 * The explicit latest-version check of the successor form and the sentence of a read that failed.
 * A rate-limited read is announced politely (`role="status"`) and is not an alert; every other
 * failure is an alert. Reading the latest version never touches the unsent values.
 */
export default function CmsTemplateLatestCheck({
  offered,
  checking,
  waiting,
  error,
  rateLimited,
  onCheck,
}: CmsTemplateLatestCheckProps): React.ReactElement {
  const announcementRef = React.useRef<HTMLParagraphElement>(null);
  // React owns the empty node; this effect owns its text after commit.
  React.useEffect(() => {
    const region = announcementRef.current;
    if (region === null) return;
    region.textContent = error && rateLimited ? error : '';
    return () => {
      region.textContent = '';
    };
  }, [error, rateLimited]);
  return (
    <>
      {offered ? (
        <button type="button" disabled={checking || waiting} onClick={onCheck}>
          {checking ? 'Checking latest version…' : 'Check latest version'}
        </button>
      ) : null}
      <p
        ref={announcementRef}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        data-cms-template-rate-limit=""
      />
      {error && !rateLimited ? <p role="alert">{error}</p> : null}
    </>
  );
}
