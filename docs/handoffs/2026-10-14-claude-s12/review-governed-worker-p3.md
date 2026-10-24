# Review: lane `claude_s12_governed_worker` phase 3 (CMS-03C-09 route, CMS-03C-19 sweep)

Reviewer: independent, adversarial (did not author). 2026-10-14, worktree HEAD `b16edb54` (uncommitted files).
Target report `lane-governed-worker-report.md` SHA-256 `8f9ece7e…7942b7e9` re-verified equal before review. Template item 5
(file re-hash) skipped as instructed. Read-only; only this file written.

## Runs (pinned PATH, `flock -s /tmp/wejammin-quiet.lock`)
| what | result |
|---|---|
| `vitest run cms-composition/governed- cms-governed-activation scheduled-manual-review-retry cms-publication-schedule-sweep index-scheduled production-idempotency-expiry-sweep` | 38 files, 950/950 |
| `vitest run cms-composition/governed-` | 25 files, 829/829 (report's 24-file count predates the admission/gate split it records; same 829) |
| `vitest run cms-governed-activation` | 5 files, 62/62 |
| `apps/worker: tsc --noEmit` | exit 0 |
Not re-run (outside allowed execution): joint 345, full Worker 10,851, eslint/prettier, the three `tests/` files.

## Clause map: BE03c row 171 / registry row `platform-registries.ts:2020-2040`
| clause | implemented | tested |
|---|---|---|
| POST `/governed-reviews/{reviewId}/activation`, 15,000 ms, Tier 2, statuses | `governed-review-policy.ts:135-159` | `governed-review-registry.test.ts` (pins row 2023 + OpenAPI) |
| strict body, discriminated `action`, `activateAt` only on schedule, `reason` only on retire | `command-routes.ts:139-140` (contract schema) | `governed-activation-admission.test.ts:47-114` |
| key + strong If-Match == `expectedVersion` (400) | `command-routes.ts:147-156` | `admission.test.ts:116-137` |
| any-of owner capability 403; hidden/absent 404 from SQL | `ports.ts:176-194`; SQL `070400:79-90` | `gate.test.ts:29-46`; tokens table `NOT_FOUND`/`capability_missing` |
| unconditional recent MFA, 401 before quota and reservation, all three actions | `ports.ts:193`, re-proved `production-governed-review-rpc.ts:58-59` | `gate.test.ts:48-96`; `governed-activation.test.ts:233-241` |
| quotas 20/min user, 40/min party | `policy.ts:139-140`, `ports.ts:200-256` | `gate.test.ts:123-190` |
| pinned-tzdb Time authority, schedule only, after quotas, 503 without authority | `governed-activation-routes.ts:38-62`, `command-routes.ts:165-171` | `governed-activation-time.test.ts:127-277` |
| 200 activate/retire, 202 schedule; ETag = `reviewVersion`; Location = review; no-store | `activation-routes.ts:94-102`, `validate.ts:98-118` | `governed-activation.test.ts:33-46,141-153,243-249` |
| CAS binding: activate +1, schedule unchanged + instant within 1 ms | `validate.ts:106-117` | `governed-activation.test.ts:97-138,174-204` |
| committed refusal envelope → 409 `{reasonCode}`; any other shape 502 | `production-governed-review-errors.ts:113-142` | `governed-activation-refusals.test.ts:52-110` |
| `canonical_source_unavailable` 422 + mandatory `details.domain` (else 502) | `production-…-errors.ts:91-103` | tokens table rows 'canonical_source_unavailable' |
| 03b time tokens 422 with typed members (missing member → 502) | `governed-activation-time-details.ts:32-50`, `production-…-errors.ts:79-90` | tokens table `TIME` rows |
| `retire` forwarded unchanged, SQL `VALIDATION_FAILED ["/action"]` → 422 at `/action` | no special case (`activation-routes.ts:85-93`) | `governed-activation.test.ts:207-231`; `refusals.test.ts:36-49` |
| events (only on committed activation) | SQL; Worker binds `eventType` via the contract refine | `activation.test.ts:130-138` (schedule-shaped answer refused) |

## Clause map: BE03c row 188 / OD-6 (1328) / BE03b 179, 1892
| clause | implemented | tested |
|---|---|---|
| `scheduled` participant, failure surfaced, manual-review-only → `noRetry` | `index.ts:215-266` | `cms-governed-activation-sweep-wiring.test.ts:73-166` |
| claim `batch` 1–100, default 25, strict distinct claims ≤ batch | `cms-governed-activation-rpc.ts:35-71`, `sweep.ts:139-144` | `rpc.test.ts:34-90`; `sweep.test.ts:29-46` |
| execute `{scheduleId, expectedVersion: claim.expectedVersion, leaseId}`, no evidence | `rpc.ts:79-101` | `rpc.test.ts:101-133`; `sweep.test.ts:51-96` (scheduleVersion 11/12 ≠ expected '3') |
| one 15,000 ms job deadline shared by claim and executes; none started after it | `sweep.ts:186-212` | `sweep-deadline.test.ts:77-192` |
| claim failure → tick retry; manual review recorded + rethrown | `sweep.ts:131-164` | `sweep.test.ts:229-270`; `deadline.test.ts:77-100` |
| execute failure logged, never retried (lease + ladder decide) | `sweep.ts:105-124` | `sweep.test.ts:147-227` |
| ids as `sha256:` only; secret never logged; closed metric labels | `sweep.ts:47-58,85-101` | `sweep.test.ts:86-96,167-174` |
| only the sweep imports the port; names isolated for the RPC union | `cms-governed-activation-rpc-names.ts`, `async-runtime-rpc-types.ts:28` | `cms-governed-activation-import-graph.test.ts` |

## Rulings on the asked questions
- **Ordering.** Origin/media/CSRF → bytes → session → path/query → strict body (422) → key/If-Match (400) → capability (403) → MFA (401) →
  user, party quota → Time authority (schedule) → port. MFA precedes every quota and every reservation (BE03c 216). Capability-before-MFA
  differs from the SQL's step order (1326 (1)) but matches the CMS-03B-07 Worker precedent (`cms-editorial/workflow-command.ts:206-208`)
  and phase 2; the 403 is uniform for every reviewId, so no existence oracle. Accepted. Time authority via `prepare` after the quotas mirrors
  `cms-editorial/schedule-routes.ts:49-53`.
- **ETag.** Activate: expected+1 (BE03c 215 "an activation [advances]"). Schedule: unchanged — 215 does not list scheduling, SQL
  `070400:206` echoes `v_review.version`. Correct.
- **Sweep conformance.** Batch 25, one 15,000 ms job deadline, claim failure → platform retry, execution failure logged and not retried:
  each is BE03b 179/1892 for CMS-03B-20 and BE03c 188/1328 imports it ("same claim, lease, retry ladder and idempotency"). Conformant, and
  line-for-line the 03b sweep minus evidence.
- **expectedVersion source.** `claim.expectedVersion` (immutable review version), matching governed-b `## RPC boundary` item 3 and SQL
  `070600:111,126`. The mutant (`scheduleVersion`) is killed by two independent tests.
- **Edits to existing tests: non-weakening.** `scheduled-manual-review-retry` and `cms-publication-schedule-sweep-wiring` add a mock of the
  new participant and resolve it (existing assertions untouched); `index-scheduled` counts 6→7, 7→8 and adds one RPC name (strictly
  stronger); `production-idempotency-expiry-sweep` stubs the new claim `[]`. No assertion removed or loosened.
- **`review_not_open` on CMS-03C-09: NOT authorized by the spec as written** — see finding 1. BE03c 1304 fixes each token's single status
  ("keeps it on every operation that raises it"); which operation raises which token is the per-operation matrix (1262, 09 row: no
  `review_not_open`) and the frozen `CMS_SLICE_12_OPERATION_REASONS['CMS-03C-09']` (`refusals.ts:166-175`). 1326 step 4 names the committed
  outcome of 09 exactly: "the RPC returns the outcome `invalidated`, answered 409 … `details.reasonCode` `dependency_changed`". The SQL's
  envelope (`070400:165-167`, `review_not_open` for the `reviewer_authority_changed` verdict) deviates from 1326; the Worker's `COMMITTED_ONLY`
  then publishes an off-contract token. Status 409 is consistent with 1304, so an amendment would be status-safe — but it needs a root DEC.

## Findings
1. `apps/worker/src/cms-composition/governed-review-errors.ts:52-60,75` with `cms-composition-production-governed-review-errors.ts:114-117,136`
   — **major** — 09 publishes 409 `{reasonCode:'review_not_open'}`, a token outside the frozen 09 reason list, BE03c 1262 and 1326 step 4.
   Reachable in production whenever an approver loses authority between approval and activation. Cross-layer drift is concrete: the Web
   governed proxy filters by the same frozen list (`apps/web/src/server/cms-governed-review-platform-error-details.ts:136-143,205-207`)
   and would publish `{}` for this 409 once 09 is proxied. Correctly isolated and flagged by the author (Decision 1, Open 2, Request 2),
   but lane rules make the contract frozen and bar inventing behavior where the spec speaks. — Fix direction (root rules one):
   (A, spec-literal, recommended) governed-b fix-forward: the 09 envelope answers `dependency_changed` for both invalidation verdicts (the
   review row still records `reviewer_authority_changed`); then delete `COMMITTED_ONLY` and change the two 09 envelope test rows
   (`governed-activation-refusals.test.ts:53-78`) to `dependency_changed` only, plus a test that a `review_not_open` envelope on 09 is 502.
   (B) DEC amending BE03c 1262 + 1326 step 4, the contract list and FE03; then `COMMITTED_ONLY` is redundant and is deleted.
2. `apps/worker/src/cms-composition/governed-review-validate.ts:93-97,117` — **minor** — the `retire` success binding requires
   `reviewVersion = expected + 1` and cites "BE03c 216" (that line is the MFA rule). BE03c 215 lists decision, invalidation and activation
   as the version-advancing events; retirement "needs no review" (1326, 1492). The rule is invented for a held action and pinned by
   `governed-activation.test.ts:243-249` (ETag `"4"`). The report's "The Worker needs no change when the owner decides" is therefore
   unproven. — Fix: until the owner decision, bind retire on review id, action and `subjectState` only (or record it as a BOUNDARY that
   changes with the policy), correct the citation, and drop the version assertion from the retire-success test.
3. `supabase/migrations/20261014070400_cms_activate_governed_subject.sql:138-140` vs `CmsGovernedTimeRefusalDetailsSchema` — **minor**
   (unreported gap) — the promoted SQL raises `resolved_utc_mismatch` without the contract-mandatory `expectedUtc`, so the Worker answers
   every SQL-side occurrence 502 (pinned in `governed-activation-tokens.test-support.ts` row 'as the producer raises it'). Fail-closed is
   right and the path is unreachable after the Worker's exact check (tz offsets lie inside the SQL's −12…+14 h window), but the SQL/contract
   mismatch is in neither Open items nor Requests to root. — Fix: add it to the report's open items for governed-b/root.
