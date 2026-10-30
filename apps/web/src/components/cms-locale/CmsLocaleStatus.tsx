import * as React from 'react';

import CmsEditorialCapabilityGate from '../cms-editorial/CmsEditorialCapabilityGate';
import {
  failureCopy,
  failureHeading,
  LOCALE_RESULT_HEADING_ID,
  MISMATCH_FOLLOW_UP,
} from './locale-variant-copy';
import type { LocaleStatus } from './use-locale-variant-form';

interface Props {
  readonly status: LocaleStatus;
  readonly locale: string;
  readonly returnTo: string;
  /** Field id to the id of its control, for the summary links. */
  readonly controlIdFor: (target: string) => string;
}

/** FE03 1048: a 403 renders the CapabilityGate copy (never a step-up route). */
const isCapabilityDenial = (
  result: Extract<LocaleStatus, { kind: 'result' }>['result'],
): boolean => result.kind === 'rejected' && result.status === 403;

/** The one focusable result region: error summary, outcome and the next action. */
export default function CmsLocaleStatus({
  status,
  locale,
  returnTo,
  controlIdFor,
}: Props): React.ReactElement | null {
  if (status.kind === 'idle') return null;
  if (status.kind === 'pending')
    return (
      <div className="cms-locale-status" role="status">
        Saving translation…
      </div>
    );
  const alert = status.kind === 'invalid' || status.kind === 'result';
  return (
    <div className="cms-locale-status" role={alert ? 'alert' : 'status'}>
      {status.kind === 'invalid' ? (
        <>
          <h2 id={LOCALE_RESULT_HEADING_ID} tabIndex={-1}>
            Check the translation
          </h2>
          <p>
            {status.issues.length}{' '}
            {status.issues.length === 1 ? 'problem' : 'problems'} to fix;
            nothing was sent.
          </p>
          <ul>
            {status.issues.map((issue) => (
              <li key={`${issue.code}-${issue.target}`}>
                <a
                  href={`#${controlIdFor(issue.target)}`}
                  onClick={(event) => {
                    const control = document.getElementById(
                      controlIdFor(issue.target),
                    );
                    if (control === null) return;
                    event.preventDefault();
                    control.focus();
                  }}
                >
                  {issue.message}
                </a>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {status.kind === 'saved' ? (
        <>
          <h2 id={LOCALE_RESULT_HEADING_ID} tabIndex={-1}>
            Translation saved as a draft
          </h2>
          <p>
            State: Draft. {status.saved.savedFieldIds.length}{' '}
            {status.saved.savedFieldIds.length === 1 ? 'field' : 'fields'} saved
            in {locale}. It becomes approved only through the editorial review
            of this language.
          </p>
        </>
      ) : null}
      {status.kind === 'result' && isCapabilityDenial(status.result) ? (
        <CmsEditorialCapabilityGate
          headingId={LOCALE_RESULT_HEADING_ID}
          title={failureHeading(status.result)}
          reason={failureCopy(status.result, locale)}
          focusable
        />
      ) : null}
      {status.kind === 'result' && !isCapabilityDenial(status.result) ? (
        <>
          <h2 id={LOCALE_RESULT_HEADING_ID} tabIndex={-1}>
            {failureHeading(status.result)}
          </h2>
          <p>{failureCopy(status.result, locale)}</p>
          {status.result.kind === 'chain_mismatch' ? (
            <p>{MISMATCH_FOLLOW_UP}</p>
          ) : null}
          {status.result.kind === 'rejected' && status.result.status === 401 ? (
            <p>
              <a
                href={`/auth/sign-in?returnTo=${encodeURIComponent(returnTo)}`}
              >
                Sign in
              </a>
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
