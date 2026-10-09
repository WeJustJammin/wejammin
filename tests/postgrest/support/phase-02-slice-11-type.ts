/** Fresh Slice 11 type from the complete local CMS03A producer chain. */
import type { EditorialWorld } from './cms-editorial-world';
import {
  activateS11SchemaCandidate,
  prepareS11SchemaCandidate,
} from './phase-02-slice-11-schema-lifecycle';
import type { CmsOwner } from './stack';

export const ensureS11ContentType = async (
  owner: CmsOwner,
): Promise<EditorialWorld> =>
  activateS11SchemaCandidate(await prepareS11SchemaCandidate(owner));
