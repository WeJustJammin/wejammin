# Phase 2 — Codex continuation handoff (from Claude)

**Status:** live document, refreshed at every Claude checkpoint. Last refresh: 2026-10-03 16:55 EDT.
**Why this exists:** the owner asked Claude to hand Phase 2 to Codex when Claude's usage reaches its limit.
**Goal (owner, verbatim intent):** finish Phase 2 Slices 09–17 through `/implement-slice`. Do not stop until Phase 2 is complete. Clean up every completed worktree and branch as you go, and leave no stale worktrees, branches or temp files.

| Item | Value |
|---|---|
| Repository | `WeJustJammin/wejammin` |
| PR | https://github.com/WeJustJammin/wejammin/pull/124 (draft; **local commits after `073496db` are not pushed**) |
| Branch | `codex/phase2-claude-handoff-20261002` |
| Local worktree | `/home/rob/.codex/worktrees/ac265-hosted-evidence-producer/WeJammin` (the main checkout `/home/rob/Projects/WeJammin` must not be touched) |
| Base | `f0bde9f1` (`origin/main` at the 2026-10-02 checkpoint) |
| Context files | `docs/handoffs/2026-10-03-phase2-codex-handoff/`, written `context/` below (decisions, audit, lane reports, research breakdowns, orchestration log) |

## Start here

1. Read `AGENTS.md`, the rules in `.agents/`, `.claude/rules/` (the same rules apply), the previous handoff `docs/handoffs/2026-10-02-phase2-claude-handoff.md`, and this file.
2. Read `context/orchestration.md` from the bottom up. It is the running log of every lane, failure and decision since 2026-10-02.
3. Read `context/decisions/s09-resolutions.md` and `context/decisions/s10-s17-resolutions.md`. They hold every owner decision (DEC-108..DEC-128) and every orchestrator ruling. Do not ask the owner again about anything recorded there.
4. Run `git status`, `git log --oneline f0bde9f1..HEAD`, and `git stash list` (it should be empty) in the worktree.

## Hard constraints (unchanged from the 2026-10-02 handoff)

- No reset, revert or broad deletion of existing work. Migrations are forward-only.
- No new real accounts, grants, deployments, paid plans or provider enrollment. Protected production writes stay disabled.
- Use Chrome only for browser work. No paid Google Workspace.
- Never put credentials or private keys in chat, PRs, evidence or logs.
- AC209, AC211, AC265 and AC266 stay **deferred gates**. Never mark them passed, waived, simulated or inferred.
- Never hand-insert review, decision, dry-run, approved or completed-plan rows to claim a producer path. Labelled negative-control forgeries are fine.
- Rules in force: TDD contract-first, debug-by-test (a failing test before any fix), boundary-not-placeholder (no TODOs), security-first, vertical slices, completion checklist, and memory capture. Never edit `.memory/wiki/{decisions,patterns,blockers}.md` directly. Use `flushEntry()` from `.memory/pipeline/flush.mjs` and then `node .memory/pipeline/compile.mjs`.
- Toolchain: `export PATH="$HOME/.local/share/wejammin-toolchain/bin:$PATH"` (node 22.23.1 and pnpm 11.24.0). Plain `pnpm` is broken on this machine.

## Security status — read first

- **SEC-1 (high, fixed on this branch, not yet merged).**
  - **What was wrong:** database authority checks read the legacy GUCs `request.jwt.claim.role/sub/aal`. PostgREST v10+ sets only `request.jwt.claims` (JSON).
  - **Effects, confirmed on a real PostgREST v16.1:**
    - A signed-in user could call `platform_api` RPCs directly with a forged `context.authUserId` and act as another user.
    - Every service-role worker RPC returned `UNAUTHENTICATED`.
    - A further bug was found: the profile-ownership step-up check was fail-open (`NULL NOT IN (...)`).
  - **The fix:** `platform_private.request_jwt_claim` reads only `request.jwt.claims`, in migrations `20261003110000`–`110200`. `pnpm db:start` now runs PostgREST and Kong. `pnpm db:api-test` (in `tests/postgrest/`) exercises the real API path and is part of `db:verify` and the CI database job.
  - **Staging:** it applies main's migrations through `deploy-staging.yml` and last ran on 2026-09-26, so **staging is probably exposed until this PR merges**. The owner has been told. Do not touch staging yourself.
