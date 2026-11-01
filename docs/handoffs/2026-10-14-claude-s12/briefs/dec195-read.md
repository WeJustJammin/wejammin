# Lane brief — `claude_s12_dec195_read` (protected related-content read, full stack)

Owner decision DEC-195 (end of `.memory/wiki/decisions.md`). Root wrote the BE03c rows (search `cmsRelatedContentRead`
in `.memory/wiki/specs/be/03c-composition-taxonomy-localization.md`: index, interaction map, route registry, validation,
error matrix, catalog, authority, `RelatedContentRuleRead` schema, changelog). RED first at each layer:
1. Contracts: `RelatedContentRuleReadSchema`, the operation id `cmsRelatedContentRead` in the platform registries
   (rates 300/600 per minute, 8,000 ms, no-store), the refusal list (`capability_missing` 403), OpenAPI path; run
   `node infra/generate-openapi.mjs --check` after `pnpm contracts:generate` (record the diff).
2. SQL: WIP `supabase/migrations-wip/dec195/`, timestamps `20261014200000`-`200499`: a private SECURITY DEFINER read
   + `platform_api` wrapper following the CMS-03C-05 authority exactly (reuse its authority helper; 403
   `capability_missing` for a visible source without edit; 404 hidden/absent) returning the current active rule as the
   same resource CMS-03C-05 returns, or `{rule: null}`. pgTAP: editor gets rule / null; reader without edit 403;
   hidden 404; revoked rule => null; malformed id 400; grants. Staged lane `dec195`.
3. Worker: GET route + production adapter (precedent: the taxonomy read routes and `forbiddenDetails`), strict parsing.
4. Web: same-origin proxy GET; the related-content page loads the rule through it, replacing the SG-S12-03 boundary
   (`readSavedRelatedRule`) and the SG-S12-04 boundary (`readEditCapability`) with the real read: 403 page for a
   reader without edit, the form editable with the saved rule; targets the viewer cannot open render as "Unavailable
   entry" and are kept on save; retry/429 contract on the read; remove the sentinel tests (replace with behavioural
   tests).
5. Spec cascade (owner-approved by DEC-195): FE03 `.memory/wiki/specs/fe/03-cms-content-modeling.md` related-content
   page/form rows (:890, :1072, :1473, :1508, :1601) name the read; FE03 :1601 "step-up gates the commits" corrected to
   BE03c 216 (no step-up for CMS-03C-05); affected Slice 12 acceptance criteria about CMS-16 (tracker + `phase-2.md` +
   depth-floor matrix, identical bodies, no box checked); report acceptance-section SHA-256 before/after.
Joint landing: SQL + contracts + Worker + Web promote together. Report `docs/handoffs/2026-10-14-claude-s12/lane-dec195-read-report.md`.
