import type { PatternVersionDetail } from '@wejammin/contracts';
import * as React from 'react';

import type { WorkflowCommandEnvironment } from '../cms-editorial-workflow/use-cms-workflow-command';
import {
  readLatestPatternVersion,
  type PatternLatestResult,
} from '../cms-pattern-designer/pattern-latest-read';
import CmsGovernedReviewPanel, {
  type GovernedPanelSubject,
} from './CmsGovernedReviewPanel';
import type { GovernedPanelReview } from './load-governed-subject-review';

/** The few members of the served pattern version the panel needs; nothing else is serialized. */
export type GovernedPatternFacts = Pick<
  PatternVersionDetail,
  'id' | 'contentHash' | 'patternKey' | 'patternVersion' | 'state'
>;

export interface CmsGovernedPatternPanelProps {
  readonly detail: GovernedPatternFacts;
  /** The version's review as the owned queue served it, else null/absent. */
  readonly review?: GovernedPanelReview | null;
  /** Seams for a test. */
  readonly readLatest?: (patternKey: string) => Promise<PatternLatestResult>;
  readonly environment?: WorkflowCommandEnvironment;
}

export const patternSubjectOf = (
  facts: GovernedPatternFacts,
): GovernedPanelSubject => ({
  kind: 'pattern_version',
  id: facts.id,
  hash: facts.contentHash,
  key: facts.patternKey,
  version: facts.patternVersion,
  state: facts.state,
});

/** The canonical re-read of the pattern's latest version (`cmsPatternLatestRead`), or null. */
export const readPatternSubject = async (
  patternKey: string,
  readLatest: (
    patternKey: string,
  ) => Promise<PatternLatestResult> = readLatestPatternVersion,
): Promise<GovernedPanelSubject | null> => {
  const latest = await readLatest(patternKey);
  return latest.kind === 'loaded' ? patternSubjectOf(latest.detail) : null;
};

/**
 * The bounded CMS-03C-06 panel on the pattern designer page. The subject is the
 * pattern version the page was served; after every command it is re-read through the
 * first-party latest-pattern read, so the panel never acts on a version it has not
 * verified.
 */
export default function CmsGovernedPatternPanel({
  detail,
  review = null,
  readLatest = readLatestPatternVersion,
  environment,
}: CmsGovernedPatternPanelProps): React.ReactElement {
  return (
    <CmsGovernedReviewPanel
      subject={patternSubjectOf(detail)}
      review={review}
      readSubject={() => readPatternSubject(detail.patternKey, readLatest)}
      {...(environment === undefined ? {} : { environment })}
    />
  );
}
