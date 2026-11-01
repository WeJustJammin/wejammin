# Lane claude_s12_coverage_1 report

## Status
GREEN. Narrow coverage of the 26 governed-/pattern- files of the list is 100/100/100/100 (statements 1244/1244, branches 1140/1140, functions 185/185, lines 1084/1084). The whole `apps/worker` suite passed in the same run (737 files, 13,032 tests). eslint (max-warnings 0), prettier --check and `tsc --build` are clean for every file of this lane. HEAD fc62deef, branch claude/phase2-slice12; no git write was run.

## Scope
Every file of `claude_root/coverage-gaps.txt` whose path contains `governed-` or `pattern-` (26 files: 10 production adapters `apps/worker/src/cms-composition-production-{governed,pattern}-*` and 16 `apps/worker/src/cms-composition/{governed,pattern}-*`).

## Runs
Final command (run 2026-10-24 03:21-03:34 EDT from the worktree, 0 exit):

```
pnpm exec vitest run --coverage --coverage.reporter=text --coverage.reporter=json \
  --coverage.reportsDirectory=<scratch>/covfull \
  --coverage.include=<each of the 26 files, listed below> apps/worker
```

Result: `Test Files 737 passed`, `Tests 13032 passed`, coverage summary Statements 100% (1244/1244), Branches 100% (1140/1140), Functions 100% (185/185), Lines 100% (1084/1084), exit 0 (the 100% global thresholds of `vitest.config.ts` were applied to the narrowed include and met). `vitest.config.ts` was not touched.

The 26 files: cms-composition-production-governed-review{,-errors,-ports,-rpc}.ts; cms-composition-production-pattern-{definition,definition-latest,errors,update,update-failure,update-rpc}.ts; cms-composition/governed-activation-routes.ts, governed-activation-time-details.ts, governed-review-{command-routes,errors,ports,read-routes,response,routes}.ts; cms-composition/pattern-{definition-latest-routes,definition-ports,definition-response,definition-routes,instance-details,update-answers,update-details,update-ports,update-response}.ts.

(An earlier full run overlapped my splitting two test files that were over 400 lines and showed stale gaps; it was discarded and the run above is on the final bytes.)

## Product changes (all provably dead branches, no behaviour change; no `v8 ignore` was used)
Each replaces a defensive `isRecord(payload) ? payload.details : <fallback>` whose fallback arm cannot be reached: a Slice 12 reason token is parsed only from a record whose `code` is `P0001` (or, for the update mapper, `tokenOf` returns a non-null token only for a record), so `payload` is a record wherever the ternary stood. Replaced by `(payload as Readonly<Record<string, unknown>>).details` with the proof as a comment.
- `cms-composition-production-governed-review-errors.ts` (was line 72, detail of a time/canonical refusal).
- `cms-composition-production-pattern-definition-latest.ts` (DEC-210 block-rules refusal of CMS-03C-12).
- `cms-composition-production-pattern-errors.ts` (DEC-210 block-rules refusal of CMS-03C-02).
- `cms-composition-production-pattern-update-failure.ts` (two sites: block-rules refusal and `refusal(detail)`).
- `cms-composition/governed-review-read-routes.ts` `parseQueue`: `String(parsed.error.issues[0]?.path[0] ?? '')` and `QUERY_KEYS.has(member) ? member : ''` replaced by `String(parsed.error.issues[0]!.path[0])`. Proof: `GovernedReviewQueueQuerySchema` is a strict object over exactly `QUERY_KEYS` (`packages/contracts/src/cms-composition/governed-review-read.ts` queueQueryShape) and unknown keys are refused as 400 before the parse, so a failed parse always carries a first issue whose path starts at one of those members.
(`git diff` also shows lane-2 changes in `cms-composition-production-related-rpc.ts`, `-locale.ts`, `taxonomy-definition-response.ts`, `production-job-effect-dispatcher.ts`, `cms-editorial-production-error-details.ts`: not mine.)

No defect (code contradicting spec) was found, so no failing-test-first fix was needed.

