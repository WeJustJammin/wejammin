-- Slice 12 gap lane claude_s12_gaps_db2: BE03c "Authorization" / RPC inventory, P2-S12-AC-261 clauses 1 and 3.
-- Every named Slice 12 RPC that exists is inventoried by schema and name: it exists, is SECURITY DEFINER with an
-- empty search_path, has PUBLIC execute revoked, and carries exactly the named grants - service_role alone on a
-- platform_api wrapper, nobody (no PUBLIC, anon, authenticated or service_role) on a platform_private body - with a
-- positive probe (the service transport may execute a wrapper) and negative probes (anon, authenticated and PUBLIC
-- may not execute anything; no API role may execute a private body).  The Worker job-handler registrations
-- (cms.pattern.linked_update_scan, cms.governed_review.recheck) are Worker code and the cms.taxonomy.merge_converge
-- handler is a BE00 jobs row: their SQL entry points (the scan, recheck and merge-converge RPCs) are inventoried here.
-- cms_resolve_taxonomy_version is named by the spec clause but is not a Slice 12 function (AC-242, owned by the
-- taxonomy_integrity lane) and is deliberately absent from this inventory.
\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- (schema, name, arity-agnostic).  'api' = platform_api wrapper, 'priv' = platform_private body.
create temp table g2_inv(schema_name text not null, fn text not null, kind text not null, primary key (schema_name, fn))
on commit drop;
insert into g2_inv(schema_name, fn, kind)
select s, n, case s when 'platform_api' then 'api' else 'priv' end
from (values
  -- the five original commands
  ('cms_define_template'), ('cms_insert_pattern_instance'), ('cms_act_taxonomy_term'),
  ('cms_author_locale_variant'), ('cms_curate_related_content'),
  -- the platform RPCs
  ('cms_template_latest'), ('cms_pattern_latest'), ('cms_list_taxonomy_versions'), ('cms_list_taxonomy_terms'),
  ('cms_submit_governed_review'), ('cms_record_governed_decision'), ('cms_assign_governed_reviewer'),
  ('cms_activate_governed_subject'), ('cms_get_governed_review'), ('cms_list_governed_reviews'),
  ('cms_create_pattern_version'), ('cms_list_pattern_selector'), ('cms_get_instance_update_diff'),
  ('cms_apply_pattern_update'), ('cms_create_taxonomy_version'), ('cms_list_taxonomy_selector'),
  ('cms_get_related_content'), ('cms_get_locale_variant'), ('cms_list_composition_instances'),
  -- DEC-196 / DEC-232: cmsPatternNestableRead (20261027100000 reader, 20261027100010 signed wrapper and transport)
  ('cms_list_pattern_nestable'),
  -- the internal RPCs that have both a wrapper and a body
  ('cms_claim_due_governed_activations'), ('cms_execute_governed_activation'),
  ('cms_recheck_governed_reviews'), ('cms_scan_linked_pattern_updates'),
  ('cms_reconcile_taxonomy_merge_converge'), ('cms_locale_observability_read'),
  ('cms_run_taxonomy_merge_converge')
) f(n)
cross join (values ('platform_api'), ('platform_private')) sc(s);
-- wrapper-only (the body is a private helper with another name)
insert into g2_inv(schema_name, fn, kind) values
  ('platform_api', 'cms_governed_recheck_resolve_event', 'api'),
  ('platform_api', 'cms_linked_scan_resolve_event', 'api');
-- private-only internals
insert into g2_inv(schema_name, fn, kind) values
  ('platform_private', 'cms_canonical_taxonomy_match', 'priv'),
  ('platform_private', 'cms_resolve_locale_field', 'priv'),
  ('platform_private', 'cms_related_content_public_targets', 'priv'),
  ('platform_private', 'cms_invalidate_governed_reviews_for_person', 'priv');

-- Every overload of every inventoried function with its facts.
create temp table g2_fn on commit drop as
select i.schema_name, i.fn, i.kind, p.oid as fn_oid, p.prosecdef, p.proconfig, p.proowner,
       coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner)) as acl,
       p.oid::regprocedure::text as sig
  from g2_inv i
  join pg_catalog.pg_namespace n on n.nspname = i.schema_name
  join pg_catalog.pg_proc p on p.pronamespace = n.oid and p.proname = i.fn and p.prokind = 'f';

create or replace function pg_temp.g2_names(p_where text) returns text[]
language plpgsql stable as $body$
declare names text[];
begin
  execute pg_catalog.format('select coalesce(array_agg(sig order by sig), array[]::text[]) from g2_fn where %s', p_where) into names;
  return names;
end;
$body$;

-- ----------------------------------------------------------------------------------------------- existence --
select is((select pg_catalog.array_agg(i.schema_name || '.' || i.fn order by i.schema_name, i.fn)
    from g2_inv i where not exists (select 1 from g2_fn f where f.schema_name = i.schema_name and f.fn = i.fn)),
  null::text[], 'every inventoried wrapper and body exists in its schema, none is missing [P2-S12-AC-261]');
