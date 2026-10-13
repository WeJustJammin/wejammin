# Slice 12 FIX lane pgTAP fixtures

Shared fragments for `supabase/tests/phase_02_slice_12_fix_*.sql` (CMS-03C-01 and the template
reads: BE03c E13 reserved keys, E14 per-owner uniqueness, E4 audience grammar, lineage ids).

- `000-owners.sqlinc` creates, inside the including test's rolled-back transaction, a second
  organization (owner B) with its own `cms.template_designer` grant and active content type next
  to the Slice 10 organization (owner A), plus the `pg_temp.s12fix_*` helpers: `s12fix_req`
  (one CMS-03C-01 request), `s12fix_as` (switch the acting owner), `s12fix_try` (run a statement
  and return the whole observable outcome: SQLSTATE, message, DETAIL, constraint), `s12fix_define`,
  `s12fix_latest` and `s12fix_clone` (a direct insert that bypasses the RPC).
- Include it AFTER `phase_02_slice_10_rpc/000-helpers.sqlinc` and `001-fixtures.sqlinc`.

To add a case: build the request with `s12fix_req`, switch owner with `s12fix_as('A' | 'B')`,
and assert on the full `s12fix_try` outcome so a refusal that differs in any observable member is
visible. Related: `supabase/tests/phase_02_slice_12_template_authority.sql` (the original suite).
