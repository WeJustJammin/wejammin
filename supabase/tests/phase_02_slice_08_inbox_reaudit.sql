\ir support/jwt-claims.sqlinc
begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users(id) values
  ('a80a0000-0000-4000-8000-000000000001'),
  ('a80a0000-0000-4000-8000-000000000002');
select platform_api.auth_bootstrap(
  'a80a0000-0000-4000-8000-000000000001', decode(repeat('51', 32), 'hex'),
  decode(repeat('61', 32), 'hex'), 'a80a0000-0000-4000-8000-000000000011',
  'a80a0000-0000-4000-8000-000000000012');
select platform_api.auth_bootstrap(
  'a80a0000-0000-4000-8000-000000000002', decode(repeat('52', 32), 'hex'),
  decode(repeat('62', 32), 'hex'), 'a80a0000-0000-4000-8000-000000000021',
  'a80a0000-0000-4000-8000-000000000022');
create temp table p2_s08_inbox_people on commit drop as
select
  (select person_id from identity.auth_user_bindings
    where auth_user_id = 'a80a0000-0000-4000-8000-000000000001') as actor_one_person_id,
  (select person_id from identity.auth_user_bindings
    where auth_user_id = 'a80a0000-0000-4000-8000-000000000002') as actor_two_person_id;

select pg_temp.set_jwt_claim('role', 'authenticated', true);
select pg_temp.set_jwt_claim('sub', 'a80a0000-0000-4000-8000-000000000001', true);
select set_config('app.auth_user_id', 'a80a0000-0000-4000-8000-000000000001', true);
select set_config('app.actor_auth_user_id', 'a80a0000-0000-4000-8000-000000000001', true);
select set_config('app.actor_person_id',
  (select actor_one_person_id::text from p2_s08_inbox_people), true);
select set_config('app.idempotency_key_hash', 's08-inbox-org-one', true);
select set_config('app.request_hash', 's08-inbox-org-one-request', true);
select set_config('app.correlation_id', 'a80a0000-0000-4000-8000-000000000091', true);
create temp table p2_s08_inbox_party on commit drop as
select ((platform_api.rpc_create_organization('self_member', '{}'::text[]))->>'organizationId')::uuid
  as acting_party_id;

insert into platform_private.acting_context_binding(
  id, person_id, acting_party_id, context_kind, client_binding_id,
  state, selected_at, last_seen_at, expires_at, projection_version, version
) values (
  'a80a0000-0000-4000-8000-000000000061',
  (select actor_one_person_id from p2_s08_inbox_people),
  (select acting_party_id from p2_s08_inbox_party), 'organization', 's08-inbox-client',
  'active'::platform_private.context_binding_state, clock_timestamp(), clock_timestamp(),
  clock_timestamp() + interval '2 hours', 1, 1
);

insert into platform_private.admin_capability_grants(
  id, subject_person_id, capability_key, resource_type, resource_id, scope,
  actions, starts_at, ends_at, grantor_person_id, reason, purpose_grant,
  state, version_no
) values
  (
    'a80a0000-0000-4000-8000-000000000101',
    (select actor_one_person_id from p2_s08_inbox_people), 'admin.inbox.read', 'person',
    (select actor_one_person_id from p2_s08_inbox_people),
    jsonb_build_object('actingPartyId', (select acting_party_id from p2_s08_inbox_party)),
    array['read'], clock_timestamp() - interval '1 hour', clock_timestamp() + interval '1 day',
    (select actor_one_person_id from p2_s08_inbox_people), 'inbox source one', false, 'active', 1
  ),
  (
    'a80a0000-0000-4000-8000-000000000102',
    (select actor_one_person_id from p2_s08_inbox_people), 'admin.inbox.read', 'person',
    (select actor_two_person_id from p2_s08_inbox_people),
    jsonb_build_object('actingPartyId', (select acting_party_id from p2_s08_inbox_party)),
    array['read'], clock_timestamp() - interval '1 hour', clock_timestamp() + interval '1 day',
    (select actor_one_person_id from p2_s08_inbox_people), 'inbox source two', false, 'active', 1
  ),
  (
    'a80a0000-0000-4000-8000-000000000103',
    (select actor_one_person_id from p2_s08_inbox_people), 'admin.inbox.read', 'job',
    'a80a0000-0000-4000-8000-000000000099',
    jsonb_build_object('actingPartyId', (select acting_party_id from p2_s08_inbox_party)),
    array['read'], clock_timestamp() - interval '1 hour', clock_timestamp() + interval '1 day',
    (select actor_one_person_id from p2_s08_inbox_people), 'inbox job source', false, 'active', 1
  );

