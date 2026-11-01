-- Slice 12 lane db10 sweep (DEC-247): the cheap node-bound probe shared by the pattern-forest expanders.
--   platform_private.cms_pattern_expanded_root_count(owner, forest, depth) returns bigint
--     the number of block roots the forest has after its top-level nested pattern references are expanded in place (DEC-181), counted without building the
--     expansion: a top-level block is one root, a top-level nested reference is the root count of the pinned version it names, a reference below a block root
--     stays inside that root and adds none.  This is the quantity cms_pattern_placement_nodes / cms_pattern_update_nodes mark `is_root`.  The count stops as
--     soon as it passes the CMS-03C-12 bound of 512 and answers 513, so a hostile fan-out cannot make the probe walk the whole expansion; a missing nested
--     version adds none (the expander that follows raises nested_pattern_not_active itself); nesting deeper than 10 levels answers 513 (the callers prove the
--     depth bound first with cms_pattern_nested_closure).
-- Why a separate probe: re-proving the bound by expanding twice doubled the cost of every update, placement-rules and save path (AC-279 timings).
-- Private; STABLE SECURITY DEFINER with an empty search_path, owned by the CMS definer.  Forward-only.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create or replace function platform_private.cms_pattern_expanded_root_count(
  p_owner_id uuid, p_forest jsonb, p_depth integer default 1)
returns bigint
language plpgsql
stable
security definer
set search_path = ''
as $body$
declare
  item record;
  nested platform_private.cms_pattern_versions%rowtype;
  total bigint := 0;
begin
  if p_depth > 10 then
    return 513;
  end if;
  for item in select element.value as value from pg_catalog.jsonb_array_elements(p_forest) element(value) loop
    if item.value->>'kind' = 'block' then
      total := total + 1;
    else
      select * into nested
        from platform_private.cms_pattern_versions candidate
       where candidate.owner_id = p_owner_id
         and candidate.pattern_id = (item.value->>'patternId')::uuid
         and candidate.version = (item.value->>'patternVersion')::integer;
      if found then
        total := total + platform_private.cms_pattern_expanded_root_count(p_owner_id, nested.block_tree, p_depth + 1);
      end if;
    end if;
    if total > 512 then
      return 513;
    end if;
  end loop;
  return total;
end;
$body$;

comment on function platform_private.cms_pattern_expanded_root_count(uuid, jsonb, integer) is
  'DEC-247 node-bound probe: the block roots of a pattern forest after top-level nested references are expanded, counted without expanding, capped at 513 (over the CMS-03C-12 bound of 512). A missing nested version adds none; nesting past 10 levels is 513. Private.';

grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_pattern_expanded_root_count(uuid, jsonb, integer) owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function platform_private.cms_pattern_expanded_root_count(uuid, jsonb, integer)
  from public, anon, authenticated, service_role;

commit;
