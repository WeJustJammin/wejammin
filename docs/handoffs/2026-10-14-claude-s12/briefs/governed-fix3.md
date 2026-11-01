# Lane brief — `claude_s12_governed_fix3_sql` (staged-runner lane `governed-fix3`)

Per `docs/handoffs/2026-10-14-claude-s12/review-block-compat.md` (governed recompute question): the pattern
branch of `platform_private.cms_governed_current_digest` (applied `20261013300400:96-128`, patched by promoted
`20261014040000`, `20261014080000`) checks registry + withdrawn only, while templates re-enforce the compiler
range at submit/decision/activation/recheck through `cms_template_block_digest`. Make the pattern branch also
enforce compatibility by calling the promoted `platform_private.cms_pattern_blocks_compatible`
(`20261014090200`) for the subject's compatible types after the block loop — refuse exactly as the pattern
producer refuses an incompatible block (same token/DETAIL). Anchored patch like `20261014080000`
(exactly-once anchor, every non-body `pg_proc` attribute compared, idempotent) — template/taxonomy branches
and every previously returnable digest unchanged (prove). RED first: a pattern whose compatible type's
active artifact compiler moves outside a block's range between create and submit (use labelled fixture
clones only where no producer can write the state, as the block-compat suite does). Also add the missing
`supabase/tests/phase_02_slice_12_block_compatibility/README.md` (extension guide like its siblings).
Files: `supabase/migrations-wip/governed-fix3/` (range 20261014100000–20261014109999), add-only cases in
`supabase/tests/phase_02_slice_12_governed_fix.sql` + dir or a new `phase_02_slice_12_governed_fix3.sql` + dir,
the README above, report `docs/handoffs/2026-10-14-claude-s12/lane-governed-fix3-report.md`. Stage
`governed-b,governed-fix3` (activation for full chains). Rerun governed_fix, governed_submit,
block_compatibility, pattern_definition to prove no regression.
