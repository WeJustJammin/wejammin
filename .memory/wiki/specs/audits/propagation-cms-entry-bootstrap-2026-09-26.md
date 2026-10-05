# Approved CMS entry bootstrap and draft-read propagation

On 2026-09-26 the owner approved protected entry-create and draft-detail-read
routes for Slice 10. [DEC-106's scan](propagation-scan-2026-09-26-cms-entry-bootstrap.md)
identified the gap: IA03 CMS-05 promised create/edit, but BE03b could only
revise an existing active entry with a positive readable base revision, and
its history read returned summaries rather than editable values. Browser
access to private editorial tables remains revoked.

The locked contracts now append `CMS-03B-10` (`POST /api/v1/cms/entries`,
`EntryCreateRequest` to 201 `EntryCreateResource`) and `CMS-03B-11` (`GET` on
`/api/v1/cms/entries/{entryId}`, `EntryDraftDetailQuery` to 200
`EntryDraftDetailResource`) without renumbering `CMS-03B-01` through `-09`.
Create requires an idempotency key but no update-only `If-Match`, because a
new entry has no prior version. It atomically establishes the active entry,
first attributable draft revision, initial assignment, audit, and outbox from
server-derived authority. Detail is an assigned, no-store, read-only fetch of
schema-typed current draft values and provenance with a strong ETag binding
entry and revision versions. Concealed/absent targets return an
indistinguishable 404; visible unassigned targets return a safe 403.

IA03, its deep dive, BE03b, and FE03 now agree on the bootstrap, protected
loader, authorization, failure/recovery, UI, and operation map. The Phase 2
plan and Slice 10 tracker retain the original 60 authored criteria and append
`P2-S10-AC-061` through `-075`, for **75 authored/active Slice 10 criteria**;
none is marked complete by this documentation change. Phase 2 now has
**2,011 active / 2,015 authored** criteria and remains **9/17 slices**.
Slice 09's AC209, AC211, AC265, and AC266 evidence/timing obligations are
unchanged. AC265 and AC266 remain mandatory pre-release gates, not Slice 10
implementation prerequisites.

Implementation is in progress separately: shared contracts, private table
foundation, Worker routes, RPC authority, and the web editor are verified
only to their own reported test scope. This propagation record does not
claim a deployable end-to-end CMS-05 flow, completed Slice 10 criterion, or
hosted acceptance. The [editorial runbook](../../operations/runbooks/cms-editorial.md)
states the fail-closed recovery and evidence rules.

Implementation source review found a further unresolved dependency, not a
passed criterion: CMS-03A-07 provides the immutable schema artifact and
activation evidence but is not readable by ordinary authors, while the
required, distinct editorial `workflowPolicy` has no versioned hash/risk/
approval snapshot in the current workflow key/version allowlist. The owner
is choosing whether to add a private policy source and author-safe manifest
or defer initial creation. Until then the create UI and positive RPC path
must fail closed; no activation evidence may be copied into the editorial
policy field as a substitute.

Verification of the propagation: BE03b's locked traceability check passed;
the IA/FE tables were checked for aligned columns and `git diff --check`
passed; `scripts/check-progress-consistency.mjs --json` reported consistent
after the plan/tracker denominator update. Spec-graph compilation and
broader code/database validation are recorded separately in the session
handoff after the current implementation lanes settle.


<!-- spec-graph: auto-generated -->
## Related Specs

### Phases into
- [[specs/phases/phase-2|Phase 2 — Identity, admin, CMS/settings]]

### References
- [[specs/phases/phase-2|Phase 2 — Identity, admin, CMS/settings]]
