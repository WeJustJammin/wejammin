-- Slice 10 QA-RED: CMS-07 revision comparison domains (D5) and restore
-- descriptor (D6).
--
-- IA03 requires a schema-aware comparison over the field, block, AND relation
-- domains; the current private producer hashes stable field IDs only and emits
-- a bare "path", so a field-only 200 can hide meaningful block/relation
-- changes. This suite gates the locked BE03b shape:
--
--   * every change carries domain in (field, block, relation) plus the safe
--     path/kind/leftHash/rightHash contract;
--   * ordering is by domain then path;
--   * relation paths use the keyed cms.compare.relation.v1 targetToken and
--     never a raw target identity;
--   * more than 512 combined changes is the typed comparison_too_large refusal
--     (never a truncated 200 or a scrubbed INTERNAL_ERROR), and an
--     unresolvable recorded version is comparison_unavailable;
--   * compare.restore carries the safe D6 descriptor shape.
--
-- Assertions are kept lightweight and catalog-driven: the producer body is
-- read through pg_get_functiondef and matched, so an absent or field-only
-- implementation is evidence-backed RED rather than an error that aborts the
-- run. Every identifier resolves by OID, so a missing object yields false.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;

select no_plan();

\ir phase_02_slice_10_rpc/000-helpers.sqlinc

-- Returns the rendered definition of one exact function overload, or '' when
-- the function is absent. The empty fallback keeps a missing producer a clean
-- RED instead of a parse-time error.
create or replace function pg_temp.s10_fn_body(
  p_schema text,
  p_name text,
  p_args text
)
returns text
language sql
stable
as $body$
  select coalesce(
    (
      select pg_catalog.pg_get_functiondef(p.oid)
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = p_schema
        and p.proname = p_name
        and pg_catalog.oidvectortypes(p.proargtypes) = p_args
    ),
    ''
  )
$body$;

create temp table s10_compare_body on commit drop as
select pg_temp.s10_fn_body(
  'platform_private', 'cms_list_revisions', 'jsonb'
) as body;

-- Guard: the private comparison producer and its worker-only wrapper exist.
-- Everything below reads this body, so an absent producer fails closed rather
-- than skipping.
select ok(
  pg_temp.s10_fn_exists('platform_private', 'cms_list_revisions', 'jsonb')
    and pg_temp.s10_fn_exists('platform_api', 'cms_list_revisions', 'jsonb'),
  'CMS-07 comparison producer exists behind the worker-only wrapper (guard)'
);

-- D5: the change object exposes the locked five-key safe shape. A bare
-- "path" without a domain is exactly the field-only shape this gate rejects.
select ok(
  (select body like '%''domain''%'
      and body like '%''path''%'
      and body like '%''kind''%'
      and body like '%''leftHash''%'
      and body like '%''rightHash''%'
   from s10_compare_body),
  'CMS-07 change objects expose domain, path, kind, leftHash and rightHash'
);

select ok(
  (select body like '%''field''%'
      and body like '%''block''%'
      and body like '%''relation''%'
   from s10_compare_body),
  'CMS-07 comparison covers the field, block and relation domains'
);

-- Stable ordering: by domain (field, block, relation) then path.
select ok(
  (select body ~ '(?s)order by.*domain' and body ~ '(?s)order by.*path'
   from s10_compare_body),
  'CMS-07 comparison orders changes by domain then path'
);

-- D5 relation identity: the pointer uses the keyed token, not a bare target
-- UUID, and the change output never publishes a raw target identity key.
select ok(
  (select body like '%cms.compare.relation.v1%' and body like '%/relations/%'
   from s10_compare_body),
  'CMS-07 relation path uses the cms.compare.relation.v1 keyed targetToken'
);

select ok(
  (select body not like '%''targetId''%' and body not like '%''target_id''%'
   from s10_compare_body),
  'CMS-07 comparison never emits a raw target identity key'
);

-- The relation and block side hashes follow the locked JCS inputs and never
-- fold a target identity into the digest.
select ok(
  (select body like '%relationDefinitionVersion%'
      and body like '%expectedTargetVersion%'
      and body like '%position%'
   from s10_compare_body),
  'CMS-07 relation side hash keys are definition version, position and expected version'
);

select ok(
  (select body like '%blockRegistryDigest%' and body like '%bindings%'
   from s10_compare_body),
  'CMS-07 block side hash keys include the registry digest and bindings'
);

-- Failure policy: the combined cap is typed. 512 combined changes is the
-- ceiling and 513 is a non-disclosing refusal, never a scrubbed internal error.
select ok(
  (select body like '%512%' and body like '%comparison_too_large%'
   from s10_compare_body),
  'CMS-07 refuses more than 512 combined changes with comparison_too_large'
);

select ok(
  (select body !~
     '(?s)jsonb_array_length\(compare_changes\)[^;]*INTERNAL_ERROR'
   from s10_compare_body),
  'CMS-07 513-change overflow is a typed refusal, not a scrubbed internal error'
);

select ok(
  (select body like '%comparison_unavailable%' from s10_compare_body),
  'CMS-07 refuses an unresolvable recorded version with comparison_unavailable'
);

-- D6: the restore descriptor is the locked safe shape for leftRevisionId.
select ok(
  (select body like '%''restore''%'
      and body like '%''migrationChainId''%'
      and body like '%''edgeCount''%'
      and body like '%''chainHash''%'
      and body like '%''availability''%'
   from s10_compare_body),
  'CMS-07 compare.restore carries the safe migrationChainId/edgeCount/chainHash/availability descriptor'
);

select ok(
  (select body like '%''available''%'
      and body like '%''chain_unavailable''%'
      and body like '%''transform_missing''%'
   from s10_compare_body),
  'CMS-07 restore descriptor uses the locked availability enum'
);

select ok(
  to_regclass('platform_private.cms_restore_chain_manifests') is not null,
  'CMS-07 restore chain manifest backs the descriptor identity (guard)'
);

select finish();

rollback;
