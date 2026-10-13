# Slice 10 integration TODO (orchestrator) — restated 2026-10-07 after reboot
Done before reboot: lanes A–G merged (SQL encodings, draft detail, cursors/compare, restore, presence, follow-ups, write-path items 1–8);
lanes G2 (contracts/spec/openapi), I (Worker/proxies/metrics/real-stack composition suite), J (CMS-05/06/07/list UI), K (evidence infra),
L (S11/S12 spec cascade), M (runbook/ARCHITECTURE/migrations README) finished. Codex review pass 1 (SQL: H1–H4, M1–M2) → lanes H/I; pass 2 (TS) → lane N.
Open:
- [ ] Lane H finish → regenerate DB types (flock … pnpm db:reset && pnpm db:types) → db:types:check.
- [ ] Rerun real-stack composition suite: ORCH/bin/lane-api.sh LANE tests/postgrest/cms-editorial-composition*.apispec.ts (needs H item 9).
- [ ] Lane N finish; Lane P finish (real-route E2E).
- [ ] S09 guards: stale S09 receipts (refresh with evidence:collect after final tests); phase_02_slice_10_field_kind_default.sql carries
      uncited [P2-S09-...] markers (retag or cite); AC-1149/AC-1144 guard failures.
- [ ] Mis-tagged [P2-S10-AC-080] markers (lane G note) — fix during evidence fill.
- [ ] Criterion wording conflicts → DEC records (no silent rewording): S10 AC047 audience 1–64 vs ^[a-z0-9_-]{1,48}$ (DEC-145);
      S11 AC038/AC048 "where required" vs unconditional step-up (E6); S12 AC025 audience; S10 AC040/AC042 contract-only status for the ledger.
- [x] E11 author ≠ publisher: already locked BE03b text + DEC-109/110 distinct reviewer; FYI only (solo-human org needs a second human to publish).
- [ ] "No route cancels a schedule" (S11 spec gap from lane L).
- [ ] Full `pnpm validate` + db:verify chain; bundle budget with new CSS/islands; visual pass 320/768/1025.
- [ ] Evidence wave: fill S10 ledger (105) with exact test citations → run-slice-evidence --slice 10 → Codex refutation audit → fix → mark.
- [ ] Tracking: slice/phase/index files, depth ratio, completion signature, progress:check; feature ledger; session log; memory compile.
- [ ] Commit (logical commits), push, PR, CI (self-hosted runners share DB — no local DB work during CI DB job), merge when green.
- [ ] Cleanup: archived lane worktrees (done), refs/backup/* after merge, orchestration dir → docs/handoffs summary.
- AC060 (S10): 'in the same change' proven by squash 3640b506 (PR #126: tracker+runbook+ARCHITECTURE+code in one commit). CI checkout depth 1 => no git-history test possible; record in S10 tracker/ledger limitation at S11 closeout.
- S10 scope pgTAP supabase/tests/phase_02_slice_10_ev_eb_publication_scope.sql pins "no review/decision/schedule/preview/publication RPC exists" and says it flips when such an RPC lands "without the contract and runtime evidence". Lane S11-3 must cascade it to an explicit allow-list of the named S11 functions (keep it failing for any unnamed function), cite DEC-149/BE03b; then regenerate S10 receipts (titles change) and re-point S10 ledger AC038..048 citations.
- S10/S09 receipts go stale from S11-1 cascades (routes.test.ts, supplemental-routes.test.ts, core-contracts.test.ts, registries.test.ts): run ORCH/bin/refresh-receipts.sh at S11 integration; the S10 evidence guard is RED until then.
- S11-3b open item: localDateTime/resolvedUtc admit 9 fractional digits in the contract (BE03b) but PostgreSQL timestamptz keeps microseconds; decide (spec reconciliation) whether the contract narrows to 6 digits or the schedule row stores the exact text — verify resolved_utc_mismatch behaviour with a 7-9 digit input end-to-end.
- S11-3b: accessibility recorder event_id NOT NULL — commands without an outbox event pass a fresh effect id; confirm the side-table key semantics (DEC-159(5)) in review.
- S11-5: type-check error in apps/web/src/components/cms-editorial-workflow/cms-workflow-axe.test.tsx (cannot find module node:module).
- S10 integration test tests/integration/phase-02-slice-10-ev-eb-publication-boundary-schedule.test.ts (7 failures) pins 'the nine Slice 10 operations' — cascade with the guard files (allow-list the named Slice 11 operations; keep it failing for unnamed ones); S10 receipts then refresh. S11-1R to-ratify: Retry-After on 503 added only for Slice 11 ops (03A + S10 03B still 429-only) — check BE00/BE03a whether 503 Retry-After applies there too (separate follow-up if so).
- REAL-STACK DEFECT 2 (S11-4R, RED by apispec): cms_submit_review (20261005017640:158) includes the Worker-built accessibility evidence (fresh evaluatedAt/bindingHash) in the idempotency request hash, so a same-key retry answers 409 IDEMPOTENCY_MISMATCH instead of replaying. Fix: hash only the browser request members (path + body + If-Match operand + acting party), exactly like the Slice 10 commands; check 3b's schedule/publish (07/09) for the same pattern. Debug-by-test: the S11-4R apispec is the RED.
- REAL-STACK DEFECT 1 fixed by orchestrator (pg-safeupdate unguarded DELETE in 017560); S11-4R/S11-5 must re-run against the repo migration (their run 3 used a diagnostic overlay — never evidence).