insert into platform_private.admin_task_projections(
  id, source_type, source_id, source_version, task_class, required_capability,
  assignee_person_id, due_at, severity, freshness_at, freshness_state, state,
  source_status
) values
  (
    'a80a0000-0000-4000-8000-000000000201', 'person',
    (select actor_one_person_id from p2_s08_inbox_people), 1, 'approval',
    'admin.inbox.read', null, clock_timestamp() - interval '3 minutes', 'high',
    clock_timestamp() - interval '2 minutes', 'healthy', 'open', 'active'
  ),
  (
    'a80a0000-0000-4000-8000-000000000202', 'person',
    (select actor_two_person_id from p2_s08_inbox_people), 1, 'failed_job',
    'admin.inbox.read', null, clock_timestamp() - interval '1 minute', 'critical',
    clock_timestamp() - interval '2 hours', 'stale', 'blocked', 'dependency_lagging'
  ),
  (
    'a80a0000-0000-4000-8000-000000000203', 'job',
    'a80a0000-0000-4000-8000-000000000099', 1, 'schedule',
    'admin.inbox.read', null, clock_timestamp() + interval '1 minute', 'info',
    clock_timestamp() - interval '2 minutes', 'healthy', 'assigned', 'active'
  ),
  (
    'a80a0000-0000-4000-8000-000000000204', 'person',
    (select actor_one_person_id from p2_s08_inbox_people), 1, 'schedule',
    'admin.inbox.read', null, null, 'warning',
    clock_timestamp() - interval '2 minutes', 'healthy', 'completed', 'active'
  );

select pg_temp.set_jwt_claim('role', 'service_role', true);
select pg_temp.set_jwt_claim('sub', '', true);

-- Both allowlisted filters are applied before pagination and authorization.
create temp table p2_s08_inbox_filtered on commit drop as
select platform_api.admin_inbox(jsonb_build_object(
  'cursor', null, 'limit', 50,
  'taskClasses', jsonb_build_array('failed_job'),
  'states', jsonb_build_array('blocked'), 'staleAfter', null,
  'context', jsonb_build_object(
    'authUserId', 'a80a0000-0000-4000-8000-000000000001',
    'actorPersonId', (select actor_one_person_id from p2_s08_inbox_people),
    'actingPartyId', (select acting_party_id from p2_s08_inbox_party)
  )
)) as response;
select is((select jsonb_array_length(response->'items') from p2_s08_inbox_filtered), 1,
  'inbox honors taskClasses and states filters');
select is((select response->'items'->0->>'taskId' from p2_s08_inbox_filtered),
  'a80a0000-0000-4000-8000-000000000202',
  'filtered inbox returns the requested task only');

-- staleAfter selects evidence older than the requested freshness cutoff and
-- stale sources are visible in the partial-source summary.
create temp table p2_s08_inbox_stale on commit drop as
select platform_api.admin_inbox(jsonb_build_object(
  'cursor', null, 'limit', 50, 'taskClasses', null, 'states', null,
  'staleAfter', (clock_timestamp() - interval '30 minutes'),
  'context', jsonb_build_object(
    'authUserId', 'a80a0000-0000-4000-8000-000000000001',
    'actorPersonId', (select actor_one_person_id from p2_s08_inbox_people),
    'actingPartyId', (select acting_party_id from p2_s08_inbox_party)
  )
)) as response;
select ok((select response->'items' @> '[{"taskId":"a80a0000-0000-4000-8000-000000000202"}]'::jsonb
  from p2_s08_inbox_stale), 'inbox honors staleAfter for old source evidence');
select ok((select response->'partialSources' @> '["person"]'::jsonb
  from p2_s08_inbox_stale), 'stale source types are included in partialSources');
select is((select response->>'aggregateFreshness' from p2_s08_inbox_stale), 'partial',
  'stale page aggregate freshness is partial');

-- Keyset pagination emits a deterministic opaque cursor and consumes it.
create temp table p2_s08_inbox_page_one on commit drop as
select platform_api.admin_inbox(jsonb_build_object(
  'cursor', null, 'limit', 1, 'taskClasses', null, 'states', null,
  'staleAfter', null,
  'context', jsonb_build_object(
    'authUserId', 'a80a0000-0000-4000-8000-000000000001',
    'actorPersonId', (select actor_one_person_id from p2_s08_inbox_people),
    'actingPartyId', (select acting_party_id from p2_s08_inbox_party)
  )
)) as response;
create temp table p2_s08_inbox_page_one_repeat on commit drop as
select platform_api.admin_inbox(jsonb_build_object(
  'cursor', null, 'limit', 1, 'taskClasses', null, 'states', null,
  'staleAfter', null,
  'context', jsonb_build_object(
    'authUserId', 'a80a0000-0000-4000-8000-000000000001',
    'actorPersonId', (select actor_one_person_id from p2_s08_inbox_people),
    'actingPartyId', (select acting_party_id from p2_s08_inbox_party)
  )
)) as response;
select ok((select response->>'nextCursor' is not null from p2_s08_inbox_page_one),
  'inbox emits nextCursor when another page exists');
select is((select response->>'nextCursor' from p2_s08_inbox_page_one),
  (select response->>'nextCursor' from p2_s08_inbox_page_one_repeat),
  'inbox nextCursor is deterministic for the same page');
create temp table p2_s08_inbox_page_two on commit drop as
select platform_api.admin_inbox(jsonb_build_object(
  'cursor', (select response->>'nextCursor' from p2_s08_inbox_page_one),
  'limit', 1, 'taskClasses', null, 'states', null, 'staleAfter', null,
  'context', jsonb_build_object(
    'authUserId', 'a80a0000-0000-4000-8000-000000000001',
    'actorPersonId', (select actor_one_person_id from p2_s08_inbox_people),
    'actingPartyId', (select acting_party_id from p2_s08_inbox_party)
  )
)) as response;
select ok((select response->'items'->0->>'taskId' <>
  (select response->'items'->0->>'taskId' from p2_s08_inbox_page_one)
  from p2_s08_inbox_page_two), 'inbox cursor advances beyond the first item');

select * from finish();

rollback;
