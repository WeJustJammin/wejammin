# Lane dec191 report (claude_s12_dec191, phase 1: SQL + pgTAP)

## Status
PHASE 1 GREEN (final, 2026-10-15T12:12Z; resumed 11:32Z after the predecessor died at the usage limit ~09:05Z).
Run 3 (the predecessor's last run, stamp 050456-334876) finished after the predecessor died: PASS, 966 tests, 11 files, 0 not ok; the WIP and test
bytes of that run equal the bytes on disk (reconstruction below), so it was not rerun. Added by this lane: exhausted ladder RED+GREEN (13 tests),
five mutation runs (all killed by the intended tests, one reset-time refusal), idempotency witness (PASS). Phase 2 not started.

## Scope
Phase 1 only (brief `briefs/dec191-read-gap.md`): DEC-191 read members in SQL.
- `GovernedActivationResource.supersededVersion` in `platform_private.cms_activate_governed_subject(jsonb)` (CMS-03C-09).
- `GovernedReviewDetailResource.activationSchedule` in `platform_private.cms_get_governed_review(jsonb)` (CMS-03C-10).
Not started, by instruction: phase 2 (contracts, Worker, Web).

## Design
- Activation: the previous active version id is already held in `v_active` (locked FOR UPDATE at position 3, re-verified equal under the lineage
  advisory lock). New private helper `cms_governed_definition_version(kind, id)` reads its immutable definition `version`; one anchored response
  patch with three anchors (activate: helper value; schedule and retire: literal null). No new lock, no new write.
- Detail: new private STABLE helper `cms_governed_review_schedule(review_id)` -> `{state, reasonCode}` or NULL of the review's most recent schedule
  row; one anchored patch of the detail read adds the member inside the same statement (same snapshot).
- Most recent = live (pending/executing/failed_retryable) first, then `created_at desc, id desc` (rows of one transaction share `created_at = now()`).
- Patches are exactly-once-anchor, compare every non-body `pg_proc` attribute (`to_jsonb(pg_proc) - 'prosrc'`) before and after, are idempotent
  (marker count 3 / 1 = already applied; any other non-zero count refused with 55000) and keep owner, ACL and comment (comment restated).

## Files (path, lines, SHA-256; read from disk 2026-10-15T11:34Z)
New migrations (WIP, lane `dec191`, range 20261014170000-170499; 3 files):
| path | lines | sha256 |
|---|---|---|
| `supabase/migrations-wip/dec191/20261014170000_cms_governed_read_gap_helpers.sql` | 80 | befa4cc1514e98c9db13ba67601997df96b362855d7aceb7bc04c040a610883a |
| `supabase/migrations-wip/dec191/20261014170100_cms_governed_activation_superseded_version.sql` | 81 | 62acc35f8eb92941f2cca6582442681eea1f8317f0412857e1488136bc136254 |
| `supabase/migrations-wip/dec191/20261014170200_cms_get_governed_review_activation_schedule.sql` | 64 | 65d34a6ee34ab4553eb69797e58bb96795b575fc06ffc3db84f7181efce6f6d7 |

New tests (`supabase/tests/`):
| path | lines | sha256 |
|---|---|---|
| `phase_02_slice_12_dec191.sql` | 39 | 986e7c34bb132dbc50864534c94c8769dee49522c068ba2367460615c12f2b7c |
| `phase_02_slice_12_dec191_pattern.sql` | 23 | 7404e1076485d98f3de65c9deba75c5b2649d8f9072b988f3e4746651ea4c533 |
| `phase_02_slice_12_dec191_exhausted.sql` | 23 | 60f2d5851c720f4c464f132165e7d64d2e6eda148488ac527939768beee9c7d2 (plan 4 -> 13 at 11:42Z, see Runs 4-5) |
| `phase_02_slice_12_dec191/000-helpers.sqlinc` | 59 | 0bd23afde3ae1a893cdea80941915ecac1fa21e9d76e6d6b4b63e68ded4d7bef |
| `phase_02_slice_12_dec191/010-setup.sqlinc` | 53 | f3e68c7f07868605a45562a7901f3f5e2111c24a26645cf5154ec16642f6b0c2 |
| `phase_02_slice_12_dec191/020-activation.sqlinc` | 81 | d45814a03630aae40e1f5054f14da7822b8f466102b127356914c8bf8b14bef4 |
| `phase_02_slice_12_dec191/030-taxonomy.sqlinc` | 57 | 8e89620c4abca339fbc6f9cd470d9e5959fed94505657c1f44c1c9dc9f9c35e1 |
| `phase_02_slice_12_dec191/040-detail.sqlinc` | 133 | 57cd2fa85d521aa11a4602f7718422f01ebda84cb447739141e2c52e68e2817e |
| `phase_02_slice_12_dec191/050-structure.sqlinc` | 53 | 234c7310fc73ba206fd2dd172c6b140cc130dd57fc9e7eaadf13ed6553d5f292 |
| `phase_02_slice_12_dec191/060-pattern.sqlinc` | 46 | 6cdcb8e7a15b5690209e1043e76fecdb9eedc7f29095f27d172d93fade28e33e |
| `phase_02_slice_12_dec191/070-exhausted.sqlinc` | 39 | 7653644f7c7a034893c6cee345303331f052087cd9d41adc730cee9f91f14b33 |
| `phase_02_slice_12_dec191/README.md` | 30 | 19fc33c1e0c04d949d2e9be59e09db8a9599b909bc68c23b6c218168e951d5fa |

Existing suites edited (five oracle files, see Test corrections):
| path | lines | sha256 |
|---|---|---|
| `phase_02_slice_12_governed_activation/030-activate.sqlinc` | 77 | f4419695540c97df6f70d9f793bf7f8e7bac0354233c024bde01fe51335a49fb |
| `phase_02_slice_12_governed_activation/050-schedule-accept.sqlinc` | 125 | 910f242d93eb820201ab47e8dfdc870dacf08c2146ea215703cccbe7e6c4703b |
| `phase_02_slice_12_governed_activation/095-retire.sqlinc` | 259 | f9585532859003e7323dd5c86a392234900090ee5a758a49648ab2ffd7383354 |
| `phase_02_slice_12_governed_retire_pattern/010-retire.sqlinc` | 72 | 272a8b04e404f0e2f77cda695150380a753409c86f579cf3faa74c5026277f46 |
| `phase_02_slice_12_governed_reads/020-detail.sqlinc` | 140 | 8d81e6e665f3e239924b1102f61a84488137e9a45cc239c426ea400ec7014f43 |

Mutation / idempotency copies: the runner stages WIP only from `supabase/migrations-wip/<lane>/`, so the mutants lived in `supabase/migrations-wip/dec191mut1..5/` and
`dec191-twice/` (the three migrations again at 20261014170400/410/420, byte-identical bodies). All six directories were deleted at 12:11Z (`ls supabase/migrations-wip | grep dec191`
shows only `dec191`); the mutant bytes are kept in `<scratchpad>/claude_s12_dec191/mutants/<name>/`. The predecessor's `dec191mut1/2` and `dec191-twice` (created 09:05Z, never run) were reused;
`mut2` was rewritten (see Mutation evidence).

## Reconstruction of run 3 (stamp 050456-334876), the run that finished after the predecessor died
- Runner invocation (inferred from the TAP and manifest): lane `dec191`, 11 test files in this order: `dec191`, `dec191_pattern`, `governed_activation`,
  `governed_schedule`, `governed_retire_pattern`, `governed_reads`, `governed_assignment`, `governed_decision`, `governed_fix`, `governed_fix3`,
  `pattern_definition`. The manifest records `lane=dec191 promoted=454 wip=3`.
- TAP `.lane-logs/alt-staged-dec191-050456-334876.tap`, SHA-256 `762e05b7c92e774eb4f33461570c2e27254109b000c1f10aad0483171f2933ba` (re-hashed
  by me, matches the lead's value): `Files=11, Tests=966, Result: PASS`, 0 `not ok`, no skips. Per file (ok / not ok): dec191 53/0, dec191_pattern 62/0,
  governed_activation 124/0, governed_schedule 56/0, governed_retire_pattern 69/0, governed_reads 56/0, governed_assignment 68/0,
  governed_decision 57/0, governed_fix 36/0, governed_fix3 42/0, pattern_definition 343/0 (sum 966). The 6 other files are the regression set
  (activation, schedule, retire, review read, plus the other governed suites that share the patched producers).
- Manifest `.lane-logs/alt-staged-dec191-050456-334876.manifest` (written 05:04:56 local = 09:04:56Z; reset finished 05:05:39; TAP last written
  05:10:36). The three WIP migration hashes it records equal the bytes on disk now (befa4cc1..., 62acc35f..., 65d34a6e...). Its body is byte-identical
  to run 2's manifest (stamp 050158-318490).
- Bytes check: every file under `supabase/tests/` and `supabase/migrations*/` newer than the manifest was searched. Exactly one is newer
  (`supabase/tests/phase_02_slice_12_pattern_selector/020-authority.sqlinc`, 05:09:03, another lane's file); it is not included by any of the 11
  files (grep for `pattern_selector` over every file of the run: no match). The newest file of the run's inputs is 05:04:43 (the five edited
  oracle files), 13 s before the manifest and 56 s before the first byte pg_prove read. The three WIP migrations were last written 04:59:48 and
  are staged by copy. Conclusion: the WIP and test bytes on disk are the bytes run 3 used. No further run needed for them.
- Caveat on "the five oracle files edited at 05:04:43": they are untracked in this worktree (no git baseline), so the "before" side of their diff is
  reconstructed from earlier TAP titles (see Test corrections).

## Runs
| # | time (UTC) | stamp | lane migrations | files | result | first failing | TAP |
|---|---|---|---|---|---|---|---|
| 1 | 08:58-09:01 | 045859-304092 | none (RED) | dec191 + dec191_pattern | 28 + 4 failed | 13 (12-member key set; the member does not exist) | `.lane-logs/alt-staged-dec191-045859-304092.tap` SHA-256 `70aa27e8ce3d28b85fc66bda23f701006596a9c7000b54235aa7e0bc5a4c6b81` |
| 2 | 09:01:58-09:04 | 050158-318490 | dec191 (3) | dec191 + dec191_pattern | PASS, 2 files, 115 tests (53 + 62), 0 not ok | none | `.lane-logs/alt-staged-dec191-050158-318490.tap` SHA-256 `18e6625ae37a1f511cb308190ef858ff89e41a1608d0080a241a3f3062b74993` |
| 3 | 09:04:56-09:10:36 | 050456-334876 | dec191 (3) | 11 files (above) | PASS, 966 tests, 0 not ok | none | `.lane-logs/alt-staged-dec191-050456-334876.tap` SHA-256 `762e05b7c92e774eb4f33461570c2e27254109b000c1f10aad0483171f2933ba` |

Run 1 classification (predecessor): main file failures 13-19, 21, 25-30, 32-33, 35, 37-38, 40, 42-44, 46-50 are all genuine missing feature (member /
helpers absent); fixtures (tests 1-12) and every control passed. Pattern failures 61 and 74 genuine missing feature; 63 and 71 were HARNESS:
`s12pd_activate` asserts definition version 1 and the successor is 2, so the pattern fragment got its own `d191_pattern_activate` in `060-pattern.sqlinc`
(the helper raises on any failed real step instead of asserting). Run 1 emitted 74 pattern tests, runs 2-3 emit 62: a title diff of the two TAPs shows the 12
missing titles are exactly the `child-successor:` assertions bundled inside `s12pd_activate` of the pattern-definition suite (prerequisite real
submission/assignment/approval/activation, lifecycle-once and definition-pin checks of the successor); they remain asserted by `phase_02_slice_12_pattern_definition.sql`
for its own scenario, and `060` proves the four real steps through its raise-on-failure fixture guard and then asserts the member. Run 2 was the first
GREEN after the harness fix.

| 4 | 11:34-11:42 | 073341-905282 | none (RED) | dec191_exhausted (plan 4) | FAIL: 13 tests ran, "planned 4", 11 and 13 `not ok` | 11 and 13 (`activationSchedule` member absent, "test result was NULL") | `.lane-logs/alt-staged-none-073341-905282.tap` SHA-256 `0421f9b1dfffa89252c96347d5f78cbcb200294e7695d069863c3f30ddf792a3` |
| 5 | 11:42-11:50 | 073431-911308 | dec191 (3) | dec191_exhausted (plan 13) | PASS, 13 tests, 446 s, 0 not ok | none | `.lane-logs/alt-staged-dec191-073431-911308.tap` SHA-256 `ca585557588ffb490c03e94b4d59d26b3cffaaf8f80607ab4a2155925ade9c93` |
| 6 | 11:50-11:55 | 075013-997523 | dec191mut1 | dec191 + dec191_pattern | FAIL as intended: 11 + 1 `not ok` of 115 | 14 | `.lane-logs/alt-staged-dec191mut1-075013-997523.tap` SHA-256 `3e7c890fe2ef95b2a7c20e53e97da61cd355e33d615b5f51c1e072505fbdeeff` |
| 7 | 11:55-12:01 | 075529-1026534 | dec191mut2 | dec191 | FAIL as intended: 10 of 53 | 13 | `.lane-logs/alt-staged-dec191mut2-075529-1026534.tap` SHA-256 `480effcfbec2455c5e631a494c27c9f6d442eabd9651c11e75498c1cb5ca30c8` |
| 8 | 12:01-12:05 | 080126-1059947 | dec191mut3 | dec191 | FAIL as intended: 13 of 53 | 19 | `.lane-logs/alt-staged-dec191mut3-080126-1059947.tap` SHA-256 `98699716b69a1b59b3911ff0b60eef7a2dbce737487a6023f0b7735794374851` |
| 9 | 12:05-12:06 | 080530-1081411 | dec191mut4 | (reset only) | RESET REFUSED by the patch: `patch anchor 2 occurs 0 times (SQLSTATE 55000)` | n/a | `.lane-logs/alt-staged-dec191mut4-080530-1081411.reset.log` SHA-256 `63a763684e28e7caf332cb0f992db0045417baae426be0bf21d5796f442499db` (no TAP) |
| 10 | 12:06-12:08 | 080625-1087123 | dec191 + dec191-twice (6) | dec191 | PASS, 53 tests, 0 not ok | none | `.lane-logs/alt-staged-dec191+dec191-twice-080625-1087123.tap` SHA-256 `f791a07f4f99aa56043b18e2096ed969d4333d23f91676f007b6bc29b2124df9` |
| 11 | 12:08-12:11 | 080849-1101565 | dec191mut5 | dec191 | FAIL as intended: 3 of 53 | 47 | `.lane-logs/alt-staged-dec191mut5-080849-1101565.tap` SHA-256 `755d25daeeda595144be5cc18a9fc8f2c4b4710cdf406f8d0d1da6b8b2528010` |

Run 4 classification: HARNESS (the file's own `plan(4)` ignores the 9 assertions the governed-b world fixture emits, so the plan is 13; "Bad plan") plus genuine missing
feature (11 and 13 fail with NULL: the `activationSchedule` key is absent without the WIP). Not a reset failure. Fix: `plan(13)`; run 5 is the only GREEN of that file and ran after the edit
(file edited 11:42:15Z before the reset of run 5 finished at 11:42:46Z, hence read by pg_prove with the corrected plan).
Runs 9-11 ran after root promoted two more migrations (`20261014140300/140310` pattern selector): their manifests say `promoted=456`; runs 1-8 (including the mutation runs 6-8) say `promoted=454` (corrected in Fix pass 1 after review finding F3; every manifest re-read). They do not touch the two patched producers
(grep of `cms_get_governed_review|cms_activate_governed_subject` over `migrations-wip` and `migrations`: only the files named above).
Run 9 is expected-failure evidence for the anchor guard, not a defect: a reset that refuses is a correct outcome there.

## Mutation evidence (scratch copies only; each run changed only the mutated WIP bytes)
Every new member and every property the migrations promise is killed by a named test. Test numbers are the numbers in the runs above (main file `phase_02_slice_12_dec191.sql` unless a `pattern` file is named).
| mutant (diff against `dec191/`) | targets | killed by (not ok) |
|---|---|---|
| mut1 (a) `cms_governed_definition_version` reads `lifecycle_version` instead of `version` for template, pattern and taxonomy | `supersededVersion` value | 14, 15, 16, 17, 18 (template v2/v3, definition-vs-lifecycle, idempotency record, replay), 26 (taxonomy), pattern 62 |
| mut1 (b) `cms_governed_review_schedule` returns `reasonCode` literal null | `activationSchedule.reasonCode` | 30 (cancelled), 37, 40, 42 (blocked x3), 44 (state/reason closed relation) |
| mut2 (a) schedule helper ranks live first INVERTED (`asc`) | most recent of two schedules | 38 (blocked then pending shows pending); (a) alone is detected by this one test, the other failures of the run come from (b) |
| mut2 (b) activate answer names `v_review.subject_version` (the activated version) instead of the superseded one | `supersededVersion` on activate | 13 (first activation must be null), 14, 15, 16, 17, 18, 25, 26, 50 |
| mut3 (a) schedule and retire answers name `v_review.subject_version` instead of null | `supersededVersion` null for schedule / retire | 19 (202 schedule over an active lineage), 21 (retire) |
| mut3 (b) detail member hard-coded to `null` | `activationSchedule` projection | 29, 30, 32, 33, 35, 37, 38, 40, 42, 44, 50 (pending, cancelled, executing, completed, failed_retryable, blocked x3, most recent, relation, helper used) |
| mut4 anchor 2 text no longer matches the live body | exactly-once anchor guard | reset refused: `patch anchor 2 occurs 0 times` (SQLSTATE 55000), nothing applied after it |
| mut5 (a) `cms_governed_definition_version` VOLATILE; (b) `... for share` row lock; (c) `grant execute ... cms_governed_review_schedule to service_role` | STABLE / no-lock / no-API-grant properties | 48 (STABLE), 49 (no row lock), 47 (no API role can execute) |
| twice: the three migrations applied a second time (as 170400/410/420) | idempotency | PASS: 53 tests green, the member counts stay 3 and 1 (test 50), attributes unchanged (test 51/52) |
Not mutated, by design: the lock order (existing tests 090-lineage-lock plus structure test 51 prove no new lock position); `canonical_source_unavailable` (Open item 1).
Not independently killable: the `created_at desc, id desc` tie-breakers (Open item 2).

## Test corrections (existing oracles; all additive, all DEC-191 / BE03c schema block citations)
Only the pinned member lists and one exact expected body gain the new member. The "before" side is confirmed by the TAP titles of earlier runs
(`(11 members)`, `(29 members)` in `.lane-logs/*.tap` before 05:04:43 local).
| file | change | citation |
|---|---|---|
| `phase_02_slice_12_governed_activation/030-activate.sqlinc` :8-9 | key list gains `,supersededVersion`; title `(11 members)` -> `(12 members, DEC-191 supersededVersion)` [AC-082] | DEC-191; BE03c `GovernedActivationResource` schema block :1106-1108 |
| `.../050-schedule-accept.sqlinc` :8-9 | same for the 202 body; title `(12 members, DEC-191 supersededVersion)` [AC-142] | same |
| `.../095-retire.sqlinc` :42-46, :135-136 | expected 200 retire body gains `'supersededVersion', null`; key list and title as above [AC-087] | same; DEC-191 "null for retire" |
| `phase_02_slice_12_governed_retire_pattern/010-retire.sqlinc` :23 | expected pattern retire body gains `'supersededVersion', null` | same |
| `phase_02_slice_12_governed_reads/020-detail.sqlinc` :13-17 | detail key list gains `activationSchedule`; title `(29 members)` -> `(30 members, DEC-191 activationSchedule)` [AC-088] | DEC-191; BE03c `GovernedReviewDetailResource` schema block :1054-1068 |
No oracle was weakened: each stays an exact-set / exact-body equality; nothing was removed, relaxed or skipped.

## Spec citations
- DEC-191 (`.memory/wiki/decisions.md` end); BE03c changelog row :1727 ("FE03-BE03c read gap").
- BE03c `GovernedReviewDetailResource.activationSchedule` :1054-1068 (state enum of six, reasonCode enum of five + null); `GovernedActivationResource.supersededVersion`
  :1106-1108 (`z.number().int().positive().nullable()`).
- CMS-03C-09 ordered steps and the lineage lock order: BE03c :1345 and `Slice 12 lock order` (`v_active` locked at position 3; unchanged).
- `cms_governed_activation_schedules` table and its CHECKs (`reason_code` closed vocabulary, `(state in blocked, cancelled) = (reason_code is not null)`): BE03c :1473;
  migration `20261013300700_cms_governed_activation_schedules.sql` (CHECKs `..._reason_code_check`, `..._reason_state_check`).
  (The brief's :1437 and :1328 are the same sections at earlier line numbers; the spec has shifted since.)
- Scheduled activation, blocked reasons and ladder: BE03c :1347 (OD-6), CMS-03C-19.
- FE03 :882 (activation form: superseded version) and :1118 (blocked/cancelled schedule reason) are the requirements DEC-191 closes.
- DEC-188 (definition `version` is immutable; only `lifecycle_version` advances): why `supersededVersion` is `version`, not `lifecycle_version`
  (test `020-activation.sqlinc` pins 1 vs lifecycle 5).
- DEC-190 (retire active-only): the `retire` answer is built by the same producer; its `supersededVersion` is null.

## Open items / BOUNDARY
1. Blocked reason `canonical_source_unavailable` is not exercised: the registry of canonical providers is code-owned and no producer can unbuild a
   provider, so no real fixture reaches it (no hand-built row, no trigger toggle). The projection is the same `reason_code` column read for the other
   three blocked reasons and `retries_exhausted`. Recorded, not a stub.
2. The `created_at desc, id desc` tie-breakers of `cms_governed_review_schedule` cannot be discriminated inside a pgTAP transaction (every row has
   `created_at = now()` = transaction start; `id` is random). The deterministic term the suite proves is "live schedule first" (test with a blocked then
   a new pending schedule of one review). Across real transactions `created_at` decides; this is not testable here without forging time.
3. `retries_exhausted` (real 15 s / 60 s / 300 s ladder, about 7.5 min) lives in its own entry point, `phase_02_slice_12_dec191_exhausted.sql`,
   like the schedule ladder suite; it is run separately (Run 5: PASS, 13 tests incl. `{state blocked, reasonCode retries_exhausted}` and `failed_retryable` after three failures) and is not part of the 11-file regression run. It has no separate mutation run (its assertion is the same projection that mut1(b)/mut3(b) kill in the main file).
4. Phase 2 (contracts, Worker strict parsing, Web copy) not started: waiting for root's release after phase-1 review.

## Requests to root
- Promote `supabase/migrations-wip/dec191/*` after review (three files, timestamps 20261014170000/100/200).
- Run the canonical gates (`pnpm db:verify`); this lane never does.

## Phase 2
### Status
PHASE 2 GREEN (final 2026-10-15T13:42Z; started 12:17Z after the `## Phase 2 released` line). Contracts, Worker and Web carry both DEC-191 members.
No SQL or pgTAP touched. Gates (flock -s /tmp/wejammin-quiet.lock, pinned PATH, run 13:17:49-13:41:40Z on the bytes listed below, nothing edited after 13:17:49Z):
eslint --max-warnings=0 and prettier --check clean on all 30 touched TS/TSX files and the three READMEs; contracts `tsc --noEmit` exit 0; worker `tsc --noEmit` exit 0; `astro check` 1980 files, 0 errors;
Vitest contracts 175 files / 2120 tests, worker 673 files / 11972 tests, web 557 files / 6813 tests, all exit 0 (logs `<scratchpad>/claude_s12_dec191_p2/g-*.txt`).
`node infra/generate-openapi.mjs --check` FAILS by design of this change: `docs/openapi/openapi.json` is generated and tracked; the only drift is the two new members (diff reviewed, 3 hunks). See Requests to root 1.

### Design (mine; say only what DEC-191 says)
- `GovernedActivationResource.supersededVersion`: `z.number().int().positive().nullable()`, required key, refined to null unless `action === 'activate'` (DEC-191: "null for schedule and retire"). "Null for a first activation" is data-dependent, so no contract rule.
- `GovernedReviewDetailResource.activationSchedule`: `GovernedActivationScheduleSummarySchema.nullable()`, strict `{state (6), reasonCode (5 or null)}`, refined: reasonCode non-null exactly when state is blocked or cancelled (DEC-191, the table CHECK). New exports `GovernedActivationScheduleStateSchema`, `...ReasonSchema`, `...SummarySchema` and the type. I did not add the migration CHECK "cancelled implies approval_invalidated" to the contract (BE03c :1473 does not carry it; prose :1347 does): not DEC-191.
- Worker: no production change. `validGovernedActivation` / `validGovernedDetail` already parse the strict contract and relay the raw value, so a 200 or 202 without the member, with a wrong type, with a non-null `supersededVersion` on schedule/retire or a state/reason mismatch is the existing local 502 `DEPENDENCY_UNAVAILABLE` (`{dependencyClass: cms_composition, retryable: true}`). Binding rules unchanged. Web server (`boundGovernedActivation`, `boundGovernedDetail`, page loader) likewise.
- Web: result line "Activated, not published: Template X, version N is now the active version. Version M is now superseded." (FE03 :882); a first activation (null) says nothing about a superseded version; schedule and retire lines unchanged. The `BOUNDARY` wording "Any version that was active before it is now superseded." and its README sentence are gone. The review detail shows one line under the status: `<p data-cms-governed-activation-schedule>` "Scheduled activation: <state>." and, for blocked/cancelled, a fixed sentence per `reasonCode` (FE03 :1118): approval_invalidated "The review approval no longer applies."; dependency_changed "A dependency changed after the review approved it."; activation_authority_ended "The authority to activate it ended."; canonical_source_unavailable "A canonical source it depends on was unavailable."; retries_exhausted "It stopped after three failed attempts." Copy is fixed text keyed by the closed vocabularies (never the token), in `governed-review-labels.ts`; no schedule means no line.
- Browser drift guards (no zod in the island): `governed-activation-command-spec.ts` `asCommitted` repeats the member rule (positive safe integer or null, null unless activate; absent is rejected, so an unverifiable answer is an unknown outcome); `governed-review-canonical-read.ts` `scheduleSound` degrades the page for a schedule it cannot word (absent, wrong type, unknown state or reason, reason/state mismatch, extra member); drift tests compare browser and generated schema on the same candidates.

### Files (path, lines, SHA-256; read from disk 2026-10-15T13:41Z)
| path | lines | sha256 |
|---|---|---|
| `apps/web/src/components/cms-governed-review/CmsGovernedActivationForm.test.tsx` | 290 | 2ec2a1d82786d1605d404a0e12221911cd2be0f573244ba2efa24535d0e74825 |
| `apps/web/src/components/cms-governed-review/CmsGovernedReviewDetail.test.tsx` | 243 | 3c9871f76332b207aabc5e5659f35470d15efb8e87a4084457230116ecd2a436 |
| `apps/web/src/components/cms-governed-review/CmsGovernedReviewDetail.tsx` | 188 | 59e5986ee535e7e8cefa4ea3eb6661f08617a46f5f4fe4857aad68c8bcc84ded |
| `apps/web/src/components/cms-governed-review/CmsGovernedReviewDetailIsland.activation.test.tsx` | 334 | c8d1eb064031bb45c528f16498b2426aba98b95c3018cf2a20bef1be44afe941 |
| `apps/web/src/components/cms-governed-review/README.md` | 108 | 1ba3760463503fe065b8ea3b56a71adf152ff56b97c2ddd4efbed525bd1bf07f |
| `apps/web/src/components/cms-governed-review/governed-activation-command-spec.ts` | 160 | 3317af6a3330abb43d71f69f727d43fd1602ffe2d53e5cfcbdbb19f8d89e14b5 |
| `apps/web/src/components/cms-governed-review/governed-activation-command-superseded.test.ts` | 78 | 9e56feef56d960918710cafeb2d05d9066c4bc401671ff5d3aaeee7f73e1c0c1 |
| `apps/web/src/components/cms-governed-review/governed-activation-command-transport.test.ts` | 363 | b92365e8ec5007a69aa75e19b6a16861fc697cc02d967a538ee489316301acbd |
| `apps/web/src/components/cms-governed-review/governed-activation-contract-drift.test.ts` | 270 | 17d9a7d82c4999ae0d5c81e8811aef93575688ea1d8251521899687fa3433683 |
| `apps/web/src/components/cms-governed-review/governed-activation-model.test.ts` | 150 | 1c0f1ccd912a92a79303aeeff4712e4061c143a28a834b07802ea079bf76e78e |
| `apps/web/src/components/cms-governed-review/governed-activation-model.ts` | 299 | 5895cb45d6dedf6cac1e5a3f678edbbacb406198a94b1f48266dbd5387e866de |
| `apps/web/src/components/cms-governed-review/governed-activation-transport.test-support.ts` | 23 | 52b80196388beaf1834c9481b451c339903d0af7c7dd0376eee3748168566087 |
| `apps/web/src/components/cms-governed-review/governed-review-canonical-read.test.ts` | 156 | aa9e7a0b68f6e386db70613015b6241716088601cbea2949e7af0490ea4cba9c |
| `apps/web/src/components/cms-governed-review/governed-review-canonical-read.ts` | 142 | f680a3f53f04ea26d30decc11ee20c58f3215dea45e8dea432b709ecc8a90b9c |
| `apps/web/src/components/cms-governed-review/governed-review-labels.test.ts` | 132 | 2d499dc186f71abbdeb21bdec2a5c282a22e56f5702db84f818657674d0a3e12 |
| `apps/web/src/components/cms-governed-review/governed-review-labels.ts` | 143 | 6417c87cd827fb120a02471a50c185ec6edd2a95152ece16933c6a75f018cc9f |
| `apps/web/src/components/cms-governed-review/load-governed-detail-page.test.ts` | 123 | 3c2772d62c74c57466e5911235e1ec3f91b38002c40e4028ca44fe8aa0ee6220 |
| `apps/web/src/server/cms-governed-review-fixtures.test-support.ts` | 246 | 08b42b52307586f4f7201dbda88ca4a0819a8b40da4622aab34d3ccb2a65ce33 |
| `apps/web/src/server/cms-governed-review-platform-activation.test.ts` | 375 | 63f3f879bb67e494ab643468741daa48dfb68b452a3e620c1c123ee53b4cf0dc |
| `apps/web/src/server/cms-governed-review-platform-reads-schedule.test.ts` | 71 | 55a320e1fc81f4320631eef9d1f3e53a2b9d1c250246e122f057625ee0df20dc |
| `apps/web/src/server/cms-governed-review-platform-reads.test.ts` | 367 | 04547308ae8d9b3a580e839996dd9c02e399c2fced1248a5b8e090169ee00eef |
| `apps/worker/src/cms-composition/README.md` | 170 | de8249c043e4a644f7e6e35e4a52c5c6f75ec24a4c418f501c0169517d6f53be |
| `apps/worker/src/cms-composition/governed-activation-superseded.test.ts` | 123 | a5442c8827fefa8a45e95cad33e66fcf3ccda193a364f434c5812e5b29ad3d8a |
| `apps/worker/src/cms-composition/governed-activation.test-support.ts` | 199 | c39dffae1fb50347a95606b023d7248f7c62dd51861f9830ab8e465262b73ca1 |
| `apps/worker/src/cms-composition/governed-review-ops.test-support.ts` | 297 | dd4ea784b8bc9fbc422dd6e5a7fc22f8ce62b1d17059c54bf4a3c7560bfb1b1b |
| `apps/worker/src/cms-composition/governed-review-reads-schedule.test.ts` | 109 | 4b667ac2ea2ec205138af35cab8451527918bcc9ffc57bc535a9e4e9b16d0686 |
| `packages/contracts/src/cms-composition/README.md` | 100 | 261d0e4edc774f8b55132b0f4c35a50b94656f6e8e24404be5121382f24713d2 |
| `packages/contracts/src/cms-composition/governed-activation.test.ts` | 343 | fd4a6e20838737b6c7cc044371dfd2ee07ad657594e8c1e8b0a750f2e6097fea |
| `packages/contracts/src/cms-composition/governed-activation.ts` | 185 | e13405f9b4e81475760a5ccc264d62e406cbb603d0a78327c27930d88dbefcfb |
| `packages/contracts/src/cms-composition/governed-review-read-schedule.test.ts` | 104 | 73b3921b80380e241b29447e3f50555ed97b1f6f1575b5cf5cdf780931314f21 |
| `packages/contracts/src/cms-composition/governed-review-read.test-support.ts` | 59 | 06fa8d36f5024d5cf13d79732b6461a872c21ecda876338daba0c8a24d60e834 |
| `packages/contracts/src/cms-composition/governed-review-read.test.ts` | 304 | 8201637aa798bad929a71b3091b53945ef0b6b8b6c2248bb581f1946b1ff62ea |
| `packages/contracts/src/cms-composition/governed-review-read.ts` | 293 | 65d54e620af9568ff6a44b57ea3324a9abe4c82101d841c451fb1d38279475a5 |

New files: `governed-activation-superseded.test.ts`, `governed-review-reads-schedule.test.ts` (worker), `governed-review-read-schedule.test.ts`, `governed-review-read.test-support.ts` (contracts; fixtures extracted from `governed-review-read.test.ts` to keep it at 304 lines), `cms-governed-review-platform-reads-schedule.test.ts`, `governed-activation-command-superseded.test.ts`, `governed-activation-transport.test-support.ts` (the `send`/`ok` helpers moved out of `governed-activation-command-transport.test.ts`, now 363 lines). All other listed files are edits. Limits: components <= 200 (Detail 188), libs <= 300 (model 299), tests <= 400 (largest edited test 363; `governed-activation-command-superseded`, `...schedule` files 78 to 109).
Scope notes: files outside the brief's literal directories were edited because the contract change breaks their fixtures: worker `governed-activation.test-support.ts`, `governed-review-ops.test-support.ts`; web `apps/web/src/server/cms-governed-review-fixtures.test-support.ts`, `cms-governed-review-platform-activation.test.ts`, `cms-governed-review-platform-reads*.test.ts`; three READMEs (contracts, worker, components).

### Runs
| # | time (UTC) | what | result |
|---|---|---|---|
| 1 | 12:18 | contracts RED: `governed-activation.test.ts` + `governed-review-read.test.ts` (new fixtures with the members, new tests) | 15 failed / 26: strict objects refused the new keys, missing-member tests; genuine missing feature (`red-contracts.txt`) |
| 2 | 12:18 | contracts GREEN same files | 26 / 26 (`green-contracts.txt`) |
| 3 | 12:19 | contracts full | 174 files, 2120 tests, exit 0 |
| 4 | 12:19-12:21 | worker `cms-composition` after the contract change, fixtures not yet updated | many failures: every fixture `Schema.parse` refuses/lacks the members; HARNESS (fixtures), not feature (`worker-after-contract.txt`) |
| 5 | 12:22 | worker new tests against the PRE-change contract (HEAD copy in a scratch mirror aliased by `vitest.pre.config.ts`) | 23 failed + 1 file failed: fixtures cannot be built, so this RED is the contract RED seen through the Worker, not an independent Worker feature RED. The Worker has no parser of its own to fail (`red-worker.txt`) |
| 6 | 12:22 | worker new tests, current contract | 35 / 35 (`green-worker-new.txt`) |
| 7 | 12:24-12:25 | web after the contract change, fixtures not updated | 108 failed / 20 files (fixtures; `web-after-contract.txt`); after the three web fixture edits 1 failed: `cms-governed-review-platform-activation.test.ts` used `supersededVersion: 1` as its example of an unknown member (see Test corrections) |
| 8 | 12:27 | web components RED (new tests, old production code) | 56 failed / 433 in 8 files, all genuine missing feature: no sentence/tables/render/guard (`red-web.txt`) |
| 9 | 12:29 | web components GREEN | 29 files, 433 / 433 |
| 10 | 13:17-13:41 | FINAL gates on final bytes (above) | all exit 0 |
An earlier full web run (13:14:43Z) failed 11 tests in `cms-editorial/cms-editorial-read-retry.test.ts` and `cms-editorial-workflow/CmsWorkflowCommandFrame.test.tsx`: other lanes' files edited at 09:09-09:10 local during that run; both pass on rerun (54 / 54) and in the final full run (557 / 557).

### Mutation evidence (scratch mirrors only: `<scratchpad>/claude_s12_dec191_p2/{mirror,webmirror}`; the worktree was never mutated)
Contract mutants (scripts `mutate_worker.py`, `mutate_contract.py`, `mutate_webserver.py`, outputs `mut-worker-*`, `mut-contract-*`, `mut-webserver-*`), same 8 mutants against three suites, 24 / 24 killed:
m1 supersededVersion optional; m2 schedule/retire may name a version; m3 non-positive allowed; m4 activationSchedule optional; m5 reason/state relation dropped; m6 reasonCode vocabulary open; m7 state vocabulary open; m8 summary not strict.
Killed by: contract tests (2, 1, 1, 1, 1, 1, 1, 1 tests), Worker new tests (1, 2, 2, 1, 3, 1, 1, 1), Web server tests (1, 1, 1, 2, 3, 1, 1, 1).
Web production mutants (`mutate_web.py`, `mut-web-*`), 18 / 18 killed over the whole `components/cms-governed-review` directory:
w1 member rule always true (18); w2 schedule/retire may name (4); w3 non-positive (4); w4 fraction (2); w5 committed drops the number (6); w6 no superseded sentence (6); w7 off-by-one version (6); w8 schedule sentence drops the reason (8); w9 two reasons share a sentence (4); w10 token leaks into copy (2); w11 label ignores the number (5); w12 detail never renders the line (12); w13 detail renders blocked only (6); w14 canonical read accepts any schedule (8); w15 closed relation dropped (2); w16 extra member allowed (SURVIVED at first; killed by 1 after adding the "member beyond state and reasonCode" row); w17 state vocabulary open (1); w18 reason vocabulary open (1). (First w1 attempt was a syntax error counted as a kill; rerun with valid syntax: 18.)

### Test corrections
- `apps/web/src/server/cms-governed-review-platform-activation.test.ts` "refuses an answer that is not the strict resource": the unknown-extra-member probe `{...fixture, supersededVersion: 1}` now is `{...fixture, unknownMember: 1}`, because `supersededVersion` is now a real, valid member (DEC-191). The assertion (502, outcome unknown) is unchanged; two new tests cover the member.
- `CmsGovernedActivationForm.test.tsx` and `CmsGovernedReviewDetailIsland.activation.test.tsx`: the sentinel sentence "Any version that was active before it is now superseded." became "Version 1 is now superseded." (the fixture supersedes version 1); DEC-191 / FE03 :882. Two new form tests cover a first activation and a larger number.
- Fixtures: `activationSchedule: null` and `supersededVersion` defaults (1 for an activation, null for schedule and retire) added to the shared governed fixtures (worker and web). Existing tests that deep-equal a fixture are unchanged.

### Spec citations
DEC-191 (`.memory/wiki/decisions.md` end); BE03c schema blocks :1054-1068 (`activationSchedule`), :1106-1108 (`supersededVersion`), changelog :1727; BE03c :1347 (blocked/cancelled reasons, ladder), :1473 (table, CHECK `(state IN (blocked, cancelled)) = (reason_code IS NOT NULL)`); FE03 :882 (activation form row: the 200 renders the activated and the superseded version; blocked and cancelled schedules show their closed reason), :1118 (heading focus on the result); phase 1 report for the exact SQL shapes.

### Open items / BOUNDARY
BOUNDARY items 1 and 2 of `lane-web-activation-report.md` are CLOSED: the superseded number is printed and blocked/cancelled schedules show their fixed reason sentence. Remaining:
1. Reason copy and the other four state lines are my wording (implementation tier); the contract fixes the vocabulary, not the sentences. Root or owner may reword; each change is one table row plus its test.
2. Blocked reason `canonical_source_unavailable` has copy and tests but no real SQL fixture (phase 1 Open item 1).
3. No browser run (no local stack): the new schedule line and the "Version N is now superseded" sentence need a Playwright check in the later E2E lane.
4. The schedule line is not a live region (the surrounding status line is polite); it appears with the next verified read after a command, like the rest of the detail.
5. Process incident: I ran `pkill -f "vitest run apps/web"` once to stop my own run. It exited 144 and I could not prove it signalled no other lane's process with the same command line (the processes I saw afterwards were all alive). If another lane's `vitest run apps/web` died around 13:16Z, that was me. I killed my own later background jobs by PID.

### Requests to root
1. Regenerate the tracked OpenAPI artifact: `pnpm contracts:generate` (updates `docs/openapi/openapi.json`: `supersededVersion` in `GovernedActivationResource` and its required list, `activationSchedule` in `GovernedReviewDetailResource` and its required list; I diffed the generator output against the file, nothing else differs). `contracts:check` fails until then. Outside this lane's claim.
2. Promote phase 1 SQL (unchanged request) before or with this phase: the Worker and Web now REQUIRE both members, so a database without the phase 1 migrations answers 502 on CMS-03C-09 activation 200 and on CMS-03C-10.
3. Confirm the extra files edited outside the brief's literal directories (list above).

## Fix pass 1
### Status
FIX PASS 1 GREEN (final 2026-10-15T13:48Z). SQL tests only plus report/comment accuracy. No change to any migration body, contract, Worker or Web file. F2 closed by a new 18-test
suite that passes on the WIP and is killed by two scratch mutants; F3 corrected; F4 done as a header-comment-only edit (proved executable-byte-neutral). F1 is a promotion-order
note for root (already in Requests to root 2 of phase 2; restated below).

### F2: the "previously ACTIVE version" semantic (new tests)
New entry `supabase/tests/phase_02_slice_12_dec191_lineage.sql` (own entry so the 53-test main file stays untouched; no real wait, about 35 s) + fragment `080-lineage.sqlinc`.
Real fixtures only (real grants, real approved reviews, real CMS-03C-09 activate and retire through `platform_api`; no hand-built governed row, no trigger toggle).
- lineage `sa`: v1 activated; v2 minted and submitted but never activated (subject state `review`); v3 approved and activated -> `supersededVersion` = 1 with `subjectVersion` 3
  (tests 11-13: fixture shape, member = 1 as a JSON number, member is not "previous definition number" 2 and equals the definition version of the row that became `superseded`, v2 still `review`).
- lineage `sb`: v1 activated then retired (no active version); v2 approved and activated -> `supersededVersion` null with `subjectVersion` 2 (tests 14-16); v3 activated over the active v2 ->
  2, not the retired 1; only v2 became `superseded`, v1 stays `retired` (tests 17-18). Tests 1-9 are the governed-b world fixtures (9 as in the exhausted entry); plan(18).
No oracle was changed. A first run (below, run F1-1) failed two of my own new assertions: harness-class expectation error in the new test (a submitted subject is `review`, an approved one is `approved`; I had written `draft`); corrected before any other run.

### Fix pass 1 runs (stamps from the runner; TAPs under `.lane-logs/`)
| # | time (UTC) | stamp | lane migrations | file | result | failing | TAP SHA-256 |
|---|---|---|---|---|---|---|---|
| F1-1 | 13:44:42-13:45:18 | 094442-1602014 | dec191 (3, pre-edit bytes) | dec191_lineage | FAIL 2 of 18 | 11, 13 (my expectation: `draft` instead of `review`/`approved`): HARNESS (test expectation), not feature | 6cb567b99070224a9e38504cf87cd08e4c682c18f0fe273dd55ea8746b147333 |
| F1-2 | 13:45:52-13:46:28 | 094552-1609759 | dec191 (3, final bytes) | dec191_lineage | PASS, 18 tests, 0 not ok | none | 8e258713d66b24ee122c68ad3d3f600f97c884277d8788390b82b926cdfd5bad |
| F1-3 | 13:46:34-13:47:20 | 094634-1614839 | dec191fp1a (mutant A) | dec191_lineage | FAIL as intended: 2 of 18 | 12, 13 | f66f61b8324a1b6d8fcb6e4cf08fa0cf8b6a2c81d5599e59eb7d1b02a00e530e |
| F1-4 | 13:47:20-13:48:15 | 094720-1619932 | dec191fp1b (mutant B) | dec191_lineage | FAIL as intended: 1 of 18 | 15 | de4d73bbfd58fdb95c678b6c89c6245627c48c8a60434cd484f15253e690075e |
Manifests of F1-2..F1-4 say `promoted=457 wip=3` (root promoted more migrations since; none touch the two patched producers per the phase 1 grep, not re-run here). F1-1 and F1-2 differ only by the test expectations and the header-comment edit of `170000` (F4).

Mutants (scratch copies `<scratchpad>/claude_s12_dec191_f1/muta|mutb/`, staged as lanes `dec191fp1a`, `dec191fp1b` from `supabase/migrations-wip/`, directories deleted after the runs: `ls supabase/migrations-wip | grep dec191` shows only `dec191`). Each differs from the WIP `170100` in exactly line 27:
- A "previous definition number": `case when cms_governed_definition_version(subject_kind, v_active) is not null then v_review.subject_version - 1 end` (the reviewer's survivor of finding F2). Killed by 12 (v3 over a never-activated v2 must name 1) and 13.
  It survives the main file by construction (every lineage there activates N-1), so these two tests are what separates it.
- B "non-null after retire": `nullif(coalesce(cms_governed_definition_version(subject_kind, v_active), v_review.subject_version - 1), 0)`: names the previous number whenever nothing is active, null only for a first activation. Killed by 15 alone (v2 activated after v1 was retired must answer null).
Tests 16-18 and the fixtures pass under both mutants, as they should: they pin the lineage states, not the member.

### F3 (report accuracy)
Corrected in "Runs" of phase 1: runs 1-8 (including mutation runs 6-8) have `promoted=454`; only runs 9-11 have `promoted=456`. Re-read all eleven manifests to confirm.

### F4 (helper migration comments)
`supabase/migrations-wip/dec191/20261014170000_cms_governed_read_gap_helpers.sql` lines 9-10 cited "BE03c 1437; vocabulary 1328"; both are now the one section :1473 (`cms_governed_activation_schedules`, table CHECKs and vocabulary together). Changed to
"(BE03c 1473; the closed vocabulary is the same table's CHECK)". Only whole-line `--` comment lines differ (`diff` shows lines 9-10 only); the file with `--` comment lines stripped hashes identical
before and after (`62f0e3a1de35126023fa0578ab403ed7434cc437c469091eea66f6e298ad7b70`); the citation is not inside any `comment on` string. The file SHA-256 changes, so root must promote THESE bytes (updated Files table below). The two other migrations are byte-identical (hashes unchanged).

### F1 (promotion coupling, restated for root)
Promote `dec191/*` in the same integration step as the phase 2 contracts + Worker + Web (never alone, never one side first): the frozen resources are strict, so either order fails CMS-03C-09 200/202 and CMS-03C-10 200 at runtime and no DB gate notices. Note it in CLAUDE-STATE.

### Files after fix pass 1 (read from disk 2026-10-15T13:48Z)
| path | lines | sha256 |
|---|---|---|
| `supabase/migrations-wip/dec191/20261014170000_cms_governed_read_gap_helpers.sql` (comment-only edit, replaces the phase 1 hash) | 80 | 65311023ef12fa90b2a509aaf42fcbbfaacde5cfeba0394bc2a7cf13eff51ff3 |
| `supabase/migrations-wip/dec191/20261014170100_cms_governed_activation_superseded_version.sql` (unchanged) | 81 | 62acc35f8eb92941f2cca6582442681eea1f8317f0412857e1488136bc136254 |
| `supabase/migrations-wip/dec191/20261014170200_cms_get_governed_review_activation_schedule.sql` (unchanged) | 64 | 65d34a6ee34ab4553eb69797e58bb96795b575fc06ffc3db84f7181efce6f6d7 |
| `supabase/tests/phase_02_slice_12_dec191_lineage.sql` (new) | 31 | 933ec0f6c4714051359c3f75c628640d098a6d18dbd442d691b0be643ef2e964 |
| `supabase/tests/phase_02_slice_12_dec191/080-lineage.sqlinc` (new) | 68 | 62c63083e92b4406a4fa6c912c58cdb3f4d38e9e9c0a0c73d92fcf3321508246 |
| `supabase/tests/phase_02_slice_12_dec191/README.md` (two table rows added) | 33 | e8b2d99e3ce84626e110f5484c1cbd3582e32b0539d0ee664f022df7f9e42e20 |

### Test corrections
None (no existing oracle touched in this pass).

### Open items / BOUNDARY
- The phase 1 main file, pattern file and the 11-file regression set were not rerun: the only executable-byte change since run 3 is none (comment-only edit, proof above) and the new file is its own entry. A final canonical gate is root's.
- Phase 1 Open items 1-3 unchanged.

### Requests to root
- Promote the three `dec191` migrations (hash above for `170000`) together with phase 2, as one step (F1).
- Run the canonical gates; this lane never does.

## Phase 2 fix pass
Status: GREEN. Source: `review-dec191-p2.md` A1, A2. Times from `date -u`, 2026-10-15. Scratch: `/tmp/claude-1000/-home-rob-Projects-WeJammin/5e403708-915a-4cd3-958f-4ebc866d0c82/scratchpad/claude_s12_dec191_p2f/`.

### Scope and changes
- A1 (copy). `governed-review-labels.ts:130` `retries_exhausted` read "It stopped after three failed attempts."; the producer blocks at the fourth consecutive failure (`20261014070100_cms_governed_schedule_state.sql:38-41`), so the sentence was false. Now "It stopped after its retries ran out." (number-free, Slice 11 style). The pinned row `CmsGovernedReviewDetail.test.tsx:203` was changed first.
- A2 (vocabulary). `governed-review-read.ts`: `GovernedActivationScheduleReasonSchema = z.enum(CMS_GOVERNED_SCHEDULE_BLOCK_REASONS)` with the import from `./governed-activation-job.ts` (that module imports only primitives and `governed-review.ts`, so no cycle). The five values are no longer repeated; the member order and values are identical, so no contract test changed.
- No other file touched.

### Runs
| # | Time (UTC) | Run | Result |
|---|---|---|---|
| 1 | 13:54:10-13:54:16 | RED: Web `CmsGovernedReviewDetail.test.tsx` with the new expected row, labels unchanged (`red-web.txt`) | 1 failed, 22 passed; the failure is "shows a blocked schedule with its closed reason retries_exhausted as fixed copy" (AssertionError, copy absent): right reason |
| 2 | 13:54:25-13:55:59 | GREEN focused vitest, 71 files: contracts `governed-activation*`, `governed-review-read*`, `core-contracts`; Worker `cms-composition/governed-*`; Web `components/cms-governed-review`, `server/cms-governed-review*`, `pages/api/v1/cms/governed-reviews`, `cms-island-static-closure` (`green-vitest.txt`) | 71 files, 1586/1586 pass, exit 0 |
| 3 | 13:56-13:57 | contracts `tsc --noEmit` | exit 0 |
| 4 | 13:56-13:57 | `node infra/generate-openapi.mjs --check` | exit 0 (no OpenAPI change, as expected) |
| 5 | 13:56-13:57 | `astro check` (apps/web, 1995 files) | 1 error, none in a target file: `cms-related-content/CmsRelatedContentForm.readonly.test.tsx:114` (TS2339), another lane's untracked file (same file the review's Runs addendum names). Only deprecation warnings elsewhere |
| 6 | 13:57:20-13:57:22 | eslint `--max-warnings=0` + prettier `--check` on the three touched files | both exit 0 |

All under `flock -s /tmp/wejammin-quiet.lock` with the pinned PATH. A first lint/prettier attempt passed the file list as one unsplit zsh variable (harness error, no result); rerun with explicit paths is run 6.

### Files
| Path | Lines | SHA-256 |
|---|---|---|
| apps/web/src/components/cms-governed-review/governed-review-labels.ts | 143 | f63b96fa40a7e1b25e247b95fbf827f32977cb2ab228939d4e9b7f462bf3197f |
| apps/web/src/components/cms-governed-review/CmsGovernedReviewDetail.test.tsx | 243 | f02152e1f0e4c73410f596d43171c825f16eb33949165f486564da1750be4b7d |
| packages/contracts/src/cms-composition/governed-review-read.ts | 290 | 4967ed37614064fd86304bf53f87b14f2eb6c90a6eef8ff0388815b741a41c21 |

### Test corrections
`CmsGovernedReviewDetail.test.tsx:203`: `'It stopped after three failed attempts.'` -> `'It stopped after its retries ran out.'`. Cites the producer rule above (fourth consecutive failure blocks); the oracle pinned a false fact, the assertion still checks fixed per-reason copy.

### Open items / Requests to root
- A3 (cascade DEC-191 into AC-082/AC-088 and the evidence ledger) and A4 (optional browser-vs-zod comparison) were not in this pass.
- Promote SQL + phase 2 as one step (unchanged from Phase 2 requests).
