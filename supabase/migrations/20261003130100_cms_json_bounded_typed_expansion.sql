-- Slice 09 (Codex review of 20261003100000, AC217): cms_json_bounded expanded
-- every node of its walk with jsonb_each / jsonb_array_elements and relied on a
-- WHERE qual (`jsonb_typeof(node) = 'object'`) to keep those set-returning
-- functions away from the wrong container type.  A qual is not a guard: the
-- planner may order it after the call, and jsonb_each on an array or a scalar
-- (jsonb_array_elements on an object, jsonb_object_keys on an array,
-- jsonb_array_length on an object) raises.  The walk now branches on
-- jsonb_typeof with CASE, so each function only ever receives its own container
-- type: an object is expanded with jsonb_each, an array with
-- jsonb_array_elements, and every other node expands to an empty set; the bound
-- checks read keys and elements only inside the matching CASE branch.  The
-- signature, volatility and every answer are unchanged (the equivalence suite
-- phase_02_slice_09_canonical_json_equivalence holds it to the reference
-- implementation).  Forward-only.
begin;

create or replace function platform_private.cms_json_bounded(
  p_value jsonb,
  p_max_bytes integer default 8192,
  p_max_depth integer default 8,
  p_max_keys integer default 128,
  p_max_array integer default 128
)
returns boolean
language plpgsql
immutable
set search_path = ''
as $body$
begin
  if p_value is null or pg_catalog.octet_length(p_value::text) > p_max_bytes then
    return false;
  end if;
  if pg_catalog.jsonb_typeof(p_value) not in ('object', 'array') then
    return true;
  end if;
  -- One walk of the document, pruned at the depth bound.  A container at nesting
  -- level L (root is level 0) makes the document L + 1 levels deep, so the depth
  -- bound is exceeded exactly when a container exists at level p_max_depth or
  -- deeper; every object and array on the walk is checked against its own bound.
  return not exists (
    with recursive walk(node, level) as (
      select p_value, 0
      union all
      select child.value, walk.level + 1
        from walk
        cross join lateral (
          select entry.value
            from pg_catalog.jsonb_each(
              case when pg_catalog.jsonb_typeof(walk.node) = 'object'
                   then walk.node else '{}'::pg_catalog.jsonb end) entry
          union all
          select element.value
            from pg_catalog.jsonb_array_elements(
              case when pg_catalog.jsonb_typeof(walk.node) = 'array'
                   then walk.node else '[]'::pg_catalog.jsonb end) element
        ) child
       where walk.level <= p_max_depth
    )
    select 1
      from walk
     where case pg_catalog.jsonb_typeof(walk.node)
             when 'object' then
               walk.level >= p_max_depth
               or (select pg_catalog.count(*)
                     from pg_catalog.jsonb_object_keys(walk.node)) > p_max_keys
             when 'array' then
               walk.level >= p_max_depth
               or pg_catalog.jsonb_array_length(walk.node) > p_max_array
             else false
           end
  );
end;
$body$;

commit;
