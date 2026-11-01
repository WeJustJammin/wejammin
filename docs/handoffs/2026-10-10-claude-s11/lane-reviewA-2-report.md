# Lane reviewA-2 report (2026-10-11)

Items of `review-a-ledger-refutation.md`: A-M3 (vacuous "left nothing behind" pgTAP checks), A-M9 (no latency measurement for
CMS-03B-15/16/17), A-M12 (AC-082 job deadline), A-M15 (retain input), and the stale-citation list (A-m1 and the rest).
Worktree `/home/rob/.codex/worktrees/phase2-slice11/WeJammin`, branch `claude/phase2-slice11`, HEAD `0fd4bf31` (the lane started at
`dd1ee1ce`; the orchestrator has since committed the production sweep change in `b001ff2d`). I ran no
`git add/commit/stash/checkout/reset/restore`. Two earlier agents of this lane died at usage limits (snapshots
`refs/backup/s11-claude-wip-3` and `-4`); the work was inspected, completed and re-verified at HEAD `0fd4bf31`, not restarted. Logs and the two runner variants I
used are in `docs/handoffs/2026-10-10-claude-s11/lane-reviewA-2-logs/` (see its `README.md`).

## State found and what was wrong

Reviewer B-1 saw eight Slice 11 pgTAP files fail only because of this lane. Confirmed in `red-run1.out`: the six refusal suites
ended on a deliberate placeholder (`want: REPORT_ASSIGN`, `REPORT_SUBMIT`, `REPORT_SCHEDULE`, `REPORT_PUBLISH`, `REPORT_MINT`,
`raised=COUNT`), `phase_02_slice_11_effect_oracle.sql` had a wrong plan (planned 9, ran 18: its three included worlds emit nine
assertions) and `phase_02_slice_11_reads_bench128.sql` aborted in its fixtures (below). Everything else already passed.

## Files changed

pgTAP harness (item 1):
- `supabase/tests/phase_02_slice_11_rpc_review/000-world.sqlinc`: `r11_probe.changed`; `r11_try` digests the fourteen durable
  tables BEFORE and AFTER each call inside the call's own transaction and before the sentinel (when a watch is armed);
  `r11_watch`, `r11_changed`, `r11_effect_report`, `r11_no_effect` (previous agent) and `r11_effect_verdict` (this session).
- Six refusal suites, final assertion only: `phase_02_slice_11_rpc_review_assign_refusals.sql`,
  `..._decision_refusals.sql`, `..._submit_refusals.sql`, `phase_02_slice_11_rpc_publication_schedule_refusals.sql`,
  `..._publish_refusals.sql`, `phase_02_slice_11_rpc_preview_mint_refusals.sql`. `assign_refusals` is shared with reviewA-1
  (its A-B1 lapsed-grant case and plan 23 -> 24 are theirs; I added one control and the plan is now 25).
- `phase_02_slice_11_criteria_decision_order.sql`, `..._criteria_publish_gates.sql` (arm the watch, assert the report),
  `phase_02_slice_11_rpc_publication_claim.sql`, `..._execute.sql` (the batch / fence "changes nothing" assertions).
- New `supabase/tests/phase_02_slice_11_effect_oracle.sql` (23 assertions, 9 from the worlds): proves the observation is not blind.
- READMEs: `supabase/tests/phase_02_slice_11_rpc_review/README.md`, `supabase/tests/phase_02_slice_11_criteria/README.md`.

Read benchmark (item 2): new `supabase/tests/phase_02_slice_11_reads_bench128.sql`,
`supabase/tests/phase_02_slice_11_reads_bench128/000-world.sqlinc`, `.../README.md`; row added to
`supabase/tests/phase_02_slice_11_rpc_reads/README.md`.

Sweep job deadline (item 3): `apps/worker/src/cms-publication-schedule-sweep-deadline.test.ts`; production
`apps/worker/src/cms-publication-schedule-sweep.ts` (the one job `AbortController`, `claimOrRetry`, the unstarted-count error).
That file also carries reviewB-2's `executeWithFreshEvidence` wiring; I did not touch its files
(`cms-publication-schedule-sweep-evidence*.ts`, `...-stale-evidence.test.ts`) or the error-code mapping.

Retain input (item 4): new `apps/web/src/components/cms-editorial-workflow/cms-workflow-input-retention.test.tsx` (6),
`...-time.test.tsx` (5), `cms-workflow-input-retention.test-support.ts`; retitled test in
`cms-workflow-command-controller.test.ts`; section added to `apps/web/src/components/cms-editorial-workflow/README.md`.

