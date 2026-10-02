commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 DEC-108 QA-RED: DEFECT C, the /v1 artifact-reference hard-code
-- (BE03a "SchemaArtifact" row and the versioned-reference paragraph).  The
-- compiler addresses the artifact by its real version, `/v{versionNo}`; the
-- deterministic hash composes that reference, the compiler version and the
-- manifests; unchanged clones of v2 and v3 coexist under distinct hashes and
-- the source artifact is never mutated.

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec108/03-support.sqlinc

create or replace function pg_temp.s09d_artifact(p_tag text, p_column text) returns text
language sql stable as $body$
  select pg_temp.s09d_scalar(format('select %I::text from platform_private.cms_schema_artifacts where content_type_version_id = %L',
    p_column, pg_temp.s09d_id(p_tag || ':version')))
$body$;
create or replace function pg_temp.s09d_recomputed_hash(p_tag text) returns text
language sql stable as $body$
  select pg_temp.s09d_scalar(format($q$select platform_private.cms_jcs_sha256(jsonb_build_object(
      'compilerVersion', compiler_version, 'zodContractRef', zod_contract_ref,
      'editorManifest', editor_manifest, 'rendererManifest', renderer_manifest,
      'localeConfigHash', (select locale_config_hash from platform_private.cms_content_type_versions
                            where id = content_type_version_id)))
    from platform_private.cms_schema_artifacts where content_type_version_id = %L$q$,
    pg_temp.s09d_id(p_tag || ':version')))
$body$;

select ok(pg_temp.s09d_def('platform_private.cms_create_type_draft(jsonb)') <> ''
  and position('/v1' in pg_temp.s09d_def('platform_private.cms_create_type_draft(jsonb)')) = 0,
  'DEFECT C: the draft compiler no longer hard-codes a literal /v1 artifact reference');
select pg_temp.s09d_create_type('a', 'dec108ver');
select pg_temp.s09d_to_active('a');
create temp table s09d_v1_artifact on commit drop as
select pg_temp.s09d_scalar(format('select row_to_json(a)::text from platform_private.cms_schema_artifacts a where a.content_type_version_id = %L',
  pg_temp.s09d_id('a:version'))) as snapshot;
select is(pg_temp.s09d_read('cms_content_type_versions', 'state', pg_temp.s09d_id('a:version')), 'active',
  'fixture: version 1 is active via the real producers');

-- Version 2: an unchanged clone of the active v1.
select pg_temp.s09d_successor('b', 'a');
select is(pg_temp.s09d_outcome('b:successor'), 'OK', 'fixture: an unchanged successor draft (v2) was cloned');
select is(pg_temp.s09d_artifact('b', 'zod_contract_ref'), 'cms/content-type/dec108ver/v2',
  'the second version''s artifact is addressed cms/content-type/{typeKey}/v2');
select ok(pg_temp.s09d_artifact('b', 'artifact_hash') ~ '^[a-f0-9]{64}$'
  and pg_temp.s09d_artifact('b', 'artifact_hash') <> pg_temp.s09d_artifact('a', 'artifact_hash'),
  'an unchanged clone has a DISTINCT artifact hash from its source (no identical-artifact claim)');
select ok(pg_temp.s09d_artifact('b', 'artifact_hash') = pg_temp.s09d_recomputed_hash('b'),
  'the v2 hash is exactly the canonical SHA-256 of compilerVersion, versioned zodContractRef, both manifests and localeConfigHash (no salt)');
select ok(pg_temp.s09d_artifact('b', 'artifact_hash') is not null
  and pg_temp.s09d_artifact('b', 'artifact_hash') = pg_temp.s09d_read('cms_content_type_versions', 'definition_hash', pg_temp.s09d_id('b:version')),
  'the successor row''s definition hash is its own artifact hash');

-- Version 2 becomes active (second atomic switch), then version 3.
select pg_temp.s09d_to_active('b');
select is(pg_temp.s09d_read('cms_content_type_versions', 'state', pg_temp.s09d_id('b:version')), 'active',
  'fixture: version 2 activated beside the superseded version 1');
select pg_temp.s09d_successor('c', 'b');
select is(pg_temp.s09d_outcome('c:successor'), 'OK', 'fixture: an unchanged successor draft (v3) was cloned from v2');
select is(pg_temp.s09d_artifact('c', 'zod_contract_ref'), 'cms/content-type/dec108ver/v3',
  'the third version''s artifact is addressed cms/content-type/{typeKey}/v3');
select ok(pg_temp.s09d_artifact('c', 'artifact_hash') ~ '^[a-f0-9]{64}$'
  and pg_temp.s09d_artifact('c', 'artifact_hash') not in (pg_temp.s09d_artifact('a', 'artifact_hash'),
        pg_temp.s09d_artifact('b', 'artifact_hash')),
  'the v3 clone''s hash differs from both v1 and v2');
select ok(pg_temp.s09d_artifact('c', 'artifact_hash') = pg_temp.s09d_recomputed_hash('c'),
  'the v3 hash is exactly the canonical SHA-256 of its versioned composition');

-- Coexistence and source immutability.
select ok((select count(distinct artifact_hash) = 3 and count(*) = 3
    from platform_private.cms_schema_artifacts
    where content_type_version_id in (pg_temp.s09d_id('a:version'), pg_temp.s09d_id('b:version'), pg_temp.s09d_id('c:version'))),
  'three versions of one type coexist as three artifacts under three distinct hashes (global UNIQUE(artifact_hash) holds)');
select ok(exists (select 1 from pg_indexes where schemaname = 'platform_private' and tablename = 'cms_schema_artifacts'
    and indexdef ilike '%unique%artifact_hash%'), 'the global UNIQUE(artifact_hash) invariant is retained, not relaxed');
select is(pg_temp.s09d_artifact('a', 'zod_contract_ref'), 'cms/content-type/dec108ver/v1', 'the v1 artifact keeps its /v1 reference');
select ok(pg_temp.s09d_outcome('c:successor') = 'OK' and pg_temp.s09d_scalar(format('select row_to_json(a)::text from platform_private.cms_schema_artifacts a where a.content_type_version_id = %L',
    pg_temp.s09d_id('a:version'))) = (select snapshot from s09d_v1_artifact),
  'creating and activating successors never mutates the source artifact row');
select is(pg_temp.s09d_artifact('a', 'artifact_hash'), pg_temp.s09d_recomputed_hash('a'),
  'the v1 hash is the same versioned composition (compilerVersion, /v1, manifests)');
select ok(pg_temp.s09d_artifact('b', 'compiler_version') = pg_temp.s09d_artifact('a', 'compiler_version')
  and pg_temp.s09d_artifact('b', 'compiler_version') = pg_temp.s09d_artifact('c', 'compiler_version')
  and (select count(*) = 3 from platform_private.cms_schema_artifacts a
       where a.state = 'compiled' and a.content_type_version_id in
        (pg_temp.s09d_id('a:version'), pg_temp.s09d_id('b:version'), pg_temp.s09d_id('c:version'))),
  'every version carries a compiled artifact with the same compiler version');

select * from finish();
rollback;
