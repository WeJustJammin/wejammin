import {
  AuthoringContextResourceSchema,
  CmsUuidSchema,
  EntryDraftDetailResourceSchema,
} from '@wejammin/contracts';

import { describeCmsAuthoringFields } from '../cms-editorial-fields/cms-field-descriptor';
import { draftValuesFromDetail } from '../cms-editorial/cms-editorial-draft-values';
import type { CmsEditorialEntryEditorInit } from '../cms-editorial/cms-editorial-entry-editor-state';
import {
  cmsEditorialNoticeFor,
  cmsEditorialUnverifiedNotice,
  type CmsEditorialPageNoticeOutcome,
} from './cms-editorial-page-outcome';
import type { CmsEditorialPageReads } from './cms-editorial-page-reads';
import type { CmsEditorialPageOutcome } from './cms-editorial-page-view';

export interface CmsEditorialEntryFacts {
  readonly lifecycle: string;
  readonly state: string;
  readonly locale: string;
  readonly validationState: string;
  readonly revisionNumber: string;
}

export type CmsEditorialEntryEditPageView =
  | { readonly kind: 'editor'; readonly init: CmsEditorialEntryEditorInit }
  | {
      readonly kind: 'unavailable';
      readonly facts: CmsEditorialEntryFacts;
      readonly message: string;
      readonly retryHref: string;
      readonly historyHref: string;
    };

const failure = (
  outcome: CmsEditorialPageNoticeOutcome,
): CmsEditorialPageOutcome<CmsEditorialEntryEditPageView> => outcome;

/**
 * The protected draft-editing surface for CMS-03B-11 plus CMS-03B-14. The page
 * owns addressing and verification, not data: a malformed id is an invalid
 * request answered without an upstream call; the draft is read through the
 * first-party proxy and must be the strict resource; the field definitions are
 * the author-safe projection of the DRAFT's own schema version (never a caller
 * choice); and everything is returned as one verified view, one closed state,
 * or a sign-in redirect. No owner, assignee or authority identifier is read.
 */
export const loadEntryEditPage = async (input: {
  readonly request: Request;
  readonly entryId: string;
  readonly reads: CmsEditorialPageReads;
}): Promise<CmsEditorialPageOutcome<CmsEditorialEntryEditPageView>> => {
  const url = new URL(input.request.url);
  const here = `${url.pathname}${url.search}`;
  const context = {
    subject: 'entry' as const,
    returnTo: here,
    retryHref: here,
  };
  if (!CmsUuidSchema.safeParse(input.entryId).success)
    return failure({
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
    });

  const draftResponse = await input.reads.draftDetail(
    input.request,
    input.entryId,
  );
  if (draftResponse.status !== 200)
    return failure(await cmsEditorialNoticeFor(draftResponse, context));
  let draftBody: unknown;
  try {
    draftBody = await draftResponse.json();
  } catch {
    return failure(cmsEditorialUnverifiedNotice('Edit entry'));
  }
  const draft = EntryDraftDetailResourceSchema.safeParse(draftBody);
  if (!draft.success || draft.data.entry.id !== input.entryId)
    return failure(cmsEditorialUnverifiedNotice('Edit entry'));
  const detail = draft.data;

  const facts: CmsEditorialEntryFacts = {
    lifecycle: detail.lifecycle,
    state: detail.state,
    locale: detail.locale,
    validationState: detail.validationState,
    revisionNumber: detail.revisionNumber,
  };
  const view = (
    status: number,
    body: CmsEditorialEntryEditPageView,
  ): CmsEditorialPageOutcome<CmsEditorialEntryEditPageView> => ({
    kind: 'view',
    status,
    title: 'Edit entry',
    heading: 'Edit entry',
    description: 'Edit an entry draft.',
    view: body,
  });
  const unavailable = (status: number, message: string) =>
    view(status, {
      kind: 'unavailable',
      facts,
      message,
      retryHref: here,
      historyHref: `/app/cms-content-modeling/entries/${input.entryId}/revisions`,
    });

  const definitions = await input.reads.authoringContext(
    input.request,
    detail.schemaVersionId,
  );
  if (definitions.status === 401)
    return failure(await cmsEditorialNoticeFor(definitions, context));
  if (definitions.status !== 200)
    return unavailable(
      definitions.status >= 500 ? 503 : 200,
      definitions.status >= 500
        ? 'The field definitions could not be loaded right now. Nothing was changed; try again shortly.'
        : 'This draft cannot be edited here: the field definitions of its schema version are not available to this account.',
    );
  let definitionsBody: unknown;
  try {
    definitionsBody = await definitions.json();
  } catch {
    return failure(cmsEditorialUnverifiedNotice('Edit entry'));
  }
  const parsed = AuthoringContextResourceSchema.safeParse(definitionsBody);
  if (!parsed.success)
    return failure(cmsEditorialUnverifiedNotice('Edit entry'));

  const projected = draftValuesFromDetail(
    detail,
    describeCmsAuthoringFields(parsed.data.fields),
  );
  return view(200, {
    kind: 'editor',
    init: {
      entryId: input.entryId,
      entryVersion: detail.entry.version,
      baseRevision: detail.revisionNumber,
      locale: detail.locale,
      schemaVersionId: detail.schemaVersionId,
      lifecycle: detail.lifecycle,
      state: detail.state,
      validationState: detail.validationState,
      openConflict:
        detail.openConflict === null
          ? null
          : {
              conflictId: detail.openConflict.conflictId,
              version: detail.openConflict.version,
            },
      fields: parsed.data.fields,
      values: projected.values,
      provenance: projected.provenance,
      readOnlyNotices: projected.readOnlyNotices,
    },
  });
};
