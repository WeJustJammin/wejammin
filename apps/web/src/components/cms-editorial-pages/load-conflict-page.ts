import { describeCmsAuthoringFields } from '../cms-editorial-fields/cms-field-descriptor-decode';
import {
  AuthoringContextReadSchema,
  CmsUuidSchema,
  ConflictDetailQuerySchema,
  ConflictDetailResourceSchema,
} from '@wejammin/contracts';

import {
  conflictInitFrom,
  type CmsEditorialConflictResolveInit,
} from '../cms-editorial/cms-editorial-conflict-state';
import { conflictTaxonomyContextFrom } from './cms-conflict-taxonomy-context';
import {
  cmsEditorialNoticeFor,
  cmsEditorialUnverifiedNotice,
} from './cms-editorial-page-outcome';
import type { CmsEditorialPageReads } from './cms-editorial-page-reads';
import type { CmsEditorialPageOutcome } from './cms-editorial-page-view';

export interface CmsEditorialConflictPageView {
  readonly init: CmsEditorialConflictResolveInit;
}

/**
 * The protected CMS-06 conflict surface. The page owns addressing and
 * verification: malformed ids are an invalid request answered without an
 * upstream call; the preimages come only from the CMS-03B-12 read (a hidden,
 * absent or closed conflict is one 404); the field definitions are those of the
 * conflict's own schema version, and every divergent field must have one, so
 * nothing is shown or sent for a field the form cannot type.
 */
export const loadConflictPage = async (input: {
  readonly request: Request;
  readonly entryId: string;
  readonly conflictId: string;
  readonly reads: CmsEditorialPageReads;
}): Promise<CmsEditorialPageOutcome<CmsEditorialConflictPageView>> => {
  const url = new URL(input.request.url);
  const here = `${url.pathname}${url.search}`;
  const context = {
    subject: 'conflict' as const,
    returnTo: here,
    retryHref: here,
  };
  if (
    !CmsUuidSchema.safeParse(input.entryId).success ||
    !CmsUuidSchema.safeParse(input.conflictId).success ||
    !ConflictDetailQuerySchema.safeParse(Object.fromEntries(url.searchParams))
      .success
  )
    return {
      kind: 'notice',
      notice: {
        status: 400,
        title: 'Invalid request',
        heading: 'Invalid request',
        message:
          'This request could not be read. Check the address and try again.',
        retryHref: null,
        requestId: null,
      },
    };

  const conflictResponse = await input.reads.conflictDetail(
    input.request,
    input.entryId,
    input.conflictId,
  );
  if (conflictResponse.status !== 200)
    return cmsEditorialNoticeFor(conflictResponse, context);
  let conflictBody: unknown;
  try {
    conflictBody = await conflictResponse.json();
  } catch {
    return cmsEditorialUnverifiedNotice('Conflict detail');
  }
  const conflict = ConflictDetailResourceSchema.safeParse(conflictBody);
  if (
    !conflict.success ||
    conflict.data.entry.id !== input.entryId ||
    conflict.data.conflict.id !== input.conflictId
  )
    return cmsEditorialUnverifiedNotice('Conflict detail');

  const definitions = await input.reads.authoringContext(
    input.request,
    conflict.data.theirs.schemaVersionId,
  );
  if (definitions.status !== 200)
    return cmsEditorialNoticeFor(definitions, context);
  let definitionsBody: unknown;
  try {
    definitionsBody = await definitions.json();
  } catch {
    return cmsEditorialUnverifiedNotice('Conflict detail');
  }
  const parsed = AuthoringContextReadSchema.safeParse({
    query: { contentTypeVersionId: conflict.data.theirs.schemaVersionId },
    resource: definitionsBody,
  });
  if (!parsed.success) return cmsEditorialUnverifiedNotice('Conflict detail');
  const descriptors = describeCmsAuthoringFields(parsed.data.resource.fields);
  const init = conflictInitFrom(conflict.data, descriptors);
  const known = new Set(
    parsed.data.resource.fields.map((field) => field.stableFieldId),
  );
  if (init.paths.some((path) => !known.has(path.fieldId)))
    return cmsEditorialUnverifiedNotice('Conflict detail');
  const view = (
    body: CmsEditorialConflictResolveInit,
  ): CmsEditorialPageOutcome<CmsEditorialConflictPageView> => ({
    kind: 'view',
    status: 200,
    title: 'Resolve edit conflict',
    heading: 'Resolve edit conflict',
    description: 'Resolve a concurrent edit.',
    view: { init: body },
  });

  // The locale of a divergent taxonomy field belongs to the conflict's own
  // immutable revision, which the locked conflict detail does not carry. Only
  // then does the page re-read that exact revision through the protected
  // CMS-03B-15 read (the same authority scope as the conflict detail); every
  // other conflict keeps its existing read sequence and view.
  const needsTaxonomyLocale = init.paths.some((path) =>
    descriptors.some(
      (descriptor) =>
        descriptor.fieldId === path.fieldId && descriptor.kind === 'taxonomy',
    ),
  );
  if (!needsTaxonomyLocale) return view(init);
  const selected = parsed.data.resource.selectedType;
  if (selected === null) return cmsEditorialUnverifiedNotice('Conflict detail');
  const theirs = conflict.data.theirs;
  const workflowResponse = await input.reads.workflow(
    new Request(
      new URL(
        `/api/v1/cms/entries/${input.entryId}/workflow?revisionId=${encodeURIComponent(theirs.revisionId)}`,
        input.request.url,
      ),
      { method: 'GET', headers: input.request.headers },
    ),
    input.entryId,
  );
  if (workflowResponse.status !== 200)
    return cmsEditorialNoticeFor(workflowResponse, context);
  let workflowBody: unknown;
  try {
    workflowBody = await workflowResponse.json();
  } catch {
    return cmsEditorialUnverifiedNotice('Conflict detail');
  }
  const taxonomyContext = conflictTaxonomyContextFrom({
    entryId: input.entryId,
    typeKey: selected.typeKey,
    theirs,
    workflowBody,
  });
  if (taxonomyContext === null)
    return cmsEditorialUnverifiedNotice('Conflict detail');
  return view({ ...init, taxonomyContext });
};