- **SEC-2 (fixed on this branch).**
  - **What was wrong:** `postgres` has BYPASSRLS and owned every SECURITY DEFINER function, so forced RLS never applied.
  - **The fix:** the new NOLOGIN non-bypass roles `wejammin_cms_definer` and `wejammin_cms_authority_reader` now own the CMS definer functions (migrations `20261003120000`–`120500` and later).
  - **Defects exposed and fixed:** the MFA last-factor guard was blind to CMS authority; the owner-grant backfill wrote 0 rows; the CMS-03A-13 403 branch is fixed.

## Slice 09 state

- **The 1235/1235 claim (commit `073496db`) was false.** Independent audit #3 (`context/s09-audit3.md`, verdict table `context/audit3-table.md`) estimated about 1.3% hard-false, 27% soft-false and 57% fully proven. Do not trust any `[x]` until the full re-verification below has run.
- **Owner ratified, 2026-10-03:**
  - DEC-124: 16 rewordings — use the proposed texts in `context/decisions/r14-ratification-bundle.md` verbatim.
  - DEC-125: AC185 enforcement moves to Slice 16 (S16-AC029).
  - DEC-126: keep the optional workflowKey/workflowVersion pair on CMS-03A-09.
  - DEC-127: the rollback RPC may fail a dry_running plan.
  - DEC-128: AC906 uses the pull model, proven by a no-cache guard and a real multi-tab test.
  - The ratified texts are **not yet applied** to the plan, tracker or ledger. The 19 held criteria are unchecked, each with a "held: …" note.
- **Later owner decisions (2026-10-03):**
  - DEC-129: delete the CMS-03A-05 "unknown release target is 404" clause.
  - DEC-130: AC1122 is reworded to cover each branch.
  - Orchestrator rulings:
    - AC527: the 409 carries `recoveryAction: 'renew'`.
    - AC1108: the admin MFA reset surface follows the spec's `tab=mfa-reset`.
- **R14 and R14b completed** (WIP `e1e53a74`):
  - Database: `db:test` 198 files / 8191 tests, `db:api-test` 53 tests, races 6/6 (with the `test-results/db-races.jsonl` gate).
  - Worker and contracts: 7017 tests.
  - Web and contracts: 3907 tests.
  - Bundle: 89,922 B gzip against the 92,160 B budget.
  - Chrome: s09-real passes in a single invocation, 107/0/0; functional is 105/0/0.
  - The new real-stack tests exposed two more production defects, both fixed:
    - CMS-03A-02 could never succeed: the Worker sent a flat body.
    - Every committed CMS-03A-05 returned 502.
- **Integrator v5 was running at the last refresh:**
  - Green the ~15 failing root vitest tests.
  - Apply the DEC-124..130 texts and the AC527, DEC-129 and AC1108 changes.
  - Fix the citations.
  - Produce real outputs and generated receipts.
  - Its report is `context/reports/integrator-v5.md`.
  - A Codex adversarial review of the R14 commits is saved to `context/reports/codex-review-r14.md`. Verify each finding before fixing it.
- **Codex review of R14 (`context/reports/codex-review-r14.md`):** Claude verified all 5 findings against the code and the catalog. Details are in the `context/orchestration.md` entry "Codex review R14".
  - Findings 4 and 5 were being fixed by lane R14c-app (report `context/reports/r14c-app.md`):
    - (4) AUTH-API-03 decodes the body before the origin and CSRF checks.
    - (5) Step-up drafts are not bound to the account or session.
  - Still to fix after integrator v5, since all three need the DB or the receipts tooling:
    - (1) `platform_api.admin_mfa_factor_reset` and `identity.rpc_admin_reset_mfa_factors` are still owned by postgres (BYPASSRLS) and write forced tables. The guard scanned too narrowly; sweep every SECURITY DEFINER function that touches a forced table.
    - (2) The real-PostgREST test derives its own target set from function bodies. Use an explicit manifest with exact equality, plus a mutation test.
    - (3) Receipts promote file-level pgTAP verdicts to every marker. Require assertion-level verbose TAP, reject SKIP/TODO, and drop the file-level fallback.
