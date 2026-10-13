import type { PreflightCategory } from '@wejammin/contracts';
import * as React from 'react';

import {
  PREFLIGHT_CATEGORY_LABEL,
  PREFLIGHT_OUTCOME_LABEL,
  preflightReasonCopy,
  type PreflightOutcome,
} from './cms-workflow-labels';

/** One check's verdict: a report result or a refusal entry (no counts, no text). */
export interface PreflightSummaryResult {
  readonly category: PreflightCategory;
  readonly outcome: PreflightOutcome;
  readonly reasonCode: string | null;
}

export interface CmsEditorialPreflightSummaryProps {
  readonly headingId: string;
  readonly results: readonly PreflightSummaryResult[];
  /** The heading level: 2 as a region of the panel, 3 inside a refusal. */
  readonly headingLevel?: 2 | 3;
  /** The region name; a refusal names its own so two regions never share one. */
  readonly title?: string;
}

/**
 * The CMS-03B-15 `preparation.preflight` (or the `details.preflight` of a
 * refusal) as one linear, semantic list in registry order: category, outcome in
 * words and the fixed sentence for its closed reason. An `unavailable` check is
 * a degraded check, not an error; an unbuilt provider is named as not available
 * yet and never offers an override. Nothing the provider wrote is rendered.
 */
export default function CmsEditorialPreflightSummary({
  headingId,
  results,
  headingLevel = 3,
  title = 'Checks',
}: CmsEditorialPreflightSummaryProps): React.ReactElement {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  const count = (outcome: PreflightOutcome): number =>
    results.filter((result) => result.outcome === outcome).length;
  return (
    <section aria-labelledby={headingId} data-cms-preflight-summary="">
      <Heading id={headingId} tabIndex={-1}>
        {title}
      </Heading>
      <p role="status" aria-live="polite" aria-atomic="true">
        {count('passed')} of {results.length}{' '}
        {results.length === 1 ? 'check' : 'checks'} passed, {count('failed')}{' '}
        failed, {count('unavailable')} unavailable.
      </p>
      <ol>
        {results.map((result) => (
          <li key={result.category} data-cms-preflight-outcome={result.outcome}>
            <strong>{PREFLIGHT_CATEGORY_LABEL[result.category]}</strong>
            {': '}
            <span>{PREFLIGHT_OUTCOME_LABEL[result.outcome]}</span>
            {' — '}
            {preflightReasonCopy(result.outcome, result.reasonCode)}
          </li>
        ))}
      </ol>
    </section>
  );
}
