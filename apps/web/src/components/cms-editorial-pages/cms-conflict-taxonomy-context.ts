import {
  EntryWorkflowResourceSchema,
  type ConflictDetailResource,
} from '@wejammin/contracts';

import type { CmsEditorialConflictTaxonomyContext } from '../cms-editorial/cms-editorial-conflict-state';

/**
 * Binds a CMS-03B-15 body to the conflict's `theirs` revision reference. It
 * returns the taxonomy context only when the body is the strict workflow
 * resource of THIS entry and its revision matches all four immutable reference
 * members (id, number, schema version and content hash); any other body, or a
 * mismatch, is null -- an unverified state, never a partial context. The
 * revision may be a non-current historical one: the locale belongs to the
 * immutable revision, not to the entry's current draft.
 */
export const conflictTaxonomyContextFrom = (input: {
  readonly entryId: string;
  readonly typeKey: string;
  readonly theirs: ConflictDetailResource['theirs'];
  readonly workflowBody: unknown;
}): CmsEditorialConflictTaxonomyContext | null => {
  const workflow = EntryWorkflowResourceSchema.safeParse(input.workflowBody);
  if (
    !workflow.success ||
    workflow.data.entry.id !== input.entryId ||
    workflow.data.revision.id !== input.theirs.revisionId ||
    workflow.data.revision.revisionNumber !== input.theirs.revisionNumber ||
    workflow.data.revision.schemaVersionId !== input.theirs.schemaVersionId ||
    workflow.data.revision.contentHash !== input.theirs.contentHash
  )
    return null;
  return {
    typeKey: input.typeKey,
    locale: workflow.data.revision.locale,
    theirs: {
      revisionId: input.theirs.revisionId,
      revisionNumber: input.theirs.revisionNumber,
      schemaVersionId: input.theirs.schemaVersionId,
      contentHash: input.theirs.contentHash,
    },
  };
};