## Test corrections
None. No existing test file was edited.

## Files (new test files, all created by this lane; none exceeds 400 lines)
- `apps/worker/src/cms-composition-production-governed-review-rpc.coverage.test.ts` (350 lines) cb6e451ee755530264f6590d981514edad3648260b2111c9711619d51765a174
- `apps/worker/src/cms-composition-production-governed-review.coverage.test.ts` (254 lines) a51e6a863b483df2573fb029d517ed7e8e18c1444d21bc7885af237be8c6d931
- `apps/worker/src/cms-composition-production-pattern-edges.coverage.test.ts` (290 lines) b027d2eb730e088013096306ba06168dab76a4ee56919e989f42dc7a6191cac9
- `apps/worker/src/cms-composition-production-pattern-transport.coverage.test.ts` (214 lines) 3b5cddb8b04a432e0e1df2bef4f18d49506f56e0c2106389f7810c7ba31f4bfe
- `apps/worker/src/cms-composition-production-pattern-update-rpc.coverage.test.ts` (106 lines) 4e39e33d8da8742e4bc39b19d2af47dfa328d5a260f701254733be55e626d3a4
- `apps/worker/src/cms-composition/coverage-abort.test-support.ts` (35 lines) f4ae6abdaeeaa382104ad84a12686b0bbfebac7a20c3f27d7b141e011fb2f05a
- `apps/worker/src/cms-composition/governed-review-edges.coverage.test.ts` (349 lines) bb01ca4d2c1059e3d442f43511b540538b02ee20c40af5ebd6a4313abc4f420e
- `apps/worker/src/cms-composition/governed-review-route-edges.coverage.test.ts` (188 lines) dd2349f6ffbf90dd4afd4ffc62962f32674949a0a2e71569ddac6d86d178d4d0
- `apps/worker/src/cms-composition/pattern-definition-edges.coverage.test.ts` (284 lines) e1251d2367e73e4f7d0894ba5a2b7c0b39868e70432150796f69886f1ead5d3e
- `apps/worker/src/cms-composition/pattern-definition-route-edges.coverage.test.ts` (246 lines) 2c4b6f08a2315679fb23b4d157ac63929c0d1acc5ef8ea80f9cf2b9d1d31d013
- `apps/worker/src/cms-composition/pattern-update-edges.coverage.test.ts` (144 lines) 2e43685f7c1ed3cfb630797f81c354ea72d206a1af94ccd7aad44ed6d1579e7d

Product files changed (SHA-256 after change):
- `apps/worker/src/cms-composition-production-governed-review-errors.ts` e80dfe28699ebaabcd8741d9f08acaaed8bb9a30c6cd96dff9410de123ed0c30
- `apps/worker/src/cms-composition-production-pattern-definition-latest.ts` ec97f72f8f3265fa0069c0d4e8003ad944c16b39ed70dc7edae178ab292e18a6
- `apps/worker/src/cms-composition-production-pattern-errors.ts` 8856e67ab35c67391e2acee457f9a5bac4f0cf34b9e2114fb820edbd5fcdc866
- `apps/worker/src/cms-composition-production-pattern-update-failure.ts` e17489b913af4bacada7493da685f3b7218d47eb546f8361fa176e6be8f73525
- `apps/worker/src/cms-composition/governed-review-read-routes.ts` 2652dfd9789ca3ec4dc35038a90ac7122e92b36d1c2a2d450eefa1743be0a9dd

