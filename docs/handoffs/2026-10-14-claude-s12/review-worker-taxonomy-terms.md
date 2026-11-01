# Independent review: claude_s12_worker_taxonomy_terms

## Status
Reviewed: lane report `lane-worker-taxonomy-terms-report.md` SHA `39c9c4a7…549ad` (matches the target), HEAD `b16edb54` (verified).
Template followed except item 5 (no file re-hashing, per root). Read-only; only this file written.
Runs (pinned PATH, `flock -s /tmp/wejammin-quiet.lock`): the 18 lane-touched Worker test files 18/18 files, 360/360 tests;
`pnpm --filter @wejammin/worker exec tsc --noEmit -p .` exit 0. No DB. Scans: no `any`, `TODO`, `.skip`/`.only` in lane files;
sources ≤300 lines (max `taxonomy-definition-response.ts` 297), tests ≤400 (max 368).
Overall: the CMS-03C-03 port, both reads and the job wiring are correct and well tested. Two majors are job-policy problems
that need a fix or a root ruling. The rest are minor.

## Clause map (implemented / tested)
- CMS-03C-03 (BE03c 161): POST path `taxonomy-routes.ts:73` / `taxonomy-reads-admission.test.ts:52`. Strict body and key + quoted If-Match
  before authority `taxonomy-routes.ts:128-137`, repeated in the port `cms-composition-production-taxonomy.ts:44-64` / `write-header-order.test.ts:200+`,
  `…-act.test.ts:24,107`. Curator 403 `capability_missing` `taxonomy-routes.ts:139-143` / `taxonomy-term-details.test.ts`. Hidden 404, 409, 422
  and canonical overlap: `taxonomy-definition-response.ts:125-151`, `taxonomy-term-failure.ts` / `…-act-tokens.test.ts:20-222`. 60/120 and 15,000 ms
  `taxonomy-rpc-table.ts` / `taxonomy-registry.test.ts:91`, `…-act.test.ts:240`. 200 = strict term `validTerm` / `taxonomy-term-binding.test.ts`.
  The event is SQL-side (not Worker).
- cmsTaxonomyTermsRead (167, 407): GET `taxonomy-definition-routes.ts:81`. Curator gate `taxonomy-definition-shared.ts:189,225` / `terms-read.test:163`.
  Witness + 404 vs empty 200 `…-reads.ts:61-68` / `…-reads.test.ts:105-140`. Cursor passthrough, default 25, max 50 `taxonomy-read-query.ts:63-78` /
  `terms-read.test:58,93,123`. Keyset order and lifecycle filter `taxonomy-read-pages.ts:22-41` / `terms-read.test:230,315`. ETag + no-store
  `terms-read.test:37`. 120/240 and 8,000 ms `registry.test`, `…-reads.test.ts:172`. 256 KiB → 502 `…-reads.test.ts:187-222`.
- CMS-03C-17 (179, 403): author|editor `taxonomy-definition-shared.ts:200` / `selector-read.test:84,92`. 422 with pointer `taxonomy-read-query.ts:105-120` /
  `selector-read.test:106-169`. Default 50, max 100, order, ETag, 300/600: `selector-read.test:33,57,247`, `registry.test:75`.
- Job (1334, 1351, 1377): effect `cms-taxonomy-merge-converge-effect.ts`, dispatcher branch `production-job-effect-dispatcher.ts:181-193`, entrypoint
  `production-async-entrypoint.ts:51-52`, context `async-runtime-job-delivery.ts:22-25` / effect, claim, dispatcher, telemetry and entrypoint suites
  (real `executeJobDispatch` composition, `production-async-entrypoint-taxonomy-merge.test.ts:108-225`).
- Request key parity with the promoted SQL is exact: act `20261014120200:65-74`, terms `120600:52-53`, selector `120700:53`, converge `120820:30-44`.

## Judgements on the brief's questions
1. `validTerm` (D-W1): correct. It matches the SQL exactly. `cms_term_resource` (`120200`) returns the term row. Create inserts version 1, active,
   with the requested parent (`120400:115`). Rename and alias do version+1 and keep the lifecycle; rename applies the parent, and a deprecated
   rename may not move it (`:107,127`). Alias keeps the parent (`:132`). Deprecate needs `active` and gives `deprecated` (`:85,136`).
   Merge gives `merged` with successor = survivor (`:178`). A merged term refuses every action (`:84`).
   - The old `expectedVersion + 1` bound the term to the vocabulary's active-version operand (D1). It would have made real successes 502.
   - Remaining looseness is unavoidable without the prior state: `>=2` and active|deprecated. The binding test kills each clause.
