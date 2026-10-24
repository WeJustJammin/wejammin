# Governed-submit Run 4 — static setup diagnosis

Historical Run 4 status: SETUP-BLOCKED. This records the read-only diagnosis at
that boundary. Run 6 subsequently verified the bounded fixture repair: all
mandatory setup controls pass and the prior RPC flag is restored before public
commands. See `CODEX-GOVERNED-RED-RECEIPT.md`; no acceptance closure is claimed.

## Observed receipt

`.lane-logs/alt-tap-054721-1107471.tap` has a complete `1..32` plan:
13 passing and 19 failing assertions. SHA-256:
`9849c004a83a8ba3504d28621e8088b164c04fc598d6292649be28a0a8721466`.
Mandatory setup assertions 9–11 receive NULL from private projections, despite
successful protected type creation and an exact two-type template-row control.

## Source trace

1. `supabase/tests/phase_02_slice_12_governed_submit/000-fixtures.sqlinc:86`
   enables `app.cms_rpc` for direct fixture activation; line 102 clears it.
2. The subsequent template producer calls go through
   `supabase/migrations/20261003120410_content_rpc_flag_restore.sql:74,86–87`:
   `cms_define_template` restores its caller's prior RPC flag after the command.
   It does not leave the private read context enabled for later inspection.
3. `supabase/migrations/20261003120000_cms_definer_roles.sql:31` creates
   `wejammin_cms_definer` as NOBYPASSRLS. The governed subject resolver is owned
   by that role (`20261013300300_cms_governed_subject_helpers.sql:339`); its reads
   at lines 146–153 therefore differ from the privileged direct table control.
   The editorial policy projection has the same definer owner under
   `20261003120500_cms_definer_function_ownership.sql:75`.
4. Template reads require `cms_rpc_context_valid()` under
   `20261003120300_cms_session_scope_policies_for_real_roles.sql:18–21`.
   Content-type/version tables have the same RPC predicate under
   `20260902080000_content_schema_registry_authority.sql:2199–2211`.
   That predicate is exactly `current_setting('app.cms_rpc', true) = 'true'`
   (same file, lines 1600–1608).
5. The policy projection returns NULL if it cannot find the content-type version
   (`20261002138000_cms_editorial_policy_evidence.sql:39–49`); the subject
   projection returns NULL for an invisible row
   (`20261013300300_cms_governed_subject_helpers.sql:173–174`).

The cleared internal context is a concrete missing precondition sufficient to
explain the observed NULLs. It is not proof of a malformed protected policy
binding, nor a public authorization defect. Other fixture problems are not ruled
out; a repaired runtime check has not been performed.

## Next repair boundary

Before another repair attempt, discuss the repeated failed fixture iterations as
required by `systematic-debugging`. Any future test-only repair must scope and
restore the internal RPC flag around private inspection controls only, including
exception paths. It must not leave the flag enabled across the public commands
under test, weaken RLS, disable triggers, stub the policy seam, or replace actual
command outcomes with synthetic successes. Re-run through the serialized runner
only after an explicit bounded release; require all setup controls to pass before
accepting missing-command RED.

The two pending locked-spec decisions remain separate: governed lifecycle/CAS
versioning and CMS03C02 response-size limits. No decision is inferred here.
