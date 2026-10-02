import * as React from 'react';

import { initialFailureOf } from './content-schema-registry-initial-failure';
import { useContentSchemaRegistryIslandRuntime } from './use-content-schema-registry-island-runtime';
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
  const {
    projectionState,
    contextEpoch,
    loading,
    offline,
    message,
    onCanonicalRefetch,
  } = useContentSchemaRegistryIslandRuntime(props, ssrHasAuthority);

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
        supportReference={props.supportReference}
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
  );
}
