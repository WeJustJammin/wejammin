-- Slice 11 shared helpers (lane S11-3s, BE03b "Settings snapshot authority (E7)";
-- tracker P2-S11-AC-091, AC-092): the publication settings snapshot.
--
-- CMS_PUBLICATION_SETTINGS_KEYS is one code-owned, versioned registry (registry
-- version 1, mirrored by packages/contracts settings-registry.ts) of the Slice 07
-- setting definition keys whose effective value alters what a publication
-- contains.  Registry version 1 has NO members: no Phase 2 setting alters
-- publication content (delivery freshness and cache policy are evaluated by
-- Shard 05 at delivery time), so the version 1 snapshot is the empty array,
-- whose JCS SHA-256 is 4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945.
-- Adding a key is code plus a forward migration and a registry version bump: that
-- migration redefines cms_publication_settings_keys() and
-- cms_publication_settings_registry_version().
--
--   cms_publication_settings_effective_values(owner, at): for each registered key in
--     ascending bytewise order, the Slice 07 resolver (cfg_resolve_effective_value,
--     consumer key `cms.publication`, service-consumer context, scope = the owner
--     party) yields { key, definitionVersionId, sourceValueVersionId (null for a
--     contract default), valueHash (JCS SHA-256 of the typed value) }; the snapshot
--     is that array.  A key the resolver cannot serve is DEPENDENCY_UNAVAILABLE
--     (never a partial snapshot); anything but a typed refusal propagates.
--   cms_settings_snapshot(owner): evaluates at the command's server instant, then
--     reads the owner's snapshot by hash or inserts it under INSERT ... ON CONFLICT
--     (owner_id, snapshot_hash) DO NOTHING with ordinal = the owner's previous
--     maximum + 1 under the owner's advisory transaction lock, and reads the
--     ordinal back.  Ordinals identify exact snapshots and are only compared for
--     equality: restoring earlier values reuses the earlier snapshot and ordinal.
--     Answers { version: "<ordinal>", hash } -- the DependencyManifest.settings member.
--
-- The advisory lock is a LEAF lock: it is held to commit, but the function takes no
-- row lock after it and nothing that holds it waits on another lock, so it cannot
-- take part in a cycle at any position of the BE03b global order.  VOLATILE: the
-- snapshot row is recorded by the first evaluation (also when a read-only workflow
-- read is the first caller).  Private; callers run under the CMS RPC context.
-- Forward-only.
--
-- AMENDED by 20261010130000 (E7 / DEC-163), which replaced cms_settings_snapshot with the
-- read-only LOOKUP (no insert, no lock) and moved the insert into the tail of the ordinary
-- writers.  The ONE position of the owner settings advisory key in the BE03b global lock
-- order (DEC-157) is therefore: the leaf of an ordinary write transaction - taken after the
-- idempotency reservation is completed, i.e. after every canonical position (0, 1, 2, 4), and
-- followed by nothing but the snapshot insert.  The review (5), schedule (6) and lineage (7)
-- positions are never taken after it, and no decision, schedule, publish, execute or
-- invalidation command, no manifest build and no preflight evaluation takes it, so the
-- decision/publication lock inversion of finding 5 cannot arise.  The static guard is
-- supabase/tests/phase_02_slice_11_rpc_publication_lock_order.sql; the three-session
-- interleaving is race runner 014 (E8).
begin;

create or replace function platform_private.cms_publication_settings_keys()
returns text[]
language sql
immutable
security definer
set search_path = ''
as $body$
  select array[]::text[]
$body$;

comment on function platform_private.cms_publication_settings_keys() is
  'BE03b E7: CMS_PUBLICATION_SETTINGS_KEYS registry version 1 (no members; no Phase 2 setting alters publication content). A key is added by a forward migration that also bumps cms_publication_settings_registry_version().';

create or replace function platform_private.cms_publication_settings_registry_version()
returns bigint
language sql
immutable
security definer
set search_path = ''
as $body$
  select 1::bigint
$body$;

comment on function platform_private.cms_publication_settings_registry_version() is
  'BE03b E7: the CMS_PUBLICATION_SETTINGS_KEYS registry version (1).';

