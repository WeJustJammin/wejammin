# Slice 09 hosted-scope evidence contract checkpoint — not acceptance

**Date:** 2026-10-01  
**Authority:** DEC-104's explicit hosted-only follow-up.  
**Status:** Additive contract implemented and locally verified; authenticated
hosted-scope acceptance route and real AC265/AC266 evidence remain open.

The production release-evidence shape still requires all six members,
including alerting and SLO. The new strict hosted-scope shape contains exactly
`artifact`, `hostedE2e`, `accessibility`, and `verifiedAt`; its expected
identity omits `productionDeploymentId` and `productionDeployedAt` but retains
the remaining release, deployment, origin, and cutoff bindings. The hosted
shape reuses the production member schemas and the exact-nine-role,
exact-ten-scenario, and both-platform manual-check validator. It also checks
artifact SHA, migration version, hosted target coherence, and chronology.

TDD evidence: the new contract suite was RED because the hosted-scope module
did not exist. After implementation, the new and existing operational-evidence
suites passed **41/41 tests across two files**. The new suite has 11 tests,
including a guard that the production schema still rejects a four-member
payload without alerting and SLO. Full pinned `pnpm validate` exited 0:
**771 Vitest files, 6,662 passing tests, one skip, configured 100% coverage**,
Slice 09 evidence checks, Chrome E2E, build, bundle, and local performance.

No AC265 or AC266 criterion is checked by these local tests. The next
acceptance-boundary increment must authenticate the exact candidate artifact
and hosted report, validate candidate axe bytes and both real-device manual
report bytes, bind all of them to the same source/deployment/origin/cutoff,
then publish only a minimized manifest. A status or digest manifest alone is
not accepted as report evidence. AC209 and AC211 remain production-side gates.

Follow-up local identity boundary: a separate RED→GREEN suite now verifies the
hosted-only expected identity against the four-member payload, including the
staging-only target, exact artifact SHA and digest, deployment and origin,
cutoff, and chronology. It rejects a self-consistent production-target payload;
it does not authenticate retained report bytes. The two new suites pass 24/24.
The subsequent full pinned `pnpm validate` exited 0 with 772 Vitest files,
6,675 passing tests, one skip, configured 100% coverage, Chrome E2E, build,
bundle checks, and local performance. The authenticated hosted-scope consumer
and genuine AC265/AC266 evidence remained absent at that checkpoint; no
criterion changed.

## Retained-report and artifact-ID continuation — local, not acceptance

The new hosted-only retained-report consumer re-verifies one strict four-member
sidecar against a branded GitHub candidate, owner-pinned staging identity,
protected V3 runner verification context, and exact retained hosted, axe,
VoiceOver, and NVDA bytes. It rejects unbranded provenance, foreign
deployments, report-byte drift, invalid cutoff, and a pasted verdict. The
candidate brand now carries the GitHub API-reported bounded archive length and
the digest of its validated `accessibility/axe.json`; its parsed result is
deep-frozen before branding. The protected runner report's CI archive digest
is deliberately distinct from the deployment-manifest digest in the release
sidecar; the hosted-only verifier binds both to the same branded candidate,
while the existing production sidecar verifier keeps its original rule.

The AC266 collector now resolves both the staging candidate and manual-intake
artifact IDs from authenticated GitHub run/artifact responses before download.
Both downloads use the resolved IDs and fail on digest mismatch. The local
consumer returns `report_bytes_verified` with `acceptance: not_claimed`, not an
AC266 acceptance verdict. It is not yet wired into a protected hosted-scope
acceptance workflow, and no real hosted matrix or real-device manual reports
were supplied. The API-reported archive length is not a ZIP-byte hash; a
future composed route must retain the ID-based download and fatal digest
check. AC265 and AC266 remain authored and unchecked, Slice 09 stays
**261/279 active**, and Phase 2 stays **8/17**.

Verification: focused pinned provenance/hosted/retained tests pass **35/35**;
the AC266 artifact resolver and workflow contract pass **12/12**. The first
full validation found one new test-fixture `chromium` literal outside the
Chrome-only wire-literal allowlist; the test now derives the existing browser
name and changes only its version. The corrected full pinned `pnpm validate`
exits 0: **774 Vitest files, 6,697 passes, one skip, configured 100%
coverage**, Slice 09 evidence commands, **105 functional Google Chrome** and
**12 production-built real-route Chrome** tests, builds, bundle budgets, and
local performance smoke. This is local verification, not hosted acceptance.
