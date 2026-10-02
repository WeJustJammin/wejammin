# Phase 2 local contract and scope checkpoint — 2026-09-30

This record covers local changes in the `codex/s10-entry-revisions` worktree.
It is not deployment, promotion, hosted AC265 acceptance, or Phase 2 closure.
No acceptance checkbox or completion denominator changed.

## Changes and RED→GREEN evidence

- **Slice 09 / AC265 local safeguard:** The hosted-staging CLI now validates
  the caller's existing absolute workspace root and every ancestor with
  filesystem metadata before network access or manifest writes. Symlinked
  roots/ancestors, missing roots, and regular-file roots fail with the stable
  `AC265_HOSTED_SCOPE_FAILURE` sentinel. Four adversarial tests were RED before
  this check; the CLI suite passed 16/16, and the combined hosted AC265 set
  passed 40 files / 477 tests afterward. This does not prove any hosted role,
  session, artifact publication, or authenticated receipt.
- **Slice 10 / CMS-03B-11:** Syntactically malformed `locale` queries now
  return structural 400 `INVALID_REQUEST`, aligned with BE03b and sibling
  CMS-03B-03. The targeted test was RED 1/26 against the old 422 and GREEN
  26/26 after the one-line status fix; restoring 422 reproduced the RED.
  A separate dependency-relayed semantic 422 remains covered. Adjacent
  editorial Worker tests passed 27 files / 316 tests. AC-068 remains open.
- **Slice 12 / CMS-03C-03:** Added the strict taxonomy term transport wrapper,
  canonical registry operation, response definition, and regenerated OpenAPI.
  The new registry/OpenAPI tests were RED 2/2 before registration and GREEN
  2/2 afterward, and the wrapper contract was independently RED before it
  existed. An operation-ID regression probe failed both tests. The generated
  document now declares the protected 200 resource and safe errors with
  required path and strong mutation headers. The production mutation port
  still returns sanitized 503; AC-016 remains open.
- **OpenAPI reference integrity:** The published-document contract test found
  44 dangling local `#/definitions/...` pointers across components and inline
  request bodies (RED); a separate profile-portfolio builder had 21 dangling
  occurrences in seven components. All three schema emitters now anchor
  structural pointers beneath their owning OpenAPI component. The shared
  traversal preserves reference-shaped literal sample data and opaque vendor
  extensions; unit tests cover recursive values, keyword-named properties,
  and JSON Pointer escaping. All five published/standalone document variants
  now resolve every structural local reference, with a non-vacuity guard.
  Restoring the old pointer prefix reproduced the RED. This validates local
  reference resolution, not hosted API behavior.
- **Local Chrome harness:** Two full real-route runs failed when Wrangler
  4.127.1's local ProxyWorker exited on `Network connection lost.` at the
  first locale POST after rapid history-page navigation. The isolated locale
  test and the history-plus-locale subset passed, and API traces showed the
  failed POST never reached the API Worker. Letting the preceding history
  page settle before each navigation is a test-only stabilization: ten
  consecutive complete real-route runs passed 12/12 afterward. The upstream
  [Wrangler issue #15451](https://github.com/cloudflare/workers-sdk/issues/15451)
  documents the same local ProxyWorker error pattern; this is not evidence of
  a production Worker failure or a guarantee that the upstream flake is fixed.

## Canonical local gate

Pinned Node `22.23.1` and pnpm `11.24.0`: `pnpm validate` exited 0 on the
combined tree. Contract generation, database type parity, progress
consistency, formatting, lint, and type-check passed. Vitest passed 769/769
files, 6,643 tests with one skip, and configured coverage was 100% for
statements, branches, functions, and lines. Slice 09 evidence checks,
105 functional Chrome checks, twelve production-built Chrome checks, builds,
bundle budgets, and local API smoke passed. `git diff --check` was clean.

## Remaining boundaries

- Slice 09 remains **261/279 active**. Its seventeen reopened human
  activation-chain criteria and separately reopened AC250 require a real
  production acting-context/review authority decision and implementation.
- Slice 10 remains **0/75** and Slice 12 remains **0/50**. The local increments
  above do not supply their full CMS mutation/authoring happy paths.
- AC265 remains a mandatory **pre-release** hosted gate. AC266 remains
  owner-deferred but mandatory pre-release; AC209 and AC211 remain the
  post-deployment and post-launch evidence gates, respectively.
