# Slice 11 — claimed input/binding initial import RED

Baseline: clean pushed `24a5a85a01cc19fdfeb289be16a424080a36038b`.
Native authors created only the two new unit-test files, then froze/released
their claims. No production module, existing helper, private contract, SQL,
factory, queue or receiving code changed.

Parent read both complete authored files. Prettier produced input344/binding325
lines, both below the400-line cap. Planned expanded cases100/106 are static
counts, not executed-test counts.

Actual focused run, fresh activeCI=0 under the shared CI flock:

- Exit1; two failed suites; no tests executed;1.36s.
- Both failures are ERR_MODULE_NOT_FOUND for the deliberately absent
  `schema-dry-run-claim-input` / `schema-dry-run-claim-binding` modules.
- Log: `.lane-logs/parent-s11-claim-input-binding-red-20261010.log`.

This is import/setup RED, not a failing functional assertion or runtime/SQL
authority proof. No stub was added to manufacture behavioral RED.

Independent input review found two QA gaps: valid19-digit coverage must also
exercise preclaim/expectedVersion and original event version, not only acquired
version; prototype nonmutation must use identity plus independently captured
inherited scalar values rather than a reference-backed structural snapshot.
Binding review also found three QA gaps: prototype identity/inherited scalar
and nested extensibility preservation; valid19 plan/original versions; and a
UUIDv7-token success control. Both reviews are complete. Parent agrees with
the concrete static mutant-survival analysis, not a runtime mutation claim.
Amendments remain behind a new clean pushed checkpoint. Existing shared helpers
stay frozen.

No acceptance criterion closed: Slice11 remains0/122. Production pure modules,
functional GREEN, distinguishing mutations/exact restore, claimed worker entry,
genuine lifecycle/nonzero/completed/receiving fences, DEC163 and full validation
remain unproven. Latest restored API76/unit1116/pgTAP121 receipts belong to the
prior checkpoint, not this new test tree.
