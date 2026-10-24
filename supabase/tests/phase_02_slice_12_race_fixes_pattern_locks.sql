-- Lane races-canonical, DEC-199 / BE03b lock-order position 3 for the publication commands
-- (supabase/migrations/20261023100000, 20261023100100).  Catalog-level and smoke
-- assertions only: a row lock is not observable from the locking transaction, so the WAIT itself
-- (a publication waiting on, and being waited on by, a nested pattern activation, in both commit orders)
-- is proven by the independent-session race supabase/tests/phase_02_slice_12_dec199_publication.race.mjs.
\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;
begin;
select no_plan();

select is(
  (select pg_catalog.pg_get_userbyid(proc.proowner) || ':' || proc.prosecdef::text || ':' || proc.provolatile::text
          || ':' || proc.proretset::text || ':' || proc.prorettype::regtype::text || ':' || proc.proconfig::text
     from pg_catalog.pg_proc proc
    where proc.oid = pg_catalog.to_regprocedure('platform_private.cms_lock_revision_pattern_dependencies(uuid)')),
  'wejammin_cms_definer:true:v:false:void:{"search_path=\"\""}',
  'the position-3 helper is a volatile SECURITY DEFINER void function owned by the CMS definer with an empty search_path');

select is(
  (select pg_catalog.has_function_privilege('anon', proc.oid, 'EXECUTE')::text || ':'
       || pg_catalog.has_function_privilege('authenticated', proc.oid, 'EXECUTE')::text || ':'
       || pg_catalog.has_function_privilege('service_role', proc.oid, 'EXECUTE')::text
     from pg_catalog.pg_proc proc
    where proc.oid = pg_catalog.to_regprocedure('platform_private.cms_lock_revision_pattern_dependencies(uuid)')),
  'false:false:false',
  'no API role can execute the position-3 helper');

select is(
  (select pg_catalog.count(*)::integer
     from pg_catalog.pg_proc proc
    cross join lateral pg_catalog.aclexplode(
      coalesce(proc.proacl, pg_catalog.acldefault('f', proc.proowner))) acl
    where proc.oid = pg_catalog.to_regprocedure('platform_private.cms_lock_revision_pattern_dependencies(uuid)')
      and acl.grantee = 0),
  0,
  'PUBLIC holds no EXECUTE on the position-3 helper');

select lives_ok(
  $$select platform_private.cms_lock_revision_pattern_dependencies('00000000-0000-4000-8000-000000000000'::uuid)$$,
  'a missing revision locks nothing and raises nothing (the caller owns the typed refusal)');

select is(
  (select pg_catalog.strpos(proc.prosrc, 'cms_lock_revision_pattern_dependencies(p_revision_id)') > 0
      and pg_catalog.strpos(proc.prosrc, 'cms_lock_revision_pattern_dependencies(p_revision_id)')
            < pg_catalog.strpos(proc.prosrc, 'cms_content_type_versions')
      and pg_catalog.strpos(proc.prosrc, 'cms_content_type_versions')
            < pg_catalog.strpos(proc.prosrc, 'cms_editorial_reviews review_item')
     from pg_catalog.pg_proc proc
    where proc.oid = pg_catalog.to_regprocedure('platform_private.cms_publication_lock_review(uuid)')),
  true,
  'CMS-03B-07/09: the pattern dependencies are locked before the content-type version (4) and the review (5)');

select is(
  (select pg_catalog.strpos(proc.prosrc, 'cms_lock_revision_pattern_dependencies(p_revision_id)') > 0
      and pg_catalog.strpos(proc.prosrc, 'cms_lock_revision_pattern_dependencies(p_revision_id)')
            < pg_catalog.strpos(proc.prosrc, 'cms_content_type_versions')
      and pg_catalog.strpos(proc.prosrc, 'cms_content_type_versions')
            < pg_catalog.strpos(proc.prosrc, 'cms_editorial_reviews review_item')
     from pg_catalog.pg_proc proc
    where proc.oid = pg_catalog.to_regprocedure('platform_private.cms_schedule_lock_review(uuid,uuid)')),
  true,
  'CMS-03B-20: the pattern dependencies are locked before the content-type version (4) and the review (5)');

select is(
  (select pg_catalog.pg_get_userbyid(proc.proowner) || ':' || proc.prosecdef::text || ':' || proc.provolatile::text
          || ':' || proc.proconfig::text
     from pg_catalog.pg_proc proc
    where proc.oid = pg_catalog.to_regprocedure('platform_private.cms_publication_lock_review(uuid)')),
  'wejammin_cms_definer:true:v:{"search_path=\"\""}',
  'the amended publication review lock keeps its owner, SECURITY DEFINER, volatility and search_path');

select is(
  (select pg_catalog.has_function_privilege('service_role', proc.oid, 'EXECUTE')::text
     from pg_catalog.pg_proc proc
    where proc.oid = pg_catalog.to_regprocedure('platform_private.cms_schedule_lock_review(uuid,uuid)')),
  'false',
  'the amended executor review lock is still private');

select * from finish();
rollback;
