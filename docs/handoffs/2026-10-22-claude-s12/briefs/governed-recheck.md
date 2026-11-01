# Lane `claude_s12_governed_recheck` — governed review recheck job and reviewer-authority invalidation (AC-202/203/204)

Read `docs/handoffs/2026-10-14-claude-s12/lane-rules.md` fully first; it binds you. Worktree
`/home/rob/.codex/worktrees/phase2-slice12/WeJammin`. Report:
`docs/handoffs/2026-10-22-claude-s12/lane-governed-recheck-report.md` (checkpoint early, after every run).

## Goal

Implement and prove P2-S12-AC-202, AC-203 and AC-204 (criteria text: grep `P2-S12-AC-20[234]` in
`.memory/pipeline/progress/slices/phase-02-slice-12.md`):
- the idempotent typed platform-queue job `cms.governed_review.recheck` (DEC-166 shape: a typed message on the
  existing platform queue, not a jobs-table row) enqueued by the consumers of `cms.block.lifecycle.changed.v1`
  (withdrawn block), `cms.schema.activated.v1` (changed bound policy or type version), `cms.pattern.activated.v1`
  and by the capability-grant revocation transaction;
- `cms_recheck_governed_reviews(kind, ref_id, batch)`: ≤500 reviews per run with continuation cursor, skips
  already `invalidated`, rebuilds hash/policy basis/identities, invalidates on difference with closed reason
  `dependency_changed` or `reviewer_authority_changed`, returns the subject to `draft`, cancels a `scheduled`
  subject's schedule (`cancelled`, `approval_invalidated`) in the same transaction; no event emitted;
- `cms_invalidate_governed_reviews_for_person(person_id, capability)` called by the revoking transaction (definer,
  not scoped to the revoker's party) plus the open-review assignment-revocation path.

## Sources (read the actual text, cite lines)

- BE03c `.memory/wiki/specs/be/03c-composition-taxonomy-localization.md` §"Governed review machinery (DEC-137,
  DEC-113, OD-1)" (line ~1439), §"Governed activation, retirement and scheduled activation" (~1457),
  §"Permission, RLS and grants" (~1597), §"Event schemas" (~1700), the GovernedReview* table rows.
- BE03b `.memory/wiki/specs/be/03b-editorial-workflow-publication.md` Review invalidation rules (grep
  `invalidat`), and the Slice 11 precedent `cms.review.dependency_recheck` (P2-S11-AC-113, DEC-166 in
  `.memory/wiki/decisions.md`): find its SQL (`grep -l dependency_recheck supabase/migrations/*.sql`), its Worker
  consumer and its tests, and mirror them.
- Existing governed SQL: promoted `supabase/migrations/2026101301*`/`2026101430*` governed files (single-review
  invalidation helpers already exist — reuse, do not duplicate); grant revocation producer (grep
  `revoke` in the capability-grant migrations, DEC-119/120).
- Intake research: `.lane-logs/s12-claude-intake-20261022/classify-200-296.md` (AC-202/203/204 rows).

## Claim

- NEW `supabase/migrations-wip/governed-recheck/` — timestamps `20261022030000`–`20261022039999` ONLY.
- NEW pgTAP `supabase/tests/phase_02_slice_12_governed_recheck.sql` (+ dir).
- Worker: NEW consumer/job files for the recheck (name them in your report before editing) + the minimal
  queue-dispatch wiring line(s) (name each existing file you must touch in your report BEFORE editing; if it
  is shared Slice 11 dispatch code, keep the change additive).
- If a promoted function must change, fix forward with `create or replace` in your WIP range, patching the
  live body exactly (see `docs/handoffs/2026-10-22-claude-s12/lane-dec202-report.md` for the anchor-checked
  patch technique used when a later migration appended a tail).

Do not touch: `supabase/migrations-wip/{dec193,dec202,dec205,pattern-updates,...}` or any other lane's files
(`docs/handoffs/2026-10-22-claude-s12/LANES.md`).

## Method

RED pgTAP first (staged ALT runner, lane `governed-recheck`; background, never `timeout`, never loop; the ALT
lock may be held by long root diagnostics — keep authoring meanwhile). Then GREEN. Worker Vitest RED→GREEN
with the pinned toolchain, focused files. Include in your final staged run the existing governed suites you
can find (`supabase/tests/phase_02_slice_12_governed*.sql`) to prove no regression. Race behaviour (concurrent
recheck vs decide): author a race module only if the spec names one; root runs race modules.

Final message: GREEN / PARTIAL / BLOCKED, report path + SHA-256, counts, files, Requests to root.
