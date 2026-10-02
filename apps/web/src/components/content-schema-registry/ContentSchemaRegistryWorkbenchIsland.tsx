import * as React from 'react';
import { flushSync } from 'react-dom';

import { ACTING_CONTEXT_CHANGED_EVENT } from '../../lib/client-binding';
import { installContentSchemaRegistryCommandEnhancement } from './content-schema-registry-runtime-dom';
import { subscribeContentSchemaRegistryInvalidation } from './content-schema-registry-invalidation';
import {
  canonicalAuthNavigate,
  CanonicalRefreshScheduler,
  type FocusLocator,
  type RefetchReason,
} from './content-schema-registry-canonical-refresh-scheduler';
import {
  initialProjectionState,
  toDisabledProjection,
  type ContentSchemaRegistryProjectionState,
} from './content-schema-registry-canonical-state-validate';
import { initialFailureOf } from './content-schema-registry-initial-failure';
import { restoreContentSchemaRegistryFocus } from './content-schema-registry-runtime-dom-refetch-support';
import { ContentSchemaRegistryCapabilityGate } from './ContentSchemaRegistryCapabilityGate';
import ContentSchemaRegistryInitialFailureBoundary from './ContentSchemaRegistryInitialFailureBoundary';
import ContentSchemaRegistryWorkbench from './ContentSchemaRegistryWorkbench';
import type { ContentSchemaRegistryWorkbenchProps } from './content-schema-registry-types';

/**
 * Serializable island props (FE03 island invariant): safe display context
 * only. No actor, person, party or binding identifier, and no session or
 * correlation value, in any spelling, ever crosses into the island.
 */
export type ContentSchemaRegistryWorkbenchIslandProps = Omit<
  ContentSchemaRegistryWorkbenchProps,
  'onCanonicalRefetch' | 'contextEpoch'
> & {
  readonly canonicalRefetchUrl: string;
};

/**
 * Serializable Astro island boundary. The server renders the exact Workbench
 * HTML; the browser owns canonical refresh and its presentation through React
 * state. No server function or authority state is serialized.
 */
