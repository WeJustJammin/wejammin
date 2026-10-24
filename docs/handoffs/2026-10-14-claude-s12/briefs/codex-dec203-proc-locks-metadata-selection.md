# DEC203 fixed proc-locks diagnostic metadata selection

Root private implementation-contract selection, 2026-10-21.
Native `gpt-6.1-sol` / `ultra`; delegated execution inherits that native model at
`high`. This is a reviewed binding change within DEC-203's approved isolated
adapter work, not a public API, product, host-policy or runtime acceptance change.

## Evidence and decision

The existing native `rb_lock_fdinfo` reads exactly `/proc/locks` through
`rb_process_read` and its held identity-checked, read-only CLOEXEC/NOFOLLOW file
slot. The current diagnostic target union does not name that mandatory input.
Coherent snapshots may therefore reject a legitimate short-lived native reader.

The bounded two-boundary reproduction window stopped on attempt 2, session 30694,
at the mapped final FD-target guard (`processes.mjs:293`). The subsequent
class-only probe stopped on its first attempt, session 64867, with the label
assigned only to exact `/proc/locks` in that predicate. Producer exit/close was
1/null, owner exit 0/null, and channels closed. No raw unknown path was logged.
The other JS UNAVAILABLE site is the initial Linux/Node-version admission, which
had already passed before the observed builds/inventories. Native transport
errors remain distinct failure paths; these diagnostics do not prove acceptance.
All temporary probes were restored to their exact baseline bytes.

Options considered:

1. Keep the current union: preserves refusal but cannot represent this mandatory
   native check reliably.
2. Ignore/defer unknown rows or stop required observation: loses the complete
   independently checked inventory premise; rejected.
3. Name exactly the already-required read-only kernel metadata object, with
   descriptor constraints and independent named identity binding: selected.

Independent root challenge: a path-only exemption would accept a fabricated or
writable row. Therefore the selection below requires both row constraints and an
independently observed named object. No general `/proc` pattern is selected.

## Exact additive binding

Add only literal `/proc/locks` to the private diagnostic target-name union.
Every such FD must remain in the complete sorted table, never filtered out.
Require full regular-file mode `0100444`, UID/GID 0, null pidfd, and canonical
fdinfo flags exactly `02400000` or `02500000`: read-only, CLOEXEC, NOFOLLOW, with
only the architecture's optional LARGEFILE bit. Existing canonical scalar/FD
bounds, process brackets and per-row identity rechecks remain unchanged.

Only owner/coordinator inventory phases may contain this metadata row. A
`lease-compiler-live` payload containing it is refused. This adds no lock owner,
protected alias, FLOCK row, descriptor transfer, process or read capability.

TEST independently lstat-checks the fixed named kernel object, preserving its
device/inode/mode/UID/GID across the invocation. Matching rows must bind those
actual named fields and the strict access/descriptor flags. Dynamic content,
size, position and timestamps are not artifact hashes or authority. Do not read
or hash additional file contents. The private anchor may add optional
`kernelMetadata`; absence continues to refuse every proc-locks payload row.
Legacy anchors without metadata remain valid for their existing closed targets.

All other proc targets, spelling variants, paths, unknowns, malformed rows and
non-read-only metadata descriptors retain hard refusal. Do not add a wildcard,
fallback, marked-incomplete retry, new error/frame or timing/holding mechanism.

## Consumers and cascade

- Production diagnostic-values: exact name predicate, strict metadata row and
  phase validation; pure only. Process snapshots use the same row predicate,
  plus a fixed named `/proc/locks` lstat and matching device/inode/mode/UID/GID
  whenever the complete snapshot includes such a row. No named lookup is added
  for snapshots without the selected metadata target.
- Independent TEST artifacts: fixed named metadata observation and readback;
  no artifact-content/hash or capability claim.
- Independent TEST observer: qualify only that exact bound row, retaining every
  other target and snapshot guard.
- Independent TEST values/assertions: optional closed metadata anchor, exact
  named identity and flag checks, compiler refusal.
- Runtime-binding's closed target paragraph, TEST-release's named-target oracle,
  and source-selection's complete-inventory binding gain only this exception.
  Their historical pin manifests remain immutable; this dated addendum is the
  explicit current override, not a silent edit to historical source evidence.
- Public Zod/REST/OpenAPI/BE/FE/IA contracts, SQL, source membership (32), native
  ABI, recipes, four locks, budgets and cancellation/drain authority are unchanged.
  Public API versioning and database migration are not applicable.

Before semantic changes, move the existing whole pure `anchored(before,after)`
tuple guard from processes into protocol, preserving its original leaf-resource
`ensure` binding and default identity refusal. Protocol adds only that pure leaf
import; processes imports the guard. Prove the two-file byte-exact inverse and
unchanged RED/baseline results before proceeding. This frees snapshot headroom
without a new production module or compressed/deleted guard. The resulting
resource → protocol → diagnostic-values → process dependency remains acyclic.

## Required execution order and holds

Write meaningful failing migration/regression tests against the original target,
snapshot, observer and payload boundaries before semantic edits. Cover exact
positive flags and independent fields, all retained refusals, missing/forged
metadata anchors, compiler rejection, row churn and no partial inventory.
Root reviews tests, executes RED, then grants exact source claims. Freeze tests;
implement minimally, validate, replay old semantics and a targeted guard-removal
negative control, restore exact GREEN, and validate again.

Root alone coordinates actual runtime. After fresh scoped gates and source
closure/pin review, PR01 runs alone first; PR02–PR04 follow separately, stopping
on the first failure. No preheld flock, global/privileged rescan, retries until
green, cleanup, service/stack/database mutation or renewed one-run approval.
Full factory/RUN_ACK, native080, `db:verify`, then `validate`, canonical receipts,
external gates, acceptance counters and Phase 2 completion remain HELD.
