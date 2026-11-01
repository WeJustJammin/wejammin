# DEC-198 ordinary pending-row carry propagation

Owner answer: **Preserve pending rows (Recommended)**, 2026-10-16.
Canonical decision: `.memory/wiki/decisions.md`, DEC-198.

## Scope and applied source changes

- BE03c receiving obligation 4 now explicitly selects newest rows before state
  eligibility and carries both active and pending_diff rows for ordinary append
  and conflict resolution. Pending state, prior pin and pending target survive;
  no target acceptance or history resurrection is inferred.
- Phase2 plan and Slice12 tracker AC245 carry the same requirement. AC count and
  unchecked status remain unchanged. Restore's named-source active-row translation
  remains separately governed by AC243/receiving obligation2.
- IA03 and FE03 were scanned for active-only carry, carried_from_id and pending
  autosave contradictions; none was found. Their pinned pending-render behavior
  remains unchanged. No public DTO/schema or new authorization is introduced.

## Required implementation propagation

- Add real ordinary append and conflict-resolution controls over newest pending
  heads, including unchanged pinned content despite a different active target,
  unchanged pending target/state and immediate provenance; preserve active-history
  suppression and complete source immutability.
- Keep carry420/421/422 and private read/manifest work distinct from restore427+.
  Existing active-only implementation plans are historical and superseded only
  for ordinary copy eligibility. Do not silently widen restore eligibility.
- Existing D5 content and render requirements still apply to pinned pending
  content. Add a discriminating comparison control before broad consumer closure.
- Root runtime and independent review precede any GREEN/AC claim. No production
  gate, external gate, acceptance checkbox or signature is cleared by propagation.

The historical excluded-parent interpretation remains separate; this decision
does not authorize path-based retargeting or resurrection of nonselected parents.