No ledger file was edited.

## 1. A-M3: "refusal left nothing behind" observed inside the call (AC-006/009/010/012/015/016/018/022/024/027/028/030/033/034 and more)

Why it was vacuous: the probes run with `p_keep` false, whose `R11_SENTINEL` rolls back a success exactly as it rolls back a
refusal, so a digest taken after them equals the one taken before whatever the calls did. A raised call is also always undone by
its own savepoint; the failure worth catching is a refusal that WRITES AND RETURNS.

Fix: the whole-row sha256 digest of the fourteen tables of `c11_snapshot()` is taken before and after each probe, in the same
transaction, and the tables that differ are stored in `r11_probe.changed`. Each battery ends with
`is(pg_temp.r11_effect_verdict(array[<declared successful controls>]), 'clean', ...)`: clean only when every probe was observed,
no raised probe shows a change, and the probes that returned and wrote are EXACTLY the declared controls. A new control in each
of the assign, decision and mint suites asserts the observation does see a write (`r11_changed('<ok probe>')` names the tables).

Evidence:
- Instrument not blind: `phase_02_slice_11_effect_oracle.sql` uses the real `cms_record_review_decision`. A wrapper that writes and
  RETURNS is reported as a returned writer (`audit_events, cms_editorial_decisions, cms_editorial_reviews, idempotency_records,
  outbox_events`); a write raised away shows nothing; a probe made before the watch, or never made, is unclean; an empty battery is
  unclean; and the old end-of-file digest equals its start value after the same probes (assertion 16 of that file).
- Mutation proof on the six real suites (`mutants-and-green-run2.tap`, scratch files deleted afterwards): each suite was copied with
  its command renamed and replaced by a wrapper that, when the real command refuses, commits a write (a review row's `updated_at`
  moves) and returns an envelope. All six verdict assertions fail and name every refusing probe as a returned writer (assign 16 failed
  assertions, decision 12, submit 15, schedule 20, publish 18, mint 16; the verdict is among them in each).
- GREEN after a fresh `supabase db reset` of the alt stack (`green-final-pgtap.out`): 12 files, 336 assertions, 0 failed
  (oracle 23, assign 25, decision 26, submit 25, schedule 41, publish 36, mint 28, criteria_decision_order 24,
  criteria_publish_gates 35, claim 27, execute 28, criteria_safe_read_effects 18).
- Observed on the real suites: raised probes assign 53, decision 42, submit 37, schedule 52, publish 44, mint 75;
  declared returned writers assign `e-control, l-expired-free, x-grantor-edge, x-reviewer-edge, x-seven-ok`;
  decision `cap-control, su-ok-edge, v-2000-emoji`; mint `cap-reviewer-own, exact-set, ok-route-dir, ok-route-max, ok-route-pct,
  ok-route-root, ok-route-unicode`; submit, schedule and publish none. `unobserved=0` everywhere. The probe counts are NOT pinned: adding a
  refusal needs no edit; a new returned write must be declared.

Changed titles (pgTAP descriptions; old -> new), file by file:
- `rpc_review_assign_refusals.sql` AC-071: "every refusal above left no assignment, review change, reservation, audit record or
  outbox event behind" -> "every refusal above changed none of the fourteen durable tables (whole-row digests of assignment, review,
  decision, reservation, audit record, outbox event and the rest), observed inside its own call before the probe rolled back; only the
  five successful controls wrote". Added: "control: the observation sees a write - an accepted assignment changes the assignment,
  reservation, event and audit tables inside its probe".
- `rpc_review_decision_refusals.sql` AC-015: "every refusal above left no decision, review change, reservation, audit record or
  outbox event behind" -> "every refusal above changed none of the fourteen durable tables (whole-row digests of decision, review,
  assignment, dependency, reservation, audit record, outbox event, snapshot and the rest), observed inside its own call before the
  probe rolled back; only the three successful controls wrote". Added: "control: the observation sees a write - an accepted decision
  changes the decision, review, reservation, event and audit tables inside its probe".
- `rpc_review_submit_refusals.sql` AC-009: "every refusal above left no review, dependency row, reservation, audit record or outbox
  event behind" -> "every refusal above raised and changed none of the fourteen durable tables (whole-row digests of review,
  dependency row, reservation, settings snapshot, evidence, audit record, outbox event and the rest), observed inside its own call
  before the probe rolled back".
