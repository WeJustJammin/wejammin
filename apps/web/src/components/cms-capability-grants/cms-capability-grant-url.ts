import type { CmsCapabilityGrantQueryState } from './cms-capability-grant-types';

/** FE03 route of the owner-only CMS capability grant console. */
export const CMS_CAPABILITY_GRANT_CONSOLE_PATH =
  '/app/cms-content-modeling/capability-grants';

const PAGE_QUERY_KEYS = [
  'capability',
  'state',
  'limit',
  'cursor',
  'sort',
  'direction',
] as const;

export const CMS_CAPABILITY_GRANT_DEFAULT_QUERY: CmsCapabilityGrantQueryState =
  { limit: 25, sort: 'updatedAt', direction: 'desc' };

/**
 * Bookmarkable console URL carrying only validated non-default state. The
 * person filter is island-local and has no field in the page query, so it can
 * never be serialized here.
 */
export const cmsCapabilityGrantConsoleUrl = (
  query: CmsCapabilityGrantQueryState,
): string => {
  const params = new URLSearchParams();
  for (const key of PAGE_QUERY_KEYS) {
    const value = query[key];
    if (
      value !== undefined &&
      value !== CMS_CAPABILITY_GRANT_DEFAULT_QUERY[key]
    )
      params.set(key, String(value));
  }
  const serialized = params.toString();
  return serialized.length === 0
    ? CMS_CAPABILITY_GRANT_CONSOLE_PATH
    : `${CMS_CAPABILITY_GRANT_CONSOLE_PATH}?${serialized}`;
};
