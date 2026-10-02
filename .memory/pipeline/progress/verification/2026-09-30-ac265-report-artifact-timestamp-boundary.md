# AC265 report-artifact attempt-window timestamp boundary

**Date**: 2026-09-30. **Scope**: local hosted-evidence verifier hardening;
no provider mutation, deployment, promotion, or hosted acceptance.

The report-artifact verifier previously substituted `created_at` whenever
GitHub's `updated_at` was absent or null. That made the update-time upper bound
vacuous and could admit an artifact whose exact attempt window could not be
verified. It also accepted parseable non-ISO timestamps through a local
`Date.parse` helper while the sibling candidate verifier used the shared
strict timestamp parser.

The hosted verifier now requires both artifact timestamps and uses the shared
`timestampMs` parser for artifact and completed-run times. Missing, null, or
noncanonical values are refused. Official GitHub REST artifact examples carry
`updated_at` and use UTC RFC3339 timestamps; a positive test preserves the
documented `Z` form without fractional seconds. The run-artifact listing still
does not provide a direct per-attempt artifact identifier, so this remains an
attempt-window check rather than a claim of independent hosted acceptance.

Four new regression cases were RED (4 failed / 30 passed); focused GREEN is
35/35 in the run-provenance suite and 10/10 in the staging CLI suite. Restoring
only the old `updated_at ?? created_at` fallback made the absent/null cases
fail again (2 RED); the final source restores the strict check and passes.
The first full validation exposed an unrelated sliding-window assertion in the
Slice 09 AC266 tracker test after the prior checkpoint note was inserted. The
note was moved below the unchanged AC266 policy text; focused policy tests
passed 9/9. The subsequent fresh pinned `pnpm validate` exited 0: 766 Vitest
files / 6,608 passes plus one skip, 100% configured coverage, Slice 09 evidence
checks, functional and production-built Chrome suites, build, bundle budgets,
and local performance smoke. Playwright's final run status is `passed` with
zero failed tests. No migrations changed.

**Status unchanged**: Slice 09 is 261/279 active, Phase 2 is 8/17, and AC265
remains authored and unchecked as a mandatory pre-release hosted gate. The
real staging role matrix, ten scenarios, signed exact artifact provenance,
and authenticated receipt are still required. AC266 remains the separate
real-device gate; AC209 and AC211 remain post-deployment/post-launch gates.
