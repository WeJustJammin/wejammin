# Lane preflight-cursor report (2026-10-10)

Worktree `/home/rob/.codex/worktrees/phase2-slice11/WeJammin`, branch `claude/phase2-slice11`, HEAD at start
`9b9b588ed3ef5409f3fdfcbf1ff179eb13ab0a0f`, at finish `352c397aa0619307e907dfcb5c6d23aa0c2289c1` (moved by the orchestrator; this
lane committed nothing).
Findings: 9 (unsupported accessibility version emits `provider_unavailable`) and 3 (filtered history
cursor leaks the concealed scan-tail identity), both from
`docs/handoffs/2026-10-08-phase2-codex-handoff/codex/s11-sql2-reverification-2026-10-09.md`.
All pgTAP ran on the alt stack (`lane-db-alt.sh`); logs are under `.lane-logs/` (git-excluded).

## Files changed

| File | Change |
| --- | --- |
| `supabase/migrations/20261005017570_cms_preflight_evaluation.sql` | Finding 9 fix, in place (S11-only, not pinned): one DEC-160 normalisation step after the dispatch chain; header comment corrected. |
| `supabase/tests/phase_02_slice_11_helpers_preflight.sql` | Finding 9 test corrected and extended (plan 157 -> 162). |
| `supabase/migrations/20261010161000_cms_history_sealed_cursor.sql` (new, 330 lines) | Finding 3: sealed (encrypt-then-MAC) cursor primitives. |
| `supabase/migrations/20261010161100_cms_history_sealed_cursor_wrapper.sql` (new, 90 lines) | Finding 3: `cms_list_revisions_signed` chooses the envelope by request. |
| `supabase/tests/phase_02_slice_11_e2_scan_history_cursor_privacy.sql` (new, plan 41) | Finding 3 RED/GREEN suite through the real wrapper. |
| `supabase/migrations/20261005018020_cms_list_revisions_derived_state.sql` | Comment only (header now says the reader answers the cursor in the clear and the wrapper seals it). No behaviour change. |

Not edited: `20261005010400_cms_revision_comparison_domains.sql` (on main) and every shared signed-cursor helper.

## Finding 9 — accessibility unavailable must emit `checker_failed`

Spec: DEC-160 (`decisions.md` ~4525) and BE03b:1805 "Unavailable reasons": `provider_unavailable` for every
database or reference-gate category, `checker_failed` for category 11; "no other unavailable token exists".

RED (`.lane-logs/alt-tap-150144-1814670.tap`, preflight file, 162 planned / 3 failed):
- `not ok 101` "a version-2 row of the worker accessibility provider is unavailable/checker_failed ..." have `unavailable/provider_unavailable`, want `unavailable/checker_failed`.
- `not ok 103` "no accessibility result ever carries the forbidden reason provider_unavailable" have 1, want 0.
- `not ok 105` "a worker accessibility row naming an unimplemented provider key is unavailable/checker_failed ..." have `unavailable/provider_unavailable`.
Right reason: the `provider_version <> 1` branch (and the unknown-worker-key branch) wrote `provider_unavailable` for every category.

Fix: after the dispatch chain, `if outcome = 'unavailable' and registry_row.category = 'accessibility' then reason := 'checker_failed'`.
One place, so every path that leaves category 11 unavailable (unimplemented version, unknown key, failed checker, no evidence)
reports the one locked token; the sixteen other categories are untouched. Registry order, no short circuit, `passed` and the
evidence verification (stale / `dependency_changed`) are unchanged.

GREEN (`.lane-logs/alt-tap-150859-1852335.tap`): `phase_02_slice_11_helpers_preflight.sql` 162/162.

Test title changes (evidence ledgers cite titles):

| Old | New |
| --- | --- |
| "a version-2 row of every database, reference_gate and worker provider is unavailable/provider_unavailable, none is evaluated as v1 [P2-S11-AC-093]" (expected 17 x `provider_unavailable`) | "a version-2 row of every database and reference_gate provider (the sixteen non-worker categories) is unavailable/provider_unavailable, none is evaluated as v1 [P2-S11-AC-093]" (16) |
| (none) | NEW "a version-2 row of the worker accessibility provider is unavailable/checker_failed (DEC-160: ...), never provider_unavailable [P2-S11-AC-093]" |
| (none) | NEW "a version-2 row of each of the seventeen providers is unavailable, none is evaluated as v1 [P2-S11-AC-093]" (17 unavailable, any reason) |
| (none) | NEW "no accessibility result ever carries the forbidden reason provider_unavailable [P2-S11-AC-093]" |
| (none) | NEW "a worker accessibility row naming an unimplemented provider key is unavailable/checker_failed, never provider_unavailable [P2-S11-AC-093]" |
| (none) | NEW "a worker row of a non-accessibility category keeps provider_unavailable (only category 11 reports checker_failed) [P2-S11-AC-093]" |

