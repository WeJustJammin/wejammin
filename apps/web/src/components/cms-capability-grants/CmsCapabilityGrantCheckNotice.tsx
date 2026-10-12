import * as React from 'react';

import { GRANT_CHECK_UNAVAILABLE_COPY } from './cms-capability-grant-validation';

interface CheckNoticeProps {
  readonly id: string;
  /** True after a submit whose checks could not run: nothing was sent. */
  readonly unavailable: boolean;
}

/**
 * The form-level alert for a submit whose checks could not run because the
 * lazily loaded validators could not be fetched. Nothing was sent; the same
 * form can be submitted again once the connection returns.
 */
export default function CmsCapabilityGrantCheckNotice({
  id,
  unavailable,
}: CheckNoticeProps): React.ReactElement | null {
  return unavailable ? (
    <p id={id} className="content-schema-registry-field-error" role="alert">
      {GRANT_CHECK_UNAVAILABLE_COPY}
    </p>
  ) : null;
}
