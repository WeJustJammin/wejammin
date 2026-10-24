# Lane report — phils_locale_qa_20261015 (locale-gate-a F1 oracle gap)

## Status

WRITE-ONLY QA authoring complete and **authored UNRUN** (2026-10-15). No test, lint, typecheck, DB, Docker, runtime, network or mutant command was executed; no commit/stage/reset. Root `gpt-6.1-sol`/`ultra` owns planning, validation, review and integration, and will run the suite under the DB lock. Author is `Phils-Charm/deepseek-v4.1-flash`/`high` (exact requested route; no fallback used).

Model availability: requested route `Phils-Charm/deepseek-v4.1-flash` at `high` served every turn; no availability error, no fallback.

## Scope (exactly the 4 claimed paths)

Authorized and touched:

1. `supabase/tests/phase_02_slice_12_locale_gate/001-gate.sqlinc` — added one assertion (F1).
2. `supabase/tests/phase_02_slice_12_locale_gate.sql` — `plan(59)` -> `plan(60)`.
3. `docs/handoffs/2026-10-14-claude-s12/lane-locale-gate-a-report.md` — durable correction appended (history not rewritten).
4. `docs/handoffs/2026-10-14-claude-s12/lane-codex-locale-qa-2026-10-15.md` — this file.

Everything else — WIP/applied migrations, specs, tracking, `h11` helpers, the protected primary and other worktrees — was **read-only**. No production SQL was changed; no fabricated RED.

## F1 fix — stale > approval witness

Review F1: the two assertions that named "stale outranks the approval check" ran on **fr2**, which this lane approved at `:116`; an approved revision clears the approval branch regardless of ordering, so the mutation survived. Stale > approval was proven nowhere.

Added after the existing legal `:215` source edit, one direct assertion:

- `001-gate.sqlinc:224-225`: `pg_temp.l12g_gate(fr3, 'execute')` = `failed/no_fallback_stale/1` —
  "a NOT-approved (submitted) stale locale revision reports no_fallback_stale at scheduled execution, so the stale branch outranks the approval check (DEC-192) [P2-S12-AC-051]".
- `phase_02_slice_12_locale_gate.sql:16`: `plan(59)` -> `plan(60)`.

Why fr3 discriminates: fr3 is a locale variant whose revision was submitted (open review) at `:131-132`, effective state `submitted` (NOT approved). The `:215` source edit (legal `Legal two` -> `Legal three`) makes fr3's `legal` value stale, so the stale branch fires before the approval branch. The new assertion is legal-field `stale`; it does not depend on missing, so it is reachable exactly because the gate reports `no_fallback_stale` (not `locale_variant_not_approved`) for a not-approved revision — distinguishing approval-before-stale from stale-before-approval. Verified statically only; not run.

## Authoring integrity (static)

- Assertion count: `001-gate.sqlinc` has **52** explicit `select is(...)`/`select ok(...)` calls (was 51); the fixture includes contribute 8; plan total **60**. `plan(60)` matches 52 + 8.
- Include expansion: `phase_02_slice_12_locale_gate.sql:18-28` lists the same 11 `.sqlinc` includes as before; only the gate include gained the assertion and the plan changed.
- Legacy assertions preserved: no existing assertion, expected value or reason string was edited, weakened or reordered. The only change inside `001-gate.sqlinc` is the one inserted assertion.
- `001-gate.sqlinc` 275 lines (was 273); `phase_02_slice_12_locale_gate.sql` 31 lines (unchanged count).

## Files (path, lines, SHA-256 after)

- `supabase/tests/phase_02_slice_12_locale_gate/001-gate.sqlinc` 275 lines `5c1d0b764a3f6eb5ad43764be176295cc2b554c15ab59ea112b5cc9da13fce76` (before `98ccea7bd43c953ca07c8a539c3650efa121b5c04a2f57ba7b03f5c0bb57bbe2`; +1 assertion at :224-225)
- `supabase/tests/phase_02_slice_12_locale_gate.sql` 31 lines `4a6c261124877e9eb415409ea4208419582455199b89fa421457b645952a823f` (before `56d9bb7b20fb85571e924693fcea2cb75d243ca4eeb6ec1f31a09956ecc4c314`; only `plan(59)` -> `plan(60)` at :16)
- `docs/handoffs/2026-10-14-claude-s12/lane-locale-gate-a-report.md` `3310cf7bff41147b7c2609f24691c0d738570a3e64eda29ddaf06b15c4629af2` (before `d7b804edbf8c2a60a4d885a8a35282c8289f3cc435135579d028ad3e28cb4918`; one appended section)
- `docs/handoffs/2026-10-14-claude-s12/lane-codex-locale-qa-2026-10-15.md` (this file)

