# Approved AC265 pre-release propagation

On 2026-09-26 the owner directed that `P2-S09-AC-265` move to pre-release.
The [propagation scan](propagation-scan-2026-09-26-ac265-pre-release.md)
classifies the affected sequencing, denominator, and evidence references.
`DEC-105` records the approved policy and supersedes only `DEC-104`'s AC265-only
Slice 10 prerequisite sentence. AC209/AC211 timing from DEC-104 and AC266's
real-device gate from DEC-101 remain intact.

Slice 09 implementation is **279/279 active**, with all **283 authored IDs**
retained. Phase 2 is **9/17 slices** and has **1,996 active / 2,000 authored**
criteria. Slice 10 implementation is unblocked and has not yet been completed.
`P2-S09-AC-265` remains authored and unchecked. Its genuine protected hosted
nine-role/ten-scenario matrix, signed exact artifact provenance, retained
report, authenticated receipt, and fail-closed staging-scope verification are
mandatory before production readiness/release. AC266 is separately mandatory
before release; AC209 is post-deployment alerting readiness; AC211 is post-launch
operational SLO acceptance. None is passed, waived, simulated, or inferred.

The decision is propagated through the canonical Phase 2 plan, current Slice
09/10 and Phase 2 progress records, overall index, blocker and pipeline
trackers, architecture map, release/hosted-E2E runbooks, progress validator,
and focused policy tests. Dated evidence and earlier decisions remain history,
not present-tense guidance. The authored AC265 criterion wording and `[ ]` row
are unchanged in both canonical copies. No identity, paid plan, hosted
environment, secret, production deployment, or protected run was created by
this policy change.

Verification: the revised focused completion-policy tests first failed against
the former gate, then passed **20/20** across three files after propagation.
`scripts/check-progress-consistency.mjs --json` returned `consistent`, with
Phase 2 **9/17** and no drift or malformed records. Broader validation and
spec-graph compile are recorded in the dated session handoff.


<!-- spec-graph: auto-generated -->
## Related Specs

### Phases into
- [[specs/phases/phase-2|Phase 2 — Identity, admin, CMS/settings]]

### References
- [[specs/phases/phase-2|Phase 2 — Identity, admin, CMS/settings]]