Unchanged and still green: "the version-2 evaluation is a report, not a raised error ...", "passed is false when any provider version is unimplemented [P2-S11-AC-097]", every `checker_failed` assertion of the accessibility section. `packages/contracts/src/cms-editorial/preflight.ts` already pins accessibility to `['checker_failed']`, so no contract change.

## Finding 3 — filtered history cursor leaks the concealed scan-tail identity

Spec: BE03b E2 (a `state`-filtered scan covers at most 1,000 candidates, concealed ones included, "a cursor must not become a
probe", cursor positioned after the last scanned candidate); BE03b:2014/2068 (no private content disclosure, cursor/context binding).

Root cause: the public cursor is `base64(JCS({queryHash, lastRevisionNumber, lastRevisionId, expiresAt, keyId, signature}))`:
authenticated, not hidden. Decoding the cursor of a page whose scan ended on a concealed rank-1000 candidate gives that
revision's UUID and number.

RED (`.lane-logs/alt-tap-150549-1835007.tap`, `phase_02_slice_11_e2_scan_history_cursor_privacy.sql`, 41 planned / 16 failed). Fixture: entry 301,
1,231 revisions, rank 1000 = revision 232 `published` under another acting party (concealed), `state=approved` read through
`cms_list_revisions_signed` (the wrapper `platform_api.cms_list_revisions` delegates to):
- `not ok 8` "decoding the bound-ending cursor does not reveal the UUID of the concealed rank-1000 revision" have 92 (offset of `a9150000-...-000000000232` in the decoded cursor), want 0.
- `not ok 10` "... does not reveal the revision number ..." have `232`, want NULL.
- `not ok 11` "... is not a decodable JSON document" have `{"keyId": ..., "lastRevisionId": "a9150000-0000-4000-8000-000000000232", "lastRevisionNumber": "232", ...}`.
- also failing: 13 (empty-page cursor), 19 (fixed length: have 420/420, want 364/364), 20 (nonce), 27-30 (tamper -> 409), 33-38 (re-sealed forgeries).

Fix (design):
- New sealed envelope, `0x01 || keyId(16) || nonce(16) || ciphertext(208) || tag(32)` = 273 bytes = 364 chars, always. Payload = the reader's four unsigned members as JCS, space-padded to 208 bytes, AES-256-CBC (`extensions.encrypt_iv`, `aes-cbc/pad:none`) under a fresh `extensions.gen_random_bytes(16)` nonce; tag = HMAC-SHA-256 over header||ciphertext, compared with the existing constant-time `cms_history_cursor_mac_equal` BEFORE decrypting (no padding or decrypt oracle).
- Keys: independent HMAC-SHA-256 subkeys (purpose enc|mac, signing domain, key id) of the existing Vault `cms_editorial_history_cursor_active` secret, same retired-key 24 h grace as `cms_signed_cursor_open`. Nothing stored or hard-coded; no key provisioned by a migration.
- The bound, keyset position and context binding are unchanged: the reader (`cms_list_revisions`, bounded 1,000-candidate scan) is untouched, `queryHash` (actor, acting party, entry, state, locale, compareRevisionId, limit) rides inside the ciphertext and is verified by the reader. Expiry <= 24 h is enforced at open and by the reader. Nothing is written (safe read).
- `cms_list_revisions_signed` (CREATE OR REPLACE, owner/definer/search_path/grants preserved) seals the cursor of EVERY request that names a `state`, and keeps the Slice 10 six-key signed envelope for filter-free requests (their cursor sits after the last RETURNED row, never a concealed one). The kind depends only on the request the caller made, so the cursor never reveals whether the tail was concealed. Inbound: first raw byte `0x01` = sealed, otherwise signed.
- Faults (DEC-140): malformed sealed envelope (wrong length/version) 400 `INVALID_REQUEST`; unknown/stale key, bad tag, foreign domain, non-object payload, missing or over-24 h expiry, replay into another actor/filter/limit/locale 409 `CONFLICT`.
- New private functions (all `platform_private`, definer, `search_path = ''`, revoked from public/anon/authenticated/service_role): `cms_sealed_cursor_seal`, `_open`, `_seal_page`, `_is_sealed`, `_verifying_key`, `_subkey`.

Other callers of the shared helper (grep): `cms_signed_cursor_open/_seal_page/_require_key` are used by the entry list
(`20261005010700`, `20261005013200`) and the editorial review list (`20261005017890`); none is modified, so Slice 10 /
CMS-03B-13 / CMS-03B-17 behaviour is untouched. Only `cms_list_revisions_signed` changes, and only for requests with a `state`.
No Slice 10 test was edited. Slice 10 suites that exercise the wrapper all pass unchanged: `phase_02_slice_10_cursor_signature`,
`_rpc` (incl. `005-history`: signed cursor replayed with `state=draft` stays 409), `_compare_chain_shared`, `_compare_lineage_domains`,
`_comparison_domains`, `_compare_lineage`, `_entry_list`. The existing `phase_02_slice_11_e2_scan_history.sql` (reader level, plaintext
cursor, 5 batches, rank-1000 cursor = revision 232) is unchanged and green: bounded scanning is preserved.

GREEN (`.lane-logs/alt-tap-150859-1852335.tap`): `phase_02_slice_11_e2_scan_history_cursor_privacy.sql` 41/41.

New test titles (all in the new file, none replaces an existing title): decoding the bound-ending cursor does not reveal the
concealed revision UUID / number; not a decodable JSON document; empty-page cursor discloses nothing; resume exactly after the last
scanned candidate; empty page resumes past the concealed revision; probe-case cursor sealed and resumes; <= 512 characters; fixed
364-character length; fresh nonce per seal (back-to-back reads differ) and both resume to the same page; unfiltered cursor keeps the
six-key signed envelope; replay with another state / limit / locale / no filter is 409; flipped ciphertext / tag / nonce / key id is
409; truncated / over-long envelope is 400; re-sealed expired / over-24 h / non-UUID position is 409; foreign member is 400; foreign
domain is 409; no table write during any read (pg_stat_xact delta 0); sealed cursor opens under a freshly retired key and never under
a non-history Vault secret.

## Verification summary

| Run | Log | Result |
| --- | --- | --- |
| RED preflight + privacy (first draft) | `alt-tap-150144-1814670.tap` | preflight 3 failed; privacy 16 failed |
| RED privacy (final test) | `alt-tap-150549-1835007.tap` | 16 failed of 41 |
| GREEN: 39 files (all `slice_11_helpers_*`, `slice_11_e2_*`, `slice_11_rpc_review_submit*`, `rpc_publication_{schedule,publish,execute}[_refusals]`, `rpc_reads_{gate,workflow}`, `slice_10_{cursor_signature,compare_chain_shared,compare_lineage_domains,comparison_domains,compare_lineage,rpc,entry_list}`) | `alt-tap-150859-1852335.tap` | 1578 tests, 0 failed, PASS |
| GREEN sweeps over the new functions and the shared-cursor neighbours: `slice_11_schema_posture`, `slice_10_write_path_{catalog,locks}`, `slice_09_{sec2_all_schema_definer_rls,sec2_definer_rls,r8_api_surface,r3_grants_misc,g1_consumer_boundary}`, `database_harness`, `persistence_runtime`, `slice_11_rpc_reads_queue`, `slice_10_entry_list_{epoch_cursor,authorized_keyset}` | `alt-tap-152342-1924990.tap` | 13 files, 420 tests, 0 failed, PASS |

## Open items / notes for the orchestrator

- `BE03b` says CMS-03B-03 uses a "signed context-bound cursor"; the state-filtered cursor is now authenticated-encrypted (still context-bound, <= 512 chars, <= 24 h). Consider a one-line spec/DEC note; no owner decision is needed (implementation decision, no contract surface change: the cursor stays an opaque string <= 512).
- `supabase/tests/phase_02_slice_11_e2/README.md` (not mine) lists the E2 entrypoints; it needs one row for `phase_02_slice_11_e2_scan_history_cursor_privacy.sql`. Evidence ledgers should cite the new titles above for P2-S11-AC-086 (privacy) and P2-S11-AC-093 (accessibility token).
- No real-PostgREST spec pages the history with a `state` filter and a cursor; the pgTAP suite goes through the private wrapper that `platform_api.cms_list_revisions` delegates to (a one-line `service_role` delegate, unchanged). A main-stack API spec for that path was not run.
- Adjacent, not changed (out of scope): the category chain in `cms_evaluate_preflight` has no final `else`, so a hypothetical registry row of a database-kind provider for a category with no implementation (for example accessibility declared `database`) would evaluate as passed. Not reachable with the seeded registry (all seventeen current rows are covered); worth a fail-closed `else` if a later slice registers new rows.
- Memory capture: candidate DEC for the orchestrator (not written by this lane): "state-filtered CMS-03B-03 cursors are sealed (encrypt-then-MAC, fixed 273 bytes) because the bounded scan can end on a concealed candidate; the envelope kind is chosen by the request, not the scan outcome".
