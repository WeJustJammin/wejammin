-- Slice 10 round 3 (lane H, evidence gaps EA-AC002 / EB-AC056; DEC-141 / gap-resolution D-3):
-- CMS-03B-03 comparison resolves the recorded template and taxonomy versions of both sides.
--
-- IA03 "Comparison" / CMS-07: both compared revisions exist "with their recorded schema, template
-- and taxonomy versions"; an unresolvable recorded schema, template or taxonomy version is a
-- non-disclosing refusal.  cms_compare_revision_resolvable resolved the schema version and the
-- block registry only, so a revision pinning a taxonomy version that resolves nowhere (or a
-- template whose registry row is gone) was compared as if it were fine (200).
--   * taxonomy: Slice 10 has no taxonomy-version authority the comparison could resolve against
--     (Slice 12 receives the obligation), so a NON-EMPTY recorded taxonomy-version list on either
--     revision fails closed with the typed 422 comparison_unavailable (message only: no id, count
--     or version).  Restore keeps its own rule (each pin resolves against cms_taxonomy_versions,
--     else migration_chain_incomplete).
--   * template: the recorded template version is re-resolved against the template registry; a
--     pin that no longer resolves is comparison_unavailable.  (It cannot dangle at write time:
--     cms_entry_revisions_template_registry_check.)
-- The compare response is a closed strict contract (leftRevisionId, rightRevisionId, restore,
-- changes, ...), so recorded versions are resolved, not added to it.
-- Signature, attributes, owner and grants unchanged (CREATE OR REPLACE).
-- Proof: ../tests/phase_02_slice_10_compare_lineage.sql and the un-TODO'd
-- ../tests/phase_02_slice_10_ev_ea_gaps.sql.
-- Forward-only.
begin;

create or replace function platform_private.cms_compare_revision_resolvable(
  p_entry_id uuid,
  p_revision_id uuid
)
returns boolean
language sql
stable
set search_path = ''
as $body$
  select exists (
    select 1
    from platform_private.cms_content_entries entry_row
    join platform_private.cms_entry_revisions revision_row
      on revision_row.entry_id = entry_row.id
     and revision_row.owner_id = entry_row.owner_id
    where entry_row.id = p_entry_id
      and revision_row.id = p_revision_id
      and platform_private.cms_compare_version_resolvable(
        entry_row.id, revision_row.schema_version_id
      )
  )
  -- DEC-141 / gap-resolution D-3 (BE03b "Recorded taxonomy and composition references in
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
  -- IA03 "Comparison": an unresolvable recorded template version is a non-disclosing refusal.
  -- A pin cannot dangle at write time (cms_entry_revisions_template_registry_check), but the
  -- comparison re-resolves it against the template registry instead of trusting the stored
  -- id, so a pin whose template row is gone is refused here and never compared as if fine.
  and not exists (
    select 1
    from platform_private.cms_entry_revisions pinned_revision
    where pinned_revision.id = p_revision_id
      and pinned_revision.entry_id = p_entry_id
      and pinned_revision.template_version_id is not null
      and platform_private.cms_template_registry_valid(
        pinned_revision.template_version_id
      ) is not true
  )
  and not exists (
    select 1
    from platform_private.cms_composition_instances instance
    where instance.revision_id = p_revision_id
      and instance.state = 'active'
      and not exists (
        select 1
        from platform_private.cms_block_definition_versions block_row
        where block_row.block_key = instance.block_key
          and block_row.block_version = instance.block_version
      )
  )
$body$;

commit;
