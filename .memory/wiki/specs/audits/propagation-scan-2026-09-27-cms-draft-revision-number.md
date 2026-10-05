# Propagation scan — CMS-03B-11 draft authoring base

**Status:** scan only; awaiting owner confirmation before the locked-contract apply pass.  
**Origin:** DEC-106 CMS-05 protected draft-detail route in BE03b.  
**Decision type:** backend response-contract correction with FE, IA, Slices 10/12,
SQL, and test cascade. The 2026-09-28 extension adds the missing schema identity
to the original revision-number scan; neither field is approved for application.

## Explicit contradiction

- BE03b's `EntryRevisionRequest.baseRevision` is a positive decimal revision number, and `EntryCreateResource` / `EntryRevisionResource` expose `revisionNumber`. `EntryDraftDetailResource` omits it, although CMS-03B-11 is the read that must supply the current editable draft for CMS-05 autosave. Its `revision.version` is the immutable row version, not the revision number. The existing `cms_get_entry_draft` RPC returns only `revision.version`; after the first revision it cannot supply a truthful `baseRevision` to the editor.
- FE03 CMS-05 requires the protected draft load and an explicit canonical base revision for changed-path autosave. The local `CmsEditorialEntryDraft` state already requires `baseRevision`, but no field in the locked draft-detail response can populate it after the first revision.
- IA03's entry-bootstrap/draft-detail decision explicitly requires the
  authorized draft read to include schema identity and canonical versions.
  BE03b's closed `EntryDraftDetailResource` and the current
  `cms_get_entry_draft` JSON projection omit `schemaVersionId` even though the
  SQL already verifies `revision_row.schema_version_id` against the active
  content-type version. Without that ID, the CMS-05 editor and CMS-15 locale
  form cannot load the exact 03a field definitions or determine localizable
  and no-fallback fields from protected server data. No caller-supplied schema
  selector may stand in for this read.

## Consistent references and affected targets

- Consistent: BE03b CMS-03B-01 request and CMS-03B-10 create success carry the decimal revision number; IA03 requires explicit readable base-revision autosave.
- Contract apply targets: `.memory/wiki/specs/be/03b-editorial-workflow-publication.md` `EntryDraftDetailResource` and CMS-03B-11 validation/read rules; `.memory/wiki/specs/fe/03-cms-content-modeling.md` CMS-05 and CMS-15 data mapping; `.memory/wiki/specs/ia/03-cms-content-modeling.md` draft-detail contract; `.memory/wiki/specs/ia/deep-dives/03-cms-content-modeling.md` draft-detail boundary; Slice 10 AC-067/075 and Slice 12 CMS-15 trace wording; `packages/contracts/src/cms-editorial/entry-draft-detail.ts`; forward-only SQL for `cms_get_entry_draft`; Worker/web fixtures and tests; generated OpenAPI and spec graph where applicable.
- Preserve the current security boundary: both additions are server-derived and
  bound to the same authorized current immutable draft. `revisionNumber` is a
  positive decimal `Version`; `schemaVersionId` is the verified current draft
  schema UUID. No caller-selected base, authority, or private values are added.

## Proposed correction for confirmation

Add required `revisionNumber: Version` and `schemaVersionId: UUID` to the
protected `EntryDraftDetailResource`. Populate them from
`cms_entry_revisions.revision_number` and the already-validated
`cms_entry_revisions.schema_version_id`, independently of `revision.version`;
verify first/later revisions and schema mismatch refusal. The browser may then
construct `baseRevision` from `revisionNumber`, `expectedVersion` from
`entry.version`, and fetch the exact 03a field-definition version by
`schemaVersionId`. The composite GET ETag remains a read-representation
validator, not the numeric write `If-Match` value.

No locked specification, SQL function, or response schema was changed by this
scan. The apply shard must wait for explicit confirmation of both required
fields, then run contract-first RED→GREEN tests, cross-layer consistency checks,
and graph refresh.
