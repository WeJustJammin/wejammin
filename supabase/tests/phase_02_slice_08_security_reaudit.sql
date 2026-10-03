\ir support/jwt-claims.sqlinc
begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

-- P2-S08 security re-audit.  Every fixture binding is one-to-one: actor one
-- acts only for party one and actor two acts only for party two.
insert into auth.users(id) values
  ('a8090000-0000-4000-8000-000000000001'),
  ('a8090000-0000-4000-8000-000000000002');
select platform_api.auth_bootstrap(
  'a8090000-0000-4000-8000-000000000001', decode(repeat('31', 32), 'hex'),
  decode(repeat('41', 32), 'hex'), 'a8090000-0000-4000-8000-000000000011',
  'a8090000-0000-4000-8000-000000000012');
select platform_api.auth_bootstrap(
  'a8090000-0000-4000-8000-000000000002', decode(repeat('32', 32), 'hex'),
  decode(repeat('42', 32), 'hex'), 'a8090000-0000-4000-8000-000000000021',
  'a8090000-0000-4000-8000-000000000022');
create temp table p2_s08_reaudit_people on commit drop as
select
  (select person_id from identity.auth_user_bindings
    where auth_user_id = 'a8090000-0000-4000-8000-000000000001') as actor_one_person_id,
  (select person_id from identity.auth_user_bindings
    where auth_user_id = 'a8090000-0000-4000-8000-000000000002') as actor_two_person_id;

select pg_temp.set_jwt_claim('role', 'authenticated', true);
select pg_temp.set_jwt_claim('sub', 'a8090000-0000-4000-8000-000000000001', true);
select set_config('app.auth_user_id', 'a8090000-0000-4000-8000-000000000001', true);
select set_config('app.actor_auth_user_id', 'a8090000-0000-4000-8000-000000000001', true);
select set_config('app.actor_person_id',
  (select actor_one_person_id::text from p2_s08_reaudit_people), true);
select set_config('app.idempotency_key_hash', 's08-reaudit-org-one', true);
select set_config('app.request_hash', 's08-reaudit-org-one-request', true);
select set_config('app.correlation_id', 'a8090000-0000-4000-8000-000000000091', true);
create temp table p2_s08_reaudit_parties on commit drop as
select ((platform_api.rpc_create_organization('self_member', '{}'::text[]))->>'organizationId')::uuid
  as actor_one_party_id;
select pg_temp.set_jwt_claim('sub', 'a8090000-0000-4000-8000-000000000002', true);
select set_config('app.auth_user_id', 'a8090000-0000-4000-8000-000000000002', true);
select set_config('app.actor_auth_user_id', 'a8090000-0000-4000-8000-000000000002', true);
select set_config('app.actor_person_id',
  (select actor_two_person_id::text from p2_s08_reaudit_people), true);
select set_config('app.idempotency_key_hash', 's08-reaudit-org-two', true);
select set_config('app.request_hash', 's08-reaudit-org-two-request', true);
select set_config('app.correlation_id', 'a8090000-0000-4000-8000-000000000092', true);
alter table p2_s08_reaudit_parties add column actor_two_party_id uuid;
update p2_s08_reaudit_parties
set actor_two_party_id =
  ((platform_api.rpc_create_organization('self_member', '{}'::text[]))->>'organizationId')::uuid;

insert into platform_private.acting_context_binding(
  id, person_id, acting_party_id, context_kind, client_binding_id,
  state, selected_at, last_seen_at, expires_at, projection_version, version
) values
  (
    'a8090000-0000-4000-8000-000000000061',
    (select actor_one_person_id from p2_s08_reaudit_people),
    (select actor_one_party_id from p2_s08_reaudit_parties),
    'organization', 's09-client-one',
    'active'::platform_private.context_binding_state, clock_timestamp(), clock_timestamp(),
    clock_timestamp() + interval '2 hours', 1, 1
  ),
  (
    'a8090000-0000-4000-8000-000000000062',
    (select actor_two_person_id from p2_s08_reaudit_people),
    (select actor_two_party_id from p2_s08_reaudit_parties),
    'organization', 's09-client-two',
    'active'::platform_private.context_binding_state, clock_timestamp(), clock_timestamp(),
    clock_timestamp() + interval '2 hours', 1, 1
  );
insert into identity_private.organization_actor_grant(
  organization_id, person_id, capability_code, valid_from, valid_through, active
) values
  (
    (select actor_one_party_id from p2_s08_reaudit_parties),
    (select actor_one_person_id from p2_s08_reaudit_people),
    'admin.capability.grant', current_date, current_date + 1, true
  ),
  (
    (select actor_two_party_id from p2_s08_reaudit_parties),
    (select actor_two_person_id from p2_s08_reaudit_people),
    'admin.capability.grant', current_date, current_date + 1, true
  );

