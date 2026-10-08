/**
 * An ISOLATED CMS owner for suites that commit content types and entries.
 *
 * `ensureCmsOwner()` returns the ONE operator-bootstrapped owner every suite of a run shares, so a
 * suite that commits types under it makes them visible to every later suite (the owner's
 * CMS-03A-06 content-type list, for one, is a single 25-row page that `worker-round-trip` asserts
 * ends with `nextCursor: null`). A suite that needs its own types uses this owner instead: a fresh
 * auth user and person (production `identity_create`), a private alias and an organization created
 * through the same production functions the operator bootstrap calls, and the CMS grants the
 * editorial suites need. The shared owner and every other suite are left untouched.
 */
import { randomUUID } from 'node:crypto';

import { type CmsOwner, createPerson, ensureCmsOwner, psql } from './stack';

const CMS_CAPABILITIES = [
  'cms.schema_registry.read',
  'cms.schema_designer',
  'cms.author',
  'cms.editor',
] as const;

export const createIsolatedCmsOwner = (): CmsOwner => {
  // The operator bootstrap refuses to run once ANY cms.* grant exists (BOOTSTRAP_AUTHORITY_EXISTS),
  // so the shared owner must be initialized BEFORE the first isolated owner takes a grant.
  ensureCmsOwner();
  const authUserId = randomUUID();
  const handle = `iso${authUserId.slice(0, 8)}`;
  psql(
    `insert into auth.users(id, email, email_confirmed_at)
     values ('${authUserId}', '${handle}@example.test', now())`,
  );
  const personId = createPerson(authUserId);
  const output = psql(`
    begin;
    select set_config('app.auth_user_id', '${authUserId}', true),
           set_config('request.jwt.claims', '{"sub":"${authUserId}"}', true),
           set_config('app.actor_auth_user_id', '${authUserId}', true),
           set_config('app.actor_person_id', '${personId}', true),
           set_config('app.acting_party_id', '', true),
           set_config('app.acting_context_id', '', true),
           set_config('app.correlation_id', gen_random_uuid()::text, true),
           set_config('app.idempotency_key_hash', 'iso-alias-${authUserId}', true),
           set_config('app.request_hash', 'iso-alias-${authUserId}', true);
    select platform_api.identity_alias_create('${handle}', '${handle}', 'private');
    select set_config('app.idempotency_key_hash', 'iso-organization-${authUserId}', true),
           set_config('app.request_hash', 'iso-organization-${authUserId}', true);
    select (platform_api.rpc_create_organization('self_member', '{}'::text[]) ->> 'organizationId') as organization_id \\gset
    insert into identity_private.organization_actor_grant(
      organization_id, person_id, capability_code, valid_from, valid_through, active)
    select :'organization_id', '${personId}', capability, current_date, current_date + 30, true
      from unnest(array['${CMS_CAPABILITIES.join("','")}']) as capability;
    commit;
    select :'organization_id';`);
  const organizationId = output.split('\n').at(-1) ?? '';
  return { authUserId, personId, organizationId };
};
