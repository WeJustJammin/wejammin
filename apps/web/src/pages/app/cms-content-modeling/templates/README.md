# Protected CMS template pages

## Contents

`new.astro` loads the scoped designer context before hydrating the private
create-draft form. `[templateKey].astro` loads both that context and the
authoritative latest editable template detail before hydrating the successor
form. `template-designer-route.test.ts` guards the structural route wiring. What each page does with the answers of its
protected reads (sign-in redirect, 403 capability sentence, 429 wait with its `Retry-After`, 5xx retry sentence, no form
unless verified) lives in `../../../../components/cms-composition/cms-template-page-outcome.ts` and is tested there.

## Ownership

Both pages are server-rendered on demand, no-store, and redirect an expired
session only to an allowlisted sign-in return path. Denied, absent, malformed,
or degraded projections never become browser form props. The Worker and
private database remain authoritative for capability and version checks.

## Extension rules

The edit page rejects a malformed key, and the reserved keys `context` and
`versions` (BE03c E13), with a disclosure-safe accessible 400 before any
protected read (FE03, P2-S12-AC-265); an absent or concealed key is the
disclosure-safe 404 and a missing designer grant is the 403.
The island uses the canonical version for `expectedVersion` and exact strong
`If-Match`; an HTTP 409 requires an explicit latest-version comparison and
rebase. Neither a newly created draft nor a successor is publication.

## Conventions

Keep the form gated on both validated projections, use a focusable result
region, and leave unsent values intact during reconciliation.

## Related links

The route test checks structural fail-closed wiring. The Chrome E2E test checks
the malformed-key and unavailable-projection boundaries. Authenticated hosted
role and two-request conflict acceptance remain separate evidence gates.
