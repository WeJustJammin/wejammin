import * as React from 'react';

import CmsWorkflowRefusalAlert, {
  type WorkflowFieldReference,
} from './CmsWorkflowRefusalAlert';
import type {
  CommandState,
  WorkflowCommandController,
} from './cms-workflow-command-controller';
import { useCommittedAnnouncement } from './use-cms-workflow-status';

export type { WorkflowFieldReference };

export interface WorkflowLocalError {
  readonly id: string;
  readonly label: string;
  readonly message: string;
}

export interface CmsWorkflowCommandFrameProps<TResource> {
  readonly headingId: string;
  readonly title: string;
  readonly state: CommandState<TResource>;
  readonly controller: Pick<
    WorkflowCommandController<never, TResource>,
    'retry' | 'reconcile' | 'acknowledgeConflict'
  >;
  /** The stable label of the commit control while the command is in flight. */
  readonly pendingLabel: string;
  readonly committedLabel: (resource: TResource) => string;
  /** The controls a refusal can name, by field name. */
  readonly fieldIds: Readonly<Record<string, WorkflowFieldReference>>;
  /** Field errors found before anything was sent; they take focus as one alert. */
  readonly localErrors?: readonly WorkflowLocalError[];
  /** Why the commands are withheld right now (an unverified read), else null. */
  readonly disabledReason?: string | null;
  /** The committed result, shown beside the status. */
  readonly result?: React.ReactNode;
  readonly children: React.ReactNode;
}

const UNKNOWN_WAITING =
  'The result could not be confirmed. Checking the current state before you retry.';
const UNKNOWN_READY =
  'The current state is loaded. You can retry the same request.';

/** The one polite sentence of a form, derived from its phase. */
export const workflowStatusText = <TResource,>(
  state: CommandState<TResource>,
  pendingLabel: string,
  committedLabel: (resource: TResource) => string,
): string => {
  switch (state.phase) {
    case 'pending':
      return pendingLabel;
    case 'committed':
      return state.committed === null ? '' : committedLabel(state.committed);
    case 'step-up-leaving':
      return 'Opening verification…';
    case 'restored':
      return 'Your entries were restored. Review them, then confirm.';
    case 'unknown':
      return state.reconciled ? UNKNOWN_READY : UNKNOWN_WAITING;
    default:
      return '';
  }
};

/**
 * Everything a Slice 11 command form shows that is not a field: the focusable
 * heading, the one polite status line, the refusal (an alert that takes focus,
 * with a link to each control it names), the capability gate (never a step-up
 * route), the degraded step-up and signed-out states, the unknown-outcome
 * reconcile-then-retry controls and the sync conflict after a step-up return.
 */
export default function CmsWorkflowCommandFrame<TResource>({
  headingId,
  title,
  state,
  controller,
  pendingLabel,
  committedLabel,
  fieldIds,
  localErrors = [],
  disabledReason = null,
  result = null,
  children,
}: CmsWorkflowCommandFrameProps<TResource>): React.ReactElement {
  const alertShown =
    state.phase === 'refused' ||
    state.phase === 'step-up-unavailable' ||
    state.phase === 'signed-out';

  const localRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (localErrors.length > 0) localRef.current?.focus();
  }, [localErrors]);

  // A committed sentence belongs to the island's line, which outlives this form.
  const statusText = workflowStatusText(state, pendingLabel, committedLabel);
  const handedOver = useCommittedAnnouncement(state.phase, statusText);

  return (
    <section
      aria-labelledby={headingId}
      data-cms-workflow-form=""
      className="cms-workflow-form"
    >
      <h3 id={headingId} tabIndex={-1}>
        {title}
      </h3>
      <p
        role="status"
        aria-live="polite"
        aria-atomic="true"
        data-cms-workflow-status=""
      >
        {handedOver ? '' : statusText}
      </p>
      {disabledReason === null ? null : (
        <p data-cms-workflow-disabled="">{disabledReason}</p>
      )}
      {state.phase === 'conflict' && state.conflict !== null ? (
        <section
          aria-labelledby={`${headingId}-conflict`}
          data-cms-editorial-sync-conflict="true"
        >
          <h4 id={`${headingId}-conflict`}>
            This record changed while you were verifying
          </h4>
          <p>
            You started at version {state.conflict.draftVersion ?? 'unknown'};
            the current record is version{' '}
            {state.conflict.currentVersion ?? 'unknown'}. Nothing was sent and
            your entries are kept in this browser only.
          </p>
          <button type="button" onClick={controller.acknowledgeConflict}>
            Review the current version and continue
          </button>
        </section>
      ) : null}
      {localErrors.length === 0 ? null : (
        <div
          role="alert"
          tabIndex={-1}
          ref={localRef}
          data-cms-workflow-local-errors=""
        >
          <p>Check these fields before continuing.</p>
          <ul>
            {localErrors.map((error) => (
              <li key={error.id}>
                <a href={`#${error.id}`}>{error.label}</a>: {error.message}
              </li>
            ))}
          </ul>
        </div>
      )}
      {alertShown ? (
        <CmsWorkflowRefusalAlert
          headingId={headingId}
          state={state}
          fieldIds={fieldIds}
        />
      ) : null}
      {state.phase === 'unknown' ? (
        <p>
          <button type="button" onClick={() => void controller.reconcile()}>
            Check the current state
          </button>{' '}
          <button
            type="button"
            aria-disabled={state.reconciled ? 'false' : 'true'}
            onClick={() => {
              if (state.reconciled) void controller.retry();
            }}
          >
            Retry the same request
          </button>
        </p>
      ) : null}
      {result}
      {children}
    </section>
  );
}
