\ir support/jwt-claims.sqlinc
begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users(id) values
  ('a7010000-0000-4000-8000-000000000001'),
  ('a7010000-0000-4000-8000-000000000002'),
  ('a7010000-0000-4000-8000-000000000003');

select platform_api.auth_bootstrap(
  'a7010000-0000-4000-8000-000000000001', decode(repeat('01', 32), 'hex'),
  decode(repeat('11', 32), 'hex'), 'a7010000-0000-4000-8000-000000000011',
  'a7010000-0000-4000-8000-000000000012');
select platform_api.auth_bootstrap(
  'a7010000-0000-4000-8000-000000000002', decode(repeat('02', 32), 'hex'),
  decode(repeat('22', 32), 'hex'), 'a7010000-0000-4000-8000-000000000021',
  'a7010000-0000-4000-8000-000000000022');
select platform_api.auth_bootstrap(
  'a7010000-0000-4000-8000-000000000003', decode(repeat('03', 32), 'hex'),
  decode(repeat('33', 32), 'hex'), 'a7010000-0000-4000-8000-000000000031',
  'a7010000-0000-4000-8000-000000000032');

select pg_temp.set_jwt_claim('role', 'authenticated', true);
select pg_temp.set_jwt_claim('sub', 'a7010000-0000-4000-8000-000000000002', true);
select set_config('app.auth_user_id', 'a7010000-0000-4000-8000-000000000002', true);
select set_config('app.actor_auth_user_id', 'a7010000-0000-4000-8000-000000000002', true);
select set_config('app.actor_person_id', (select person_id::text from identity.auth_user_bindings
  where auth_user_id = 'a7010000-0000-4000-8000-000000000002'), true);
select set_config('app.correlation_id', 'a7010000-0000-4000-8000-000000000041', true);
select set_config('app.idempotency_key_hash', 'slice07-behavior-org', true);
select set_config('app.request_hash', 'slice07-behavior-org-request', true);

create temp table p2_s07_org as
select (result->>'organizationId')::uuid as organization_id,
       (select person_id from identity.auth_user_bindings
         where auth_user_id = 'a7010000-0000-4000-8000-000000000002') as editor_person_id,
       (select person_id from identity.auth_user_bindings
         where auth_user_id = 'a7010000-0000-4000-8000-000000000003') as reviewer_person_id
  from lateral (select platform_api.rpc_create_organization(
    'self_member', '{}'::text[]
  ) as result) created;

insert into platform_private.acting_context_binding(
  id, person_id, acting_party_id, context_kind, source_relationship_id,
  client_binding_id, state, selected_at, last_seen_at, expires_at,
  projection_version, version
)
select 'a7010000-0000-4000-8000-000000000050', fixture.editor_person_id,
       fixture.organization_id, 'organization', tenure.id, 'slice07-editor-org', 'active',
       clock_timestamp(), clock_timestamp(), clock_timestamp() + interval '12 hours', 1, 1
  from p2_s07_org fixture
  join identity_private.membership_tenure tenure
    on tenure.organization_id = fixture.organization_id
   and tenure.person_id = fixture.editor_person_id;

insert into identity_private.membership_tenure(
  id, organization_id, person_id, state, provenance, governance_mode,
  starts_on, accepted_at, invite_expires_at, actor_id
)
select 'a7010000-0000-4000-8000-000000000051', organization_id,
       reviewer_person_id, 'confirmed', 'invitation', 'ungoverned', current_date,
       clock_timestamp(), clock_timestamp() + interval '1 day', editor_person_id
  from p2_s07_org;

insert into platform_private.acting_context_binding(
  id, person_id, acting_party_id, context_kind, source_relationship_id,
  client_binding_id, state, selected_at, last_seen_at, expires_at,
  projection_version, version
)
select 'a7010000-0000-4000-8000-000000000052', reviewer_person_id,
       organization_id, 'organization', 'a7010000-0000-4000-8000-000000000051',
       'slice07-reviewer-org', 'active', clock_timestamp(), clock_timestamp(),
       clock_timestamp() + interval '12 hours', 1, 1
  from p2_s07_org;

insert into identity_private.organization_actor_grant(
  organization_id, person_id, capability_code, valid_from, valid_through, active
)
select organization_id, editor_person_id, capability, current_date,
       current_date + 1, true
  from p2_s07_org
 cross join unnest(array['settings.profile.write','settings.approve']) capability
union all
select organization_id, reviewer_person_id, capability, current_date,
       current_date + 1, true
  from p2_s07_org
 cross join unnest(array['settings.approve','settings.release','settings.rollback']) capability;

insert into platform_private.cfg_release_principals(principal_id, key_id)
values ('a7010000-0000-4000-8000-000000000001', 'release.ci');

select pg_temp.set_jwt_claim('role', 'service_role', true);
select pg_temp.set_jwt_claim('sub', '', true);
select set_config('test.slice07_step_up_at', clock_timestamp()::text, true);

