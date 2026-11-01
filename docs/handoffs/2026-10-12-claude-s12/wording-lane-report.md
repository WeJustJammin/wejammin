# Slice 12 wording lane report (2026-10-12)

Worktree `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`, branch `claude/phase2-slice12`, HEAD `4a97ee4d95e9a61c8646522d3779e96e5323c830` (unchanged; nothing staged, committed or stashed). Docs, specs, plan, trackers and one evidence-ledger entry only. No pnpm, vitest, tsc, eslint, prettier, docker, psql or supabase was run. Only read-only `node` scripts that read files were run (listed under Checks). No memory record, no compile, no edit to `decisions.md`, `patterns.md` or `blockers.md`.

Line numbers below were resolved by script against the files as they stand after this lane's edits.

## Read these first (deviations and judgement calls)

1. **Slice 10 AC030 ledger entry is now `partial`, not `verified`.** The brief said to adjust only clause text. G5-01 adds a parenthetical claim (composition changes are written only by CMS-03C-02 and CMS-03C-15 under the entry aggregate `version` and are reported by comparison, never accepted as `changedPaths`) that no cited Slice 10 test proves, and Slice 10 ships no composition write path. I split it into its own clause with `citations: []` (the "new clause has no citation" case the brief anticipated). The guard (`scripts/evidence/ledger-guard-lib.mjs`, `statusProblems`) rejects a `verified` entry with an uncited clause, so I set `status: 'partial'` and wrote a limitation (same convention as Slice 11 wording batch S1-04/S1-05). The two lines are `tests/contracts/phase-02-slice-10-evidence-ledger-001-035.ts:5681-5683`. To revert to a single cited clause instead: merge the clause at `:5624-5627` back into the `/blocks/...` clause at `:5584`, and restore `status: 'verified'`, `limitation: ''`. The refusal part of the claim stays fully cited (existing 6 citations kept on `` `/blocks/...` and every other pointer is refused ``).
2. **DEC-182 is cited inside the BE03b spec text** ("; DEC-182)" at the end of the new parenthetical, BE03b:251 and BE03b:1543) because the brief says to cite it beside each spec change. The plan, tracker and ledger criterion text carries no DEC id (the batch text is applied exactly as PROPOSED, and ledger `text` must equal the tracker claim byte for byte).
3. **G5-03 line is BE03b:1543**, not :1538 as the brief says (the draft says :1543; resolved by script).
4. **DEC-182 is not yet in the derived `.memory/wiki/decisions.md`**; it exists as raw record `.memory/raw/events/2026-10-12.jsonl:11` and is cited by id.
5. The existing Slice 12 cascade text in the tracker (line 15) said G5 and the existing-row defects "wait in the owner wording-batch draft"; I changed that one sentence to "waited ... and are applied under DEC-182 (next paragraph)" and added "per block root after DEC-181" to its DEC-175 sentence, so the narrative does not contradict the new rows.

## Task 1: DEC-182 (owner ratified all items)

W-01..W-10 were applied by script from the CURRENT/PROPOSED code blocks of `wording-batch-draft.md`; for every row each CURRENT was asserted equal to the file text (checkbox to first source link) in both plan and tracker before replacement, and the checkbox and source links were kept. All 9 text rows matched; none needed adjustment.

