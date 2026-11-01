-- Slice 12 lane db10 sweep (DEC-247, ledger P2-S12-AC-211 "again before publish"): cms_pattern_update_nodes, the expander behind CMS-03C-14 (diff),
-- CMS-03C-15 (accept, detach), the render plan and accessibility checker read model (cms_composition_effective_nodes -> cms_pattern_root_snapshot), the restore
-- (cms_restore_composition_refs) and the DEC-210 forest rules (cms_pattern_forest_rules_violated), re-proves the CMS-03C-12 bounds before it expands: the
-- outermost call raises pattern_depth_exceeded when cms_pattern_nested_closure reaches a 9th nested level (the producer's own rule, as 20261031110000 does for
-- placement) and pattern_nodes_exceeded when the forest expands to more than 512 block roots (counted by cms_pattern_expanded_root_count, 20261031110300, without a second expansion), in strict and non-strict mode alike, at /patternId like its
-- nested_pattern_not_active.  One anchored replacement (the anchor occurs once; the inverse restores the installed source byte for byte; every pg_proc
-- attribute except the source is unchanged); the comment is restated.  Forward-only.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $migration$
declare
  identity constant text := 'platform_private.cms_pattern_update_nodes(uuid,jsonb,uuid[],boolean,text,text,integer)';
  original pg_catalog.pg_proc%rowtype;
  actual pg_catalog.pg_proc%rowtype;
  old_source text;
  new_source text;
  inverse_source text;
  definition text;
  comment_text text;
  i integer;
  anchors_old text[] := array[
    $old$  for item in
    select element.value as value$old$
  ];
  anchors_new text[] := array[
    $new$  -- DEC-247: the CMS-03C-12 bounds are re-proved on the forest before it is expanded (the outermost call only; the node bound is counted by cms_pattern_expanded_root_count, 20261031110300, without a second expansion).
  if p_depth = 1 then
    if exists (
      select 1 from platform_private.cms_pattern_nested_closure(p_owner_id, p_forest) closure
       where closure.nested_depth >= 9
    ) then
      raise exception 'pattern_depth_exceeded' using errcode = 'P0001', detail = '["/patternId"]';
    end if;
    if platform_private.cms_pattern_expanded_root_count(p_owner_id, p_forest) > 512 then
      raise exception 'pattern_nodes_exceeded' using errcode = 'P0001', detail = '["/patternId"]';
    end if;
  end if;
  for item in
    select element.value as value$new$
  ];
begin
  select proc.* into original from pg_catalog.pg_proc proc
   where proc.oid = pg_catalog.to_regprocedure(identity);
  if not found then
    raise exception 'DEC-247 missing existing function: %', identity using errcode = '55000';
  end if;
  old_source := original.prosrc;
  comment_text := pg_catalog.obj_description(original.oid, 'pg_proc');
  if original.proowner <> 'wejammin_cms_definer'::pg_catalog.regrole
     or not original.prosecdef or original.prokind <> 'f' or original.provolatile <> 's'
     or not original.proretset or original.prorettype <> 'record'::pg_catalog.regtype
     or original.proconfig is distinct from array['search_path=""']::text[]
     or original.prolang <> (select oid from pg_catalog.pg_language where lanname = 'plpgsql') then
    raise exception 'DEC-247 unexpected baseline attributes: %', identity using errcode = '55000';
  end if;
  new_source := old_source;
  for i in 1 .. pg_catalog.cardinality(anchors_old) loop
    if (pg_catalog.length(new_source) - pg_catalog.length(pg_catalog.replace(new_source, anchors_old[i], '')))
         / pg_catalog.length(anchors_old[i]) <> 1
       or pg_catalog.strpos(old_source, anchors_new[i]) <> 0 then
      raise exception 'DEC-247 unexpected anchor % in %', i, identity using errcode = '55000';
    end if;
    new_source := pg_catalog.replace(new_source, anchors_old[i], anchors_new[i]);
  end loop;
  inverse_source := new_source;
  for i in reverse pg_catalog.cardinality(anchors_old) .. 1 loop
    if (pg_catalog.length(inverse_source) - pg_catalog.length(pg_catalog.replace(inverse_source, anchors_new[i], '')))
         / pg_catalog.length(anchors_new[i]) <> 1 then
      raise exception 'DEC-247 ambiguous inverse % in %', i, identity using errcode = '55000';
    end if;
    inverse_source := pg_catalog.replace(inverse_source, anchors_new[i], anchors_old[i]);
  end loop;
  if inverse_source is distinct from old_source then
    raise exception 'DEC-247 non-anchored change in %', identity using errcode = '55000';
  end if;
  definition := pg_catalog.pg_get_functiondef(original.oid);
  if definition is null or pg_catalog.length(old_source) = 0
     or (pg_catalog.length(definition) - pg_catalog.length(pg_catalog.replace(definition, old_source, '')))
          / pg_catalog.length(old_source) <> 1 then
    raise exception 'DEC-247 ambiguous definition: %', identity using errcode = '55000';
  end if;
  execute pg_catalog.replace(definition, old_source, new_source);
  select proc.* into actual from pg_catalog.pg_proc proc
   where proc.oid = pg_catalog.to_regprocedure(identity);
  if not found or actual.oid <> original.oid or actual.prosrc is distinct from new_source
     or pg_catalog.to_jsonb(actual) - 'prosrc' is distinct from pg_catalog.to_jsonb(original) - 'prosrc'
     or pg_catalog.obj_description(actual.oid, 'pg_proc') is distinct from comment_text then
    raise exception 'DEC-247 replacement changed more than the source: %', identity using errcode = '55000';
  end if;
end;
$migration$;

comment on function platform_private.cms_pattern_update_nodes(uuid, jsonb, uuid[], boolean, text, text, integer) is
  'CMS-03C-14/15 (DEC-181, DEC-186, DEC-247): every block node of a pattern version forest in forest order with its key chain and the chain of the block root it lies under, nested references expanded in place; strict requires nested versions active (the target), non-strict only existing (the pinned base of an instance). The outermost call re-proves the CMS-03C-12 bounds first: a 9th nested level is pattern_depth_exceeded, more than 512 expanded block roots pattern_nodes_exceeded, both at /patternId. Private.';

commit;
