-- Slice 12 gap lane claude_s12_gaps_db4: P2-S12-AC-155 clauses 0 and 2 (BE03c "Internal service operations" 189-198, Public projection):
--   c0  CMS-03C-21 is executable only by the registered non-browser callers (the Shard 04 delivery projection and the Slice 11
--       related-content recheck), which run as the CMS definer under the CMS RPC context (migration 20261014060200 header);
--   c2  PUBLIC, anon, authenticated and every other role have EXECUTE revoked.
-- DEC-226 rule 2: the stored ACL is read with aclexplode (proacl, or acldefault when NULL), never four named roles, and the whole
-- CMS-03C-21 function family is covered: the operation itself, the head predicate and the derived-candidate reader it calls.  Real
-- roles then call the function (denied 42501) and the definer-owner runs it.  Catalog only: no fixture.
\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

create or replace function pg_temp.g4_grantees(p_function regprocedure) returns text[] language sql stable as $body$
  select coalesce(array_agg(distinct case when acl.grantee = 0 then 'PUBLIC' else pg_get_userbyid(acl.grantee) end
                            order by case when acl.grantee = 0 then 'PUBLIC' else pg_get_userbyid(acl.grantee) end), array[]::text[])
    from pg_proc proc
    cross join lateral aclexplode(coalesce(proc.proacl, acldefault('f', proc.proowner))) acl
   where proc.oid = p_function and acl.privilege_type = 'EXECUTE'
$body$;
create or replace function pg_temp.g4_owner(p_function regprocedure) returns text language sql stable as $body$
  select pg_get_userbyid(proowner) from pg_proc where oid = p_function $body$;
-- The functions of the two schemas whose body mentions p_callee, the callee itself excluded.
create or replace function pg_temp.g4_referrers(p_callee text) returns text[] language sql stable as $body$
  select coalesce(array_agg(n.nspname || '.' || p.proname order by n.nspname, p.proname), array[]::text[])
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('platform_private', 'platform_api')
     and p.prolang in (select oid from pg_language where lanname in ('plpgsql', 'sql'))
     and p.proname <> p_callee and p.prosrc ~ ('\m' || p_callee || '\M')
$body$;
-- SQLSTATE of calling a statement as another role ('00000' when it ran); the statement's effect is rolled back, the role restored.
create or replace function pg_temp.g4_as(p_role text, p_call text) returns text language plpgsql as $body$
declare prior_role text := current_setting('role'); prior text := coalesce(pg_catalog.current_setting('app.cms_rpc', true), '');
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  execute 'set local role ' || quote_ident(p_role);
  begin
    execute p_call;
    raise exception 'g4 probe ran' using errcode = 'G4OK0';
  exception when others then
    perform pg_catalog.set_config('role', prior_role, true);
    perform pg_catalog.set_config('app.cms_rpc', prior, true);
    if sqlstate = 'G4OK0' then return '00000'; end if;
    return sqlstate;
  end;
end;
$body$;

-- =================================================================== c2: every role but the owner is revoked ==
select is(pg_temp.g4_grantees('platform_private.cms_related_content_public_targets(uuid,text,text)'::regprocedure), array['wejammin_cms_definer'],
  'CMS-03C-21 cms_related_content_public_targets is executable by its owner wejammin_cms_definer and by no other role, PUBLIC included [P2-S12-AC-155]');
select is(pg_temp.g4_owner('platform_private.cms_related_content_public_targets(uuid,text,text)'::regprocedure), 'wejammin_cms_definer',
  'CMS-03C-21 is owned by the CMS definer role the registered callers run as [P2-S12-AC-155]');
select is(pg_temp.g4_grantees('platform_private.cms_related_publish_head_revision(uuid,text,text)'::regprocedure), array['wejammin_cms_definer'],
  'the public-eligibility head predicate CMS-03C-21 calls is owner-only as well [P2-S12-AC-155]');
select is(pg_temp.g4_grantees('platform_private.cms_related_derived_candidates(uuid,text,text,text,integer,uuid[],uuid[])'::regprocedure), array['wejammin_cms_definer'],
  'the derived-candidate reader CMS-03C-21 calls is owner-only as well [P2-S12-AC-155]');
select ok(pg_temp.g4_owner('platform_private.cms_related_publish_head_revision(uuid,text,text)'::regprocedure) = 'wejammin_cms_definer'
    and pg_temp.g4_owner('platform_private.cms_related_derived_candidates(uuid,text,text,text,integer,uuid[],uuid[])'::regprocedure) = 'wejammin_cms_definer',
  'both helpers are owned by the CMS definer role [P2-S12-AC-155]');
-- EXECUTE as actually computed for every non-superuser role of the cluster other than the owner and the roles that are members of it
select is((select coalesce(array_agg(r.rolname order by r.rolname), array[]::name[])
     from pg_roles r
    where not r.rolsuper and r.rolname <> 'wejammin_cms_definer'
      and not pg_has_role(r.oid, 'wejammin_cms_definer', 'member')
      and has_function_privilege(r.oid, 'platform_private.cms_related_content_public_targets(uuid,text,text)'::regprocedure, 'execute')),
  array[]::name[],
  'no non-superuser role outside the definer''s membership can execute CMS-03C-21: anon, authenticated, service_role, authenticator and every other role are revoked [P2-S12-AC-155]');
