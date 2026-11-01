# Review (fix pass F1): lane `claude_s12_pattern_updates_sql`

Independent adversarial delta review, 2026-10-15T08:56Z. I did not author this work. Read-only except this file. No DB.
- **Target.** Lane report (sha256 `431274b7…87b36c`, verified), prior review `review-pattern-updates.md`, brief `briefs/pattern-updates-f1.md`, the 12 WIP
  migrations, the lane's four test dirs, `refusals.ts` and its test, and the parity test. Per root, I did not re-hash the final TAP or WIP bytes.
  I did re-hash the F1 and F2 TAPs (`a657561f…`, `ac5e3b6f…`); both match the report.
- **Pre-edit bytes recovered.** `<session scratchpad>/wip-hold/*.sql` holds all 11 first-pass migrations; each hash equals the F1 manifest (140600 `001250ff…`).
  I diffed every predecessor edit against these files.
- **BE03c changed while I reviewed it.** It was edited twice (04:49:47 and 04:51:46 local; now 1751 lines, sha256 `2b0f15d8…`).
  Current line numbers, with root's in brackets: matrix :1287 [1268], typed refusals :1323 [1304], lock order :1355-1367 [1336-1348],
  linked update :1386 [1367], eligibility :1512 [1476]. The texts I rely on did not change.
- **Allowed vitest run.** `refusals-operations.test.ts` and `…pattern-updates-pending-parity.test.ts`: 2 files, 25/25 passed.

## 1. RED evidence for each behaviour change (pre-edit vs current, by `diff`)
| # | Change | Test | Shown able to fail? |
|---|---|---|---|
| 1 | 140200:124-127 a non-head row gets no update offer | diff 020-states:16-23 | **Yes**, F1 #412 on the pre-edit bytes |
| 2 | 140300:72-75 malformed `contentTypeId` is `INVALID_REQUEST` with no DETAIL | selector 010-paging:69-90 | **Yes**, F1 #244-249 (had `VALIDATION_FAILED#["/contentTypeId"]`) |
| 3 | 140400:45-48 malformed `instanceId` is `INVALID_REQUEST` with no DETAIL | diff 040-authority | **Yes**, F1 #504/507/510/512 |
| 4 | 140600:210-211 position 4 is taken after position 3 | 080-lock-order (static) | **Yes**, F2 #1307 (`0<1<4<3<5`) |
| 5 | 140600:150 detach is admitted on a linked `draft` head | 075-eligibility:5-7 | **Yes**, F2 #1297 |
| 6 | 140600:171-180 `nested_pattern_not_active` is pointed at `/targetPatternVersion` | 070-adoption:36-42 | **Yes**, F2 #1291 and #1295 |
| 7 | 140600:150 detach is now also admitted on a stored `superseded` head | none | **No** (R1) |
| 8 | 140600:176 `pattern_cycle` / `pattern_depth_exceeded` re-pointed | none | **No** (R2) |
| 9 | 140605 closure split out of 140600 | whole suites | n/a: semantics preserved (§3) |

- **F5** changed no migration (140550 is still `e767b52f…`). Its new oracles fail under mutant M4: F2 #1270/1271/1278/1279/1287 (`@1`/`77f454d5…` for `@2`/`ec35bc05…`).
- **F2 is valid evidence; root's incident note (tracker :1912, "not evidence for either") should be corrected.**
  - Every lane test file's mtime is ≤ 04:41:20.68, and F2 reset at 04:41:32. So F2 ran the final test bytes.
  - The F2 and F3 manifests differ only in 140550 and 140600, the two mutants.
  - The F2 and F3 test descriptions are identical, apart from 18 checks that run only after success (`e-dr1-detach`). That is exactly 1325 − 1307.
- **Mutant fidelity (`mutate.py`).** M1 puts lock 4 after the head loop, not before it as the pre-edit code did; the static check catches both. M2 refuses
  `draft` only, while the pre-edit code also refused `superseded`; that is why #7 has no RED.

## 2. Fix-pass items
- **F2 (lock order): fixed.** The function now takes 0, 1, 3 (`order by locked.id for share`), 4, then 5 (`order by review_row.id for update`), as :1361 and placement do.
  - What the static test proves: the first occurrences of five anchor strings appear in that order in the stored source. Nothing more.
  - It does not check the lock clause (deleting `for share` still passes) or uniqueness (`cms_editorial_reviews review_row` is at :213 and :248; the comment says "occur once").
  - It does not check id order within a position, or locks taken inside callees (`cms_invalidate_editorial_review` locks reviews and publication schedules).
  - It does not check run-time order, deadlock freedom, or the deadlock → 409 conversion. Those need the race module.
