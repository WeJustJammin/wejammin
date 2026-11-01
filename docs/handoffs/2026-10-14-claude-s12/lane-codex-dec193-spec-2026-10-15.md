# Lane: DEC-193 spec cascade (Codex)

Task name: /root/phils_dec193_spec_20261015
Date: 2026-10-15 America/New_York (report written 2026-10-16 UTC).
Model: Phils-Charm/deepseek-v4.1-flash / high (exact; no fallback used).
Status: **UNRUN / IN PROGRESS — no acceptance claim.** Awaiting root consistency review; freeze after all six files are written.

## Authority and boundary

- Worktree: /home/rob/.codex/worktrees/phase2-slice12/WeJammin, HEAD b16edb54a7a1b698ed8ca15b6085046d4270626e.
- Primary checkout /home/rob/Projects/WeJammin is READ-ONLY; never written.
- Edits use apply_patch only.
- The root design and owner confirmations are already provided; this lane records them, it does not create a new product decision.
- Owner already approved policy "Honor each choice (Recommended)" and all five scan fixes "Apply listed corrections (Recommended)". No policy re-ask.

## Exact six writable paths (only these)

1. .memory/wiki/specs/be/03c-composition-taxonomy-localization.md (BE03c)
2. .memory/wiki/specs/fe/03-cms-content-modeling.md (FE03)
3. .memory/wiki/specs/be/03b-editorial-workflow-publication.md (BE03b)
4. .memory/wiki/specs/phases/phase-2.md (phase plan)
5. .memory/pipeline/progress/verification/2026-10-11-slice-12-depth-floor.md (depth-floor ledger)
6. docs/handoffs/2026-10-14-claude-s12/lane-codex-dec193-spec-2026-10-15.md (this file, new)

Everything else is read-only: tracker, decisions/raw, code, contracts, WIP/applied SQL, scripts. No tests/lint/type/build/DB/network/runtime/git mutations. No memory compile.

## Root design recorded by this cascade (not this lane's own decision)

1. A pinned expanded tree B; L = B with local overrides; T = target. NodeValue { blockKey, blockVersion, props, children: ordered FULL direct expanded child addresses }. base/theirs NodeValue|null; yours existing local props override|null (structure derived server-side).
2. Canonical collision precedence: removed_root > structure (presence/identity/ordered-children change) > props (same structure, target props changed, local override differs base). added/removed subtree highest node only, descendants suppressed per current contract; collision coverage computed BEFORE answers.
3. Structural yours chooses L local node presence/identity/children/effective props; structural theirs chooses T node, retains override only if T base props unchanged. Props choices select L/T props; unchanged target retains L, changed non-collision adopts T.
4. All node choices SIMULTANEOUS; descendant answers apply within chosen reachable topology. No unchanged whole-instance fallback, no answer discard, no reparent, no resurrect.
5. Inconsistent complete answers (e.g. parent excludes X but X answer requires present, or parent requires X but X absent), invalid selected graph/registry/protected props/children => atomic 422 COMPOSITION_VALIDATION_FAILED, SQL VALIDATION_FAILED, /instances/0/choices existing token; no new reasonCode.
6. Existing 400 malformed, 422 bad choice, 409 bulk diff_has_collisions mappings preserved; no pattern_nodes_exceeded token added to the 03C-15 closed list.
7. PRIVATE snapshot { format: 'cms.detached_tree.v1', nodes: [{ parent: number|null, keySegments: string[], blockKey, blockVersion, props }] }; 1-512 expanded blocks; root index 0 sole parent null; earlier parent active preorder stack (no closed-subtree reopening); relative key segments preserve ref namespaces; unique reconstructed addresses/consistent ancestry, sibling order.
8. All effective props COPY EXACT under existing per-value/registry bounds; no new object-only coercion if existing admits other JSON; no whole-tree 128-key/256-KiB/depth-8 snapshot bound.
9. Snapshot tree server-side; row detached props {}; root identity matches; digest all reachable blocks; provenance pins not live pattern-render deps.
10. Ordinary detach copies L UNCHANGED; accept structural yours materializes RESOLVED MIXED tree; props-only target topology accept linked pins T and selected valid props.
11. Removed root theirs => retired; yours => active detached; retain PRIOR positive pin/provenance; preserve path/slot/position.
12. Added roots separate explicit placement, never auto-appended.
13. PUBLIC ExpandedPatternNodePath same slash-joined key grammar, 1-72 segments, max 4680 ASCII (= 9 forests * 8 keys * 65); use for diff path/children, choice path, new-root/root-subset addresses; old short strings unchanged, no encoding/shortening. Actual CompositionInstance.path/slotPath/stored row 248-octet cap UNCHANGED.
14. Expanded child list reflects all actual children within 512 total, not authored 32-child limit. Existing 128 diff paths / aggregate 256 KiB wire bounds remain; no full snapshot response.
15. No-update ONLY pattern-origin rows retaining valid positive provenance pins (detached/retired/older included); standalone NULL pin remains refused — not fabricated pins. Ordinary detach admits newest LINKED pattern-origin including retired; restore earlier permission, do not ratify author Q2 ban.
16. Include canonical snapshot in BE03b D5/contenthash; BE03c render/checker/manifest/restore/carry-over consume all reachable blocks without reopening provenance pins.
17. FE accurately describes per-choice mixed results/atomic inconsistent answers, not whole-block ignore.
18. Reconcile ONLY the 16 existing AC IDs 028, 112, 113, 114, 117, 119, 120, 122, 123, 214, 215, 218, 243, 245, 247, 258 in phase plan + depth ledger with correct normative wording; denominator 285 unchanged; NO ticks. Root tracker (read-only) mirrors after freeze.
19. ALSO small DEC-192 consistency fix in the BE03c derived LocaleVariant state approved row: effective approved OR scheduled OR published (current row omits scheduled; gated code 050400 already admits). No other locale changes.
20. No other product scope; no fake receipts.

