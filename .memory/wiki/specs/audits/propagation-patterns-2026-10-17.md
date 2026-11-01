# DEC-202 approved default-template propagation — 2026-10-17

Status: approved documentation/tracking application and constrained spec-graph refresh complete. SQL/Web implementation and runtime acceptance remain OPEN. No full live-memory regeneration was performed.

Owner approval was recorded immediately at 2026-10-17T23:38:29Z in `.memory/wiki/decisions.md`, DEC-202. This applies the explicit/implicit documentation corrections identified in [the scan](propagation-scan-2026-10-17.md); it does not authorize changes to immutable history, completed replay, public request operands or capability boundaries.

## Applied source corrections

| Source | Applied correction |
|---|---|
| IA03 and its deep dive | Exact authorized active-schema default becomes the first revision's server-derived pin; absent default stays SQL NULL. Preserve resolver refusal mapping, completed replay ordering, ordinary author/editor authority and immutable history. |
| BE03b | Defines initial-default producer, same-owner relation2→template3→schema4 fencing and post-wait checks; documents 404 missing/concealed without details, 422 exact pointer-array DETAIL, 409 retired/blocked, eligible superseded defaults and unexpected-fault propagation. |
| BE03c | Narrows the superseded-version initial-create exception only; live pattern/publication active-only gates are not weakened. |
| FE03 | Exact neutral error copy without template identity/control; preserve entered data and focus. An unknown mutation retains immutable body/evidence/key until settled; changed intent receives a fresh key only after settlement. Receiving tests remain explicitly open. |
| Plan and Slice 12 tracker | Add eleven unchecked AC286–AC296, preserving all original285 criterion lines; floor/authored counts now296. |
| Phase 02 progress | Current active denominator3321, authored3325, activechecked2670, phase9/17. Four external gates remain authored and unchecked. |

The new [depth-floor ledger](../../../pipeline/progress/verification/2026-10-17-slice-12-dec202-depth-floor.md) records derivation, original criterion-line hashes, mirroring and evidence limits. The old285-criterion ledger remains historical and unchanged.

## Independent review and consistency

Native independent source reviews found no remaining concrete scoped defect: `native_web_b_review_20261016` reviewed root BE03b/counts/links; `native_registry_green_20261016` reviewed IA pair, BE03c and FE changes, not its own implementation. Initial new-criteria broken BE links/heading references and omitted eleven in the count breakdown were corrected before final source review. Both plan and tracker contain296 unique consecutive IDs, none checked, and all eleven new descriptions/references match after relative-path normalization. Original285 criterion-line hashes are unchanged.

### Source hashes at application freeze, before generated graph-tail refresh

- `.memory/wiki/specs/ia/03-cms-content-modeling.md`: `0e9d216484d92fadaf6a6618a26d94f5dc7b2a11a4072fa1507819aefb29daac`.
- `.memory/wiki/specs/ia/deep-dives/03-cms-content-modeling.md`: `be9295fc6ecfcd4f3576437f03e5faabd29bc8bf568b507b9ebe91c636d25008`.
- `.memory/wiki/specs/be/03b-editorial-workflow-publication.md`: `d98b1953aa2b0a9136870eed203314c63a40ff4eb089eece7981b7cbf3f108ce`.
- `.memory/wiki/specs/be/03c-composition-taxonomy-localization.md`: `4f51ccf3ce052713500ceecb57f30049e74fce67fc6445d339f417fce9e17985`.
- `.memory/wiki/specs/fe/03-cms-content-modeling.md`: `d302b6b565652149cd0a248f5571d93f75459b4be02b29e40bfac9fa3a7b0a8b`.
- `.memory/wiki/specs/phases/phase-2.md`: `595d4a76aa762bc7563136204073a575e863eb0d2f482ede32538eba392f5ae3`.
- `.memory/pipeline/progress/slices/phase-02-slice-12.md`: `4fc0d849c08c3a5b2f64738f2f84aa524bcf74664c7375fba11d5c3a3a92f1cf`.
- `.memory/pipeline/progress/phases/phase-02.md`: `eb86a5b59cdc4e61884f2ab0a60819d713130c2bb1466fb3cf59377e9ecef78f`.
- `.memory/pipeline/progress/verification/2026-10-17-slice-12-dec202-depth-floor.md`: `f1165d67aa63794178939b52eb5d47964765b977cfc24bfa54d2154da3528223`.

## Constrained compiler and graph refresh

The MCP `memory_compile` tool is unavailable in this session. Root used its existing source API, `compileMemory({projectRoot, memoryRoot})`, with both roots explicitly set to a fresh disposable specs-only snapshot at `/tmp/wejammin-dec202-memory-compile.ayKzRMKc`. The snapshot contained no symlinks and did not share writable source files with the worktree. Actual execution exited0: `ok:true`, rawFiles0, knowledgeEntries1567, chunkEntries82278, semanticEntries82278, specGraphNodes1668, specGraphEdges10187, specGraphLintIssues67. This is an explicit source-API fallback, not a claimed MCP invocation.

Only three generated graph JSON/lint/hub files and seven generated Related Specs tails were adopted. Every non-generated prefix was preserved except boundary blank-space normalization; all generated suffixes satisfy the compiler's grammar. Previous versions of all ten files remain recoverable under the snapshot's `previous-generated/` directory. No generated raw/knowledge/decisions/patterns/config/semantic/index output was adopted. Independent native artifact review found all ten adopted files byte-identical to the compiler outputs at adoption and source prefixes unchanged at the stated boundary.

Graph warnings remain warnings, not waived or acceptance: the previous graph had64, the fresh graph67. Exactly three newly indexed ORPHAN_SPEC warnings concern already-existing DEC-198/DEC-199/DEC-200 propagation reports. No new DEC-202 orphan was found. The graph refresh does not prove full live-memory regeneration or final phase readiness.

## Open gates, not inferred from documentation

- Scan E3/E4 public-create SQL producer and lock-order defects remain implementation work; scan I9 Web receiving copy remains code/TDD work. Shared public contracts already represent these errors; no new wire operand or error enum is required by this propagation.
- Public-create test receipt is RED70/76: six stored-pin/through-pin failures across owner, author-only and editor-only callers. This is not lifecycle/refusal/replay/fault/race/Web acceptance.
- Broad raw-to-wiki regeneration was deliberately confined to the disposable snapshot because it overwrites hand-authored memory. Live graph outputs were refreshed as documented above; no daemon/config changes or full live-memory rebuild is claimed.
- Canonical `pnpm db:verify` then `pnpm validate`, receiving-surface tests, all slice gates and final `/validate-phase` remain required. No criterion is closed by this record.


<!-- spec-graph: auto-generated -->
## Related Specs

### Phases into
- [[specs/phases/phase-2|Phase 2 — Identity, admin, CMS/settings]]
