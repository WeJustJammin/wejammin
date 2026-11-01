# Independent review (fix pass 2, delta): claude_s12_worker_taxonomy_terms

## Status
- Target: `lane-worker-taxonomy-terms-report.md` `## Fix pass 2`. Report SHA `8d2a0829…3506` matches dispatch; HEAD
  `b16edb54` verified. Brief `briefs/worker-taxonomy-terms-f2.md`; prior review `review-worker-taxonomy-terms-f1.md`.
- Read-only; I wrote only this file and read the lane's scratch artifacts in place. Hashes: all 9 rows of `### Files changed in fix pass 2` match disk (SHA-256 and line count). The lane mirror's copies
  of those 9 files, `-telemetry.ts` and the BE03c spec are byte-identical to the worktree.
- Runs (pinned PATH, `flock -s /tmp/wejammin-quiet.lock`):
  - 11:55Z focused Vitest, 8 files (effect, runbook, guard telemetry, dispatcher merge, dispatcher, integration,
    telemetry, claim): 8/8 files, 108/108 tests.
  - 11:56Z `pnpm --filter @wejammin/worker exec tsc --noEmit -p .`: exit 2, ONE error, in
    `cms-composition/capability-missing-refusals.test.ts:313` (TS2352). Untracked, not a lane file, mtime 11:54:40Z
    (after the lane's 11:50Z 0-error run). Concurrent-lane drift, not this lane's defect; root's gate must see it fixed.
- Not re-run (outside allowance): full Worker suite, eslint, prettier. The artifact `full-worker.out` shows
  668 files / 11,887 tests, exit 0, start 11:39:06Z; final lane bytes were in place by 11:38:39Z.
- Scans: no `any`/TODO/`.skip`/`.only`; sources ≤300 (dispatcher 259), tests ≤400 (effect test 397).

## Items
**m-f1 — CLOSED (nit n-f2a).** SQL check: the merge converges only its own term in-transaction
(`20261014120400:180-182`, `cms_converge_taxonomy_merge(retired.id, 5000)`, remaining per term) and requests a job only
then. The fenced handler drains party-wide: `20261014120810:106-113` loops `cms_taxonomy_merge_work(acting_party, null)`
and continues while party-wide `remaining > 0` (`:114-122`). The new text (`names.ts:21-23`, runbook `:77-79`) is true.
Pinned by `runbook.test.ts:129-135` (mutant R9 killed).

**m-f2 — CLOSED; D-F5 correct.** `effect.ts:42-47,171-173`.
- Grounds: BE00 550 and BE03c 1302/1565 give no bound. No jitter precedent exists in `apps/`/`packages/`.
- Seam: +0..10 % upward only; `Math.floor`; one draw per pause actually taken.
- Broken-sample guard: `sample >= 0 && sample < 1` rejects NaN, negatives, 1, >1 and ±Infinity. `-0` gives base.
- Float edge: for x = 1500 or 6000 and any sample ≤ 1−2⁻⁵³, x·sample < x, so the floor is ≤1499 / ≤5999. The real
  maximum is 16,499 + 65,999 + 3 × 15,000 = 127,498 ms. That is ≤127.5 s, < 200 s (BE00 554 heartbeat) and < 240 s.
- Tests assert the range, not one value: lower edge, upper edge (`> base`, `≤ base*1.1`, integer), linear scaling with 2
  independent draws, floor, a broken-seam table, the `Math.random` default, 50 real draws inside `[base, 1.1·base]`, and
  the jittered worst case `(120 000, 127 500]` (`effect.test.ts:185-198, 265-355`).

**n-f1 — CLOSED (minor m-f2a).** `dispatcher.ts:195-216` routes all three guard failures through the same
`logMergeSettled` / `mergeLoggerFor` (same per-env WeakMap logger as the effect). Event shape, `outcome="failed"` metric,
attempt and the lease-token scrub are asserted (`guard-telemetry.test.ts`). The throw message is not logged.
Other job types: the dispatcher diff vs HEAD is pure insertion (5 hunks, 0 deletions). All new logic sits inside the
`cms.taxonomy.merge_converge` branch. `logMergeSettled` and `mergeLoggerFor` both swallow errors, so the guard cannot
throw. G9 and "other job types never log" pin it.

**BE03c sync test — CLOSED.** `runbook.test.ts:83-98` parses the BE03c "Merge convergence Job disposition" table to the next
`### ` (the table is at BE03c 1398-1411). It checks: distinct codes = `TAXONOMY_MERGE_JOB_ERROR`; `(code, state)` pairs = the runbook's; every registry state
`failed`; the `succeeded | null` row present. It fails in each direction: spec drop/rename/add (R2, R3, R5), a state flip (R4), a runbook drop (R1), a constant
rename/add (R7, R8) and lost citation (R6). It fails safe: a missing heading or empty parse cannot equal the 8 codes.

**Mutation battery — VERIFIED.**
- Script `mutate_f2.py` mutates only the private mirror and runs real Vitest. `mutation-results.tsv` has 52 rows:
  51 KILLED, 1 SURVIVED (M2). All have `restored-sha-ok=True`. `mirror-before2.sha` equals `mirror-after2.sha`
  (1,315 files).
- Sampled M7, M13, J2, J4, J6, J12, G7, G8, R2, R4: each mutant matches its claimed property; the killer is in the named file.
- M2 is equivalent. `safeDetails(403, x)` returns `{}` for every x (non-object `:12-13`, object `:41`), so
  `taxonomy-term-details.ts:62`'s 403 branch is redundant.
- Run-1 survivors J6, J7 and G4 were disclosed and resolved honestly.
- J10 is mislabeled ("one sample reused" is really a constant 0.5). The reuse property is still pinned by
  `effect.test.ts:299-304`.

**m-f3 — CLOSED.** AC-226 dependency stated; tracking issue is Request #2. AC-226 now sits at
`phase-02-slice-12.md:2188` (root edited the file at 11:51Z), so the cited `:2158` is stale (now AC-196).

**Test corrections #1-#3 — non-weakening.** #1 `random: () => 0` keeps the exact base-pause assertion (range pinned
elsewhere). #2 82,500 ms advance ≥ the 82,498 ms real maximum; J11 shows the headroom is load-bearing; assertions
unchanged. #3 shared column parser, equal assertion, plus the new BE03c test.

