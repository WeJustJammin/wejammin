\ir support/jwt-claims.sqlinc
begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users(id) values
  ('a80d0000-0000-4000-8000-000000000001'),
  ('a80d0000-0000-4000-8000-000000000002');
select platform_api.auth_bootstrap(
  'a80d0000-0000-4000-8000-000000000001', decode(repeat('91', 32), 'hex'),
  decode(repeat('a1', 32), 'hex'), 'a80d0000-0000-4000-8000-000000000011',
  'a80d0000-0000-4000-8000-000000000012');
select platform_api.auth_bootstrap(
  'a80d0000-0000-4000-8000-000000000002', decode(repeat('92', 32), 'hex'),
  decode(repeat('a2', 32), 'hex'), 'a80d0000-0000-4000-8000-000000000021',
  'a80d0000-0000-4000-8000-000000000022');
create temp table p2_s08_audit_people on commit drop as
select
  (select person_id from identity.auth_user_bindings
    where auth_user_id = 'a80d0000-0000-4000-8000-000000000001') as actor_one_person_id,
  (select person_id from identity.auth_user_bindings
    where auth_user_id = 'a80d0000-0000-4000-8000-000000000002') as actor_two_person_id;

select pg_temp.set_jwt_claim('role', 'authenticated', true);
select pg_temp.set_jwt_claim('sub', 'a80d0000-0000-4000-8000-000000000001', true);
select set_config('app.auth_user_id', 'a80d0000-0000-4000-8000-000000000001', true);
select set_config('app.actor_auth_user_id', 'a80d0000-0000-4000-8000-000000000001', true);
select set_config('app.actor_person_id',
  (select actor_one_person_id::text from p2_s08_audit_people), true);
select set_config('app.idempotency_key_hash', 's08-audit-org-one', true);
select set_config('app.request_hash', 's08-audit-org-one-request', true);
select set_config('app.correlation_id', 'a80d0000-0000-4000-000000000091', true);
create temp table p2_s08_audit_party on commit drop as
select ((platform_api.rpc_create_organization('self_member', '{}'::text[]))->>'organizationId')::uuid
  as acting_party_id;
insert into platform_private.acting_context_binding(
  id, person_id, acting_party_id, context_kind, client_binding_id,
  state, selected_at, last_seen_at, expires_at, projection_version, version
) values (
  'a80d0000-0000-4000-8000-000000000061',
  (select actor_one_person_id from p2_s08_audit_people),
  (select acting_party_id from p2_s08_audit_party), 'organization',
  's08-audit-client', 'active'::platform_private.context_binding_state,
  clock_timestamp(), clock_timestamp(), clock_timestamp() + interval '2 hours', 1, 1
);
insert into platform_private.admin_capability_grants(
  id, subject_person_id, capability_key, resource_type, resource_id, scope,
  actions, starts_at, ends_at, grantor_person_id, reason, purpose_grant,
  state, version_no
) values (
  'a80d0000-0000-4000-8000-000000000101',
  (select actor_one_person_id from p2_s08_audit_people), 'admin.audit.read', 'person',
  (select actor_two_person_id from p2_s08_audit_people),
  jsonb_build_object('actingPartyId', (select acting_party_id from p2_s08_audit_party)),
  array['read'], clock_timestamp() - interval '1 hour', clock_timestamp() + interval '2 hours',
  (select actor_one_person_id from p2_s08_audit_people), 'audit re-audit authority', false, 'active', 1
);

select pg_temp.set_jwt_claim('role', 'service_role', true);
select pg_temp.set_jwt_claim('sub', '', true);
create temp table p2_s08_audit_event on commit drop as
select extensions.gen_random_uuid() as id;
insert into audit_private.audit_events(
  id, action, actor_id, acting_party_id, target_type, target_id,
  decision, reason_code, correlation_id
) values (
  (select id from p2_s08_audit_event), 'admin.audit.fixture',
  'a80d0000-0000-4000-8000-000000000001',
  (select acting_party_id from p2_s08_audit_party), 'person',
  (select actor_two_person_id from p2_s08_audit_people), 'allowed', 'AUDIT_FIXTURE',
  'a80d0000-0000-4000-0000-000000000391'
);
insert into platform_private.admin_audit_links(
  id, source_type, source_id, source_version, audit_event_id, safe_label
) values (
  'a80d0000-0000-4000-8000-000000000201', 'person',
  (select actor_two_person_id from p2_s08_audit_people), 1,
  (select id from p2_s08_audit_event), 'audit-reaudit-fixture'
);

create temp table p2_s08_audit_base on commit drop as
select jsonb_build_object(
  'action', 'read_audit', 'targetType', 'person',
  'targetId', (select actor_two_person_id::text from p2_s08_audit_people),
  'targetVersion', '1',
  'auditLinkId', 'a80d0000-0000-4000-8000-000000000201',
  'diagnosticDefinitionKey', null, 'diagnosticDefinitionVersion', null,
  'input', null, 'expectedFreshnessAt', null, 'reason', 'audit read',
  'context', jsonb_build_object(
    'authUserId', 'a80d0000-0000-4000-8000-000000000001',
    'actorPersonId', (select actor_one_person_id from p2_s08_audit_people),
    'actingPartyId', (select acting_party_id from p2_s08_audit_party)
  )
) as request;

-- Catching only for this RED harness lets the assertion run when the old
-- routine rejects the newly locked If-Match key before migration repair.
create function pg_temp.s08_try_audit(p_request jsonb) returns jsonb
language plpgsql as $body$
declare response jsonb;
begin
  response := platform_api.admin_audit_diagnostic(p_request);
  return response;
exception when others then
  return null;
end;
$body$;
create temp table p2_s08_audit_if_match on commit drop as
select pg_temp.s08_try_audit(request || jsonb_build_object(
  'ifMatch', '1', 'idempotencyKey', 's08-audit-ifmatch-exact'
)) as response from p2_s08_audit_base;
select ok((select response is not null from p2_s08_audit_if_match),
  'B05 read_audit accepts the Worker If-Match version');
select is((select response->>'targetVersion' from p2_s08_audit_if_match), '1',
  'B05 read_audit returns the exact version protected by If-Match');

select throws_ok($stale_if_match$
  select platform_api.admin_audit_diagnostic(request || jsonb_build_object(
    'ifMatch', '2', 'idempotencyKey', 's08-audit-ifmatch-stale'
  )) from p2_s08_audit_base
$stale_if_match$, 'P0001', 'DIAGNOSTIC_VERSION_CONFLICT',
  'stale audit If-Match is rejected as a version conflict');

create temp table p2_s08_audit_replay_first on commit drop as
select platform_api.admin_audit_diagnostic(request || jsonb_build_object(
  'idempotencyKey', 's08-audit-replay-key'
)) as response from p2_s08_audit_base;
create temp table p2_s08_audit_replay_second on commit drop as
select platform_api.admin_audit_diagnostic(request || jsonb_build_object(
  'idempotencyKey', 's08-audit-replay-key'
)) as response from p2_s08_audit_base;
select is(
  (select response from p2_s08_audit_replay_second),
  (select response from p2_s08_audit_replay_first),
  'read_audit idempotency replays the durable response');
select throws_ok($audit_hash_conflict$
  select platform_api.admin_audit_diagnostic(request || jsonb_build_object(
    'idempotencyKey', 's08-audit-replay-key', 'reason', 'changed business request'
  )) from p2_s08_audit_base
$audit_hash_conflict$, 'P0001', 'IDEMPOTENCY_MISMATCH',
  'read_audit rejects a changed request under the same idempotency key');

select * from finish();

rollback;
