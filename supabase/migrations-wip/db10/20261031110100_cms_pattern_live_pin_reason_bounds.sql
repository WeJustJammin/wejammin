-- Slice 12 lane db10 (DEC-247, BE03c 1585 and 1678 "again before publish"; ledger P2-S12-AC-211): the live pattern pin's publication
-- reason re-proves the CMS-03C-12 bounds on the pinned forest.  After root activity and nested activity/containment (and before the
-- content-hash and registry-digest checks) a pinned version that reaches a 9th nested level answers pattern_depth_exceeded, and one that
-- expands to more than 512 block roots answers pattern_nodes_exceeded.  The depth rule is the producer's own (cms_pattern_nested_closure
-- depth >= 9); the roots are those cms_pattern_placement_nodes expands (the node count CMS-03C-02 refuses).
-- The installed private function is amended by 1 guarded anchored replacement: the anchor occurs exactly once in the installed
-- source, the inverse replacement restores the installed source byte for byte, and every pg_proc attribute except the source (owner,
-- security mode, search_path, ACL) is unchanged.  The comment is restated.  Forward-only.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $migration$
declare
  identity constant text := 'platform_private.cms_pattern_live_pin_reason(uuid,uuid,integer,text)';
  original pg_catalog.pg_proc%rowtype;
  actual pg_catalog.pg_proc%rowtype;
  old_source text;
  new_source text;
  inverse_source text;
  definition text;
  i integer;
  anchors_old text[] := array[
    $old$  current_digest := platform_private.cms_pattern_registry_digest_readonly(
    p_owner_id, root_row.block_tree);$old$
  ];
  anchors_new text[] := array[
    $new$  -- DEC-247: the CMS-03C-12 bounds are re-proved on the live pin's expanded forest before publish.  The activity checks above
  -- hold, so the expansion below cannot meet an inactive or missing version.
  if exists (
    select 1 from platform_private.cms_pattern_nested_closure(p_owner_id, root_row.block_tree) closure
     where closure.nested_depth >= 9
  ) then
    return 'pattern_depth_exceeded';
  end if;
  if (select pg_catalog.count(*) filter (where expanded.is_root)
        from platform_private.cms_pattern_placement_nodes(p_owner_id, root_row.block_tree,
               array[root_row.pattern_id]) expanded) > 512 then
    return 'pattern_nodes_exceeded';
  end if;

  current_digest := platform_private.cms_pattern_registry_digest_readonly(
    p_owner_id, root_row.block_tree);$new$
  ];
begin
  select proc.* into original from pg_catalog.pg_proc proc
   where proc.oid = pg_catalog.to_regprocedure(identity);
  if not found then
    raise exception 'DEC-247 missing existing function: %', identity using errcode = '55000';
  end if;
  old_source := original.prosrc;
  if original.proowner <> 'wejammin_cms_definer'::pg_catalog.regrole
     or original.prosecdef or original.prokind <> 'f' or original.provolatile <> 's'
     or original.proretset or original.prorettype <> 'text'::pg_catalog.regtype
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
     or pg_catalog.to_jsonb(actual) - 'prosrc' is distinct from pg_catalog.to_jsonb(original) - 'prosrc' then
    raise exception 'DEC-247 replacement changed more than the source: %', identity using errcode = '55000';
  end if;
end;
$migration$;

comment on function platform_private.cms_pattern_live_pin_reason(uuid, uuid, integer, text) is
  'DEC-199 live pin gate (DEC-247): root activity, recursive nested activity and existing immediate parent type containment precede the re-proved CMS-03C-12 bounds (nesting below 9 levels, at most 512 expanded block roots) and then the root content-hash and reachable registry-digest checks. Returns only pattern_not_active, nested_pattern_not_active, pattern_depth_exceeded, pattern_nodes_exceeded, pattern_digest_changed, or NULL. Private.';

commit;
