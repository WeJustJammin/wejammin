# Approved CMS conflict-record propagation

On 2026-09-26 the owner selected a private durable conflict table for CMS-06
instead of deferring conflict resolution. [DEC-107's scan](propagation-scan-2026-09-26-cms-conflict-record.md)
identified the gap: BE03b `CMS-03B-02` used `conflictId`, an unresolved-conflict
lookup, and atomic close, but enumerated eleven private records with no
conflict record. An identifier alone could not prove current conflict state.

BE03b now defines `ConflictRecord / cms_conflict_records` as its twelfth
canonical record. It binds the entry and common/base/current revision evidence,
supports either an immutable candidate revision or a private bounded proposed
value payload for the "yours" side, and closes the `open` state under CAS when
resolution creates its attributable revision. The private table enforces one
open conflict per entry, closed state/source envelopes, forced RLS, named-RPC
writes, no browser grants, and 128-key/8-depth/256-KiB proposed-value bounds.
The same bounds must also be checked at the RPC boundary. Hidden or absent
conflicts remain 404; visible unassigned conflicts remain safe 403; a stale
resolution returns 409 without deleting the open conflict or overwriting a
newer draft.

Three forward database migrations cover the support records, conflict record,
and proposed-value CHECK hardening. Their focused pgTAP suites report **30/30**
support, **25/25** conflict, and **32/32** original entry-schema assertions.
The BE03b locked-traceability test reports **3/3**. These prove schema and
documentation properties only. The `CMS-03B-02` RPC, Worker route, and browser
flow are not yet complete; all Slice 10 acceptance checkboxes remain open.
IA03, FE03, and the Phase 2 plan already require recorded same-field conflict
and explicit resolution, so their user-visible behavior and criterion counts
do not change. All eleven BE03b operation IDs remain stable.

No Slice 09 evidence gate is altered: AC265/AC266 remain mandatory pre-release,
AC209 is post-deployment alerting readiness, and AC211 is post-launch SLO
acceptance. DEC-107 neither passes nor waives any of them.


<!-- spec-graph: auto-generated -->
## Related Specs

### Phases into
- [[specs/phases/phase-2|Phase 2 — Identity, admin, CMS/settings]]

### References
- [[specs/phases/phase-2|Phase 2 — Identity, admin, CMS/settings]]
