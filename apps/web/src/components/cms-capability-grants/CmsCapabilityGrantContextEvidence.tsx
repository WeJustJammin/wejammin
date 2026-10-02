import * as React from 'react';

import ContentSchemaRegistryStepUpDisclosure from '../content-schema-registry/ContentSchemaRegistryStepUpDisclosure';
import type { CmsCapabilityGrantContextEvidence as Evidence } from './cms-capability-grant-types';

/** Display-only acting-context label and expiring step-up window; no identifier. */
export default function CmsCapabilityGrantContextEvidence({
  evidence,
}: {
  readonly evidence: Evidence;
}): React.ReactElement {
  return (
    <dl>
      <dt>Acting context</dt>
      <dd>
        {evidence.actingContextLabel ??
          'Server-verified acting context unavailable'}
      </dd>
      <dt>Step-up</dt>
      <dd>
        {evidence.stepUpState === 'verified' ? (
          <ContentSchemaRegistryStepUpDisclosure
            freshUntil={evidence.stepUpFreshUntil}
          />
        ) : (
          'Step-up required before commit'
        )}
      </dd>
    </dl>
  );
}
