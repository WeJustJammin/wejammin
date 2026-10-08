-- RESTORED by lane EA (2026-10-07 19:50): this is the original supabase/tests/phase_02_slice_10_compare_lineage.sql
-- (backup ref refs/backup/s10-integration-5), whose 15 runtime assertions (relation targetToken, block registry,
-- domain ordering, lineage refusals, exactly-512 / 513 combined changes) were overwritten when lane H round 3 wrote
-- its taxonomy/template assertions into the same path.  Kept unchanged as a separate entrypoint so the runtime
-- evidence of AC-016 / AC-020 is not lost; lane H's round 3 file keeps its own name.
-- Slice 10 QA-RED/GREEN: CMS-03B-03 comparison lineage, relation token and
-- change ceiling (BE03b Request/Response Contracts, comparison section).
--
-- The comparison producer (10400) must
--   * key every relation change by the stable field id and the keyed
--     targetToken: lowercase hex HMAC-SHA-256 over
--     'cms.compare.relation.v1:' || JCS({entryId, fieldId, targetKind,
--     targetId}) with the Vault signing key, identical on both sides of one
--     read, never publishing the target identity;
--   * order changes by domain (field, block, relation) and hash blocks over
--     the locked {blockKey, blockVersion, blockRegistryDigest, mode,
--     patternRef, props, bindings} input;
--   * refuse a side whose lineage cannot be resolved -- owner, content type,
--     compiled artifact hash, 03a block registry, ambiguous or over-long block
--     pointer, relation to a stable field -- as the non-disclosing
--     comparison_unavailable, never a partial answer;
--   * accept exactly 512 combined changes and refuse 513 with the typed
--     comparison_too_large (never a truncated 200 or a scrubbed
--     INTERNAL_ERROR).
--
-- Harness: the compare read requires the per-environment Vault signing key that
-- no migration provisions (see rpc/005-history.sqlinc), so the suite creates its
-- transaction-local test key first; each corruption runs inside a rolled-back
-- pg_temp.s10_rpc_probe with row triggers skipped by the replica role.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_remaining_schema/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_10_signed_read/002-compare-helpers.sqlinc

select vault.create_secret(
  repeat('a1', 32),
  'cms_editorial_history_cursor_active',
  'pgTAP transaction-only CMS-03B-03 test key'
);

select pg_temp.s10_rpc_as(
  'a9100000-0000-4000-8000-000000000001'::uuid,
  (select value::uuid from s10_ids where key = 'organization')
);

-- ---------------------------------------------------------------------------
-- Relation targetToken.  The seeded revision carries one relation whose target
-- is the entry itself.  Its change path is /relations/<stableFieldId>/<token>,
-- the same relation on both sides is "unchanged" with identical side hashes,
-- and the target identity is never published.
-- ---------------------------------------------------------------------------
create temp table s10_lineage_base on commit drop as
select pg_temp.s10_rpc_exec(pg_temp.s10_compare_sql()) as response;

select is(
  pg_temp.s10_last_error_state(), '00000',
  'CMS-07 compare read succeeds on the seeded revision pair'
);

select ok(
  (
    select count(*) = 1
       and bool_and(
         change->>'domain' = 'relation'
         and change->>'kind' = 'unchanged'
         and change->>'path' = '/relations/'
           || (select value from s10_ids where key = 'typeRelationFieldId')
           || '/' || encode(extensions.hmac(
                convert_to(
                  'cms.compare.relation.v1:' || platform_private.cms_jcs(
                    jsonb_build_object(
                      'entryId', (select value from s10_ids where key = 'entryId'),
                      'fieldId', (select value from s10_ids
                                  where key = 'typeRelationFieldId'),
                      'targetKind', 'content',
                      'targetId', (select value from s10_ids where key = 'entryId')
                    )
                  ),
                  'utf8'
                ),
                decode(repeat('a1', 32), 'hex'),
                'sha256'
              ), 'hex')
         and change->>'leftHash' = change->>'rightHash'
         and change->>'leftHash' = platform_private.cms_jcs_sha256(
           jsonb_build_object(
             'relationDefinitionVersion', (
               select definition_row.version
               from platform_private.cms_relation_definitions definition_row
               join platform_private.cms_entry_relations relation_row
                 on relation_row.field_definition_id
                    = definition_row.field_definition_id
               where relation_row.revision_id
                 = (select value::uuid from s10_ids where key = 'entryRevisionId')
             ),
             'position', 0,
             'expectedTargetVersion', 1
           )
         )
       )
   from s10_lineage_base base,
        lateral jsonb_array_elements(base.response->'compare'->'changes') change
   where change->>'domain' = 'relation'
  ),
  'CMS-07 relation change is keyed by the stable field id and the locked keyed targetToken, stable across both sides'
);
select ok(
  (select position(
            (select value from s10_ids where key = 'entryId')
            in (response->'compare')::text
          ) = 0
   from s10_lineage_base),
  'CMS-07 compare output never publishes the relation target identity'
);