2. Token mapping: complete for every token the producer raises.
   - `capability_missing` 403, `taxonomy_not_active` 409, `canonical_overlap`/`canonical_source_unavailable` 422 with `domain` (and `canonicalId`).
   - The generic tokens: NOT_FOUND/CONFLICT/IDEMPOTENCY_MISMATCH/VALIDATION_FAILED (with pointer)/INVALID_REQUEST/DEPENDENCY_UNAVAILABLE/INTERNAL_ERROR.
   - Provider faults go to a scrubbed 500, 5xx to 503. Prose and DETAIL cannot pick a reason (`act-tokens.test:196`).
   - A known token whose members are missing is 502. That follows the recorded ruling in `review-governed-worker-fix.md:180-187`.
3. 400 vs 422: matches the matrix. Row 407 (terms) allows only 400/policy-safe 404/502, so every query fault is 400. Row 403 (selector)
   allows 400/422; grammar and range faults are 422 with the pointer, as the SQL reader does (`120700:72-88`). A missing key is 400 (D-W5).
   Defensible; one edge case is in m3.
4. Job decisions:
   - Never `queued`: right. Claim bumps the version (`20260830120000:218`) and `decideJobDispatch` skips stale envelopes
     (`dispatch.ts:250-258`). BE00 Consumer Registry limits the bypass to dry-run: "Other registered Job types retain existing stale/future
     event-version rules".
   - `failed` after exhaustion: right. It matches BE00 `platform.job.execute` "exhausted/non-retryable -> failed".
   - Stale-fence CONFLICT then `failed`: harmless, as claimed. The outcome CAS needs version, token, `running` and a live lease
     (`20260830120000:312-314`).
   - `result_ref` (D-W3): the conclusion stands. The binding constraint is `JobStatusSchema.resultRef` strict `{type: JobType, id: UUID}`
     (`job-status.ts:39-43`). The DB only refuses null; it would store the raw answer (`:293`). So the report's "cannot be stored" is imprecise.
   - Retry BOUNDARY: see M2. A dispatch bypass is neither needed nor allowed. The author missed BE00's own terminal-path rules.
