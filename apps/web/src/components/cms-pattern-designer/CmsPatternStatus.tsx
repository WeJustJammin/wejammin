import * as React from 'react';

import type { IssueTarget } from './pattern-designer-request';
import CmsPatternVersionFacts from './CmsPatternVersionFacts';
import {
  PATTERN_RESULT_HEADING_ID,
  PATTERN_STATUS_ID,
  nodeNumber,
  targetDomId,
} from './pattern-designer-ids';
import { PATTERN_REFUSAL_COPY } from './pattern-designer-reasons';
import type { PatternSubmitResult } from './pattern-designer-submit';
import { locateNode, type EditableTree } from './pattern-tree-state';

/** A problem the summary links to a control. */
export interface PatternSummaryItem {
  readonly message: string;
  readonly target: IssueTarget;
}

export type PatternFormStatus =
  | { readonly kind: 'idle' }
  | { readonly kind: 'invalid'; readonly items: readonly PatternSummaryItem[] }
  | { readonly kind: 'pending' }
  /** An unknown outcome the server's latest version showed did not commit. */
  | { readonly kind: 'unsaved' }
  | {
      readonly kind: 'created';
      readonly resource: Extract<
        PatternSubmitResult,
        { kind: 'created' }
      >['resource'];
    }
  | {
      readonly kind: 'result';
      readonly result: Exclude<PatternSubmitResult, { kind: 'created' }>;
      /** The refusal as a linked item when a control owns it. */
      readonly items: readonly PatternSummaryItem[];
    };

export const PATTERN_REJECTED_COPY: Readonly<Record<number, string>> = {
  400: 'The server could not read the pattern. Review the form and try again. Nothing was saved.',
  403: 'Template designer access is required for this acting context. Nothing was saved.',
  404: 'This pattern is unavailable to the current acting context. Nothing was saved.',
  415: 'The server could not read the pattern. Reload the page and try again. Nothing was saved.',
  422: 'The server rejected the pattern. Review the form and try again. Nothing was saved.',
};
const UNAVAILABLE =
  'The pattern service is unavailable. Your tree remains here for a later retry.';

const resultCopy = (
  result: Exclude<PatternSubmitResult, { kind: 'created' }>,
): string => {
  switch (result.kind) {
    case 'uncertain':
      return 'The result is unknown. The latest version could not settle it. Your tree remains here. Check the latest version before changing anything; retrying these unchanged values reuses the same idempotency key, so it cannot save twice.';
    case 'conflict':
      return 'Another version of this pattern was saved after the one you started from. Nothing was overwritten. Check the latest version, then choose how to continue.';
    case 'refused':
      return PATTERN_REFUSAL_COPY[result.reason];
    case 'rejected':
      if (result.status === 401)
        return 'Your session expired. Sign in again before submitting; your tree remains here.';
      if (result.status === 429)
        return result.retryAfterSeconds === undefined
          ? 'The request was rate-limited. Wait before retrying.'
          : `The request was rate-limited. Wait at least ${result.retryAfterSeconds} seconds before retrying.`;
      return PATTERN_REJECTED_COPY[result.status] ?? UNAVAILABLE;
  }
};

const headingOf = (
  result: Exclude<PatternSubmitResult, { kind: 'created' }>,
): string =>
  result.kind === 'uncertain'
    ? 'The result is unknown'
    : result.kind === 'conflict'
      ? 'Another version was saved'
      : 'The pattern was not saved';

const labelOf = (item: PatternSummaryItem, tree: EditableTree): string => {
  if (item.target.kind !== 'node') return '';
  const location = locateNode(tree, item.target.uiId);
  return location === null ? '' : `Node ${nodeNumber(location.path)}: `;
};

interface Props {
  readonly status: PatternFormStatus;
  readonly tree: EditableTree;
  readonly summaryRef: React.Ref<HTMLDivElement>;
  readonly returnTo: string;
}

/** The one focusable result region: error summary, outcome and the next action. */
export default function CmsPatternStatus({
  status,
  tree,
  summaryRef,
  returnTo,
}: Props): React.ReactElement {
  const items =
    status.kind === 'invalid' || status.kind === 'result' ? status.items : [];
  const alert = status.kind === 'invalid' || status.kind === 'result';
  return (
    <div
      id={PATTERN_STATUS_ID}
      ref={summaryRef}
      className="cms-pattern-status"
      role={alert ? 'alert' : 'status'}
      aria-live={alert ? undefined : 'polite'}
      tabIndex={-1}
    >
      {status.kind === 'invalid' ? (
        <>
          <h3 id={PATTERN_RESULT_HEADING_ID} tabIndex={-1}>
            Check the pattern
          </h3>
          <p>
            {items.length} {items.length === 1 ? 'problem' : 'problems'} to fix;
            nothing was sent.
          </p>
        </>
      ) : null}
      {status.kind === 'pending' ? <p>Saving the pattern draft…</p> : null}
      {status.kind === 'unsaved' ? (
        <>
          <h3 id={PATTERN_RESULT_HEADING_ID} tabIndex={-1}>
            Nothing was saved
          </h3>
          <p>
            The save did not reach a result, so the server's latest version was
            checked: it holds nothing from this attempt. Your tree remains here;
            you can save again, and the unchanged values reuse the same
            idempotency key, so a late arrival cannot save twice.
          </p>
        </>
      ) : null}
      {status.kind === 'result' ? (
        <>
          <h3 id={PATTERN_RESULT_HEADING_ID} tabIndex={-1}>
            {headingOf(status.result)}
          </h3>
          <p>{resultCopy(status.result)}</p>
        </>
      ) : null}
      {items.length > 0 ? (
        <ul>
          {items.map((item) => (
            <li key={`${targetDomId(item.target)}-${item.message}`}>
              <a
                href={`#${targetDomId(item.target)}`}
                onClick={(event) => {
                  const control = document.getElementById(
                    targetDomId(item.target),
                  );
                  if (control === null) return;
                  event.preventDefault();
                  control.focus();
                  control.scrollIntoView?.({ block: 'center' });
                }}
              >
                {labelOf(item, tree)}
                {item.message}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
      {status.kind === 'created' ? (
        <>
          <h3 id={PATTERN_RESULT_HEADING_ID} tabIndex={-1}>
            Pattern draft saved
          </h3>
          <p>It is a private draft, not a published or active pattern.</p>
          <CmsPatternVersionFacts
            version={status.resource.version}
            lifecycle="draft"
            nodeCount={status.resource.nodeCount}
            blockRegistryDigest={status.resource.blockRegistryDigest}
          />
          <p>
            <a
              href={`/app/cms-content-modeling/patterns/${encodeURIComponent(status.resource.patternKey)}`}
            >
              Open the latest draft to submit it for review
            </a>
          </p>
        </>
      ) : null}
      {status.kind === 'result' &&
      status.result.kind === 'rejected' &&
      status.result.status === 401 ? (
        <p>
          <a href={`/auth/sign-in?returnTo=${encodeURIComponent(returnTo)}`}>
            Sign in
          </a>
        </p>
      ) : null}
    </div>
  );
}
