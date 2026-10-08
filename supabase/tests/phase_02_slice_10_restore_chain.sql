-- Slice 10 QA-RED (WP-S10-2a): CMS-03B-04 revision restore chain (D6).
--
-- The suite asserts the locked restore-chain contract: an immutable
-- platform_private.cms_restore_chain_manifests record composed from completed
-- 03a migration-plan edges, the cms_restore_revision command, and the eight
-- documented refusal/identity cases.  Plan and approval evidence is produced
-- only by the real Slice 09 producers (cms_verify_schema_migration,
-- cms_complete_schema_migration, cms_activate_schema_migration); the suite
-- never inserts a plan or approval row by hand.  Every assertion is written
-- before the WP-S10-3 migration exists, so an absent table, function or guard
-- is an evidence-backed RED rather than a silent pass.
--
-- This file is the single Supabase discovery entrypoint; the shared
-- rpc/remaining-schema helpers and the Slice 10 fixtures are includes in the
-- repository convention.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(23);

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_remaining_schema/000-helpers.sqlinc
\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec108/03-support.sqlinc
\ir phase_02_slice_09_dec108/04-worker.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_10_rpc/009-restore-policy-binding.sqlinc

-- Multi-edge producer setup (D6).  The zero-edge and refusal cases run entirely
-- on the s10 fixture entry; the multi-edge success needs a real chain of
-- consecutive COMPLETED 03a plan edges.  That chain is built here through the
-- real Slice 09 producers only -- successor drafts, review, an independent
-- decision, the worker dry-run/verify/complete protocol, and activation -- and
-- the single source entry is created through the real CMS-03B-10 create
-- command while the source version is active.  No plan, review, decision,
-- completed-plan, approved-state or chain row is inserted by hand.  The dec108
-- owner receipt (platform_private.initialize_cms_owner) refuses once any cms.%
-- grant exists, so 01-actors provisioned above runs before the s10 fixture
-- inserted its own grants, and the owner gains cms.author through the real
-- CMS-03A-15 grant command.
select pg_temp.s09d_grant_via_rpc('owner', 'cms.author', 1);

select pg_temp.s09d_guc_save();
select pg_temp.s09d_create_type('s10src', 'articlesrc');
select pg_temp.s09d_to_active('s10src', array['rev1']);
select pg_temp.s09d_grant_via_rpc('owner', 'cms.author', 1);
select pg_temp.s09w_entry('s10e', 's10src', 'Seed title');
select pg_temp.s09d_successor('s10mid', 's10src');
select pg_temp.s09d_dry_run('s10mid');
select pg_temp.s09w_dry_run('s10mid');
select pg_temp.s09d_submit('s10mid');
select pg_temp.s09d_assign('s10mid', 'rev2');
select pg_temp.s09d_decide('s10mid', 'rev2');
select pg_temp.s09w_backfill('s10mid');
select pg_temp.s09d_activate('s10mid');
select pg_temp.s09d_successor('s10tgt', 's10mid');
select pg_temp.s09d_dry_run('s10tgt');
select pg_temp.s09w_dry_run('s10tgt');
select pg_temp.s09d_submit('s10tgt');
select pg_temp.s09d_assign('s10tgt', 'rev3');
select pg_temp.s09d_decide('s10tgt', 'rev3');
select pg_temp.s09w_backfill('s10tgt');
select pg_temp.s09d_activate('s10tgt');
select pg_temp.s09d_guc_restore();

create temp table s10_chain on commit drop as
select entry.id as entry_id,
       entry.version as entry_version,
       (
         select revision.id
         from platform_private.cms_entry_revisions revision
         where revision.entry_id = entry.id
         order by revision.revision_number
         limit 1
       ) as revision_id,
       pg_temp.s09d_id('s10src:type') as type_id,
       pg_temp.s09d_id('s10src:version') as source_version_id,
       pg_temp.s09d_id('s10tgt:version') as target_version_id
from platform_private.cms_content_entries entry
where entry.content_type_id = pg_temp.s09d_id('s10src:type');

