# CMS-14 canonical taxonomy source and version-authoring scan

**Status:** owner decision requested; no locked contract changed.

## Existing lock

- Ideation 25.05.01 D-01 requires editorial vocabularies to reference, never
  duplicate, canonical role, instrument, gear, place, rights, and jurisdiction
  taxonomies. Its failure path blocks activation on overlap or an absent curator.
- IA03 CMS-14 requires a canonical-taxonomy overlap check, stable term keys,
  acyclic hierarchy, and survivor-directed merges.
- BE03c CMS-03C-03 exposes term actions through
  `POST /api/v1/cms/taxonomies/{taxonomyId}/terms/actions` and says overlap is
  checked before mutation. It defines neither the authoritative canonical-ID
  source nor protected taxonomy-version create, activation, or selector-read
  operations.

## Current implementation boundary

`20260927260000_cms_taxonomy_authority.sql` and later migrations provide
private, forced-RLS taxonomy/term/label/assignment tables and several integrity
guards. There is no named curator transaction, canonical-overlap provider, or
protected version-authoring route in the current Slice 12 implementation. A
private table row is not evidence that a curator can safely create or activate
an editorial vocabulary. The owner-bound assignment-field FK added in
`20260927480000_cms_taxonomy_assignment_field_owner.sql` closes one storage
integrity gap only.

## Proposed cascade, pending approval

1. Define a read-only internal canonical taxonomy source contract fed by the
   owning domain authorities. Unavailable or unproven source means activation
   fails closed; no hard-coded or synthetic canonical records count as proof.
2. Add protected taxonomy-version draft/create, detail/selector-read, and
   activation contracts with curator scope, CAS, idempotency, and audit/outbox
   obligations. Keep term actions bound to an existing visible version.
3. Cascade IA03, BE03c, applicable FE specs, Slice 12 criteria, API inventory,
   SQL/RPC contracts, and browser acceptance before implementing the curator
   happy path.

No spec, API, status, or acceptance criterion is changed by this scan.
