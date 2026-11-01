# Promotion review V5: lane `claude_s12_dec208_obs`, FINAL state after four rounds (DEC-208 / 213 / 216 / 219 / 220)

Reviewer: independent verification reviewer V5. I did not author or previously review any file below (V3 reviewed the first-round bytes; I read
its report only as the finding list to verify). Read-only: no SQL, docker, supabase, pgTAP, race module or staged runner was run, and no
repository file other than this report was written. Worktree `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`, branch
`claude/phase2-slice12`, HEAD `b16edb54a7a1b698ed8ca15b6085046d4270626e`. Review time 2026-10-23T03:43Z to 04:12Z (clock from `date -u`).

## Verdict

| Part | Verdict |
| --- | --- |
| `claude_s12_dec208_obs` SQL (four files `supabase/migrations-wip/dec208/20261022100000/100005/100010/100020`) and its pgTAP suite | **PROMOTE** (no BLOCKER; one recommended comment-only edit before promotion, V5-3, because the file is immutable afterwards) |
| `claude_s12_dec208_obs` Worker probe, alert policy, registry and the shared Worker wiring (locale lines only) | **PROMOTE** |
| Root-owned integration preconditions that travel with the promotion | **OPEN, not lane-closable**: V3 F-3 (S09 `r8_api_surface` pin, MAJOR) and V3 F-9 (BE03c grants list / AC-261, NIT) |

Counts by severity (new findings of this review, V5-n): **BLOCKER 0, MAJOR 1 (root-owned carry-over of V3 F-3), MINOR 3, NIT 4** (8 findings), plus
6 observations that are not findings. V3 resolution (11 findings): **9 resolved on disk, 2 open (both root-owned: F-3, F-9)**, none reopened.

Root actions, in order: (1) with the promotion, apply V5-1 and V5-7 (S09 `r8_api_surface` pin: add the wrapper, 74 to 75; name the RPC in BE03c's grants list and AC-261; regenerate
`database.types.ts`); (2) promote the whole `dec208/` directory, four files; (3) optionally, before promoting, patch the one stale comment in `100010` (V5-3) and run the new suite once so
the manifest hash is current; (4) schedule the test hardening V5-2 (plan-agnostic counters, window-query counter, positive control) before AC-052/263 evidence calls the cost bound proven.

What changed my confidence, in one paragraph. The V3 blocker (the reader never set `app.cms_rpc`, so over PostgREST it answered zeros forever) is
fixed in the right shape and proved the right way: the V3 bytes were run RED (`.lane-logs/...214320-3944326.tap`, manifest still lists the V3
hashes `57ebe9aa…`/`df0b6b71…`, assertions 68, 69, 72 return the all-zero answer on the real caller path), the fix went GREEN, and the final
suite contains a context-cleared `service_role` test with a negative control and flag-restore assertions (PAT-031 satisfied). The final gauge is
a recursive skip scan whose every access to `cms_locale_variants` is a `LIMIT 1` probe keyed by (entry, locale); I found no plan path that must
visit superseded stale rows, and I checked the DEC-220 selection rule against a brute-force oracle over 300,000 random worlds (0 mismatches).
What I could not call sound is the 007 scan-counter test as a PROOF of that bound (V5-2): it can pass while history is read through an index it
does not count. That is a hardening finding on the evidence, not a defect in the bytes being promoted.

## Scope (all SHA-256 re-computed by me; the first 16 hex of each equal the lane report)

| SHA-256 | Lines | File |
| --- | --- | --- |
| db067815bc0fe358984904c5eb397712a0af8547bed59a98fad0a3e7b0bd27cc | 29 | `supabase/migrations-wip/dec208/20261022100000_cms_locale_variants_observability_indexes.sql` |
| ae851c8f081cbb58711006081ce646963b633830a7b701fe0ee644b83673f9a5 | 109 | `supabase/migrations-wip/dec208/20261022100005_cms_locale_stale_legal_field_count.sql` |
| 81cfa34114d3038acb3e0020c5211ceb01da4d17fe16b3508388bcade3e82ae8 | 100 | `supabase/migrations-wip/dec208/20261022100010_cms_locale_observability_read.sql` |
| 5f186430e67c96ba27def514a672ed6f755a00ac3d6538673b2e01c0685705cd | 49 | `supabase/migrations-wip/dec208/20261022100020_cms_locale_observability_read_public.sql` |
| 52ed73d86cb55f8cab9d9f77d26fe8230143ce25e1fa3cccbbeafa256a528d61 | 17 | `supabase/migrations-wip/dec208/README.md` |
| c6fbc3a6e99512b297bc876edce4d5db19b95ea181c798f2bbcc7117ccd14c21 | 37 | `supabase/tests/phase_02_slice_12_locale_observability.sql` |
| a6cd8d7b77fcedfecb8e0f54ef280ebb9f6f4f59b67efc1cb0bcc38990aedd12 | 84 | `supabase/tests/phase_02_slice_12_locale_observability/000-helpers.sqlinc` |
| 1cb4833fc4808292d48d7de6065386a7fca6b84bd79f4d399a036a565f143a1a | 98 | `supabase/tests/phase_02_slice_12_locale_observability/001-shape-and-grants.sqlinc` |
| 57e3c73a3751b11d94a316199c7c80c30905c7d5180f0406a35bc390420a88a4 | 44 | `supabase/tests/phase_02_slice_12_locale_observability/002-refusals.sqlinc` |
| b700850d8ebc0ed9b09a99bfc885da66fa03b5e9bce0313390e3e1604d5f67ca | 111 | `supabase/tests/phase_02_slice_12_locale_observability/003-window.sqlinc` |
| 7d97c75b137770f57cc7b628bccaf449398e318e9418d467315b265123e21d8e | 41 | `supabase/tests/phase_02_slice_12_locale_observability/004-rpc-context.sqlinc` |
| 1940936cda8d3849b1cc59e7e10b509a786dd107e6a8a06c19b3be65a1e6edb3 | 35 | `supabase/tests/phase_02_slice_12_locale_observability/005-gauge.sqlinc` |
| eb3771675cda01a74abdd7f903cad8bd8a1b247d9b7131b40148bb93dc61fd62 | 106 | `supabase/tests/phase_02_slice_12_locale_observability/006-cases.sqlinc` |
| d4e38c3abb4fe5ddd7cd891fc9155c147080f138e6e8bea34ae7ef3f833be4f9 | 104 | `supabase/tests/phase_02_slice_12_locale_observability/007-volume.sqlinc` |
| abe652d04072ef8973d3fff9a8743686b54440aaf6404058a1318f561bed20f7 | 64 | `supabase/tests/phase_02_slice_12_locale_observability/008-closing.sqlinc` |
| f58771e509330cbee1054a193bc9cb0012bac5b5af5932ffd3300a955cd0c3fc | 18 | `supabase/tests/phase_02_slice_12_locale_observability/README.md` |
| 20f4550ab871bedfd252d685993df59399616187d4ef5000e7038b1f319fb9a2 | 201 | `apps/worker/src/cms-composition/locale-observability.ts` |
| efca66baa325c4ab21ceaf40547d462d435a0fd8effd266e5317aacd53b4543c | 163 | `apps/worker/src/cms-composition/locale-observability.test.ts` |
| f16b285a0ec765f0ef839cd25a0b52b90b288276508d18a7fc5ca2ec618cff48 | 340 | `apps/worker/src/cms-composition/locale-observability-probe.test.ts` |
| 4c24af5847e50c94f54d0228535d1fa1c811ab1cb1ac871806277b27bb06148e | 178 | `apps/worker/src/cms-composition/locale-observability-failures.test.ts` |
| d35a58ae38c80bcb8ec68d132212e71d5c0743abc4206a2401d8f244bd8aa4c4 | 224 | `apps/worker/src/cms-composition/observability-registry.ts` |
| 30ec23c9da9f9ae7e2095b40646ba861abe4a72b9a11d442efa073c59f92069f | 187 | `apps/worker/src/cms-composition/observability-registry.test.ts` |
| c275530f60994a9be6317beafbc442b2c793db0f40f20081606b75637720e0a3 | 121 | `apps/worker/src/async-entrypoint-locale-observability.test.ts` |
| 257134dc10a7aa0a57256b220bc48600b7df3c120308ee1da71593374e7ef958 | 155 | `apps/worker/src/production-async-entrypoint-locale-observability.test.ts` |
| e1b223b31eadf77f086d736cf1f640c8c5075ec81237910b537d4ba92dc56080 | 322 | `apps/worker/src/async-entrypoint.ts` |
| 1333421461ad9541c69cf3d54eb0f2d6d528fcca7595947be15fa387795cf23d | 199 | `apps/worker/src/production-async-entrypoint.ts` |
| 068bcfe57f255122878236f0c8d5b2241189bfa3eeaba6cc4faa78c0f5bc0c78 | 126 | `apps/worker/src/event-consumers/production.ts` |
| 8cbd9cb7f21f50aca57e803197d0ba5be42b8191e155fc57fefae0e922039f27 | 26 | `apps/worker/src/event-consumers/rpc-names.ts` |
| 77cf2aec6ee9cbb8a64aaf3386ecea281c2bf0db6c8a054b1b6f118149f54c86 | 82 | `packages/observability/src/cms-composition-alert-evaluator.ts` |
| 6dc08675ef0e681e2681bafe1a2d48e0a54dc7dde27d3d7f7b6cb376c77819a8 | 18 | `packages/observability/src/cms-composition-alert-thresholds.ts` |
| 54a534f6ed3cdcf62f3855596581ea3824bd8001cfc10f4529adbfe73891217c | 42 | `packages/observability/src/cms-composition-alert-types.ts` |
| 4bb14c3bd8b99ec6d255accfecd9c1b196e4544fcc9469bd34e041ba11ae0231 | 8 | `packages/observability/src/cms-composition-alerts.ts` |
| e50c6aa43826fc08108bd4dd8d74ebccf73708f92d1bc278d4a48f517de4bef0 | 15 | `infra/observability/cms-composition-alert-policy.ts` |
| 875591416b9d7bdf15230a3f7fd36a69352c6e108db4a562881bdf3eccbeb46d | 199 | `tests/observability/phase-02-slice-12-alert-policy.test.ts` |
| 34602b361fca4eba2a03d879f9dcdc0c5dfbf053688ffba1c58ba86106952cd1 | 217 | `apps/worker/src/cms-composition/README.md` |
| 37c34372cf2e41dd7de6a94dc4358a819f0e94434f66366be8bf838d259cac7c | 75 | `apps/worker/src/event-consumers/README.md` |
| 3cb2391c4e6d5f18bdcd866818ab29a7cd989e642d288b5f9e41f8429b793b6e | 38 | `packages/observability/src/README.md` |
| 3318b82cdd193126b73b3fcaba0852ef59df851c6b91aaadf470d3206f2d74d9 | 67 | `infra/observability/README.md` |

