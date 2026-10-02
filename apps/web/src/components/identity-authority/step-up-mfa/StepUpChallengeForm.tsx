import * as React from 'react';

import type { MfaApiDeps } from './mfa-api';
import { OneTimeCodeField } from './OneTimeCodeField';
import { stepUpSignInHref } from './step-up-return';
import type { StepUpChannelPort } from './step-up-channel';
import type { StepUpFactorChoice, StepUpPhase } from './step-up-phase';
import { LockoutNotice } from './LockoutNotice';
import {
  StepUpChooseFactor,
  StepUpNoFactor,
  StepUpRecovery,
} from './StepUpPhases';
import { useStepUpChallenge } from './use-step-up-challenge';

export interface StepUpChallengeFormProps {
  children?: never;
  variant: 'authPage';
  /** Server-validated; never re-read from the URL on the client. */
  returnTo: string;
  factors: readonly StepUpFactorChoice[];
  initialPhase: StepUpPhase;
  /** Display-only: set when the server already sees a fresh proof. */
  initialFreshUntil?: string | null;
  api?: MfaApiDeps;
  navigate?: (href: string) => void;
  reload?: () => void;
  channel?: StepUpChannelPort | null;
}

const reloadPage = (): void => window.location.reload();

/** FE01 lost-access entry: the sign-in recovery path, never a step-up bypass. */
const LOST_ACCESS_LABEL = 'Lost your authenticator? Recover your account';

/** FE01 step-up island: challenge, code entry, and a full navigation back. */
export function StepUpChallengeForm({
  returnTo,
  factors,
  initialPhase,
  initialFreshUntil = null,
  api,
  navigate,
  reload = reloadPage,
  channel,
}: StepUpChallengeFormProps): React.ReactElement {
  const { state, actions, lockout } = useStepUpChallenge({
    returnTo,
    factors,
    initialPhase,
    initialFreshUntil,
    api,
    navigate,
    channel,
  });
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  React.useEffect(() => {
    if (state.focus !== 'field') return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [state.focus, state.fieldError, state.phase]);

  const locked = lockout.remainingSeconds !== null;
  const showForm =
    (state.phase === 'awaiting-code' || state.phase === 'verifying') &&
    state.challengeId !== null;
  return (
    <section className="infra-workbench" aria-labelledby="step-up-heading">
      <h2 id="step-up-heading">Confirm with your authenticator</h2>
      <p role="status" aria-live="polite" aria-atomic="true">
        {state.announcement}
      </p>
      {state.freshUntil !== null && (
        <p>
          Your account is already verified until{' '}
          <time dateTime={state.freshUntil}>
            {new Date(state.freshUntil).toLocaleTimeString()}
          </time>
          . <a href={returnTo}>Continue</a>
        </p>
      )}
      {state.phase === 'no-factor' && <StepUpNoFactor returnTo={returnTo} />}
      {state.phase === 'choosing-factor' && (
        <StepUpChooseFactor factors={factors} state={state} actions={actions} />
      )}
      {state.phase === 'creating-challenge' && (
        <p>Preparing your code request.</p>
      )}
      {state.phase === 'signed-out' && (
        <p>
          Your session ended.{' '}
          <a href={stepUpSignInHref(returnTo)}>Sign in again</a>
        </p>
      )}
      <StepUpRecovery
        state={state}
        retry={actions.newChallenge}
        reload={reload}
      />
      {showForm && (
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            actions.submit();
          }}
        >
          <p>
            Open <strong>{state.factorName}</strong> and enter the 6-digit code.
          </p>
          <OneTimeCodeField
            name="code"
            label="6-digit code"
            describedBy="step-up-code-help"
            help="Spaces and hyphens are fine. The code changes every 30 seconds."
            errorId={state.fieldError === null ? null : 'step-up-code-error'}
            errorMessage={state.fieldError}
            readOnly={state.phase === 'verifying'}
            value={state.code}
            onChange={actions.setCode}
            inputRef={inputRef}
          />
          {lockout.remainingSeconds !== null && (
            <LockoutNotice remainingSeconds={lockout.remainingSeconds} />
          )}
          <button type="submit" disabled={locked}>
            {state.phase === 'verifying' ? 'Verifying' : 'Verify'}
          </button>
        </form>
      )}
      {state.phase !== 'signed-out' && (
        <p className="infra-help">
          <a href={stepUpSignInHref(returnTo)}>{LOST_ACCESS_LABEL}</a>
        </p>
      )}
    </section>
  );
}

export default StepUpChallengeForm;