-- ---------------------------------------------------------------------------
-- Block domain: ordering, the locked side hash, and 03a block registry
-- resolution.
-- ---------------------------------------------------------------------------
select pg_temp.s10_rpc_probe(
  'compare-block-unregistered',
  pg_temp.s10_sql_replica(pg_temp.s10_sql_instances($$'/hero'$$)),
  pg_temp.s10_compare_sql()
);
select is(
  pg_temp.s10_probe_message('compare-block-unregistered'),
  'comparison_unavailable',
  'CMS-07 a block that does not resolve through the 03a registry is comparison_unavailable'
);

select pg_temp.s10_rpc_probe(
  'compare-block-registered',
  pg_temp.s10_sql_replica(
    pg_temp.s10_sql_block_definition() || pg_temp.s10_sql_instances($$'/hero'$$)
  ),
  pg_temp.s10_compare_sql()
);
select is(
  pg_temp.s10_probe_state('compare-block-registered'), '00000',
  'CMS-07 a block resolving through the 03a registry compares'
);
select is(
  (select jsonb_path_query_array(
            response->'compare'->'changes', '$[*].domain')
   from (select pg_temp.s10_probe_response('compare-block-registered')
           as response) probe),
  '["field", "block", "relation"]'::jsonb,
  'CMS-07 changes are ordered by domain: field, then block, then relation'
);
select ok(
  (select change->>'path' = '/blocks//hero'
      and change->>'kind' = 'unchanged'
      and change->>'leftHash' = platform_private.cms_jcs_sha256(
        jsonb_build_object(
          'blockKey', 'profile.header',
          'blockVersion', 1,
          'blockRegistryDigest', repeat('a', 64),
          'mode', 'detached',
          'patternRef', null,
          'props', '{}'::jsonb,
          'bindings', '{}'::jsonb
        ))
      and change->>'leftHash' = change->>'rightHash'
   from pg_temp.s10_probe_capture capture,
        lateral jsonb_array_elements(capture.response->'compare'->'changes') change
   where capture.label = 'compare-block-registered'
     and change->>'domain' = 'block'),
  'CMS-07 block side hash is the locked JCS {blockKey, blockVersion, blockRegistryDigest, mode, patternRef, props, bindings} input'
);

-- Two active instances on one path would silently collapse into one change,
-- and a /blocks/<path> pointer beyond the 256-character JsonPointer contract
-- could never be returned intact: each is refused, never partial.
select pg_temp.s10_rpc_probe(
  'compare-block-duplicate-path',
  pg_temp.s10_sql_replica(
    pg_temp.s10_sql_block_definition()
      || pg_temp.s10_sql_instances($$'/hero'$$, 2, true)
  ),
  pg_temp.s10_compare_sql()
);
select is(
  pg_temp.s10_probe_message('compare-block-duplicate-path'),
  'comparison_unavailable',
  'CMS-07 two active block instances on one path are comparison_unavailable, never a collapsed diff'
);
select pg_temp.s10_rpc_probe(
  'compare-block-long-path',
  pg_temp.s10_sql_replica(
    pg_temp.s10_sql_block_definition()
      || pg_temp.s10_sql_instances($$'/' || repeat('p', 300)$$)
  ),
  pg_temp.s10_compare_sql()
);
select is(
  pg_temp.s10_probe_message('compare-block-long-path'),
  'comparison_unavailable',
  'CMS-07 a block pointer beyond the 256-character JSON Pointer contract is comparison_unavailable'
);