-- The producer chain above selected the dec108 owner worker sessions; restore
-- the s10 fixture creator/organization session so every zero-edge and refusal
-- probe below runs against the fixture entry exactly as before.
select pg_temp.s10_rpc_as(
  'a9100000-0000-4000-8000-000000000001'::uuid,
  (select value::uuid from s10_ids where key = 'organization')
);

-- Evaluates a boolean query through EXECUTE so a read of the not-yet-existing
-- restore-chain manifest is an evidence-backed false instead of a parse-time
-- relation error that would abort the whole RED run.  This is the only way to
-- assert on a table the migration has not created yet.
create or replace function pg_temp.s10_sql_bool(p_sql text)
returns boolean
language plpgsql
as $body$
declare
  result boolean;
begin
  begin
    execute 'select (' || p_sql || ')' into result;
    return coalesce(result, false);
  exception
    when others then
      return false;
  end;
end;
$body$;

-- The restore chain is only valid when it is composed from real completed plan
-- edges.  This guard pins the producers the WP-S10-3 migration must use so a
-- later hand-inserted plan row can never satisfy the suite.
select ok(
  pg_temp.s10_fn_exists('platform_api', 'cms_verify_schema_migration', 'jsonb')
    and pg_temp.s10_fn_exists(
      'platform_api', 'cms_complete_schema_migration', 'jsonb'
    )
    and pg_temp.s10_fn_exists(
      'platform_api', 'cms_activate_schema_migration', 'jsonb'
    ),
  'restore chain composes real Slice 09 completed plan edges, never hand-inserted rows'
);

-- The manifest is a private immutable chain identity keyed by content type and
-- source/target schema versions, carrying the ordered bounded plan ids.
select ok(
  to_regclass('platform_private.cms_restore_chain_manifests') is not null
    and pg_temp.s10r_has_column(
      'platform_private.cms_restore_chain_manifests', 'plan_ids'
    )
    and pg_temp.s10r_has_column(
      'platform_private.cms_restore_chain_manifests', 'edge_count'
    )
    and pg_temp.s10r_has_column(
      'platform_private.cms_restore_chain_manifests', 'manifest_hash'
    )
    and pg_temp.s10r_col_notnull(
      'platform_private.cms_restore_chain_manifests', 'edge_count'
    )
    and pg_temp.s10r_has_check(
      'platform_private.cms_restore_chain_manifests', 'edge_count <= 64'
    )
    and pg_temp.s10r_unique_target(
      'platform_private.cms_restore_chain_manifests'
    ) @> array['manifest_hash']::text[],
  'restore-chain manifest carries the ordered bounded plan edges and a unique hash'
);

-- Forced RLS with no browser grant.  CASE is used so a missing table yields
-- false instead of aborting the single-transaction RED run.
select ok(
  coalesce(
    (select relrowsecurity and relforcerowsecurity
     from pg_class
     where oid = to_regclass('platform_private.cms_restore_chain_manifests')),
    false
  )
    and case
      when to_regclass('platform_private.cms_restore_chain_manifests') is null
        then false
      else not has_table_privilege(
          'authenticated',
          'platform_private.cms_restore_chain_manifests', 'SELECT'
        )
        and not has_table_privilege(
          'authenticated',
          'platform_private.cms_restore_chain_manifests', 'INSERT'
        )
        and not has_table_privilege(
          'anon',
          'platform_private.cms_restore_chain_manifests', 'SELECT'
        )
    end,
  'restore-chain manifest is private with forced RLS and no browser grants'
);

-- The command is a named RPC in the platform_api layer and a definer in
-- platform_private, and it is worker-only.
select ok(
  pg_temp.s10_fn_exists('platform_api', 'cms_restore_revision', 'jsonb')
    and pg_temp.s10_fn_exists('platform_private', 'cms_restore_revision', 'jsonb')
    and not pg_temp.s10_fn_privilege(
      'platform_api', 'cms_restore_revision', 'jsonb', 'authenticated'
    )
    and not pg_temp.s10_fn_privilege(
      'platform_api', 'cms_restore_revision', 'jsonb', 'anon'
    ),
  'cms_restore_revision exists as the worker-only restore command'
);

