# Slice 11 review A: refuting the evidence ledger (2026-10-11)

**Reviewer:** independent reviewer A. I wrote none of the code, tests or ledger.

**Worktree:** `/home/rob/.codex/worktrees/phase2-slice11/WeJammin`, branch `claude/phase2-slice11`, HEAD `7ca0d9cd`.

**What I did:** read-only, per `review-brief.md`. I ran no test, pnpm, node, database or state-changing git command. This report is the only file written.

**How:** I ran the mechanical checks with read-only `python3`/`grep` over the four ledger fragments. Four read-only sub-reviewers then read test bodies and production code, one per ledger quarter. I re-checked every sub-reviewer finding rated major or higher against the source myself before keeping it. One sub-reviewer finding was rejected; see the end of §3.

**Scope:** 122 criteria (113 verified, 7 partial, 2 unverified), 725 clauses (661 in verified entries) and 3,498 citations: 1,816 vitest, 1,591 pgTAP, 82 race, 9 Playwright.

## Summary

The ledger's structure is sound:
- Every cited file exists, and every cited title or pgTAP description exists.
- Every `text` equals the tracker claim byte for byte, and the clauses tile it.
- Most security and concurrency clauses are backed by genuine proof: kept pgTAP calls, real Worker+Kong+PostgREST+SQL apispecs with full-row effect digests, and race runners that park sessions and observe `pg_locks`.

**But the verified count is overstated:**
- **Contradicted by code or tests:** two verified entries (AC-069, AC-070).
- **Status not supported:** seven more verified entries (AC-052, 058, 059, 064, 083, 097, 122) hold a clause the implementation contradicts or that is only declared, never measured. This is the same class of defect the ledger itself downgrades to partial for AC-050/053/056/090.
- **Proof falls short:** five RLS clauses plus AC-081, 082, 084 and 091.
- **Not executed:** nothing has been run. No receipts file exists and the guard test is uncommitted, so none of the 113 is receipt-backed yet.

Under the ledger's own rules, a corrected count would be about **95-104 verified**, not 113.

## 1. Mechanical results

| Check | Result |
| --- | --- |
| Cited file exists | 3,498 / 3,498 |
| Title found exactly (vitest describe path + test name; pgTAP whole literal, whitespace collapsed; race `ok -` label) | 2,989 exact |
| Title found only as a pattern | 505 vitest titles. They come from `it.each`, template literals, or loop titles like `it(testCase.operationId)`. All 505 match the source pattern, but exact rendering can only be confirmed by a run (see §6). |
| pgTAP description uniqueness | 1,591 / 1,591 are whole string literals occurring exactly once in their file |
| Ledger `text` vs tracker | 122 / 122 byte-identical; clause tiling OK |
| Sole-proof maximum | 2 (limit 3) |
| Receipts | `tests/contracts/phase-02-slice-11-receipts.generated.jsonl` **does not exist**; `phase-02-slice-11-evidence-guard.test.ts` is untracked (`??`) |
| `SECURITY DEFINER` with `search_path = ''` | 137 occurrences in the 74 added migrations, all compliant |

## 2. Findings

Severity order: blocking, then major, then minor.

### A-B1 — blocking — REFUTED
- **Where:** `supabase/migrations/20261005017620_cms_assign_editorial_reviewer.sql:193-197`; `supabase/tests/phase_02_slice_11_rpc_review_assign_refusals.sql:119`; race `010-review-assignment-race.mjs` A7 (P2-S11-AC-069 clause 0).
- **Claim examined:** CMS-03B-18 requires the receipt-derived owner holding `cms.editorial_review.assign` "and a valid `cms.editor` grant (else 403 `capability_missing`)". BE03b:1848 says the same with no exception: "an owner without a valid `cms.editor` grant is refused 403 `capability_missing`".
- **Evidence:**
  - The SQL checks `cms.editor` only for create: `if action = 'create' then if not platform_private.cms_person_holds_capability(..., 'cms.editor') then raise exception 'capability_missing'`.
  - The citation offered as proof asserts the opposite for revoke. Its title is "an owner without a valid cms.editor grant is refused a create (no grantor authority end) **but may still revoke**".
  - Race A7 encodes "a REVOKE needs the owner receipt only".
  - No DEC in DEC-149..169, and nothing in BE03b or IA03, authorizes the exemption.
  - It is an authority rule diverging from a locked spec, marked verified by a test that asserts the divergence.
- **Required fix:**
  - Either obtain and record an owner ruling exempting revoke (then amend BE03b:1848 and set AC-069 partial until the criterion text follows),
  - or enforce `cms.editor` on revoke and flip the test and race A7 RED→GREEN.

