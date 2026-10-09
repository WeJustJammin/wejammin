-- Slice 11 shared helpers: platform_private.cms_version_set_of and
-- cms_version_set_matches_manifest (BE03b "Frozen dependency manifest build and
-- version set (E1, E7)"; tracker P2-S11-AC-089).  RED before 20261005017520,
-- GREEN after.
--
-- The VersionSet is the PURE projection versionSetOf(manifest, revision): the
-- SQL functions must equal the TypeScript versionSetOf / versionSetMatchesManifest
-- (packages/contracts/src/cms-editorial/version-set.ts) on shared fixtures.  The
-- fixtures live in ONE file both sides read (version-set-parity.sqlinc); the
-- expected version sets were derived independently of this SQL and verified with
-- the TypeScript function and the strict DependencyManifest/VersionSet Zod schemas.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(51);

\ir phase_02_slice_11_helpers/000-helpers.sqlinc
\ir phase_02_slice_11_helpers/version-set-parity.sqlinc

create temp table h11_parity on commit drop as
select (ord - 1)::integer as idx,
       fixture->>'name' as name,
       fixture->'manifest' as manifest,
       fixture->'taxonomyVersionIds' as taxonomy,
       fixture->'expectedVersionSet' as expected
from jsonb_array_elements(:'parity_fixture'::jsonb) with ordinality as t(fixture, ord);

select is((select count(*)::integer from h11_parity), 3,
  'the shared parity file carries three fixtures [P2-S11-AC-089]');

-- ---------------------------------------------------------------------------
-- Shape and privileges.
-- ---------------------------------------------------------------------------
select ok(
  pg_temp.h11_private_definer('cms_version_set_of(jsonb, jsonb)')
    and pg_temp.h11_private_definer('cms_version_set_matches_manifest(jsonb, jsonb)'),
  'both projection helpers are private SECURITY DEFINER functions of the CMS definer with an empty search_path and no API-role execute [P2-S11-AC-089]'
);
select is(pg_temp.h11_rettype('cms_version_set_of(jsonb, jsonb)'), 'jsonb',
  'cms_version_set_of returns jsonb [P2-S11-AC-089]');
select is(pg_temp.h11_rettype('cms_version_set_matches_manifest(jsonb, jsonb)'), 'boolean',
  'cms_version_set_matches_manifest returns boolean [P2-S11-AC-089]');
select ok(
  pg_temp.h11_volatility('cms_version_set_of(jsonb, jsonb)') = 'i'
    and pg_temp.h11_volatility('cms_version_set_matches_manifest(jsonb, jsonb)') = 'i',
  'both projection helpers are IMMUTABLE (pure, no table access) [P2-S11-AC-089]'
);

-- ---------------------------------------------------------------------------
-- Parity with the TypeScript projection on each shared fixture.
-- ---------------------------------------------------------------------------
select is(
  pg_temp.h11_json(format('select platform_private.cms_version_set_of(%L::jsonb, %L::jsonb)',
    (select manifest::text from h11_parity where idx = 0), (select taxonomy::text from h11_parity where idx = 0))),
  (select expected from h11_parity where idx = 0),
  'parity fixture 0: the minimal manifest projects to the expected version set (null template, empty groups) [P2-S11-AC-089]'
);
select is(
  pg_temp.h11_json(format('select platform_private.cms_version_set_of(%L::jsonb, %L::jsonb)',
    (select manifest::text from h11_parity where idx = 1), (select taxonomy::text from h11_parity where idx = 1))),
  (select expected from h11_parity where idx = 1),
  'parity fixture 1: the full manifest projects to the expected version set (template, blocks, patterns, settings 12, compiler 1.9) [P2-S11-AC-089]'
);
select is(
  pg_temp.h11_json(format('select platform_private.cms_version_set_of(%L::jsonb, %L::jsonb)',
    (select manifest::text from h11_parity where idx = 2), (select taxonomy::text from h11_parity where idx = 2))),
  (select expected from h11_parity where idx = 2),
  'parity fixture 2: unsorted taxonomy ids are sorted bytewise ascending [P2-S11-AC-089]'
);

select is(
  (select expected->'taxonomyVersionIds' from h11_parity where idx = 2),
  '["a9300000-0000-4000-8000-000000000001","a9300000-0000-4000-8000-000000000009","a93000f0-0000-4000-8000-000000000002"]'::jsonb,
  'oracle check: the parity file itself pins the bytewise taxonomy order (0…01 < 0…09 < …f0) [P2-S11-AC-089]'
);

-- matches: true on the expected projection, false on any single-member drift.
select is(
  (select bool_and(coalesce(pg_temp.h11_text(format(
      'select platform_private.cms_version_set_matches_manifest(%L::jsonb, %L::jsonb)',
      expected::text, manifest::text)), 'x') = 'true')
     from h11_parity),
  true,
  'each expected version set matches the manifest it was projected from [P2-S11-AC-089]'
);

create temp table h11_mutations on commit drop as
select p.idx, k.key,
       case jsonb_typeof(p.expected->k.key)
         when 'string' then jsonb_set(p.expected, array[k.key], to_jsonb((p.expected->>k.key) || 'x'))
         when 'null' then jsonb_set(p.expected, array[k.key], '"unexpected"'::jsonb)
         when 'array' then jsonb_set(p.expected, array[k.key], (p.expected->k.key) || '["a9300000-0000-4000-8000-0000000000ff"]'::jsonb)
         else jsonb_set(p.expected, array[k.key], '{"drift":true}'::jsonb)
       end as mutated
from h11_parity p cross join lateral jsonb_object_keys(p.expected) as k(key)
where k.key <> 'taxonomyVersionIds';

select is((select count(*)::integer from h11_mutations), 36,
  'the mutation matrix covers the 12 manifest-bound members of each of the three fixtures [P2-S11-AC-089]');

select is(
  (select count(*)::integer from h11_mutations m
    join h11_parity p on p.idx = m.idx
   where pg_temp.h11_text(format(
      'select platform_private.cms_version_set_matches_manifest(%L::jsonb, %L::jsonb)',
      m.mutated::text, p.manifest::text)) = 'false'),
  36,
  'a drift of any one manifest-bound member is a mismatch: 36 of 36 [P2-S11-AC-089]'
);

select is(
  (select string_agg(m.idx || ':' || m.key, ',' order by m.idx, m.key)
     from h11_mutations m join h11_parity p on p.idx = m.idx
    where pg_temp.h11_text(format(
      'select platform_private.cms_version_set_matches_manifest(%L::jsonb, %L::jsonb)',
      m.mutated::text, p.manifest::text)) is distinct from 'false'),
  null,
  'no mutated member slips through as a match or an error [P2-S11-AC-089]'
);

-- taxonomyVersionIds is the one member the manifest does not carry (the revision
-- does), so appending a sorted id is not detectable by this pure check, while an
-- order that is not the bytewise projection is.
select is(
  pg_temp.h11_text(format(
    'select platform_private.cms_version_set_matches_manifest(%L::jsonb, %L::jsonb)',
    (select jsonb_set(expected, '{taxonomyVersionIds}',
        '["a9300000-0000-4000-8000-0000000000ff"]'::jsonb)::text from h11_parity where idx = 0),
    (select manifest::text from h11_parity where idx = 0))),
  'true',
  'taxonomy ids are taken from the version set itself: a well-formed sorted list matches [P2-S11-AC-089]'
);
select is(
  pg_temp.h11_text(format(
    'select platform_private.cms_version_set_matches_manifest(%L::jsonb, %L::jsonb)',
    (select jsonb_set(expected, '{taxonomyVersionIds}',
        '["a9300000-0000-4000-8000-0000000000ff","a9300000-0000-4000-8000-000000000001"]'::jsonb)::text
       from h11_parity where idx = 0),
    (select manifest::text from h11_parity where idx = 0))),
  'false',
  'an unsorted taxonomy list is not the projection and does not match [P2-S11-AC-089]'
);

-- Binding to the manifest, not to the version set alone: the same version set
-- against a manifest with one changed identity is a mismatch.
select is(
  pg_temp.h11_text(format(
    'select platform_private.cms_version_set_matches_manifest(%L::jsonb, %L::jsonb)',
    (select expected::text from h11_parity where idx = 1),
    (select jsonb_set(manifest, '{blocks,0,id}', '"a9300000-0000-4000-8000-0000000000aa"')::text from h11_parity where idx = 1))),
  'false',
  'a version set no longer matches a manifest whose first block identity changed [P2-S11-AC-089]'
);
select is(
  pg_temp.h11_text(format(
    'select platform_private.cms_version_set_matches_manifest(%L::jsonb, %L::jsonb)',
    (select expected::text from h11_parity where idx = 1),
    (select jsonb_set(manifest, '{settings,version}', '"13"')::text from h11_parity where idx = 1))),
  'false',
  'a version set no longer matches a manifest whose settings ordinal moved [P2-S11-AC-089]'
);
select is(
  pg_temp.h11_text(format(
    'select platform_private.cms_version_set_matches_manifest(%L::jsonb, %L::jsonb)',
    (select expected::text from h11_parity where idx = 1),
    (select jsonb_set(manifest, '{schema,schemaArtifact,compilerVersion}', '"1.0.0"')::text from h11_parity where idx = 1))),
  'false',
  'a version set no longer matches a manifest whose compiler version moved [P2-S11-AC-089]'
);

-- A hash change in the manifest that the version set does not carry (terms,
-- locale sources, relations, checker) does not change the projection: the
-- version set is a projection, the manifest hash is what binds those groups.
select is(
  pg_temp.h11_text(format(
    'select platform_private.cms_version_set_matches_manifest(%L::jsonb, %L::jsonb)',
    (select expected::text from h11_parity where idx = 1),
    (select jsonb_set(jsonb_set(manifest, '{terms,0,hash}', to_jsonb(repeat('f', 64))),
                      '{checker,version}', '"2"')::text from h11_parity where idx = 1))),
  'true',
  'groups the version set does not project (terms, locale sources, relations, checker) do not affect the match [P2-S11-AC-089]'
);

-- Block and pattern hashes are not projected either, only their ids.
select is(
  pg_temp.h11_text(format(
    'select platform_private.cms_version_set_matches_manifest(%L::jsonb, %L::jsonb)',
    (select expected::text from h11_parity where idx = 1),
    (select jsonb_set(manifest, '{blocks,1,hash}', to_jsonb(repeat('e', 64)))::text from h11_parity where idx = 1))),
  'true',
  'a block hash change alone is not a version-set drift (ids only; the manifest hash binds the digest) [P2-S11-AC-089]'
);

-- ---------------------------------------------------------------------------
-- Pure projection rules, one at a time.
-- ---------------------------------------------------------------------------
select is(
  (select pg_temp.h11_json(format('select platform_private.cms_version_set_of(%L::jsonb, %L::jsonb)',
     jsonb_set(manifest, '{template}', 'null'::jsonb)::text, taxonomy::text))
     ->> 'templateVersionId'
     from h11_parity where idx = 1),
  null,
  'a null template projects a null templateVersionId [P2-S11-AC-089]'
);
select is(
  (select pg_temp.h11_json(format('select platform_private.cms_version_set_of(%L::jsonb, %L::jsonb)',
     jsonb_set(manifest, '{template}', 'null'::jsonb)::text, taxonomy::text))
     ->> 'templateHash'
     from h11_parity where idx = 1),
  null,
  'a null template projects a null templateHash (both or neither) [P2-S11-AC-089]'
);
select is(
  (select pg_temp.h11_json(format('select platform_private.cms_version_set_of(%L::jsonb, %L::jsonb)',
     manifest::text, taxonomy::text)) -> 'blockVersionIds'
     from h11_parity where idx = 1),
  '["a9300000-0000-4000-8000-000000000041","a9300000-0000-4000-8000-000000000042","a9300000-0000-4000-8000-00000000004f"]'::jsonb,
  'blockVersionIds are the manifest block ids in manifest order (already ascending) [P2-S11-AC-089]'
);
select is(
  (select pg_temp.h11_json(format('select platform_private.cms_version_set_of(%L::jsonb, %L::jsonb)',
     manifest::text, taxonomy::text)) ->> 'settingsVersion'
     from h11_parity where idx = 1),
  '12',
  'settingsVersion is the manifest settings ordinal as a decimal string [P2-S11-AC-089]'
);
select is(
  (select pg_temp.h11_json(format('select platform_private.cms_version_set_of(%L::jsonb, %L::jsonb)',
     manifest::text, taxonomy::text)) ->> 'compilerVersion'
     from h11_parity where idx = 1),
  '1.9',
  'compilerVersion is the schema artifact compiler version [P2-S11-AC-089]'
);
select is(
  (select pg_temp.h11_json(format('select platform_private.cms_version_set_of(%L::jsonb, %L::jsonb)',
     manifest::text, taxonomy::text)) -> 'workflowPolicy' ->> 'riskClass'
     from h11_parity where idx = 1),
  'protected',
  'workflowPolicy is copied from manifest.schema unchanged [P2-S11-AC-089]'
);
select is(
  (select count(*)::integer from jsonb_object_keys(
     (select expected from h11_parity where idx = 0))),
  13,
  'a version set has exactly the thirteen members of the VersionSet contract [P2-S11-AC-089]'
);

-- ---------------------------------------------------------------------------
-- Canonical lists (BE03b E1: one dependency set, one serialization).  Mirrors the strict TypeScript
-- schemas: every identity is a lowercase UUID named once, every list ascending bytewise (validator
-- references by key then version), and non-canonical input is refused, never re-ordered.
-- ---------------------------------------------------------------------------
create or replace function pg_temp.h11v_of(p_manifest jsonb, p_taxonomy jsonb default '[]'::jsonb)
returns text
language sql
as $body$
  select pg_temp.h11_outcome(format('select platform_private.cms_version_set_of(%L::jsonb, %L::jsonb)',
    p_manifest::text, p_taxonomy::text))
$body$;

create or replace function pg_temp.h11v_manifest(p_path text[], p_value jsonb)
returns jsonb
language sql
as $body$
  select jsonb_set(manifest, p_path, p_value) from h11_parity where idx = 1
$body$;

select is(pg_temp.h11v_of(pg_temp.h11v_manifest('{blocks}', (select jsonb_agg(block order by ordinality desc)
    from jsonb_array_elements((select manifest->'blocks' from h11_parity where idx = 1)) with ordinality t(block, ordinality)))),
  'P0001:INVALID_REQUEST', 'a manifest whose blocks are not ascending (B2 before B1) is INVALID_REQUEST, never projected as listed [P2-S11-AC-089]');
select is(pg_temp.h11v_of(pg_temp.h11v_manifest('{patterns}', (select jsonb_build_array(manifest->'patterns'->0, manifest->'patterns'->0)
    from h11_parity where idx = 1))),
  'P0001:INVALID_REQUEST', 'a manifest naming one pattern twice is INVALID_REQUEST (each identity once) [P2-S11-AC-089]');
select is(pg_temp.h11v_of(pg_temp.h11v_manifest('{blocks,0,id}', (select to_jsonb(upper(manifest->'blocks'->0->>'id'))
    from h11_parity where idx = 1))),
  'P0001:INVALID_REQUEST', 'an upper-case block id is not a canonical UUID: INVALID_REQUEST [P2-S11-AC-089]');
select is(pg_temp.h11v_of(pg_temp.h11v_manifest('{blocks,0,id}', '"not-a-uuid"'::jsonb)),
  'P0001:INVALID_REQUEST', 'a block id that is not a UUID at all is INVALID_REQUEST [P2-S11-AC-089]');
select is(pg_temp.h11v_of(pg_temp.h11v_manifest('{schema,validatorRefs}',
    '[{"key":"rich_text.v1","version":"2"},{"key":"rich_text.v1","version":"1"}]'::jsonb)),
  'P0001:INVALID_REQUEST', 'validator references listed (rich_text.v1@2, rich_text.v1@1) are not ascending: INVALID_REQUEST [P2-S11-AC-089]');
select is(pg_temp.h11v_of(pg_temp.h11v_manifest('{schema,validatorRefs}',
    '[{"key":"rich_text.v1","version":"1"},{"key":"rich_text.v1","version":"1"}]'::jsonb)),
  'P0001:INVALID_REQUEST', 'a validator reference named twice is INVALID_REQUEST [P2-S11-AC-089]');
select is(pg_temp.h11v_of(pg_temp.h11v_manifest('{schema,validatorRefs}',
    '[{"key":"rich_text.v1","version":"2"},{"key":"rich_text.v1","version":"10"}]'::jsonb)),
  'P0001:INVALID_REQUEST', 'versions order bytewise, not numerically: "2" before "10" is not ascending [P2-S11-AC-089]');
select is(pg_temp.h11v_of(pg_temp.h11v_manifest('{schema,validatorRefs}',
    '[{"key":"rich_text.v1","version":"10"},{"key":"rich_text.v1","version":"2"}]'::jsonb)),
  '00000', 'control: validator references ascending bytewise ("10" before "2") are accepted [P2-S11-AC-089]');
select is(
  pg_temp.h11_json(format('select platform_private.cms_version_set_of(%L::jsonb, ''[]''::jsonb)',
    pg_temp.h11v_manifest('{schema,validatorRefs}',
      '[{"key":"rich_text.v1","version":"10"},{"key":"rich_text.v1","version":"2"}]'::jsonb)::text)) -> 'validatorRefs',
  '[{"key":"rich_text.v1","version":"10"},{"key":"rich_text.v1","version":"2"}]'::jsonb,
  'the projected validator references are the canonical list [P2-S11-AC-089]');
select is(pg_temp.h11v_of((select manifest from h11_parity where idx = 1),
    '["a9300000-0000-4000-8000-000000000001","a9300000-0000-4000-8000-000000000001"]'::jsonb),
  'P0001:INVALID_REQUEST', 'a revision that names one taxonomy version twice is INVALID_REQUEST (identity once) [P2-S11-AC-089]');
select is(pg_temp.h11v_of((select manifest from h11_parity where idx = 1),
    '["A9300000-0000-4000-8000-000000000001"]'::jsonb),
  'P0001:INVALID_REQUEST', 'an upper-case taxonomy id is not a canonical UUID: INVALID_REQUEST [P2-S11-AC-089]');
select is(
  pg_temp.h11_text(format('select platform_private.cms_version_set_matches_manifest(%L::jsonb, %L::jsonb)',
    (select jsonb_set(expected, '{taxonomyVersionIds}',
        '["a9300000-0000-4000-8000-000000000001","a9300000-0000-4000-8000-000000000001"]'::jsonb)::text
       from h11_parity where idx = 1),
    (select manifest::text from h11_parity where idx = 1))),
  'false', 'a version set that repeats a taxonomy id is not a match: the taxonomy list cannot self-seed a duplicate [P2-S11-AC-089]');

-- ---------------------------------------------------------------------------
-- Malformed input.
-- ---------------------------------------------------------------------------
select is(pg_temp.h11_outcome('select platform_private.cms_version_set_of(null, ''[]''::jsonb)'),
  'P0001:INVALID_REQUEST', 'a null manifest is INVALID_REQUEST [P2-S11-AC-089]');
select is(pg_temp.h11_outcome('select platform_private.cms_version_set_of(''[]''::jsonb, ''[]''::jsonb)'),
  'P0001:INVALID_REQUEST', 'a non-object manifest is INVALID_REQUEST [P2-S11-AC-089]');
select is(
  pg_temp.h11_outcome(format('select platform_private.cms_version_set_of(%L::jsonb, ''[]''::jsonb)',
    (select (manifest - 'schema')::text from h11_parity where idx = 0))),
  'P0001:INVALID_REQUEST', 'a manifest without a schema group is INVALID_REQUEST [P2-S11-AC-089]');
select is(
  pg_temp.h11_outcome(format('select platform_private.cms_version_set_of(%L::jsonb, ''[]''::jsonb)',
    (select (manifest - 'blocks')::text from h11_parity where idx = 0))),
  'P0001:INVALID_REQUEST', 'a manifest without a blocks group is INVALID_REQUEST [P2-S11-AC-089]');
select is(
  pg_temp.h11_outcome(format('select platform_private.cms_version_set_of(%L::jsonb, ''{}''::jsonb)',
    (select manifest::text from h11_parity where idx = 0))),
  'P0001:INVALID_REQUEST', 'a non-array taxonomy list is INVALID_REQUEST [P2-S11-AC-089]');
select is(
  pg_temp.h11_outcome(format('select platform_private.cms_version_set_of(%L::jsonb, ''[1]''::jsonb)',
    (select manifest::text from h11_parity where idx = 0))),
  'P0001:INVALID_REQUEST', 'a non-string taxonomy id is INVALID_REQUEST [P2-S11-AC-089]');
select is(pg_temp.h11_text('select platform_private.cms_version_set_matches_manifest(null, null)'), 'false',
  'matches answers false (never an error) for a null version set and manifest [P2-S11-AC-089]');
select is(pg_temp.h11_text('select platform_private.cms_version_set_matches_manifest(''{}''::jsonb, ''{}''::jsonb)'), 'false',
  'matches answers false for empty objects [P2-S11-AC-089]');
select is(pg_temp.h11_text('select platform_private.cms_version_set_matches_manifest(''[]''::jsonb, ''[]''::jsonb)'), 'false',
  'matches answers false for non-objects [P2-S11-AC-089]');
select is(
  pg_temp.h11_text(format('select platform_private.cms_version_set_matches_manifest(%L::jsonb, %L::jsonb)',
    (select (expected || '{"extra":true}'::jsonb)::text from h11_parity where idx = 0),
    (select manifest::text from h11_parity where idx = 0))),
  'false',
  'a version set with an unknown extra member is not a match (strict, like the contract) [P2-S11-AC-089]');
select is(
  pg_temp.h11_text(format('select platform_private.cms_version_set_matches_manifest(%L::jsonb, %L::jsonb)',
    (select (expected - 'compilerVersion')::text from h11_parity where idx = 0),
    (select manifest::text from h11_parity where idx = 0))),
  'false',
  'a version set missing a member is not a match [P2-S11-AC-089]');

select is(
  (select count(*)::integer from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'platform_private'
     and p.proname in ('cms_version_set_of', 'cms_version_set_matches_manifest')),
  2, 'exactly one overload of each projection helper exists [P2-S11-AC-089]');

select * from finish();
rollback;