- **F3 (detach eligibility).** `draft` is fixed; `retired` is correctly held for the owner (§4).
- **F5 (adoption): fixed, and the oracle is non-vacuous.**
  - `s12puc_digest` builds the 03a tuples from test constants and self-checks against `s12pd_expected_digest()` (070:5-6).
  - It asserts v1 ≠ v2 (070:7-8, world:32-33), and checks identity on every update (000-oracles:87-91), including the block-version-only `rootb`.
  - Weakness: it reuses production `cms_jcs_sha256`, so only the tuple assembly is independent.
  - The whole-tree digest matches placement (`20261014110300:163`).
- **F8: fixed.**
  - 400 for malformed ids on CMS-03C-13/14 matches :398/:399 and :1285/:1286.
  - On CMS-03C-15, a malformed body `instanceId` stays 422 at its pointer. That fits :1287's 422 "choices/targets schema": the contract item is `PatternUpdateTargetSchema` (pattern-update.ts:44).
  - All three expander tokens are re-pointed. Non-head rows get an empty diff. The retired fixture is labelled. The 262144/262145 byte pair is exact.
  - The retirement `pageVersion` test runs through the promoted retire. Its F1 failure (#269-273) was the environment, not a RED; the behaviour is from the first pass.
- **B3: non-weakening.** The test uses exact sorted equality (refusals-operations.test.ts:142), so adding a member makes it stricter. See R6.
- **Parity test: passes.** Test 1 is real; test 3 only proves that `replace` changed the copy. The real non-vacuity evidence is the lane's in-place
  one-byte mutation (140000 has mtime 02:47 and an unchanged hash, `ac79470b…`).

## 3. Security and the 140605 split
- **140605 preserves semantics.** Its DO block is byte-identical to the block removed from 140600 (`diff`), and its callee list still covers every direct call
  of the new 140600 (the fix adds none). Order 140600 → 140605 → 140610 puts the grants before the wrapper. Only change: a closure failure no longer rolls back
  140600, which is harmless because the run aborts anyway.
- **The edited functions keep their security settings.** They stay SECURITY DEFINER with `search_path = ''`, owned by `wejammin_cms_definer`, with `revoke all … from public, anon, authenticated,
  service_role`. The `platform_api` wrappers are unchanged (140310/140410/140610 hashes equal the first pass).
- **Error ordering and payloads.** The selector's 400 follows 404/403 and leaks nothing (R7); the diff's 400 comes after actor/party and before resolution.
  DETAIL carries pointers, versions and the instance UUID only. No PII.

## 4. F3, the retired head: a spec conflict for the owner, not a defect
- **The conflict.** The literal "any linked (detach)" (:1512, AC-120) includes a `retired` linked head. But :1386 defines detach as materializing the "current effective
  content (pinned tree plus overrides)" into an appended row that the lane writes as `active`.
- **Why it cannot be implemented as written.** The only retired linked row any producer writes is the lane's D-RETIRE row, which is pinned to a target that lacks the root. So:
  - there is nothing to materialize;
  - an `active` result would revive a block whose removal the author accepted.
- **It depends on D-RETIRE.** No spec text produces retired linked rows at all, so the conflict exists only under that pending interpretation.
- **Current behaviour.** The refusal fails closed, is pinned by 020-detach `d-retired` through the real producer (rm1 `/gone`), and is stated in the 140600 header.
- **Classification:** spec conflict, owner, bundled with D-RETIRE.
- **Nuance.** The refusal also covers retired rows whose pinned tree keeps the root (none are producible today). Ask the owner "may detach ever revive a retired row?".

## 5. Findings (no blocker, no major)
R1 `20261014140600_cms_apply_pattern_update.sql:148-150` — **minor**
- Problem: detach now admits every linked state except `retired`, including a stored `superseded` head. This widening is untested, and no mutant covered it.
- Why it matters: unreachable today; no producer writes `superseded` rows (deep dive :250 treats the state as derived).
- Fix direction: whitelist `('draft','active','pending_diff')`, or add a labelled-fixture test.

R2 `140600:176` — **minor**
- Problem: the re-pointing of `pattern_cycle` and `pattern_depth_exceeded` is untested.
- Why it matters: neither token is in the contract list for CMS-03C-15 (refusals.ts:189-196), so the Worker could not map either one.
  Both are unreachable: nested pins are immutable and are checked at CMS-03C-12 (:1380).
- Fix direction: drop both from the remap with a comment, or list them in the contract and test them.

R3 `supabase/tests/phase_02_slice_12_pattern_updates/080-lock-order.sqlinc:10-15` — **minor (test)** — the static check has the §2 F2 gaps.
Fix: anchor on the full clause, including `for share`/`for update`, and assert that each anchor occurs once.

R4 `20261014140200_cms_pattern_update_plan.sql:125` with `20261014140400_cms_get_instance_update_diff.sql:82` — **minor (residual of prior F7)** — a linked
`draft` head is still offered an update with `bulkEligible: true`, but accept refuses it (140600:149). Unreachable outside the fixture. Fix: offer updates only to `active`/`pending_diff`.

R5 `supabase/tests/phase_02_slice_12_pattern_updates_common/020-world-adoption.sqlinc:52-67` — **minor** — the `draft`-detach fix is proven only on a labelled
fixture state that no producer writes. Fix: track it as a BOUNDARY next to the `pending_diff` fixture.

R6 `packages/contracts/src/cms-composition/refusals.ts:189-196` vs BE03c :1287 — **minor (spec debt)**
- Problem: the contract now names `revision_not_editable`, but the 409 cell of :1287 still omits it, while the test title claims "exactly the typed refusals the BE03c matrices name".
- Why the amendment is justified:
  - :1323 [1304] fixes the status only; it names no operation.
  - Operation membership comes from FE03 :885, AC-123, and :1386 ("keep their pin as history") with DEC-176.
  - The requested 422 addition `nested_pattern_not_active` is justified by :1323 directly. `pattern_incompatible`, which the request omits, is justified the same way.
- Fix direction: amend :1287 before the Worker lane relies on it.

R7 `20261014140300_cms_list_pattern_selector.sql:63-75` — **minor** — the 400 check runs after 404/403, against "BE00 order" (:175, parse first). Worker Zod runs
first, so this is the second line only; concealment unaffected. Fix: document the order, or move the check before authority.

R8 `docs/handoffs/2026-10-14-claude-s12/lane-pattern-updates-report.md` — **minor (accuracy)**
- Problem: stale first-pass sections now contradict the current state.
  - `## Files` (:13-25) still has the old 140200/300/400/600 hashes and omits 140605.
  - D-ELIGIBLE (:92) still says draft and superseded heads are refused.
  - The first `## Test corrections` says "None.".
  - B3 (:109) says both "Contract frozen" and "FIXED".
- Fix direction: mark those sections superseded.

R9 `140400:67` — **info (residual of prior F6, out of brief)** — the non-strict diff offers `pu-dd` v2, which accept refuses with `nested_pattern_not_active` (`nna1`). UX call for root/owner.

## 6. The four "owner decisions pending"
1. **D-VALUE.**
   - Replace vs merge is largely answered. An override is a `JsonValue` keyed by node path (pattern-instance.ts:36-37; :377), and a collision is "override differs from
     the base" (:1386). Only whole-value replacement is consistent with that rule.
   - What is open: no BE03c text says how render applies an override.
   - Structural blindness is a **genuine gap**. :1386 does not say whether block identity or children are part of a path's value, and `base`/`theirs` are bare `JsonValue`
     (pattern-update.ts:149-151). Silent adoption conflicts with IA03 493.
   - A version-only change yields `paths: []` with `target > pinned`, a state FE03 does not define.
2. **D-RETIRE: genuine.** :1386 "appends an `active` row pinned to the target version" cannot apply to a root the target lacks. I found no removed-root text in
   BE03c, IA03, the deep dive or FE03. The prior F1 (stuck row) and F4 follow from this.
3. **B2.** The behaviour is answered: :1386 "the stored rows carry no placement identity, so there is no placement-wide accept" means accept creates no row.
   The remedy is a genuine product gap: a re-placement collides with the occupied paths.
4. **D-DETACH: genuine, but a root (architecture) call first.** :1386 "materializes … as local props" does not define the shape. Overrides cap at
   64 keys / depth 8 (:377) while trees allow 512 nodes and props of depth 8 (:1380), so no chain→props map holds every root (too many keys; depth 8
   becomes 9). Any surviving refusal needs a :1287 422 entry.

## 7. Recommendation
- All fix-pass items are done; every reachable behaviour change was shown RED (R1/R2 are unreachable). Correct the F2 incident note. Promote CMS-03C-13.
- Keep CMS-03C-14/15 held, as the prior review did, until the owner rules on the §6 items (D-RETIRE / prior F1 first), :1287 is amended (R6), and the race module proves the lock clauses.

VERDICT: PARTIAL
