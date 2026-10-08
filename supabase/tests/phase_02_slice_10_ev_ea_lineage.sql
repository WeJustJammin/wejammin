-- Slice 10 evidence lane EA: recorded template and taxonomy lineage of compare and restore
-- (P2-S10-AC-002; IA03 "Comparison" row and CMS-07: a revision records its schema, template and
-- taxonomy versions, and an unresolvable recorded version is a non-disclosing refusal).
--
-- Restore (CMS-03B-04): a source revision that pins a taxonomy version must find that version
-- again for the owning tenant.  An unresolvable or foreign pin refuses the restore with the typed
-- migration_chain_incomplete and the restore of a resolvable pin carries the pinned taxonomy
-- version ids onto the new draft unchanged.
--
-- The compare-side counterpart (an unresolvable recorded taxonomy version) is the open
-- EVIDENCE GAP EA-AC002 recorded in phase_02_slice_10_ev_ea_gaps.sql; this file stays green.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_remaining_schema/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_10_restore_transform/000-restore-fixtures.sqlinc
\ir phase_02_slice_10_rpc/009-restore-policy-binding.sqlinc

-- A taxonomy version row for the given owner (the Slice 12 persistence foundation).
create or replace function pg_temp.s10l_taxonomy(p_id uuid, p_owner uuid, p_key text)
returns uuid
language plpgsql
as $body$
begin
  perform set_config('app.cms_rpc', 'true', true);
  insert into platform_private.cms_taxonomy_versions(
    id, owner_id, version, taxonomy_key, owner_capability, shape,
    allowlisted_type_keys, allowlisted_field_keys, content_hash, created_by
  ) values (
    p_id, p_owner, 1, p_key, 'cms.taxonomy_curator', 'flat',
    '[]'::jsonb, '[]'::jsonb, repeat('a', 64),
    (select value::uuid from s10_ids where key = 'creatorAuth')
  );
  return p_id;
end;
$body$;

-- Pins taxonomy versions on the SOURCE revision of forged slot 0 (the trigger-skipping replica
-- role is the only way to write an immutable snapshot; the probe rolls it back).
create or replace function pg_temp.s10l_pin_source(p_taxonomy jsonb)
returns void
language plpgsql
as $body$
begin
  set local session_replication_role = replica;
  update platform_private.cms_entry_revisions
     set taxonomy_version_ids = p_taxonomy
   where id = pg_temp.s10r_id(0, 2);
  set local session_replication_role = origin;
end;
$body$;

-- ---------------------------------------------------------------------------------------
-- CMS-03B-04 restore: the recorded taxonomy versions of the source revision.
-- ---------------------------------------------------------------------------------------
select pg_temp.s10_rpc_probe(
  'restore-taxonomy-unresolvable',
  $setup$select pg_temp.s10r_forge(jsonb_build_object('a9100000-0000-4000-8000-000000000601', 'Title'));
         select pg_temp.s10l_pin_source(jsonb_build_array('a9140000-0000-4000-8000-0000000000f1'))$setup$,
  $sql$select platform_api.cms_restore_revision(pg_temp.s10r_request('s10-ea-restore-tax-0001'))$sql$
);
select is(
  pg_temp.s10_probe_state('restore-taxonomy-unresolvable') || ':'
    || pg_temp.s10_probe_message('restore-taxonomy-unresolvable'),
  'P0001:migration_chain_incomplete',
  'a recorded taxonomy version that no longer resolves refuses the restore as migration_chain_incomplete'
);

select pg_temp.s10_rpc_probe(
  'restore-taxonomy-foreign-owner',
  $setup$select pg_temp.s10r_forge(jsonb_build_object('a9100000-0000-4000-8000-000000000601', 'Title'));
         select pg_temp.s10l_taxonomy(
           'a9140000-0000-4000-8000-0000000000f2',
           (select value::uuid from s10_ids where key = 'strangerPerson'), 'foreign-vocabulary');
         select pg_temp.s10l_pin_source(jsonb_build_array('a9140000-0000-4000-8000-0000000000f2'))$setup$,
  $sql$select platform_api.cms_restore_revision(pg_temp.s10r_request('s10-ea-restore-tax-0002'))$sql$
);
select is(
  pg_temp.s10_probe_state('restore-taxonomy-foreign-owner') || ':'
    || pg_temp.s10_probe_message('restore-taxonomy-foreign-owner'),
  'P0001:migration_chain_incomplete',
  'a recorded taxonomy version owned by another tenant never satisfies the restore'
);

select pg_temp.s10_rpc_probe(
  'restore-taxonomy-resolvable',
  $setup$select pg_temp.s10r_forge(jsonb_build_object('a9100000-0000-4000-8000-000000000601', 'Title'));
         select pg_temp.s10l_taxonomy(
           'a9140000-0000-4000-8000-0000000000f3',
           (select value::uuid from s10_ids where key = 'organization'), 'own-vocabulary');
         select pg_temp.s10l_pin_source(jsonb_build_array('a9140000-0000-4000-8000-0000000000f3'))$setup$,
  $sql$select platform_api.cms_restore_revision(pg_temp.s10r_request('s10-ea-restore-tax-0003'))$sql$
);
select is(
  pg_temp.s10_probe_state('restore-taxonomy-resolvable'), '00000',
  'a recorded taxonomy version that still resolves for the owner lets the restore proceed'
);
select is(
  pg_temp.s10_probe_response('restore-taxonomy-resolvable')->'resource'->'taxonomyVersionIds',
  jsonb_build_array('a9140000-0000-4000-8000-0000000000f3'),
  'the restored draft records exactly the taxonomy version ids of its source revision'
);
select is(
  pg_temp.s10_probe_response('restore-taxonomy-resolvable')->'resource'->>'schemaVersionId',
  (select value from s10_ids where key = 'restoreVersionId'),
  'the restored draft records the active schema version the chain ends on'
);

-- ---------------------------------------------------------------------------------------
-- The migration-chain manifest a restore binds is immutable once recorded.
-- ---------------------------------------------------------------------------------------
select pg_temp.s10_rpc_probe(
  'manifest-update',
  $setup$select pg_temp.s10r_forge(jsonb_build_object('a9100000-0000-4000-8000-000000000601', 'Title'));
         select platform_api.cms_restore_revision(pg_temp.s10r_request('s10-ea-manifest-0001'))$setup$,
  $sql$update platform_private.cms_restore_chain_manifests set edge_count = edge_count returning to_jsonb(cms_restore_chain_manifests)$sql$
);
select is(
  pg_temp.s10_probe_state('manifest-update') <> '00000'
    and pg_temp.s10_probe_message('manifest-update') ~* 'immutable',
  true,
  'a recorded restore-chain manifest cannot be updated'
);
select pg_temp.s10_rpc_probe(
  'manifest-delete',
  $setup$select pg_temp.s10r_forge(jsonb_build_object('a9100000-0000-4000-8000-000000000601', 'Title'));
         select platform_api.cms_restore_revision(pg_temp.s10r_request('s10-ea-manifest-0002'))$setup$,
  $sql$delete from platform_private.cms_restore_chain_manifests returning to_jsonb(cms_restore_chain_manifests)$sql$
);
select is(
  pg_temp.s10_probe_state('manifest-delete') <> '00000'
    and pg_temp.s10_probe_message('manifest-delete') ~* 'immutable',
  true,
  'a recorded restore-chain manifest cannot be deleted'
);

select * from finish();
rollback;
