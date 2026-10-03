\ir support/jwt-claims.sqlinc
begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

-- The Worker context seam returns only a sorted, de-duplicated capability-key
-- array.  This wrapper keeps the RED lane executable before the production
-- routine exists; once migrated, it invokes the real SECURITY DEFINER RPC.
create function pg_temp.s08_context_capabilities(p_request jsonb)
returns jsonb
language plpgsql
as $body$
declare
  response jsonb;
begin
  execute 'select platform_api.admin_context_capabilities($1)' using p_request into response;
  return response;
exception when undefined_function then
  return '[]'::jsonb;
end;
$body$;

insert into auth.users(id) values
  ('a80c0000-0000-4000-8000-000000000001'),
  ('a80c0000-0000-4000-8000-000000000002');
select platform_api.auth_bootstrap(
  'a80c0000-0000-4000-8000-000000000001', decode(repeat('71', 32), 'hex'),
  decode(repeat('81', 32), 'hex'), 'a80c0000-0000-4000-8000-000000000011',
  'a80c0000-0000-4000-8000-000000000012');
select platform_api.auth_bootstrap(
  'a80c0000-0000-4000-8000-000000000002', decode(repeat('72', 32), 'hex'),
  decode(repeat('82', 32), 'hex'), 'a80c0000-0000-4000-8000-000000000021',
  'a80c0000-0000-4000-8000-000000000022');
create temp table p2_s08_context_people on commit drop as
select
  (select person_id from identity.auth_user_bindings
    where auth_user_id = 'a80c0000-0000-4000-8000-000000000001') as actor_one_person_id,
  (select person_id from identity.auth_user_bindings
    where auth_user_id = 'a80c0000-0000-4000-8000-000000000002') as actor_two_person_id;

select pg_temp.set_jwt_claim('role', 'authenticated', true);
select pg_temp.set_jwt_claim('sub', 'a80c0000-0000-4000-8000-000000000001', true);
select set_config('app.auth_user_id', 'a80c0000-0000-4000-8000-000000000001', true);
select set_config('app.actor_auth_user_id', 'a80c0000-0000-4000-8000-000000000001', true);
select set_config('app.actor_person_id',
  (select actor_one_person_id::text from p2_s08_context_people), true);
select set_config('app.idempotency_key_hash', 's08-context-org-one', true);
select set_config('app.request_hash', 's08-context-org-one-request', true);
select set_config('app.correlation_id', 'a80c0000-0000-4000-000000000091', true);
create temp table p2_s08_context_parties on commit drop as
select ((platform_api.rpc_create_organization('self_member', '{}'::text[]))->>'organizationId')::uuid
  as actor_one_party_id;
select pg_temp.set_jwt_claim('sub', 'a80c0000-0000-4000-8000-000000000002', true);
select set_config('app.auth_user_id', 'a80c0000-0000-4000-8000-000000000002', true);
select set_config('app.actor_auth_user_id', 'a80c0000-0000-4000-8000-000000000002', true);
select set_config('app.actor_person_id',
  (select actor_two_person_id::text from p2_s08_context_people), true);
select set_config('app.idempotency_key_hash', 's08-context-org-two', true);
select set_config('app.request_hash', 's08-context-org-two-request', true);
select set_config('app.correlation_id', 'a80c0000-0000-4000-000000000092', true);
alter table p2_s08_context_parties add column actor_two_party_id uuid;
update p2_s08_context_parties
set actor_two_party_id =
  ((platform_api.rpc_create_organization('self_member', '{}'::text[]))->>'organizationId')::uuid;

insert into platform_private.acting_context_binding(
  id, person_id, acting_party_id, context_kind, client_binding_id,
  state, selected_at, last_seen_at, expires_at, projection_version, version
) values
  (
    'a80c0000-0000-4000-8000-000000000061',
    (select actor_one_person_id from p2_s08_context_people),
    (select actor_one_party_id from p2_s08_context_parties), 'organization',
    's08-context-client-one', 'active'::platform_private.context_binding_state,
    clock_timestamp(), clock_timestamp(), clock_timestamp() + interval '2 hours', 1, 1
  ),
  (
    'a80c0000-0000-4000-8000-000000000062',
    (select actor_two_person_id from p2_s08_context_people),
    (select actor_two_party_id from p2_s08_context_parties), 'organization',
    's08-context-client-two', 'active'::platform_private.context_binding_state,
    clock_timestamp(), clock_timestamp(), clock_timestamp() + interval '2 hours', 1, 1
  );

