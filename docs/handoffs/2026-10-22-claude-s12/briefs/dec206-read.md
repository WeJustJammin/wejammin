# Lane `claude_s12_dec206_read` — protected composition-instance list read, full stack (DEC-206)

Read `docs/handoffs/2026-10-14-claude-s12/lane-rules.md` fully first; it binds you. Worktree
`/home/rob/.codex/worktrees/phase2-slice12/WeJammin`. Report:
`docs/handoffs/2026-10-22-claude-s12/lane-dec206-read-report.md` (checkpoint early, after every run).

## Decision and spec (root already wrote BE03c)

Owner decision DEC-206 (2026-10-22; raw record in `.memory/raw/events/2026-10-22.jsonl`). Root wrote the
BE03c rows — search `cmsCompositionInstancesRead` in
`.memory/wiki/specs/be/03c-composition-taxonomy-localization.md` (epic index, interaction map, route registry,
validation, `CompositionInstancesQuery`/`CompositionInstancePage` schemas after `PatternSelectorPage`, error
kinds, error matrix composition row, authority, changelog). Items reuse `CompositionInstanceResource`.
Those rows are the contract; if inconsistent with another BE03c/BE03b rule, STOP that part and report.

Precedents: the DEC-195 related-content read (`docs/handoffs/2026-10-14-claude-s12/briefs/dec195-read.md`,
`lane-dec195-read-report.md`), the CMS-03C-13 selector (cursor paging, `PatternSelectorPage`), and the
render plan `platform_private.cms_revision_render_plan` (ordering, newest-per-path, DEC-185) — reuse its
ordering logic, do not re-derive it.

## Layers (RED first at each)

1. **Contracts** (`packages/contracts/src/cms-composition/`): `CompositionInstancesQuerySchema`,
   `CompositionInstancePageSchema`; operation id `cmsCompositionInstancesRead` in the platform registries
   (300/600 per minute, 8,000 ms, no-store, Tier 1), refusal list, OpenAPI path; `pnpm contracts:generate`
   then `node infra/generate-openapi.mjs --check` (record diff). Another lane (`claude_s12_dec205_read`) is
   editing contract registries concurrently: make additive, minimal, line-local edits to shared registry
   files, name each in your report BEFORE editing, and re-read the file immediately before each edit.
2. **SQL** WIP `supabase/migrations-wip/dec206/`, timestamps `20261022050000`–`20261022059999`: private
   SECURITY DEFINER read + `platform_api` wrapper reusing the CMS-03C-02 authority helper exactly (403 for a
   visible entry without edit, 404 hidden/absent), opaque cursor bound to entry + draft revision, ≤100 per
   page. `pending_diff`/`pending_pattern_version` live in unpromoted WIP: stage
   `pattern-updates,dec193,dec206` (comma list) for every run. New pgTAP
   `supabase/tests/phase_02_slice_12_composition_instances_read.sql` (+ dir): order (two placements in one
   slot stay grouped; position before path), newest-per-path, superseded/retired excluded, pending_diff
   included, detached row included, paging + cursor rejection for another entry/revision, empty page without
   a draft, 403/404/400, grants.
3. **Worker**: GET route + production adapter + strict parsing (precedent: DEC-195 read, CMS-03C-13 route).
4. **Web**: the composition lane is finished (report `docs/handoffs/2026-10-22-claude-s12/lane-web-composition-report.md`,
   BOUNDARY "no instance-list read", typed port + sentinel test). Add a same-origin proxy GET, load all pages
   server-side in the composition page loader (FE03: one in-page collection, virtualized above 100 rows),
   replace the session-only port and its sentinel with behavioural tests; the page-level 403 comes from this read.
5. **FE03 cascade** (owner-approved by DEC-206): FE03 `.memory/wiki/specs/fe/03-cms-content-modeling.md`
   `CmsCompositionInstanceList` rows (~887, ~1509), composition page rows (~1072, ~1640), route row (~1547),
   endpoint tables (~1599/1615 area and ~1728/1744 area: add the read row) and changelog name the read.
   Do NOT change acceptance-criteria text; list affected criteria for root.

## Claim

- NEW `supabase/migrations-wip/dec206/`; NEW `supabase/tests/phase_02_slice_12_composition_instances_read*`.
- Contracts: new read files + named additive registry edits.
- Worker: new route/adapter files + named wiring line.
- Web: `apps/web/src/components/cms-composition-instances/`, `entries/[entryId]/composition.astro` (+ test),
  `apps/web/src/server/cms-composition-instances-*.ts`, and the three `pages/api/` endpoint files the
  composition lane created (listed in its report) — you own these now.
- FE03 composition rows listed above (not BE03c).
Never touch `cms-locale/`, `entries/[entryId]/locales/`, `cms-composition-platform-locale*`,
`supabase/migrations-wip/dec205/` or other lanes' files (`docs/handoffs/2026-10-22-claude-s12/LANES.md`).

Final message: GREEN / PARTIAL / BLOCKED, report path + SHA-256, pgTAP/Vitest counts, files, Requests to root.
