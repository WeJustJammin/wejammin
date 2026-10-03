/** Element ids of the visible reasons the grant console disables its commands. */
export const DEGRADED_REASON_ID = 'cms-grants-degraded-reason';
export const STEP_UP_REASON_ID = 'cms-grants-step-up-reason';

/**
 * The id of the visible reason every disabled command points at: the degraded
 * list notice, else the step-up recovery; none when access itself is disabled
 * (the disabled panel states its own reason) or commands are enabled.
 */
export const disabledReasonIdFor = (state: {
  readonly commandsDisabled: boolean;
  readonly degraded: boolean;
  readonly disabledAccess: boolean;
}): string | undefined => {
  if (!state.commandsDisabled || state.disabledAccess) return undefined;
  return state.degraded ? DEGRADED_REASON_ID : STEP_UP_REASON_ID;
};

/** `aria-describedby` of a command: its own description plus the reason when disabled. */
export const describedByWithReason = (
  own: string,
  disabled: boolean,
  reasonId: string | undefined,
): string => (disabled && reasonId !== undefined ? `${own} ${reasonId}` : own);
