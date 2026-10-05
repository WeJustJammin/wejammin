I couldn't write `reports/s09-audit3.md`: the harness blocks subagents from writing report files. The full report is below so you can save it. The 200-row verdict table is already on disk at `scratchpad/audit3/table.md`, and every other artefact is under `scratchpad/audit3/`.

## Summary (25 lines)
1. The claim does not hold: Slice 09 is not 1235/1235. It is much closer than at re-audit 2. HEAD is `073496db`, the tree is clean, and no repo file was edited.
2. Sample of 200: a = 70 of the 88 criteria re-audit 2 rated NOT-PROVEN or WEAK (S); b = 100 random amendment criteria, proportional by layer; c = 30 random pre-amendment criteria (below AC284).
3. Overall: 116 PROVEN, 27 WEAK (C), 50 WEAK (S), 7 NOT-PROVEN.
4. By set: a 42/6/16/6, b 58/17/25/0, c 16/4/9/1. Four fresh sub-auditors did 182 criteria; I did the 18 auth criteria and re-checked every decisive NOT-PROVEN.
5. Estimated rates across 1235: hard-false ≈16 (1.3%), soft-false ≈335 (27%, roughly 18–38%), any defect ≈43%, fully proven ≈57%.
6. Re-audit 2 estimated 7.8% hard and 45% soft, so both rates fell. Confidence is medium-high on the sampled verdicts and medium on the population rates.
7. Fixed and confirmed: per-request aal2 + MFA amr step-up proof, refresh never extending freshness, 500 rows, the in-isolate idempotency cache, 429 details, the OD-4 `path` member, AUTH-API-17 503 variants, `format:check`, and specific receiving criteria.
8. All cited vitest files pass (≈3,500 tests, 0 failed). The pgTAP receipt (07:07) postdates every SQL change. Both Playwright reports show 187/187 passed, and every marked title is present.
9. NOT-PROVEN, reopen now: 025, 064, 658, 1127, 1146, 1149, 1182, plus 181 and 685 found outside the sample.
10. Of those, 064 means the Worker and BE03a accept a literal `defaultValue: null` that the DB refuses.
11. 1127: profile ownership renders `STEP_UP_REQUIRED` as "Sign in again", so the mapping is not global. 1182: for CMS-03A-09 the Worker refuses before the DB-only locale rules run, so "every issue" is impossible.
12. 658's reworded text contradicts its own test. 025's ruling claims the BE00 order while writing an order that contradicts BE00.
13. **SEC-1 (high, static, needs one real-stack call to confirm):** every Slice 09 database authority check reads `request.jwt.claim.role/sub`. The local PostgREST v16.1 binary only knows `request.jwt.claims`.
14. Fail-open: any signed-in user calling the five `authenticated`-executable CMS RPCs directly can supply `context.authUserId` and act as another user.
15. Fail-closed: every real Worker call to the release-worker and migration-worker RPCs (37 call sites) gets `UNAUTHENTICATED`, so block registration and the activation pipeline cannot run when deployed.
16. No test can see SEC-1: pgTAP sets the old GUCs by hand, Worker tests fake PostgREST, and the e2e lane uses in-memory ports.
17. Other security findings: S09 RLS protects no real caller, because the function owner and `service_role` both bypass RLS.
18. The nonce-replay alert can never fire, and Worker-side 401/403 refusals emit no telemetry.
19. Reusing an idempotency key with a changed body tells the client `refresh` with `INVALID_TRANSITION` (D-IDEM). The tests claim otherwise because their stand-in DB raises a code the real one never does.
20. Partial remediation recurs: 761 was fixed but 789, 820, 850, 876 are still provider-only; 764 was fixed but 823 and 574 lack variants; the expired-session variant is never produced; all CMS 415 rows return `details: {}`.
21. Unratified rewordings counted as verified: 16 ledger rows plus AC034, AC390 and AC641, which are not in the ledger.
22. The checked rows themselves carry no "pending owner ratification" mark. `decisions.md` still stops at DEC-107.
23. DEC-122 now has an owner-ratified raw record (9 criteria). AC282 and AC1147 still credit DEC-122 with the Slice 16 and template moves, which come from the AC185 ruling and DEC-123.
24. Tracking is still inconsistent: tracker lines 10/13, the "249/1235" notes in Slice 10 and 12, `spec-pipeline.md:416`, and the phase tracker's "not complete".
25. Exact reopen, hold and citation-fix lists are in §9.

