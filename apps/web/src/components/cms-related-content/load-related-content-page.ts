import {
  EntryDraftDetailResourceSchema,
  EntryListPageSchema,
  RelatedContentRuleReadSchema,
  relatedRuleReadAnswersEntry,
  type RelatedContentRuleRead,
} from '@wejammin/contracts';

import { cmsEditorialCsrfCookie } from '../../server/cms-editorial-platform-shared';
import {
  cmsEditorialNoticeFor,
  cmsEditorialUnverifiedNotice,
} from '../cms-editorial-pages/cms-editorial-page-outcome';
import type { CmsEditorialPageOutcome } from '../cms-editorial-pages/cms-editorial-page-view';
import { candidatesFromPage, type CandidatePage } from './related-candidates';
import { relatedContentPagePath } from './related-content-path';
import type { RelatedContentPageReads } from './related-content-page-reads';
import type {
  RelatedEntryFacts,
  RelatedRuleSnapshot,
} from './related-content-types';

export interface RelatedContentPageView {
  readonly entry: RelatedEntryFacts;
  /** The stored rule the form starts from (`cmsRelatedContentRead`), empty when none is active. */
  readonly rule: RelatedRuleSnapshot;
  readonly candidates: CandidatePage;
  readonly csrfToken: string;
  /** The page path: sign-in and reload links return to it. */
  readonly path: string;
}

const invalidRequest = (): CmsEditorialPageOutcome<never> => ({
  kind: 'notice',
  notice: {
    status: 400,
    title: 'Invalid request',
    heading: 'Invalid request',
    message: 'This request could not be read. Check the address and try again.',
    retryHref: null,
    requestId: null,
  },
});

/** FE03 :1072: a visible entry without edit authority is the page-level 403, with fixed copy. */
const editDenied = (): CmsEditorialPageOutcome<never> => ({
  kind: 'notice',
  notice: {
    status: 403,
    title: 'Access denied',
    heading: 'Access denied',
    message: 'This account cannot edit related content for this entry.',
    retryHref: null,
    requestId: null,
  },
});

const EMPTY_RULE: RelatedRuleSnapshot = {
  pins: [],
  exclusions: [],
  derivedRule: null,
};

/** The form's starting rule from a verified read: ids exactly as stored, the bound unknown (see the type). */
const snapshotOf = (
  rule: RelatedContentRuleRead['rule'],
): RelatedRuleSnapshot =>
  rule === null
    ? EMPTY_RULE
    : {
        pins: [...rule.pins],
        exclusions: [...rule.exclusions],
        derivedRule:
          rule.derivedRule === null
            ? null
            : {
                key: rule.derivedRule.key,
                version: rule.derivedRule.version,
                maxCandidates: null,
              },
      };

const jsonOf = async (response: Response): Promise<unknown> => {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
};

/**
 * The protected related-content page (FE03 :1072, :1601). The address is `:entryId` only: a malformed
 * id or ANY query is a 400 before a read, since pins and exclusions are form state and never URL state.
 * The entry is read first (CMS-03B-11): a missing session is the 303 sign-in redirect, a concealed or
 * absent entry the disclosure-safe 404, a visible entry the account cannot read a 403. Then the stored rule
 * is read (`cmsRelatedContentRead`, DEC-195), which is also the edit-authority gate: its 403 (a visible
 * entry the account cannot edit) is the page-level 403 and no candidate is read; its 429 and dependency
 * statuses are closed notices with a retry link. Only then is the first page of readable entries read for the
 * picker (CMS-03B-13). No form is built from an answer the strict contracts did not verify.
 */
export const loadRelatedContentPage = async (input: {
  readonly request: Request;
  readonly entryId: string;
  readonly reads: RelatedContentPageReads;
}): Promise<CmsEditorialPageOutcome<RelatedContentPageView>> => {
  const { request, entryId, reads } = input;
  const path = relatedContentPagePath(entryId);
  if (path === null || new URL(request.url).search !== '')
    return invalidRequest();
  const entryContext = {
    subject: 'entry' as const,
    returnTo: path,
    retryHref: path,
  };

  const draftResponse = await reads.draftDetail(request, entryId);
  if (draftResponse.status !== 200)
    return cmsEditorialNoticeFor(draftResponse, entryContext);
  const draft = EntryDraftDetailResourceSchema.safeParse(
    await jsonOf(draftResponse),
  );
  if (!draft.success || draft.data.entry.id !== entryId)
    return cmsEditorialUnverifiedNotice('Related content');

  const ruleResponse = await reads.savedRule(request, entryId);
  if (ruleResponse.status === 403) return editDenied();
  if (ruleResponse.status !== 200)
    return cmsEditorialNoticeFor(ruleResponse, entryContext);
  const read = RelatedContentRuleReadSchema.safeParse(
    await jsonOf(ruleResponse),
  );
  if (!read.success || !relatedRuleReadAnswersEntry(read.data, entryId))
    return cmsEditorialUnverifiedNotice('Related content');

  const listResponse = await reads.entryList(request);
  if (listResponse.status !== 200)
    return cmsEditorialNoticeFor(listResponse, {
      subject: 'entries',
      returnTo: path,
      retryHref: path,
    });
  const list = EntryListPageSchema.safeParse(await jsonOf(listResponse));
  if (!list.success) return cmsEditorialUnverifiedNotice('Related content');

  return {
    kind: 'view',
    status: 200,
    title: 'Related content',
    heading: 'Related content',
    description: 'Pin and exclude related entries and choose a derived rule.',
    view: {
      entry: {
        entryId,
        version: draft.data.entry.version,
        locale: draft.data.locale,
        lifecycle: draft.data.lifecycle,
      },
      rule: snapshotOf(read.data.rule),
      candidates: candidatesFromPage(list.data, entryId),
      csrfToken: cmsEditorialCsrfCookie(request) ?? '',
      path,
    },
  };
};