## Clause application status (serial; source context read first)

- C1 (BE03c private snapshot representation): APPLIED. CompositionInstance table row now specifies the private `{ format: 'cms.detached_tree.v1', nodes: [{ parent, keySegments, blockKey, blockVersion, props }] }` preorder snapshot (1-512 nodes, index 0 sole root, relative key segments preserving reference namespaces, exact effective props, no whole-tree key/KiB/depth bound).
- C2 (BE03b D5/contenthash canonical snapshot): APPLIED. BE03b D5 block side hash hashes a detached row's canonical detached content; the dependency manifest `blocks` group covers the detached tree's reachable blocks and `patterns` records the pin as provenance only; the DEC-141 recorded-reference paragraph and a BE03b changelog row record it.
- C3 (BE03c no-update scope to pattern-origin rows; restore retired-detach permission): APPLIED. CMS-03C-14 no-update is scoped to a readable pattern-origin row with a positive pin (a standalone no-pin row stays refused); `detach` admits any linked pattern-origin row including `retired` (validation matrix, authorization matrix, composition table, Zod comment).
- C4 (BE03c/FE03/phase/ledger: honor each choice, mixed results, atomic inconsistent answers): APPLIED. Linked-update paragraph, composition table row, FE03 component row and Slice 12 pattern-updates rule, and phase-plan AC-117/AC-214/AC-215 all state simultaneous choices, mixed resolution, resolved-tree materialization (not an unchanged whole-instance copy) and atomic 422 `COMPOSITION_VALIDATION_FAILED` at `/instances/0/choices`.
- C5 (public ExpandedPatternNodePath grammar/bounds): APPLIED. New `ExpandedPatternNodePath` Zod type (row-path grammar, 1-72 segments, max 4680 ASCII) used for diff `path`/`children`, `choices` path, `newRoots` and `roots`; validation-matrix row, placing-selected-roots and diff paragraphs updated; stored row `path`/`slotPath` and the 248-octet cap unchanged.
- C6 (DEC-192 derived LocaleVariant state scheduled fix): APPLIED. BE03c derived variant state now reads `approved`, `scheduled` and `published` all show `approved`, consistent with the DEC-192 gate.
- C7 (16 AC rows phase plan + ledger wording): APPLIED. Phase plan AC-028/112/113/114/117/119/120/122/123/214/215/218/243/245/247/258 carry the corrected DEC-193 wording; the 15 matching depth-floor ledger rows now equal the phase-plan body text exactly (verified). Denominator 285 unchanged; no checkbox ticked.

## Verification performed (read-only)

- HEAD confirmed b16edb54; branch claude/phase2-slice12.
- Six target paths present; this file did not exist before (claim 6 is new).
- Approved scan .memory/wiki/specs/audits/propagation-scan-2026-10-15-codex-dec193-choice.md read (APPLY APPROVED).
- Canonical DEC-193 + owner clarification read in .memory/wiki/decisions.md.
- Phase plan rows for the 16 IDs already carried DEC-193 wording in the working tree; the 15 matching depth-floor ledger rows were stale and are now reconciled to the phase-plan body text (exact-equality check: no mismatches).
- No checkbox in the phase plan or ledger was ticked; the 285-row denominator is untouched.
- BE03c preflight provider `cms.pattern.active_digest` now treats a detached row's `patterns` entry as provenance and hashes the detached tree's own reachable blocks.

