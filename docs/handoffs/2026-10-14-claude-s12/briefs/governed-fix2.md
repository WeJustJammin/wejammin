# Lane brief — `claude_s12_governed_fix2_sql` (staged-runner lane `governed-fix2`)

One defect, forward-only and test-first. BE03c :1361 (and :396) admit a registered DEPRECATED block in a
pattern and reject only a missing, withdrawn or incompatible block; "the digest is recomputed again at
activation and at 03b publication preflight". The applied governed recompute (in
`supabase/migrations/20261013300400_cms_governed_frozen_status.sql`, already patched forward by
`supabase/migrations/20261014040000_cms_governed_digest_pattern_order.sql`) raises CONFLICT for a
deprecated block, so a pattern draft over a deprecated block is created (CMS-03C-12) but can never be
submitted. Evidence: `docs/handoffs/2026-10-14-claude-s12/lane-pattern-def-report.md` `## Fix pass`
Requests to root 2. Fix: the recompute must fold a deprecated block as `deprecated` (exactly as the
pattern producer's digest does — `supabase/migrations-wip/pattern-def/20261014020300_*`) and refuse only
withdrawn/missing. Template and taxonomy digests must stay byte-identical (prove it). Use the same
anchored-patch technique as `20261014040000`/`040100` (exactly-once anchor, every non-body `pg_proc`
attribute compared before/after, idempotent, fail-loud) or a full forward redefinition carrying every
prior patch — say which and why.

## Files (exclusive)
- `supabase/migrations-wip/governed-fix2/` — range 20261014080000–20261014089999.
- `supabase/tests/phase_02_slice_12_governed_fix.sql` + dir: ADD cases only (existing 18 byte-identical).
- Report `docs/handoffs/2026-10-14-claude-s12/lane-governed-fix2-report.md`.

## Staged runs
Lane list `pattern-def,governed-b,governed-fix2` (pattern subjects need the pattern producer; submit of a
deprecated-block pattern must go draft → review; activation must then succeed). RED first: a real
pattern over a signed supported→deprecated block, submit refused today; then GREEN. Also rerun
`phase_02_slice_12_pattern_definition.sql` and `phase_02_slice_12_governed_submit.sql` to prove no
regression.
