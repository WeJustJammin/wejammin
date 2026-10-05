import * as React from 'react';

import CmsCapabilityGrantContextEvidence from './CmsCapabilityGrantContextEvidence';
import { COMMAND_COPY } from './cms-capability-grant-commands';
import { STEP_UP_REASON_ID } from './cms-capability-grant-reasons';
import type { CmsCapabilityGrantConsoleProps } from './cms-capability-grant-types';

export interface CmsCapabilityGrantHeaderProps {
  readonly evidence: CmsCapabilityGrantConsoleProps['contextEvidence'];
  /** The step-up recovery link, or null when commands need no recovery. */
  readonly recoveryHref: string | null;
}

/** Owner console heading, context disclosure and the step-up recovery. */
export default function CmsCapabilityGrantHeader({
  evidence,
  recoveryHref,
}: CmsCapabilityGrantHeaderProps): React.ReactElement {
  return (
    <header className="content-schema-registry-header">
      <p className="content-schema-registry-eyebrow">Owner only</p>
      <h2 id="cms-grants-heading">CMS access</h2>
      <p>
        Grant, renew or revoke CMS capabilities for people in your organization.
        Each grant ends on a date you choose, within 90 days.
      </p>
      <CmsCapabilityGrantContextEvidence evidence={evidence} />
      {recoveryHref === null ? null : (
        <p id={STEP_UP_REASON_ID} data-step-up-recovery="true">
          {COMMAND_COPY.stepUp} <a href={recoveryHref}>Verify identity</a>
        </p>
      )}
    </header>
  );
}
