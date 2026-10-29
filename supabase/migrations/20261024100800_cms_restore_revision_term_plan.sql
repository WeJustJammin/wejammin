-- Slice 12 lane taxonomy-integrity: cms_restore_revision uses the restore term plan (BE03c Receiving obligations from Slice 10
-- (DEC-141) items 1 and 3; BE03c Slice 12 lock order position 6; P2-S12-AC-242 lineage, AC-244, AC-276).  Guarded anchored amendment of the
-- LIVE source (each anchor occurs exactly once, the inverse replay restores the installed source byte for byte, every pg_proc attribute
-- except the source is unchanged):
--   * the pin check resolves each recorded taxonomy version through cms_taxonomy_version_resolves;
--   * after the value translation, cms_restore_term_plan re-points / carries the source assignments and rewrites the taxonomy values;
--   * the new revision records the plan's version ids; after the composition copy the carried terms are locked FOR SHARE (ascending id)
--     and the plan re-run under the lock, then the assignments are appended; the response reports the stored ids.
-- Forward-only.
begin;
set local lock_timeout = '5s';

do $amend$
declare
  identity constant text := 'platform_private.cms_restore_revision(jsonb)';
  pairs constant text[][] := array[
    array[$o0$  translated jsonb;
  final_values jsonb;
$o0$,
     $n0$  translated jsonb;
  final_values jsonb;
  restore_terms jsonb;
$n0$],
    array[$o1$  if exists (
    select 1
    from pg_catalog.jsonb_array_elements_text(source_row.taxonomy_version_ids) pinned(taxonomy_id)
    where platform_private.cms_valid_uuid(pinned.taxonomy_id) is not true
       or not exists (
         select 1
         from platform_private.cms_taxonomy_versions taxonomy
         where taxonomy.id = pinned.taxonomy_id::uuid
           and taxonomy.owner_id = entry_row.owner_id
       )
  ) then
    raise exception 'migration_chain_incomplete' using errcode = 'P0001';
  end if;
$o1$,
     $n1$  -- DEC-141 item 1: each recorded version resolves through the taxonomy-version resolver (any state, owner scope).
  if exists (
    select 1
    from pg_catalog.jsonb_array_elements_text(source_row.taxonomy_version_ids) pinned(taxonomy_id)
    where platform_private.cms_taxonomy_version_resolves(pinned.taxonomy_id) is not true
  ) then
    raise exception 'migration_chain_incomplete' using errcode = 'P0001';
  end if;
$n1$],
    array[$o2$  final_provenance := translated->'provenance';
$o2$,
     $n2$  final_provenance := translated->'provenance';
  -- DEC-141 item 3: the source's active term assignments are carried (merged terms re-pointed); the taxonomy values and the
  -- recorded version ids follow the carried terms.
  restore_terms := platform_private.cms_restore_term_plan(
    entry_row.owner_id, source_row.id, version_row.id, final_values
  );
  final_values := restore_terms->'values';
$n2$],
    array[$o3$    source_row.template_version_id, source_row.taxonomy_version_ids,
    parent_ids, source_row.locale, payload_hash::char(64),$o3$,
     $n3$    source_row.template_version_id, restore_terms->'versionIds',
    parent_ids, source_row.locale, payload_hash::char(64),$n3$],
    array[$o4$  perform platform_private.cms_restore_composition_copy(
    source_row.id, new_revision_id, snapshot_time, restore_heads, restore_pattern_ids, restore_block_ids
  );$o4$,
     $n4$  perform platform_private.cms_restore_composition_copy(
    source_row.id, new_revision_id, snapshot_time, restore_heads, restore_pattern_ids, restore_block_ids
  );
  -- BE03c Slice 12 lock order position 6: the carried terms FOR SHARE in ascending id order, then the plan re-run under the lock; a
  -- concurrent merge that changed it is a retryable 409 CONFLICT.
  perform platform_private.cms_restore_lock_term_plan(
    entry_row.owner_id, source_row.id, version_row.id, final_values, restore_terms
  );
  perform platform_private.cms_restore_record_term_assignments(
    new_revision_id, entry_row.owner_id, actor_id, restore_terms
  );$n4$],
    array[$o5$      'taxonomyVersionIds', source_row.taxonomy_version_ids,$o5$,
     $n5$      'taxonomyVersionIds', restore_terms->'versionIds',$n5$]
  ];
  original pg_catalog.pg_proc%rowtype;
  actual pg_catalog.pg_proc%rowtype;
  old_source text;
  new_source text;
  replayed text;
  definition text;
  comment_text text;
  item integer;
begin
  select proc.* into original from pg_catalog.pg_proc proc
   where proc.oid = pg_catalog.to_regprocedure(identity);
  if not found or original.proowner <> 'wejammin_cms_definer'::pg_catalog.regrole
     or not original.prosecdef or original.prokind <> 'f' or original.provolatile <> 'v'
     or original.proconfig is distinct from array['search_path=""']::text[]
     or original.prolang <> (select lang.oid from pg_catalog.pg_language lang where lang.lanname = 'plpgsql') then
    raise exception 'cms_restore_revision: unexpected attributes' using errcode = '55000';
  end if;
  old_source := original.prosrc;
  new_source := old_source;
  for item in 1 .. pg_catalog.array_length(pairs, 1) loop
    if (pg_catalog.length(new_source) - pg_catalog.length(pg_catalog.replace(new_source, pairs[item][1], '')))
         / pg_catalog.length(pairs[item][1]) <> 1 then
      raise exception 'cms_restore_revision: anchor % is not unique', item using errcode = '55000';
    end if;
    new_source := pg_catalog.replace(new_source, pairs[item][1], pairs[item][2]);
  end loop;
  -- the inverse replay (last pair first) restores the installed source byte for byte
  replayed := new_source;
  for item in reverse pg_catalog.array_length(pairs, 1) .. 1 loop
    replayed := pg_catalog.replace(replayed, pairs[item][2], pairs[item][1]);
  end loop;
  if replayed is distinct from old_source then
    raise exception 'cms_restore_revision: amendment is not reversible' using errcode = '55000';
  end if;
  definition := pg_catalog.pg_get_functiondef(original.oid);
  if (pg_catalog.length(definition) - pg_catalog.length(pg_catalog.replace(definition, old_source, '')))
       / pg_catalog.length(old_source) <> 1 then
    raise exception 'cms_restore_revision: definition is ambiguous' using errcode = '55000';
  end if;
  comment_text := pg_catalog.obj_description(original.oid, 'pg_proc');
  execute pg_catalog.replace(definition, old_source, new_source);
  select proc.* into actual from pg_catalog.pg_proc proc where proc.oid = original.oid;
  if not found or actual.prosrc is distinct from new_source
     or pg_catalog.to_jsonb(actual) - 'prosrc' is distinct from pg_catalog.to_jsonb(original) - 'prosrc'
     or pg_catalog.obj_description(actual.oid, 'pg_proc') is distinct from comment_text then
    raise exception 'cms_restore_revision: amendment changed more than the anchors' using errcode = '55000';
  end if;
end;
$amend$;

commit;
