-- Slice 12 CMS-03C-03: private taxonomy persistence foundation.
-- The named curator RPC, merge transaction, audit and outbox follow separately.
-- Never grant browser roles direct access to these records.
begin;

create table platform_private.cms_taxonomy_versions (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_id uuid not null references platform_private.party(id),
  state text not null default 'draft' check (state in (
    'draft', 'review', 'approved', 'scheduled', 'active',
    'superseded', 'retired', 'blocked'
  )),
  version bigint not null check (version between 1 and 2147483647),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  taxonomy_key text not null check (taxonomy_key ~ '^[a-z][a-z0-9-]{1,63}$'),
  owner_capability text not null check (owner_capability ~ '^cms\.[a-z][a-z0-9._-]{0,95}$'),
  shape text not null check (shape in ('flat', 'hierarchical')),
  allowlisted_type_keys jsonb not null check (
    jsonb_typeof(allowlisted_type_keys) = 'array'
    and platform_private.cms_json_bounded(allowlisted_type_keys, 16384, 2, 64, 64)
  ),
  allowlisted_field_keys jsonb not null check (
    jsonb_typeof(allowlisted_field_keys) = 'array'
    and platform_private.cms_json_bounded(allowlisted_field_keys, 16384, 2, 64, 64)
  ),
  content_hash char(64) not null check (content_hash ~ '^[a-f0-9]{64}$'),
  created_by uuid not null references auth.users(id),
  constraint cms_taxonomy_versions_key_version_key unique (taxonomy_key, version),
  constraint cms_taxonomy_versions_id_owner_key unique (id, owner_id)
);

create index cms_taxonomy_versions_owner_key_state_version_idx
  on platform_private.cms_taxonomy_versions
  (owner_id, taxonomy_key, state, version desc);

create table platform_private.cms_terms (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_id uuid not null references platform_private.party(id),
  lifecycle text not null default 'active'
    check (lifecycle in ('active', 'deprecated', 'merged')),
  version bigint not null check (version between 1 and 2147483647),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  taxonomy_version_id uuid not null,
  term_key text not null check (term_key ~ '^[a-z][a-z0-9-]{1,63}$'),
  parent_term_id uuid references platform_private.cms_terms(id),
  aliases jsonb not null default '[]'::jsonb check (
    jsonb_typeof(aliases) = 'array'
    and platform_private.cms_json_bounded(aliases, 16384, 2, 64, 64)
  ),
  successor_id uuid references platform_private.cms_terms(id),
  created_by uuid not null references auth.users(id),
  constraint cms_terms_taxonomy_owner_fkey
    foreign key (taxonomy_version_id, owner_id)
    references platform_private.cms_taxonomy_versions(id, owner_id),
  constraint cms_terms_successor_not_self check (successor_id <> id),
  constraint cms_terms_parent_not_self check (parent_term_id <> id),
  constraint cms_terms_taxonomy_key_version_key
    unique (taxonomy_version_id, term_key, version),
  constraint cms_terms_id_owner_key unique (id, owner_id)
);

create index cms_terms_owner_taxonomy_lifecycle_idx
  on platform_private.cms_terms (owner_id, taxonomy_version_id, lifecycle);
create index cms_terms_parent_idx on platform_private.cms_terms(parent_term_id);
create index cms_terms_successor_idx on platform_private.cms_terms(successor_id);

create table platform_private.cms_term_labels (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_id uuid not null references platform_private.party(id),
  state text not null default 'active' check (state in ('active', 'retired')),
  version bigint not null check (version between 1 and 2147483647),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  term_id uuid not null,
  locale text not null check (locale ~ '^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$'),
  label text not null check (octet_length(label) between 1 and 256),
  description text check (description is null or octet_length(description) <= 4096),
  aliases jsonb not null default '[]'::jsonb check (
    jsonb_typeof(aliases) = 'array'
    and platform_private.cms_json_bounded(aliases, 16384, 2, 64, 64)
  ),
  created_by uuid not null references auth.users(id),
  constraint cms_term_labels_term_owner_fkey
    foreign key (term_id, owner_id) references platform_private.cms_terms(id, owner_id),
  constraint cms_term_labels_snapshot_time_check check (updated_at = created_at),
  constraint cms_term_labels_term_locale_version_key unique (term_id, locale, version)
);

