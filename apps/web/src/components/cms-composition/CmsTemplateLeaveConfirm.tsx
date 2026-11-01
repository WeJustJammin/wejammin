import * as React from 'react';

export interface CmsTemplateLeaveConfirmProps {
  /** Keep editing: close the confirmation, the draft is untouched. */
  readonly onStay: () => void;
  /** The explicit discard: the unsent template values are let go. */
  readonly onLeave: () => void;
}

/** The inline leave confirmation of FE03 "Unsaved changes" for a template designer. */
export default function CmsTemplateLeaveConfirm({
  onStay,
  onLeave,
}: CmsTemplateLeaveConfirmProps): React.ReactElement {
  const stay = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => stay.current?.focus(), []);
  return (
    <div role="alert" className="cms-template-leave">
      <p>
        This template form holds changes that were not sent. Leaving this page
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
