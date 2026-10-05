\ir support/jwt-claims.sqlinc
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
-- Security-remediation RED coverage for the active S08 database boundaries.
-- Fixtures use two isolated actors/parties so idempotency and scope checks are
-- exercised through the same service-role RPC path that Worker uses.
insert into auth.users(id) values
  ('a8080000-0000-4000-8000-000000000001'),
  ('a8080000-0000-4000-8000-000000000002');
select platform_api.auth_bootstrap(
  'a8080000-0000-4000-8000-000000000001', decode(repeat('01', 32), 'hex'),
  decode(repeat('11', 32), 'hex'), 'a8080000-0000-4000-8000-000000000011',
  'a8080000-0000-4000-8000-000000000012');
select platform_api.auth_bootstrap(
  'a8080000-0000-4000-8000-000000000002', decode(repeat('02', 32), 'hex'),
  decode(repeat('22', 32), 'hex'), 'a8080000-0000-4000-8000-000000000021',
  'a8080000-0000-4000-8000-000000000022');
create temp table p2_s08_people on commit drop as
select
  (select person_id from identity.auth_user_bindings
    where auth_user_id = 'a8080000-0000-4000-8000-000000000001') as actor_one_person_id,
  (select person_id from identity.auth_user_bindings
    where auth_user_id = 'a8080000-0000-4000-8000-000000000002') as actor_two_person_id;
-- Create an organization for each actor, then grant only the generic
-- capability-management identity permission.  The S08 parent grant rows below
-- are the effective named authority used to test subset enforcement.
select pg_temp.set_jwt_claim('role', 'authenticated', true);
select pg_temp.set_jwt_claim('sub', 'a8080000-0000-4000-8000-000000000001', true);
select set_config('app.auth_user_id', 'a8080000-0000-4000-8000-000000000001', true);
select set_config('app.actor_auth_user_id', 'a8080000-0000-4000-8000-000000000001', true);
select set_config('app.actor_person_id',
  (select actor_one_person_id::text from p2_s08_people), true);
select set_config('app.idempotency_key_hash', 's08-red-org-one', true);
select set_config('app.request_hash', 's08-red-org-one-request', true);
select set_config('app.correlation_id', 'a8080000-0000-4000-8000-000000000091', true);
create temp table p2_s08_parties on commit drop as
select
  ((platform_api.rpc_create_organization('self_member', '{}'::text[]))->>'organizationId')::uuid
    as actor_one_party_id;
select pg_temp.set_jwt_claim('sub', 'a8080000-0000-4000-8000-000000000002', true);
select set_config('app.auth_user_id', 'a8080000-0000-4000-8000-000000000002', true);
select set_config('app.actor_auth_user_id', 'a8080000-0000-4000-8000-000000000002', true);
select set_config('app.actor_person_id',
  (select actor_two_person_id::text from p2_s08_people), true);
select set_config('app.idempotency_key_hash', 's08-red-org-two', true);
select set_config('app.request_hash', 's08-red-org-two-request', true);
select set_config('app.correlation_id', 'a8080000-0000-4000-8000-000000000092', true);
alter table p2_s08_parties add column actor_two_party_id uuid;
update p2_s08_parties
set actor_two_party_id =
  ((platform_api.rpc_create_organization('self_member', '{}'::text[]))->>'organizationId')::uuid;

-- Organization contexts are explicit, short-lived authority bindings.  The
-- command helper must not infer an organization acting party from membership
-- alone, so install one binding per actor before exercising the S08 RPC.
insert into platform_private.acting_context_binding(
  id, person_id, acting_party_id, context_kind, client_binding_id,
  state, selected_at, last_seen_at, expires_at, projection_version, version
)
values
  ('a8080000-0000-4000-8000-000000000061',
   (select actor_one_person_id from p2_s08_people),
   (select actor_one_party_id from p2_s08_parties), 'organization', 's08-client-one',
   'active'::platform_private.context_binding_state, clock_timestamp(), clock_timestamp(),
   clock_timestamp() + interval '2 hours', 1, 1),
  ('a8080000-0000-4000-8000-000000000062',
   (select actor_two_person_id from p2_s08_people),
   (select actor_two_party_id from p2_s08_parties), 'organization', 's08-client-two',
   'active'::platform_private.context_binding_state, clock_timestamp(), clock_timestamp(),
   clock_timestamp() + interval '2 hours', 1, 1);