---

# Slice 09 acceptance audit 3 (independent, adversarial, read-only), 2026-10-03

**Scope:**
- Worktree `/home/rob/.codex/worktrees/ac265-hosted-evidence-producer/WeJammin` @ `073496db`, clean.
- Not run: `pnpm db:*`, supabase, Playwright, e2e.
- Run: targeted vitest, `pnpm format:check`, `pnpm progress:check`, and the three evidence guards.

**Claim:** 1235/1235 active verified. The index holds 1235 verified entries (279 below AC284, 956 amendment); 4 deferred gates stay open.

**Verdict:** the claim does not hold. Hard-false ≈1.3% and soft-false ≈27% of the 1235. Around 19 criteria are checked on unratified rewordings. SEC-1 (below) makes database-level proofs for the release and migration-worker paths valid only under a GUC environment the deployed PostgREST does not create.

## 1. Method
- **Index:** parsed with `node --experimental-strip-types`. 1235 verified, 4 open (209, 211, 265, 266); `S09_PRE_AMENDMENT_CHECKED` is empty.
- **Plan vs tracker:** text identical after link normalisation; both show 1235 `[x]` and 4 `[ ]`.
- **Sample:** seed 20261006, built by `audit3/build.cjs`, saved in `audit3/sample.json`.
  - a = 70 of the 88 from re-audit 2's R1/R2/R3 lists.
  - b = 100 of the other 897 amendment criteria: db 36, worker 22, web 20, auth 14, contracts 6, browser 2.
  - c = 30 of the other 250 pre-amendment criteria.
- **Auditors:**
  - Four sub-auditors under `audit3/brief.md`: DBA 43, DBB 42, WEB 46, WK 51.
  - I audited the 18 AU criteria myself and ran the security probes.
  - I re-checked 025, 064, 658, 1127, 1149, 1182, 537 and 355.
- **Verdict scale:**
  - PROVEN: every clause asserted on the real path.
  - WEAK (C): proven, but part of the proof sits in files the index doesn't cite.
  - WEAK (S): a clause is unasserted, injected, proven through a fake, covers one variant, or is disjunctive.
  - NOT-PROVEN: contradicted, cannot fail, or self-contradictory.
  - (P) flag: the text is a rewording still pending owner ratification.

## 2. Runs and receipts

| Batch | Files | Tests passed |
|---|---:|---:|
| AU | 13 | 300 |
| DBA | 36 | 721 |
| DBB | 39 | 717 |
| WEB | 72 | 722 |
| WK | 54 | 1021 |

- **Guards:** 3 files, 19 tests passed. `format:check` green. `progress:check` exits 0.
- **pgTAP:** `logs/r13-dbtest.log` at 07:07 shows `Files=194 Tests=7974 PASS` with 0 `not ok`. The newest SQL file is from 07:05.
- **Playwright:** functional 105 and s09-real 82, all expected, no retries.
  - All 62 Playwright-cited entries map to marked titles that passed.
  - Pass counts disagree for 1036, 1037, 1038 (receipt claims more), and for 262 and 1126 (receipt claims fewer).
  - The run (05:54–06:00) postdates web source changes. The later Worker CMS-03A-10 unknown-key change (10:33) and contracts change (06:36) are not exercised by any Chrome spec.
- **Limits of the "production-built Chrome" evidence:**
  - The s09-real lane runs the real Worker over in-memory ports with a test TOTP seam.
  - The functional lane runs Astro dev against a mock API.
  - So it is browser-behaviour evidence only. Concealment and authority outcomes in those specs come from fixtures, not the database.

## 3. Results

**Lead adjudications:**

| ID | Auditor verdict | Final | Reason |
|---|---|---|---|
| 537 | NOT-PROVEN | WEAK (S) | The literal text holds in production. The mismatch variant is proven only through a stand-in DB that diverges from the real one. |
| 355 | NOT-PROVEN | WEAK (S) | `{}` satisfies "only allowlisted", but BE00 defines `{allowedMediaTypes}`. |
| 007 | NOT-PROVEN | PROVEN (P) | The reworded text is proven; only the authority is missing. |
| 261 | NOT-PROVEN | WEAK (S) (P) | Clauses unproven at render time and against the real bundle. |

**Counts:**

