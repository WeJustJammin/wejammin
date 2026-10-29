import * as React from 'react';

export interface CmsCompositionLeaveConfirmProps {
  /** Keep editing: close the confirmation, the draft is untouched. */
  readonly onStay: () => void;
  /** The explicit discard: the unsent placement input is let go. */
  readonly onLeave: () => void;
}

/** The inline leave confirmation of FE03 "Unsaved changes" for an insert form that holds unsent input. */
export default function CmsCompositionLeaveConfirm({
  onStay,
  onLeave,
}: CmsCompositionLeaveConfirmProps): React.ReactElement {
  const stay = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => stay.current?.focus(), []);
  return (
    <div role="alert" className="cms-composition-leave">
      <p>
        The insert form holds changes that were not sent. Leaving this page
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