export default function ContentSchemaRegistryWorkbenchIsland(
  props: ContentSchemaRegistryWorkbenchIslandProps,
): React.ReactElement {
  // The server withholds protected access from a page that carries no
  // verified authority, so a usable access level is the only signal needed.
  const ssrHasAuthority =
    props.access === 'full' || props.access === 'read-only';
  const [contextEpoch, setContextEpoch] = React.useState(0);
  const [projectionState, setProjectionState] =
    React.useState<ContentSchemaRegistryProjectionState>(() =>
      initialProjectionState(props),
    );
  const [loading, setLoading] = React.useState(false);
  const [offline, setOffline] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const commandCleanupRef = React.useRef<() => void>(() => undefined);
  const [focusLocator, setFocusLocator] = React.useState<FocusLocator>(null);
  const schedulerRef = React.useRef<CanonicalRefreshScheduler | null>(null);
  if (schedulerRef.current === null) {
    schedulerRef.current = new CanonicalRefreshScheduler(
      {
        setLoading,
        setMessage,
        setProjection: (updater) => setProjectionState(updater),
        setFocusLocator,
        navigate: (target) => {
          // Commit the fail-closed state to the DOM before navigating so the
          // protected controls are gone at the moment navigation is observed.
          flushSync(() =>
            setProjectionState((current) =>
              toDisabledProjection(current, 'navigate'),
            ),
          );
          canonicalAuthNavigate(target);
        },
      },
      props.canonicalRefetchUrl,
    );
  }

  React.useEffect(() => {
    schedulerRef.current?.setUrl(props.canonicalRefetchUrl);
  }, [props.canonicalRefetchUrl]);

  const onCanonicalRefetch = React.useCallback(
    async (reason: RefetchReason | 'mutation'): Promise<void> => {
      // A completed mutation reconciles its own result; it never triggers a
      // canonical refetch. Mutation is not a scheduler reason.
      if (reason === 'mutation') return;
      schedulerRef.current?.request(reason);
    },
    [],
  );

  React.useEffect(() => {
    if (typeof document === 'undefined' || !ssrHasAuthority) return undefined;
    commandCleanupRef.current =
      installContentSchemaRegistryCommandEnhancement(document);
    document
      .querySelector<HTMLElement>('[data-workbench="content-schema-registry"]')
      ?.setAttribute('data-content-schema-registry-hydrated', 'true');
    return () => {
      commandCleanupRef.current();
      commandCleanupRef.current = () => undefined;
    };
  }, [ssrHasAuthority]);

  React.useEffect(() => {
    if (typeof window === 'undefined' || !ssrHasAuthority) return undefined;
    const scheduler = schedulerRef.current;
    const subscription = subscribeContentSchemaRegistryInvalidation({
      onInvalidate: () => scheduler?.request('list-read'),
    });
    const onOffline = (): void => setOffline(true);
    const onOnline = (): void => {
      setOffline(false);
      scheduler?.request('reconnect');
    };
    // Context change forces an immediate read and invalidates the in-flight one.
    const onActingContextChanged = (): void => {
      scheduler?.bumpEpoch();
      setContextEpoch((current) => current + 1);
      setProjectionState((current) =>
        toDisabledProjection(current, 'context-change'),
      );
      scheduler?.request('list-read', true);
    };
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    window.addEventListener(
      ACTING_CONTEXT_CHANGED_EVENT,
      onActingContextChanged,
    );
    const kickoff = window.setTimeout(
      () => scheduler?.request('detail-read', true),
      0,
    );
    return () => {
      window.clearTimeout(kickoff);
      scheduler?.dispose();
      subscription.unsubscribe();
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
      window.removeEventListener(
        ACTING_CONTEXT_CHANGED_EVENT,
        onActingContextChanged,
      );
    };
  }, [ssrHasAuthority]);

  const projectionRevision = JSON.stringify([
    projectionState.access,
    projectionState.initialList.status,
    projectionState.initialDetail?.status ?? null,
  ]);
  React.useEffect(() => {
    if (focusLocator === null || typeof document === 'undefined') return;
    restoreContentSchemaRegistryFocus(document, focusLocator);
    const clear = setTimeout(() => setFocusLocator(null), 0);
    return () => clearTimeout(clear);
  }, [projectionRevision, focusLocator]);

  // A denial/failure boundary takes focus so the removed controls are announced
  // from a safe, non-interactive heading.
  const accessState = projectionState.access;
  React.useEffect(() => {
    if (accessState !== 'disabled' || typeof document === 'undefined') return;
    document
      .getElementById('content-schema-registry-capability-heading')
      ?.focus({ preventScroll: true });
  }, [accessState]);

  if (props.access === 'not-rendered') {
    return (
      <ContentSchemaRegistryCapabilityGate
        variant="not-rendered"
        reasonCode={props.variant}
      />
    );
  }

  const initialFailure = initialFailureOf(projectionState);

  if (
    projectionState.access === 'disabled' &&
    initialFailure !== null &&
    !ssrHasAuthority
  ) {
    return (
      <ContentSchemaRegistryInitialFailureBoundary
        failure={initialFailure}
        access="disabled"
        variant={projectionState.variant}
        requestId={props.requestId}
        retryUrl={props.canonicalRefetchUrl}
      />
    );
  }

  if (projectionState.access === 'disabled' || !ssrHasAuthority) {
    return (
      <ContentSchemaRegistryCapabilityGate
        variant="disabled"
        reasonCode={projectionState.variant}
        recoveryHref={props.canonicalRefetchUrl}
      />
    );
  }

  return (
    <ContentSchemaRegistryWorkbench
      query={props.query}
      contractFields={props.contractFields}
      contentTypeId={props.contentTypeId}
      versionId={props.versionId}
      cursor={props.cursor}
      expectedVersion={props.expectedVersion}
      requestId={props.requestId}
      canonicalUrl={props.canonicalUrl}
      listUrl={props.listUrl}
      retryUrl={props.retryUrl}
      csrfToken={props.csrfToken}
      access={projectionState.access}
      variant={projectionState.variant}
      initialList={projectionState.initialList}
      initialDetail={projectionState.initialDetail}
      {...(projectionState.actingContextLabel === undefined
        ? {}
        : { actingContextLabel: projectionState.actingContextLabel })}
      {...(projectionState.stepUpState === undefined
        ? {}
        : { stepUpState: projectionState.stepUpState })}
      {...(projectionState.stepUpFreshUntil === undefined
        ? {}
        : { stepUpFreshUntil: projectionState.stepUpFreshUntil })}
      reviewId={props.reviewId ?? null}
      initialReview={projectionState.initialReview}
      contextEpoch={contextEpoch}
      onCanonicalRefetch={onCanonicalRefetch}
      loading={loading}
      offline={offline}
      message={message}
    />
  );
}
