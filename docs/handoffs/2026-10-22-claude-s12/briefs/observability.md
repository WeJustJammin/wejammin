# Lane `claude_s12_observability` — Slice 12 metrics, alerts, traces and log allowlist (AC-051/052/263/264)

Read `docs/handoffs/2026-10-14-claude-s12/lane-rules.md` fully first; it binds you. Worktree
`/home/rob/.codex/worktrees/phase2-slice12/WeJammin`. Report:
`docs/handoffs/2026-10-22-claude-s12/lane-observability-report.md` (checkpoint early, after every run).

## Goal

Implement and prove P2-S12-AC-263 (twelve named Slice 12 metrics emitted at the events they name, labels never
carrying an id, label text, locale text, hash or person), AC-264 (alerts: DLQ > 0, outbox age > 2 min, activation
blocked > 15 min, stale locale legal-field count > 0, target-filter anomaly; trace coverage; structured logs and
diagnostics with allowlisted fields only), and the counter halves of AC-051 (`cms_no_fallback_block_total`) and
AC-052 (`cms_locale_stale_total`). Criteria text: grep `P2-S12-AC-(051|052|263|264)` in
`.memory/pipeline/progress/slices/phase-02-slice-12.md`.

## Sources

- BE03c `.memory/wiki/specs/be/03c-composition-taxonomy-localization.md` §Observability, §"Security and abuse
  controls", §"Middleware & Policies"; BE00 `.memory/wiki/specs/be/00-infrastructure.md` observability/alerting
  sections (metric/alert/log conventions).
- PRECEDENT FIRST: find how Slices 09–11 implemented their metrics, alert definitions and log allowlists
  (grep the Worker for `_total` counters, a metrics module, alert config under `infra/`/`observability/`, and the
  tests that assert label allowlists — e.g. Slice 11 metric tests). Mirror the existing mechanism exactly; do not
  invent a new telemetry stack.
- Intake research: `.lane-logs/s12-claude-intake-20261022/classify-*.md` (AC-263: only
  `cms_governed_activation_total` and `cms_governed_schedule_blocked_total` are emitted today).

## Claim

- Worker emission points inside existing Slice 12 route/job modules under `apps/worker/src/cms-composition/`
  (name every existing file in your report BEFORE editing; keep edits additive), plus new metric/alert/log
  modules and tests. Alert definitions in the existing alert config location.
- NOT: `apps/worker/src/async-entrypoint.ts`, `async-runtime-rpc-types.ts`, `production-async-entrypoint*.ts`
  (lane `claude_s12_integ_web_worker` is fixing a regression there — if you need an emission point inside them,
  request root with an exact diff), apps/web, contracts, SQL/WIP, pgTAP.
- If a metric's "event" happens only inside SQL (e.g. a preflight block counted in the database), read how the
  precedent counts SQL-side outcomes (outbox/audit-derived?) and follow it; if no precedent and the spec is
  silent on the mechanism, record a BOUNDARY with the exact missing spec line rather than inventing one.

## Method

RED Vitest first (each metric at its event with exact labels; label-allowlist negative tests; alert rule tests;
log/diagnostic allowlist tests), then GREEN, then refactor. Pinned toolchain, focused runs
(`PATH=/home/rob/.local/share/wejammin-toolchain/bin:$PATH pnpm exec vitest run <files>`); final full
`apps/worker` project + worker `tsc --noEmit` clean.

Final message: GREEN / PARTIAL / BLOCKED, report path + SHA-256, counts, files, Requests to root.
