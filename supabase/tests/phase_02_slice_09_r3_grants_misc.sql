commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 audit remediation (R3): grant-list scoping (AC616), the projection
-- writer contract (AC658), RFC 8785 known-answer vectors for the policy hash
-- (AC665), the exact BE03a SQL API surface (AC685) and the template-binding
-- immutability behaviour (AC169).  Rows other than the labelled negative
-- controls are produced through the named RPCs.

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec108/03-support.sqlinc
\ir phase_02_slice_09_dec108/05-probes.sqlinc
\ir phase_02_slice_09_dec119/00-support.sqlinc

create or replace function pg_temp.r3_err(p_sql text) returns text language plpgsql as $body$
begin
  execute p_sql;
  return 'OK';
exception when others then
  return sqlerrm;
end;
$body$;
create or replace function pg_temp.r3_state(p_sql text) returns text language plpgsql as $body$
begin
  execute p_sql;
  return 'OK';
exception when others then
  return sqlstate;
end;
$body$;

-- ================================================================ AC616 ========
-- The forged other-organization row is a NEGATIVE CONTROL whose subject is a
-- confirmed member of the owner's organization, so only owner_id scoping can
-- hide it from the owner's list.
select pg_temp.s09g_member('rev1');
select pg_temp.s09g_grant('l:real', 'owner', 'rev1', 'cms.author', pg_temp.s09g_day(5));
select is(pg_temp.s09d_outcome('l:real'), 'OK', 'fixture: the owner grants rev1 (an owner-organization member) cms.author through CMS-03A-15');
select set_config('app.cms_rpc', 'true', true);
insert into platform_private.cms_capability_grants(owner_id, state, version, subject_person_ref, capability_code,
    valid_from, valid_through, grantor_person_ref, last_action)
select pg_temp.s09d_id('otherOrg'), 'active', 1, pg_temp.s09d_actor_id('rev1', 'person')::uuid, 'cms.editor',
       current_date, current_date + 5, pg_temp.s09d_actor_id('other', 'person')::uuid, 'granted';
select set_config('app.cms_rpc', '', true);
select is((select count(*) from platform_private.cms_capability_grants
            where owner_id = pg_temp.s09d_id('otherOrg') and subject_person_ref = pg_temp.s09d_actor_id('rev1', 'person')::uuid),
  1::bigint, 'negative control: a forged row owned by ANOTHER organization names the owner-organization member rev1 as its subject [P2-S09-AC-616]');
select pg_temp.s09g_list('l:list', 'owner');
select is(pg_temp.s09d_outcome('l:list'), 'OK', 'the owner list succeeds: it never emits 404 for the other organization row [P2-S09-AC-616]');
select ok((select count(*) = 0 from jsonb_array_elements(pg_temp.s09d_resp('l:list')->'items') i where i->>'capability' = 'cms.editor'),
  'the other organization row is omitted although its subject is a member of the owner organization: only owner_id scoping can hide it [P2-S09-AC-616]');
select is((select count(*) from jsonb_array_elements(pg_temp.s09d_resp('l:list')->'items') i
            where i->>'subjectPersonId' = pg_temp.s09d_actor_id('rev1', 'person') and i->>'capability' = 'cms.author'),
  1::bigint, 'the owner own aggregate for the same subject is returned [P2-S09-AC-616]');
select is(jsonb_array_length(pg_temp.s09d_resp('l:list')->'items')::bigint,
  (select count(*) from platform_private.cms_capability_grants where owner_id = pg_temp.s09d_id('ownerOrg')),
  'the list returns exactly the rows owned by the owner organization [P2-S09-AC-616]');

-- ================================================================ AC658 ========
-- Projection into identity_private.organization_actor_grant happens inside the grant,
-- renew and revoke transactions, and an RPC rollback leaves neither side changed.
create or replace function pg_temp.r3_projection(p_subject text, p_capability text) returns text language sql as $body$
  select coalesce((select concat_ws('|', ag.active, ag.valid_through)
                     from identity_private.organization_actor_grant ag
                    where ag.organization_id = pg_temp.s09d_id('ownerOrg')
                      and ag.person_id = pg_temp.s09d_actor_id(p_subject, 'person')::uuid
                      and ag.capability_code = p_capability), 'absent')
$body$;
create or replace function pg_temp.r3_aggregate(p_subject text, p_capability text) returns text language sql as $body$
  select coalesce((select concat_ws('|', (g.state = 'active'), g.valid_through)
                     from platform_private.cms_capability_grants g
                    where g.owner_id = pg_temp.s09d_id('ownerOrg')
                      and g.subject_person_ref = pg_temp.s09d_actor_id(p_subject, 'person')::uuid
                      and g.capability_code = p_capability), 'absent')
