# Lane brief — `claude_s12_web_taxonomies` (Web, FE03 taxonomy pages)

Build, test-first, `/app/cms-content-modeling/taxonomies/new` and `/app/cms-content-modeling/taxonomies/[taxonomyId]`
(FE03 :1068) with `CmsTaxonomyVersionDesigner` (FE03 :886), `CmsTaxonomyTermForm` (FE03 :887, term list from
`cmsTaxonomyTermsRead`, actions via CMS-03C-03, `canonical_overlap` copy with copyable canonical id,
`taxonomy_not_active` links to the governed review, merge shows the survivor redirect) and the
`CmsGovernedReviewPanel` submit mount (reuse `apps/web/src/components/cms-governed-review/`, like
`CmsGovernedPatternPanel`). Same-origin proxies for CMS-03C-16 (POST versions), `cmsTaxonomyVersionsRead`,
CMS-03C-03 (term actions), `cmsTaxonomyTermsRead`, CMS-03C-17 (selector) over the existing Worker routes
(`docs/handoffs/2026-10-14-claude-s12/lane-worker-taxonomy-terms-report.md`, taxonomy-definition transport
reports in `docs/handoffs/2026-10-12-claude-s12/`). Relay typed reasons exactly (pattern: hardening-3's
`cms-composition-platform-pattern-details.ts`), `retryable: true` on 502/503/504. Term actions render only
against an `active` version; curator-only. FE03 :1036–1050, :1171, :1179, :1216, :1380, :1403, :1736, :1749,
:1814–1916, :2668. Nav entry. Zero zod in the browser with contract drift guards (precedent: the pattern
designer). Components ≤200 lines; README per directory; step-up inventory entries for new 401-reading files.
`CmsTaxonomyFieldEditor` (FE03 :888, entry value authoring) is OUT of scope (separate lane).
Files: new `apps/web/src/pages/app/cms-content-modeling/taxonomies/**`, `apps/web/src/components/cms-taxonomy*/**`,
`apps/web/src/pages/api/v1/cms/taxonomies/**`, `apps/web/src/server/cms-taxonomy-*.ts` (+tests), minimal mount
edits in `cms-governed-review/` and the CMS nav, `step-up-required.inventory.test.ts` entries. Report
`docs/handoffs/2026-10-14-claude-s12/lane-web-taxonomies-report.md`.
