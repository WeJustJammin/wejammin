/**
 * The committed fixtures the claim-gate suites share: two real auth users with
 * no person (`attacker`, `victim`), a ghost subject that is not an auth user, a
 * registered release principal key, the history-cursor signing secret the
 * revision list needs before it reaches its gate, and the operator-bootstrapped
 * CMS owner (a real person with an organization) for the success controls.
 * Everything is created through production code or a documented insert, and the
 * suites run right after `pnpm db:reset` (and reset again afterwards).
 */
import { randomUUID } from 'node:crypto';

import type { GateContext } from './claim-gate-check';
import { type CmsOwner, createAuthUser, ensureCmsOwner, psql } from './stack';

export const RELEASE_KEY = 'apigate-release-key';
const GHOST = '00000000-0000-4000-8000-0000000000ff';

export type GateWorld = GateContext & Readonly<{ owner: CmsOwner }>;

export const prepareGateWorld = (): GateWorld => {
  const principal = createAuthUser(randomUUID());
  psql(`insert into platform_private.cfg_release_principals(principal_id, key_id)
        values ('${principal}', '${RELEASE_KEY}') on conflict do nothing`);
  // Test-only signing key for the signed editorial cursors: CMS-03B-03
  // history and CMS-03B-13 entry list answer DEPENDENCY_UNAVAILABLE before they
  // resolve the caller while the Vault has none.
  psql(`select vault.create_secret(repeat('a1', 32), 'cms_editorial_history_cursor_active',
          'api gate suite key') where not exists (
          select 1 from vault.secrets where name = 'cms_editorial_history_cursor_active')`);
  return {
    attacker: createAuthUser(randomUUID()),
    victim: createAuthUser(randomUUID()),
    ghost: GHOST,
    releaseKey: RELEASE_KEY,
    owner: ensureCmsOwner(),
  };
};
