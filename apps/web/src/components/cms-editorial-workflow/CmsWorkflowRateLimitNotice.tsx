import * as React from 'react';

import { rateLimitMessage } from '../../lib/rate-limit-message';
import type { CanonicalResource } from './use-cms-workflow-canonical';

export interface CmsWorkflowRateLimitNoticeProps {
  /** The last read's 429 (FE03 :1172), or null when the last read was not rate limited. */
  readonly rateLimit: CanonicalResource<unknown>['rateLimit'];
}

/**
 * The polite announcement of a rate-limited canonical read: the wait the server stated, and that
 * the person's input is kept. Mounted empty with the island so assistive technology has
 * registered it before the first 429; the read itself repeats once the wait has elapsed
 * (`useCanonicalResource`).
 */
export default function CmsWorkflowRateLimitNotice({
  rateLimit,
}: CmsWorkflowRateLimitNoticeProps): React.ReactElement {
  return (
    <p
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-cms-workflow-rate-limit=""
    >
      {rateLimit === null ? '' : rateLimitMessage(rateLimit.retryAfterSeconds)}
    </p>
  );
}
