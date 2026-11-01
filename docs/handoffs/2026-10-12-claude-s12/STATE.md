# Slice 12 Claude orchestration — live state (started 2026-10-13 ~04:00Z)

Resume here if the session is cut off. Owner instructions: `docs/handoffs/2026-10-10-phase2-claude-prompt.md`.
Slice 11 closure state: `docs/handoffs/2026-10-10-claude-s11/STATE.md` (PR #129, draft, `claude/phase2-slice11`).

## Branch and worktree

- Worktree `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`, branch `claude/phase2-slice12`, stacked on
  `claude/phase2-slice11` (merged in at `1eb492eb`; merge again after every S11 push).
- The alt pgTAP stack (`/home/rob/.codex/worktrees/phase2-slice10/orchestration/altdb`) is relinked to THIS worktree
  (2026-10-13). Locks as in the S11 state file.

## Decisions recorded on this branch

DEC-178 (cascade, floor 53 -> 285), DEC-179 (R1-R4), DEC-180 (G2-G4, G6, G8, G9, G11, R5), DEC-181 (owner: nested
top-level pattern references expand), DEC-182 (owner: wording batch incl. G5), DEC-183 (owner: dry-run Job map, sealed
failing scan = failed MIGRATION_BLOCKED), DEC-184 (owner: 4-delivery budget, fail late, measure then cap), DEC-185
(owner: composition `position` column), DEC-186 (orchestrator: placement paths, digest 409 token, E14, AC-225, AC-265,
DEPENDENCY_UNAVAILABLE mapping).

## Evidence baseline

First ledger classification (source reading, no receipts): 9 verified, 66 partial, 210 unverified of 285
(`tests/contracts/phase-02-slice-12-evidence-ledger-*.ts`, gap reports `ledger-gap-*.md`).

## Lanes (wave 1, running)

| Lane | Brief | Owns |
| --- | --- | --- |
| L0 contracts | `impl-lane-brief.md` | `packages/contracts/src/cms-composition/`, registry rows, OpenAPI |
| FIX shipped drift | same | CMS-03C-01/-04 + template reads/pages; migrations 20261013100000-109999 |
| B128 boundary | same + `b08-production-trigger-design.md` | dispatcher/entrypoint/claimed preparation; BE03a; runbook; migrations 20261013200000-209999 |
| spec completion | inline | BE03c/BE05c/FE03 text for DEC-185/186 and DEC-181 consequences |

## Next waves (plan)

- Wave 2: L1 governed review SQL (6 tables, CMS-03C-06..11, -19, activation events, E13/E14 version keys and lineage),
  L2 composition/pattern/taxonomy/locale/related SQL (CMS-03C-02/03/05/12..18/20/21, `position`, render plan, relay
  prefixes), each with its own migration range; then L3 Worker routes/adapters for CMS-03C-06..21, L4 web pages and
  islands, L5 relay/jobs/providers (DEC-166, G9), L6 e2e/races/perf; Slice 10 AC-080 pgTAP cases; ledger refresh;
  independent review; gates; receipts; tracking.

## Update 2026-10-13 ~05:30Z — wave 1 integrated

- Committed: L0 contracts/registry/OpenAPI (c1cca047); spec completion DEC-185/186/187 (b87044d7); boundary #128
  production trigger (bfb1c8ab: DEC-183/184, real-stack apispecs, S11 closeout guard now tracks only #127); FIX
  (32faf5fd: E13/E14/E4 template keys per owner, live template reads, DEPENDENCY_UNAVAILABLE 502/503/504, 400 pages).
- Running (wave 2): L1 governed review BE (migrations 202610133xxxxx), L2a patterns/composition BE (4xxxxx), L2b
  taxonomy/related/locale BE (5xxxxx).
- Known red until lanes land: 9 CMS-03C-02 worker/web tests (PatternPlacementResource; L2a fixes worker, web lane later);
  `pnpm db:types` must be regenerated after the SQL lanes (new template_id column etc.).
- Open follow-ups: a `verifying` plan whose 30 s plan lease lapsed cannot be rolled back by the DEC-184 exhaustion path
  (SQL refuses the lease), leaving the plan blocking new dry runs with 409 — needs a SQL fix lane; DEC-184 CPU
  measurement of one 128-row batch; issue #128 can be closed once merged to main; S11/S09 receipts on this branch go
  stale as S11 test files change and are regenerated at the Slice 12 close; Slice 10 AC-080 pgTAP cases.
