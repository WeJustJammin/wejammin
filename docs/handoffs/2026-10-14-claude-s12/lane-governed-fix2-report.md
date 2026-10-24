# Lane governed-fix2 - the governed digest recompute refuses a deprecated block

- Date: 2026-10-14
- Lane: `claude_s12_governed_fix2_sql` (staged-runner lane `governed-fix2`), model Sonnet 5.5
- Worktree: `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`, branch `claude/phase2-slice12`, HEAD `b16edb54a7a1b698ed8ca15b6085046d4270626e`

## Status

GREEN. Final run G2: 4 files, 481 tests, 0 failures, no harness abort. RED was observed first for the right reason
(the governed recompute raised CONFLICT for a deprecated block; the governed submit of a pattern over a deprecated
block was refused). A pattern over a signed supported-to-deprecated block now goes draft -> review -> approved ->
active through the real governed commands.

## Scope

One defect: `platform_private.cms_governed_current_digest` pattern branch raised CONFLICT for any block whose current
lifecycle is not `supported`, so a pattern draft over a deprecated block (created by CMS-03C-12, BE03c 396, 1361)
could never be submitted. Fix: refuse only `withdrawn` (missing already raises VALIDATION_FAILED); the tuple folds
`deprecated` (`coalesce(current_lifecycle,'supported')`, already there after `20261014040000`), the form
`cms_pattern_registry_digest` produces.

Decisions:
- Anchored patch, not a full redefinition. One anchor, asserted exactly once; `already applied` is detected by the
  replacement text; every `pg_proc` attribute except `prosrc` is compared before and after; fails loud (55000).
  Why: the template branch, taxonomy branch, per-block lock and every other statement of the applied body then stay
  provably identical, which a full redefinition could only assert. It also composes with `20261014040000` without
  restating its two patches.
- Withdrawn keeps its token (`CONFLICT`, P0001). The brief changes only deprecated; the frozen recheck maps any raise
  to `changed`; creation already refuses withdrawn as VALIDATION_FAILED. Not a spec-defined token at the recompute.