create temp table p2_s07_definition as
select result as response,
       (result->>'definitionId')::uuid as definition_id,
       (result->>'definitionVersionId')::uuid as definition_version_id
  from lateral (select platform_private.cfg_register_definition(
    jsonb_build_object(
      'key', 'profile.visibility', 'valueKind', 'boolean',
      'schema', jsonb_build_object('type', 'boolean'),
      'ownerCapability', 'settings.profile.write',
      'allowedScopes', jsonb_build_array('party','user'),
      'precedence', jsonb_build_array('user','party'), 'mergeMode', 'replace',
      'defaultSource', 'literal', 'defaultValue', false, 'riskClass', 'high',
      'approverPolicy', jsonb_build_object('minimumDistinct', 1,
        'requiresMfa', true, 'requiresCanary', false,
        'notifyCapabilities', jsonb_build_array()),
      'consumerKeys', jsonb_build_array('web.profile'),
      'contractRelease', 'phase-2.7', 'sensitivity', 'internal',
      'reason', 'behavior fixture', 'idempotencyKey', 'slice07-register',
      'context', jsonb_build_object('releasePrincipalId', 'release.ci',
        'requestId', 'a7010000-0000-4000-8000-000000000061',
        'correlationId', 'a7010000-0000-4000-8000-000000000062')
    )
  ) result) registered;

select ok((select response ?& array['definitionId','definitionVersionId','version',
  'schemaHash','contractRelease','synchronized'] from p2_s07_definition),
  'P2-S07-AC-005 registration returns the strict safe definition projection');
select is((select count(*)::integer from platform_private.outbox_events
  where event_type = 'config.definition.registered.v1'), 1,
  'P2-S07-AC-010 registration commits one identifier-only outbox event');
select ok((select payload - array['definitionId','definitionVersionId','version']::text[] = '{}'::jsonb
  from platform_private.outbox_events
  where event_type = 'config.definition.registered.v1'),
  'P2-S07-AC-044 registration event excludes schema, default, and key material');

create temp table p2_s07_proposal as
select result as response,
       (result->>'reviewId')::uuid as review_id,
       result->>'valueHash' as candidate_hash
  from p2_s07_definition definition
 cross join lateral (select platform_private.cfg_propose_change(
    jsonb_build_object(
      'definitionId', definition.definition_id, 'scopeType', 'party',
      'scopeId', (select organization_id from p2_s07_org), 'environment', null,
      'typedValue', true, 'interval', jsonb_build_object(
        'effectiveFrom', clock_timestamp() - interval '1 minute', 'effectiveTo', null),
      'expectedDefinitionVersion', '1',
      'impactManifest', jsonb_build_object('consumers', jsonb_build_array('web.profile')),
      'rollbackCandidate', false, 'reason', 'enable fixture',
      'consumerKeys', jsonb_build_array('web.profile'),
      'idempotencyKey', 'slice07-propose',
      'context', jsonb_build_object(
        'authUserId', 'a7010000-0000-4000-8000-000000000002',
        'actorPersonId', (select editor_person_id from p2_s07_org),
        'actingPartyId', (select organization_id from p2_s07_org),
        'stepUpVerified', true, 'stepUpAt', current_setting('test.slice07_step_up_at'),
        'requestId', 'a7010000-0000-4000-8000-000000000071',
        'correlationId', 'a7010000-0000-4000-8000-000000000072')
    )
  ) result) proposed;

select is((select response->>'state' from p2_s07_proposal), 'draft',
  'P2-S07-AC-017 authorized proposal creates a no-effect draft');
select is((select rollback_hash from platform_private.cfg_config_change_reviews
  where id = (select review_id from p2_s07_proposal)),
  platform_private.cfg_hash_json('false'::jsonb),
  'P2-S07-AC-003 proposal freezes the rollback candidate by content hash');
select ok((select payload ?& array['reviewId','candidateId','candidateVersion']::text[]
  and payload - array['reviewId','candidateId','candidateVersion']::text[] = '{}'::jsonb
  from platform_private.outbox_events where event_type = 'config.change.proposed.v1'),
  'P2-S07-AC-046 proposal event contains identifiers only');

select throws_ok($$select platform_private.cfg_resolve_effective_value(
  jsonb_build_object('key','profile.visibility','consumerKey','web.profile',
    'supportedDefinitionVersions',jsonb_build_array('1'),
    'partyId','a7010000-0000-4000-8000-000000000099',
    'context',jsonb_build_object(
      'authUserId','a7010000-0000-4000-8000-000000000002',
      'actingPartyId',(select organization_id from p2_s07_org)))
)$$, 'P0001', 'FORBIDDEN',
  'P2-S07-AC-013 human resolver rejects a cross-party context IDOR');
select throws_ok($$select platform_private.cfg_resolve_effective_value(
  jsonb_build_object('key','profile.visibility','consumerKey','web.profile',
    'supportedDefinitionVersions',jsonb_build_array('1'),
    'siteId','a7010000-0000-4000-8000-000000000098',
    'context',jsonb_build_object(
      'authUserId','a7010000-0000-4000-8000-000000000002',
      'actingPartyId',(select organization_id from p2_s07_org)))
)$$, 'P0001', 'FORBIDDEN',
  'P2-S07-AC-038 human resolver rejects an unregistered site scope');