| Set | n | PROVEN | WEAK (C) | WEAK (S) | NOT-PROVEN |
|---|---:|---:|---:|---:|---:|
| a | 70 | 42 | 6 | 16 | 6 |
| b | 100 | 58 | 17 | 25 | 0 |
| c | 30 | 16 | 4 | 9 | 1 |
| Total | 200 | 116 | 27 | 50 | 7 |

**Set b by layer (PROVEN / WEAK C / WEAK S / NOT-PROVEN):**
- worker 18/2/2/0
- contracts 5/0/1/0
- web 12/1/7/0
- db 17/8/11/0
- auth 6/6/2/0
- browser 0/0/2/0

**Set a, how verdicts moved since re-audit 2:**
- To PROVEN: 41 (35 from WEAK (S), 4 from NOT-PROVEN, 2 from the R3 list).
- To WEAK (C): 6.
- Still or newly WEAK (S): 16.
- Still or newly NOT-PROVEN: 6.

**Rates (Wilson 95%; weights a 88, b 897, c 250):**

| Population | Hard false | Soft false (hard + WEAK S) | Any defect | Fully proven |
|---|---|---|---|---|
| a | 8.6% (4.0–17.5) | 31.4% (21.8–43.0) | 40% | 60% |
| b | 0% (0–3.7) | 25% (17.5–34.3) | 42% | 58% |
| c | 3.3% (0.6–16.7) | 33.3% (19.2–51.2) | 46.7% | 53.3% |
| **1235** | **≈16 (1.3%; roughly 5–90)** | **≈335 (27%; roughly 225–475)** | **≈530 (43%)** | **≈705 (57%)** |

- Re-audit 2 on the same weighting: ≈96 hard (7.8%) and ≈555 soft (45%).
- Not in these rates:
  - SEC-1 dependence: 22 of 200 sampled criteria cite pgTAP files that call worker-gated RPCs (file-level heuristic).
  - The ≈19 unratified rewordings.

## 4. Systemic findings
1. **Partial remediation keeps leaving siblings broken.**
   - 761 is fixed, but 789, 820, 850 and 876 are still provider-only (their titles literally say "(provider)").
   - 764 is fixed, but 823 and 574 lack the future-dated variant; 441 and 503 are unsampled siblings.
   - The expired-session variant is never produced: 534, 726, and 12 siblings.
   - All 8 CMS 415 rows return `details: {}`.
2. **Stand-ins that disagree with production.**
   - **D-IDEM:** `r8-db-harness.ts:91` raises `IDEMPOTENCY_MISMATCH`. The real DEC-108 RPCs (CMS-03A-04 and 09–17) go through `cms_reserve_conflict` (`20261002125000:19-21`). It turns the mismatch into a plain `CONFLICT`, which reaches the wire as `{conflict: INVALID_TRANSITION, recoveryAction: refresh}`.
     - That breaks BE00 (`00-infrastructure.md:161`).
     - Affected: 300, 308, 354, 396, 433, 495, 537, 566, 594.
   - **Injected web props:** 249 (`resultCount=3` on a 1-item page), 1050 (forbidden console, where production returns a bare "Forbidden" 403), 224.
   - **Real-route Chrome:** authority comes from fixtures.
3. **Contradictions between layers or criteria.**
   - 064: Worker and BE03a Zod accept a literal null default; the DB refuses it (`20261002204000:88-89`).
   - 1182: Worker pre-refusal on CMS-03A-09 prevents "every issue".
   - 685 says "exactly eighteen" RPCs; AC180's guard proves 51.
   - 181 says "immutable helper"; the code and AC037 use STABLE.
4. **Spec edited to match code under pending rulings.**
   - AC180 (BE03a:2178), AC356 (BE03a:1830) and AC025 (BE03a:147).
   - AC025's BE03a text says "BE00 governs", then lists an order that contradicts BE00 §Hono Middleware Order (`00-infrastructure.md:342-348`):
     - Zod validation runs before CORS and the session.
     - CSRF runs after capability and step-up.
5. **pgTAP test validity.**
   - `app.cms_rpc` stays `'true'` after the first RPC (98 sets, 0 resets), so the direct-write guard is inert for later fixture writes.
   - Fixtures forge authority rows (`01-actors.sqlinc:45-75`; `s09g_warp` disables triggers).
   - No behavioural pgTAP ever does `SET ROLE` to an API role; grants and RLS are shown by catalog checks only.
