-- Slice 10 QA (WP-S10-3 fix): CMS-03B-04 restore across a REAL completed-plan
-- chain -- registered-transform application, rebinding to the target schema,
-- server-side hash recomputation, chain/edge binding and the same-schema
-- identity of a migrated type.
--
-- The chain is produced only by the real Slice 09 producers (successor,
-- dry-run, worker seal, review, backfill, activation) with two conditional
-- edges that name the registered identity.revalidate transform; no plan,
-- review, decision or backfill row is inserted by hand.  Tamper probes run in
-- rolled-back subtransactions and alter ONLY the evidence they name (with the
-- table's user triggers disabled for that one statement, as the Slice 09
-- time-warp helper does), so each refusal proves one binding of the immutable
-- chain and the shared chain stays pristine.

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

select pg_temp.s09d_grant_via_rpc('owner', 'cms.author', 1);
select pg_temp.s09d_guc_save();
select pg_temp.s09d_create_type('rbsrc', 'articlerb');
select pg_temp.s09d_to_active('rbsrc', array['rev1']);
select pg_temp.s09d_grant_via_rpc('owner', 'cms.author', 1);
select pg_temp.s09w_entry('rbe', 'rbsrc', 'Seed title');

-- Edge 1: a conditional candidate (identity.revalidate proves the tightened
-- title bound over every source row).
select pg_temp.s09d_successor('rbmid', 'rbsrc');
select pg_temp.s09d_dry_run('rbmid');
select pg_temp.s09w_dry_run('rbmid');
select pg_temp.s09w_tighten('rbmid', 40);
select pg_temp.s09d_dry_run('rbmid', 'owner', 'identity.revalidate', '1');
select pg_temp.s09w_dry_run('rbmid');
select pg_temp.s09d_submit('rbmid');
select pg_temp.s09d_assign('rbmid', 'rev2');
select pg_temp.s09d_decide('rbmid', 'rev2');
select pg_temp.s09w_backfill('rbmid');
select pg_temp.s09d_activate('rbmid');

-- Edge 2: a second conditional candidate over the first.
select pg_temp.s09d_successor('rbtgt', 'rbmid');
select pg_temp.s09d_dry_run('rbtgt');
select pg_temp.s09w_dry_run('rbtgt');
select pg_temp.s09w_tighten('rbtgt', 30);
select pg_temp.s09d_dry_run('rbtgt', 'owner', 'identity.revalidate', '1');
select pg_temp.s09w_dry_run('rbtgt');
select pg_temp.s09d_submit('rbtgt');
select pg_temp.s09d_assign('rbtgt', 'rev3');
select pg_temp.s09d_decide('rbtgt', 'rev3');
select pg_temp.s09w_backfill('rbtgt');
select pg_temp.s09d_activate('rbtgt');
select pg_temp.s09d_guc_restore();

create temp table s10b_chain on commit drop as
select entry.id as entry_id,
       (select revision.id from platform_private.cms_entry_revisions revision
        where revision.entry_id = entry.id order by revision.revision_number limit 1
       ) as revision_id,
       pg_temp.s09d_id('rbsrc:type') as type_id,
       pg_temp.s09d_id('rbsrc:version') as source_version_id,
       pg_temp.s09d_id('rbmid:version') as middle_version_id,
       pg_temp.s09d_id('rbtgt:version') as target_version_id,
       pg_temp.s09d_id('rbmid:plan') as first_plan_id,
       pg_temp.s09d_id('rbtgt:plan') as second_plan_id
from platform_private.cms_content_entries entry
where entry.content_type_id = pg_temp.s09d_id('rbsrc:type');

\ir phase_02_slice_10_restore_chain_rebind/000-helpers.sqlinc

select pg_temp.s09d_session('owner', 'service_role');
select set_config('app.cms_rpc', 'true', true);

-- Guard: the chain is two completed plans carrying the registered transform.
select ok(
  (select count(*) = 2
   from platform_private.cms_schema_migration_plans plan
   where plan.content_type_id = (select type_id from s10b_chain)
     and plan.state = 'completed'
     and plan.transform_key = 'identity.revalidate'),
  'the restore chain is two completed Slice 09 plans carrying the registered identity.revalidate transform'
);

-- The derivation is deterministic and ordered across both edges.
select ok(
  (select platform_private.cms_restore_chain_derive(
            chain.type_id, chain.source_version_id, chain.target_version_id
          )->'planIds'
          = jsonb_build_array(chain.first_plan_id, chain.second_plan_id)
      and (platform_private.cms_restore_chain_derive(
            chain.type_id, chain.source_version_id, chain.target_version_id
          )->>'edgeCount') = '2'
   from s10b_chain chain),
  'the derived chain orders both completed edges from the source schema to the active schema'
);

