-- Slice 12 lane pattern-def (BE03c "Pattern versions and linked updates (D9, OD-2)" 1361, Registry invariants
-- 215-219, Database Schema 1425, route rows CMS-03C-12 174 and validation row 396; tracker P2-S12-AC-100 to
-- AC-104, AC-193, AC-211): the pure validators of the ordered PatternNode forest and of the compatible type
-- list.  They are IMMUTABLE and storage-free so the table CHECKs of 20261014020100 and the producer of
-- 20261014020400 share one definition of "a well-formed forest".
--
--   cms_pattern_forest_nodes(tree)         every node of the forest with its path and level (levels above 10 are
--                                          not expanded, so a hostile depth cannot recurse the walk)
--   cms_pattern_node_shape_valid(node)     one node against the locked PatternNode contract
--   cms_pattern_forest_check(tree)         NULL for a valid forest, else the closed refusal token:
--                                          VALIDATION_FAILED, pattern_depth_exceeded or pattern_nodes_exceeded
--   cms_pattern_type_ids_valid(ids)        1 to 64 distinct UUID strings
--   cms_pattern_refs(tree)                 the nested pattern references of a forest
--   cms_pattern_props_valid(snapshot, props) block props against the registered, signed props snapshot
-- Private; owned by the CMS definer role (the producer, the table CHECKs and the guard run as that role).
-- Forward-only.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create or replace function platform_private.cms_pattern_forest_nodes(p_tree jsonb)
returns table(node_path integer[], node_level integer, node jsonb)
language sql
immutable
set search_path = ''
as $body$
  with recursive walk(node_path, node_level, node) as (
    select array[root_node.ord::integer - 1], 1, root_node.value
      from pg_catalog.jsonb_array_elements(
        case when pg_catalog.jsonb_typeof(p_tree) = 'array' then p_tree else '[]'::jsonb end
      ) with ordinality root_node(value, ord)
    union all
    select walk.node_path || (child_node.ord::integer - 1), walk.node_level + 1, child_node.value
      from walk
      cross join lateral pg_catalog.jsonb_array_elements(
        case when pg_catalog.jsonb_typeof(walk.node) = 'object'
               and walk.node->>'kind' = 'block'
               and pg_catalog.jsonb_typeof(walk.node->'children') = 'array'
             then walk.node->'children' else '[]'::jsonb end
      ) with ordinality child_node(value, ord)
     where walk.node_level <= 9
  )
  select walk.node_path, walk.node_level, walk.node from walk
$body$;

