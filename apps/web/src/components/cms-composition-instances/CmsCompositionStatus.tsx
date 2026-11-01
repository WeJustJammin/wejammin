import * as React from 'react';

import CmsEditorialCapabilityGate from '../cms-editorial/CmsEditorialCapabilityGate';
import type { CompositionStatus } from './composition-status';

export const RESULT_HEADING_ID = 'cms-composition-result-heading';

/** The one focusable result region: a pending note, a named outcome, or a refusal that says what was kept. */
export default function CmsCompositionStatus({
  status,
  recheck = null,
  rechecking = false,
}: {
  readonly status: CompositionStatus;
  /** An unknown outcome whose reading could not verify: "Check again", the only way to a retry (FE03 1050). */
  readonly recheck?: (() => Promise<void>) | null;
  readonly rechecking?: boolean;
}): React.ReactElement | null {
  const nonce =
    status.kind === 'success' || status.kind === 'error' ? status.nonce : 0;
  React.useEffect(() => {
    if (nonce > 0) document.getElementById(RESULT_HEADING_ID)?.focus();
  }, [nonce]);
  if (status.kind === 'idle') return null;
  if (status.kind === 'pending')
    return (
      <div className="cms-composition-status" role="status">
        {status.message}
      </div>
    );
  const lines = status.lines;
  return (
    <div
      className="cms-composition-status"
      role={status.kind === 'error' ? 'alert' : 'status'}
    >
      {status.kind === 'error' && status.gate ? (
        <CmsEditorialCapabilityGate
          headingId={RESULT_HEADING_ID}
          title={status.heading}
          reason={status.message}
          focusable
        />
      ) : (
        <h2 id={RESULT_HEADING_ID} tabIndex={-1}>
          {status.heading}
        </h2>
      )}
      {status.kind === 'error' && !status.gate ? <p>{status.message}</p> : null}
      {recheck === null ? null : (
        <p>
          <button
            type="button"
            aria-disabled={rechecking ? 'true' : 'false'}
            onClick={rechecking ? undefined : () => void recheck()}
          >
            Check again
          </button>
        </p>
      )}
      {lines.length > 0 ? (
        <ul>
          {lines.map((line, index) => (
            <li key={`${index}-${line}`}>{line}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
