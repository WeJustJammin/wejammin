-- DEC-199: revision-aware frozen-manifest currentness.
-- The legacy one-argument predicate remains strict for existing callers.  The
-- revision-aware wrapper proves the effective pattern provider first, then
-- delegates every non-pattern identity to that unchanged predicate.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create function platform_private.cms_revision_manifest_identities_current(
  p_revision_id uuid, p_manifest jsonb
)
returns boolean
language plpgsql
volatile
security invoker
set search_path = ''
as $body$
declare local_manifest jsonb; provider record;
begin
  if p_revision_id is null or not platform_private.cms_dependency_manifest_valid(p_manifest) then
    return false;
  end if;
  if not exists (
    select 1 from platform_private.cms_entry_revisions revision where revision.id = p_revision_id
  ) then
    return false;
  end if;
  select result.* into provider
    from platform_private.cms_pattern_active_digest(p_revision_id, p_manifest) result;
  if not found or provider.outcome <> 'passed' or provider.reason_code is not null
     or provider.blocking_count <> 0 then
    return false;
  end if;
  local_manifest := pg_catalog.jsonb_set(
    p_manifest, '{patterns}', '[]'::jsonb, false);
  return platform_private.cms_manifest_identities_current(local_manifest);
exception when others then
  return false;
end;
$body$;

comment on function platform_private.cms_revision_manifest_identities_current(uuid, jsonb) is
  'DEC-199 revision-aware manifest currentness: strict original manifest validation, effective live/canonical pattern provider pass, then unchanged one-argument identity checks with only the local patterns projection removed. The caller manifest and version set are never rewritten. Private.';

grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_revision_manifest_identities_current(uuid, jsonb)
  owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function platform_private.cms_revision_manifest_identities_current(uuid, jsonb)
  from public, anon, authenticated, service_role;

do $amend$
declare identity constant text := 'platform_private.cms_frozen_dependencies_status(uuid,jsonb)';
  old_call constant text := 'platform_private.cms_manifest_identities_current(p_frozen_manifest)';
  new_call constant text := 'platform_private.cms_revision_manifest_identities_current(p_revision_id, p_frozen_manifest)';
  original pg_catalog.pg_proc%rowtype; actual pg_catalog.pg_proc%rowtype;
  definition text; old_source text; new_source text; comment_text text;
begin
  select proc.* into original from pg_catalog.pg_proc proc
   where proc.oid = pg_catalog.to_regprocedure(identity);
  if not found or original.proowner <> 'wejammin_cms_definer'::pg_catalog.regrole
     or not original.prosecdef or original.prokind <> 'f'
     or original.provolatile <> 'v' or original.proretset
     or original.prorettype <> 'text'::pg_catalog.regtype
     or original.proconfig is distinct from array['search_path=""']::text[]
     or original.prolang <> (select lang.oid from pg_catalog.pg_language lang where lang.lanname = 'plpgsql') then
    raise exception 'cms_frozen_dependencies_status unexpected attributes' using errcode = '55000';
  end if;
  old_source := original.prosrc;
  if (pg_catalog.length(old_source) - pg_catalog.length(pg_catalog.replace(old_source, old_call, '')))
       / pg_catalog.length(old_call) <> 1 then
    raise exception 'cms_frozen_dependencies_status currentness anchor is not unique' using errcode = '55000';
  end if;
  new_source := pg_catalog.replace(old_source, old_call, new_call);
  if pg_catalog.replace(new_source, new_call, old_call) is distinct from old_source then
    raise exception 'cms_frozen_dependencies_status amendment is not reversible' using errcode = '55000';
  end if;
  definition := pg_catalog.pg_get_functiondef(original.oid);
  if (pg_catalog.length(definition) - pg_catalog.length(pg_catalog.replace(definition, old_source, '')))
       / pg_catalog.length(old_source) <> 1 then
    raise exception 'cms_frozen_dependencies_status definition is ambiguous' using errcode = '55000';
  end if;
  comment_text := pg_catalog.obj_description(original.oid, 'pg_proc');
  execute pg_catalog.replace(definition, old_source, new_source);
  select proc.* into actual from pg_catalog.pg_proc proc where proc.oid = original.oid;
  if not found or actual.prosrc is distinct from new_source
     or pg_catalog.to_jsonb(actual) - 'prosrc' is distinct from pg_catalog.to_jsonb(original) - 'prosrc'
     or pg_catalog.obj_description(actual.oid, 'pg_proc') is distinct from comment_text
     or pg_catalog.pg_get_functiondef(actual.oid) is distinct from
        pg_catalog.replace(definition, old_source, new_source) then
    raise exception 'cms_frozen_dependencies_status amendment changed more than the call' using errcode = '55000';
  end if;
end;
$amend$;

commit;