- Template and taxonomy digests stay byte-identical: PROVEN two ways. (a) md5 of the live function source before the
  `elsif p_kind = 'pattern_version'` branch (`28ad23e7...`, 316 bytes) and from the closing `return ...(tuples)` block
  (`d3efc219...`, 82 bytes) equals the md5 of the same text taken from the applied `300400` file (computed by script,
  not from the function under test; both pass on the live body in RED and GREEN). (b) The existing behavioral cases
  (#15 template delegates to `cms_template_block_digest`, #16 taxonomy NULL) still pass. The pattern branch changes
  only for a deprecated block, which previously could not return a digest at all.

## Files

| Path | Lines | SHA-256 |
| --- | --- | --- |
| supabase/migrations-wip/governed-fix2/20261014080000_cms_governed_digest_deprecated_block.sql | 64 | 33a2a2ed4aec5bc6a0e35a0f34e4569fcf40df70be56490f882065706b6cbfe8 |
| supabase/tests/phase_02_slice_12_governed_fix.sql (two `\ir` lines added; plan stays no_plan) | 28 | cb9cdf779605022708b265c6c47a3bf51f10c2093ab4c75f0978fb1f4866a05a |
| supabase/tests/phase_02_slice_12_governed_fix/020-deprecated-digest.sqlinc (new, 14 cases) | 80 | 9d34e13334e38a36d279ddf606e79896dc30c596ee68a16264b92dcadec988b4 |
| supabase/tests/phase_02_slice_12_governed_fix/030-replay.sqlinc (new, 4 cases) | 124 | 41f98e6d6aad0f8c4b8378a60f302f9fd5fc57ae9d8fa4b036ad7493ce3d2f7a |
| supabase/tests/phase_02_slice_12_governed_fix/deprecated-pattern-flow.sql (new, standalone, 30 cases) | 156 | 000070876a40e491b07e5689f08ae16cda632140ff9dff6cb16bad2724c340e0 |
| supabase/tests/phase_02_slice_12_governed_fix/README.md (section appended) | 34 | 9d3585c9f7592feaf2e6718a976f70b50ba613ae4f94df89781b6f2612be81c7 |
| docs/handoffs/2026-10-14-claude-s12/lane-governed-fix2-report.md | this file | - |

Untouched and byte-identical (SHA-256 equal to the governed-fix lane report): `000-blocks.sqlinc`
(`4f85cbcb...`), `005-submit-source.sqlinc` (`3ec4d35e...`), `010-digest.sqlinc` (`33ff685e...`); the 18 existing
cases are #1-18 of the main suite and pass in every run. The main suite file itself gained only
`\ir .../020-deprecated-digest.sqlinc` and `\ir .../030-replay.sqlinc` before `finish()` (its pre-edit SHA was
`fa39e987...`).

Standalone placement: `deprecated-pattern-flow.sql` lives in the claimed directory (precedent:
`phase_02_slice_12_pattern_definition/populated-lineage.sql`), sets `s12pd.type_count = 2` and reuses the
pattern-definition fixtures read-only (`000-fixtures.sqlinc`, `010-oracles.sqlinc`); it does not edit them. It needs
the pattern producer and governed activation staged, so it runs only with the lane list
`pattern-def,governed-b,governed-fix2`. `030-replay.sqlinc` embeds a byte-identical copy of the migration's
`do $amend$` block twice (extracted by script); if the migration is edited, regenerate it. After promotion the
copy stays valid (the block is idempotent), but its header names the WIP path.

## Runs

All runs: lane list `pattern-def,governed-b,governed-fix2`, ALT stack, via `lane-db-alt-staged.sh`.

| # | Time | Files | Result |
| - | ---- | ----- | ------ |
| R1 | 11:34 | governed_fix.sql + flow file; WIP dir empty (RED) | main suite plan 32, 3 fail: #22, #23 `have: RAISED P0001 CONFLICT` (deprecated block refused) and #32 (source: the supported-only guard still present) = genuine RED; #1-18 existing pass; byte-identity oracles #30, #31 pass. Flow file 13 tests, #13 fails with CONFLICT (RED), then HARNESS abort `pg_temp.s12pd_why(text) does not exist` (my include did not define the helper). TAP `.lane-logs/alt-staged-pattern-def+governed-b+governed-fix2-113422-103131.tap`, SHA-256 `8ca173248304ba313da43bafe09628a4091b6d8b269576d9a224460accafb74b` |
| R2 | 11:35 | flow file only (RED, helper defined) | 30 tests, 11 fail = genuine RED: #13 recompute CONFLICT; #14 `dep:submit refused P0001 CONFLICT`; #15-17 assign/decide/activate `INVALID_REQUEST` (cascade: no review exists), #18-20 state stays `draft`, #22-24 second draft: submit CONFLICT, status `changed`. Zero harness aborts. TAP `...-113544-110407.tap`, SHA-256 `a6fed091962fdfd7579c76af9e4346ca5668e2e2bacd2ffe2094069bfe4ace36` |
| G1 | 11:36 | + migration; governed_fix.sql, flow, pattern_definition.sql, governed_submit.sql | 477 tests, all pass. TAP `...-113623-114991.tap` (superseded by G2: the replay file was added after) |
| G2 | 11:37 | same four files, + `030-replay.sqlinc` | **481 tests, 0 fail**: governed_fix 36 (plan 1..36), flow 30, pattern_definition 341 (plan 341, all pass; the previous 31 `blocked-on-governed-09` failures pass now that `governed-b` is staged), governed_submit 74. TAP `.lane-logs/alt-staged-pattern-def+governed-b+governed-fix2-113756-123741.tap`, SHA-256 `4b150ac4d95dfca9913da582b8809908279f17c571a386862cc28cfc92a1fcc6` |

## Test corrections

None. No existing assertion or file changed (see Files for the hashes of the untouched include files).

## Spec citations

- BE03c :1361 (CMS-03C-12 rejects a missing, withdrawn or incompatible block; "the digest is recomputed again at
  activation and at 03b publication preflight"), :396 (validation row: "a registered, non-withdrawn version").
- BE03c :306-313 (lifecycle is a registry-record member of the digest tuple; the tuple records the real lifecycle).
- BE03c :389 (governed submit preconditions), :1259 (hash refusal), unchanged here.
- DEC-188 (lifecycle_version advances once per transition; asserted in the flow file: 4 after activation).

## Open items / BOUNDARY

- None for this defect. Not changed, flagged: a block WITHDRAWN after a pattern draft exists makes the governed
  submit raise `CONFLICT` (from the recompute) rather than a typed 422/409 refusal; BE03c names no token for it, so
  I kept the existing one (BOUNDARY: no spec line defines the submit refusal for a block withdrawn after draft
  creation). The behavior is pinned by the main-suite cases "a withdrawn block is still refused by the recompute" (#27-28) and the flow-file
  cases "the recompute still refuses a withdrawn block" and "a block withdrawn after submit makes the open review changed".
- `030-replay.sqlinc` is a verbatim copy, not a contract-parity-tested one (unlike the pattern-lineage witness); see
  Files.

## Requests to root

1. Promote `supabase/migrations-wip/governed-fix2/20261014080000_cms_governed_digest_deprecated_block.sql`
   (timestamp 20261014080000 sorts after the promoted `20261014040000`/`040100`; it requires `040000`'s body).
2. Run the canonical gates (`db:verify` etc.) with the new tests: `phase_02_slice_12_governed_fix.sql` runs on its own
   (no pattern producer needed); `phase_02_slice_12_governed_fix/deprecated-pattern-flow.sql` needs the pattern
   producer, governed submit/assign/decide/activation promoted. If `db:test` globs `supabase/tests/*.sql` only, the
   standalone flow file is not auto-run (same as `populated-lineage.sql`); add it to the gate list if wanted.
3. No new BOUNDARY stubs, no tracking issue created (no network actions in this lane).
