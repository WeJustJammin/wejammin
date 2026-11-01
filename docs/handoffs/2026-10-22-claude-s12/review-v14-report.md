# Review V14 report (claude_s12_review_v14)

Independent adversarial review of the `placement-perf` and `nestable-read` WIP migrations and the nestable-read contracts, Worker and web
changes. Reviewer did not author any of it. Read-only except this file. Brief:
`docs/handoffs/2026-10-22-claude-s12/briefs/review-v14-placement-perf-nestable.md`. Rules: `docs/handoffs/2026-10-14-claude-s12/lane-rules.md`.

## Status

COMPLETE (first pass 2026-10-28 00:08 to 00:55 EDT). **Verification pass 2026-10-28 19:42 to 20:05 EDT: see `## Verification` at the end; it supersedes the nestable-read verdict in the table below (now PROMOTE-WITH-CONDITIONS with one mechanical condition, V14-19); placement-perf stays PROMOTE.**
HEAD `cd89d54cc84403e32699666c8d3710f45bbffce0` on `claude/phase2-slice12` (lane-rules text says b16edb54; the worktree is at cd89d54c; noted only).
Scratch: `/tmp/claude-1000/-home-rob-Projects-WeJammin/2663dcb2-f742-450b-97cd-0e849cede6cc/scratchpad/review-v14/` (scripts, logs).
Date of review: 2026-10-28, 00:08 to 00:55 EDT.

### Verdicts

| WIP dir | Verdict | Why |
|---|---|---|
| `supabase/migrations-wip/placement-perf/` (5 migrations + 2 tests) | **PROMOTE** | Old bodies are byte-identical to the promoted sources (script-verified, three places each); every new body is semantically equivalent by line-by-line analysis; no lock, check, audit or grant changed; stacks cleanly with its sibling dirs (R2: three siblings, R3: all four). No BLOCKER or MAJOR. Eight MINOR/NIT items (pin strength, equivalence gaps, perf headroom) are recommended hardening, none blocks. |
| `supabase/migrations-wip/nestable-read/` (3 migrations) + the nestable contracts/Worker/web/tests | **PROMOTE-WITH-CONDITIONS** | SQL is correct and matches the CMS-03C-13 precedent in every security property; the stacked runs are green. Four MAJOR items would fail or weaken a gate the moment the lane is promoted: V14-01 (SEC-1 claim-gate manifest not updated), V14-02 (Worker 100% coverage gate fails on one uncovered line), V14-03 (a test correction weakens an inventory pin: REJECT that part), V14-04 (the reserved-key CHECK is re-added with no populated-table pre-check or witness). All four are small, test/manifest-only or 5-line edits. |

### Counts

18 findings: 0 BLOCKER, 4 MAJOR, 8 MINOR, 6 NIT; plus 1 cross-lane observation (X-1, resolved while I reviewed).
Test corrections: 14 listed by the lane (number 13 split into 13a and 13b) plus 9 unlisted additive ones: 23 ACCEPT, 1 REJECT (13b), see below.

## Scope and method

1. Read the brief, the lane rules, both lane reports (`lane-placement-perf-report.md`, `lane-nestable-read-report.md` incl. `## Follow-ups`), the five placement-perf
   and three nestable-read migrations, the two placement-perf tests, the whole nestable SQL suite (8 include files), the contracts, OpenAPI, Worker route/query/adapter/failure mapping,
   web proxy/Astro route/browser read/hook/picker/designer wiring, the BE03c and FE03 spec sites, DEC-196 and DEC-232 raw records, and every test the lane changed.
2. Scripts (kept in the scratch dir): `verbatim.mjs` (old bodies vs promoted sources), `overlap.mjs` (functions patched by more than one WIP dir),
   `hashes.mjs` (lane report SHA-256 tables vs disk).
3. Runs: ALT staged pgTAP (combined stacks), focused Vitest, Vitest coverage on the changed Worker/contracts files, eslint/prettier, `verify-bundle-budget.mjs`.
   No canonical db, race, Playwright or `pnpm validate` run. No file outside this report was written (the runner writes its own `.lane-logs/`).

### Runs

| # | When (EDT) | What | Result | Artifact | SHA-256 |
|---|---|---|---|---|---|
| R1 | 00:13:44 | ALT staged, lanes `taxonomy-integrity,gaps-db2,node-pointers,placement-perf,nestable-read`, 17 files | HARNESS-level abort at reset: `gaps-db2/20261024130000` failed (`mismatched parentheses at or near ")"`, SQLSTATE 42601). Not feature RED, not mine; see X-1. | `scratchpad/review-v14/stacked-run-1-gaps-db2-reset-failed.out` | n/a |
| R2 | 00:14:55 to 00:18:07 | ALT staged, four lanes (without gaps-db2), 17 files: nestable_read, pattern_definition, gaps_node_pointers, placement_perf_equivalence, placement_perf_effective_state, pattern_placement, gaps_perf_patterns (bench), block_rules, block_rules_legacy, r8_api_surface, gaps_rpc_inventory, helpers_effective_state, composition_instance_guards, dec193_selected_roots, pattern_selector, e2_adoption, e2_composition_guard | PASS: 17 files, 3,780 tests, 0 not ok, exit 0, 137 s | `.lane-logs/alt-staged-taxonomy-integrity+node-pointers+placement-perf+nestable-read-001455-604789.tap` | `326b59e116b0333d9880c4bb3f54110ff6762d86ef1fa4c3638050bdb3b14830` |
| R3 | 00:42:53 to 00:45 | ALT staged, ALL FIVE lanes (23 WIP migrations on 543 promoted; gaps-db2 fixed by then), 12 files: nestable_read 207, pattern_definition 343, gaps_node_pointers 122, placement_perf_equivalence 50, placement_perf_effective_state 16, pattern_placement 715, gaps_perf_patterns 44, r8_api_surface 14, gaps_rpc_inventory 15, gaps_lock_conversion 62, gaps_governed_basis 52, pattern_updates 1,490 | PASS: 12 files, 3,130 tests, 0 not ok, exit 0, 124 s | `.lane-logs/alt-staged-taxonomy-integrity+gaps-db2+node-pointers+placement-perf+nestable-read-003945-663917.tap` (manifest `...663917.manifest` `9b80e8ae96818bfa9b7b80ea50c9c922ff2054fac595b106bcdf860ed48ee0cf`) | `1eaff9ec710cad2e7e89d8ddc32f64eee852546f0913dbeae2b579a286986a21` |
| V1 | 00:20 | Vitest focused (58 files): contracts nestable/key-grammar/pattern-version/refusals/catalog/registries/core, Worker nestable query/routes/adapter/registry/order/runtime/definition, web proxy/route/designer dir/step-up, tests/contracts parity (5 files), pattern-openapi, closeout | PASS 58 files, 1,253 tests | `review-v14/vitest-focused.log` | n/a |
| V2 | 00:36 | Vitest with coverage on the 14 changed Worker/contracts production files, over 219 test files | tests PASS (4,352), COVERAGE FAILS the 100% threshold: see V14-02 | `review-v14/vitest-coverage2.log` | n/a |
| V3 | 00:40 | Vitest `tests/performance tests/security tests/accessibility` | PASS 51 files, 416 tests | `review-v14/vitest-perf-sec.log` | n/a |
| L1 | 00:38 | eslint `--max-warnings=0` and `prettier --check` on the lane's 68 files | clean | n/a | n/a |
| B1 | 00:19 | `node scripts/verify-bundle-budget.mjs` on the dist built 00:16 (contains the nestable code) | exit 0, `passed: true`; see V14-08 | `review-v14/bundle-now.log` | n/a |
| T1 | 00:52 | `tsc --noEmit` (contracts, worker) and `astro check` (web, 2,311 files) | exit 0 / exit 0 / 0 errors, 0 warnings | `review-v14/tsc-*.log`, `astro-check.log` | n/a |
| O1 | 00:50 | `node infra/generate-openapi.mjs --check` | exit 0 (checked-in `docs/openapi/openapi.json` equals the generated one) | n/a | n/a |

Lane report integrity: every row of both lane reports' file tables was re-hashed against disk: placement-perf 8/8 equal, nestable-read 94/94 equal (no drift since the reports).

## Findings

