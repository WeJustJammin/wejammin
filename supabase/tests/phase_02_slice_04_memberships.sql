\ir support/jwt-claims.sqlinc
begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

-- P2-S04 membership persistence RED contract.  Catalog guards keep this
-- useful before implementation: absent tables produce assertion failures,
-- not an undefined-relation abort.
select has_table('identity_private', 'membership_tenure',
  'membership tenure table exists');
select has_table('identity_private', 'membership_capacity_period',
  'membership capacity period table exists');
select has_table('identity_private', 'organization_duplicate_review',
  'membership slice shares duplicate review persistence');

select ok(
  (select count(*) = 3
     and bool_and(relrowsecurity and relforcerowsecurity)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'identity_private'
     and c.relname = any(array[
       'membership_tenure', 'membership_capacity_period',
       'organization_duplicate_review']::name[])),
  'all Slice 04 membership tables force RLS'
);

select ok(
  (select count(*) = 9
     and bool_and(
       case when to_regclass(t.table_name) is null then false
            else not has_table_privilege(r.role_name, t.table_name, 'select')
             and not has_table_privilege(r.role_name, t.table_name, 'insert')
             and not has_table_privilege(r.role_name, t.table_name, 'update')
             and not has_table_privilege(r.role_name, t.table_name, 'delete')
       end)
    from (values ('anon'::name), ('authenticated'::name), ('service_role'::name)) r(role_name)
    cross join (values
      ('identity_private.membership_tenure'::text),
      ('identity_private.membership_capacity_period'::text),
      ('identity_private.organization_duplicate_review'::text)) t(table_name)),
  'browser and service roles have no direct membership table grants'
);

select has_column('identity_private', 'membership_tenure', 'organization_id',
  'tenure references an organization');
select has_column('identity_private', 'membership_tenure', 'person_id',
  'tenure references a person');
select has_column('identity_private', 'membership_tenure', 'state',
  'tenure stores its lifecycle state');
select has_column('identity_private', 'membership_tenure', 'provenance',
  'tenure stores invitation or historical provenance');
select has_column('identity_private', 'membership_tenure', 'starts_on',
  'tenure stores its start date');
select has_column('identity_private', 'membership_tenure', 'ends_on',
  'tenure stores its optional end date');
select has_column('identity_private', 'membership_tenure', 'accepted_at',
  'tenure stores acceptance evidence');
select has_column('identity_private', 'membership_tenure', 'revoked_at',
  'tenure stores revocation evidence');
select has_column('identity_private', 'membership_tenure', 'accepted_terms_version_id',
  'tenure locks the accepted governance terms version');
select has_column('identity_private', 'membership_tenure', 'version',
  'tenure version supports CAS');
select has_column('identity_private', 'membership_capacity_period', 'tenure_id',
  'capacity period references a tenure');
select has_column('identity_private', 'membership_capacity_period', 'capacity',
  'capacity period stores its closed capacity code');
select has_column('identity_private', 'membership_capacity_period', 'starts_on',
  'capacity period stores its start date');
select has_column('identity_private', 'membership_capacity_period', 'ends_on',
  'capacity period stores its optional end date');

