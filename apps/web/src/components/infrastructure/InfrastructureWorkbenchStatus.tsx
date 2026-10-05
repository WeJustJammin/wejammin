import OfflineStatus from './OfflineStatus';
import {
  parseContractState,
  stateAnnouncement,
  stepUpRecoveryHref,
  type ServerInitialState,
} from './infrastructure-workbench-state';

export type InfrastructureLiveStatus =
  'idle' | 'loading' | 'stale' | 'failed' | 'offline' | 'pending';

export interface InfrastructureWorkbenchStatusProps {
  readonly initial: ServerInitialState;
  readonly requestId: string;
  readonly liveStatus: InfrastructureLiveStatus;
  readonly lastKnownGoodAt: string | null;
  readonly contractFieldCount: number;
  readonly hasActorContext: boolean;
  readonly validationMessage: string | null;
  readonly onRetry: () => void;
}

export function InfrastructureWorkbenchStatus({
  initial,
  requestId,
  liveStatus,
  lastKnownGoodAt,
  contractFieldCount,
  hasActorContext,
  validationMessage,
  onRetry,
}: InfrastructureWorkbenchStatusProps) {
  const announcement =
    liveStatus === 'stale'
      ? 'A change hint arrived. Refetching canonical state.'
      : stateAnnouncement(initial, requestId);

  const parsedInitial = parseContractState(initial);
  const stepUpHref =
    parsedInitial.success && parsedInitial.data.status === 'step_up_required'
      ? stepUpRecoveryHref(parsedInitial.data)
      : null;

  return (
    <>
      <header className="infra-workbench-header">
        <p className="infra-eyebrow">Infrastructure workbench</p>
        <h2 id="infrastructure-workbench-heading">
          Current infrastructure records
        </h2>
        <p>
          Canonical state, version, and provenance are provided by the server.
          Client controls only refine this view and request a fresh canonical
          read.
        </p>
        {contractFieldCount > 0 && (
          <p className="infra-help">
            Validated contract fields: {contractFieldCount}.
          </p>
        )}
        {hasActorContext && (
          <p className="infra-help">
            Acting context is server-selected; identifiers are not accepted from
            URL state.
          </p>
        )}
      </header>

      <div
        className="infra-live-region"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {announcement}
        {liveStatus === 'failed' && ` Retry failed. Request ID: ${requestId}.`}
        {liveStatus === 'pending' &&
          ' Command pending reconciliation; no success is claimed.'}
      </div>

      {liveStatus === 'offline' && (
        <OfflineStatus
          connectivity="offline"
          requestId={requestId}
          lastKnownGoodAt={lastKnownGoodAt}
          onRetry={onRetry}
        />
      )}

      {stepUpHref !== null && (
        <section
          className="infra-step-up-recovery"
          aria-labelledby="step-up-recovery-heading"
        >
          <h3 id="step-up-recovery-heading">Verification required</h3>
          <a href={stepUpHref}>Continue to verification</a>
        </section>
      )}

      {validationMessage !== null && (
        <section
          id="validation-summary"
          className="infra-validation-summary"
          role="alert"
          aria-labelledby="validation-summary-heading"
        >
          <h3 id="validation-summary-heading">Review the highlighted values</h3>
          <p>{validationMessage}</p>
          <a href="#infrastructure-query">Return to the first filter</a>
        </section>
      )}
    </>
  );
}

export default InfrastructureWorkbenchStatus;
