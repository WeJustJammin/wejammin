import * as React from 'react';

import type { CmsEditorialEntryEditPageView } from './load-entry-edit-page';

type Unavailable = Extract<
  CmsEditorialEntryEditPageView,
  { kind: 'unavailable' }
>;

/**
 * The draft is readable but cannot be edited right now (its field definitions
 * are not available to this account, or the read is degraded). It states the
 * facts the draft read verified and the reason, never a value.
 */
export default function CmsEditorialEntryEditUnavailable({
  view,
}: {
  readonly view: Unavailable;
}): React.ReactElement {
  return (
    <section aria-labelledby="entry-edit-unavailable">
      <h2 id="entry-edit-unavailable" tabIndex={-1}>
        Editing is unavailable
      </h2>
      <p>{view.message}</p>
      <dl>
        <dt>Lifecycle</dt>
        <dd>{view.facts.lifecycle}</dd>
        <dt>Revision state</dt>
        <dd>{view.facts.state}</dd>
        <dt>Locale</dt>
        <dd>{view.facts.locale}</dd>
        <dt>Validation</dt>
        <dd>{view.facts.validationState}</dd>
        <dt>Revision</dt>
        <dd>{view.facts.revisionNumber}</dd>
      </dl>
      <p>
        <a href={view.retryHref}>Try again</a>{' '}
        <a href={view.historyHref}>Revision history</a>
      </p>
    </section>
  );
}