-- ---------------------------------------------------------------------------
-- Combined-change ceiling: the seeded pair carries one field and one relation
-- change, so 510 block instances make exactly 512 combined changes (accepted)
-- and 511 make 513 (the typed comparison_too_large refusal).
-- ---------------------------------------------------------------------------
select pg_temp.s10_rpc_probe(
  'compare-512-changes',
  pg_temp.s10_sql_replica(
    pg_temp.s10_sql_block_definition()
      || pg_temp.s10_sql_instances($$'/b' || lpad(n::text, 4, '0')$$, 510)
  ),
  pg_temp.s10_compare_sql()
);
select ok(
  pg_temp.s10_probe_state('compare-512-changes') = '00000'
    and (select jsonb_array_length(response->'compare'->'changes') = 512
         from (select pg_temp.s10_probe_response('compare-512-changes')
                 as response) probe),
  'CMS-07 exactly 512 combined changes is still a complete 200'
);
select pg_temp.s10_rpc_probe(
  'compare-513-changes',
  pg_temp.s10_sql_replica(
    pg_temp.s10_sql_block_definition()
      || pg_temp.s10_sql_instances($$'/b' || lpad(n::text, 4, '0')$$, 511)
  ),
  pg_temp.s10_compare_sql()
);
select is(
  pg_temp.s10_probe_message('compare-513-changes'), 'comparison_too_large',
  'CMS-07 513 combined changes is the typed comparison_too_large refusal, never partial'
);

-- ---------------------------------------------------------------------------
-- Lineage refusals.
-- ---------------------------------------------------------------------------
select pg_temp.s10_rpc_probe(
  'compare-artifact-hash-drift',
  pg_temp.s10_sql_replica($sql$
    update platform_private.cms_schema_artifacts
    set artifact_hash = repeat('f', 64)
    where id = (select value::uuid from s10_ids where key = 'typeArtifactId');
  $sql$),
  pg_temp.s10_compare_sql()
);
select is(
  pg_temp.s10_probe_message('compare-artifact-hash-drift'),
  'comparison_unavailable',
  'CMS-07 a recorded schema whose artifact hash differs from its definition hash is comparison_unavailable'
);

select pg_temp.s10_rpc_probe(
  'compare-content-type-lineage',
  pg_temp.s10_sql_replica($sql$
    insert into platform_private.cms_content_types(
      id, owner_id, state, type_key, owner_capability, created_by
    )
    select 'a9100000-0000-4000-8000-000000000521', owner.value::uuid,
           'active', 'other_type', 'cms.schema_designer', creator.value::uuid
    from s10_ids owner, s10_ids creator
    where owner.key = 'organization' and creator.key = 'creatorAuth';
    update platform_private.cms_content_entries
    set content_type_id = 'a9100000-0000-4000-8000-000000000521'
    where id = (select value::uuid from s10_ids where key = 'entryId');
  $sql$),
  pg_temp.s10_compare_sql()
);
select is(
  pg_temp.s10_probe_message('compare-content-type-lineage'),
  'comparison_unavailable',
  'CMS-07 a revision whose schema version belongs to another content type is comparison_unavailable'
);

select pg_temp.s10_rpc_probe(
  'compare-owner-lineage',
  pg_temp.s10_sql_replica($sql$
    update platform_private.cms_entry_revisions
    set owner_id = 'a9100000-0000-4000-8000-000000000999'
    where id = (select value::uuid from s10_ids where key = 'entryRevisionId');
  $sql$),
  pg_temp.s10_compare_sql()
);
select is(
  pg_temp.s10_probe_message('compare-owner-lineage'),
  'comparison_unavailable',
  'CMS-07 a revision whose owner differs from its entry owner is comparison_unavailable'
);

select pg_temp.s10_rpc_probe(
  'compare-relation-lineage',
  pg_temp.s10_sql_replica($sql$
    update platform_private.cms_entry_relations
    set field_id = 'a9100000-0000-4000-8000-000000000998'
    where revision_id = (select value::uuid from s10_ids where key = 'entryRevisionId');
  $sql$),
  pg_temp.s10_compare_sql()
);
select is(
  pg_temp.s10_probe_message('compare-relation-lineage'),
  'comparison_unavailable',
  'CMS-07 a stored relation that does not resolve to its stable field and relation definition is comparison_unavailable'
);

select finish();
rollback;