-- One active named grant is scoped to party one.  The other rows exercise the
-- expiry, revocation, and cross-party scope filters without cross-joining
-- unrelated people and organizations.
insert into platform_private.admin_capability_grants(
  id, subject_person_id, capability_key, resource_type, resource_id, scope,
  actions, starts_at, ends_at, grantor_person_id, approver_person_id, reason,
  purpose_grant, state, version_no, revoked_at, revoked_by
) values
  (
    'a80c0000-0000-4000-8000-000000000101',
    (select actor_one_person_id from p2_s08_context_people), 'admin.audit.read',
    'person', (select actor_one_person_id from p2_s08_context_people),
    jsonb_build_object('actingPartyId', (select actor_one_party_id from p2_s08_context_parties)),
    array['read'], clock_timestamp() - interval '1 hour', clock_timestamp() + interval '1 hour',
    (select actor_one_person_id from p2_s08_context_people), null, 'context active', false, 'active', 1,
    null, null
  ),
  (
    'a80c0000-0000-4000-8000-000000000102',
    (select actor_one_person_id from p2_s08_context_people), 'admin.expired.capability',
    'person', (select actor_one_person_id from p2_s08_context_people),
    jsonb_build_object('actingPartyId', (select actor_one_party_id from p2_s08_context_parties)),
    array['read'], clock_timestamp() - interval '2 hours', clock_timestamp() - interval '1 hour',
    (select actor_one_person_id from p2_s08_context_people), null, 'context expired', false, 'expired', 1,
    null, null
  ),
  (
    'a80c0000-0000-4000-8000-000000000103',
    (select actor_one_person_id from p2_s08_context_people), 'admin.revoked.capability',
    'person', (select actor_one_person_id from p2_s08_context_people),
    jsonb_build_object('actingPartyId', (select actor_one_party_id from p2_s08_context_parties)),
    array['read'], clock_timestamp() - interval '1 hour', clock_timestamp() + interval '1 hour',
    (select actor_one_person_id from p2_s08_context_people), null, 'context revoked', false, 'revoked', 1,
    clock_timestamp(), (select actor_one_person_id from p2_s08_context_people)
  ),
  (
    'a80c0000-0000-4000-8000-000000000104',
    (select actor_one_person_id from p2_s08_context_people), 'admin.mismatch.capability',
    'person', (select actor_one_person_id from p2_s08_context_people),
    jsonb_build_object('actingPartyId', (select actor_two_party_id from p2_s08_context_parties)),
    array['read'], clock_timestamp() - interval '1 hour', clock_timestamp() + interval '1 hour',
    (select actor_one_person_id from p2_s08_context_people), null, 'context mismatch', false, 'active', 1,
    null, null
  );
insert into identity_private.organization_actor_grant(
  organization_id, person_id, capability_code, valid_from, valid_through, active
) values (
  (select actor_one_party_id from p2_s08_context_parties),
  (select actor_one_person_id from p2_s08_context_people), 'admin.context.generic',
  current_date, current_date + 1, true
);

select pg_temp.set_jwt_claim('role', 'service_role', true);
select pg_temp.set_jwt_claim('sub', '', true);
create temp table p2_s08_context_response on commit drop as
select pg_temp.s08_context_capabilities(jsonb_build_object(
  'context', jsonb_build_object(
    'authUserId', 'a80c0000-0000-4000-8000-000000000001',
    'actorPersonId', (select actor_one_person_id from p2_s08_context_people),
    'actingPartyId', (select actor_one_party_id from p2_s08_context_parties)
  )
)) as response;

select ok(to_regprocedure('platform_api.admin_context_capabilities(jsonb)') is not null,
  'Worker context capability RPC is named and present');
select ok(
  coalesce((select p.prosecdef and coalesce(array_to_string(p.proconfig, ','), '') ~ 'search_path='
    from pg_proc p where p.oid = to_regprocedure('platform_api.admin_context_capabilities(jsonb)')), false),
  'context capability RPC is a pinned SECURITY DEFINER boundary');
select ok(
  coalesce((select has_function_privilege('service_role', p.oid, 'execute')
    and not has_function_privilege('anon', p.oid, 'execute')
    and not has_function_privilege('authenticated', p.oid, 'execute')
    from pg_proc p where p.oid = to_regprocedure('platform_api.admin_context_capabilities(jsonb)')), false),
  'context capability RPC is service-role-only');
select ok((select jsonb_typeof(response) = 'array' from p2_s08_context_response),
  'context capability response is a capability-key array');
select ok((select response ? 'admin.audit.read' from p2_s08_context_response),
  'active named grant is returned for the selected acting party');
select ok((select response ? 'admin.context.generic' from p2_s08_context_response),
  'current generic organization capability is returned');
select ok((select not response ? 'admin.expired.capability' from p2_s08_context_response),
  'expired named grant is excluded');
select ok((select not response ? 'admin.revoked.capability' from p2_s08_context_response),
  'revoked named grant is excluded');
select ok((select not response ? 'admin.mismatch.capability' from p2_s08_context_response),
  'named grant scoped to another acting party is excluded');
select ok((select response = (
  select jsonb_agg(value order by value)
  from jsonb_array_elements(response) item(value)
) from p2_s08_context_response), 'capability keys are sorted and deterministic');
select ok((select not exists (
  select 1 from jsonb_array_elements(response) item(value)
  where jsonb_typeof(value) <> 'string'
) from p2_s08_context_response), 'context response contains no capability rows or identifiers');

select * from finish();

rollback;