4. `apps/worker/src/cms-composition-production-governed-review.ts:121-136`; `cms-governed-activation-sweep.ts:45,53-58` — **minor** —
   BE03c 1597 `cms_governed_activation_total{subject_kind,action,outcome}`: the HTTP route (the only producer of the spec's `action`
   values activate/schedule/retire) emits none; the sweep emits it with an off-spec `action="execute"` (author Decision 3). Same gap for
   the 06–08 metrics (lane-wide, pre-existing). — Fix: root tracks one observability item: route telemetry emits the metric with
   `action = body.action`; record the sweep's label value in the spec or DEC.
5. `apps/worker/src/cms-governed-activation-sweep.ts:127-225` vs `cms-publication-schedule-sweep.ts:189-287`, and
   `cms-schedule-sweep-support.ts:11-54` vs `cms-publication-schedule-sweep.ts:52-91` — **minor** — the tick runner (deadline, claimOrRetry,
   start loop, unstarted and completed logs) and the three helpers now exist twice (extensibility "if you wrote it twice, extract it").
   The 03b file is outside the lane claim; the author asked root to migrate the helpers (Request 3) but not the runner. — Fix: root
   extracts one schedule-tick runner parameterized by operation, claim and execute when it migrates the 03b sweep.

## Notes (no action in this lane)
- A lost-response replay of `schedule` re-runs the Worker Time authority before the RPC, so a replay after the lead/horizon moved answers
  422 instead of the stored 202 (BE03c 1590 "replays by idempotency/status"). Identical in CMS-03B-07 (`schedule-routes.ts:49-53`); a client
  reconciles through CMS-03C-10. Root may want a spec note for both.
- Tests are non-vacuous on every point checked: each binding has a negative oracle (502 rows), ordering tests assert `rateLimit`/`fetch`
  untouched (`expectNoWork`), the replay test compares RPC bytes, and the sweep tests distinguish review and schedule versions.
- No `any`, TODO, skip or only in new code; every new file ≤ 300 lines (`governed-review-ops-tokens.test-support.ts` exactly 300).
- Report claims checked and true: report SHA, focused counts (829, 62), tsc 0, retire open owner decision recorded, registration files
  listed. Unverifiable here: joint 345, full suite, lint/format, mutant runs (mutants plausible by reading: each named mutant has a
  killing assertion I located).

## Summary
Route and sweep are faithful to the promoted SQL, the 03b precedents and the registry row; the sweep is conformant with BE03b/BE03c and
uses the immutable review version; the four existing-test edits only strengthen. One major item stands: the Worker widens the frozen
CMS-03C-09 reason list with `review_not_open` against BE03c 1262/1326 step 4 — a root ruling (A or B above) is required before CLEAR.
Minors 2–5 are latent or bookkeeping.

VERDICT: PARTIAL
