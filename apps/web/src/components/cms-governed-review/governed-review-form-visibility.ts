import type { CommandPhase } from '../cms-editorial-workflow/cms-workflow-command-controller';

/**
 * A governed command frame outlives the permission to use it. The canonical
 * re-read that follows a refusal can remove the action (the review closed, the
 * assignment ended), and that same re-read must not erase the sentence that says
 * why. So a form is mounted for the life of its island; it draws its frame while
 * the server permits the action, or while its command is in a state the person
 * still has to read or answer. A committed command hands its sentence to the
 * island's own status line, so `committed` and `idle` draw nothing on their own.
 */
const READABLE_PHASES: ReadonlySet<CommandPhase> = new Set([
  'pending',
  'refused',
  'unknown',
  'step-up-leaving',
  'step-up-unavailable',
  'signed-out',
  'restored',
  'conflict',
]);

export const governedFrameVisible = (
  permitted: boolean,
  phase: CommandPhase,
): boolean => permitted || READABLE_PHASES.has(phase);
