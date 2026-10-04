# Phase 2 — Codex continuation handoff (from Claude)

**Status:** live document, refreshed at every Claude checkpoint. Last refresh: 2026-10-04 02:10 EDT (final Claude refresh; Claude weekly usage exhausted).
**Why this exists:** the owner asked Claude to hand Phase 2 to Codex when Claude's usage reaches its limit.
**Goal (owner, verbatim intent):** finish Phase 2 Slices 09–17 through `/implement-slice`. Do not stop until Phase 2 is complete. Clean up every completed worktree and branch as you go, and leave no stale worktrees, branches or temp files.

| Item | Value |
|---|---|
| Repository | `WeJustJammin/wejammin` |
| PR | https://github.com/WeJustJammin/wejammin/pull/124 (draft; all Claude commits pushed) |
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

- **Do not trust the `[x]` marks yet.** The 1235/1235 claim at `073496db` was false. Independent audit #3 (`context/s09-audit3.md`, verdicts in `context/audit3-table.md`) estimated about 1.3% hard-false, 27% soft-false and 57% fully proven. Since then, R14 through R14d have fixed every systemic class it named and every listed reopen item. No new independent audit has run since R14 (see Next steps).
- **Owner decisions this session**, all recorded as raw records and compiled into `.memory/wiki/decisions.md`:
  - DEC-124: 16 rewordings, applied verbatim from `context/decisions/r14-ratification-bundle.md`.
  - DEC-125: AC185 enforcement moves to Slice 16 (S16-AC029).
  - DEC-126: CMS-03A-09 keeps the optional workflowKey/workflowVersion pair.
  - DEC-127: the rollback RPC may fail a dry_running plan.
  - DEC-128: AC906 uses the pull model, proven.
  - DEC-129: the CMS-03A-05 unknown-target 404 clause is deleted.
  - DEC-130: AC1122 is proven per branch.
  - Errata applied in R14d, recorded as ledger notes: AC1122 reads 400 INVALID_REQUEST, not VALIDATION_FAILED; AC034 drops the deleted 404 clause; AC233 drops a stale "stays open" phrase; AC282 and AC1147 now say "ratified by DEC-125".
- **Orchestrator rulings** (`context/decisions/s09-resolutions.md`): AC527's 409 carries `recoveryAction: 'renew'`; AC1108 uses `tab=mfa-reset`; the R14-web rulings.
- **Tracker:** S09 shows 1234/1235, with AC261 still held. Re-check AC261 now that the bundle budget is met: 89,922 B gzip against 92,160.
- **Last full verification** (R14e, final Claude commit — see `git log -1`):
  - `pnpm validate` exits 0 with 100% coverage.
  - `pnpm db:verify` exits 0.
  - `pnpm progress:check` exits 0.
  - Verbose pgTAP (`pnpm db:test:tap`): 201 files, 8233 ok.
  - `db:api-test`: 9 files, 70 tests through real Kong→PostgREST.
    - Claim gate: 90/90 manifest entries, each with a valid per-signature fixture, 379 exact probes, and mutation 90/90.
  - Races 6/6.
  - Root vitest: 1231 files, 13765 passed.
  - Chrome, single invocations: functional 105/105 and s09-real 112/112.
  - Generated receipts `tests/contracts/phase-02-slice-09-receipts.generated.jsonl`: 9961 rows, all passed. None are stale, skipped, failed or file-level; a skip is rejected for every tool.
  - PR #124 CI was 3/3 green at `356a5dec`.
- **Real production defects found and fixed this session.** Every one was invisible to the old tests:
  - SEC-1: legacy JWT GUCs made actors forgeable and service-role RPCs dead.
  - SEC-2: RLS never applied to definer functions.
  - The step-up check was fail-open (`NULL NOT IN`).
  - CMS-03A-02 never succeeded.
  - CMS-03A-05 always returned 502.
  - The 409 details allowlist dropped `recoveryAction`.
  - The MFA last-factor guard was blind to CMS authority.
  - The owner-grant backfill wrote 0 rows.
  - Cookie reads skipped the Origin check.
  - Upload routes had no CSRF.
  - Blocked migration plans emitted no telemetry.
  - The grant console lost its idempotency key across step-up.
  - Step-up drafts leaked across accounts.
- **Codex reviews:**
  - R14 (`context/reports/codex-review-r14.md`): 5/5 findings verified and fixed in R14c and R14c2.
  - R14c2 (`context/reports/codex-review-r14c2.md`): findings 1–4 verified and fixed in R14e (report `context/reports/r14e.md`). Finding 5 was a timing artifact, closed by the R14d errata and DEC-131.
  - The R14d and R14e commits have **not** had an adversarial review yet.