6. **Lock and serialization clauses (052, 097, 157)** rely on race runners outside `pnpm validate`, with no receipt.
7. **Disjunctive assertions:**
   - pgTAP `in (...)`: 058, 136, 141, 187, 192.
   - Status sets: 733, 766, 793, 825, 854, 855 (`[400,422]`); 466 (`[200,201]`); 612 (`[400,404]`); 890 (`[404,405]`); 1022 (`[403,404]`).
   - DOM selector: 1094.
8. **Tracking inconsistent (AC1149).**
   - Tracker lines 10 and 13 still say "956 open" and point to an open-criteria block that doesn't exist.
   - The Slice 10 and 12 trackers say "249/1235".
   - `spec-pipeline.md:416` lists AC678 and AC1128–1138 as open, though all are `[x]`.
   - The phase tracker (line 388) says "not complete".
   - `decisions.md` stops at DEC-107.
9. **The evidence guard is still structural.** It never runs the index commands, and AC1144 is enforced as "has an entry plus a receipt string".

## 5. Security findings

### SEC-1 (HIGH): legacy JWT GUCs (static analysis; needs one real-stack call to confirm)

**Evidence:**
- Migrations read only `request.jwt.claim.role`, `.sub` and `.aal`: 13 sites, zero reads of `request.jwt.claims`.
- The local `public.ecr.aws/supabase/postgrest:v16.1` binary (`audit3/pgrst/layer/bin/postgrest`) knows `request.jwt.claims`, `request.headers`, `request.cookies`, `request.method` and `request.path`. It has no `jwt.claim.` string and no legacy-GUC option.

**Fail-open (impersonation):**
- `platform_private.cfg_actor` (`20260901070000:361-401`) binds the caller to the JWT `sub` only when `claim.role = 'authenticated'`. Otherwise it trusts `context.authUserId`. `cfg_acting_party` (`:404-421`) trusts `context.actingPartyId`.
- `authenticated` can EXECUTE `cms_create_type_draft`, `cms_add_field_definition`, `cms_bind_relation`, `cms_list_content_types` and `cms_get_content_type_version` (`20260902080000:8233`; guarded by `r8_api_surface.sql:110-113`).
- `platform_api` is exposed (`config.toml:13`).
- So `POST /rest/v1/rpc/cms_list_content_types` with `Content-Profile: platform_api`, your own bearer token and `{"p_request":{"context":{"authUserId":"<victim>","actingPartyId":"<victim org>"}}}` would read or write as the victim.
- It bypasses the Worker's CSRF, rate limiting and admission checks, and writes audit rows attributed to the victim.
- Precondition: the attacker needs the victim's Auth UUID and one of the victim's organization IDs.

**Fail-closed (deployed outage):**
- These gates require `claim.role = 'service_role'`:
  - `cms_require_release_worker` and `cms_release_actor` (`20260902080000:5028-5060`)
  - `cms_worker_require_request` (`:5688-5699`)
  - `cms_worker_require_scan_request` (`20261002148000:138`)
- They cover 37 call sites: CMS-03A-05/06 block release, plus every migration-worker step (claim, heartbeat, dry-run batches, finalize, activate, verify, rollback).
- Every real Worker call to them gets `UNAUTHENTICATED`.

**Why it's invisible:**
- pgTAP sets the GUCs by hand (52 `claim.role` and 67 `claim.sub` uses) as superuser.
- Worker tests fake PostgREST.
- The e2e lane uses in-memory ports.
- The performance smoke only hits `/health`.

**To confirm:**
1. Make the forged-context call above against a local stack; it should return `UNAUTHENTICATED`.
2. Run one migration-worker lease claim through the real Worker.

**Fix direction:**
- Read `request.jwt.claims` (or `auth.role()` / `auth.jwt()`) everywhere.
- Add one real-PostgREST test per role (anon, authenticated, service_role).
- Then reopen every criterion whose proof depends on the hand-set GUC.

**Outside Slice 09:** `party_identity_aliases`, `relationships_authority_governance` and `profile_ownership_commands` share the root cause. The profile one reads `claim.aal`, so step-up is always required there and that path fails closed.

### SEC-2 (MEDIUM): RLS protects no real caller
- The function owner `postgres` bypasses RLS (`r3_rls_session_scope.sql:14`), and so does `service_role`.
- `anon` and `authenticated` hold no table grants.
- The restrictive policies behind 181, 647, 660 and 675 are proven only on a synthetic probe role.