-- A same-schema restore of a migrated type is the zero-edge identity: a
-- completed plan that merely ENDS at the active version never makes a revision
-- already on that version ambiguous.
select ok(
  (select platform_private.cms_restore_chain_derive(
            chain.type_id, chain.target_version_id, chain.target_version_id
          )->>'edgeCount' = '0'
      and platform_private.cms_restore_chain_derive(
            chain.type_id, chain.target_version_id, chain.target_version_id
          )->'planIds' = '[]'::jsonb
   from s10b_chain chain),
  'a same-schema chain on the migrated active version is the zero-edge manifest, not an unavailable path'
);

-- ---------------------------------------------------------------------------
-- Multi-edge restore: transform application, rebinding and recomputed hashes.
-- ---------------------------------------------------------------------------
select pg_temp.s10_rpc_probe(
  'rebind_multi_edge', null,
  $sql$select pg_temp.s10b_observe(pg_temp.s10b_request('s10-rebind-multi-0001'), 1)$sql$
);

select is(
  pg_temp.s10_probe_state('rebind_multi_edge'), '00000',
  'a two-edge restore applies each registered transform and appends a draft'
);

select ok(
  (pg_temp.s10_probe_response('rebind_multi_edge')->'response'->'resource'->>'schemaVersionId')
    = (select target_version_id::text from s10b_chain)
    and (pg_temp.s10_probe_response('rebind_multi_edge')->'values'->>'title') = 'Seed title'
    and (pg_temp.s10_probe_response('rebind_multi_edge')->>'boundToTarget')::boolean
    and not (pg_temp.s10_probe_response('rebind_multi_edge')->>'sharesSourceDefinition')::boolean,
  'every restored value is rebound to the TARGET field definition, never the source definition row'
);

select ok(
  (pg_temp.s10_probe_response('rebind_multi_edge')->>'hashesRecomputed')::boolean
    and (pg_temp.s10_probe_response('rebind_multi_edge')->>'payloadRecomputed')::boolean,
  'the restored value hashes and the payload hash are recomputed server-side across the chain'
);

select ok(
  (pg_temp.s10_probe_response('rebind_multi_edge')->'manifest'->>'edgeCount') = '2'
    and (pg_temp.s10_probe_response('rebind_multi_edge')->'manifest'->'planIds')
      = (select jsonb_build_array(first_plan_id, second_plan_id) from s10b_chain)
    and (pg_temp.s10_probe_response('rebind_multi_edge')->'response'
      ->'restoreVerification'->'registry'->'chainSchemaVersionIds')
      = (select jsonb_build_array(source_version_id, middle_version_id, target_version_id)
         from s10b_chain),
  'the immutable manifest and the verification evidence carry the ordered edges and every schema version of the chain'
);

select ok(
  (pg_temp.s10_probe_response('rebind_multi_edge')->'response'->'resource'->'parentRevisionIds')
    = (select jsonb_build_array(revision_id, revision_id) from s10b_chain)
    and (pg_temp.s10_probe_response('rebind_multi_edge')->>'outboxCount')::integer = 1
    and (pg_temp.s10_probe_response('rebind_multi_edge')->>'auditCount')::integer = 1,
  'the draft records [currentDraftRevisionId, sourceRevisionId] and one outbox event and one audit record are committed'
);

select ok(
  (pg_temp.s10_probe_response('rebind_multi_edge')->>'replayEqual')::boolean
    and (pg_temp.s10_probe_response('rebind_multi_edge')->>'revisionCount')::integer = 2,
  'a replay after the entry advanced returns the first envelope with no second revision'
);

-- ---------------------------------------------------------------------------
-- Chain and edge bindings: each tamper refuses with the typed token.
-- ---------------------------------------------------------------------------
select pg_temp.s10_rpc_probe(
  'rebind_chain_mismatch', null,
  $sql$select pg_temp.s10b_observe(pg_temp.s10b_request(
    's10-rebind-mismatch-0001', null, null, null,
    'a9100000-0000-4000-8000-000000000903'))$sql$
);
select is(
  pg_temp.s10_probe_state('rebind_chain_mismatch') || ':'
    || pg_temp.s10_probe_message('rebind_chain_mismatch'),
  'P0001:migration_chain_mismatch',
  'a chain id that is not the derived two-edge identity is migration_chain_mismatch'
);

