# CMS composition contracts

## Contents

The governing source is
`.memory/wiki/specs/be/03c-composition-taxonomy-localization.md`. Every module
is strict, bounded and paired with an adjacent `*.test.ts`.

Shared grammar and vocabularies

- `key-grammar.ts` is the one definition of template, pattern and taxonomy keys,
  the reserved sets (E13: templates `context`, `versions`, `new`; patterns also
  `selector`), lineage ids, node keys and normalized node paths. Keys are unique
  per owner (E14); no schema carries an owner.
- `definition-state.ts` is the eight-state lifecycle of a template, pattern or
  taxonomy version.
- `refusals.ts` is the closed catalog of Slice 12 typed refusal tokens (403, 409,
  422), the tokens each operation may publish and the `details` shape per token.
- `block-rules-refusal.ts` (DEC-210) is the pointer grammar of the `block_rules_violated` 422 per operation
  (CMS-03C-12 `/blockTree/...` node, CMS-03C-02 `/roots` or `/patternVersion`, CMS-03C-15 `/instances/{i}[/choices]`)
  and the one projection of a refusal onto it, shared by the Worker and the web proxies.
- `error-catalog.ts` (zod-free) maps each HTTP status to the application code of
  the six 03c catalogs and generates the catalog message.
- `conditional-if-match.ts` is the `If-Match` rule of a lineage create: absent on
  `expectedVersion: null`, equal to `expectedVersion` otherwise.

Operations CMS-03C-01 to CMS-03C-05 (shipped in Slices 09/12)

- `template.ts`, `template-detail.ts`, `template-compatibility.ts`: CMS-03C-01,
  the designer context, the latest read and the service-only resolver.
- `pattern-instance.ts`: CMS-03C-02 request (overrides keyed by node path),
  headers, the closed `CompositionInstanceResource` (with `position`) and the
  `PatternPlacementResource` items list (1 to 512 rows, DEC-175/181/185).
- `composition-instances-read.ts`: the `cmsCompositionInstancesRead` path and query request
  (`cursor`, `limit` 1-50 default 25) and `CompositionInstancePage` (`{ revisionId | null,
items: CompositionInstanceResource[] <= 50, nextCursor }`, live heads only, DEC-206 as aligned to BE00) and
  `compositionInstancesPageHonours` (no more items than `limit`, a cursor only after a full page).
- `taxonomy-term.ts`, `locale-variant.ts`, `related-content.ts`: CMS-03C-03, -04
  and -05 (variant `staleFieldIds`, DEC-121). `related-content.ts` also holds the
  `cmsRelatedContentRead` path request and `RelatedContentRuleRead`
  (`{ rule: RelatedContentResource | null }`, DEC-195).
- `locale-variant-read.ts`: the `cmsLocaleVariantRead` path request and `LocaleVariantRead`
  (`{ locale, activeFallbackChain, variant: LocaleVariantResource | null, fields, resolutions }`,
  DEC-205), with `localeVariantReadAnswers` as the one same-entry/same-locale check.

Governed review set (CMS-03C-06 to CMS-03C-11, DEC-137)

- `governed-review.ts` (vocabularies, base resource, CMS-03C-06 submission),
  `governed-decision.ts` (CMS-03C-07), `governed-assignment.ts` (CMS-03C-08),
  `governed-activation.ts` (CMS-03C-09 and the `ScheduledInstant`),
  `governed-review-read.ts` (CMS-03C-10 detail and CMS-03C-11 queue).
- DEC-191 read members: `GovernedActivationResource.supersededVersion` (the replaced
  definition version; null unless the action is `activate`) and
  `GovernedReviewDetailResource.activationSchedule` (`{state, reasonCode}` or null; the
  reason is set exactly for a blocked or cancelled schedule). Both are required keys.

Patterns, taxonomy and reads (CMS-03C-12 to CMS-03C-17 and the supporting reads)

- `pattern-node.ts` (the bounded node forest), `pattern-version.ts` (CMS-03C-12
  and `cmsPatternLatestRead`), `pattern-selector.ts` (CMS-03C-13),
  `pattern-update.ts` (CMS-03C-14 diff and CMS-03C-15 accept/detach).
- `taxonomy-version.ts` (CMS-03C-16 and `cmsTaxonomyVersionsRead`),
  `taxonomy-selector.ts` (CMS-03C-17), `taxonomy-term-list.ts`
  (`cmsTaxonomyTermsRead`).

Internal service operations (CMS-03C-18 to CMS-03C-21; no browser route, never in
OpenAPI)

- `canonical-taxonomy-match.ts` (CMS-03C-18), `governed-activation-job.ts`
  (CMS-03C-19), `locale-resolution.ts` (CMS-03C-20, the `no_fallback` gate),
  `related-public-target.ts` (CMS-03C-21 and the code-owned rule registry),
  `preflight-providers.ts` (the three Slice 12 preflight rows).

`composition-fixtures.test-support.ts` holds the canonical valid fixtures the
Slice 12 suites derive their invalid variants from. `index.ts` is the public
export surface.

## Ownership

This directory owns strict CMS-03C request, resource and refusal contracts.
Worker adapters, not these schemas, resolve registered blocks, recompute the
registry digest, check that an override key names a node of the pinned tree,
check a nested pattern is active, authorize the actor and commit.

## Extension

Add one focused schema module and adjacent boundary tests per operation (valid
accepted, every invalid shape rejected at the right issue path, empty/max/max+1
boundaries, strict unknown keys, closed enums), export it from `index.ts`, then
register the route row in `../platform-registries.ts`, the schemas in
`../openapi.ts` and the responses in `infra/openapi-definitions-cms-composition.mjs`
and run `pnpm contracts:generate`. Keep every schema strict and bounded and every
file under 300 lines.

## Conventions

- A request schema is never `.readonly()` (it would publish `readOnly` on a
  request body); a response schema may be.
- A failure that has a typed refusal token carries it as the Zod issue message
  (`key_reserved`, `pattern_depth_exceeded`, `pattern_nodes_exceeded`,
  `diff_too_large`, `override_key_not_node_path`), at the pointer the spec names.
- Reuse 03a's safe registry projection and shared CMS primitives. Never copy
  release credentials, ownership identifiers or capability authority into a
  browser resource. A caller-supplied block-registry digest is an equality
  expectation, not authoritative persisted evidence; a differing one is 409
  `block_registry_digest_mismatch` (DEC-186).

## Related links

Related contracts live in `packages/contracts/src/content-schema-registry/` and
`packages/contracts/src/cms-editorial/` (the 03b review, time and refusal
primitives the governed set reuses).
