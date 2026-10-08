import * as React from 'react';

export interface CmsEditorialLeaveConfirmationProps {
  readonly unsentCount: number;
  readonly onSaveAndLeave: () => void;
  readonly onLeave: () => void;
  readonly onStay: () => void;
}

/**
 * The inline leave confirmation (FE03 `<ConfirmationStep>`: inline first, the
 * heading takes focus, Escape cancels before anything is committed). It names
 * the consequence and the three choices; nothing is discarded until the author
 * chooses Leave without saving.
 */
export default function CmsEditorialLeaveConfirmation({
  unsentCount,
  onSaveAndLeave,
  onLeave,
  onStay,
}: CmsEditorialLeaveConfirmationProps): React.ReactElement {
  const heading = React.useRef<HTMLHeadingElement>(null);
  React.useEffect(() => {
    heading.current?.focus();
  }, []);
  return (
    <section
      data-cms-editorial-leave=""
      aria-labelledby="cms-editorial-leave-heading"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          onStay();
        }
      }}
    >
      <h2 id="cms-editorial-leave-heading" tabIndex={-1} ref={heading}>
        Leave this entry?
      </h2>
      <p>
        {unsentCount > 0
          ? `You have ${unsentCount} unsent ${unsentCount === 1 ? 'change' : 'changes'}.`
          : 'A save is still waiting to be confirmed.'}{' '}
        Leaving without saving discards them.
      </p>
      <p>
        <button type="button" onClick={onSaveAndLeave}>
          Save draft and leave
        </button>{' '}
        <button type="button" onClick={onLeave}>
          Leave without saving
        </button>{' '}
        <button type="button" onClick={onStay}>
          Keep editing
        </button>
      </p>
    </section>
  );
}
