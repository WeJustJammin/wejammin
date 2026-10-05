\ir support/jwt-claims.sqlinc
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- P2-S03 authority edges. This file is intentionally RED until the complete
-- Slice 03 authority migration and named RPCs exist.
create or replace function pg_temp.identity_edge_count(p_relation text, p_where text default null)
returns bigint language plpgsql as $$
declare v_count bigint;
begin
  if pg_catalog.to_regclass(p_relation) is null then return 0; end if;
  execute 'select count(*) from ' || p_relation || case when p_where is null then '' else ' where ' || p_where end into v_count;
  return v_count;
end;
$$;
create or replace function pg_temp.edge_context(
  p_auth uuid, p_person uuid, p_acting uuid, p_tenant uuid, p_correlation uuid,
  p_key text, p_key_hash text, p_request_hash text
) returns void language plpgsql as $$
begin
  perform pg_temp.set_jwt_claim('sub', p_auth::text, true);
  perform set_config('app.auth_user_id', p_auth::text, true);
  perform set_config('app.actor_auth_user_id', p_auth::text, true);
  perform set_config('app.actor_person_id', p_person::text, true);
  perform set_config('app.acting_party_id', p_acting::text, true);
  perform set_config('app.tenant_id', p_tenant::text, true);
  perform set_config('app.request_id', p_correlation::text, true);
  perform set_config('app.correlation_id', p_correlation::text, true);
  perform set_config('app.idempotency_key', p_key, true);
  perform set_config('app.idempotency_key_hash', p_key_hash, true);
  perform set_config('app.request_hash', p_request_hash, true);
end;
$$;

select ok(
  (select count(*) = 9 from information_schema.tables
   where table_schema = 'platform_private' and table_name = any(array[
     'person_party','role_facet_assertion','handle_reservation','alias_party',
     'alias_transfer_offer','alias_ownership_period','legal_identity_record',
     'legal_disclosure_event','acting_context_binding']::text[])),
  'all Slice 03 authority tables exist'
);
select ok(
  (select count(*) = 9 and bool_and(c.relrowsecurity and c.relforcerowsecurity)
   from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'platform_private' and c.relname = any(array[
     'person_party','role_facet_assertion','handle_reservation','alias_party',
     'alias_transfer_offer','alias_ownership_period','legal_identity_record',
     'legal_disclosure_event','acting_context_binding']::name[])),
  'all Slice 03 authority tables force RLS'
);
select ok(
  (select count(*) = 27 and bool_and(case when pg_catalog.to_regclass(t.table_name) is null then false
     else not has_table_privilege(r.role_name,t.table_name,'select')
      and not has_table_privilege(r.role_name,t.table_name,'insert')
      and not has_table_privilege(r.role_name,t.table_name,'update')
      and not has_table_privilege(r.role_name,t.table_name,'delete') end)
   from (values ('anon'::name),('authenticated'::name),('service_role'::name)) r(role_name)
   cross join (values
    ('platform_private.person_party'::text),('platform_private.role_facet_assertion'::text),
    ('platform_private.handle_reservation'::text),('platform_private.alias_party'::text),
    ('platform_private.alias_transfer_offer'::text),('platform_private.alias_ownership_period'::text),
    ('platform_private.legal_identity_record'::text),('platform_private.legal_disclosure_event'::text),
    ('platform_private.acting_context_binding'::text)) t(table_name)),
  'anon, authenticated, and service roles have no direct Slice 03 table grants'
);
select ok(
  not exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='platform_api' and p.proname = any(array[
    'identity_alias_create','identity_alias_patch','identity_handle_change','identity_alias_retire',
    'identity_transfer_offer_create','identity_transfer_accept','identity_transfer_decline',
    'identity_context_bind','identity_legal_upsert','identity_legal_disclose']::name[])
   and (has_function_privilege('anon',p.oid,'execute') or has_function_privilege('service_role',p.oid,'execute'))),
  'protected identity commands have no anon or service-role function bypass'
);
select ok(
  not exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='platform_private' and p.proname = any(array[
    'identity_alias_create','identity_alias_patch','identity_handle_change','identity_alias_retire',
    'identity_transfer_offer_create','identity_transfer_accept','identity_transfer_decline',
    'identity_context_bind','identity_legal_upsert','identity_legal_disclose']::name[])
   and has_function_privilege('authenticated',p.oid,'execute')),
  'authenticated callers cannot execute private identity helpers'
);

