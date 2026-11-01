import * as React from 'react';
import type { TemplateVersionDetail } from '@wejammin/contracts';

import { templateDetailToDraftFields } from './cms-template-designer-request';

interface Props {
  readonly latest: TemplateVersionDetail;
  readonly unsentValues: Record<string, unknown>;
}

/**
 * The create designer's comparison (FE03 1266 Conflict: "Show current server version beside preserved draft"):
 * the template the key already holds beside the values the person typed. A create cannot rebase, so the only
 * actions are to open that template (where a successor is saved) or to change the key; nothing is overwritten.
 */
export default function CmsTemplateExistingVersion({
  latest,
  unsentValues,
}: Props): React.ReactElement {
  return (
    <section aria-labelledby="cms-template-latest-heading">
      <h3 id="cms-template-latest-heading">Latest version {latest.version}</h3>
      <p>
        A template with the key {latest.templateKey} already exists. Your values
        stay in this form; nothing was overwritten.
      </p>
      <h4>Latest canonical values</h4>
      <pre>{JSON.stringify(templateDetailToDraftFields(latest), null, 2)}</pre>
      <h4>Your unsent values</h4>
      <pre>{JSON.stringify(unsentValues, null, 2)}</pre>
      <a
        href={`/app/cms-content-modeling/templates/${encodeURIComponent(latest.templateKey)}`}
      >
        Open the latest draft to save a successor, or choose another key above
      </a>
    </section>
  );
}
