-- Slice 09 (AC217; R12 holdover): the shared JSON bound check and the RFC 8785
-- canonical serializer become single-pass.  cms_json_bounded recomputed the
-- depth of every nested node at every level and re-recursed into each child, so
-- the 512 KiB compiled-artifact CHECK of a 128-field definition cost about 50 ms
-- per row write; cms_jcs accumulated its output by repeated string
-- concatenation with one recursive call per scalar.  Both keep their exact
-- signatures and results (the equivalence is asserted by the
-- phase_02_slice_09_canonical_json_equivalence pgTAP suite against a verbatim
-- copy of the previous implementation), so every stored hash and every CHECK
-- keeps its meaning.  Forward-only.
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
            from pg_catalog.jsonb_each(walk.node) entry
           where pg_catalog.jsonb_typeof(walk.node) = 'object'
          union all
          select element.value
            from pg_catalog.jsonb_array_elements(walk.node) element
           where pg_catalog.jsonb_typeof(walk.node) = 'array'
        ) child
       where pg_catalog.jsonb_typeof(walk.node) in ('object', 'array')
         and walk.level <= p_max_depth
    )
    select 1
      from walk
     where pg_catalog.jsonb_typeof(walk.node) in ('object', 'array')
       and (walk.level >= p_max_depth
         or (pg_catalog.jsonb_typeof(walk.node) = 'object'
             and (select pg_catalog.count(*) from pg_catalog.jsonb_object_keys(walk.node)) > p_max_keys)
         or (pg_catalog.jsonb_typeof(walk.node) = 'array'
             and pg_catalog.jsonb_array_length(walk.node) > p_max_array))
  );
end;
$body$;

create or replace function platform_private.cms_jcs(p_value jsonb)
returns text
language plpgsql
stable
strict
set search_path = ''
as $body$
declare
  value_type text := pg_catalog.jsonb_typeof(p_value);
begin
  if value_type in ('null', 'boolean', 'string') then
    return p_value::text;
  end if;
  if value_type = 'number' then
    return platform_private.cms_jcs_number(p_value);
  end if;
  if value_type = 'array' then
    return '[' || coalesce((
      select pg_catalog.string_agg(
        case pg_catalog.jsonb_typeof(element.value)
          when 'object' then platform_private.cms_jcs(element.value)
          when 'array' then platform_private.cms_jcs(element.value)
          when 'number' then platform_private.cms_jcs_number(element.value)
          else element.value::text
        end, ',' order by element.ordinality)
      from pg_catalog.jsonb_array_elements(p_value) with ordinality as element(value, ordinality)
    ), '') || ']';
  end if;
  return '{' || coalesce((
    select pg_catalog.string_agg(
      member.key_text || ':' || case pg_catalog.jsonb_typeof(member.value)
        when 'object' then platform_private.cms_jcs(member.value)
        when 'array' then platform_private.cms_jcs(member.value)
        when 'number' then platform_private.cms_jcs_number(member.value)
        else member.value::text
      end, ',' order by member.key collate "C")
    from (
      select entry.key, entry.value, pg_catalog.to_jsonb(entry.key)::text as key_text
      from pg_catalog.jsonb_each(p_value) entry
    ) member
  ), '') || '}';
end;
$body$;

commit;
