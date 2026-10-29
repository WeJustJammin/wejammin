-- Slice 12 lane web-impl (DEC-228; BE03c field matrix CMS-03C-12 `blockTree` row, 1525; FE03 885; P2-S12-AC-105): the cycle, depth
-- and node-count refusals of CMS-03C-12 name the offending request node's /blockTree/{i}(/children/{j})* pointer in the
-- DETAIL instead of the root /blockTree.  The tokens and statuses are unchanged; the pointers come from the helpers of
-- 20261024140000.
-- The installed private function is amended by 4 guarded anchored replacement(s): each anchor occurs exactly once in
-- the installed source, the inverse replacement restores the installed source byte for byte, and every pg_proc
-- attribute except the source (owner, SECURITY DEFINER, search_path, ACL, comment) is unchanged.  Forward-only.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $migration$
declare
  identity constant text := 'platform_private.cms_create_pattern_version(jsonb)';
  original pg_catalog.pg_proc%rowtype;
  actual pg_catalog.pg_proc%rowtype;
  old_source text;
  new_source text;
  inverse_source text;
  definition text;
  comment_text text;
  i integer;
  anchors_old text[] := array[
    $old$    raise exception '%', v_token using errcode = 'P0001', detail = '["/blockTree"]';$old$,
    $old$    raise exception 'pattern_cycle' using errcode = 'P0001', detail = '["/blockTree"]';$old$,
    $old$    raise exception 'pattern_depth_exceeded' using errcode = 'P0001', detail = '["/blockTree"]';$old$,
    $old$    raise exception 'pattern_nodes_exceeded' using errcode = 'P0001', detail = '["/blockTree"]';$old$
  ];
  anchors_new text[] := array[
    $new$    -- DEC-228: a literal depth or node-count refusal names the offending request node, not the root.
    raise exception '%', v_token using errcode = 'P0001', detail = case v_token
      when 'pattern_depth_exceeded' then
        pg_catalog.jsonb_build_array(platform_private.cms_pattern_depth_offender(v_tree))::text
      when 'pattern_nodes_exceeded' then
        pg_catalog.jsonb_build_array(platform_private.cms_pattern_count_offender(v_party_id, v_tree))::text
      else '["/blockTree"]' end;$new$,
    $new$    raise exception 'pattern_cycle' using errcode = 'P0001',
      detail = pg_catalog.jsonb_build_array(
        platform_private.cms_pattern_cycle_offender(v_party_id, v_tree, v_lineage_id))::text;$new$,
    $new$    raise exception 'pattern_depth_exceeded' using errcode = 'P0001',
      detail = pg_catalog.jsonb_build_array(platform_private.cms_pattern_chain_offender(v_party_id, v_tree))::text;$new$,
    $new$    raise exception 'pattern_nodes_exceeded' using errcode = 'P0001',
      detail = pg_catalog.jsonb_build_array(platform_private.cms_pattern_count_offender(v_party_id, v_tree))::text;$new$
  ];
begin
  select proc.* into original from pg_catalog.pg_proc proc
   where proc.oid = pg_catalog.to_regprocedure(identity);
  if not found then
    raise exception 'DEC-228 missing existing function: %', identity using errcode = '55000';
  end if;
  old_source := original.prosrc;
  comment_text := pg_catalog.obj_description(original.oid, 'pg_proc');
  if original.proowner <> 'wejammin_cms_definer'::pg_catalog.regrole
     or not original.prosecdef or original.prokind <> 'f' or original.provolatile <> 'v'
     or original.proretset or original.prorettype <> 'jsonb'::pg_catalog.regtype
     or original.proconfig is distinct from array['search_path=""']::text[]
     or original.prolang <> (select oid from pg_catalog.pg_language where lanname = 'plpgsql') then
    raise exception 'DEC-228 unexpected baseline attributes: %', identity using errcode = '55000';
  end if;
  new_source := old_source;
  for i in 1 .. pg_catalog.cardinality(anchors_old) loop
    if (pg_catalog.length(new_source) - pg_catalog.length(pg_catalog.replace(new_source, anchors_old[i], '')))
         / pg_catalog.length(anchors_old[i]) <> 1
       or pg_catalog.strpos(old_source, anchors_new[i]) <> 0 then
      raise exception 'DEC-228 unexpected anchor % in %', i, identity using errcode = '55000';
    end if;
    new_source := pg_catalog.replace(new_source, anchors_old[i], anchors_new[i]);
  end loop;
  inverse_source := new_source;
  for i in reverse pg_catalog.cardinality(anchors_old) .. 1 loop
    if (pg_catalog.length(inverse_source) - pg_catalog.length(pg_catalog.replace(inverse_source, anchors_new[i], '')))
         / pg_catalog.length(anchors_new[i]) <> 1 then
      raise exception 'DEC-228 ambiguous inverse % in %', i, identity using errcode = '55000';
    end if;
    inverse_source := pg_catalog.replace(inverse_source, anchors_new[i], anchors_old[i]);
  end loop;
  if inverse_source is distinct from old_source then
    raise exception 'DEC-228 non-anchored change in %', identity using errcode = '55000';
  end if;
  definition := pg_catalog.pg_get_functiondef(original.oid);
  if definition is null or pg_catalog.length(old_source) = 0
     or (pg_catalog.length(definition) - pg_catalog.length(pg_catalog.replace(definition, old_source, '')))
          / pg_catalog.length(old_source) <> 1 then
    raise exception 'DEC-228 ambiguous definition: %', identity using errcode = '55000';
  end if;
  execute pg_catalog.replace(definition, old_source, new_source);
  select proc.* into actual from pg_catalog.pg_proc proc
   where proc.oid = pg_catalog.to_regprocedure(identity);
  if not found or actual.oid <> original.oid or actual.prosrc is distinct from new_source
     or pg_catalog.to_jsonb(actual) - 'prosrc' is distinct from pg_catalog.to_jsonb(original) - 'prosrc'
     or pg_catalog.obj_description(actual.oid, 'pg_proc') is distinct from comment_text then
    raise exception 'DEC-228 replacement changed more than the source: %', identity using errcode = '55000';
  end if;
end;
$migration$;

commit;
