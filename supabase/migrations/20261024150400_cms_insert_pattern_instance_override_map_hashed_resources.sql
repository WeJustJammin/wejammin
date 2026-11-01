-- Slice 12 lane placement-perf (defect D1, BE03c 1813: CMS-03C-02 placement of 512 rows inside the RPC < 300 ms bound).
-- The installed private placement producer is amended by 3 guarded anchored replacements (each anchor occurs exactly once
-- in the installed source; the inverse replacement restores the installed source byte for byte; every pg_proc attribute
-- except the source is unchanged):
--   1 + 2  the override entries of each placed root are aggregated once into override_by_root and joined to the roots,
--          instead of rescanning every override against every plan node for every row (rows x overrides x nodes);
--   3      each distinct content image of the inserted rows is hashed once and the rows are projected through
--          cms_composition_instance_resource_hashed (placement-perf 150300), instead of canonicalising and hashing the
--          image again for every row.
-- Behaviour, locks, checks, audit and response are unchanged.  Forward-only.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $migration$
declare
  identity constant text := 'platform_private.cms_insert_pattern_instance(jsonb)';
  original pg_catalog.pg_proc%rowtype;
  actual pg_catalog.pg_proc%rowtype;
  old_source text;
  new_source text;
  inverse_source text;
  definition text;
  comment_text text;
  i integer;
  anchors_old text[] := array[
    $old$  with roots as (
    select item.value as node_info, item.ordinality as seq
      from pg_catalog.jsonb_array_elements(v_nodes) with ordinality item(value, ordinality)
     where (item.value->>'isRoot')::boolean
  ), inserted as ($old$,
    $old$           coalesce((select pg_catalog.jsonb_object_agg(override_item.key, override_item.value)
                       from pg_catalog.jsonb_each(v_overrides) override_item
                      where exists (select 1 from pg_catalog.jsonb_array_elements(v_nodes) placed(value)
                                     where placed.value->>'chain' = override_item.key
                                       and placed.value->>'root' = root_row.node_info->>'root')), '{}'::jsonb),$old$,
    $old$      from roots root_row
    returning *
  )
  select pg_catalog.jsonb_agg(platform_private.cms_composition_instance_resource(
           row(inserted.*)::platform_private.cms_composition_instances)
         order by inserted.position)
    into v_items
    from inserted;$old$
  ];
  anchors_new text[] := array[
    $new$  with roots as (
    select item.value as node_info, item.ordinality as seq
      from pg_catalog.jsonb_array_elements(v_nodes) with ordinality item(value, ordinality)
     where (item.value->>'isRoot')::boolean
  ), override_by_root as (
    -- the override entries addressing a node of each placed root, aggregated once (not rescanned per row)
    select matched.root, pg_catalog.jsonb_object_agg(matched.key, matched.value) as props
      from (select distinct placed.value->>'root' as root, override_item.key, override_item.value
              from pg_catalog.jsonb_each(v_overrides) override_item
              join pg_catalog.jsonb_array_elements(v_nodes) placed(value)
                on placed.value->>'chain' = override_item.key) matched
     group by matched.root
  ), inserted as ($new$,
    $new$           coalesce(override_by_root.props, '{}'::jsonb),$new$,
    $new$      from roots root_row
      left join override_by_root on override_by_root.root = root_row.node_info->>'root'
    returning *
  ), imaged as (
    select inserted.position as position, image_row.inst as inst,
           platform_private.cms_composition_instance_content(image_row.inst) as content_image
      from inserted
      cross join lateral (select row(inserted.*)::platform_private.cms_composition_instances as inst) image_row
  ), hashed as materialized (
    -- each DISTINCT content image is canonicalised and hashed once; the rows of a placement share most images (materialized: the planner must not re-run the distinct pass per joined row)
    select distinct_image.content_text, platform_private.cms_jcs_sha256(distinct_image.content_image) as content_hash
      from (select distinct on (imaged.content_image::text)
                   imaged.content_image::text as content_text, imaged.content_image
              from imaged
             order by imaged.content_image::text) distinct_image
  )
  select pg_catalog.jsonb_agg(platform_private.cms_composition_instance_resource_hashed(imaged.inst, hashed.content_hash)
         order by imaged.position)
    into v_items
    from imaged
    join hashed on hashed.content_text = imaged.content_image::text;$new$
  ];
begin
  select proc.* into original from pg_catalog.pg_proc proc
   where proc.oid = pg_catalog.to_regprocedure(identity);
  if not found then
    raise exception 'placement-perf missing existing function: %', identity using errcode = '55000';
  end if;
  old_source := original.prosrc;
  comment_text := pg_catalog.obj_description(original.oid, 'pg_proc');
  if original.proowner <> 'wejammin_cms_definer'::pg_catalog.regrole
     or not original.prosecdef or original.prokind <> 'f' or original.provolatile <> 'v'
     or original.proretset or original.prorettype <> 'jsonb'::pg_catalog.regtype
     or original.proconfig is distinct from array['search_path=""']::text[]
     or original.prolang <> (select oid from pg_catalog.pg_language where lanname = 'plpgsql') then
    raise exception 'placement-perf unexpected baseline attributes: %', identity using errcode = '55000';
  end if;
  new_source := old_source;
  for i in 1 .. pg_catalog.cardinality(anchors_old) loop
    if (pg_catalog.length(new_source) - pg_catalog.length(pg_catalog.replace(new_source, anchors_old[i], '')))
         / pg_catalog.length(anchors_old[i]) <> 1
       or pg_catalog.strpos(old_source, anchors_new[i]) <> 0 then
      raise exception 'placement-perf unexpected anchor % in %', i, identity using errcode = '55000';
    end if;
    new_source := pg_catalog.replace(new_source, anchors_old[i], anchors_new[i]);
  end loop;
  inverse_source := new_source;
  for i in reverse pg_catalog.cardinality(anchors_old) .. 1 loop
    if (pg_catalog.length(inverse_source) - pg_catalog.length(pg_catalog.replace(inverse_source, anchors_new[i], '')))
         / pg_catalog.length(anchors_new[i]) <> 1 then
      raise exception 'placement-perf ambiguous inverse % in %', i, identity using errcode = '55000';
    end if;
    inverse_source := pg_catalog.replace(inverse_source, anchors_new[i], anchors_old[i]);
  end loop;
  if inverse_source is distinct from old_source then
    raise exception 'placement-perf non-anchored change in %', identity using errcode = '55000';
  end if;
  definition := pg_catalog.pg_get_functiondef(original.oid);
  if definition is null or pg_catalog.length(old_source) = 0
     or (pg_catalog.length(definition) - pg_catalog.length(pg_catalog.replace(definition, old_source, '')))
          / pg_catalog.length(old_source) <> 1 then
    raise exception 'placement-perf ambiguous definition: %', identity using errcode = '55000';
  end if;
  execute pg_catalog.replace(definition, old_source, new_source);
  select proc.* into actual from pg_catalog.pg_proc proc
   where proc.oid = pg_catalog.to_regprocedure(identity);
  if not found or actual.oid <> original.oid or actual.prosrc is distinct from new_source
     or pg_catalog.to_jsonb(actual) - 'prosrc' is distinct from pg_catalog.to_jsonb(original) - 'prosrc'
     or pg_catalog.obj_description(actual.oid, 'pg_proc') is distinct from comment_text then
    raise exception 'placement-perf replacement changed more than the source: %', identity using errcode = '55000';
  end if;
end;
$migration$;

commit;
