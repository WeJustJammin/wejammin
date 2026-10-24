# Review: lane claude_s12_dec191 phase 1 (SQL + pgTAP), DEC-191 read gap

Reviewer: independent, read-only (no DB, docker or runner). Date 2026-10-15. Template `briefs/review-template.md`, rules `lane-rules.md`.

## Verified claims
- Hashes equal the target: report `c23298ad…`, WIP `170000` `befa4cc1…`, `170100` `62acc35f…`, `170200` `65d34a6e…`; all 14 new test files and
  the 5 edited oracle files match the report's table. Line counts 80/81/64 (all files ≤300). No TODO/FIXME; no direct governed INSERT/UPDATE
  and no trigger toggle in any dec191 test file.
- All 11 run artifacts re-hashed equal to the report. Re-parsed TAP: run 1 RED 28+4 `not ok` (main 13-50, pattern 61/63/71/74); run 2 PASS 115;
  run 3 PASS `Files=11, Tests=966`, 0 `not ok`, 0 skip/todo; run 4 RED 11,13; run 5 PASS 13; mut1 kills 14-18,26,30,37,40,42,44 + pattern 62;
  mut2 13-18,25,26,38,50; mut3 19,21,29,30,32,33,35,37,38,40,42,44,50; mut5 47,48,49; mut4 reset log shows `patch anchor 2 occurs 0 times
  (SQLSTATE 55000)`; twice-run manifest stages the same three hashes at `170000/100/200` and `170400/410/420`, PASS 53. All as reported.
- Run-3 bytes: manifest WIP hashes equal disk; every dec191 test file and the 5 oracle files predate the manifest (latest 05:04:43 local);
  the newer files under `supabase/tests/` (pattern_updates*, pattern_update_diff, pattern_selector) are not reachable from any of the 11 entry
  files (grep of the entry files and their fragment dirs: no match). Reconstruction holds.

## Spec conformance (DEC-191; BE03c :1054-1068, :1106-1108, :1345, :1347, :1473)
| clause | implemented | tested |
|---|---|---|
| activate: definition `version` of the lineage's previously active row | 170100:27 via helper 170000:18-42 on `v_active` (locked pos. 3 by `cms_governed_lock_lineage_active`, re-read equal under the advisory lock, then superseded by `cms_governed_supersede_lineage` in `apply_activation`, 070200:118) | 020:18-29 (1, not lifecycle 5), :36-39 (2), 030:48-57 (taxonomy), 060:38-45 (pattern) |
| null for first activation | helper returns NULL for NULL `v_active` | 020:7-12, 030:41-46, 060:4-8 |
| null for schedule / retire | 170100:29-32 literals | 020:56-62 (lineage has an active version), :68-73; oracles 050-schedule-accept, 095-retire, retire_pattern 010 |
| replay returns stored answer | unchanged reservation path (070400:91-97) | 020:40-51, :63-65, :74-76 |
| detail: review's most recent schedule `{state, reasonCode}` or null | 170200:18 via helper 170000:44-57 | null 040:11-18; pending :29; cancelled :33; executing :46; completed :52; failed_retryable :61; blocked x3 :70/:88/:101; retries_exhausted exhausted 070:35; most recent :74-81 |
| reasonCode non-null iff blocked/cancelled | stored column; table CHECK `((state in blocked,cancelled) = (reason_code is not null))` | 040:109-115 (10 bodies, all 6 states) |
| one snapshot, no lock, no write | helper STABLE; inside the one document statement | 050:19-26, :33-37; 040:104-106 (read wrote nothing) |
| exact member sets | — | 040:19-24 (30), activation key list 000:58-59 (12), five additive oracle edits |
Nothing beyond DEC-191: no new member, state, vocabulary, authority, lock position or write path. `canonical_source_unavailable` is not
reachable through producers (registry code-owned); projection is the same column. Accepted as recorded (report Open item 1).

## "Most recent" ordering: reasonable reading, not a deviation
`order by (state in live) desc, created_at desc, id desc limit 1` (170000:54-56). "Live first" never contradicts insertion order:
(a) BE03c :1473 allows one live row per subject (partial UNIQUE); (b) no producer moves a row out of `completed`/`blocked`/`cancelled`
(claim takes only `pending`/`failed_retryable`, 070500:72-73; the other writers set only failed_retryable/blocked/completed/cancelled,
070100:41,50,88, 070600:199, 070000:189). So a live row is always the last-inserted row of its review; live-first only breaks ties of
`created_at = now()` (transaction start; same-transaction rows tie) in the causal direction. Among terminal rows `created_at desc` is sound:
a later schedule of the same review needs the earlier one terminal while the review stays `approved`, i.e. executed and blocked (≥60 s
horizon), far beyond the route deadline, so its transaction cannot have started earlier. `id` makes the order total, hence deterministic.
Same idiom as the existing assignment ordering of this read (010300:118 `state='active' desc, created_at desc, id desc`). Tie-breakers are
not separately killable in one pgTAP transaction (report Open item 2): accepted.

