# DEC-201 restore implementation preflight — NOT a GREEN release

Root integration notes, 2026-10-16 18:04 UTC. Native `gpt-6.1-sol`/`ultra`.
Source-only helper inventory plus actual root RED/catalog evidence. No new
production file, private API commitment, acceptance tick or implementation.

Continuation status: the 2026-10-17 selection below supersedes the original
three-helper/file sketch, and its explicit contract RED is recorded. Production
445–447 authoring is released after independent design clearance;448 remains
held for actual relation QA RED and its own source review. Current receipts
are consolidated in `CODEX-NATIVE-VALIDATION-2026-10-17.md`; older report/time
references are historical, not substitutes for that checkpoint.

## Actual baseline

- ALT509; all49 executed WIP immutable. Restore post-E7 body SHA
  `a8e0b1e886c5ba79e33965224e4938f9fbbecc702082bb6de8915679b7528a81`,
  MD5 `b326ae0f547874039e8f410861f27554`, verified in live catalog. Existing
  plan's pre-E7 fingerprint is NOT the correct amendment baseline.
- Expanded restore/carry808/741PASS67FAIL/noabort; original18 restore failures
  plus49 new consequences of missing receiving/copy/refusal/remap. New public
  setup/placement/lifecycle premises pass; generation depends on absent copies.
  Injected second-copy fault is not reached until copying exists. Exact ledger
  and receipt SHA in `CODEX-NATIVE-VALIDATION-2026-10-16.md`17:43 section.
- DEC201 is confirmed, not pending. Restore selects newest-per-path BEFORE
  active-only eligibility; historical parent→owner/source-revision-bound path
  →selected active fresh copy. Excluded/missing parent or collapsed cycle
  refuses whole restore. No pending/draft carry, history resurrection, detach,
  child drop, fabricated parent or cross-revision reference.

## Existing helper facts that constrain implementation

1. `cms_pattern_blocks_compatible(uuid,jsonb,jsonb) RETURNS boolean` final
   definition is **20261014090200_cms_pattern_blocks_compiler_range.sql:21–59**,
   not the superseded20300 manifest-only definition. It is STABLE, private
   SECURITY DEFINER, no locks/writes. Every reachable registered block's
   `compatibility_range` must cover each requested owner's ACTIVE artifact's
   `compiler_version`. Do not add a mandatory `blocks`/`blockDefinitions`
   manifest-key rule that this final helper deliberately replaced.
2. `cms_detached_tree_registry(uuid,jsonb,uuid,jsonb DEFAULT '{}') RETURNS text`
   final41600 definition is VOLATILE SECURITY DEFINER. It expands/validates
   canonical own nodes, checks current registered/lifecycle/compiler-range
   compatibility, per-value/executable-leaf policy and signed child/depth/node
   rules, then returns the tuple JCS digest. It still takes block-row FOR SHARE
   at41600:42–52. After schema position4 it is safe ONLY if every actual block
   reference was already locked at3 and independently checked against the
   captured complete set. No supplied-list/captured-source API exists today.
3. `cms_pattern_registry_digest_readonly(uuid,jsonb) RETURNS text`,44000,
   folds the current whole reachable B-pin tuples without locks. Missing or
   withdrawn blocks return SQLNULL. It can support a current repin after proper
   early locking, but does not itself prove activity, compatibility or closure.
4. `cms_pattern_live_pin_reason(uuid,uuid,integer,text)`,44100, is NOT directly
   a restore policy: lines74–78 refuse a changed current registry digest.
   Restore intentionally repins current tuples, including allowed deprecated
   blocks. Reuse source-supported activity/type checks without accidentally
   importing publication's stale-digest refusal into restore.
5. `cms_pattern_nested_closure` and `cms_governed_pattern_closure` are capped, read-only graph
   traversals; missing nested identities can appear NULL. A planner must fail
   closed on unprovable/missing/cyclic/depth-truncated legacy graphs, not treat
   a capped partial closure as complete. Producer20400:186–230 proves active
   nesting, depth and expanded512 bounds for genuine new pattern versions.
