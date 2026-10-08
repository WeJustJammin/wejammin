import * as React from 'react';

import type { CmsEditorialPageNotice as Notice } from './cms-editorial-page-outcome';

/**
 * A closed page state: one fixed sentence, an optional way back, and the support
 * reference of a degraded read. The route's own `<h1>` (the shell heading) names
 * the state, so this adds no second heading. Nothing here comes from the failed
 * response except a verified request id.
 */
export default function CmsEditorialPageNotice({
  notice,
}: {
  readonly notice: Notice;
}): React.ReactElement {
  return (
    <section data-cms-editorial-notice={String(notice.status)}>
      <p>{notice.message}</p>
      {notice.retryHref === null ? null : (
        <p>
          <a href={notice.retryHref}>
            {notice.status === 409 ? 'Start from the first page' : 'Try again'}
          </a>
        </p>
      )}
      {notice.requestId === null ? null : (
        <p>
          Reference: <code>{notice.requestId}</code>
        </p>
      )}
    </section>
  );
}
