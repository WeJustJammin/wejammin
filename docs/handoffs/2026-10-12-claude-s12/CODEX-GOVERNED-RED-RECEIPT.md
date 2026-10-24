# Governed submit — completed focused RED, 2026-10-13

Root independently verified the terminal Run 6 receipt:
`.lane-logs/alt-tap-123651-2691685.tap`, SHA-256
`f715b3c6c5d0ad8caa1936824454a19fc161d1369746714540c6075f069dcecf`.
Complete TAP plan `1..33`: 17 passed, 16 failed; runner exit 1.
The executing shell used Node 22.23.1 and pnpm 11.24.0 through the serialized ALT runner.

All mandatory fixture controls passed: real protected type creation, protected
policy projection, both draft subjects, immutable subject-hash shape, exact
two-compatible-type row, and restoration of the prior internal RPC flag before
the public commands. The test-only projection wrappers scope the flag to their
private reads and restore it on success/exception. The original missing-context
diagnosis is now supported by a successful repaired runtime check, not just a
source hypothesis. A preceding one-character parse error was separately traced
and corrected; its incomplete Run 5 receipt is retained and is not accepted RED.

The intended failures identify the missing public/private
`cms_submit_governed_review(jsonb)` command and consequences of its absent success
body/state/audit. Passing no-effect snapshots are vacuous while the command is
absent; they omit idempotency records and use audit/outbox counts, so they are not
full-store atomicity acceptance proof.

This is a focused RED subset, not all 285 criteria, complete Slice 12 RED coverage,
GREEN, a depth-ratio pass, production acceptance, or Phase 2 completion. The owner
approvals in DEC-188/189 are separate from this receipt. All old logs are preserved.