select ok(
  exists (
    select 1
      from pg_constraint c
     where c.conrelid = to_regclass('identity_private.membership_tenure')
       and c.contype = 'c'
       and pg_get_constraintdef(c.oid) ilike '%state%'
       and pg_get_constraintdef(c.oid) ilike '%invited%'
       and pg_get_constraintdef(c.oid) ilike '%confirmed%'
       and pg_get_constraintdef(c.oid) ilike '%rejected%'
       and pg_get_constraintdef(c.oid) ilike '%expired%'),
  'membership tenure uses the closed invited/asserted/confirmed/end states'
);
select ok(
  exists (
    select 1
      from pg_constraint c
     where c.conrelid = to_regclass('identity_private.membership_tenure')
       and c.contype = 'c'
       and pg_get_constraintdef(c.oid) ilike '%provenance%'
       and pg_get_constraintdef(c.oid) ilike '%invitation%'
       and pg_get_constraintdef(c.oid) ilike '%historical_assertion%'),
  'membership provenance is limited to invitation and historical assertion'
);
select ok(
  exists (
    select 1
      from pg_constraint c
     where c.conrelid = to_regclass('identity_private.membership_tenure')
       and c.contype = 'c'
       and pg_get_constraintdef(c.oid) ilike '%ends_on%'
       and pg_get_constraintdef(c.oid) ilike '%starts_on%'),
  'membership tenure end date follows start date'
);
select ok(
  exists (
    select 1
      from pg_constraint c
     where c.conrelid = to_regclass('identity_private.membership_capacity_period')
       and c.contype = 'c'
       and pg_get_constraintdef(c.oid) ilike '%capacity%'
       and pg_get_constraintdef(c.oid) ilike '%permanent%'
       and pg_get_constraintdef(c.oid) ilike '%honorary%'),
  'membership capacity uses the permanent/touring/staff/honorary registry'
);
select ok(
  exists (
    select 1
      from pg_constraint c
     where c.conrelid = to_regclass('identity_private.membership_capacity_period')
       and c.contype = 'c'
       and pg_get_constraintdef(c.oid) ilike '%ends_on%'
       and pg_get_constraintdef(c.oid) ilike '%starts_on%'),
  'capacity period end date follows start date'
);
select ok(
  exists (
    select 1
      from pg_constraint c
     where c.conrelid = to_regclass('identity_private.membership_capacity_period')
       and c.contype = 'x'
       and pg_get_constraintdef(c.oid) ilike '%tenure_id%'
       and pg_get_constraintdef(c.oid) ilike '%daterange%'),
  'capacity periods cannot overlap inside a tenure'
);
select ok(
  exists (
    select 1
      from pg_index i
     where i.indrelid = to_regclass('identity_private.membership_tenure')
       and pg_get_indexdef(i.indexrelid) ilike '%organization_id%'
       and pg_get_indexdef(i.indexrelid) ilike '%state%'
       and pg_get_indexdef(i.indexrelid) ilike '%starts_on%'),
  'membership roster lookup has organization/state/date index coverage'
);
select ok(
  exists (
    select 1
      from pg_index i
     where i.indrelid = to_regclass('identity_private.membership_tenure')
       and pg_get_indexdef(i.indexrelid) ilike '%person_id%'
       and pg_get_indexdef(i.indexrelid) ilike '%state%'
       and pg_get_indexdef(i.indexrelid) ilike '%starts_on%'),
  'membership self lookup has person/state/date index coverage'
);
select ok(
  exists (
    select 1
      from pg_index i
     where i.indrelid = to_regclass('identity_private.membership_capacity_period')
       and pg_get_indexdef(i.indexrelid) ilike '%tenure_id%'
       and pg_get_indexdef(i.indexrelid) ilike '%starts_on%'),
  'capacity period lookup has tenure/date index coverage'
);

select ok(
  (select count(*) = 6
     and bool_and(prosecdef)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'identity_private'
     and p.proname = any(array[
       'rpc_create_organization', 'rpc_change_organization_type',
       'rpc_invite_membership', 'rpc_assert_membership',
       'rpc_accept_or_end_membership', 'rpc_add_capacity_period']::name[])),
  'membership mutation RPC set is present and protected'
);
select ok(
  (select count(*) = 3
     and bool_and(
       lower(pg_get_functiondef(p.oid)) like '%idempotenc%'
       and (lower(pg_get_functiondef(p.oid)) like '%outbox_events%'
         or lower(pg_get_functiondef(p.oid)) like '%identity_record_effects%')
       and (lower(pg_get_functiondef(p.oid)) like '%audit_events%'
         or lower(pg_get_functiondef(p.oid)) like '%identity_record_effects%'))
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'identity_private'
     and p.proname = any(array[
       'rpc_invite_membership', 'rpc_assert_membership',
       'rpc_accept_or_end_membership']::name[])),
  'membership transitions reserve idempotency and atomically record audit/outbox effects'
);

select ok(
  coalesce((select pg_get_functiondef(
    to_regprocedure('platform_private.valid_base_event_payload(text,integer,jsonb)'))
    ilike '%identity.relationship.changed.v1%'), false),
  'relationship change event is registered with the base event validator'
);
select ok(
  coalesce((select pg_get_functiondef(
    to_regprocedure('platform_private.valid_base_event_payload(text,integer,jsonb)'))
    ilike '%identity.acting-context.revoked.v1%'), false),
  'context revocation event is registered with the base event validator'
);

-- Behavioral P2-S04 coverage: full resources/replay, termsHash, CAS rollback,
-- and the AC002 retroactive confirmation/context-revocation transition.
select lives_ok($$insert into auth.users(id) values
 ('a6111111-1111-4111-8111-111111111111'),
 ('a6222222-2222-4222-8222-222222222222')$$, 'membership actors exist');
select lives_ok($$select platform_api.auth_bootstrap(
 'a6111111-1111-4111-8111-111111111111',decode(repeat('11',32),'hex'),decode(repeat('22',32),'hex'),
 'a6111111-1111-4111-8111-111111111112','a6111111-1111-4111-8111-111111111113')$$, 'owner context bootstraps');
select lives_ok($$select platform_api.auth_bootstrap(
 'a6222222-2222-4222-8222-222222222222',decode(repeat('33',32),'hex'),decode(repeat('44',32),'hex'),
 'a6222222-2222-4222-8222-222222222223','a6222222-2222-4222-8222-222222222224')$$, 'member context bootstraps');
