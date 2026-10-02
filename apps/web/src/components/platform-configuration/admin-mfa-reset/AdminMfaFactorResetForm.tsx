import * as React from 'react';

import type { MfaApiDeps } from '../../identity-authority/step-up-mfa/mfa-api';
import type { DraftStorage } from '../../identity-authority/step-up-mfa/step-up-draft';
import type { StepUpState } from '../../identity-authority/step-up-mfa/step-up-phase';
import { stepUpHref } from '../../identity-authority/step-up-mfa/step-up-return';
import { AdminMfaResetConfirmation } from './AdminMfaResetConfirmation';
import {
  AdminMfaResetFields,
  PERSON_ID,
  REASON_ID,
} from './AdminMfaResetFields';
import {
  AdminMfaResetNotice,
  AdminMfaResetResult,
} from './AdminMfaResetNotice';
import { ADMIN_RESET_COPY } from './admin-mfa-reset-values';
import { useAdminMfaReset } from './use-admin-mfa-reset';

export interface AdminMfaFactorResetFormProps {
  children?: never;
  variant: 'adminStepUp' | 'disabledPrerequisite' | 'forbiddenHidden';
  /** Display-only; the server decides freshness. */
  stepUp: StepUpState;
  onCanonicalRefetch?: (reason: 'mutation') => Promise<void>;
  api?: MfaApiDeps;
  navigate?: (href: string) => void;
  currentLocation?: Readonly<{ pathname: string; search: string }>;
  storage?: DraftStorage | null;
}

const currentPath = (
  here: AdminMfaFactorResetFormProps['currentLocation'],
): Readonly<{ pathname: string; search: string }> =>
  here ??
  (typeof window === 'undefined'
    ? { pathname: '/app', search: '' }
    : { pathname: window.location.pathname, search: window.location.search });

/** FE05 CFG-05B-06: reset another person's two-step verification factors. */
export function AdminMfaFactorResetForm(
  props: AdminMfaFactorResetFormProps,
): React.ReactElement | null {
  const { state, actions, lockout } = useAdminMfaReset({
    api: props.api,
    navigate: props.navigate,
    currentLocation: props.currentLocation,
    storage: props.storage,
    onCanonicalRefetch: props.onCanonicalRefetch,
  });
  const personRef = React.useRef<HTMLInputElement | null>(null);
  const reasonRef = React.useRef<HTMLTextAreaElement | null>(null);
  const confirmRef = React.useRef<HTMLHeadingElement | null>(null);
  const resultRef = React.useRef<HTMLHeadingElement | null>(null);
  const noticeRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    const target = state.focus?.target;
    const element =
      target === 'person'
        ? personRef.current
        : target === 'reason'
          ? reasonRef.current
          : target === 'confirm'
            ? confirmRef.current
            : target === 'result'
              ? resultRef.current
              : target === 'notice'
                ? noticeRef.current
                : null;
    element?.focus();
  }, [state.focus]);

  if (props.variant === 'forbiddenHidden') return null;
  const here = currentPath(props.currentLocation);
  if (props.variant === 'disabledPrerequisite')
    return (
      <section
        className="infra-workbench"
        aria-labelledby="admin-mfa-reset-heading"
      >
        <h2 id="admin-mfa-reset-heading">Reset two-step verification</h2>
        <p aria-disabled="true">{ADMIN_RESET_COPY.prerequisite}</p>
        <a href={stepUpHref(here.pathname, here.search)}>
          Verify your identity
        </a>
      </section>
    );

  const confirming = state.phase !== 'editing';
  const summary = Object.entries(state.fieldErrors);
  return (
    <section
      className="infra-workbench"
      aria-labelledby="admin-mfa-reset-heading"
    >
      <h2 id="admin-mfa-reset-heading">Reset two-step verification</h2>
      <p role="status" aria-live="polite" aria-atomic="true">
        {state.announcement}
      </p>
      {state.result !== null && (
        <AdminMfaResetResult result={state.result} headingRef={resultRef} />
      )}
      {state.notice !== null && (
        <AdminMfaResetNotice
          notice={state.notice}
          remainingSeconds={lockout.remainingSeconds}
          signInHref={`/auth/sign-in?returnTo=${encodeURIComponent(here.pathname)}`}
          noticeRef={noticeRef}
          onRetry={actions.retry}
          onStartOver={actions.startOver}
        />
      )}
      {confirming ? (
        <AdminMfaResetConfirmation
          pending={state.phase === 'pending'}
          headingRef={confirmRef}
          onConfirm={actions.confirm}
          onCancel={actions.cancel}
        />
      ) : (
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            actions.review();
          }}
        >
          {state.showSummary && summary.length > 0 && (
            <div role="alert" className="infra-error">
              <ul>
                {state.fieldErrors.targetPersonId !== undefined && (
                  <li>
                    <a href={`#${PERSON_ID}`}>
                      {state.fieldErrors.targetPersonId}
                    </a>
                  </li>
                )}
                {state.fieldErrors.reason !== undefined && (
                  <li>
                    <a href={`#${REASON_ID}`}>{state.fieldErrors.reason}</a>
                  </li>
                )}
              </ul>
            </div>
          )}
          <AdminMfaResetFields
            values={state.values}
            errors={state.fieldErrors}
            readOnly={false}
            personRef={personRef}
            reasonRef={reasonRef}
            onChange={actions.setField}
            onBlurPerson={actions.blurPerson}
          />
          <button type="submit" disabled={lockout.remainingSeconds !== null}>
            Review reset
          </button>
        </form>
      )}
      <p className="infra-help">{ADMIN_RESET_COPY.runbook}</p>
    </section>
  );
}
