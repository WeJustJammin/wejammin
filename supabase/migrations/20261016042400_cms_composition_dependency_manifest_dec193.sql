-- DEC-193: amend only the installed manifest's composition block/provenance reads.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $migration$
declare
  signature constant text := 'platform_private.cms_build_dependency_manifest(uuid)';
  original pg_catalog.pg_proc%rowtype;
  actual pg_catalog.pg_proc%rowtype;
  old_source text;
  new_source text;
  inverse_source text;
  definition text;
  comment_text text;
  n integer;
  anchors_old text[] := array[
    $a$  select distinct instance.block_key, instance.block_version::integer
    from platform_private.cms_composition_instances instance
   where instance.revision_id = revision_row.id
     and instance.state in ('draft', 'active', 'pending_diff')$a$,
    $a$        from platform_private.cms_composition_instances instance
        join platform_private.cms_pattern_versions pattern
          on pattern.pattern_id = instance.pattern_id
         and pattern.version = instance.pattern_version
         and pattern.owner_id = instance.owner_id
       where instance.revision_id = revision_row.id
         and instance.state in ('draft', 'active', 'pending_diff')$a$
  ];
  anchors_new text[] := array[
    $a$   select distinct effective.block_key, effective.block_version::integer
     from platform_private.cms_revision_effective_composition(revision_row.id) instance
     cross join lateral platform_private.cms_composition_effective_nodes(instance) effective$a$,
    $a$         from platform_private.cms_revision_effective_composition(revision_row.id) instance
         join platform_private.cms_pattern_versions pattern
           on pattern.owner_id = instance.owner_id and pattern.pattern_id = instance.pattern_id
          and pattern.version = instance.pattern_version$a$
  ];
begin
  select proc.* into original from pg_catalog.pg_proc proc
   where proc.oid = pg_catalog.to_regprocedure(signature);
  if not found or original.proowner <> 'wejammin_cms_definer'::pg_catalog.regrole
     or not original.prosecdef or original.prokind <> 'f' or original.provolatile <> 'v'
     or original.proretset or original.prorettype <> 'pg_catalog.jsonb'::pg_catalog.regtype
     or original.proconfig is distinct from array['search_path=""']::text[]
     or original.prolang <> (select oid from pg_catalog.pg_language where lanname = 'plpgsql') then
    raise exception 'composition manifest: unexpected installed function' using errcode = '55000';
  end if;
  old_source := original.prosrc;
  new_source := old_source;
  comment_text := pg_catalog.obj_description(original.oid, 'pg_proc');
  for n in 1..pg_catalog.cardinality(anchors_old) loop
    if (pg_catalog.length(new_source) - pg_catalog.length(pg_catalog.replace(new_source, anchors_old[n], '')))
         / pg_catalog.length(anchors_old[n]) <> 1
       or pg_catalog.strpos(new_source, anchors_new[n]) <> 0 then
      raise exception 'composition manifest: unexpected anchor %', n using errcode = '55000';
    end if;
    new_source := pg_catalog.replace(new_source, anchors_old[n], anchors_new[n]);
  end loop;
  inverse_source := new_source;
  for n in reverse pg_catalog.cardinality(anchors_old)..1 loop
    inverse_source := pg_catalog.replace(inverse_source, anchors_new[n], anchors_old[n]);
  end loop;
  if inverse_source is distinct from old_source then
    raise exception 'composition manifest: non-anchor change' using errcode = '55000';
  end if;
  definition := pg_catalog.pg_get_functiondef(original.oid);
  if definition is null or (pg_catalog.length(definition) - pg_catalog.length(pg_catalog.replace(definition, old_source, '')))
       / pg_catalog.length(old_source) <> 1 then
    raise exception 'composition manifest: ambiguous definition' using errcode = '55000';
  end if;
  execute pg_catalog.replace(definition, old_source, new_source);
  select proc.* into actual from pg_catalog.pg_proc proc where proc.oid = pg_catalog.to_regprocedure(signature);
  if not found or actual.oid <> original.oid or actual.prosrc is distinct from new_source
     or pg_catalog.to_jsonb(actual) - 'prosrc' is distinct from pg_catalog.to_jsonb(original) - 'prosrc'
     or pg_catalog.obj_description(actual.oid, 'pg_proc') is distinct from comment_text then
    raise exception 'composition manifest: replacement changed more than source' using errcode = '55000';
  end if;
end;
$migration$;

commit;
