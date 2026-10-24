# Lane brief — `claude_s12_taxonomy_def_sql` follow-up pass (staged-runner lane `taxonomy-def`)

Your previous pass is GREEN and independently reviewed CLEAR (`docs/handoffs/2026-10-14-claude-s12/review-taxonomy-def.md`).
Read that review fully, then fix its findings in your WIP migrations BEFORE root promotes them:
- F1: the race path raises bare `FORBIDDEN` and loses `details.reasonCode`; spec names `capability_missing`.
- F3: create validates canonical domains against a hardcoded set; the route row requires a canonical
  domain registry read (`20261013300100_cms_canonical_domain_registry.sql`, `cms_canonical_domain_current`).
- F4: make the 060 test read the registry directly instead of toggling `app.cms_rpc`, if that keeps the
  assertion's meaning; otherwise keep the reviewed form and say why.
- Add a parity test (model it on the template DDL-parity test; find it with
  `grep -rl 'PARITY\|parity' tests/contracts supabase/tests | head`) proving the
  `-- BEGIN/END TAXONOMY-LINEAGE-DDL` region in `030000` and `populated-lineage.sql` stays byte-identical.
- `20261014030500` was moved by root to `supabase/migrations-wip/governed-fix/` (governed-fix owns the
  submit function). Suite 060 #1061–1065 depend on it: classify them `blocked-on-governed-fix` until
  promotion; never fake them.
Files, rules and reporting as in `briefs/taxonomy-def.md`. Edit your WIP migrations in place (they are
unpromoted). Append a `## Follow-up pass` section to your report. Every assertion other than the
blocked ones must pass; plan never shrinks.