Shared-file note. `apps/worker/src/async-entrypoint.ts` and `apps/worker/src/production-async-entrypoint.ts` were edited by another lane at 23:56 local (03:56Z) while I was reviewing
(linked-scan, governed-recheck and taxonomy-merge wiring). The two rows above carry the SHA-256 I computed at the start of the review; the files now hash to
`9e49300b75b323dfd72b8b67ec6ae512ae35586a4fdc0c763eb275571c71b6ee` (async-entrypoint.ts) and `ed6d0bdfedac231f620e61e72367035ca47c5bffa89fa2bf90937f1f52446e74` (production-async-entrypoint.ts). I re-read the locale lines in the new bytes (`async-entrypoint.ts:137-143,308-314,320`,
`production-async-entrypoint.ts:142-143`): intact and as the lane describes them. `event-consumers/production.ts` and `event-consumers/rpc-names.ts` are unchanged.

## Evidence I generated (all read-only)

- Focused Vitest, 9 files (`locale-observability` x3, `observability-registry`, both entrypoint locale suites, event-consumers production,
  `index-scheduled`, `tests/observability/phase-02-slice-12-alert-policy.test.ts`): **9 files / 109 tests passed**. Wider set (Worker
  `cms-composition/`, `event-consumers/`, `packages/observability`, `tests/observability`, `infra/observability`, the entrypoint and scheduled
  suites): **173 files / 3,677 tests passed**. ESLint `--max-warnings=0` on the 16 touched TypeScript files, Prettier `--check` on those plus
  the five READMEs, and `tsc --noEmit` for `apps/worker/tsconfig.json` and `packages/observability/tsconfig.json` (build info redirected to scratch, `git status` entry count unchanged): all clean. Logs: scratchpad `review-v5/vitest-focused.log`, `vitest-wide.log`, `eslint.log`, `prettier.log`.
- Final TAP `.lane-logs/alt-staged-pattern-updates+...+dec208-233710-238690.tap`: SHA-256 `5664b612a275dc9bfc6ae09d0003f8c7a700dc9b5b9bbc49f85a3088186a7b40`
  (equals the lane report), `Files=14, Tests=577`, 0 `not ok`, `Result: PASS`; the new suite is 127/127 ok (TAP lines 197-365). Its `.manifest`
  lists the four dec208 migrations with SHA-256 equal to the files on disk (`db067815`, `ae851c8f`, `81cfa341`, `5f186430`), and the reset log
  applies them in order (`...reset.log:536-539`). The manifest does not hash tests, so for the fragments I used mtimes: the last test edit is
  23:37:02, the manifest was written 23:37:10 and the TAP finished 23:37:51 (local, 22 Oct), i.e. the run used the final test bytes (an inference from mtimes).
- RED evidence for V3 F-1/F-2: `...214320-3944326.tap` (SHA-256 `d7fe2325…`, equals the lane report) ran the NEW suite on the V3 bytes (manifest
  `57ebe9aa…`, `df0b6b71…`): 13 `not ok`, among them 68, 69 and 72, the real caller path answering zeros. DEC-219 RED: `...222608-4134383.tap`
  (pre-DEC-219 reader bytes `93f8acb3…`): 107, 110, 111, 112 are the genuine RED, 105/106/115 the lane's own fixture error, as the report says.
- The lane's plan diagnostic, `...233557-231108.tap` (SHA-256 `5db24b73…`, equals the lane report): plan A (the `lower(locale)` skip scan) and plan B
  (plain column) of the gauge query EXPLAINed as `wejammin_cms_definer` with RLS on, and the leakproof flags of this PG 17 stack (`lower` false;
  `text_gt`, `text_lt`, `texteq`, `uuid_eq` true; TAP lines 170-177). I rely on it for the plan shapes; I could not re-run it.
