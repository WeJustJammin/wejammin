# Lane brief — `claude_s12_block_compat_sql` (staged-runner lane `block-compat`)

Implement root ruling B from `docs/handoffs/2026-10-14-claude-s12/review-blockcompat.md` (read it fully;
every citation you need is there). Block compatibility for templates and patterns is NOT a
renderer-manifest `blocks` allowlist (no spec basis; the type compiler correctly never writes one). It is:
block registered + lifecycle rule (templates: `supported`; patterns: non-withdrawn, BE03c :396/:1361) +
for EACH compatible content type's active artifact, `compiler_version` within the block's registered
`compatibility {minSchemaCompiler, maxSchemaCompiler}` (BE03a :1098–1101, :2761; BE03c :209, :1567), compared
dotted-numerically over the closed compiler registry; a block whose range lacks a key fails closed.

## Files (exclusive)
- `supabase/migrations-wip/block-compat/` — range 20261014090000–20261014099999. ONE forward change set that
  replaces the applied `platform_private.cms_template_block_digest` compatibility rule
  (`supabase/migrations/20260927240000_*:54–83`) and the promoted `cms_pattern_blocks_compatible`
  (`supabase/migrations/20261014020300_*`). Keep digests byte-identical where the spec does not change them;
  say precisely what changes and why.
- New suite `supabase/tests/phase_02_slice_12_block_compatibility.sql` + dir: real-chain (S09 producers,
  signed block registration with real `compatibility` ranges) block-bearing template AND pattern creation —
  in-range accepted, out-of-range refused, key-less range refused, deprecated pattern block admitted,
  withdrawn refused. RED first against the current rule.
- Oracle corrections (spec-cited, minimal, never weakening; list every diff in your report for review):
  `supabase/tests/phase_02_slice_12_template_authority.sql` (~618–620), the raw fixtures whose
  `compatibility_range '{}'` the review lists, and pattern-definition suite `047`/`000` variants
  (`supabase/tests/phase_02_slice_12_pattern_definition/`). Do not touch other files.
- Report `docs/handoffs/2026-10-14-claude-s12/lane-block-compat-report.md`.

## Staged runs
Lane list `governed-b,block-compat` (pattern activation chains need governed-b WIP). Rerun template,
pattern-definition, governed-submit, governed-fix and template-authority suites to prove no regression.
Record the two implementation decisions the review names (registry ordering; fail-closed) in your report.
