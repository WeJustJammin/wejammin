import * as React from 'react';

import CmsEditorialCapabilityGate from '../cms-editorial/CmsEditorialCapabilityGate';
import CmsTaxonomyCanonicalId from './CmsTaxonomyCanonicalId';
import type { TermFacts } from './taxonomy-terms-read';
import type { TermIssue } from './term-action-request';
import { failureCopy, failureHeading } from './term-status-copy';
import {
  TERM_FORM_HEADING_ID,
  TERM_RESULT_HEADING_ID,
  type TermStatus,
} from './use-term-form';

const LINK_TARGET: Readonly<Record<TermIssue['field'], string>> = {
  termKey: 'cms-term-key',
  labels: 'cms-term-labels',
  aliases: 'cms-term-alias-input',
  parentId: 'cms-term-parent',
  survivorId: 'cms-term-survivor',
  form: TERM_FORM_HEADING_ID,
};

const DONE_HEADING = {
  create: (key: string) => `Term ${key} created`,
  rename: (key: string) => `Term ${key} renamed`,
  alias: (key: string) => `Alias added to ${key}`,
  deprecate: (key: string) => `Term ${key} deprecated`,
  merge: (key: string) => `Term ${key} merged`,
} as const;

interface Props {
  readonly status: TermStatus;
  /** The terms of the loaded page, to name a merge survivor. */
  readonly terms: readonly TermFacts[];
  readonly reviewHref: string;
  readonly returnTo: string;
}

/** FE03 1048: a 403 renders the CapabilityGate copy (never a step-up route). */
const isCapabilityDenial = (
  result: Extract<TermStatus, { kind: 'result' }>['result'],
): boolean =>
  (result.kind === 'refused' && result.reason === 'capability_missing') ||
  (result.kind === 'rejected' && result.status === 403);

const doneBody = (
  status: Extract<TermStatus, { kind: 'done' }>,
  terms: readonly TermFacts[],
): string => {
  const { term, action } = status;
  if (action === 'merge') {
    const survivor = terms.find((entry) => entry.termId === term.successorId);
    return `${term.termKey} now redirects permanently to ${survivor?.termKey ?? 'its surviving term'}. Every use of it moved there.`;
  }
  if (action === 'deprecate')
    return `${term.termKey} stays resolvable, but authors can no longer choose it.`;
  return action === 'create'
    ? `${term.termKey} is active and available to authors.`
    : `The list shows the change.`;
};

/** The one focusable result region: error summary, outcome and the next action. */
export default function CmsTaxonomyTermStatus({
  status,
  terms,
  reviewHref,
  returnTo,
}: Props): React.ReactElement | null {
  if (status.kind === 'idle') return null;
  if (status.kind === 'pending')
    return (
      <div className="cms-term-status" role="status">
        Saving the term…
      </div>
    );
  const alert = status.kind === 'invalid' || status.kind === 'result';
  return (
    <div
      className="cms-term-status"
      role={alert ? 'alert' : 'status'}
      aria-live={alert ? undefined : 'polite'}
    >
      {status.kind === 'invalid' ? (
        <>
          <h3 id={TERM_RESULT_HEADING_ID} tabIndex={-1}>
            Check the term
          </h3>
          <p>
            {status.issues.length}{' '}
            {status.issues.length === 1 ? 'problem' : 'problems'} to fix;
            nothing was sent.
          </p>
          <ul>
            {status.issues.map((issue) => (
              <li key={`${issue.code}-${issue.row ?? ''}`}>
                <a
                  href={`#${LINK_TARGET[issue.field]}`}
                  onClick={(event) => {
                    const control = document.getElementById(
                      LINK_TARGET[issue.field],
                    );
                    if (control === null) return;
                    event.preventDefault();
                    control.focus();
                  }}
                >
                  {issue.row === undefined ? '' : `Label ${issue.row + 1}: `}
                  {issue.message}
                </a>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {status.kind === 'done' ? (
        <>
          <h3 id={TERM_RESULT_HEADING_ID} tabIndex={-1}>
            {DONE_HEADING[status.action](status.term.termKey)}
          </h3>
          <p>{doneBody(status, terms)}</p>
        </>
      ) : null}
      {status.kind === 'result' && isCapabilityDenial(status.result) ? (
        <CmsEditorialCapabilityGate
          headingId={TERM_RESULT_HEADING_ID}
          title={failureHeading(status.result)}
          reason={failureCopy(status.result)}
          focusable
        />
      ) : null}
      {status.kind === 'result' && !isCapabilityDenial(status.result) ? (
        <>
          <h3 id={TERM_RESULT_HEADING_ID} tabIndex={-1}>
            {failureHeading(status.result)}
          </h3>
          <p>{failureCopy(status.result)}</p>
          {status.result.kind === 'refused' &&
          status.result.reason === 'canonical_overlap' &&
          status.result.canonicalId !== undefined ? (
            <CmsTaxonomyCanonicalId canonicalId={status.result.canonicalId} />
          ) : null}
          {status.result.kind === 'refused' &&
          status.result.reason === 'taxonomy_not_active' ? (
            <p>
              <a href={reviewHref}>
                Open the vocabulary&apos;s governed review
              </a>
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
