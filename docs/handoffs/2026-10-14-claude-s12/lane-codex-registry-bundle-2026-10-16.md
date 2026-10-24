# Native registry companion accounting GREEN author handoff

Date: 2026-10-16. Native Codex author; S12Dispatch requested model
`gpt-6.1-sol`, reasoning effort `ultra`. Worktree:
`/home/rob/.codex/worktrees/phase2-slice12/WeJammin`.

Status: implementation frozen for root validation. GREEN is UNRUN by this author.
The primary checkout remained read-only. This author wrote only
`scripts/verify-bundle-budget.mjs` and this handoff. All tests remained frozen.

## Root-owned RED evidence

Raw receipt: `/tmp/wejammin-native-registry-red-pW9xqc/red-hashed.json`.
SHA-256: `637116cc0d5adafc7811cecf621a9c8c9f4faa10097d152bcf509f8dfbc73c9b`.
This author read the existing receipt; root executed the tests.

The receipt records four cases: two PASS and two FAIL. The complete initial
asset-set assertion failed with five assets instead of seven at test line 114.
The cap assertion failed at test line 150 because the checker reported 286 gzip
bytes, below the 92,160-byte cap, after omitting the auth companion and its static
dependency. The island-budget and genuinely dynamic-import cases passed.
Root qualified the earlier unhashed-fixture receipt; this lane relies on the
corrected hashed-filename receipt above.

Frozen test: `tests/performance/cms-registry-bundle-budget.test.ts` (158 lines).
SHA-256 before and after this author's edit:
`0eac244b0a1c139f91462ee4ad97b70589b7ab53ba75630e5cdaa2a1a98c42b0`.

## Root cause and precise change

The registry index, version and review pages explicitly load both
`route-heading-focus.ts` and `auth-scope-sync.ts` beside the registry island:
`index.astro:170-171`, `[contentTypeId]/versions/[versionId].astro:180-181`, and
`schema-reviews/[reviewId].astro:154-155`, under
`apps/web/src/pages/app/cms-content-modeling/`.

The `REGISTRY_ENTRY_STEM` branch in `findRouteAssets` matched only hashed
`route-heading-focus` assets. At `scripts/verify-bundle-budget.mjs:491-498`, the
discovery regex now accepts both hashed `route-heading-focus` and
`auth-scope-sync` JavaScript/module asset families. Existing initial-asset sets
and `collectBuiltStaticClosure` traverse the discovered companion's static
dependencies and deduplicate assets. No closure algorithm, island measurement,
lazy promotion rule, budget, or other route branch was changed.

Checker SHA-256 before:
`ff3ad92821a10a3e8d8851ebb9a691302520e2395e8643bb2501a9b11cee5492`.
Checker SHA-256 after:
`25de0722fb2ffe43a74c9f6ecab9ff913f7ddc5a099e4c1564aff0b9b299ef6e`.
The existing checker was 1,366 lines by newline splitting; this minimal patch
adds two physical lines and does not restructure the legacy file.

## Validation boundary and continuation

No application runtime, tests, lint, build, git, or network commands were run by
this author. Static inspection and SHA-256 reads are the only checks performed.
No current production-build size or real-build overage is claimed; the receipt
above uses a synthetic built asset graph.

Root next: run the frozen focused regression, obtain an independent native
review, and later measure a fresh real build. Full project validation and
progress/session integration remain root-owned. Do not treat this handoff as
passing GREEN or slice acceptance evidence.
