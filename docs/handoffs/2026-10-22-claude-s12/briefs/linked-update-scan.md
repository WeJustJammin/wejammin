# Lane `claude_s12_linked_scan` — `cms.pattern.linked_update_scan` (P2-S12-AC-212, AC-213)

Read `docs/handoffs/2026-10-14-claude-s12/lane-rules.md` fully first; it binds you (note the rule: tar-backup any untracked
file before editing it in place). Start EVERY shell command with `cd /home/rob/.codex/worktrees/phase2-slice12/WeJammin &&`.
Toolchain `PATH=/home/rob/.local/share/wejammin-toolchain/bin:$PATH`. Report:
`docs/handoffs/2026-10-22-claude-s12/lane-linked-scan-report.md` (checkpoint early; keep `## Status` current).

## Spec (the contract — cite lines; never edit specs)

BE03c (`.memory/wiki/specs/be/03c-composition-taxonomy-localization.md`): "Pattern versions and linked updates" — the
**Linked update** paragraph (consumer job `cms.pattern.linked_update_scan`, payload `{ patternId, patternVersionId }`, 500
instances per run with a continuation cursor, idempotent, appends a new `pending_diff` row pinned to the unchanged version
carrying `pending_pattern_version` and the unchanged `position` (DEC-185) for each `linked` instance on a *draft* revision whose
pinned version is older and whose entry type is compatible with the new version; reviewed/published revisions keep their pin);
"Job transport (DEC-166, DEC-180 G9)" (typed platform-queue message, identifiers only, idempotent on re-delivery);
"Slice 12 lock order" (the scan's row); "Event schemas" (`cms.pattern.activated.v1` as the trigger); Observability
(`cms_pattern_linked_update_pending_total` is incremented where the consumer lands); the governed-review invalidation rules
for a composition write (a composition write invalidates the revision's live review — check whether an appended
`pending_diff` row is such a write and cite the line either way). Criteria P2-S12-AC-212 and AC-213 in
`.memory/wiki/specs/phases/phase-2.md`. If the spec is silent on something you need (e.g. what happens when the instance's
row is already `pending_diff` for an older pending version), record a BOUNDARY with the lines; do not invent.

## Precedent (follow layer by layer)

The governed-recheck lane: `supabase/migrations-wip/governed-recheck/` (job RPC with continuation cursor, `platform_api`
wrapper, `app.cms_rpc` set/restore), `apps/worker/src/cms-composition/governed-recheck/` (typed message contract, message
classifier, consumer of activation events, production wiring) and its tests; the dec193 append helpers that write
`pending_diff` rows (`supabase/migrations-wip/pattern-updates/`, `dec193/` — find the row-append helper and REUSE it; do not
re-implement row append).

## Layers (RED first at each)

1. **SQL**, NEW WIP `supabase/migrations-wip/linked-scan/`, timestamps `20261022110000`–`20261022119999` only: private scan
   function + `platform_api` wrapper (service_role only; sets and restores `app.cms_rpc`); batch ≤500 with an opaque
   continuation cursor in the job result; idempotent (a re-delivery appends nothing twice — key the idempotency on the
   instance path and target version); takes locks in the Slice 12 lock order; draft-only; compatibility by entry type.
   pgTAP `supabase/tests/phase_02_slice_12_linked_scan.sql` (+ dir): every predicate both ways (linked vs detached/standalone,
   draft vs reviewed/published, older vs same/newer pin, compatible vs incompatible type), 501+ instances → two runs via the
   cursor, re-delivery idempotency, position unchanged, row shape (pinned version unchanged, `pending_pattern_version` set),
   grants/definer posture, AND a context-cleared `service_role` call that proves the wrapper works without a pre-set
   `app.cms_rpc` (PAT-031 — fixtures that hold the flag hide a broken entry point).
2. **Worker**: typed queue message + classifier + consumer: `cms.pattern.activated.v1` enqueues the scan; the job handler
   calls the RPC, re-enqueues with the cursor until done, increments `cms_pattern_linked_update_pending_total` by the rows
   appended, retries/backs off per BE00 for server/queue callers (DEC-211: 3× at 15/60/300 s with jitter). Vitest for each.
   Shared entrypoint wiring: check `git diff` on `apps/worker/src/async-entrypoint.ts`, `production-async-entrypoint.ts`,
   `event-consumers/production.ts`, `event-consumers/rpc-names.ts` first; add lines only; name them in the report before editing.
3. Remove `cms_pattern_linked_update_pending_total` from the observability registry's "unemitted" list once emitted.

Staged stack (exact): `pattern-updates,dec193,dec194,dec195,locale-gate,dec197,dec202,dec205,dec206,governed-recheck,block-rules,
fix-dec193,dec208,linked-scan`; test files as SEPARATE runner arguments. Final run: your suite + every
`phase_02_slice_12_pattern*.sql`, `dec193*`, `composition*` file; focused Worker Vitest; tsc/eslint/prettier on touched files.

## Claim

NEW `supabase/migrations-wip/linked-scan/`, NEW `supabase/tests/phase_02_slice_12_linked_scan*`, NEW
`apps/worker/src/cms-composition/linked-scan/` (+ tests), the shared wiring lines named in the report, the observability
registry line. Never edit dec193/pattern-updates/block-rules SQL (under review V2) — if you need a change there, put it under
Requests to root. Live lanes: `claude_s12_dec208_obs` (dec208 SQL/tests, locale-observability Worker files), reviewers V2/V4
(read-only).

Final message to root: GREEN / PARTIAL / BLOCKED, report path + SHA-256, pgTAP/Vitest counts, files with SHA-256,
BOUNDARY items, requests to root.
