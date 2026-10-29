-- Slice 12 gap lane claude_s12_gaps_db1: owner-only ACL assertions (DEC-226 rule 2: `proacl`/aclexplode, never four named
-- roles) and callers inventories over pg_proc.prosrc.  Catalog-only: no fixture is needed.
--   P2-S12-AC-138 clause 0  CMS-03C-18 `cms_canonical_taxonomy_match` is executable only by its database-internal caller
--                           (cms_term_overlap_check, called by cms_act_taxonomy_term); every other role has EXECUTE revoked;
--                           the activation preflight reads the registry provider_state (DEC-227 Q5).
--   P2-S12-AC-144 clause 1  the claim/execute wrappers grant EXECUTE to the registered sweep principal (service_role) only.
--   P2-S12-AC-148 clause 2  the 03b `locale` preflight gate runs the resolver core `cms_locale_resolutions`.
--   P2-S12-AC-150 clause 2  CMS-03C-20 is executable only by the registered non-browser callers; every other role revoked.
\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- The grantees of a function's EXECUTE privilege by role name ('PUBLIC' for the pseudo-role), from the stored ACL (or the
-- default ACL when the column is NULL, which includes PUBLIC).
create or replace function pg_temp.gd_grantees(p_function regprocedure) returns text[] language sql stable as $body$
  select coalesce(array_agg(distinct case when acl.grantee = 0 then 'PUBLIC' else pg_get_userbyid(acl.grantee) end
                            order by case when acl.grantee = 0 then 'PUBLIC' else pg_get_userbyid(acl.grantee) end), array[]::text[])
    from pg_proc proc
    cross join lateral aclexplode(coalesce(proc.proacl, acldefault('f', proc.proowner))) acl
   where proc.oid = p_function and acl.privilege_type = 'EXECUTE'
$body$;
create or replace function pg_temp.gd_owner(p_function regprocedure) returns text language sql stable as $body$
  select pg_get_userbyid(proowner) from pg_proc where oid = p_function $body$;
-- Names of the SQL/plpgsql functions of the two schemas whose body mentions p_callee (the callee itself excluded).
create or replace function pg_temp.gd_referrers(p_callee text) returns text[] language sql stable as $body$
  select coalesce(array_agg(n.nspname || '.' || p.proname order by n.nspname, p.proname), array[]::text[])
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('platform_private', 'platform_api')
     and p.prolang in (select oid from pg_language where lanname in ('plpgsql', 'sql'))
     and p.proname <> p_callee and p.prosrc ~ ('\m' || p_callee || '\M')
$body$;

-- ------------------------------------------------------------------------------------------------ AC-138 --
select is(pg_temp.gd_grantees('platform_private.cms_canonical_taxonomy_match(text,jsonb)'::regprocedure), array['wejammin_cms_definer'],
  'cms_canonical_taxonomy_match is executable by its owner wejammin_cms_definer and by no other role, PUBLIC included [P2-S12-AC-138]');
select is(pg_temp.gd_owner('platform_private.cms_canonical_taxonomy_match(text,jsonb)'::regprocedure), 'wejammin_cms_definer',
  'cms_canonical_taxonomy_match is owned by the CMS definer role [P2-S12-AC-138]');
select is(pg_temp.gd_referrers('cms_canonical_taxonomy_match'), array['platform_private.cms_term_overlap_check'],
  'the only function that references cms_canonical_taxonomy_match is cms_term_overlap_check [P2-S12-AC-138]');
select is(pg_temp.gd_referrers('cms_term_overlap_check'), array['platform_private.cms_term_apply_write'],
  'the only caller of cms_term_overlap_check is the term write step cms_term_apply_write [P2-S12-AC-138]');
select is(pg_temp.gd_referrers('cms_term_apply_write'), array['platform_private.cms_act_taxonomy_term'],
  'the only caller of the term write step is cms_act_taxonomy_term, so the match function is reached only through the CMS-03C-03 command [P2-S12-AC-138]');
select is(pg_temp.gd_grantees('platform_private.cms_term_overlap_check(jsonb,text[])'::regprocedure), array['wejammin_cms_definer'],
  'the overlap check itself is owner-only, so the match function is reachable only inside the term action [P2-S12-AC-138]');
select ok(
  (select p.prosrc ~ 'cms_canonical_domain_current' and p.prosrc ~ 'provider_state'
      and p.prosrc !~ 'cms_canonical_taxonomy_match'
     from pg_proc p where p.oid = 'platform_private.cms_governed_first_unbuilt_domain(jsonb)'::regprocedure),
  'the activation preflight reads the registry provider_state through the domain registry and never the match function [P2-S12-AC-138]');

-- ------------------------------------------------------------------------------------------------ AC-144 --
select is(pg_temp.gd_grantees('platform_api.cms_claim_due_governed_activations(jsonb)'::regprocedure),
  array['service_role', 'wejammin_cms_definer'],
  'the claim wrapper grants EXECUTE to service_role (the registered sweep principal) and its owner only [P2-S12-AC-144]');
select is(pg_temp.gd_grantees('platform_api.cms_execute_governed_activation(jsonb)'::regprocedure),
  array['service_role', 'wejammin_cms_definer'],
  'the execute wrapper grants EXECUTE to service_role and its owner only [P2-S12-AC-144]');
select is(pg_temp.gd_grantees('platform_private.cms_claim_due_governed_activations(jsonb)'::regprocedure), array['wejammin_cms_definer'],
  'the private claim function is owner-only [P2-S12-AC-144]');
select is(pg_temp.gd_grantees('platform_private.cms_execute_governed_activation(jsonb)'::regprocedure), array['wejammin_cms_definer'],
  'the private execute function is owner-only [P2-S12-AC-144]');

-- ------------------------------------------------------------------------------------------------ AC-148 --
select ok(pg_get_functiondef('platform_private.cms_locale_no_fallback_gate(uuid,text)'::regprocedure) ~ 'cms_locale_resolutions',
  'the 03b locale preflight gate runs the shared resolver core cms_locale_resolutions, the resolver cms_resolve_locale_field also uses [P2-S12-AC-148]');
select ok(pg_get_functiondef('platform_private.cms_resolve_locale_field(uuid,text,uuid)'::regprocedure) ~ 'cms_locale_resolutions',
  'the field resolver is the same core [P2-S12-AC-148]');

-- ------------------------------------------------------------------------------------------------ AC-150 --
select is(pg_temp.gd_grantees('platform_private.cms_resolve_locale_field(uuid,text,uuid)'::regprocedure), array['wejammin_cms_definer'],
  'CMS-03C-20 cms_resolve_locale_field is executable by its owner only: PUBLIC, anon, authenticated, service_role and every other role are revoked [P2-S12-AC-150]');
select is(pg_temp.gd_grantees('platform_private.cms_locale_resolutions(uuid,text,uuid,uuid[],uuid)'::regprocedure), array['wejammin_cms_definer'],
  'the resolver core is owner-only as well [P2-S12-AC-150]');
select is(pg_temp.gd_referrers('cms_locale_resolutions'),
  array['platform_private.cms_get_locale_variant', 'platform_private.cms_locale_no_fallback_gate', 'platform_private.cms_resolve_locale_field'],
  'the registered callers of the resolver core are exactly the publication preflight gate, the CMS-03C-04 editorial reader and the field resolver [P2-S12-AC-150]');
select is(pg_temp.gd_referrers('cms_resolve_locale_field'), array[]::text[],
  'no function calls cms_resolve_locale_field yet: the Shard 04 delivery projection is a later shard and has no caller to register [P2-S12-AC-150]');

select finish();
rollback;