select pg_temp.s10_rpc_probe(
  'rebind_truncated_chain', null,
  $sql$select pg_temp.s10b_observe(pg_temp.s10b_request(
    's10-rebind-truncated-0001', null, (select middle_version_id from s10b_chain)))$sql$
);
select is(
  pg_temp.s10_probe_state('rebind_truncated_chain') || ':'
    || pg_temp.s10_probe_message('rebind_truncated_chain'),
  'P0001:migration_chain_mismatch',
  'the identity of the middle-to-active chain does not cover source to active and is refused as migration_chain_mismatch'
);

select pg_temp.s10_rpc_probe(
  'rebind_unregistered_transform',
  $setup$select pg_temp.s09d_timewarp('cms_schema_migration_plans',
    format($q$update platform_private.cms_schema_migration_plans
      set transform_key = 'ghost.transform' where id = %L$q$,
      (select second_plan_id from s10b_chain)))$setup$,
  $sql$select pg_temp.s10b_observe(pg_temp.s10b_request('s10-rebind-ghost-0001'))$sql$
);
select is(
  pg_temp.s10_probe_state('rebind_unregistered_transform') || ':'
    || pg_temp.s10_probe_message('rebind_unregistered_transform'),
  'P0001:migration_chain_incomplete',
  'an edge naming a transform the digest-verified registry cannot resolve is migration_chain_incomplete'
);

select pg_temp.s10_rpc_probe(
  'rebind_plan_not_completed',
  $setup$select pg_temp.s09d_timewarp('cms_schema_migration_plans',
    format($q$update platform_private.cms_schema_migration_plans
      set state = 'verifying' where id = %L$q$,
      (select first_plan_id from s10b_chain)))$setup$,
  $sql$select pg_temp.s10b_observe(pg_temp.s10b_request(
    's10-rebind-notdone-0001', null, null, null,
    'a9100000-0000-4000-8000-000000000903'))$sql$
);
select is(
  pg_temp.s10_probe_state('rebind_plan_not_completed') || ':'
    || pg_temp.s10_probe_message('rebind_plan_not_completed'),
  'P0001:migration_chain_unavailable',
  'a chain with an edge that is not a completed plan is migration_chain_unavailable, never guessed'
);

select pg_temp.s10_rpc_probe(
  'rebind_edge_without_activation',
  $setup$set constraints all immediate;
    select pg_temp.s09d_timewarp('cms_content_type_versions',
    format($q$update platform_private.cms_content_type_versions
      set state = 'approved'::platform_private.cms_definition_state,
          activation_workflow_policy_key = null,
          activation_workflow_policy_version = null,
          activation_workflow_policy_hash = null,
          activation_required_decision_count = null,
          activation_required_capabilities = null,
          activation_approval_evidence_hash = null
      where id = %L$q$,
      (select middle_version_id from s10b_chain)))$setup$,
  $sql$select pg_temp.s10b_observe(pg_temp.s10b_request('s10-rebind-noact-0001'))$sql$
);
select is(
  pg_temp.s10_probe_state('rebind_edge_without_activation') || ':'
    || pg_temp.s10_probe_message('rebind_edge_without_activation'),
  'P0001:migration_chain_unavailable',
  'an edge whose target version was never activated (no activation evidence) is not a registered chain edge'
);

select pg_temp.s10_rpc_probe(
  'rebind_foreign_edge',
  $setup$select pg_temp.s09d_timewarp('cms_schema_migration_plans',
    format($q$update platform_private.cms_schema_migration_plans
      set owner_id = 'a9100000-0000-4000-8000-0000000000fe' where id = %L$q$,
      (select first_plan_id from s10b_chain)))$setup$,
  $sql$select pg_temp.s10b_observe(pg_temp.s10b_request('s10-rebind-foreign-0001'))$sql$
);
select is(
  pg_temp.s10_probe_state('rebind_foreign_edge') || ':'
    || pg_temp.s10_probe_message('rebind_foreign_edge'),
  'P0001:migration_chain_unavailable',
  'a chain edge owned by another tenant is invisible to the restoring tenant: the chain is unavailable, never disclosed'
);

select pg_temp.s10_rpc_probe(
  'rebind_transform_cannot_prove',
  $setup$select pg_temp.s09d_timewarp('cms_entry_field_values',
    format($q$update platform_private.cms_entry_field_values
      set value = to_jsonb(repeat('x', 45)),
          value_hash = %L
      where revision_id = %L and provenance = 'authored'$q$,
      platform_private.cms_jcs_sha256(to_jsonb(repeat('x', 45))),
      (select revision_id from s10b_chain)));
    select pg_temp.s09d_timewarp('cms_entry_revisions',
      format($q$update platform_private.cms_entry_revisions
        set payload_hash = %L where id = %L$q$,
        platform_private.cms_jcs_sha256(jsonb_build_object(
          (select stable_field_id::text from platform_private.cms_field_definition_versions
           where content_type_version_id = (select source_version_id from s10b_chain)
             and field_key = 'title'), to_jsonb(repeat('x', 45)))),
        (select revision_id from s10b_chain)))$setup$,
  $sql$select pg_temp.s10b_observe(pg_temp.s10b_request('s10-rebind-prove-0001'))$sql$
);
select is(
  pg_temp.s10_probe_state('rebind_transform_cannot_prove') || ':'
    || pg_temp.s10_probe_message('rebind_transform_cannot_prove'),
  'P0001:migration_chain_incomplete',
  'a source value the registered transform cannot prove against the tightened target (45 > 40) refuses the restore'
);