create index cms_term_labels_owner_term_locale_state_idx
  on platform_private.cms_term_labels (owner_id, term_id, locale, state);

create table platform_private.cms_term_assignments (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_id uuid not null references platform_private.party(id),
  state text not null default 'active' check (state in ('active', 'superseded', 'revoked')),
  version bigint not null check (version between 1 and 2147483647),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revision_id uuid not null references platform_private.cms_entry_revisions(id),
  field_definition_id uuid not null
    references platform_private.cms_field_definition_versions(id),
  term_id uuid not null references platform_private.cms_terms(id),
  taxonomy_version_id uuid not null
    references platform_private.cms_taxonomy_versions(id),
  position integer not null check (position between 0 and 127),
  provenance text not null check (provenance in ('authored', 'inherited', 'system_rule')),
  created_by uuid not null references auth.users(id),
  constraint cms_term_assignments_snapshot_time_check check (updated_at = created_at),
  constraint cms_term_assignments_revision_field_term_version_key
    unique (revision_id, field_definition_id, term_id, version)
);

create index cms_term_assignments_owner_revision_field_position_idx
  on platform_private.cms_term_assignments
  (owner_id, revision_id, field_definition_id, position);
create index cms_term_assignments_term_state_idx
  on platform_private.cms_term_assignments (term_id, state);

create trigger cms_taxonomy_versions_write_guard
before insert or update or delete on platform_private.cms_taxonomy_versions
for each row execute function platform_private.cms_write_guard();
create trigger cms_terms_write_guard
before insert or update or delete on platform_private.cms_terms
for each row execute function platform_private.cms_write_guard();
create trigger cms_term_labels_write_guard
before insert or update or delete on platform_private.cms_term_labels
for each row execute function platform_private.cms_write_guard();
create trigger cms_term_assignments_write_guard
before insert or update or delete on platform_private.cms_term_assignments
for each row execute function platform_private.cms_write_guard();
create trigger cms_term_labels_immutable_guard
before update or delete on platform_private.cms_term_labels
for each row execute function platform_private.cms_immutable_guard();
create trigger cms_term_assignments_immutable_guard
before update or delete on platform_private.cms_term_assignments
for each row execute function platform_private.cms_immutable_guard();

-- Definitions can change lifecycle only. Active/terminal versions are immutable.
create or replace function platform_private.cms_taxonomy_versions_lifecycle_guard()
returns trigger language plpgsql set search_path = '' as $body$
begin
  if tg_op = 'INSERT' then
    if new.state <> 'draft' or new.updated_at <> new.created_at then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
    return new;
  end if;
  if tg_op = 'DELETE' or old.state in ('active', 'superseded', 'retired', 'blocked') then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  if (to_jsonb(new) - 'state' - 'updated_at') is distinct from
     (to_jsonb(old) - 'state' - 'updated_at') or new.updated_at < old.updated_at then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  return new;
end;
$body$;
create trigger cms_taxonomy_versions_lifecycle_guard
before insert or update or delete on platform_private.cms_taxonomy_versions
for each row execute function platform_private.cms_taxonomy_versions_lifecycle_guard();

-- Stable term identity and hierarchy; merged/deprecated rows cannot reactivate.
create or replace function platform_private.cms_terms_lifecycle_guard()
returns trigger language plpgsql set search_path = '' as $body$
begin
  if tg_op = 'INSERT' then
    if new.lifecycle <> 'active' or new.successor_id is not null
       or new.updated_at <> new.created_at then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
    return new;
  end if;
  if tg_op = 'DELETE' or old.lifecycle in ('merged', 'deprecated') then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  if (to_jsonb(new) - 'lifecycle' - 'successor_id' - 'updated_at') is distinct from
     (to_jsonb(old) - 'lifecycle' - 'successor_id' - 'updated_at')
     or new.updated_at < old.updated_at
     or (new.lifecycle = 'merged' and new.successor_id is null)
     or (new.lifecycle <> 'merged' and new.successor_id is not null) then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  return new;
end;
$body$;
create trigger cms_terms_lifecycle_guard
before insert or update or delete on platform_private.cms_terms
for each row execute function platform_private.cms_terms_lifecycle_guard();

do $body$
declare table_name text;
begin
  foreach table_name in array array[
    'cms_taxonomy_versions', 'cms_terms', 'cms_term_labels', 'cms_term_assignments'
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

commit;