### A-M1 — major — WRONG-STATUS (process: nothing receipt-backed)
- **Where:** all 113 verified entries; `scripts/evidence/README.md` "Receipts"; `ledger-refresh-report.md` ("Nothing was executed").
- **Claim examined:** 113 verified.
- **Evidence:**
  - No `phase-02-slice-11-receipts.generated.jsonl` exists.
  - The guard (`phase-02-slice-11-evidence-guard.test.ts`) is uncommitted.
  - The guard rejects any cited identity without an all-`passed` receipt, and any non-passing test in a cited file.
  - 505 citations are generated titles whose exact rendering was hand-built (loupe/`%j` rules) and is unconfirmed.
- **Required fix:**
  1. Run `node scripts/evidence/run-slice-evidence.mjs --slice 11`, then the guard.
  2. Commit the receipts and guard with the ledger.
  3. Treat every "no receipt" as a citation defect. The generated titles are the most likely source.

### A-M2 — major — WEAK: the "RLS" member of AC-007/013/019/025/031 (clause 1 of each)
- **Where:** `supabase/tests/phase_02_slice_11_schema_posture.sql:84-88` (cited); e.g. `20261005017020_cms_editorial_review_assignments.sql:150-154`; BE03b:2002-2006.
- **Claim examined:** "enforce principal, capability, ownership, scope, **and RLS**".
- **Evidence:**
  - BE03b:2005 says "RLS predicates use verified session, acting party, relationship/assignment, capability, risk, lifecycle, locale…".
  - BE03b:2006 requires "positive/negative RLS tests".
  - Every Slice 11 table has exactly one policy, `using (platform_private.cms_rpc_context_valid())`. That is a context flag, not a caller predicate. The posture test asserts exactly that ("exactly one policy, the CMS RPC-context gate").
  - Authorization is real, but it lives in the SECURITY DEFINER RPC bodies, which are tested separately.
  - No predicate RLS and no positive/negative RLS test exists, and no DEC records that context-gate RLS satisfies BE03b:2005-2006.
  - Mitigation: there is no API-role grant on any table, and the convention predates Slice 11 (Slice 09/10 tables).
- **Required fix:**
  - Record an owner ruling that context-gate RLS plus definer-RPC authorization satisfies BE03b "Permission, RLS and grants", and amend the spec,
  - or add predicate policies with positive and negative tests.
  - Until then the RLS member is unproven as specified, and the five entries are partial under the ledger's own rule.

### A-M3 — major — WEAK (systemic: vacuous "left nothing behind" pgTAP assertions)
- **Where:** `supabase/tests/phase_02_slice_11_rpc_review/000-world.sqlinc:126-153` (`r11_try`).
- **How the probe works:** with `p_keep=false` it raises `R11_SENTINEL_5c1f`, which rolls the call back whether it succeeded or refused.
- **Where the assertions sit:**
  - `rpc_review_decision_refusals.sql:209-210` (44 probes with `false`, including the successful controls `su-ok-edge` at line 95 and `cap-control` at line 173, both asserted `'00000:'`)
  - `rpc_review_submit_refusals.sql:235`
  - `rpc_publication_schedule_refusals.sql:248-249`
  - `rpc_publication_publish_refusals.sql:224-225`
  - `rpc_preview_mint_refusals.sql:229`
- **Clauses that cite them:** AC-006[2], 009[5], 010[0], 012[2], 015[5], 016[0], 018[2], 022[0], 024[2], 027[5], 028[0], 030[2], 033[5], 034[0].
- **Claim examined:** "no state mutation", "commit … atomically", "preserve safe recovery".
- **Evidence:**
  - The final assertion (e.g. "every refusal above left no decision, review change, reservation, audit record or outbox event behind") passes even after successful decisions. It cannot detect a write.
  - A refusal that committed effects and returned instead of raising would also be erased by the sentinel.
  - Mitigation: most of these clauses also cite real-stack apispecs with `snapshotDigest`/`expectUnchanged` (`tests/postgrest/support/phase-02-slice-11-effect.ts`). Those do prove no-effect for many refusal families.
- **Required fix:**
  - Probe with `keep=true` and take a per-call before/after digest inside `r11_try`,
  - or drop these citations wherever an apispec digest is not also cited.

### A-M4 — major — REFUTED (P2-S11-AC-070 clauses 2 and 5)
- **Where:** `20261005017620_cms_assign_editorial_reviewer.sql:324-329`; `supabase/tests/phase_02_slice_11_rpc_review_assign_authority.sql:69-95`.
- **Claim examined:**
  - The command "leaves the review `version` unchanged on create and revoke".
  - It commits "exactly one `cms.entry.review-changed.v1`".
