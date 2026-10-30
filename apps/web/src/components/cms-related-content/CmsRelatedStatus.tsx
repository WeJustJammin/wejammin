import * as React from 'react';

import CmsEditorialCapabilityGate from '../cms-editorial/CmsEditorialCapabilityGate';
import { MAX_CANDIDATES_ID, RULE_NONE_ID } from './CmsRelatedRuleFields';
import { EXCLUSIONS_HEADING_ID } from './CmsRelatedExclusionList';
import { PINS_HEADING_ID } from './CmsRelatedPinList';
import type { RequestIssueTarget } from './related-content-request';
import { RELATED_RULES, ruleByKey, type RelatedRuleKey } from './related-rules';
import { failureCopy, failureHeading } from './related-status-copy';
import {
  RELATED_RESULT_HEADING_ID,
  type RelatedStatus,
} from './use-related-content-form';

const LINK_TARGET: Readonly<Record<RequestIssueTarget, string>> = {
  pins: PINS_HEADING_ID,
  exclusions: EXCLUSIONS_HEADING_ID,
  rule: RULE_NONE_ID,
  maxCandidates: MAX_CANDIDATES_ID,
  form: RELATED_RESULT_HEADING_ID,
};

interface Props {
  readonly status: RelatedStatus;
  readonly returnTo: string;
}

/** FE03 1048: a 403 renders the CapabilityGate copy (never a step-up route). */
const isCapabilityDenial = (
  result: Extract<RelatedStatus, { kind: 'result' }>['result'],
): boolean =>
  (result.kind === 'refused' && result.reason === 'capability_missing') ||
  (result.kind === 'rejected' && result.status === 403);

const ruleSentence = (key: string): string => {
  const member = ruleByKey(key);
  return member === null
    ? 'a derived rule'
    : `the ${RELATED_RULES[key as RelatedRuleKey].label} rule`;
};

/** The one focusable result region: error summary, outcome and the next action. */
export default function CmsRelatedStatus({
  status,
  returnTo,
}: Props): React.ReactElement | null {
  if (status.kind === 'idle') return null;
  if (status.kind === 'pending')
    return (
      <div className="cms-related-status" role="status">
        Saving related content…
      </div>
    );
  const alert = status.kind === 'invalid' || status.kind === 'result';
  return (
    <div className="cms-related-status" role={alert ? 'alert' : 'status'}>
      {status.kind === 'invalid' ? (
        <>
          <h2 id={RELATED_RESULT_HEADING_ID} tabIndex={-1}>
            Check the related content
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
                  href={`#${LINK_TARGET[issue.target]}`}
                  onClick={(event) => {
                    const control = document.getElementById(
                      LINK_TARGET[issue.target],
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
          <h2 id={RELATED_RESULT_HEADING_ID} tabIndex={-1}>
            Related content saved
          </h2>
          <p>
            {status.saved.pins.length} pinned, {status.saved.exclusions.length}{' '}
            excluded,{' '}
            {status.saved.derivedRule === null
              ? 'no derived rule'
              : ruleSentence(status.saved.derivedRule.key)}
            . {status.saved.eligibleCount}{' '}
            {status.saved.eligibleCount === 1 ? 'entry is' : 'entries are'}{' '}
            eligible to be shown now.
          </p>
        </>
      ) : null}
      {status.kind === 'result' && isCapabilityDenial(status.result) ? (
        <CmsEditorialCapabilityGate
          headingId={RELATED_RESULT_HEADING_ID}
          title={failureHeading(status.result)}
          reason={failureCopy(status.result)}
          focusable
        />
      ) : null}
      {status.kind === 'result' && !isCapabilityDenial(status.result) ? (
        <>
          <h2 id={RELATED_RESULT_HEADING_ID} tabIndex={-1}>
            {failureHeading(status.result)}
          </h2>
          <p>{failureCopy(status.result)}</p>
          {status.result.kind === 'conflict' ? (
            <p>
              <a href={returnTo}>Reload this page</a>
            </p>
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
