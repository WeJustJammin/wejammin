import * as React from 'react';

import type { SchemaReviewResource } from './content-schema-registry-types';

/** Outcome sentence per review state (FE03 review state rendering). */
const STATE_NOTE: Readonly<
  Record<SchemaReviewResource['state'], string | null>
> = {
  open: null,
  approved:
    'The review is approved; activation may use the recorded approvals.',
  rejected:
    'The review was rejected and the candidate returned to an editable draft.',
  invalidated:
    'The review is no longer valid; a new frozen submission is required.',
};

/**
 * Disclosure-safe facts of one `SchemaReviewResource`. `approvalEvidenceHash`
 * and `decidedAt` exist only for an approved review and render only then; no
 * reviewer, submitter, actor or party identifier is part of the resource.
 */
export default function ContentSchemaRegistryReviewFacts({
  review,
  decisionReferences = false,
}: {
  readonly review: SchemaReviewResource;
  /** Decision ids belong to the review route; the version page omits them. */
  readonly decisionReferences?: boolean;
}): React.ReactElement {
  const frozen = review.frozenEvidence;
  const note = STATE_NOTE[review.state];
  return (
    <>
      {note === null ? null : <p>{note}</p>}
      <dl className="content-schema-registry-summary">
        <dt>State</dt>
        <dd>{review.state}</dd>
        <dt>Risk class</dt>
        <dd>{review.riskClass}</dd>
        <dt>Required decisions</dt>
        <dd>{String(review.requiredDecisionCount)}</dd>
        <dt>Recorded decisions</dt>
        <dd>{String(review.recordedDecisionCount)}</dd>
        <dt>Distinct approvals</dt>
        <dd>{String(review.distinctApprovalCount)}</dd>
        <dt>Policy</dt>
        <dd>
          <code>{review.policyKey}</code> version {review.policyVersion}
        </dd>
        {review.approvalEvidenceHash === null ? null : (
          <>
            <dt>Approval evidence</dt>
            <dd>
              <code>{review.approvalEvidenceHash}</code>
            </dd>
          </>
        )}
        {review.decidedAt === null ? null : (
          <>
            <dt>Decided at</dt>
            <dd>
              <time dateTime={review.decidedAt}>{review.decidedAt}</time>
            </dd>
          </>
        )}
      </dl>
      <section aria-labelledby="content-schema-registry-frozen-heading">
        <h4 id="content-schema-registry-frozen-heading">Frozen evidence</h4>
        <dl>
          <dt>Candidate version</dt>
          <dd>{frozen.contentTypeVersionNo}</dd>
          <dt>Definition hash</dt>
          <dd>
            <code>{frozen.definitionHash}</code>
          </dd>
          <dt>Compiled artifact</dt>
          <dd>
            <code>{frozen.schemaArtifact.zodContractRef}</code> · compiler{' '}
            {frozen.schemaArtifact.compilerVersion} ·{' '}
            <code>{frozen.schemaArtifact.artifactHash}</code>
          </dd>
          <dt>Dependency manifest</dt>
          <dd>
            <code>{frozen.dependencyManifestHash}</code>
          </dd>
          <dt>Sealed dry run</dt>
          <dd>
            {frozen.dryRun.result ?? frozen.dryRun.state}
            {frozen.dryRun.reportHash === null ? null : (
              <>
                {' '}
                · report <code>{frozen.dryRun.reportHash}</code>
              </>
            )}
          </dd>
        </dl>
      </section>
      {!decisionReferences || review.decisions.length === 0 ? null : (
        <section aria-labelledby="content-schema-registry-decisions-heading">
          <h4 id="content-schema-registry-decisions-heading">
            Recorded decision references
          </h4>
          <ul>
            {review.decisions.map((decision) => (
              <li key={decision.id}>
                <code>{decision.id}</code> · {decision.decision} ·{' '}
                {decision.capability} ·{' '}
                <time dateTime={decision.decidedAt}>{decision.decidedAt}</time>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