Severity: BLOCKER = promotion wrong or unsafe; MAJOR = a gate or rule fails or is weakened on promotion, fix with the promotion; MINOR = recommended hardening; NIT = cosmetic.

### MAJOR

**V14-01 MAJOR (nestable-read): the SEC-1 real-PostgREST claim gate is not updated; it will report drift on the first canonical run after promotion.**
Evidence: `platform_api.cms_list_pattern_nestable` is a claim-reading service-role wrapper (`20261027100000_cms_list_pattern_nestable.sql:62` `v_actor_id := platform_private.cms_actor(p_request)`, exactly like the selector).
`tests/postgrest/support/claim-gate-manifest.ts` lists every sibling (`:119` cms_list_composition_instances, `:121` cms_list_pattern_selector, and the actor family at `:270`, `:272`), but `grep cms_list_pattern_nestable tests/postgrest` finds nothing.
`tests/postgrest/claim-gate-manifest.apispec.ts` "lists every claim-reading platform_api function and no other" via `manifestDrift` (`tests/postgrest/support/claim-gate-check.ts:44-117`, a name-reachability oracle that finds the new wrapper through `cms_actor`) and every manifest entry needs a `CLAIM_ACTOR_FAMILY` entry and a fixture (`claim-gate-fixtures-composition.ts:123-126` is the selector's).
`docs/handoffs/2026-10-22-claude-s12/lane-sec1-manifest-report.md` records the same failure for 21 earlier functions in the canonical run. The lane brief's precedent grep omitted `tests/postgrest/`, which is why this was missed.
Fix: add `cms_list_pattern_nestable: 'service-role'` to `CLAIM_GATED_API_FUNCTIONS`, `'cms_list_pattern_nestable'` to the `cfg-actor` family list, and a fixture `cms_list_pattern_nestable: { request: { contentTypeId: [id(1)] }, real: NOT_FOUND }` in `claim-gate-fixtures-composition.ts`. Run `claim-gate-manifest.apispec.ts` and `claim-gate-mutation.apispec.ts` in the canonical `db:api-test`.

**V14-02 MAJOR (nestable-read): the Worker 100% coverage gate fails on one uncovered line.**
Evidence: `vitest.config.ts:64-78` (coverage include and thresholds) requires 100% statements, branches, functions and lines over `apps/worker/src/**`. Coverage run V2 (219 test files, 4,352 tests, 14 changed production files):
`apps/worker/src/cms-composition-production-pattern-update.ts` 98.14% statements, 98.52% branches, 97.95% lines, uncovered line **124**: `return failure(400);` in
`readNestable` (`:121-124`, the `input.operationId !== 'cmsPatternNestableRead' || !query.success` guard). The identical guard of `readSelector` is tested at
`cms-composition-production-pattern-update-apply.test.ts:293-303`; the lane's `cms-composition-production-pattern-nestable.test.ts` has no such case. All 13 other changed files are at 100%.
The lane ran plain `vitest run`, never `--coverage`, so `pnpm validate` (`test:coverage`) fails.
Fix: add a test calling `dependencies.readNestable` with a wrong `operationId` and with a query that fails `PatternNestableQuerySchema` (65 types / limit 0), expecting `{ ok: false, status: 400 }` and no RPC call. Consider extracting the body shared with `readSelector` (V14-07).

**V14-03 MAJOR (nestable-read): test correction 13b weakens an inventory pin. REJECT that part.**
Evidence: `supabase/tests/phase_02_slice_12_gaps_rpc_inventory.sql:77-90`. The original asserted typed totals (33 wrappers, 35 bodies, 68 functions). The lane replaced them with recounts that compare the inventory rows to "the catalog functions whose names are in the inventory". That is satisfied by any inventory: delete a name from the list and both sides shrink together. The typed totals were the only completeness pin on the inventory's size (the other assertions prove existence and overload-freedom, not membership). Lane rules: "Change one only if it contradicts the spec ... keep the change minimal, never weaken".
The minimal correct change is the bump 33/35/68 to 34/36/70 plus the new name (13a, ACCEPT).
Fix: restore three typed `is(..., 34 / 36 / 70)` assertions with updated text; keep the name addition. (The count must follow the final set of names after the other lanes promote; compute it from the final inventory, do not make it self-referential.)

**V14-04 MAJOR (nestable-read): the reserved-key CHECK is re-added with no populated-table pre-check or witness.**
Evidence: `20261027100020_cms_pattern_key_reserved_nestable.sql:80-83` drops and re-adds `cms_pattern_versions_pattern_key_not_reserved` without `NOT VALID`, which scans every stored row under ACCESS EXCLUSIVE. If a stored pattern named `nestable` exists (the old list did not forbid it, CMS-03C-12 accepted it until this migration), the ALTER fails with a bare `23514` and rolls the whole migration back (atomic, fail-closed, but undiagnosable). The header (`:10-12`) asserts "none can exist" without evidence; the lane only ever ran `db reset` on an empty table. The repo's own convention for CHECKs on live tables is an explicit refusal naming the count (PAT-025 witness, `supabase/tests/phase_02_slice_12_pattern_definition/populated-lineage.sql`; and `20261013100000_cms_template_per_owner_keys_lineage.sql:93-123` adds the reserved-key CHECK `NOT VALID` and validates conditionally).
Answer to the brief's question: on a database holding no `nestable` row the re-added CHECK validates cleanly (proved on the reset DB, `convalidated = true`, test 060); on a populated database holding one it fails atomically; no populated witness exists and I could not run one (no `migration up` over seeded rows is permitted to a reviewer).
Likelihood is low (no seed, fixture or Playwright spec uses that key; I grepped supabase/, tests/, apps/), consequence is a failed hosted deploy.
Fix: before the ALTER, `select count(*) ... where pattern_key = 'nestable'` and raise `55000` "DEC-232 refused: N stored pattern version(s) hold the reserved key nestable" (so the operator gets an action), and add a pgTAP witness that seeds one such row on the old constraint, asserts the refusal leaves the table untouched, and that the migration passes once the row is gone. Alternatively run the same count on staging and production and record it in the promotion manifest as a deploy precondition.

### MINOR

**V14-05 MINOR: spec and decision-record drift for the DEC-232 consistency changes.**
BE03c still lists four reserved pattern keys in the schema block (`.memory/wiki/specs/be/03c-composition-taxonomy-localization.md:452` `ReservedPatternKeys = ['context','versions','selector','new']`) and in the persisted model (`:1611` `CHECK pattern_key NOT IN ('context','versions','selector','new') (E13)`), while `:407` and the code say five. The migration changes exactly that CHECK, so the spec line the SQL implements now contradicts it. The raw record `dec-232` (`.memory/raw/events/2026-10-27.jsonl`) records only the route cascade; the "read consistency" decisions (cursor faults all 400, bounds 422, `nestable` reserved) exist only as a spec changelog row (`:1921`), with no DEC id, although they alter two promoted function bodies and a storage constraint (memory-capture rule: non-trivial decisions with ripple effects get a raw record).
Fix (root): update `:452` and `:1611`; append a raw decision record (new DEC or an amendment) for the three consistency choices and compile only through `flushEntry`.

**V14-06 MINOR: every non-SQL seam of the nestable read is proven against stubs only.**
Worker production adapter tests use a fake PostgREST fetch, the web proxy a fake binding, the picker a fake `read`. No real-route Playwright spec exists for the designer (the lane says so) and V14-01 means no real-PostgREST fixture either. The E2E-mock lesson applies: the only real-stack proof is the pgTAP suite. The request shape `{ contentTypeId[], limit, cursor? }` the adapter sends matches what the SQL suite sends, and `%2B`/`%2F`/`%3D` cursor encoding survives the browser read and the proxy by construction (`pattern-nestable-read.ts:193-203`, `cms-pattern-nestable.ts:117-120`), so I found no defect, but nothing exercises the chain.
Fix: after V14-01, run the lane's suggested real-route spec (designer ticks two types, request returns a page, choose, add, save) once in the canonical Playwright wave.

**V14-07 MINOR: extensibility rule breaches.**
`apps/web/src/components/cms-pattern-designer/pattern-tree-state.ts` is 311 lines (HEAD 276; utilities/lib cap 300, `.claude/rules/extensibility.md`): move `NestedPatternChoice` and `newPatternNode` to a sibling module. `readNestable` (`cms-composition-production-pattern-update.ts:121-139`) is a copy of `readSelector` (`:102-120`) apart from schema and operation id ("no copy-paste patterns"): extract one helper taking `(schema, operationId)`.

**V14-08 MINOR: pattern edit route bundle headroom is 2.3%.**
Re-measured on the 00:16 dist (`bundle-now.log`): CMS pattern create initial 84,267 gzip bytes (budget 92,160, headroom 7,893); CMS pattern edit initial 90,073 (headroom 2,087); workbench 24,438 of 35,840. Matches the lane (84,275 and 89,885). The lane's observed `bundle:check` failure on the CMS entry editor (92,386) is gone on this dist (exit 0). Any later addition to the designer island will cross the edit-route budget; the picker, its hook, the browser read and the wiring together cost about 2,061 bytes.

**V14-09 MINOR: no performance evidence for the multi-type predicate.**
BE03c 184 sets Tier 1 p95 < 750 ms. `gaps_perf_patterns` benchmarks the selector (limit 50 of 65 versions) but not the nestable read. The predicate (`20261027100000:153-156`, `176-180`) is a double NOT EXISTS with `jsonb_array_elements_text` per required type per row, run twice (page and high-water). For 64 types over versions listing many types that is O(rows x 64 x 64) text compares per request. I expect single-digit to tens of ms at the current scale, but nothing measures it. Fix: add a nestable first page and cursor page (and a 64-type request) to the bench, or record the expected bound.

**V14-10 MINOR: the duplicated effective-state derivation is accepted, but its pin is narrow.** (Brief: "judge the pin".)
`20261024150200` copies the CASE of `cms_revision_effective_states` (`20261005017540:41-72`) into the single form; the documented "ONE derivation" is now two. Today the two are identical (I compared line by line: same published, scheduled, review-latest, ordering and NULL behaviour). The agreement test (`phase_02_slice_12_placement_perf_effective_state.sql:27-53`) covers 7 evidence shapes (approved, rejected, open, invalidated, pending schedule, publish row, none) plus absent/NULL; it does not cover the schedule-state lattice (executing, failed_retryable, blocked, cancelled, completed), the `unpublish` action filters on both evidence tables, review ordering and the id tie-break, or precedence (published over scheduled over approved). The S11 oracle `phase_02_slice_11_helpers_effective_state.sql` covers that full matrix, but only through the SINGLE form; the SET form is compared at 7 tags (`:270-274`). So a one-sided edit of the set form (for example adding a state to the scheduled list, the "single place a future stage is added") would pass both suites.
Judgement: ACCEPT the duplication (the 0.31 to 0.04 ms per call gain is measured and real); the pin is INSUFFICIENT as written.
Fix (test-only, can follow promotion): run the S11 matrix through both forms in the agreement test, and add a structural pin comparing the normalised text of the two `case ... end` expressions in `pg_proc.prosrc`; add a one-line note to the set form's `comment on function` that the single form mirrors it.

**V14-11 MINOR: the equivalence suite has gaps at the exact boundaries the brief names.**
The old bodies ARE embedded verbatim (script-verified: the pg_temp copies and the WIP `old_source` equal the promoted bodies byte for byte) and compared on the same inputs, so the suite is not vacuous (random forests: 192 violating, 208 clean, all three reasons; 400 forests, avg 11 nodes). Not covered:
(a) position ceiling at the boundary: the only ceiling case has max position 2147483647 so every new root conflicts at once; the case max position 2147483646 (first new root placed at 2147483647, second CONFLICT) pins the `new_before` running count and the `least()` fix but is absent. By analysis the new body is right (first root v_next + 0, second v_next + 1 > ceiling).
(b) a repeated RETIRED path (`['/a','/a']`: both must get version 3 and position 3), and a retired head at version 2147483646 (placed at 2147483647);
(c) a non-root slot prefix with existing heads at the prefixed paths (only `/m` with no heads is tested);
(d) block rules: random forests are at most 14 nodes, chains at most 3 deep, no empty-string chain, double slash, trailing slash or multi-byte chain, no depth over 64, nothing at the 512-node scale where the rewrite actually changed the algorithm;
(e) the producer: the response equals the OLD projection only for a 3-root placement with 3 distinct content images, so the new dedupe join (`join hashed on hashed.content_text = imaged.content_image::text`, `20261024150400:81`) is never compared with the old projection when several rows share an image, which is the case it was written for (the 512-row bench only asserts success).
By analysis every one of these is equivalent; the point is that the suite would not catch a regression there.
Fix: add (a)-(c) as two-line cases, a 200-to-512-node seeded forest comparison, and a placement of N identical-content roots asserting N items and each contentHash equal to the old projection.

**V14-12 MINOR: measured 512-row headroom is thinner than the lane states.**
Lane: p95 225 ms on a busy host, "25% headroom". Re-measured with the bench (`gaps_perf_patterns`, n=24) twice: R2 place512 p50 174.9, p95 266.8, max 290.8 ms (11% under 300); R3 p50 186.8, p95 206.6, max 233.1 (31% under). pat_create_512 p95 224.4 and 214.2 (lane 233); place32 p50 18.4 and 13.7. The improvement is real (from 661 to 990 ms before), but p95 under n=24 tracks the tail and was 267 ms once on a quiet host (load about 1) with other lanes active; the #41 assertion (p95 < 300) can flake on a loaded canonical host. Not a defect of the migrations. Root: run the canonical bench on a quiet host, and do not read 225 ms as the expected p95.

### NIT

**V14-13 NIT:** the cursor `queryHash` binds route, actor, party, the sorted type set and limit but no explicit sort token (`20261027100000:93-96`); BE03c 184 says "bound to the route, the requested type set, the sort and ...". The sort is a constant of the route so nothing can differ today; add `'sort', 'patternKey:asc,patternVersion:desc'` so a future sort change cannot continue an old cursor.
**V14-14 NIT:** the page and `pageVersion` are read by two statements under READ COMMITTED (`:143-162` then `:174-180`), so a concurrent activation can leave the ETag newer than the items; read the high-water first. Same as the CMS-03C-13 precedent.
**V14-15 NIT:** generated OpenAPI for `contentTypeId` has min/max items but no `uniqueItems: true` (the zod `.refine` is not exported), and the 200 `ETag` description reads "authorized job representation" (shared copy).
**V14-16 NIT (reporting):** the lane report's Status line says "Final SQL run: 191/191" (final is 207); and nine existing oracle files were edited to add `nestable` to reserved-key lists (key-grammar, pattern-version, cms-pattern-platform-write, cms-pattern-platform-latest, patterns-routes, load-pattern-designer-page, pattern-designer-request, pattern-definition-write, pattern-definition-latest) but are described only in `## Follow-ups (a)`, not under `## Test corrections` as the lane rules require. All nine are additive (ACCEPT). Also: the placement-perf README says every migration aborts unless the installed source equals the promoted source; `150400` checks anchors and the inverse, not the whole source (the lane report states this correctly).
**V14-17 NIT:** `cms_composition_instance_resource` now delegates to `cms_composition_instance_resource_hashed` (`20261024150300:65-68`), adding one nested SQL-function call (planned per outer call) for every other caller (instance list, update diff, apply). Output is identical (asserted); the added cost per projected row is unmeasured, small, and only matters for the 100-row list reads.
**V14-18 NIT:** the producer's inner join `hashed.content_text = imaged.content_image::text` would silently drop a row whose content image were NULL. `cms_composition_instance_content` is built from `jsonb_build_object ... ||` and cannot return NULL today (`20261016041200:13-21`); `is not distinct from` or a left join would make that independent of the callee.

### Cross-lane observation

**X-1 (resolved while I reviewed; for root's attention):** `supabase/migrations-wip/gaps-db2/20261024130000_cms_version_lifecycle_columns_governed_only.sql` (mtime 00:04:54) did not apply: line 31 held an `E'...'` string containing the unescaped apostrophe of "the table's own write guard", which ends the literal early; `supabase db reset` failed on exactly that migration with `mismatched parentheses at or near ")" (SQLSTATE 42601)` (run R1, log kept). The lane rewrote the sentence at 00:19:46 ("the write guard of the table", no apostrophe) and R3 then applied all 23 WIP migrations. Root should confirm the final bytes before promotion (R3 manifest hashes are in `.lane-logs/...663917.manifest`).

## Check list from the brief

### 1. placement-perf

| Check | Result |
|---|---|
| Equivalence suite compares the old bodies verbatim | Yes. `verbatim.mjs`: allocation 1748 bytes, block-rules 2691, resource 778, effective-state 114: WIP `old_source` == promoted body == pg_temp copy in `phase_02_slice_12_placement_perf_equivalence.sql:38-141`, IDENTICAL for all. The `_hashed` body equals the old resource body except the `contentHash` expression. |
| Adversarial inputs (position ceiling, collisions, nested roots, rule violations at every depth) | Partly: see V14-11 (boundary and scale gaps; no semantic difference found by analysis). |
| New allocation equals old | Analysed line by line: head selection (max version, id desc, revision-wide not slot-wide), CONFLICT conditions and detail, running `new_before` equals the old `v_next` increments, retired heads keep position at version + 1 (bigint, no overflow), non-root and malformed items pass through, `isRoot` coalesced, NULL root path treated as a new path. The `least()` guard preserves the 22003-before-CONFLICT ordering the lane's test caught. |
| New block-rules equals old | Parent = longest proper `/`-prefix naming another node, ties lowest index: the `ancestors`/`picked` hash join reproduces `starts_with(chain, candidate.chain || '/')` ordered by `char_length desc, idx` (empty-string and trailing-slash chains included); explicit `parent` untouched; `bad` equals the old per-node `min(idx)` subselect including NULL block keys; `reach`, `totals`, limits unchanged. |
| Effective state | Same derivation, same first-match order, NULL for absent/NULL id, same attributes (STABLE, SECURITY DEFINER, owner, search_path, ACL, comment, `procost`) asserted by the pg_proc image comparison. See V14-10 for the pin. |
| Producer patch | Three anchored replacements, each anchor once, inverse restores the installed source byte for byte, pg_proc image equal except `prosrc`: override map aggregated once (`left join override_by_root`, NULL root never matches, `{}` default), `hashed as materialized` content hashing once per distinct image text, final projection through `_hashed`. Locks (FOR SHARE/UPDATE order), idempotency, audit, outbox, CAS, review invalidation, response and grants untouched; the admission guard still fires per inserted row. |
| No grant change | New `_hashed`: SECURITY DEFINER, owner `wejammin_cms_definer`, `search_path = ''`, revoked from public/anon/authenticated/service_role (asserted in the suite and in `r8_api_surface`/`gaps_rpc_inventory`, both green in R2 and R3). |
| Behavioural regression | `pattern_placement` 715, `dec193_selected_roots` 1,203, `pattern_updates` 1,490, `block_rules` 124, `block_rules_legacy` 559, `composition_instance_guards`, S11 `helpers_effective_state` 44, `e2_adoption`, `e2_composition_guard`: all green in the stacks. |

### 2. nestable-read

| Check | Result |
|---|---|
| Spec conformity (BE03c 92, 184, 407, 413, 1194, 1427, 1457, 1528, 1633, 1665, 1920-1921; FE03 886, 2905) | Conforms: designer-only, owner-scoped, active versions only, every requested type (case-insensitive, same comparison as the save's `nested_pattern_not_active`, `20261014020400:186-205`), order (patternKey bytewise, version DESC), limit 1-50 default 25, 300/600 per minute, 8,000 ms, Tier 1, no-store, ETag = pageVersion, error matrix `[400,401,403,404,415,422,429,500,502,503,504]`, cursor faults all 400, bounds 422, hidden/absent type 404 for the whole request, strict query, DEC-181 rule, lineage not excluded. The only spec defects are V14-05. |
| Security | Reader SECURITY DEFINER, `search_path = ''`, owner `wejammin_cms_definer`, EXECUTE revoked from public/anon/authenticated/service_role; `_signed` the same; `platform_api` wrapper `service_role` only, `grant usage on schema platform_api to service_role`, not in `public_api`; ownership and ACL equal to the CMS-03C-13 pair (suite 010 asserts it); `app.cms_rpc` set by the reader and restored by the wrapper to the caller's value (suite 040: cleared stays cleared, a sentinel survives); PAT-031: context-cleared real `service_role` call, sentinel call and a negative control that the same role cannot read the table directly (040:55-83), plus real `anon`/`authenticated` 42501. BE00 order verified in code and in 030 (validation before concealment before capability before type 404 before cursor binding; anonymous 401 first). Owner scope: every row filtered `owner_id = v_party_id`, the acting party being the one proved visible and capability-checked; another organization's type is NOT_FOUND for the whole request; a member of another organization is `capability_missing` in its own party. No other-owner pattern can be listed. Capability re-proved on every call (revoked designer refused, 040). |
| Cursor binding | Signed (Vault, domain `cms-03c-nestable`), bound to route, actor, acting party, the SORTED type SET (order irrelevant, tested; a subset is refused), limit; 24 h; tamper, expiry, cross-set, cross-limit, cross-actor, another operation's cursor and every malformed shape are 400 (020). `_signed` maps the helper's CONFLICT to INVALID_REQUEST only around the open call. See V14-13 (sort token). |
| Every-type compatibility both ways | 010: a version listing all requested types (including extras) is listed, one missing any is not (two-type, three-type, single-type, T1+T3 combinations), superseded/draft/retired never listed, empty page for a real type nobody lists, `t12 == t21`, the listed set equals an independently built oracle from the CMS-03C-12 responses. |
| Reserved key (DEC-232) | Five enforcement points consistent: contracts `CMS_RESERVED_PATTERN_KEYS`, web mirror (drift-tested), SQL `cms_create_pattern_version` and `cms_pattern_latest` (one-line anchored patches, inverse and pg_proc image checks), storage CHECK. Composes with node-pointers (anchors disjoint, timestamps order node-pointers 140100 < nestable 100020; applied and tested in R2 and R3). Populated data: V14-04. |
| Contracts, OpenAPI, parity | `PatternNestableQuerySchema` strict, 1-64 unique UUIDs, cursor <= 512, limit 1-50; registry row Tier 1 / 8,000 ms / 300 / 600 / no-store / designer; error catalog, refusal allowlist `['capability_missing']`; OpenAPI regenerated and `--check` clean (lane); parity fixture lists nine supporting reads and the parity, Hono, worker-policy and rate tests pass (V1). |
| Worker | Route registered before `:patternKey` (precedence test `production-worker-runtime-pattern-update.test.ts`), query admission mirrors the SQL grammar and statuses, capability from the operation table (author/editor alone is 403 and consumes no quota), user then party quota, ETag `"pageVersion"`, a port 409 is a contract failure (scrubbed 500), failure table has no CONFLICT row. Coverage: V14-02. |
| Web | Proxy repeats the allowlist, forwards session headers only, relays a 200 only as the strict page honouring the request with matching ETag, upstream 409 becomes local 502; browser read is zod-free and re-verifies page size, order, uniqueness, ETag, retries 502/503/504 twice (250/750 ms); hook cancels in-flight reads on a type change, restarts on a 400 cursor; picker: native select never preselected, disabled with a stated reason, loading after 250 ms, empty/failed/retry/load-more, restart note; designer passes the version's `compatibleTypeIds`; `newPatternNode` makes keys unique under the 64-char cap. FE03 886 and the AsyncState table are met. No TODO, FIXME, BOUNDARY or `any` in any new file. |
| Bundle | Pattern create 84,267 / pattern edit 90,073 gzip of 92,160: passes, see V14-08. |

### 3. Stacking

Only one function is patched by two dirs: `platform_private.cms_create_pattern_version` (node-pointers `20261024140100` anchors the four `raise exception` lines; nestable `20261027100020` anchors the reserved-key line). Disjoint anchors, node-pointers earlier; the combined runs R2 and R3 apply both and pass `pattern_definition` (343), `gaps_node_pointers` (122) and the nestable 060 reserved-key tests. No other function is patched by more than one of the five dirs (`overlap.mjs`). `cms_insert_pattern_instance` is patched only by placement-perf (the gaps-db2 wrapper amendments target other writers). Coupling for promotion: the edited `phase_02_slice_09_r8_api_surface.sql` and `phase_02_slice_12_gaps_rpc_inventory.sql` now REQUIRE `cms_list_pattern_nestable`, so promote nestable-read in the same step as, or before, any canonical `db:verify`.

## Test corrections (nestable-read): ACCEPT or REJECT

| # | File | Verdict | Note |
|---|---|---|---|
| 1 | `packages/contracts/src/cms-composition/error-catalog.test.ts` | ACCEPT | operation joins the composition list, 24 to 25; additive |
| 2 | `refusals-operations.test.ts` | ACCEPT | marker `P2-S12-AC-105`, allowlist `capability_missing`, 25 operations; additive |
| 3 | `packages/contracts/src/registries.test.ts` | ACCEPT | route-order list gains the id |
| 4 | `packages/contracts/src/core-contracts.test.ts` | ACCEPT | exported schema list gains `PatternNestableApiRequest` |
| 5 | parity fixture / reads / worker-bodies, parity and parity-openapi titles | ACCEPT | the brief's "make it list nine"; the fixture errors list is read against the amended matrix |
| 6 | `apps/worker/src/cms-composition/pattern-update-registry.test.ts` | ACCEPT | per-operation capability assertion is as strong for the four old operations (literal author/editor + any_of); the single-capability row skips `capabilityMode`, which is correct |
| 7 | `pattern-update-order.test.ts`, `production-worker-runtime-pattern-update.test.ts`, `pattern-update-routes.test-support.ts` | ACCEPT | required port added (type completeness); the runtime file also gains the precedence test |
| 8 | `CmsPatternVersionDesigner.test.tsx` | ACCEPT | "not available yet" becomes the new stated reason; still asserts the disabled select, the reason element and `aria-describedby` |
| 9 | `CmsPatternVersionDesigner.uncertain-boundaries.test.tsx`, `pattern-latest-read.cancellation.test.ts` | ACCEPT | inject `readNestable` so the counted global `fetch` keeps measuring only the latest-read retry |
| 10 | `tests/contracts/phase-02-slice-12-closeout.test.ts` | ACCEPT | diffed against the lane's backup: the pinned "only marker is the picker placeholder" test now asserts NO production `BOUNDARY:` marker (stronger); `trackingIssues` import dropped with it; passes (V1) |
| 11 | `apps/web/src/components/step-up-required.inventory.test.ts` | ACCEPT | picker and read file classified `NO_STEP_UP_ROW` (BE03c 184 step-up none) like their siblings |
| 12 | `tests/contracts/phase-02-slice-12-pattern-openapi.test.ts` | ACCEPT | path list gains `/patterns/nestable` |
| 13a | `phase_02_slice_09_r8_api_surface.sql`, `phase_02_slice_12_gaps_rpc_inventory.sql`: the new name | ACCEPT | one line each, classified like the selector |
| 13b | `phase_02_slice_12_gaps_rpc_inventory.sql`: typed totals 33/35/68 replaced by catalog recounts | **REJECT** | weakens the pin, V14-03 |
| 14 | DEC-232 409-not-applicable edits in the parity fixture, OpenAPI definitions, Worker/web tests | ACCEPT | follow the amended matrix (`BE03c:1427`) |
| U1-U9 | the nine reserved-key oracle files (V14-16) | ACCEPT | each only adds `'nestable'` to a list or a case; not listed under Test corrections but additive |

placement-perf made no test correction (verified: no existing test was edited; the two test files are new).

## Promotion checklist for root (derived from this review)

placement-perf: promote the five migrations in timestamp order with the two new test files; run the canonical bench `gaps_perf_patterns.sql` #41 on a quiet host and read p95 as 200 to 270 ms (V14-12); optional same-PR hardening V14-10 and V14-11.
nestable-read: (1) V14-01 manifest + family + fixture; (2) V14-02 coverage test; (3) V14-03 restore typed totals; (4) V14-04 pre-check and witness or a recorded precondition; (5) V14-05 spec lines 452/1611 and a decision record; (6) promote the three migrations, add the lane section to `supabase/migrations/README.md`, remove the WIP dir; (7) regenerate `packages/data-access/src/database.types.ts` (`pnpm db:types`; it names `cms_list_pattern_selector` today and will need the new RPC) and the S12 evidence receipts/ledger for AC-105, AC-261, AC-275 (changed and new tests alter hashes); (8) canonical gates `db:verify`, `test:coverage`, `db:api-test`, and the real-route spec of V14-06.

## Requests to root

1. Decide V14-03 (restore typed totals) and V14-04 (pre-check) before promoting `20261027100020`; the other two MAJOR items are mechanical.
2. Update BE03c `:452` and `:1611` and add the DEC record (V14-05).
3. Confirm gaps-db2 final bytes before promotion (X-1).
4. Nothing in this review required a spec edit by me; none was made.

## Files reviewed (SQL, SHA-256 as read and as staged in R2 and R3; all equal the lane report tables)

| Path | Lines | SHA-256 |
|---|---|---|
| `supabase/migrations-wip/placement-perf/20261024150000_cms_pattern_placement_path_allocation_set_based.sql` | 151 | `6926e14e9072b848f5c8805344292d7eff4b6ae20bb651e2b236c57830332b66` |
| `supabase/migrations-wip/placement-perf/20261024150100_cms_block_rules_violation_linear.sql` | 169 | `5917b0a4fcb1bbfadf74386d2c9c145f533b18ac115157e3f802d5e8ba4335eb` |
| `supabase/migrations-wip/placement-perf/20261024150200_cms_revision_effective_state_single_query.sql` | 92 | `72f006db7e5f73be2850afc90ad065d54a75e1b96cb1afdcaea049764ebb149e` |
| `supabase/migrations-wip/placement-perf/20261024150300_cms_composition_instance_resource_hashed.sql` | 101 | `bbcb29c99aff656a78af41de9e07c0bd7171754ddc239b4f8c797ad13589cd11` |
| `supabase/migrations-wip/placement-perf/20261024150400_cms_insert_pattern_instance_override_map_hashed_resources.sql` | 135 | `a76e634ca954474a09e626b254988f743c12fc4c864272fa3927a823647796f5` |
| `supabase/tests/phase_02_slice_12_placement_perf_equivalence.sql` | 375 | `11568e86fcb51e0cc35e77d4b5292fb61c3cb5f657963ca150ca67725e29981e` |
| `supabase/tests/phase_02_slice_12_placement_perf_effective_state.sql` | 56 | `df3b9f261ea27e7aad420a04fd31d3a8b806e736938e1d92bb0499b80d5961cf` |
| `supabase/migrations-wip/nestable-read/20261027100000_cms_list_pattern_nestable.sql` | 235 | `fa24838339564e247390ef33007492e6de3eedcc0ccdf8492e9872738acae235` |
| `supabase/migrations-wip/nestable-read/20261027100010_cms_list_pattern_nestable_public.sql` | 77 | `284bb36552d602d34f439dfbedaf8bcc3e512b2ffa4fecc22e621a7f6fb826d0` |
| `supabase/migrations-wip/nestable-read/20261027100020_cms_pattern_key_reserved_nestable.sql` | 93 | `f10b8240df57b4fc3e43d602fe4088c3db8cb9f255c37831e9ac1ccb9425a23a` |
| `supabase/tests/phase_02_slice_12_nestable_read.sql` + `phase_02_slice_12_nestable_read/000..060` (8 include files) | 36 + 556 | entry `5a67823276dc82a64aa8711fda4c169e48969c9353aa47c3ea80e25262d88545`; includes `b01af5a4`, `1e3eb633`, `9ebde7fa`, `b151fbbd`, `29760a05`, `876fd4d4`, `dd00ad58`, `ba658b4d` (prefixes, equal to the lane table) |
| `supabase/tests/phase_02_slice_12_gaps_rpc_inventory.sql` | 134 | `dc4a069b06ab5f8604d8d80f1684f46b06753b22ede2ea73dc05054817cc61ba` |
| `supabase/tests/phase_02_slice_09_r8_api_surface.sql` | 262 | `2f6ef5863920eb165d16a2a284204a6b060ed5fcbdfa8534ee8e1a99b9e52aa9` |
| `supabase/migrations-wip/node-pointers/20261024140100_cms_create_pattern_version_node_pointers.sql` (stacking partner) | 97 | `d6b778aff8e08b87a4409bf36a9018bf56be84decbb86c923b3ece66976e1801` |

The 94 TypeScript, OpenAPI, README and test files of the nestable-read table were re-hashed with `hashes.mjs` (94/94 equal); their line counts were not individually re-read except where cited above.

## Spec citations

BE03c (`.memory/wiki/specs/be/03c-composition-taxonomy-localization.md`): 75, 92, 184 (route row), 226, 407, 413 (validation row), 452, 1192-1198 (`PatternNestableQuery`), 1427 (error matrix), 1457 (composition catalog), 1528 (CMS-03C-13 / nestable paragraph), 1611, 1633 (RPC inventory), 1665 (authority), 1813 (RPC < 300 ms, AC-279), 1920-1921 (changelog: DEC-196 cascade, DEC-232 read consistency).
FE03 (`.memory/wiki/specs/fe/03-cms-content-modeling.md`): 886 (`CmsPatternVersionDesigner` row), 1040-1056 (AsyncState table), 2905 (changelog). Decisions: DEC-196 and DEC-232 raw records (`.memory/raw/events/2026-10-15.jsonl`, `2026-10-27.jsonl`), DEC-181 (nested-node rule), DEC-193, DEC-210, DEC-228 (node pointers), DEC-226 rule 4. Rules: `.claude/rules/extensibility.md`, `boundary-not-placeholder.md`, `tdd-contract-first.md`, `security-first.md`; memory PAT-025 (populated-table witness), PAT-031 (context-cleared real-role call).

## Open items (what I could not or did not do)

- No populated-database migration run (`supabase migration up` over seeded rows) for `20261027100020`: not permitted to a reviewer; V14-04 rests on reading and on the fresh-reset runs.
- No canonical `db:verify`, `db:api-test` (real PostgREST claim gate, V14-01), race, Playwright or `pnpm validate` run. V14-01 and V14-02 are established by reading the gate code and by a scoped coverage run, not by running the canonical gate.
- The bench was read twice (R2, R3), n = 24 each, on a shared host; both stayed under 300 ms (V14-12).
- Static checks I did run: `tsc --noEmit` in `packages/contracts` and `apps/worker` (exit 0), `astro check` in `apps/web` (2,311 files, 0 errors, 0 warnings, 211 pre-existing hints), eslint and prettier on the lane's 68 files, the OpenAPI `--check`, and 1,253 + 416 + 4,352 Vitest tests. Not run: the web unit suite as a whole (only the pattern-designer, proxy and route files), the full 27k-test run.
- No BOUNDARY items exist in either dir; none was added.

## Verification

Second pass, 2026-10-28 19:42 to 20:05 EDT, requested by root: verify (not fix) that the nestable-read lane closed the first-pass findings, against the current bytes.
Inputs read: `## V14 follow-ups` of `lane-nestable-read-report.md` (SHA-256 `e7e0b457ad54c3102c4eef054a0f4616faade75d6433b368dab01eac17e568a4`, matches the hash root named) and root's raw record **DEC-234**
(`.memory/raw/events/2026-10-28.jsonl`, id `dec-234`, canonicalId DEC-234). HEAD is still `cd89d54c`; nothing committed. The lane report's file table (99 rows) was re-hashed against disk: 99/99 equal, the six new or
renamed files are listed. The scratch logs named in the first-pass `Runs` table (`scratchpad/review-v14/*.log`) no longer exist (the scratchpad was reset between sessions); the two TAP files in `.lane-logs/` and their
recorded SHA-256 values do (re-hashed today, unchanged), and every number the verdicts rest on is repeated in this report.

### Verdict

| WIP dir | Verdict now | Why |
|---|---|---|
| `supabase/migrations-wip/nestable-read/` and the nestable contracts/Worker/web/tests | **PROMOTE-WITH-CONDITIONS** (one condition, mechanical, no re-review needed) | All four first-pass MAJOR conditions (V14-01 to V14-04) are CLOSED and independently reproduced, including the mutant the lane did not run. One NEW MAJOR remains: **V14-19**, `pnpm format:check` (inside `pnpm validate`) fails on two nestable Markdown files; I missed it in the first pass because the lane's lint list excluded Markdown and I mirrored it. Condition: run `prettier --write` on `supabase/tests/phase_02_slice_12_nestable_read/README.md` (it stays after promotion) and on `supabase/migrations-wip/nestable-read/README.md` (deleted at promotion, but inside the glob until then), then `pnpm format:check`. |
| `supabase/migrations-wip/placement-perf/` | **PROMOTE** (unchanged) | Not touched since the first pass: all 7 SQL files hash-equal to the first-pass table; it still composes (run V below passes its two suites in the current five-lane stack). V14-10, V14-11, V14-12, V14-17, V14-18 stay open as non-blocking hardening. |

### Runs and checks (all on the final bytes; inputs hashed before and after each staged run)

| # | What | Result | Artifact | SHA-256 |
|---|---|---|---|---|
| V | ALT staged, ALL FIVE lanes (24 WIP migrations on 543 promoted: taxonomy-integrity 9, gaps-db2 5 incl. the new `130400`, node-pointers 2, placement-perf 5, nestable-read 3), 8 files: nestable_read 207, **nestable_read_populated 27**, pattern_definition 343, gaps_node_pointers 122, r8_api_surface 14, **gaps_rpc_inventory 15 (typed 34/36/70)**, placement_perf_equivalence 50, placement_perf_effective_state 16. `governed_schedule_ladder` not run. | PASS: 8 files, 794 tests, 0 not ok, exit 0, 26 s | `.lane-logs/alt-staged-taxonomy-integrity+gaps-db2+node-pointers+placement-perf+nestable-read-194940-125693.tap` (manifest `...125693.manifest` `1471938d785fddabc0ac3a992cd49fc8c9521428a0ec55b4e579d1178c5168b3`) | `4669ff0cbc0e421654dcb77c2ddf39b23d96d1b641c4ae8b5d36504157843539` |
| M | ALT staged MUTANT stack (scratch lane `zz-v14-mutant`: verbatim copies of `100000` and `100010` plus a copy of `100020` with the pre-check removed; 543 promoted + 3 WIP), 2 files: the REAL witness and a scratch copy of the witness whose replayed DDL lacks the pre-check | real witness 27/27 PASS; mutant witness copy 24 ok, **3 not ok (17, 18, 21)**, pg_prove exit 1 (expected) | `.lane-logs/alt-staged-zz-v14-mutant-195125-132853.tap` (manifest `...132853.manifest` `803a6cdca4597d3601ac96478be1a9ba53349584e56c499d6e7ae5cb00d04272`) | `aa7557fa56958fce32a237ef63989bcfd64aec5f61d322cc3f9f897442914301` |
| P | The REAL parity test source (`phase-02-slice-12-nestable-reserved-witness-parity.test.ts`) against the real migration, then against the mutant migration (a Vite transform swaps only the migration path string; the test file is unmodified) | real: 3/3 pass; mutant: **2 of 3 fail** (witness region differs from the migration region; the whole-transform needles are missing) | n/a (inline below) | n/a |
| C | Narrow `--coverage` over the same 14 changed Worker/contracts production files as first pass, same 219 test files | 4,353 tests pass (4,352 + the new test); Statements **100%** (420/420), Branches **100%** (318/318), Functions 100% (78/78), Lines 100% (366/366); exit 0 | inline below | n/a |
| D | `readSelector` differential: the HEAD adapter (verbatim `git show HEAD:` copy, imports made absolute) vs the working-tree adapter with `pagedRead`, 33 scenarios through the real session resolver, RPC transport and page validator | identical `result` and identical outbound request for all 33; outcomes cover `ok` and 400, 403, 404, 409, 422, 500, 502, 503 | inline below | n/a |
| S | Scratch DB-free SEC-1 check (real manifest, family and fixture modules loaded through Vitest) | manifest 128 = family 128 = fixtures 128, no duplicate fixture; the 16 composition fixtures all expect `400:NOT_FOUND` | inline below | n/a |
| V1 | Vitest focused (68 files): parity test, contracts, Worker nestable/adapter/registry/runtime/definition, web proxy/route/designer dir (incl. `pattern-tree-nested.test.ts`), step-up inventory, five parity files, pattern-openapi, closeout | PASS 68 files, 1,527 tests | n/a | n/a |
| T | `tsc --noEmit` (worker); `astro check` (web, 2,313 files); `node infra/generate-openapi.mjs --check`; eslint `--max-warnings=0` on the lane's 73 TS files | exit 0; 0 errors, 0 warnings (211 pre-existing hints); exit 0; clean | n/a | n/a |
| B | `node scripts/verify-bundle-budget.mjs` on the dist built 19:48 | exit 0, `passed: true`; pattern create initial 84,275 gzip (headroom 7,885), **pattern edit 90,230 (headroom 1,930)**, workbench 24,446 of 35,840 | n/a | n/a |
| F | The repo's exact `format:check` file set | **exit 1**, three files: the two nestable READMEs and `migrations-wip/node-pointers/README.md` (V13's); see V14-19 | n/a | n/a |
| L | The lane's own run8 TAP | file exists, SHA-256 equals the lane's claim (`e851740e...e244`); 5 files, 606 tests PASS; its manifest lists the three migrations at today's SHA-256 values | `.lane-logs/alt-staged-nestable-read-005858-718689.tap` | `e851740e33a3ccbb1a3b25f0de4b4cd61de67c5127b8b813c7b14ba9d567e244` |

Files verified (SHA-256 now): `100000` `0721dc1115c20746e78d7295a1c2e3245aded0fbf2215811ba456b997d01edee` (236 lines; was `fa248383...`), `100010` `284bb36552d602d34f439dfbedaf8bcc3e512b2ffa4fecc22e621a7f6fb826d0` (unchanged),
`100020` `54ba1b2d277a7b4407c09e3f03fbf4296773af8bab35fb4ea02947e8f87ba01e` (116 lines; was `f10b8240...`), witness `supabase/tests/phase_02_slice_12_nestable_read_populated.sql` `2a99a300437edb8dc3368f8e8d76e5e269bc4665fd6555aa0199523fc1cd2d94` (148),
parity test `50404fb481a6b9d7eed8c618d7db47de9e6206af3cbf85b3ab45225b99a9b785` (70), `phase_02_slice_12_gaps_rpc_inventory.sql` `570066d3ec81107ea9d57106c16735bf8845fad8b79ac31602f8bae2c3f0a8e0` (129),
`claim-gate-manifest.ts` `d15708d4baa1467c8cb06d880fad2a2dc5aa34235044f5d928b1b3f0f92c62e6` (354), `claim-gate-fixtures-composition.ts` `226f00904f0094dcfbd0f9d3d5932a352e06b31d09a29d84248df6e032e3dc15` (159),
`cms-composition-production-pattern-update.ts` `60976e32952026c1885d1568885e50223ca0ef43c11f6635a7a89c3623ff5a9a` (231), `cms-composition-production-pattern-nestable.test.ts` `755b35db3203784fc665da4e20dd2a16e048697db22cea8543e879edeced63c7` (248),
`pattern-tree-nested.ts` `2fb0b0b72dc3b732d91b33fbbdf9310b39edd5bbb253301704a79ec99d24afdc` (35), `pattern-tree-state.ts` `6b34a9cbdb5529fcdd33c4bd11b6f66ac62026a634409ff94362812c65800f14` (277), `CmsPatternNestedPicker.tsx` `c9e5a2b4cecb771451e574ed43627a67c0226d5e9014372946eaaaf09f920eb7` (157).
Sibling-dir note: `gaps-db2` gained `20261024130400_cms_definition_writers_lock_position4.sql` since the first pass; it patches `cms_define_template` and `cms_create_taxonomy_version`, not `cms_create_pattern_version`, so the only multi-dir function is still `cms_create_pattern_version` (node-pointers `140100` and nestable `100020`); run V applies all 24 and passes `pattern_definition` and `gaps_node_pointers`.

### Finding by finding

| Finding | Status | Evidence |
|---|---|---|
| V14-01 MAJOR (SEC-1 claim gate) | **CLOSED** (static); the dynamic proof is root's canonical `db:api-test` | `claim-gate-manifest.ts:121` (`cms_list_pattern_nestable: 'service-role'`) and `:273` (the `cfg-actor` family, beside the selector); `claim-gate-fixtures-composition.ts:123-126` `{ request: { contentTypeId: [id(1)] }, real: NOT_FOUND }`. Check S: manifest = family = fixtures = 128 names; the fixture is a one-element UUID array exactly like the selector's single UUID, and all 16 composition fixtures expect `NOT_FOUND`. The reader resolves actor, party, validation, then person (NOT_FOUND) in the same order as the selector. I cannot run `claim-gate-manifest.apispec.ts` or `claim-gate-mutation.apispec.ts` (real PostgREST): root must. |
| V14-02 MAJOR (coverage) | **CLOSED** | Check C: 100% on all four metrics (was 99.76% / 99.69% / 99.73%, line 124). New test `cms-composition-production-pattern-nestable.test.ts:196-247` drives both disjuncts of the guard (another operation's id with a valid query; 65 types, a duplicate, a non-UUID, an empty set, limit 0), expects `{ ok: false, status: 400 }` and no fetch. |
| V14-03 MAJOR (inventory totals) | **CLOSED** | `phase_02_slice_12_gaps_rpc_inventory.sql:77-84` asserts typed `34` wrappers, `36` bodies, `70` functions (I counted the inventory list: 5 + 20 + 9 = 34; 32 names x private + 4 private-only = 36; 70); tests 2, 3, 4 pass in run V. Correction 13a (the name) stays; 13b is withdrawn. `phase_02_slice_09_r8_api_surface.sql` is byte-unchanged (`2f6ef586...`). |
| V14-04 MAJOR (pre-check, witness) | **CLOSED** | See "The mutant" below. Real migration `100020:77-101`: the stored-row count raises SQLSTATE `55000` `DEC-232 refused: N stored pattern version(s) hold the reserved key nestable; re-key or remove them before this migration` before the shape check and before the `alter table`; a post-check (`:103-114`) asserts the new CHECK is validated and five-key. Witness 27/27 on the stack (run V), parity 3/3. |
| V14-05 MINOR (spec, decision record) | **CLOSED** (root) | `be/03c...md:452` `ReservedPatternKeys = ['context','versions','selector','nestable','new']`; `:1611` `CHECK pattern_key NOT IN ('context','versions','selector','nestable','new')`; changelog row `:1922`; raw record `dec-234` states the three consistency choices, the pre-check and the typed totals. (The derived `decisions.md` is not recompiled, by the standing compile.mjs hold.) |
| V14-06 MINOR (stub-only seams) | **OPEN, accepted** (root request) | No Playwright spec was added. V14-01 now puts the real-PostgREST gate behind the read. Unchanged risk: Worker adapter, proxy and picker are proven against stubs; the SQL suite and the claim gate are the real-stack proof. |
| V14-07 MINOR (size, duplication) | **CLOSED** | `pattern-tree-state.ts` 277 lines (HEAD 276, cap 300); `NestedPatternChoice` and `newPatternNode` moved to `pattern-tree-nested.ts` (35 lines, `import type` back to the state module, no cycle), test renamed, no stale reference. `readSelector` and `readNestable` are `pagedRead(operationId, schema, rpc)`. **`readSelector` behaviour is unchanged**: check D, 33/33 scenarios identical (result and outbound call), plus the existing selector tests pass (check C). |
| V14-08 MINOR (bundle headroom) | **OPEN, accepted** (informational) | Pattern edit route 90,230 of 92,160 gzip bytes: headroom **1,930** on today's dist (was 2,087; other lanes' changes moved shared chunks). Passing. Not a lane change. |
| V14-09 MINOR (no perf evidence) | **OPEN, accepted** (root's bench) | `gaps_perf_patterns` is another lane's file; the lane states the expected bound and asks root to add a first page, a cursor page and a 64-type request to the canonical bench. |
| V14-10, V14-11, V14-12, V14-17, V14-18 | not addressed to this lane; **unchanged, non-blocking** | placement-perf bytes equal the first-pass table (7/7). |
| V14-13 NIT (sort token) | **CLOSED** | `100000:94` `'sort', 'patternKey:asc,patternVersion:desc'` is in the `queryHash`; the cursor tests (207) pass. |
| V14-14 NIT (water before page) | **CLOSED** | `100000:143-150` reads the high-water instant, `:152-170` then reads the page; comment `(V14-14)`; the follow-the-data tests (050) pass. |
| V14-15 NIT (OpenAPI) | **CLOSED, accepted** | Rationale holds: the zod refine is not exportable to JSON Schema and uniqueness is enforced and tested in the contract, Worker, proxy and SQL. `generate-openapi.mjs --check` exit 0. |
| V14-16 NIT (reporting) | **CLOSED** (one leftover, V14-20) | Status line now points to the final run; the nine reserved-key oracle files are listed as additive corrections. |

### The mutant (V14-04): what was run, what happened

The lane did not run it; I did. The pre-check is the five lines `select count(*) ... where pattern_key = 'nestable'; if stored > 0 then raise exception 'DEC-232 refused: ...' using errcode = '55000'; end if;`
(`100020:83-87`). Two mutations of exactly those five lines, nothing else changed (diff verified):

1. **Mutant migration** `100020` without the five lines, staged as scratch WIP lane `zz-v14-mutant` (SHA-256 `82244d067217388e32023575fb36954b2d321301a147af2b291e0dfce2392e0f`), beside byte-copies of `100000` and `100010`, run through the staged ALT runner (run M).
   Result: the **real witness still passes 27/27**. This is by design and I report it because root's expectation was that the witness would fail: the witness does not execute the migration file. It replays its own embedded copy of the region between `-- BEGIN/END NESTABLE-RESERVED-DDL` (`execute (select body from s12nw_ddl)`), and the only thing binding the copy to the migration is the Vitest parity test. That guard catches this mutant (check P: with the real, unmodified parity test source pointed at the mutant, `replays exactly the DDL` FAILS and `compares the whole transform, not a stub` FAILS on the missing `where pattern_key = 'nestable'` needle; `runs the pre-check before the constraint is dropped` still passes because the shape-check raise precedes the drop).
2. **Mutant witness copy** `supabase/tests/zz_v14_mutant_nestable_read_populated.sql` (SHA-256 `92632c7efb14f1443506faba1966bf1a199933e9b3187133b363fc2408cc6481`): the real witness with the same five lines removed from its replayed region, created for the duration of the run only. Result: **tests 17, 18 and 21 fail with the bare 23514**:
   ```
   not ok 17 - a stored nestable row refuses the migration with SQLSTATE 55000, not 23514
   #         have: 23514
   #         want: 55000
   not ok 18 - the refusal names the count (1) and the key
   #   'check constraint "cms_pattern_versions_pattern_key_not_reserved" of relation "cms_pattern_versions" is violated by some row'
   #   doesn't match: E'^DEC-232 refused: 1 stored pattern version\\(s\\) hold the reserved key nestable'
   not ok 21 - the refusal counts both owners' rows
   #   '23514:check constraint "cms_pattern_versions_pattern_key_not_reserved" of relation "cms_pattern_versions" is violated by some row'
   #   doesn't match: E'^55000:DEC-232 refused: 2 stored pattern version(s)'
   ```
   Tests 19 (the refusal leaves the old CHECK and all rows untouched: the failed ALTER rolled back inside the exception block) and 22 to 27 still pass, as predicted.
The two guards are complementary and neither is redundant: the pgTAP witness proves the behaviour of the text; the parity test proves the text is the migration's. Both are needed in the gate; the parity test lives under `tests/contracts/**`, which `vitest.config.ts` includes.
**Cleanup verified:** the driver removed `supabase/migrations-wip/zz-v14-mutant/` and `supabase/tests/zz_v14_mutant_nestable_read_populated.sql` (its trap printed the confirmation, and `git status` shows neither); the scratch files outside the worktree are in the scratchpad only. No tracked or lane file was modified.

### `pagedRead` and `readSelector`

Code reading: `pagedRead(operationId, schema, rpc)` performs, in order, `schema.safeParse(input.query)`; `input.operationId !== operationId || !query.success` gives `failure(400)`; destructure `contentTypeId, cursor, limit`;
one `rpc(input, { contentTypeId, limit, ...(cursor == null ? {} : { cursor }) }, signal)` (the `as unknown as PatternUpdateRpcInput` is a type cast only); a failed answer returns as is; `validSelectorPage(answer.value.value, query.data)` gives `{ ok: true, value }` or `failure(502)`.
That is statement for statement the old `readSelector` body (`git show HEAD:apps/worker/src/cms-composition-production-pattern-update.ts`). Check D confirms it empirically (33 scenarios, identical results and identical outbound requests).

### New findings of the verification pass

**V14-19 MAJOR (nestable-read): `pnpm format:check` fails on two nestable Markdown files.** `format:check` (part of `pnpm validate`, `package.json:45`) includes `'supabase/**/*.md'`. `prettier --check` over the repo's exact file set exits 1 on three files:
`supabase/tests/phase_02_slice_12_nestable_read/README.md` (permanent, stays after promotion), `supabase/migrations-wip/nestable-read/README.md` (deleted at promotion, inside the glob until then) and `supabase/migrations-wip/node-pointers/README.md` (V13's lane, not this one). The cause is table-column alignment only (`prettier file | diff file -`).
Both nestable files were unchanged since the first pass, so this was missing then (the lane's prettier list excluded Markdown; mine mirrored it). Fix: `prettier --write` on the two nestable files, then `pnpm format:check`. Mechanical, no re-review needed.
**V14-20 NIT: stale documentation.** `supabase/migrations-wip/nestable-read/README.md` still says "the gaps inventory recounts its totals from the catalog" (false since V14-03) and says nothing about the pre-check, the populated witness or the parity test; `lane-nestable-read-report.md:212` and `:215` (the older `## Follow-ups`) still describe the recount correction that `## V14 follow-ups` withdraws. Fix the README before root copies it into `supabase/migrations/README.md`.
**V14-21 NIT: the pre-check is not atomic with the ALTER, and its advice is not actionable by normal means.** The count runs without a table lock, so a `nestable` row inserted by a concurrent transaction between the count and the `alter table` would still surface as a bare 23514 (still atomic and fail-closed; the window is a deploy, so tiny). A `lock table platform_private.cms_pattern_versions in access exclusive mode;` as the first statement of the `$check$` block closes it (edit both copies, parity holds). Separately, the message says "re-key or remove them", but pattern version rows are append-only behind `cms_pattern_versions_lifecycle_guard`/the write guard (the witness itself must pause the guard to delete); if the count is ever non-zero the remedy is a DBA procedure under change control, and the lane's request 2 (precondition `count(*) = 0` on staging and production) is the right place to say so.
**V14-22 NIT (observation, accepted): the witness pauses `cms_pattern_versions_lifecycle_guard`** (lane rule "never disable triggers"). It follows the PAT-025 precedent (`populated-lineage.sql`), is scoped to deleting the seeded rows inside a rolled-back transaction, is disclosed in the header, and is asserted enabled again (test 25, `tgenabled = 'O'`). ACCEPT.

Counts after this pass: of the 18 first-pass findings, 10 CLOSED (V14-01, 02, 03, 04, 05, 07, 13, 14, 15, 16), 3 OPEN and accepted for root (V14-06, 08, 09), 5 not this lane and unchanged (V14-10, 11, 12, 17, 18). New: 1 MAJOR (V14-19), 3 NIT (V14-20, 21, 22). No BLOCKER.

### Open items for root

1. **Condition (V14-19):** `prettier --write` the two nestable READMEs, rerun `pnpm format:check` (it will still name the node-pointers README until V13's lane fixes it).
2. Run `claim-gate-manifest.apispec.ts` and `claim-gate-mutation.apispec.ts` in the canonical `db:api-test` (V14-01 is closed statically only).
3. Promote the three migrations together with the two inventory test files and the witness; keep `phase-02-slice-12-nestable-reserved-witness-parity.test.ts` in the gate (it reads `supabase/migrations/` once promoted); regenerate `database.types.ts` (`pnpm db:types`); add the lane section to `supabase/migrations/README.md` (from a corrected README, V14-20); regenerate the S12 receipts.
4. Record the deploy precondition on staging and production: `select count(*) from platform_private.cms_pattern_versions where pattern_key = 'nestable'` is 0 (lane request 2; V14-21).
5. Non-blocking, still open: real-route Playwright spec (V14-06), pattern edit route headroom 1,930 bytes (V14-08), nestable bench cases (V14-09), and the placement-perf hardening items (V14-10, 11, 12, 17, 18).
