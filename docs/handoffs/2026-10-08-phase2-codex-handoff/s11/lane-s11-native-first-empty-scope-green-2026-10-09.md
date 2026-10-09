# Native GREEN — DEC-162 actual initial scope helper

## Authority and frozen RED

Owner-approved DEC-162 and BE03a/IA03 amendments bind. Parent fresh CI0/shared
flock/main54322 reset passed, then fresh CI0/lock targeted pgTAP ran20 assertions:
13 failed/7 passed, exit1; all13 failures caught no exception rather than required
P0001/DEPENDENCY_UNAVAILABLE. No setup/deferred-constraint failure. This witnesses
the current null-source literal-zero defect, not real authority or sealing races.
Native gpt-6-astra/high; parent/review gpt-6.1-sol/ultra.
Root ONLY `/home/rob/.codex/worktrees/phase2-slice11/WeJammin`.
Parent checkpoints/pushes this claim before dispatch.

## Exact scope and restrictions

Create ONLY forward migration:
`supabase/migrations/20261005018100_cms_first_empty_scope.sql` (<=300 lines).
Replace ONLY existing private `cms_schema_source_row_count(uuid,uuid)` body,
retaining signature/search_path/definer/revokes and non-null branch behavior.
Verified parent CI0/flock live catalog: old owner postgres, STABLE/definer with
empty search_path; EXECUTE ACL only postgres and existing CMS definer. Direct
forced-table census requires SEC-2 ownership, so scope now explicitly includes
transfer to existing `wejammin_cms_definer` within this sole migration, using
transaction-local schema CREATE grant, ALTER OWNER and immediate CREATE revoke
pattern. Role already NOLOGIN/NOSUPERUSER/NOBYPASSRLS and holds required SELECT.
No new API EXECUTE/table/role/membership grants. Preserve effective existing
private access, empty search_path and STABLE/read-only behavior. Parent verifies
live ACL/role/CREATE and SEC-2 tests after reset; do not retain postgres ownership.
No historical migration/test edits, new public function/grant, packages/config/
lock/environment, README/progress/other files. Parent updates directory docs.
PURE ctx JavaScript fs/path reads + native apply_patch writes ONLY. NO commands,
exec_command/write_stdin/shell/child_process/scripts/tests/DB/network/format/lint/
TSC/git/commits/packages/nested agents. Parent executes; author source is UNRUN.

## Actual census

Null source must validate target joined to matching type/owner, version_no1,
supersedes_id null, no other persisted type version or current active. Missing,
inconsistent, nonfirst or nonempty initial scope raises existing exact
P0001/DEPENDENCY_UNAVAILABLE, never silently returns zero.
Actual relation checks: T=all candidate.type versions; E=entries of that type;
R=revisions rooted in E OR T; P=publications rooted in E/R/T; L=locale variants
rooted in E/R/source revisions. Use real persisted queries, never null equality,
LIMIT0 or caller-provided zeros. No lifecycle exclusions or owner filtering that
hides inconsistent roots. Candidate definitions/artifacts/fields/bindings are
declarations, not instantiated content. Unrelated same-owner types remain valid.
For non-null source, preserve actual existing live-row revision/publication/
affected-locale counting exactly. No new side effects or fake approval/evidence.

The helper is NOT the final admission/sealing concurrency fence: actual protected
scan/seal and lock/CAS/lease/fingerprint rechecks remain separate open work. Do not
change them or activation/completed replay semantics in this lane. Publication,
current-active and cross-owner cases remain NOT PROVEN by the20 helper fixtures;
implement required checks without overstating test coverage. Freeze and return
exact path/lines, preserved role boundary and residual gaps for parent execution.