Both `supabase/tests/` owned files are well under 300 physical lines.

## Source citations (read-only, for root)

- Review F1: `review-locale-gate-a.md` §Findings 1 and §To reach CLEAR.
- Gate body precedence `:64-72`: `missing_count > 0` then `stale_count > 0` then the approval branch — the stale branch is evaluated before the approval branch.
- `cms_revision_effective_states` (`20261005017540_cms_revision_effective_state.sql:40-73`): published > scheduled > latest review state; fr3's open review -> `submitted`, which is not in `(approved, scheduled, published)`, so the approval branch would fail fr3 if reached — which is exactly what makes the new assertion discriminating.
- `cms_locale_resolutions` (`20261014050500_cms_resolve_locale_field.sql:96-99`): a variant field is stale when the recorded `field_source_hashes` value differs from the current source hash, independent of review state.
- DEC-192 (`.memory/wiki/decisions.md`); `briefs/locale-gate-a.md`.

## UNRUN / proof status

- **Runtime proof: PENDING.** Root must run the gate suite under `/tmp/wejammin-supabase-ci.lock` and observe 60/60 (and that the new assertion is the 60th, not a substitute). This author ran nothing.
- **Mutation proof: PENDING.** The intended mutation — move the approval check above the stale branch in `20261014050600_cms_locale_no_fallback_gate.sql:66-72` — must now flip the new fr3 execute assertion (`no_fallback_stale` -> `locale_variant_not_approved`) while leaving the fr2 assertions unchanged. Root to confirm.
- No RED was fabricated; the existing lane's real RED receipts are unchanged.

## Honest remaining minors / held for root

- **F2 (fixture realism, minor):** fr7 (`:193-199`) still raw-inserts an `active` publish lineage row without a real approved review. This author did **not** add a new raw active-row/guard-bypass fixture; the existing `h11r_raw_insert` helper (`phase_02_slice_11_helpers/002-reviews.sqlinc:146-160`) does disable user triggers, and the report's "no trigger was disabled" wording is now corrected. Correcting fr7 to a real approval chain (`h11r_approved`) is a candidate for root review; it is **not** authored here because it is outside the F1 scope and does not change the oracle. Remaining: unresolved unless root accepts the correction.
- **F3 (comment, minor):** `20261014050600_cms_locale_no_fallback_gate.sql:17-20` — the "defense in depth against a schedule whose review was invalidated without cancellation" comment cannot occur (E2 rule 2 keeps such a schedule `scheduled` and admitted). Not in this lane's claim; held for root.
- **F4 (spec-internal, minor):** `be/03c-composition-taxonomy-localization.md:1436` omits `scheduled` from the derived-variant-state sentence. Not in this lane's claim; held for root.
- **F6 (nit):** stale line citations in `050600:1-2` (BE03c 1391/1397 -> :1434) and the matrix row AC240 citations. Held for root.
- **Pre-existing baseline (not this lane):** `locale_owner_integrity` #13 and `locale_related_authority` abort (stale `max_candidates` fixtures) reproduce on promoted migrations alone; routed to fixture repair.

## Requests to root

1. Run the gate suite and the 27-file regression under the DB lock; confirm 60/60 and capture the new TAP hash.
2. Apply the approval-above-stale mutation and confirm the new fr3 execute assertion is the only one that flips.
3. Rule on F2 (author an fr7 real-approval correction in a follow-up, or accept as-is), F3, F4 and F6.
4. Record the new acceptance-section and file hashes in the Dispatch Log; this lane did not touch it.

## Root runtime diagnosis correction (2026-10-15) — supersedes the F1 sections above

Root ran the suite and corrected the F1 conclusion. Nothing above is rewritten; the following supersedes where it conflicts.

