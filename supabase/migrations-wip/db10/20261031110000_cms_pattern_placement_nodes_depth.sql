-- Slice 12 lane db10 (DEC-247, BE03c CMS-03C-02 graph/blockRegistryDigest row and 1678 "again before publish"; ledger P2-S12-AC-211):
-- CMS-03C-02 placement re-proves the CMS-03C-12 nesting-depth bound on the pinned forest.  A 9th nested level is
-- 422 pattern_depth_exceeded at /patternId.  The rule is the producer's own: cms_pattern_nested_closure depth >= 9
-- (cms_create_pattern_version, 20261014020400), applied once to the forest the expansion starts from, so it is not a second copy of the bound.
-- The 512 expanded-root bound is already re-proved by the placement plans (pattern_nodes_exceeded at /patternId).
--
-- cms_pattern_placement_nodes is the single expander every placement plan (cms_pattern_placement_plan and
-- cms_pattern_placement_selected_plan) calls, so one anchored replacement covers both.  The installed private function is amended by
-- 1 guarded anchored replacement: the anchor occurs exactly once in the installed source, the inverse replacement restores the installed
-- source byte for byte, and every pg_proc attribute except the source (owner, security mode, search_path, ACL) is unchanged.  The comment is
-- restated.  Forward-only.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $migration$
declare
  identity constant text := 'platform_private.cms_pattern_placement_nodes(uuid,jsonb,uuid[],text,text,integer)';
  original pg_catalog.pg_proc%rowtype;
  actual pg_catalog.pg_proc%rowtype;
  old_source text;
  new_source text;
  inverse_source text;
  definition text;
  i integer;
  anchors_old text[] := array[
    $old$  for item in
    select element.value as value$old$
  ];
  anchors_new text[] := array[
    $new$  -- DEC-247: the CMS-03C-12 nesting bound is re-proved on the pinned forest before it is expanded (the outermost call only;
  -- the closure already covers every level below): a 9th nested level is pattern_depth_exceeded, the producer's own rule.
  if p_depth = 1 and exists (
    select 1 from platform_private.cms_pattern_nested_closure(p_owner_id, p_forest) closure
     where closure.nested_depth >= 9
  ) then
    raise exception 'pattern_depth_exceeded' using errcode = 'P0001', detail = '["/patternId"]';
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
     or pg_catalog.to_jsonb(actual) - 'prosrc' is distinct from pg_catalog.to_jsonb(original) - 'prosrc' then
    raise exception 'DEC-247 replacement changed more than the source: %', identity using errcode = '55000';
  end if;
end;
$migration$;

comment on function platform_private.cms_pattern_placement_nodes(uuid, jsonb, uuid[], text, text, integer) is
  'CMS-03C-02 (DEC-175, DEC-181, DEC-186, DEC-247): every block node of a pinned pattern forest in forest order with its key chain and the chain of the block root it lies under; a top-level nested pattern reference is replaced in place by the nested pinned forest, so its key leads the chain; reference nodes are never returned. Nested versions must be active, lineages acyclic, and the nesting within the CMS-03C-12 bound (cms_pattern_nested_closure depth below 9, else pattern_depth_exceeded). Private.';

commit;