## Findings
- **m-f2a** `production-job-effect-dispatcher.ts:198` — minor.
  - Problem: the guard's production logger path is untested. Production never sets `taxonomyMergeLogger`
    (`production-async-entrypoint.ts:45-53`), so the guard logs only through `mergeLoggerFor(context.env, undefined)`.
    Every guard test injects a logger.
  - The mutant `mergeLoggerFor(undefined, dependencies?.taxonomyMergeLogger)` would survive (by reading). It makes the
    guard silent in production and re-opens n-f1 unseen. The same applies to the effect's env path (first-pass scope).
  - Fix: one guard test without an injected logger, with a valid context env, spying `console.info` (the default
    sink) and asserting one `outcome:"failure"` event.
- **n-f2a** runbook `:77-79`, `names.ts:21-23` — nit. "Only a later merge … requests a job" omits one path: a still-live
  chain of the same party, from an earlier or concurrent merge. Its next continuation is party-wide (`120810:106-122`)
  and also drains a failed job's tail. The conclusion "nothing guarantees one" stands. Fix: "… or a continuation of a
  chain of that party still running".
- **n-f2b** report `### Runs` — nit. Per the TSV and `full-start.txt`, mutation run 2 ran 11:39:02–11:42:38Z, and the
  full Worker suite ran 11:39:06–11:49:49Z, at the same time. The report says 11:38-11:40 and 11:41-11:49.
  No contamination (isolated mirror, equal hashes), but the overlap breaks the quiet-host practice.
- **n-f2c** item 2 — informational. The jitter code and tests came from the killed predecessor, and no RED run was
  observed (disclosed). The J1-J12 kills are the non-vacuity evidence, and they suffice.
- Carry-over: f1 n-f2 (mark first-pass Open item 1 superseded) is still unedited (`report:120`); not in this brief.

## Requests to root
1. Accept m-f1, m-f2 (ratify D-F5), n-f1 (ratify D-F6), the BE03c sync, item 5 and m-f3 as closed.
2. Optional, non-blocking: m-f2a (one env-logger guard test) and n-f2a (wording). Eslint/prettier not re-verified here.
3. Before the canonical Worker gate, have the owner of `capability-missing-refusals.test.ts` fix TS2352 at `:313`.

VERDICT: CLEAR
