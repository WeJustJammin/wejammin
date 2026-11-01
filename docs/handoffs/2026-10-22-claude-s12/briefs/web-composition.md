# Lane `claude_s12_web_composition` — composition page + instance list, selector, update diff (CMS-12)

Read `docs/handoffs/2026-10-14-claude-s12/lane-rules.md` fully first; it binds you (no DB runs needed in
this lane; Vitest only). Worktree `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`. Report:
`docs/handoffs/2026-10-22-claude-s12/lane-web-composition-report.md` (checkpoint early, after every run).

## Goal

Build the protected server-first page `/app/cms-content-modeling/entries/:entryId/composition` with
`CmsCompositionInstanceList`, `CmsPatternSelector` (the real one; the pattern designer may currently use a
stand-in — check) and `CmsPatternUpdateDiff`, wired through first-party Astro proxies to the existing
Worker routes for CMS-03C-02 (place), CMS-03C-13 (selector), CMS-03C-14 (update diff GET) and CMS-03C-15
(accept/detach), so the CMS-12 criteria (notably P2-S12-AC-045, AC-111, AC-117, AC-123, AC-269 and every
other Slice 12 criterion naming these components or the composition page) are implemented and tested.

## Sources (read the actual text, cite lines)

- FE03 `.memory/wiki/specs/fe/03-cms-content-modeling.md`: component rows ~886–887 (selector; instance
  list + diff incl. DEC-175/181/185/193 behaviour, never-preselected per-collision radios, `newRoots`
  _Place_ command, bulk accept ≤32 per request with version refetch, 422 `COMPOSITION_VALIDATION_FAILED`
  keeps choices), props rows ~1508–1509, page rows ~1072 and ~1640 (title `Composition | WeJammin`),
  route row ~1547, the `CompositionTaxonomyLocalizationWorkbench` section ~608 (bounded list,
  virtualization >100 rows, stable ids), changelog rows ~2892–2893 (DEC-193), and every Interaction /
  Concurrency / Degradation / Testing Obligations row naming these components (grep).
- BE03c `.memory/wiki/specs/be/03c-composition-taxonomy-localization.md`: route rows 161, 177–179;
  validation rows 377–381; §"Pattern versions and linked updates (D9, OD-2)" ~1477.
- Decisions DEC-175, DEC-181, DEC-185, DEC-193 in `.memory/wiki/decisions.md`.
- Criteria: grep the `- [ ] **P2-S12-AC-` lines of `.memory/pipeline/progress/slices/phase-02-slice-12.md`
  for these component names, `composition`, `CMS-03C-02/13/14/15`.
- Intake gap research: `.lane-logs/s12-claude-intake-20261022/classify-*.md`.
- Existing code to follow: `apps/web/src/pages/app/cms-content-modeling/entries/[entryId]/related-content.astro`
  (protected sibling page), `apps/web/src/components/cms-pattern-designer/` (tree/a11y/conflict patterns),
  proxies `apps/web/src/server/cms-composition-platform-*.ts`, contracts `packages/contracts/src/cms-composition/` (frozen).

## Important

The CMS-03C-14/15 SQL is still unpromoted WIP (`supabase/migrations-wip/dec193`, `pattern-updates`); the
Worker routes and contracts should already exist — verify. Your work is web-only and tested with mocked
proxies/fetch; it does not depend on SQL promotion. If a needed Worker route or contract is absent, record
a BOUNDARY naming it and the FE03 line; do not add Worker routes or contracts yourself.

## Claim (touch nothing else)

- NEW `apps/web/src/components/cms-composition-instances/` (components, hooks, tests, README.md).
- NEW `apps/web/src/pages/app/cms-content-modeling/entries/[entryId]/composition.astro` + route test.
- New proxy modules `apps/web/src/server/cms-composition-instances-*.ts` (+tests) if existing
  `cms-composition-platform-*.ts` proxies lack an operation; editing an existing proxy file → request to root.
- Shared files (entry page navigation, `entries/[entryId]/README.md`, any web route registry, existing
  `cms-composition-platform-*.ts`): do NOT edit — exact proposed diff under `## Requests to root`.
  The page must be reachable from the entry page (vertical-slice rule).

## Method

Contract-first (consume existing Zod contracts), RED Vitest first (component, interaction incl. keyboard,
accessibility with the existing axe pattern, route structure, 32-per-request bulk splitting, choice
retention on 409/422), GREEN, refactor. Components ≤200 lines (split the diff into sub-components).
Focused runs only with the pinned toolchain (`PATH=/home/rob/.local/share/wejammin-toolchain/bin:$PATH
pnpm exec vitest run <files>`), plus web type-check and eslint on your files at the end.

Final message: GREEN / PARTIAL / BLOCKED, report path + SHA-256, test counts, files, Requests to root.
