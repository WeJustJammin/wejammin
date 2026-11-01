# Lane bench2 report (P2-S09-AC-217 in the canonical SQL suite, Slice 11 branch, 2026-10-11)

Worktree `/home/rob/.codex/worktrees/phase2-slice11/WeJammin`, branch `claude/phase2-slice11`. Started at `813fcafd`; HEAD moved to
`6af4f106` while I worked (other lanes). Nothing staged, committed, stashed or reset by this lane. The primary checkout was not touched.
Logs, probes, job scripts and the mutation harness are in `docs/handoffs/2026-10-10-claude-s11/lane-bench2-logs/` (README there).

Result: in-suite reproductions of the canonical suite (reset, the 94 test files that sort before the bench file, the unmodified bench
file) went from create128 p95 237 / 248 / 272 ms and activate p95 255 / 264 / 278 ms to **create128 p95 189.4 / 204.7 / 184.0 ms and activate p95
117.2 / 119.4 / 114.2 ms** (p50 159 / 163 / 159 and 96 / 102 / 99 ms), every run with the quiet lock held exclusively. One new forward
migration, one new test suite. Behaviour is unchanged and proven against the verbatim previous body.

## 1. Cause of the in-suite slowdown

I could not reproduce a state-dependent regression, and there is none to fix with an index. Evidence (all runs under the exclusive quiet lock,
alt stack, `diag-20261011-041329.*` in the logs):

- State after the 94 preceding files (65 s of tests): `probes/probe-state.sql`, `diag-...summary.v1-state`. Database 42 MB; the largest of
  the 210 user tables is 264 kB in total; `cms_field_definition_versions` heap 8 kB with 19 dead tuples; 878 dead tuples in the whole
  database; 47 autovacuum and 8 autoanalyze runs already done; no autovacuum worker running when the bench starts. Every test rolls back
  (the only commits are the two header commits), so the suite leaves registries and dead tuples, nothing that grows.
- `ANALYZE` (v2) and `VACUUM (ANALYZE)` (v3) between the prefix and the bench changed nothing: create128 223.0 / 305.3 / 405.0 and
  219.2 / 276.6 / 289.1 ms (p50 / p95 / max), against 242.5 / 271.9 / 280.9 pristine.
- Plans are identical. `EXPLAIN (ANALYZE, BUFFERS)` of the 128-row field insert (`probes/probe-plans.sql`): Function Scan, Insert, the same
  five triggers, 1,260 to 1,766 shared hits, no scan of any grown table (there is none). Insert execution 68.2 / 69.0 / 72.7 ms in-suite
  against 61.0 / 62.0 / 67.8 ms on a fresh reset (`diag-...suite-plans2`, `w1-...w1-fresh-plans`).
- Same-session controls: fresh reset then bench, create128 204.0 / 237.8 / 262.5 and 203.7 / 240.0 / 302.4; in-suite (base2, base3)
  209.3 / 236.8 / 245.5 and 214.1 / 247.9 / 294.0. Against those controls the in-suite penalty at p50 is 3 to 5 percent in the two later runs and 8 to 19 percent in the first three (v1 to v3), which ran minutes earlier in the same job: a drift of the host, not of the database (ANALYZE and VACUUM did not move it). The canonical run (223.0 / 309.5 / 321.9) and
  my v2 run (223.0 / 305.3 / 405.0) sit in the upper tail of the same distribution. `percentile_cont(0.95)` over n = 25 samples interpolates
  between the second- and third-largest sample, so two or three slow samples decide it, and the old cost left only 60 to 90 ms of
  margin to the 300 ms assertion.
- Where the time goes (function-level profile, `track_functions`, `probes/probe-func-prof.sql`, in-suite, ms per call of the command):
  create128 211 total: `cms_valid_field_input` 61.7 (128 calls), `cms_jcs` 29.8, `cms_json_bounded` 35.4 (385 calls), `cms_active_parent_guard`
  20.2, `cms_reserved_key` 19.4 (0.15 ms per call), `cms_activation_review_invalidation_trigger` 19.0, `cms_rpc_context_valid` 16.5.
  activate 227 total: `cms_activation_references_valid` 183.2, of which `cms_valid_field_input` 130.1 (256 calls: every manifest field, then every stored row),
  `cms_reserved_key` 39.7, `cms_json_bounded` 24.6, `cms_exact_keys` 20.8, `cms_valid_uuid` 20.1. Dry run, submit and decide show no validator calls in their profiles.

