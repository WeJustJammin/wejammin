# DEC-193 private simultaneous resolver — GREEN author handoff

Author: native `gpt-6.1-sol` / `ultra`, 2026-10-16.
Worktree: `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`.
Status: **AUTHOR UNRUN; frozen for root validation and independent review**.

## Exact scope and RED boundary

Only these three NEW paths were authored under the root Dispatch claim:

- `supabase/migrations-wip/dec193/20261016040500_cms_pattern_snapshot_expanded.sql`
- `supabase/migrations-wip/dec193/20261016040600_cms_pattern_update_resolve.sql`
- This report.

No existing WIP, promoted migration, writer, GET, test, public contract, spec,
tracker or protected-primary file was changed. No project runtime, SQL/parser,
formatter, test, DB, process command, Docker, network or Git operation was run.
Static source reads/hash analysis and absolute apply_patch were the only actions.

Root reported actual completed RED:453 tests,293 PASS,160 FAIL, comprising55
missing-private-seam failures and105 actual writer/digest semantic failures, with
no SQL abort and passing signed/governed/discriminating tuple prerequisites.
That execution is root evidence, not an author rerun. These WIPs address only the
private seam; existing writer/digest failures are intentionally not closed here.

## Locked source and implementation seam

Read the actual private-GREEN Dispatch immediately before Acceptance Criteria in
`.memory/pipeline/progress/slices/phase-02-slice-12.md`, BE03c1487 in full,
BE03c1563, DEC-193 at `.memory/wiki/decisions.md:5302–5308`, the existing detached
validator/typed delta/planner, and the seven frozen resolution test/support files
plus their original author report. No new product choice or public schema arose.

BE03c1487 requires every explicit answer simultaneously under the selected
topology, noncolliding target adoption, unchanged local values, highest membership
suppression, resolved detached content for structural yours, retirement for
removed-root theirs and atomic refusal of inconsistent reachable content.
BE03c1563 supplies the canonical preorder/relative namespace grammar and shared
512-node/per-value validator, without whole-snapshot diff-read or row-path caps.
Registry authority, protected-field/schema checks, pin eligibility, SQL locks,
CAS, digest computation and actual append remain the future caller's duties.

## Representation helper

`cms_pattern_snapshot_expanded(jsonb) RETURNS jsonb` is private, immutable,
security invoker and empty-search-path. It calls the shared canonical validator,
then reconstructs absolute addresses from each declared parent plus every relative
key segment. The result is an ordered expanded array of
`{chain, root, isRoot, node, children}`. `node` retains its five exact canonical
fields and its original JSON props; `children` lists direct block addresses in
preorder sibling order. Nested-reference namespaces are not flattened away.

JSONB null returns an empty expanded target. SQL NULL is validation failure.
The resolver independently forbids an empty/JSON-null B and a nonempty T with a
different root address. Valid integral numeric parent values are cast through
numeric only after shared validation, preserving valid JSON numeric spelling.
There is no stored512-character snapshot-address, aggregate128-key,256KiB or
public128-path refusal. The existing canonical validator remains authoritative.

## Simultaneous resolution

`cms_pattern_update_resolve(B,T,O,C) RETURNS jsonb` returns exactly
`{disposition, tree, overrides}`. It performs no persistent read or write.

1. Validate canonical B/T and O/C JSON shape. Override keys must name B nodes,
   retain their existing512-character key bound, and satisfy existing per-value
   bounds. Key presence is tested separately from JSON null. No aggregate
   public diff-read bound is imposed on these internal full trees.
2. Reuse `cms_pattern_diff_delta` on the complete ordered expanded arrays, with
   no truncated public diff. Build independent path maps and require exactly one
   valid unique answer for every emitted collision, none for noncolliding,
   unknown or suppressed descendants. Choice order changes no selector state.
3. Select every union path before traversal. Highest added/removed membership
   frontiers alone propagate their selected source to suppressed descendants.
   Ordinary ancestor choices select that node's identity/children/props only;
   they never replace independently answered descendants with an entire L block.
4. Unchanged paths retain O; changed noncollisions adopt T and drop redundant O.
   Props yours retains the authoritative O value, including JSON null. Structure
   yours selects L identity/children/effective props. Structure theirs takes T
   identity/children and retains O only where T props equal B props. Any structural
   or removed-root yours marks the eventual valid content detached.
5. Traverse selected child edges in selected sibling order. Missing/absent child,
   repeated node, unreachable selected node and final513-node output all raise
   `P0001:VALIDATION_FAILED`; no answer is silently discarded. Reconstruct relative
   keySegments from the actual chosen parent address and validate the entire
   canonical result with the same shared predicate before returning it.

Removed-root theirs returns retired/JSON-null-tree/empty-overrides only when no
selected node remains. Otherwise the result is linked or detached, never noop.
Linked returns its effective resolved tree and retained target-reachable override
map; detached returns its selected canonical tree and empty overrides. The caller
will decide storage/pins: these functions append nothing and expose no public tree.

Both functions belong to `wejammin_cms_definer`; PUBLIC, anon, authenticated and
service_role execution is explicitly revoked. All helper calls are private,
store-free functions already owned/available in the CMS closure. No API privilege
or table/sequence grant is added. No security-definer content resolver is created.

## Frozen manifest and verification limits

| Path | LF lines | Bytes | SHA-256 |
| --- | ---: | ---: | --- |
| `supabase/migrations-wip/dec193/20261016040500_cms_pattern_snapshot_expanded.sql` | 66 | 2748 | `f58cb800533044b6653b67a7651e459aed98b0035687786eea6b0619d85ac0e4` |
| `supabase/migrations-wip/dec193/20261016040600_cms_pattern_update_resolve.sql` | 191 | 9449 | `50087e85f14ec02d1b0896dee8fbcfafffd08e7b6b4a911dac27fe893bc22a6d` |

Read-only dependency binding: existing40100 delta SHA
`f9065f20e67db4bfef6390d42b211f2c4cad0c9f6c5e76f4f49b432bb9e81288`;
existing40000 storage/validator SHA
`ac3ec91d42b72fee2e5b4420c15c8cda8a33990483d5dfad3500448d343d3371`.
Static rehash of all seven resolution driver/support files matches the frozen
test author's manifest. No test oracle or source fixture was revised.

Static reasoning/readback is not SQL parsing, GREEN, mutation sensitivity,
performance validation or actual API atomicity. Root must stage both new WIPs
after40000/40100 and run the frozen resolution driver, distinguish newly passing
pure cases from still-failing unmodified writer cases, then independently review
choice suppression/null presence/reachability/order and ACL metadata. Root owns
all actual DB execution under the canonical locks and any later writer release.

TDD kept the frozen exact hybrid/inconsistency oracles authoritative. Surgical
development guidance limited edits to the two private seams; adversarial review
guided explicit coverage, malformed/null distinction and fail-closed graph checks.