- `rpc_publication_schedule_refusals.sql` AC-018: "every raised refusal above left no schedule, review change, lineage row,
  reservation, event or audit record behind" -> "every refusal above raised and changed none of the fourteen durable tables
  (whole-row digests of schedule, review, lineage row, reservation, event, audit record, snapshot and the rest), observed inside its
  own call before the probe rolled back".
- `rpc_publication_publish_refusals.sql` AC-030: "every raised refusal above left no lineage row, review change, schedule,
  reservation, event or audit record behind" -> "every refusal above raised and changed none of the fourteen durable tables
  (whole-row digests of lineage row, review, schedule, reservation, event, audit record, snapshot and the rest), observed inside its
  own call before the probe rolled back".
- `rpc_preview_mint_refusals.sql` AC-027: "every refusal and every probed success was rolled back: no token, reservation, audit
  record, event or settings snapshot remains" -> "every refusal above changed none of the fourteen durable tables (whole-row digests of
  token, reservation, audit record, event, settings snapshot and the rest), observed inside its own call before the probe rolled
  back; only the seven successful controls wrote". Added: "control: the observation sees a write - a minted preview changes the
  token, reservation and audit tables inside its probe". Mint writes no outbox event and no settings snapshot (observed).
- `criteria_decision_order.sql` AC-108: "every raised refusal above left no decision, review change, reservation, audit record,
  event or snapshot behind" -> "every raised refusal above changed none of the fourteen durable tables (whole-row digests of
  decision, review, assignment, dependency, schedule, lineage, token, snapshot, evidence, reservation, event, audit, entry and
  revision), observed inside its own call before the probe rolled back".
- `criteria_publish_gates.sql` AC-004: "every raised publish refusal above left no lineage row, review change, schedule,
  reservation, event, audit record, snapshot or evidence summary behind" -> "every raised publish refusal above changed none of the
  fourteen durable tables (lineage row, review, schedule, reservation, event, audit record, snapshot, evidence summary and the rest),
  observed inside its own call before the probe rolled back".
- `rpc_publication_claim.sql` AC-079: "... are INVALID_REQUEST and change nothing" -> "... are INVALID_REQUEST and change no
  durable table (observed inside each call before it rolled back)".
- `rpc_publication_execute.sql` AC-079: "... an absent schedule is NOT_FOUND, and nothing changes" -> "... an absent schedule is
  NOT_FOUND, and none of them changed a durable table (observed inside each call before it rolled back)"; AC-080: "... are refused
  (CONFLICT / VERSION_MISMATCH) with no effect" -> "... are refused (CONFLICT / VERSION_MISMATCH) and none of them changed a durable
  table (observed inside each call before it rolled back)".
- New in `effect_oracle.sql` (all `[P2-S11-AC-015]`): the 14 assertions listed in that file.

Not changed: reads suites (`rpc_reads_*`) keep their end-of-file counters because their probes are KEPT (default `p_keep`), so those
counters are not vacuous; `rpc_review_assign.sql`'s step-up and replay digests likewise follow kept calls.

## 2. A-M9: p95 benches for CMS-03B-15/16/17 (AC-052 clauses 5-6, AC-058 clause 5, AC-064 clause 6)

`phase_02_slice_11_reads_bench128.sql` (24 assertions, 9 from the worlds) follows `phase_02_slice_09_evidence_bench128.sql`: each call's
wall time is taken in the database over thirty samples and the p95 is asserted against the declared tier. Fixtures at the declared
bounds, built with the real RPCs and builders: a 128-field type created by `cms_create_type_draft` (activated with the real editorial
policy); CMS-03B-15 on a 128-value draft with the 17-result preflight and on an entry with an open review, 20 schedules (16 returned)
and 70 publications (64 returned); CMS-03B-16 at 7 of 8 decisions, 16 active plus 20 revoked assignment rows (32 summarized) and a
128-field frozen manifest; CMS-03B-17 at limit 50 from 200 assigned reviews among 500, first page and a signed-cursor page.
Targets: Tier 2 p95 < 1,200 ms, Tier 1 p95 < 750 ms, worst sample < 8,000 ms.

