import * as React from 'react';

import { mfaSettingsHref } from './step-up-return';
import type { StepUpFactorChoice } from './step-up-phase';
import type { StepUpActions, StepUpUiState } from './use-step-up-challenge';

export function StepUpNoFactor({
  returnTo,
}: Readonly<{ returnTo: string }>): React.ReactElement {
  return (
    <div>
      <p>
        A verified authenticator is required for this action. Set one up, then
        come back to continue.
      </p>
      <p>
        <a href={mfaSettingsHref(returnTo)}>Set up an authenticator</a>
      </p>
      <p>
        <a href={returnTo}>Go back</a>
      </p>
    </div>
  );
}

export function StepUpChooseFactor({
  factors,
  state,
  actions,
}: Readonly<{
  factors: readonly StepUpFactorChoice[];
  state: StepUpUiState;
  actions: StepUpActions;
}>): React.ReactElement {
  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        actions.continueWithFactor();
      }}
    >
      <fieldset role="radiogroup" aria-labelledby="step-up-choose-legend">
        <legend id="step-up-choose-legend">Choose an authenticator</legend>
        {factors.map((factor) => (
          <label key={factor.id} className="infra-choice">
            <input
              type="radio"
              name="factorId"
              value={factor.id}
              checked={state.selectedFactorId === factor.id}
              onChange={() => actions.chooseFactor(factor.id)}
            />{' '}
            {factor.friendlyName}
          </label>
        ))}
      </fieldset>
      <button type="submit">Continue</button>
    </form>
  );
}

export function StepUpRecovery({
  state,
  retry,
  reload,
}: Readonly<{
  state: StepUpUiState;
  retry: () => void;
  reload: () => void;
}>): React.ReactElement | null {
  const failure = state.failure;
  const buttonRef = React.useRef<HTMLButtonElement | null>(null);
  React.useEffect(() => {
    if (state.focus === 'retry') buttonRef.current?.focus();
  }, [state.focus, failure]);
  if (failure === null || failure.message === null) return null;
  return (
    <div role="alert" className="infra-error">
      <p>{failure.message}</p>
      {failure.showRequestId && state.requestId !== null && (
        <p className="infra-request-id">
          Request ID: <code>{state.requestId}</code>
        </p>
      )}
      {failure.needsReload ? (
        <button type="button" onClick={reload}>
          Reload
        </button>
      ) : (
        failure.retryLabel !== null && (
          <button ref={buttonRef} type="button" onClick={retry}>
            {failure.retryLabel}
          </button>
        )
      )}
    </div>
  );
}
