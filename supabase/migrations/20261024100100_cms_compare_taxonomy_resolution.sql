-- Slice 12 lane taxonomy-integrity: BE03c "Receiving obligations from Slice 10 (DEC-141)" item 1, the comparison half (P2-S12-AC-242).
--
-- CMS-03B-03 comparison used to fail closed with comparison_unavailable for ANY non-empty recorded taxonomy-version list because
-- no authority could resolve a recorded id (20261005014100).  With cms_resolve_taxonomy_version registered the lineage guard
-- cms_compare_revision_resolvable compares recorded taxonomy versions by identity: every recorded id must resolve in the
-- caller's owner scope, in any state; an id that is absent or out of scope (or not a UUID) keeps the non-disclosing refusal.
-- One guarded anchored amendment of the LIVE source (the anchor occurs exactly once, the inverse replacement restores the
-- installed source byte for byte, every pg_proc attribute except the source is unchanged).  Forward-only.
begin;
set local lock_timeout = '5s';

do $migration$
declare
  identity constant text := 'platform_private.cms_compare_revision_resolvable(uuid,uuid)';
  original pg_catalog.pg_proc%rowtype;
  actual pg_catalog.pg_proc%rowtype;
  old_source text;
  new_source text;
  definition text;
  comment_text text;
  anchor_old constant text := $a$  -- DEC-141 / gap-resolution D-3 (BE03b "Recorded taxonomy and composition references in
  -- comparison and restore", 1): Slice 10 has no taxonomy-version authority the comparison
  -- could resolve a recorded reference against, so a non-empty recorded taxonomy-version list
  -- on EITHER revision fails closed; the refusal never echoes an id, a count or a version.
  -- (Restore resolves each pin against cms_taxonomy_versions and has its own typed refusal.)
  and not exists (
    select 1
    from platform_private.cms_entry_revisions pinned_revision
    where pinned_revision.id = p_revision_id
      and pinned_revision.entry_id = p_entry_id
      and pg_catalog.jsonb_array_length(pinned_revision.taxonomy_version_ids) > 0
  )
$a$;
  anchor_new constant text := $a$  -- DEC-141 (BE03c Receiving obligations from Slice 10, item 1): recorded taxonomy versions are compared
  -- by identity.  Every id the revision records must resolve through cms_resolve_taxonomy_version in
  -- the caller's owner scope, in any state; an absent, out-of-scope or malformed id is not
  -- resolvable and the refusal never echoes an id, a count or a version.
  and not exists (
    select 1
    from platform_private.cms_entry_revisions pinned_revision
    cross join lateral pg_catalog.jsonb_array_elements_text(pinned_revision.taxonomy_version_ids) recorded(id)
    where pinned_revision.id = p_revision_id
      and pinned_revision.entry_id = p_entry_id
      and platform_private.cms_taxonomy_version_resolves(recorded.id) is not true
  )
$a$;
begin
  select proc.* into original from pg_catalog.pg_proc proc
   where proc.oid = pg_catalog.to_regprocedure(identity);
  if not found or original.proowner <> 'wejammin_cms_definer'::pg_catalog.regrole
     or original.prokind <> 'f' or original.provolatile <> 's'
     or original.proconfig is distinct from array['search_path=""']::text[]
     or original.prolang <> (select oid from pg_catalog.pg_language where lanname = 'sql') then
    raise exception 'comparison lineage guard: unexpected attributes' using errcode = '55000';
  end if;
  old_source := original.prosrc;
  comment_text := pg_catalog.obj_description(original.oid, 'pg_proc');
  if (pg_catalog.length(old_source) - pg_catalog.length(pg_catalog.replace(old_source, anchor_old, '')))
       / pg_catalog.length(anchor_old) <> 1 then
    raise exception 'comparison lineage guard: unexpected anchor' using errcode = '55000';
  end if;
  new_source := pg_catalog.replace(old_source, anchor_old, anchor_new);
  if pg_catalog.replace(new_source, anchor_new, anchor_old) <> old_source then
    raise exception 'comparison lineage guard: non-anchor change' using errcode = '55000';
  end if;
  definition := pg_catalog.pg_get_functiondef(original.oid);
  if (pg_catalog.length(definition) - pg_catalog.length(pg_catalog.replace(definition, old_source, '')))
       / pg_catalog.length(old_source) <> 1 then
    raise exception 'comparison lineage guard: ambiguous definition' using errcode = '55000';
  end if;
  execute pg_catalog.replace(definition, old_source, new_source);
  select proc.* into actual from pg_catalog.pg_proc proc
   where proc.oid = pg_catalog.to_regprocedure(identity);
  if not found or actual.oid <> original.oid or actual.prosrc <> new_source
     or pg_catalog.to_jsonb(actual) - 'prosrc' <> pg_catalog.to_jsonb(original) - 'prosrc'
     or pg_catalog.obj_description(actual.oid, 'pg_proc') is distinct from comment_text then
    raise exception 'comparison lineage guard: replacement changed more than the source' using errcode = '55000';
  end if;
end;
$migration$;

commit;
