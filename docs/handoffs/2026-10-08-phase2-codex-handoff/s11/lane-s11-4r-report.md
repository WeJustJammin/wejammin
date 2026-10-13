# Lane S11-4R report: Worker production adapters vs real PostgREST (Slice 11)

LANE = /home/rob/.codex/worktrees/phase2-slice11/WeJammin. Nothing staged/committed. Own files: apps/worker/src/cms-editorial/**, cms-editorial-production-*, cms-publication-schedule-*, tests/postgrest/phase-02-slice-11-*.apispec.ts, tests/postgrest/support/phase-02-slice-11-*.

## Plan
1. support/phase-02-slice-11-stack.ts: production deps (real session-resolver path via options.auth, real quality gate, real RPC adapters over Kong) + request helpers.
2. support/phase-02-slice-11-world.ts: isolated org with owner(author/editor), reviewer, publisher, outsider; entry+revision through the Worker (CMS-03B-10).
3. Suites per operation family; RED apispec before any adapter fix.

## Checkpoints
(none yet)

## Remaining
everything

### CP1: harness written (not yet run)
tests/postgrest/support/phase-02-slice-11-stack.ts (production deps via options.auth + resolveCapabilities so sessionId/actorPersonId/stepUpAt reach the RPC context; spy fetch records every RPC), phase-02-slice-11-world.ts (isolated org: owner author+editor, reviewer x2, publisher, outsider; seedDraft through CMS-03B-10), phase-02-slice-11-review-chain.apispec.ts (15 -> 05 -> 18 -> 06 -> 16 -> 17). Run 1 queued behind the DB lock (s11-4r-run1.out).

### CP2: four suites written (not yet run; lock held by lane-e2e)
tests/postgrest/phase-02-slice-11-{review-chain,review-refusals,publication,schedule}.apispec.ts + support/phase-02-slice-11-{stack,world,flow}.ts.
Coverage designed: 15/05/18/06/16/17 success+refusals (401 step-up reserves nothing, VERSION_MISMATCH safe versions, revision_not_submittable, dependency_changed, preflight_failed 17 entries via archived entry, 503+Retry-After via broken quality-gate load, capability gates, concealment 404, cursor), 08 (+19 verifier adapter), 09, 07 (UTC/Berlin/fold/gap/horizon/authority), committed refusal (DEC-159(2)) on 06 and 09 via frozen-manifest drift fixture, CMS-03B-20 production sweep (completed / null proof failed_retryable then retry / publisher_authority_ended).
review-refusals is 500 lines: split after first green (400-line limit).
Run 1 = all four files, output s11-4r-run1.out.

### CP3: run 1 (main stack, 4 files): all red at the first Slice 11 call
GET /entries/{id}/workflow (CMS-03B-15) answered 400 INVALID_REQUEST details {} through the real stack; every downstream step cascaded (404 on empty ids). Cause not visible (no RPC trace yet): added [s11-rpc]/[s11-http] console traces to the stack helper; run 2 queued (s11-4r-run2.out). Lane-api lock contended by lane-e2e/lane-db (waits of 15+ min per slot).

### CP4: FIRST REAL-STACK DEFECT (SQL, not mine): safeupdate refuses `delete from pg_temp.cms_manifest_block_refs;`
Trace (api-201601.log): cms_load_quality_gate_input and cms_get_entry_workflow answer 400 SQLSTATE 21000 "DELETE requires a WHERE clause" (authenticator has session_preload_libraries=supautils, safeupdate).
Source: supabase/migrations/20261005017560_cms_dependency_manifest.sql:187 (cms_build_dependency_manifest). Only occurrence of an unguarded DELETE/UPDATE in migrations 2026100100000..2026100501999 (scripted scan). Worker side is correct: it reached both RPCs with the documented members and mapped the 400 to INVALID_REQUEST. NOTES entry 20:25 sent (orchestrator / S11-SR).
Run 3 = same 4 suites with S11_DIAG_OVERLAY=1 (support/phase-02-slice-11-overlay.ts rewrites the statement in the reset DB; diagnostic only, deleted when the migration is fixed) to expose the defects behind it.

### CP5: run 3 (overlay on) - the 6 CMS-03B-05 refusal tests PASS; two further findings
- PASS (real stack, Worker adapter unchanged): 05 VERSION_MISMATCH {expectedVersion,currentVersion}, revision_not_submittable, dependency_changed + dependencyHash, /frozenHash 422, preflight_failed (archived entry, 17 entries, revocation/entry_unavailable), 503 DEPENDENCY_UNAVAILABLE {dependencyClass:'preflight'} + Retry-After via broken load RPC, Worker capability gate 403 / DB capability_missing.
- DEFECT 2 (SQL, S11-3a): cms_submit_review reserves idempotency over the whole p_request incl. server-built evidence -> a lost-response retry (same key, same body, fresh proof) is 409 IDEMPOTENCY_MISMATCH. 20261005017640:158 (07/09 already use `p_request - 'evidence'`). NOTES 20:55. RED test kept: review-chain "[CMS-03B-05] submit ... exactly once".
- HARNESS FACT: CMS-03B-18/owner scopes derive from cms_owner_initialization -> world moved from an isolated org to the bootstrap owner's org (support/phase-02-slice-11-type.ts find-or-create ONE type s11_world). 
- My assertion error fixed: CMS-03B-15 ETag is `"{entryId}:{entryVersion}:{revisionId}:{reviewId|0}:{reviewVersion|0}:{sha256}"` (workflow-read-routes.ts), not sha256-only.
- Run 4 queued (4 suites, overlay on).

## FINAL CHECKPOINT (stopped on coordinator request: account usage exhausted)
No file half-edited; eslint + prettier clean on all new files. Nothing staged/committed. No apps/worker edit was needed so far (no Worker adapter mismatch found).

### Files (all NEW, mine)
tests/postgrest/phase-02-slice-11-{review-chain,review-refusals,publication,schedule}.apispec.ts
tests/postgrest/support/phase-02-slice-11-{stack,world,flow,type,overlay}.ts
Run 4 (4 suites, S11_DIAG_OVERLAY=1) is STILL QUEUED behind the DB lock (pid 2418708, started ~20:40): result lands in ORCH/s11/s11-4r-run4.out and LANE/.lane-logs/api-<stamp>.log (grep "[s11-rpc]" / "[s11-http]" traces for the wire answer behind every Worker status). Nobody needs to act; read it when it finishes.

### Operations: what is verified on the real stack
DONE (run 3, overlay on, GREEN): CMS-03B-05 refusal families through the production Worker adapter -> PostgREST -> SQL: VERSION_MISMATCH {expectedVersion,currentVersion}; revision_not_submittable; dependency_changed + dependencyHash; 422 /frozenHash; preflight_failed with the 17-entry report (archived entry, revocation/entry_unavailable); 503 DEPENDENCY_UNAVAILABLE {dependencyClass:'preflight'} + Retry-After (transport-broken load RPC); Worker capability gate 403 vs database capability_missing. Request members the adapter sends match the SQL contracts for 05 and 15 (no INVALID_REQUEST from the SQL for shape).
WRITTEN, NOT YET RUN GREEN (blocked by defects 1-2 or by the queue): 15 success, 05 success+replay, 18 (success, step-up 401 reserves nothing, reviewer_not_eligible, expiry_out_of_bounds, assignment_exists, revoke, CONFLICT), 06 (success+replay, step-up, Worker gate, assignment gate, VERSION_MISMATCH, review_not_open, committed refusal 200 kind:refusal -> 409 dependency_changed with review kept invalidated), 16/17 (+concealment 404, signed cursor, tampered cursor 409), 08 (+CMS-03B-19 verifier adapter), 09 (success, replay, step-up, capability, separation_of_duties, VERSION_MISMATCH, version_set_stale, frozenHash, committed refusal, 503), 07 (UTC/Berlin/fold/gap/horizon/authority_ends_before_schedule/step-up/503) and the CMS-03B-20 production sweep (completed with real checker evidence, null proof -> failed_retryable then retried, publisher_authority_ended). All of these still need a GREEN run.

### Findings (adapter mismatches: none in apps/worker so far; SQL defects: 2)
1. SQL (S11-SR / 017560:187): `delete from pg_temp.cms_manifest_block_refs;` is refused by PostgREST safeupdate (authenticator role) -> every manifest-rebuilding RPC (load gate, 15, 05, 06, 07, 09, 20) answers 400 SQLSTATE 21000. Until fixed, ALL Slice 11 flows are RED through the real stack. Only unguarded DELETE/UPDATE in migrations. NOTES 20:25.
2. SQL (S11-3a / 017640:158): cms_submit_review reserves idempotency over the whole p_request incl. Worker-built evidence -> a lost-response retry is 409 IDEMPOTENCY_MISMATCH (07/09 already strip evidence). NOTES 20:55.
3. Worker observation (not changed; S10-shared design): mapCmsEditorialRpcFailure maps an unregistered 4xx SQLSTATE (e.g. 21000) to a caller-blaming 400 INVALID_REQUEST details {}; a database fault arguably should be the scrubbed 500. Left for the orchestrator (touches S09/S10 behaviour).
4. Harness fact: CMS-03B-18 and `owner` scopes derive from cms_owner_initialization -> worlds live in the bootstrap owner's org; ONE shared type `s11_world` is added to the owner's content-type list (worker-round-trip pages it; +1 row).

### Remaining
- Let run 4 finish (or re-run) and triage: fix test-assertion mistakes (guessed detail shapes: queue/ETag/violations pointers), then Worker fixes only if an apispec shows a real adapter mismatch (RED first).
- After the SQL owners land defects 1-2: delete support/phase-02-slice-11-overlay.ts and its call in world.ts, run WITHOUT S11_DIAG_OVERLAY; every suite must be green with no overlay (the overlay is diagnostic only, never evidence).
- Split phase-02-slice-11-review-refusals.apispec.ts (500 lines) below the 400-line limit; add rows to tests/postgrest/README.md and a support README line for the five new support modules.
- Unrun: 07 time-authority DB re-check of tzdb_version (Worker pins 2026e vs cms_tzdb_version()), preview_expired replay, preflight_failed for accessibility (needs a rich-text type with a blocking finding), CMS-03B-19 circuit/timeouts, claim/execute stale-lease direct calls, DEC-161 revoke-invalidation.
- Final gates not run: full `lane-api.sh LANE` (S09/S10 + slice-11 apispecs), pnpm type-check / lint / format:check (eslint+prettier on my files are clean).

### CORRECTION (after the final checkpoint)
Run 4 never executed: lane-api.sh printed "[lane-api] lock timeout" (3600 s wait for /tmp/wejammin-supabase-ci.lock, held by lane-e2e / lane-db runs). There is NO run-4 log; no pid is queued any more. The last executed run is run 3 (api-202609.log, overlay on). Remaining item 1 therefore reads: re-queue `S11_DIAG_OVERLAY=1 lane-api.sh LANE <the four phase-02-slice-11 apispecs>` when the lock is free (the suites already contain the post-run-3 fixes: bootstrap-owner world, ETag assertion, paged queue).
