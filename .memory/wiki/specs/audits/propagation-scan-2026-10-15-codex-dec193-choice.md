# DEC-193 choice clarification — propagation scan

Date: 2026-10-15 America/New_York (owner reply and durable record at 2026-10-16 UTC).
Orchestration/research/review: `gpt-6.1-sol` / `ultra`.
Implementation author, after approval: `Phils-Charm/deepseek-v4.1-flash` / `high`.
Status: APPLY APPROVED. The human answered **"Apply listed corrections (Recommended)"** to the five-correction confirmation in this continuation. Process the listed corrections serially, preserving the stated boundaries. No downstream spec, contract, WIP implementation or acceptance checkbox changed by this scan itself.

## Authority and scope

The human answered **"Honor each choice (Recommended)"** when asked whether keeping one structural change should preserve the other explicit choices in the same block. Every explicit per-path `yours`/`theirs` choice must apply. One structural choice may not silently replace the rest with an unchanged whole-block copy.

The confirmation is recorded in `.memory/wiki/decisions.md` under DEC-193 and as a full-body, same-title decision event in `.memory/raw/events/2026-10-16.jsonl`. The original event `.memory/raw/events/2026-10-15.jsonl:5` is unchanged. The compiler groups by exact title and selects the latest full text; a clarification-only replacement would lose the original decision, so the new event retains its complete body.

This is a targeted scan of linked-pattern update policy and its consumers, not a re-plan of Phase 2. Existing authorization, CAS, ordered positions, provenance, explicit added-root placement, error privacy and wire bounds remain locked. Promoted migration bytes remain immutable; consumer changes require forward migrations.

## Inventory

Programmatic search for `DEC-193|detached_tree|detachedTree|collisionKind|removed_root|newRoots` found 82 normative line hits: BE03c 40, FE03 10, phase plan 16, tracker acceptance section 16, IA03/depth-floor ledger zero. These are search hits, not defect counts; the ledger still contains contradictions in older vocabulary. All 16 currently affected plan/tracker criterion bodies match after link normalization. Contracts/Worker validation have not implemented the new structural vocabulary.

Paths below are relative to the active Slice 12 worktree. Line numbers are this scan's snapshot, not permanent anchors.

## Explicit contradictions and proposed fixes

1. **Honor all explicit choices.** BE03c `03c-composition-taxonomy-localization.md:1464` says a structural `yours` copies the unchanged detached row and the instance's other choices change nothing. AC214 in phase plan `phase-2.md:3313` and the tracker likewise equates this result with ordinary detach. Replace that fallback with a resolved tree reflecting every explicit choice, including mixed structural and props choices. Ordinary explicit detach still copies current effective content. Define overlapping ancestor/descendant application without dropping answers. This is the already-confirmed policy correction.
2. **Represent every admitted subtree.** BE03c:1540 stores full descendant paths under a 512-character ceiling, while key grammar admits 64-character keys and depth eight: eight maximum keys already need 520 characters. Nested-reference namespaces can make paths longer. Replace repeated full-path storage with an internal parent-indexed preorder snapshot and relative key segments, preserving namespaces, sibling order, block identities and every effective props value for up to 512 expanded block nodes. Keep snapshots server-side and distinguish expanded storage validation from public path/authored-tree bounds. This representation is an implementation proposal, not a new refusal or a change to product limits.
3. **Scope no-update to representable pattern-origin rows.** BE03c:403/1203–1217 promises no-update for every readable row but requires positive pattern pins. General instance pins are nullable at :911, and WIP `20261014140400_cms_get_instance_update_diff.sql:65` refuses standalone null-pattern rows. Scope no-update to pattern-origin rows retaining valid provenance pins, including detached/retired/older versions. Preserve standalone refusal; never fabricate a pin. Reconcile AC114 and FE no-update wording.
4. **Cascade typed contracts and actual consumers before implementation acceptance.** `packages/contracts/src/cms-composition/pattern-update.ts:146/213` still uses arbitrary JSON values and rejects empty-path bulk eligibility; the WIP planner compares props only, next-row helper detaches into props, and Worker answer validation rejects detached accept results. Introduce typed structural collisions/new roots/slot paths, preserve per-choice results and provenance, add placement root subsets, and integrate snapshot hashing/render/checker/restore/carry-over. Use contract-first RED → GREEN → REFACTOR in bounded follow-up claims; this scan does not release code writes.
5. **Reconcile depth/tracking without ticking acceptance.** `.memory/pipeline/progress/verification/2026-10-11-slice-12-depth-floor.md:267–268` and other affected rows still describe linked-only accept/local-props detach. Update affected criterion bodies identically in the phase plan, tracker and ledger after final wording is approved. Preserve the 285-row denominator and all unchecked states; these corrections are not acceptance evidence.

## Implicit assumptions and consistent foundations

- **Do not introduce a retired-detach ban.** The old ledger permits any linked instance, but the authored cascade excludes retired rows in BE03c:404/1464/1591, FE03:885/2667 and AC120/215. The author left this as Q2 in `lane-dec193-spec-report.md:108`; the current human answer does not approve that restriction. Preserve the earlier permission unless the owner separately changes it. This is restoration of existing scope, not an additional policy choice.
- BE03b:1709's comparison hash and the composition instance content hash must include canonical detached content, not merely the old props/pattern fields.
- BE03c:1513/1520/1522 publication manifests, rendering, checker traversal, restore and revision carry-over must enumerate detached reachable blocks and treat retained pattern pins as provenance rather than live rendering dependencies. Do not reopen those pins to reconstruct detached content.
- IA03's explicit per-path choices/no-silent-overwrite rule is consistent. Preserve unanswered pins, CAS/authority, positions and explicit new-root placement.
- No public snapshot response is proposed: existing metadata-only resources and their wire-size bounds remain intact. Do not impose the authored forest's 256-KiB whole-value bound on an expanded snapshot or add an arbitrary 128-key refusal.

## Apply gate and execution order

The scan skill requires confirmation before its apply shard. Request approval for the listed corrections, preserving existing retired-detach permission and all locked boundaries. On approval, process explicit contradictions serially, record each result, flag any new product ambiguity rather than guessing, and run cross-layer consistency checks before releasing implementation claims.

The `memory_compile` MCP tool is not available on this surface. Verified fallback is `node .memory/pipeline/compile.mjs` from the active worktree, but it broadly rewrites derived wiki/schema/graph/semantic outputs. Do not run it until those outputs and manual-derived edits are reconciled and explicitly claimed. No graph-refresh claim is made by this scan.

Next implementation order after approved spec/contract cascade: snapshot contract/validator and node enumeration; mixed-choice resolution/materialization; forward-only comparison/render/checker/restore/carry-over integration; strict Worker/Web consumers; mutation-sensitive and concurrent failure proofs; independent review; staged upgrade/canonical gates and read-back tracking. No promotion or slice/phase completion is authorized here.


<!-- spec-graph: auto-generated -->
## Related Specs

### Phases into
- [[specs/phases/phase-2|Phase 2 — Identity, admin, CMS/settings]]
