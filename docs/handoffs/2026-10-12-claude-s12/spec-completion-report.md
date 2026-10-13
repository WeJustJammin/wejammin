# Slice 12 spec-completion report (2026-10-13)

Worktree `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`, branch `claude/phase2-slice12`. Docs and specs only; no git write, no pnpm, vitest, tsc, eslint, prettier, docker, psql or supabase. Edits were made with `python3` and `node` string replacement that asserted a single occurrence of every old string (no regex, no partial writes). Read-only `node` scripts did the checks. No memory record, no compile, no edit to `decisions.md`, `patterns.md` or `blockers.md`. Files edited: BE03c, BE05c, FE03, `phase-2.md`, `phase-02-slice-12.md` and this report. Line numbers below were resolved by script after the last edit.

## Read these first

1. **The Slice 12 evidence ledger now drifts from the tracker for three ids.** Ledger `text` must equal the tracker claim byte for byte. I reworded AC218, AC247 and AC258 (DEC-185), so `tests/contracts/phase-02-slice-12-evidence-ledger-214-285.ts` entries for those three ids no longer equal the tracker (script: "text != tracker claim: 218,247,258"; before this pass every one of the 285 matched). The ledger lane must resync `text` and the clause tiling; I did not touch the ledger. Any DEC-186 criterion rewording later will need the same.
2. **DEC-185 reworded three criteria, not eight.** The position-copy rule for accept, detach, the linked-update scan, restore and carry-over is carried by AC258 (persistence) and AC218, so AC121, AC212, AC219, AC243 and AC245 stay as they are (they say "appends a row" or "keeps its path and link mode"; none is contradicted). Say so if you want those five reworded too; each is one more ledger resync.
3. **The depth-floor ledger document** `.memory/pipeline/progress/verification/2026-10-11-slice-12-depth-floor.md` (Appendix A, Application record) was not edited (not on the file list). It no longer equals the plan for AC218, AC247 and AC258, and its BE03c line citations are stale.
4. **Derived choices (implementation decisions; the owner may override), all in BE03c:** (a) `position integer NOT NULL CHECK (position >= 0)`, first position 0 for an empty slot, "slot" = `(revision_id, slot_key)`, the maximum taken over rows of any state or version; (b) the forward-migration backfill: dense rank from 0 of each path, bytewise `COLLATE "C"`, among the distinct paths of its `(revision_id, slot_key)`, so every version of a path shares one position and today's render order is unchanged; (c) forest order = the pinned forest's root array order with a top-level nested reference replaced in place by that pattern's block roots, recursively; (d) an `overrides` key that stops at a reference node (above every block root, so under no row) is 422 at `/overrides`, and each row stores only the overrides whose key begins with its own key chain; (e) a malformed `blockRegistryDigest` is a plain 422 at its pointer with no reason token (only the mismatch gets the new token); (f) `CompositionInstanceResource` gains no `position` member (the strict object stays as it is); the 201 `items` list is stated to be in position order.

## Task 1: DEC-185 (owner)

BE03c (`.memory/wiki/specs/be/03c-composition-taxonomy-localization.md`):