- **R14 remediation history** (lane reports in `context/reports/`):
  - Done:
    - SEC-1 (DB1).
    - Worker class sweeps (WK): BE00 middleware order on every cookie route family, 503/expired-session/step-up/415 variants, and AC1031/AC1142.
    - Evidence tooling (EVID): receipts generated by `pnpm evidence:collect`, a bidirectional marker-citation guard, holds, the ratification bundle and tracking fixes.
    - Web lane 1.
  - Running at the last refresh (workflow `wf_7194570c-35c`): DB2 finishing SEC-2, then DB3, then WEB2. Check the lane reports for their final state.
    - DB3 covers: the `cms_json_bounded` type-safety fix, the MFA settlement receipt, D-IDEM (`IDEMPOTENCY_MISMATCH` instead of `CONFLICT`), AC064 literal null, SEC-5 release-route 403/404, SEC-3 nonce/denial telemetry, SEC-8 owner-without-grants tests, disjunctive pgTAP assertions, and race-runner JSON output.
    - WEB2 covers: AC1127 draft persistence and consolidation, the "ownerFull" label defect, the AC261 bundle reduction (the real build is ~141.7 KB gzipped against a 90 KB budget), AC233 input, AC1122, AC248, the persona fixture, the AC1108 marker, and the stability problem where the Wrangler "Network connection lost" crash forced s09-real to be split into 4 runs.
  - Latest WIP checkpoint: `d8f9de1f` (not pushed). DB2 (SEC-2) finished: `pnpm db:verify` green, 197 files / 8076 tests, db:api-test 22, races 6/6. Every lane's later output is uncommitted until the next checkpoint commit.

## Next steps, in order

1. If any R14 lane is unfinished, read its report (`context/reports/r14-*.md`, `r14b-web.md`) and finish it. Database work is single-owner and sequential.
2. **Integrator v5:**
   - Apply the DEC-124..128 texts and un-hold those criteria.
   - Fix the AC090 and AC1142 citations.
   - Produce real outputs: `pnpm db:test` verbose TAP, db:races JSON, `pnpm db:api-test`, full vitest JSON, and Playwright JSON from single invocations of the functional and s09-real configs.
   - Run `pnpm evidence:collect` to write the receipts, get all guards green, and pass `pnpm progress:check`.
   - Do not rerun `s09v4/merge-v4.mjs`; it undoes the receipt work.
3. Commit a checkpoint, then run an adversarial review of the R14 commits (base `073496db`). Verify every finding before fixing it; earlier reviews produced false positives.
4. **Full re-verification of all active S09 criteria** by a fresh verifier population: PROVEN / WEAK(C) / WEAK(S) / NOT-PROVEN, each with the deciding file:line, written to disk. Then fix lanes for everything not PROVEN, a separate re-verification of the fixed set, and an independent sample audit. Audit, refute, fix and verify must be separate populations.
5. Run full `pnpm validate` plus `pnpm db:verify` and all Chrome configs in this worktree. Push PR #124, watch CI on the self-hosted runners, and merge when green. The merge triggers the staging deploy, which closes the SEC-1 exposure.
6. **Clean up after the merge:** remove this worktree and branch, and any branches or worktrees you created. `/home/rob/Projects/WeJammin/.claude/worktrees/agent-*` (~100, pre-existing) and the untracked `apps/worker/src/cms-editorial/` in the main checkout are pre-existing; ask the owner before deleting them.
7. **Slices 10–17:**
   - Inputs: `context/s10-s17-survey.md`, `context/s10-s11-breakdown.md`, `context/s12-breakdown.md`, and the decisions in `context/decisions/s10-s17-resolutions.md` (DEC-109..DEC-121 owner; D2–D25, G3, G6, G9, OD-1..OD-6, and the A2/A3 follow-ups).
   - Per slice: spec cascade, depth-floor ledger, RED, GREEN, evidence markers, an independent audit, validate, and a PR.
   - Earlier Slice 10/12 code exists on this branch but is unaccepted.
   - Known carry-overs:
     - Upload intents and completion are unwired in production (503) — media slices 13/14.
     - DEC-114 builds CMS-15/16 and CFG-05C-01 in Phase 2.
     - The S12 live bugs listed under OD-6.
8. **Final close:** S17, then verify-infrastructure, then validate-phase.

## Lessons that cost real time (apply them)

- An `[x]` with a hand-written receipt has been wrong about 40% of the time across three audits. Close a criterion only on generated receipts plus an independent verification.
- When fixing a class of defect, sweep the whole class and state N/N. Every audit's top finding was a fix that stopped partway.
- Test authority through the real path: a real PostgREST, the real Worker adapters, and the real role that owns the functions. SEC-1 and SEC-2 survived months because tests set GUCs by hand and ran as roles that bypass RLS.
- Subagents' cwd resets to the main checkout. Every command must start with `cd <worktree> &&`, and the worktree path and HEAD must be checked first.
- Run at most about 4 concurrent heavy agents. Commit a WIP checkpoint before each wave, because account limits kill lanes mid-edit.
- Wrangler-backed s09-real Playwright runs crash under one long invocation ("Network connection lost") until WEB2's stability fix lands.
