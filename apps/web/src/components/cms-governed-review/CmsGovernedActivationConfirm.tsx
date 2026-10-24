import * as React from 'react';

import {
  ACTIVATION_COMMIT_LABEL,
  ACTIVATION_CONFIRM_TITLE,
  ACTIVATION_CONSEQUENCE,
  type ActivationAction,
} from './governed-activation-model';

export const GOVERNED_ACTIVATION_CONFIRM_ID =
  'governed-activation-confirm-title';

const PENDING_TEXT_ID = 'governed-activation-confirm-pending';

export interface CmsGovernedActivationConfirmProps {
  readonly action: ActivationAction;
  /** What is about to happen, in one sentence (the subject and, for a schedule, the instant). */
  readonly sentence: string;
  readonly blocked: boolean;
  readonly pending: boolean;
  /** The words of the command in flight, exposed beside the commit control. */
  readonly pendingLabel: string;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

/**
 * The inline confirmation step of CMS-03C-09 (FE03 :902): it names the
 * consequence of the chosen action and sends nothing until the person confirms.
 * Focus lands on its heading; Escape and Cancel withdraw it; any change to the
 * inputs withdraws it too (the form derives its presence from the inputs). While
 * the command is in flight it stays mounted, so focus stays on the commit
 * control, which keeps its label and width, is `aria-disabled` and `aria-busy`
 * and is described by the pending words (FE03 :1118, :1216); Escape and Cancel
 * do nothing until the command settles. Retire is the one genuinely destructive
 * action: its commit control takes the Danger style (DESIGN.md Components > Buttons).
 */
export default function CmsGovernedActivationConfirm({
  action,
  sentence,
  blocked,
  pending,
  pendingLabel,
  onConfirm,
  onCancel,
}: CmsGovernedActivationConfirmProps): React.ReactElement {
  const heading = React.useRef<HTMLHeadingElement>(null);
  React.useEffect(() => {
    heading.current?.focus();
  }, []);
  return (
    <section
      aria-labelledby={GOVERNED_ACTIVATION_CONFIRM_ID}
      data-cms-activation-confirm=""
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !pending) onCancel();
      }}
    >
      <h4 id={GOVERNED_ACTIVATION_CONFIRM_ID} tabIndex={-1} ref={heading}>
        {ACTIVATION_CONFIRM_TITLE[action]}
      </h4>
      <p>{sentence}</p>
      <p>{ACTIVATION_CONSEQUENCE[action]}</p>
      <button
        type="button"
        className={action === 'retire' ? 'cms-danger-action' : undefined}
        aria-disabled={blocked ? 'true' : 'false'}
        aria-busy={pending ? 'true' : 'false'}
        aria-describedby={pending ? PENDING_TEXT_ID : undefined}
        onClick={() => {
          if (!blocked) onConfirm();
        }}
      >
        {ACTIVATION_COMMIT_LABEL[action]}
      </button>{' '}
      <button
        type="button"
        aria-disabled={pending ? 'true' : 'false'}
        onClick={() => {
          if (!pending) onCancel();
        }}
      >
        Cancel
      </button>
      {pending ? <p id={PENDING_TEXT_ID}>{pendingLabel}</p> : null}
    </section>
  );
}
