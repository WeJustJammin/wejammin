import type { CommandState } from './cms-workflow-command-controller';

/**
 * A command form never disables a focused control (a disabled button drops
 * keyboard focus to the body); it is `aria-disabled` and its handler refuses.
 * The commit is blocked while a command is in flight, after it committed,
 * while its outcome is unknown, while a step-up detour or a changed version
 * waits, and while the read behind the form is not verified.
 */
const BLOCKING_PHASES: ReadonlySet<CommandState<unknown>['phase']> = new Set([
  'pending',
  'committed',
  'unknown',
  'step-up-leaving',
  'conflict',
]);

/**
 * The one local error of a form whose checks could not run because the lazily
 * loaded validators could not be fetched. Nothing was sent; the person can
 * submit again.
 */
export const validatorsUnavailableError = (field: {
  readonly id: string;
  readonly label: string;
}): {
  readonly id: string;
  readonly label: string;
  readonly message: string;
} => ({
  id: field.id,
  label: field.label,
  message:
    'This form could not be checked before sending, so nothing was sent. Check your connection and try again.',
});

export const isCommitBlocked = (
  state: CommandState<unknown>,
  disabledReason: string | null,
): boolean => disabledReason !== null || BLOCKING_PHASES.has(state.phase);