-- Actor A is the alias owner; B is the unrelated caller/recipient.
select lives_ok($$
  insert into auth.users(id) values
   ('93333333-3333-4333-8333-333333333333'),('93333333-3333-4333-8333-333333333335') on conflict do nothing;
  insert into platform_private.party(id,kind) values
   ('93333333-3333-4333-8333-333333333334','person'),('93333333-3333-4333-8333-333333333336','person') on conflict do nothing;
  insert into platform_private.person_party(party_id,auth_user_id,account_state) values
   ('93333333-3333-4333-8333-333333333334','93333333-3333-4333-8333-333333333333','active'),
   ('93333333-3333-4333-8333-333333333336','93333333-3333-4333-8333-333333333335','active') on conflict do nothing;
  insert into identity.auth_user_bindings(id,auth_user_id,person_id,state) values
   ('93333333-3333-4333-8333-33333333333a','93333333-3333-4333-8333-333333333333','93333333-3333-4333-8333-333333333334','active'),
   ('93333333-3333-4333-8333-33333333333b','93333333-3333-4333-8333-333333333335','93333333-3333-4333-8333-333333333336','active') on conflict do nothing;
$$, 'authority edge fixture creates two verified people');
select lives_ok($$
  insert into platform_private.party(id,kind) values ('93333333-3333-4333-8333-333333333337','alias') on conflict do nothing;
  insert into platform_private.handle_reservation(id,normalized_handle,display_handle,party_id,state,first_used_at,last_used_at)
   values ('93333333-3333-4333-8333-333333333338','edge-authority','edge-authority','93333333-3333-4333-8333-333333333337','active',clock_timestamp(),clock_timestamp()) on conflict do nothing;
  insert into platform_private.alias_party(party_id,display_name,current_handle_id,lifecycle,public_link_state)
   values ('93333333-3333-4333-8333-333333333337','Authority Edge Alias','93333333-3333-4333-8333-333333333338','active','private') on conflict do nothing;
  insert into platform_private.alias_ownership_period(id,alias_id,owner_person_id,starts_at)
   values ('93333333-3333-4333-8333-33333333333c','93333333-3333-4333-8333-333333333337','93333333-3333-4333-8333-333333333334',clock_timestamp()-interval '1 day') on conflict do nothing;
  insert into platform_private.alias_transfer_offer(id,alias_id,offering_person_id,recipient_person_id,state,offered_at,expires_at)
   values ('93333333-3333-4333-8333-333333333339','93333333-3333-4333-8333-333333333337','93333333-3333-4333-8333-333333333334','93333333-3333-4333-8333-333333333336','pending',clock_timestamp(),clock_timestamp()+interval '7 days') on conflict do nothing;
$$, 'authority edge fixture creates one alias, ownership period, and offer');
select lives_ok($$
  insert into platform_private.acting_context_binding(id,person_id,acting_party_id,context_kind,client_binding_id,state,selected_at,last_seen_at,expires_at,projection_version,version)
   values ('93333333-3333-4333-8333-33333333333d','93333333-3333-4333-8333-333333333334','93333333-3333-4333-8333-333333333337','alias','edge-tab-a','active',clock_timestamp(),clock_timestamp(),clock_timestamp()+interval '12 hours',1,1) on conflict do nothing;
  insert into platform_private.acting_context_binding(id,person_id,acting_party_id,context_kind,client_binding_id,state,selected_at,last_seen_at,expires_at,projection_version,version)
   values ('93333333-3333-4333-8333-33333333333e','93333333-3333-4333-8333-333333333334','93333333-3333-4333-8333-333333333334','person','edge-self','active',clock_timestamp(),clock_timestamp(),'infinity'::timestamptz,1,1) on conflict do nothing;
$$, 'authority edge fixture creates alias binding and self fallback');