create or replace function platform_private.cms_pattern_node_shape_valid(p_node jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $body$
declare
  kind text;
begin
  if pg_catalog.jsonb_typeof(p_node) is distinct from 'object'
     or pg_catalog.jsonb_typeof(p_node->'kind') is distinct from 'string' then
    return false;
  end if;
  kind := p_node->>'kind';
  if pg_catalog.jsonb_typeof(p_node->'key') is distinct from 'string'
     or p_node->>'key' !~ '^[a-z][a-z0-9_-]{0,63}$' then
    return false;
  end if;
  if kind = 'block' then
    return platform_private.cms_exact_keys(
             p_node,
             array['kind','key','blockKey','blockVersion','props','children']::text[],
             array['kind','key','blockKey','blockVersion','props','children']::text[])
       and pg_catalog.jsonb_typeof(p_node->'blockKey') = 'string'
       and p_node->>'blockKey' ~ '^[a-z][a-z0-9._-]{0,95}$'
       and pg_catalog.jsonb_typeof(p_node->'blockVersion') = 'number'
       and p_node->>'blockVersion' ~ '^[1-9][0-9]{0,9}$'
       and (p_node->>'blockVersion')::bigint <= 2147483647
       and pg_catalog.jsonb_typeof(p_node->'props') = 'object'
       and (select pg_catalog.count(*) from pg_catalog.jsonb_object_keys(p_node->'props')) <= 64
       and not exists (
         select 1 from pg_catalog.jsonb_object_keys(p_node->'props') prop_key
          where pg_catalog.length(prop_key) > 128)
       and platform_private.cms_json_bounded(p_node->'props', 262144, 8, 128, 128)
       and pg_catalog.jsonb_typeof(p_node->'children') = 'array'
       and pg_catalog.jsonb_array_length(p_node->'children') <= 32;
  elsif kind = 'pattern' then
    return platform_private.cms_exact_keys(
             p_node,
             array['kind','key','patternId','patternVersion']::text[],
             array['kind','key','patternId','patternVersion']::text[])
       and pg_catalog.jsonb_typeof(p_node->'patternId') = 'string'
       and p_node->>'patternId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       and pg_catalog.jsonb_typeof(p_node->'patternVersion') = 'number'
       and p_node->>'patternVersion' ~ '^[1-9][0-9]{0,9}$'
       and (p_node->>'patternVersion')::bigint <= 2147483647;
  end if;
  return false;
exception when others then
  return false;
end;
$body$;

create or replace function platform_private.cms_pattern_forest_check(p_tree jsonb)
returns text
language plpgsql
immutable
set search_path = ''
as $body$
declare
  deepest integer;
  total integer;
begin
  if p_tree is null
     or pg_catalog.jsonb_typeof(p_tree) is distinct from 'array'
     or pg_catalog.octet_length(p_tree::text) > 262144
     or pg_catalog.jsonb_array_length(p_tree) not between 1 and 32 then
    return 'VALIDATION_FAILED';
  end if;
  if exists (
    select 1 from platform_private.cms_pattern_forest_nodes(p_tree) scanned
     where not platform_private.cms_pattern_node_shape_valid(scanned.node)
  ) then
    return 'VALIDATION_FAILED';
  end if;
  -- sibling keys are unique within one parent (the roots share the empty parent path)
  if exists (
    select 1 from platform_private.cms_pattern_forest_nodes(p_tree) scanned
     group by scanned.node_path[1:pg_catalog.cardinality(scanned.node_path) - 1], scanned.node->>'key'
    having pg_catalog.count(*) > 1
  ) then
    return 'VALIDATION_FAILED';
  end if;
  select pg_catalog.max(scanned.node_level), pg_catalog.count(*)::integer
    into deepest, total
    from platform_private.cms_pattern_forest_nodes(p_tree) scanned;
  if deepest > 8 then return 'pattern_depth_exceeded'; end if;
  if total > 512 then return 'pattern_nodes_exceeded'; end if;
  return null;
exception when others then
  return 'VALIDATION_FAILED';
end;
$body$;

create or replace function platform_private.cms_pattern_type_ids_valid(p_ids jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $body$
begin
  if pg_catalog.jsonb_typeof(p_ids) is distinct from 'array'
     or pg_catalog.jsonb_array_length(p_ids) not between 1 and 64 then
    return false;
  end if;
  if exists (
    select 1 from pg_catalog.jsonb_array_elements(p_ids) element(value)
     where pg_catalog.jsonb_typeof(element.value) <> 'string'
        or (element.value #>> '{}') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  ) then
    return false;
  end if;
  return (
    select pg_catalog.count(distinct pg_catalog.lower(element.value #>> '{}'))
      from pg_catalog.jsonb_array_elements(p_ids) element(value)
  ) = pg_catalog.jsonb_array_length(p_ids);
exception when others then
  return false;
end;
$body$;

create or replace function platform_private.cms_pattern_refs(p_tree jsonb)
returns table(ref_pattern_id uuid, ref_pattern_version integer)
language sql
immutable
set search_path = ''
as $body$
  select (scanned.node->>'patternId')::uuid, (scanned.node->>'patternVersion')::integer
    from platform_private.cms_pattern_forest_nodes(p_tree) scanned
   where scanned.node->>'kind' = 'pattern'
$body$;

-- A block's props against its registered, signed props snapshot: every key is a declared field (the snapshot
-- is `additionalProperties: false`), every `required` field is present, and every value has the encoding of
-- its field kind.  The kind vocabulary of a block props snapshot is not closed by BE03a (a free 1 to 64
-- character string); the content field kinds are decided by cms_field_kind_value_shape and `string` is read as
-- `short_text`, the kind every registered fixture uses.  An unknown kind admits no value (fail closed).
create or replace function platform_private.cms_pattern_props_valid(p_snapshot jsonb, p_props jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $body$
declare
  field jsonb;
  field_kind text;
  field_name text;
begin
  if pg_catalog.jsonb_typeof(p_snapshot) is distinct from 'object'
     or pg_catalog.jsonb_typeof(p_snapshot->'fields') is distinct from 'array'
     or pg_catalog.jsonb_typeof(p_props) is distinct from 'object' then
    return false;
  end if;
  if exists (
    select 1 from pg_catalog.jsonb_object_keys(p_props) prop_key
     where not exists (
       select 1 from pg_catalog.jsonb_array_elements(p_snapshot->'fields') declared(value)
        where declared.value->>'name' = prop_key)
  ) then
    return false;
  end if;
  for field in select declared.value from pg_catalog.jsonb_array_elements(p_snapshot->'fields') declared(value) loop
    field_name := field->>'name';
    if p_props ? field_name then
      field_kind := case when field->>'kind' = 'string' then 'short_text' else field->>'kind' end;
      if not coalesce(platform_private.cms_field_kind_value_shape(
           field_kind, coalesce(field->'constraints', '{}'::jsonb), p_props->field_name), false) then
        return false;
      end if;
    elsif coalesce((field->>'required')::boolean, false) then
      return false;
    end if;
  end loop;
  return true;
exception when others then
  return false;
end;
$body$;

grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_pattern_forest_nodes(jsonb) owner to wejammin_cms_definer;
alter function platform_private.cms_pattern_node_shape_valid(jsonb) owner to wejammin_cms_definer;
alter function platform_private.cms_pattern_forest_check(jsonb) owner to wejammin_cms_definer;
alter function platform_private.cms_pattern_type_ids_valid(jsonb) owner to wejammin_cms_definer;
alter function platform_private.cms_pattern_refs(jsonb) owner to wejammin_cms_definer;
alter function platform_private.cms_pattern_props_valid(jsonb, jsonb) owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function
  platform_private.cms_pattern_forest_nodes(jsonb),
  platform_private.cms_pattern_node_shape_valid(jsonb),
  platform_private.cms_pattern_forest_check(jsonb),
  platform_private.cms_pattern_type_ids_valid(jsonb),
  platform_private.cms_pattern_refs(jsonb),
  platform_private.cms_pattern_props_valid(jsonb, jsonb)
  from public, anon, authenticated, service_role;

-- The CHECKs and the producer call these validators as the definer role: it needs EXECUTE on every helper they
-- reach.  Only what is missing is granted (non-grantable), no prior ACL is touched.
do $closure$
declare
  callee text;
  callee_oid regprocedure;
begin
  foreach callee in array array[
    'platform_private.cms_exact_keys(jsonb,text[],text[])',
    'platform_private.cms_json_bounded(jsonb,integer,integer,integer,integer)',
    'platform_private.cms_field_kind_value_shape(text,jsonb,jsonb)',
    -- the table CHECK names it, so every role that writes a pattern row (the definer) needs EXECUTE
    'platform_private.cms_pattern_tree_keys_valid(jsonb)'
  ] loop
    callee_oid := pg_catalog.to_regprocedure(callee);
    if callee_oid is null then
      raise exception 'pattern validator callee is missing: %', callee using errcode = '55000';
    end if;
    if not pg_catalog.has_function_privilege('wejammin_cms_definer', callee_oid, 'EXECUTE') then
      execute pg_catalog.format('grant execute on function %s to wejammin_cms_definer', callee_oid::text);
    end if;
  end loop;
end;
$closure$;

commit;