| Item | Row | Plan line | Tracker line | Old -> new (abbreviated) |
| --- | --- | --- | --- | --- |
| W-01 | AC022 | 3121 | 784 | `pair never reused; 422/409` -> reserved keys (`context`, `versions`, `new`), `(owner, key, version)` triple, first version `expectedVersion: null`, successor names parent `version` |
| W-02 | AC025 | 3124 | 787 | `audience 1–64 safe chars` -> `` `^[a-z0-9_-]{1,48}$` `` matched as submitted, never trimmed |
| W-03 | AC027 | 3126 | 789 | `positive version; linked or detached only` -> positive version naming an `active` PatternVersion of that lineage whose `compatibleTypeIds` lists the revision's content type (else 422 `pattern_version_not_active` or `pattern_incompatible`) |
| W-04 | AC030 | 3129 | 792 | `UUID; action ...` -> lineage id, active TaxonomyVersion (else 409 `taxonomy_not_active`), `parentId` other than null requires `hierarchical` |
| W-05 | AC034 | 3133 | 796 | `ordered BCP 47 list ≤16, explicit no_fallback` -> `locale` in `supportedLocales`, `fallbackChain` equality expectation (409 `FALLBACK_CHAIN_MISMATCH`) |
| W-06 | AC036 | 3135 | 798 | adds eligible-target rule and the uniform 422 `related_target_ineligible` |
| W-07 | AC037 | 3136 | 799 | `explainable key/version` -> code-owned registry (`shared-terms`, `same-type-recent`), `reasonCode` equality, `maxCandidates` 1–128, 422 `derived_rule_unknown` |
| W-08 | AC010 | 3109 | 772 | `201 CompositionInstanceResource` -> `201 PatternPlacementResource` |
| W-09 | AC004-AC039 | 3103-3138 | 766-801 | source suffix only: AC022-AC039 (18 rows) `§Request/Response Contracts validation table at line 148` -> `§Route field validation matrix`; AC004-AC021 (18 rows) `...Error Handling and Failure Recovery, Verification and Test Strategy` -> `...Error Handling, Testing Strategy`. Asserted end-of-line single occurrence per row; no other Slice 12 row carries either suffix |
| W-10 | AC026 | 3125 | 788 | `entry revision readable and pattern immutable` -> current draft revision (effective state `draft`, else 409 `revision_not_editable`), `patternId` a lineage id of the caller's owner scope |

Every token the W-01..W-07 and W-10 texts name (`related_target_ineligible`, `derived_rule_unknown`, `FALLBACK_CHAIN_MISMATCH`, `taxonomy_not_active`, `pattern_incompatible`, `pattern_version_not_active`, `revision_not_editable`, `key_reserved`) exists in the BE03c typed-refusal list (BE03c:1286); the headings `Route field validation matrix` (BE03c:357), `Error Handling` and `Testing Strategy` exist.

**G5-01** (Slice 10 AC030, clause `` `/blocks/...` and every other pointer is refused until a composition write path exists; 422 `` -> `` ... is refused (composition changes are written only by CMS-03C-02 and CMS-03C-15 under the entry aggregate `version` and are reported by comparison, never accepted as `changedPaths`); 422 ``):

- Plan `phase-2.md:2852`; Slice 10 tracker `phase-02-slice-10.md:550`. Both stay `- [ ]` (checkbox state kept). Claims equal each other and the ledger `text` (script).
- Ledger `tests/contracts/phase-02-slice-10-evidence-ledger-001-035.ts`: `text` at :5500; clause at :5584 shortened to `` `/blocks/...` and every other pointer is refused `` (keeps its 6 citations); new uncited clause at :5624-5627; `status: 'partial'` and `limitation` at :5681-5683 (see item 1 above). Clauses tile the text verbatim and in order (gap between the two new clauses is one space; the `;` before `422.` is a legal separator). Citation counts per clause now 1,5,5,6,0,3,4.
- I ran the real guard function (`evaluateLedger` from `scripts/evidence/ledger-guard-lib.mjs`, same call as `tests/contracts/phase-02-evidence-guard-suite.ts`, against the real tracker and receipts file): 0 non-receipt problems across all 105 entries; counts 101 verified, 4 partial (was 102 and 3). The only problems it reports are the pre-existing stale-receipt and no-receipt ones (cited test files changed since the 2026-10-08 run; the AC030 citations are among them). Receipts must be regenerated (`node scripts/evidence/run-slice-evidence.mjs --slice 10`) before the guard test goes green; I did not touch `phase-02-slice-10-receipts.generated.jsonl`.

**G5-02 / G5-03** (BE03b; DEC-182 cited in the text):

- BE03b:251 (CMS-03B-01 `changedPaths` cell): `refused until a composition write path exists` -> `refused (composition changes are written only by CMS-03C-02 and CMS-03C-15 under the entry aggregate `version` and are reported by comparison, never accepted as `changedPaths`; DEC-182)`.
- BE03b:1543 (`Pointers` bullet): `is refused by CMS-03B-01 until a composition write path exists (03c owns composition writes);` -> `is refused by CMS-03B-01 (03c owns composition writes: CMS-03C-02 and CMS-03C-15 write them under the entry aggregate `version`, and they are reported by comparison, never accepted as `changedPaths`; DEC-182);`.
- Changelog row added as the last row at BE03b:2278 (workflow `write-be-spec (Slice 12 wording batch)`).

