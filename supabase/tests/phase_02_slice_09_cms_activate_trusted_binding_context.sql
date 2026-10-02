begin;

select plan(13);

-- CMS-03A-04 internal acting-context transport. The production service-role
-- Worker sends the verified server actor envelope (authUserId, sessionId,
-- actorPersonId, actingPartyId, step-up evidence, request/correlation ids)
-- plus the private acting-context binding id. The internal activation gate
-- must admit that envelope and keep re-checking the binding against the
-- persisted owner/person/party/active/recent-MFA facts.
--
-- This suite owns and rolls back its own fixtures. It deliberately supplies
-- no review/approval evidence: the fail-closed expectation after the gate is
-- APPROVAL_INVALID, not a synthesized approval path.

insert into auth.users(id) values
  ('a9140000-0000-4000-8000-000000000001'),
  ('a9140000-0000-4000-8000-000000000002');
select platform_api.auth_bootstrap(
  'a9140000-0000-4000-8000-000000000001', decode(repeat('14', 32), 'hex'),
  decode(repeat('24', 32), 'hex'), 'a9140000-0000-4000-8000-000000000208',
  'a9140000-0000-4000-8000-000000000209'
);
select platform_api.auth_bootstrap(
  'a9140000-0000-4000-8000-000000000002', decode(repeat('15', 32), 'hex'),
  decode(repeat('25', 32), 'hex'), 'a9140000-0000-4000-8000-000000000210',
  'a9140000-0000-4000-8000-000000000211'
);

create temporary table s09tb_actor as
select auth_user_id, person_id from identity.auth_user_bindings
where auth_user_id = 'a9140000-0000-4000-8000-000000000001';

insert into platform_private.party(id, kind)
values ('a9140000-0000-4000-8000-000000000101', 'organization');
insert into identity_private.organization_party(party_id)
values ('a9140000-0000-4000-8000-000000000101');
insert into identity_private.membership_tenure(
  organization_id, person_id, state, provenance, governance_mode,
  starts_on, accepted_at, actor_id, version
)
select 'a9140000-0000-4000-8000-000000000101', person_id, 'confirmed',
       'invitation', 'ungoverned', current_date - 1,
       clock_timestamp() - interval '1 day', person_id, 1
from s09tb_actor;
insert into identity_private.organization_actor_grant(
  organization_id, person_id, capability_code, valid_from, valid_through, active
)
select 'a9140000-0000-4000-8000-000000000101', person_id,
       'cms.schema_designer', current_date - 1, current_date + 1, true
from s09tb_actor;

select set_config('app.cms_rpc', 'true', true);
select set_config('app.cfg_rpc', 'true', true);
select set_config('request.jwt.claim.role', 'service_role', true);

insert into platform_private.cms_content_types(
  id, owner_id, state, version, type_key, owner_capability, created_by
) values (
  'a9140000-0000-4000-8000-000000000202',
  'a9140000-0000-4000-8000-000000000101', 'retired', 1, 'articleb',
  'cms.schema_designer', 'a9140000-0000-4000-8000-000000000001'
);
insert into platform_private.cms_content_type_versions(
  id, owner_id, state, version, content_type_id, version_no, labels,
  workflow_key, workflow_version, source_locale, default_locale,
  schema_artifact_id, definition_hash, compatibility, dry_run_id, created_by
) values (
  'a9140000-0000-4000-8000-000000000201',
  'a9140000-0000-4000-8000-000000000101', 'approved', 1,
  'a9140000-0000-4000-8000-000000000202', 1,
  '{"label":"Trusted binding"}'::jsonb, 'editorial', 1, 'en-US', 'en-US',
  'a9140000-0000-4000-8000-000000000203', repeat('e', 64), 'additive',
  'a9140000-0000-4000-8000-000000000206',
  'a9140000-0000-4000-8000-000000000001'
);
insert into platform_private.cms_schema_artifacts(
  id, owner_id, state, version, content_type_version_id, compiler_version,
  zod_contract_ref, editor_manifest, renderer_manifest, artifact_hash, compiled_at
) values (
  'a9140000-0000-4000-8000-000000000203',
  'a9140000-0000-4000-8000-000000000101', 'compiled', 1,
  'a9140000-0000-4000-8000-000000000201', '1',
  'cms/content-type/articleb/v1',
  jsonb_build_object(
    'schema', jsonb_build_object(
      'typeKey', 'articleb', 'label', 'Trusted binding',
      'ownerCapability', 'cms.schema_designer', 'sourceLocale', 'en-US',
      'defaultLocale', 'en-US', 'workflowKey', 'editorial',
      'workflowVersion', '1', 'defaultTemplateVersionId', null,
      'fields', '[]'::jsonb, 'relations', '[]'::jsonb,
      'templateBindings', '[]'::jsonb, 'capabilityBindings', '[]'::jsonb
    ),
    'fields', '[]'::jsonb
  ),
  jsonb_build_object(
    'relations', '[]'::jsonb, 'templateBindings', '[]'::jsonb,
    'capabilityBindings', '[]'::jsonb, 'blockDefinitions', '[]'::jsonb
  ),
  repeat('e', 64), clock_timestamp()
);

