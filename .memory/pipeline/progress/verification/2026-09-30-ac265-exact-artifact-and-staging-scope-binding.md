# AC265 exact-artifact and staging-scope binding — local checkpoint

**Date**: 2026-09-30. **Scope**: local pre-release producer hardening only; no
hosted run, provider mutation, deployment, promotion, acceptance, or secret
provisioning.

The hosted E2E preflight now resolves the exact CI and staging artifact IDs
through the authenticated GitHub run/attempt provenance API before download.
The pinned download action selects those IDs, enforces digest mismatch as an
error, and exposes the IDs to the collector. The collector requires the
downloaded IDs, re-verifies provenance, and refuses any ID drift before writing
the candidate enrollment request. Name-based download ambiguity is removed.

The separate hosted staging-scope verifier now validates the caller-supplied
manifest workspace root before network or file access, binds the GitHub-
authenticated staging run ID and attempt to the protected runner-contract
identity, strictly decodes the protected context bundle before GitHub access,
and caps direct raw-bundle parsing at 256 KiB.

Focused TDD reproduced artifact-download wiring, missing/mismatched IDs,
workspace-root drift, four run/attempt mismatches, permissive base64, and an
oversized valid JSON bundle before the corrections. The related staging-scope
and CLI suites finish at 38/38; the artifact-binding subagent's five-file
focused suite finishes at 35/35 and its AC265 sweep at 112 files / 1,178 tests.
Fresh pinned `pnpm validate` exits 0: 766 Vitest files, 6,603 passes plus one
skip, 100% configured coverage, Slice 09 evidence checks, 105 functional
Chrome tests, all twelve production-built real-route tests after one bounded
retry for an exact local Wrangler disconnect, build, bundle budgets, and local
performance smoke. The Playwright last-run status is `passed` with zero failed
tests. No migrations changed, so this checkpoint did not rerun `pnpm db:verify`.

**Acceptance remains open**: Slice 09 is 261/279 active, Phase 2 is 8/17,
and AC265 remains an authored, unchecked mandatory pre-release gate. These
fixture/local results do not prove nine real staging role sessions, ten hosted
scenarios, approved signed provenance, or the authenticated receipt. AC209 and
AC211 remain post-deployment/post-launch gates; AC266 remains an independent
real-device pre-release gate. An additional read-only audit flagged the report
artifact `updated_at ?? created_at` fallback as a possible attempt-window
weakness; this checkpoint does not close it.
