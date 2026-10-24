# Independent review (fix pass): claude_s12_worker_taxonomy_terms

## Status
- Target: `lane-worker-taxonomy-terms-report.md` `## Fix pass`. Report SHA `4cb706ae…c9e6` matches the dispatch.
  HEAD `b16edb54` verified. Prior review `review-worker-taxonomy-terms.md` (PARTIAL). Brief `briefs/worker-taxonomy-terms-f1.md`.
- Read-only. I wrote only this file. My scratch files are in `<scratchpad>/review-worker-taxonomy-terms-f1/`.
- Hashes: all 19 rows under `### Files changed in the fix pass` match disk, both SHA-256 and line count.
  - I also re-hashed the 52 first-pass rows. 13 changed, and every one of them is listed in the fix-pass table.
  - `taxonomy-definition-production.test.ts` (an earlier lane's file) is disclosed as Test correction #1. No change is undisclosed.
- Runs (pinned PATH, `flock -s /tmp/wejammin-quiet.lock`, 08:48 UTC):
  - 27 focused Worker files (lane tests plus every `cms-composition/taxonomy-*.test.ts`): 26/27 files, 593/594 tests.
  - `pnpm --filter @wejammin/worker exec tsc --noEmit -p .`: exit 0.
- The one failure is expected concurrency and not this lane's defect:
  - Failing test: `taxonomy-term-details.test.ts` "safeDetails still publishes CAPABILITY_REQUIRED". Its bytes are unchanged since the first pass (`17d7d140…`).
  - Cause: `taxonomy-safe-details.ts` drifted from `8d46d573…` to `38ed63a0…`. The only change is the 403 branch (`:40-41`, now `return {}`). That is lane hardening_4's permitted edit.
  - Per the dispatch, I did not review the 403 token question. Hardening_4 must update that oracle.
- Not re-run: the full Worker suite (647 files / 11,262 tests) is outside my allowance. That claim is unverified here.
- Scans of the fix-pass TS files: no `any`, no `TODO`, no `.skip`/`.only`. Sources are ≤300 lines (max `taxonomy-definition-response.ts` 298). Tests are ≤400 lines (max 299).

## Prior findings: closure
**M1 — CLOSED.**
- Constants: `cms-taxonomy-merge-converge-effect.ts:29-30` sets `MERGE_MAX_ATTEMPTS = 3` and `MERGE_RETRY_PAUSES_MS = [15_000, 60_000]`.
- Loop `:126-153`: call, then pause[0]; call, then pause[1]; final call with no pause (`pause === undefined`). A terminal refusal returns at once (`:149`).
- Spec source: the BE00 550 queue schedule (15/60/300 s). Dropping the 300 s step is correct.
  - Budget: `invocationBudgetMs = min(240000, leaseUntil - now - 60000)` (`async-runtime-job-context.ts:37-52`).
  - Lease: the default `leaseSeconds` is 300 (`async-runtime.ts:84`).
  - So 300 s can never fit. Worst case = 75 s of pauses + 3 × 15 s calls (`ASYNC_RPC_DEADLINE_MS`, enforced in `async-runtime-rpc-transport.ts:73`) = 120 s. That is under 240 s, and under 200 s (the BE00 554 heartbeat point, one-third of a 300 s lease left).
- Abort-awareness: the budget signal aborts at the deadline (`async-runtime-job-delivery.ts:52-58`). `abortableDelay` settles early on abort (`:52-65`). The loop re-checks `signal.aborted` before each call.
- Duration oracles. They fail on the old `[250, 1000]` and are non-vacuous:
  - `effect.test.ts:156-168` checks the exact sleep arguments `[15000, 60000]` and the identity of the live signal.
  - `:170-180` checks worst case `toBe(120_000)`, `≤ INVOCATION_BUDGET_CAP_MS` and `< 200 s`. It also pins `pauses.length === attempts - 1`.
  - Test-support `build` injects a no-op sleep (`test-support.ts:70`), so the other suites stay fast and the duration oracle is the one that binds.
  - Integration `production-async-entrypoint-taxonomy-merge.test.ts:195-219` drives the real delay under fake timers: 3 RPC calls, `failed DEPENDENCY_UNAVAILABLE`, `p_retryable false`, one ack.
- Test correction #2 (advance 5,000 → the sum of the pauses) is valid and not weakening. The old value encoded the uncited pauses, and the assertions are unchanged.

**M2 — CLOSED for everything the Worker can do. The open parts are root and spec actions.**
- The bypass option is dropped. It is correct under BE00 543 ("Other registered Job types retain existing stale/future event-version rules").
- Error-code registry: the runbook `docs/runbooks/platform/cms-taxonomy-merge-converge.md:42-53` lists 8 codes. They match `TAXONOMY_MERGE_JOB_ERROR` exactly, including the dispatcher guard `MERGE_CONVERGE_OUTCOME_UNMAPPED` (`production-job-effect-dispatcher.ts:187-189`).
- The sync test `cms-taxonomy-merge-converge-runbook.test.ts` parses the errorCode column, so drift in either direction fails.
- The code `DEPENDENCY_INVALID_RESPONSE` as a job code has precedent in BE03a 2450.
- The runbook facts check against the code:
  - log `outcome: 'failure'` (`telemetry.ts:89`);
  - metric labels;
  - `platform.on_call`, the existing route in five platform runbooks;
  - `GET /api/v1/jobs/{jobId}` (BE00 89);
  - lease 300 s and 4 deliveries.
- It is indexed in `README.md` and in `jobs-outbox-reconciliation.md` item 7.
- Owning-domain registration (BE00 233) is correctly escalated as a BE03c table (Requests to root #2), following the BE03a DEC-183 precedent.
- Recovery BOUNDARY, checked against `.claude/rules/boundary-not-placeholder.md`:
  - It names the missing spec: BE03c defines no re-request command or reconciliation. I confirmed this. BE03c 1334/1351/1377 and BE00 554/571 give only the terminal path.
  - It applies the three-part test. Q3 = "blocks no slice test", so the rule says to omit any stub. That is why there is correctly no typed interface and no sentinel test: no stub code exists, and adding one would break the rule's "don't stub what you don't need".
  - Tracking is still open (no issue number); it is deferred to root. See m-f3.
- I checked the facts behind the SQL requirement (Requests to root #1):
  - `cms_taxonomy_merge_work(uuid, uuid)` exists (`20261014120300:26`).
  - The key namespaces `merge_converge:<term>` and `...continuation:<job>` exist (`120300:137`, `120810:120`).
  - The 5,000 threshold is at `120400:180-182`.
  - The new per-failed-job key namespace is needed, as argued.

**m1 — CLOSED.** `cms-composition-production-taxonomy.test.ts:78-118` sends a valid POST. The fixture `expectedVersion '1'` matches `if-match "1"`, and the key and body are valid.
- So it passes every strict clause of the port (`cms-composition-production-taxonomy.ts:44-64`). A header-less GET would answer 400 and fail the assertion.
- It asserts `ok false`, `status 401`, `UNAUTHENTICATED`, and that `fetchImpl` is never called.
- Mutation check: if the context check is removed, `fetch` would be called, so the test kills that mutant.

**m2 — CLOSED.** The 502 branch is gone (`taxonomy-definition-response.ts:132-133`, comment only). On a non-03 operation the token falls through to the foreign-reason 500 (`:146-149`). CMS-03C-03 still answers the typed 422 `{domain}` (`:128-130`).
- Spec check: BE03c 1375 generates the token at CMS-03C-03 create/rename/alias, at CMS-03C-06 submission (governed catalog) and at activation (governed). The governed operations are not served by this mapper. That matches BE03c 1298-1302.
- `taxonomy-foreign-source-token.test.ts` covers the four other operations (500, scrubbed), the 03 path (422 + domain) and the default operation. It fails on the old 502.
- Test correction #1 (`taxonomy-definition-production.test.ts:170-188`, `502 → 500`) is not weakening. It keeps the exact status and the scrub assertions.

**m3 — CLOSED.**
- `LIMIT_SYNTAX = /^(?:0|-?[1-9][0-9]*)$/u` (`taxonomy-read-query.ts:30`) accepts canonical integers of any length.
- Selector (BE03c 403, 400/422): `paging.limit` outside 1-100 is 422 `/limit` (`:110-122`). Pinned for 0, 101, 999999, 1000000, 23 digits and -1 (`selector-read.test.ts:149-154`). Non-canonical `abc`, `1.5`, empty, `+5`, `007` and `-0` stay a bare 400 (`:114-119`).
- Terms (BE03c 407, 400/policy-safe 404/502; no 422): every bad limit is 400, including 1000000, 400 nines and -1 (`terms-read.test.ts:97-103`).
- A 400-digit value parses to `Infinity`. It is still caught: `> 100` gives 422, and the Zod int check gives 400.
- The regex is linear, so there is no ReDoS risk.

**n1, n2 — CLOSED.**
- n1: the comment at `async-runtime-job-delivery.ts:48-49` is now accurate.
- n2: claim-refused and no-context deliveries now log one failed event (`effect.ts:166-179`, `telemetry.ts:25-45`). See also nit n-f1.

**D-W1, D-W4, D-W5:** these are root ratifications and unchanged. D-F1 to D-F4 are consistent with them. m2 extends D-W4, and D-F3 refines D-W5.

**First-pass behaviours:** no regression in the 594-test focused run beyond the concurrency failure above.

## New findings (fix pass)
**m-f1** — `cms-taxonomy-merge-converge-names.ts:20-21`; runbook `cms-taxonomy-merge-converge.md:71-72` — minor.
- Problem: the fix overcorrects. The text now says "no later event drains the tail" / "no later event drains it". The SQL handler is party-wide: `120810` loops over `cms_taxonomy_merge_work(job.acting_party_id, null)` (excerpt lines 32-60).
- So a later merge in the same acting party that itself leaves more than 5,000 assignments requests a job, and that job drains every stranded tail of the party. What is true is that nothing guarantees such an event.
- Why it matters: the operator runbook and the code comment state a false fact. The prior review asked for "may never happen", not "never".
- Fix: "only a later merge of the same acting party above 5,000 assignments requests a job (which drains all of the party's merged-term work); nothing guarantees one".

**m-f2** — `cms-taxonomy-merge-converge-effect.ts:22-30` — minor.
- Problem: BE00 550, the cited source, reads "15s, 60s, and 300s with bounded jitter". BE03c 1302 also says "with jitter". The pauses are exact, and D-F1 does not record that jitter was dropped.
- Why it matters: in a database outage, every party's merge job retries in lockstep at +15 s and +75 s. The pacing adopts the schedule but not its de-synchronisation clause.
- Fix direction:
  - Option 1: add bounded jitter, for example +0-10 % through an injectable random seam. Assert the range, and use the upper edges for the worst case (≈127.5 s, still under 200 s).
  - Option 2: record in D-F1 why jitter is omitted, for root to ratify.

**m-f3** — report `## Fix pass` Open item 1 and Requests to root — minor (decision input).
- Problem: the Q3 answer "blocks no slice test" does not name P2-S12-AC-226 (`phase-02-slice-12.md:2158`: "re-points **every** `active` TermAssignment"). Under a persistent fault, "every" does not hold until a recovery rule exists.
- Also, "root to open the GitHub issue" appears only in the Open item, not as a numbered request.
- Why it matters: root may close AC-226 with a known permanent-strand path left open, and the BOUNDARY could end up with no tracking issue.
- Fix: state the AC-226 dependency explicitly. Add "open a tracking issue for the recovery BOUNDARY" as a numbered request.

**n-f1** — `production-job-effect-dispatcher.ts:181-192` — nit. The dispatcher-guard failures (effect not wired, effect threw, `UNMAPPED`) settle `failed` with no `cms_taxonomy_merge_converge.settled` event and no `outcome="failed"` metric. So the runbook's alert trigger misses them, and the README's "Every delivery logs one event" holds only for deliveries that reach the effect. Two of the three cases are unreachable in practice (the effect is total). The not-wired case is a deployment error. Fix: say so in the runbook, or emit from the guard.

**n-f2** — report line 120 (first-pass Open item 1) — nit. The fix pass says the overstated claim was "removed" from "report Open item 1". The first-pass text still offers the "immutable-origin bypass" and the "next continuation of the acting party". It is only superseded, not edited. Mark it superseded so that root does not act on it.

## Residual risk (informational)
- Batch aggregate: `async-entrypoint.ts:174` processes a batch sequentially, and `wrangler.jsonc` sets no `max_batch_size`.
  - The per-message worst case rose from about 46 s to 120 s. A batch of several merge jobs, all timing out, could approach the consumer's wall-clock limit (the limit was not verified here).
  - The same per-message model already applies to the DEC-184 dry run (240 s). This is family-wide, not this lane's. Root may consider `max_batch_size`.
- The false negative (an attempt times out, then commits) is narrower now: the 15 s and 60 s pauses let a committed attempt release its locks before the retry. It is still possible, and the runbook documents it.

## Requests to root
1. Accept M1, M2 (Worker scope), m1, m2, m3, n1 and n2 as closed.
2. Have m-f1 and m-f2 fixed, or ratify m-f2 as a recorded D-F1 exception. These are small edits and are not blocking.
3. For m-f3: decide whether AC-226 can close while the recovery BOUNDARY is open. Open the tracking issue. Act on the lane's BE03c registration request (#2) and recovery request (#1).
4. Lane hardening_4 must update the `taxonomy-term-details.test.ts` CAPABILITY_REQUIRED oracle. I did not review that.

VERDICT: CLEAR
