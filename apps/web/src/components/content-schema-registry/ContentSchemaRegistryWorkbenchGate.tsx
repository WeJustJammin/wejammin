import * as React from 'react';

import CapabilityGate from '../infrastructure/CapabilityGate';
import ContentSchemaRegistryInitialFailureBoundary from './ContentSchemaRegistryInitialFailureBoundary';
import { initialFailureOf } from './content-schema-registry-initial-failure';
import type { ContentSchemaRegistryWorkbenchProps } from './content-schema-registry-types';

type GateInput = Pick<
  ContentSchemaRegistryWorkbenchProps,
  | 'access'
  | 'variant'
  | 'initialList'
  | 'initialDetail'
  | 'initialReview'
  | 'supportReference'
  | 'retryUrl'
  | 'canonicalUrl'
>;

/**
 * Server-authoritative access gate. A hidden or disabled projection never
 * renders a protected label or control; the caller renders the workbench only
 * when this returns null.
 */
export function contentSchemaRegistryWorkbenchGate({
  access,
  variant,
  initialList,
  initialDetail,
  initialReview,
  supportReference,
  retryUrl,
  canonicalUrl,
}: GateInput): React.ReactElement | null {
  if (access === 'not-rendered') {
    return (
      <CapabilityGate
        surface="content-schema-registry"
        variant="not-rendered"
      />
    );
  }

  const initialFailure = initialFailureOf({
    initialList,
    initialDetail,
    initialReview,
  });
  if (access === 'disabled' && initialFailure !== null) {
    return (
      <ContentSchemaRegistryInitialFailureBoundary
        failure={initialFailure}
        access="disabled"
        variant={variant}
        supportReference={supportReference}
        retryUrl={retryUrl}
      />
    );
  }

  const disabledReason =
    initialList.status === 'disabled'
      ? initialList.reason
      : 'A server capability prerequisite is not satisfied.';
  if (access === 'disabled') {
    return (
      <CapabilityGate
        surface="content-schema-registry"
        variant="disabled"
        reasonCode="SCHEMA_REGISTRY_UNAVAILABLE"
        disclosure={disabledReason}
        recoveryHref={canonicalUrl}
      />
    );
  }

  return null;
}

export default contentSchemaRegistryWorkbenchGate;
