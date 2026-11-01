# Review: lane `claude_s12_pattern_updates_sql` (CMS-03C-13/14/15, `pending_pattern_version`)

Independent adversarial reviewer. I did not write this lane. Static review only: no DB, no tests run, nothing edited except this file.
Template item 5 (re-hash) was skipped as root instructed. The final TAP counts were reconciled by grep:
`.lane-logs/alt-staged-pattern-updates-224205-2903550.tap` has plans 267/480/1140/27, 1914 `ok N`, 0 `not ok`, and ends `Result: PASS`.
Sources read: lane report (incl. `## RPC boundary`), brief, 11 WIP migrations, all three suites plus the common dirs, contracts
`pattern-update.ts`/`pattern-selector.ts`/`refusals.ts`, BE03c 175-177, 398-400, 1266-1268, 1304, 1336-1367, 1474-1476, 1586-1588 and 1612,
FE03 885/1113/1802, IA03 262/493, IA03 deep dive 44/230, tracker AC-112..123/212/258, DEC-175, and the S12 resolutions for D9/OD-2.
Note: OD-2 only covers `compatibleTypeIds`. No decision record defines how linked updates behave. BE03c 1367 is the only normative text.

## 1. Silent-spec interpretations: classification (most important)
Key: (a) answered by the spec, (b) an implementation decision root may make, (c) a PRODUCT decision for the owner.
| # | Interpretation | Class | Basis and whether the implementation matches |
|---|---|---|---|
| 1 | D-VALUE: node value = `props`; an override replaces it | **split: (a) / (b) / (c)** | (a) The unit is right. Diffs are per node path (BE03c 1367: "for each node path"), and override keys are node paths (1365, DEC-175/186). (b) Storing values as a chain-to-props map is a fine implementation choice. **(c)** Two consequences are user-visible and the owner must rule on them. (i) An override replaces the whole node `props`; it is not merged field by field. A pattern change to a sibling field under an overridden node therefore becomes a collision, and choosing `yours` drops the pattern's other fields. (ii) Only `props` is compared, so the diff cannot see changes to a node's block identity, child order or structure. `accept` still adopts them: the target root's `blockKey`/`blockVersion` (next_row:56-58) and the target tree. An author can therefore accept a block-type change that was never shown to them. IA03 493 says "never overwrite silently". |
| 2 | D-RETIRE: a removed root becomes a `retired` row unless the author kept `yours` | **(c)** | BE03c 1367 says only that accept "appends an `active` row pinned to the target version", which is impossible for a root the target no longer has. Whether a block the pattern author deleted disappears from the author's entry, stays as a local copy, or forces a detach is user-visible content loss or retention. As implemented it is also defective; see F1 and F4. |
| 3 | D-DETACH: detach materializes the effective props, at most 128 keys | **(a) + (b), limit is (b) or (c)** | (a) BE03c 1367 says detach "materializes ... (pinned tree plus overrides) as local props", and the code matches. (b) The chain-to-props shape is fine. The refusal for more than 128 keys (and likely for more than 8 depth or more than 256 KiB) is a user-visible refusal that the 1268 catalog does not list. It is (b) if root removes it in the implementation (for example a bound derived from the 512-node cap). It becomes (c) if it stays and some roots simply cannot be detached. |
| 4 | D-ELIGIBLE: only linked `active`/`pending_diff` heads are eligible | **(a), mismatch** | BE03c 1476 and AC-120 say "`pending_diff` or `active` linked (accept) **or any linked (detach)**". Accept matches. Detach does not: it refuses linked `draft` and `retired` heads (apply:148). The `retired` case exists only because of D-RETIRE (#2), so it should be resolved together with #2. See F3. |
| 5 | B2: roots ADDED by the target version get no rows | **(c)** | BE03c 1367 is silent. After an accept the entry claims to be on the target but renders without the new blocks. The author's proposed remedy ("re-place it") cannot work: CMS-03C-02 refuses any slot path that already has a row in the revision, in any state (20261014110300:172-182). The same rule blocks re-placing over a retired root. |
| 6 | B1: the root chain is inferred from `path` | **(b)** | BE03c 1367 says the rows "carry no placement identity". Storing `root_chain`/`slotPath` is a schema choice for root and needs a change to CMS-03C-02. Extra weakness: the inference also accepts an empty prefix for templated rows (plan:62), even though templated entries never take `/`. |
| 7 | B3: the CMS-03C-15 reason list omits `revision_not_editable` | **(a) behaviour, (b) contract fix** | Refusing is the specified behaviour: FE03 885 and AC-123 name `revision_not_editable` for CMS-03C-15, it is on the closed 409 list (1304), and non-draft revisions "keep their pin as history" (1367). The frozen `refusals.ts:189` list and the BE03c 1268 matrix cell both omit it, and root must amend both. The lane report's citation is wrong: BE03c 1268 does **not** name it. |
| 8 | D-CHOICES, D-ENTRY, D-ARCHIVED, selector `pageVersion`, audit names, `cms_pattern_update_nodes` duplicate | (b) | D-ENTRY follows from the single entry If-Match (1367). D-CHOICES is consistent with contract coverage. The audit names follow the placement precedent. |

## 2. Findings
F1 `supabase/migrations-wip/pattern-updates/20261014140550_cms_pattern_update_next_row.sql:56-66` — **blocker (for CMS-03C-15 promotion)**
- Problem: when `yours` is kept on a removed root, the result is an `active` linked row pinned to a target whose tree lacks that root. Two failures follow.
  - Detach of that row fails: `cms_pattern_update_effective_props` cannot find the root (plan:168-169) and raises `NOT_FOUND`, so the user gets a 404 on a visible, editable instance.
  - Once any newer version exists, the diff and accept for the row also 404 (plan:131-132).
- Why it matters: the row is permanently stuck. It also violates the placement invariant that a row's root is in its pinned tree (BE03c 1365).
  Test `010-accept.sqlinc:60-63` (rm4) stops at the append and never exercises the row afterwards.
- Fix direction: get the owner ruling on #2 first. Then either refuse `yours` on a removed root, or detach it. In both cases, add follow-up tests that detach and diff the row.

F2 `20261014140600_cms_apply_pattern_update.sql:135` vs `:166` — **major**
- Problem: position 4 (the content-type version, `FOR SHARE`) is taken before position 3 (the target and nested pattern versions, `FOR SHARE`).
- Why it matters: BE03c 1338 says writers "never acquire an earlier position after a later one". The 1342 row lists 3 before 4 for CMS-03C-15. The placement precedent does 3 then 4 (20261014110300:139-160). The lane's own header comment numbers the steps in this wrong order.
- Fix direction: move the content-type lock after the pattern-version lock block, as placement does.

F3 `20261014140600_cms_apply_pattern_update.sql:148` — **major**
- Problem: detach refuses linked heads in state `draft` or `retired`.
- Why it matters: BE03c 1476 and AC-120 say detach takes "any linked" instance.
- Fix direction: rule on this together with #2. Otherwise allow any linked head, and make `effective_props` total.

F4 `20261014140550_cms_pattern_update_next_row.sql:47-53` — **major (product, part of #2)**
- Problem: when `yours` is kept on a node the target removed, the override key stays even though it names no node of the new pinned tree.
- Why it matters: this breaks the BE03c 1365 rule "each naming a node of the pinned version's tree". The override never appears in a later diff (plan:141-145 only walks base ∪ theirs), but detach silently re-materializes it (plan:172).
  In the other direction, a child override kept with `yours` under a root that gets retired (no override on the root itself, so `yours` cannot be chosen there) is lost even though the author explicitly kept it.
- Fix direction: owner ruling on #2.

F5 `supabase/tests/phase_02_slice_12_pattern_updates/000-oracles.sqlinc:68-88` — **major (test)**
- Problem: no assertion checks the adopted `blockKey`/`blockVersion` after an accept. The world appears to use a single block, so adoption at next_row:56-58 can never be told apart from no adoption. The "digest is the target's" assertion (:86-87) compares against one registry-wide digest, so it is vacuous.
- Fix direction: add a target that changes a root's block version, with and without a props change. This also covers the structural blindness in #1.

F6 `20261014140100_cms_pattern_update_nodes.sql:59` reached via `140600:169` — **minor**
- Problem: on CMS-03C-15, `nested_pattern_not_active`, `pattern_cycle` and `pattern_depth_exceeded` carry the DETAIL `["/patternId"]`. That member does not exist in `CompositionUpdateRequest`. `pattern_cycle` and `pattern_depth_exceeded` are also missing from the 03C-15 reason list, though stored active versions should make them unreachable.
- Further gaps:
  - No test covers `nested_pattern_not_active` on accept.
  - The diff runs non-strict (140400:67), so it offers a target that accept then refuses.
- Fix direction: re-raise with `/targetPatternVersion` in apply, and add a test.

F7 `20261014140400_cms_get_instance_update_diff.sql:50-67` with `plan:124` — **minor**
- Problem: a non-head row is diffed as a live update. Rows are immutable, so they never physically become `superseded`. Test `020-states.sqlinc:13-18` asserts that version 1 shows the same non-empty paths, and FE would show `bulkEligible: true` for an instance the command refuses with 409.
  The report's "superseded row → empty diff" therefore never happens in practice.
- Related: the plan treats `draft` rows as eligible while apply refuses them (apply:148).
- Fix direction: resolve the head of the path (or answer non-head rows as history) and align the eligible states.

F8 `20261014140300_cms_list_pattern_selector.sql:72-75` and `140400:45-48` — **minor**
- Problem: a malformed `contentTypeId`/`instanceId` returns 422 `VALIDATION_FAILED`. BE03c 398/399 and 1266/1267 classify it as 400 (malformed query/path). The Worker's Zod check runs first, so this is defence in depth only.
- Fix direction: return `INVALID_REQUEST`, or document that only the Worker can reach this path.

F9 `supabase/tests/phase_02_slice_12_pattern_update_diff/020-states.sqlinc:26-30` — **minor**
- Problem: this inserts a `retired` row directly, under `app.cms_rpc`. That bypasses the lane's own retire producer, and the shape (pinned to v1) is one the producer never writes (it pins the target).
  - The suite header `phase_02_slice_12_pattern_update_diff.sql:5-6` and the report both say the only fixture write is the `pending_diff` row. That claim is inaccurate.
  - `040-refusals.sqlinc:64` also archives an entry by direct `update`, which matches the placement precedent.
- Fix direction: produce the retired row through accept, and correct the claims.

F10 Tests, **minor**:
- The byte bound has no boundary pair. `fat1` only proves that a value far over the bound is refused, and the "≤256 KiB" assertion (030-bounds, last line) is trivially true. Path bounds 128/129 are tested correctly.
- Retirement-only movement of `pageVersion` is untested. The activation test (000-selector:93-100) would pass even if transitions left `updated_at` unchanged, because the new version row moves the high-water mark.

F11 `20261014140000_cms_composition_instance_pending_version.sql:33-36` — **minor (suggestion)**
- Problem: the CHECK does not require `pending_pattern_version > pattern_version` (1367: a pending version is newer than the pin).
- Fix direction: add it now, while no producer exists.

## 3. Specific checks requested
- **Pending-diff fixture** (`phase_02_slice_12_pattern_updates_common/000-helpers.sqlinc:170-187`): **acceptable as a labelled boundary fixture**.
  - No producer exists: the AC-212/213 scan belongs to another lane.
  - The row is not `active`.
  - It copies the head row, keeps the unchanged pin, sets `pending_pattern_version` and keeps the same position, exactly as BE03c 1367 describes.
  - Caveats: it does not perform the composition-write side effects the real scan may have (1365: a composition write invalidates live reviews; whether the entry version moves is unspecified). Track it as a BOUNDARY and replace it with the real producer when the scan lands. See F9 for the other fixtures.
- **Cursor binding**: correct. The domain is `cms-03c-13`. The cursor is signed and verified in constant time (140310). The inner `queryHash` binds actor, acting party, content type and limit. Keyset order is right: (key ASC, version DESC) with a `C`-collated tie-break. Tests (010-paging) cover tampered, expired and foreign-bound cursors (limit, type, actor) as 409, and malformed cursors as 400. The cursor is opened before the auth checks, but that is the CMS-03C-11 precedent.
- **All-or-nothing 1–32**: correct. The store-free check refuses 0 and 33 (`140500:76-79`). One plpgsql transaction means any raise rolls everything back. Tests: `050-bulk.sqlinc` (one stale instance in 32 leaves all 32 unanswered; a 39-row placement is answered in successive requests) and `030-envelope:39`.
- **CAS**: correct. Entry CAS runs after the reservation under `FOR UPDATE` (`140600:119-122`), and the final update is guarded (`:229-232`). Instance CAS checks both head and version and returns `instanceId` (`:141-147`). Tests: `040-refusals.sqlinc:41-51` (stale entry, stale instance, old row).
- **Live-review invalidation**: correct. Live reviews are locked `FOR UPDATE` (position 5) and invalidated with `dependency_changed`, and exactly one review-changed outbox event is emitted (`060-effects.sqlinc:16-35`).
- **Positions (DEC-185)**: preserved. The row copies its head (next_row:34). The oracle asserts position, path, slot and lineage unchanged, and every prior row byte-identical (000-oracles:79-93).
- **`diff_too_large` thresholds**: cited and correct. More than 128 paths, or more than 262144 octets of JCS over the whole resource (BE03c 399, 1367). This matches the contract constants and the contract's whole-resource byte rule. Byte boundary tests are missing (F10).
- **Non-vacuity**: generally strong. Oracles use literal base/theirs/yours values, the contentHash is computed from first principles, captured stores are diffed before and after, and real anon/authenticated ACL probes run. Gaps: F5, F6, F10.

## 4. Route clauses (BE03c 175-177 / 398-400 / 1474-1476)
| Clause | Where implemented | Where tested |
|---|---|---|
| 13: author/editor in owner party; designer alone is not enough | 140300:67-70 | selector/020-authority:6-22,43-44 |
| 13: only active compatible versions; order; 25/50; pageVersion | 140300:118-169 | selector/000-selector, 010-paging |
| 14: assigned author/editor; 404 vs 403 | 140400:50-65 | update_diff/040-authority |
| 14: collision definition; no-update 200 | plan:134-145; 140400:69-82 | update_diff/010-diff, 020-states |
| 14: 128 paths / 256 KiB | 140400:72-85 | update_diff/030-bounds (F10) |
| 15: one entry If-Match plus per-instance CAS | 140600:119-147 | 040-refusals |
| 15: target is latest active compatible, else 422 at `/targetPatternVersion` | 140600:155-173 | 040-refusals:70-91 |
| 15: `diff_has_collisions` in bulk; mandatory choices for a single instance | 140600:175-195 | 040-refusals:93-115 |
| 15: eligibility per 1476 | 140600:148 | 020-detach:34-37 (F3 mismatch) |
| 15: lock order per 1342 | 140600:104-201 | not testable single-session (F2) |
- No event of its own; one audit record; replay returns the stored body and ETag: `060-effects`.
- The deadlock / lock-timeout conversion to CONFLICT is in 140610. Its behaviour is unproven (the race module is with root, as the author states).

## 5. Security and conventions
- AuthN runs before resolution.
- Concealment is uniform: hidden, absent and one-absent-among-visible all return the same 404, and this is tested.
- The 403 for a capability refusal returns only `capability_missing`. Errors carry no PII.
- All three `platform_api` functions are executable by `service_role` only, and private functions have execute revoked from service_role too.
- Definer grants match the placement precedent (`20261014110300:258-262`).
- No MFA is required (BE03c 1294).
- Idempotency reservation runs after the authority re-proof and before CAS, as in the precedent.
- Conventions:
  - Every migration is under 300 lines (apply is 297) and every test file is under 400.
  - There are no TODOs.
  - All four test directories have READMEs. `migrations-wip/pattern-updates/` has 11 files and no README; root promotes them out of that directory.
  - The duplicate expander is acknowledged (R5).

## 6. Recommendation to root
- Promote CMS-03C-13 (selector) as is, apart from F8.
- Hold CMS-03C-14 and CMS-03C-15 until:
  1. The owner rules on the (c) items: #1 (override replace vs merge; structural changes being invisible to the diff), #2/F1/F4 (removed roots and nodes), #5 (added roots) and the limit in #3.
  2. F2 and F3 are fixed, or F3 is ratified against BE03c 1476 and AC-120.
  3. F5/F6 tests are added.
  4. B3 is fixed in `refusals.ts` and BE03c 1268, with the lane report's citation corrected.

VERDICT: PARTIAL
