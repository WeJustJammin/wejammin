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
