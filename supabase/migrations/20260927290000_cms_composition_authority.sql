-- Slice 12 CMS-03C-02: private pattern and composition persistence foundation.
-- The named graph/digest RPC and browser workflow are not substituted here.
begin;

-- Traverse only bounded JSON. Every declared blockKey must use the canonical
-- grammar even when nested in an array or object under a caller-chosen key.
create or replace function platform_private.cms_pattern_tree_keys_valid(
  p_tree jsonb
)
returns boolean language sql immutable strict set search_path = '' as $body$
  with recursive nodes(value) as (
    select p_tree
    union all
    select child.value
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

create table platform_private.cms_pattern_versions (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_id uuid not null references platform_private.party(id),
  state text not null default 'draft' check (state in (
    'draft','review','approved','scheduled','active',
    'superseded','retired','blocked'
  )),
  version bigint not null check (version between 1 and 2147483647),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  pattern_key text not null check (pattern_key ~ '^[a-z][a-z0-9-]{1,63}$'),
  block_tree jsonb not null check (
    platform_private.cms_pattern_tree_keys_valid(block_tree)
  ),
  block_registry_digest char(64) not null
    check (block_registry_digest ~ '^[a-f0-9]{64}$'),
  content_hash char(64) not null check (content_hash ~ '^[a-f0-9]{64}$'),
  owner_capability text not null
    check (owner_capability ~ '^cms\.[a-z][a-z0-9._-]{0,95}$'),
  created_by uuid not null references auth.users(id),
  constraint cms_pattern_versions_key_version_key unique (pattern_key, version),
  constraint cms_pattern_versions_id_version_key unique (id, version)
);

create index cms_pattern_versions_key_state_version_idx
  on platform_private.cms_pattern_versions(pattern_key, state, version desc);
create index cms_pattern_versions_owner_state_updated_idx
  on platform_private.cms_pattern_versions(owner_id, state, updated_at desc);

create table platform_private.cms_composition_instances (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_id uuid not null references platform_private.party(id),
  state text not null default 'draft' check (state in (
    'draft','active','pending_diff','superseded','retired'
  )),
  version bigint not null check (version between 1 and 2147483647),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revision_id uuid not null references platform_private.cms_entry_revisions(id),
  path text not null check (
    octet_length(path) between 1 and 512
    and path ~ '^/[^[:cntrl:]]{0,511}$'
  ),
  slot_key text not null check (slot_key ~ '^[a-z][a-z0-9_-]{1,63}$'),
  block_key text not null check (block_key ~ '^[a-z][a-z0-9._-]{0,95}$'),
  block_version bigint not null check (block_version between 1 and 2147483647),
  pattern_id uuid,
  pattern_version bigint check (
    pattern_version between 1 and 2147483647
  ),
  block_registry_digest char(64) not null
    check (block_registry_digest ~ '^[a-f0-9]{64}$'),
  link_mode text not null check (link_mode in ('linked','detached')),
  props jsonb not null default '{}'::jsonb check (
    jsonb_typeof(props) = 'object'
    and platform_private.cms_json_bounded(props, 262144, 8, 128, 128)
  ),
  bindings jsonb not null default '{}'::jsonb check (
    jsonb_typeof(bindings) = 'object'
    and platform_private.cms_json_bounded(bindings, 262144, 8, 128, 128)
  ),
  parent_instance_id uuid references platform_private.cms_composition_instances(id),
  created_by uuid not null references auth.users(id),
  constraint cms_composition_instances_pattern_pair_check
    check ((pattern_id is null) = (pattern_version is null)),
  constraint cms_composition_instances_pattern_version_fkey
    foreign key (pattern_id, pattern_version)
    references platform_private.cms_pattern_versions(id, version),
  constraint cms_composition_instances_parent_not_self
    check (parent_instance_id <> id),
  constraint cms_composition_instances_snapshot_time_check
    check (updated_at = created_at),
  constraint cms_composition_instances_revision_path_version_key
    unique (revision_id, path, version)
);

create index cms_composition_instances_owner_revision_slot_idx
  on platform_private.cms_composition_instances(owner_id, revision_id, slot_key);
create index cms_composition_instances_pattern_version_idx
  on platform_private.cms_composition_instances(pattern_id, pattern_version);

create trigger cms_pattern_versions_write_guard
before insert or update or delete on platform_private.cms_pattern_versions
for each row execute function platform_private.cms_write_guard();
create trigger cms_composition_instances_write_guard
before insert or update or delete on platform_private.cms_composition_instances
for each row execute function platform_private.cms_write_guard();
create trigger cms_composition_instances_immutable_guard
before update or delete on platform_private.cms_composition_instances
for each row execute function platform_private.cms_immutable_guard();

create or replace function platform_private.cms_pattern_versions_lifecycle_guard()
returns trigger language plpgsql set search_path = '' as $body$
begin
  if tg_op = 'INSERT' then
    if new.state <> 'draft' or new.updated_at <> new.created_at then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
    return new;
  end if;
  if tg_op = 'DELETE' or old.state in ('active','superseded','retired','blocked') then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  if (to_jsonb(new) - 'state' - 'updated_at') is distinct from
     (to_jsonb(old) - 'state' - 'updated_at') or new.updated_at < old.updated_at then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  return new;
end;
$body$;
create trigger cms_pattern_versions_lifecycle_guard
before insert or update or delete on platform_private.cms_pattern_versions
for each row execute function platform_private.cms_pattern_versions_lifecycle_guard();

do $body$
declare table_name text;
begin
  foreach table_name in array array[
    'cms_pattern_versions', 'cms_composition_instances'
  ] loop
    execute format('alter table platform_private.%I enable row level security', table_name);
    execute format('alter table platform_private.%I force row level security', table_name);
    execute format(
      'revoke all on table platform_private.%I from public, anon, authenticated, service_role',
      table_name
    );
    execute format(
      'create policy %I on platform_private.%I for all to public using (platform_private.cms_rpc_context_valid()) with check (platform_private.cms_rpc_context_valid())',
      table_name || '_rpc_policy', table_name
    );
  end loop;
end;
$body$;

revoke all on function platform_private.cms_pattern_tree_keys_valid(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_pattern_versions_lifecycle_guard()
  from public, anon, authenticated, service_role;

commit;
