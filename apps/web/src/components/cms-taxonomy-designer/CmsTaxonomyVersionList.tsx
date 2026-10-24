import * as React from 'react';

import { LIFECYCLE_LABEL } from './CmsTaxonomyVersionFacts';
import type { TaxonomyVersionFacts } from './taxonomy-versions-read';

/** One row of the version history; the large allowlists stay in the version itself. */
export type TaxonomyVersionSummary = Pick<
  TaxonomyVersionFacts,
  'version' | 'state' | 'shape'
> & {
  readonly typeKeyCount: number;
  readonly fieldKeyCount: number;
  readonly domainCount: number;
};

export const summaryOf = (
  version: TaxonomyVersionFacts,
): TaxonomyVersionSummary => ({
  version: version.version,
  state: version.state,
  shape: version.shape,
  typeKeyCount: version.allowedTypeKeys.length,
  fieldKeyCount: version.allowedFieldKeys.length,
  domainCount: version.canonicalOverlapDomains.length,
});

interface Props {
  readonly versions: readonly TaxonomyVersionSummary[];
}

/** The versions of this vocabulary, newest first, as a semantic table (FE03 :1718). */
export default function CmsTaxonomyVersionList({
  versions,
}: Props): React.ReactElement | null {
  if (versions.length === 0) return null;
  return (
    <table className="cms-taxonomy-versions">
      <caption>
        Versions of this vocabulary, newest first ({versions.length})
      </caption>
      <thead>
        <tr>
          <th scope="col">Version</th>
          <th scope="col">Lifecycle</th>
          <th scope="col">Shape</th>
          <th scope="col">Content type keys</th>
          <th scope="col">Field keys</th>
          <th scope="col">Domains declared</th>
        </tr>
      </thead>
      <tbody>
        {versions.map((row) => (
          <tr key={row.version}>
            <th scope="row">{row.version}</th>
            <td>{LIFECYCLE_LABEL[row.state]}</td>
            <td>{row.shape === 'flat' ? 'Flat' : 'Hierarchical'}</td>
            <td>{row.typeKeyCount}</td>
            <td>{row.fieldKeyCount}</td>
            <td>{row.domainCount}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