- **Evidence:**
  - `if counted_approve then perform platform_private.cms_invalidate_editorial_review(... 'reviewer_authority_changed' ...)`.
  - The same suite asserts `r11_rv('rCounted') = 'invalidated/3/1'`, two review-changed events at versions `'2,3'`, and two audit records.
  - The AC-070-tagged citations are explicitly the no-decision case.
  - DEC-161 ratifies this behaviour, but the entry carries no limitation. Compare AC-090, which is set partial for exactly this kind of DEC-vs-text gap.
- **Required fix:** set AC-070 partial with a DEC-161 limitation: a revoke of a counted approver's assignment on an open review moves the review version +1 and emits a second event. Ask for the criterion wording ruling.

### A-M5 — major — WRONG-STATUS (P2-S11-AC-059 clause 5)
- **Where:** `apps/worker/src/cms-editorial/workflow-read.ts:236` (`return fail(BAD_GATEWAY)`); `workflow-read-breach.test-support.ts:25` (`RESPONSE_BOUND_STATUS: 502 | 422 = 502`); BE03b:1909 (CMS-03B-16 "response bounds" sits in the **422** column); BE03b:292.
- **Claim examined:** CMS-03B-16 maps "a response-bound failure … to typed ApiError". The declared mapping is 422.
- **Evidence:**
  - The cited `workflow-read-routes.test.ts` "is 502 when the success payload breaks the resource contract CMS-03B-16" asserts 502.
  - AC-053 and AC-056 are partial for exactly this 502-vs-422 contradiction, and the breach tests even carry the `[P2-S11-AC-059]` marker. AC-059 is verified anyway.
- **Required fix:** set AC-059 partial with the AC-056 limitation until the owner's 422/502 ruling.

### A-M6 — major — WRONG-STATUS (P2-S11-AC-097 clause 3)
- **Where:** `supabase/tests/phase_02_slice_11_rpc_publication_publish_refusals.sql:257-284` (and the schedule twin); DEC-169.
- **Claim examined:** for a `failed` (422) or `unavailable` (503) preflight, "in both cases nothing commits and no success idempotency record is retained".
- **Evidence:**
  - A failed `revocation` category (a lazily found lapsed counted approver) answers the committed `preflight_failed` refusal.
  - It invalidates the review `reviewer_authority_changed`, at version 3 with one event.
  - It cancels the pending schedule `approval_invalidated`.
  - It completes the reservation `completed/422`.
  - The ledger cites only tests titled "every **raised** refusal above left no …". Those exclude the committed refusal.
  - DEC-169 sanctions the behaviour, but the verified entry states no exception. Same pattern as AC-090.
- **Required fix:** set AC-097 partial with a DEC-169 limitation, pending a criterion wording ruling, or narrow the clause through the owner.

### A-M7 — major — WRONG-STATUS (P2-S11-AC-083 clause 3, "cancels with `entry_unavailable`")
- **Where:**
  - BE03b:1888: "A schedule whose entry is not `active` at execution is `cancelled` with `entry_unavailable`."
  - `20261005017740_cms_execute_publication_schedule.sql:252-253` (the `entry_unavailable` exception becomes `blocked`/`approval_invalidated`).
  - `phase_02_slice_11_rpc_publication_execute_refusals.sql` test titled "… (a superseded revision, an unavailable entry) is blocked approval_invalidated, never cancelled by the executor (DEC-158(d))".
- **Claim examined:** CMS-03B-20 "… cancels with `entry_unavailable`".
- **Evidence:**
  - The executor never produces `cancelled`/`entry_unavailable`.
  - The citations for this clause are three `helpers_invalidation.sql` tests of the review-invalidation transaction, a different producer.
  - DEC-158(d) chose this behaviour, but the entry carries no limitation, unlike AC-090.
  - AC-084 clause 5 "every `reasonCode`" leans on the same helper test for `entry_unavailable`.
- **Required fix:** set AC-083 partial with a DEC-158(d) limitation (the executor blocks `approval_invalidated`; cancellation happens only in the invalidation transaction), and reconcile BE03b:1888 with DEC-158(d).

