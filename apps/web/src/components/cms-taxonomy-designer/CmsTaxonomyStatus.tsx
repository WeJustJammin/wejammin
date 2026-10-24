import * as React from 'react';

import {
  TAXONOMY_RESULT_HEADING_ID,
  TAXONOMY_STATUS_ID,
  issueDomId,
} from './taxonomy-designer-ids';
import type { TaxonomyFormStatus } from './taxonomy-designer-status';
import type { TaxonomySubmitResult } from './taxonomy-designer-submit';

const REJECTED_COPY: Readonly<Record<number, string>> = {
  400: 'The server could not read the vocabulary. Review the form and try again. Nothing was saved.',
  403: 'Taxonomy curator access is required for this acting context. Nothing was saved.',
  404: 'This vocabulary is unavailable to the current acting context. Nothing was saved.',
  415: 'The server could not read the vocabulary. Reload the page and try again. Nothing was saved.',
  422: 'The server rejected the vocabulary. Review the form and try again. Nothing was saved.',
};
const UNAVAILABLE =
  'The vocabulary service is unavailable. Your entries remain here for a later retry.';
const CAPABILITY =
  'Taxonomy curator access is required for this acting context. Nothing was saved.';

type Failure = Exclude<TaxonomySubmitResult, { kind: 'created' }>;

const copyOf = (result: Failure): string => {
  switch (result.kind) {
    case 'uncertain':
      return 'The result is unknown. Your entries remain here. Check the latest version before changing anything; retrying these unchanged values reuses the same idempotency key, so it cannot save twice.';
    case 'conflict':
      return 'Another version of this vocabulary was saved after the one you started from. Nothing was overwritten. Check the latest version, then choose how to continue.';
    case 'refused':
      return CAPABILITY;
    case 'rejected':
      if (result.status === 401)
        return 'Your session expired. Sign in again before submitting; your entries remain here.';
      if (result.status === 429)
        return result.retryAfterSeconds === undefined
          ? 'The request was rate-limited. Wait before retrying.'
          : `The request was rate-limited. Wait at least ${result.retryAfterSeconds} seconds before retrying.`;
      return REJECTED_COPY[result.status] ?? UNAVAILABLE;
  }
};

const headingOf = (result: Failure): string =>
  result.kind === 'uncertain'
    ? 'The result is unknown'
    : result.kind === 'conflict'
      ? 'Another version was saved'
      : 'The vocabulary was not saved';

interface Props {
  readonly status: TaxonomyFormStatus;
  readonly summaryRef: React.Ref<HTMLDivElement>;
  readonly returnTo: string;
}

/** The one focusable result region: error summary, outcome and the next action. */
export default function CmsTaxonomyStatus({
  status,
  summaryRef,
  returnTo,
}: Props): React.ReactElement {
  const items = status.kind === 'invalid' ? status.items : [];
  const alert = status.kind === 'invalid' || status.kind === 'result';
  return (
    <div
      id={TAXONOMY_STATUS_ID}
      ref={summaryRef}
      className="cms-taxonomy-status"
      role={alert ? 'alert' : 'status'}
      aria-live={alert ? undefined : 'polite'}
      tabIndex={-1}
    >
      {status.kind === 'invalid' ? (
        <>
          <h3 id={TAXONOMY_RESULT_HEADING_ID} tabIndex={-1}>
            Check the vocabulary
          </h3>
          <p>
            {items.length} {items.length === 1 ? 'problem' : 'problems'} to fix;
            nothing was sent.
          </p>
          <ul>
            {items.map((item) => (
              <li key={`${item.field}-${item.message}`}>
                <a
                  href={`#${issueDomId(item.field)}`}
                  onClick={(event) => {
                    const control = document.getElementById(
                      issueDomId(item.field),
                    );
                    if (control === null) return;
                    event.preventDefault();
                    control.focus();
                    control.scrollIntoView?.({ block: 'center' });
                  }}
                >
                  {item.message}
                </a>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {status.kind === 'pending' ? <p>Saving the vocabulary draft…</p> : null}
      {status.kind === 'unsaved' ? (
        <>
          <h3 id={TAXONOMY_RESULT_HEADING_ID} tabIndex={-1}>
            Nothing was saved
          </h3>
          <p>
            The save did not reach a result, so the server&apos;s latest version
            was checked: it holds nothing from this attempt. Your entries remain
            here; you can save again, and the unchanged values reuse the same
            idempotency key, so a late arrival cannot save twice.
          </p>
        </>
      ) : null}
      {status.kind === 'result' ? (
        <>
          <h3 id={TAXONOMY_RESULT_HEADING_ID} tabIndex={-1}>
            {headingOf(status.result)}
          </h3>
          <p>{copyOf(status.result)}</p>
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
      {status.kind === 'created' ? (
        <>
          <h3 id={TAXONOMY_RESULT_HEADING_ID} tabIndex={-1}>
            Vocabulary draft saved
          </h3>
          <p>
            It is a private draft, not an active vocabulary. Submit it for
            review from its page; terms can be added once a version is active.
          </p>
          <dl className="cms-taxonomy-facts">
            <div>
              <dt>Vocabulary</dt>
              <dd>{status.resource.taxonomyKey}</dd>
            </div>
            <div>
              <dt>Version</dt>
              <dd>{status.resource.version}</dd>
            </div>
            <div>
              <dt>Lifecycle</dt>
              <dd>Draft</dd>
            </div>
          </dl>
          <p>
            <a
              href={`/app/cms-content-modeling/taxonomies/${status.resource.taxonomyId}`}
            >
              Open the vocabulary to submit it for review
            </a>
          </p>
        </>
      ) : null}
    </div>
  );
}
