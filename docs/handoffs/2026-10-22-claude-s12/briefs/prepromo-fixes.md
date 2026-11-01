# Pre-promotion fix wave (2026-10-22)

Every lane: read `docs/handoffs/2026-10-14-claude-s12/lane-rules.md` (binding) and `LANES.md`; start every
shell command with `cd /home/rob/.codex/worktrees/phase2-slice12/WeJammin &&`. Reviews:
`docs/handoffs/2026-10-22-claude-s12/review-r1-report.md`, `review-r2-report.md`, `review-r3-report.md` (read
your findings there in full — they carry file:line, evidence and proposed fixes). Owner decisions this wave:
DEC-209 (resolve-conflict carries from `theirs`), DEC-210 (block composition rules everywhere) — raw records in
`.memory/raw/events/2026-10-22.jsonl`; BE03c already updated by root (changelog rows dated 2026-10-22).
WIP SQL may be edited in place (unpromoted) — list every edited file with before/after SHA-256. RED first for
every behaviour change. Staged full stack for runs (exact, append your own lane):
`pattern-updates,dec193,dec194,dec195,locale-gate,dec197,dec202,dec205,dec206,governed-recheck,<own>`
(create your WIP dir even if empty). Background runs, never `timeout`, never loop, one run per change. Final
run per lane: every pgTAP file your change can affect (at least all `phase_02_slice_12*.sql`, plus Slice 10/11
files touching your functions). Report: `lane-<lane>-report.md`.

## F1 `claude_s12_fix_dec193` (own WIP dir `fix-dec193`, range `20261022090000`–`099999`)
Findings R1-002 (DEC-209: `20261016042200` resolve anchor → `theirs_row.id`; CC-RES oracles in
`phase_02_slice_12_dec193_carry*` updated with DEC-209 citation), R1-003 (split `20261017044700` ≤300 lines —
keep timestamps ordered, update any md5/sha pins in `044710`/`044720`/`044800` that reference its body),
R1-005, R1-006, R1-007, R1-008, R1-009, R1-010 (legacy nested-slot rows: decide with evidence whether a
forward data migration is required for existing rows; never edit promoted migrations). R1-004 only as needed.
Files: `supabase/migrations-wip/dec193/*` EXCEPT `20261016041600_cms_detached_tree_safe_props.sql`;
`supabase/migrations-wip/pattern-updates/*`; Slice 12 dec193/pattern pgTAP; Slice 10/11 tests only if your
change requires (listed, cited).

## F2 `claude_s12_block_rules` (own WIP dir `block-rules`, range `20261022080000`–`089999`)
Implement DEC-210 (BE03c "Block composition rules (DEC-210)" paragraph in "Pattern versions and linked
updates"): fix-forward patches of CMS-03C-12 pattern save and CMS-03C-02 placement (promoted functions: patch
the LIVE body exactly — newest definition across promoted + WIP — anchor-checked like dec202), the
`cms.pattern.active_digest` provider (`pattern_block_rules_violated`; provider lives in dec193 WIP
`20261016044400` — patch forward in your dir), and align the writer's refusal (`dec193/20261016041600` — you may
edit THIS ONE file in place) to `details.reasonCode` `block_rules_violated` with the specified pointers.
Contracts: add the reason codes to the closed sets (`packages/contracts/src/cms-composition/`, the preflight
category reason set and fixed copy per P2-S12-AC-241; name each file before editing), Worker/Web mapping/copy
if refusal copy is keyed by reason. RED pgTAP per refusal and boundary: allowed child, disallowed child, empty
allow-list leaf, maxNodes at/over, maxDepth at/over, nested-reference expansion across the boundary, each
operation, provider on a pre-rule pattern.

## F3 `claude_s12_fix_dec194` (NOT YET RELEASED) — R2-01, R2-03, R2-04, R2-05, R2-09
DEC-212 (root, 2026-10-22): rename `platform_private.cms_taxonomy_merge_recoveries` →
`platform_private.taxonomy_merge_recoveries` (policies `taxonomy_merge_recoveries_select/insert`), touch list in
review-r2-report.md R2-01 option A; squash `190000` into `190050` if the reviewer's note still applies; R2-03
pre-filter the routing scan before taking per-party locks; R2-04 comments; R2-05 grant/posture tests; R2-09
labels. BE03c and runbook text already updated by root (changelog row "Merge-recovery support state ratified").
Files: `supabase/migrations-wip/dec194/*`, `dec194_sweep` pgTAP + dir, the postgrest isolation probe include.
Final: dec194 suites + Slice 12 taxonomy suites on the full stack; root runs the two dec194 race modules.

## F4a `claude_s12_fix_dec206` (own WIP dir `fix-dec206` if needed; edit `dec206` in place)
R3-01/R3-02/R3-04: BE03c now specifies `limit` 1–50 default 25 and a signed BE00 cursor (search the 2026-10-22
"DEC-206 read aligned to BE00" changelog row and the `cmsCompositionInstancesRead` validation row). Seal the
cursor with the SAME shared helper CMS-03C-13 uses (find it), bind entry, draft revision, sort and the caller's
user/acting context, ≤24 h expiry, 400 on tamper/expiry/cross-context; `limit` param; items ≤50. Update
contracts (`CompositionInstancesQuery`/`Page`), Worker parsing, web proxy and the composition page loader
(follows `nextCursor` until exhausted; keep a fail-closed guard with an explicit degraded state, no silent
truncation), FE03 rows if they state 100. Other R3 findings for dec206.
Files: `supabase/migrations-wip/dec206/*`, its pgTAP, the dec206 contracts/Worker/Web files listed in
`lane-dec206-read-report.md`.

## F4b `claude_s12_fix_recheck` (edit `governed-recheck` WIP in place)
R3-07 (wire membership tenure end exactly as the BE03b `cms_invalidate_reviews_for_person` equivalent does;
then the five suites that used a tenure end as their "lag" fixture need a genuine lag mechanism that no
trigger covers — e.g. a grant whose `valid_until` passes without an event — cite BE03c "As defense in depth,
activation recomputes…"), R3-20 (recheck takes block FOR SHARE before the subject lock: follow the Slice 12
lock order), R3-08 (one failing review must not abort the run or pin the cursor: isolate per review per the
spec's idempotency/bounded-run rules; if the spec is silent on per-item failure handling, report BOUNDARY), and
the other R3 governed-recheck minors. Files: `supabase/migrations-wip/governed-recheck/*`, governed pgTAP files
and dirs, the governed-recheck Worker module.
