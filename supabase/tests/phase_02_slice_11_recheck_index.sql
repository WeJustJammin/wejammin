-- Slice 11 dependency recheck, the ReviewDependency index (BE03b Database Schema
-- "ReviewDependency", Review invalidation "Dependency recheck"; tracker P2-S11-AC-113):
-- the clause "cms_editorial_review_dependencies (review_id, kind, ref_id) is written only by
-- cms_submit_review from the frozen manifest (nine kinds), immutable, retained after
-- invalidation and UNIQUE(review_id, kind, ref_id)".
--
-- The shape, uniqueness, immutability and retention are asserted by
-- phase_02_slice_11_review_dependencies_schema.sql and the per-kind rows by
-- phase_02_slice_11_helpers_manifest.sql; this file adds what was missing: WHO may write the
-- table (no role but the definer of cms_submit_review, and only that function's body),
-- that every kind is produced from ONE frozen manifest, and that the recheck job reads the
-- index without ever writing it.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(17);

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_11_helpers/000-helpers.sqlinc
\ir phase_02_slice_11_helpers/001-world.sqlinc
\ir phase_02_slice_11_helpers/003-registry.sqlinc
\ir phase_02_slice_11_pattern_forest.sqlinc

-- ---------------------------------------------------------------------------
-- Who may write the table.
-- ---------------------------------------------------------------------------
select is(
  (select string_agg(r.role_name || ':' || r.privilege, ',' order by r.role_name, r.privilege)
     from unnest(array['anon', 'authenticated', 'service_role']) as r0(role_name)
    cross join lateral (
      select r0.role_name, p.privilege
        from unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) as p(privilege)
    ) r
    where has_table_privilege(r.role_name, 'platform_private.cms_editorial_review_dependencies'::regclass, r.privilege)),
  null,
  'no API role holds any privilege on the dependency index [P2-S11-AC-113]');

select is(
  (select count(*)::integer
     from aclexplode((select relacl from pg_class where oid = 'platform_private.cms_editorial_review_dependencies'::regclass)) acl
    where acl.grantee = 0),
  0,
  'PUBLIC holds no privilege on the dependency index [P2-S11-AC-113]');

select is(
  (select string_agg(acl.privilege_type, ',' order by acl.privilege_type)
     from aclexplode((select relacl from pg_class where oid = 'platform_private.cms_editorial_review_dependencies'::regclass)) acl
    where acl.grantee = 'wejammin_cms_definer'::regrole),
  'INSERT,SELECT',
  'the CMS definer role holds INSERT and SELECT on the index and nothing else: no UPDATE, DELETE or TRUNCATE [P2-S11-AC-113]');

select is(
  (select array_agg(p.proname order by p.proname)
     from pg_proc p
    where p.pronamespace not in ('pg_catalog'::regnamespace, 'information_schema'::regnamespace)
      and p.prosrc ~* 'insert\s+into\s+platform_private\.cms_editorial_review_dependencies'),
  array['cms_submit_review']::name[],
  'cms_submit_review is the only function whose body inserts into the dependency index [P2-S11-AC-113]');

select is(
  (select array_agg(p.proname order by p.proname)
     from pg_proc p
    where p.pronamespace not in ('pg_catalog'::regnamespace, 'information_schema'::regnamespace)
      and p.prosrc ~* '(update\s+platform_private\.cms_editorial_review_dependencies|delete\s+from\s+platform_private\.cms_editorial_review_dependencies)'),
  null,
  'no function updates or deletes a dependency row [P2-S11-AC-113]');

set local role service_role;
select throws_ok(
  $$insert into platform_private.cms_editorial_review_dependencies(owner_id, state, version, review_id, kind, ref_id)
    values ('a1130000-0000-4000-8000-0000000000a1', 'active', 1, 'a1130000-0000-4000-8000-0000000000a2', 'schema',
            'a1130000-0000-4000-8000-0000000000a3')$$,
  '42501', null,
  'the Worker service role cannot insert a dependency row directly [P2-S11-AC-113]');
reset role;
set local role authenticated;
select throws_ok(
  $$insert into platform_private.cms_editorial_review_dependencies(owner_id, state, version, review_id, kind, ref_id)
    values ('a1130000-0000-4000-8000-0000000000a1', 'active', 1, 'a1130000-0000-4000-8000-0000000000a2', 'schema',
            'a1130000-0000-4000-8000-0000000000a3')$$,
  '42501', null,
  'a signed-in human cannot insert a dependency row directly [P2-S11-AC-113]');
reset role;

select set_config('app.cms_rpc', 'false', true);
select throws_ok(
  $$insert into platform_private.cms_editorial_review_dependencies(owner_id, state, version, review_id, kind, ref_id)
    values ('a1130000-0000-4000-8000-0000000000a1', 'active', 1, 'a1130000-0000-4000-8000-0000000000a2', 'schema',
            'a1130000-0000-4000-8000-0000000000a3')$$,
  'P0001', 'DIRECT_CMS_TABLE_WRITE',
  'even the table owner is refused outside the CMS RPC context [P2-S11-AC-113]');
