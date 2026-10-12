import type { CmsValidators } from '../../lib/cms-contract-validators';
import type { CmsCapabilityGrantQueryState } from './cms-capability-grant-types';

/**
 * The zod-free half of the console address rules. The island imports this
 * module, never `cms-capability-grant-url.ts` (which the server imports and
 * which carries the static schema): the list-query schema reaches the browser
 * only through the lazily loaded validators (FE03 performance budgets, AC261).
 */

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

/**
 * Parse only the page-state keys of a console URL, so the person filter can
 * never be carried. Invalid values normalize to the defaults (the server and
 * the browser agree, so a bad address and Back land on the same state). The
 * caller supplies the list-query schema: statically on the server, from the
 * lazily loaded validators in the browser.
 */
export const parseCmsCapabilityGrantPageQueryWith = (
  validators: Pick<CmsValidators, 'CmsCapabilityGrantListQuerySchema'>,
  url: URL,
): CmsCapabilityGrantQueryState => {
  const input: Record<string, string> = {};
  for (const key of PAGE_QUERY_KEYS) {
    const value = url.searchParams.get(key);
    if (value !== null) input[key] = value;
  }
  const parsed = validators.CmsCapabilityGrantListQuerySchema.safeParse(input);
  if (!parsed.success) return CMS_CAPABILITY_GRANT_DEFAULT_QUERY;
  const { limit, sort, direction, capability, state, cursor } = parsed.data;
  return {
    limit,
    sort,
    direction,
    ...(capability === undefined ? {} : { capability }),
    ...(state === undefined ? {} : { state }),
    ...(cursor === undefined ? {} : { cursor }),
  };
};