-- Actor one can delegate only read access to actor two's person resource.
insert into platform_private.admin_capability_grants(
  id, subject_person_id, capability_key, resource_type, resource_id, scope,
  actions, starts_at, ends_at, grantor_person_id, reason, purpose_grant,
  state, version_no
) values
  (
    'a8090000-0000-4000-8000-000000000101',
    (select actor_one_person_id from p2_s08_reaudit_people), 'admin.audit.read', 'person',
    (select actor_two_person_id from p2_s08_reaudit_people),
    jsonb_build_object('actingPartyId', (select actor_one_party_id from p2_s08_reaudit_parties)),
    array['read'], clock_timestamp() - interval '1 hour', clock_timestamp() + interval '1 day',
    (select actor_one_person_id from p2_s08_reaudit_people), 'parent authority', false, 'active', 1
  ),
  (
    'a8090000-0000-4000-8000-000000000102',
    (select actor_one_person_id from p2_s08_reaudit_people), 'admin.audit.read', 'person',
    (select actor_one_person_id from p2_s08_reaudit_people),
    jsonb_build_object('actingPartyId', (select actor_one_party_id from p2_s08_reaudit_parties)),
    array['read'], clock_timestamp() - interval '1 hour', clock_timestamp() + interval '1 day',
    (select actor_one_person_id from p2_s08_reaudit_people), 'parent authority self resource', false, 'active', 1
  ),
  (
    'a8090000-0000-4000-8000-000000000103',
    (select actor_one_person_id from p2_s08_reaudit_people), 'admin.audit.read', 'job',
    'a8090000-0000-4000-8000-000000000099',
    jsonb_build_object('actingPartyId', (select actor_one_party_id from p2_s08_reaudit_parties)),
    array['read'], clock_timestamp() - interval '1 hour', clock_timestamp() + interval '1 day',
    (select actor_one_person_id from p2_s08_reaudit_people), 'parent authority job resource', false, 'active', 1
  ),
  (
    'a8090000-0000-4000-8000-000000000110',
    (select actor_two_person_id from p2_s08_reaudit_people), 'admin.audit.read', 'person',
    'a8090000-0000-4000-8000-000000000099',
    jsonb_build_object('actingPartyId', (select actor_one_party_id from p2_s08_reaudit_parties)),
    array['read'], clock_timestamp(), clock_timestamp() + interval '2 hours',
    (select actor_one_person_id from p2_s08_reaudit_people), 'stale If-Match fixture', false, 'active', 1
  ),
  (
    'a8090000-0000-4000-8000-000000000111',
    (select actor_two_person_id from p2_s08_reaudit_people), 'admin.audit.read', 'person',
    'a8090000-0000-4000-8000-000000000098',
    jsonb_build_object('actingPartyId', (select actor_one_party_id from p2_s08_reaudit_parties)),
    array['read'], clock_timestamp(), clock_timestamp() + interval '2 hours',
    (select actor_one_person_id from p2_s08_reaudit_people), 'exact If-Match fixture', false, 'active', 1
  );

select pg_temp.set_jwt_claim('role', 'service_role', true);
select pg_temp.set_jwt_claim('sub', '', true);

-- Purpose grants require a named approver other than the actor/grantor and a
-- fresh MFA/step-up context.  Rejections must leave no canonical/effect row.
select throws_ok($purpose_missing$
  select platform_api.admin_capability_action(jsonb_build_object(
    'action', 'create', 'grantId', null, 'expectedVersion', null,
    'subjectPersonId', (select actor_two_person_id::text from p2_s08_reaudit_people),
    'capabilityKey', 'admin.audit.read', 'resourceType', 'person',
    'resourceId', (select actor_two_person_id::text from p2_s08_reaudit_people),
    'scope', jsonb_build_object('actingPartyId', (select actor_one_party_id from p2_s08_reaudit_parties)),
    'actions', jsonb_build_array('read'),
    'startsAt', clock_timestamp() - interval '1 minute',
    'endsAt', clock_timestamp() + interval '1 hour',
    'reason', 'purpose missing approver', 'approverPersonId', null,
    'purposeGrant', true, 'stepUpToken', 'step-up-token-value-0001',
    'idempotencyKey', 's08-reaudit-purpose-missing',
    'context', jsonb_build_object(
      'authUserId', 'a8090000-0000-4000-8000-000000000001',
      'actorPersonId', (select actor_one_person_id from p2_s08_reaudit_people),
      'actingPartyId', (select actor_one_party_id from p2_s08_reaudit_parties),
      'stepUpVerified', 'true',
      'stepUpAt', clock_timestamp() - interval '1 minute'
    )
  ))
$purpose_missing$, 'P0001', 'GRANT_INVALID',
  'purpose grant without approver is rejected before persistence');