Fixture defects found and fixed while getting it running (the file had never run): `b11_timing` was created after the SQL function
that reads it; the 20 assign/revoke cycles ran after 16 actives and hit `assignment_limit` (cycles now first); review clones used
`md5(...)::uuid`, whose id the signed cursor rejects as malformed (`INVALID_REQUEST` on page 2), now `pg_temp.h11w_uuid`.

Results:
- Loaded host (load average 10-15, shared lock, `bench-functional-run4.out`): draft128 p50 336 / p95 397 / max 433 ms; bounds
  252 p95; review detail 71; queue page 1 133; queue page 2 134. All assertions pass (24/24).
- Mutation proof (`bench-mutant-slow.out`): CMS-03B-16 and -17 slowed 0.8 s per call: queue 975 / 1,015 ms and detail 889 ms p95, and
  exactly the three Tier 1 assertions fail (21-23); the unslowed Tier 2 assertions still pass.
- Quiet host, the quiet lock held EXCLUSIVELY, one-minute load average 1.47 when the run started (`bench-exclusive-run.out`,
  `bench-exclusive-run.tap`, 2026-10-11 19:51 after a fresh `supabase db reset` of the alt stack): 24/24 pass. p50 / p95 / max in ms
  over n=30: CMS-03B-15 draft128 79.5 / 87.1 / 87.9 (Tier 2 target 1,200); CMS-03B-15 bounds 65.6 / 72.5 / 74.9 (1,200);
  CMS-03B-16 review detail 18.1 / 22.1 / 23.3 (Tier 1 target 750); CMS-03B-17 queue page 1 33.6 / 225.9 / 251.0 (750); CMS-03B-17 queue
  page 2 (signed cursor) 31.8 / 35.5 / 36.0 (750). Worst sample of every read 251.0 ms against the 8,000 ms deadline. The only
  edits to a migration or pgTAP file after that run are two comment-only tracking-issue links (`20261010165000`,
  `phase_02_slice_11_projection_state.sql`, commit `0fd4bf31`), so the figures stand for the final tree.

What this measures and what it does not: the database share of each read, the way Slice 09 measured its RPCs. BE03b folds the 2,000 ms
accessibility checker budget into the 1,200 ms Tier 2 figure; the checker runs in the Worker (bounded by its own budget tests) and the
two numbers are inconsistent as written (the budget alone exceeds the p95). No Worker + Kong + PostgREST latency was measured. If the
ledger wants the composed figure, AC-052/058/064 stay partial for that part, or the owner reads "p95" as the RPC figure.

## 3. A-M12: AC-082 whole-job 15,000 ms sweep deadline

BE03b CMS-03B-20 (`03b-editorial-workflow-publication.md` line 179): "claim and execute run under the 15,000 ms job deadline"; it is
one deadline per job (one scheduled tick), not per RPC. The sweep now opens one `AbortController` aborted at
`CMS_SCHEDULE_DEADLINE_MS` when the tick starts, passes its signal to the claim, to every checker load and to every execute (including
reviewB-2's re-execution on stale evidence), starts no schedule after it has passed (the lease and the database ladder own those
claims), logs `JOB_DEADLINE_EXCEEDED` with the unstarted count, and clears the timer in `finally`.

Titles in `cms-publication-schedule-sweep-deadline.test.ts` (describe "the 15,000 ms job deadline"):
- old: "gives the claim and the execute each their own 15,000 ms" -> new: "shares ONE 15,000 ms job deadline between the claim and the
  execute: a claim that takes 10,000 ms leaves 5,000 ms".
- added: "starts no further schedule once the job deadline has passed and logs how many were left unstarted"; "leaves no timer behind when
  the tick finishes inside the deadline". The three earlier tests (claim aborted at 15,000 ms, execute aborted at 15,000 ms, the
  constant is the transport deadline) are unchanged.

