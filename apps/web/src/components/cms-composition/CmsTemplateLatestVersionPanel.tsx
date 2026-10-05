import * as React from 'react';
import type { TemplateVersionDetail } from '@wejammin/contracts';

import { templateDetailToDraftFields } from './cms-template-designer-request';

interface Props {
  readonly latest: TemplateVersionDetail;
  readonly baseVersion: string;
  readonly unsentValues: Record<string, unknown>;
  readonly onUseAsParent: () => void;
}

/** Render-only comparison panel; rebasing stays an explicit user action. */
export default function CmsTemplateLatestVersionPanel({
  latest,
  baseVersion,
  unsentValues,
  onUseAsParent,
}: Props): React.ReactElement {
  if (latest.version === baseVersion) {
    return (
      <section aria-labelledby="cms-template-latest-heading">
        <h3 id="cms-template-latest-heading">
          Latest version {latest.version}
        </h3>
        <p>
          The current parent is still latest. Review your values before
          retrying.
        </p>
      </section>
    );
  }
  return (
    <section aria-labelledby="cms-template-latest-heading">
      <h3 id="cms-template-latest-heading">Latest version {latest.version}</h3>
      <p>
        Compare all values below. Rebase keeps your unsent form values; it does
        not copy the newer version's edits into them.
      </p>
      <h4>Latest canonical values</h4>
      <pre>{JSON.stringify(templateDetailToDraftFields(latest), null, 2)}</pre>
      <h4>Your unsent values</h4>
      <pre>{JSON.stringify(unsentValues, null, 2)}</pre>
      <button type="button" onClick={onUseAsParent}>
        Use version {latest.version} as parent for my displayed values
      </button>
    </section>
  );
}