5. D-W4 (a foreign Slice 11 reason is now 500): correct under BE03c 1298-1302 (a message not generated by the operation's catalog). It also
   aligns taxonomy with the governed and pattern transports; `review-governed-worker-fix.md:51-56` had recorded that 500-vs-502 split.
   - The branch is operation-agnostic and pinned through CMS-03C-03 (`act-tokens.test:182-193`) and the terms read (`…-reads.test.ts:149`).
   - Leftover inconsistency: m2.
6. Test corrections:
   - #1 (503 → 401, no fetch) is valid.
   - #2 weakens an oracle (m1).
   - #3 (`taxonomy-definition.test-support.ts:159-175`) only adds `readTerms`/`readSelector` stubs, consistent with the new dependency type,
     and no assertion. Accepted. I cannot byte-diff it: the file is untracked.
7. Suites written after the code: discriminating. They assert exact key sets, exact bodies and headers, the witness lineage, the limit and order,
   and 404 vs empty 200, plus exact call counts (3/1). One mutant class survives: `BACKOFF_MS` values. The effect test counts `sleep` calls but
   never checks their durations (`effect.test.ts:138-145`); see M1.

## Findings
M1 `cms-taxonomy-merge-converge-effect.ts:23-24` — **major**.
- Problem: the in-invocation retry is 3 attempts with 250/1,000 ms pauses, so the whole window is about 1.3 s plus call time. The values are
  uncited. They match neither BE00 schedule: 250/750 ms for synchronous retries (BE00 426, 455) or 15/60/300 s for job deliveries (BE00 550, 554).
- Why it matters: there is no recovery after `failed`. A merge requests a job only for its own term, and only when more than 5,000 assignments
  remain (`20261014120400:180-182`). So any dependency or lock outage longer than about 2 s strands the tail permanently. The page then reads
  through the redirect, but assignments never converge.
- Fix: pace retries on the BE00 550 schedule inside the existing invocation budget. Worst case 15 s and 60 s pauses plus 3×15 s calls is
  about 120 s, under 240 s (`invocationBudgetMs`) and under the 200 s heartbeat point of a 300 s lease. Keep it abort-aware. Otherwise root
  ratifies the window. Either way, pin the sleep durations in the test.

M2 Report Open item 1, `cms-taxonomy-merge-converge-names.ts:21-29` — **major (decision input)**.
- Problem: the BOUNDARY asks for "an immutable-origin bypass … or a spec'd re-request command". The bypass is excluded by BE00 Consumer
  Registry ("Other registered Job types retain existing stale/future event-version rules"). It is also unnecessary: the SQL's fresh
  continuation job already gives a redeliverable envelope.
- BE00 already covers the terminal path:
  - 554: "exhausted/non-retryable -> failed" and "job-type runbook required".
  - 571: failed "with a registered non-retryable safe error code and domain recovery reference".
  - 233: a failed job uses a "registered error code".
- The real gaps:
  - (a) no `cms.taxonomy.merge_converge` runbook or recovery trigger. This is the same gap as SQL lane R13.
  - (b) the seven `MERGE_CONVERGE_*`/`CAPABILITY_MISSING` codes are registered nowhere. Compare BE03a DEC-183 for dry-run.
- Also, "the next continuation of the acting party drains them" (report, `names.ts:27`) overstates. That continuation exists only if a later
  merge in the same party itself exceeds 5,000 assignments. It may never happen.
- Fix: reframe the BOUNDARY as BE03c-owned (runbook/re-request plus a registered disposition vocabulary). Drop the bypass option, and add the
  error-code vocabulary to the D-W list for ratification.

m1 `cms-composition-production-taxonomy.test.ts:79-98` — **minor**.
- Problem: correction #2 weakens 503 to `toMatchObject({ ok: false })`. The request is a header-less GET, so the port refuses it at the
  method check (`cms-composition-production-taxonomy.ts:55`), before any authority branch.
- Why it matters: "no implicit allow when auth/rate absent" is no longer exercised for `actTerm`.
- Fix: send a valid POST with key and If-Match, and assert exactly `{ ok: false, status: 401 }` with no fetch.

m2 `taxonomy-definition-response.ts:133` — **minor**. After D-W4, foreign reasons are 500, but `canonical_source_unavailable` on non-03
operations still answers 502 (the old foreign-token rule). CMS-03C-16 never emits it (BE03c 1375). So one transport has two foreign-token
statuses. Fix: 500 by the same BE03c 1298-1302 reading, or record the exception.

m3 `taxonomy-read-query.ts:28,108-112` — **minor**. Selector `limit=999999` is 422 `/limit`, but `limit=1000000` is a bare 400 (the 6-digit
syntax cap). A range fault's status depends on its digit count. Fix: 422 for any canonical integer outside 1-100.

n1 `async-runtime-job-delivery.ts:48-49` — nit. Stale comment "no other effect ever receives a control or the context": the merge effect
now receives the context.

n2 `cms-taxonomy-merge-converge-effect.ts:165-167` — nit. Claim-invalid and missing-context deliveries emit no event. The telemetry header
promises "one … event per delivery".

## Residual risk (informational)
- If an attempt times out but later commits, and the retries then hit its still-held locks (CONFLICT ×3), the job records `failed` although
  the batch converged and the continuation exists. The status is a false negative; the data is correct.
- The 15,000 ms async RPC ceiling against a cold 5,000-row batch is unmeasured (author's Open item 2).
- None of the BE03c 1597 metrics except `cms_taxonomy_merge_total` are emitted anywhere in the Worker. Pre-existing family gap, not this lane's.
- The edit to `cms-editorial-production-boundary-types.ts` (another lane's untracked file) is two union members. It counts as wiring under
  the brief and was disclosed.
- The 502 `retryable: true` change that reaches pattern-instance through the split `safeDetails` came from the hardening lane
  (`lane-worker-hardening-report.md:31-35`), not this lane.

## Requests to root
1. M1: choose BE00-paced in-invocation retries (recommended) or ratify the 1.3 s window. Either way, require a duration oracle.
2. M2: record the BOUNDARY as BE03c-owned (runbook/re-request) and ratify or register the job error-code vocabulary with D-W3. Drop the
   dispatch-bypass option.
3. Ratify D-W1, D-W4 and D-W5 as reviewed above. Fix m1 to m3 in a follow-up pass.

VERDICT: PARTIAL
