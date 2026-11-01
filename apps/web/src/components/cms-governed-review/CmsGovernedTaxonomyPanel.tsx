import * as React from 'react';

import { readTaxonomyVersionsOnDemand } from '../cms-taxonomy-designer/taxonomy-versions-on-demand';
import type {
  readTaxonomyVersions,
  TaxonomyVersionFacts,
} from '../cms-taxonomy-designer/taxonomy-versions-read';
import type { WorkflowCommandEnvironment } from '../cms-editorial-workflow/use-cms-workflow-command';
import CmsGovernedReviewPanel, {
  type GovernedPanelSubject,
} from './CmsGovernedReviewPanel';
import type { GovernedPanelReview } from './load-governed-subject-review';

/**
 * The few members of the served vocabulary version the panel needs; nothing else is
 * serialized. `taxonomyId` is the lineage the canonical re-read is addressed by.
 */
export type GovernedTaxonomyFacts = Pick<
  TaxonomyVersionFacts,
  | 'id'
  | 'contentHash'
  | 'taxonomyId'
  | 'taxonomyKey'
  | 'taxonomyVersion'
  | 'state'
>;

export interface CmsGovernedTaxonomyPanelProps {
  readonly detail: GovernedTaxonomyFacts;
  /** The version's review as the owned queue served it, else null/absent. */
  readonly review?: GovernedPanelReview | null;
  /** Seams for a test. */
  readonly readVersions?: typeof readTaxonomyVersions;
  readonly environment?: WorkflowCommandEnvironment;
}

export const taxonomySubjectOf = (
  facts: GovernedTaxonomyFacts,
): GovernedPanelSubject => ({
  kind: 'taxonomy_version',
  id: facts.id,
  hash: facts.contentHash,
  key: facts.taxonomyKey,
  version: facts.taxonomyVersion,
  state: facts.state,
});

/** The canonical re-read of the vocabulary's newest version (`cmsTaxonomyVersionsRead`), or null. */
export const readTaxonomySubject = async (
  taxonomyId: string,
  readVersions: typeof readTaxonomyVersions = readTaxonomyVersionsOnDemand,
): Promise<GovernedPanelSubject | null> => {
  const result = await readVersions(taxonomyId);
  const newest = result.kind === 'loaded' ? result.page.items[0] : undefined;
  return newest === undefined ? null : taxonomySubjectOf(newest);
};

/**
 * The bounded CMS-03C-06 panel on the vocabulary page. The subject is the vocabulary
 * version the page was served; after every command the newest version is re-read
 * through the first-party versions read, so the panel never acts on a version it has
 * not verified.
 */
export default function CmsGovernedTaxonomyPanel({
  detail,
  review = null,
  readVersions = readTaxonomyVersionsOnDemand,
  environment,
}: CmsGovernedTaxonomyPanelProps): React.ReactElement {
  return (
    <CmsGovernedReviewPanel
      subject={taxonomySubjectOf(detail)}
      review={review}
      readSubject={() => readTaxonomySubject(detail.taxonomyId, readVersions)}
      {...(environment === undefined ? {} : { environment })}
    />
  );
}