### A-M8 — major — WRONG-STATUS (P2-S11-AC-122 clause 5)
- **Where:** `supabase/migrations/20261010150000_cms_schedule_precision_storage.sql:26-27`; `supabase/tests/phase_02_slice_11_schedules_schema.sql:87-88`; BE03b:1981.
- **Claim examined:** `UNIQUE(entry_id, revision_id, action, local_datetime, timezone, audience)`.
- **Evidence:**
  - The migration replaces it with `UNIQUE (entry_id, revision_id, action, local_datetime, local_datetime_submicro_ns, timezone, audience)`.
  - The cited test asserts the seven-column key. The citation contradicts the literal clause.
  - No DEC or BE03b amendment records the schema change (commit `9b9b588e`, nine-digit precision).
- **Required fix:** record a DEC or BE03b amendment for the seven-column identity, and set AC-122 partial until the criterion wording follows.

### A-M9 — major — WRONG-STATUS (AC-052 clauses 5-6, AC-058 clause 5, AC-064 clause 6: p95 targets)
- **Where:** the only citations are `packages/contracts/src/cms-editorial/routes-slice11.test.ts:370-379` and the CMS-03B-16/17 row tests. They assert `responseTargetMs: 1_200` / `750` on a registry row.
- **Claim examined:** "the Tier 2 p95 < 1,200 ms target (which includes the 2,000 ms accessibility checker budget)" and "the Tier 1 p95 < 750 ms target".
- **Evidence:**
  - No Slice 11 latency measurement exists. `tests/performance/` holds only `api-p95-smoke`, baseline, bundle and Slice 09 files, and no file mentions CMS-03B-15/16/17 or their RPCs.
  - A constant shows the target is declared, not that it is met. The clause also embeds a 2,000 ms budget inside a 1,200 ms p95, which no test reconciles.
- **Required fix:**
  - Measure p95 of the three reads through the composed stack, as Slice 09 did for its routes,
  - or set the three entries partial with a limitation.

### A-M10 — major — WEAK (P2-S11-AC-091 clause 1)
- **Where:** `supabase/tests/phase_02_slice_11_helpers_settings.sql:216-224`.
- **Claim examined:** the snapshot is evaluated "through `cfg_resolve_effective_value` with consumer key `cms.publication` for each registered key in ascending order".
- **Evidence:**
  - Both cited pgTAP assertions are source-text greps: `pg_get_functiondef(p.oid) like '%cfg_resolve_effective_value%' and … like '%cms.publication%'` and `… like '%collate "C"%'`.
  - This is a marker-presence proof. No behavioural test registers served keys out of order and observes the order, consumer key or member shape.
  - The evaluation instant is `clock_timestamp()` at the write tail (`20261010130000:66-67`), not "the command's server instant".
- **Required fix:**
  - Add a behavioural pgTAP case: two served keys registered as `{b,a}`; assert array order and `{key, definitionVersionId, sourceValueVersionId, valueHash}`.
  - Otherwise set the clause unproven (registry v1 is empty).

### A-M11 — major — WEAK (P2-S11-AC-084 clause 2, "two concurrent sweepers under SKIP LOCKED")
- **Where:** `supabase/tests/phase_02_slice_11_races/013-schedule-claim-race.mjs:62-90` (C2) and `:95-129` (C3).
- **Claim examined:** concurrent sweepers, which BE03b:2168 requires explicitly.
- **Evidence:**
  - C2's lock holder is a raw `select … for update; pg_sleep` session, not a sweeper. It proves SKIP LOCKED for one claim.
  - C3 starts `claimAsync(25,…-c3-b)` and `claimAsync(25,…-c3-c)` under `Promise.all`, with no park, no `blockedBy`/`pg_stat_activity` witness and no overlap barrier. Sequential execution produces the same outcome.
  - C1 has the same gap.
- **Required fix:** park sweeper A after it has claimed its rows (gate trigger or open transaction), run sweeper B, and observe that B completes while A is parked and that the two claim sets are disjoint.

### A-M12 — major — WEAK (P2-S11-AC-082 clause 3, "claim and execute under the 15,000 ms job deadline")
- **Where:** `apps/worker/src/cms-publication-schedule-sweep.ts:225-252`; `apps/worker/src/async-runtime-rpc-types.ts:65`; `cms-publication-schedule-sweep-deadline.test.ts:180-243`.
- **Evidence:**
  - The only deadline is the per-call RPC timeout `ASYNC_RPC_DEADLINE_MS = 15_000`.
  - The cited test proves "gives the claim and the execute **each their own** 15,000 ms". A claim at 14,999 ms plus an execute at 14,999 ms both succeed.
  - The tick executes up to 25 claims sequentially, so 25 × 15 s exceeds the five-minute lease. The lease fence prevents duplicates.
  - No job-level budget exists.