create or replace function platform_private.cms_publication_settings_effective_values(
  p_owner_id uuid,
  p_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  setting_key text;
  resolved jsonb;
  entries jsonb := '[]'::jsonb;
begin
  for setting_key in
    select registered.key
      from pg_catalog.unnest(platform_private.cms_publication_settings_keys()) registered(key)
     order by registered.key collate "C"
  loop
    begin
      resolved := platform_private.cfg_resolve_effective_value(pg_catalog.jsonb_build_object(
        'key', setting_key,
        'consumerKey', 'cms.publication',
        'supportedDefinitionVersions', pg_catalog.jsonb_build_array('1'),
        'partyId', p_owner_id,
        'at', p_at,
        'context', pg_catalog.jsonb_build_object(
          'serviceConsumerKey', 'cms.publication',
          'servicePrincipalId', 'cms.editorial'
        )
      ));
    exception
      when raise_exception then
        raise exception 'DEPENDENCY_UNAVAILABLE' using errcode = 'P0001';
    end;
    entries := entries || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'key', setting_key,
      'definitionVersionId', resolved->'definitionVersionId',
      'sourceValueVersionId', resolved->'sourceValueVersionId',
      'valueHash', platform_private.cms_jcs_sha256(resolved->'typedValue')
    ));
  end loop;
  return entries;
end;
$body$;

comment on function platform_private.cms_publication_settings_effective_values(uuid, timestamptz) is
  'BE03b E7: the settings snapshot values for an owner at an instant: per registered key (ascending) the Slice 07 resolver result (consumer cms.publication) as { key, definitionVersionId, sourceValueVersionId, valueHash }. Unservable key => DEPENDENCY_UNAVAILABLE. Private.';

create or replace function platform_private.cms_settings_snapshot(p_owner_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  snapshot_values jsonb;
  snapshot_digest text;
  found_ordinal bigint;
begin
  if p_owner_id is null then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  -- Leaf lock: serializes the ordinal assignment of one owner, held to commit.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('cms.settings_snapshot:' || p_owner_id::text, 0)
  );
  snapshot_values := platform_private.cms_publication_settings_effective_values(
    p_owner_id, pg_catalog.clock_timestamp()
  );
  snapshot_digest := platform_private.cms_jcs_sha256(snapshot_values);
  select snapshot.ordinal into found_ordinal
    from platform_private.cms_publication_settings_snapshots snapshot
   where snapshot.owner_id = p_owner_id
     and snapshot.snapshot_hash = snapshot_digest;
  if found_ordinal is null then
    insert into platform_private.cms_publication_settings_snapshots(
      owner_id, state, version, ordinal, registry_version, snapshot_hash, effective_values
    )
    select p_owner_id, 'active', 1,
           coalesce(pg_catalog.max(existing.ordinal), 0) + 1,
           platform_private.cms_publication_settings_registry_version(),
           snapshot_digest, snapshot_values
      from platform_private.cms_publication_settings_snapshots existing
     where existing.owner_id = p_owner_id
    on conflict (owner_id, snapshot_hash) do nothing;
    select snapshot.ordinal into found_ordinal
      from platform_private.cms_publication_settings_snapshots snapshot
     where snapshot.owner_id = p_owner_id
       and snapshot.snapshot_hash = snapshot_digest;
  end if;
  if found_ordinal is null then
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;
  return pg_catalog.jsonb_build_object(
    'version', found_ordinal::text,
    'hash', snapshot_digest
  );
end;
$body$;

comment on function platform_private.cms_settings_snapshot(uuid) is
  'BE03b E7: records (insert-if-absent under the owner advisory lock) and returns the owner''s current publication settings snapshot as { version: <ordinal>, hash }. VOLATILE; private; callers run under the CMS RPC context.';

grant select, insert on table platform_private.cms_publication_settings_snapshots
  to wejammin_cms_definer;
grant execute on function platform_private.cfg_resolve_effective_value(jsonb)
  to wejammin_cms_definer;

grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_publication_settings_keys()
  owner to wejammin_cms_definer;
alter function platform_private.cms_publication_settings_registry_version()
  owner to wejammin_cms_definer;
alter function platform_private.cms_publication_settings_effective_values(uuid, timestamptz)
  owner to wejammin_cms_definer;
alter function platform_private.cms_settings_snapshot(uuid)
  owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function platform_private.cms_publication_settings_keys()
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_publication_settings_registry_version()
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_publication_settings_effective_values(uuid, timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_settings_snapshot(uuid)
  from public, anon, authenticated, service_role;

commit;
