import * as React from 'react';

import ContentSchemaRegistryDiagnosticReference from './ContentSchemaRegistryDiagnosticReference';
import ContentSchemaRegistryReviewFacts from './ContentSchemaRegistryReviewFacts';
import { safeContentSchemaRegistryErrorMessage } from './content-schema-registry-types';
import type {
  ContentSchemaRegistryReviewState,
  SchemaReviewResource,
} from './content-schema-registry-types';

export interface ContentSchemaRegistryReviewPanelProps {
  readonly state: ContentSchemaRegistryReviewState | null;
  readonly retryUrl: string;
  readonly supportReference: string;
  /** Where the submitter continues; absent for a review-only reader. */
  readonly candidateUrl?: string | undefined;
  /** List the recorded decision references (review route only). */
  readonly decisionReferences?: boolean;
  readonly children?: React.ReactNode;
}

const Skeleton = (): React.ReactElement => (
  <>
    <div
      className="content-schema-registry-loading-skeleton"
      aria-hidden="true"
    />
    <p role="status" aria-live="polite" aria-busy="true" aria-atomic="true">
      Loading the review.
    </p>
  </>
);

const Retry = ({ href }: { readonly href: string }): React.ReactElement => (
  <a href={href} data-cms-retry-control="enabled">
    Retry
  </a>
);

const Body = ({
  state,
  retryUrl,
  supportReference,
  decisionReferences = false,
  children,
}: Omit<ContentSchemaRegistryReviewPanelProps, 'candidateUrl'> & {
  readonly state: ContentSchemaRegistryReviewState;
}): React.ReactElement | null => {
  switch (state.status) {
    case 'idle':
      return null;
    case 'loading':
      return <Skeleton />;
    case 'empty':
      return <p>This review is not available to you.</p>;
    case 'error':
      return (
        <div role="alert" aria-live="assertive" aria-atomic="true">
          <p>{safeContentSchemaRegistryErrorMessage(state.error.code)}</p>
          <ContentSchemaRegistryDiagnosticReference
            requestId={state.error.requestId}
            supportReference={supportReference}
          />
          {state.retryable ? <Retry href={retryUrl} /> : null}
        </div>
      );
    case 'disabled':
      return <p>{state.reason}</p>;
    case 'degraded':
      return (
        <>
          <p role="status" aria-live="polite" aria-atomic="true">
            The review could not be refreshed. Decision and activation controls
            are disabled.
            {state.lastVerifiedAt === null ? null : (
              <>
                {' '}
                Last verified{' '}
                <time dateTime={state.lastVerifiedAt}>
                  {state.lastVerifiedAt}
                </time>
                .
              </>
            )}
          </p>
          <ContentSchemaRegistryDiagnosticReference
            requestId={state.requestId}
            supportReference={supportReference}
          />
          {state.data === null ? null : (
            <ContentSchemaRegistryReviewFacts
              review={state.data}
              decisionReferences={decisionReferences}
            />
          )}
          <Retry href={retryUrl} />
        </>
      );
    case 'success':
      return (
        <>
          <ContentSchemaRegistryReviewFacts
            review={state.data}
            decisionReferences={decisionReferences}
          />
          {children}
        </>
      );
  }
};

/** The review resource of a success or degraded state, if one is held. */
export const reviewOf = (
  state: ContentSchemaRegistryReviewState | null,
): SchemaReviewResource | null =>
  state?.status === 'success' ? state.data : null;

/** FE03 `reviewState` panel (CMS-03A-13); a read-only, disclosure-safe view. */
export default function ContentSchemaRegistryReviewPanel(
  props: ContentSchemaRegistryReviewPanelProps,
): React.ReactElement | null {
  const { state, candidateUrl } = props;
  if (state === null || state.status === 'idle') return null;
  return (
    <section
      className="content-schema-registry-review"
      aria-labelledby="content-schema-registry-review-heading"
    >
      <h3 id="content-schema-registry-review-heading" tabIndex={-1}>
        Schema review
      </h3>
      <Body {...props} state={state} />
      {candidateUrl === undefined ? null : (
        <p>
          <a href={candidateUrl}>Open the candidate version</a>
        </p>
      )}
    </section>
  );
}
