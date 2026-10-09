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

export const isCommitBlocked = (
  state: CommandState<unknown>,
  disabledReason: string | null,
): boolean => disabledReason !== null || BLOCKING_PHASES.has(state.phase);
