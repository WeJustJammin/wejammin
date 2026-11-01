# Lane brief — `claude_s12_governed_worker` (Worker transport for governed reviews)

Build the Worker HTTP transport for CMS-03C-06 POST /api/v1/cms/governed-reviews (submit) now, test-first,
against its existing SQL boundary `platform_api.cms_submit_governed_review(p_request jsonb)`
(`supabase/migrations/20261013300810_cms_submit_governed_review_public.sql`, private producer
`20261013300800`/`300820`). Its pgTAP suite passed 60/60 on 2026-10-14. CMS-03C-07/08/10/11 transport
follows in a second phase of this lane ONLY after root adds their SQL boundary (from lane `governed-a`'s
`## RPC boundary` section) to this brief; do not guess those RPCs. CMS-03C-09 is out of scope.

## Your files (exclusive)
- New: `apps/worker/src/cms-composition/governed-review-*.ts` (routes, ports, response mapping, tests,
  test support) and `apps/worker/src/cms-composition-production-governed-review*.ts` (production RPC
  adapter + tests). Keep each file ≤300 physical lines.
- Shared integration files, exclusively yours while this lane runs (no other lane edits them now):
  `apps/worker/src/worker-route-composition.ts`, `apps/worker/src/production-worker-runtime-cms.ts`,
  `apps/worker/src/production-worker-runtime.ts`, `apps/worker/src/worker-types.ts`,
  `apps/worker/src/cms-editorial-production-types.ts`,
  `apps/worker/src/cms-editorial-production-boundary-types.ts`. Change them only to register/wire the
  governed routes and ports; preserve every existing export, alias, constant, RPC mapping, operation
  ID, deadline and rate-map entry. Keep each ≤300 lines (production-types is 289 — extract if needed).
- Report: `docs/handoffs/2026-10-14-claude-s12/lane-governed-worker-report.md`.
Frozen: `packages/contracts/**`, OpenAPI generation, Web, SQL, configs, lockfiles.

## Read before designing
1. BE03c `.memory/wiki/specs/be/03c-composition-taxonomy-localization.md`: Route Registry row
   CMS-03C-06 (~168), Registry invariants (If-Match operands: 06 has NO If-Match; it names the exact
   subject version by id and hash; key required; no step-up), error catalog, Middleware & Policies,
   Testing Strategy "Contract and route tests".
2. Contract: `packages/contracts/src/cms-composition/governed-review.ts` (+ test) and the registry row at
   `packages/contracts/src/platform-registries.ts:1957` (rate, timeout, capabilities any_of designer/curator).
3. The closest precedent, built and independently reviewed on 2026-10-13: the pattern-definition
   transport — `apps/worker/src/cms-composition/pattern-definition-{routes,ports,response,latest-routes}.ts`,
   `apps/worker/src/cms-composition-production-pattern-definition*.ts`, their tests and support files,
   and `docs/handoffs/2026-10-12-claude-s12/lane-native-pattern-transport-red-report.md` and
   `lane-native-worker-integration-report.md`. Copy its structure: admission (strict JSON, 262,144-byte
   request cap, unknown fields, headers), verified session + original Request proof, provider
   identity/capability refresh, RPC call, response parsing with response-size budget, error mapping
   (provider 500/502/503/504 → 503 DEPENDENCY_UNAVAILABLE; explicit INTERNAL_ERROR and recognized tokens
   keep their contract mapping; malformed/oversized response → local 502; deadline abort → local 504),
   idempotency-key handling, rate operation registration.
4. The SQL producer's request JSON and error tokens: read `20261013300800` and `300820` for the exact
   `p_request` keys it reads and every `raise exception` token/DETAIL it emits; the 60-case suite
   `supabase/tests/phase_02_slice_12_governed_submit.sql` + dir shows real request bodies.

## Method
Contract-first RED: Vitest route/admission/production-adapter tests for every clause of the CMS-03C-06
registry row and every SQL refusal token → exact HTTP status + ApiError `code` + `details`; 403 vs 404
concealment; idempotent replay; no If-Match accepted; 201 strict `GovernedReviewResource` parsed with the
frozen schema. Run focused tests with
`cd /home/rob/.codex/worktrees/phase2-slice12/WeJammin && PATH=/home/rob/.local/share/wejammin-toolchain/bin:$PATH pnpm --filter @wejammin/worker exec vitest run <files>`
(check the actual package name in `apps/worker/package.json`), under the shared quiet lock:
`flock -s /tmp/wejammin-quiet.lock <command>`. See it fail, implement, see it pass, refactor. Then run
Worker typecheck and lint for touched files (find the scripts in `apps/worker/package.json`; no full
`pnpm validate`). Re-run the existing 345-test pattern/taxonomy joint set after you touch shared files
to prove no regression; record counts.

## Done
Phase 1: CMS-03C-06 transport GREEN with focused + regression counts, typecheck/lint clean on touched
files, ≤300 lines each. Report: files (path/lines/SHA-256), runs with counts, status/code mapping table,
remaining items. Then stop and report; root releases phase 2 (07/08/10/11) separately.
