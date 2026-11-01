# Lane brief — `claude_s12_web_definition_reviews` (Web surface, FE03)

Build, test-first, the protected definition-review pages and components over the existing Worker routes
CMS-03C-06/07/08/10/11 (activation form CMS-03C-09 and Retire are OUT of scope: Worker transport for 09 is
not built and retire policy awaits the owner):
- Routes `/app/cms-content-modeling/definition-reviews` (queue) and `/app/cms-content-modeling/definition-reviews/[reviewId]`
  (detail) — FE03 :1069; components `CmsGovernedReviewQueue`, `CmsGovernedReviewDetail`, `CmsGovernedDecisionForm`,
  owner `CmsGovernedAssignmentForm` — FE03 :877–882; the Submit-for-review action of `CmsGovernedReviewPanel`
  (CMS-03C-06) on the template designer page `/app/cms-content-modeling/templates/[templateKey]` — FE03 :877, :1066.
- States FE03 :1036–1050; network/retry :1171; step-up recovery :1179 (DEC-111, same as `CmsEditorialDecisionForm`);
  form contract :1216; responsive :1380; accessibility inventory :1403; performance budgets :1736; form/auth
  security :1749; data mapping/field ownership :1814–1916; error classes :2599; navigation/degradation :2640;
  testing obligations :2668. Contracts: `packages/contracts/src/cms-composition/governed-*.ts`.
- Same-origin first-party proxies under `apps/web/src/pages/api/v1/cms/governed-reviews/...` following the
  existing CMS proxy precedent (`apps/web/src/server/cms-composition-platform-*.ts`, `cms-editorial-platform-bounded.ts`),
  strict query/body admission, CSRF, no-store, step-up passthrough.
- Precedent pages/components: `apps/web/src/pages/app/cms-content-modeling/reviews/{index,[reviewId]}.astro`,
  `apps/web/src/components/cms-editorial-workflow/*` (decision form, assignment form), template designer
  page and `apps/web/src/components/cms-composition/*`. Navigation: a nav entry reachable from
  `/app/cms-content-modeling` (vertical-slices rule).
Method: RED component/route/proxy tests first (Vitest + the repo's component-testing setup; find patterns in
existing `*.test.tsx`), then implement, then refactor. Components ≤200 lines, no business logic in
components, README per directory with >2 files. Run focused tests, `apps/web` typecheck/lint/prettier on
touched files and the full web Vitest suite. Browser E2E is a later lane; note what it must cover.
Files: new `apps/web/src/pages/app/cms-content-modeling/definition-reviews/**`,
`apps/web/src/components/cms-governed-review/**`, `apps/web/src/pages/api/v1/cms/governed-reviews/**`,
`apps/web/src/server/cms-governed-review-*.ts` (+ tests), plus minimal edits to the template designer page
and the CMS nav to mount the panel and link. Report `docs/handoffs/2026-10-14-claude-s12/lane-web-definition-reviews-report.md`.