6. `cms_pattern_snapshot_expanded(jsonb) RETURNS jsonb`,40500, is immutable,
   store-free canonical expansion. JSONBnull→empty array is distinct from SQL
   NULL/invalid canonical input. `cms_revision_effective_composition(uuid)`,
   42300, includes newest draft/active/pending: it is NOT restore's active-only
   selector. Ordinary42100 carry also admits pending and has no repin; reuse
   its parent-path/topological algorithm, not its unmodified entry point.
7. `cms_successor_template_gate(actor,party,templateVersion,type,candidate,pointer)
   RETURNS void`,20261002216000:20–50, and its resolver/binding checker take no
   dependency locks. Resolver132000 sets `app.cms_rpc=true`; preserve caller
   request/session scope. Restore uses the EXACT source template version and
   keeps its existing compatible-target-schema gate, never the current draft's
   different template. Final41800 root-snapshot lookup derives the exact source
   revision template, matches `slots[].key` to `slot_key` and verifies the path
   prefix. Root and an independent source lane confirmed these originals on
   2026-10-17; bare content type/path without revision context is insufficient.

## Original decomposition sketch — superseded by 2026-10-17 selection

The old427/428 plan is a design aid, not a mandate. Prefer NEW monotonic
migrations beyond444 so helpers do not depend forward on later440 definitions.
A natural three-file split (plan, registry, copy+guarded RPC amendment) is
reasonable; keep naturally formatted helpers within project limits.

- Proposed plan(sourceUUID)→`heads cms_composition_instances[]`,
  `pattern_ids uuid[]`, `block_ids uuid[]`: derive the named source and exact
  source-template/pattern/nested/full-B or canonical-own/standalone block union
  from actual rows; early lock deterministic IDs and re-read/prove closure.
- Proposed registry(sourceComposite,actualEntryTypeUUID,lockedPatternIDs,
  lockedBlockIDs)→text: current repin after schema4, no NEW earlier locks,
  fail closed on actual refs outside the captured set. Live NULL pins require
  active/compatible root+nested pins; legacy detached NULL preserves its real
  B content while ignoring provenance activity; canonical nonnull validates
  only own nodes, not unrelated provenance. No aggregate snapshot public cap.
- Proposed copy(sourceUUID,destinationUUID,snapshotTime,heads[],patternIDs[],
  blockIDs[])→void: independently verify actual complete selected membership,
  owner/entry/locale/target schema and captured dependencies, preplan all fresh
  UUIDs and DEC201 parent edges, reject unrepresentable graphs before copying,
  then insert parent-first. Preserve every other typed composite member,
  created_by/position/full tree/SQLNULL, immediate provenance and version1.
- Private CMS-owned SECURITY INVOKER/empty search_path/no API-role execute;
  prove existing role/crypto/SELECT/INSERT closure rather than widening grants.
  Source list agreement alone is not proof that the list is complete.

## RPC and validation boundaries

Preserve actual restore concealment, author/editor+assignment proof,
reservation replay before CAS, named-source hash verification, source-bound
template, chain/field/relation translation, E7 response envelope and effects.
Amend unique exact anchors with inverse/source/OID/full-pg_proc/comment guards.
The existing revision INSERT already invalidates the old review: do not add
duplicate review invalidation, per-copy audit or events.

The existing late relation-target shared lock pass365–374 must not remain
after schema4 when adding pattern/block3. Moving it earlier is necessary but
does NOT alone prove BE03b1737 caller visibility/assignment fencing. Check the
actual resolver/assignment path; uniform refusal/no invisible-target lock and
real concurrency remain required. Do not silently close that separate boundary.

Map only expected policy failures to existing restore translation/template
tokens; preserve unexpected original faults, and existing typed lock-failure
handling. The real second-copy fault must propagate and roll back everything;
same-key retry must then be fresh, with exactly the existing restore/review
effects, and later dependency withdrawal must not revalidate an exact replay.

After any implementation: independent source review, fresh full expanded
carry, affected regressions/currentness and genuine concurrent dependency
barriers, then canonical gates. New-manifest INSERT-fault isolation and real
relation races are not proven by the current serial full-store snapshots.

## Root contract selection — 2026-10-17, contract RED and design review recorded

