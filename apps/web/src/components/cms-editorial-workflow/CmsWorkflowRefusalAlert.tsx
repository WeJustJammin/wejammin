import * as React from 'react';

import CmsEditorialCapabilityGate from '../cms-editorial/CmsEditorialCapabilityGate';
import CmsEditorialPreflightSummary from './CmsEditorialPreflightSummary';
import type { CommandState } from './cms-workflow-command-controller';

export interface WorkflowFieldReference {
  readonly id: string;
  readonly label: string;
}

export interface CmsWorkflowRefusalAlertProps {
  readonly headingId: string;
  readonly state: CommandState<unknown>;
  /** The controls a refusal can name, by field name. */
  readonly fieldIds: Readonly<Record<string, WorkflowFieldReference>>;
}

const reference = (requestId: string | null): React.ReactNode =>
  requestId === null ? null : <p>Reference: {requestId}</p>;

/**
 * The one alert of a command form (a refusal, an unavailable step-up or an ended
 * session). It is rendered only while one applies, and it takes focus when it
 * appears and whenever what it says changes (a named result, FE03).
 */
export default function CmsWorkflowRefusalAlert({
  headingId,
  state,
  fieldIds,
}: CmsWorkflowRefusalAlertProps): React.ReactElement {
  const alertRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    alertRef.current?.focus();
  }, [state.refusal, state.stepUpIssue, state.signInHref]);
  const refusal = state.phase === 'refused' ? state.refusal : null;
  const links = (refusal?.fields ?? []).flatMap((name) => {
    const field = fieldIds[name];
    return field === undefined ? [] : [field];
  });
  return (
    <div
      role="alert"
      tabIndex={-1}
      ref={alertRef}
      data-cms-workflow-refusal={refusal?.kind ?? state.phase}
    >
      {refusal === null ? null : refusal.kind === 'gate' ? (
        <CmsEditorialCapabilityGate
          headingId={`${headingId}-gate`}
          title="Not available to you"
          reason={refusal.message}
          requestId={refusal.requestId}
        />
      ) : (
        <>
          <p>{refusal.message}</p>
          {refusal.preflight === null ? null : (
            <CmsEditorialPreflightSummary
              headingId={`${headingId}-checks`}
              title="Checks that did not pass"
              results={refusal.preflight}
            />
          )}
          {links.length === 0 ? null : (
            <ul>
              {links.map((field) => (
                <li key={field.id}>
                  <a href={`#${field.id}`}>{field.label}</a>
                </li>
              ))}
            </ul>
          )}
          {reference(refusal.requestId)}
        </>
      )}
      {state.phase === 'step-up-unavailable' && state.stepUpIssue !== null ? (
        <>
          <p>
            {state.stepUpIssue.kind === 'no-method'
              ? 'No verification method is available. Nothing was sent.'
              : 'Verification could not be started. Nothing was sent.'}
          </p>
          {reference(state.stepUpIssue.requestId)}
        </>
      ) : null}
      {state.phase === 'signed-out' ? (
        <>
          <p>Your session expired. Your entries were not saved.</p>
          {state.signInHref === null ? null : (
            <p>
              <a href={state.signInHref}>Sign in again</a>
            </p>
          )}
          {reference(state.requestId)}
        </>
      ) : null}
    </div>
  );
}
