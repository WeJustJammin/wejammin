import type { TemplateVersionDetail } from '@wejammin/contracts';
import * as React from 'react';

import { readLatestCmsTemplateVersion } from '../cms-composition/cms-template-edit-reconcile';
import type { WorkflowCommandEnvironment } from '../cms-editorial-workflow/use-cms-workflow-command';
import CmsGovernedReviewPanel, {
  type GovernedPanelSubject,
} from './CmsGovernedReviewPanel';
import type { GovernedPanelReview } from './load-governed-subject-review';

/** The few members of the served template version the panel needs; nothing else is serialized. */
export type GovernedTemplateFacts = Pick<
  TemplateVersionDetail,
  'id' | 'contentHash' | 'templateKey' | 'templateVersion' | 'state'
>;

export interface CmsGovernedTemplatePanelProps {
  readonly detail: GovernedTemplateFacts;
  /** The version's review as the owned queue served it, else null/absent. */
  readonly review?: GovernedPanelReview | null;
  /** Seams for a test. */
  readonly readLatest?: typeof readLatestCmsTemplateVersion;
  readonly environment?: WorkflowCommandEnvironment;
}

export const templateSubjectOf = (
  facts: GovernedTemplateFacts,
): GovernedPanelSubject => ({
  kind: 'template_version',
  id: facts.id,
  hash: facts.contentHash,
  key: facts.templateKey,
  version: facts.templateVersion,
  state: facts.state,
});

/** The canonical re-read of the template's latest version (`cmsTemplateLatestRead`), or null. */
export const readTemplateSubject = async (
  templateKey: string,
  readLatest: typeof readLatestCmsTemplateVersion = readLatestCmsTemplateVersion,
): Promise<GovernedPanelSubject | null> => {
  const latest = await readLatest(templateKey);
  return latest.kind === 'loaded' ? templateSubjectOf(latest.detail) : null;
};

/**
 * The bounded CMS-03C-06 panel on the template designer page. The subject is
 * the template version the page was served; after every command it is re-read
 * through the first-party latest-template read, so the panel never acts on a
 * version it has not verified.
 */
export default function CmsGovernedTemplatePanel({
  detail,
  review = null,
  readLatest = readLatestCmsTemplateVersion,
  environment,
}: CmsGovernedTemplatePanelProps): React.ReactElement {
  return (
    // The template page styles its controls through this class (cms-template-designer.css).
    <div className="cms-template-designer">
      <CmsGovernedReviewPanel
        subject={templateSubjectOf(detail)}
        review={review}
        readSubject={() => readTemplateSubject(detail.templateKey, readLatest)}
        {...(environment === undefined ? {} : { environment })}
      />
    </div>
  );
}
