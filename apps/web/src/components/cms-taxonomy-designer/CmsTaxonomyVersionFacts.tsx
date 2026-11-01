import * as React from 'react';

import type { TaxonomyVersionFacts } from './taxonomy-versions-read';
import {
  CANONICAL_DOMAIN_LABEL,
  type TaxonomyDefinitionState,
} from './taxonomy-vocabulary';

export const LIFECYCLE_LABEL: Readonly<
  Record<TaxonomyDefinitionState, string>
> = {
  draft: 'Draft',
  review: 'In review',
  approved: 'Approved',
  scheduled: 'Scheduled, not active',
  active: 'Active',
  superseded: 'Superseded',
  retired: 'Retired',
  blocked: 'Blocked',
};

interface Props {
  readonly version: Pick<
    TaxonomyVersionFacts,
    'version' | 'state' | 'shape' | 'canonicalOverlapDomains'
  >;
}

/** The facts the server holds for a saved version: its number, lifecycle and rules summary. */
export default function CmsTaxonomyVersionFacts({
  version,
}: Props): React.ReactElement {
  return (
    <dl className="cms-taxonomy-facts">
      <div>
        <dt>Version</dt>
        <dd>{version.version}</dd>
      </div>
      <div>
        <dt>Lifecycle</dt>
        <dd>{LIFECYCLE_LABEL[version.state]}</dd>
      </div>
      <div>
        <dt>Shape</dt>
        <dd>{version.shape === 'flat' ? 'Flat' : 'Hierarchical'}</dd>
      </div>
      <div>
        <dt>Canonical domains declared</dt>
        <dd>
          {version.canonicalOverlapDomains.length === 0
            ? 'None'
            : version.canonicalOverlapDomains
                .map((domain) => CANONICAL_DOMAIN_LABEL[domain])
                .join(', ')}
        </dd>
      </div>
    </dl>
  );
}