$body$;
select is(pg_temp.r3_projection('rev1', 'cms.author'), pg_temp.r3_aggregate('rev1', 'cms.author'),
  'after cms_grant_capability the actor-grant row equals the aggregate (active, valid_through) [P2-S09-AC-658]');
select isnt(pg_temp.r3_projection('rev1', 'cms.author'), 'absent', 'and the projection row exists [P2-S09-AC-658]');
create or replace function public.r3_fail_grant_outbox() returns trigger language plpgsql as $body$
begin
  if new.event_type = 'cms.capability.grant.changed.v1' then raise exception 'R3_FORCED_OUTBOX_FAILURE'; end if;
  return new;
end;
$body$;
create trigger r3_fail_grant_outbox before insert on platform_private.outbox_events
for each row execute function public.r3_fail_grant_outbox();
select pg_temp.s09g_member('rev2');
select pg_temp.s09g_grant('l:fail:grant', 'owner', 'rev2', 'cms.author', pg_temp.s09g_day(5));
select is(pg_temp.s09d_outcome('l:fail:grant'), 'R3_FORCED_OUTBOX_FAILURE', 'fixture: a failing outbox write fails the grant command');
select is(pg_temp.r3_projection('rev2', 'cms.author') || '/' || pg_temp.r3_aggregate('rev2', 'cms.author'), 'absent/absent',
  'a rolled-back grant leaves neither the aggregate nor the projection row [P2-S09-AC-658]');
select pg_temp.s09d_resp('l:real')->>'id' as real_id, pg_temp.s09d_resp('l:real')->>'version' as real_version \gset
select pg_temp.s09d_rpc('l:fail:renew', 'platform_api.cms_renew_capability_grant', 'owner',
  jsonb_build_object('grantId', :'real_id'::uuid, 'expectedVersion', :'real_version', 'validThrough', pg_temp.s09g_day(9),
    'idempotencyKey', 'r3-fail-renew-0001'), true);
select is(pg_temp.s09d_outcome('l:fail:renew'), 'R3_FORCED_OUTBOX_FAILURE', 'fixture: a failing outbox write fails the renew command');
select is(pg_temp.r3_projection('rev1', 'cms.author'), pg_temp.r3_aggregate('rev1', 'cms.author'),
  'a rolled-back renewal leaves the aggregate and the projection both unchanged and equal [P2-S09-AC-658]');
select is(split_part(pg_temp.r3_projection('rev1', 'cms.author'), '|', 2), pg_temp.s09g_day(5), 'and still at the original validThrough [P2-S09-AC-658]');
select pg_temp.s09d_rpc('l:fail:revoke', 'platform_api.cms_revoke_capability_grant', 'owner',
  jsonb_build_object('grantId', :'real_id'::uuid, 'expectedVersion', :'real_version', 'idempotencyKey', 'r3-fail-revoke-0001'), true);
select is(pg_temp.s09d_outcome('l:fail:revoke'), 'R3_FORCED_OUTBOX_FAILURE', 'fixture: a failing outbox write fails the revoke command');
select is(split_part(pg_temp.r3_projection('rev1', 'cms.author'), '|', 1), 't',
  'a rolled-back revocation leaves the projection active [P2-S09-AC-658]');
drop trigger r3_fail_grant_outbox on platform_private.outbox_events;
select pg_temp.s09d_rpc('l:renew', 'platform_api.cms_renew_capability_grant', 'owner',
  jsonb_build_object('grantId', :'real_id'::uuid, 'expectedVersion', :'real_version', 'validThrough', pg_temp.s09g_day(9),
    'idempotencyKey', 'r3-renew-0001'), true);
select is(pg_temp.s09d_outcome('l:renew'), 'OK', 'fixture: the renewal succeeds once the outbox works');
select is(pg_temp.r3_projection('rev1', 'cms.author'), pg_temp.r3_aggregate('rev1', 'cms.author'),
  'after cms_renew_capability_grant the actor-grant row equals the aggregate [P2-S09-AC-658]');
