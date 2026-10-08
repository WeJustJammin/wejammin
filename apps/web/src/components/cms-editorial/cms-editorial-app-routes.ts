import { CmsUuidSchema } from '@wejammin/contracts';

/**
 * The APP (page) routes of the CMS editorial surfaces. A committed command
 * navigates to one of these, derived from the identity in the verified 201
 * body. It never navigates to the JSON API `Location` the response also
 * carries: that header addresses a resource for programmatic clients and has
 * no page behind it.
 */
export const CMS_EDITORIAL_APP_ENTRIES_PATH =
  '/app/cms-content-modeling/entries';

const withUuid = (build: (id: string) => string, id: string): string | null =>
  CmsUuidSchema.safeParse(id).success ? build(id) : null;

/** The draft editor for one entry, or null when the id is not a UUID. */
export const cmsEditorialAppEntryPath = (entryId: string): string | null =>
  withUuid((id) => `${CMS_EDITORIAL_APP_ENTRIES_PATH}/${id}`, entryId);

/** The revision history and comparison page for one entry. */
export const cmsEditorialAppRevisionsPath = (entryId: string): string | null =>
  withUuid(
    (id) => `${CMS_EDITORIAL_APP_ENTRIES_PATH}/${id}/revisions`,
    entryId,
  );

/** The three-way conflict resolution page for one open conflict. */
export const cmsEditorialAppConflictPath = (
  entryId: string,
  conflictId: string,
): string | null =>
  CmsUuidSchema.safeParse(entryId).success &&
  CmsUuidSchema.safeParse(conflictId).success
    ? `${CMS_EDITORIAL_APP_ENTRIES_PATH}/${entryId}/conflicts/${conflictId}`
    : null;
