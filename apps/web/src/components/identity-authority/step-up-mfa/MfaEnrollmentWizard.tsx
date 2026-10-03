import * as React from 'react';

import CapabilityGate from '../../infrastructure/CapabilityGate';
import type { MfaApiDeps } from './mfa-api';
import { MfaFactorList } from './MfaFactorList';
import { MfaNameStep } from './MfaNameStep';
import { MfaNotice } from './MfaNotice';
import { MfaRemoveConfirmation } from './MfaRemoveConfirmation';
import { MfaScanStep } from './MfaScanStep';
import type { StepUpChannelPort } from './step-up-channel';
import type { MfaFactorSummary, StepUpState } from './step-up-phase';
import { useMfaWizard } from './use-mfa-wizard';

export interface MfaEnrollmentWizardProps {
  children?: never;
  variant: 'authPage';
  /** Set only when entered from `/step-up` or a protected form. */
  returnTo: string | null;
  factors: readonly MfaFactorSummary[];
  allowedMethods: readonly string[];
  stepUp: StepUpState;
  /** The AUTH-API-16 ETag, sent as If-Match. */
  expectedVersion: string;
  api?: MfaApiDeps;
  navigate?: (href: string) => void;
  reload?: () => void;
  channel?: StepUpChannelPort | null;
  currentLocation?: Readonly<{ pathname: string; search: string }>;
}

/** FE01 `/settings/security/mfa`: factor list plus the inline three-step wizard. */
export function MfaEnrollmentWizard(
  props: MfaEnrollmentWizardProps,
): React.ReactElement {
  const { state, actions, lockout } = useMfaWizard({
    returnTo: props.returnTo,
    factors: props.factors,
    stepUp: props.stepUp,
    expectedVersion: props.expectedVersion,
    api: props.api,
    navigate: props.navigate,
    reload: props.reload,
    channel: props.channel,
    currentLocation: props.currentLocation,
  });
  const headingRef = React.useRef<HTMLHeadingElement | null>(null);
  const nameRef = React.useRef<HTMLInputElement | null>(null);
  const codeRef = React.useRef<HTMLInputElement | null>(null);
  React.useEffect(() => {
    const target = state.focus?.target;
    if (target === 'heading') headingRef.current?.focus();
    else if (target === 'name') nameRef.current?.focus();
    else if (target === 'code') {
      codeRef.current?.focus();
      codeRef.current?.select();
    }
  }, [state.focus]);

  const gated = state.notice?.kind === 'gate';
  const removing = state.factors.find((f) => f.id === state.removal?.factorId);
  const verifiedCount = state.factors.filter(
    (f) => f.state === 'verified',
  ).length;
  const allowed = props.allowedMethods.includes('totp');
  return (
    <section
      className="infra-workbench"
      aria-labelledby="mfa-factor-list-heading"
    >
      <h2 id="mfa-factor-list-heading" ref={headingRef} tabIndex={-1}>
        Authenticators
      </h2>
      <p role="status" aria-live="polite" aria-atomic="true">
        {state.announcement}
      </p>
      {!allowed && <p role="alert">No verification method is available.</p>}
      {state.notice !== null && (
        <MfaNotice
          notice={state.notice}
          onRetry={actions.retry}
          onReload={actions.reload}
          onStartAgain={() => actions.openName()}
        />
      )}
      {gated && state.notice !== null && (
        <CapabilityGate variant="disabled" disclosure={state.notice.message} />
      )}
      <MfaFactorList
        factors={state.factors}
        busy={state.busy}
        onRemove={actions.openRemoval}
        onStartAgain={actions.openName}
        onCancelSetup={actions.cancelPending}
        onRefresh={actions.refresh}
      />
      {removing !== undefined && state.removal !== null && (
        <MfaRemoveConfirmation
          name={removing.friendlyName}
          lastVerified={removing.state === 'verified' && verifiedCount === 1}
          reason={state.removal.reason}
          busy={state.busy}
          onReason={actions.setRemovalReason}
          onConfirm={actions.confirmRemoval}
          onCancel={actions.closeRemoval}
        />
      )}
      {state.step === 'idle' && allowed && state.removal === null && (
        <button type="button" onClick={() => actions.openName()}>
          Set up an authenticator
        </button>
      )}
      {state.step === 'name' && (
        <MfaNameStep
          name={state.name}
          error={state.nameError}
          busy={state.busy}
          gated={gated}
          lockedSeconds={lockout.remainingSeconds}
          inputRef={nameRef}
          onChange={actions.setName}
          onSubmit={actions.submitName}
          onCancel={actions.closeName}
        />
      )}
      {state.step === 'scan' && state.secret !== null && (
        <MfaScanStep
          secret={state.secret}
          code={state.code}
          error={state.codeError}
          busy={state.busy}
          lockedSeconds={lockout.remainingSeconds}
          inputRef={codeRef}
          onCode={actions.setCode}
          onSubmit={actions.submitCode}
          onCopy={actions.copyKey}
          onCancel={() => actions.cancelPending(state.secret?.factorId ?? '')}
        />
      )}
      {state.step === 'done' && (
        <section aria-labelledby="mfa-done-heading">
          <h3 id="mfa-done-heading">Authenticator added</h3>
          {state.doneFreshUntil !== null && (
            <p>
              Verified until{' '}
              <time dateTime={state.doneFreshUntil}>
                {new Date(state.doneFreshUntil).toLocaleTimeString()}
              </time>
              .
            </p>
          )}
          <p>
            If you lose every authenticator, account recovery by email comes
            first, then an administrator resets your authenticators. There are
            no recovery codes.
          </p>
          {props.returnTo === null ? (
            <a
              className="mfa-standalone-link"
              href="#mfa-factor-list-heading"
              onClick={actions.dismissDone}
            >
              Back to your authenticators
            </a>
          ) : (
            <a className="mfa-standalone-link" href={props.returnTo}>
              Continue
            </a>
          )}
        </section>
      )}
    </section>
  );
}

export default MfaEnrollmentWizard;