insert into identity_private.organization_actor_grant(
  organization_id, person_id, capability_code, valid_from, valid_through, active
)
values
  ((select actor_one_party_id from p2_s08_parties),
   (select actor_one_person_id from p2_s08_people), 'admin.capability.grant',
   current_date, current_date + 1, true),
  ((select actor_two_party_id from p2_s08_parties),
   (select actor_two_person_id from p2_s08_people), 'admin.capability.grant',
   current_date, current_date + 1, true);
-- The first actor is authorized to grant only read on actor two's resource.
-- The second actor is authorized to grant only read on actor one's resource.
insert into platform_private.admin_capability_grants(
  id, subject_person_id, capability_key, resource_type, resource_id, scope,
  actions, starts_at, ends_at, grantor_person_id, reason, purpose_grant,
  state, version_no
) values
  (
    'a8080000-0000-4000-8000-000000000101',
    (select actor_one_person_id from p2_s08_people), 'admin.audit.read', 'person',
    (select actor_two_person_id from p2_s08_people),
    jsonb_build_object('actingPartyId', (select actor_one_party_id from p2_s08_parties)),
    array['read'], clock_timestamp() - interval '1 hour', clock_timestamp() + interval '1 day',
    (select actor_one_person_id from p2_s08_people), 'parent authority', false, 'active', 1
  ),
  (
    'a8080000-0000-4000-8000-000000000102',
    (select actor_two_person_id from p2_s08_people), 'admin.audit.read', 'person',
    (select actor_one_person_id from p2_s08_people),
    jsonb_build_object('actingPartyId', (select actor_two_party_id from p2_s08_parties)),
    array['read'], clock_timestamp() - interval '1 hour', clock_timestamp() + interval '1 day',
    (select actor_two_person_id from p2_s08_people), 'parent authority', false, 'active', 1
  );
-- A valid decimal expectedVersion must revoke a current grant and advance its
-- version.  The old implementation incorrectly validates the version as UUID.
insert into platform_private.admin_capability_grants(
  id, subject_person_id, capability_key, resource_type, resource_id, scope,
  actions, starts_at, ends_at, grantor_person_id, reason, purpose_grant,
  state, version_no
) values (
  'a8080000-0000-4000-8000-000000000110',
  (select actor_two_person_id from p2_s08_people), 'admin.audit.read', 'person',
  'a8080000-0000-4000-8000-000000000099',
  jsonb_build_object('actingPartyId', (select actor_one_party_id from p2_s08_parties)),
  array['read'], clock_timestamp(), clock_timestamp() + interval '2 hours',
  (select actor_one_person_id from p2_s08_people), 'revoke fixture', false, 'active', 1
);
select pg_temp.set_jwt_claim('role', 'service_role', true);
select pg_temp.set_jwt_claim('sub', '', true);
select lives_ok($revoke$
  select platform_api.admin_capability_action(jsonb_build_object(
    'action', 'revoke',
    'grantId', 'a8080000-0000-4000-8000-000000000110',
    'expectedVersion', '1',
    'subjectPersonId', null,
    'capabilityKey', null,
    'resourceType', null,
    'resourceId', null,
    'scope', null,
    'actions', null,
    'startsAt', null,
    'endsAt', null,
    'reason', null,
    'approverPersonId', null,
    'purposeGrant', null,
    'stepUpToken', null,
    'idempotencyKey', 's08-red-revoke-001',
    'context', jsonb_build_object(
      'authUserId', 'a8080000-0000-4000-8000-000000000001',
      'actorPersonId', (select actor_one_person_id from p2_s08_people),
      'actingPartyId', (select actor_one_party_id from p2_s08_parties)
    )
  ))
$revoke$, 'decimal expectedVersion revoke does not fail UUID validation');
select is((select state from platform_private.admin_capability_grants
  where id = 'a8080000-0000-4000-8000-000000000110'), 'revoked',
  'valid version-1 revoke transitions the grant to revoked');
