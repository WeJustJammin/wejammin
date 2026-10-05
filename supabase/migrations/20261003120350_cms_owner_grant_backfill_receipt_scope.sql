-- SEC-2: the owner-initialization grant backfill runs as the owner receipt holder.
--
-- cms_backfill_owner_capability_grants is fired by the operator bootstrap
-- (initialize_cms_owner, run by the platform operator with no JWT and no human
-- session).  It used to read the receipt BEFORE it held the RPC context and wrote
-- the aggregates as the BYPASSRLS platform owner.  As a function of a non-bypass
-- role it must satisfy the same policies as every other writer:
--   1. it holds the RPC context from its first statement (the receipt read goes
--      through the same gate), and
--   2. it publishes the verified session of the receipt holder (the immutable
--      owner-initialization receipt: actor, person and organization), the scope
--      the session policy admits for the owner organization's own grants, writes
--      the aggregates the receipt holder is granting to itself, and restores the
--      RPC flag AND the previously published session before it returns.
-- The grantor of every aggregate stays the receipt person.  Forward-only.
begin;

create or replace function platform_private.cms_backfill_owner_capability_grants(p_organization_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $body$
declare
  receipt_person uuid;
  receipt_auth uuid;
  previous_rpc text := coalesce(pg_catalog.current_setting('app.cms_rpc', true), '');
  previous_actor text := coalesce(pg_catalog.current_setting('app.cms_session_actor', true), '');
  previous_party text := coalesce(pg_catalog.current_setting('app.cms_session_party', true), '');
  inserted integer;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  select receipt.person_id, receipt.auth_user_id into receipt_person, receipt_auth
    from platform_private.cms_owner_initialization receipt
   where receipt.organization_id = p_organization_id;
  if receipt_person is null then
    perform pg_catalog.set_config('app.cms_rpc', previous_rpc, true);
    return 0;
  end if;
  perform platform_private.cms_publish_session(receipt_auth, p_organization_id);
  insert into platform_private.cms_capability_grants(
    owner_id, state, version, created_at, updated_at, subject_person_ref,
    capability_code, valid_from, valid_through, grantor_person_ref, last_action
  )
  select actor_grant.organization_id,
         case when actor_grant.active then 'active' else 'revoked' end,
         1, actor_grant.created_at, actor_grant.created_at, actor_grant.person_id,
         actor_grant.capability_code, actor_grant.valid_from, actor_grant.valid_through,
         receipt_person,
         case when actor_grant.active then 'granted' else 'revoked' end
    from identity_private.organization_actor_grant actor_grant
   where actor_grant.organization_id = p_organization_id
     and platform_private.cms_grantable_capability(actor_grant.capability_code)
     and actor_grant.valid_through is not null
     and actor_grant.valid_through >= actor_grant.valid_from
     and actor_grant.valid_through - actor_grant.valid_from <= 89
  on conflict (owner_id, subject_person_ref, capability_code) do nothing;
  get diagnostics inserted = row_count;
  perform pg_catalog.set_config('app.cms_session_actor', previous_actor, true);
  perform pg_catalog.set_config('app.cms_session_party', previous_party, true);
  perform pg_catalog.set_config('app.cms_rpc', previous_rpc, true);
  return inserted;
end;
$body$;

commit;
