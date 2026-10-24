# CMS vocabulary page loader (Slice 12)

## Contents

`load-taxonomy-page.ts` is the tested loader the two Astro pages under
`pages/app/cms-content-modeling/taxonomies/` call; `taxonomy-page-reads.ts` is the one seam
(`TaxonomyPageReads`, built by `createTaxonomyPageReads` from the `PLATFORM_API` binding) over the
versions and terms proxies, with only the session headers of the page request. `load-taxonomy-page.test.ts` (saved vocabularies) and
`load-taxonomy-page.new.test.ts` (the probe and `/new`, with the shared stubs in
`load-taxonomy-page.test-support.ts`) drive it with only the proxy edge replaced; `taxonomy-static-closure.test.ts` proves the three vocabulary islands
never reach zod or the contract barrel.

## Ownership

The loader owns what the pages may render: it validates the lineage id and the term list URL state,
performs the protected reads through the first-party proxies, verifies each answer structurally
(the same zod-free verifiers the islands use) and returns one view, one closed notice or a sign-in
redirect. No form is built from an unverified answer; only the facts an island renders reach it.

## Behavior

- `/taxonomies/new` reads `cmsTaxonomyVersionsRead` once for the reserved probe lineage
  `00000000-0000-4000-8000-000000000000` (`TAXONOMY_PROBE_ID`). FE03 :1068 gates the page on
  `cms.taxonomy_curator`, and BE03c names no curator read without a vocabulary id; BE00 checks the
  session and the capability before any lookup. A missing session is 401 (303 to sign-in), a missing
  capability 403, and a verified curator 404 (no vocabulary carries that lineage; SQL also answers
  404 for a non-visible tenant, and the CMS-03C-16 write still authorizes). Any other answer (a 400
  from the producer, a 500, a 200) is shown as a notice, never as a curator pass. The id must pass
  the producer's `cms_valid_uuid` grammar (version nibble 1-8, variant 8/9/a/b; a nil id is
  refused as INVALID_REQUEST 400): `load-taxonomy-page.new.test.ts` reads the grammar from
  `supabase/migrations/20260902080000_content_schema_registry_authority.sql` and fails if the id or
  the grammar drifts. The probe takes one of the 60 versions reads per minute per user and per
  party (BE03c 166), a budget shared with every `/:taxonomyId` view and in-page re-read. A
  dedicated curator context read in BE03c would replace the probe.
- `/taxonomies/:taxonomyId` reads the versions and one term page in parallel. A malformed id
  (including `selector` and `versions`) or term list query (unknown or repeated member, unknown
  lifecycle, empty or over-512-character cursor) is a 400 before any read; a concealed or absent
  vocabulary is a 404; a stale signed cursor (409) is a 303 to the first page with the filter kept.
  A 409 on a request with no cursor has nothing to restart from, so it is shown as a failure (a
  redirect would be to the same address). An empty `lifecycle` (the filter form's "All terms")
  is no filter.
- The newest version is the edit preimage; the `active` version, if any, is the version term
  actions run under. `cmsTaxonomyVersionsRead` holds at most the newest 50 versions (BE03c 406,
  `TAXONOMY_VERSIONS_PAGE_MAX`), so the `active` version is searched only there. When a full 50
  hold none, `vocabulary.versionsBounded` is true and the term form says no active version was
  found among the newest 50, instead of claiming there is none.
- Reads in the browser (`taxonomy-versions-read.ts`, `taxonomy-terms-read.ts`) retry a 502, 503 or
  504 that declares `details.retryable` twice, after the delays `SAFE_READ_RETRY_DELAYS_MS` defines
  once (FE03 :1173, `../../lib/safe-read-retry.ts`, which pins the values), before the degraded
  state. `taxonomy-read-retry.test.ts` follows that constant; `taxonomy-filter-roundtrip.test.tsx` runs the filter form's address through the loader.

## Conventions

- The loader never throws: every outcome is a view, a closed notice or a 303 to an allowlisted sign-in address.
- The loader and its tests stay zod-free in the browser closure (`taxonomy-static-closure.test.ts`); verifiers
  are shared with the islands.
- A 401 is sign-in only: the CMS-03C-16/-17 catalogs carry no `STEP_UP_REQUIRED` row (BE03c 1441).
- Files stay at most 200 lines (tests at most 400); one loader test file per behavior group.

## Extension rules

A new read goes behind `TaxonomyPageReads` with a loader test first. Keep the pages thin.

## Related links

- `../cms-taxonomy-designer/README.md`
- `../cms-taxonomy-terms/README.md`
- `../../pages/app/cms-content-modeling/taxonomies/README.md`
