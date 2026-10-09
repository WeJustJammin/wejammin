# Lane S11-4 report: Slice 11 Worker/API runtime

LANE = /home/rob/.codex/worktrees/phase2-slice11/WeJammin (claude/phase2-slice11). Nothing staged or committed. No SQL, web or packages/contracts edits.
Sub-lane S11-4a (apps/worker/src/cms-editorial/a11y-structural/**) is delegated to a background agent; its checkpoints are in lane-s11-4a-report.md.

## Design (ratify / override)
- Slice 11 browser routes share one admission kit (apps/worker/src/cms-editorial/workflow-command.ts, workflow-read.ts) instead of nine copies; per-operation modules supply only
  path/body schemas, cross-checks, port selection, response invariants and headers. Registry row (`cmsEditorialRoutePolicies`) is the single source of method/path/status/rate/deadline/tier/etag/location.
- Admission order (commands): origin -> media/length -> CSRF -> bytes -> session -> query -> path -> body -> cross-checks -> capability gate (only `gate: capability`) -> step-up (only `stepUp: required`, 401 STEP_UP_REQUIRED, before rate, idempotency and RPC) -> rate (user+party) -> headers -> pre-RPC stages (time authority for 07; accessibility evidence for 05/07/09/15) -> port.
- Server-built `evidence` (PreflightEvidence | null) rides on the port input and the RPC body; absent evidence is sent as null and the database reports `accessibility` unavailable/checker_failed (DEC-150).
- Typed refusals: reason tokens filtered per operation by `policy.reasonCodes` and status by `cmsSlice11ReasonStatus`; structured members validated by `CmsEditorialRefusalDetailsSchema`.

## Checkpoints

### CP1 (resumed after the 15:40Z reboot; files intact): shared kit + error boundary + telemetry + commands 05, 06, 07, 08, 09, 18
New (apps/worker/src/cms-editorial): workflow-errors.ts (+test 41), workflow-admission.ts, workflow-command.ts, workflow-support.ts, workflow-time-authority.ts (+test 4),
 workflow-telemetry.ts (+test 11), review-submit-routes.ts, review-decision-routes.ts, schedule-routes.ts, preview-routes.ts, publication-routes.ts, review-assignment-routes.ts, workflow-routes.ts,
 tests workflow-command-admission.test.ts (160 = 6 commands x the whole BE00 admission order), workflow-command-operations.test.ts (20), workflow-schedule-time.test.ts (15), workflow-error-response.test.ts (4),
 support workflow-fixtures.test-support.ts, workflow-harness.test-support.ts.
Edited (additive): types.ts (nine ports, qualityGate + timeAuthority deps, rate-limit operationId = full CmsEditorialOperationId), port-inputs.ts (nine port inputs), route-errors.ts (Slice 11 rows publish through
 normalizedWorkflowError and are serialized unflattened), route-telemetry.ts (Slice 11 metrics; cms_revision_created_total now keyed to the four revision-creating operations, behaviour unchanged for S10), index.ts (mount + type exports).
RED observed: workflow-errors (module absent), workflow-error-response (3 of 4 failed: step-up flattened to UNAUTHENTICATED, details dropped), workflow-telemetry (9 of 11 failed), workflow-command-admission (158 of 160 failed: 404, no route).
 Op-specific suites (operations, schedule-time) were written after the route modules; sensitivity proven by mutation (dropping the schedule audience invariant fails the suite; reverted).
GREEN: all 70 files / 1227 tests in apps/worker/src/cms-editorial; narrow coverage (workflow-*, review-*, schedule/preview/publication routes, route-errors, route-telemetry) = 100% stmts/branches/functions/lines. eslint + prettier clean.
Decisions inside the lane (override welcome): step-up is evaluated after the capability gate and before quota (content-schema-registry authorize order); a 403 without a registered typed token publishes empty details
 (origin/CSRF denials are not capability_missing); If-Match vs body expectedVersion disagreement is 400 (workflow-requests contract comment), path-vs-body id disagreement is 422; Location values:
 05 /api/v1/cms/reviews/{id}, 07 /api/v1/cms/publication-schedules/{id}, 09 /api/v1/cms/publications/{id}, 18 create /api/v1/cms/reviews/{reviewId}/assignments/{id} (no GET exists for 07/09/18, same as S10 revisions);
 07 pre-RPC order = time authority (E8) then accessibility proof; CMS-03B-09 accepts an active or superseded publish row (replay after a newer publish); accessibility proof absent => evidence null (DB reports unavailable/checker_failed).
Known type errors (production adapter not yet extended; fixed in the production step): production rateLimit operationId union in cms-editorial-production-*.test.ts / production-worker-runtime-cms.ts.

### CP2: safe reads CMS-03B-15, 16, 17 (shared read kit)
New: workflow-read.ts (kit), workflow-read-routes.ts (15), review-detail-routes.ts (16), review-queue-routes.ts (17), workflow-read-routes.test.ts (83 = 3 reads x BE00 order + op-specifics); fixtures extended (workflowResource, reviewDetailResource, queuePage).
 RED->GREEN: the suite was written against the already-built read kit (no separate RED; the kit's first run failed 5 tests for genuine reasons, fixed: origin refusal on the queue row (403 is undeclared there) now goes through the middleware path, GET-with-body case not constructible).
 Middleware refusals (CORS origin, CSRF) are published as the BE00 403 on every row via the Slice 10 normalizer (a row that declares no 403, CMS-03B-17, must not turn an origin refusal into a 500).
 Closed query keys (15: revisionId; 16: none; 17: cursor/limit/scope/state), limit digits 1..50, cursor 1..512; validators: 15 `"{entryId}:{entryVersion}:{revisionId}:{reviewId|0}:{reviewVersion|0}:{caller-scoped sha256 of the exact body}"`, 16 `"{review.version}"`, 17 `"{pageVersion}"`.
 Queue page invariants: <= limit rows, state filter honoured, assignmentEndsAt only for scope assigned, no empty cursor.
 Gates: narrow coverage 100% on all new files; tsc clean for apps/worker except the production adapter files (next step); eslint clean over apps/worker/src/cms-editorial.
S11-4a (a11y-structural) finished: 352 tests / 16 files, 100% narrow coverage; see lane-s11-4a-report.md.

### CP3: production layer, quality-gate adapter, CMS-03B-19 verifier, CMS-03B-20 sweep, principals
New (apps/worker/src): cms-editorial-production-workflow.ts (port shape guard + committed-refusal disposition), cms-editorial-production-quality-gate.ts (service load RPC cms_load_quality_gate_input + composed browser gate + redacted log),
 cms-editorial-production-preview-verifier.ts (CMS-03B-19 port+adapter: Worker-side SHA-256 of the token, 500 ms, retries 75/150 ms, 30 s circuit, byte-identical denial), cms-publication-schedule-rpc-names.ts, cms-publication-schedule-rpc.ts
 (claim/execute port, strict contract parse, CmsScheduleResponseError), cms-publication-schedule-sweep.ts (every minute, batch 25, checker -> JCS-bound evidence -> execute with the claim's schedule version and lease).
Edited (additive): cms-editorial-production-{types,ports,session,session-rpc-body,errors,error-details,error-tokens,telemetry}.ts and cms-editorial-production.ts (9 operations: RPC map, deadlines, quotas, rate classes, typed Slice 11 tokens incl. STEP_UP_REQUIRED,
 object-DETAIL structured members, evidence merged after the browser members, qualityGate composed), async-runtime-rpc-types.ts (two RPC names), index.ts (scheduled wiring after the edit-presence sweep, before the alerts), cms-editorial/route-stages.ts (the gate marks the RPC stage).
Tests (new): cms-editorial-production-workflow{,-guard,-refusals,-telemetry}.test.ts, cms-editorial-production-quality-gate.test.ts, cms-editorial-production-preview-verifier.test.ts (11), cms-publication-schedule-rpc.test.ts (13),
 cms-publication-schedule-sweep.test.ts (12), cms-publication-schedule-sweep-wiring.test.ts (4), cms-editorial-principals.test.ts (6: only the sweep imports the claim/execute port, nobody but the future delivery adapter imports the verifier,
 neither internal RPC nor the load RPC appears in apps/web, and the mounted browser routes equal the 18 registry rows exactly with no internal route).
Existing-test cascade (harness-only, because the sweep is one more RPC per scheduled tick; the cited S09 files go stale, orchestrator refreshes receipts): index-scheduled.test.ts (6->7 calls, claim answers []),
 scheduled-manual-review-retry.test.ts (module mocked like its siblings), production-idempotency-expiry-sweep.test.ts (operationalResponse answers the claim). No assertion was weakened or removed.
Verification: whole-worker run (488 files / 7230 tests) was green before the wiring; after the wiring the only failures were the three scheduled-tick harness files above (fixed). Narrow coverage of the touched files: see CP4 below.
Decisions: the quality-gate load is a NEW RPC (NOTES entry lists its exact contract); typed refusals that must commit travel as an HTTP 200 `kind: refusal` disposition; raised refusals may carry an OBJECT DETAIL (NOTES: ratify, the Slice 10 rule said arrays only);
 an execution failure is never retried by the Worker (outcome unknown: the lease and the database ladder decide); the sweep sends evidence null when the gate fails (needs ExecuteScheduleRequest.evidence nullable: NOTES, S11-1).

### CP4: gate evidence and a defect the real logger caught
- Real-logger tests (cms-editorial-production-workflow-logging.test.ts) found that `riskClass` is not a legal metric label name (the shared logger drops the WHOLE event: lowercase [a-z][a-z0-9_]{0,31} only):
  RED 4 invalid_log_event diagnostics, fixed to `risk_class` (NOTES asks S11-1 to rename it in the runbook).
- Test files split to stay under the 400-line limit; source files all <= 300 lines (largest workflow-command.ts 289).
- Targeted run (106 files / 1615 tests green: cms-editorial, production adapter, sweep, scheduled handler tests): every line I added is covered; the only uncovered lines in the included files are pre-existing and exercised by other
  suites outside that run (cms-editorial-production-error-details.ts:113 delete recoveryAction, index.ts:99-107 https redirect). A full-worker run was 488 files / 7230 tests green before the scheduled wiring; after it the three
  scheduled-tick harness files were repaired (listed in CP3) and re-run green. conflict-routes.test.ts 'aborts the resolve port when cumulative stage latency...' is a wall-clock assertion (<240 ms) that flaked once at load average 15; it passed on re-run.
- apps/worker: eslint clean, tsc clean (`tsc --noEmit -p apps/worker`), prettier clean; repo-wide `pnpm lint` exit 0, `pnpm format:check` exit 0, `pnpm type-check` fails ONLY in apps/web (lane S11-5 in-flight:
  CmsEditorialReviewSubmitForm.test.tsx, CmsWorkflowCommandFrame.test.tsx, CmsWorkflowFields.tsx, cms-workflow-command-specs.test.ts); no error in apps/worker or packages/contracts.
- Op-specific suites (operations, schedule-time, production workflow) were written after the modules they cover (the admission, error, telemetry and logging suites were RED first); sensitivity was proven by mutation
  (schedule audience invariant, principal import) and by the logging RED above.

## Remaining
- Real PostgREST verification (ORCH/bin/lane-api.sh) once lanes 3a/3b/3c land the wrappers, including the NEW cms_load_quality_gate_input and the object-DETAIL / committed-refusal conventions (NOTES entry).
- Evidence wave: tag/cite these tests against P2-S11-AC-005..034, 049..084, 098..106; S09 receipts for index-scheduled / scheduled-manual-review-retry / production-idempotency-expiry-sweep tests are stale (refresh).
- S11-1: ExecuteScheduleRequest.evidence nullable; runbook metric label risk_class. Orchestrator: ratify the object-DETAIL and committed-refusal conventions, the 50 ms cpu_ms watch on the minute tick.