### SEC-3 (MEDIUM): monitoring blind spots
- A replayed release nonce is a DB `CONFLICT` (`20260902080000:4944-4946`). It is never counted as a `rejected` nonce claim (`route-registry-metrics.ts:127-130`), and `nonceRejectionRate` keys on a "NONCE" error code nobody emits. So `nonce_rejection_spike` can never fire.
- Worker-side 401 and 403 refusals emit no telemetry (`route-human-authority.ts:62-85`). The denial-spike alerts (AC694) never see them.

### SEC-4 (LOW–MEDIUM): idempotency mismatch → `refresh` / `INVALID_TRANSITION` (D-IDEM)
- A client that reuses a key with a changed body is told to refresh and retry, not to use a new key.

### SEC-5 (LOW): release-route authority rows
- A human caller on CMS-03A-05 gets 401 from the DB, where BE03a:164 says 403.
- No DB 404 exists for an unknown release target.
- The Worker's 403/404 rows for A05/A08 are stubbed.

### SEC-6 (LOW, fails closed): AC1127
- `profile-ownership-command-transport.ts:106` turns 401 `STEP_UP_REQUIRED` into "Sign in again".

### SEC-7 (LOW): CSRF runs late
- Session-bound CSRF runs after the session, capability and step-up reads (`route-human-authority.ts:79-86`), not at BE00 step 2.

### SEC-8 (test validity): owner authority without grants is never really tested
- AC523 forges only the projection; the real grants stay valid.
- AC1133's owner still holds 3 self-grants, so the label at `r3_ia_edge_cases.sql:303` is false.
- A regression to "any valid CMS grant" would pass both tests. The code itself is correct.

### Confirmed sound
- **Step-up proof:** checked per request (`production-session.ts:99-108`), requiring aal2 plus MFA amr and taking the older instant. A refresh never extends it; aal1 or amr-less tokens carry no proof; `iat` is never used. CMS and editorial read the same value. 764, 884 and 909 are PROVEN.
- **CFG-05B-06:** requires the capability and fresh step-up, and refuses self-targeting (`20261002175000`).
- **CMS-03A-12 decide** (`20261002197000:77-100`) requires:
  - an effective assignment;
  - not the submitter and not a repeat decider;
  - eligibility;
  - a fresh, binding-bound step-up instant.
- **Grants and search_path:**
  - Every SECURITY DEFINER pins `search_path`.
  - Exactly 51 cms_ functions are executable; `authenticated` can execute only the 5 originals.
  - The 2 internal functions are executable by no API role.

## 6. Rewordings and authority
- **DEC-122:** an owner-ratified raw record exists (`.memory/raw/events/2026-10-03.jsonl`, `dec-122-ratified`, agent-written). It covers 300, 678, 774, 1031, 1166, 285, 431, 942 and 1049.
- **DEC-123:** owner record covers 003, 045, 049.
- Neither is compiled into `decisions.md`.
- **Ledger:** 16 rows are bold "pending owner ratification" (ledger `:162-194`; tracker line 93): 005, 007, 025, 037, 180, 185, 233, 246, 261, 282, 356, 431 (refinement), 658, 708, 906, 1147.
  - The checked criterion rows themselves are unmarked and count toward 1235.
- **Unrecorded rulings:**
  - AC034 is "pending ratification" in integrator-v4 but has no ledger row.
  - AC390 and AC641 were flagged by r12-db (`reports/r12-db.md:59`) for an owner or spec ruling; there is no ledger row for either. The AC390 change adds an optional workflow pair to the CMS-03A-09 API, which is an architecture decision.
- **Defective rewordings:**
  - AC658's text says "grant, renew and revoke RPCs only", yet names the backfill writer. Its own test shows `cms_backfill_owner_capability_grants` inserting rows (`evidence_constraints_grants.sql:94`).
  - AC233's ledger row says it "stays open until the reconnect-revalidation clause is asserted", yet it is `[x]`. Its "reconnect" test is an immediate in-memory retry against stubbed fetches.

