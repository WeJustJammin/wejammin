# Brief — `claude_s12_dec193_spec` (owner-approved spec cascade for DEC-193)

Owner decision DEC-193 (end of `.memory/wiki/decisions.md`) — read it first, then: BE03c
`.memory/wiki/specs/be/03c-composition-taxonomy-localization.md` "Pattern versions and linked updates" (~:1380-1390),
CMS-03C-02/13/14/15 rows (route ~:160-177, validation ~:398-400, matrix ~:1274-1287, authority ~:1499-1512, resources
and schema blocks for `CompositionInstanceResource`, `CompositionUpdateDiffResource`, `CompositionUpdateRequest`,
`CompositionUpdateResource`, the CompositionInstance table row ~:1426 and DEC-175/176/181/185 rules); FE03
`.memory/wiki/specs/fe/03-cms-content-modeling.md` composition/diff components and the conflict row; IA03 `:493`;
contracts `packages/contracts/src/cms-composition/pattern-update*.ts`, `pattern-instance.ts`; the held WIP SQL
`supabase/migrations-wip/pattern-updates/*` and `lane-pattern-updates-report.md` (D-VALUE, D-RETIRE, B2, D-DETACH as
implemented today), `review-pattern-updates.md` and `review-pattern-updates-f1.md` §4/§6.

Write the spec text DEC-193 requires, and nothing beyond it:
1. Structural changes: define a node path's value for diff purposes (props, plus block identity and children) so a
   change of block identity or children between pinned and target is a collision the author resolves (yours/theirs),
   never silently adopted; text overrides keep "an override replaces the node's props".
2. Removed root: accept retires the instance row; `yours` makes it a detached local copy (DEC-193), not a linked row
   pinned to a target lacking the root; the diff and detach must never strand such a row.
3. Added roots: the diff lists roots new in the target version; accept never creates rows; the author places them via
   CMS-03C-02, and CMS-03C-02 must be able to place them without colliding with occupied paths (state how).
4. Detach: materializes the full subtree as a detached local block tree bounded by the pattern node limit (512 nodes,
   depth/prop bounds of patterns), stored how (column/table, typed field list with constraints), with no 128-key
   refusal; reads (composition reads, delivery) resolve a detached tree.
5. The resource/schema changes this needs (exact zod blocks in BE03c), error-matrix and validation rows, FE03 component
   rows for the diff UI (collision kinds, removed root choice, "new in this version" list), and the affected Slice 12
   acceptance criteria (find every P2-S12-AC row about linked updates/detach/diff in the tracker
   `.memory/pipeline/progress/slices/phase-02-slice-12.md` and `.memory/wiki/specs/phases/phase-2.md`; identical body edits in
   both; check no box). Changelog rows in each spec. No measurements or corpus counts in spec text.
Write ONLY the spec/AC files; no code. Record the acceptance-section SHA-256 before/after (tracker `## Acceptance
Criteria` to EOF). Report `docs/handoffs/2026-10-14-claude-s12/lane-dec193-spec-report.md`: every edit with before/after
text, open questions you could not resolve from DEC-193 (do not invent: list them for root).