select is(split_part(pg_temp.r3_projection('rev1', 'cms.author'), '|', 2), pg_temp.s09g_day(9), 'and carries the renewed validThrough [P2-S09-AC-658]');
select pg_temp.s09d_rpc('l:revoke', 'platform_api.cms_revoke_capability_grant', 'owner',
  jsonb_build_object('grantId', :'real_id'::uuid, 'expectedVersion', (pg_temp.s09d_resp('l:renew')->>'version'),
    'idempotencyKey', 'r3-revoke-0001'), true);
select is(pg_temp.s09d_outcome('l:revoke'), 'OK', 'fixture: the revocation succeeds');
select is(pg_temp.r3_projection('rev1', 'cms.author'), pg_temp.r3_aggregate('rev1', 'cms.author'),
  'after cms_revoke_capability_grant the actor-grant row equals the aggregate (inactive) [P2-S09-AC-658]');
select is(split_part(pg_temp.r3_projection('rev1', 'cms.author'), '|', 1), 'f', 'and the projection is inactive [P2-S09-AC-658]');
select is(pg_temp.r3_state(format($$set local role %s; insert into identity_private.organization_actor_grant(organization_id, person_id, capability_code, valid_from, valid_through, active)
   values (%L, %L, 'cms.author', current_date, current_date + 1, true)$$, r, pg_temp.s09d_id('ownerOrg'), pg_temp.s09d_actor_id('rev3', 'person'))),
  '42501', 'role ' || r || ' cannot INSERT into the actor-grant projection [P2-S09-AC-658]')
from unnest(array['anon', 'authenticated', 'service_role']) r;
reset role;
select is(pg_temp.r3_state(format($$set local role %s; update identity_private.organization_actor_grant set active = true$$, r)),
  '42501', 'role ' || r || ' cannot UPDATE the actor-grant projection [P2-S09-AC-658]')
from unnest(array['anon', 'authenticated', 'service_role']) r;
reset role;
select is(pg_temp.r3_state(format($$set local role %s; delete from identity_private.organization_actor_grant$$, r)),
  '42501', 'role ' || r || ' cannot DELETE from the actor-grant projection [P2-S09-AC-658]')
from unnest(array['anon', 'authenticated', 'service_role']) r;
reset role;
select is((select string_agg(n.nspname || '.' || p.proname, ',' order by n.nspname, p.proname)
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('platform_private', 'platform_api', 'identity_private', 'identity', 'public_api', 'audit_private')
       and p.prokind = 'f'
       and pg_get_functiondef(p.oid) ~* '(insert[[:space:]]+into|update|delete[[:space:]]+from)[[:space:]]+identity_private\.organization_actor_grant'),
  'identity_private.rpc_create_organization,platform_private.cms_capability_grant_project,platform_private.initialize_cms_owner',
  'the only writers of the actor-grant projection are the organization bootstrap, the owner initialization and cms_capability_grant_project [P2-S09-AC-658]');
select is((select string_agg(p.proname, ',' order by p.proname)
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'platform_private' and p.prokind = 'f' and p.proname <> 'cms_capability_grant_project'
       and pg_get_functiondef(p.oid) ~* 'cms_capability_grant_project\('),
  'cms_grant_capability,cms_renew_capability_grant,cms_revoke_capability_grant',
  'only the grant, renew and revoke functions call the projection writer [P2-S09-AC-658]');

-- ================================================================ AC665 ========
-- RFC 8785 known answers computed independently in Node (not by the function
-- that seeded the policy rows): key order, nested arrays and non-ASCII text.
select is(platform_private.cms_jcs_sha256('{"requiredCapabilities":["cms.schema_review","cms.schema_designer"],"key":"protected.workflow","version":"1","riskClass":"protected","requiredDecisionCount":2}'::jsonb),
  'db46af046e70f58d457a125298062a3071785ab9073dd203a6c5623b987fb451',
  'known answer 1: a scrambled-order policy member hashes to the independently computed canonical digest [P2-S09-AC-665]');
select is(platform_private.cms_jcs_sha256(jsonb_build_object('b', U&'\00E9\20AC', 'a', 1)),
  'daac807f3f9f09865f0025adfa7ffdb6045305e085bfe85a3019878eceb88a7e',
  'known answer 2: {"b":"é€","a":1} hashes over {"a":1,"b":"é€"} (UTF-8, no escaping of non-ASCII) [P2-S09-AC-665]');
select is(platform_private.cms_jcs_sha256(jsonb_build_object('string', E'€$\u000f\nA''B"\\\\"/')),
  'ca355c6f913afd1af684476e56a97043696f617c7e34c84221c5643b66842a63',
  'known answer 3: RFC 8785 string escaping (\u000f, \n, quote, backslash, unescaped solidus) [P2-S09-AC-665]');
