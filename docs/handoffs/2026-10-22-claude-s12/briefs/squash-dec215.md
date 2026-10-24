# Lane `claude_s12_squash` — squash superseded WIP migration bodies before promotion (DEC-215)

Read `docs/handoffs/2026-10-14-claude-s12/lane-rules.md` fully first; it binds you. Start EVERY shell command with
`cd /home/rob/.codex/worktrees/phase2-slice12/WeJammin &&`. Report: `docs/handoffs/2026-10-22-claude-s12/lane-squash-report.md`
(checkpoint after every pair and every run; keep `## Status` current — root watches it).

## Decision

DEC-215 (root, raw record in `.memory/raw/events/2026-10-22.jsonl`): before joint promotion, no superseded intermediate
function body and no digest pin of one may enter `supabase/migrations/`. No shared database has applied anything from
`20261013300000` on, so WIP history can still be rewritten. Source: review R1-004 in
`docs/handoffs/2026-10-22-claude-s12/review-r1-report.md` (read it, and R1-003/R1-005 for context). The END STATE of every
function, table, grant and comment after the full staged stack must be byte-identical before and after your lane — this is a
history refactor, not a behaviour change.

## Pairs (from R1-004; verify each on disk — F1/F2 edited some in place since the review)

| earlier | superseding | note |
| --- | --- | --- |
| `dec193/20261016040700` | `dec193/20261016041800` | ambiguous `template_id` identifier fixed by the later file |
| `dec193/20261016040800` | `dec193/20261016041600` | replaced whole; `041600` was edited in place by F2 (DEC-210) and calls `block-rules/20261022080100` |
| `dec193/20261016041100` | `dec193/20261016041500` | target-lock race; `041500` edited in place by F1 |
| `dec193/20261016041900` | `dec193/20261016042900` | `042900` anchors on `041900`'s text |
| `dec193/20261017044500` | `dec193/20261017044710` | `044710` pins md5/sha256 of the earlier body |
| `dec193/20261017044600` | `dec193/20261017044720` | `044720` pins the earlier body |
| — | `dec193/20261017044800` | pins a previous body (27,517 octets) — find which and remove the pin with its subject |
| `pattern-updates/20261014140200`, `140400`, `140500`, `140550`, `140600` | dec193 | replaced by dec193 bodies (check `140410`, `140605`, `140610` wrappers/closures too) |

For each pair choose, with evidence, the direction that keeps ONE definition and preserves every dependency in timestamp
order: (a) fold the final body into the earlier file and delete the superseding file, or (b) delete the earlier body (the
superseding file becomes the sole `create or replace`) when objects defined between the two timestamps are required by the
final body, or when an anchor-patch chain needs the later position. Anchor patches (`prosrc` text replacement with
`anchors_old`/`anchors_new` and a reverse check) that target a body you change must be re-anchored or folded too. Never
change a file under `supabase/migrations/`. A file that becomes empty is deleted, not left as a no-op.

## Step 0 — one behaviour fix BEFORE the squash (debug-by-test)

Lane F2 found (report `lane-block-rules-report.md`, Requests to root 1): `dec193/20261016044200_cms_pattern_active_digest.sql`
lines ~124-133 — the passing path of the `cms.pattern.active_digest` provider emits `passed::0` and then falls through to
`failed::0` (no `return;`), so a passing pin returns TWO rows and `cms_evaluate_preflight` is right only by emission order.
Find the LIVE body of that provider (it may have been re-patched forward later, e.g. in `block-rules/`), write a RED pgTAP
assertion that a passing pattern category answers exactly one row (`passed`), run it, then fix the body where it is finally
defined (in place if WIP anchors allow; otherwise forward in `fix-dec193/` within `20261022090000`–`099999`), run GREEN.
BE03c "Preflight providers registered by Slice 12" is the spec (one outcome per category). Only after Step 0 is GREEN take
the snapshot baseline below — the squash must not change behaviour beyond Step 0.

## Proof of byte-identical end state (do this first, before any edit)

1. Write a catalog-snapshot query (pg_proc `prosrc`/`proconfig`/`prosecdef`/owner/ACL and `obj_description` for every function
   in `platform_private`, `platform_api`, `public`; tables/columns/constraints/indexes/policies/triggers/grants in those
   schemas) as a pgTAP-free `.sql` file under `supabase/tests/` named `phase_02_slice_12_squash_catalog_snapshot.sql` that emits
   one TAP `ok` line per object with a `# sha256:` diagnostic, or another form the staged runner accepts. Run it on the
   standard stack BEFORE edits (baseline TAP) and AFTER edits; the per-object hashes must be identical. Record both TAP paths
   and a diff summary in the report.
2. Standard stack (exact): `pattern-updates,dec193,dec194,dec195,locale-gate,dec197,dec202,dec205,dec206,governed-recheck,
   block-rules,fix-dec193`. Pass test files to the runner as SEPARATE arguments (a single space-joined argument runs nothing).

## Final run

Every `phase_02_slice_12*.sql`, the Slice 10 and Slice 11 suites, and the three S09 inventory files
(`phase_02_slice_09_r8_api_surface.sql`, `phase_02_slice_09_sec2_all_schema_definer_rls.sql`,
`phase_02_slice_09_sec2_definer_rls.sql`) on the standard stack; compare failure sets with the newest pre-squash full runs
in `.lane-logs/` and explain every difference (there should be none attributable to you). Also update any Vitest parity
fixture or witness test that names a deleted file (search `apps/`, `packages/`, `tests/`, `infra/` for each deleted
filename and timestamp) and run those tests.

## Claim

`supabase/migrations-wip/dec193/*`, `supabase/migrations-wip/pattern-updates/*`, `supabase/migrations-wip/fix-dec193/*`,
`supabase/migrations-wip/block-rules/*` (Step 0 or a fold only), the dec193/pattern/block-rules pgTAP files (Step 0 RED
test; listed in the report), the new snapshot test file, and Vitest files that name a deleted migration (list each before
editing). Live lanes at release time are listed in `LANES.md`; never touch their claims.

Final message to root: GREEN / PARTIAL / BLOCKED, report path + SHA-256, per-pair direction with reason, deleted and edited
files with before/after SHA-256, snapshot equality evidence, final run counts, requests to root.