-- anon and authenticated hold no USAGE on platform_private, so any call fails at the schema whatever the function ACL says; USAGE is granted
-- here (rolled back with the transaction) so the denial observed below can only come from the EXECUTE privilege on the function.
grant usage on schema platform_private to anon, authenticated;
select is(pg_temp.g4_as('anon', 'select platform_private.cms_related_content_public_targets(''00000000-0000-4000-8000-000000000001''::uuid, ''en-US'', ''public'')'), '42501',
  'anon, with schema USAGE, calling CMS-03C-21 is denied 42501 by the function ACL [P2-S12-AC-155]');
select is(pg_temp.g4_as('authenticated', 'select platform_private.cms_related_content_public_targets(''00000000-0000-4000-8000-000000000001''::uuid, ''en-US'', ''public'')'), '42501',
  'authenticated, with schema USAGE, calling CMS-03C-21 is denied 42501 by the function ACL [P2-S12-AC-155]');
select is(pg_temp.g4_as('service_role', 'select platform_private.cms_related_content_public_targets(''00000000-0000-4000-8000-000000000001''::uuid, ''en-US'', ''public'')'), '42501',
  'service_role (the sweep principal of other operations) calling CMS-03C-21 is denied 42501 [P2-S12-AC-155]');
select is(pg_temp.g4_as('wejammin_cms_definer', 'select platform_private.cms_related_content_public_targets(''00000000-0000-4000-8000-000000000001''::uuid, ''en-US'', ''public'')'), '00000',
  'control: the owning definer, the role the registered callers run as, can execute CMS-03C-21 (an absent source answers an empty array) [P2-S12-AC-155]');

-- ============================================================ c0: no unregistered caller, no browser route ==
select is(pg_temp.g4_referrers('cms_related_content_public_targets'), array[]::text[],
  'no stored function in platform_private or platform_api calls CMS-03C-21 yet: the Shard 04 delivery projection and the Slice 11 recheck are later callers that run as the definer, so no unregistered caller exists [P2-S12-AC-155]');
select is(pg_temp.g4_referrers('cms_related_publish_head_revision'),
  array['platform_private.cms_related_content_public_targets', 'platform_private.cms_related_derived_candidates']::text[],
  'the head predicate is called only by the CMS-03C-21 family itself [P2-S12-AC-155]');
select is(pg_temp.g4_referrers('cms_related_derived_candidates'),
  array['platform_private.cms_related_content_public_targets', 'platform_private.cms_related_eligible_count']::text[],
  'the derived-candidate reader is called only by CMS-03C-21 and the CMS-03C-05 eligibleCount helper [P2-S12-AC-155]');
select ok(not exists (select 1 from pg_proc proc join pg_namespace ns on ns.oid = proc.pronamespace
                       where ns.nspname = 'platform_api' and proc.prosrc ~ 'cms_related_content_public_targets'),
  'no platform_api wrapper exposes CMS-03C-21: the operation has no browser route [P2-S12-AC-155]');
select ok(not exists (select 1 from pg_proc proc join pg_namespace ns on ns.oid = proc.pronamespace
                       where ns.nspname = 'platform_api' and proc.proname ~ 'related_content_public'),
  'no platform_api function is named for CMS-03C-21 [P2-S12-AC-155]');
select ok((select proc.prosecdef and proc.provolatile = 's' and proc.proconfig = array['search_path=""']::text[]
             from pg_proc proc where proc.oid = 'platform_private.cms_related_content_public_targets(uuid,text,text)'::regprocedure),
  'CMS-03C-21 is SECURITY DEFINER, STABLE and runs with an empty search_path, so a registered caller reaches it only as the definer [P2-S12-AC-155]');

-- ------------------------------------------------------------------ oracle controls (mutations, rolled back) --
-- Each probe above must be able to fail: add a grant and a caller and watch the probes see them.
grant execute on function platform_private.cms_related_content_public_targets(uuid, text, text) to anon;
grant execute on function platform_private.cms_related_publish_head_revision(uuid, text, text) to public;
select is(pg_temp.g4_as('anon', 'select platform_private.cms_related_content_public_targets(''00000000-0000-4000-8000-000000000001''::uuid, ''en-US'', ''public'')'), '00000',
  'control: once anon is granted EXECUTE (and holds schema USAGE) the same call runs, so the 42501 above came from the function ACL [P2-S12-AC-155]');
select is(pg_temp.g4_grantees('platform_private.cms_related_content_public_targets(uuid,text,text)'::regprocedure),
  array['anon', 'wejammin_cms_definer']::text[],
  'control: the ACL probe reports anon when anon is granted EXECUTE [P2-S12-AC-155]');
select is(pg_temp.g4_grantees('platform_private.cms_related_publish_head_revision(uuid,text,text)'::regprocedure),
  array['PUBLIC', 'wejammin_cms_definer']::text[],
  'control: the ACL probe reports PUBLIC when PUBLIC is granted EXECUTE [P2-S12-AC-155]');
create function platform_private.g4_probe_caller() returns jsonb language sql as
  $$ select platform_private.cms_related_content_public_targets(null, null, null) $$;
select is(pg_temp.g4_referrers('cms_related_content_public_targets'), array['platform_private.g4_probe_caller']::text[],
  'control: the caller scan reports a function that calls CMS-03C-21 when one is added [P2-S12-AC-155]');

select * from finish();
rollback;
