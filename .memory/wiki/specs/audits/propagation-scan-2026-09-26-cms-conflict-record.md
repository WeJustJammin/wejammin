# CMS conflict-record propagation scan

Owner decision DEC-107 (2026-09-26): add a private durable conflict record for
CMS-06 resolution. BE03b `CMS-03B-02` accepts `conflictId`, requires loading an
unresolved conflict, and closes it atomically, but the canonical data-model
table enumerates eleven records and defines no conflict record. A wire-only
identifier cannot establish a safe current conflict state.

## Classification and targets

| Surface                                             | Classification                                                 | Required correction                                                                                                                                        |
| --------------------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BE03b canonical data model                          | Explicit omission                                              | Add a twelfth private conflict table with closed fields, FKs, state/version envelope, one-open-per-entry uniqueness, forced RLS, guards, no browser grants |
| BE03b CMS-03B-02 flow, authorization, errors, tests | Implicit persistence assumption                                | Bind conflict lookup to authorized entry/base/theirs/yours revisions; atomically close a resolved conflict with resulting revision, audit and outbox       |
| IA03 and FE03 CMS-06                                | Existing user-visible behavior, implementation detail implicit | Check cross-references for false wire-only persistence assumptions; preserve explicit human resolution and safe three-way values                           |
| Phase 2 Slice 10 and progress tracker               | Existing acceptance criterion, incomplete                      | Preserve AC IDs, authored/active denominators and unchecked CMS-06 criteria; require durable proof before completion                                       |
| Database/runtime code and runbook                   | Not implemented yet                                            | Add forward migration, pgTAP, RPC/route integration and recovery guidance after BE03b fields are frozen                                                    |
| Slice 09 gates and other CMS routes                 | Unaffected                                                     | Preserve all AC209/AC211/AC265/AC266 timing and CMS-03B-01 through -11 operation IDs                                                                       |

## Invariants

- The conflict record is private, versioned and scoped to one entry and
  revision ancestry. It cannot be created or resolved by a caller-supplied
  owner, acting party, capability or assignment assertion.
- At most one open conflict exists per entry. A resolution either commits its
  revision, terminal conflict transition, audit and outbox together or
  commits none of them. Replay and stale versions cannot duplicate effects.
- Authorized reads may expose only BE03b's bounded safe base/theirs/yours
  values; hidden or absent targets remain indistinguishable 404, while visible
  unassigned targets receive a safe 403.
- This is an additive locked-spec correction, not completion of CMS-06. No
  acceptance checkbox changes until contract, database, Worker, UI and tests
  support the complete flow.


<!-- spec-graph: auto-generated -->
## Related Specs

### Phases into
- [[specs/phases/phase-2|Phase 2 — Identity, admin, CMS/settings]]

### References
- [[specs/phases/phase-2|Phase 2 — Identity, admin, CMS/settings]]