select pg_temp.set_jwt_claim('sub','a6111111-1111-4111-8111-111111111111',true); select set_config('app.auth_user_id','a6111111-1111-4111-8111-111111111111',true); select set_config('app.actor_auth_user_id','a6111111-1111-4111-8111-111111111111',true); select set_config('app.actor_person_id',(select person_id::text from identity.auth_user_bindings where auth_user_id='a6111111-1111-4111-8111-111111111111'),true); select set_config('app.correlation_id','a6111111-1111-4111-8111-111111111113',true); select set_config('app.idempotency_key_hash','s04-org',true); select set_config('app.request_hash','s04-org-r',true);
create temp table p2_s04_membership_org as
select (result->>'organizationId')::uuid organization_id,
 (select person_id from identity.auth_user_bindings where auth_user_id='a6111111-1111-4111-8111-111111111111') owner_person_id
from lateral (select platform_api.rpc_create_organization('self_member','{}'::text[]) result) created;
insert into identity_private.governance_terms_version(id,organization_id,version_no,terms_schema_version,terms_json,document_hash,governance_mode,state,required_member_set_hash,effective_at)
select 'a6333333-3333-4333-8333-333333333333',organization_id,1,1,'{"notice":"s04"}'::jsonb,decode(repeat('ab',32),'hex'),'governed','active',decode(repeat('cd',32),'hex'),clock_timestamp() from p2_s04_membership_org;
select set_config('app.idempotency_key_hash','s04-invite',true); select set_config('app.request_hash','s04-invite-r',true);
create temp table p2_s04_invite as select (result->>'tenureId')::uuid tenure_id,result resource from lateral (select platform_api.rpc_invite_membership((select organization_id from p2_s04_membership_org),(select person_id from identity.auth_user_bindings where auth_user_id='a6222222-2222-4222-8222-222222222222'),current_date-10,'a6333333-3333-4333-8333-333333333333','touring',clock_timestamp()+interval '1 day','governed',1) result) invited;
select ok((select resource ?& array['tenureId','organizationId','personId','state','provenance','startsOn','endsOn','acceptedAt','revokedAt','version','etag'] from p2_s04_invite),'MEM-01 returns the full tenure resource');
select is((select terms_hash from identity_private.membership_tenure where id=(select tenure_id from p2_s04_invite)),decode(repeat('ab',32),'hex'),'MEM-01 locks the terms document hash');
select set_config('app.idempotency_key_hash','s04-invite-stale',true); select set_config('app.request_hash','s04-invite-stale-r',true);
select throws_ok($$select platform_api.rpc_invite_membership((select organization_id from p2_s04_membership_org),(select person_id from identity.auth_user_bindings where auth_user_id='a6222222-2222-4222-8222-222222222222'),current_date,'a6333333-3333-4333-8333-333333333333','touring',clock_timestamp()+interval '1 day','governed',1)$$,'P0001','VERSION_MISMATCH','MEM-01 stale organization CAS loses');
select pg_temp.set_jwt_claim('sub','a6222222-2222-4222-8222-222222222222',true); select set_config('app.auth_user_id','a6222222-2222-4222-8222-222222222222',true); select set_config('app.actor_auth_user_id','a6222222-2222-4222-8222-222222222222',true); select set_config('app.actor_person_id',(select person_id::text from identity.auth_user_bindings where auth_user_id='a6222222-2222-4222-8222-222222222222'),true); select set_config('app.idempotency_key_hash','s04-accept-wrong',true); select set_config('app.request_hash','s04-accept-wrong-r',true);
select throws_ok($$select platform_api.rpc_accept_or_end_membership((select tenure_id from p2_s04_invite),'accept',1,'a6333333-3333-4333-8333-333333333333',null,null,null,repeat('cd',32))$$,'P0001','TERMS_VERSION_MISMATCH','MEM-03 rejects a mismatched termsHash');
select set_config('app.idempotency_key_hash','s04-accept',true); select set_config('app.request_hash','s04-accept-r',true);
create temp table p2_s04_accepted as select result resource from lateral (select platform_api.rpc_accept_or_end_membership((select tenure_id from p2_s04_invite),'accept',1,'a6333333-3333-4333-8333-333333333333',null,null,null,repeat('ab',32)) result) accepted;
select is((select resource->>'state' from p2_s04_accepted),'confirmed','MEM-03 confirms only after exact termsHash comparison');
select is((select platform_api.rpc_accept_or_end_membership((select tenure_id from p2_s04_invite),'accept',1,'a6333333-3333-4333-8333-333333333333',null,null,null,repeat('ab',32))),(select resource from p2_s04_accepted),'MEM-03 replay is byte-for-byte the confirmed resource');
select ok((select (platform_api.identity_memberships_read((select organization_id from p2_s04_membership_org),null,5) ?& array['items','nextCursor','hasMore'])),'membership read returns its bounded envelope');
insert into identity_private.membership_evidence(id,organization_id,person_id,evidence_kind,trusted) select 'a6444444-4444-4444-8444-444444444444',organization_id,(select person_id from identity.auth_user_bindings where auth_user_id='a6222222-2222-4222-8222-222222222222'),'historical_membership',true from p2_s04_membership_org;
select pg_temp.set_jwt_claim('sub','a6111111-1111-4111-8111-111111111111',true); select set_config('app.auth_user_id','a6111111-1111-4111-8111-111111111111',true); select set_config('app.actor_auth_user_id','a6111111-1111-4111-8111-111111111111',true); select set_config('app.actor_person_id',(select owner_person_id::text from p2_s04_membership_org),true); select set_config('app.idempotency_key_hash','s04-assert-stale',true); select set_config('app.request_hash','s04-assert-stale-r',true);
select throws_ok($$select platform_api.rpc_assert_membership((select organization_id from p2_s04_membership_org),(select person_id from identity.auth_user_bindings where auth_user_id='a6222222-2222-4222-8222-222222222222'),current_date-20,current_date-15,'a6444444-4444-4444-8444-444444444444',2)$$,'P0001','VERSION_MISMATCH','MEM-02 stale organization CAS loses');
select set_config('app.idempotency_key_hash','s04-end-missing',true); select set_config('app.request_hash','s04-end-missing-r',true); select pg_temp.set_jwt_claim('sub','a6222222-2222-4222-8222-222222222222',true); select set_config('app.auth_user_id','a6222222-2222-4222-8222-222222222222',true); select set_config('app.actor_auth_user_id','a6222222-2222-4222-8222-222222222222',true); select set_config('app.actor_person_id',(select person_id::text from identity.auth_user_bindings where auth_user_id='a6222222-2222-4222-8222-222222222222'),true); select set_config('app.acting_party_id','',true);
insert into platform_private.acting_context_binding(id,person_id,acting_party_id,context_kind,source_relationship_id,client_binding_id,state,selected_at,last_seen_at,expires_at,projection_version,version) select 'a6777777-7777-4777-8777-777777777777',(select person_id from identity.auth_user_bindings where auth_user_id='a6222222-2222-4222-8222-222222222222'),organization_id,'organization',(select tenure_id from p2_s04_invite),'s04-org','active',clock_timestamp(),clock_timestamp(),clock_timestamp()+interval '12 hours',1,1 from p2_s04_membership_org;
insert into identity_private.membership_counterpart_confirmation(id,tenure_id,confirmer_person_id,ends_on) select 'a6666666-6666-4666-8666-666666666666',tenure_id,(select owner_person_id from p2_s04_membership_org),current_date-1 from p2_s04_invite;
select throws_ok($$select platform_api.rpc_accept_or_end_membership((select tenure_id from p2_s04_invite),'end',2,null,current_date-2,null,'MEMBER_REQUESTED',null)$$,'P0001','COUNTERPART_CONFIRMATION_REQUIRED','P2-S04-AC-002 rejects retroactive end without confirmation');
select set_config('app.idempotency_key_hash','s04-end-confirmed',true); select set_config('app.request_hash','s04-end-confirmed-r',true);
create temp table p2_s04_ended as select result resource from lateral (select platform_api.rpc_accept_or_end_membership((select tenure_id from p2_s04_invite),'end',2,null,current_date-1,'a6666666-6666-4666-8666-666666666666','MEMBER_REQUESTED',null) result) ended;
select is((select resource->>'state' from p2_s04_ended),'ended','P2-S04-AC-002 performs the confirmed retroactive transition');
select is((select state from platform_private.acting_context_binding where id='a6777777-7777-4777-8777-777777777777'),'revoked','relationship end revokes acting context');
select ok((select payload=jsonb_build_object('personId',(select person_id from identity.auth_user_bindings where auth_user_id='a6222222-2222-4222-8222-222222222222'),'partyId',(select organization_id from p2_s04_membership_org),'relationshipId',(select tenure_id from p2_s04_invite)) from platform_private.outbox_events where event_type='identity.acting-context.revoked.v1' and aggregate_id=(select tenure_id from p2_s04_invite) order by occurred_at desc limit 1),'context revoke outbox is identifier-only');
select throws_ok($$select platform_api.identity_memberships_read((select organization_id from p2_s04_membership_org),null,5)$$,'P0001','FORBIDDEN','ended member loses roster read authority');

select * from finish();
rollback;
