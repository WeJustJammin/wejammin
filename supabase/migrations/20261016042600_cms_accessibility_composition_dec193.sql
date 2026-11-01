-- DEC-193: amend only block payload lookup; preserve hash formula and loader.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $migration$
declare
  signature constant text := 'platform_private.cms_accessibility_checker_input(uuid,text)';
  original pg_catalog.pg_proc%rowtype;
  actual pg_catalog.pg_proc%rowtype;
  old_source text;
  new_source text;
  inverse_source text;
  definition text;
  comment_text text;
  n integer;
  anchors_old text[] := array[
    $a$  -- A node is its plan identity plus its payload, in plan order; the renderPlanHash covers the identities alone.
  select coalesce$a$,
    $a$'accessibleName', case when pg_catalog.jsonb_typeof(instance.props->'accessible_name') = 'string'
                                        then instance.props->>'accessible_name' end)$a$,
    $a$        left join platform_private.cms_block_definition_versions block
          on block.block_key = instance.block_key and block.block_version = instance.block_version$a$
  ];
  anchors_new text[] := array[
    $a$  -- A node is its plan identity plus its payload, in plan order; the renderPlanHash covers the identities alone.
  with composition_nodes as materialized (
    select head.id as instance_id, effective.*
      from platform_private.cms_revision_effective_composition(revision_row.id) head
      cross join lateral platform_private.cms_composition_effective_nodes(head) effective
  )
  select coalesce$a$,
    $a$'accessibleName', case when pg_catalog.jsonb_typeof(effective.effective_props->'accessible_name') = 'string'
                                        then effective.effective_props->>'accessible_name' end)$a$,
    $a$         left join composition_nodes effective
           on effective.instance_id = plan.instance_id and plan.plan_kind = 'block'
             and plan.identity->>'pointer' = '/composition/' || instance.id::text
             || case when effective.node_index = 0 then '' else '/nodes/' || effective.node_index::text end
         left join platform_private.cms_block_definition_versions block
           on block.block_key = effective.block_key and block.block_version = effective.block_version$a$
  ];
begin
  select proc.* into original from pg_catalog.pg_proc proc
   where proc.oid = pg_catalog.to_regprocedure(signature);
  if not found or original.proowner <> 'wejammin_cms_definer'::pg_catalog.regrole
     or not original.prosecdef or original.prokind <> 'f' or original.provolatile <> 's'
     or original.proretset or original.prorettype <> 'pg_catalog.jsonb'::pg_catalog.regtype
     or original.proconfig is distinct from array['search_path=""']::text[]
     or original.prolang <> (select oid from pg_catalog.pg_language where lanname = 'plpgsql') then
    raise exception 'composition checker: unexpected installed function' using errcode = '55000';
  end if;
  old_source := original.prosrc;
  new_source := old_source;
  comment_text := pg_catalog.obj_description(original.oid, 'pg_proc');
  for n in 1..pg_catalog.cardinality(anchors_old) loop
    if (pg_catalog.length(new_source) - pg_catalog.length(pg_catalog.replace(new_source, anchors_old[n], '')))
         / pg_catalog.length(anchors_old[n]) <> 1
       or pg_catalog.strpos(new_source, anchors_new[n]) <> 0 then
      raise exception 'composition checker: unexpected anchor %', n using errcode = '55000';
    end if;
    new_source := pg_catalog.replace(new_source, anchors_old[n], anchors_new[n]);
  end loop;
  inverse_source := new_source;
  for n in reverse pg_catalog.cardinality(anchors_old)..1 loop
    inverse_source := pg_catalog.replace(inverse_source, anchors_new[n], anchors_old[n]);
  end loop;
  if inverse_source is distinct from old_source then
    raise exception 'composition checker: non-anchor change' using errcode = '55000';
  end if;
  definition := pg_catalog.pg_get_functiondef(original.oid);
  if definition is null or (pg_catalog.length(definition) - pg_catalog.length(pg_catalog.replace(definition, old_source, '')))
       / pg_catalog.length(old_source) <> 1 then
    raise exception 'composition checker: ambiguous definition' using errcode = '55000';
  end if;
  execute pg_catalog.replace(definition, old_source, new_source);
  select proc.* into actual from pg_catalog.pg_proc proc where proc.oid = pg_catalog.to_regprocedure(signature);
  if not found or actual.oid <> original.oid or actual.prosrc is distinct from new_source
     or pg_catalog.to_jsonb(actual) - 'prosrc' is distinct from pg_catalog.to_jsonb(original) - 'prosrc'
     or pg_catalog.obj_description(actual.oid, 'pg_proc') is distinct from comment_text then
    raise exception 'composition checker: replacement changed more than source' using errcode = '55000';
  end if;
end;
$migration$;

commit;
