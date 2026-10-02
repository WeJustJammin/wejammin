# AC265 pre-release gate propagation scan

Owner decision (2026-09-26): move `P2-S09-AC-265` to **pre-release**. This changes
the timing of hosted acceptance, not the authored criterion or its evidence
contract. AC265 remains unchecked until genuine hosted staging evidence proves
the exact artifact provenance and nine-role, ten-scenario matrix. It must pass
before production readiness/release, but it no longer blocks Slice 09
implementation completion or Slice 10 implementation.

## Pre-scan and selection

Decision type: implementation-sequencing and acceptance-gate timing. The owner
selected AC265 directly. Current references occur in the canonical Phase 2
plan; Slice 09, Phase 2, overall, pipeline, and blocker trackers; architecture
map; release and hosted-E2E runbooks; progress validator; focused policy and
traceability tests. Dated verification/session records and prior decisions are
historical and must not be rewritten.

## Classification

| Surface | Classification | Correction |
| --- | --- | --- |
| Canonical Phase 2 plan and current trackers | Explicit contradiction: AC265 is the only active Slice 09 / Slice 10 implementation gate | Remove AC265 from active implementation denominator and prerequisite; keep authored AC265 unchecked and mandatory pre-release |
| Progress validator and policy tests | Explicit contradiction: pin 280/1997 active counts and the AC265-only Slice 10 lock | Pin 279/1996 active counts and the new pre-release timing; keep authored totals at 283/2000 |
| Architecture and current runbooks | Explicit contradiction where AC265 is described as the implementation lock | Describe hosted proof as pre-release acceptance, with no claim that it exists |
| Prior decisions and dated evidence records | Consistent as history | Add superseding dated decision and propagation record; do not erase prior observations |
| Hosted matrix, evidence verifier, protected workflows, identities, signatures, AC266 device proof | Consistent evidence obligations | Preserve exact proof requirements and all fail-closed checks; no synthetic or staging shortcut |

## Implicit assumptions

- A criterion excluded from the *implementation* denominator is not waived.
  AC265 remains an authored, unchecked pre-release release gate. Its existing
  hosted route and genuine evidence must still be completed before release.
- Slice 09 implementation completion does not imply production readiness.
  AC266 also remains a pre-release gate; AC209 is a post-deployment alerting
  readiness gate; AC211 is post-launch operational SLO acceptance.
- This decision does not authorize identity provisioning, a paid plan, or a
  production deployment. It allows the independent Slice 10 work to start.

## Apply targets and invariant

Apply the decision in the canonical plan, current progress records, validator,
focused policy tests, architecture, and operational runbooks. Record the new
decision and propagation, then compile and check the spec graph. Retain all
283 Slice 09 and 2,000 Phase 2 authored IDs. Slice 09 active implementation
count becomes **279/279**; Phase 2 active denominator becomes **1,996/2,000**.
`P2-S09-AC-265`, `209`, `211`, and `266` remain authored and unchecked.

The owner already confirmed this exact timing change; no further approval is
required for the apply pass.


<!-- spec-graph: auto-generated -->
## Related Specs

### Phases into
- [[specs/phases/phase-2|Phase 2 — Identity, admin, CMS/settings]]

### References
- [[specs/phases/phase-2|Phase 2 — Identity, admin, CMS/settings]]
