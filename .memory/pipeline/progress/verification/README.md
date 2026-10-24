# Verification Evidence

This directory holds Slice 12 verification artifacts: immutable historical JSON
receipts, source-pin manifests, recovery CJS files, and evidence records.

## Evidence rules

- Historical artifacts are append-only evidence. A new dated artifact must use
  a new name; it must not overwrite an older receipt or source pin.
- Historical receipts provide context only. They do not grant acceptance,
  privilege, producer identity, or current-state proof.
- An active audit requires a fresh source grant and a recorded consumption event
  before any daemon or `/proc` read. Root reviews and pins the exact source and
  commands before execution.

The dated metadata helper is a zero-argument, fixed-target, pure diagnostic. It
does not launch or observe a genuine producer and cannot establish backend
lifetime or native finality.

## Test boundary

`pytest` is not applicable. Contract coverage belongs in the new
[native-finality metadata contract test](../../../../tests/contracts/phase-02-slice-12-native-finality-metadata.test.ts).

## References

- [Slice 12 root](../slices/phase-02-slice-12.md)
- [Sessions](../sessions/2026-10-21.md)
- [Blockers](../memory/blockers.md)
- [Audit proposal](./2026-10-21-native-finality-capability-audit-proposal.md)
- [Audit approval](./2026-10-22-native-finality-capability-audit-approval.md)
- [Command selection](../../../../docs/handoffs/2026-10-14-claude-s12/briefs/codex-dec203-finality-audit-command-selection.md)