-- The valid binding matches the candidate owner. The second binding stands for
-- a selector whose acting party is not the candidate owner.
insert into platform_private.acting_context_binding(
  id, person_id, acting_party_id, context_kind, client_binding_id,
  state, selected_at, last_seen_at, expires_at, projection_version, version
)
select 'a9140000-0000-4000-8000-000000000204', person_id,
       'a9140000-0000-4000-8000-000000000101', 'organization', 's09tb-tab',
       'active', clock_timestamp(), clock_timestamp(),
       clock_timestamp() + interval '2 hours', 1, 1
from s09tb_actor;
insert into platform_private.acting_context_binding(
  id, person_id, acting_party_id, context_kind, client_binding_id,
  state, selected_at, last_seen_at, expires_at, projection_version, version
)
select 'a9140000-0000-4000-8000-000000000205', person_id, person_id,
       'person', 's09tb-self-tab', 'active', clock_timestamp(),
       clock_timestamp(), 'infinity'::timestamptz, 1, 1
from s09tb_actor;

-- Same owner party but a different persisted person: the actor comparison,
-- not the party comparison, must reject this rollback-only fixture.
insert into platform_private.acting_context_binding(
  id, person_id, acting_party_id, context_kind, client_binding_id,
  state, selected_at, last_seen_at, expires_at, projection_version, version
)
select 'a9140000-0000-4000-8000-00000000020b', person_id,
       'a9140000-0000-4000-8000-000000000101', 'organization', 's09tb-other-tab',
       'active', clock_timestamp(), clock_timestamp(),
       clock_timestamp() + interval '2 hours', 1, 1
from identity.auth_user_bindings
where auth_user_id = 'a9140000-0000-4000-8000-000000000002';

-- The verified service-role envelope. No app.auth_user_id app GUC is set:
-- the actor must resolve from the verified context field itself, exactly as
-- the service-role Worker supplies it.
create temporary table s09tb_context as
select jsonb_build_object(
  'actingContextId', 'a9140000-0000-4000-8000-000000000204',
  'authUserId', 'a9140000-0000-4000-8000-000000000001',
  'sessionId', 'a9140000-0000-4000-8000-00000000020a',
  'actorPersonId', (select person_id from s09tb_actor),
  'actingPartyId', 'a9140000-0000-4000-8000-000000000101',
  'stepUpVerified', true,
  'stepUpAt', (clock_timestamp() - interval '5 minutes'),
  'requestId', 'a9140000-0000-4000-8000-000000000208',
  'correlationId', 'a9140000-0000-4000-8000-000000000209'
) as context;
create temporary table s09tb_request as
select jsonb_build_object(
  'contentTypeId', 'a9140000-0000-4000-8000-000000000202',
  'versionId', 'a9140000-0000-4000-8000-000000000201',
  'expectedVersion', '1',
  'dryRunId', 'a9140000-0000-4000-8000-000000000206',
  'approvalIds', jsonb_build_array('a9140000-0000-4000-8000-000000000207'),
  'migrationPlanId', null,
  'idempotencyKey', 's09tb-activate-0001',
  'context', context
) as request
from s09tb_context;

create function pg_temp.try_s09tb_activate(p_request jsonb)
returns jsonb language plpgsql as $fn$
declare returned_state text;
begin
  return platform_api.cms_activate_schema(p_request);
exception when others then
  get stacked diagnostics returned_state = returned_sqlstate;
  return pg_catalog.jsonb_build_object('error', sqlerrm, 'sqlstate', returned_state);
end;
$fn$;

create temporary table s09tb_progress as
select pg_temp.try_s09tb_activate(request) as result from s09tb_request;

select is(
  (select result->>'error' from s09tb_progress),
  'APPROVAL_INVALID',
  'verified server context with an active binding clears the binding-only step-up gate'
);
select is(
  (select pg_temp.try_s09tb_activate(request)->>'error' from s09tb_request),
  (select result->>'error' from s09tb_progress),
  'failed activation leaves no completed idempotency record and repeats deterministically'
);