| Line | Old -> new (abbreviated) |
| --- | --- |
| 29 | decision status: new sentence for the 2026-10-13 spec-completion pass naming DEC-185 (position), DEC-186 and the DEC-181 consequences |
| 90 | IA map CMS-12: `(DEC-175, DEC-181);` -> `(DEC-175, DEC-181), at consecutive positions in forest order (DEC-185);` |
| 160 | registry CMS-03C-02: `all-or-nothing (DEC-175, DEC-181)` -> `all-or-nothing, at consecutive positions appended after the slot's greatest in forest order (DEC-175, DEC-181, DEC-185)` |
| 899 | `PatternPlacementResource` comment gains: the list is in `position` order, the forest order (DEC-185) |
| 1357 | CMS-03C-02 paragraph: new `**Row order (DEC-185).**` sentence group (column, consecutive positions in forest order, first = greatest + 1 or 0, under the revision/slot lock, no renumbering, `items` in position order, accept/detach/scan/restore/carry-over copy it, D5 hash unchanged, render order region, slot ordinal, `position`, `path`, `id`, heading-order effect); render plan clause `in its existing order` -> `in position order within its slot, DEC-185` |
| 1359 | linked update: the scan row carries `pending_pattern_version` `and the instance's position unchanged (DEC-185)`; new sentence that every row accept or detach appends keeps the `position` |
| 1398 | restore translation: `keeps its path and link mode` -> `keeps its path, position (DEC-185) and link mode` |
| 1400 | carry-over: `(provenance carried_from_id)` -> `(provenance carried_from_id, each copying its source row's position unchanged, DEC-185)` |
| 1418 | composition table: field cell gains `position integer NOT NULL CHECK (position >= 0)` with the backfill rule (DEC-185); write-rule cell: a placement appends at consecutive positions starting one above the slot's greatest, every other append copies the position, the position of a path never changes |
| 1495 | CMS-03C-02 data flow: `lock revision/slot -> insert one ... row per block root` gains `at consecutive positions after the slot's greatest in forest order (DEC-185)` |
| 1598 | CMS-03C-02 tests: consecutive positions in forest order, two concurrent placements grouped without a shared position, position copied by accept, detach, scan, restore and carry-over, render order (DEC-185) |
| 1677 | new changelog row (2026-10-13) |

BE05c (`.memory/wiki/specs/be/05c-portability-quality-lifecycle.md`): line 1005, `Document order`: `then composition order.` -> `then composition order, which is the stored position order of the composition rows of the slot, then path (bytewise) and id (BE03c, DEC-185).` Line 1496: new changelog row. No checker rule, rule id or hash formula changes.

FE03 (`.memory/wiki/specs/fe/03-cms-content-modeling.md`): it does not repeat the render order, so the only DEC-185 text is at :885, the instance list: `one row per block root of a placed pattern` gains `listed in render order (the stored position, so a placement keeps its forest order and two placements in one slot stay apart, DEC-185)`. Changelog row :2825.

Plan and tracker (identical claim text per id, script-verified; checkbox and source links kept):

