import { useEffect, useState } from 'react';
import type {
  ContentSchemaRegistryDetailState,
  ContentSchemaRegistryListState,
} from './content-schema-registry-types';
import {
  isError,
  retryAfterMessage,
  retryAfterSecondsFor,
  statusCode,
  statusMessage,
} from './content-schema-registry-status-helpers';

const CONTENT_SCHEMA_REGISTRY_LOADING_DELAY_MS = 250;

interface Props {
  readonly state:
    ContentSchemaRegistryListState | ContentSchemaRegistryDetailState;
  readonly regionLabel: string;
  readonly requestId: string;
  readonly canonicalUrl: string;
  readonly resetUrl?: string;
  readonly resultCount?: number;
  readonly activeFilterSummary?: string;
}

export default function ContentSchemaRegistryStatus({
  state,
  regionLabel,
  requestId,
  canonicalUrl,
  resetUrl,
  resultCount,
  activeFilterSummary,
}: Props) {
  const retryAfterSeconds = retryAfterSecondsFor(state);
  const deadlineFor = (seconds: number | null): number | null =>
    seconds === null ? null : Date.now() + seconds * 1_000;
  const [retryDeadline, setRetryDeadline] = useState<number | null>(() =>
    deadlineFor(retryAfterSeconds),
  );
  const [clock, setClock] = useState(() => Date.now());
  // A new canonical projection (new state identity) re-arms the countdown even
  // when the server sends the same retry-after value, so a repeat 429 restarts
  // rather than staying expired. Adjusting derived state during render is the
  // React-endorsed alternative to a cascading effect.
  const [retryIdentity, setRetryIdentity] = useState(state);
  if (retryIdentity !== state) {
    setRetryIdentity(state);
    setRetryDeadline(() => deadlineFor(retryAfterSeconds));
    setClock(() => Date.now());
  }
  useEffect(() => {
    if (retryDeadline === null || retryDeadline <= clock) return;
    const timer = window.setTimeout(() => setClock(Date.now()), 1_000);
    return () => window.clearTimeout(timer);
  }, [clock, retryDeadline]);
  const remainingRetryAfter =
    retryDeadline === null
      ? null
      : Math.max(0, Math.ceil((retryDeadline - clock) / 1_000));
  const message = statusMessage(state);
  const countMessage =
    resultCount === undefined
      ? null
      : `${resultCount} registry record${resultCount === 1 ? '' : 's'} shown.`;
  const filterSummary =
    activeFilterSummary === undefined ? null : activeFilterSummary;
  const retryMessage = retryAfterMessage(remainingRetryAfter);
  const retryControl = (enabled: boolean) => {
    if (!enabled) return null;
    if (remainingRetryAfter !== null && remainingRetryAfter > 0)
      return (
        <button
          type="button"
          disabled
          aria-disabled="true"
          data-cms-retry-control="disabled"
        >
          Retry
        </button>
      );
    return (
      <a href={canonicalUrl} data-cms-retry-control="enabled">
        Retry
      </a>
    );
  };
  const httpStatus = statusCode(state);
  if (state.status === 'loading') {
    return (
      <section
        className="content-schema-registry-status content-schema-registry-status-loading"
        role="status"
        aria-live="polite"
        aria-busy="true"
        aria-atomic="true"
        aria-label={`${regionLabel} status`}
        data-loading-delay-ms={CONTENT_SCHEMA_REGISTRY_LOADING_DELAY_MS}
      >
        <div
          className="content-schema-registry-loading-skeleton"
          aria-hidden="true"
        />
        <p>{message}</p>
      </section>
    );
  }
  if (isError(state)) {
    return (
      <section
        className="content-schema-registry-status content-schema-registry-status-error"
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        aria-label={`${regionLabel} error`}
      >
        <h3>{regionLabel} needs attention</h3>
        <p>{message}</p>
        {filterSummary !== null ? <p>{filterSummary}</p> : null}
        <p>
          Request ID: <code>{state.error.requestId || requestId}</code>
        </p>
        {httpStatus === null ? null : (
          <p data-http-status={httpStatus}>Status: {httpStatus}</p>
        )}
        {retryMessage === null ? null : (
          <p data-retry-after-seconds={remainingRetryAfter}>{retryMessage}</p>
        )}
        {retryControl(state.retryable)}
      </section>
    );
  }

  if (state.status === 'degraded') {
    return (
      <section
        className="content-schema-registry-status content-schema-registry-status-degraded"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        aria-label={`${regionLabel} status`}
      >
        <p>{message}</p>
        {filterSummary !== null ? <p>{filterSummary}</p> : null}
        <p>
          Request ID: <code>{state.requestId || requestId}</code>.
        </p>
        {httpStatus === null ? null : (
          <p data-http-status={httpStatus}>Status: {httpStatus}</p>
        )}
        {retryMessage === null ? null : (
          <p data-retry-after-seconds={remainingRetryAfter}>{retryMessage}</p>
        )}
        {retryControl(true)}
      </section>
    );
  }

  return (
    <section
      className="content-schema-registry-status"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-label={`${regionLabel} status`}
    >
      <p>{message}</p>
      {countMessage !== null ? <p>{countMessage}</p> : null}
      {filterSummary !== null ? <p>{filterSummary}</p> : null}
      {state.status === 'empty' && state.reason === 'filter-miss' ? (
        <a href={resetUrl ?? canonicalUrl}>Reset filters</a>
      ) : null}
    </section>
  );
}
