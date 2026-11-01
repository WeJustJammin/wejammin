-- DEC-199: install the pattern provider row and dispatch it before the shared
-- preflight.<category> key guard.  Every other registry row and evaluator
-- branch remains byte-for-byte unchanged.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

select pg_catalog.set_config('app.cms_rpc', 'true', true);

do $amend$
declare identity constant text := 'platform_private.cms_evaluate_preflight(jsonb)';
  anchor_old constant text := $old$    elsif registry_row.provider_key <> 'preflight.' || registry_row.category then
      outcome := 'unavailable';
      reason := 'provider_unavailable';$old$;
  anchor_new constant text := $new$    elsif registry_row.category = 'pattern'
       and registry_row.provider_key = 'cms.pattern.active_digest'
       and registry_row.provider_version = 1
       and registry_row.provider_kind = 'database' then
      select active.outcome, active.reason_code, active.blocking_count
        into outcome, reason, offenders
        from platform_private.cms_pattern_active_digest(revision_row.id, frozen) active;

    elsif registry_row.provider_key <> 'preflight.' || registry_row.category then
      outcome := 'unavailable';
      reason := 'provider_unavailable';$new$;
  original pg_catalog.pg_proc%rowtype; actual pg_catalog.pg_proc%rowtype;
  old_source text; new_source text; definition text; comment_text text;
begin
  select proc.* into original from pg_catalog.pg_proc proc
   where proc.oid = pg_catalog.to_regprocedure(identity);
  if not found or original.proowner <> 'wejammin_cms_definer'::pg_catalog.regrole
     or not original.prosecdef or original.prokind <> 'f' or original.provolatile <> 'v'
     or original.proretset or original.prorettype <> 'jsonb'::pg_catalog.regtype
     or original.proconfig is distinct from array['search_path=""']::text[]
     or original.prolang <> (select lang.oid from pg_catalog.pg_language lang where lang.lanname = 'plpgsql') then
    raise exception 'cms_evaluate_preflight unexpected attributes' using errcode = '55000';
  end if;
  old_source := original.prosrc;
  if (pg_catalog.length(old_source) - pg_catalog.length(pg_catalog.replace(old_source, anchor_old, '')))
       / pg_catalog.length(anchor_old) <> 1 then
    raise exception 'cms_evaluate_preflight dispatch anchor is not unique' using errcode = '55000';
  end if;
  new_source := pg_catalog.replace(old_source, anchor_old, anchor_new);
  if pg_catalog.replace(new_source, anchor_new, anchor_old) is distinct from old_source then
    raise exception 'cms_evaluate_preflight amendment is not reversible' using errcode = '55000';
  end if;
  definition := pg_catalog.pg_get_functiondef(original.oid);
  if (pg_catalog.length(definition) - pg_catalog.length(pg_catalog.replace(definition, old_source, '')))
       / pg_catalog.length(old_source) <> 1 then
    raise exception 'cms_evaluate_preflight definition is ambiguous' using errcode = '55000';
  end if;
  comment_text := pg_catalog.obj_description(original.oid, 'pg_proc');
  execute pg_catalog.replace(definition, old_source, new_source);
  select proc.* into actual from pg_catalog.pg_proc proc where proc.oid = original.oid;
  if not found or actual.prosrc is distinct from new_source
     or pg_catalog.to_jsonb(actual) - 'prosrc' is distinct from pg_catalog.to_jsonb(original) - 'prosrc'
     or pg_catalog.obj_description(actual.oid, 'pg_proc') is distinct from comment_text
     or pg_catalog.pg_get_functiondef(actual.oid) is distinct from
        pg_catalog.replace(definition, old_source, new_source) then
    raise exception 'cms_evaluate_preflight amendment changed more than dispatch' using errcode = '55000';
  end if;
end;
$amend$;

insert into platform_private.cms_preflight_registry(
  owner_id, state, version, category, owner_slice, provider_key,
  provider_version, provider_kind, reference_kind
)
values (
  '0d6a0d6a-0000-4000-8000-000000000134'::uuid, 'seeded', 2,
  'pattern', 'slice-12', 'cms.pattern.active_digest', 1, 'database', null
);

do $registry_guard$
declare row_item platform_private.cms_preflight_registry%rowtype;
begin
  select registry.* into row_item
    from platform_private.cms_preflight_registry registry
   where registry.category = 'pattern' and registry.version = 2;
  if not found or row_item.owner_id <> '0d6a0d6a-0000-4000-8000-000000000134'::uuid
     or row_item.state <> 'seeded' or row_item.owner_slice <> 'slice-12'
     or row_item.provider_key <> 'cms.pattern.active_digest' or row_item.provider_version <> 1
     or row_item.provider_kind <> 'database' or row_item.reference_kind is not null then
    raise exception 'cms.pattern.active_digest registry row is not exact' using errcode = '55000';
  end if;
end;
$registry_guard$;

commit;
