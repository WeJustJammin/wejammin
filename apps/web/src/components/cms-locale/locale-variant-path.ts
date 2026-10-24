import { isCmsUuid } from '@wejammin/contracts/client';

const LOCALE_TAG = /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/u;

/** The BCP 47 shape the contracts accept (`CmsLocaleSchema`), zod-free for the island and the page. */
export const isLocaleTag = (value: string): boolean =>
  value.length <= 35 && LOCALE_TAG.test(value);

/** The page path (FE03 :1073), or null when either id is malformed: a 400, never a read. */
export const localeVariantPagePath = (
  entryId: string,
  locale: string,
): string | null =>
  isCmsUuid(entryId) && isLocaleTag(locale)
    ? `/app/cms-content-modeling/entries/${entryId}/locales/${encodeURIComponent(locale)}`
    : null;

/** The same-origin CMS-03C-04 path the island posts to. */
export const localeVariantApiPath = (entryId: string, locale: string): string =>
  `/api/v1/cms/entries/${entryId}/locales/${encodeURIComponent(locale)}/variants`;