## Blocker

None. No model-availability error.

## Bounded correction pass (root-released, independent gpt-6.1/ultra BLOCK)

Five corrections applied on the same six claimed paths; no tests/runtime/git/compile; unrelated dirty bytes preserved.

1. **P1 — corrupted CompositionInstance row repaired.** The row (now BE03c:1557) had a duplicated prefix and a truncated regex from an earlier `$ ` replacement hazard. The whole row was rebuilt by slicing (no `String.replace` with a replacement string) and patched as one line. `detached_tree` is an optional object `{ format: 'cms.detached_tree.v1', nodes: 1..512 }` of exact `{ parent, keySegments, blockKey, blockVersion, props }` objects; index 0 is the sole root with `parent` null; every other `parent` is an integer earlier index open on the active preorder stack (closed subtrees never reopened; `[null, 0, 0, 1]` rejected); nonempty relative `keySegments` are complete anchored ASCII `^[a-z][a-z0-9_-]{0,63}$`, preserving reference namespaces, the row's block-root key chain, unique addresses, ancestry and sibling order; `props` copies effective props exactly under the existing per-value bounds with no object coercion and no aggregate 128-key/256 KiB/depth bound. Row `detached` `props` is `{}`; root identity matches; one pure immutable shared validator. Other row constraints, `position`, provenance and immutability preserved.
2. **P1 — residual retired-detach bans removed.** BE03c linked-update paragraph (a `retired` row is not accepted but the newest version of its path may still be detached), BE03c Testing Strategy line, the prior BE03c DEC-193 changelog row, and FE03 Slice 12 pattern-updates rule now state that the newest linked pattern-origin `retired` row may be detached; a detached row still cannot accept or detach; newest-row/CAS/edit-authority unchanged. Full scan of the six claimed files found no other contradictory retired clause.
3. **P2 — no-update predicate explicit.** BE03c CMS-03C-14 validation row, the diff-resource comment, the behavior paragraph, and phase-plan AC-114 plus its ledger body now state the predicate: a readable row that carries a positive provenance pattern pin AND is NOT (linked AND `active`/`pending_diff` AND newest) gets the no-update diff, including a historical linked `active`/`pending_diff` row that is no longer newest; a standalone NULL-pin row is refused. The ordinary no-newer-compatible-target case is preserved.
4. **P2 — B/L/T contract explicit.** BE03c `PatternUpdateChoice` comment and the linked-update resolution paragraph define B (pinned expanded tree), L (B plus local overrides) and T (target): structural `yours` selects the L node's presence, identity, ordered children and effective props; structural `theirs` selects the T node and retains a local override only where T left B's props unchanged; props choices select L/T; unchanged target retains L, changed non-collision adopts T. A worked counterexample (B block `a`/`old`, T block `b`/`new`, `yours` yields block `a`/`old`) removes the ambiguity. Simultaneous reachable descendant answers and the atomic inconsistent-graph 422 are unchanged.
5. **P2 — provenance-only exception narrowed.** The exception now applies only to rows carrying a nonnull `detached_tree`. Tightened BE03c preflight provider (BE03c:1530), BE03b manifest `patterns` row (BE03b:1779), BE03b D5 block side hash (BE03b:1709), BE03b DEC-141 paragraph, both DEC-193 changelog rows, and phase-plan AC-247 plus its ledger body. A plain `detached` row with a NULL `detached_tree` (a CMS-03C-02 `linkMode: detached` row) is not exempted and keeps its defined pinned render/checker behavior. No migration, backfill, producer or placement scope was expanded; no legacy row is claimed backfilled.

Review notes preserved: no authority widening; 72-segment/4680-character public address bound and the 248-octet row cap unchanged; wire/error/CAS/explicit added-roots unchanged; the 15 ledger body matches and the 8 phase-plan changes (final count; the initial freeze recorded 7 as historical) stay within the 16 allowed IDs; 285-row denominator with 16 rows unchecked; C6 `scheduled` locale fix intact.

Status remains **UNRUN**; no independent CLEAR claim is made.

## Handoff

Root (6.1) owns planning, validation, review, integration. Do not invoke the old 1163-line report as authority and do not modify it. Freeze promptly after all six files are written; root verifies.
