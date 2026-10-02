import * as React from 'react';
import type { JobState } from '@wejammin/contracts';

import {
  pollableJobId,
  useContentSchemaRegistryDryRunPolling,
} from './content-schema-registry-dry-run-polling';
import { reviewRouteFor } from './content-schema-registry-version-actions';
import type {
  ContentSchemaRegistryReviewState,
  SchemaActivationPreparation,
} from './content-schema-registry-types';

export interface ContentSchemaRegistryActivationPreparationProps {
  readonly preparation: SchemaActivationPreparation;
  readonly review: ContentSchemaRegistryReviewState | null;
  readonly onCanonicalRefetch: () => void;
  /**
   * Set when the preparation is the last verified one held while the detail
   * read is degraded: it is shown with its time, never polled, and every
   * command that would consume it stays unavailable.
   */
  readonly degraded?: { readonly lastVerifiedAt: string | null } | undefined;
}

const UNSEALED_FAILURE =
  'The dry run did not complete and produced no sealed report. Start a new dry run when the server allows it.';

/** The safe failure code of an unsealed failed dry run, if the server sent one. */
const failureCodeOf = (
  preparation: SchemaActivationPreparation,
): string | null => {
  const dryRun = preparation.dryRunRef;
  return dryRun?.state === 'failed' ? (dryRun.failureCode ?? null) : null;
};

/** Plain status sentence; a job state alone never reads as a result. */
const statusSentence = (
  preparation: SchemaActivationPreparation,
  job: JobState | null,
): string => {
  const dryRun = preparation.dryRunRef;
  if (dryRun === null) return 'No dry run has been started for this version.';
  if (dryRun.state === 'completed')
    return dryRun.result === 'passed'
      ? 'The sealed dry run passed.'
      : 'The sealed dry run failed; its report lists the row errors.';
  if (dryRun.state === 'failed' || job === 'failed' || job === 'cancelled') {
    const code = failureCodeOf(preparation);
    return code === null
      ? UNSEALED_FAILURE
      : `The dry run did not complete and produced no sealed report (failure code ${code}). Start a new dry run when the server allows it.`;
  }
  if (job === 'succeeded')
    return 'The job finished; the sealed report is being read from the server.';
  return `The dry run is ${job ?? dryRun.state}.`;
};

const sealedResult = (preparation: SchemaActivationPreparation) =>
  preparation.dryRunRef?.state === 'completed'
    ? preparation.dryRunRef.result
    : null;

const CompatibilityProjection = ({
  projection,
}: {
  readonly projection: NonNullable<
    SchemaActivationPreparation['templateCompatibility']
  >;
}): React.ReactElement => (
  <section aria-labelledby="content-schema-registry-compatibility-heading">
    <h4 id="content-schema-registry-compatibility-heading">
      Template compatibility
    </h4>
    <dl>
      <dt>Template</dt>
      <dd>
        <code>{projection.templateKey}</code> version{' '}
        {projection.templateVersionNo} ({projection.state})
      </dd>
      <dt>Compatible with this version</dt>
      <dd>{projection.compatible ? 'yes' : 'no'}</dd>
      <dt>Template digest</dt>
      <dd>
        <code>{projection.templateDigest}</code>
      </dd>
    </dl>
  </section>
);

/**
 * FE03 activationPreparation panel (CMS-03A-07 data mapping): dry-run status
 * with the BE00 job vocabulary, announced politely and never moving focus.
 */
export default function ContentSchemaRegistryActivationPreparation({
  preparation,
  review,
  onCanonicalRefetch,
  degraded,
}: ContentSchemaRegistryActivationPreparationProps): React.ReactElement {
  const { job: polled, failure, retry } = useContentSchemaRegistryDryRunPolling({
    jobId: degraded === undefined ? pollableJobId(preparation) : null,
    onTerminal: onCanonicalRefetch,
  });
  const failureCode = failureCodeOf(preparation);
  const job = polled ?? preparation.jobRef?.state ?? null;
  const result = sealedResult(preparation);
  const compatibility = preparation.templateCompatibility ?? null;
  const reviewRef = preparation.reviewRef;
  const showReviewLink = reviewRef !== null && review?.status !== 'empty';
  return (
    <section
      className="content-schema-registry-preparation"
      aria-labelledby="content-schema-registry-preparation-heading"
    >
      <h3 id="content-schema-registry-preparation-heading">
        Activation preparation
      </h3>
      <p
        role="status"
        aria-live="polite"
        aria-atomic="true"
        data-cms-dry-run-status="true"
      >
        {statusSentence(preparation, job)}
      </p>
      {failure === null ? null : (
        <div data-dry-run-poll-error="true" role="alert" aria-atomic="true">
          <p>The dry-run status could not be read from the server.</p>
          {failure.retryable ? (
            <button type="button" data-cms-retry-control="enabled" onClick={retry}>
              Retry
            </button>
          ) : null}
        </div>
      )}
      {degraded === undefined ? null : (
        <p role="status" aria-live="polite" aria-atomic="true">
          Showing the last verified dry run
          {degraded.lastVerifiedAt === null ? null : (
            <>
              {' '}
              (last verified{' '}
              <time dateTime={degraded.lastVerifiedAt}>
                {degraded.lastVerifiedAt}
              </time>
              )
            </>
          )}
          . Submit review is disabled until the server read succeeds again.
        </p>
      )}
      <dl>
        <dt>Dry run</dt>
        <dd>{preparation.dryRunRef?.state ?? 'none'}</dd>
        {result === null ? null : (
          <>
            <dt>Result</dt>
            <dd>{result}</dd>
          </>
        )}
        {failureCode === null ? null : (
          <>
            <dt>Failure code</dt>
            <dd>
              <code>{failureCode}</code>
            </dd>
          </>
        )}
        {job === null ? null : (
          <>
            <dt>Job</dt>
            <dd>{job}</dd>
          </>
        )}
        {reviewRef === null ? null : (
          <>
            <dt>Review</dt>
            <dd>
              {reviewRef.state}
              {showReviewLink ? (
                <>
                  {' '}
                  <a href={reviewRouteFor(reviewRef.id)}>Open the review</a>
                </>
              ) : null}
            </dd>
          </>
        )}
      </dl>
      {compatibility === null ? null : (
        <CompatibilityProjection projection={compatibility} />
      )}
    </section>
  );
}
