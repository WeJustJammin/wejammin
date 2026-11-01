# Lane claude_s12_gaps_api5 report

## Status
FINAL: GREEN for AC-238 (ALT run 3: 215 ok, 0 not ok); AC-010/AC-016 written UNRUN; AC-211/AC-001 BOUNDARY. HEAD cd89d54cc84403e32699666c8d3710f45bbffce0.
- AC-010, AC-016: composed apispecs written, eslint + prettier clean, UNRUN (apispecs run only under root's PostgREST runner).
- AC-238: pgTAP written and run green on the ALT staged runner (see Runs).
- AC-211, AC-001: BOUNDARY, no test (reasons and lines below).

## Scope
Rows: AC-010 "and complete the declared happy path"; AC-016 "and complete the declared happy path"; AC-211 "again before publish";
AC-238 "and satisfy the existing graph compatibility rule (DEC-199)."; AC-001 "and accessibility contracts in templates."

## Per-row outcome
| Criterion | Clause | Outcome | Identity |
|---|---|---|---|
| AC-010 | and complete the declared happy path | gap real (no composed test: `grep pattern-instances tests/postgrest` finds only the latency timing suite, which asserts 201 only as a timing fixture); NEW apispec, UNRUN | `tests/postgrest/phase-02-slice-12-pattern-placement.apispec.ts`: "CMS-03C-02 pattern placement happy path through the real stack [P2-S12-AC-010] an assigned author placing ... one audit record" and "... [P2-S12-AC-010] a nested pattern reference expands into its block roots ..." |
| AC-016 | and complete the declared happy path | gap real (latency-taxonomy creates 120 terms as a fixture and asserts only status 200); NEW apispec, UNRUN | `tests/postgrest/phase-02-slice-12-taxonomy-term-action.apispec.ts`: "CMS-03C-03 term action happy path through the real stack [P2-S12-AC-016] a taxonomy curator creating a term ... one taxonomy event" |
| AC-211 | again before publish | BOUNDARY (no test) | see below; existing placement-side re-proofs named for root |
| AC-238 | and satisfy the existing graph compatibility rule (DEC-199). | gap real and closable; NEW pgTAP GREEN | `supabase/tests/phase_02_slice_12_gaps_api5_pattern_compat.sql` (labels `A238-direct-*`, `A238-recursive-*`, controls `A238-control-*`, `A238-rawcopy-control-*`) |
| AC-001 | and accessibility contracts in templates. | BOUNDARY (no test) | see below |

## Files
(SHA-256 in the final message and the table at the end of this report.)
- tests/postgrest/phase-02-slice-12-pattern-placement.apispec.ts (AC-010)
- tests/postgrest/phase-02-slice-12-taxonomy-term-action.apispec.ts (AC-016)
- supabase/tests/phase_02_slice_12_gaps_api5_pattern_compat.sql (AC-238)
- docs/handoffs/2026-10-22-claude-s12/recite4/api5-proposals.json
- no product code, no WIP migration (no defect found), no existing file edited.

## Design notes
### AC-010 / AC-016 apispecs
Both reuse the latency world (`createLatencyStack`, `prepareLatencyWorld`, `registerLatencyBlock`, `draftEntryFactory`, the governed chain helpers): the
whole production Worker route set -> production RPC adapter -> Kong -> PostgREST -> newest SQL; only the verified session and an always-allow rate limiter
are supplied. AC-010 asserts: 201, body keys exactly `["items"]`, `PatternPlacementResourceSchema` (strict rows), paths/positions, ETag equals the
quoted committed entry version (read from `cms_content_entries`, must be the request version + 1), committed rows (path:position, ids) equal the response,
pinned pattern columns, exactly one `cms.composition.pattern.insert` audit event on the first item id, and the named RPC answered 200; plus a nested
reference expansion case (paths `/nested1/root1 ...`, BE03c line 1530). AC-016 asserts: 200, strict `TaxonomyTermResourceSchema`, lifecycle/version/null
parent+successor, ETag `"1"`, the committed `cms_terms` row (under the active vocabulary version, aliases), two active version-1 `cms_term_labels`, one
`cms.taxonomy.term.create` audit event and one `cms.taxonomy.changed.v1` outbox event for the term id (BE03c row 165; oracle 030-create.sqlinc:47-50).
Typecheck: the repo `type-check` project graph does not include `tests/`; the type-aware eslint (`--max-warnings=0`) is the gate and passed.

### AC-238 (technique, for root's acceptance)
The incompatible-nested branch of `cms_pattern_live_pin_reason` (20261016044100, the recursive `child.compatible_type_ids` containment at every edge) was
declared "not runtime-proven" in dec193_pattern_currentness/README.md. It is reachable without disabling a trigger or inserting an active row: the
CMS-03C-06 submit gate checks only that the nested version is `active` and the bound content types are active ("by construction, compatible",
20261013300820:153-160), so a DRAFT row copied directly in the RPC context with ONE patched member (`compatible_type_ids` = {type1, type2} over a child that
lists {type1}) goes through the REAL submit/assign/decide/activate chain and the REAL CMS-03C-02 placement (placement checks only the root's type, 20261014110300:150-156).
This is the precedent of `phase_02_slice_12_gaps_pattern_governed.sql` AC-200 (2b) ("draft rows copied directly in the RPC context to reach a stored state the honest
producers cannot"); it reuses that lane's `g2p_raw_copy`/`g2p_step` helpers unchanged. Please confirm you accept it for the ledger.
Observed: control (compatible) passes in submit and publish; raw-copy control (same copy path, true type set) passes; direct edge fails
`nested_pattern_not_active`, count 1, frozen status stale; recursive edge (honest top -> mismatching parent -> child) fails the same way. The only
difference between the control parent and the failing parent is the type set, so the type rule is the discriminator. The "or owner" half of the
inventory note is not separately constructible (a different-owner nested row is not joined, so it already fails through the nested-not-found branch of the same reason).

## BOUNDARY items
### AC-001 "and accessibility contracts in templates." (BOUNDARY, no test)
- BE03c 320-324 defines the template `blockRegistryDigest` as the JCS array of `{blockKey,blockVersion,releaseDigest,propsSchemaHash,rendererRef,lifecycle}`: the
  block accessibility manifest is not in the tuple; `cms_define_template` (20261013100200) never reads `accessibility`.
- The only template accessibility text is BE03c 1828-1830 (stable JSON Pointer paths; reserved profile/provenance regions content cannot hide or reorder),
  already cited under clause 0.
- No spec line states what a template must preserve of a placed block's accessibility contract. A test would invent the behaviour (refuse vs re-digest). Needed: an
  owner-ratified spec line, then pgTAP in template_authority.sql and a template.test.ts case.
### AC-211 "again before publish" (BOUNDARY, no test)
- The publication-time pattern recheck is the provider `cms.pattern.active_digest` with the CLOSED reason list `pattern_not_active`, `nested_pattern_not_active`,
  `pattern_digest_changed`, `pattern_block_rules_violated` (BE03c 1585), and the AC text itself says the nested-pin active/compatibility recheck "is the pattern
  provider's `nested_pattern_not_active` failed reason (DEC-199), not a new transport status". No spec line names a publication token for
  `pattern_depth_exceeded` / `pattern_nodes_exceeded` / `pattern_cycle`.
- A stored PatternVersion is immutable (20261014020200: every definition column frozen, only state/updated_at move) and its nested pins are exact, pre-existing,
  active-at-save rows (20261014020400:187-232), so depth, expanded node count and lineage-cycle outcome of a stored forest cannot change between save and publish;
  the only way to store a violating forest is a forged row (forbidden). The nested-pin half is already evidence under clause 0 (currentness PC-N03 submit/schedule/publish/execute).
- Placement-side re-proofs that already exist (inventory item 2): `supabase/tests/phase_02_slice_12_pattern_placement/065-defensive.sqlinc` titles
  "a nested reference to a lineage already on the chain is refused pattern_cycle at /patternId (409) [BE03c 1612]",
  "a forest nested 129 levels deep is refused pattern_depth_exceeded at /patternId (422) [BE03c 1612]",
  "a forest of 513 block roots is refused pattern_nodes_exceeded at /patternId (422) [BE03c 1612, DEC-175]" (real expander/plan functions, synthesized input, nothing forged).
- Needed from the owner/spec: whether "again before publish" for depth/nodes/cycle means the placement re-proof (those three are then the evidence) or a provider reason (then name the token).

## Runs
| # | Time (UTC) | Stamp | Target | Plan | Result | TAP |
|---|---|---|---|---|---|---|
| 1 | 04:34 | 003452-1616326 | gaps_api5_pattern_compat.sql (first version) | no_plan, 107 | FAIL: setup 1-41 ok; 42-... `cms_build_dependency_manifest` answered P0001 DEPENDENCY_UNAVAILABLE = HARNESS (missing consumer-fixture settings snapshot + JCS({}) entry bootstrap), not feature RED | .lane-logs/alt-staged-none-003452-1616326.tap sha256 eb63129a8dd0dbb5... |
| 2 | 04:35 | 003544-1620751 | same + dec193_consumers/000-fixture include | 191 | PASS, 0 not ok | .lane-logs/alt-staged-none-003544-1620751.tap sha256 a1212fe0fc81888dd3866e6a72afb0eb70de32bd34ec14a8d8a46d58f8792de9 |
| 3 | 04:36 | 003647-1626501 | final bytes (adds the raw-copy control) | 215 | PASS, 0 not ok | .lane-logs/alt-staged-none-003647-1626501.tap sha256 7ad94e4f827a75806b7292584ba62a64db6752be1f5e7c6cc984053652dfe9ae |

## Test corrections
none

## Spec citations
BE03c 164, 1530, 1694 (CMS-03C-02); 165, 1696 (CMS-03C-03); 320-334 (blockRegistryDigest tuple); 1585 (provider reasons, DEC-199 graph rule); 1678; 1828-1830
(accessibility handoff); DEC-226 (tier labels), DEC-235/236/237 (context only, none touches these rows).

## Requests to root
1. Run the two new apispecs under the PostgREST runner right after `pnpm db:reset` (they commit fixtures, reset again afterwards):
   `tests/postgrest/phase-02-slice-12-pattern-placement.apispec.ts` and `tests/postgrest/phase-02-slice-12-taxonomy-term-action.apispec.ts`.
2. Accept (or reject) the raw-copy-then-governed technique for AC-238 (precedent: gaps_pattern_governed AC-200 (2b)).
3. Owner/spec decisions for AC-001 (accessibility contract preservation) and AC-211 (which evidence "again before publish" names).
