import { CmsCapabilityGrantListQuerySchema } from '@wejammin/contracts';

import { parseCmsCapabilityGrantPageQueryWith } from './cms-capability-grant-console-url';
import type { CmsCapabilityGrantQueryState } from './cms-capability-grant-types';

/**
 * The server-facing address rules of the console. This module imports the
 * contracts barrel for the list-query schema, so the browser island must not
 * import it: the island uses `cms-capability-grant-console-url.ts` and the
 * lazily loaded validators instead.
 */
export {
  CMS_CAPABILITY_GRANT_CONSOLE_PATH,
  CMS_CAPABILITY_GRANT_DEFAULT_QUERY,
  cmsCapabilityGrantConsoleUrl,
} from './cms-capability-grant-console-url';

/** Parse only the page-state keys of a console URL (see the `...With` rule). */
export const parseCmsCapabilityGrantPageQuery = (
  url: URL,
): CmsCapabilityGrantQueryState =>
  parseCmsCapabilityGrantPageQueryWith(
    { CmsCapabilityGrantListQuerySchema },
    url,
  );