select pg_temp.s10_rpc_probe(
  'rebind_key_other_chain',
  $setup$select platform_api.cms_restore_revision(pg_temp.s10b_request('s10-rebind-reuse-0001'))$setup$,
  $sql$select pg_temp.s10b_observe(pg_temp.s10b_request(
    's10-rebind-reuse-0001', null, (select middle_version_id from s10b_chain)))$sql$
);
select is(
  pg_temp.s10_probe_state('rebind_key_other_chain') || ':'
    || pg_temp.s10_probe_message('rebind_key_other_chain'),
  'P0001:IDEMPOTENCY_MISMATCH',
  'the idempotency business hash binds the selected migration chain across a real chain'
);

-- ---------------------------------------------------------------------------
-- Same-schema restore after the migration: restore the draft the multi-edge
-- restore produced (schema = active) onto the active schema.  Its chain is the
-- zero-edge manifest even though completed plans end at that version.
-- ---------------------------------------------------------------------------
select pg_temp.s10_rpc_probe(
  'rebind_same_schema_after_migration',
  $setup$select platform_api.cms_restore_revision(pg_temp.s10b_request('s10-rebind-first-0001'))$setup$,
  $sql$select pg_temp.s10b_observe(pg_temp.s10b_request(
    's10-rebind-same-0001',
    (select entry_row.current_draft_revision_id
     from platform_private.cms_content_entries entry_row
     where entry_row.id = (select entry_id from s10b_chain)),
    (select target_version_id from s10b_chain)))$sql$
);
select is(
  pg_temp.s10_probe_state('rebind_same_schema_after_migration'), '00000',
  'a same-schema restore of a revision already on the migrated active version succeeds with the zero-edge chain'
);
select ok(
  (pg_temp.s10_probe_response('rebind_same_schema_after_migration')->'manifest'->>'edgeCount') = '0'
    and (pg_temp.s10_probe_response('rebind_same_schema_after_migration')->'values'->>'title') = 'Seed title'
    and (pg_temp.s10_probe_response('rebind_same_schema_after_migration')->>'hashesRecomputed')::boolean
    and (pg_temp.s10_probe_response('rebind_same_schema_after_migration')->>'revisionCount')::integer = 3,
  'the zero-edge restore records the empty manifest and carries the value with recomputed hashes'
);

select pg_temp.s10_rpc_probe(
  'rebind_stale_entry_version',
  $setup$select platform_api.cms_restore_revision(pg_temp.s10b_request('s10-rebind-adv-0001'))$setup$,
  $sql$select platform_api.cms_restore_revision(
    pg_temp.s10b_request('s10-rebind-stale-0001') || jsonb_build_object('expectedVersion', '1'))$sql$
);
select is(
  pg_temp.s10_probe_state('rebind_stale_entry_version') || ':'
    || pg_temp.s10_probe_message('rebind_stale_entry_version'),
  'P0001:VERSION_MISMATCH',
  'a new key with the pre-restore entry version fails the entry-version CAS across a real chain (typed VERSION_MISMATCH, P0001; cascade P2-S10-AC-025, was 40001)'
);

-- Source immutability: the multi-edge restore never touched the source.
select ok(
  pg_temp.s10_sql_bool($q$
    select revision.state = 'draft' and revision.version = 1
       and revision.updated_at = revision.created_at
       and revision.schema_version_id = (select source_version_id from s10b_chain)
    from platform_private.cms_entry_revisions revision
    where revision.id = (select revision_id from s10b_chain)
  $q$),
  'the source revision is still an immutable snapshot on its recorded schema after the restores'
);

select ok(
  not exists (select 1 from platform_private.cms_restore_chain_manifests),
  'the rolled-back probes left no restore-chain manifest in the shared chain fixture'
);

-- Evidence hygiene: the manifest and the chain evidence name only identifiers.
select ok(
  not exists (
    select 1 from platform_private.cms_restore_chain_manifests manifest
    where manifest::text like '%Seed title%'
  ),
  'restore-chain evidence records only chain identity and safe counts, never migrated values'
);

select finish();
rollback;
