import { CmsCapabilityGrantListQuerySchema } from '@wejammin/contracts';

import { CMS_CAPABILITY_GRANT_DEFAULT_QUERY } from '../components/cms-capability-grants/cms-capability-grant-url';
import type { CmsCapabilityGrantListQuery } from '@wejammin/contracts';

export {
  CMS_CAPABILITY_GRANT_CONSOLE_PATH,
  cmsCapabilityGrantConsoleUrl,
} from '../components/cms-capability-grants/cms-capability-grant-url';

/** First-party same-origin transport for CMS-03A-15..18. */
export const CMS_CAPABILITY_GRANTS_API_PATH = '/api/v1/cms/capability-grants';

/**
 * URL state of the console: every CMS-03A-18 query field except the person
 * filter, which is island-local and never serialized (FE03).
 */
export type CmsCapabilityGrantPageQuery = Omit<
  CmsCapabilityGrantListQuery,
  'subjectPersonId'
>;

const PAGE_QUERY_KEYS = [
  'capability',
  'state',
  'limit',
  'cursor',
  'sort',
  'direction',
] as const;

/** Parse only the page-state keys, so the person filter can never be carried. */
const parsePageQuery = (
  input: Readonly<Record<string, string>>,
): CmsCapabilityGrantPageQuery | null => {
  const parsed = CmsCapabilityGrantListQuerySchema.safeParse(input);
  if (!parsed.success) return null;
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

const DEFAULTS = CMS_CAPABILITY_GRANT_DEFAULT_QUERY;

/** Invalid values normalize to the defaults; the page re-canonicalizes the URL. */
export const parseCmsCapabilityGrantPageQuery = (
  url: URL,
): CmsCapabilityGrantPageQuery => {
  const input: Record<string, string> = {};
  for (const key of PAGE_QUERY_KEYS) {
    const value = url.searchParams.get(key);
    if (value !== null) input[key] = value;
  }
  return parsePageQuery(input) ?? DEFAULTS;
};

/** DEC-120: a standing grant runs at most 90 UTC days (validThrough <= today + 89). */
export const MAX_GRANT_TERM_OFFSET_DAYS = 89;
const MILLISECONDS_PER_DAY = 86_400_000;

export interface CmsCapabilityGrantTermWindow {
  readonly minDate: string;
  readonly maxDate: string;
}

const utcDate = (epochMs: number): string =>
  new Date(epochMs).toISOString().slice(0, 10);

/** Server-computed input bounds for `validThrough`; the Worker stays authoritative. */
export const grantTermWindow = (now: number): CmsCapabilityGrantTermWindow => {
  const today = Date.parse(`${utcDate(now)}T00:00:00.000Z`);
  return {
    minDate: utcDate(today),
    maxDate: utcDate(today + MAX_GRANT_TERM_OFFSET_DAYS * MILLISECONDS_PER_DAY),
  };
};