create temp table p2_s07_approved as
select platform_private.cfg_change_action(jsonb_build_object(
  'reviewId', proposal.review_id, 'action', 'approve',
  'expectedReviewVersion', '1', 'candidateHash', proposal.candidate_hash,
  'approvalReason', 'independent review', 'idempotencyKey', 'slice07-approve',
  'context', jsonb_build_object(
    'authUserId', 'a7010000-0000-4000-8000-000000000003',
    'actorPersonId', (select reviewer_person_id from p2_s07_org),
    'actingPartyId', (select organization_id from p2_s07_org),
    'stepUpVerified', true, 'stepUpAt', current_setting('test.slice07_step_up_at'))
)) as response from p2_s07_proposal proposal;
select is((select response->>'resultingState' from p2_s07_approved), 'approved',
  'P2-S07-AC-023 a distinct capable reviewer approves the frozen candidate');
select is(
  (select approval.review_version::text
     from platform_private.cfg_config_approvals approval
    where approval.review_id = (select review_id from p2_s07_proposal)),
  (select review.version_no::text
     from platform_private.cfg_config_change_reviews review
    where review.id = (select review_id from p2_s07_proposal)),
  'P2-S07 approval evidence binds to the resulting current review version'
);

create temp table p2_s07_activated as
select platform_private.cfg_change_action(jsonb_build_object(
  'reviewId', proposal.review_id, 'action', 'activate',
  'expectedReviewVersion', '2', 'candidateHash', proposal.candidate_hash,
  'approvalReason', 'release approved value', 'idempotencyKey', 'slice07-activate',
  'context', jsonb_build_object(
    'authUserId', 'a7010000-0000-4000-8000-000000000003',
    'actorPersonId', (select reviewer_person_id from p2_s07_org),
    'actingPartyId', (select organization_id from p2_s07_org),
    'stepUpVerified', true, 'stepUpAt', current_setting('test.slice07_step_up_at'))
)) as response from p2_s07_proposal proposal;
select is((select response->>'resultingState' from p2_s07_activated), 'active',
  'P2-S07-AC-028 activation commits approved value, snapshot intent, audit, and outbox');

create temp table p2_s07_effective as
select platform_private.cfg_resolve_effective_value(jsonb_build_object(
  'key', 'profile.visibility', 'consumerKey', 'web.profile',
  'supportedDefinitionVersions', jsonb_build_array('1'),
  'partyId', (select organization_id from p2_s07_org),
  'context', jsonb_build_object(
    'authUserId', 'a7010000-0000-4000-8000-000000000002',
    'actingPartyId', (select organization_id from p2_s07_org))
)) as response;
select is((select response->>'ownerCapability' from p2_s07_effective),
  'settings.profile.write',
  'P2-S07 effective read returns the owner capability of the resolved definition version');
select is((select response->'typedValue' from p2_s07_effective), 'true'::jsonb,
  'P2-S07 effective read still returns the activated party value');

select throws_ok($$select platform_private.cfg_change_action(jsonb_build_object(
  'reviewId',(select review_id from p2_s07_proposal),'action','rollback',
  'expectedReviewVersion','3','candidateHash',(select candidate_hash from p2_s07_proposal),
  'approvalReason','mismatch must fail','rollbackValue',true,
  'idempotencyKey','slice07-rollback-mismatch','context',jsonb_build_object(
    'authUserId','a7010000-0000-4000-8000-000000000003',
    'actingPartyId',(select organization_id from p2_s07_org),
    'stepUpVerified',true,'stepUpAt',current_setting('test.slice07_step_up_at'))
))$$, 'P0001', 'VERSION_CONFLICT',
  'P2-S07-AC-040 rollback refuses a value different from the frozen candidate');

select is((platform_private.cfg_change_action(jsonb_build_object(
  'reviewId',(select review_id from p2_s07_proposal),'action','rollback',
  'expectedReviewVersion','3','candidateHash',(select candidate_hash from p2_s07_proposal),
  'approvalReason','restore last known good','rollbackValue',false,
  'idempotencyKey','slice07-rollback','context',jsonb_build_object(
    'authUserId','a7010000-0000-4000-8000-000000000003',
    'actingPartyId',(select organization_id from p2_s07_org),
    'stepUpVerified',true,'stepUpAt',current_setting('test.slice07_step_up_at'))
))->>'resultingState'), 'rolled_back',
  'P2-S07-AC-003 rollback creates a forward active version without erasing history');

select ok((select count(*) = 2 from platform_private.cfg_setting_value_versions
  where definition_id = (select definition_id from p2_s07_definition)),
  'P2-S07-AC-030 activation and rollback retain append-only value history');
select ok(not exists(select 1 from audit_private.audit_events
  where target_type = 'config_change_review'
    and (reason_code ilike '%true%' or reason_code ilike '%false%')),
  'P2-S07-AC-047 transition audit contains no candidate or rollback value');

select * from finish();
rollback;
