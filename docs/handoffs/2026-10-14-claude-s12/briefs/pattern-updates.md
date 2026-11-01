# Lane brief — `claude_s12_pattern_updates_sql` (staged-runner lane `pattern-updates`)

Build, test-first, the SQL for CMS-03C-13 GET /api/v1/cms/patterns/selector (active, owner-scoped,
compatible-with-the-named-content-type pattern versions; signed keyset cursor `(patternKey ASC,
patternVersion DESC)`, 25/50, ETag page version; author/editor in the owner party), CMS-03C-14 GET
/api/v1/cms/compositions/instances/{instanceId}/update-diff (base/theirs/yours per path, collisions,
`no-update`, 422 `diff_too_large`, strong ETag instance version; assigned author/editor on the instance's
revision), and CMS-03C-15 POST /api/v1/cms/compositions/pattern-updates (accept/detach 1–32 instances per
request, If-Match = entry aggregate version plus each instance's own `version`, all-or-nothing,
`diff_has_collisions`, `revision_not_editable`, `pattern_version_not_active`; linked-update semantics D9/OD-2;
DEC-181 successive requests for >32 rows; DEC-185 positions copied unchanged).
Over PROMOTED placement (`20261014110*`), pattern (`20261014020*`, `090200`) and governed activation. Placement
slot rule (downstream contract): template-less entries take only `/`; templated entries only a template slot.

Spec: BE03c rows ~175–177, validation ~398–400, "Pattern versions and linked updates (D9, OD-2)" ~1359,
pinned definitions ~1355, lock order ~1336, schema/grants, error catalog, testing ~1612; FE03 :884–885;
contracts `pattern-selector.ts`, `pattern-update.ts` (+ diff resource), `refusals.ts`. Criteria AC106–123 and
cascade rows naming linked updates/diff/selector (grep the tracker). Precedent cursors: governed queue
(`supabase/migrations/20261014010400_*`) and taxonomy terms read (WIP/promoted).
Files: `supabase/migrations-wip/pattern-updates/` (range 20261014140000–20261014149999), new suites
`supabase/tests/phase_02_slice_12_pattern_{selector,update_diff,updates}.sql` + dirs, report
`docs/handoffs/2026-10-14-claude-s12/lane-pattern-updates-report.md` with `## RPC boundary` for the Worker lane.
Reuse the placement suite's real fixtures read-only by `\ir`. Lane `pattern-updates`.