select throws_ok($purpose_self$
  select platform_api.admin_capability_action(jsonb_build_object(
    'action', 'create', 'grantId', null, 'expectedVersion', null,
    'subjectPersonId', (select actor_two_person_id::text from p2_s08_reaudit_people),
    'capabilityKey', 'admin.audit.read', 'resourceType', 'person',
    'resourceId', (select actor_one_person_id::text from p2_s08_reaudit_people),
    'scope', jsonb_build_object('actingPartyId', (select actor_one_party_id from p2_s08_reaudit_parties)),
    'actions', jsonb_build_array('read'),
    'startsAt', clock_timestamp() - interval '1 minute',
    'endsAt', clock_timestamp() + interval '1 hour',
    'reason', 'purpose self approver',
    'approverPersonId', (select actor_one_person_id::text from p2_s08_reaudit_people),
    'purposeGrant', true, 'stepUpToken', 'step-up-token-value-0002',
    'idempotencyKey', 's08-reaudit-purpose-self',
    'context', jsonb_build_object(
      'authUserId', 'a8090000-0000-4000-8000-000000000001',
      'actorPersonId', (select actor_one_person_id from p2_s08_reaudit_people),
      'actingPartyId', (select actor_one_party_id from p2_s08_reaudit_parties),
      'stepUpVerified', 'true',
      'stepUpAt', clock_timestamp() - interval '1 minute'
    )
  ))
$purpose_self$, 'P0001', 'GRANT_INVALID',
  'purpose grant self-approval is rejected before persistence');
select throws_ok($purpose_no_mfa$
  select platform_api.admin_capability_action(jsonb_build_object(
    'action', 'create', 'grantId', null, 'expectedVersion', null,
    'subjectPersonId', (select actor_two_person_id::text from p2_s08_reaudit_people),
    'capabilityKey', 'admin.audit.read', 'resourceType', 'job',
    'resourceId', 'a8090000-0000-4000-8000-000000000099',
    'scope', jsonb_build_object('actingPartyId', (select actor_one_party_id from p2_s08_reaudit_parties)),
    'actions', jsonb_build_array('read'),
    'startsAt', clock_timestamp() - interval '1 minute',
    'endsAt', clock_timestamp() + interval '1 hour',
    'reason', 'purpose stale MFA',
    'approverPersonId', (select actor_two_person_id::text from p2_s08_reaudit_people),
    'purposeGrant', true, 'stepUpToken', 'step-up-token-value-0003',
    'idempotencyKey', 's08-reaudit-purpose-no-mfa',
    'context', jsonb_build_object(
      'authUserId', 'a8090000-0000-4000-8000-000000000001',
      'actorPersonId', (select actor_one_person_id from p2_s08_reaudit_people),
      'actingPartyId', (select actor_one_party_id from p2_s08_reaudit_parties)
    )
  ))
$purpose_no_mfa$, 'P0001', 'STEP_UP_REQUIRED',
  'purpose grant without fresh MFA is rejected before persistence');
select is((select count(*)::integer from platform_private.admin_capability_grants
  where purpose_grant and grantor_person_id = (select actor_one_person_id from p2_s08_reaudit_people)
    and reason like 'purpose %'), 0,
  'purpose approval failures leave no grant mutation');
select is((select count(*)::integer from audit_private.audit_events
  where action = 'admin.capability.create'
    and actor_id = 'a8090000-0000-4000-8000-000000000001'), 0,
  'purpose approval failures emit no audit effect');
select is((select count(*)::integer from platform_private.outbox_events
  where event_type = 'admin.capability.changed.v1'
    and aggregate_type = 'admin_capability_grant'), 0,
  'purpose approval failures emit no outbox effect');

-- The Worker supplies If-Match separately from the body.  It is copied to the
-- RPC request as a decimal string and must be the exact target version.
select throws_ok($stale_if_match$
  select platform_api.admin_capability_action(jsonb_build_object(
    'action', 'revoke', 'grantId', 'a8090000-0000-4000-8000-000000000110',
    'expectedVersion', '1', 'ifMatch', '2', 'subjectPersonId', null,
    'capabilityKey', null, 'resourceType', null, 'resourceId', null,
    'scope', null, 'actions', null, 'startsAt', null, 'endsAt', null,
    'reason', null, 'approverPersonId', null, 'purposeGrant', null,
    'stepUpToken', null, 'idempotencyKey', 's08-reaudit-if-match-stale',
    'context', jsonb_build_object(
      'authUserId', 'a8090000-0000-4000-8000-000000000001',
      'actorPersonId', (select actor_one_person_id from p2_s08_reaudit_people),
      'actingPartyId', (select actor_one_party_id from p2_s08_reaudit_parties)
    )
  ))
$stale_if_match$, 'P0001', 'GRANT_VERSION_CONFLICT',
  'stale Worker If-Match is rejected without revoking the target');
