-- Forward-only correction: PostgreSQL regex repetitions cannot use 511 here.
-- Byte length is already a separate bounded check. Also cap the recursive
-- block-key walk independently of the JSON admission helper.
begin;

alter table platform_private.cms_composition_instances
  drop constraint cms_composition_instances_path_check;
alter table platform_private.cms_composition_instances
  add constraint cms_composition_instances_path_check check (
    octet_length(path) between 1 and 512
    and path ~ '^/[^[:cntrl:]]*$'
  );

create or replace function platform_private.cms_pattern_tree_keys_valid(
  p_tree jsonb
)
returns boolean language sql immutable strict set search_path = '' as $body$
  with recursive nodes(value, depth) as (
    select p_tree, 0
    union all
    select child.value, node.depth + 1
      from nodes node
      cross join lateral (
        select item.value
          from pg_catalog.jsonb_each(
            case when pg_catalog.jsonb_typeof(node.value) = 'object'
              then node.value else '{}'::jsonb end
          ) item
        union all
        select item.value
          from pg_catalog.jsonb_array_elements(
            case when pg_catalog.jsonb_typeof(node.value) = 'array'
              then node.value else '[]'::jsonb end
          ) item
      ) child
     where node.depth < 8
  )
  select pg_catalog.jsonb_typeof(p_tree) = 'object'
    and platform_private.cms_json_bounded(p_tree, 262144, 8, 128, 128)
    and not exists (
      select 1 from nodes node
       where pg_catalog.jsonb_typeof(node.value) = 'object'
         and node.value ? 'blockKey'
         and (
           pg_catalog.jsonb_typeof(node.value->'blockKey') <> 'string'
           or coalesce(node.value->>'blockKey','') !~ '^[a-z][a-z0-9._-]{0,95}$'
         )
    )
$body$;

revoke all on function platform_private.cms_pattern_tree_keys_valid(jsonb)
  from public, anon, authenticated, service_role;

commit;