Plan and tracker narrative for DEC-182: plan `phase-2.md:3095` (new `**Wording batch (DEC-182)**` paragraph after the Pattern scope paragraph); tracker `phase-02-slice-12.md:17-18` (new dated continuation, 2026-10-12, DEC-181 and DEC-182) and the two in-place sentence fixes at :15.

Not changed (outside the allowed scope, still carry the old rationale text): `packages/contracts/src/cms-editorial/primitives.ts:66` and `packages/contracts/src/cms-editorial/field-pointer.test.ts:12` (comments saying `/blocks/...` is refused "until a composition write path exists"). The refusal behavior is unchanged and correct; fix the comments with the next code touch. Historical docs under `docs/handoffs/` still quote the old clause by design.

## Task 2: DEC-181 (owner, 2026-10-12)

A top-level nested pattern reference is expanded at placement into that pattern's own block roots, recursively, so every row carries a block; rows stay pinned to the placed `(patternId, patternVersion)`; the CMS-03C-02 `items` list holds one or more rows bounded by the existing 512-node cap after expansion (not 1-32). Nodes below a block root, nested references included, stay inside that root's pinned tree. I wrote only that; nothing about the path suffix of an expanded root (see "Left open").

BE03c (`.memory/wiki/specs/be/03c-composition-taxonomy-localization.md`):

