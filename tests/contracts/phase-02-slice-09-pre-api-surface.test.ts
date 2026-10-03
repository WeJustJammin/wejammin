import { describe, expect, it } from 'vitest';

import { holders, replayExecuteAcl } from './phase-02-slice-09-pre-acl-replay';

const ORIGINAL_HUMAN = [
  'cms_add_field_definition',
  'cms_bind_relation',
  'cms_create_type_draft',
  'cms_get_content_type_version',
  'cms_list_content_types',
];
const ORIGINAL_SERVICE_ONLY = [
  'cms_activate_schema',
  'cms_advance_block_lifecycle',
  'cms_register_block',
];
const AMENDMENT = [
  'cms_assign_schema_review',
  'cms_create_schema_successor',
  'cms_decide_schema_review',
  'cms_get_schema_review',
  'cms_grant_capability',
  'cms_list_capability_grants',
  'cms_renew_capability_grant',
  'cms_revoke_capability_grant',
  'cms_start_schema_dry_run',
  'cms_submit_schema_review',
];

describe('SQL API surface replayed from the migrations (effective EXECUTE grants)', () => {
  const acl = replayExecuteAcl();

  it('[P2-S09-AC-180] leaves anon and PUBLIC with no cms_ RPC and the authenticated role with exactly the five signed-in-human originals, replaying every later revoke', () => {
    expect(holders(acl, 'anon')).toEqual([]);
    expect(holders(acl, 'public')).toEqual([]);
    expect(holders(acl, 'authenticated')).toEqual(ORIGINAL_HUMAN);
    const service = holders(acl, 'service_role');
    for (const name of [
      ...ORIGINAL_HUMAN,
      ...ORIGINAL_SERVICE_ONLY,
      ...AMENDMENT,
    ])
      expect(service, name).toContain(name);
    for (const name of [...ORIGINAL_SERVICE_ONLY, ...AMENDMENT])
      expect(holders(acl, 'authenticated'), name).not.toContain(name);
  });

  it('[P2-S09-AC-180] counts a grant only until a later revoke: the originals the text of one migration grants to authenticated are revoked again before the migrations end', () => {
    const everGranted = holders(
      replayExecuteAcl('platform_api', 'cms_', { ignoreRevokes: true }),
      'authenticated',
    );
    const revokedAgain = everGranted.filter(
      (name) => !holders(acl, 'authenticated').includes(name),
    );
    expect(revokedAgain).toEqual(expect.arrayContaining(ORIGINAL_SERVICE_ONLY));
    for (const name of ORIGINAL_SERVICE_ONLY)
      expect(acl.get(name)?.has('authenticated') ?? false, name).toBe(false);
    expect(acl.size).toBeGreaterThanOrEqual(8 + AMENDMENT.length);
  });
});
