import * as React from 'react';

export interface CmsTaxonomyTermLeaveConfirmProps {
  /** Keep editing: close the confirmation, the draft is untouched. */
  readonly onStay: () => void;
  /** The explicit discard: the unsent term input is let go. */
  readonly onLeave: () => void;
}

/** The inline leave confirmation of FE03 "Unsaved changes" for an open term form. */
export default function CmsTaxonomyTermLeaveConfirm({
  onStay,
  onLeave,
}: CmsTaxonomyTermLeaveConfirmProps): React.ReactElement {
  const stay = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => stay.current?.focus(), []);
  return (
    <div role="alert" className="cms-term-leave">
      <p>
        This term form holds changes that were not sent. Leaving this page
        discards them.
      </p>
      <button type="button" ref={stay} onClick={onStay}>
        Keep editing
      </button>{' '}
      <button type="button" onClick={onLeave}>
        Leave without saving
      </button>
    </div>
  );
}