## Next steps, in order

1. Run an adversarial review of the commits after `e89c2e1d`, which cover R14d and R14e: the cross-tab scope sync, the proxy body streaming, the claim-gate fixtures and the receipt skip rule. Verify each finding against the code before fixing it, and fix confirmed findings RED-first.
2. **Independent verification of Slice 09.** Use a fresh population that did none of the work:
   - First an audit #4 sample, like audit #3: about 200 criteria across sets a/b/c plus security probes.
   - Then a full re-verification of all 1235 active criteria (PROVEN / WEAK(C) / WEAK(S) / NOT-PROVEN, with the deciding file:line, written to disk).
   - Then fix lanes for everything not PROVEN, then a separate re-verification of the fixed set.
   - Audit, refute, fix and verify are separate agent populations.
   - Close a criterion only on a generated receipt plus a verifier PROVEN.
3. Run `pnpm validate`, `pnpm db:verify`, `pnpm db:test:tap`, `pnpm evidence:collect` (0 stale) and both Chrome configs in single invocations.
4. Push PR #124, watch CI on the self-hosted runners, and merge when green. The merge triggers the staging deploy, which also closes the SEC-1 staging exposure.
5. Clean up after the merge:
   - Remove this worktree and branch, plus any branches or worktrees you created.
   - Ask the owner about the pre-existing `/home/rob/Projects/WeJammin/.claude/worktrees/agent-*` (~100) and the untracked `apps/worker/src/cms-editorial/` in the main checkout.
6. **Security follow-up (pre-existing, outside S09):**
   - 154 earlier-slice SECURITY DEFINER functions are still owned by BYPASSRLS `postgres` while touching FORCE-RLS tables. The list is in `context/reports/r14c2-fix.md` and the evidence JSON.
   - This includes nested legacy helpers on the MFA reset path.
   - Plan a sweep with the same pattern: non-bypass definer roles and behavioural RLS tests.
7. **Slices 10–17:**
   - Inputs: `context/s10-s17-survey.md`, `context/s10-s11-breakdown.md`, `context/s12-breakdown.md`, and `context/decisions/s10-s17-resolutions.md` (DEC-109..DEC-121 owner decisions; D2–D25, G3, G6, G9, OD-1..OD-6, and the A2/A3 follow-ups).
   - Per slice: spec cascade, depth-floor ledger, RED, GREEN, evidence markers plus generated receipts, an independent audit, validate, and a PR.
   - Earlier Slice 10/12 code exists on this branch but is unaccepted.
   - Carry-overs:
     - Upload intents and completion are unwired in production (503) — media slices 13/14.
     - DEC-114 builds CMS-15/16 and CFG-05C-01 in Phase 2.
     - The S12 live bugs under OD-6.
     - No producer exists for ungoverned membership acceptance (the largest remaining labelled-forgery class in pgTAP).
     - No cross-organization CMS grant producer exists (AC593).
8. **Final close:** S17, then verify-infrastructure, then validate-phase.

## Lessons that cost real time (apply them)

- An `[x]` with a hand-written receipt has been wrong about 40% of the time across three audits. Close a criterion only on generated receipts plus an independent verification.
- When fixing a class of defect, sweep the whole class and state N/N. Every audit's top finding was a fix that stopped partway.
- Test authority through the real path: a real PostgREST, the real Worker adapters, and the real role that owns the functions. SEC-1 and SEC-2 survived months because tests set GUCs by hand and ran as roles that bypass RLS.
- Subagents' cwd resets to the main checkout. Every command must start with `cd <worktree> &&`, and the worktree path and HEAD must be checked first.
- Run at most about 4 concurrent heavy agents. Commit a WIP checkpoint before each wave, because account limits kill lanes mid-edit.
- Self-hosted CI runners (wejammin-2/-3) run on THIS host and share the local Supabase stack (project_id `wejammin`). Pushing to the PR triggers `pnpm db:ci`, which resets the local DB and then stops it. Wrap all local DB work in `flock --wait N 9 ... 9>/tmp/wejammin-supabase-ci.lock` (the lock CI's `infra/verify-database.sh` uses), and restart with `pnpm db:start && pnpm db:reset` after CI stops it.
- Never SendMessage a running Workflow agent: it starts a second copy, and the two collide in the same tree.
- Wrangler-backed s09-real Playwright runs crash under one long invocation ("Network connection lost") until WEB2's stability fix lands.
