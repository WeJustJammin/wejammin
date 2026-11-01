import { isCmsUuid } from '@wejammin/contracts/client';

/** The composition page of one entry (FE03 1072), or null when the id is not a UUID. */
export const compositionPagePath = (entryId: string): string | null =>
  isCmsUuid(entryId)
    ? `/app/cms-content-modeling/entries/${entryId}/composition`
    : null;
