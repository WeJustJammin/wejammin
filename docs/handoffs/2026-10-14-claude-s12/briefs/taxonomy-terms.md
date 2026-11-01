# Lane brief — `claude_s12_taxonomy_terms_sql` (staged-runner lane `taxonomy-terms`)

Build, test-first, the SQL for: CMS-03C-03 POST /api/v1/cms/taxonomies/{taxonomyId}/terms/actions
(`cms_act_taxonomy_term`: create/rename/alias/deprecate/merge per BE03c ~1377), CMS-03C-17 GET
/api/v1/cms/taxonomies/selector (active vocabularies whose allowlist names the type+field; signed keyset
cursor `(taxonomyKey ASC, termKey ASC)`, default 50/max 100), `cmsTaxonomyTermsRead` GET
/api/v1/cms/taxonomies/{taxonomyId}/terms (cursor `(termKey ASC, termId ASC)`, 25/50, lifecycle filter), and
CMS-03C-18 internal `platform_private.cms_canonical_taxonomy_match(p_domain text, p_candidates jsonb)` (≤64
candidates, one domain, 2,000 ms, provider fault → 503 `DEPENDENCY_UNAVAILABLE`, `canonical_overlap`
refusal never creates the term; unbuilt domains → 422 `canonical_source_unavailable` + `details.domain`).
Term actions run only against an ACTIVE taxonomy version (`taxonomy_not_active`); taxonomy activation is
governed-b WIP — stage `governed-b,taxonomy-terms`. Taxonomy versions/lineage are promoted (`20261014030*`).

## Spec
BE03c rows ~161, ~166–167, ~179, ~187; validation rows ~366–410 incl. ~407; "Taxonomy versions, canonical
projection and term governance (D10, OD-1, DEC-135)" ~1369–1377 (merge convergence, survivor redirect,
merged ids never reactivate, assignments convergent); schema ~1428; grants; authorization matrix ~1478;
events (`cms.taxonomy.changed.v1`); error catalog; testing. Contracts `taxonomy-term.ts`, `taxonomy-term-list.ts`,
`taxonomy-selector.ts`, `canonical-taxonomy-match.ts`. Existing storage/guards: `supabase/migrations/2026092738*`–
`2026092748*`, CMS-03C-03 link integrity migration; promoted `20261013300100` canonical domain registry.
Worker routes exist for 03 (production port currently 503: `apps/worker/src/cms-composition-production-taxonomy.ts`)
— record the RPC boundary you define in `## RPC boundary` for the Worker lane; do not edit Worker files.
Criteria AC016–021, AC130–141, AC183–188 and cascade rows naming terms/merge/canonical (grep the tracker);
gap analysis `docs/handoffs/2026-10-12-claude-s12/ledger-gap-*.md`.

## Files (exclusive)
`supabase/migrations-wip/taxonomy-terms/` (range 20261014120000–20261014129999), new suites
`supabase/tests/phase_02_slice_12_taxonomy_terms{,_reads,_canonical}.sql` + dirs (add-only cases allowed in
`phase_02_slice_12_taxonomy_link_integrity.sql`), report `docs/handoffs/2026-10-14-claude-s12/lane-taxonomy-terms-report.md`.
