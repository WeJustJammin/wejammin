-- Slice 09 (AC217; P2-S09-AC-217): the compiled-manifest bound reads the manifest with jsonpath.
--
-- cms_schema_artifacts_editor_manifest_check and ..._renderer_manifest_check call
-- platform_private.cms_compiled_manifest_bounded, which answered with cms_json_bounded(p_value, 524288, 12, 128, 128):
-- a recursive CTE that expands every node of the document in SQL.  The editor manifest of a 128-field
-- definition holds every field twice (about 80 KB, about 6,500 nodes), so that one CHECK cost 35-40 ms of the
-- 128-field create (CMS-03A-01), the largest single statement of the artifact insert.  The bound is the same
-- three rules, now read by the C-level jsonpath engine:
--   * depth: a container at level >= 12 (levels count from the root at 0) exists exactly when one exists at
--     level 12, so `$.**{12}` asks for containers at that one level and never descends further, which also keeps
--     the later scans within a document of at most 12 levels;
--   * array length: any array with more than 128 elements, at any level;
--   * object width: any object with more than 128 keys, at any level (the keys are counted with the same
--     jsonb_object_keys the walk used).
-- The byte bound (524288 octets of JSON text) and the scalar answer are unchanged.  Signature, language,
-- volatility, strictness, search_path, owner, ACL and comment are preserved and checked below;
-- cms_json_bounded itself is untouched, so every other bound check keeps its implementation.  The answer is held
-- to cms_json_bounded(p_value, 524288, 12, 128, 128) on boundary and generated documents by
-- supabase/tests/phase_02_slice_09_create_draft_parity_manifest_bound.sql.  Forward-only.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $migration$
declare
  original pg_catalog.pg_proc%rowtype;
begin
  select proc.* into original
    from pg_catalog.pg_proc proc
   where proc.oid = pg_catalog.to_regprocedure('platform_private.cms_compiled_manifest_bounded(jsonb)');
  if not found then
    raise exception 'CMS compiled manifest bound function missing' using errcode = '55000';
  end if;
  if pg_catalog.md5(original.prosrc) is distinct from '348f71cf3a958c64a44ac4445d1429da'
     or original.prokind is distinct from 'f'
     or original.provolatile is distinct from 'i'
     or original.prosecdef is distinct from false
     or original.proisstrict is distinct from true
     or original.proleakproof is distinct from false
     or original.proparallel is distinct from 'u'
     or original.proconfig is distinct from array['search_path=""']::text[]
     or original.pronargs is distinct from 1
     or original.pronargdefaults is distinct from 0
     or pg_catalog.oidvectortypes(original.proargtypes) is distinct from 'jsonb'
     or original.prorettype is distinct from 'boolean'::pg_catalog.regtype
     or original.proretset is distinct from false
     or original.prolang is distinct from (
       select lang.oid from pg_catalog.pg_language lang where lang.lanname = 'sql'
     ) then
    raise exception 'CMS compiled manifest bound baseline mismatch (installed source md5 %)',
      pg_catalog.md5(original.prosrc) using errcode = '55000';
  end if;
  perform pg_catalog.set_config(
    'wejammin.compiled_manifest_bound_metadata',
    ((pg_catalog.to_jsonb(original) - 'prosrc')::text), true);
  perform pg_catalog.set_config(
    'wejammin.compiled_manifest_bound_comment',
    coalesce(pg_catalog.obj_description(original.oid, 'pg_proc'), ''), true);
end;
$migration$;

create or replace function platform_private.cms_compiled_manifest_bounded(p_value jsonb)
returns boolean
language sql
immutable
strict
set search_path = ''
as $body$
  select case
    when pg_catalog.octet_length(p_value::text) > 524288 then false
    when pg_catalog.jsonb_typeof(p_value) not in ('object', 'array') then true
    else not (
      pg_catalog.jsonb_path_exists(p_value,
        'strict $.**{12} ? (@.type() == "object" || @.type() == "array")')
      or pg_catalog.jsonb_path_exists(p_value,
        'strict $.** ? (@.type() == "array" && @.size() > 128)')
      or exists (
        select 1
          from pg_catalog.jsonb_path_query(p_value, 'strict $.** ? (@.type() == "object")') as object_node(node)
         where (select pg_catalog.count(*)
                  from pg_catalog.jsonb_object_keys(object_node.node)) > 128
      )
    )
  end
$body$;

do $migration$
declare
  actual pg_catalog.pg_proc%rowtype;
begin
  select proc.* into actual
    from pg_catalog.pg_proc proc
   where proc.oid = pg_catalog.to_regprocedure('platform_private.cms_compiled_manifest_bounded(jsonb)');
  if not found
     or (pg_catalog.to_jsonb(actual) - 'prosrc')::text
        is distinct from pg_catalog.current_setting('wejammin.compiled_manifest_bound_metadata')
     or coalesce(pg_catalog.obj_description(actual.oid, 'pg_proc'), '')
        is distinct from pg_catalog.current_setting('wejammin.compiled_manifest_bound_comment')
     or pg_catalog.md5(actual.prosrc) is not distinct from '348f71cf3a958c64a44ac4445d1429da' then
    raise exception 'CMS compiled manifest bound preservation mismatch' using errcode = '55000';
  end if;
end;
$migration$;

commit;
