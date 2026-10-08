import {
  EntryListItemSchema,
  EntryListPageSchema,
  EntryListQuerySchema,
} from '@wejammin/contracts';
import type {
  EntryListItem,
  EntryListPage,
  EntryListQuery,
} from '@wejammin/contracts';

/**
 * Browser-side projection of the locked BE03b CMS-03B-13 assigned-entry list
 * for the CMS-05 workbench (03-cms-content-modeling.md:531, :1200).
 *
 * Rows are authorized list items only; the cursor is signed,
 * opaque URL state and never serializes a protected value. The list read is a
 * protected no-store GET with no body, no Idempotency-Key and no If-Match,
 * and it has no optimistic state. Every schema is the shared contract
 * re-exported rather than a second, drift-prone copy.
 */
export const CMS_EDITORIAL_ENTRY_LIST_SOURCE = {
  source: 'packages/contracts/src/cms-editorial/entry-list.ts',
  spec: '.memory/wiki/specs/be/03b-editorial-workflow-publication.md',
  route: 'GET /api/v1/cms/entries',
  successStatus: 200,
  cacheControl: 'no-store',
} as const;

/** BE03b EntryListQuery: allowlisted filters plus the signed keyset cursor. */
export const CmsEditorialEntryListQuerySchema = EntryListQuerySchema;

/**
 * The list row and page are the shared BE03b contracts (DEC-145): a
 * `RevisionSummary` plus the canonical `entryId`, the server-derived
 * `entryLifecycle` and the entry's `entryUpdatedAt`, which FE03 renders as text
 * beside the draft `revisionNumber` and `state`. A local copy drifted from this
 * (it named `revisionId`, `lifecycle` and `updatedAt`) and would have refused
 * every real page. The schemas are strict, so a row that leaks a protected
 * field (an owner or assignment id) fails closed instead of rendering.
 */
export const CmsEditorialEntryListRowSchema = EntryListItemSchema;

/**
 * FE03 CmsEditorialEntryList page: at most 50 authorized rows, one opaque
 * signed cursor (URL state, never a protected value) and the page version.
 */
export const CmsEditorialEntryListPageSchema = EntryListPageSchema;

export type CmsEditorialEntryListQuery = EntryListQuery;
export type CmsEditorialEntryListRow = EntryListItem;
export type CmsEditorialEntryListPage = EntryListPage;
