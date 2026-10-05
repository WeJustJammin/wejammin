# CMS-16 related-content eligibility and derived-rule source scan

**Status:** owner decision needed; no locked contract changed.

## Existing lock

- IA03 CMS-16 and BE03c CMS-03C-05 require manual pins before derived results,
  exclusions to win, bounded deterministic rules with a reason and version, and
  target authorization and publication eligibility to be rechecked at read,
  preview, and publication. A hidden or ineligible target is never made visible
  merely because a curator saved a rule.
- BE03c names `cms_curate_related_content` as the private mutation RPC and
  `RelatedContentResource` as the 201 result. The existing request contract
  bounds pins, exclusions, and the
  `{ key, version, reasonCode, maxCandidates }` rule descriptor; it does not
  permit arbitrary query text.

## Current implementation boundary

`20260927310000_cms_locale_related_authority.sql` provides private,
append-only related-rule storage with forced RLS and structural guards. There
is no named eligible-target projection adapter or implemented
`cms_curate_related_content` RPC in the production path. Publication-version
storage alone does not prove target visibility or read-time authorization.
The rule key/version descriptor does not identify a registered algorithm,
ranked inputs, or a definition of what `maxCandidates` counts. The
`cms.publication.changed.v1` invalidation consumer also has no concrete
related-eligibility transition. A 201 response or nonzero `eligibleCount`
cannot be fabricated from private rule rows.

## Spec gap and proposed cascade, pending approval

**SPEC GAP: BE03c §CMS-03C-05/Data Flow —** the eligible-target authority,
derived-candidate ranking semantics, and invalidation transition are not
defined sufficiently to implement the required production happy path.

1. Name a bounded read-only eligible-target projection owned by the relevant
   publication and target-authorization authorities. Define how the projection
   proves current target visibility at read, preview, and publication, and how
   unavailable authority fails closed.
2. Define the registered derived-rule inputs, deterministic ordering and
   reason/version provenance, whether `maxCandidates` bounds pre- or
   post-exclusion candidates, and how a publication change invalidates prior
   eligibility without rewriting immutable rule history.
3. Cascade IA03, BE03c, applicable FE specs, Slice 12 criteria, API/RPC and
   projection contracts, SQL tests, and browser acceptance before claiming a
   related-content curator happy path.

No spec, API, status, or acceptance criterion is changed by this scan.
