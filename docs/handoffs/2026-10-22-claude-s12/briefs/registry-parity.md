# Lane `claude_s12_registry_parity` — P2-S12-AC-275 route registry / Hono / OpenAPI parity

Read `docs/handoffs/2026-10-14-claude-s12/lane-rules.md` fully first; it binds you. Start EVERY shell command with
`cd /home/rob/.codex/worktrees/phase2-slice12/WeJammin &&`. Toolchain `PATH=/home/rob/.local/share/wejammin-toolchain/bin:$PATH`.
Report: `docs/handoffs/2026-10-22-claude-s12/lane-registry-parity-report.md` (checkpoint early; keep `## Status` current).
No database runs are needed.

## Criterion (P2-S12-AC-275, `.memory/wiki/specs/phases/phase-2.md`)

"CI matches the discovered Hono routes and the generated OpenAPI to every Slice 12 browser operation ID (CMS-03C-01 to
CMS-03C-17 and the five supporting reads) on method and path, request, success and error schemas, auth, CORS, rate, timeout,
cache, idempotency, ETag and SLO, and CMS-03C-18 to CMS-03C-21 are absent from the browser route inventory and generated
OpenAPI." Spec: BE03c (`.memory/wiki/specs/be/03c-composition-taxonomy-localization.md`) "Route Registry" endpoint table
(rows ~160-190: every `CMS-03C-NN` and the supporting reads — `cmsTemplateLatestRead`, `cmsPatternLatestRead`,
`cmsTaxonomyVersionsRead`, `cmsTaxonomyTermsRead`, `cmsGovernedReviewRead`/list, plus the later DEC-195/205/206 reads
`cmsRelatedContentRead`, `cmsLocaleVariantRead`, `cmsCompositionInstancesRead` — enumerate them from the table, do not trust
this list), "Internal service operations" (CMS-03C-18..21 are internal), "Contract and route tests".

## Precedent (copy its shape)

`tests/contracts/phase-02-slice-11-editorial-registry-openapi.test.ts` (Slice 11 registry ↔ OpenAPI ↔ Hono parity) and the
Slice 12 OpenAPI tests already present (`tests/contracts/phase-02-slice-12-*-openapi.test.ts`,
`phase-02-slice-12-openapi.test-support.ts`). Find how the Worker exposes its Hono route inventory (search
`apps/worker/src` for the composition/editorial route registries and any existing "discovered routes" helper) and how the
platform operation registry stores rate/timeout/cache/SLO per operation (`packages/contracts/src/**/registry*`).

## Work (tests are the spec; RED first where behaviour is missing)

1. Enumerate the BE03c browser operations from the endpoint table into a typed fixture (operation id, method, path, auth,
   CORS, rate user/party, timeout, cache, idempotency/If-Match, ETag, SLO tier/p95) with a comment citing each row.
2. One test file `tests/contracts/phase-02-slice-12-registry-parity.test.ts` (split at 400 lines) asserting, per operation:
   the platform registry row equals the fixture; the generated OpenAPI path/method exist with request, success and error
   schemas referencing the contracts schemas; the Hono app actually mounts that method+path (discover it from the real
   Worker app, not a hand list); and CMS-03C-18..21 appear in none of the three browser inventories. Title tests with
   `[P2-S12-AC-275]`.
3. Run it. Every mismatch is either a genuine defect (registry/route/OpenAPI wrong vs BE03c) or a spec gap. Fix genuine
   defects ONLY in registry/route wiring files you name in the report first (contracts registry rows, Worker route mount,
   OpenAPI generation input) with `node infra/generate-openapi.mjs --check` passing after `pnpm contracts:generate` if needed.
   A BE03c-vs-code contradiction where you cannot tell which is right → BOUNDARY with both lines cited; never edit specs.
4. Do not touch ledgers or receipts; list in the report which AC-275 clauses your tests prove (root re-cites).

## Claim

NEW `tests/contracts/phase-02-slice-12-registry-parity*.ts`; registry/route/OpenAPI-input files only as named in the report
before editing. Live lanes (never touch): `claude_s12_squash` (dec193/pattern-updates/fix-dec193/block-rules SQL + tests),
`claude_s12_dec208_obs` (dec208 SQL, locale_observability tests, `apps/worker/src/cms-composition/locale-observability*`),
read-only reviewer V4.

Final message to root: GREEN / PARTIAL / BLOCKED, report path + SHA-256, Vitest counts, files with SHA-256, defects fixed,
BOUNDARY items, AC-275 clause coverage, requests to root.