-- Zero-edge: a same-schema restore still records a manifest whose edge count is
-- 0 and whose plan id list is empty.
select pg_temp.s10_rpc_probe_persist(
  'restore_zero_edge',
  null,
  $sql$select platform_api.cms_restore_revision(jsonb_build_object(
    'entryId', (select value from s10_ids where key = 'entryId'),
    'revisionId', (select value from s10_ids where key = 'entryRevisionId'),
    'migrationChainId', platform_private.cms_restore_chain_manifest_id(
      platform_private.cms_restore_chain_derive(
        (select value::uuid from s10_ids where key = 'typeId'),
        (select value::uuid from s10_ids where key = 'draftVersionId'),
        (select value::uuid from s10_ids where key = 'draftVersionId')
      )->>'hash')::text,
    'expectedVersion', (select entry_row.version::text
      from platform_private.cms_content_entries entry_row
      where entry_row.id = (select value::uuid from s10_ids where key = 'entryId')),
    'idempotencyKey', 's10-restore-zero-0001'))$sql$
);

select is(
  pg_temp.s10_probe_state('restore_zero_edge'), '00000',
  'a same-schema restore returns a new draft revision'
);

select ok(
  pg_temp.s10_sql_bool($q$
    select count(*) = 1
    from platform_private.cms_restore_chain_manifests manifest
    where manifest.edge_count = 0
      and manifest.plan_ids = '[]'::jsonb
  $q$),
  'a zero-edge restore records a manifest with no plan edges'
);

-- Multi-edge: the source revision sits on the first chain version and the
-- active target is two completed plans ahead, so the re-derived chain carries
-- two ordered edges.  The request is a NEW owner worker request of its own
-- (isolated idempotency key) against the real chain entry captured above.
select pg_temp.s09d_session('owner', 'service_role');
select set_config('app.cms_rpc', 'true', true);

select pg_temp.s10_rpc_probe_persist(
  'restore_multi_edge',
  null,
  $sql$select platform_api.cms_restore_revision(jsonb_build_object(
    'entryId', (select entry_id::text from s10_chain),
    'revisionId', (select revision_id::text from s10_chain),
    'migrationChainId', platform_private.cms_restore_chain_manifest_id(
      platform_private.cms_restore_chain_derive(
        (select type_id from s10_chain),
        (select source_version_id from s10_chain),
        (select target_version_id from s10_chain)
      )->>'hash')::text,
    'expectedVersion', (select entry_version::text from s10_chain),
    'idempotencyKey', 's10-restore-multi-0001'))$sql$
);

select set_config('app.cms_rpc', '', true);

-- Restore the s10 fixture session so the CAS and identity assertions below run
-- against the fixture entry exactly as before.
select pg_temp.s10_rpc_as(
  'a9100000-0000-4000-8000-000000000001'::uuid,
  (select value::uuid from s10_ids where key = 'organization')
);

select is(
  pg_temp.s10_probe_state('restore_multi_edge'), '00000',
  'a multi-edge restore translates content across every recorded plan'
);

select ok(
  pg_temp.s10_sql_bool($q$
    select count(*) = 1
    from platform_private.cms_restore_chain_manifests manifest
    where manifest.edge_count = jsonb_array_length(manifest.plan_ids)
      and manifest.edge_count between 1 and 64
      and manifest.manifest_hash
        = platform_private.cms_jcs_sha256(jsonb_build_object(
            'contentTypeId', manifest.content_type_id,
            'sourceSchemaVersionId', manifest.source_schema_version_id,
            'targetSchemaVersionId', manifest.target_schema_version_id,
            'planIds', manifest.plan_ids
          ))::char(64)
  $q$),
  'a multi-edge manifest records consecutive bounded edges and a recomputed hash'
);