## 7. Receiving criteria and transfer record
- **Receiving criteria:** P2-S11-AC-046 to 048, P2-S12-AC-051 to 053 and P2-S16-AC-029 all exist, are open, have identical text in the plan and the trackers, and are specific. This fixes re-audit 2's "generic carriers" finding.
- **Transfer record:** it states 0 original transfers and 7 under DEC-122 (3 to Slice 11, 3 to Slice 12, 1 to Slice 16). The counts are right.
- **What's wrong:** AC282 and AC1147 credit all seven to DEC-122.
  - The ratified DEC-122 covers only the AC1031 move (S11 046–048) and the AC1166 move (S12 051–052).
  - S12-053 comes from DEC-123.
  - S16-029 comes from the AC185 ruling, still pending.
  - AC282's "covered by existing owners" check is still a keyword regex.

## 8. Chrome receipts
- All marked titles are present and passed, and every spec is in the right config's `testMatch`.
- Five pass counts don't match the reports (§2).
- The AC262 performance spec isn't wired into any suite.
- The evidence is browser-only (§2).

## 9. Reopen list (exact)

**A. NOT-PROVEN, reopen now (9):** 025, 064, 658, 1127, 1146, 1149, 1182, 181, 685.

**B. WEAK (S), reopen unless the missing assertion lands (50):**
032, 034, 045, 052, 097, 122, 157, 208, 224, 233, 234, 244, 248, 249, 254, 261, 282, 355, 523, 534, 537, 574, 593, 694, 714, 726, 736, 823, 850, 880, 906, 930, 963, 994, 1005, 1021, 1031, 1034, 1036, 1050, 1064, 1076, 1094, 1122, 1133, 1138, 1144, 1147, 1150, 1204

**C. Re-verify unsampled siblings before keeping `[x]`:**
- 503 "provider, circuit or database": 789, 820, 876.
- Step-up stale/future variants: 441, 503.
- Expired session never produced: 305, 351, 393, 456, 492, 563, 591, 620, 936, 1022, 1067, 1070.
- CMS 415 `{}` details: 309, 397, 434, 496, 538, 567, 595.
- D-IDEM (needs a code fix plus a corrected stand-in DB): 300, 354, 396, 433, 495, 566.
- Disjunctive assertions: 058, 136, 141, 187, 192, 466, 612, 733, 766, 793, 825, 854, 855, 890, 1022.
- SEC-1 dependent, once confirmed: every proof that needs the hand-set `request.jwt.claim.*`. Sampled indicators: 003, 034, 098, 104, 108, 114, 119, 122, 151, 156, 157, 162, 163, 169, 180, 212, 217, 641, 658, 674, 1199, 1204.

**D. Hold until the owner ratifies — uncheck or mark conditional (19):**
005, 007, 025, 034, 037, 180, 185, 233, 246, 261, 282, 356, 390, 431 (refinement), 641, 658, 708, 906, 1147

**E. WEAK (C), fix the index citation only (27):**
023, 090, 167, 171, 303, 307, 308, 454, 527, 545, 594, 602, 629, 632, 739, 797, 814, 828, 856, 863, 895, 898, 918, 929, 1047, 1142, 1227

**Tracking fixes:**
- Tracker lines 10 and 13, and the "open-criteria block" they reference.
- The "249/1235" notes in the Slice 10 and 12 trackers.
- `spec-pipeline.md:416` and `phases/phase-02.md:388`.
- Compile `decisions.md` through DEC-123.
- Mark pending-ratification rows on the criterion lines themselves.
- Record AC034, AC390 and AC641 in the ledger.
- Reconcile the receipt counts for 1036, 1037, 1038.
- Wire the AC262 performance spec into a suite.
- Fix the AC1150 runbook. It omits the step-up reconciliation hop, and its "escalate" conditions fire on normal intermediate states: the first enrollment is a 401, and the removed factor still lists as reconciling.

## 10. Per-criterion verdicts (200)
These are in `scratchpad/audit3/table.md`, one row per criterion. Columns: ID, set, batch, prior verdict, verdict (with (P) flag), reason, deciding file:line.

Files are in `/tmp/claude-1000/-home-rob-Projects-WeJammin/8b84077b-05a3-4143-a4a7-ae46900e86e6/scratchpad/audit3/`:
- table.md
- merged.json
- sample.json
- out-DBA.md, out-DBB.md, out-WEB.md, out-WK.md
- AU-verdicts.json, DBA-verdicts.json, DBB-verdicts.json, WEB-verdicts.json, WK-verdicts.json
- brief.md
- build.cjs, merge.cjs, sqlscan.cjs