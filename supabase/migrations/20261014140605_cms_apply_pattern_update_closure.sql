-- Slice 12 lane pattern-updates (CMS-03C-15, split from 20261014140600 to keep each file under 300 lines): the owner, ACL and table
-- privileges of platform_private.cms_apply_pattern_update, then its privilege closure - every function the command calls directly must be
-- executable by the CMS definer; only what is missing is granted.  Forward-only.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_apply_pattern_update(jsonb) owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function platform_private.cms_apply_pattern_update(jsonb) from public, anon, authenticated, service_role;

grant select, insert on table platform_private.cms_composition_instances to wejammin_cms_definer;
grant select, update on table platform_private.cms_content_entries to wejammin_cms_definer;
grant select on table platform_private.cms_entry_revisions, platform_private.cms_pattern_versions,
  platform_private.cms_content_type_versions to wejammin_cms_definer;
grant select, update on table platform_private.cms_editorial_reviews to wejammin_cms_definer;

-- Privilege closure: every function the command calls directly must be executable by the definer; only what is missing is granted.
do $closure$
declare
  callee text;
  callee_oid regprocedure;
begin
  foreach callee in array array[
    'platform_private.cms_actor(jsonb)', 'platform_private.cms_acting_party(jsonb,uuid)', 'platform_private.cms_correlation(jsonb)',
    'platform_private.cms_entry_tenant_visible(uuid,uuid)', 'platform_private.cms_lock_entry_authority(uuid,uuid,uuid)',
    'platform_private.cms_authority_origin(uuid,uuid,text,uuid)', 'platform_private.cms_revision_effective_state(uuid)',
    'platform_private.cms_reserve(jsonb,uuid,text)', 'platform_private.cms_complete(uuid,uuid,integer,jsonb)',
    'platform_private.cms_record_audit(text,uuid,uuid,text,uuid,text,uuid)', 'platform_private.cms_invalidate_editorial_review(jsonb)',
    'platform_private.cms_json_bounded(jsonb,integer,integer,integer,integer)',
    'platform_private.cms_pattern_nested_closure(uuid,jsonb)', 'platform_private.cms_pattern_registry_digest(uuid,jsonb)',
    'platform_private.cms_composition_instance_resource(platform_private.cms_composition_instances)',
    'platform_private.cms_pattern_update_check(jsonb)', 'platform_private.cms_pattern_update_target(uuid,uuid,bigint,uuid)',
    'platform_private.cms_pattern_update_plan(platform_private.cms_composition_instances,uuid,boolean)',
    'platform_private.cms_pattern_update_next_row(platform_private.cms_composition_instances,text,jsonb,jsonb,text,uuid,timestamp with time zone)',
    'extensions.gen_random_uuid()'
  ] loop
    callee_oid := pg_catalog.to_regprocedure(callee);
    if callee_oid is null then
      raise exception 'pattern update command callee is missing: %', callee using errcode = '55000';
    end if;
    if not pg_catalog.has_function_privilege('wejammin_cms_definer', callee_oid, 'EXECUTE') then
      execute pg_catalog.format('grant execute on function %s to wejammin_cms_definer', callee_oid::text);
    end if;
  end loop;
end;
$closure$;

commit;
