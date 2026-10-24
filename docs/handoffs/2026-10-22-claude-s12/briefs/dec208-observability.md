# Lane `claude_s12_dec208_obs` — database-side locale observability (DEC-208, DEC-213)

Read `docs/handoffs/2026-10-14-claude-s12/lane-rules.md` fully first; it binds you. Worktree
`/home/rob/.codex/worktrees/phase2-slice12/WeJammin`. Start every shell command with
`cd /home/rob/.codex/worktrees/phase2-slice12/WeJammin &&`. Report:
`docs/handoffs/2026-10-22-claude-s12/lane-dec208-obs-report.md` (checkpoint early, after every run).

## Decision and spec (root already wrote BE03c)

Owner decision DEC-208 and root mechanism DEC-213 (raw records in `.memory/raw/events/2026-10-22.jsonl`).
The contract is the BE03c paragraph **"Database-side locale observability (DEC-208)"** in `## Observability`
of `.memory/wiki/specs/be/03c-composition-taxonomy-localization.md`, plus the Metrics paragraph above it
(`cms_locale_stale_total` has no `locale` label) and the "Fan-out bound and event key (D12)" paragraph. If you
find the paragraph internally inconsistent or contradicting another BE03c/BE00 rule, STOP that part and report
it; never edit BE03c yourself.

Predecessor context: `lane-observability-report.md` (BOUNDARY items 1, 2, 6 are what this closes) and the
existing gauge precedent `apps/worker/src/event-consumers/reconciling-age.ts` (scheduled-tick RPC sample,
failure reported and swallowed). Alert input already exists: `staleLocaleLegalFieldCount` in
`packages/observability/src/cms-composition-alert-{types,thresholds,evaluator}.ts`.

## Layers (RED first at each)

1. **SQL** WIP `supabase/migrations-wip/dec208/`, timestamps `20261022100000`–`20261022109999` only: the two
   `cms_locale_variants` indexes; a private SECURITY DEFINER reader (owner and `search_path` per the existing
   locale functions) and the `platform_api.cms_locale_observability_read(p_window_start timestamptz,
   p_window_end timestamptz)` wrapper, execute to `service_role` only (`revoke all … from public, anon,
   authenticated`); `VALIDATION_FAILED` (P0001 + DETAIL json per existing convention) unless both bounds are
   whole minutes and the span is exactly 60 s; `statement_timeout` 5 s; no lock, no write; answer exactly
   `{fanoutRows, staleFieldsAppended, staleLegalFields}`. `staleLegalFields` must use the same `no_fallback`
   predicate as `platform_private.cms_resolve_locale_field` (find and reuse it; do not re-derive policy) and
   the current-row rule of `supabase/migrations-wip/dec205/20261022020000_cms_get_locale_variant.sql`.
   New pgTAP `supabase/tests/phase_02_slice_12_locale_observability.sql` (+ dir): window inclusion at both
   bounds (closed start, open end); author `draft` rows not counted; fan-out rows and their stale field sums
   counted; a legacy stale row with `stale_field_ids = '[]'` counts 1 row / 0 fields; gauge counts only
   `no_fallback` stale fields on the CURRENT row (an older stale row superseded by a newer draft row is not
   counted); malformed windows refused; grants and SECURITY DEFINER attributes; the index definitions; the
   answer has exactly three keys. Staged lane list (exact): `pattern-updates,dec193,dec194,dec195,locale-gate,
   dec197,dec202,dec205,dec206,governed-recheck,dec208` (add a fix-lane dir only if your function depends on it).
2. **Contracts / observability package**: register the gauge name `cms_locale_stale_legal_fields` and the read's
   response parser beside the existing Slice 12 metric registry (name each shared file in your report before
   editing). No browser operation id: this RPC is internal.
3. **Worker**: a scheduled-tick probe wired into the existing `scheduled` entrypoint exactly like the reconciling-age
   probe: window from `controller.scheduledTime` floored to the minute (T−3 min, T−2 min); strict response parse;
   counter increments `cms_locale_fanout_total` += fanoutRows, `cms_locale_stale_total` += staleFieldsAppended;
   gauge; pass the gauge value to the composition alert evaluator snapshot as `staleLocaleLegalFieldCount`;
   failed/timed-out/malformed read logged with allowlisted fields and swallowed (the sweep still succeeds).
   Vitest: window math at minute boundaries, zero counts emit nothing harmful, malformed responses (extra key,
   negative, non-integer) rejected, failure swallowed, alert fires at 1 not at 0.
4. **Docs**: README lines in each touched directory per `extensibility.md`.

## Claim

- NEW `supabase/migrations-wip/dec208/`; NEW `supabase/tests/phase_02_slice_12_locale_observability*`.
- NEW Worker probe file(s) under `apps/worker/src/` + the minimal wiring lines in the scheduled entrypoint
  (name the file and lines in your report before editing; another lane may hold `production-async-entrypoint*`
  — if `git status` shows it modified by someone else since HEAD, STOP and ask root).
- `packages/observability/src/cms-composition-*` (gauge registration, snapshot input) and, if the metric registry
  lives in contracts, the one registry file you name.
Never touch `supabase/migrations-wip/{dec193,pattern-updates,block-rules,fix-dec193,dec206,fix-dec206,
governed-recheck,dec194}/` or any file another live lane claims in `LANES.md`.

## Done

Final run: the new suite plus every `phase_02_slice_12_locale*.sql` on the staged stack; Vitest for touched
packages. Final message: GREEN / PARTIAL / BLOCKED, report path + SHA-256, pgTAP/Vitest counts, files with
SHA-256, BOUNDARY items, Requests to root (AC-052/263/264 evidence rows are root's — do not edit ledgers).
