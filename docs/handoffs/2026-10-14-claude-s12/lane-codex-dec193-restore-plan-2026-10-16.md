# DEC-193 restore receiving — read-only 427/428 plan

Native agent: `gpt-6.1-sol / ultra`, `native_registry_green_20261016`.
Worktree: `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`.
Scope: this report only. Proposed SQL/signatures and new tests are **unreleased**.
All SQL, tests and ordinary-carry420–422 remain frozen; no acceptance is claimed.

## Stop boundary: restore parent policy is pending

DEC-200 (`.memory/wiki/decisions.md:5324–5334`) explicitly governs ordinary
`cms_create_revision` / `cms_resolve_conflict`. Its historical-parent path remap
must not silently become restore policy. BE03c1543/1545/1563 requires source
composition translation, fresh provenance and valid storage, but does not answer
whether restore maps recorded historical P1 to the selected newest active P2 at
the same path or refuses that otherwise valid legacy source graph.

For a source graph whose parent IDs are all selected, fresh destination parent
remapping is unambiguous: the revision-bound FK requires it. Historical-parent,
excluded-parent and collapsed-cycle restore disposition is held. Root read the
full normative sources and asked the owner the restore-specific question at
16:54; no answer, default, DEC or implementation is recorded as of this report.
Do not write disputed negative oracles or a placeholder INTERNAL_ERROR branch.

## Normative source spine

- BE03c `.memory/wiki/specs/be/03c-composition-taxonomy-localization.md:1543`:
  named source active instances; retain path, position, mode and local tree;
  current registry repin; withdrawn block/tree member =>
  `migration_chain_incomplete`; inactive pattern => the same **unless the
  instance is detached**; absent compatible-template slot =>
  `template_incompatible`; fabricate nothing.
- BE03c1545: newest per path before eligibility; restore separately selects
  newest eligible **active** source rows. DEC-198 pending preservation applies
  only to ordinary append/resolve (`decisions.md:5348–5357`).
- BE03c1487/1563: canonical nonnull detached trees own their complete content;
  their pin is provenance, never reopened by restore. Plain detached NULL-tree
  rows keep their defined pinned behavior. Copy the tree unchanged, including
  scalar/JSON-null values and the full 512-node/private aggregate envelope.
  `carried_from_id` is nullable immediate carry provenance, not rendering input.
- BE03b `.memory/wiki/specs/be/03b-editorial-workflow-publication.md:1715,2087`:
  source-recorded template authority, source-to-current-active schema chain,
  new draft only, parents `[currentDraftRevisionId,sourceRevisionId]`, no source
  mutation/activation, supersede open conflicts and preserve chain evidence.
- IA `.memory/wiki/specs/ia/deep-dives/03-cms-content-modeling.md:350`:
  independently derive the unique completed-plan chain (including zero-edge),
  compare its identity, reject unprovable translation/template, fabricate nothing
  and retain both revision parents. It supplies no restore parent-path answer.
- BE03b1723–1741: relation target locks at position 2, candidate/dependencies at
  3, active schema at 4 and reviews at 5; never acquire an earlier position late.

## Actual complete RED, not a new execution

Read and hashed root's direct four-lock pgTAP stdout:
`/tmp/wejammin-native-receiving-proto-red-BkaHbW/dec193-dec200-carry-first-red.log`.
SHA-256 `2b00c3f727843147fa632c5f7f17e72df4197b933ea7a7271256e32d24fbea7d`.
Text recount: plan486, 486 visible assertions, 392 PASS, 94 FAIL,
`SUITE_EXIT phase_02_slice_12_dec193_carry.sql 0`; root reports no SQL abort and
final rollback. This file is a `.log`, not a `.tap`. No author DB/baseline check.

Its **18 restore failures** are exact existing assertions:

| TAP IDs | Frozen assertion identities / omission |
| --- | --- |
| 377,378 | CC-RST001: newest active count; complete fresh semantic/provenance copies |
| 385 | CC-RST004: source local full subtree, not current linked target |
| 404,405 | CC-RST005: inactive linked pattern refusal; complete atomic rollback |
| 415,416,421 | CC-RST006: newest count; semantics/provenance; legacy detached SQL-NULL tree retained |
| 439 | CC-RST007: nonnull detached copy despite inactive retained prior pin |
| 441,442 | CC-RST008: missing source-bound slot refusal; complete rollback |
| 453,454,459 | CC-RST009: count; semantics/provenance; current deprecated reachable-tuple digest |
| 480,481 | CC-RST010: withdrawn own-tree descendant refusal; complete rollback |
| 485,486 | CC-RST011: withdrawn legacy pinned root refusal; complete rollback |

