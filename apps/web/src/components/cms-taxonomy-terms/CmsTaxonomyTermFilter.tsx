import * as React from 'react';

import { TERM_LIFECYCLES, type TermLifecycle } from './taxonomy-terms-read';

export const FILTER_LABEL: Readonly<Record<TermLifecycle, string>> = {
  active: 'Active',
  deprecated: 'Deprecated',
  merged: 'Merged',
};

interface Props {
  readonly basePath: string;
  readonly lifecycle: TermLifecycle | null;
}

/**
 * The lifecycle filter (FE03 :1068): a native GET form, so the filter is URL state. "All terms"
 * submits an empty `lifecycle`, which the page loader reads as no filter.
 */
export default function CmsTaxonomyTermFilter({
  basePath,
  lifecycle,
}: Props): React.ReactElement {
  return (
    <form method="get" action={basePath} className="cms-term-filter">
      <label htmlFor="cms-term-filter">Show</label>
      <select
        id="cms-term-filter"
        name="lifecycle"
        defaultValue={lifecycle ?? ''}
      >
        <option value="">All terms</option>
        {TERM_LIFECYCLES.map((choice) => (
          <option key={choice} value={choice}>
            {FILTER_LABEL[choice]} terms
          </option>
        ))}
      </select>
      <button type="submit">Apply filter</button>
      {lifecycle === null ? null : <a href={basePath}>Clear filter</a>}
    </form>
  );
}
