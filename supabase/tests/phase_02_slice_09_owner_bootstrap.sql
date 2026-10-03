begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Operator setup is not an authenticated browser session or hosted evidence.
insert into auth.users(id,email,email_confirmed_at) values
 ('a9100000-0000-4000-8000-000000000001','bootstrap-owner@example.test',clock_timestamp());
select platform_api.auth_bootstrap(
 'a9100000-0000-4000-8000-000000000001',decode(repeat('01',32),'hex'),
 decode(repeat('02',32),'hex'),'a9100000-0000-4000-8000-000000000011',
 'a9100000-0000-4000-8000-000000000012');
create temp table bootstrap_subject as
 select party_id as person_id from platform_private.person_party
 where auth_user_id='a9100000-0000-4000-8000-000000000001';

select has_function('platform_private','initialize_cms_owner',
 array['uuid','uuid','text','timestamp with time zone','uuid','boolean'],
 'AC265 owner initialization has an explicit pinned-identity contract');
select throws_ok($$select platform_private.initialize_cms_owner(
 'a9100000-0000-4000-8000-000000000001',(select person_id from bootstrap_subject),
 'wrong@example.test',clock_timestamp()+interval '1 day',
 'a9100000-0000-4000-8000-000000000099',true)$$,
 'P0001','BOOTSTRAP_IDENTITY_MISMATCH','Wrong verified identity fails closed');
select throws_ok($$select platform_private.initialize_cms_owner(
 'a9100000-0000-4000-8000-000000000001',(select person_id from bootstrap_subject),
 'bootstrap-owner@example.test',clock_timestamp()+interval '8 days',
 'a9100000-0000-4000-8000-000000000099',true)$$,
 'P0001','BOOTSTRAP_INVALID','Grant term cannot exceed seven days');
select is((platform_private.initialize_cms_owner(
 'a9100000-0000-4000-8000-000000000001',(select person_id from bootstrap_subject),
 'bootstrap-owner@example.test',clock_timestamp()+interval '1 day',
 'a9100000-0000-4000-8000-000000000099',true)->>'state'),
 'preview','Preview reports intent');
select is((select count(*) from platform_private.cms_owner_initialization),0::bigint,
 'Preview does not retain a completion receipt');
select is((select count(*) from identity_private.organization_actor_grant
 where capability_code like 'cms.%'),0::bigint,'Preview grants no CMS authority');

update auth.users set email_confirmed_at=null where id='a9100000-0000-4000-8000-000000000001';
select throws_ok($$select platform_private.initialize_cms_owner(
 'a9100000-0000-4000-8000-000000000001',(select person_id from bootstrap_subject),
 'bootstrap-owner@example.test',clock_timestamp()+interval '1 day',
 'a9100000-0000-4000-8000-000000000099',false)$$,
 'P0001','BOOTSTRAP_IDENTITY_MISMATCH','Unconfirmed owner cannot receive authority');
update auth.users set email_confirmed_at=clock_timestamp() where id='a9100000-0000-4000-8000-000000000001';
select throws_ok($$select platform_private.initialize_cms_owner(
 'a9100000-0000-4000-8000-000000000001','a9100000-0000-4000-8000-000000000002',
 'bootstrap-owner@example.test',clock_timestamp()+interval '1 day',
 'a9100000-0000-4000-8000-000000000099',false)$$,
 'P0001','BOOTSTRAP_IDENTITY_MISMATCH','Pinned person cannot be substituted');

create function pg_temp.reject_bootstrap_receipt() returns trigger language plpgsql as $$
begin raise exception 'INJECTED_RECEIPT_FAILURE' using errcode='P0001'; end; $$;
create trigger reject_bootstrap_receipt before insert on platform_private.cms_owner_initialization
 for each row execute function pg_temp.reject_bootstrap_receipt();
select throws_ok($$select platform_private.initialize_cms_owner(
 'a9100000-0000-4000-8000-000000000001',(select person_id from bootstrap_subject),
 'bootstrap-owner@example.test',clock_timestamp()+interval '1 day',
 'a9100000-0000-4000-8000-000000000099',false)$$,
 'P0001','INJECTED_RECEIPT_FAILURE','Late failure rolls back initialization');
select is((select count(*) from platform_private.alias_party),0::bigint,'Failure rolls back alias');
select is((select count(*) from identity_private.organization_party),0::bigint,'Failure rolls back organization');
select is((select count(*) from identity_private.organization_actor_grant),0::bigint,'Failure rolls back all grants');
drop trigger reject_bootstrap_receipt on platform_private.cms_owner_initialization;

-- A database operator has no browser context. Existing browser bindings must
-- neither block initialization nor be renewed by it.
-- TIME-WARP: a stale or recent acting-context binding (heartbeat, MFA recency, expiry) cannot be produced without waiting; the binding itself was selected through identity_context_bind.
update platform_private.acting_context_binding
 set selected_at=clock_timestamp()-interval '3 days',
 expires_at=clock_timestamp()-interval '1 day',last_seen_at=clock_timestamp()-interval '2 days'
 where person_id=(select person_id from bootstrap_subject);
select set_config('app.acting_context_id',
 (select id::text from platform_private.acting_context_binding
  where person_id=(select person_id from bootstrap_subject) limit 1),true);
