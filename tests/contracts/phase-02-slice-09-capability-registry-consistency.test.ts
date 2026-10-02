/**
 * BE03a "Grantable capability registry consistency" CI assertion: the code
 * owned GrantableCmsCapability set, the platform capability registry function
 * and the SQL grantable predicate must agree, using the latest forward
 * migration that defines each of them.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  GRANTABLE_CMS_CAPABILITIES,
  GrantableCmsCapabilitySchema,
} from '../../packages/contracts/src/content-schema-registry/models-grants';

const MIGRATIONS = join(process.cwd(), 'supabase', 'migrations');
const files = readdirSync(MIGRATIONS)
  .filter((name) => name.endsWith('.sql'))
  .sort();

const latestDefinition = (functionName: string): string => {
  let latest: string | undefined;
  for (const name of files) {
    const sql = readFileSync(join(MIGRATIONS, name), 'utf8');
    const pattern = new RegExp(
      `create or replace function platform_private\\.${functionName}\\([\\s\\S]*?\\$body\\$([\\s\\S]*?)\\$body\\$`,
      'gu',
    );
    for (const match of sql.matchAll(pattern)) latest = match[1];
  }
  if (latest === undefined)
    throw new Error(`no migration defines ${functionName}`);
  return latest;
};

const quoted = (text: string): string[] =>
  [...text.matchAll(/'([^']+)'/gu)].map((match) => match[1] as string);

const registry = quoted(
  latestDefinition('cms_capability_registry_valid').replace(
    /p_key|p_version/gu,
    '',
  ),
).filter((value) => /^[a-z][a-z0-9_.-]*$/u.test(value));
const grantableSql = quoted(
  latestDefinition('cms_grantable_capability').split(
    'and platform_private',
  )[0] ?? '',
);

describe('capability registry consistency', () => {
  it('[P2-S09-AC-525] every GrantableCmsCapability member is a registered capability key and the grantable set is a subset of the platform capability registry', () => {
    expect(registry.length).toBeGreaterThan(15);
    for (const capability of GRANTABLE_CMS_CAPABILITIES)
      expect(registry, capability).toContain(capability);
    expect([...grantableSql].sort()).toEqual(
      [...GRANTABLE_CMS_CAPABILITIES].sort(),
    );
  });

  it('[P2-S09-AC-526] CMS-03A-15 never writes a non-CMS capability code: the grantable set is closed over cms.* keys and the grant RPC is gated by the grantable predicate', () => {
    for (const capability of GRANTABLE_CMS_CAPABILITIES)
      expect(capability.startsWith('cms.')).toBe(true);
    for (const rejected of [
      'admin.cms',
      'admin.*',
      'cms.*',
      '*',
      'identity.owner',
      'platform.admin',
    ])
      expect(GrantableCmsCapabilitySchema.safeParse(rejected).success).toBe(
        false,
      );
    const grantRpc = readFileSync(
      join(MIGRATIONS, '20261002141000_cms_grant_capability.sql'),
      'utf8',
    );
    expect(grantRpc).toContain('platform_private.cms_grantable_capability(');
  });

  it('[P2-S09-AC-696] cms.taxonomy_curator, cms.publisher, cms.navigation_editor, cms.media_contributor and cms.media_curator are registered in the platform capability registry by a forward migration together with the grantable set', () => {
    for (const capability of [
      'cms.taxonomy_curator',
      'cms.publisher',
      'cms.navigation_editor',
      'cms.media_contributor',
      'cms.media_curator',
    ]) {
      expect(registry, capability).toContain(capability);
      expect(grantableSql, capability).toContain(capability);
      expect(GRANTABLE_CMS_CAPABILITIES, capability).toContain(capability);
    }
    const registered = files.filter((name) =>
      readFileSync(join(MIGRATIONS, name), 'utf8').includes(
        "('cms.media_curator', 1::bigint)",
      ),
    );
    expect(registered.length).toBeGreaterThan(0);
  });

  it('[P2-S09-AC-697] cms.delivery_review and cms.delivery_review.assign are never grantable', () => {
    for (const capability of [
      'cms.delivery_review',
      'cms.delivery_review.assign',
    ]) {
      expect(GrantableCmsCapabilitySchema.safeParse(capability).success).toBe(
        false,
      );
      expect(grantableSql).not.toContain(capability);
      expect(GRANTABLE_CMS_CAPABILITIES as readonly string[]).not.toContain(
        capability,
      );
    }
  });
});
