# Lane brief — `claude_s12_web_related` (Web related-content page, FE03 CMS-16 / CMS-03C-05)

Build, test-first, the protected server-first page `/app/cms-content-modeling/entries/:entryId/related-content`
(FE03 `.memory/wiki/specs/fe/03-cms-content-modeling.md` :1072, :1601) with `CmsRelatedContentForm` (:890, props
:1473, interaction :1121, :1508, :1718 layout, :2678 tests): ordered pins (≤32, move controls, no drag-only path),
exclusions (≤64, "exclusions win" stated beside the lists), candidates only from entries the caller can read
(`CMS-03B-13` list), a derived rule from the registry (`shared-terms`, `same-type-recent`) with `maxCandidates`,
`eligibleCount` after save, `related_target_ineligible` as one fixed message at the offending row that never says
why; exact `If-Match` = entry `version`; idempotency key; focus stays until the named result heading; 303 sign-in,
400 malformed, disclosure-safe 404, 403 without capability; step-up gates commits only if the spec says so (check
BE03c 216 and the existing proxy).

The same-origin proxy already exists: `apps/web/src/pages/api/v1/cms/entries/[entryId]/related-content.ts` and
`apps/web/src/server/cms-composition-platform-related.ts` (403 via `cms-composition-platform-capability.ts`).
FIRST determine where the page gets the CURRENT rule (`rule` prop): BE03c CMS-03C-05 and its resources, the entry
reads, and `RelatedContentResource`. If no author-facing read of the current rule exists in BE03c/contracts, do NOT
invent an endpoint: record a BOUNDARY (missing spec named) in your report, and build the page so that it renders
"no saved rule" from what exists, with the boundary stated in the README and a sentinel test.

Precedents: the Web taxonomies lane (`lane-web-taxonomies-report.md`: server-first page + loader + island, zero zod in
browser with drift guards, nav, static-closure guard, step-up inventory classification) and the pattern designer.
Files: new `apps/web/src/pages/app/cms-content-modeling/entries/[entryId]/related-content.astro`,
`apps/web/src/components/cms-related-content/**` (+tests, README), minimal loader/read seam files, step-up inventory
entries for new 401 readers, entry-page link to the related-content page if an entry page exists. Not the proxy files
(report needed changes), not `components/cms-governed-review/**`, not `cms-taxonomy*`, no Worker/SQL/contracts.
Gates: focused + full `apps/web` Vitest, `astro check`, eslint `--max-warnings=0` + prettier; mutation battery on
scratch copies under `<scratchpad>/claude_s12_web_related/`; all under `flock -s /tmp/wejammin-quiet.lock`.
Components ≤200 lines, tests ≤400. Report `docs/handoffs/2026-10-14-claude-s12/lane-web-related-report.md`.