So the fix is the product's CPU cost, not a table or plan.

## 2. The fix

New: `supabase/migrations/20261010167000_cms_valid_field_input_fast_accept.sql` (about 320 lines). `CREATE OR REPLACE` of
`platform_private.cms_valid_field_input(jsonb, boolean)` only. The body opens with an early accept: one boolean conjunction that
returns `true` for the common field shape (complete-definition form, a scalar kind, no default value, no validator pair, constraints within
`minLength` / `maxLength` / `minimum` / `maximum`, a well-formed `editorConfig`). Each conjunct is at least as strict as the rule of the same name
in the full body (digit bounds are written as the digit patterns that satisfy them; lists, objects, enums, literal defaults, protected validators
and the incremental `p_require_stable_id = false` form are left to the full body), so it can only answer `true` for what the full body also
accepts. Every other input, every refusal included, runs the previous statements unchanged, nested one block deeper so that the cast-error handler
still wraps exactly them. It calls `pg_catalog` built-ins and operators only (the uuid pattern and the 54 reserved words are written inline), so no
role needs a new EXECUTE grant. The migration pins before replacing: md5 of the installed `prosrc` (`f3fbc53f...`, the body of
`20261005010100`), owner `postgres`, IMMUTABLE, not SECURITY DEFINER, `search_path = ""`, ACL `{postgres=X/postgres,wejammin_cms_definer=X/postgres}`, and after the
replacement compares every `pg_proc` column except `prosrc`, plus the comment, to the captured original. One PL/pgSQL fact is worth the
parentheses in the source: an `IF` condition ends at the first `THEN` outside parentheses, so the two `CASE` expressions are parenthesized (my first apply failed on it).

Not done (and not needed for the target): the field-insert row triggers (`cms_active_parent_guard`, the invalidation trigger: 39 ms per create), the
256 `cms_json_bounded` calls of the table CHECKs (24 ms), `cms_jcs` (29 ms) and the RLS policy function `cms_rpc_context_valid` (16.5 ms).
The trigger catalog is pinned by `phase_02_slice_09_dec108/06-trigger-probes.sqlinc` (names and types), so only a function-body change is open
there; see Open items.

## 3. Method, RED and GREEN

1. Suite first (`supabase/tests/phase_02_slice_09_valid_field_input_fast_accept.sql`, includes in `.../phase_02_slice_09_valid_field_input_fast_accept/`):
   installs the verbatim previous body as `cms_valid_field_input_legacy` (md5 asserted equal to the one the migration pins), builds a corpus of
   3,383 field inputs (the base, every variant of each of 13 members alone, 3,000 deterministic mixtures with a fixed seed, non-object inputs, and every
   word `cms_reserved_key` refuses in three spellings, read from that function), and requires the same answer (or the same SQLSTATE) from both functions
   for `p_require_stable_id` true, false and NULL. A counting copy of `cms_exact_keys` (this transaction only) shows which inputs took the early accept:
   none that the previous body refuses, 620 of the 625 it accepts, the 128-field benchmark shape and 60 authored shapes.
2. RED: `red-fast-accept-1.tap` (before the migration existed): 18 ok, 6 not ok, all for the right reason: the installed body is still the previous one
   (`have: f3fbc53fdde3f16a338c3edadc94a02b`), the early accept is taken on 0 inputs (`not ok 15`), the base field (`not ok 17`) and the 164 benchmark and authored shapes
   (`not ok 18`, `have: 0 want: 164`) do not take it. (`not ok 5` was an expectation bug of mine, a NULL ACL on the freshly created copy; fixed to the literal ACL, not loosened.) The
   equality assertions pass trivially before the migration, as they must.
3. GREEN: `green-fast-accept-3.tap` (final file, alt stack after a reset to the tree): `Files=1, Tests=24, Result: PASS`; `corpus: 3383 inputs, previous body
   accepts 625 and refuses 2758; early accept on 620, full rules on 2763`.
