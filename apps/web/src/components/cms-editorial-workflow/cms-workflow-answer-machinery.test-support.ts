/**
 * The modules a command form and the workflow island load lazily (`cms-workflow-answer-machinery.ts`,
 * the island's default canonical read; P2-S11-AC-106): the transport, the refusal classifier and
 * the canonical read (governed ones too). A test that sends a command or refetches loads them first, so the step under
 * test is not racing the first load of a module (which the island's `act`-bounded waits do not
 * cover). Production never preloads: a cold route fetches none of them until a form is focused or
 * a command is sent.
 */
export const preloadWorkflowAnswerMachinery = async (): Promise<void> => {
  await Promise.all([
    import('./cms-workflow-command-transport'),
    import('./cms-workflow-refusal'),
    import('./cms-workflow-canonical-read'),
    // The governed forms answer the same way (governed-answer-machinery.ts).
    import('../cms-governed-review/governed-review-command-transport'),
    import('../cms-governed-review/governed-review-refusal'),
    import('../cms-governed-review/governed-review-canonical-read'),
  ]);
};