-- Typed totals (the only completeness pin on the inventory's size; a recount against its own list would prove nothing).  DEC-196 / DEC-232 added
-- cms_list_pattern_nestable: 33 -> 34 wrappers, 35 -> 36 bodies, 68 -> 70 functions.  The count follows the final set of names.
select is((select pg_catalog.count(*)::integer from g2_inv where kind = 'api'), 34,
  'the inventory lists 34 platform_api wrappers: 5 original commands, 20 platform RPCs and 9 internal RPCs [P2-S12-AC-261]');
select is((select pg_catalog.count(*)::integer from g2_inv where kind = 'priv'), 36,
  'the inventory lists 36 platform_private bodies and internals [P2-S12-AC-261]');
select is((select pg_catalog.count(*)::integer from g2_fn), 70,
  'the inventory resolves to exactly one function per listed (schema, name): no overload hides an ungranted twin [P2-S12-AC-261]');

-- ---------------------------------------------------------------------------- definer and search_path ----
select is(pg_temp.g2_names('not prosecdef'), array[]::text[],
  'every inventoried RPC is SECURITY DEFINER [P2-S12-AC-261]');
select is(pg_temp.g2_names($$proconfig is null or not ('search_path=""' = any (proconfig))$$), array[]::text[],
  'every inventoried RPC pins an empty search_path [P2-S12-AC-261]');

-- ------------------------------------------------------------------------------------------ PUBLIC revoked --
select is(pg_temp.g2_names($$exists (select 1 from pg_catalog.aclexplode(acl) a where a.grantee = 0)$$), array[]::text[],
  'PUBLIC execute is revoked on every inventoried RPC [P2-S12-AC-261]');

-- ----------------------------------------------------------------- positive grant: the service transport --
select is(pg_temp.g2_names($$kind = 'api' and not pg_catalog.has_function_privilege('service_role', fn_oid, 'execute')$$),
  array[]::text[], 'service_role may execute every platform_api wrapper (positive grant) [P2-S12-AC-261]');
-- --------------------------------------------------------------------------------- negative grants --------
select is(pg_temp.g2_names($$pg_catalog.has_function_privilege('anon', fn_oid, 'execute')$$), array[]::text[],
  'anon may execute no inventoried RPC (negative grant) [P2-S12-AC-261]');
select is(pg_temp.g2_names($$pg_catalog.has_function_privilege('authenticated', fn_oid, 'execute')$$), array[]::text[],
  'authenticated may execute no inventoried RPC (negative grant) [P2-S12-AC-261]');
select is(pg_temp.g2_names($$kind = 'priv' and pg_catalog.has_function_privilege('service_role', fn_oid, 'execute')$$),
  array[]::text[], 'service_role may execute no platform_private body: it reaches them only through its wrapper (negative grant) [P2-S12-AC-261]');
-- exact grantee sets, as ACL entries: a wrapper's only grantees are service_role and its owner, a body's only its owner
select is(pg_temp.g2_names($$exists (
    select 1 from pg_catalog.aclexplode(acl) a
     where a.privilege_type = 'EXECUTE' and a.grantee <> proowner
       and a.grantee <> coalesce((select oid from pg_catalog.pg_roles where rolname = case kind when 'api' then 'service_role' else '-' end), 0)
       and a.grantee not in (select oid from pg_catalog.pg_roles where rolname in ('wejammin_cms_definer', 'wejammin_platform_definer',
           'wejammin_cms_authority_reader', 'postgres', 'supabase_admin')))$$),
  array[]::text[], 'no inventoried RPC carries an EXECUTE grant beyond its named grantee and the definer roles that own or compose it [P2-S12-AC-261]');
select is(pg_temp.g2_names($$kind = 'api' and not exists (
    select 1 from pg_catalog.aclexplode(acl) a where a.privilege_type = 'EXECUTE'
       and a.grantee = (select oid from pg_catalog.pg_roles where rolname = 'service_role'))$$),
  array[]::text[], 'service_role appears in the ACL of every wrapper as a named grant [P2-S12-AC-261]');

-- ------------------------------------------------------------------ oracle controls (mutations, rolled back) --
grant execute on function platform_private.cms_canonical_taxonomy_match(text, jsonb) to anon;
select ok(pg_catalog.has_function_privilege('anon', 'platform_private.cms_canonical_taxonomy_match(text, jsonb)'::regprocedure, 'execute'),
  'control: the negative-grant probe sees an anon EXECUTE grant when one is added [P2-S12-AC-261]');
grant execute on function platform_private.cms_canonical_taxonomy_match(text, jsonb) to public;
select ok(exists (select 1 from pg_catalog.pg_proc p, pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
    where p.oid = 'platform_private.cms_canonical_taxonomy_match(text, jsonb)'::regprocedure and a.grantee = 0),
  'control: the PUBLIC-execute probe sees a PUBLIC grant when one is added [P2-S12-AC-261]');

select * from finish();
rollback;
