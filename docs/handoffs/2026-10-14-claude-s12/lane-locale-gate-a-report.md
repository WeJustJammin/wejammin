# Lane report — claude_s12_locale_gate_a

## Status

GREEN (2026-10-15T17:02Z). DEC-192 implemented: `locale_variant_not_approved` now applies in the `schedule`, `publish` and `execute` phases, admits effective states `approved`, `scheduled`, `published`, and never applies at `submit`; missing outranks stale outranks approval. Gate suite 59/59. The four known reds (helpers_preflight #14/#94, criteria_publish_gates #32/#33) are green. Two unrelated failures in other lanes' fixtures are classified under Open items. No box checked. `pnpm progress:check` exit 0 (under `flock -s /tmp/wejammin-quiet.lock`).

## Scope

Brief `briefs/locale-gate-a.md`; DEC-192 (`.memory/wiki/decisions.md`); `review-locale.md` F4; `lane-locale-report.md` F4. Edited: gate WIP migration 050600, gate suite, BE03c, the AC-240 clause in the tracker and phase-2.md. Not edited: 050700 (no approval wording in it), FE03, IA03, BE03b (see Spec citations).

## Files (path, lines, SHA-256 after)

- `supabase/migrations-wip/locale-gate/20261014050600_cms_locale_no_fallback_gate.sql` 94 lines `d0fe7feac84b3772e4282b8b07750a94931d9da60c9169c692bc044853b1bbcd` (before `915e00d1c1bc6b1f039cfbc90fc7e1db3564074699e09de6b616ce4cd352f5c9`)
- `supabase/migrations-wip/locale-gate/20261014050700_cms_preflight_locale_provider.sql` 91 lines `2718715bdd09381f892631fc933d53ccc623460aabc00af24667f029b6a95254` (unchanged)
- `supabase/tests/phase_02_slice_12_locale_gate.sql` 31 lines `56d9bb7b20fb85571e924693fcea2cb75d243ca4eeb6ec1f31a09956ecc4c314` (before `75a621dc...e552cd`; only `plan(36)` -> `plan(59)`)
- `supabase/tests/phase_02_slice_12_locale_gate/001-gate.sqlinc` 273 lines `98ccea7bd43c953ca07c8a539c3650efa121b5c04a2f57ba7b03f5c0bb57bbe2` (before `66c4b985d94a66c2433c2af7c6bd73b9bb2b8f3c49140bffef71fd8785ccc50c`, 199 lines)
- `.memory/wiki/specs/be/03c-composition-taxonomy-localization.md` `660ed34603f8c9a7c9e9d44a39b88451f7190c885193f33149fd13148fbf21cf` (before `4c042de810f548b11af666f2dad35fb7fd4111e24aac2de5abebd643834f39a7`; other lanes also edit this file, so the before/after delta is not purely this lane)
- `.memory/wiki/specs/phases/phase-2.md` `18239bcc0e9193d2443a84589ebfb793e2f10a16e9c213f52684233d012a5a8d` (before `562e0b609ce9ec8cec8e892de9075064cf8e96783e935a38da1a7753584db9db`)
- `.memory/pipeline/progress/slices/phase-02-slice-12.md` `0b3c5360fa84b88fa16973c2d2d79d2fed1c70432d75b9a734cbda8f403e34d1` (whole file; other lanes append to the Dispatch Log)

Tracker acceptance section (`## Acceptance Criteria` to EOF):
before `9950eb5ddcd3df08516ed73a8c65a1acab9bfb794076dfc1f51eb38490820427` (equals the value root recorded at claim; reproduced by reversing this lane's one substitution on the current section),
after `d44800a1d9b2ab3195797251ff1de954d98f9f65f8dc40da954600da3e5a2b76`. Root to record in the Dispatch Log (this lane did not touch it).

## Gate change (050600)

- phase condition `p_phase in ('schedule', 'publish')` -> `p_phase in ('schedule', 'publish', 'execute')`
- admitted set `('approved', 'published')` -> `('approved', 'scheduled', 'published')`
- header comment and function comment rewritten to DEC-192 (submit never checks; execute is defense in depth; scheduled admitted to agree with `cms_locale_variant_state`, 050400:27-33 which maps scheduled to approved).
  The phase whitelist already contained `execute`, and `submit` falls through to `passed`; precedence missing > stale > approval is unchanged.

## Exact AC-240 wording diff (identical in tracker `phase-02-slice-12.md` line 2284 and `phase-2.md` line 3339; each file's trailing source link untouched; no box changed)

- old: "a revision whose locale variant is not in effective state `approved` or `published` fails with `locale_variant_not_approved`, and otherwise the category passes;"
- new: "in the `schedule`, `publish` and `execute` phases a revision whose locale variant is not in effective state `approved`, `scheduled` or `published` fails with `locale_variant_not_approved` (never at `submit`; a missing value outranks a stale one, which outranks the approval check; DEC-192), and otherwise the category passes;"
  Nothing else in the criterion changed; checked boxes in the acceptance section: 0 before, 0 after.

## BE03c edits

- "Locale preflight provider" paragraph (line 1428): phase rule, admitted states (`approved`, `scheduled`, `published`), submit never checks (with the CMS-03B-05 reason), missing > stale > approval (DEC-192).
- Locale tests line (1651): the gate tests the three phases, every effective state (admitted/refused), never submit, precedence.
- Changelog: one 2026-10-15 row after the last row (line 1732).

## Runs (all via the staged runner, lane `locale-gate`, except run 4)

| #   | Stamp (TAP)                             | Plan                                                                                                                                                              | Result                                                                                                                                                                                  | Classification                                                                                                                                                                                            | TAP SHA-256                                                        |
| --- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 1   | `alt-staged-locale-gate-125622-2406118` | gate suite, new RED cases against unchanged 050600                                                                                                                | 59 planned, 54 ok, 5 not ok: #20 (execute, draft fails), #29 (execute, submitted fails), #34 (execute, rejected fails), #39 (scheduled passes publish), #40 (scheduled passes schedule) | genuine missing feature, right reason; plan 59 correct (51 explicit assertions + 8 from fixture includes); fixtures (scheduled/published rows) worked                                                     | `1878d4cc246a48e082bd3757e1c37e66c67343c5d520c5692c9844b98e2574fa` |
| 2   | `alt-staged-locale-gate-125738-2414882` | gate suite after the 050600 change                                                                                                                                | PASS, 59/59                                                                                                                                                                             | GREEN                                                                                                                                                                                                     | `bc3d154549a45608ccb1b369597c5fa565c01f1356aa74a1cc454b53425985e5` |
| 3   | `alt-staged-locale-gate-125847-2424149` | 27 files: every `*locale*.sql` (Slice 9/10/11/12 incl. locale_perf), `phase_02_slice_11_helpers_preflight`, `criteria_publish_gates`, `preflight_registry_schema` | 828 ok, 1 not ok, 1 abort: `locale_owner_integrity` #13 and `locale_related_authority` aborted at :158                                                                                  | all other 25 files fully green, including the four known reds (helpers_preflight #14/#94, criteria_publish_gates #32/#33) and the gate (59/59). The two failures are the pre-existing baseline, see run 4 | `79ed2c0d4fad4f6594b5a6a51e79c5051e408946841204f9eff1f6b76a498b01` |
| 4   | `alt-staged-none-130026-2434276`        | the two failing files on promoted migrations only (lane `none`, no WIP)                                                                                           | identical: owner_integrity #13 not ok, related_authority aborts at :158 with `cms_related_content_rules_max_candidates_check`                                                           | diagnostic: pre-existing, not caused by this lane                                                                                                                                                         | `4e1adbcbbfcd2fa46a0673a90ad8ae09636c34f694696d46428a5e3cf43507f5` |

## Test corrections (existing oracle changed; review these)

Only the gate suite, which this lane's migration owns. Spec basis: DEC-192 and review-locale F4 (the test at 001:110-111 "pins the skip" and F4 says it becomes an `approved|scheduled` pass).

1. `001-gate.sqlinc` fr2 `'execute'` assertion: expected `passed/-/0` ("at execution the revision is scheduled by construction and the approval was enforced at acceptance") -> `failed/locale_variant_not_approved/1` for a draft revision (DEC-192: the check applies at execute). No other existing assertion was edited.
   Added (23 assertions, no existing one weakened): invalid phase `bogus` -> `__error P0001:INVALID_REQUEST`; submit never checks (approved fr2, submitted fr3, rejected fr4, scheduled fr6, published fr7 all `passed/-/0`); execute: approved passes, submitted/rejected fail; schedule fails for submitted/rejected; fr6 (approved review + pending publish schedule raw-inserted with the Slice 11 row builders, effective state `scheduled`): execute, publish, schedule pass and the derived variant state shows `approved`; fr7 (publish lineage row, effective state `published`): execute, publish, schedule pass and state `approved`; precedence at execute: stale (fr2) and missing (fr1) outrank the approval check. Plan 36 -> 59 (`phase_02_slice_12_locale_gate.sql` line 16 only).
   Fixture note: fr6/fr7 rows use the shared `h11r_raw_insert` helper exactly as `phase_02_slice_11_helpers_effective_state.sql` does; no trigger was disabled by this lane's code.

## Spec citations

BE03c 1428 and 1651 (edited), DEC-192, review-locale F4 (:111-125), lane-locale-report F4, BE03b :1818 (submit evaluates categories 1-16; schedule/publish all seventeen), `20261005017540_cms_revision_effective_state.sql` (state order published > scheduled > approved...), `20261014050400_cms_locale_variant_state.sql:27-33` (scheduled and published show approved). FE03 (889, 1120, 2665) and IA03 (49, 70, 501) were checked: they describe resolution/stale blocking and the derived variant states but state no timing for the approval gate, so nothing was aligned. BE03b :1811 (category row 14) and 1818 name no approval timing either; no BE03b edit was needed.

## Open items / BOUNDARY

1. Pre-existing, unrelated to DEC-192, reproduced on promoted migrations alone (run 4): `phase_02_slice_12_locale_related_authority.sql:158` raw-inserts a `derived` rule into `cms_related_content_rules` without `max_candidates`, violating the check added by promoted `20261014060000_cms_related_rule_registry.sql:70-71` (derived requires `max_candidates`); the abort also gives `phase_02_slice_12_locale_owner_integrity.sql` #13 ("related-content source cannot claim another owner") the same cause at its own insert. These are frozen locale-lane fixtures made stale by the related lane. Not edited here (outside the brief). Fix: add `max_candidates` (1..128) to those raw `derived` inserts.
2. The execute check is defense in depth, as F4 predicted; a schedule that reaches `execute` is `scheduled` by construction, so the new execute branch is exercised through the gate directly, not through a full executing worker.
3. No BOUNDARY stubs.

## Requests to root

1. Record the new tracker acceptance-section hash `d44800a1d9b2ab3195797251ff1de954d98f9f65f8dc40da954600da3e5a2b76` in the Dispatch Log.
2. The depth-floor matrix `.memory/pipeline/progress/verification/2026-10-11-slice-12-depth-floor.md` line 293 still carries the old AC-240 wording; the brief assigned only tracker and phase-2.md, so it was not edited. Apply the identical substitution (the retire cascade precedent edited that file too) or authorize this lane to.
3. Promote `locale-gate/20261014050600` and `050700` (reviewed with the gate change); then the two stale locale fixtures (Open item 1) need a fixture-repair lane.
4. The 27-file regression runs do not include `r8_api_surface` or `sec2_*` baselines; unchanged by this lane's WIP (a pure function body change, no grant or owner change).

## Post-review correction (2026-10-15, `phils_locale_qa_20261015` — durable append; history above unchanged)

Independent review `review-locale-gate-a.md` (PARTIAL, F1) corrects claims of this report. Nothing above is rewritten; the following supersedes where it conflicts.

1. **Precedence evidence (F1) — withdrawn.** The two assertions cited above as proving "stale outranks the approval check" (`001-gate.sqlinc:220-221` publish, `:222-223` execute) run on **fr2, which this report's own §Test corrections approves at `:116`**. An approved revision clears the approval branch whether that branch sits above or below the stale branch, so neither assertion — nor the sentence "stale (fr2) … outrank the approval check" — distinguishes the ordering. Stale > approval is now witnessed by the added assertion on **fr3**, a submitted (NOT-approved) revision made stale by the `:215` source edit, returning `failed/no_fallback_stale/1` at `execute` (`001-gate.sqlinc:224-225`). Plan 59 -> 60 (`phase_02_slice_12_locale_gate.sql:16`).
2. **Missing > stale is not established (F1).** The suite has a single `legal` no_fallback field, so `missing > stale` cannot be shown by it; this report does not claim it and the gate's fr1 reason is `no_fallback_missing`.
3. **Run 3 count (F5) — corrected.** "828 ok, 1 not ok, 1 abort" is wrong. TAP `alt-staged-locale-gate-125847-2424149` carries **803 `ok` + 1 `not ok`** (`Files=27, Tests=804`), and `locale_related_authority` aborted after **13** assertions. The classification and conclusion are unchanged.
4. **Trigger-bypass wording (F2) — corrected.** "no trigger was disabled by this lane's code" is imprecise: the shared `h11r_raw_insert` helper this lane calls **does** disable the table's user triggers (`phase_02_slice_11_helpers/002-reviews.sqlinc:146-160`). This lane added no new raw active-row/guard-bypass fixture of its own; the fr6/fr7 rows go through that existing helper exactly as the Slice 11 precedent does.
5. **Held for root, not edited here.** F3 (`20261014050600_cms_locale_no_fallback_gate.sql:17-20` comment accuracy) and F4 (BE03c `:1436` derived-variant-state omission of `scheduled`) are outside this lane's write claim and are left for root.

## Second correction (2026-10-15, `phils_locale_qa_20261015` root runtime diagnosis — durable append; history above unchanged)

Root ran the suite and its independent trace correct the _first_ correction above. Nothing above is rewritten.

1. **fr2 and fr3 are BOTH not-approved at the stale tests.** Creating fr3 (`001-gate.sqlinc:130`) invalidates fr2's approved review through the promoted invalidation trigger (`20261005017580:377-389`, trigger `:486-489`, core `:267-273` `revision_superseded`); creating fr4 (`:145`) invalidates fr3's open review. E2 (`20261005017540:57-68`) maps an invalidated review to `draft`. So at the stale assertions fr2 is `draft` and fr3 is `draft` — neither is approved or submitted, and the first correction's "fr2 is approved" and "fr3 is submitted" readings do not hold at the point those assertions run.
2. **The mutant was already killed.** Root's valid mutant TAP `.lane-logs/alt-staged-locale-gate-215752-509475.tap` (plan 60) is **57 PASS / 3 FAIL at 50-52** — assertions **50 and 51**, the old fr2 `publish` and `execute` stale assertions, plus the added assertion **52** (fr3 `execute`). Assertion 49 (fr2 `submit`) still PASSES, so this is not "pre-existing fr2 submit/publish/execute"; these stale witnesses provide no current `submitted`-state coverage. Earlier open-review assertions do cover submitted revisions. No SQL or guard abort and exact catalog restore. The "mutation survives the whole suite" premise of the first correction and of review F1 is therefore wrong for the mutant as run.
3. **The added assertion is an extra case, not a gap closure.** The fr3 `execute` assertion (now `001-gate.sqlinc:226-227`) is a second non-approved stale case, not the sole mutant killer and not `submitted`-state coverage. Its description and the fr2 publish description (`:223`) were changed to "previously approved but now invalidated" and "previously submitted but is now invalidated"; all oracles, expected values and the plan (60) are unchanged.
4. **F2 (fr7 fixture realism) — authored.** `h11r_approved('l12g-rv-7', fr7, entry)` now runs immediately after fr7 creation and before the existing `h11r_raw_insert` publication row, matching the fr6 pattern; no new assertions and no new bypass or fixture-helper edits.
5. **F3 (050600 header) — corrected.** The header `:17-19` no longer asserts a "review invalidated without cancellation" scenario; it states the execute effective state is scheduled by construction and the check is defense in depth only. No executable SQL change.

Root baseline is 60 PASS (`.lane-logs/alt-staged-locale-gate-211903-262630.tap`); the later valid mutant negative is 57/3. Final joint confirmation then ran mutant 57/3 followed by canonical 60 PASS: `.lane-logs/alt-staged-locale-gate-221226-608425.tap`, SHA-256 `4ec9f573fd0661bcba959d194f6098b840da3d0dbee77187d35bf0da42dd6b02`. No promotion or broader-regression acceptance is claimed.