create temp table original_bootstrap_context as
 select id,expires_at,last_seen_at,version from platform_private.acting_context_binding
 where person_id=(select person_id from bootstrap_subject);

create temp table bootstrap_result as select platform_private.initialize_cms_owner(
 'a9100000-0000-4000-8000-000000000001',(select person_id from bootstrap_subject),
 'bootstrap-owner@example.test',clock_timestamp()+interval '1 day',
 'a9100000-0000-4000-8000-000000000099',false) as body;
select is((select body->>'state' from bootstrap_result),'initialized','Initial owner setup succeeds');
select is((select count(*) from platform_private.acting_context_binding b
 join original_bootstrap_context old using(id)
 where b.expires_at=old.expires_at and b.last_seen_at=old.last_seen_at and b.version=old.version),
 (select count(*) from original_bootstrap_context),'Operator setup never renews stale browser sessions');
select is(current_setting('app.acting_context_id'),
 (select id::text from original_bootstrap_context limit 1),'Caller context setting restored after operator setup');
select lives_ok($$select platform_private.cms_require_read(
 'a9100000-0000-4000-8000-000000000001',
 (select (body->>'organizationId')::uuid from bootstrap_result))$$,
 'Canonical CMS read authority accepts initialized owner membership');
select lives_ok($$select platform_private.cms_require_capability(
 'a9100000-0000-4000-8000-000000000001',
 (select (body->>'organizationId')::uuid from bootstrap_result),'cms.schema_designer')$$,
 'Canonical CMS design authority accepts initialized owner capability');
select ok(platform_private.admin_capability_allows(
 'a9100000-0000-4000-8000-000000000001',
 (select (body->>'organizationId')::uuid from bootstrap_result),'admin.audit.read',
 'organization',(select (body->>'organizationId')::uuid from bootstrap_result),'read'),
 'Admin authority resolves the named organization-scoped read grant');
select ok(not platform_private.admin_capability_allows(
 'a9100000-0000-4000-8000-000000000001',
 (select (body->>'organizationId')::uuid from bootstrap_result),'admin.audit.read',
 'organization',(select (body->>'organizationId')::uuid from bootstrap_result),'grant'),
 'Bootstrap does not authorize delegation');
select is((select count(*) from identity_private.organization_actor_grant
 where capability_code like 'cms.%'),2::bigint,'Only two named CMS capabilities granted');
select is((select count(distinct person_id) from identity_private.organization_actor_grant
 where capability_code like 'cms.%' or capability_code like 'admin.%'),1::bigint,
 'Only approved person receives CMS/admin authority');
select is((select count(*) from platform_private.admin_capability_grants),2::bigint,
 'Only inbox and audit read grants initialized; no delegation permission');
select is((select count(*) from platform_private.alias_party where display_name='WeBeJammin'
 and public_link_state='private'),1::bigint,'Alias preserves private person linkage');
select is((select count(*) from platform_private.cms_owner_initialization),1::bigint,
 'Initialization retains one receipt');
select is((select count(*) from audit_private.audit_events
 where action='operator.cms_owner.initialize'
 and reason_code='OWNER_AUTHORIZED_OPERATOR_INITIALIZATION'),1::bigint,
 'Audit distinguishes operator initialization from interactive sign-in');
select ok((select bool_and(valid_through::timestamptz+interval '1 day'<=r.grant_ends_at)
 from identity_private.organization_actor_grant g
 cross join platform_private.cms_owner_initialization r
 where g.capability_code like 'cms.%' or g.capability_code like 'admin.%'),
 'Date-granularity grants never outlive requested end');
select throws_ok($$select platform_private.initialize_cms_owner(
 'a9100000-0000-4000-8000-000000000001',(select person_id from bootstrap_subject),
 'bootstrap-owner@example.test',clock_timestamp()+interval '1 day',
 'a9100000-0000-4000-8000-000000000099',false)$$,
 'P0001','BOOTSTRAP_ALREADY_INITIALIZED','Replay cannot recreate or extend authority');
-- NEGATIVE CONTROL: removes the receipt to prove the command refuses without it.
delete from platform_private.cms_owner_initialization;
select throws_ok($$select platform_private.initialize_cms_owner(
 'a9100000-0000-4000-8000-000000000001',(select person_id from bootstrap_subject),
 'bootstrap-owner@example.test',clock_timestamp()+interval '1 day',
 'a9100000-0000-4000-8000-000000000099',false)$$,
 'P0001','BOOTSTRAP_AUTHORITY_EXISTS','Existing authority prevents initialization');
select ok(not has_function_privilege('authenticated',
 'platform_private.initialize_cms_owner(uuid,uuid,text,timestamptz,uuid,boolean)','EXECUTE'),
 'Authenticated users cannot initialize an owner');
select ok(not has_function_privilege('service_role',
 'platform_private.initialize_cms_owner(uuid,uuid,text,timestamptz,uuid,boolean)','EXECUTE'),
 'Application service role cannot initialize an owner');
select ok(not has_function_privilege('anon',
 'platform_private.initialize_cms_owner(uuid,uuid,text,timestamptz,uuid,boolean)','EXECUTE'),
 'Anonymous users cannot initialize an owner');
select * from finish();
rollback;