| Row | Plan line | Tracker line | Old -> new (abbreviated) |
| --- | --- | --- | --- |
| AC218 | 3317 | 983 | `Pattern insertion rows (DEC-175, DEC-181)` -> `(DEC-175, DEC-181, DEC-185)`; `in one transaction and all-or-nothing, and answers 201` -> `... all-or-nothing, at consecutive position values in forest order starting one above the greatest position of the revision's slot (0 for an empty slot) under the revision/slot lock (DEC-185), and answers 201`; `items list ... CompositionInstanceResource` gains `in position order`. The path clause (`that root's key as the suffix of its path`) is deliberately unchanged (DEC-186, below) |
| AC247 | 3346 | 1012 | `Render plan (DEC-165 receiving obligation)` -> `(..., DEC-185)`; `in template slot order, then path (bytewise) and id` -> `in template slot order, then position (so the rows of one placement render in forest order and two placements in one slot stay grouped), then path (bytewise) and id` |
| AC258 | 3357 | 1023 | persistence delta gains `position integer NOT NULL` records the authored order of a row within its `(revision_id, slot_key)` (consecutive values in forest order after the slot's greatest, forward-migration backfill of every existing row, copied unchanged by accept, detach, scan, restore and carry-over, DEC-185) |

Narrative: plan `phase-2.md:3094` `**Pattern scope (DEC-175, DEC-176, DEC-181)**` -> `(..., DEC-185)` with a closing clause on `position`; tracker `phase-02-slice-12.md:20` new dated continuation (2026-10-13) for DEC-185, DEC-186 and the DEC-181 consequences.

## Task 2: DEC-186 items 1 to 3 (orchestrator; spec text only, no criterion text changed)

BE03c:

| Line | Old -> new (abbreviated) |
| --- | --- |
| 322 | digest invariants: new sentence: not 64 lowercase hex is 422 at `/blockRegistryDigest`; a well-formed different digest writes nothing and is 409 `details.reasonCode` `block_registry_digest_mismatch` on CMS-03C-01 (`TEMPLATE_VERSION_CONFLICT`), CMS-03C-02 and CMS-03C-12 (`COMPOSITION_VERSION_CONFLICT`) |
| 368 | CMS-03C-01 `allowedBlocks/blockRegistryDigest`: `equality expectation only` gains `(malformed: 422 at /blockRegistryDigest; well-formed but different from the recomputed digest: 409 block_registry_digest_mismatch; DEC-186)`; the `422/409` failure cell now reads unambiguously |
| 372 | CMS-03C-02 `slotPath/overrides`: gains the row `path` rule (the `slotPath` joined with `/` and the root's key chain), the 248-octet bound with 422 at `/slotPath`, and the key chain inside an expanded root for `overrides` keys |
| 373 | CMS-03C-02 `graph/blockRegistryDigest`: the old `409/422` ambiguity resolved for the digest (malformed 422, different 409 `block_registry_digest_mismatch`) |
| 392 | new row CMS-03C-12 `blockRegistryDigest` (same two statuses) |
| 499, 884 | Zod comments: override key chain begins with the reference's `key`; resource `path` is `slotPath` + `/` + the root's key chain, at most 248 octets |
| 1246, 1247, 1257 | error matrix 409 cells for CMS-03C-01, -02, -12 gain `block_registry_digest_mismatch`; the CMS-03C-02 422 cell gains `row path over 248 octets` |
| 1296 | closed typed-refusal list, 409 group: `block_registry_digest_mismatch` (CMS-03C-01, -02, -12, no other member) before `FALLBACK_CHAIN_MISMATCH` |
| 1357 | CMS-03C-02 paragraph: `takes that root's key as the suffix of its path` -> the `slotPath` joined with `/` and the root's key chain, with `/main` + `hero` = `/main/hero`, `shared` expanding to `a` = `/main/shared/a`, `/` + `hero` = `/hero`, 422 at `/slotPath` over 248 octets (the `/blocks/{path}` pointer fits the 256-character `JsonPointer`, BE03b:307) after the pattern is resolved; overrides key chain inside an expanded root (`/shared/a/title`) |
| 1418 | table row: `taking the node key as the suffix of path` -> the `slotPath` joined with `/` and its key chain, at most 248 octets |
| 1495 | data flow gains `with the row path of DEC-186` |
| 1571, 1572, 1578 | operation error coverage 409 text gains `digest mismatch` |
| 1597, 1598, 1622 | tests: malformed 422 versus different 409, 248 and 249 octet paths, root `slotPath`, expanded-root chain, overrides chain and a key above every block root |

FE03: :1110 error cell gains `COMPOSITION_VALIDATION_FAILED at /slotPath (a row path over 248 octets, DEC-186) or /overrides`; :1789 CMS-03C-02 contract row: `overrides` keys `led by the reference's key inside an expanded root, DEC-186`. I did not add the digest 409 to any FE03 error cell: FE03:1798 says the CMS-03C-12 form never types a digest, and FE03 does not say whether the CMS-03C-01 and CMS-03C-02 forms send the optional one.

### Criterion rows DEC-186 would change (not changed)

| Row | Plan / tracker line | What would change |
| --- | --- | --- |
| AC028 | 3127 / 793 | `normalized path 1-512 chars; strict overrides ...`: add the 248-octet row path bound (422 at `/slotPath`) and the key chain for overrides keys |
| AC029 | 3128 / 794 | `graph; no cycles; ...; 409/422`: add the digest statuses (malformed 422, different 409 `block_registry_digest_mismatch`) |
| AC104 | 3203 / 869 | CMS-03C-12 409 list: add `block_registry_digest_mismatch` |
| AC193 | 3292 / 958 | `a client-supplied digest is only an equality expectation`: add the two statuses |
| AC218 | 3317 / 983 | `that root's key as the suffix of its path`: the `slotPath` + key chain rule; the 248-octet bound; the overrides key chain inside an expanded root |
| AC274 | 3373 / 1039 | closed `reasonCode` list: add `block_registry_digest_mismatch` under 409 |
| AC103 | 3202 / 868 | optional: `computes blockRegistryDigest on the server` could add the refusal |

No existing row owns the CMS-03C-01 `allowedBlocks/blockRegistryDigest` validation (BE03c:368) or the new CMS-03C-12 digest validation row (BE03c:392); covering them needs a new row (the floor would move from 285) or a fold into AC022-style rows. AC008/AC014/AC010 are generic and need nothing.

## Task 3: remaining DEC-181 consequences

**CMS-03C-14 and CMS-03C-15 versus a placement of more than 32 rows.** One reading follows from the existing text, so I applied it. BE03c already says a placement of several block roots is several instances, each diffed, accepted and detached independently, and that a bulk request lists up to 32 of them; DEC-181 bounded only the CMS-03C-02 `items` list at 512 and left the CMS-03C-15 32 alone; and a stored row carries no placement identity (a placement is not a column), so no placement-wide operation can exist. Rule written (BE03c:1359 plus the bound wording at :177, :395 and the Zod comment :742): the 32 is a bound per request; a larger placement is accepted or detached in successive requests of at most 32 instances, each request all-or-nothing, each carrying the entry's then-current `version` as `If-Match` (read again after the previous request) and every listed instance's own `version`; a row not yet answered stays on its pinned version; CMS-03C-14 diffs one instance per call. FE03:885 says the same for the _Accept_ and _Detach_ selection; FE03:1111 says at most 32 per request. Not adopted, because each would change a locked bound or add a stored identity: raising `instances.max` above 32, or a placement-wide accept. Consequence to know: between two requests, rows of one placement can sit on different pinned versions (the render plan already renders a `pending_diff` row from its pinned version).

**FE03 list for a placement of up to 512 rows.** Existing bounded-list pattern chosen: the workbench rule "list over 100 virtualizes" (`Performance budgets and loading strategy`, the `CompositionTaxonomyLocalizationWorkbench` row, FE03:1743; desktop `virtualize >100 rows, stable IDs`, FE03:1384; the same rule at FE03:2674), the politely announced result count of the Table/filter/selection row (FE03:1727, the same count the list already announces, FE03:885), and no cursor pager because the rows arrive as one bounded collection (FE03:1741 shows the other branch: a page of at most 100 needs no virtualization). Text at FE03:885. The virtualized window's screen-reader row-count semantics are not defined anywhere in FE03; I did not invent them.

## Open readings left unresolved

1. **"Canonical" or "normalized" `slotPath` is still undefined.** The Zod accepts `/main/`, `//` and `/`. I applied DEC-186 literally: the `slotPath` is joined with `/` and only the root path `/` adds no separator, so `/main/` + `hero` gives `/main//hero`. Reading B normalizes a trailing `/` first (`/main/` and `/main` alias to `/main/hero`, which can collide on `UNIQUE (revision_id, path, version)`). Needs an owner or orchestrator call; neither is implemented by this text.
2. **`slot_key` derivation from `slotPath` is still unspecified.** Position is scoped to `(revision_id, slot_key)` and the render plan joins `slot_key` to the template slot key; shipped fixtures set `path` and `slot_key` independently. L2 SQL must derive it somewhere (the first path segment of `slotPath`, with a reserved key for the root path, is one option).
3. **Whether `CompositionInstanceResource` exposes `position`.** DEC-185 is silent. Not exposed; clients rely on `items` order. Exposing it is a contract change (`z.number().int().min(0)`).
4. **Whether the CMS-03C-01 and CMS-03C-02 forms send `blockRegistryDigest`** (FE03:1789 lists it as optional) decides whether FE03 needs a `block_registry_digest_mismatch` message.

## Checks (read-only scripts)

- Plan and tracker each have 285 Slice 12 criterion lines, ids AC001-AC285 contiguous, claim text identical per id (0 differences), 0 checked; rows changed this pass: AC218, AC247, AC258 in each file.
- Every BE03c, BE05c, FE03, plan and tracker line cited above was resolved by script after the last edit (each BE03c line printed and compared to its expected content).
- `node scripts/check-progress-consistency.mjs` (pinned node 22.23.1): "Progress files consistent."
- Ledger text versus tracker claim (read-only import of the Slice 12 ledger): 3 differences (218, 247, 258), the item-1 resync above.
- `git diff` of this lane touches only the five spec and tracking files and this report; code files shown as modified in `git status` belong to other lanes.
