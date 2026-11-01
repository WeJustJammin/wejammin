-- DEC-193: retain the installed six-column plan and every field derivation.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $migration$
declare
  signature constant text := 'platform_private.cms_revision_render_plan(uuid)';
  original pg_catalog.pg_proc%rowtype;
  actual pg_catalog.pg_proc%rowtype;
  old_source text;
  new_source text;
  inverse_source text;
  definition text;
  comment_text text;
  n integer;
  anchors_old text[] := array[
    $a$stored.stable_field_id as sort_id, 0 as member_no$a$,
    $a$    select 0, stored.editor_position, stored.field_key, stored.stable_field_id,
           declared.ordinality::integer$a$,
    $a$    -- a live composition instance, by template slot, path and id
    select 1,
           case when revision_item.template_version_id is null then 0 else coalesce((
             select slot.ordinality::integer
               from pg_catalog.jsonb_array_elements(template_item.slots) with ordinality slot(value, ordinality)
              where slot.value->>'key' = instance.slot_key
           ), 100000) end,
           instance.path::text, instance.id, 0, 'block', null::uuid, null::text, instance.id,
           pg_catalog.jsonb_build_object('kind', 'block',
             'pointer', '/composition/' || instance.id::text,
             'blockKey', instance.block_key,
             'blockVersion', instance.block_version::integer)
      from revision_item
      cross join template_item
      join platform_private.cms_composition_instances instance on instance.revision_id = revision_item.id
     where instance.state in ('draft', 'active')$a$,
    $a$order by planned.region_no, planned.rank_no, planned.sort_text collate "C", planned.sort_id, planned.member_no$a$
  ];
  anchors_new text[] := array[
    $a$stored.stable_field_id as sort_id, 0 as composition_position, 0 as member_no$a$,
    $a$    select 0, stored.editor_position, stored.field_key, stored.stable_field_id,
           0, declared.ordinality::integer$a$,
    $a$    -- DEC-193: selected heads, authored position, canonical node preorder.
    select 1,
           case when revision_item.template_version_id is null then 0 else coalesce((
             select slot.ordinality::integer
               from pg_catalog.jsonb_array_elements(template_item.slots) with ordinality slot(value, ordinality)
              where slot.value->>'key' = instance.slot_key
           ), 100000) end,
           instance.path::text, instance.id, instance.position, effective.node_index,
           'block', null::uuid, null::text, instance.id,
           pg_catalog.jsonb_build_object('kind', 'block',
             'pointer', '/composition/' || instance.id::text || case when effective.node_index = 0 then ''
               else '/nodes/' || effective.node_index::text end,
             'blockKey', effective.block_key,
             'blockVersion', effective.block_version::integer)
      from revision_item
      cross join template_item
      cross join lateral platform_private.cms_revision_effective_composition(revision_item.id) instance
      cross join lateral platform_private.cms_composition_effective_nodes(instance) effective$a$,
    $a$order by planned.region_no, planned.rank_no, planned.composition_position, planned.sort_text collate "C", planned.sort_id, planned.member_no$a$
  ];
begin
  select proc.* into original from pg_catalog.pg_proc proc
   where proc.oid = pg_catalog.to_regprocedure(signature);
  if not found or original.proowner <> 'wejammin_cms_definer'::pg_catalog.regrole
     or not original.prosecdef or original.prokind <> 'f' or original.provolatile <> 's'
     or not original.proretset or original.prorettype <> 'pg_catalog.record'::pg_catalog.regtype
     or original.proconfig is distinct from array['search_path=""']::text[]
     or original.prolang <> (select oid from pg_catalog.pg_language where lanname = 'sql') then
    raise exception 'composition render plan: unexpected installed function' using errcode = '55000';
  end if;
  old_source := original.prosrc;
  new_source := old_source;
  comment_text := pg_catalog.obj_description(original.oid, 'pg_proc');
  for n in 1..pg_catalog.cardinality(anchors_old) loop
    if (pg_catalog.length(new_source) - pg_catalog.length(pg_catalog.replace(new_source, anchors_old[n], '')))
         / pg_catalog.length(anchors_old[n]) <> 1
       or pg_catalog.strpos(new_source, anchors_new[n]) <> 0 then
      raise exception 'composition render plan: unexpected anchor %', n using errcode = '55000';
    end if;
    new_source := pg_catalog.replace(new_source, anchors_old[n], anchors_new[n]);
  end loop;
  inverse_source := new_source;
  for n in reverse pg_catalog.cardinality(anchors_old)..1 loop
    inverse_source := pg_catalog.replace(inverse_source, anchors_new[n], anchors_old[n]);
  end loop;
  if inverse_source is distinct from old_source then
    raise exception 'composition render plan: non-anchor change' using errcode = '55000';
  end if;
  definition := pg_catalog.pg_get_functiondef(original.oid);
  if definition is null or (pg_catalog.length(definition) - pg_catalog.length(pg_catalog.replace(definition, old_source, '')))
       / pg_catalog.length(old_source) <> 1 then
    raise exception 'composition render plan: ambiguous definition' using errcode = '55000';
  end if;
  execute pg_catalog.replace(definition, old_source, new_source);
  select proc.* into actual from pg_catalog.pg_proc proc where proc.oid = pg_catalog.to_regprocedure(signature);
  if not found or actual.oid <> original.oid or actual.prosrc is distinct from new_source
     or pg_catalog.to_jsonb(actual) - 'prosrc' is distinct from pg_catalog.to_jsonb(original) - 'prosrc'
     or pg_catalog.obj_description(actual.oid, 'pg_proc') is distinct from comment_text then
    raise exception 'composition render plan: replacement changed more than source' using errcode = '55000';
  end if;
end;
$migration$;

commit;