| Line | Old -> new (abbreviated) |
| --- | --- |
| 29 | decision-status sentence: DEC-175 "one composition row per root node" gains "refined by DEC-181 to one row per block root"; DEC-181 added to the owner decisions with its effect |
| 90 | IA map row CMS-12: `one composition row per root node of the pinned pattern version (DEC-175)` -> `per block root ... after expanding any top-level nested pattern reference into that pattern's own block roots (DEC-175, DEC-181)` |
| 160 | route registry: `201 PatternPlacementResource (1–32 rows, DEC-175)` -> `(one or more rows, at most 512 after expansion, DEC-175, DEC-181)`; `one row per root node, all-or-nothing (DEC-175)` -> `one row per block root after expansion ... (DEC-175, DEC-181)` |
| 873-876 | `CompositionInstanceResource` comment: root node -> block root, expansion noted |
| 885-889 | comment above `PatternPlacementResource`: `(1-32)` -> one or more rows, at most 512 |
| 891 | `items: z.array(CompositionInstanceResource).min(1).max(32)` -> `.max(512)` (the CMS-03C-15 `CompositionUpdateResource` at its own `.max(32)` is untouched) |
| 1347 | placement paragraph: per root node -> per block root; new sentences on expansion of a `kind: pattern` root and the 512 bound ("a forest of 1–32 root nodes can therefore write more than 32 rows"); `items` list of 1–32 -> one or more, at most 512; row pins the placed `(patternId, patternVersion)`; nodes below a block root stay in the pinned tree; "each root row" -> "each block-root row" |
| 1349 | linked update: `A placement of several root nodes` -> `several block roots` (the bulk bound "up to 32" is CMS-03C-15's and is untouched) |
| 1408 | composition table row: DEC-175 placement rule gains the expansion (DEC-181); `a placement appends 1–32 rows` -> `one or more rows (at most 512, the node cap after expansion) ... (DEC-175, DEC-181)` |
| 1485 | CMS-03C-02 data flow: `per root node of the pinned forest (1–32 ...)` -> `per block root ... after expanding top-level nested pattern references (at most 512 ...)` |
| 1588 | tests: forest of 1, 2 and 32 block roots, plus a forest whose nested root expands recursively, an expansion writing more than 32 rows, and the 512-node cap (DEC-181) |
| 1666 | new changelog row (2026-10-12, DEC-181); the DEC-175 row at :1665 is history and is not edited (it supersedes it explicitly) |

Unchanged on purpose (bounds that are not the placement list): CMS-03C-12 `blockTree` 1–32 root nodes (BE03c:387, :713, :1146), `children` max 32 (:696), CMS-03C-15 1–32 instances.

FE03 (`.memory/wiki/specs/fe/03-cms-content-modeling.md`): :885 instance list (`one row per root node ... adds 1–32 rows` -> `per block root ... one or more rows, at most 512 after nested pattern references are expanded ... DEC-175, DEC-181`); :1110 insert-form result (`1–32 rows, one per root node` -> `one or more rows, at most 512, one per block root ... after expansion`); :1789 contract row (`per root node` -> `per block root after expansion`); :2824 new changelog row (the :2823 DEC-175 row is history).

Plan and tracker (identical claim text, script-verified): AC218 (plan 3317, tracker 980): `Pattern insertion rows (DEC-175)` -> `(DEC-175, DEC-181)`, new expansion clause, `per root node ... 1-32 rows ... items list of 1-32` -> `per block root ... after that expansion, one or more rows (at most 512, the node cap after expansion) ... items list of one or more`, row pinned to the placed pair, "keeps the nodes below a block root inside the pinned tree"; AC219 (3318 / 981): `one row per root node` -> `one row per block root (DEC-181)`; AC247 (3346 / 1009): `each root-node row` -> `each block-root row ... (DEC-175, DEC-181)`; plan header `phase-2.md:3094` `**Pattern scope (DEC-175, DEC-176, DEC-181)**` (per block root, 512 bound). Rows that state a 1-32 bound but are not the placement list were left alone: AC100, AC101, AC171 (pattern forest roots), AC118, AC119, AC121, AC123 (CMS-03C-15 instances), AC059, AC088, AC236 (other bounds).

### Left open by DEC-181 (spec says nothing; not filled)

1. **Path suffix of an expanded root** (DEC-181 lists it as downstream but gives no rule). Two block roots reached through different nested references, or a nested root whose key equals a sibling's key in the placed forest, would have the same suffix and collide on `UNIQUE (revision_id, path, version)` inside one transaction. See Task 3 item 1.
2. **Bulk accept cap versus row count.** A placement can now write more than 32 rows, but CMS-03C-15 accepts and detaches at most 32 instances per request and calls bulk all-or-nothing. A 40-row placement needs two requests; nothing says whether that is intended.
3. **Override keys inside an expanded nested pattern.** `overrides` keys are "node paths under the inserted root ... naming a node of the pinned tree" (BE03c:368). The spec does not say whether a node inside a top-level nested pattern is addressed through the reference node's key.
4. **FE list size.** FE03:885 now announces a count of up to 512 rows; no pagination or virtualization is specified for `CmsCompositionInstanceList`.
5. **Slice 12 depth-floor ledger** `.memory/pipeline/progress/verification/2026-10-11-slice-12-depth-floor.md` appendix A still holds the old AC218/AC219/AC247 text (and its Application record "Left open" list). The cascade brief put that file under the cascade lane; I did not edit it. It no longer equals the plan text for those three ids.
6. **Existing boundary code assumes one resource and `path === slotPath`:** `packages/contracts/src/cms-composition/pattern-instance.ts` (`CompositionInstanceResourceSchema` as the 201 body), `apps/worker/src/cms-composition/pattern-instance-contracts.ts:147` (`instance.path === body.slotPath`) and `apps/web/src/server/cms-composition-platform-pattern.ts:193`. They predate DEC-175 and need the implementation lane (not touched here).

## Other observation (not in the batch, not changed)

AC028 (`Enforce CMS-03C-02: slotPath/overrides; normalized path 1–512 chars; strict overrides max 64 keys/8 depth; 422.`) does not state the DEC-175 rule that `overrides` keys are normalized node paths under the inserted root (BE03c:368 does; AC218 does). A wording defect of the same kind as W-01..W-07; offer it for the next batch.

## Checks (read-only node scripts)

- Plan and tracker each have 285 Slice 12 criterion lines, ids AC001-AC285 contiguous; claim text identical per id (0 differences); source suffixes identical after path normalization (0 differences); 0 checked in both. Rows changed per file: 36 for DEC-182 (the 9 text rows lie inside AC004-AC039) plus 3 for DEC-181 (AC218, AC219, AC247).
- Slice 10 AC030: tracker claim equals plan claim equals ledger `text`; clauses tile it (hand tiling and the real guard).
- `node scripts/check-progress-consistency.mjs` (pinned node 22.23.1): "Progress files consistent."
- Added lines contain no `{{`, `TODO` or `TBD`.
- `node scripts/evidence/refreeze-ledger-sources.mjs --check` lists seven frozen sources as stale (IA03, IA03 deep dive, 03a, BE03b, BE03c, BE00, FE03). Four of them (IA03, deep dive, 03a, BE00) were not touched by this lane, so the staleness predates it; BE03b, BE03c and FE03 now differ further.
- `git diff --stat`: 7 files, +121/-105 (Slice 10 tracker, Slice 12 tracker, BE03b, BE03c, FE03, phase-2.md, Slice 10 ledger fragment 001-035). Docs and the ledger only.

## Task 3: research on the three open items (not applied)

### Item 1: path suffix separator and the root-path case

**What code and specs already fix**

- The row `path` column: `octet_length(path) between 1 and 512 and path ~ '^/[^[:cntrl:]]*$'` (`supabase/migrations/20260927300000_cms_composition_path_and_tree_bounds.sql:9-12`, replacing `20260927290000_cms_composition_authority.sql:82-85`). Bytes, not characters. `UNIQUE (revision_id, path, version)` (`20260927290000...sql:115-116`).
- `slot_key` is a separate NOT NULL column, `^[a-z][a-z0-9_-]{1,63}$` (`20260927290000...sql:86`), indexed with the owner and revision (`:119-120`). The request has only `slotPath`; no spec or code derives `slot_key` from it. Fixtures use `path '/primary', slot_key 'primary'` and `path '/parent/child', slot_key 'primary'` (`supabase/tests/phase_02_slice_12_composition_instance_guards.sql:36-60`), so the two are independent today. The render plan joins `slot.value->>'key' = instance.slot_key`, rank 0 with no template, 100000 for an unknown slot (`supabase/migrations/20261005017910_cms_load_quality_gate_input.sql:105-113`).
- `slotPath`: `/^\/[^\u0000-\u001f]*$/`, 1–512 characters (BE03c:506 and the validation row BE03c:368 "normalized `slotPath`"); the code check is only "starts with `/` and no character below 0x20" (`packages/contracts/src/cms-composition/pattern-instance.ts:16-18`). "Normalized" is defined nowhere, so `/main/`, `//` and `/` all pass. The response `path` regex is `/^\/[^\u0000-\u001f]{0,511}$/` (BE03c:872), characters not octets.
- Node keys: `PatternNodeKey = /^[a-z][a-z0-9_-]{0,63}$/` (BE03c:687), so a key never contains `/`. Node paths in `overrides` keys and `PatternUpdateChoice.path` use `/` as the segment separator: `/{nodeKey}(/{nodeKey})*`, at most 512 (BE03c:493, :723).
- DEC-175 says only "node key as the path suffix" (BE03c:1347, :1408). "Root path when the entry has no template" is stated (BE03c:1347) without a definition.
- Comparison keys blocks by `path`: pointer `/blocks/<path>`; two `active` rows with the same `path` in a revision, or `octet_length('/blocks/' || path) > 256`, make the comparison `comparison_unavailable` (`supabase/migrations/20261005010400_cms_revision_comparison_domains.sql:851-866`; BE03b D5 "Revision comparison domains"). So an accepted row path longer than 248 octets silently makes the revision uncomparable.
- Existing boundary code (Worker and web) asserts `path === slotPath`, i.e. one row at the slot path (see Left open 6). It will change.

**Options**

| Option | Rule | Pros | Cons |
| --- | --- | --- | --- |
| A | `path = slotPath` + `/` + key; if `slotPath` ends with `/` (root `/` included) append the key with no extra `/` | Never produces `//`; root path gives `/hero`; matches the `/{nodeKey}` node-path grammar | `/main` and `/main/` give the same row path, so two spellings of one slot collide or alias; "normalized" stays undefined |
| B | Define "normalized": starts with `/`, no empty or `.`/`..` segment, no trailing `/` except the root `/`; suffix = `slotPath` + `/` + key, root = `/` + key; for an expanded root (DEC-181) suffix = the chain of node keys from the placed forest root through each nested reference key, so keys stay unique among siblings; reject (422 `COMPOSITION_VALIDATION_FAILED` at `/slotPath`) any row path over 248 octets so comparison always fits | One canonical form, unique mapping, unique paths after expansion, aligned with the BE03b normalized-route precedent (BE03b:272 CMS-03B-08 route grammar) and with node-path grammar; closes the comparison cliff | Tighter than the shipped `slotPath` check (contract and test change); 248 is a new limit |
| C | Always `slotPath` + `/` + key | Simplest string rule | Root path gives `//hero`, which is not normalized and breaks the `/blocks/<path>` pointer reading |

**Recommendation:** B. It is the only option that keeps `UNIQUE (revision_id, path, version)` satisfiable after DEC-181 expansion (A and C let a nested root's key collide with a sibling's), and it makes the 256-octet comparison cap a write-time refusal instead of a later `comparison_unavailable`. State the `slot_key` derivation in the same decision (suggest: the first path segment of `slotPath`, and a reserved key for the root path so the NOT NULL regex holds).

**Schema change:** none required (the existing `path` check, uniqueness and `slot_key` column carry it). Optional defense in depth: a CHECK that `path` has no `//` and no trailing `/` except the root, and a `slot_key` derivation inside `cms_insert_pattern_instance`. Needs an owner decision because it adds a limit and fixes a stored identity (architecture-level by the classification rule).

### Item 2: row order of one placement versus bytewise path order

**What code and specs already fix**

- Render plan order for composition rows: region 1, slot ordinal, then `instance.path collate "C"` (bytewise), then `instance.id` (`supabase/migrations/20261005017910_cms_load_quality_gate_input.sql:105-123`; comment at :130). The Slice 12 AC247 row (plan 3346) restates it and adds highest-version per `(revision_id, path)` and the `pending_diff` rule.
- `cms_composition_instances` has no position or ordinal column (`20260927290000...sql:72-117`); `id` defaults to `gen_random_uuid()` (random); `created_at` is equal for all rows of one transaction.
- BE05c:1005 says document order is "template slot order, then bound field position within each slot, then composition order" without defining composition order; BE03c:1347 says the render plan reads each row "in its existing order". DEC-165 (decisions.md) fixes only that fields lead the root region.
- The pattern forest is an ordered array: `blockTree: z.array(PatternNodeSchema).min(1).max(32)` (BE03c:713) with `children` ordered (:696).
- Precedents for an explicit order column: related-content pins stored "in array order as `position`" and read "in `position` order" (BE03c:1363, :1367); relation values carry `position` = index (BE03b Value encodings by field kind).
- No Slice 12 command reorders composition (CMS-03C-02 appends, CMS-03C-15 re-pins), and the D5 comparison hash input has no position (BE03b D5).

**Consequence:** within one slot, rows render by node-key bytewise order, not forest order, and rows of two placements at the same `slotPath` interleave by key. Since the checker's rules depend on document order (BE05c `heading.first_level` at :1016), key names change a11y verdicts.

**Options**

| Option | Rule | Pros | Cons |
| --- | --- | --- | --- |
| A | Keep bytewise; document that forest order does not define render order; authors encode order in keys | No schema change; equals shipped function, AC247 and DEC-165 | Authored order lost; placements interleave; pattern designer preview would differ from render |
| B | Add `position integer NOT NULL` to `cms_composition_instances`: a placement takes consecutive positions in forest order (after DEC-181 expansion) appended after the slot's current maximum under the existing revision/slot lock; render plan orders by slot ordinal, `position`, then `path`, `id`; accept, detach, scan, restore and carry-over copy the position | Authored order preserved and placements stay grouped; deterministic; cheap now because Slice 12 already alters this table and rewrites the render-plan function for AC247 | Schema and function change; BE03c table rule, AC247, AC258-style persistence row and FE03 wording change; carried across every append path |
| C | Order by `id` using time-ordered UUIDs | No new column | Hidden coupling to id generation; not expressible in the spec; fragile on restore |

**Recommendation:** B (the standing "more work now" rule, and document order is user-visible output). Insert order is the only order that exists, so a position is immutable per path and the D5 hash needs no change.

**Schema change:** yes for B (one NOT NULL integer column and the `cms_revision_render_plan` ordering); none for A.

### Item 3: digest-mismatch status (422/409 in one matrix row, 409/422 in another)

**What code and specs already fix**

- The two rows: BE03c:364 (CMS-03C-01 `allowedBlocks/blockRegistryDigest`, failure `422/409`) and BE03c:369 (CMS-03C-02 `graph/blockRegistryDigest`, failure `409/422`). Both say "equality expectation only"; the rest of the 369 row also covers cycles (409 `pattern_cycle`, BE03c:387 and :1286) and depth/node bounds (422). The listing order is not a mapping; neither row says which constraint takes which status.
- **Shipped code and test for CMS-03C-01:** a malformed digest (not 64 lowercase hex) is `VALIDATION_FAILED` (422) and a digest that differs from the recomputed one is `CONFLICT` (409) (`supabase/migrations/20260927200000_cms_template_authority.sql:420-423` and :443-446); pgTAP asserts `CONFLICT` for `repeat('f', 64)` (`supabase/tests/phase_02_slice_12_template_authority.sql:418-427`). So 422 = shape, 409 = mismatch, and the `422/409` order of the 364 row already reads that way.
- The Worker helper `computeBlockRegistryDigest` throws internal `block_registry_digest_invalid` and `block_registry_digest_mismatch` (`apps/worker/src/cms-composition/block-registry-digest.ts:21-22`, :57, :119); no status mapping exists yet. CMS-03C-02 and CMS-03C-12 RPCs are not implemented.
- The digest is over mutable registry state: the tuples include `lifecycle` (BE03c:311-319), so a differing expectation means the registry moved since the client read it.
- Precedents: a mismatch of a server-resolved, time-varying value is 409 (03a:227 and :1166 `expectedActivationEvidenceHash`, "returns typed conflict"; 03a:2738 `localeConfigHash` "a mismatch is 409 CONFLICT"; BE03c `FALLBACK_CHAIN_MISMATCH` 409 at BE03c:374 and :1286; BE03b `expectedVersionSet` 409 `version_set_stale`, BE03b:274). A submitted hash of an immutable identity that the client simply got wrong is 422 at its pointer (BE03b:260 and :274 `frozenHash`, BE03c:380 `subjectHash`).
- BE00: 409 `CONFLICT` is for stale/version/state (BE00:166, :483); 422 `VALIDATION_FAILED` is a field violation (BE00:169).
- The closed typed-refusal list (BE03c:1286) has no digest token in either the 409 or the 422 group, and the error matrix 409 cells for CMS-03C-01, -02 and -12 (BE03c:1236, :1237, :1247) do not name the digest.

**Options**

| Option | Rule | Pros | Cons |
| --- | --- | --- | --- |
| A | Shape is 422 at `/blockRegistryDigest`; a differing digest is 409 (`*_VERSION_CONFLICT`) with a new lowercase token `block_registry_digest_mismatch`, no digest echoed | Matches the shipped CMS-03C-01 SQL and its pgTAP test (no code change there); matches the 03a/BE03c equality-expectation precedents; client action is "re-read the registry and resubmit", which is the 409 catalog guidance; one rule for CMS-03C-01, -02, -12 | Adds one token to the closed list and to three 409 cells |
| B | Mismatch is 422 at `/blockRegistryDigest` (the `frozenHash` precedent) | One status for every digest failure | Contradicts the shipped SQL and its test (a Slice 12 migration change to a delivered function); the request is valid by shape and the fault is server state, so it is a conflict, not a validation failure |
| C | Mismatch is 409 with no reason token | No list change | Violates "exactly one lowercase `details.reasonCode` from the closed list" (BE03c:1286); the client cannot tell it from a stale version |

**Recommendation:** A. Spec edits (no code edit for CMS-03C-01): rows BE03c:364 and :369 state shape 422 / mismatch 409 explicitly; the 409 cells of the error matrix for CMS-03C-01, -02, -12 gain the digest; the typed-refusal list (BE03c:1286) gains `block_registry_digest_mismatch`; add the pgTAP/Worker mapping for CMS-03C-02 and -12 when built. The R5 reading in DEC-180 ("the server recomputes and refuses a mismatched expectation") then has a status.

**Schema change:** none (a status and token decision; the digest column and recomputation already exist).
