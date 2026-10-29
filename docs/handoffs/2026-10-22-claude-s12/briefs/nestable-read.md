# Lane `claude_s12_nestable_read` — `cmsPatternNestableRead` and the designer's nested-pattern picker (DEC-196 / DEC-232)

Read `docs/handoffs/2026-10-14-claude-s12/lane-rules.md` fully first; it binds you (ALT pgTAP through the staged runner
only; tar-backup every untracked file before editing it). Start EVERY shell command with
`cd /home/rob/.codex/worktrees/phase2-slice12/WeJammin &&` (HEAD the latest root commit). Toolchain
`PATH=/home/rob/.local/share/wejammin-toolchain/bin:$PATH`. zsh does not word-split. `/bin/ls`, never bare `ls`. Report:
`docs/handoffs/2026-10-22-claude-s12/lane-nestable-read-report.md` (Bash heredoc if Write refuses).

## Spec (written by root 2026-10-27; cite lines, never edit specs)

BE03c `.memory/wiki/specs/be/03c-composition-taxonomy-localization.md`, every `cmsPatternNestableRead` site (grep it):
interaction map, Route Registry row (designer-only; active versions of the owner whose `compatibleTypeIds` contains EVERY
requested type; keyset cursor `(patternKey ASC, patternVersion DESC)` bound to route, type set, sort and acting context;
limit 1–50 default 25; 300/600 per minute; 8,000 ms; no-store; Tier 1; ETag on page version), field matrix (repeated
`contentTypeId` 1–64 unique UUIDs of the owner scope, hidden/absent → policy-safe 404; strict query), schemas
(`PatternNestableQuery`, `PatternSelectorPage`), the CMS-03C-13 paragraph (the read never lists what the save would refuse
`nested_pattern_not_active` for that type set; it does not exclude the lineage being edited), error matrix and the
composition catalog row, authority row, RPC inventory (`cms_list_pattern_nestable`). FE03
`.memory/wiki/specs/fe/03-cms-content-modeling.md` `CmsPatternVersionDesigner` row (nested nodes from
`CmsPatternNestedPicker` over this read with the version's `compatibleTypeIds`). Criterion P2-S12-AC-105 clause "nested
pattern nodes from `CmsPatternNestedPicker` over the designer-only `cmsPatternNestableRead` (DEC-196)" and AC-275 (registry
parity: the read must appear in the registry, the Hono routes and the generated OpenAPI).

## Precedent

CMS-03C-13 end to end (grep `cms_list_pattern_selector`, `pattern-selector` in `supabase/`, `packages/contracts/src/`,
`apps/worker/src/`, `apps/web/src/`): its SQL read + `platform_api` wrapper, contracts registry row and OpenAPI, Worker
route, production adapter and admission, web server proxy and `CmsPatternSelector`. Follow it layer by layer.

## Layers (RED first at each)

1. SQL in NEW WIP `supabase/migrations-wip/nestable-read/` (timestamps `20261027100000`–`109999`): the private read + the
   `platform_api` wrapper (definer ownership, `search_path = ''`, grants: the Worker's service role only, `app.cms_rpc`
   set/restore). pgTAP NEW `supabase/tests/phase_02_slice_12_nestable_read.sql`: designer-only (author/editor refused),
   every-type compatibility both ways (a version listing all requested types is listed; one missing a type is not),
   drafts/retired/other-owner never listed, cursor binding (type set, sort, actor), bounds, a hidden type is 404, a
   context-cleared real-role call with a negative control (PAT-031), and the S09 inventory pins for the new names.
2. Contracts: query/page schemas, the platform registry row (rates, timeout, tier, cache), generated OpenAPI
   (`pnpm contracts:generate`, then `node infra/generate-openapi.mjs --check`), and the registry-parity fixture
   (`tests/contracts/phase-02-slice-12-registry-parity-*.ts`) — `tests/contracts/phase-02-slice-12-registry-parity.test.ts`
   fails RED today ("lists exactly CMS-03C-01 to CMS-03C-17 and the eight named supporting reads"): make it list nine.
3. Worker: route, admission (BE00 order), production adapter with the real token forms (DEC-226 rule 4), tests.
4. Web: server proxy and `CmsPatternNestedPicker` (replace the BOUNDARY placeholder; update exactly the pinned expectations
   of `tests/contracts/phase-02-slice-12-closeout.test.ts` and name it as a test correction), wired into
   `CmsPatternVersionDesigner` with the version's `compatibleTypeIds`; component tests (loading/empty/failed/retry, keyboard).
   Measure the pattern designer route bundle before/after (`pnpm build && pnpm bundle:check` is allowed); keep it in budget.
   Name any real-route Playwright spec for root to run.

## Claim

NEW `supabase/migrations-wip/nestable-read/`, NEW `phase_02_slice_12_nestable_read*`, the contracts/registry/OpenAPI files,
Worker and web files of this read and the picker (name each in the report before editing), the registry-parity fixture
files, the closeout test expectations. Never edit promoted migrations, ledgers, receipts, trackers or specs. Live:
`claude_s12_gaps_db2`, `claude_s12_placement_perf` (`cms_insert_pattern_instance`), review V12.

Final message to root: GREEN / PARTIAL / BLOCKED, report path + SHA-256, counts, bundle before/after, files with SHA-256,
BOUNDARY items, the AC clauses your tests prove, requests to root.