Status at HEAD `0fd4bf31`: the production change (one `AbortController` per tick, `claimOrRetry`, the `JOB_DEADLINE_EXCEEDED`
log) is already committed in `b001ff2d` together with reviewB-2's re-execution; `git status` shows `cms-publication-schedule-sweep.ts`
unmodified, so nothing was missing and I added nothing to production. Only the test file `cms-publication-schedule-sweep-deadline.test.ts`
is uncommitted (this lane's). Re-verified: `sweep-run2.out`, 5 files, 43 tests, all pass, including the six deadline cases.

RED: `sweep-deadline-red-against-head.out` runs the file against the sweep at the old `HEAD` (`dd1ee1ce`) and the two whole-job tests fail ("shares ONE ..."
`AssertionError: expected false to be true` at `signal.aborted`, the execute got a fresh 15,000 ms window; "starts no further schedule ..."
`Test timed out in 15000ms`, the second claim's execute hung with no job bound). GREEN: `sweep-run1.out`, the five
`cms-publication-schedule-sweep*` files, 43 tests (including reviewB-2's stale-evidence files at their state of 17:57).

## 4. A-M15: retain input (AC-037, AC-040, AC-043 clause 9)

The old controller test asserted nothing about input (the controller holds no form values); it is retitled: "rotates the key,
refetches the canonical state and keeps the input on a stale conflict" -> "rotates the key and refetches the canonical state on a stale
conflict, then commits a new submit".

New specs mount each real form with queued `fetch` responses, enter values, drive a definite refusal and an unknown outcome (504),
assert the CONTROLS still hold exactly what was typed, press the commit control again and assert the second request body equals the
first (and, after the unknown outcome, the same `Idempotency-Key`). Titles (describe + test; the ledger form is "describe test"):
- AC-037, `CMS-03B-06 decision form keeps its entries`: "[P2-S11-AC-037] keeps the chosen decision and the typed reason after a
  definite 409 refusal and re-sends them"; "... through an unknown outcome and re-sends them under the same key".
- AC-037, `CMS-03B-05 submit form re-sends the served preparation unchanged` (the form has no typed input; the served preparation is
  re-sent identically): "[P2-S11-AC-037] has no typed input to lose, and a definite refusal leaves the same preparation to send
  again"; "[P2-S11-AC-037] re-sends the same request under the same key after an unknown outcome".
- AC-040, `CMS-03B-07 schedule form keeps its entries`: "[P2-S11-AC-040] keeps the action, local time, zone and audience after a
  definite 409 refusal and re-sends them"; "... keeps every entry after a 422 that names a field, and the named field is marked";
  "... keeps every entry through an unknown outcome and re-sends them under the same key".
- AC-043, `CMS-03B-09 publish confirmation keeps its entry`: "[P2-S11-AC-043] keeps the audience after a definite 409 refusal and
  re-sends it"; "... keeps the audience through an unknown outcome and re-sends it under the same key". And
  `CMS-03B-08 preview form keeps its entries`: "[P2-S11-AC-043] keeps the audience and route after a definite 409 refusal and re-sends
  them"; "... through an unknown outcome and re-sends them under the same key".

RED/mutation: the first run (`retention-run1.out`) failed the 422 spec: `expected null to be 'true'` for `aria-invalid`. Cause: my
fixture sent `schedule_out_of_horizon` without the `minUtc`/`maxUtc` window members the contract requires, so the Worker answer was not
a verified refusal (a test-fixture defect, not a production one); fixed. Then, by mutation of the real forms (scratch files, deleted):
making `useDraftFields` forget what was typed when a refusal alert appears fails decision 409, schedule 409 and 422, publish 409; when
the unknown-outcome state appears it fails decision, schedule and publish unknown (7 failures, `retention-mutants.out`); the preview
form (own `useState`) mutated the same two ways fails its 409 and unknown specs (`retention-mutants-preview.out`). GREEN:
`retention-run3.out` (the three web files, 32 tests: 11 new + 21 controller).

## 5. Stale ledger citations (not edited; ledger fragments cited as fragment:line)

Citations whose title no longer exists in the cited file (found by comparing every ledger citation of a changed file with `HEAD`,
34 in all). Replace each old title in the stated fragment lines.

| Old title (file) | Cited at (criterion[clause] fragment:line) | Replacement |
| --- | --- | --- |
| "every refusal above left no review, dependency row, reservation, audit record or outbox event behind [P2-S11-AC-009]" (`rpc_review_submit_refusals.sql`) | AC-006[2] 001-034:1228; AC-009[5] 001-034:1805; AC-010[0] 001-034:1841; AC-097[3] 067-100:5472; AC-113[0] 101-122:2312 | "every refusal above raised and changed none of the fourteen durable tables (whole-row digests of review, dependency row, reservation, settings snapshot, evidence, audit record, outbox event and the rest), observed inside its own call before the probe rolled back [P2-S11-AC-009]" |
| "every refusal above left no decision, review change, reservation, audit record or outbox event behind [P2-S11-AC-015]" (`rpc_review_decision_refusals.sql`) | AC-012[2] 001-034:2209; AC-015[5] 001-034:2842; AC-016[0] 001-034:2885; AC-046[1] 035-066:3030 | "every refusal above changed none of the fourteen durable tables (whole-row digests of decision, review, assignment, dependency, reservation, audit record, outbox event, snapshot and the rest), observed inside its own call before the probe rolled back; only the three successful controls wrote [P2-S11-AC-015]"; add the control "control: the observation sees a write - an accepted decision changes the decision, review, reservation, event and audit tables inside its probe [P2-S11-AC-015]" to AC-015[5] |
| "every raised refusal above left no schedule, review change, lineage row, reservation, event or audit record behind [P2-S11-AC-018]" (`rpc_publication_schedule_refusals.sql`) | AC-018[2] 001-034:3378; AC-022[0] 001-034:4095; AC-047[1] 035-066:3280; AC-097[3] 067-100:5478 | "every refusal above raised and changed none of the fourteen durable tables (whole-row digests of schedule, review, lineage row, reservation, event, audit record, snapshot and the rest), observed inside its own call before the probe rolled back [P2-S11-AC-018]" |
| "every refusal and every probed success was rolled back: no token, reservation, audit record, event or settings snapshot remains [P2-S11-AC-027]" (`rpc_preview_mint_refusals.sql`) | AC-024[2] 001-034:4534; AC-027[5] 001-034:5163; AC-028[0] 001-034:5218 | "every refusal above changed none of the fourteen durable tables (whole-row digests of token, reservation, audit record, event, settings snapshot and the rest), observed inside its own call before the probe rolled back; only the seven successful controls wrote [P2-S11-AC-027]" |
| "every raised refusal above left no lineage row, review change, schedule, reservation, event or audit record behind [P2-S11-AC-030]" (`rpc_publication_publish_refusals.sql`) | AC-030[2] 001-034:5555; AC-033[5] 001-034:6242; AC-034[0] 001-034:6291; AC-048[1] 035-066:3499; AC-097[3] 067-100:5484 | "every refusal above raised and changed none of the fourteen durable tables (whole-row digests of lineage row, review, schedule, reservation, event, audit record, snapshot and the rest), observed inside its own call before the probe rolled back [P2-S11-AC-030]" |
| "every refusal above left no assignment, review change, reservation, audit record or outbox event behind [P2-S11-AC-071]" (`rpc_review_assign_refusals.sql`) | AC-071[2] 067-100:801 | "every refusal above changed none of the fourteen durable tables (whole-row digests of assignment, review, decision, reservation, audit record, outbox event and the rest), observed inside its own call before the probe rolled back; only the five successful controls wrote [P2-S11-AC-071]" |
| "a batch outside 1..100, ... are INVALID_REQUEST and change nothing [P2-S11-AC-079]" (`rpc_publication_claim.sql`) | AC-079[0] 067-100:2119 | "... are INVALID_REQUEST and change no durable table (observed inside each call before it rolled back) [P2-S11-AC-079]" |
| "an unknown key, ... an absent schedule is NOT_FOUND, and nothing changes [P2-S11-AC-079]" (`rpc_publication_execute.sql`) | AC-079[1] 067-100:2172 | "... an absent schedule is NOT_FOUND, and none of them changed a durable table (observed inside each call before it rolled back) [P2-S11-AC-079]" |
| "a stale lease, a stale version and a schedule that was never claimed are refused (CONFLICT / VERSION_MISMATCH) with no effect [P2-S11-AC-080]" (`rpc_publication_execute.sql`) | AC-080[1] 067-100:2279; AC-122[7] 101-122:4895 | "... are refused (CONFLICT / VERSION_MISMATCH) and none of them changed a durable table (observed inside each call before it rolled back) [P2-S11-AC-080]" |
| "the 15,000 ms job deadline gives the claim and the execute each their own 15,000 ms" (`cms-publication-schedule-sweep-deadline.test.ts`) | AC-082[3] 067-100:2674 | "the 15,000 ms job deadline shares ONE 15,000 ms job deadline between the claim and the execute: a claim that takes 10,000 ms leaves 5,000 ms"; add "the 15,000 ms job deadline starts no further schedule once the job deadline has passed and logs how many were left unstarted" |
| "definite refusals rotates the key, refetches the canonical state and keeps the input on a stale conflict" (`cms-workflow-command-controller.test.ts`) | AC-037[9] 035-066:950; AC-040[9] 035-066:1847; AC-043[9] 035-066:2811 | Replace by the retention specs of the criterion (file `apps/web/src/components/cms-editorial-workflow/cms-workflow-input-retention.test.tsx` for AC-037 and the preview/AC-043 ones, `...-time.test.tsx` for schedule/publish): AC-037[9] "CMS-03B-06 decision form keeps its entries [P2-S11-AC-037] keeps the chosen decision and the typed reason after a definite 409 refusal and re-sends them" and "... through an unknown outcome and re-sends them under the same key"; AC-040[9] the three `CMS-03B-07 schedule form keeps its entries [P2-S11-AC-040] ...` specs; AC-043[9] the two `CMS-03B-09 publish confirmation keeps its entry [P2-S11-AC-043] ...` and the two `CMS-03B-08 preview form keeps its entries [P2-S11-AC-043] ...` specs. The old controller test may stay as the proof of key rotation and refetch |

Not mine, found by the same scan (34 stale citations in all at HEAD `0fd4bf31`: the 30 above plus these four, the same count as
at the start of the lane; re-run with the read-only scan `lane-reviewA-2-logs/stale-citations-scan.mjs` (output `stale-citations-scan.out`) against the four fragments). The owning lane
(reviewA-1) retitled them; exact replacements in the files as they stand now:
- AC-069[0] 067-100:318 (`rpc_review_assign_refusals.sql`): old "an owner without a valid cms.editor grant is refused a create (no
  grantor authority end) but may still revoke [P2-S11-AC-069]" -> "an owner without a valid cms.editor grant is refused both a create
  and a revoke: 403 capability_missing (BE03b CMS-03B-18, review of finding A-B1) [P2-S11-AC-069]".
- AC-091[1] 067-100:4386 and :4392 (`helpers_settings.sql`): old "the evaluation goes through cfg_resolve_effective_value with
  consumer key cms.publication [P2-S11-AC-091]" and "registered keys are evaluated in ascending bytewise order [P2-S11-AC-091]" ->
  "each registered key is resolved through cfg_resolve_effective_value with consumer key cms.publication, for the owner party and
  the given instant, in ascending bytewise order (observed on a spy resolver) [P2-S11-AC-091]" and "keys registered out of order
  (b, a, B) come back in ascending bytewise order (B, a, b) as { key, definitionVersionId, sourceValueVersionId, valueHash } members,
  a contract default carrying a null source value version [P2-S11-AC-091]".
- AC-119[8] 101-122:4079 (`schema_posture.sql`): old "posture: each Slice 11 table has exactly one policy, the CMS RPC-context gate
  [P2-S11-AC-119]" -> "posture: each Slice 11 table has exactly its CMS RPC-context gate plus its named restrictive session-scope
  policies (tenant, exclusive-writer, owner, system), never an unnamed one - proved row by row in
  phase_02_slice_11_rls_session_scope.sql [P2-S11-AC-119]".

New proof the ledger can cite for items 2-4 (exact titles are in the files): the bench assertions 18-24 of
`supabase/tests/phase_02_slice_11_reads_bench128.sql` for AC-052[5][6], AC-058[5], AC-064[6]; the three job-deadline specs above for AC-082[3].

A-m1 / independent finding #13 (AC-083 clause 2, "blocks ... while the prior publication stays intact", 067-100:2816; the same title is
also cited by AC-039 "and cascade" at 035-066:1525, which should be re-examined): the cited test
"a blocked outcome appends no lineage row and emits no publication event: the prior publication stays intact [P2-S11-AC-083]"
(`rpc_publication_execute_refusals.sql`, line 117) asserts that NO publication row exists for those three entries, so there is no
prior head to preserve. The real preservation proof exists and is uncited, in the same file (the `xr-head` entry, an active v1 head
published through `cms_publish_revision` before the claim, whole lineage fingerprint compared before and after):
- "the scheduled publish over an existing head fails the preflight and the schedule is blocked preflight_failed [P2-S11-AC-083]"
- "the blocked execution left the existing active v1 head, the lineage rows, their events, audit records and evidence summaries
  exactly as they were: no tombstone, no successor row [P2-S11-AC-083]"
Cite both for AC-083[2]. The line-117 title overclaims; retitling it (for example "a blocked outcome appends no lineage row and
emits no publication event [P2-S11-AC-083]") changes a ledger-cited title, so it is left for whoever edits the ledger.

## Final verification at HEAD `0fd4bf31` (resume of 2026-10-11, after the second usage-limit stop)

All commands ran in this worktree; logs are in `lane-reviewA-2-logs/` (see its `README.md`).
- pgTAP, alt stack after a fresh `supabase db reset` of the current migrations (reviewA-1's `20261010169000` included): the 42 suites
  that include the shared `rpc_review/000-world.sqlinc` (every suite that depends on the harness I changed, `world-suites.txt`),
  `world-suites-run.out` / `.tap`: `Files=42, Tests=1219, Result: PASS`, 0 `not ok`. The 8 files another lane saw failing pass:
  `effect_oracle` 23, `reads_bench128` 24, `rpc_review_assign_refusals` 25, `rpc_review_decision_refusals` 26,
  `rpc_review_submit_refusals` 25, `rpc_publication_schedule_refusals` 41, `rpc_publication_publish_refusals` 36,
  `rpc_preview_mint_refusals` 28; and the others of this lane: `criteria_decision_order` 24, `criteria_publish_gates` 35,
  `rpc_publication_claim` 27, `rpc_publication_execute` 28, `criteria_safe_read_effects` 18; and the neighbour
  `rpc_publication_execute_refusals` 35 (not edited by this lane).
  After that run I changed one character in a comment of `000-world.sqlinc` (line 186, `.sqinc` -> `.sqlinc`); no code moved.
- Read benchmark under the exclusive quiet lock (section 2): `bench-exclusive-run.out` / `.tap`, 24/24.
- vitest: `sweep-run2.out` (5 files, 43 tests, the six deadline cases among them) and `retention-run4.out` (the whole
  `cms-editorial-workflow` directory: 35 files, 369 tests, the 11 retention specs and the 21 controller tests among them).
- `lint-run2.out`: prettier `--check` and eslint `--max-warnings=0` clean on the five TS files of this lane; prettier clean on the
  five README files I touched (they are in the `format:check` globs). `tsc-run3.out`: `tsc --noEmit` exit 0 for `apps/web` and
  `apps/worker`. `git diff --check` clean on every tracked file I edited.
- Not run by this lane: `pnpm validate`, `pnpm db:verify`, the API and race stages, Playwright, and the evidence guard (it needs the
  receipts the orchestrator regenerates; it fails here with 2,130 evidence problems for the whole ledger, the ones I read being "no receipt").

## Spec lines satisfied

BE03b CMS-03B-20 "claim and execute run under the 15,000 ms job deadline" (item 3); BE03b "Testing Strategy" (p95 at declared bounds,
items 2); FE03 "Map exact ApiError; retain input; reconcile unknown mutation before retry" (item 4); BE03b "Permission, RLS and grants"
no-effect refusals (item 1). Decision rules: debug-by-test (RED shown for every change that fixes a defect), tdd (specs first),
extensibility (README sections, every file under 400 lines).

## Open items

- The benchmark's timing figures were taken once under the exclusive quiet lock (one-minute load 1.47 at the start; the run itself is
  10 s). The functional run of the same file also passes on a loaded host (load 10-15, `bench-functional-run4.out`, p95 397 ms). Absolute
  figures depend on the machine; the Tier 1 and Tier 2 assertions pass with a margin of more than 3x (the slowest p95, queue page 1, is
  225.9 ms against 750).
- Composed-stack latency (Worker + Kong + PostgREST) and the 2,000 ms checker budget inside the 1,200 ms figure are not measured (item 2).
- `CmsEditorialPreviewForm` keeps its entries in `useState` while the other forms use `useDraftFields`; behaviour is the same and
  both are proven, but a step-up restore for the preview form would need the shared hook (not in scope).
- Retention is proven at form level with a stubbed `refetch`. A regression that re-keys a form in an island on a refetch would not
  be caught; the island tests (`CmsEditorialWorkflowIsland*.test.tsx`) do not enter values.
- Static checks: see "Final verification" above (prettier, eslint `--max-warnings=0`, `tsc --noEmit` for web and worker all clean).
  The full `pnpm validate` and the API/race stages were not run by this lane.
- Ledger edits in section 5 are for the ledger owner; the guard cannot pass until they are made.
- `rpc_review_assign_refusals.sql` is edited by two lanes; the verdict does not pin probe counts, so reviewA-1's later probes need no
  edit here, only a declaration if one of them returns and writes.