- **F1 as first stated is withdrawn.** The added fr3 `execute` assertion (`001-gate.sqlinc:226-227`, was `:224-225` before the fr7 insert) is not a gap closure and is not the sole mutant killer. Root's valid mutant TAP `.lane-logs/alt-staged-locale-gate-215752-509475.tap` (plan 60) is 57 PASS / 3 FAIL at 50-52: assertions **50 and 51** are the old fr2 `publish` and `execute` stale assertions and **52** is the added fr3 `execute` assertion. Assertion 49 (fr2 `submit`) still PASSES; these stale witnesses provide no current `submitted`-state coverage, while earlier open-review assertions do. The approval-above-stale mutation was therefore already killed by the old 50/51, without SQL or guard abort and with exact catalog restore.
- **fr2 and fr3 are both not-approved at the stale tests.** fr3 creation (`001:130`) invalidates fr2's approved review (`20261005017580:377-389`, trigger `:486-489`, core `:267-273` `revision_superseded`); fr4 creation (`:145`) invalidates fr3's open review. E2 (`20261005017540:57-68`) maps an invalidated review to `draft`. The earlier "fr3 is `submitted`" and "fr2 is approved" claims are both wrong at the point the stale assertions run.
- **Assertion 52 role:** an additional non-approved stale case; it is not `submitted`-state coverage.
- **Descriptions only:** `001:223` and `:227` now read "previously approved but now invalidated" and "previously submitted but is now invalidated". Oracles, values and counts unchanged; plan stays 60.
- **F2 (fr7 fixture realism) — resolved by authoring, not a new bypass.** `h11r_approved('l12g-rv-7', fr7, entry)` now runs immediately after fr7 creation and before the existing `h11r_raw_insert` publication row, matching the fr6 pattern. No new assertions, no new bypass or fixture-helper edits, plan unchanged at 60.
- **F3 (050600 header) — corrected.** Header `:17-19` no longer asserts a "review invalidated without cancellation" scenario; it states the execute effective state is scheduled by construction and the check is defense in depth only. No executable SQL change.
- **Still held for root:** F4 (BE03c `:1436` derived-variant-state omits `scheduled`) is held for the spec writer, not this lane's claim. F6 (stale line citations in `050600:1-2` and the AC240 matrix row) remains held.
- **Proof status:** root baseline `.lane-logs/alt-staged-locale-gate-211903-262630.tap` = 60 PASS; root's valid mutant negative = 57/3. Joint final confirmation pending. This author ran nothing.

## Root final joint confirmation (2026-10-15) — receipt

Root's final joint run is confirmed: mutant **57/3 at 50-52** first, then canonical **60 PASS**, receipt `.lane-logs/alt-staged-locale-gate-221226-608425.tap` SHA-256 `4ec9f573fd0661bcba959d194f6098b840da3d0dbee77187d35bf0da42dd6b02`. This supersedes the "Joint final confirmation pending" wording in the proof-status bullet above. This author ran nothing.

## Freeze — exact final hashes and diffs (2026-10-15)

After the corrections above, the four claimed paths plus the newly claimed WIP header are:

| Path                                                                                 | Lines | SHA-256 (final)                                                    |
| ------------------------------------------------------------------------------------ | ----- | ------------------------------------------------------------------ |
| `supabase/tests/phase_02_slice_12_locale_gate/001-gate.sqlinc`                       | 277   | `2ac0a415d2f52eabb3aa4ae1a58f7029d0890a1f71ec5f8d280feab497db1dda` |
| `supabase/tests/phase_02_slice_12_locale_gate.sql`                                   | 31    | `4a6c261124877e9eb415409ea4208419582455199b89fa421457b645952a823f` |
| `supabase/migrations-wip/locale-gate/20261014050600_cms_locale_no_fallback_gate.sql` | 93    | `75ad1184e77d46dc723809e7c6dee09198dca115d4ce6fa471f12e8b07835dbd` |
| `docs/handoffs/2026-10-14-claude-s12/lane-locale-gate-a-report.md`                   | 98    | `ad0682dbfdba9a63ce010c647f86a030fa4aba9f6e78b8e3f3d53a914f6a7df0` |
| `docs/handoffs/2026-10-14-claude-s12/lane-codex-locale-qa-2026-10-15.md`             | —     | this file (self-referential; not cited)                            |

Diffs, all authored with `apply_patch`:

1. `001-gate.sqlinc` — inserted `h11r_approved('l12g-rv-7', fr7, entry)` at `:194-195` (after fr7 creation, before the existing raw publication row); reworded two descriptions at `:223` and `:227`. No oracle, value, assertion or plan change; 52 explicit assertions + 8 fixture = 60.
2. `phase_02_slice_12_locale_gate.sql` — unchanged from the first pass (`plan(60)` at `:16`).
3. `20261014050600` — header `:17-19` reworded (was `:17-20`); the file is now 93 lines (was 94). No executable SQL change; the function body, grants and comment are byte-identical.
4. Reports — two durable correction sections; no historical text rewritten.
