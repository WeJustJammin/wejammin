-- Slice 10 DEC-107 conflict-record hardening: bound the private proposed_values
-- payload instead of checking only its JSON shape.
--
-- 20260927100000 established platform_private.cms_conflict_records with a
-- shape-only CHECK (jsonb_typeof(proposed_values) = 'object'). An uncommitted
-- candidate autosave is caller-supplied private data, so shape alone is not a
-- sufficient bound. This forward migration tightens the SAME named constraint
-- to the frozen 256 KiB / depth-8 / 128-key / 128-array ceiling by delegating to
-- the existing immutable Slice 09 helper platform_private.cms_json_bounded
-- (see 20260902080000_content_schema_registry_authority.sql), which already
-- implements byte, depth, key and array bounds and is asserted by the Slice 09
-- contract suite.
--
-- Forward-only by design: 20260927100000 is already applied to shared local and
-- hosted environments, so its SQL is left byte-stable and migration ordering and
-- provenance are preserved. The constraint NAME is deliberately reused so the
-- locked phase_02_slice_10_conflict_schema suite keeps its existing assertion
-- anchor; only the predicate widens.
--
-- Caveat (documented obligation): a CHECK that calls an immutable plpgsql
-- helper is not re-validated when that helper's body changes later, so this
-- bound is pinned to cms_json_bounded's behaviour as of this migration. Any
-- future change to the helper's semantics requires a NEW forward constraint
-- migration rather than a body-only edit.
--
-- proposed_values is only ever populated when yours_source = 'proposed'; the
-- yours_source binding CHECK in 20260927100000 already forbids it alongside a
-- persisted revision identity, so this bound composes with that coupling.

alter table platform_private.cms_conflict_records
  drop constraint if exists cms_conflict_records_proposed_values_check;

alter table platform_private.cms_conflict_records
  add constraint cms_conflict_records_proposed_values_check
  check (
    proposed_values is null
    or (
      jsonb_typeof(proposed_values) = 'object'
      and platform_private.cms_json_bounded(proposed_values, 262144, 8, 128, 128)
    )
  );