- **Required fix:** add a job-level budget and test it against the production sweep, or record a ruling that "job deadline" means a per-RPC timeout and reword the criterion.

### A-M13 — major — WEAK (P2-S11-AC-081 clause 0; AC-075 clause 0 is minor)
- **Where:**
  - `supabase/tests/phase_02_slice_11_rpc_review/000-world.sqlinc:226-246` (`r11_posture`)
  - `apps/worker/src/cms-editorial-principals.test.ts:74-107`
  - `apps/worker/src/async-runtime-rpc-types.ts`
- **Claim examined:** "EXECUTE only to the registered Worker `scheduled` sweep principal (PUBLIC, anon, authenticated and **every other role** revoked)". Under DEC-156 this means `service_role` plus a module boundary.
- **Evidence:**
  - `r11_posture` checks only `service_role`, `anon`, `authenticated` and PUBLIC. It never enumerates `aclexplode(proacl)` grantees. Only the takedown test asserts an exact ACL.
  - The module boundary pins importers of `cms-publication-schedule-rpc` and literal mentions only.
  - `cms-publication-schedule-rpc-names.ts` is imported by the generic `async-runtime-rpc-types.ts`, so any Worker module can import the constants and call the RPCs through the generic client. The test would not fail.
  - The entry does not state the DEC-156 interpretation.
- **Required fix:**
  - Assert the exact grantee set per function: owner plus `service_role` for the wrapper, owner only for the private function.
  - Pin the importers of the names module and its constants.
  - Cite DEC-156 in the entry.

### A-M14 — major — WEAK (P2-S11-AC-051 clause 3, "an active reviewer assignee of a review of the revision")
- **Where:** `supabase/tests/phase_02_slice_11_rpc_reads_workflow.sql:252-258` is the only negative (an unassigned reviewer and a capability-less member).
- **Evidence:**
  - No test reads CMS-03B-15 as a reviewer whose assignment was revoked or expired, nor as an assignee of a review of another revision.
  - The code enforces both (`20261005017900_cms_get_entry_workflow.sql:66-73`: `assignment_item.state = 'active' and review_item.revision_id = p_revision_id`).
  - CMS-03B-16 does test the revoked case (`rpc_reads_review.sql:210-215`).
- **Required fix:** add a pgTAP case for each, a revoked assignee and an assignee on another revision, each expecting 403 `capability_missing`.

### A-M15 — major — WEAK ("retain input": AC-040 clause 9 and AC-043 clause 9; minor for AC-037 clause 9)
- **Where:** `apps/web/src/components/cms-editorial-workflow/cms-workflow-command-controller.test.ts:194-208`.
- **Evidence:**
  - The test is titled "…and keeps the input on a stale conflict" but asserts only the phase, refusal kind, key rotation and refetch, then that a new `submit(request('Edited.'))` commits. Nothing checks that input is retained; the controller holds no form values.
  - For AC-040/043 the other citations are step-up restore-from-storage tests, not retention after a definite 409/422 or an unknown outcome.
  - AC-037 has retention only after a 504 (`CmsEditorialDecisionForm.test.tsx:364-387`).
- **Required fix:** add form-level assertions that entered values survive a definite refusal and an unknown outcome (schedule, preview, publish, decision), and retitle the controller test.

### Minor findings (WEAK unless marked)