select is((select state from platform_private.admin_capability_grants
  where id = 'a8090000-0000-4000-8000-000000000110'), 'active',
  'stale Worker If-Match leaves target state unchanged');
select lives_ok($exact_if_match$
  select platform_api.admin_capability_action(jsonb_build_object(
    'action', 'revoke', 'grantId', 'a8090000-0000-4000-8000-000000000111',
    'expectedVersion', '1', 'ifMatch', '1', 'subjectPersonId', null,
    'capabilityKey', null, 'resourceType', null, 'resourceId', null,
    'scope', null, 'actions', null, 'startsAt', null, 'endsAt', null,
    'reason', null, 'approverPersonId', null, 'purposeGrant', null,
    'stepUpToken', null, 'idempotencyKey', 's08-reaudit-if-match-exact',
    'context', jsonb_build_object(
      'authUserId', 'a8090000-0000-4000-8000-000000000001',
      'actorPersonId', (select actor_one_person_id from p2_s08_reaudit_people),
      'actingPartyId', (select actor_one_party_id from p2_s08_reaudit_parties)
    )
  ))
$exact_if_match$, 'exact Worker If-Match is accepted by the capability CAS');
select is((select state from platform_private.admin_capability_grants
  where id = 'a8090000-0000-4000-8000-000000000111'), 'revoked',
  'exact Worker If-Match revokes the target');
select is((select version_no from platform_private.admin_capability_grants
  where id = 'a8090000-0000-4000-8000-000000000111'), 2::bigint,
  'exact Worker If-Match advances the target version');

-- Trace IDs are transport metadata, not request business content.  Changing
-- them with the same key must replay the durable response, not conflict.
create temp table p2_s08_reaudit_trace_request on commit drop as
select jsonb_build_object(
  'action', 'create', 'grantId', null, 'expectedVersion', null,
  'subjectPersonId', (select actor_two_person_id::text from p2_s08_reaudit_people),
  'capabilityKey', 'admin.audit.read', 'resourceType', 'job',
  'resourceId', 'a8090000-0000-4000-8000-000000000099',
  'scope', jsonb_build_object('actingPartyId', (select actor_one_party_id from p2_s08_reaudit_parties)),
  'actions', jsonb_build_array('read'),
  'startsAt', clock_timestamp() - interval '1 minute',
  'endsAt', clock_timestamp() + interval '1 hour',
  'reason', 'trace-independent replay', 'approverPersonId', null,
  'purposeGrant', false, 'stepUpToken', null,
  'idempotencyKey', 's08-reaudit-trace-replay',
  'context', jsonb_build_object(
    'authUserId', 'a8090000-0000-4000-8000-000000000001',
    'actorPersonId', (select actor_one_person_id from p2_s08_reaudit_people),
    'actingPartyId', (select actor_one_party_id from p2_s08_reaudit_parties),
    'requestId', 'a8090000-0000-4000-8000-000000000301',
    'correlationId', 'a8090000-0000-4000-8000-000000000302'
  )
) as request;
create temp table p2_s08_reaudit_trace_result on commit drop as
select platform_api.admin_capability_action(request) as response
from p2_s08_reaudit_trace_request;
select lives_ok($trace_replay$
  select platform_api.admin_capability_action(
    request || jsonb_build_object('context', jsonb_build_object(
      'authUserId', 'a8090000-0000-4000-8000-000000000001',
      'actorPersonId', (select actor_one_person_id from p2_s08_reaudit_people),
      'actingPartyId', (select actor_one_party_id from p2_s08_reaudit_parties),
      'requestId', 'a8090000-0000-4000-8000-000000000303',
      'correlationId', 'a8090000-0000-4000-8000-000000000304'
    )))
  from p2_s08_reaudit_trace_request
$trace_replay$, 'same business request replays across Worker trace IDs');
select is((select count(*)::integer from platform_private.admin_capability_grants
  where subject_person_id = (select actor_two_person_id from p2_s08_reaudit_people)
    and resource_id = 'a8090000-0000-4000-8000-000000000099'
    and reason = 'trace-independent replay'), 1,
  'trace-only replay does not create a duplicate grant');

select * from finish();

rollback;
