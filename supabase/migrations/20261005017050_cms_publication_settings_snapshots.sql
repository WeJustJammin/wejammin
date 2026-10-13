-- Slice 11 data model (BE03b E7 "Settings snapshot authority", Database Schema
-- "SettingsSnapshot"; tracker P2-S11-AC-091, AC-092): the immutable, owner-scoped
-- store of publication settings snapshots.  A snapshot is the array of
-- { key, definitionVersionId, sourceValueVersionId, valueHash } the Slice 07
-- resolver yields for the registered CMS_PUBLICATION_SETTINGS_KEYS; its hash is
-- the lowercase SHA-256 of the JCS form (the empty registry-version-1 array
-- hashes to 4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945),
-- and its ORDINAL is the number that DependencyManifest.settings.version and
-- VersionSet.settingsVersion carry.  Ordinals identify exact snapshots and are
-- only ever compared for equality: restoring earlier values reuses the earlier
-- snapshot and ordinal.
--
-- A snapshot is inserted under INSERT ... ON CONFLICT (owner_id, snapshot_hash)
-- DO NOTHING and its ordinal read back; a new snapshot takes the owner's previous
-- maximum ordinal plus one under the owner's advisory lock (the first is 1).  No
-- migration seeds a row: the first evaluation records ordinal 1.  The insert guard
-- states both invariants in the table itself - the stored hash is the JCS SHA-256
-- of the stored values, and the ordinal is gapless per owner - and the unique keys
-- are the race backstop.  Rows are private, forced-RLS, immutable (no UPDATE or
-- DELETE).  The function is SECURITY INVOKER.  Forward-only.
begin;

set local lock_timeout = '5s';

create table platform_private.cms_publication_settings_snapshots (
  id uuid not null default extensions.gen_random_uuid() primary key,
  owner_id uuid not null,
  state text not null,
  version bigint not null default 1,
  ordinal bigint not null,
  registry_version bigint not null,
  snapshot_hash char(64) not null,
  effective_values jsonb not null,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint cms_publication_settings_snapshots_state_check
    check (state = 'active'),
  constraint cms_publication_settings_snapshots_version_check
    check (version = 1 and version > 0),
  constraint cms_publication_settings_snapshots_ordinal_check
    check (ordinal > 0),
  constraint cms_publication_settings_snapshots_registry_version_check
    check (registry_version > 0),
  constraint cms_publication_settings_snapshots_hash_check
    check (snapshot_hash ~ '^[a-f0-9]{64}$'),
  constraint cms_publication_settings_snapshots_values_check check (
    pg_catalog.jsonb_typeof(effective_values) = 'array'
    and pg_catalog.jsonb_array_length(effective_values) <= 64
  ),
  constraint cms_publication_settings_snapshots_time_check
    check (updated_at = created_at),
  constraint cms_publication_settings_snapshots_owner_hash_key
    unique (owner_id, snapshot_hash),
  constraint cms_publication_settings_snapshots_owner_ordinal_key
    unique (owner_id, ordinal)
);

create or replace function platform_private.cms_settings_snapshot_guard()
returns trigger
language plpgsql
set search_path = ''
as $body$
declare
  previous_ordinal bigint;
begin
  if new.snapshot_hash is distinct from platform_private.cms_jcs_sha256(new.effective_values) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  select coalesce(pg_catalog.max(snapshot_row.ordinal), 0)
    into previous_ordinal
    from platform_private.cms_publication_settings_snapshots snapshot_row
   where snapshot_row.owner_id = new.owner_id;
  if new.ordinal <> previous_ordinal + 1 then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  return new;
end;
$body$;

create trigger cms_publication_settings_snapshots_write_guard
before insert on platform_private.cms_publication_settings_snapshots
for each row execute function platform_private.cms_write_guard();
create trigger cms_publication_settings_snapshots_z_snapshot_guard
before insert on platform_private.cms_publication_settings_snapshots
for each row execute function platform_private.cms_settings_snapshot_guard();
create trigger cms_publication_settings_snapshots_immutable_guard
before update or delete on platform_private.cms_publication_settings_snapshots
for each row execute function platform_private.cms_immutable_guard();

alter table platform_private.cms_publication_settings_snapshots enable row level security;
alter table platform_private.cms_publication_settings_snapshots force row level security;
revoke all on table platform_private.cms_publication_settings_snapshots
  from public, anon, authenticated, service_role;
create policy cms_publication_settings_snapshots_rpc_policy
  on platform_private.cms_publication_settings_snapshots
  for all to public
  using (platform_private.cms_rpc_context_valid())
  with check (platform_private.cms_rpc_context_valid());

revoke all on function platform_private.cms_settings_snapshot_guard()
  from public, anon, authenticated, service_role;

-- SEC-2: a function whose body names a forced-RLS CMS table is owned by the
-- NOLOGIN, non-BYPASSRLS definer role (the catalog guard in
-- supabase/tests/phase_02_slice_09_sec2_definer_rls.sql derives the set from the
-- live bodies), exactly as the Slice 09 schema-review guards are.  ALTER FUNCTION
-- ... OWNER TO needs CREATE on the function's schema for the new owner, held for
-- this transaction only.  The guard stays SECURITY INVOKER: it runs with the
-- privileges of the calling role, so the definer functions that write the table
-- (Slice 11 command migrations) are the ones that hold the table verbs.
grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_settings_snapshot_guard() owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;

commit;
