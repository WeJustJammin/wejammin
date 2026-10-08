-- Slice 10 evidence lane EA: production gaps found while proving P2-S10-AC-001..035.
-- Each assertion states the behaviour the locked text requires.  They were wrapped in a pgTAP
-- TODO while the gap was open; EA-AC002 was closed by lane H round 3 (migration 20261005014100,
-- DEC-141) and its TODO wrapper is removed, so it is a normal assertion the criterion may cite.
-- The broader compare-lineage proof is supabase/tests/phase_02_slice_10_compare_lineage.sql.
--
-- EVIDENCE GAP EA-AC002 (compare, taxonomy lineage) - CLOSED.  IA03 "Comparison" row: "an unresolvable
-- recorded schema/template/taxonomy version or block-registry digest is a non-disclosing
-- refusal".  platform_private.cms_compare_revision_resolvable resolves the schema version and
-- the block registry only; a compared revision whose recorded taxonomy version resolves nowhere
-- is compared as if it were fine.  (A dangling template version cannot exist: the
-- cms_entry_revisions_template_registry_check constraint refuses it at write time.)

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

select pg_temp.s10_rpc_probe(
  'gap-compare-taxonomy-unresolvable',
  pg_temp.s10_sql_replica(
    $s$update platform_private.cms_entry_revisions
          set taxonomy_version_ids = jsonb_build_array('a9140000-0000-4000-8000-0000000000f5')
        where id = (select value::uuid from s10_ids where key = 'entryRevisionId');$s$),
  pg_temp.s10_compare_sql()
);

select is(
  pg_temp.s10_probe_message('gap-compare-taxonomy-unresolvable'),
  'comparison_unavailable',
  'GAP EA-AC002 a compared revision whose recorded taxonomy version does not resolve is comparison_unavailable'
);

select * from finish();
rollback;