Three alternatives were considered: replace the complete restore body; reuse
ordinary42100 and the locking41600 registry gate; or add a captured private
plan/read-only registry/copy spine plus a narrowly guarded existing-RPC patch.
The last preserves the E7 body/attributes, separates restore's active-only
policy from ordinary pending carry, and avoids acquiring block locks after4.
Full replacement risks stale contracts; ordinary carry has the wrong eligibility
and no repin;41600 additionally locks/revalidates producer props. None is a
reason to weaken existing tests or change a public contract.

Selected NEW private contracts (no defaults or overloads):

| Function | Return | Volatility / language |
| --- | --- | --- |
| `cms_restore_composition_heads(uuid)` | SETOF `platform_private.cms_composition_instances` | STABLE / SQL |
| `cms_restore_composition_refs(platform_private.cms_composition_instances)` | TABLE(`kind text`, `ref_id uuid`) | STABLE / PLpgSQL |
| `cms_restore_composition_plan(uuid)` | TABLE(`heads platform_private.cms_composition_instances[]`, `pattern_ids uuid[]`, `block_ids uuid[]`) | VOLATILE / PLpgSQL |
| `cms_restore_composition_registry(platform_private.cms_composition_instances,uuid,uuid[],uuid[])` | text | STABLE / PLpgSQL |
| `cms_restore_composition_copy(uuid,uuid,timestamptz,platform_private.cms_composition_instances[],uuid[],uuid[])` | void | VOLATILE / PLpgSQL |

Every helper is CMS-owned SECURITY INVOKER, empty search_path, with no PUBLIC,
anon, authenticated or service_role EXECUTE. No new schema/type or application
grant. Captured arrays identify a closure, NOT authority or proof of held locks.
The existing trusted restore RPC must call the planner at position3; private
helper inputs cannot replace its actor/source/entry/CAS checks.

Argument meanings are private and explicit: heads/plan take the actual source
revision ID; refs takes its complete persisted source row. Registry's second
UUID is `p_content_type_id`, proved equal to the source revision entry's actual
content type, not a template ID or content-type-version ID. The final90200
compiler-range helper resolves that type's active artifact. Copy takes source
revision ID, destination revision ID, snapshot time, captured heads, sorted
unique pattern-version row IDs and sorted unique block-version row IDs. Source
and destination content-type-version IDs need not equal: restore can translate
an older schema into the active one. Prove their real entry/type/owner/context,
the destination's actual target schema and the retained source-bound template;
do not reject legitimate schema translation by imposing schema-ID equality.

`heads` is the one newest-per-C-collated-path THEN active-only selector, scoped
to the actual source owner/revision and returned in deterministic position/path/
id order. `refs` checks a supplied composite against its actual complete stored
row and returns actual source-template (`template`), exact root/nested NULL-pin
versions (`pattern`) and reachable registry version rows (`block`), deduplicated.
Canonical nonnull trees contribute ONLY own blocks plus their actual template;
standalone SQLNULL contributes its one actual block. Missing/unprovable/cyclic/
depth-truncated graph refuses; origin activity is not checked by this extractor.
Legacy detached SQLNULL means a NONNULL pattern pin with a SQLNULL detached
tree: extract its complete actual B forest, without an activity gate. It is
not the separate pattern-null standalone case. Live linked SQLNULL activity
and recursive edge-type compatibility belong only in the registry gate.

`plan` derives the full union, including the source template even for0heads,
locks rows in deterministic ascending UUID/kind order FOR SHARE before schema4,
then rederives and compares closure. It returns one row with typed empty arrays
when selection is empty. Expected lock failures retain existing CONFLICT policy.
No foreign-owner pattern/template lock; code-owned registry rows are global.
The source-bound template is separately derived, locked and rederived even
though the returned arrays contain only pattern/block version IDs; zero heads
does not omit that template. Captured arrays are sorted, unique and nonnull;
copy rejects NULL members, duplicates, extra IDs or incomplete sets, rather
than treating a caller-supplied superset as proof of completeness.
`pattern_ids` contains resolved `cms_pattern_versions.id` version-row UUIDs,
never the lineage `pattern_id`; block IDs likewise identify registry rows.
Block closure includes ONLY blocks actually reached by selected compositions,
not every unused `slots.allowedBlocks` declaration of the source template.
The existing gate02216000:30–36 → resolver02132000:38–56 → final binding
helper20260930161000:16–27 reads the source template's state/type compatibility,
not unused registry entries. The template row is still separately locked and
reproved. With zero heads, both returned dependency arrays are typed empty.

