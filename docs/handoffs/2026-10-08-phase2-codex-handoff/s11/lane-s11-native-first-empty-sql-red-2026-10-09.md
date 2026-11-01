# Native QA-RED — DEC-162 initial scope SQL helper

## Authority and exact scope

Owner approved both policies; DEC-162 and BE03a/IA03 amendments are canonical.
Native author gpt-6-astra/high; parent/review gpt-6.1-sol/ultra. Active root only:
`/home/rob/.codex/worktrees/phase2-slice11/WeJammin`.

Create ONLY `supabase/tests/phase_02_slice_11_first_empty_scope.sql`.
Prefer<=300 lines; max400 test lines. Existing production/old tests, README,
progress, package/config/lock/environment are frozen. Request exact additional
scope BEFORE touching any other file. Parent checkpoints/pushes before dispatch.

## Source-only constraints

Read relevant rules/skills/DDL/pgTAP examples and actual current helper before edits.
Pure ctx JavaScript fs/path reads; native apply_patch writes only. NO commands,
exec_command/write_stdin/shell/child_process, scripts/tests/DB/network/git,
format/lint/commits/package work or nested agents. Parent alone executes under
fresh CI/shared flock/main54322. All author case reports are UNRUN.

## Boundary and matrix

Use actual existing private function
`platform_private.cms_schema_source_row_count(uuid,uuid)` with null source.
Current021830 function returns literal0; required forward repair retains this
signature and uses existing typed `DEPENDENCY_UNAVAILABLE`/P0001 for an invalid
or nonempty initial scope (no new public refusal/catalog/grant).

Controlled private DB unit fixtures may create synthetic local draft candidate,
type/owner/content rows using existing pgTAP fixture conventions. Label this as a
helper unit, NOT genuine Auth/review/activation proof. Do not insert approvals,
decisions, sealed reports, completed plans or real accounts; do not disable guards,
replace production functions, warm/delete snapshots or fabricate baseline IDs.
Use exact current DDL and guard-respecting fixtures; fail loudly on setup errors.

- Genuine first candidate shape: version_no1, supersedes_id null, validated type
  and owner, no predecessor/history/current active; no entry/revision/publication/
  locale roots => count0 (candidate fields/artifacts/bindings are declarations,
  not affected legacy content). No sealed report prerequisite.
- Unknown target, wrong first version/history/predecessor/current active, and
  nonempty initial persisted content refuse with existing dependency-unavailable.
- Actual census: E=entries of candidate.type; R=revisions rooted in E OR any
  candidate.type version; P=publications rooted in E/R/type versions; L=locale
  variants rooted in E/R/source revisions. Never filter archived/draft rows or
  ownership inconsistencies away. A negative data fixture is not ordinary authority.
- Keep legitimate non-null successor counting unchanged. Use fixtures possible
  under real constraints; do not weaken/disable guards to invent impossible rows.
- A constant0 mutation must fail concrete nonempty/invalid-target assertions.

Source helper and source/seal callers live in021830; BE03a source allowlist and
entry/revision DDL at20260926090000 define scope. Read current examples; no guessed
function/table columns. Wrap pgTAP test in begin/finish/rollback. No SQL execution.
Return path, exact planned assertion count, fixture scope/limits and UNRUN status;
freeze source at final report.