select pg_temp.edge_context('93333333-3333-4333-8333-333333333333','93333333-3333-4333-8333-333333333336','93333333-3333-4333-8333-333333333337','93333333-3333-4333-8333-333333333336','93333333-3333-4333-8333-333333333341','edge-forged-owner','b1','b2');
select lives_ok($$select platform_api.identity_alias_patch('93333333-3333-4333-8333-333333333337','Server Derived Name','private',1)$$,
  'forged actor, tenant, owner, and acting-party input cannot widen owner authority');
select is(pg_temp.identity_edge_count('platform_private.alias_party','party_id=''93333333-3333-4333-8333-333333333337'' and display_name=''Server Derived Name'''),1::bigint,
  'verified Auth subject, not forged settings, authorizes the owner patch');
select ok(exists(select 1 from audit_private.audit_events where action='identity.alias.patch' and target_id='93333333-3333-4333-8333-333333333337' and actor_id='93333333-3333-4333-8333-333333333333' and acting_party_id='93333333-3333-4333-8333-333333333334'),
  'audit records verified actor and canonical person context');

select pg_temp.edge_context('93333333-3333-4333-8333-333333333335','93333333-3333-4333-8333-333333333336','93333333-3333-4333-8333-333333333336','93333333-3333-4333-8333-333333333336','93333333-3333-4333-8333-333333333342','edge-wrong-owner','b3','b4');
select throws_ok($$select platform_api.identity_alias_patch('93333333-3333-4333-8333-333333333337','Hijacked','private',2)$$,'P0001','FORBIDDEN','known visible alias without capability returns 403/FORBIDDEN');
select throws_ok($$select platform_api.identity_alias_patch('93333333-3333-4333-8333-3333333333ff','Unknown','private',1)$$,'P0001','ALIAS_NOT_FOUND','concealed alias target returns 404/ALIAS_NOT_FOUND');
select is(pg_temp.identity_edge_count('platform_private.alias_party','party_id=''93333333-3333-4333-8333-333333333337'' and display_name=''Hijacked'''),0::bigint,'403 and concealed 404 attempts do not mutate alias state');

select pg_temp.edge_context('93333333-3333-4333-8333-333333333333','93333333-3333-4333-8333-333333333334','93333333-3333-4333-8333-333333333337','93333333-3333-4333-8333-333333333334','93333333-3333-4333-8333-333333333344','edge-alias-facet','b5','b6');
select throws_ok($$select platform_api.identity_facet_add('producer')$$,'P0001','FORBIDDEN','alias acting context cannot mutate person facets');
select is(pg_temp.identity_edge_count('platform_private.role_facet_assertion','person_id=''93333333-3333-4333-8333-333333333334'' and facet_code=''producer'''),0::bigint,'alias facet escalation leaves person facet history untouched');
set local role authenticated;
select throws_ok($$insert into platform_private.role_facet_assertion(person_id,facet_code,state,source,asserted_at) values ('93333333-3333-4333-8333-333333333334','writer','active','curation_approved',clock_timestamp())$$,'42501',null,'authenticated cannot insert facets directly');
select throws_ok($$insert into platform_private.legal_identity_record(person_id,effective_from,protected_field_refs) values ('93333333-3333-4333-8333-333333333334',current_date,'{"legalNameRef":"93333333-3333-4333-8333-333333333345","addressRef":"93333333-3333-4333-8333-333333333346"}'::jsonb)$$,'42501',null,'authenticated cannot write protected legal identity directly');
select throws_ok($$insert into platform_private.legal_disclosure_event(legal_identity_id,legal_identity_version,transaction_id,recipient_party_id,purpose_code,field_codes,actor_person_id,acting_party_id,request_id) values ('93333333-3333-4333-8333-333333333345',1,'93333333-3333-4333-8333-333333333347','93333333-3333-4333-8333-333333333336','service.contract',array['legal_name'],'93333333-3333-4333-8333-333333333334','93333333-3333-4333-8333-333333333337','93333333-3333-4333-8333-333333333348')$$,'42501',null,'authenticated cannot append legal disclosure directly');
reset role;
select ok(not exists(select 1 from information_schema.columns where table_schema='platform_private' and table_name='alias_party' and column_name='legal_identity_id'),'alias cannot store legal identity authority');

