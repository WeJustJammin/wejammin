# Slice 12 governed-fix test support

Suite: `../phase_02_slice_12_governed_fix.sql`. Lane `claude_s12_governed_fix_sql`, forward migrations
`supabase/migrations/` (`20261014040000` digest, `20261014040100` submit refusals).

- `000-blocks.sqlinc`: four real signed block registrations (CMS-03A-05) and independent tuple/node builders. Keys
  `fix-c`, `fix.b`, `fixa` differ in byte order versus any punctuation-ignoring locale order.
- `005-submit-source.sqlinc`: CATALOG-SOURCE oracles over the live private submit body for the nested-pattern token and
  the `canonical_source_unavailable` DETAIL, because those branches need pattern/taxonomy producers that are not promoted.
  A source oracle is weaker than behavior: the behavioral proofs are the combined staged run named in the lane report.
- `010-digest.sqlinc`: `cms_governed_current_digest` driven directly: pattern branch (42P10 fix, byte order, dedupe,
  node-order independence, lifecycle `supported`), template and taxonomy branches unchanged, catalog identity and ACL.
  The wrapper `fix_digest` sets `app.cms_rpc` for the single call (the registry tables are forced-RLS) and turns a raise
  into a comparable `RAISED <sqlstate> <message>` value so one defect cannot hide later assertions.

The stored-hash refusal (behavioral, template subject) lives in the governed-submit suite:
`../phase_02_slice_12_governed_submit/030-hash-refusal.sqlinc`.

Adding a case: append an include and keep each file under 300 lines. Never weaken an oracle to pass.

## Lane governed-fix2 - a deprecated block (BE03c 396, 1361)

Forward migration `supabase/migrations/20261014080000_cms_governed_digest_deprecated_block.sql`
(anchored patch: the recompute refuses only a `withdrawn` block and folds `deprecated`).

- `020-deprecated-digest.sqlinc`: `cms_governed_current_digest` driven directly with real signed registration and
  lifecycle commands: deprecated admitted and folded `deprecated`, withdrawn still refused, missing unchanged, and
  md5 oracles proving everything outside the pattern branch (template branch, closing return, taxonomy) is byte-identical
  to the applied body.
- `030-replay.sqlinc`: a byte-identical copy of the migration's `do $amend$` block replayed: idempotent against the
  patched body, and 55000 (rolled back) against a body without the anchor.
- `deprecated-pattern-flow.sql` (standalone, not included by the main file; run it with the lane list
  `pattern-def,governed-b,governed-fix2`): a real pattern over a signed supported-to-deprecated block goes draft,
  review, approved, active through the governed commands, and an open review turns `changed` once the block is withdrawn.
