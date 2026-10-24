# Lane claude_s12_fixture_repair report

## Status
GREEN for the brief's scope (2026-10-15 16:51Z). Lane `none`, base HEAD b16edb54, `supabase/migrations/` as promoted (WIP pattern-updates 14/15 and locale-gate excluded).
All fixture breakages from the promoted placement (DEC-185) and taxonomy-terms migrations are repaired; the 78-file run (r8 as pgtap leader + every suite that includes the touched helpers)
is 2989 tests with exactly four not-ok, all known-unpromoted locale-gate dependencies (none a fixture breakage). No file aborts part-way any more.

## Scope
`briefs/fixture-repair.md`. Fixture-only edits (no oracle weakened, no assertion changed, no migration/contract/Worker/Web file touched), each a Test correction below.

## Files
| path | lines | SHA-256 |
|---|---|---|
| `supabase/tests/phase_02_slice_11_helpers/001-world.sqlinc` | 384 | `d199d842aeadf40ba87f13cdba29b8aa898b9de5adc91832263f2def01f0d759` |
| `supabase/tests/phase_02_slice_11_helpers/003-registry.sqlinc` | 118 | `f4394245300ac9873b906d66fdd384e0004324b870d4eada5da871216aabce35` |
| `supabase/tests/phase_02_slice_10_signed_read/002-compare-helpers.sqlinc` | 122 | `080a0b86c04b53981a5c31644aa76f5ca4b080e5ae9983203582b9ba0096e5c5` |
| `supabase/tests/phase_02_slice_11_e2_composition_guard.sql` | 96 | `9fb9fd950c5aca3d27a002f588a19e1babb7b023686bf258e2691c331ddaa6d6` |
| `supabase/tests/phase_02_slice_11_helpers_manifest.sql` | 695 | `1ca81626cd6762ea7876f8ebf872cd4165bc00c628bd349c28e4cd816f47d407` |
| `supabase/tests/phase_02_slice_11_recheck_index.sql` | 156 | `c56804bed5e2369c91913f886956e8d5427e931b1be26ed66b0b23e2eeba8008` |
| `supabase/tests/phase_02_slice_11_recheck_run.sql` | 388 | `365572720e531f722987a76f6f6b35456de324c18ba818d6ad54c9d3937cf3f3` |
Several of these also carry earlier lanes' edits (git diff against HEAD is wider than this lane's changes).

## Runs
| # | time (Z) | lane | files | result | TAP sha256 |
|---|---|---|---|---|---|
| 1 | 16:48-16:51 | none | `phase_02_slice_09_r8_api_surface.sql` (leads: installs pgtap) + 77 files: every `.sql` that `\ir`s/names `phase_02_slice_11_helpers`, `002-compare-helpers`, `phase_02_slice_10_signed_read`, `001-world`, `003-registry`, plus the three term suites and e2_composition_guard (list: scratchpad `claude_s12_fixture_repair/files.txt`; `phase_02_slice_12_locale_gate` excluded, needs the unpromoted locale-gate pair) | 78 files, 2989 tests, 4 not ok: `criteria_publish_gates` #32, #33; `helpers_preflight` #14, #94. `.lane-logs/alt-staged-none-124835-2362661.tap` | `cf251c3ae1da0bfcc6e64201a199f902a9e0120df4313fb32b7cd68894eeed79` |

