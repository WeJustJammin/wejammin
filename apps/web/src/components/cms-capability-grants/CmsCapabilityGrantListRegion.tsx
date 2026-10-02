import * as React from 'react';

import type { CmsCapabilityGrantListProps } from './CmsCapabilityGrantList';
import CmsCapabilityGrantList from './CmsCapabilityGrantList';
import { safeContentSchemaRegistryErrorMessage } from '../content-schema-registry/content-schema-registry-types';
import type { CmsCapabilityGrantListState } from './cms-capability-grant-types';

export interface CmsCapabilityGrantListRegionProps extends Omit<
  CmsCapabilityGrantListProps,
  'page' | 'commandsDisabled'
> {
  readonly state: CmsCapabilityGrantListState;
  readonly retryUrl: string;
  readonly requestId: string;
  readonly onRetry: () => void;
  readonly onGrantFocus: () => void;
  readonly onReset: () => void;
}

const Retry = ({
  href,
  onRetry,
}: {
  readonly href: string;
  readonly onRetry: () => void;
}): React.ReactElement => (
  <a
    href={href}
    data-cms-retry-control="enabled"
    onClick={(event) => {
      event.preventDefault();
      onRetry();
    }}
  >
    Retry
  </a>
);

/** FE03 `listState` (CMS-03A-18): one rendering per AsyncState status. */
export default function CmsCapabilityGrantListRegion(
  props: CmsCapabilityGrantListRegionProps,
): React.ReactElement | null {
  const { state } = props;
  const list = (
    page: Parameters<typeof CmsCapabilityGrantList>[0]['page'],
    disabled: boolean,
  ) => (
    <CmsCapabilityGrantList
      {...props}
      page={page}
      commandsDisabled={disabled}
    />
  );
  switch (state.status) {
    case 'idle':
      return null;
    case 'loading':
      return (
        <p role="status" aria-live="polite" aria-busy="true">
          Loading current grants
        </p>
      );
    case 'success':
      return list(state.data, false);
    case 'empty':
      return (
        <div data-empty-state>
          {state.reason === 'no-records' ? (
            <>
              <p>No capability has been granted yet.</p>
              <button type="button" onClick={props.onGrantFocus}>
                Grant a capability
              </button>
            </>
          ) : (
            <>
              <p>No grant matches these filters.</p>
              <button type="button" onClick={props.onReset}>
                Reset filters
              </button>
            </>
          )}
        </div>
      );
    case 'error':
      return (
        <div role="alert" aria-live="assertive" aria-atomic="true">
          <p>{safeContentSchemaRegistryErrorMessage(state.error.code)}</p>
          <p>
            Request ID: <code>{state.error.requestId || props.requestId}</code>
          </p>
          {state.retryable ? (
            <Retry href={props.retryUrl} onRetry={props.onRetry} />
          ) : null}
        </div>
      );
    case 'disabled':
      return <p>{state.reason}</p>;
    case 'degraded':
      return (
        <>
          <div role="status" aria-live="polite" aria-atomic="true">
            <p>
              The grants could not be refreshed. Every change is disabled until
              the list is current.
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
            <p>
              Request ID: <code>{state.requestId || props.requestId}</code>
            </p>
            {state.retryable ? (
              <Retry href={props.retryUrl} onRetry={props.onRetry} />
            ) : null}
          </div>
          {state.data === null ? null : list(state.data, true)}
        </>
      );
  }
}