4. Mutation proof (`mutants-fast-accept.py`, verdicts in `mutants-fast-accept-verdicts.txt`, one TAP per mutant): 40 mutants loosen or break one conjunct of the installed
   function inside the test transaction. 37 are killed (the equality or the soundness assertion fails): uuid check, version and variant nibble, reserved list (all
   spellings, one word), key length bounds, kinds (`list`, `object`, any string), constraint keys, byte bound, digit patterns, min/max order, types, default
   mode / value, localization, lifecycle, validator pair, top-level and `editorConfig` extra keys, label and helpText lengths and types, `order` bound and type. Three survive and are
   equivalent mutants: `m05` (drop `lower()` of the key: the key pattern already forces lowercase), `m31` (drop the `label` key from the `?&` list: the next conjunct,
   `jsonb_typeof(label) = 'string'`, already refuses a missing label), `m39` (ignore `p_require_stable_id`: an input accepted early is also valid in the incremental form,
   so the answers still agree; the guard stays as the conservative choice). Two mutants needed corpus or shape additions after the first pass (`m17`: `{"maxLength":"5"}`;
   `m34`: an NFD label whose raw length exceeds 120 and NFC length does not) and the anchors of five were repaired (`ANCHOR-ERROR` in `mutants-fast-accept.out`, rerun in `-2.out`).

## 4. Benchmark evidence

Every run below held `/tmp/wejammin-quiet.lock` EXCLUSIVELY (`b2lib.sh`: quiet lock, then the alt-stack lock, reset under the reset lock, wait for the 1-minute load average below 1.5,
the unmodified `phase_02_slice_09_evidence_bench128.sql`, 25 samples, all 15 assertions pass in every run), on the second (alt) stack. In-suite = reset, then the 94 files
that sort before the bench file, in pg_prove's order, then the bench. Waiting for the exclusive lock took 56 and 50 minutes behind other lanes' shared holders. create128 / activate, ms:

| Series | Run | load before -> after (1 min) | create128 p50 / p95 / max | activate p50 / p95 / max |
| --- | --- | --- | --- | --- |
| before | v1 (diag job) | 1.40 -> 1.82 | 242.5 / 271.9 / 280.9 | 236.8 / 278.2 / 294.5 |
| before | base2 | 1.47 -> 1.78 | 209.3 / 236.8 / 245.5 | 208.1 / 264.4 / 269.2 |
| before | base3 | 1.40 -> 1.75 | 214.1 / 247.9 / 294.0 | 217.4 / 254.9 / 265.1 |
| before (extra) | v2, after ANALYZE | 1.47 -> 2.20 | 223.0 / 305.3 / 405.0 (assertion fails) | 218.1 / 274.1 / 314.1 |
| before (extra) | v3, after VACUUM (ANALYZE) | 1.44 -> 2.16 | 219.2 / 276.6 / 289.1 | 217.0 / 270.2 / 290.3 |
| before (reference) | canonical gate `claude-dbverify-20261011-035212` | 1.28 at start | 223.0 / 309.5 / 321.9 (assertion fails) | 216.5 / 276.9 / 360.6 |
| control | fresh reset, bench only (x2) | 1.49 -> 1.68, 1.41 -> 1.73 | 204.0 / 237.8 / 262.5 ; 203.7 / 240.0 / 302.4 | 213.1 / 252.6 / 277.3 ; 210.4 / 270.1 / 295.9 |
| **after** | w1-r1 | 1.48 -> 2.00 | **159.1 / 189.4 / 210.1** | **95.8 / 117.2 / 127.1** |
| **after** | w1-r2 | 1.48 -> 1.75 | **163.0 / 204.7 / 210.5** | **101.8 / 119.4 / 131.3** |
| **after** | w1-r3 | 1.48 -> 1.52 | **158.5 / 184.0 / 194.8** | **99.2 / 114.2 / 116.3** |