update platform_private.acting_context_binding set state='revoked',version=version+1,updated_at=clock_timestamp() where id='93333333-3333-4333-8333-33333333333d' and version=1;
select is(pg_temp.identity_edge_count('platform_private.acting_context_binding','id=''93333333-3333-4333-8333-33333333333d'' and state=''revoked'''),1::bigint,'first binding revocation wins its version CAS');
update platform_private.acting_context_binding set state='active',version=version+1,updated_at=clock_timestamp() where id='93333333-3333-4333-8333-33333333333d' and version=1;
select is(pg_temp.identity_edge_count('platform_private.acting_context_binding','id=''93333333-3333-4333-8333-33333333333d'' and state=''active'''),0::bigint,'stale concurrent binding reactivation cannot win');
select pg_temp.edge_context('93333333-3333-4333-8333-333333333333','93333333-3333-4333-8333-333333333334','93333333-3333-4333-8333-33333333333d','93333333-3333-4333-8333-333333333334','93333333-3333-4333-8333-333333333349','edge-revoked-binding','b7','b8');
select throws_ok($$select platform_api.identity_context_bind('93333333-3333-4333-8333-33333333333d',true,'edge-tab-a')$$,'P0001','CONTEXT_REVOKED','revoked binding cannot be reused after a race');
select is(pg_temp.identity_edge_count('platform_private.acting_context_binding','person_id=''93333333-3333-4333-8333-333333333334'' and acting_party_id=''93333333-3333-4333-8333-333333333334'' and state=''active'''),1::bigint,'revoked alias context falls back to self');

select throws_ok($$insert into platform_private.handle_reservation(id,normalized_handle,display_handle,party_id,state,first_used_at,last_used_at) values ('93333333-3333-4333-8333-33333333334a','edge-authority','edge-authority','93333333-3333-4333-8333-333333333336','active',clock_timestamp(),clock_timestamp())$$,'23505',null,'same normalized handle has one race winner');
select throws_ok($$insert into platform_private.alias_transfer_offer(id,alias_id,offering_person_id,recipient_person_id,state,offered_at,expires_at) values ('93333333-3333-4333-8333-33333333334b','93333333-3333-4333-8333-333333333337','93333333-3333-4333-8333-333333333334','93333333-3333-4333-8333-333333333336','pending',clock_timestamp(),clock_timestamp()+interval '7 days')$$,'23505',null,'one alias has one pending transfer race winner');
select pg_temp.edge_context('93333333-3333-4333-8333-333333333335','93333333-3333-4333-8333-333333333336','93333333-3333-4333-8333-333333333336','93333333-3333-4333-8333-333333333336','93333333-3333-4333-8333-33333333334c','edge-transfer','b9','ba');
select lives_ok($$select platform_api.identity_transfer_accept('93333333-3333-4333-8333-333333333339',1)$$,'named recipient wins transfer acceptance once');
select throws_ok($$select platform_api.identity_transfer_accept('93333333-3333-4333-8333-333333333339',1)$$,'P0001',null,'stale second transfer acceptance cannot win');
select is(pg_temp.identity_edge_count('platform_private.alias_ownership_period','alias_id=''93333333-3333-4333-8333-333333333337'' and ends_at is null'),1::bigint,'transfer leaves exactly one open ownership period');
select is(pg_temp.identity_edge_count('platform_private.alias_ownership_period','alias_id=''93333333-3333-4333-8333-333333333337'' and owner_person_id=''93333333-3333-4333-8333-333333333336'' and ends_at is null'),1::bigint,'accepted recipient is sole current owner');

