# Lane `claude_s12_pw9` — the AC-273 journeys still undriven

Read `docs/handoffs/2026-10-14-claude-s12/lane-rules.md` fully first; it binds you. Start EVERY shell command with
`cd /home/rob/.codex/worktrees/phase2-slice12/WeJammin &&`. Toolchain `PATH=/home/rob/.local/share/wejammin-toolchain/bin:$PATH`.
zsh does not word-split; `/bin/ls`, never bare `ls`. Run every command in the FOREGROUND (no `run_in_background`, no monitors).
**Never run Playwright** (root runs every spec in the canonical browser gate), never db/supabase/docker/races; eslint and an ad hoc
`tsc --noEmit -p` over your specs are allowed (`tests/e2e/**` is in no tsc project: type errors there are otherwise invisible —
PAT-036). **Do not spawn sub-agents.** Report `docs/handoffs/2026-10-22-claude-s12/lane-pw9-report.md` (checkpoint early, keep
`## Status` current); proposals `docs/handoffs/2026-10-22-claude-s12/recite9/pw9-proposals.json` (the `recite2/*-proposals.json`
schema). New files under `tests/e2e/` only (specs and support); register nothing in the Playwright configs — list every spec,
title and project for root.

Criterion P2-S12-AC-273 (`.memory/pipeline/progress/slices/phase-02-slice-12.md`, FE03 §Testing Obligations). Already written and
passing: J1/J2 (`phase-02-slice-12-definition-journeys-real-route.spec.ts`), J3 (`…template-journey…`), J4/J5
(`…locale-related-journeys…`), J6 (`…term-merge-journey…`), T2/T3/T6 (`…governed-review-real-route…`). Follow those files and
`tests/e2e/support/README.md` (the real-route harness composes production boundaries; `s12-real-governed.ts`,
`s12-real-template-locale.ts`). Read `lane-gaps-pw7-report.md` "Open items" and "first-run risk": your specs run blind too, so take
every label and sentence from the component sources and state each assumption.

Write, as real-route journeys with two or more people where the operation needs them:
1. **A dependency invalidation returning a subject to draft**: a pending governed subject whose dependency changes (BE03c names
   which — find the dependency-invalidation rule and its producer) is returned to draft, and the page shows it.
2. **A linked pattern update accepted and detached**: a pattern placed linked in an entry, a successor version activated, the
   update diff reviewed and accepted from the composition page, and (another instance) detached (DEC-193 author decides).
3. **The protected decision inside a journey**: a subject of a protected disclosure class (DEC-110) decided by its specialist
   reviewer in the browser, end to end with the submit and assignment.
4. **A pattern created and assigned in the browser** (not seeded), then **scheduled** (CMS-03C-07/-08 schedule from its page).
5. **The identifier scan**, extended: no diff value, canonical id or person id in URLs, storage, console, AND in the server logs
   and telemetry the harness captures — find where the Worker/web log lines and any telemetry events go in the real-route harness;
   if they go nowhere capturable, add a capture in a NEW support file (no product change) or record BOUNDARY with lines.
6. Keyboard-only at a 640x400 viewport (200% zoom) for at least the template and pattern journeys (J1 already covers a vocabulary).

A journey the platform cannot drive (no browser surface for an operation BE03c names) → BOUNDARY with spec and source lines; never
seed around a missing browser path silently. Final message to root: GREEN / PARTIAL / BLOCKED, report path + SHA-256, every spec
+ title + project, the support files, assumptions per spec, BOUNDARY items with lines.