select is(platform_private.cms_jcs_sha256('{"numbers":[1,4,"x"],"literals":[null,true,false]}'::jsonb),
  '5e48dbf065eaa8ff06f89c7f0ea86c7545d21efff4dacc55f07856fcf0806dfa',
  'known answer 4: literals and arrays keep order while object keys sort [P2-S09-AC-665]');
select is(platform_private.cms_jcs_sha256('{"a":[],"b":{}}'::jsonb),
  '9959f7ea5ff37e0cf81634a894845a335eb6e26fbad0877944e9bc009b4f0644', 'known answer 5: empty array and object [P2-S09-AC-665]');
select isnt(platform_private.cms_jcs_sha256('{"a":1,"b":2}'::jsonb), platform_private.cms_jcs_sha256('{"a":1,"b":3}'::jsonb),
  'a one-value change changes the digest [P2-S09-AC-665]');

-- ================================================================ AC685 ========
-- The eighteen BE03a-named RPCs: SECURITY DEFINER, no PUBLIC/anon execute, the
-- named grantee role holds execute, and (for the five reads/draft commands that
-- the signed-in human calls) the authenticated role; anon/authenticated hold no
-- INSERT/UPDATE/DELETE on any platform_private.cms_ table.
create temp table r3_api(fn text primary key, human boolean) on commit drop;
insert into r3_api values
  ('cms_create_type_draft', true), ('cms_add_field_definition', true), ('cms_bind_relation', true),
  ('cms_activate_schema', false), ('cms_register_block', false), ('cms_advance_block_lifecycle', false),
  ('cms_list_content_types', true), ('cms_get_content_type_version', true), ('cms_create_schema_successor', false),
  ('cms_start_schema_dry_run', false), ('cms_submit_schema_review', false), ('cms_decide_schema_review', false),
  ('cms_get_schema_review', false), ('cms_assign_schema_review', false), ('cms_grant_capability', false),
  ('cms_renew_capability_grant', false), ('cms_revoke_capability_grant', false), ('cms_list_capability_grants', false);
select is((select count(*) from r3_api), 18::bigint, 'the BE03a-named API has exactly eighteen members [P2-S09-AC-685]');
select is((select string_agg(a.fn, ',' order by a.fn) from r3_api a
            where not exists (select 1 from pg_proc p where p.pronamespace = 'platform_api'::regnamespace and p.proname = a.fn)),
  null, 'every one of the eighteen named RPCs exists in platform_api [P2-S09-AC-685]');
select is((select string_agg(a.fn, ',' order by a.fn) from r3_api a join pg_proc p on p.pronamespace = 'platform_api'::regnamespace and p.proname = a.fn
            where not p.prosecdef), null, 'all eighteen are SECURITY DEFINER [P2-S09-AC-685]');
select is((select string_agg(a.fn, ',' order by a.fn) from r3_api a join pg_proc p on p.pronamespace = 'platform_api'::regnamespace and p.proname = a.fn
            where not has_function_privilege('service_role', p.oid, 'execute')), null,
  'the service role (the named capability grantee) can execute all eighteen [P2-S09-AC-685]');
select is((select string_agg(a.fn, ',' order by a.fn) from r3_api a join pg_proc p on p.pronamespace = 'platform_api'::regnamespace and p.proname = a.fn
            where has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('public', p.oid, 'execute')), null,
  'neither anon nor PUBLIC can execute any of the eighteen [P2-S09-AC-685]');
select is((select string_agg(a.fn, ',' order by a.fn) from r3_api a join pg_proc p on p.pronamespace = 'platform_api'::regnamespace and p.proname = a.fn
            where has_function_privilege('authenticated', p.oid, 'execute') is distinct from a.human), null,
  'the authenticated role can execute exactly the five signed-in-human RPCs (draft, field, relation, list, detail) and none of the other thirteen [P2-S09-AC-685]');
select is((select string_agg(p.proname, ',' order by p.proname) from pg_proc p
            where p.pronamespace = 'platform_api'::regnamespace and p.proname like 'cms\_%'
              and (not p.prosecdef or has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('public', p.oid, 'execute'))),
  null, 'no platform_api cms_ function of any slice is non-definer or executable by anon/PUBLIC [P2-S09-AC-685]');