## What the new tests assert (spec: BE03c rows 168-173 governed review, CMS-03C-12 pattern definition, CMS-03C-13/14/15 linked update; BE00 transport and quota fail-closed; BE03c 1298-1304 token mapping)
- `cms-composition/pattern-definition-edges.coverage.test.ts`: `patternSession`/`patternAdmission` fail closed (502 malformed envelope or decision, 401 null session, 503 throwing quota with retry 15, 504 abort between or after quotas); `patternErrorResponse` (unpublished status becomes scrubbed 500, canonical version operands only, 429 default 60 s window with no rate headers, 503 default 15 s, no members from non-record details); `runPatternRoute` (pre-aborted 504 with no handler call, handler throw 500, telemetry sink rejection or throw never replaces the response).
- `cms-composition/pattern-definition-route-edges.coverage.test.ts`: OPTIONS preflights of CMS-03C-12 and the latest read (allowed origin 204 with method and header allowlists, foreign or missing origin 403, malformed key 400), query string on the write 400 before quota and RPC, abort after admission 504 with no port call, port throw 503, malformed envelope 502, draft or detail that does not honour the request 502, minted request id on a request without `x-request-id`.
- `cms-composition/governed-review-edges.coverage.test.ts`: the same fail-closed matrix for `governedSession`/`governedQuota`; `governedErrorResponse` (repeated request pointer named once, non-record details, unregistered canonical domain dropped, registered domain relayed, 429 window, budget overrun scrub); `governedTimeDetails` ignores non-record violation entries; `runGovernedRoute` lifecycle.
- `cms-composition/governed-review-route-edges.coverage.test.ts`: for each of CMS-03C-06/07/08/09/10/11 through the real production harness with only the PostgREST fetch and session faked (ports overridden only to inject faults): minted request id, port throw 503 with retry 15, non-envelope 502, successful answer that does not honour the request 502, abort after the quotas 504 with no port call; CMS-03C-09 schedule with a throwing Time authority is 503 with no RPC, non-schedule actions never consult it.
- `cms-composition/pattern-update-edges.coverage.test.ts`: non-record refusal sources keep no member (CMS-03C-02 and CMS-03C-15), DEC-193 resolved-row validation rejects detached-retired and linked-superseded rows, `patternUpdateAdmission` aborted as the party quota settles is 504, `patternUpdateError` 429 default window and rate headers.
- `cms-composition-production-governed-review-rpc.coverage.test.ts`: `callGovernedRpc` (null or non-object session 401, missing owner capability 403, oversize payload 400, verifier throw 503, verifier refusal relayed, deadline pre-passed 504, abort while the verifier is pending or as it answers 504, registry 8 s read deadline narrows a longer configured one, stalled body 504, non-JSON success 502 with body released, rejecting body cancel swallowed, unserialisable payload 503 or 504 when aborted).
- `cms-composition-production-governed-review.coverage.test.ts`: composition refuses a zero, fractional, non-finite or over-15 s deadline and a zero or fractional budget; runtime fetch used when none is injected; the four write ports re-parse their input and refuse 400 without a network call; a committed `dependency_changed` refusal emits the separate `.invalidated` event with `cms_governed_review_invalidated_total{reason="dependency_changed"}` and keeps it out of the request event.
- `cms-composition-production-pattern-edges.coverage.test.ts`: foreign editorial reasons (Slice 11 tokens) are scrubbed to 500 by CMS-03C-12, the latest read, CMS-03C-02 and the governed reviews; `placementRpcError` INTERNAL_ERROR and unpublished Slice 12 reasons 500; linked-update token mapping without a message; pattern definition composition (invalid config, runtime fetch, 400 on wrong operation or invalid body or key); linked-update runtime fetch and composition-instances 400.
- `cms-composition-production-pattern-transport.coverage.test.ts`: `callPatternRpc` 401, 403 (no party, no designer), idempotency key and strong If-Match only when a parent version is named, verifier throw 503, pre-aborted 504, abort between verifier answer and continuation 504, unserialisable payload 503 or 504, rejecting body cancel swallowed.
- `cms-composition-production-pattern-update-rpc.coverage.test.ts`: the same transport faults for `createPatternUpdateRpc`.
- `cms-composition/coverage-abort.test-support.ts`: quota seam that aborts the caller one microtask hop after the quota helper's own final abort check, so the route's own post-admission check answers 504.

## Open items / BOUNDARY
None.

## Requests to root
- Root reruns the evidence receipts for any cited file; no existing test file was edited, only new files above.
- The `apps/worker` whole-suite run was done with the narrowed 26-file include; root's canonical `pnpm validate` still has to confirm the global 100% once lane 2 lands.
