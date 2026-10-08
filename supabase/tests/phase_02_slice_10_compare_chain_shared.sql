-- Slice 10 QA-RED/GREEN: shared restore-chain derivation for the comparison
-- descriptor (finding 27/28, coordinated with the restore lane's 10500).
--
-- The compare producer (10400) derives compare.restore from the SAME canonical
-- chain helpers the restore command (10500) uses:
--   * platform_private.cms_restore_chain_derive(uuid, uuid, uuid) -> jsonb;
--   * platform_private.cms_restore_chain_manifest_id(text) -> uuid.
-- The prior in-producer re-derivation was md5/v5-shaped and diverged from the
-- canonical UUID shaping (manifest_id: version nibble '4', variant '8'), so a
-- compare-derived chain id and a restore-required chain id could disagree.
-- With the shared helpers the compare-side chain id, hash, edge count and
-- availability equal what restore requires, and an ambiguous/unreachable
-- chain is compare 'chain_unavailable' / restore 'migration_chain_unavailable'
-- rather than fabricated.  The comparison lineage, relation token and 512-change
-- ceiling of the same producer are pinned in phase_02_slice_10_compare_lineage.
--
-- Harness: the history/compare read requires the per-environment Vault signing
-- key that no migration provisions (see rpc/005-history.sqlinc), so the suite
-- creates its transaction-local test key first.  pg_temp.s10_fn_body lives in
-- phase_02_slice_10_signed_read/002-compare-helpers.sqlinc.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_remaining_schema/000-helpers.sqlinc
\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec108/03-support.sqlinc
\ir phase_02_slice_09_dec108/04-worker.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_10_rpc/009-restore-policy-binding.sqlinc
\ir phase_02_slice_10_signed_read/002-compare-helpers.sqlinc

-- Multi-edge producer setup: a real two-edge chain of COMPLETED 03a plans and a
-- source entry created through the real CMS-03B-10 command, built by the real
-- Slice 09 producers only (the same construction as
-- phase_02_slice_10_restore_chain.sql).  No plan, review, decision or chain row
-- is inserted by hand.  The dec108 owner receipt refuses once any cms.% grant
-- exists, so the owner gains cms.author through the real CMS-03A-15 command.
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

-- The signing key is a per-environment Vault secret that no migration
-- provisions; this fixed key exists only inside the rolled-back transaction.
select vault.create_secret(
  repeat('a1', 32),
  'cms_editorial_history_cursor_active',
  'pgTAP transaction-only CMS-03B-03 test key'
);

-- The canonical helpers from 10500 exist with the shared signatures (guard).
select ok(
  pg_temp.s10_fn_exists(
    'platform_private', 'cms_restore_chain_derive', 'uuid, uuid, uuid'
  )
    and pg_temp.s10_fn_exists(
      'platform_private', 'cms_restore_chain_manifest_id', 'text'
    ),
  'canonical restore-chain helpers exist for the shared derivation (guard)'
);

-- Producer body: the compare implementation must call the canonical helpers
-- and no longer inline its own md5/v5 chain derivation.
create temp table s10_compare_chain_body on commit drop as
select pg_temp.s10_fn_body(
  'platform_private', 'cms_list_revisions', 'jsonb'
) as body;

select ok(
  (select body like '%cms_restore_chain_derive(%'
      and body like '%cms_restore_chain_manifest_id(%'
   from s10_compare_chain_body),
  'CMS-07 compare derives restore chains through the canonical 10500 helpers'
);

select ok(
  (select body !~ '(?s)substr\(pg_catalog\.md5\('
   from s10_compare_chain_body),
  'CMS-07 compare no longer inlines an md5/v5 chain UUID derivation'
);

-- The shared signed-cursor and lineage helpers are private: no API role may
-- execute them, and the unsigned reader and its signed wrapper stay private.
select ok(
  not pg_temp.s10_fn_privilege(
      'platform_private', 'cms_signed_cursor_open', 'text, jsonb, text[]',
      'service_role')
    and not pg_temp.s10_fn_privilege(
      'platform_private', 'cms_signed_cursor_open', 'text, jsonb, text[]',
      'authenticated')
    and not pg_temp.s10_fn_privilege(
      'platform_private', 'cms_signed_cursor_seal_page', 'text, jsonb, text[]',
      'service_role')
    and not pg_temp.s10_fn_privilege(
      'platform_private', 'cms_signed_cursor_require_key', '', 'service_role')
    and not pg_temp.s10_fn_privilege(
      'platform_private', 'cms_compare_revision_resolvable', 'uuid, uuid',
      'service_role')
    and not pg_temp.s10_fn_privilege(
      'platform_private', 'cms_compare_version_resolvable', 'uuid, uuid',
      'service_role')
    and not pg_temp.s10_fn_privilege(
      'platform_private', 'cms_compare_relation_token',
      'text, bytea, uuid, uuid, text, uuid', 'service_role')
    and not pg_temp.s10_fn_privilege(
      'platform_private', 'cms_list_revisions', 'jsonb', 'service_role')
    and not pg_temp.s10_fn_privilege(
      'platform_private', 'cms_list_revisions_signed', 'jsonb', 'service_role'),
  'CMS-03B-03 shared cursor and lineage helpers are not executable by any API role'
);

-- The entry fixture and both compare sides resolve through the seeded author.
select pg_temp.s10_rpc_as(
  'a9100000-0000-4000-8000-000000000001'::uuid,
  (select value::uuid from s10_ids where key = 'organization')
);

create temp table s10_compare_chain_call on commit drop as
select pg_temp.s10_rpc_exec(pg_temp.s10_compare_sql()) as response;

select is(
  pg_temp.s10_last_error_state(), '00000',
  'CMS-07 compare read succeeds on the seeded revision pair'
);

-- The same-schema compare returns the zero-edge chain: the descriptor is the
-- canonical manifest id for the derived hash and equals what restore requires.
-- (The chain derivation reads the forced-RLS plan table as a definer, so a
-- direct call holds the RPC context for the statement only.)
select set_config('app.cms_rpc', 'true', true);
select ok(
  (
    select response->'compare'->'restore' is not null
       and response->'compare'->'restore'->>'migrationChainId'
         = platform_private.cms_restore_chain_manifest_id(
             platform_private.cms_restore_chain_derive(
               (select value::uuid from s10_ids where key = 'typeId'),
               (select value::uuid from s10_ids where key = 'draftVersionId'),
               (select value::uuid from s10_ids where key = 'draftVersionId')
             )->>'hash'
           )::text
       and response->'compare'->'restore'->>'chainHash'
         = platform_private.cms_restore_chain_derive(
             (select value::uuid from s10_ids where key = 'typeId'),
             (select value::uuid from s10_ids where key = 'draftVersionId'),
             (select value::uuid from s10_ids where key = 'draftVersionId')
           )->>'hash'
       and response->'compare'->'restore'->>'availability' = 'available'
       and (response->'compare'->'restore'->>'edgeCount')::int = 0
   from s10_compare_chain_call
  ),
  'CMS-07 compare.restore chain id equals the canonical restore derivation'
);
select set_config('app.cms_rpc', '', true);

-- Parity: restore accepts the compare-derived chain id verbatim (the restore
-- command re-derives the same identity from the same helpers, so a
-- compare-issued migrationChainId cannot mismatch).
create temp table s10_restore_request on commit drop as
select jsonb_build_object(
  'entryId', (select value from s10_ids where key = 'entryId'),
  'revisionId', (select value from s10_ids where key = 'entryRevisionId'),
  'migrationChainId',
    (select response->'compare'->'restore'->>'migrationChainId'
     from s10_compare_chain_call),
  'expectedVersion', '1',
  'idempotencyKey', 's10-compare-parity-0001'
) as request;

select pg_temp.s10_rpc_probe(
  'restore-accepts-compare-chain-id',
  null,
  'select platform_private.cms_restore_revision('
    || quote_literal((select request::text from s10_restore_request))
    || '::jsonb)'
);
select is(
  pg_temp.s10_probe_state('restore-accepts-compare-chain-id'), '00000',
  'CMS-07/CMS-03B-04 parity: restore accepts the compare-derived chain id'
);

-- The compare restore descriptor keeps the locked safe shape.
select ok(
  (
    select platform_private.cms_exact_keys(
             response->'compare'->'restore',
             array[
               'migrationChainId', 'edgeCount', 'chainHash', 'availability'
             ]::text[],
             array[
               'migrationChainId', 'edgeCount', 'chainHash', 'availability'
             ]::text[]
           )
   from s10_compare_chain_call
  ),
  'CMS-07 compare.restore carries the locked four-key descriptor'
);

-- ---------------------------------------------------------------------------
-- Multi-edge parity: the compare descriptor over a real two-edge completed
-- chain equals the identity restore re-derives from the same canonical helpers.
-- ---------------------------------------------------------------------------
select pg_temp.s09d_session('owner', 'service_role');
select pg_temp.s09d_rpc(
  'compare-multi-edge', 'platform_api.cms_list_revisions', 'owner',
  jsonb_build_object(
    'entryId', (select entry_id::text from s10_chain),
    'compareRevisionId', (select revision_id::text from s10_chain)
  )
);
select is(
  pg_temp.s09d_outcome('compare-multi-edge'), 'OK',
  'CMS-07 compare reads a real source revision under the signed cursor wrapper'
);
select set_config('app.cms_rpc', 'true', true);
select ok(
  (
    select response->'compare'->'restore'->>'migrationChainId'
         = platform_private.cms_restore_chain_manifest_id(
             platform_private.cms_restore_chain_derive(
               (select type_id from s10_chain),
               (select source_version_id from s10_chain),
               (select target_version_id from s10_chain)
             )->>'hash'
           )::text
       and response->'compare'->'restore'->>'chainHash'
         = platform_private.cms_restore_chain_derive(
             (select type_id from s10_chain),
             (select source_version_id from s10_chain),
             (select target_version_id from s10_chain)
           )->>'hash'
       and (response->'compare'->'restore'->>'edgeCount')::int = 2
       and response->'compare'->'restore'->>'availability' = 'available'
   from (select pg_temp.s09d_resp('compare-multi-edge') as response) probe
  ),
  'CMS-07 compare.restore over a two-edge completed chain equals the canonical restore derivation'
);
select set_config('app.cms_rpc', '', true);

-- A completed edge that is no longer completed breaks the path: the descriptor
-- is chain_unavailable, still the locked safe shape, never a fabricated chain.
select pg_temp.s10_rpc_probe(
  'compare-chain-broken',
  pg_temp.s10_sql_replica($sql$
    update platform_private.cms_schema_migration_plans
    set state = 'draft'
    where from_version_id = (select source_version_id from s10_chain)
      and state = 'completed';
  $sql$),
  format(
    'select platform_api.cms_list_revisions(%L::jsonb)',
    jsonb_build_object(
      'entryId', (select entry_id::text from s10_chain),
      'compareRevisionId', (select revision_id::text from s10_chain),
      'context', pg_temp.s09d_context('owner')
    )::text
  )
);
select ok(
  pg_temp.s10_probe_state('compare-chain-broken') = '00000'
    and (select response->'compare'->'restore'->>'availability'
              = 'chain_unavailable'
            and (response->'compare'->'restore'->>'edgeCount')::int = 0
            and response->'compare'->'restore'->>'chainHash' ~ '^[a-f0-9]{64}$'
            and response->'compare'->'restore'->>'migrationChainId'
              = platform_private.cms_restore_chain_manifest_id(
                  response->'compare'->'restore'->>'chainHash'
                )::text
         from (select pg_temp.s10_probe_response('compare-chain-broken')
                 as response) probe),
  'CMS-07 an unreachable chain is chain_unavailable with a well-formed descriptor'
);

-- A plan whose transform is not registered is transform_missing.  A transform
-- is only admitted on a conditional/breaking classification (03a plan check).
select pg_temp.s10_rpc_probe(
  'compare-transform-missing',
  pg_temp.s10_sql_replica($sql$
    update platform_private.cms_schema_migration_plans
    set classification = 'conditional',
        transform_key = 'unregistered.transform', transform_version = 1
    where from_version_id = (select source_version_id from s10_chain)
      and state = 'completed';
  $sql$),
  format(
    'select platform_api.cms_list_revisions(%L::jsonb)',
    jsonb_build_object(
      'entryId', (select entry_id::text from s10_chain),
      'compareRevisionId', (select revision_id::text from s10_chain),
      'context', pg_temp.s09d_context('owner')
    )::text
  )
);
select ok(
  pg_temp.s10_probe_state('compare-transform-missing') = '00000'
    and (select response->'compare'->'restore'->>'availability'
              = 'transform_missing'
            and (response->'compare'->'restore'->>'edgeCount')::int = 2
         from (select pg_temp.s10_probe_response('compare-transform-missing')
                 as response) probe),
  'CMS-07 a completed plan without a registered transform is transform_missing'
);

select finish();
rollback;