select is((select version_no from platform_private.admin_capability_grants
  where id = 'a8080000-0000-4000-8000-000000000110'), 2::bigint,
  'valid version-1 revoke advances the grant to version 2');
create temp table p2_s08_create_request on commit drop as
select jsonb_build_object(
  'action', 'create',
  'grantId', null,
  'expectedVersion', null,
  'subjectPersonId', (select actor_two_person_id::text from p2_s08_people),
  'capabilityKey', 'admin.audit.read',
  'resourceType', 'person',
  'resourceId', (select actor_two_person_id::text from p2_s08_people),
  'scope', jsonb_build_object('actingPartyId', (select actor_one_party_id from p2_s08_parties)),
  'actions', jsonb_build_array('read'),
  'startsAt', (clock_timestamp() - interval '1 minute'),
  'endsAt', (clock_timestamp() + interval '2 hours'),
  'reason', 'valid bounded grant',
  'approverPersonId', null,
  'purposeGrant', false,
  'stepUpToken', null,
  'idempotencyKey', 's08-red-create-001',
  'context', jsonb_build_object(
    'authUserId', 'a8080000-0000-4000-8000-000000000001',
    'actorPersonId', (select actor_one_person_id from p2_s08_people),
    'actingPartyId', (select actor_one_party_id from p2_s08_parties)
  )
) as request;
create temp table p2_s08_created on commit drop as
select platform_api.admin_capability_action(request) as response
from p2_s08_create_request;
select ok((select response->>'outboxEventId' is not null from p2_s08_created),
  'valid grant returns an immutable outbox/notification intent ID');
select is((select count(*)::integer from audit_private.audit_events
  where action = 'admin.capability.create'
    and target_id = (select (response->>'grantId')::uuid from p2_s08_created)), 1,
  'valid grant writes one immutable audit event');
select is((select count(*)::integer from platform_private.outbox_events
  where event_type = 'admin.capability.changed.v1'
    and aggregate_id = (select (response->>'grantId')::uuid from p2_s08_created)), 1,
  'valid grant writes one identifier-only outbox event');

select lives_ok($replay$
  select platform_api.admin_capability_action(request)
  from p2_s08_create_request
$replay$, 'same actor/request idempotently replays the original grant');
select is((select count(*)::integer from platform_private.admin_capability_grants
  where subject_person_id = (select actor_two_person_id from p2_s08_people)
    and capability_key = 'admin.audit.read'
    and resource_type = 'person'
    and resource_id = (select actor_two_person_id from p2_s08_people)
    and grantor_person_id = (select actor_one_person_id from p2_s08_people)), 1,
  'idempotent replay creates no duplicate active grant');

select throws_ok($hash_conflict$
  select platform_api.admin_capability_action(
    request || jsonb_build_object('reason', 'changed request hash')
  ) from p2_s08_create_request
$hash_conflict$, 'P0001', 'IDEMPOTENCY_MISMATCH',
  'same key with a changed request hash is rejected');

-- Same key in a second actor/acting-party isolate is independent and creates
-- its own grant, proving reservations are not globally keyed by raw text.
select is((platform_api.admin_capability_action(
  (select request from p2_s08_create_request) || jsonb_build_object(
    'subjectPersonId', (select actor_one_person_id::text from p2_s08_people),
    'resourceId', (select actor_one_person_id::text from p2_s08_people),
    'scope', jsonb_build_object('actingPartyId', (select actor_two_party_id from p2_s08_parties)),
    'context', jsonb_build_object(
      'authUserId', 'a8080000-0000-4000-8000-000000000002',
      'actorPersonId', (select actor_two_person_id from p2_s08_people),
      'actingPartyId', (select actor_two_party_id from p2_s08_parties)
    )
  )
))->>'state', 'active',
  'same idempotency key remains isolated to a different actor and party');

