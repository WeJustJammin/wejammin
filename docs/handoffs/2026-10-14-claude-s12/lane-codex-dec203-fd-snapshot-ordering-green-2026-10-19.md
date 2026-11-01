# DEC203 producer FD-snapshot ordering — unit GREEN, native OPEN

Date: 2026-10-19. Checkout: Slice12 only. No commit/push/default-stack change.

## Evidence and limits

One approved sanitized diagnostic was consumed and both temporary sources restored
exactly. Its 58-byte source/line tag identified the allowlist guard, not the process
role, target path, or transience. No second diagnostic is authorized.

Source review established early semantic rejection before existing coherence checks.
Independent contract/security review accepted correction under runtime binding133–140.
This is not proof of the diagnostic's specific cause, atomic FD-table acquisition,
or defeat of later same-number/ABA reuse.

## Minimal production delta

Only receiving-bootstrap-processes.mjs changed: immediate encoding/512-byte bounds
remain hard; unchanged semantic policy now checks every private candidate after
the existing per-row and final process/name-set checks, before any return.
No filtering, target logging, arbitrary file-content read, whitelist expansion,
new retry class, deadline, API, source module, service or signal permission.

Current source: 299 LF / 8982 B,
SHA256 c066829a9f9c16b399039fd7b97563b8548f86f84f09476d6d9ab40bbc595da1.
Exact two-line inverse restores prior298LF hash80e940f144b051e3b7e785cca7f6b538d3cc034b184589e8deb64dba39890cf0.

## TDD and adversarial controls

New permanent test249LF, fixture helper133LF; narrow filesystem/kernelText mocks
exercise the real fdSnapshot/facts/ensure/failure/stamp/target policy.
These are deterministic mock schedules, not genuine kernel/native race proof.

Actual baseline RED: 34 total, 31 passed, 3 failed exactly (FS03 target/stat
replacement; FS04 final-table disappearance). Each failed on wrong hard error.
Reviewed production GREEN: 34/34 passed.
Removing final allowlist admission: 30 passed, 4 rejection cases failed.
Restored exactly; removing immediate bounds: 30 passed, 4 FS12 cases failed.
Both mutants restored exactly, with all188 protected pins reverified.

Final integrated pure run: 42 EX/INV/STAT + 167 Vitest (133 lease + 34 FD) passed.
Production32 caps/canonical formatting/closed import DAG: passed.
17 JavaScript syntax checks, ESLint, two strict C syntax-only checks: passed.
New unit pair ESLint stdin: passed. Actual delta and tests independently reviewed.

## Current boundary

Independent TEST sampler has the same early semantic policy ordering. Its minimal
mirror is statically reviewed, but no TEST correction is yet released. Genuine
observer-path regressions are being planned, separate from pending-exec redesign.
The latter requires bounded compiler→owner state, real predecessor absence,
exact owner path, and different detached-compiler versus non-detached-owner
group/session rules. No recipe, boolean authority or widened Node skip.

PR01, native later gates, canonical DB/validate, hosted evidence and Phase2 acceptance
remain OPEN. Default database reset path remains held; targeted pure/static checks
do not clear that boundary. Historical pinned manifests remain unchanged.

Receipts: /tmp/wejammin-native-s12-20261017.Adf0uP/dec203-fd-ordering-*.json.
Current overlay: dec203-current-source-overrides-after-fd-ordering.json.
