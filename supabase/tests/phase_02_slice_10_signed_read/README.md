# Slice 10 signed-read pgTAP fragments

Shared includes for the three suites that prove the signed keyset cursors and
the schema-aware comparison of CMS-03B-03 (revision history / compare) and
CMS-03B-13 (assigned-entry list):

- `../phase_02_slice_10_cursor_signature.sql` — six-key signed envelope,
  tamper/foreign/expired/over-lived/cross-domain refusals, key rotation.
- `../phase_02_slice_10_compare_chain_shared.sql` — compare descriptor equals
  the canonical restore-chain derivation (zero-edge and a real two-edge chain).
- `../phase_02_slice_10_compare_lineage.sql` — relation targetToken, block
  domain, 512-change ceiling, and the comparison lineage refusals.

The suites above are the discovery entrypoints; the fragments here are `\ir`
includes (000-002 are shared helpers and fixtures, 003-004 continue the cursor
suite), not independently discovered Supabase test files, and each stays below
the repository's 400-line test cap.

| Fragment                     | Coverage                                                                                                                          |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `000-cursor-helpers.sqlinc`  | refusal-token probe, correctly-signed/tampered cursor forgery, list/history call builders, Vault key-rotation setup SQL           |
| `001-cursor-fixtures.sqlinc` | second authorised entry and second history revision so a limit-1 first page carries a next cursor                                 |
| `002-compare-helpers.sqlinc` | `pg_temp.s10_fn_body`, compare call builder, replica-role wrapper, block-definition and composition-instance fixture SQL builders |
| `003-history-cursor.sqlinc`  | CMS-03B-03 history cursor: signed envelope, continuation, stable comparison across pages, tamper, cross-cursor refusal            |
| `004-key-handling.sqlinc`    | unnamed/mis-named signing secrets never verify; freshly retired key verifies; rotation signs with the new active key              |

## Adding tests

Include `phase_02_slice_10_rpc/000-helpers.sqlinc` and `001-fixtures.sqlinc`
first (these fragments call their helpers), create the transaction-local Vault
signing key (`vault.create_secret(repeat('a1', 32),
'cms_editorial_history_cursor_active', ...)`; no migration provisions an
operational key), then reuse the builders here instead of re-spelling cursor
envelopes or block fixtures. Run corruption inside `pg_temp.s10_rpc_probe` so it
rolls back with the probe.

## Conventions

- The entry-list cursor signs under the `cms-03b-13` domain and the history
  cursor under `cms-03b-03`; re-sign probes must use the matching domain.
- Everything runs inside the entrypoint's rolled-back transaction.
- Vault stamps `updated_at` with the transaction clock and the suite role cannot
  write `vault.secrets`, so the 24-hour retired-key bound cannot be aged in a
  suite; the freshly-retired and mis-named cases are covered instead.

## Related paths

- `../phase_02_slice_10_rpc/` — shared helpers, fixtures and the history suite
- `supabase/migrations/20261005010400_cms_revision_comparison_domains.sql` and
  `20261005010700_cms_entry_list_read.sql` — the producers under test
