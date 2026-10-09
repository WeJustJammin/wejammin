# Phase 2 — Codex continuation handoff (from Claude, Slice 11 in flight)

**Status:** live document, refreshed at every Claude checkpoint. Last refresh: 2026-10-09 01:50 UTC (final Claude refresh; weekly usage at 96%).
**Why this exists:** the owner asked Claude to hand Phase 2 to Codex when Claude's weekly usage runs out (memory: codex-handoff-at-usage-limit). Claude's weekly limit resets 2026-10-13 23:00 UTC.
**Goal (owner, verbatim intent):** finish Phase 2 Slices 09–17 through `/implement-slice` and the final `/validate-phase`. Keep externally owned release evidence (AC209, AC211, AC265, AC266) on its approved timeline; never fabricate or count it as passed. Close each slice with evidence, depth checks, tracking, architecture/runbook updates, session capture and memory flush/compile. Open PRs, verify checks, follow the established integration process. Clean task-owned worktrees, branches and temp artifacts after verifying they are merged and recoverable.

| Item | Value |
|---|---|
| Repository | `WeJustJammin/wejammin` |
| Worktree | `/home/rob/.codex/worktrees/phase2-slice11/WeJammin` (never edit the primary checkout `/home/rob/Projects/WeJammin`, and never stage its untracked `apps/worker/src/cms-editorial/` or `packages/contracts/src/cms-editorial/`) |
| Branch | `claude/phase2-slice11` (base `3640b506` = `origin/main`, the Slice 10 squash merge, PR #126) |
| Committed on the branch | `1dc3969b` (Slice 11 criteria AC049–AC122, DEC-149..155, depth-floor ledger), `fe2eb57f` (live handoff). Everything else in this file is uncommitted work on disk unless the "Commit state" section below says otherwise. |
| Backup refs (local) | `refs/backup/s11-wave1-reboot`, `refs/backup/s11-wave2`, `refs/backup/s11-wave3` — full snapshots of the uncommitted tree |
| Orchestration record | `/home/rob/.codex/worktrees/phase2-slice10/orchestration/` (durable, outside git). A copy of the Slice 11 parts is in `docs/handoffs/2026-10-08-phase2-codex-handoff/` (`s11/` briefs and lane reports, `lanes/NOTES.md` binding rulings, `codex/` reviews and the RPC plan, `lanes/*.sh` runners) |
| Previous handoffs | `docs/handoffs/2026-10-06-phase2-claude-handoff.md` (Codex → Claude), `docs/handoffs/2026-10-07-phase2-s10-live-handoff.md` (Slice 10 record + Slice 11 checkpoint) |

## Start here

1. Read `AGENTS.md`, `.claude/rules/*` (they apply to you), the 2026-10-06 handoff, and this file.
2. Read `docs/handoffs/2026-10-08-phase2-codex-handoff/lanes/NOTES.md` from the "2026-10-08 12:40 ORCHESTRATOR" entry to the end: every Slice 11 cross-lane contract and ruling is there (Worker↔SQL transport, refusal conventions, helper signatures, guard cascades).
3. Read `.memory/wiki/decisions.md` DEC-147 … DEC-161. DEC-149..161 are orchestrator rulings the owner may override; do not re-ask the owner anything recorded there.
4. `git status`, `git log --oneline origin/main..HEAD`, `git stash list` (expect empty) in the worktree.

## Hard constraints (unchanged)

- No reset, revert or broad deletion of existing work. Migrations are forward-only once merged (the Slice 11 migrations are unmerged, so lanes have fixed them in place).
- AC209, AC211, AC265, AC266 stay deferred gates. Never mark them passed, waived, simulated or inferred.
- Never accept or enter passwords; no new real accounts, grants, deployments or paid plans. Merging to `main` triggers the staging deploy (established process); production stays disabled.
- Rules: contract-first TDD (RED observed, then GREEN), debug-by-test, boundary-not-placeholder, security-first, vertical slices, completion checklist, memory capture. Never edit `.memory/wiki/{decisions,patterns,blockers}.md`; use `flushEntry()` from `.memory/pipeline/flush.mjs` then `node .memory/pipeline/compile.mjs`.
- Toolchain: `export PATH="$HOME/.local/share/wejammin-toolchain/bin:$PATH"` (node 22.23.1, pnpm 11.24.0).
- The local Supabase stack is shared with self-hosted CI runners. Every DB reset/test takes `/tmp/wejammin-supabase-ci.lock` (the lane runner `lanes/lane-db.sh` does). Do not run local DB work while a CI DB job runs.
- The host rebooted once (2026-10-08 15:40Z): restart the main stack with `flock /tmp/wejammin-supabase-ci.lock ./node_modules/.bin/supabase start --workdir .` from the worktree. A second stack (`wejammin_ev`, port 55322, `lanes/lane-db-ev.sh`) exists; stop it at final cleanup.

## Owner-held questions (do not decide them)

- **DEC-147** (Slice 10 forward-scope wording): options A (reword the Slice 10 criteria and add receiving criteria to S11/S12, recommended), B (leave open), C (build the runtime now). Blocks Slice 10 AC030, 038, 040, 042, 044–048, 079, 080, 089 from closing. DEC-155 adds the Slice 11 AC035/AC038/AC041 wording defects to the same batch (proposed text in `s11/lane-s11-0-report.md` §7).
- Slice 10 evidence gaps AC-045 (misplaced preview sentence), AC-047 (audience 1–64 vs DEC-145 `{1,48}`), AC-056 (taxonomy half → Slice 12).

## Slice 10

Merged (PR #126, squash `3640b506`). Tracker 91/105 checked; the 14 partials are DEC-147 items, AC056 (Slice 12 half) and AC060. AC060 "in the same change" is satisfied by the squash commit (code, tracker, runbook and ARCHITECTURE.md in one commit) — record that in the Slice 10 tracker/ledger limitation at Slice 11 closeout (no git-history test is possible: CI checks out depth 1).

## Slice 11 — state per lane (122 criteria, none checked yet)

Lane reports are in `docs/handoffs/2026-10-08-phase2-codex-handoff/s11/lane-s11-<x>-report.md`; each ends with "Remaining".

| Lane | Scope | State at the final Claude refresh (2026-10-09 01:50 UTC) |
|---|---|---|
| S11-1 / S11-1R | contracts, registry, OpenAPI, tz pin 2026e, time authority; Codex contract-review fixes 1–10 | done; contracts:check, lint, format clean |
| S11-2 / S11-SR | data model 017000–017090; Codex SQL-review fixes (2 high fixed in place: preflight provider_version dispatch, review CAS requires decision rows; schedule retry/cancel guards; version-set canonical; manifest structure; lineage race 016) | done |
| S11-3s | shared helpers 017500–017595 (`s11/helpers-api.md`) | done; orchestrator fixed a pg-safeupdate defect at 017560:189 (unguarded DELETE refused under PostgREST) |
| S11-3a | review RPCs 017600–: submit, decision, assignment, DEC-159 envelope + audit side table, DEC-161 revoke-invalidates; races 012/… | done (318 tests + 3 races) — DEFECT 2 open: `cms_submit_review` (017640:158) hashes the Worker evidence into the idempotency request hash, so a same-key retry is 409; hash only the browser request (check 07/09 too) |
| S11-3b | schedule/publish/claim/execute 017700–017740; races 013–015 | done (236 assertions) — open: 9-digit fractions vs microsecond timestamptz; recorder event_id for event-less commands |
| S11-3c | verify, mint, workflow, review detail, queue, `cms_load_quality_gate_input` 017850–017910; race 020 | done |
| S11-3d | E2 derived state 018000–018090 (state CHECK narrowed to `draft`) | done — fixture `supabase/tests/phase_02_slice_11_e2/000-derived-evidence.sqlinc` (~line 29) seeds reviews with a count-only UPDATE that the S11-SR guard now refuses: seed real decision rows (7 files abort until then) |
| S11-4 | Worker routes, adapters, a11y checker, verifier adapter, sweep | done at unit level |
| S11-4R | real-composition apispecs (production adapters → real PostgREST) | 4 apispecs + 5 support modules written, never green on the repo migrations (run 3 used `S11_DIAG_OVERLAY=1`, a diagnostic overlay that is never evidence — remove it); rerun after the two SQL fixes |
| S11-5 | web surfaces; real-route Playwright | unit/a11y done; real-route 05/06/18 green only on a patched copy (now fixed in the repo — rerun); 07/09 specs never green; no real-route spec yet for 08, 16, 17; `build` + `bundle:check` unrun |
| S11-G | guard cascades (r8, sec2, ev_eb_publication_scope, S10 publication-boundary integration test), DB types, READMEs, full run | guards 53/53 pass; types regenerated + db:types:check; db:lint 0 errors; full pgTAP 329 files / 12,563 assertions: 321 green, reds = the 7 e2-fixture aborts + bench128 p95 under host load; races were running at the refresh (log `s11/lane-s11-g-races.log`) |

## Slice 11 — integration steps (orchestrator-owned, in order)

1. Finish the lanes above (each "Remaining" list). Regenerate DB types under the lock: `flock /tmp/wejammin-supabase-ci.lock bash -c 'pnpm db:reset && pnpm db:types'`.
2. Apply the GUARD CASCADE rows from every lane report to `supabase/tests/phase_02_slice_09_r8_api_surface.sql`, `phase_02_slice_10_ev_eb_publication_scope.sql` (turn it into an explicit allow-list of the named Slice 11 functions; keep it failing for any unnamed one) and `phase_02_slice_09_sec2_all_schema_definer_rls.sql`.
3. Real-stack verification: `lanes/lane-api.sh <worktree>` (PostgREST apispecs for every Slice 11 route and the internal RPCs), then real-route Playwright (`lanes/lane-e2e.sh`, project `real-route-chrome`). Watch the Worker `cpu_ms` 50 limit on the minute sweep (S11-4 note).
4. README rows for new directories (supabase/migrations section, test dirs), `docs/ARCHITECTURE.md` Slice 11 delta, runbook `docs/runbooks/platform/cms-publication.md`.
5. Receipts: S09 and S10 receipts are stale (cascaded files: routes.test.ts, supplemental-routes.test.ts, core-contracts.test.ts, registries.test.ts, index-scheduled.test.ts, scheduled-manual-review-retry.test.ts, production-idempotency-expiry-sweep.test.ts, S10/S12 SQL suites edited by S11-3d). Run `lanes/refresh-receipts.sh` (S09 + S10).
6. Slice 11 evidence ledger (122 criteria, same structure as `tests/contracts/phase-02-slice-10-evidence-ledger*.ts`), `node scripts/evidence/run-slice-evidence.mjs --slice 11`, guard green; Codex refutation rounds until only honest partials remain.
7. `pnpm db:verify` and `pnpm validate` on the final tree; Codex adversarial review of the final diff (scoped `task`, read-only, forbid executing anything; `--scope working-tree` fails above 1 MiB).
8. Tracking: tick verified criteria in `.memory/pipeline/progress/slices/phase-02-slice-11.md`, phase/index fractions, depth ratio, Completion Signature, `pnpm progress:check`; session log; memory flush/compile.
9. Logical commits, push, PR, CI (self-hosted runners share the DB), merge per process, cleanup (backup refs, the second DB stack, worktree after merge).

## Then

Slices 12–17 in plan order (`.memory/wiki/specs/phases/phase-2.md`); each starts with the DEC-148 depth-floor cascade (Slice 12 also carries DEC-141, DEC-135/137/138 and the DEC-147 receiving criteria if the owner picks A). Then `/validate-phase`.

## First actions for the next agent (before the integration steps)

1. Fix the e2 seed fixture (`supabase/tests/phase_02_slice_11_e2/000-derived-evidence.sqlinc`, `pg_temp.e2_review`): seed real `cms_editorial_decisions` rows before advancing a review, never disable the guard unless real rows are impossible; rerun the 7 aborting files.
2. Fix DEFECT 2 (`cms_submit_review` idempotency hash includes server evidence) debug-by-test: the S11-4R apispec is the RED; check `cms_schedule_publication`/`cms_publish_revision` for the same pattern.
3. Remove the `S11_DIAG_OVERLAY` mechanism from the S11-4R support modules; run the four real-composition apispecs (`lanes/lane-api.sh <worktree> tests/postgrest/phase-02-slice-11-*.apispec.ts`) on the repo migrations; finish 06/07/08/09/15/16/17/18/19/20 coverage per `s11/lane-s11-4r-brief.md`.
4. S11-5 real-route: rerun 05/06/18 on the repo migrations, make 07/09 green, add 08/16/17, run `pnpm build && pnpm bundle:check` (lazy time-authority chunk ≤ 80 KB gz budget).
5. Re-point the Slice 10 evidence-ledger citations whose test titles S11-G changed (list in `s11/lane-s11-g-report.md` CP3/CP4) and `packages/contracts/src/cms-editorial/routes.test.ts` ('registers exactly the nine locked operations…', cascaded by S11-1), then refresh S09/S10 receipts.
6. Re-run bench128 on a quiet host (p95 383 ms vs 300 ms budget measured at load 5–7); report both numbers honestly.
7. Codex review of the RPC migrations was running at the refresh (`codex/s11-review-sql2.md`); verify and fix its findings.

## Commit state

All Slice 11 work above is committed on `claude/phase2-slice11` as one WIP checkpoint commit on top of `fe2eb57f` and pushed to `origin/claude/phase2-slice11` (no PR yet). It is a checkpoint, not a reviewed change: several suites are red as listed. Squash or split into logical commits before opening the PR.