| ID | Criterion and clause | Where | Issue | Required fix |
| --- | --- | --- | --- | --- |
| A-m1 | AC-083[2] | `rpc_publication_execute_refusals.sql:110-117` | The cited test titled "...the prior publication stays intact" asserts that NO publication row exists for those entries, so there is no prior head to preserve. The real preservation test (`xr-head`, lines 193-237: lineage fingerprint byte-identical after a blocked `preflight_failed`) exists but is uncited. This is a leftover of independent finding 13. | Cite the xr-head test; retitle the line-117 test. |
| A-m2 | AC-027[4], AC-059[8] | `workflow-errors-typed.test.ts:274-291` | The 500 envelope is shown only through the CMS-03B-09 row. CMS-03B-08 and -16 have no internal-failure case. AC-053's limitation admits this; these entries do not. | Add per-operation 500 cases or a limitation. |
| A-m3 | AC-059[11] | `rpc_reads_review.sql` | "Concealed review stays 404 on every refetch": no test refetches a concealed review. | Add a repeated concealed read. |
| A-m4 | AC-053[7] (partial entry) | | Cites the breach-502 test as proof of "read dependency (502)". A contract breach is not a dependency failure. | Drop that citation. |
| A-m5 | AC-105[2] | | "The Worker passes only the verified time members to the RPC": the citations show a response-binding check and a pre-RPC refusal, not the outbound RPC body. | Cite or add an RPC-body assertion (e.g. the `commands bind the named RPC with a server-built request CMS-03B-07` style). |
| A-m6 | AC-106[0] (partial entry) | | "The same pinned snapshot and resolver the Worker uses" is shown only by shared imports; no test asserts identity. | Add an identity assertion, or note it. |
| A-m7 | AC-103[5] | `tzdb-pin.test.ts:62-80` | "Newest stable IANA release available when it starts" is asserted by a hard-coded `'2026e'`. | Treat as a process statement, or state it in a limitation. |
| A-m8 | AC-116[2] | `20261010165000` | The state mapping (`converged` = every one of the eight consumers' newest row `active\|superseded\|revoked`; `degraded` = `blocked`) is the lane's choice. DEC-167 only restates the criterion. The ledger-refresh report itself flags it. The `projection_id` BOUNDARY has no GitHub tracking issue (the boundary rule requires one). | Ratify the mapping and open the issue. |
| A-m9 | AC-118[2] | | A lapsed grant (valid_through passing) is denied at open but never CAS-revoked. Reviewer-assignment revoke and `cms.publisher` deactivation token revocation are uncited (sub-reviewer). | Cite or add the two CAS cases; note lapse. |
| A-m10 | AC-046/047/048 [9][10] | `cms-workflow-command-transport.test.ts:303-340` | `allowedMethods: []` and a mixed list containing totp are never exercised. | Add both cases. |
| A-m11 | AC-047/048 [2][7] | | No form-level "never a gate or sign-in" check and no SyncConflict check for the schedule or publish forms. | Add form tests. |
| A-m12 | AC-051[9] | `rpc_reads_workflow.sql:154-157` | The identifier-leak check runs only on a draft with no review, schedules or publications. | Run it on the populated responses. |
| A-m13 | AC-052[4], 058[4], 064[5] | | The 8,000 ms deadline is proven as a registry constant plus a mechanism tested at 20 ms. | Assert the composed budget equals 8,000 ms. |
| A-m14 | AC-057[4] | `rpc_reads_review.sql:149-151` | `assignments = []` is not asserted for the entry assignee, and reason redaction is not asserted for the submitter or entry assignee. | Assert both. |
| A-m15 | AC-064[1] | | Reuse of a cursor by the same actor under another acting party is untested (`queryHash` includes `actingPartyId`). | Add the case. |
| A-m16 | AC-003[recheck] | | "Recheck every open" is a verifier property; no production route consumes the adapter yet (Slice 15). | State it in the entry. |
| A-m17 | AC-004 settings / route / locale / privacy | `criteria_publish_gates.sql:58-116` | The fixtures set the failing condition before approval on synthetic reviews (settings: a fake frozen hash), so this is not a genuine pass-then-fail. Template, block and relation drift after approval genuinely. | Add post-approval drift through the real submit and decide path. |
| A-m18 | AC-009 every declared domain | | `separation_of_duties` is declared for CMS-03B-05 but never raised by submit. `dependency_manifest_too_large` is tested only at helper level. | Fix the catalog or spec; add an RPC/Worker case. |
| A-m19 | AC-008/014/020/026 concurrency; AC-083[1][6] | | Races without an overlap barrier are cited: 012 C1/C2, 011 B1/B3/B4, 020 M1/M2, 014 E1. The barriered B2 and S2 are not cited. | Park sessions (as E3 does); cite B2 and S2. |
| A-m20 | AC-028, AC-010, AC-022, AC-034 telemetry | | The CMS-03B-08 redaction check covers only "token not in telemetry", on success. CMS-03B-05 refusal paths are not in the matrix. The declared metrics `cms_preview_minted_total`, `cms_preview_denied_total`, `cms_schedule_state_total` and `cms_publication_state_total` (BE03b:2151) are emitted nowhere (0 hits in `apps/` and `packages/`). | Extend the matrix; emit the metrics or record a deferral. |
| A-m21 | AC-019[1], AC-031[1] | | A cross-acting-party negative is missing for CMS-03B-07 and -09 (05, 06 and 08 have it). | Add it. |
| A-m22 | AC-008…032 pagination / rate / cache | | Pagination is n/a for commands. Rate is shown only with a stubbed limiter (the real stack allows everything). `no-store` is asserted on success only. | Mark pagination n/a; cite the limiter's own tests. |
| A-m23 | AC-069[1] | `017600:26-58` | "Binding-bound" MFA: the database trusts the `stepUpAt` from the `service_role` caller, and only Playwright drives a real step-up. | Add a test that a proof from another session or binding is refused. |
| A-m24 | AC-070[1] | | Race A4 does not tell the command's own review lock apart from the FK or write-guard locks; A2's blocker witness is the right citation. | Cite A2. |
| A-m25 | AC-076[0] | `preview_verify.sql:44-48` | The title "STABLE, so the database itself refuses any … write" overclaims; the xmin digest test is the proof. | Retitle. |
| A-m26 | AC-073[0], AC-079[0] | | The RPC signatures are `(p_request jsonb)`, not the criterion's argument lists (DEC-156), and the entries do not cite DEC-156. | Note DEC-156. |
| A-m27 | AC-087, AC-089 | | "Only builder" is checked by name only. The 422 `dependency_manifest_too_large` mapping is checked in the contract catalog only. The "stable hash" test compares a function with itself. | Strengthen or note. |
| A-m28 | AC-092[5][6] | `helpers_settings.sql` | "Restoring earlier values reuses the ordinal" is shown only with lookup fixtures. "No forward migration seeds a row" is checked on a fixture owner, so it is vacuous. | Add a v1→v2→v1 write-path case; add a migration scan. |
| A-m29 | AC-095 | `20261005017570` | "Emits only declared reason codes" is sampled; there is no closure test of the SQL reason literals against the registry sets. | Add a parity test. |
| A-m30 | AC-099[0] | `checker-limits.test.ts:203-227` | The group evaluation order is not observable: every stop asserts the same `{state:'stopped'}`. | Instrument the order. |
| A-m31 | AC-102[5] | | Rejection of a browser `evidence` member is shown for CMS-03B-05 and -09 but not -07. | Add the CMS-03B-07 case. |
| A-m32 | AC-114[4] | `publication_lineage_schema.sql:216-237` | The trigger is never driven with a successor whose `publication_id`, `entry_id` or `locale` differs. | Add three negative inserts. |
| A-m33 | AC-115[1] | | Cites race 016 (the private helper, synthetic evidence), not the command race 014 E3. The CMS-03B-20 loser is `failed_retryable`, not a 409. | Cite E3; note the execute path. |
| A-m34 | AC-119[0], AC-120[1] | | "Written only by …" / "only the named CAS RPCs" is proven by the context guard, not a single-writer scan (AC-113 has one). | Add a pg_proc body scan. |
| A-m35 | AC-075[0] | | Role enumeration covers four roles only (see A-M13); the verifier's module boundary itself is tight. | Assert the exact ACL. |

## 3. The 7 partial and 2 unverified entries

Every limitation is accurate. None hides an unimplemented clause beyond what it states.

- **AC-041:** accurate. The truncated tail "sta" (DEC-155) is uncited and the evident reading is cited. The BE03b 25.03.04 pointer is machine-checked.
- **AC-050, AC-053, AC-056:** accurate. 502 is implemented and the spec says 422; one token flips it (`workflow-read-breach.test-support.ts:25`). Inconsistency: AC-059 carries the same defect and is verified (A-M5).
- **AC-071:** accurate. No test redelivers `cms.entry.review-changed.v1`, and no Slice 11 consumer of it exists. The recheck relay's redelivery idempotency (AC-113, `phase-02-slice-11-recheck.apispec.ts`) is for the six source events, not this one. BE03b:2139 requires "assignment event retries idempotently".
- **AC-090:** accurate. The spec is internally inconsistent: BE03b:1773 lists the executor among the 409 `version_set_stale` commands, while BE03b:1917 says internal operations return typed results. Needs an owner ruling.
- **AC-106:** accurate. There is no test of the built `contracts-time-authority` chunk against `BUNDLE_BUDGETS`. Minor: clause 0's "same snapshot and resolver" is shown by imports only (A-m6).
- **AC-044:** accurate; provable only at slice close.
- **AC-045:** accurate. It must also cover the `projection_consumer_state.projection_id` BOUNDARY, whose tracking is a Slice 13 criterion reference rather than the GitHub issue the boundary rule requires (STATE.md: issue not opened).

**Rejected sub-reviewer claim:** one sub-reviewer reported that CMS-03B-15 can insert a settings snapshot through `cms_build_dependency_manifest` → `cms_settings_snapshot`. That is stale. `20261010130000_cms_settings_write_tail_lookup.sql` replaces `cms_settings_snapshot` with a lookup-only body (it raises `DEPENDENCY_UNAVAILABLE` and never inserts), and the only remaining insert is the ordinary-write tail. **Not a finding.**

**Earlier independent findings** (`s11-sql2-reverification-2026-10-09.md`):
- I checked these statically: #1 and #15 (race 010 A2/A5/A6/A7), #3 (sealed encrypt-then-MAC cursor with constant-time MAC verified before decryption), #5 and #8 (race 014 E2/E3/E8, early head observation in `cms_publish_revision` before the first shared lock), and #7 (lookup-only reads, DEC-163). They appear fixed and are cited.
- #13 is fixed in the test file but cited wrongly (A-m1).
- #6, #9 and #10 match the refresh report's renamed titles. I did not re-derive them.

## 4. Totals

**By finding** (the finding counts below the table are the same thing grouped by severity):

| Verdict | Blocking | Major | Minor |
| --- | --- | --- | --- |
| REFUTED | 1 (AC-069) | 1 (AC-070) | 0 |
| WRONG-STATUS | 0 | 6 (A-M1 process, AC-059, AC-097, AC-083, AC-122, p95 ×3 entries) | 0 |
| WEAK | 0 | 8 (A-M2 RLS ×5 entries, A-M3 systemic, AC-091, AC-084, AC-082, AC-081, AC-051, retain-input) | 35 |

- **Findings:** 1 blocking, 15 major, 35 minor.

**By clause** (661 clauses in verified entries):

| Verdict | Clauses |
| --- | --- |
| REFUTED | 3: AC-069[0], AC-070[2], AC-070[5] |
| WRONG-STATUS | 7: AC-052[5], 058[5], 064[6], 059[5], 083[3], 097[3], 122[5] |
| WEAK, major | 13: AC-007/013/019/025/031[1], 052[6], 091[1], 084[2], 082[3], 081[0], 051[3], 040[9], 043[9] |
| WEAK, minor | about 50, plus 14 clauses that also carry a vacuous citation (A-M3) |
| UPHELD | the remainder, about 590 |

About 55% of verified clauses were read at test-body plus production-code depth; the rest were checked against titles and sampled bodies.

**Entries whose `verified` status is not supported now:** 9, namely AC-052, 058, 059, 064, 069, 070, 083, 097 and 122. A further 9 are unproven as specified until a test or ruling lands: AC-007, 013, 019, 025, 031, 081, 082, 084 and 091.

## 5. What was examined deeply

The test bodies and production SQL/TS read for each are:

- **Security, authority and RLS:** AC-001, 007, 013, 019 and 031 (RLS member), 025, 051, 057, 063, 069, 075, 081, 087 (RLS), 102, 107, 108, 119.
- **Concurrency, locking and races:** races 010 (A1-A7), 011 (B1-B7), 012, 013 (C1-C4), 014 (E1-E8), 015, 016 (L1-L3), 020, 030; AC-036, 039, 042, 070, 082, 084, 092, 115.
- **Idempotency and replay:** AC-008, 014, 020, 026, 032, 046-048, 071, 083, 117.
- **Preview tokens and cursors:** AC-003, 041, 064, 065, 073-078, 086 (sealed cursor: encrypt-then-MAC, constant-time MAC before decrypt), 117, 118.
- **Publication and lineage:** AC-004, 029-034, 080, 083, 084, 090, 097, 114-116, 122.
- **Others, more than 30 chosen across the remainder:** AC-002, 009, 010, 016, 024, 028, 037, 040, 043, 049, 052, 058, 059, 062, 068, 079, 085, 089, 091, 093, 095, 099, 101, 103, 105, 106, 110, 113, 120, 121.
- **All partial and unverified entries:** AC-041, 044, 045, 050, 053, 056, 071, 090, 106.
- **Cross-cutting:** definer `search_path` across all 74 added migrations; history of the most-edited cited test files since `3640b506` (removals were file splits and the DEC-169 rename; no weakening found).

## 6. Could not verify statically

- **Whether any cited test passes.** Nothing has been executed for this ledger: there are no receipts and the guard is uncommitted. The lane logs report a green API run (71 files, 843 tests) and race run (21 runners), but those are not identity receipts.
- **Exact rendered titles of the 505 generated vitest citations.** These come from `it.each`/`describe.each` `$prop`/`%s`/`%j` and loop titles. Only a run's JSON report settles them.
- **Real timing behaviour of the race barriers and the 15 s / 8 s deadlines.** I read the barrier code (`pg_locks` and `pg_blocking_pids` witnesses), but did not observe it.
- **p95 latency of CMS-03B-15/16/17.** No measurement exists to read.
- **Production data effects of the forward migrations' self-checks.** For example, `20261005018090` refuses to run if any stored revision is not `draft`. That depends on the populated production state, which I cannot see.
