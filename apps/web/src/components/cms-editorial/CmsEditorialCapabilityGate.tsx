import type * as React from 'react';

export interface CmsEditorialCapabilityGateProps {
  readonly headingId: string;
  readonly reason: string;
  readonly requestId?: string | null;
  /** The surface the gate stands for; the editor's default names editing. */
  readonly title?: string;
  /** True when the heading is a focus target of its form (tabindex -1), as a form's named result heading is. */
  readonly focusable?: boolean;
}

/**
 * Denial surface. It states the typed reason without disclosing whether the
 * hidden record exists (BE03b:653 "A denied entry/review/revision cannot be
 * distinguished from absence when the caller lacks read authority").
 */
const CmsEditorialCapabilityGate = ({
  headingId,
  reason,
  requestId = null,
  title = 'Editing unavailable',
  focusable = false,
}: CmsEditorialCapabilityGateProps): React.ReactElement => (
  <section
    className="cms-editorial-gate"
    aria-labelledby={headingId}
    data-cms-editorial-capability-gate="true"
  >
    <h2 id={headingId} tabIndex={focusable ? -1 : undefined}>
      {title}
    </h2>
    <p>{reason}</p>
    {requestId === null ? null : (
      <p className="cms-editorial-request-id">Reference: {requestId}</p>
    )}
  </section>
);

export default CmsEditorialCapabilityGate;