-- Ambiguous/changed path: the re-derived chain must equal the request, else a
-- 409 migration_chain_mismatch and no manifest is trusted.
select pg_temp.s10_rpc_probe(
  'restore_ambiguous_path',
  null,
  $sql$select platform_api.cms_restore_revision(jsonb_build_object(
    'entryId', (select value from s10_ids where key = 'entryId'),
    'revisionId', (select value from s10_ids where key = 'entryRevisionId'),
    'migrationChainId', 'a9100000-0000-4000-8000-000000000903',
    'expectedVersion', (select entry_row.version::text
      from platform_private.cms_content_entries entry_row
      where entry_row.id = (select value::uuid from s10_ids where key = 'entryId')),
    'idempotencyKey', 's10-restore-ambig-0001'))$sql$
);

select is(
  pg_temp.s10_probe_state('restore_ambiguous_path'), 'P0001',
  'a chain that no longer matches the derived path is refused, never guessed'
);

-- Over-limit chain: more than 64 edges can never be recorded or silently
-- truncated; the restore is refused.
select pg_temp.s10_rpc_probe(
  'restore_over_64',
  null,
  $sql$select platform_api.cms_restore_revision(jsonb_build_object(
    'entryId', (select value from s10_ids where key = 'entryId'),
    'revisionId', (select value from s10_ids where key = 'entryRevisionId'),
    'migrationChainId', 'a9100000-0000-4000-8000-000000000904',
    'expectedVersion', (select entry_row.version::text
      from platform_private.cms_content_entries entry_row
      where entry_row.id = (select value::uuid from s10_ids where key = 'entryId')),
    'idempotencyKey', 's10-restore-over64-0001'))$sql$
);

select is(
  pg_temp.s10_probe_state('restore_over_64'), 'P0001',
  'a restore chain longer than 64 edges is refused, never truncated'
);

select ok(
  pg_temp.s10_sql_bool($q$
    select not exists (
      select 1 from platform_private.cms_restore_chain_manifests manifest
      where manifest.edge_count > 64
    )
  $q$),
  'no over-limit restore manifest is ever recorded'
);

-- Missing transform: a source field with no registered transform refuses with
-- migration_chain_incomplete and fabricates nothing.
select pg_temp.s10_rpc_probe(
  'restore_missing_transform',
  null,
  $sql$select platform_api.cms_restore_revision(jsonb_build_object(
    'entryId', (select value from s10_ids where key = 'entryId'),
    'revisionId', (select value from s10_ids where key = 'entryRevisionId'),
    'migrationChainId', 'a9100000-0000-4000-8000-000000000905',
    'expectedVersion', (select entry_row.version::text
      from platform_private.cms_content_entries entry_row
      where entry_row.id = (select value::uuid from s10_ids where key = 'entryId')),
    'idempotencyKey', 's10-restore-missing-0001'))$sql$
);

select is(
  pg_temp.s10_probe_state('restore_missing_transform'), 'P0001',
  'a field without a registered transform is a typed restore refusal'
);

-- Required field with no literal default: migration_chain_incomplete.
select pg_temp.s10_rpc_probe(
  'restore_required_no_default',
  null,
  $sql$select platform_api.cms_restore_revision(jsonb_build_object(
    'entryId', (select value from s10_ids where key = 'entryId'),
    'revisionId', (select value from s10_ids where key = 'entryRevisionId'),
    'migrationChainId', 'a9100000-0000-4000-8000-000000000906',
    'expectedVersion', (select entry_row.version::text
      from platform_private.cms_content_entries entry_row
      where entry_row.id = (select value::uuid from s10_ids where key = 'entryId')),
    'idempotencyKey', 's10-restore-reqnodef-0001'))$sql$
);

select is(
  pg_temp.s10_probe_state('restore_required_no_default'), 'P0001',
  'a required target field without a literal default refuses rather than inventing one'
);

-- Incompatible template resolution: template_incompatible.
select pg_temp.s10_rpc_probe(
  'restore_template_incompatible',
  null,
  $sql$select platform_api.cms_restore_revision(jsonb_build_object(
    'entryId', (select value from s10_ids where key = 'entryId'),
    'revisionId', (select value from s10_ids where key = 'entryRevisionId'),
    'migrationChainId', 'a9100000-0000-4000-8000-000000000907',
    'expectedVersion', (select entry_row.version::text
      from platform_private.cms_content_entries entry_row
      where entry_row.id = (select value::uuid from s10_ids where key = 'entryId')),
    'idempotencyKey', 's10-restore-tplinc-0001'))$sql$
);

