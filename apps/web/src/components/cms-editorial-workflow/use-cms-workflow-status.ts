import * as React from 'react';

import type { CommandPhase } from './cms-workflow-command-controller';

/**
 * What a command form may do with the one confirmation line its island owns.
 * `announce` sets it on behalf of a form; `withdraw` clears it: with no owner
 * when a new command begins, with an owner only if that form's own text is
 * still the one showing.
 */
export interface WorkflowAnnouncer {
  readonly announce: (owner: string, text: string) => void;
  readonly withdraw: (owner?: string) => void;
}

/** Null outside an island: a form mounted alone keeps its confirmation itself. */
export const WorkflowAnnouncerContext =
  React.createContext<WorkflowAnnouncer | null>(null);

interface Confirmation {
  readonly owner: string;
  readonly text: string;
}

/**
 * The island's confirmation: the text of the last committed command, kept by
 * the island (never by the form that sent the command, which the canonical
 * refetch may remove) until the next command begins, the form that produced it
 * starts over, or the island unmounts on navigation.
 */
export const useIslandConfirmation = (): Readonly<{
  announcer: WorkflowAnnouncer;
  text: string;
}> => {
  const [current, setCurrent] = React.useState<Confirmation | null>(null);
  const announcer = React.useMemo<WorkflowAnnouncer>(
    () => ({
      // The same owner and text is not a new announcement: it renders nothing.
      announce: (owner, text) =>
        setCurrent((now) =>
          now?.owner === owner && now.text === text ? now : { owner, text },
        ),
      withdraw: (owner) =>
        setCurrent((now) =>
          now === null || (owner !== undefined && now.owner !== owner)
            ? now
            : null,
        ),
    }),
    [],
  );
  return { announcer, text: current?.text ?? '' };
};

/**
 * A command form's side of the island's confirmation line. A committed command
 * hands its sentence to the island and the form stops saying it (true is
 * returned), so exactly one live region announces it. A new command, or this
 * form leaving `committed` (starting over), withdraws it. Outside an island
 * nothing is handed over and the form keeps its own line.
 */
export const useCommittedAnnouncement = (
  phase: CommandPhase,
  text: string,
): boolean => {
  const announcer = React.useContext(WorkflowAnnouncerContext);
  const owner = React.useId();
  const previous = React.useRef<CommandPhase>(phase);
  React.useEffect(() => {
    const was = previous.current;
    previous.current = phase;
    if (announcer === null) return;
    if (phase === 'committed') announcer.announce(owner, text);
    else if (phase === 'pending') announcer.withdraw();
    else if (was === 'committed') announcer.withdraw(owner);
  }, [announcer, owner, phase, text]);
  return announcer !== null && phase === 'committed';
};
