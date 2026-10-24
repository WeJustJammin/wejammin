# Lane `claude_s12_web_locale` — locale variant page + `CmsLocaleVariantForm` (CMS-15 / CMS-03C-04)

Read `docs/handoffs/2026-10-14-claude-s12/lane-rules.md` fully first; it binds you (no DB runs needed in
this lane; Vitest only). Worktree `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`. Report:
`docs/handoffs/2026-10-22-claude-s12/lane-web-locale-report.md` (checkpoint early, after every run).

## Goal

Build the protected server-first page `/app/cms-content-modeling/entries/:entryId/locales/:locale` and
its bounded React island `CmsLocaleVariantForm`, wired to the existing CMS-03C-04 Worker route through
the first-party Astro proxy, so the CMS-15 criteria (notably P2-S12-AC-058, AC-270, AC-282 and every
other Slice 12 criterion naming `CmsLocaleVariantForm` or the locale page) are implemented and tested.

## Sources (read the actual text, cite lines)

- FE03 `.memory/wiki/specs/fe/03-cms-content-modeling.md`: component row ~891, props row ~1513, page
  rows ~1073 and ~1641 (title `Translate | WeJammin`, description text), route behaviour ~1549, locale
  configuration fields ~1268, endpoint row ~1885 (error codes), plus the Interaction/accessibility,
  Concurrency, Degradation, Testing Obligations sections wherever they name the locale form/page
  (grep `Locale`).
- BE03c `.memory/wiki/specs/be/03c-composition-taxonomy-localization.md`: CMS-03C-04 row 163, validation
  row 385, §"Locale field resolution (DEC-121, DEC-138) and fan-out (D12)" ~1524, CMS-03C-20 row 191.
- Criteria text: grep `.memory/pipeline/progress/slices/phase-02-slice-12.md` for `CmsLocaleVariantForm`,
  `locales/:locale`, `CMS-15`, `CMS-03C-04`, `CMS-03C-20` within the `- [ ] **P2-S12-AC-` lines.
- Intake gap research: `.lane-logs/s12-claude-intake-20261022/classify-*.md` (search "locale").
- Existing code to follow: `apps/web/src/pages/app/cms-content-modeling/entries/[entryId]/related-content.astro`
  (sibling protected page: session/expiry/acting-context, 303/400/404/403 handling) and its island;
  existing proxy `apps/web/src/server/cms-composition-platform-locale.ts`; contracts in
  `packages/contracts/src/cms-composition/` (frozen).

## Key open question you must settle from source, not invent

The form shows per-field resolution (own value / fallback source locale / `no_fallback` missing or stale)
"from the resolver projection" and the fallback order "from the protected version detail". Identify the
EXACT existing read(s) (Worker route + contract) that supply these. If no served read returns the
resolution projection or fallback chain, STOP that part, record a BOUNDARY naming the missing BE read and
the FE03 line that needs it, and finish everything else. Do not add a Worker route or contract yourself.

## Claim (touch nothing else)

- NEW `apps/web/src/components/cms-locale/` (component files, tests, README.md).
- NEW `apps/web/src/pages/app/cms-content-modeling/entries/[entryId]/locales/[locale].astro` + its route test.
- `apps/web/src/server/cms-composition-platform-locale.ts` and its test(s) if the proxy needs changes.
- Shared files (entry page navigation link in `entries/[entryId].astro` or its nav component, the
  `entries/[entryId]/README.md`, any web route registry): do NOT edit — put the exact proposed diff under
  `## Requests to root`. The page must become reachable from the entry page (vertical-slice rule).

## Method

Contract-first (consume existing Zod contracts), RED Vitest first (component, interaction, accessibility
with the existing axe pattern, route structure), then GREEN, then refactor. Components ≤200 lines. Run
only focused files with the pinned toolchain (`PATH=/home/rob/.local/share/wejammin-toolchain/bin:$PATH
pnpm exec vitest run <files>`), plus `pnpm exec tsc -p apps/web --noEmit` (or the repo's web type-check
script) and eslint on your files at the end.

Final message: GREEN / PARTIAL / BLOCKED, report path + SHA-256, test counts, files, Requests to root.