No RED baseline run was taken by this lane: the RED state is the pins-b run 3 (`alt-staged-none-123829-2307518.tap`, sha `357e7c73...`): helpers_references aborted at :101 (16 tests), helpers_preflight at :421 (82 of 165),
helpers_manifest at :56 (7 of 92), recheck_index (15 of 17), recheck_run (8 tests), e2_composition_guard #5/#7 (23502). After the edits all of these run to their full plan.
Before/after: helpers_manifest 92 planned, 7 ran -> all ran, 0 failed; helpers_references 16 ran -> all, 0 failed; helpers_preflight 82 ran -> 165, 2 failed (#14, #94 below); recheck_index and recheck_run -> full plan, 0 failed;
e2_composition_guard 2 failed -> 0.

Classification of the 4 remaining not-ok (none a fixture breakage, none fixed, all unchanged since the baseline-repair/pins-b reports):
- `helpers_preflight` #14 (registry vs TypeScript registry) and `criteria_publish_gates` #32/#33: need the unpromoted locale-gate pair (owner decision F4).
- `helpers_preflight` #94 (`have locale:failed/provider_unbuilt_reference`, `want locale:failed/no_fallback_missing`): it was hidden behind the abort at :421 in pins-b run 3. Its own message states the dependency: `cms.locale.no_fallback_gate` replaces the reference gate, P2-S12-AC-240,
  i.e. the same unpromoted locale-gate migrations as #14/#32/#33. Genuine missing (unpromoted) feature, not harness. Expected to clear on locale-gate promotion; confirm on the first post-promotion run.

## Test corrections
All fixture-only; no assertion text, plan or expectation changed.
1. `composition_instances.position` (NOT NULL, `check (position >= 0)`, no default; `20261014110000`, DEC-185, BE03c 1463: "the authored order of a row within its (revision_id, slot_key) ... consecutive positions starting one above the slot's greatest (0 for an empty slot) ... the position of a path never changes"). The column is non-unique (index only), so the value is chosen to follow the rule, not a constant:
   - `001-world.sqlinc` `h11w_instance`, `003-registry.sqlinc` `h11m_instance`, `e2_composition_guard.sql` `e2_instance`: `position` = the existing position of the same `(revision_id, 'primary', path)` row if any, else `coalesce(max(position) + 1, 0)` over the revision's `primary` slot.
   - `002-compare-helpers.sqlinc` `s10_sql_instances` (set-based generator): `position` = `coalesce(max(position)+1, 0)` of the revision's primary slot plus `dense_rank() over (order by <path expr>) - 1` (paths in path order = the pre-migration render order, versions of one path share a position; `p_path_expr` is now passed to `format` twice).
   - `helpers_manifest.sql` two `generate_series(1, 128)` bulk inserts (distinct paths `/p<n>`, fresh revisions `big`, `big2`): `position` = `n - 1`.
2. `cms_terms.taxonomy_id` (NOT NULL; `20261014120000`, BE03c 1371/1428; "the version-1 row's id is its lineage id", `20261014030000`). `h11_raw_exec` disables all user triggers, so the BEFORE INSERT `cms_terms_00_lineage_fill` cannot run for raw term rows; the lineage fill is not re-enabled or bypassed for any suite, the rows name it explicitly:
   `'taxonomy_id', pg_temp.h11w_uuid('tax1')` (tax1 is the version-1 row, so its id is the lineage) added to the raw term images in `helpers_manifest.sql`, `recheck_index.sql`, `recheck_run.sql`, with a comment. The composite FK `(taxonomy_version_id, taxonomy_id, owner_id)` verifies the value against the live version row.
   `helpers_references.sql:126` uses a plain insert (trigger enabled) and needed no change.

## Spec citations
BE03c 1463 (CompositionInstance: `position` NOT NULL, placement rule, path position immutable), BE03c 90/160/1541 (consecutive positions, DEC-185), `20261014110000_cms_composition_instance_position.sql` (backfill = dense rank of path per (revision, slot), COLLATE "C"),
BE03c 1371/1428 and `20261014120000_*` header (taxonomy_id lineage, trigger fill), `20261014030000` (taxonomy_id = version-1 row id).

## Open items / BOUNDARY
1. Brief item 4 (six `function plan(integer) does not exist` files): NOT canonical failures. `pnpm db:test` = `supabase test db --local`, i.e. `pg_prove -r --ext .sql` over all of
   `supabase/tests` in sorted order (the staged runner uses the same pg_prove image). pgTAP is installed by `create extension if not exists pgtap` inside each file's own transaction
   (rolled back, so it vanishes) EXCEPT in files that issue it as an autocommit statement before `begin;`: scanning all 407 root `*.sql` files, the first such persister in sort order is
   `ac265_hosted_artifact_source_authority_concurrency.sql` (line 9, outside any transaction; the 7th file), which sorts before `authentication_foundation`, `login_methods_account_merge` and
   `phase_02_slice_03_*`. So in the full canonical run pgtap is present for all six; they fail only in a hand-picked partial list that does not lead with a persisting file. No change made to those files.
   Caveat: this depends on the ac265 concurrency file staying early and green in the canonical run; if it is skipped or fails before line 9 the six break. Root may want a persisting install
   (a `commit;create extension...;commit;` prefix as `phase_02_slice_09_r8_api_surface.sql` has) in `authentication_foundation.sql`; not done (outside the brief).

## Requests to root
1. Review the exception edits: the five shared helper files (`phase_02_slice_11_helpers/001-world.sqlinc`, `003-registry.sqlinc`, `phase_02_slice_10_signed_read/002-compare-helpers.sqlinc`, plus `helpers_manifest.sql`) edited under the brief's explicit exception.
2. Decide whether to harden brief item 4: add the `commit; create extension if not exists pgtap with schema extensions; commit;` prefix (as `phase_02_slice_09_r8_api_surface.sql` has) to `authentication_foundation.sql` so it does not depend on `ac265_hosted_artifact_source_authority_concurrency.sql` having run first. Not done.
3. Locale-gate promotion (F4) clears `helpers_preflight` #14/#94 and `criteria_publish_gates` #32/#33 together; re-run those two suites then.
4. Other lanes' newer fixtures (`phase_02_slice_12_*` helpers that insert instances/terms) were not touched; the five Slice 12 suites that include the Slice 11 helpers passed in run 1.
