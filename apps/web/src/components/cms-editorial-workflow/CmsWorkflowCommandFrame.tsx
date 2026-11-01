import * as React from 'react';

import { warmCmsValidators } from '../../lib/cms-contract-validators';
import { REGION_ATTRIBUTE, markRegionHydrated } from './cms-lazy-intent';
import { warmWorkflowAnswerMachinery } from './cms-workflow-answer-machinery';
import CmsWorkflowLocalErrors from './CmsWorkflowLocalErrors';
import CmsWorkflowSyncConflict from './CmsWorkflowSyncConflict';
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
  /**
   * Set when the form loads on intent (`cms-lazy-view.tsx` `loadViewOnIntent`): the name of its
   * region. The server markup carries it, and the mounted frame marks it hydrated. A form that
   * does not load on intent is still a region, named by its heading id.
   */
  readonly lazyRegion?: string;
  /**
   * What the canonical re-read settled after a lost answer, when it settled it: the sentence
   * that replaces the retry offer (FE03 governed reconciliation, DEC-113 and DEC-137). A form
   * sets it once its reconciled read shows the command was recorded, or can no longer be
   * repeated; the same request is then never offered again.
   */
  readonly settled?: string | null;
  readonly children: React.ReactNode;
}

/** A sign of intent: warm what the check and the send of this form will need. */
const warmCommandForm = (): void => {
  warmCmsValidators();
  warmWorkflowAnswerMachinery();
};

const UNKNOWN_WAITING =
  'The result could not be confirmed. Checking the current state before you retry.';
const UNKNOWN_READY =
  'The current state is loaded. You can retry the same request.';

/** The one polite sentence of a form, derived from its phase. */
export const workflowStatusText = <TResource,>(
  state: CommandState<TResource>,
  pendingLabel: string,
  committedLabel: (resource: TResource) => string,
  settled: string | null = null,
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
      if (!state.reconciled) return UNKNOWN_WAITING;
      return settled ?? UNKNOWN_READY;
    default:
      return '';
  }
};

/**
 * Focusing any control of the form starts loading the lazy validators its
 * submit checks need (a sign of intent; a cold load fetches none of them).
 *
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
  lazyRegion,
  settled = null,
  children,
}: CmsWorkflowCommandFrameProps<TResource>): React.ReactElement {
  const sectionRef = React.useRef<HTMLElement>(null);
  // Every command form is a region (its own heading id unless it names one): a form that loads
  // with the page still hydrates after its server markup is visible, and what a person chose,
  // typed or pressed in between is kept and replayed (`cms-lazy-intent.ts`), not lost.
  const region = lazyRegion ?? headingId;
  React.useLayoutEffect(() => {
    if (sectionRef.current !== null) markRegionHydrated(sectionRef.current);
  }, [region]);
  const alertShown =
    state.phase === 'refused' ||
    state.phase === 'step-up-unavailable' ||
    state.phase === 'signed-out';

  const localRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (localErrors.length > 0) localRef.current?.focus();
  }, [localErrors]);

  // A committed sentence belongs to the island's line, which outlives this form.
  const statusText = workflowStatusText(
    state,
    pendingLabel,
    committedLabel,
    settled,
  );
  const handedOver = useCommittedAnnouncement(state.phase, statusText);

  return (
    <section
      ref={sectionRef}
      aria-labelledby={headingId}
      {...{ [REGION_ATTRIBUTE]: region }}
      data-cms-workflow-form=""
      className="cms-workflow-form"
      onFocus={warmCommandForm}
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
        <CmsWorkflowSyncConflict
          headingId={headingId}
          conflict={state.conflict}
          onAcknowledge={controller.acknowledgeConflict}
        />
      ) : null}
      <CmsWorkflowLocalErrors errors={localErrors} focusRef={localRef} />
      {alertShown ? (
        <CmsWorkflowRefusalAlert
          headingId={headingId}
          state={state}
          fieldIds={fieldIds}
        />
      ) : null}
      {state.phase === 'unknown' && !(state.reconciled && settled !== null) ? (
        <p>
          <button
            type="button"
            id={`${headingId}-check`}
            data-cms-workflow-check=""
            onClick={() => void controller.reconcile()}
          >
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