Frozen source: `supabase/tests/phase_02_slice_12_dec193_carry/020-restore.sqlinc`.
The successful-envelope/manifest/field/source-immutability/effect/replay/CAS
controls pass. In particular 369–376,379–384,386–403,407–414,417–420,
422–438,440,443–452,455–458,460–479,482–484 pass. These establish genuine
receiving omissions, not missing source authority or invalid fixture setup.
Other cohort failures belong to ordinary carry or its boundaries, not restore.

## Complete installed-source reconstruction

Read all 565 physical lines of promoted
`supabase/migrations/20261005018055_cms_restore_revision_derived_state.sql`:
27366 bytes, SHA-256
`cc1ba7d128cdb840b16160481e78f383248cf0cd3fb7ba93b630fcdaaea4d07e`.
Read the later private-body amendment in
`20261010130000_cms_settings_write_tail_lookup.sql:103–205`:
10085 bytes, SHA-256
`7bd5eb6405875ba052e83b45cece793534156bba152cd5a695c4b2c165838784`.
The locale head-move migration changes triggers, not this private body.

The extracted pre-E7 body MD5 is `551996cb945b4b09d634e19d39710a59`, matching
E7's locked predecessor fingerprint. Reconstructing its exact E7 positive-201
tail yields a final prior body of 27517 bytes, SHA-256
`a8e0b1e886c5ba79e33965224e4938f9fbbecc702082bb6de8915679b7528a81`.
This is checked-in source-string reconstruction, not a live catalog capture.

Each proposed seam occurs **once** in that final body:

1. Declaration: `response jsonb;` immediately followed by outer `begin`.
2. Early seam: payload-hash verification208–210 followed by the active-schema
   comment212. Move the exact existing relation lock block here, then preplan
   composition dependencies before active schema lock228.
3. Removed late seam: exact relation-target comment/perform365–374, before the
   field translation comment376. Remove only this copied block, not its behavior.
4. Copy seam: exact new-revision INSERT values tail415–417 followed by the first
   field INSERT418. Insert the prepared composition-copy call between them.

The eventual migration must guard every unique old/new anchor, prove a full
inverse back to the actual prior source, use canonical `pg_get_functiondef` /
CREATE OR REPLACE, and compare OID, full `pg_proc` minus `prosrc` and comment.
No wrapper rename, stale full-function copy or broad replacement is proposed.

## Proposed bounded decomposition — not an API commitment

NEW `supabase/migrations-wip/dec193/20261016042700_cms_restore_composition_plan.sql`:

- `cms_restore_composition_plan(uuid)` RETURNS TABLE
  `(heads cms_composition_instances[], pattern_ids uuid[], block_ids uuid[])`.
  Internally select named-source newest heads before active-only eligibility.
  Prelock the exact source-bound template and complete required pattern/registry
  union deterministically. Canonical nonnull trees contribute only own nodes;
  NULL pattern-origin rows contribute the real pinned forest/nested identities;
  standalone NULL rows contribute their own block identity. Re-read activity and
  closure under the locks; no unproved late dependency lock.
- `cms_restore_composition_registry(cms_composition_instances,uuid,uuid[],uuid[])`
  RETURNS text. Proposed second argument is the actual entry content type;
  arrays are the internal captured dependency set, never caller attestation.
  Recompute current digest only after target schema position4 is held, checking
  actual references against the prelocked set. Do not freeze a digest against an
  unlocked active schema and later apply it to a different schema version.

NEW `supabase/migrations-wip/dec193/20261016042800_cms_restore_revision_composition.sql`:

- `cms_restore_composition_copy(uuid,uuid,timestamptz,
  cms_composition_instances[],uuid[],uuid[])` RETURNS void. Source, destination,
  timestamp and the internally prepared typed plan. Independently verify actual
  source/destination owner, entry, locale, destination schema and complete
  selected-source membership; do not trust an agreeing supplied ID list.
- Preplan all destination UUIDs and valid parent edges before composition writes;
  insert parent-first under the real revision-bound FK. Parent-policy branch
  remains unreleased until the owner answer. Copy typed rows, changing only fresh
  ID, target revision, version1/times, immediate provenance, parent remap and the
  newly computed registry digest. Preserve all other semantic members/created_by.
- Add only the guarded existing-RPC amendment described above. Keep each helper
  and migration naturally formatted within project limits; request another exact
  bounded helper path if needed, never minify or weaken guards to fit.

Proposed helper posture: VOLATILE for locks/writes, CMS-owned, SECURITY INVOKER
where existing closure suffices, empty search path, API EXECUTE closed. Check
existing table/function closure; do not add grants, RPC context, new public DTOs,
statuses, reasons, registry policy or schema/JSON aggregate caps.