`registry` rederives real refs and requires them to be within the captured sets;
copy independently recomputes the COMPLETE union and requires exact set equality.
Slot validation derives the source revision's exact template: no template means
root slot; otherwise row.slot_key must name an actual slots[].key and row.path
must begin `/<key>/`. Do not substitute the current draft's template. Existing
source-template/target-schema compatibility gate remains and is locked early.

For a live SQLNULL pin, require active/compatible root and nested pins. For a
legacy detached SQLNULL pin, ignore origin activity but resolve its actual B
forest and validate its blocks. Repin NULL pins with44000's read-only whole-B
tuple fold; use flat own-node block refs for canonical and standalone rows with
the same read-only fold/compiler-range checks. Never pass copied props through
an authored request/forest validator, invent aggregate caps/object coercion,
fabricate a stored tree, or use44100's stale-digest refusal. Missing/withdrawn/
unprovable registry uses existing migration_chain_incomplete; source slot loss
uses template_incompatible. Do not catch unexpected injected/programming faults
as an expected policy refusal.

`copy` verifies real source/destination owner/entry/locale/schema/template and
complete selected row images/closure before writes; preallocates all fresh IDs,
maps recorded historical parent→source path→selected active head, and plans a
parent-first order. Missing/excluded/collapsed cycle refuses whole restore.
Typed copies change only identity/revision/version1/times/immediate provenance/
remapped parent/current digest; every other member stays exact.

Proposed NEW monotonic files445(heads/refs/plan),446(registry),447(copy), then
448(guarded RPC amendment). No file is released by this note. Source helper
contracts must first get explicit missing-helper/security RED and independent
design review. Relation visibility/assignment/ordering gets its own TEST-first
coverage before448; moving the legacy lock pass alone is not an acceptance fix.

### Root private-contract RED — 2026-10-17 21:53 UTC

Root ran the frozen standalone86-check contract suite on the locked ALT509
baseline. Complete `1..86`, contiguous86 assertions,1PASS/85FAIL, psql exit0,
strict TAP runner exit1, no SQL abort. Missing five helpers fail signature,
catalog/ACL and real-role probes explicitly; the original-caller restoration
control passes. This is the expected missing-contract RED, not behavioral
restore/security acceptance. Independent TEST review is STATIC CLEAR; the
independent design clearance and subsequent bounded release are recorded below.

Receipt: `/tmp/wejammin-native-s12-20261017.Adf0uP/dec201-private-contract-509-first-red.log`,
SHA256 `42704a8f7fce8553cdb69639ee2c2033f3139adc9fb1bc6aacf54f84bb3e77b4`.
No production file is released by this checkpoint.

### Root bounded GREEN author release — 2026-10-17

Independent native design challenge found no source-backed blocker after the
explicit UUID/schema-translation, legacy detached, template closure and
version-row-ID clarifications above. This is contract-design clearance, not
implementation or runtime proof. Root selects the captured-plan/read-only-
registry/typed-copy alternative and releases these exact NEW files, one owner
each, after the genuine86-check missing-helper RED and808 behavioral RED:

- `20261017044500_cms_restore_composition_plan.sql`: heads/refs/plan only.
- `20261017044600_cms_restore_composition_registry.sql`: registry only.
- `20261017044700_cms_restore_composition_copy.sql`: copy only.

All are under `supabase/migrations-wip/dec193/`. Authors cannot edit existing
executed SQL, fixtures/tests, public contracts, grants/config/environment or
each other's files. Root owns formatting, parser and all runtime/DB work.
Each function remains private under the frozen contracts; no widened grants.
Independent production review and actual private-contract/behavioral checks
remain required.448 RPC integration is NOT released: real relation-target
visibility/assignment/order TEST-first evidence remains its prerequisite.