select throws_ok($overreach$
  select platform_api.admin_capability_action(
    request || jsonb_build_object(
       'resourceId', (select actor_one_person_id::text from p2_s08_people),
      'actions', jsonb_build_array('write'),
      'idempotencyKey', 's08-red-overreach-001'
    )
  ) from p2_s08_create_request
$overreach$, 'P0001', 'FORBIDDEN',
  'grantor overreach beyond its effective action/resource set is denied');
select is((select count(*)::integer from platform_private.admin_capability_grants
  where subject_person_id = (select actor_two_person_id from p2_s08_people)
    and resource_id = (select actor_one_person_id from p2_s08_people)
    and grantor_person_id = (select actor_one_person_id from p2_s08_people)), 0,
  'overreach denial leaves no grant row');

select throws_ok($unknown_scope$
  select platform_api.admin_capability_action(
    request || jsonb_build_object(
      'resourceId', 'a8080000-0000-4000-8000-000000000099',
      'scope', jsonb_build_object(
        'actingPartyId', (select actor_one_party_id from p2_s08_parties),
        'unknownScope', 'not-registered'
      ),
      'idempotencyKey', 's08-red-scope-unknown'
    )
  ) from p2_s08_create_request
$unknown_scope$, 'P0001', 'GRANT_INVALID',
  'unknown scope keys are rejected before persistence');
select throws_ok($cross_party_scope$
  select platform_api.admin_capability_action(
    request || jsonb_build_object(
      'resourceId', 'a8080000-0000-0000-0000-000000000099',
      'scope', jsonb_build_object(
        'actingPartyId', (select actor_two_party_id from p2_s08_parties)
      ),
      'idempotencyKey', 's08-red-scope-cross-party'
    )
  ) from p2_s08_create_request
$cross_party_scope$, 'P0001', 'GRANT_INVALID',
  'cross-party scope is rejected instead of widening authority');
select throws_ok($unrestricted_scope$
  select platform_api.admin_capability_action(
    request || jsonb_build_object(
      'resourceId', 'a8080000-0000-0000-0000-000000000098',
      'scope', '{}'::jsonb,
      'idempotencyKey', 's08-red-scope-unrestricted'
    )
  ) from p2_s08_create_request
$unrestricted_scope$, 'P0001', 'GRANT_INVALID',
  'unrestricted scope without an acting party is rejected');

create function pg_temp.s08_insert_audit_links(p_party_id uuid) returns void
language plpgsql security definer set search_path = '' as $body$
declare event_id uuid := extensions.gen_random_uuid();
begin
  insert into audit_private.audit_events(
    id, action, actor_id, acting_party_id, target_type, target_id,
    decision, reason_code, correlation_id
  ) values (
    event_id, 'admin.audit.fixture',
    'a8080000-0000-4000-8000-000000000001',
    p_party_id, 'person',
    (select actor_two_person_id from pg_temp.p2_s08_people), 'allowed', 'AUDIT_FIXTURE',
    'a8080000-0000-4000-8000-000000000391'
  );
  insert into platform_private.admin_audit_links(
    id, source_type, source_id, source_version, audit_event_id, safe_label
  ) values (
    'a8080000-0000-4000-8000-000000000401', 'person',
    (select actor_two_person_id from pg_temp.p2_s08_people), 1, event_id, 'audit-fixture'
  );
  insert into platform_private.admin_audit_links(
    id, source_type, source_id, source_version, security_event_id, safe_label
  ) values (
    'a8080000-0000-4000-8000-000000000402', 'person',
    (select actor_two_person_id from pg_temp.p2_s08_people), 1,
    'a8080000-0000-4000-8000-000000000399', 'missing-security-evidence'
  );
end;
$body$;
select pg_temp.s08_insert_audit_links(
  (select actor_one_party_id from p2_s08_parties)
);

