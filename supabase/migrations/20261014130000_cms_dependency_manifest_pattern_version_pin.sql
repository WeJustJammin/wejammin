-- Slice 12 lane baseline-repair (BE03c 219 and 1426 lineage ids; BE03b E1 frozen manifest; review finding F12 of
-- review-pattern-def.md; tracker P2-S11-AC-088, AC-090, P2-S12-AC-100): the dependency manifest freezes the
-- PatternVersion ROW a composition instance is pinned to.
--
-- Defect.  cms_build_dependency_manifest (20261005017560) resolved a placement's pattern with
-- `pattern.id = instance.pattern_id`.  Slice 12 made cms_composition_instances.pattern_id the stable LINEAGE id
-- (the id of the version-1 row, BE03c 219) and pins the version in pattern_version (the foreign key
-- (pattern_id, pattern_version, owner_id) -> cms_pattern_versions of 20261014020100).  The old join is therefore
-- right only for version 1: an instance pinned to version 2 of a lineage froze the version-1 row (its id and its
-- content_hash), so the manifest named a superseded identity, a version-2 pin was never recorded as a dependency
-- and cms_manifest_identities_current judged the frozen set against the wrong row.
--
-- Fix.  The join becomes the pinned row, by the same key the foreign key uses:
--   pattern.pattern_id = instance.pattern_id and pattern.version = instance.pattern_version
--   and pattern.owner_id = instance.owner_id
-- One row per instance (the key is unique), so the existing `select distinct` and ordering are unchanged, and for
-- a version-1 pin the result is byte-identical (a first version is its own lineage).  The manifest still carries
-- VERSION ROW ids, which is what cms_manifest_identities_current (20261005017560:703) and the dependency recheck
-- lineage (20261010164100:80-84, sibling rows of one owner and key) already consume, so neither needs a change.
--
-- Mechanics.  One anchored amendment of the LIVE source of the function (the anchor occurs exactly once; the
-- inverse replacement restores the installed source byte for byte; every pg_proc attribute except the source and
-- the comment is unchanged), the same pattern as 20261014050700.  Forward-only; no table is touched.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $migration$
declare
  identity constant text := 'platform_private.cms_build_dependency_manifest(uuid)';
  original pg_catalog.pg_proc%rowtype;
  actual pg_catalog.pg_proc%rowtype;
  old_source text;
  new_source text;
  definition text;
  comment_text text;
  anchor_old constant text :=
    $a$        join platform_private.cms_pattern_versions pattern on pattern.id = instance.pattern_id$a$;
  anchor_new constant text :=
    $a$        join platform_private.cms_pattern_versions pattern
          on pattern.pattern_id = instance.pattern_id
         and pattern.version = instance.pattern_version
         and pattern.owner_id = instance.owner_id$a$;
begin
  select proc.* into original from pg_catalog.pg_proc proc
   where proc.oid = pg_catalog.to_regprocedure(identity);
  if not found then
    raise exception 'dependency manifest builder missing: %', identity using errcode = '55000';
  end if;
  old_source := original.prosrc;
  comment_text := pg_catalog.obj_description(original.oid, 'pg_proc');
  if original.proowner <> 'wejammin_cms_definer'::pg_catalog.regrole
     or not original.prosecdef or original.prokind <> 'f' or original.provolatile <> 'v'
     or original.proconfig is distinct from array['search_path=""']::text[]
     or original.prolang <> (select oid from pg_catalog.pg_language where lanname = 'plpgsql') then
    raise exception 'dependency manifest builder: unexpected attributes' using errcode = '55000';
  end if;
  if (pg_catalog.length(old_source) - pg_catalog.length(pg_catalog.replace(old_source, anchor_old, '')))
       / pg_catalog.length(anchor_old) <> 1 then
    raise exception 'dependency manifest builder: unexpected anchor' using errcode = '55000';
  end if;
  new_source := pg_catalog.replace(old_source, anchor_old, anchor_new);
  if pg_catalog.replace(new_source, anchor_new, anchor_old) <> old_source then
    raise exception 'dependency manifest builder: non-anchor change' using errcode = '55000';
  end if;
  definition := pg_catalog.pg_get_functiondef(original.oid);
  if (pg_catalog.length(definition) - pg_catalog.length(pg_catalog.replace(definition, old_source, '')))
       / pg_catalog.length(old_source) <> 1 then
    raise exception 'dependency manifest builder: ambiguous definition' using errcode = '55000';
  end if;
  execute pg_catalog.replace(definition, old_source, new_source);
  select proc.* into actual from pg_catalog.pg_proc proc
   where proc.oid = pg_catalog.to_regprocedure(identity);
  if not found or actual.oid <> original.oid or actual.prosrc <> new_source
     or pg_catalog.to_jsonb(actual) - 'prosrc' <> pg_catalog.to_jsonb(original) - 'prosrc'
     or pg_catalog.obj_description(actual.oid, 'pg_proc') is distinct from comment_text then
    raise exception 'dependency manifest builder: replacement changed more than the source' using errcode = '55000';
  end if;
end;
$migration$;

commit;