## Translation and authority details that must survive implementation

- Keep existing entry/authority/source concealment119–160, exact reservation
  replay167–178 and CAS183–185 ahead of the new work. Source composition is never
  selected from current_row, and the source need not be an editable draft.
- Move existing relation locks365–374 after verified source payload208–210;
  preserve their target set/exclusions and existing visibility/auth/CAS behavior.
  Position2 must precede new pattern3, schema4 and the revision-trigger review5.
- Keep source template compatibility gate334–349 against the target active
  schema. Validate slots against that exact source binding; never pick the
  current draft's template or a newer default template. Reuse exact flat-slot
  semantics (404/418), not first-segment/prefix acceptance.
- For linked NULL-tree rows, require the real pinned root and nested graph active
  and compatible under lock. For `link_mode='detached'`, the inactive-pattern
  exception applies literally even with SQL NULL detached_tree; retain its real
  pinned behavior, block checks and template checks. Do not require nonnull tree
  as the exception predicate.
- Nonnull canonical trees never reopen their retained pin or nested provenance.
  Use own nodes/effective values and current reachable registry tuples only.
  Deprecated blocks pass with changed lifecycle tuple; withdrawn/missing own
  identities refuse `migration_chain_incomplete` atomically.
- NULL-tree pattern-origin digest retains the existing whole-pin fold. This is
  distinct from the own-tree digest: 020:93–116 independently expects deprecated
  root/child tuples for the local canonical tree and the additional s12pd.block
  tuple for the legacy/linked whole pin. Do not replace both with root-only folds.
- Registry repin is not a pattern-target acceptance or block-version upgrade.
  Preserve original pattern/block identities, local content, bindings, position
  and NULL-tree value; no current target content is substituted.
- Keep field/relation translation, chain evidence, head CAS, conflict supersession,
  exact two effect pairs, envelope and E7 tail unchanged. Existing revision INSERT
  trigger17580:365–393 invalidates older live reviews; no duplicate invalidation.
- Translate only known semantic admission failures to the existing restore token.
  Do not swallow arbitrary later INSERT faults, deadlocks or original diagnostics;
  the existing wrapper13100:82–100 maps deadlock to CONFLICT and restores context.

## Missing TEST discriminators before production GREEN

Propose a separately claimed bounded restore fixture/test extension (for example
NEW carry021/022 plus driver includes); no such write is released by this report.
Preserve 000/010/015/016/017/018/020 and their current oracles.

1. Active-only newest selection: pending, draft and retired latest rows hide older
   active rows; never import ordinary pending preservation or resurrect history.
2. Active linked outer pin with inactive nested pin refuses; the same real legacy
   detached NULL-tree case preserves its defined pin under the literal exception.
3. Nonnull tree with inactive/unavailable or withdrawn **provenance-only** content
   still succeeds when own nodes are valid; own withdrawn descendant still fails.
4. Source /main template versus different current /side template: positive source
   binding wins; inverse absent-source-slot case refuses. Existing020's negative
   slot fixture alone does not defeat every current-template substitution mutant.
5. Full512-node/>256KiB tree, standalone legacy NULL, exact selected-parent ID
   remap, authored position/created_by and second-generation immediate provenance.
6. Later copied-row fault: prove an actual first copy, fail a distinct later copy,
   then compare complete revision/composition/review/conflict/reservation/chain
   manifest/audit/outbox images. Preserve original injected error identity.
7. Genuine independent-client relation-target barrier: observe position2 wait
   before any pattern/schema work; changed target then yields existing refusal
   and no durable effects. Add locked root/nested-currentness race discriminators.
8. Replay after later dependency withdrawal still returns the original complete
   restore envelope without fresh translation or side effects.
9. Owner/OID/ACL/comment/inverse-source guards and real destination parent FK
   behavior. Historical-parent/excluded-parent/cycle restore expectations wait
   for the pending answer; do not borrow ordinary018's policy by implication.

## Verification and handoff limits

Migration-management/TDD planning kept source facts, observed RED, proposed
implementation and unresolved policy separate. This turn writes only this report
through absolute apply_patch. No repository parser, formatter, tests, SQL, DB,
Docker, runtime command, Git, network or child agent was used. Source/text reads
and hashing do not prove runtime syntax, lock order, atomicity or deployment.
Root owns any eventual test release, full locked-source review, GREEN release,
actual SQL/race/regression execution and acceptance accounting. Restore427/428
remains held; ordinary-carry420–422 is unaffected.
