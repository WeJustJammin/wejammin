import * as React from 'react';

import {
  HydrationFenceContext,
  createHydrationFence,
} from './content-schema-registry-hydration-fence';
import { initialFailureOf } from './content-schema-registry-initial-failure';
import { useContentSchemaRegistryIslandRuntime } from './use-content-schema-registry-island-runtime';
import CapabilityGate from '../infrastructure/CapabilityGate';
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
  const fence = React.useRef(createHydrationFence()).current;
  const {
    projectionState,
    contextEpoch,
    loading,
    offline,
    message,
    onCanonicalRefetch,
  } = useContentSchemaRegistryIslandRuntime(props, ssrHasAuthority, fence);

  if (props.access === 'not-rendered') {
    return (
      <CapabilityGate
        surface="content-schema-registry"
        variant="not-rendered"
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
        supportReference={props.supportReference}
        retryUrl={props.canonicalRefetchUrl}
      />
    );
  }

  if (projectionState.access === 'disabled' || !ssrHasAuthority) {
    return (
      <CapabilityGate
        surface="content-schema-registry"
        variant="disabled"
        reasonCode="SCHEMA_REGISTRY_UNAVAILABLE"
        recoveryHref={props.canonicalRefetchUrl}
      />
    );
  }

  return (
    <HydrationFenceContext.Provider value={fence}>
      <ContentSchemaRegistryWorkbench
        query={props.query}
        contractFields={props.contractFields}
        contentTypeId={props.contentTypeId}
        versionId={props.versionId}
        cursor={props.cursor}
        expectedVersion={props.expectedVersion}
        supportReference={props.supportReference}
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
    </HydrationFenceContext.Provider>
  );
}
