\ir /w/supabase/tests/support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;
begin;
select no_plan();
select diag(format('CAT %s owner=%s lang=%s vol=%s strict=%s secdef=%s config=%s acl=%s md5=%s len=%s comment=%s',
  p.oid::regprocedure, pg_get_userbyid(p.proowner), l.lanname, p.provolatile, p.proisstrict, p.prosecdef, coalesce(p.proconfig::text, '-'), coalesce(p.proacl::text, '-'),
  md5(p.prosrc), length(p.prosrc), left(coalesce(obj_description(p.oid, 'pg_proc'), '-'), 40)))
  from pg_proc p join pg_language l on l.oid = p.prolang
 where p.oid in ('platform_private.cms_valid_field_input(jsonb,boolean)'::regprocedure, 'platform_private.cms_exact_keys(jsonb,text[],text[])'::regprocedure,
   'platform_private.cms_reserved_key(text)'::regprocedure, 'platform_private.cms_valid_uuid(text)'::regprocedure, 'platform_private.cms_json_bounded(jsonb,integer,integer,integer,integer)'::regprocedure,
   'platform_private.cms_rpc_context_valid()'::regprocedure, 'platform_private.cms_active_parent_guard()'::regprocedure, 'platform_private.cms_activation_review_invalidation_trigger()'::regprocedure,
   'platform_private.cms_invalidate_activation_reviews(uuid)'::regprocedure, 'platform_private.cms_activation_references_valid(uuid)'::regprocedure, 'platform_private.cms_create_type_draft(jsonb)'::regprocedure)
 order by 1;
select diag('CAT src cms_rpc_context_valid: ' || p.prosrc) from pg_proc p where p.oid = 'platform_private.cms_rpc_context_valid()'::regprocedure;
select diag('CAT grants wejammin_cms_definer exec valid_field_input=' || has_function_privilege('wejammin_cms_definer', 'platform_private.cms_valid_field_input(jsonb,boolean)', 'EXECUTE')
  || ' authority_reader=' || has_function_privilege('wejammin_cms_authority_reader', 'platform_private.cms_valid_field_input(jsonb,boolean)', 'EXECUTE')
  || ' platform_definer=' || has_function_privilege('wejammin_platform_definer', 'platform_private.cms_valid_field_input(jsonb,boolean)', 'EXECUTE')
  || ' public=' || has_function_privilege('public', 'platform_private.cms_valid_field_input(jsonb,boolean)', 'EXECUTE'));
select diag('CAT tg ' || c.relname || '.' || t.tgname || ' type=' || t.tgtype || ' fn=' || t.tgfoid::regproc || ' enabled=' || t.tgenabled)
  from pg_trigger t join pg_class c on c.oid = t.tgrelid where c.relname = 'cms_field_definition_versions' and not t.tgisinternal order by t.tgname;
select diag('CAT rls ' || c.relname || ' enabled=' || c.relrowsecurity || ' forced=' || c.relforcerowsecurity) from pg_class c where c.relname in ('cms_field_definition_versions', 'cms_content_type_versions');
select diag('CAT policy ' || pol.polrelid::regclass || ' ' || pol.polname || ' cmd=' || pol.polcmd || ' roles=' || pol.polroles::text || ' using=' || coalesce(pg_get_expr(pol.polqual, pol.polrelid), '-') || ' check=' || coalesce(pg_get_expr(pol.polwithcheck, pol.polrelid), '-'))
  from pg_policy pol where pol.polrelid in ('platform_private.cms_field_definition_versions'::regclass) order by pol.polname;
select * from finish();
rollback;
