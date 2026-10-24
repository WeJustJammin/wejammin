-- DEC-193: compare the newest immutable composition row before state filtering.
-- DEC-198: pending heads still render pinned B and remain visible to D5, so the eligibility predicate is `active` or `pending_diff`.
-- Preserve the installed reader source, attributes, owner, ACL, and comment.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $migration$
declare
  identity constant text := 'platform_private.cms_list_revisions(jsonb)';
  original pg_catalog.pg_proc%rowtype;
  actual pg_catalog.pg_proc%rowtype;
  old_source text;
  new_source text;
  definition text;
  comment_text text;
  anchor_old constant text :=
    $old$  -- Block side map: JCS hash of the locked {blockKey, blockVersion,
  -- blockRegistryDigest, mode, patternRef, props, bindings} input, keyed by the
  -- composition instance path.  The registry digest and bindings are folded
  -- into the digest; no target identity is ever included.  Two active
  -- instances on one path would silently collapse into one map entry, and a
  -- path whose /blocks/<path> pointer cannot fit the 256-character JsonPointer
  -- contract could never be returned intact, so each is a non-disclosing
  -- refusal rather than a hidden or truncated change.
  if exists (
       select 1
       from platform_private.cms_composition_instances instance
       where instance.revision_id in (left_id, right_id)
         and instance.state = 'active'
       group by instance.revision_id, instance.path
       having pg_catalog.count(*) > 1
     )
     or exists (
       select 1
       from platform_private.cms_composition_instances instance
       where instance.revision_id in (left_id, right_id)
         and instance.state = 'active'
         and pg_catalog.octet_length('/blocks/' || instance.path) > 256
     ) then
    raise exception 'comparison_unavailable' using errcode = 'P0001';
  end if;
  select
    coalesce(pg_catalog.jsonb_object_agg(block_side.path, block_side.side_hash)
      filter (where block_side.revision_id = left_id), '{}'::jsonb),
    coalesce(pg_catalog.jsonb_object_agg(block_side.path, block_side.side_hash)
      filter (where block_side.revision_id = right_id), '{}'::jsonb)
  into left_blocks, right_blocks
  from (
    select instance.revision_id,
           '/blocks/' || instance.path as path,
           platform_private.cms_jcs_sha256(pg_catalog.jsonb_build_object(
             'blockKey', instance.block_key,
             'blockVersion', instance.block_version,
             'blockRegistryDigest',
               pg_catalog.btrim(instance.block_registry_digest::text),
             'mode', instance.link_mode,
             'patternRef', case
               when instance.pattern_id is null then null
               else pg_catalog.jsonb_build_object(
                 'patternId', instance.pattern_id,
                 'patternVersion', instance.pattern_version
               )
             end,
             'props', instance.props,
             'bindings', instance.bindings
           )) as side_hash
    from platform_private.cms_composition_instances instance
    where instance.revision_id in (left_id, right_id)
      and instance.state = 'active'
  ) block_side;$old$;
  anchor_new constant text :=
    $new$  -- DEC-193 effective D5 heads precede live-state eligibility.
  if exists (
    with latest as materialized (
      select distinct on (instance.revision_id, instance.path)
             instance.id, instance.revision_id, instance.path, instance.version,
             instance.state
        from platform_private.cms_composition_instances instance
       where instance.revision_id in (left_id, right_id)
       order by instance.revision_id, instance.path,
                instance.version desc, instance.id desc
    )
    select 1
      from latest
     where latest.state in ('active', 'pending_diff')
       and pg_catalog.octet_length('/blocks/' || latest.path) > 256
  ) then
    raise exception 'comparison_unavailable' using errcode = 'P0001';
  end if;
  select
    coalesce(pg_catalog.jsonb_object_agg(block_side.path, block_side.side_hash)
      filter (where block_side.revision_id = left_id), '{}'::jsonb),
    coalesce(pg_catalog.jsonb_object_agg(block_side.path, block_side.side_hash)
      filter (where block_side.revision_id = right_id), '{}'::jsonb)
  into left_blocks, right_blocks
  from (
    with latest as materialized (
      select distinct on (instance.revision_id, instance.path)
             instance.id, instance.revision_id, instance.path, instance.version,
             instance.state
        from platform_private.cms_composition_instances instance
       where instance.revision_id in (left_id, right_id)
       order by instance.revision_id, instance.path,
                instance.version desc, instance.id desc
    )
    select instance.revision_id,
           '/blocks/' || instance.path as path,
           platform_private.cms_jcs_sha256(
             platform_private.cms_composition_instance_content(instance)
           ) as side_hash
      from latest
      join platform_private.cms_composition_instances instance
        on instance.id = latest.id
     where latest.state in ('active', 'pending_diff')
  ) block_side;$new$;
begin
  select proc.* into original from pg_catalog.pg_proc proc
   where proc.oid = pg_catalog.to_regprocedure(identity);
  if not found then
    raise exception 'D5 comparison reader missing: %', identity using errcode = '55000';
  end if;
  old_source := original.prosrc;
  comment_text := pg_catalog.obj_description(original.oid, 'pg_proc');
  if original.proowner <> 'wejammin_cms_definer'::pg_catalog.regrole
     or not original.prosecdef or original.prokind <> 'f' or original.provolatile <> 'v'
     or original.proretset or original.prorettype <> 'pg_catalog.jsonb'::pg_catalog.regtype
     or original.proconfig is distinct from array['search_path=""']::text[]
     or original.prolang <> (select oid from pg_catalog.pg_language where lanname = 'plpgsql') then
    raise exception 'D5 comparison reader: unexpected attributes' using errcode = '55000';
  end if;
  if (pg_catalog.length(old_source) - pg_catalog.length(pg_catalog.replace(old_source, anchor_old, '')))
       / pg_catalog.length(anchor_old) <> 1
     or pg_catalog.strpos(old_source, 'DEC-193 effective D5 heads') <> 0 then
    raise exception 'D5 comparison reader: unexpected block anchor' using errcode = '55000';
  end if;
  new_source := pg_catalog.replace(old_source, anchor_old, anchor_new);
  if pg_catalog.replace(new_source, anchor_new, anchor_old) is distinct from old_source then
    raise exception 'D5 comparison reader: non-anchor change' using errcode = '55000';
  end if;
  definition := pg_catalog.pg_get_functiondef(original.oid);
  if definition is null
     or (pg_catalog.length(definition) - pg_catalog.length(pg_catalog.replace(definition, old_source, '')))
       / pg_catalog.length(old_source) <> 1 then
    raise exception 'D5 comparison reader: ambiguous definition' using errcode = '55000';
  end if;
  execute pg_catalog.replace(definition, old_source, new_source);
  select proc.* into actual from pg_catalog.pg_proc proc
   where proc.oid = pg_catalog.to_regprocedure(identity);
  if not found or actual.oid <> original.oid or actual.prosrc is distinct from new_source
     or pg_catalog.to_jsonb(actual) - 'prosrc' is distinct from pg_catalog.to_jsonb(original) - 'prosrc'
     or pg_catalog.obj_description(actual.oid, 'pg_proc') is distinct from comment_text then
    raise exception 'D5 comparison reader: replacement changed more than the source' using errcode = '55000';
  end if;
end;
$migration$;

commit;