Target (<= 260 ms p95 for both, three runs): met, with 55 ms of margin on create128 and 140 ms on activate; the assertion budget is 300 ms. The other operations of the chain did not change in kind (p95 dry_run 118.5 to 125.3, submit 121.7 to 132.0, decide 66.8 to 70.1 ms). The function profile after the fix (same in-suite state, `w1-...w1-suite-func`): create128 153.5 ms, `cms_valid_field_input` 6.1 ms
(0.048 ms per call, from 61.7); activate 103.2 ms, `cms_activation_references_valid` 60.8 ms, `cms_valid_field_input` 14.3 ms (from 130.1).
Exclusive holds: diag job 05:09:46 to 05:53:08 (local time), w1 job 07:07:29 to 07:23:24. HEAD during the w1 job was `6af4f106` with 17 dirty files of other lanes, none under
`supabase/` except my three. The migration text differs from the one measured only in comments (the header and one comment inside the function body; a wrong sentence about dry run and submit was corrected after the measurement; the SHA of the file changed, the code did not); the test file's three runtime-numbered titles were made constant after the measurement.

A shared-lock regression chunk that contains the bench file failed its timing assertion once (`regress-final-chunk1.tap`, create128 222.2 / 382.1 / 437.5) while the host load average was
7, with another lane's database tests running; the chunk took 199 s against 104 s the first time. That is the noise the quiet lock exists to keep out, not a result; the clean re-run is below.

## 5. Verification run

- Alt-stack regression of every Slice 09, 10, 11 and 12+ pgTAP file (296 files; the pg_prove image truncates arguments when the command line is long, so `regress.sh` runs five chunks of at most 60 files
  after one reset): first run on the migration `regress-w1-chunk1..5.tap`: 11,732 tests, all five chunks PASS. Final run `regress-final-chunk1..5.tap`: chunks 2 to 5 PASS (9,009 tests);
  chunk 1 failed only the load-sensitive bench assertion described above; the quiet re-run of chunk 1 (`chunk-job.sh`, quiet lock exclusive, reset, load 1.39 before) is `chunk1-final-*.tap`: 60 files, 2,723 tests, PASS, bench in that run create128 161.5 / 203.3 / 217.0 ms and activate 102.2 / 125.1 / 154.2 ms.
- New suite `green-fast-accept-3.tap` PASS (24 tests); the create parity suite (157 assertions) and the manifest-bound parity suite, the R14 `cms_json_bounded` catalog guards and the canonical-JSON
  equivalence suite are in the 296.
- `supabase db lint --level warning` on the alt stack, schemas `platform_private,audit_private,platform_api,public_api`: exit 0, one warning, in `cms_resolve_relation_targets`, not mine (`db-lint-w1.out`).
- Vitest (`flock -s`): `tests/contracts/phase-02-slice-09*`, `phase-02-slice-10-process-record`, `phase-02-slice-11-sql-parity`, `tests/database-harness-contract.test.ts`,
  `tests/security/phase-02-slice-09-release-boundary.test.ts`: 109 files, 106 pass, 3 fail (`vitest-contracts.log`), none a behaviour regression: (a) `phase-02-slice-09-marker-citations` AC-1149:
  AC217 is carried by `phase_02_slice_09_create_draft_parity.sql`, `..._parity_manifest_bound.sql` (first bench lane) and `phase_02_slice_09_valid_field_input_fast_accept.sql` (this lane) but not cited
  by the AC-217 entry; (b) `phase-02-slice-09-receipts-guard` AC-1144: 22 stale receipts for files I did not touch (`phase_02_slice_09_p240_a03_relation.sql`, `..._evidence_trigger_catalog.sql`,
  `..._r8_api_surface.sql`, ...: "the file changed after the run"); (c) `phase-02-slice-09-phase-completion-policy` AC-1144: a 15 s timeout under load, passes alone (14 of 14).
- Not run: `pnpm db:verify`, `pnpm validate`, race runners (no table, trigger or lock order changed), evidence collectors.

## 6. Added tests (no existing test changed or loosened)