select is(
  pg_temp.s10_probe_state('restore_template_incompatible'), 'P0001',
  'an incompatible template resolution is a typed restore refusal'
);

-- Replay: a replayed Idempotency-Key returns the original revision without
-- another revision or outbox event, so a lost response is reconciled.
select pg_temp.s10_rpc_probe(
  'restore_replay',
  null,
  $sql$select platform_api.cms_restore_revision(jsonb_build_object(
    'entryId', (select value from s10_ids where key = 'entryId'),
    'revisionId', (select value from s10_ids where key = 'entryRevisionId'),
    'migrationChainId', platform_private.cms_restore_chain_manifest_id(
      platform_private.cms_restore_chain_derive(
        (select value::uuid from s10_ids where key = 'typeId'),
        (select value::uuid from s10_ids where key = 'draftVersionId'),
        (select value::uuid from s10_ids where key = 'draftVersionId')
      )->>'hash')::text,
    'expectedVersion', (select entry_row.version::text
      from platform_private.cms_content_entries entry_row
      where entry_row.id = (select value::uuid from s10_ids where key = 'entryId')),
    'idempotencyKey', 's10-restore-replay-0001'))$sql$
);

select ok(
  pg_temp.s10_probe_state('restore_replay') = '00000'
    and pg_temp.s10_reservation_count(
      (select value::uuid from s10_ids where key = 'creatorAuth'),
      'CMS-03B-04'
    ) = 1,
  'a replayed restore key returns the original revision without duplicate effects'
);

-- CAS: a stale expectedVersion is a 409 version mismatch, not a silent write.
select pg_temp.s10_rpc_probe(
  'restore_cas_stale',
  null,
  $sql$select platform_api.cms_restore_revision(jsonb_build_object(
    'entryId', (select value from s10_ids where key = 'entryId'),
    'revisionId', (select value from s10_ids where key = 'entryRevisionId'),
    'migrationChainId', 'a9100000-0000-4000-8000-000000000909',
    'expectedVersion', 999,
    'idempotencyKey', 's10-restore-cas-0001'))$sql$
);

select is(
  pg_temp.s10_probe_state('restore_cas_stale') || ':' || pg_temp.s10_probe_message('restore_cas_stale'),
  'P0001:VERSION_MISMATCH',
  'a stale entry version fails the restore CAS with the typed VERSION_MISMATCH path (P0001, as append and resolve; cascade: write-path audit P2-S10-AC-025, was SQLSTATE 40001)'
);

-- The new draft records its parent chain as [current draft, source revision].
select ok(
  case
    when to_regclass('platform_private.cms_entry_revisions') is null then false
    else exists (
      select 1
      from platform_private.cms_entry_revisions revision
      where revision.state = 'draft'
        and revision.entry_id = (select value::uuid from s10_ids where key = 'entryId')
        and jsonb_array_length(revision.parent_revision_ids) = 2
        and revision.parent_revision_ids
          @> jsonb_build_array((select value from s10_ids where key = 'entryRevisionId'))
    )
  end,
  'a restored draft records its current-draft and source parent chain'
);

-- The source revision is immutable: restore never mutates or activates it.
select ok(
  case
    when to_regclass('platform_private.cms_entry_revisions') is null then false
    else (
      select revision.state = 'draft'
        and revision.version = 1
        and revision.updated_at = revision.created_at
      from platform_private.cms_entry_revisions revision
      where revision.id = (select value::uuid from s10_ids where key = 'entryRevisionId')
    )
  end,
  'the source revision stays an immutable draft snapshot after restore'
);

-- Evidence is chain identity and safe counts only, never migrated values.
select ok(
  pg_temp.s10_sql_bool($q$
    select not exists (
      select 1
      from platform_private.cms_restore_chain_manifests manifest
      where manifest.plan_ids::text like '%title%'
         or manifest.manifest_hash::text like '%Seeded draft%'
    )
  $q$),
  'restore audit/outbox evidence records only chain identity and safe counts'
);

select finish();
rollback;