select is((select string_agg(c.relname || ':' || r.privilege, ',' order by c.relname, r.privilege)
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      cross join unnest(array['anon', 'authenticated']) as role_name(role_name)
      cross join unnest(array['INSERT', 'UPDATE', 'DELETE']) as r(privilege)
     where n.nspname = 'platform_private' and c.relkind = 'r' and c.relname like 'cms\_%'
       and has_table_privilege(role_name.role_name, c.oid, r.privilege)),
  null, 'anon and authenticated hold no INSERT, UPDATE or DELETE on any platform_private.cms_ table [P2-S09-AC-685]');
select is((select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'platform_private' and c.relkind = 'r' and c.relname like 'cms\_%'), (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'platform_private' and c.relkind = 'r' and c.relname like 'cms\_%' and c.relrowsecurity), 'every checked table has RLS enabled [P2-S09-AC-685]');

-- ================================================================ AC169 ========
-- Template-binding immutability after activation, with the guard triggers ENABLED.
-- The parent version is activated through the real chain; the one binding row is a
-- negative-control fixture injected with the triggers disabled (an approved
-- template version is not needed to prove the parent-state guard).
select pg_temp.s09d_create_type('tb', 'r3_tmplbind');
select pg_temp.s09d_to_active('tb');
select is(pg_temp.s09d_read('cms_content_type_versions', 'state', pg_temp.s09d_id('tb:version')), 'active', 'fixture: the parent version is active through the real chain');
set constraints all immediate;
alter table platform_private.cms_content_type_template_bindings disable trigger user;
insert into platform_private.cms_content_type_template_bindings(owner_id, state, version, content_type_version_id, template_version_id, position)
select owner_id, 'active', 1, id, extensions.gen_random_uuid(), 0 from platform_private.cms_content_type_versions where id = pg_temp.s09d_id('tb:version');
alter table platform_private.cms_content_type_template_bindings enable trigger user;
set constraints all deferred;
create temp table r3_binding on commit drop as
select id, template_version_id from platform_private.cms_content_type_template_bindings where content_type_version_id = pg_temp.s09d_id('tb:version');
select is((select count(*) from r3_binding), 1::bigint, 'fixture: one binding row on the activated version');
select set_config('app.cms_rpc', 'true', true);
select is(pg_temp.r3_err(format($$update platform_private.cms_content_type_template_bindings set position = 1, version = version + 1 where id = %L$$, (select id from r3_binding))),
  'IMMUTABLE_RECORD', 'UPDATE of a binding of an activated version raises IMMUTABLE_RECORD with the guards enabled [P2-S09-AC-169]');
select is(pg_temp.r3_err(format($$delete from platform_private.cms_content_type_template_bindings where id = %L$$, (select id from r3_binding))),
  'IMMUTABLE_RECORD', 'DELETE of a binding of an activated version raises IMMUTABLE_RECORD [P2-S09-AC-169]');
select is(pg_temp.r3_err(format($$insert into platform_private.cms_content_type_template_bindings(owner_id, state, version, content_type_version_id, template_version_id, position)
   select owner_id, 'draft', 1, id, extensions.gen_random_uuid(), 1 from platform_private.cms_content_type_versions where id = %L$$, pg_temp.s09d_id('tb:version'))),
  'IMMUTABLE_RECORD', 'INSERT of a binding into an activated version raises IMMUTABLE_RECORD [P2-S09-AC-169]');
select is((select count(*) from platform_private.cms_content_type_template_bindings where content_type_version_id = pg_temp.s09d_id('tb:version')),
  1::bigint, 'the activated version still has exactly its one binding [P2-S09-AC-169]');
select pg_temp.s09d_create_type('tb2', 'r3_tmplbind2');
set constraints all immediate;
alter table platform_private.cms_content_type_template_bindings disable trigger user;
insert into platform_private.cms_content_type_template_bindings(owner_id, state, version, content_type_version_id, template_version_id, position)
select owner_id, 'draft', 1, id, extensions.gen_random_uuid(), 0 from platform_private.cms_content_type_versions where id = pg_temp.s09d_id('tb2:version');
alter table platform_private.cms_content_type_template_bindings enable trigger user;
set constraints all deferred;
select is(pg_temp.s09e_unique('cms_content_type_template_bindings',
    (select id from platform_private.cms_content_type_template_bindings where content_type_version_id = pg_temp.s09d_id('tb2:version')),
    array['content_type_version_id', 'template_version_id'], jsonb_build_object('template_version_id', extensions.gen_random_uuid())), 'dup:REJECTED:23505|ctl:ACCEPTED',
  'the unique (parent version, template version) pair rejects a duplicate and accepts a different template [P2-S09-AC-169]');

select * from finish();
rollback;
