# Lane brief — `claude_s12_web_patterns` (Web surface, FE03 pattern designer)

Build, test-first, `/app/cms-content-modeling/patterns/new` and `/app/cms-content-modeling/patterns/[patternKey]`
(FE03 :1067) with `CmsPatternVersionDesigner` (FE03 :883) and the `CmsGovernedReviewPanel` submit action
(reuse `apps/web/src/components/cms-governed-review/` from the definition-reviews lane; extend its mount the
way `CmsGovernedTemplatePanel` mounts on the template page), over the existing Worker routes CMS-03C-12
(POST /api/v1/cms/patterns/versions) and `cmsPatternLatestRead` (GET /api/v1/cms/patterns/{patternKey}),
plus `cmsTemplateContextRead` for block and content-type selectors. Nested pattern nodes choose from
`CmsPatternSelector` (CMS-03C-13) — that route is NOT built yet: render the nested-pattern picker as a
disabled control with the FE03 empty/disabled-state copy and record a BOUNDARY (do not invent a route).
- FE03 :883 contract: ordered nested `<ol>` tree with level text; add/remove/move-up/move-down controls (no
  drag-only path); props ≤64 keys/depth 8; `compatibleTypeIds` from context selectors; server digest,
  `nodeCount`; cycle/depth/node-count refusals inline with the node path; successor sends the read version
  as `expectedVersion`; reserved keys `context|versions|selector|new` (FE03 :1067). States :1036–1050;
  network/retry :1171; form contract :1216; responsive :1380; a11y :1403 (44×44 px targets on mobile,
  error summary links to the node); perf :1736; security :1749; data ownership :1814–1916; testing :2668.
- Same-origin proxies under `apps/web/src/pages/api/v1/cms/patterns/**` following the existing proxy
  precedent (`apps/web/src/server/cms-composition-platform-*.ts`); strict admission, CSRF, no-store.
- Precedent: the template designer (`apps/web/src/pages/app/cms-content-modeling/templates/**`,
  `apps/web/src/components/cms-composition/CmsTemplate*.tsx`) and the definition-reviews lane's panel.
  Navigation entry from `/app/cms-content-modeling`.
Files: new `apps/web/src/pages/app/cms-content-modeling/patterns/**`, `apps/web/src/components/cms-pattern-designer/**`,
`apps/web/src/pages/api/v1/cms/patterns/**`, `apps/web/src/server/cms-pattern-*.ts` (+tests), minimal mount
edits in `apps/web/src/components/cms-governed-review/**` and the CMS nav. Do not touch
`apps/web/src/server/cms-composition-platform-*.ts` (hardening-2 owns them). Components ≤200 lines, README
per directory. Run focused, full web Vitest, astro check, eslint, prettier. Report
`docs/handoffs/2026-10-14-claude-s12/lane-web-patterns-report.md`.