`supabase/tests/phase_02_slice_09_valid_field_input_fast_accept.sql`, 24 assertions, all carry `[P2-S09-AC-217]`: `fixture: the legacy copy is the body that 20261010167000 pins by md5 before
replacing it`; `the installed cms_valid_field_input carries the early accept, not the previous body`; owner; flags and signature; ACL; no API role or other dedicated role can execute it; comment survived;
`fixture: the corpus holds ...`; `p_require_stable_id = true / = false / = NULL: the current function answers exactly what the previous body answers on every corpus input`; `the comparison is not vacuous`;
`the previous body raises on no corpus input`; `soundness: no input the previous body refuses is accepted early`; `the early accept is taken on at least 400 corpus inputs`; `the full rules still decide at least
1,500 corpus inputs`; `the base field is accepted early`; `every benchmark and authored field shape is valid and takes the early accept`; `a field that carries a literal default is decided by the full rules`;
`a list field (itemKind) is decided by the full rules`; `a field bound to a protected validator is decided by the full rules`; `a key that merely resembles a reserved word ... is accepted early`;
`a reserved key is never accepted early`; `and is refused, as before`. Includes: `00-legacy-body.sqlinc`, `01-corpus.sqlinc`, `README.md`.

## 7. Spec lines satisfied

BE03a `.memory/wiki/specs/be/03a-content-schema-registry.md:2767` (RPC p95 < 300 ms, 128-field schemas); P2-S09-AC-217 (`phases/phase-2.md:1778`) in the canonical suite, not only in isolation.
Unchanged and re-proved: the field-definition rules of BE03a CMS-03A-01 / -02 / -04 (accept and refuse sets of `cms_valid_field_input`), DEC-133 (list and object structure), DEC-146 (protected validators), the 512 KiB bound.

## 8. Open items for the orchestrator

1. Evidence ledger (not my file): `tests/contracts/phase-02-slice-09-amendment-evidence.ts`, entry `P2-S09-AC-217`, `testFiles` must add `supabase/tests/phase_02_slice_09_create_draft_parity.sql`,
   `supabase/tests/phase_02_slice_09_create_draft_parity_manifest_bound.sql` and `supabase/tests/phase_02_slice_09_valid_field_input_fast_accept.sql`, and the limitation text can name migrations
   `20261010166000`, `166100` and `167000`. The receipts need regeneration after the final `pnpm db:test:tap`.
2. Docs (not my files): `supabase/migrations/README.md`: "`167000` (lane bench2, `../tests/phase_02_slice_09_valid_field_input_fast_accept.sql`): AC-217. `cms_valid_field_input` accepts the
   common field shape through one boolean conjunction before the full rules; identical answers, proven against the verbatim previous body on 3,383 inputs." `supabase/tests/README.md`: the new suite and its include directory.
3. Remaining cost, if more margin is ever wanted (create128 is 153 ms in the profile): the two field-insert row triggers (39 ms: a cheaper body for INSERT, or a transaction-local "fresh draft" hint set by
   `cms_create_type_draft`, which is a trust decision I did not take), the 256 `cms_json_bounded` CHECK calls (24 ms: a flat-document fast path, equivalence-tested like this one), `cms_jcs` of the field array (29 ms).
   The early accept could also cover `p_require_stable_id = false` (mutant `m39` shows it is sound).
4. The first bench lane's migration `166100` decision is unchanged; this change is independent of it.

## 9. Deviations and incidents, for the record

- The shared session scratchpad directory is used by other lanes. In my first minutes I wrote `order.txt`, `order2.txt` and `sorted.txt` there (file lists for the prefix); if another lane had files of those names they were
  overwritten. Everything after that is under `scratchpad/bench2-lane/`.
- Probes that need a superuser GUC (`pg_stat_statements.track`, `track_functions`) connect as `supabase_admin` and `SET ROLE postgres` for the fixtures and commands (the bootstrap fixture requires `current_user = 'postgres'`);
  alt stack only, everything rolled back. The first attempt failed on the GUC (`diag-...fresh-prof.tap`) and was repeated in the same exclusive hold.
- I used `lane-bench-logs/altrun.sh` (from the first bench lane) for exclusive jobs and for shared runs, and the stock `lanes/lane-db-alt.sh` once (no tests ran: the image truncated the long argument list).
  A few TAP files first landed in `lane-bench-logs/` and were moved; nothing there changed. I ran `supabase db lint` against the alt stack under both locks (read only).
- My own waiting jobs were stopped with `kill <pid>` (no `pkill`). `ls` is aliased to `eza` in this shell; use `find` for listings.
- Host state at the end: the alt stack is reset to the tree (all migrations including `167000`); the main stack was not touched.
