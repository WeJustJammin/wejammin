import * as React from 'react';

import CmsTemplateLateEditNotice from '../cms-composition/CmsTemplateLateEditNotice';
import CmsTaxonomyBasics from './CmsTaxonomyBasics';
import CmsTaxonomyConflictPanel from './CmsTaxonomyConflictPanel';
import CmsTaxonomyDomains from './CmsTaxonomyDomains';
import CmsTaxonomyStatus from './CmsTaxonomyStatus';
import CmsTaxonomyTagList from './CmsTaxonomyTagList';
import CmsTaxonomyVersionFacts from './CmsTaxonomyVersionFacts';
import CmsTaxonomyVersionList, {
  type TaxonomyVersionSummary,
} from './CmsTaxonomyVersionList';
import {
  TAXONOMY_FIELDS_ID,
  TAXONOMY_FORM_ID,
  TAXONOMY_TYPES_ID,
} from './taxonomy-designer-ids';
import type { IssueField } from './taxonomy-designer-request';
import type { TaxonomySummaryItem } from './taxonomy-designer-status';
import type { TaxonomyVersionFacts as VersionFacts } from './taxonomy-versions-read';
import {
  useTaxonomyDesigner,
  type TaxonomyDesignerOptions,
} from './use-taxonomy-designer';

export interface CmsTaxonomyVersionDesignerProps {
  /** The vocabulary's newest version for an edit; null for a new vocabulary. */
  readonly latest: VersionFacts | null;
  /** The vocabulary's versions, newest first, as table rows. */
  readonly versions?: readonly TaxonomyVersionSummary[];
  readonly csrfToken: string;
  /** Seams for a test. */
  readonly submit?: TaxonomyDesignerOptions['submit'];
  readonly readVersions?: TaxonomyDesignerOptions['readVersions'];
}

const issuesOf = (
  items: readonly TaxonomySummaryItem[],
  field: IssueField,
): string[] =>
  items.filter((item) => item.field === field).map((item) => item.message);

/**
 * The vocabulary version designer (FE03 :886): a native form over the rules of a vocabulary,
 * its shape, the content type and field keys it may be used with and the canonical domains
 * it declares. A saved version is always a private draft; activation is a governed review.
 */
export default function CmsTaxonomyVersionDesigner(
  props: CmsTaxonomyVersionDesignerProps,
): React.ReactElement {
  const { latest, versions = [], csrfToken } = props;
  const designer = useTaxonomyDesigner(props);
  const { status } = designer;
  const editing = latest !== null;
  const invalid = status.kind === 'invalid' ? status.items : [];
  const returnTo = editing
    ? `/app/cms-content-modeling/taxonomies/${latest.taxonomyId}`
    : '/app/cms-content-modeling/taxonomies/new';
  return (
    <section
      className="cms-taxonomy-designer"
      aria-labelledby="cms-taxonomy-designer-title"
    >
      <h2 id="cms-taxonomy-designer-title">
        {editing ? `Rules of ${latest.taxonomyKey}` : 'Define a vocabulary'}
      </h2>
      <p>
        {editing
          ? `Editing from version ${designer.base?.version}. Saving creates the next version as a private draft; it does not change the version you read.`
          : 'A vocabulary is a governed list of terms authors can pick from. Saving creates a private draft of its rules that must be reviewed before it can be used.'}
      </p>
      {designer.base === null ? null : (
        <CmsTaxonomyVersionFacts version={designer.base} />
      )}
      <CmsTaxonomyVersionList versions={versions} />
      {csrfToken.length === 0 ? (
        <p role="status">Reload to restore the protected form session.</p>
      ) : null}
      <CmsTaxonomyStatus
        status={status}
        summaryRef={designer.summaryRef}
        returnTo={returnTo}
      />
      {designer.lateEdits ? <CmsTemplateLateEditNotice /> : null}
      {designer.showConflict ? (
        <CmsTaxonomyConflictPanel
          state={designer.conflict.state}
          baseVersion={designer.base?.version ?? null}
          newer={designer.conflict.newer}
          draft={{
            shape: designer.shape,
            typeKeys: designer.typeKeys,
            fieldKeys: designer.fieldKeys,
            domains: designer.domains,
          }}
          onCheck={() => void designer.conflict.check()}
          onRebase={designer.conflict.rebase}
          onDiscard={designer.conflict.discard}
        />
      ) : null}
      <form
        id={TAXONOMY_FORM_ID}
        noValidate
        tabIndex={-1}
        onSubmit={(event) => {
          event.preventDefault();
          void designer.onSubmit();
        }}
      >
        <fieldset disabled={designer.done}>
          <legend>Vocabulary rules</legend>
          <CmsTaxonomyBasics
            taxonomyKey={designer.taxonomyKey}
            onKeyChange={designer.setTaxonomyKey}
            keyReadOnly={editing}
            shape={designer.shape}
            onShapeChange={designer.setShape}
            keyIssues={issuesOf(invalid, 'taxonomyKey')}
            shapeIssues={issuesOf(invalid, 'shape')}
          />
          <CmsTaxonomyTagList
            id={TAXONOMY_TYPES_ID}
            kind="type"
            label="Content type keys"
            noun="content type key"
            help="The content types whose fields may use this vocabulary. Type a key and press Enter, or paste several separated by commas."
            tags={designer.typeKeys}
            onChange={designer.setTypeKeys}
            issues={issuesOf(invalid, 'allowedTypeKeys')}
          />
          <CmsTaxonomyTagList
            id={TAXONOMY_FIELDS_ID}
            kind="field"
            label="Field keys"
            noun="field key"
            help="The fields of those content types that may take its terms."
            tags={designer.fieldKeys}
            onChange={designer.setFieldKeys}
            issues={issuesOf(invalid, 'allowedFieldKeys')}
          />
          <CmsTaxonomyDomains
            declared={designer.domains}
            onToggle={designer.toggleDomain}
            issues={issuesOf(invalid, 'canonicalOverlapDomains')}
          />
          {issuesOf(invalid, 'form').map((message) => (
            <p key={message} className="cms-field-errors">
              {message}
            </p>
          ))}
          <p>
            A saved version is a private draft, not publication or activation.
          </p>
          <button type="submit" disabled={designer.blocked || designer.pending}>
            {designer.pending
              ? 'Saving…'
              : editing
                ? 'Save successor draft'
                : 'Create draft'}
          </button>
        </fieldset>
      </form>
    </section>
  );
}