select ok(
  exists(select 1 from platform_private.outbox_events where aggregate_type='alias' and event_type like 'identity.alias.%')
  and not exists(select 1 from platform_private.outbox_events where aggregate_type='alias' and event_type like 'identity.alias.%' and payload ?| array['displayName','handle','ownerPersonId','recipientPersonId','legalIdentityId','protectedFieldRefs','email']::text[]),
  'alias outbox payloads contain identifiers/state only, never authority or PII'
);
select ok(
  not exists(select 1 from platform_private.outbox_events e cross join lateral jsonb_object_keys(e.payload) as k(key_name)
   where e.event_type like 'identity.%' and e.aggregate_type in ('person','alias','context','legal_identity','disclosure')
     and key_name not in ('personId','aliasId','handleId','offerId','bindingId','eventId','facetCode','version','state','lifecycle','publicLinkState')),
  'identity event payload keys stay within the identifier-only allowlist'
);

create or replace function pg_temp.slice03_fail_outbox() returns trigger language plpgsql as $$ begin raise exception 'SLICE03_OUTBOX_FAIL' using errcode='P0001'; end; $$;
do $$ begin if pg_catalog.to_regclass('platform_private.outbox_events') is not null then execute 'create trigger slice03_outbox_fail before insert on platform_private.outbox_events for each row execute function pg_temp.slice03_fail_outbox()'; end if; end $$;
select pg_temp.edge_context('93333333-3333-4333-8333-333333333333','93333333-3333-4333-8333-333333333334','93333333-3333-4333-8333-333333333334','93333333-3333-4333-8333-333333333334','93333333-3333-4333-8333-33333333334d','edge-rollback-outbox','bb','bc');
select throws_ok($$select platform_api.identity_alias_create('Rollback Outbox','rollback-outbox','private')$$,'P0001','SLICE03_OUTBOX_FAIL','outbox failure aborts alias command');
do $$ begin if pg_catalog.to_regclass('platform_private.outbox_events') is not null then execute 'drop trigger if exists slice03_outbox_fail on platform_private.outbox_events'; end if; end $$;
select is(pg_temp.identity_edge_count('platform_private.handle_reservation','normalized_handle=''rollback-outbox'''),0::bigint,'outbox failure rolls back business state');
select is((select count(*) from platform_private.outbox_events where correlation_id='93333333-3333-4333-8333-33333333334d'::uuid),0::bigint,'outbox failure leaves no outbox row');
select is((select count(*) from audit_private.audit_events where correlation_id='93333333-3333-4333-8333-33333333334d'::uuid),0::bigint,'outbox failure rolls back paired audit row');

create or replace function pg_temp.slice03_fail_audit() returns trigger language plpgsql as $$ begin raise exception 'SLICE03_AUDIT_FAIL' using errcode='P0001'; end; $$;
do $$ begin if pg_catalog.to_regclass('audit_private.audit_events') is not null then execute 'create trigger slice03_audit_fail before insert on audit_private.audit_events for each row execute function pg_temp.slice03_fail_audit()'; end if; end $$;
select pg_temp.edge_context('93333333-3333-4333-8333-333333333333','93333333-3333-4333-8333-333333333334','93333333-3333-4333-8333-333333333334','93333333-3333-4333-8333-333333333334','93333333-3333-4333-8333-33333333334e','edge-rollback-audit','bd','be');
select throws_ok($$select platform_api.identity_alias_create('Rollback Audit','rollback-audit','private')$$,'P0001','SLICE03_AUDIT_FAIL','audit failure aborts alias command');
do $$ begin if pg_catalog.to_regclass('audit_private.audit_events') is not null then execute 'drop trigger if exists slice03_audit_fail on audit_private.audit_events'; end if; end $$;
select is(pg_temp.identity_edge_count('platform_private.handle_reservation','normalized_handle=''rollback-audit'''),0::bigint,'audit failure rolls back business state');
select is((select count(*) from platform_private.outbox_events where correlation_id='93333333-3333-4333-8333-33333333334e'::uuid),0::bigint,'audit failure leaves no outbox row');

select * from finish();
rollback;