select set_config('app.cms_rpc', 'true', true);

-- ---------------------------------------------------------------------------
-- Every kind comes from one frozen manifest.
-- ---------------------------------------------------------------------------
insert into platform_private.cms_taxonomy_versions(
  id, owner_id, version, taxonomy_key, owner_capability, shape,
  allowlisted_type_keys, allowlisted_field_keys, content_hash, created_by
) values (pg_temp.h11w_uuid('tax1'), pg_temp.h11w_org(), 1, 'h11-genres', 'cms.taxonomy_curator',
  'flat', '[]'::jsonb, '[]'::jsonb, repeat('a', 64), (select value::uuid from s10_ids where key = 'creatorAuth'));
-- taxonomy_id (BE03c 1371/1428; 20261014120000): h11_raw_exec disables the lineage-fill trigger, so the row names its lineage
-- (the version-1 row's id) itself.
select pg_temp.h11_raw_insert('platform_private.cms_terms', jsonb_build_object(
  'id', 'a9200000-0000-4000-8000-0000000e0001', 'owner_id', pg_temp.h11w_org(), 'lifecycle', 'active', 'version', 1,
  'taxonomy_id', pg_temp.h11w_uuid('tax1'), 'taxonomy_version_id', pg_temp.h11w_uuid('tax1'), 'term_key', 'jazz', 'aliases', '[]'::jsonb,
  'created_by', (select value::uuid from s10_ids where key = 'creatorAuth'),
  'created_at', timestamptz '2026-10-08T12:00:00Z', 'updated_at', timestamptz '2026-10-08T12:00:00Z'));

-- A French variant revision of an English source revision, built on the template, with a block
-- and a pattern instance, a term, a relation and the taxonomy version recorded: all nine groups.
select pg_temp.h11w_revision('all9src');
select pg_temp.h11w_revision('all9', 'creatorPerson', 'fr-FR', jsonb_build_array(pg_temp.h11w_uuid('tax1')),
  'all9src', 2, 'a9200000-0000-4000-8000-0000000d0001');
-- DEC-193 / BE03c 1511: the pinned row's path is a block-root key chain of its pattern version, below the template slot.
select pg_temp.h11x_forest('a9200000-0000-4000-8000-0000000c0001', 'h11.first', array['a']);
select pg_temp.h11m_instance('all9:i1', pg_temp.h11w_uuid('all9:revision'), '/primary/a', 'h11.first',
  'a9200000-0000-4000-8000-0000000c0001');
select set_config('app.cms_rpc', 'true', true);
insert into platform_private.cms_term_assignments(
  id, owner_id, state, version, revision_id, field_definition_id,
  term_id, taxonomy_version_id, position, provenance, created_by
) values (
  pg_temp.h11w_uuid('all9:a1'), pg_temp.h11w_org(), 'active', 1, pg_temp.h11w_uuid('all9:revision'),
  pg_temp.h11w_fdef('tags'), 'a9200000-0000-4000-8000-0000000e0001', pg_temp.h11w_uuid('tax1'), 0, 'authored',
  (select value::uuid from s10_ids where key = 'creatorAuth'));
select pg_temp.h11w_relation(pg_temp.h11w_uuid('all9:revision'), 'rel_omit',
  'a9100000-0000-4000-8000-000000000301'::uuid, 1, 0, 'omit');
insert into platform_private.cms_locale_variants(
  id, owner_id, state, version, entry_id, revision_id, source_revision_id,
  locale, source_locale, source_hash, created_by
) values (
  pg_temp.h11w_uuid('all9:variant'), pg_temp.h11w_org(), 'draft', 1,
  pg_temp.h11w_uuid('all9src:entry'), pg_temp.h11w_uuid('all9:revision'),
  pg_temp.h11w_uuid('all9src:revision'), 'fr-FR', 'en-US',
  (select payload_hash from platform_private.cms_entry_revisions where id = pg_temp.h11w_uuid('all9src:revision')),
  (select value::uuid from s10_ids where key = 'creatorAuth'));

create temp table ri_refs on commit drop as
select refs.kind, refs.ref_id
  from platform_private.cms_review_dependency_refs(
    pg_temp.h11w_uuid('all9:revision'),
    platform_private.cms_build_dependency_manifest(pg_temp.h11w_uuid('all9:revision'))) refs;

select is(
  (select array_agg(kind order by kind) from (select distinct kind from ri_refs) k),
  array['block', 'locale_source', 'pattern', 'relation_target', 'schema', 'settings', 'taxonomy_version', 'template', 'term']::text[],
  'one frozen manifest yields a dependency row of each of the nine kinds [P2-S11-AC-113]');
select is(
  (select count(*)::integer from ri_refs) - (select count(*)::integer from (select distinct kind, ref_id from ri_refs) d),
  0,
  'each (kind, ref_id) identity is listed once, which UNIQUE(review_id, kind, ref_id) requires [P2-S11-AC-113]');
select * from finish();
rollback;