## Security
- `activationSchedule` to every reader with review read scope is correct. BE03c CMS-03C-10 (:172, :393, :1507) restricts only decision
  `reason` (decider) and `assignments` (owner); DEC-191 forbids new authority. The member is closed vocabulary only (no `created_by`, person,
  party or grant id); the same class is already shown to all readers via `subjectState` and `invalidatedReason`. 040:104 proves an assignee
  sees the owner's value.
- Helpers: private, SECURITY DEFINER, `search_path=''`, owned by `wejammin_cms_definer`, revoked from public/anon/authenticated/service_role
  (050:11-18; mut5(c) killed); consistent with p240 AC-182 (no private cms_ fn executable by API roles). Table grants are restatements:
  070000:208-214 already grants select, update on the three version tables and the schedules table. Called only after the detail read's
  concealment/scope checks and inside the activation producer's own locks.
- Anchored patches: 3 + 1 exactly-once anchors (refusal witnessed by mut4); idempotency by marker count 0/3 and 0/1, partial refused (55000),
  witnessed by the twice run; `to_jsonb(pg_proc) - 'prosrc'` before/after covers owner, ACL, prosecdef, provolatile, proconfig, cost, parallel,
  argnames. Detail CREATE omits volatility: live function is default VOLATILE (010300:17-20), so equal; a mismatch would raise. Restated
  comments differ from the promoted ones only by one inserted DEC-191 sentence (activate) and one inserted clause (detail) (diffed).

## Findings
1. `docs/handoffs/2026-10-14-claude-s12/lane-dec191-report.md:169` — major (integration ordering; no SQL change) — "Promote … after review"
   without the coupling to phase 2. The frozen resources are `strictObject` and are `safeParse`d at runtime by the Worker
   (`apps/worker/src/cms-composition/governed-review-validate.ts:107,133`) and Web (`apps/web/src/server/cms-governed-review-binding.ts:103`,
   `apps/web/src/components/cms-governed-review/load-governed-detail-page.ts:63`). With old contracts, the new SQL's unknown key fails every
   CMS-03C-09 200/202 and CMS-03C-10 200; with phase 2's contracts (being edited now: `governed-activation.ts:122` `supersededVersion`
   required-nullable, `governed-review-read.ts:142`), the old SQL fails them the other way. Neither DB gate (`db:verify`) nor mocked Worker
   tests would notice. — Fix: promote `dec191/*` in the same integration step as phase 2 contracts + Worker + Web, never alone; note it in
   CLAUDE-STATE.
2. `supabase/tests/phase_02_slice_12_dec191/020-activation.sqlinc:15-39`, `030-taxonomy.sqlinc:48-57`, `060-pattern.sqlinc:38-45` — minor
   (test gap on the defining semantic) — every successor supersedes version N-1, so no behavioural test separates "previously ACTIVE version"
   from "previous definition number". A mutant `case when cms_governed_definition_version(kind, v_active) is not null then
   v_review.subject_version - 1 end` survives all assertions, including the source-text check 050:27-32. The header claim
   `170100:7` ("NULL … a lineage whose only earlier version was retired") is also untested. — Fix: add (a) v1 active, v2 drafted/left
   unactivated, v3 activated -> `supersededVersion` 1 with `subjectVersion` 3; (b) retire the active version, then activate a successor -> null.
3. `lane-dec191-report.md:111` — minor (report accuracy) — "Runs 6-11 … manifests say promoted=456": runs 6-8 (mut1/mut2/mut3) manifests say
   `promoted=454`; only runs 9-11 say 456. No effect on validity (the two extra migrations do not touch either producer; grep confirms).
4. `20261014170000_cms_governed_read_gap_helpers.sql:9-10` — nit — cites BE03c 1437/1328; the sections are now :1473/:1347 (the report
   notes the shift). Comment becomes immutable on promotion; fix before promotion if convenient.
Notes (no finding): `_pattern.sql` uses `no_plan()` (precedent: pattern_definition) and so absorbed the 74 -> 62 count drop silently; the lane
explained it by title diff. The function-level policy-evidence fault and the direct call of the private invalidation helper are existing,
labelled fixtures of `governed_activation/000-world.sqlinc:225-250`, not forging. The global SEC-2 catalog suites
(`phase_02_slice_09_sec2_*`, `phase_02_slice_09_p240_authority.sql`) were not in run 3; by reading they hold (no new grants, helpers revoked),
root's canonical gate must confirm.

## Summary
SQL is correct, minimal and DEC-191-exact; anchors, attribute preservation and idempotency are sound and witnessed; tests are real-fixture,
non-vacuous for five mutants, oracle edits additive. PARTIAL only because promotion must be coupled with phase 2 (F1); F2 is a cheap test
addition recommended before promotion; F3/F4 are accuracy fixes.

VERDICT: PARTIAL