- Algorithm model (no SQL): `review-v5/skipscan-model.mjs` mirrors `100005:34-87` line by line (skip scan over raw locales, newest row of each raw
  locale, `DISTINCT ON (entry, lower(locale))`) and compares it with the `cmsLocaleVariantRead` oracle (newest row per `(entry, lower(locale))` over
  all rows). 300,000 random worlds, small version and `created_at` ranges so ties are frequent, 9 raw spellings of 4 locales:
  **0 mismatches**; 400,077 case-interleaved groups and 166,702 groups whose raw spellings tie on their maximum version were exercised.
- Migration timestamps `20261022100000`, `100005`, `100010`, `100020`: unique across `supabase/migrations` (461 files, newest `20261020203606`) and every
  `supabase/migrations-wip/*` directory (the only duplicates anywhere are `governed-recheck` vs `governed-recheck-red`), and no other file is at or
  after `20261022090000`, so the four are ordered after everything else. Sizes 29, 109, 100, 49 lines (limit 300).

## Findings

| ID | Severity | file:line | Evidence (short) | Spec / rule | Proposed fix (short) |
| --- | --- | --- | --- | --- | --- |
| V5-1 | MAJOR (root-owned; V3 F-3 carried over, still OPEN) | `supabase/tests/phase_02_slice_09_r8_api_surface.sql:165-167,179-183,223-229,230-235` | The pin classifies every `cms_` function of `platform_api` and counts the supported set (`8 + 10 + 74`, title at `:235`). `cms_locale_observability_read` appears in no list (a worktree-wide grep, excluding `node_modules`, `.git` and `.lane-logs`, names it only in the lane's files, BE03c, the raw records and the handoff documents; the tracker does not name it). The three assertions at `:179-183` ("every cms_ function … is classified"), `:223-229` ("API-executable set is exactly the enumerated …") and `:230-235` (the count) go red once the wrapper exists. | Tracker AC-261 (RPC and grant inventory); DEC-213 Downstream "AC-261 RPC inventory cascade"; STATE.md "INTEGRATION TODO" | In the same promotion add `('cms_locale_observability_read')` to `r8a_supporting` (after `:167`) and change `74` to `75` at `:235`. No edit is needed for the private helper: `phase_02_slice_09_sec2_all_schema_definer_rls.sql` derives the function set from the catalog and pins only tables (all four are in its set, `:112`) and `search_path=""` (`:189-192`). Regenerate `database.types.ts` (root TODO). |
| V5-2 | MINOR | `supabase/tests/phase_02_slice_12_locale_observability/007-volume.sqlinc:64-79,86-93` | The scan-counter test is a sound regression guard for the V3 shape and for an unbounded probe through the head index, but it is not a proof that no plan reads history (details below). It counts only `cms_locale_variants_state_created_at_idx`, `cms_locale_variants_entry_locale_head_idx` and the table `seq_scan`, i.e. 2 of the table's 8 indexes (PK, unique `…entry_locale_source_version_key`, `…owner_entry_locale_state_idx`, `…source_hash_idx`, `…source_locale_latest_idx` and `…current_row_idx` are not counted); the measured call runs with `enable_seqscan` and `enable_bitmapscan` off; the window query is not measured; the bound `< 60` is absolute. Precedent that the blind spot is real: the lane's own plan A read 52 rows x 4 loops of the head probe through `cms_locale_variants_owner_entry_locale_state_idx` + `Sort` (`...233557-231108.tap:132-134`), an index no counter of this test observes. | BE03c 1776 "neither count may grow with its history"; DEC-219; `.claude/rules/tdd-contract-first.md` ("tests ARE the spec") | Make the proof plan-agnostic: assert the delta of `sum(pg_stat_get_xact_tuples_returned(indexrelid))` over `pg_index where indrelid = 'platform_private.cms_locale_variants'::regclass`, plus `pg_stat_get_xact_tuples_returned(table)` and `pg_stat_get_xact_tuples_fetched(table)`, each below a bound derived from the world (3 x heads + entries), not 60. Add one assertion for the window query: after one `platform_private.cms_locale_observability_read` call on a quiet window, the `…state_created_at_idx` delta is at most the rows in the window plus 1 (it would be 201+ if the window read degraded to the stale partition). Add a positive control for the zero: the same window call must lift the `…state_created_at_idx` delta above 0 (the V3-shape RED run read 207 entries through it, so the counter works, but today's `= 0` has no control in the test itself). Until then the AC-052/263 evidence should say "regression guard under seq/bitmap off", not "proof". |
| V5-3 | MINOR | `supabase/migrations-wip/dec208/20261022100010_cms_locale_observability_read.sql:27-29` | The cost comment says the gauge "skip-scans INDEX(entry_id, lower(locale), ...)". The final helper skip-scans `INDEX(entry_id, locale, ...)` (`100005:9-14,34-54`; the third index `100000:26-27`), the very point DEC-220 settled (`lower()` is not leakproof). The file is immutable once promoted; `100000`, `100005`, `dec208/README.md:17` and BE03c 1776 are right, so this one comment would permanently contradict them. | BE03c 1776; DEC-220; `.claude/rules/specificity-standards.md` | Comment-only edit: "skip-scans INDEX(entry_id, locale, ...) (the plain column: lower() is not leakproof under forced RLS, 20261022100000)". It changes the `100010` SHA-256, so refresh the evidence with one staged run of the new suite (as the lane did for its earlier comment-only change, run `210446`). Nothing breaks if root skips it. |
| V5-4 | MINOR | `006-cases.sqlinc:16,22,30,36`; `007-volume.sqlinc:21`; `008-closing.sqlinc:8`; `003-window.sqlinc:60` | Seven `set local session_replication_role = replica` blocks in four fragments (V3 F-6 accepted the first kind with a note). The two new kinds flip registry authority rows (`cms_field_definition_versions.state`, `cms_content_type_versions.state`, `006:16-41`) and bulk-insert 200 stale rows past the write guard, the immutability guard and the foreign-key triggers (`007:21-40`). The rows are copies of valid rows and the transaction is rolled back, and no producer exists to drive these states (no migration sets an entry `lifecycle` other than `active`: `grep` finds none; 200 real source edits are not a practical fixture), so I accept them, but each use should be listed in the lane report's fixture notes and any later fragment that can use a real producer should. The six direct `update … set lifecycle` statements (`006:93-103`) run under `origin` with the flag set and bypass no trigger. | `docs/handoffs/2026-10-14-claude-s12/lane-rules.md` "Never"; review brief (fixtures) | Accept with the note; add the list to the lane report's `## Test corrections` so the next reviewer does not rediscover it. |
| V5-5 | NIT | `docs/handoffs/2026-10-22-claude-s12/lane-dec208-obs-report.md:97,107,114` | The report's promotion-facing text is stale after DEC-219/220: the V3 table still says F-5 "RECORDED, query unchanged" (`:97`), "Open items 1" still describes the old per-row stale scan (`:107`), and "Requests to root 1" says "Promote … (3 files, … 20261022100000/100010/100020)" (`:114`). The set is FOUR files (item `00` at `:112` and STATE.md say so). A promotion that followed `:114` would omit `100005`: `plpgsql` does not resolve the helper at `create function`, so the reader would apply and fail on its first call. | `.claude/rules/completion-checklist.md` | Mark `:97` and `:107` superseded by DEC-219 and correct `:114` to the four files (or delete it). Root should promote the whole directory. |
| V5-6 | NIT | `008-closing.sqlinc:7-43` | The pgTAP coverage of case-insensitive identity is one transition (`de-DE` v2 stale, then `de-de` v3 draft, gauge 3 to 2). The A, B, A shape (a stale row on the older spelling that is overtaken, then re-overtaken by a third spelling) is not in the suite. The SQL is correct for it (worked case below; 0 mismatches in the model), so this only matters for mutation power: a mutant that orders the `DISTINCT ON` by raw spelling instead of `version desc` survives under a collation that sorts `de-de` before `de-DE`. | BE03c 1776 ("newest row per entry and case-insensitive locale by `version`, `created_at`, `id` descending"); DEC-220 | In `008`, after the existing forged `de-de` draft, forge a `De-DE` revision and a `De-DE` v4 stale `[legal]` row the same FK-consistent way; assert the gauge returns to 3. |
| V5-7 | NIT (root-owned; V3 F-9 carried over, OPEN) | `.memory/wiki/specs/be/03c-composition-taxonomy-localization.md:1621`; tracker `.memory/pipeline/progress/slices/phase-02-slice-12.md:4181` | The "Permission, RLS and grants" named-RPC list and AC-261's text do not name `cms_locale_observability_read` (only the DEC-208 paragraph `:1776` and the changelog do). | DEC-213 Downstream | Root: add the RPC to both lists with V5-1. |
| V5-8 | NIT | `001-shape-and-grants.sqlinc:1-3,67`; `apps/worker/src/cms-composition/README.md:192-199` | The pgTAP header says "two indexes so neither read scans the table" and `:67` says "The two read indexes"; the assertions below them cover three. The Worker README paragraph on `locale-observability.ts` stops at "logged … and swallowed": it omits the DEC-219/220 failed-read counter and `locale_observability_unavailable` alert and does not list `locale-observability-failures.test.ts`. | `.claude/rules/extensibility.md` (README per directory) | One-line fixes. |

### Observations (not findings; recorded so root does not rediscover them)

1. **The failed-read alert is a structured log line only.** DEC-220 and BE03c 1776 rely on "delivery deduplicates repeats", but no delivery layer exists in the repo
   (`infra/observability/cms-composition-alert-boundary.ts` forwards every page-worthy record to a caller-provided sink; no provider rule is bound). During a
   database outage the Worker writes one failed-sample line and one alert line per minute and nothing suppresses them. This is the predecessor's open BOUNDARY, not a
   regression, but "the alert input can no longer vanish silently" is true only of the log stream until a provider rule exists.
2. **The cost bound depends on catalog flags nothing pins.** A2/A3 become index conditions only because `uuid_eq`, `texteq` and `text_gt` are leakproof on this stack
   (`...233557-231108.tap:173-176`, PG 17 per `supabase/config.toml:41`). If the hosted major differed, A2 would degrade to a filter and read the history of the earlier
   locales. A one-assertion catalog pin (`proleakproof` of those three functions) would make a version change visible.
3. **A Worker abort does not necessarily cancel the server-side statement.** BE03c 1776 fixes the bound as the caller's 5,000 ms (the function-level timeout was removed
   because it cannot bound its own caller). What protects the database is the DEC-219 cost bound, not the abort.
4. **The per-tick cost is linear in ACTIVE entries, including those with no translation** (one `first_row` probe each; `100005:34-43`). That is the spec's shape ("starts from
   the `active` entries"); at millions of entries the 5,000 ms abort and the failed-read alert are the backstop.
5. **`cms_locale_variants_current_row_idx` (the spec'd lower-case index) is used by no query of this lane.** The lane's plan A shows that under forced RLS a `lower(locale)`
   predicate cannot be an index condition, which also holds for the `lower()` predicates of the dec205 reader (not in this lane). Whether the spec'd index still earns its
   write cost is a root question for BE03c, outside this review.
6. **Decision records.** DEC-208 and DEC-213 are in `.memory/raw/events/2026-10-22.jsonl` (lines 6 and 11); DEC-216, PAT-031, DEC-219 and DEC-220 are in
   `.memory/raw/events/2026-10-23.jsonl` (lines 1, 2, 5, 7), not in the 10-22 file the brief names. None of the five DEC ids is in the derived `.memory/wiki/decisions.md` yet (not compiled; this
   matches the standing instruction not to run `compile.mjs` until DEC-188/189 have raw records). BE03c changelog row `:1893` (DEC-219) still says "five within ten minutes raise
   `locale_observability_unavailable`"; it is history, superseded by row `:1895` (DEC-220) and by the paragraph at `:1776`, which is current.

## 1. V3 resolution table (all eleven findings, verified on disk)

| V3 | Severity | Status | Where it is resolved (file:line) and how I checked it |
| --- | --- | --- | --- |
| F-1 | BLOCKER | **RESOLVED** | Reader sets the transaction-local flag after the three `VALIDATION_FAILED` checks: `100010:49-62` then `:64` (`perform pg_catalog.set_config('app.cms_rpc', 'true', true)`). Wrapper is the flag-restoring plpgsql shape with the SEC-2 guard-D spelling: `100020:20` (`rpc_previous`), `:23` (call), `:24` (restore), `:25` (return). Reader and wrapper are VOLATILE (no `stable` keyword; the reader's volatility is pinned `001-shape-and-grants.sqlinc:16-17`). Guard D of `phase_02_slice_09_sec2_definer_rls.sql:460-477` matches the wrapper (it reaches the flag-setting reader by name and restores through `rpc_previous`); the helper does not set the flag. RED first: `…214320-3944326.tap` ran the new suite on the V3 bytes and failed 68, 69, 72 with the all-zero answer. |
| F-2 | MAJOR | **RESOLVED** | New `004-rpc-context.sqlinc` (driver `phase_02_slice_12_locale_observability.sql:30`): negative control `:9-11` (definer sees `0` variant rows with the flag cleared), `service_role` real counts `{2,2,4}` and `{0,2,0}` `:13-21`, flag restored when cleared / `true` / `false` `:22-32`, refused window leaves it cleared `:34-38`. Failed on the V3 bytes (68, 69, 72). Satisfies PAT-031 (details in check 2). |
| F-3 | MAJOR (root) | **OPEN, root-owned** | `phase_02_slice_09_r8_api_surface.sql:165-167,179-183,223-229,230-235` still do not list `cms_locale_observability_read` (V5-1). Not editable by the lane. |
| F-4 | MINOR | **RESOLVED** | `100010:6-9` now says `created_at` is the `clock_timestamp()` the fan-out writer takes when it starts, never earlier than the transaction start (the writer: `20261014050300:46,96-105`). BE03c 1776 carries the same sentence. |
| F-5 | MINOR | **RESOLVED by redesign (DEC-219, DEC-220)**; proof caveat V5-2 | Cost: the gauge starts from active entries and skip-scans (`100005:34-90`, indexes `100000:19-27`), no `state = 'stale'` enumeration remains (check 4). Silent disappearance: every failed, timed-out or malformed read now counts `cms_locale_observability_read_failed_total` and raises `locale_observability_unavailable` for that firing (`locale-observability.ts:136-167`; threshold `cms-composition-alert-thresholds.ts:17`, rule `cms-composition-alert-evaluator.ts:64-74`). |
| F-6 | MINOR | **REPLACED, residual V5-4** | The forged `de-de` state is now FK-consistent: a matching `de-de` revision is forged first and a control asserts every E1 variant row satisfies `(revision_id, locale)` (`008-closing.sqlinc:7-43`; TAP 119-120 ok). Still built under the replica role and still unreachable through a producer (said in the fragment header `:1-5`). |
| F-7 | MINOR | **RESOLVED** | `006-cases.sqlinc`: retired definition `:16-27`, non-active type version `:29-41`, second entry with two stale `no_fallback` fields on one variant, members not rows, cross-entry sum `:43-77`, unpinned real fan-out row read through its own minute `:79-89`. I checked kill power analytically (the lane ran no mutation pass on SQL): members-vs-rows 3 vs 2 (`:76`), retired definition 1 vs 0 (`:21`), only type version superseded 1 vs 0 (`:35`), lifecycle 3/1/3 (`:94-104`). |
| F-8 | NIT | **RESOLVED** | No function-level `statement_timeout` in any of the three functions (the three `set local statement_timeout` in the migrations are migration-session settings, `100000:17`, `100005:20`, `100010:33`); `proconfig` is exactly `{search_path=""}` for reader, helper and wrapper, pinned with `=` (`001:6,25,37`; TAP 7, 13, 15 ok). Comments say the bound is the Worker's 5,000 ms (`100010:23-26`, `100020:5-6`). |
| F-9 | NIT (root) | **OPEN, root-owned** | BE03c `:1621` and tracker AC-261 (`:4181`) still do not name the RPC (V5-7). |
| F-10 | NIT | **RESOLVED (DEC-216), premise verified** | `lifecycle = 'active'` at `100005:43` (header `:4-8`); pins `001:22-23`, `007:99-100`; behaviour `006-cases.sqlinc:91-106` (RED first: V3-bytes run failed 96-98, 100). V3 left the premise untraced; I traced it: the locale author command and the revision writer both refuse any non-active entry with `INVALID_TRANSITION` (`20260927440000:100-102`, `20260927150000:104-106`), so a stale `no_fallback` field on an `archived`, `held` or `deletion_pending` entry could indeed never be cleared. No migration writes a non-active lifecycle yet (grep), which is why the fixtures must set it directly. |
| F-11 | NIT | **RESOLVED** | `observability-registry.ts:10-14` now says "sixteen metrics" and lists the DEC-208 gauge and the DEC-219 counter; the registry has 16 entries (`:40-86`). |

Totals: 9 resolved (F-1, F-2, F-4, F-5, F-6 with residual, F-7, F-8, F-10, F-11), 2 open and root-owned (F-3, F-9).

## 2. The seven requested checks

### (2) Context and PAT-031: PASS

PAT-031 asks for: clear `app.cms_rpc`, call as the real caller role, assert real non-zero results, assert the caller's value is restored, and a negative control. `004-rpc-context.sqlinc` has
all five: control `:9-11`; `service_role` through the `platform_api` wrapper with the flag cleared returns `{"fanoutRows": 2, "staleLegalFields": 2, "staleFieldsAppended": 4}` `:14-17`
and, on a quiet window, `{0, 2, 0}` `:18-21` (so the helper, which sets no flag, also reads rows under the reader's flag); the flag is `''` afterwards `:22-23`, `true` after a call that started with
`true` `:26-28`, `false` after a call that started with `false` `:29-32`; a refused window leaves the cleared flag untouched `:35-38`. Over the real PostgREST path the request also starts with
the flag unset (V3 F-1 trace), and `coalesce(current_setting(…), '')` at `100020:20` handles that. Remaining blind spot, accepted: the pgTAP transaction cannot show that PostgREST starts without
the flag; it is the same assumption the repo's earlier fixes (`20261003120360`, `20261013100500`) rest on.

### (3) DEC-216 active-only: PASS

`100005:43` (`entry_row.lifecycle = 'active'` in the recursion's base case) and nowhere in the window query (`100010:66-72`, which has no join to entries, so the window counters keep
"fan-out history is history", asserted `006:105-106`). The lifecycle check constraint has exactly four values (`20260926090000:33-34`), so "active only" excludes exactly the three the spec names
and any future value by default. Premise verified (F-10 row above).

### (4) DEC-219 cost bound and the soundness of the 007 proof: bounded by construction; the proof is partial (V5-2)

**4a. Every access to `cms_locale_variants` in the final gauge (`100005`).**

| Access | SQL | Predicate and order | Served by | Index tuples |
| --- | --- | --- | --- | --- |
| A1 first locale of an active entry | `:37-41` | `entry_id = e ORDER BY locale LIMIT 1` | `…entry_locale_head_idx` or the unique `…entry_locale_source_version_key` (both lead `(entry_id, locale)`) | at most 1 per active entry |
| A2 next distinct locale | `:47-52` | `entry_id = e AND locale > prev ORDER BY locale LIMIT 1` | same two | at most 1 per distinct raw locale, 0 for the terminal probe |
| A3 head of (entry, raw locale) | `:59-66` | `entry_id = e AND locale = l ORDER BY version DESC, created_at DESC, id DESC LIMIT 1` | only `…entry_locale_head_idx` yields this order without a Sort | 1 per (entry, raw locale) |

So the index tuples read per call are at most `E_active + 2K` (K = distinct raw (entry, locale) heads of active entries), independent of the depth of any key's history.

**4b. Why no plan path must, or can be forced to, visit superseded stale rows.**
1. `state` is never in a predicate of A1, A2 or A3. It is tested only on the already chosen head (`:87`), and PostgreSQL does not push a qual on a non-`DISTINCT ON` column below a `DISTINCT ON`
   subquery, so `INDEX(state, created_at)` is unreachable for the gauge (the test confirms: delta 0, `007:86-87`).
2. Variants are never the driving relation: A1 is a scalar subplan of the entries scan, A2 is a scalar subplan of the recursive term, A3 is a `LATERAL … LIMIT 1` keyed by the CTE row. The rows the
   executor must fetch are exactly the A1/A2/A3 results; the recursion ends when A2 returns NULL (strict `>`), so it takes `max locales per entry + 1` iterations.
3. History could be read only if a probe were realized by a non-ordered access (bitmap/seq scan, or an index that needs a `Sort`). For A3 every alternative costs at least the ordered
   `LIMIT 1` scan plus a Sort and reads at least as many tuples, so a cost-based planner prefers `…entry_locale_head_idx` over every other index path for any cardinality estimate, and over a sequential or bitmap scan once the table is more than a few
   pages, provided its qualifiers can be index conditions. Under FORCE RLS they can only if every function in them is leakproof: `uuid_eq`, `texteq`, `text_gt` are, `lower` is not (`…233557-231108.tap:170-176`). That is what the intermediate
   `lower(locale)` design (plan A) did: it read the head probe through `…owner_entry_locale_state_idx` + `Sort` (52 rows x 4 loops, `:132-134`), and `next_row` filtered 54 rows (`:123`). Plan B,
   the final shape, shows `Index Cond: ((entry_id = …) AND (locale > previous.locale))` for A2, `((entry_id = …) AND (locale = …))` with no Sort for A3, `actual rows=1` (`:167`).
   The remaining per-tick cost that does grow is `E_active` (one A1 probe each, including entries without translations; observation 4), which is the spec's shape.

**4c. Is the `007-volume` scan-counter proof sound? It can pass while the query still scans history, in these specific ways.**
1. Only 2 of the table's 8 indexes are counted (`007:67-68,78-79`). A regression that moves A1, A2 or A3 onto the unique key, `…owner_entry_locale_state_idx`, `…source_locale_latest_idx`,
   `…current_row_idx`, `…source_hash_idx` or the primary key (a mutant that reorders A3's `ORDER BY` so the head index no longer provides it is the simplest) reads history through an
   index no assertion observes, while the head-index delta stays small and `> 0` (A1 or A2 may still use it). The earlier version of this very test missed a 52 x 4 read in exactly that way
   (above).
2. The measured call runs with `enable_seqscan` and `enable_bitmapscan` off (`007:69-70`). It proves the intended plan exists and is chosen when the alternatives are disabled, not that the default-GUC
   plan on a realistic table avoids history. The test table is 210 rows; a default-GUC assertion there would fail for the wrong reason (the planner prefers a sequential scan on two pages), so the
   fix has to be plan-agnostic counting, not a GUC change.
3. The window query (`100010:66-72`) is not measured by any assertion. It should be an index range scan on `INDEX(state, created_at)` (`state` is `text`, `texteq` leakproof; `created_at >= / <` on
   `timestamptz` are very probably leakproof, but the lane's diagnostic did not check them). If they were not, the window read would degrade to the whole stale partition (201+ entries here) and
   nothing would fail.
4. The bound `< 60` is absolute and the TAP does not print the measured value (only that the delta is in (0, 60)); for this world I expect 4 to 8 (A3 four times, plus A1/A2 when the planner uses that index; my estimate from the plan shape).
What the test does establish: the V3 shape (every stale row through `INDEX(state, created_at)`) is gone (delta exactly 0), the gauge makes no sequential scan, the head index is used and read a
handful of times, and the answer is unchanged by 200 superseded rows. As a regression guard that is real; as a "proof of no history visit" it is not. Fix: V5-2.

### (5) DEC-220: PASS

**5a. The skip scan returns the newest row per case-insensitive locale in every case.** The rule is an argmax over a union: the newest row of `(entry, lower(locale))` equals the newest of the
per-raw-spelling newest rows, because the order `(version, created_at, id)` is total (`id` is the primary key). `raw_head` takes the maximum of each raw spelling (A3) and `head` takes the maximum
over spellings with the same `ORDER BY version desc, created_at desc, id desc` (`100005:68-74`), then `state = 'stale'` is applied to that winner only. Adversarial case (one entry, active; `legal` is
`no_fallback` and active in the active type version):

| row | locale | version | created_at | state | stale_field_ids |
| --- | --- | --- | --- | --- | --- |
| a | `fr-FR` | 1 | t1 | draft | `[]` |
| b | `fr-fr` | 2 | t2 | stale | `[legal]` |
| c | `fr-FR` | 3 | t3 | stale | `[legal]` |
| d | `fr-fr` | 4 | t4 | draft | `[]` |
| e | `FR-fr` | 4 | t5 > t4 | stale | `[legal]` |

Oracle (`cmsLocaleVariantRead` rule, partition `(E, 'fr-fr')`): newest is e (v4, t5), stale, so `staleLegalFields` = 1. Gauge: the recursion visits `fr-FR`, `FR-fr`, `fr-fr` (each strictly after the previous in
the column collation; any order); `raw_head` = c (v3), e (v4, t5), d (v4, t4); `DISTINCT ON` keeps e; stale, one `no_fallback` member, count 1. If e were a draft the winner would be e and the count 0 even
though c is stale and newer than b: an older spelling cannot resurrect. I also ran the 300,000-world model (Evidence): 0 mismatches. pgTAP covers one transition only (V5-6); the SQL is correct for the rest.

**5b. The alert is stateless.** `locale-observability.ts` has no module-level mutable binding (the only `let` is `observation` inside `observe`, `:129`); on a failed read it builds a fresh
snapshot literal `{ localeObservabilityFailedReads: 1 }` (`:153-155`) and calls the pure, frozen-threshold evaluator (`cms-composition-alert-evaluator.ts:31-82`,
`cms-composition-alert-thresholds.ts:11-18`); the strict-above-zero rule is `evaluator:64-74`. The only cache in the wiring is `consumersFor(env)` (a `WeakMap`,
`production-async-entrypoint.ts`), which holds probe objects whose closure is `port`, `telemetry` and `clock`, nothing else. A grep of the lane's source files for mutable containers, `Date.now`,
timers, `globalThis`, KV or Durable Object finds none. Behaviour is pinned: two separate probe instances alert each time (`locale-observability-failures.test.ts:128-133`), one instance failing four
times alerts four times (`:135-140`), a failure after a success alerts (`:142-147`), a timeout, a malformed answer and an invalid scheduled time each alert (`:149-177`), one failure raises exactly
one allowlisted, schema-valid alert with no `metrics` member so the counter is not double counted (`:95-120`), and the policy carries no window key (`phase-02-slice-12-alert-policy.test.ts:157-180`).
No `failedAt`, `MAX_REMEMBERED_FAILURES`, `countFailedLocaleReadsWithin` or window constant remains anywhere (grep). Observation 1 is the one caveat (no delivery layer exists to dedupe).

### (6) The 5,000 ms Worker deadline: PASS

`LOCALE_OBSERVABILITY_READ_DEADLINE_MS = 5_000` (`locale-observability.ts:32`) is the second argument of `runWithDeadline` (`:132-135`), which aborts the signal at the deadline and clears its timer
in `finally` (`event-consumers/deadline.ts:8-19`). The production transport does not depend on `fetch` honouring the signal: the external abort rejects its own `deadline` promise, which is raced
against the fetch (`async-runtime-rpc-transport.ts:78-84,94-110`), and `createProductionEventConsumers` forwards the probe's signal (`event-consumers/production.ts:78-79`). The transport's own deadline
is 15 s (`async-runtime-rpc-types.ts:85`), so the probe's 5 s governs. An abort is a failed read: failed sample (counter 1, allowlisted fields, `retryable`), the unavailable alert, nothing thrown
(`:136-167`). Tests: constant named `locale-observability-probe.test.ts:272-274`; a read resolving at 4,999 ms is used `:276-297`; one that would resolve at 5,001 ms is a failed read with the counter, no
fan-out counter, no gauge, no stale alert `:299-325`; timeout alerts `locale-observability-failures.test.ts:158-171`. Entry wiring: hook type `async-entrypoint.ts:137-143`, contained IIFE
`:308-314`, awaited in `finally` `:320`, production binding `production-async-entrypoint.ts:142-143`; the cron is `* * * * *` in every environment (`wrangler.jsonc:36,63,93`), which is what the
tiling window assumes. The function-level timeout is gone, so on the database side the only bound is the cost bound of check 4 (observation 3).

### (7) Promotability: PASS

| Item | Result |
| --- | --- |
| Size | 29 / 109 / 100 / 49 lines (limit 300). |
| Timestamps | `20261022100000` < `100005` < `100010` < `100020`; unique across promoted and all WIP; newer than every promoted (`20261020203606`) and WIP (`20261022080500`) file. Dependency order is right: indexes, then the helper, then the reader that calls it, then the wrapper that calls the reader. |
| Promoted files | None edited (`git status`: only `supabase/migrations/README.md` is modified there; the untracked `2026101330xxxx` files are other lanes' applied migrations). All four files are new `create function` / `create index`; no `create or replace`; no backfill, no NOT NULL addition, no data rewrite. |
| Index build | Three plain `create index` on an append-only table under `lock_timeout = '5s'` and `statement_timeout = '2min'` (`100000:16-17`): a SHARE lock for the build, fail-fast and retryable on a busy writer. Names collide with nothing (grep). |
| Definer posture | All three functions: `SECURITY DEFINER`, `set search_path = ''`, owner `wejammin_cms_definer` through the repo's `grant create on schema … ; alter function … owner to … ; revoke create …` sequence (same as dec205 `20261022020010:27-29`), `proconfig = {search_path=""}` pinned. No dynamic SQL from input; the only `execute` is the fixed closure in `100020:40-47`. |
| Grants | Reader and helper: `revoke all … from public, anon, authenticated, service_role`, no regrant (pinned `001:5-13,24-33`). Wrapper: same revoke, `grant usage on schema platform_api to service_role`, `grant execute … to service_role` only (pinned `001:36-44`; role matrix `001:91-98`: `anon` and `authenticated` get 42501, `service_role` cannot call the private reader, can call the wrapper). `grant select` of the four tables to the definer matches the dec205 convention and is a no-op where already held. No grant to a browser role; RLS untouched and still forced. |
| Locks | The reader and the helper take no lock and write nothing (pinned `001:58-65`). BE03c/BE03b lock orders do not apply. |
| S09 pins (read, not run) | `sec2_definer_rls.sql:387-458` calls every `platform_api` function with NULL arguments under each API role: the wrapper is reached by `service_role` (answers `VALIDATION_FAILED`, no table read) and refused at the ACL for `anon` and `authenticated`; guard D (`:460-477`) passes by construction (the wrapper reaches the flag-setting reader by name and restores through `rpc_previous`). The all-schema pin (`sec2_all_schema_definer_rls.sql`) derives its function set from the catalog. Only `r8_api_surface` needs the root edit (V5-1). |
| Final-bytes evidence | One staged run on the final bytes, `233710-238690`, 14 files / 577 tests, PASS, manifest hashes equal to disk, reset log applies all four in order. |

## 3. Spec clause map (BE03c 1776, DEC-208 / 213 / 216 / 219 / 220)

| Spec clause | Implementation | Test |
| --- | --- | --- |
| Closed-open window `[T-3, T-2)`, consecutive ticks tile | `locale-observability.ts:59-73`; DB `100010:70-72` | `locale-observability.test.ts` window block; `003-window.sqlinc:84-100` |
| `created_at` is `clock_timestamp()` when the fan-out writer starts | comment `100010:6-9` | `006:79-89` (unpinned real row) |
| Internal RPC, SECURITY DEFINER over a private reader, `service_role` only | `100020`, `100010:86-90` | `001:5-13,36-44,91-98` |
| `VALIDATION_FAILED` unless whole minutes and exactly 60 s | `100010:49-62` | `002-refusals.sqlinc` (12 refusals, 3 acceptance controls, 4 DETAIL assertions) |
| No lock, no write; sets and restores the RPC context | `100010:64`, `100020:20-25` | `001:58-65`, `004-rpc-context.sqlinc`, `008:58-62` |
| Exactly `{fanoutRows, staleFieldsAppended, staleLegalFields}`, three non-negative integers, no id/locale/text | `100010:76-79` | `008:44-55`; Worker strict parser `locale-observability.ts:78-96` and its tests |
| `fanoutRows` counts `stale` rows in the window; `staleFieldsAppended` sums `jsonb_array_length` | `100010:66-72` | `003-window.sqlinc` (legacy `[]` row counts 1 row / 0 fields `:94-96`) |
| `staleLegalFields`: current row per entry and case-insensitive locale, `no_fallback` members in the active schema, active entries only (DEC-216) | `100005:34-87` | `005`, `006`, `008:41-42`, `007:58-59` |
| Three indexes (`state, created_at`; `lower(locale)` current row; plain `locale` head) | `100000:19-27` | `001:67-88` |
| Cost never grows with superseded or historical stale rows (DEC-219) | `100005` structure (check 4) | `007` (partial proof, V5-2) |
| Counters, gauge, alert above 0, labels never carry a locale | `locale-observability.ts:169-198`; registry `observability-registry.ts:76-86` | probe tests; `observability-registry.test.ts:41-62,134-175` |
| 5,000 ms abort is a failed read; failure counted and alerted per firing, no history; logged with allowlisted fields and swallowed (DEC-219/220) | `locale-observability.ts:32,132-167`; thresholds `:17` | probe `:243-330`; failures test; entrypoint tests |

## 4. Test-correction verdicts (lane report `## Test corrections`, both lists, plus DEC-220)

| # | File | Verdict | Reason |
| --- | --- | --- | --- |
| 1 | `apps/worker/src/cms-composition/observability-registry.test.ts` (V3 list item 1, extended by DEC-219) | **ACCEPT** | Additive and stricter: `cms_locale_stale_total: []` (DEC-208 drops its label), the gauge `cms_locale_stale_legal_fields: []` and the DEC-219 counter `cms_locale_observability_read_failed_total: []` join the exact-registry oracle (`:41-62`), named by BE03c 1776; `metricKeyConforms` accepts the three label-free keys and rejects `cms_locale_stale_total{locale="fr-FR"}` (`:134-175`); the no-event list shrinks to the linked-update counter because both locale counters now have a source (`:177-186`). |
| 2 | `apps/worker/src/production-async-entrypoint-event-consumers.test.ts` | **ACCEPT** | Adds the handler and the sorted RPC name of one scheduled tick; the list stays exact, so an extra or missing call still fails; required by BE03c 1776 ("on every firing"). |
| 3 | `apps/worker/src/index-scheduled.test.ts` | **ACCEPT** | The counts (9, 10) equal the lengths of the exact sorted name lists; not loosened. The file also carries other lanes' lines, which I did not review. |
| 4 | `tests/observability/phase-02-slice-12-alert-policy.test.ts` (DEC-219, DEC-220) | **ACCEPT** | The pinned thresholds gain `localeObservabilityFailedReads: 0` and no window key; the code list, `it.each` (observed 1, threshold 0), the order test, `healthy` and the NaN case gain the sixth condition; required by BE03c 1776 as amended by DEC-220. The DEC-219 window-edge tests were removed because DEC-220 removed the window; the behaviour that replaced them is pinned at the Worker (check 5b), so coverage moved, it was not lost. The remaining "no window key" assertion (`:175-179`) is weak on its own; the Worker tests carry the proof. |
| 5 | The lane's own probe and production tests (failed read now yields the failed sample AND the unavailable alert, 2 log lines; no stale alert on a failed read) | **ACCEPT** | The lane's own oracles, changed because DEC-220 requires the alert; they assert the stricter, spec-stated behaviour. |

Fixtures: replica-role use is accepted with the note in V5-4; no fixture inserts an active row, forges an approval or evidence, or disables a trigger by `ALTER TABLE … DISABLE TRIGGER`.

## 5. Brief checklist walk-through

1. Security: definer owner, `search_path`, revokes, `service_role`-only wrapper, no browser-role grant, forced RLS intact, no dynamic SQL, no PII (three integers), authority = the DEC-208 paragraph (internal, service role): PASS. The V3 failure (`app.cms_rpc`) is fixed (check 2).
2. Spec correctness: every sentence of BE03c 1776 is implemented and pinned (map above). Nothing invented beyond the helper function itself, which the spec does not name but permits ("a private reader"): its sole caller is the reader.
3. Promotability: PASS (check 7), with the root-owned S09 pin (V5-1) and the recommended comment edit (V5-3).
4. Locks: none taken.

## 6. What I did not verify

I ran no SQL, so the plan shapes (EXPLAIN) and the leakproof flags rest on the lane's diagnostic TAP (hash matches the lane report); the exact counter values of `007` are not printed in the TAP; behaviour of PostgREST on a client abort is not tested anywhere; the hosted PostgreSQL major was not checked against the local 17; I did not review the other lanes' lines in `index-scheduled.test.ts`, `async-entrypoint.ts` and `production-async-entrypoint.ts`. Note: another lane edited `async-entrypoint.ts` and `production-async-entrypoint.ts` at 03:56Z while I was reviewing (linked-scan and governed-recheck wiring); I re-read the locale lines afterwards (`async-entrypoint.ts:137-143,308-314,320`, `production-async-entrypoint.ts:142-143`) and they are intact; my 173-file Vitest run started after those edits and passed. The SHA-256 values for those two files in the scope table are the ones I computed at the start of the review.

Process note: three of my shell commands (the heredoc writes of this review's own scratch files `skipscan-model.mjs`, `part2.md`, `part3.md`) did not begin with the mandatory `cd /home/rob/.codex/worktrees/phase2-slice12/WeJammin &&` prefix. They wrote only absolute paths under the scratchpad's `review-v5/` directory and touched nothing in either checkout; every other command had the prefix.

## 7. Promotion verdict

- `claude_s12_dec208_obs`, SQL + pgTAP (four files): **PROMOTE.** Conditions that travel with the promotion (root-owned): V5-1 (S09 `r8_api_surface`: add the wrapper, 74 to 75) and V5-7 (BE03c grants list, AC-261); promote the whole `dec208/` directory (four files, not three: V5-5). Recommended before promotion because the file is immutable afterwards: the one-comment edit V5-3 and one staged run of the new suite.
- `claude_s12_dec208_obs`, Worker probe, alert policy, registry, shared wiring (locale lines only), READMEs: **PROMOTE.**
- Recommended follow-ups, not blocking: V5-2 (plan-agnostic counters and a window-query counter before the AC-052/263 evidence says "proof"), V5-4, V5-6, V5-8, and the catalog pin of observation 2.

## Appendix A: the selection model I ran (no SQL; reproduces the 0-mismatch result)

Saved for the reviewer who wants to re-run it: `PATH=/home/rob/.local/share/wejammin-toolchain/bin:$PATH node <file>.mjs`. It models only the selection algebra of `100005:34-87`; the SQL text itself is covered by the lane TAP.

```js
// Pure-JS model of the DEC-220 gauge selection (no SQL is run). It mirrors 20261022100005:
//   locale_key  = distinct raw locales of an entry by repeated "next raw locale > previous" (skip scan)
//   raw_head    = for each raw locale, the row maximal by (version desc, created_at desc, id desc)
//   head        = DISTINCT ON (entry, lower(locale)) ordered by (version desc, created_at desc, id desc) over raw_head
// and compares it with the oracle (cmsLocaleVariantRead rule): the maximal row per (entry, lower(locale)) over ALL rows.
let seed = 123456789;
const rnd = (n) => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % n; };
const spellings = ['fr-FR', 'fr-fr', 'FR-fr', 'Fr-Fr', 'FR-FR', 'de-DE', 'de-de', 'en', 'EN'];
const cmp = (a, b) => (a.version - b.version) || (a.createdAt - b.createdAt) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0); // ascending total order
const newest = (rows) => rows.reduce((m, r) => (m === null || cmp(r, m) > 0 ? r : m), null);
let worlds = 0, mismatches = 0, interleavedCasePairs = 0, tieVersionAcrossSpellings = 0;
for (let w = 0; w < 300000; w += 1) {
  const rows = [];
  const n = 1 + rnd(14);
  for (let i = 0; i < n; i += 1) {
    rows.push({
      id: String(1000 + i * 7 + rnd(5)).padStart(6, '0') + '-' + i, // unique
      locale: spellings[rnd(spellings.length)],
      version: 1 + rnd(5),          // small range => many equal versions across spellings
      createdAt: rnd(4),            // tiny range => created_at ties as well
      state: rnd(2) ? 'stale' : 'draft',
    });
  }
  // oracle
  const groups = new Map();
  for (const r of rows) { const k = r.locale.toLowerCase(); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); }
  const oracle = [...groups.values()].map(newest).map((r) => r.id).sort();
  // model of the SQL: skip scan over raw locales
  const rawLocales = [];
  let cur = rows.map((r) => r.locale).sort()[0] ?? null;                    // first_row: min raw locale
  while (cur !== null) {
    rawLocales.push(cur);
    const next = rows.map((r) => r.locale).filter((l) => l > cur).sort()[0]; // next_row: min raw locale > previous
    cur = next === undefined ? null : next;
  }
  const rawHeads = rawLocales.map((l) => newest(rows.filter((r) => r.locale === l)));
  const byLower = new Map();
  for (const h of rawHeads) { const k = h.locale.toLowerCase(); if (!byLower.has(k)) byLower.set(k, []); byLower.get(k).push(h); }
  const model = [...byLower.values()].map(newest).map((r) => r.id).sort();
  worlds += 1;
  if (JSON.stringify(oracle) !== JSON.stringify(model)) mismatches += 1;
  // coverage of the adversarial shape: some group has >= 2 raw spellings whose rows interleave in version order
  for (const g of groups.values()) {
    const sp = new Set(g.map((r) => r.locale));
    if (sp.size >= 2) {
      const sorted = [...g].sort(cmp);
      let interleaved = false;
      for (let i = 1; i < sorted.length; i += 1) if (sorted[i].locale !== sorted[i - 1].locale) interleaved = true;
      if (interleaved) interleavedCasePairs += 1;
      const maxPerSpelling = [...sp].map((s) => Math.max(...g.filter((r) => r.locale === s).map((r) => r.version)));
      if (new Set(maxPerSpelling).size < maxPerSpelling.length) tieVersionAcrossSpellings += 1;
    }
  }
}
console.log(JSON.stringify({ worlds, mismatches, interleavedCasePairs, tieVersionAcrossSpellings }));
```
