# Lane brief — `claude_s12_taxonomy_def_sql` (staged-runner lane `taxonomy-def`)

Implement the missing SQL producers for CMS-03C-16 (POST /api/v1/cms/taxonomies/versions → `cms_create_taxonomy_version`) and the supporting read `cmsTaxonomyVersionsRead` (GET /api/v1/cms/taxonomies/{taxonomyId}/versions → `cms_list_taxonomy_versions`), taking the existing RED pgTAP suite to GREEN through strict TDD.

## Your files (exclusive)
- `supabase/migrations-wip/taxonomy-def/` — forward migrations, timestamps ONLY in 20261014030000–20261014039999.
- `supabase/tests/phase_02_slice_12_taxonomy_definition.sql` and `supabase/tests/phase_02_slice_12_taxonomy_definition/` — existing RED suite (independently reviewed). Add cases freely; correct an existing oracle only under the lane-rules "Test corrections" rule.
- Report: `docs/handoffs/2026-10-14-claude-s12/lane-taxonomy-def-report.md` (a stub from a stopped predecessor may exist; overwrite it).
Nothing else. Worker TypeScript is frozen and reviewed; your SQL must match it.

## Read before designing
1. Prior RED report: `docs/handoffs/2026-10-12-claude-s12/lane-native-taxonomy-definition-report.md` (whole file). Third run: complete plan 1..1143, 341 pass / 802 fail, no abort; all 14 setup controls pass; first create returns 42883. TAP `.lane-logs/alt-tap-185629-376711.tap`.
2. The suite, all includes, README.
3. BE03c `.memory/wiki/specs/be/03c-composition-taxonomy-localization.md`: Route Registry rows CMS-03C-16 and cmsTaxonomyVersionsRead (~166, 178); Registry invariants (~192–221: DEC-188 immutable `version` + private `lifecycle_version`; E14 per-owner `UNIQUE (owner_id, taxonomy_key, version)`; lineage `taxonomy_id`; `supersedes_id`); TaxonomyVersion* contracts; "Taxonomy versions, canonical projection and term governance (D10, OD-1, DEC-135)"; canonical domain registry; lock order; Database Schema; grants; authorization matrix; error catalog.
4. Contracts (frozen): `packages/contracts/src/cms-composition/taxonomy-version.ts`, `canonical-taxonomy-match.ts`, `key-grammar.ts`, `refusals.ts`, `error-catalog.ts`.
5. Worker adapter (frozen RPC boundary): `apps/worker/src/cms-composition-production-taxonomy-definition.ts`, `apps/worker/src/cms-composition-production-taxonomy-definition-versions.ts` (RPC names ~95), `apps/worker/src/cms-composition/taxonomy-definition-*.ts` and their tests.
6. Existing storage: taxonomy tables and guards (`supabase/migrations/202609273[6-9]*`, `2026092740*`–`2026092748*`, CMS-03C-03 link-integrity migration); canonical domain registry `20261013300100_cms_canonical_domain_registry.sql`; governed helpers `20261013300000`–`300830` (reuse, never edit); template analogue `20260927200000_cms_template_authority.sql` and `20261013100000`–`100300` (per-owner keys, lineage, latest read).

## Decisions already fixed (do not reopen)
- Private read witness is strict `{ taxonomyId, page }`; `taxonomyId` must equal the requested lineage before the Worker unwraps the unchanged public `{ items, pageVersion }`. Absent/hidden lineage is 404; never infer lineage existence from empty items.
- Private CAS: public HTTP If-Match stays quoted; the private JSON `ifMatch` operand is decoded (header `"7"` → operand `7`). Keep owner concealment on latest/read and current-capability checks.
- Declared-but-unavailable canonical domains are ACCEPTED at vocabulary creation; later use of an unbuilt domain is 422 `canonical_source_unavailable` with `details.domain`, not a creation-time 503.
- DEC-188: definition `version` immutable; private `lifecycle_version` starts at 1.

## Known hazards (address each in your report)
Taxonomy term lineage/FKs versus version rows; version-row FK versus stable lineage; ambiguous populated-legacy backfill (migrate deterministically or refuse clearly); immutable guarded definition fields; full SECURITY DEFINER callee privilege closure; concurrent CAS/replay and all-or-nothing atomicity; idempotent replay returns identical resource.

## Dependencies outside your scope
Review/successor cases in `060-review-successor.sqlinc` may need governed CMS-03C-07/08/09. 07/08 are built concurrently by lane `governed-a`; 09 is not started; your staged runs do not include other lanes' WIP. Classify such assertions `blocked-on-governed-07/08/09` with TAP evidence; never fake them.

## Done
All assertions not blocked on governed 07/08/09 pass; plan never shrinks; zero harness aborts. Report: migrations (path/lines/SHA-256), runs, test corrections with diffs and spec citations, remaining failures classified, hazard dispositions, requests to root.