update platform_private.acting_context_binding
set last_seen_at = clock_timestamp() - interval '11 minutes'
where id = 'a9140000-0000-4000-8000-000000000204';
select is(
  (select pg_temp.try_s09tb_activate(request || jsonb_build_object(
     'idempotencyKey', 's09tb-activate-stale-0001'
   ))->>'error' from s09tb_request),
  'STEP_UP_REQUIRED',
  'stale binding heartbeat still fails closed with STEP_UP_REQUIRED'
);
update platform_private.acting_context_binding
set last_seen_at = clock_timestamp()
where id = 'a9140000-0000-4000-8000-000000000204';

update platform_private.acting_context_binding
set selected_at = clock_timestamp() - interval '1 hour',
    expires_at = clock_timestamp() - interval '1 second'
where id = 'a9140000-0000-4000-8000-000000000204';
select is(
  (select pg_temp.try_s09tb_activate(request || jsonb_build_object(
     'idempotencyKey', 's09tb-activate-expired-0001'
   ))->>'error' from s09tb_request),
  'STEP_UP_REQUIRED',
  'expired binding still fails closed despite a recent heartbeat'
);
update platform_private.acting_context_binding
set selected_at = clock_timestamp(),
    expires_at = clock_timestamp() + interval '2 hours', state = 'revoked'
where id = 'a9140000-0000-4000-8000-000000000204';
select is(
  (select pg_temp.try_s09tb_activate(request || jsonb_build_object(
     'idempotencyKey', 's09tb-activate-revoked-0001'
   ))->>'error' from s09tb_request),
  'STEP_UP_REQUIRED',
  'revoked binding still fails closed despite current expiry and heartbeat'
);
update platform_private.acting_context_binding
set state = 'active'
where id = 'a9140000-0000-4000-8000-000000000204';

select is(
  (select pg_temp.try_s09tb_activate(request || jsonb_build_object(
     'context', jsonb_set(
       request->'context', '{actingContextId}',
       to_jsonb('a9140000-0000-4000-8000-00000000020b'::text)
     ),
     'idempotencyKey', 's09tb-activate-person-0001'
   ))->>'error' from s09tb_request),
  'STEP_UP_REQUIRED',
  'binding with matching owner party but a different persisted person fails closed'
);

select is(
  (select pg_temp.try_s09tb_activate(request || jsonb_build_object(
     'context', jsonb_set(
       request->'context', '{actingContextId}',
       to_jsonb('a9140000-0000-4000-8000-000000000205'::text)
     ),
     'idempotencyKey', 's09tb-activate-party-0001'
   ))->>'error' from s09tb_request),
  'STEP_UP_REQUIRED',
  'binding whose acting party is not the candidate owner fails closed'
);
select is(
  (select pg_temp.try_s09tb_activate(request || jsonb_build_object(
     'context', jsonb_build_object(
       'actingContextId', 'a9140000-0000-4000-8000-000000000204'
     ),
     'idempotencyKey', 's09tb-activate-binding-only-0001'
   ))->>'error' from s09tb_request),
  'UNAUTHENTICATED',
  'binding-only context cannot resolve the service-role actor and fails closed'
);
select is(
  (select pg_temp.try_s09tb_activate(request || jsonb_build_object(
     'context', (request->'context') - 'actingContextId',
     'idempotencyKey', 's09tb-activate-no-binding-0001'
   ))->>'error' from s09tb_request),
  'STEP_UP_REQUIRED',
  'verified context without the private binding id still fails closed'
);
select is(
  (select pg_temp.try_s09tb_activate(request || jsonb_build_object(
     'context', (request->'context') || jsonb_build_object('selector', 'tab-a'),
     'idempotencyKey', 's09tb-activate-extra-key-0001'
   ))->>'error' from s09tb_request),
  'STEP_UP_REQUIRED',
  'unknown nested context key still fails closed'
);
select is(
  (select pg_temp.try_s09tb_activate(request || jsonb_build_object(
     'selector', 'tab-a',
     'idempotencyKey', 's09tb-activate-extra-top-0001'
   ))->>'error' from s09tb_request),
  'INVALID_REQUEST',
  'unknown top-level request key still fails closed'
);

select ok(
  (select count(*) = 0 from platform_private.cfg_config_change_reviews
    where candidate_id = 'a9140000-0000-4000-8000-000000000201')
  and (select state = 'approved' and version = 1
         and dry_run_id = 'a9140000-0000-4000-8000-000000000206'
       from platform_private.cms_content_type_versions
       where id = 'a9140000-0000-4000-8000-000000000201'),
  'rejected activations leave no review evidence and no partial mutation'
);
select ok(
  has_function_privilege('service_role',
    'platform_api.cms_activate_schema(jsonb)', 'execute')
  and not has_function_privilege('authenticated',
    'platform_private.cms_activate_schema(jsonb)', 'execute'),
  'activation stays service-role-only through the public wrapper'
);

select * from finish();
rollback;