select throws_ok($unauthorized_existing$
  select platform_api.admin_audit_diagnostic(jsonb_build_object(
    'action', 'read_audit',
    'targetType', 'person',
    'targetId', (select actor_two_person_id::text from p2_s08_people),
    'targetVersion', '1',
    'auditLinkId', 'a8080000-0000-4000-8000-000000000401',
    'diagnosticDefinitionKey', null,
    'diagnosticDefinitionVersion', null,
    'input', null,
    'expectedFreshnessAt', null,
    'reason', 'unauthorized audit read',
    'context', jsonb_build_object(
      'authUserId', 'a8080000-0000-4000-8000-000000000002',
      'actorPersonId', (select actor_two_person_id from p2_s08_people),
      'actingPartyId', (select actor_two_party_id from p2_s08_parties)
    )
  ))
$unauthorized_existing$, 'P0001', 'AUDIT_TARGET_NOT_FOUND',
  'unauthorized existing audit targets are disclosure-safe 404');
select throws_ok($nonexistent_target$
  select platform_api.admin_audit_diagnostic(jsonb_build_object(
    'action', 'read_audit',
    'targetType', 'person',
    'targetId', 'a8080000-0000-0000-0000-000000000099',
    'targetVersion', '1',
    'auditLinkId', 'a8080000-0000-0000-0000-000000000099',
    'diagnosticDefinitionKey', null,
    'diagnosticDefinitionVersion', null,
    'input', null,
    'expectedFreshnessAt', null,
    'reason', 'missing audit read',
    'context', jsonb_build_object(
      'authUserId', 'a8080000-0000-4000-8000-000000000002',
      'actorPersonId', (select actor_two_person_id from p2_s08_people),
      'actingPartyId', (select actor_two_party_id from p2_s08_parties)
    )
  ))
$nonexistent_target$, 'P0001', 'AUDIT_TARGET_NOT_FOUND',
  'nonexistent audit targets return the same disclosure-safe 404');

select set_config('app.expected_s08_freshness',
  (clock_timestamp() + interval '1 hour')::text, true);
create temp table p2_s08_stale_response on commit drop as
select platform_api.admin_audit_diagnostic(jsonb_build_object(
  'action', 'read_audit',
  'targetType', 'person',
  'targetId', (select actor_two_person_id::text from p2_s08_people),
  'targetVersion', '1',
  'auditLinkId', 'a8080000-0000-4000-8000-000000000401',
  'diagnosticDefinitionKey', null,
  'diagnosticDefinitionVersion', null,
  'input', null,
  'expectedFreshnessAt', current_setting('app.expected_s08_freshness'),
  'reason', 'stale audit read',
  'context', jsonb_build_object(
    'authUserId', 'a8080000-0000-4000-8000-000000000001',
    'actorPersonId', (select actor_one_person_id from p2_s08_people),
    'actingPartyId', (select actor_one_party_id from p2_s08_parties)
  )
)) as response;
select is((select response->>'state' from p2_s08_stale_response), 'stale',
  'audit freshness expectation marks older backing evidence stale');

create temp table p2_s08_unknown_response on commit drop as
select platform_api.admin_audit_diagnostic(jsonb_build_object(
  'action', 'read_audit',
  'targetType', 'person',
  'targetId', (select actor_two_person_id::text from p2_s08_people),
  'targetVersion', '1',
  'auditLinkId', 'a8080000-0000-4000-8000-000000000402',
  'diagnosticDefinitionKey', null,
  'diagnosticDefinitionVersion', null,
  'input', null,
  'expectedFreshnessAt', null,
  'reason', 'unknown audit evidence',
  'context', jsonb_build_object(
    'authUserId', 'a8080000-0000-4000-8000-000000000001',
    'actorPersonId', (select actor_one_person_id from p2_s08_people),
    'actingPartyId', (select actor_one_party_id from p2_s08_parties)
  )
)) as response;
select is((select response->>'state' from p2_s08_unknown_response), 'unknown',
  'missing backing evidence never presents as healthy');

select * from finish();

rollback;
