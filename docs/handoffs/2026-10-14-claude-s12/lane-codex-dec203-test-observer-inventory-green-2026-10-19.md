# DEC203 independent TEST FD inventory ordering — 2026-10-19

Scope: private per-run native tracing adapter. This record is unit/static evidence,
not PR01, native, kernel/FLOCK, database, hosted or Phase 2 acceptance.

## Change and static review

The independent TEST sampler now applies its unchanged closed-target policy to
every row only after its existing complete-table and process-facts coherence
checks. Immediate target bounds remain before metadata capture. Stable coherent
unknown targets still fail closed; no filtering, whitelist expansion, retry class,
budget, signal permission, public API or service change was introduced.

Sampler: tests/native/helpers/dec203-bootstrap-pre-ready-observe.mjs
284 LF; SHA256 39af64e40b79a2e8adf6178ba89eda8007236b254355d41dfe26c382f2e6ec53.
Exact inverse restores the previous 281-LF 44adc6f6 source. Independent static review
confirmed the original 16-LF predicate is byte-identical. Root syntax and scoped
lint passed. This does not fix or claim to fix same-number FD reuse or ABA.

New real-consumer unit files, normal form and independently reviewed:

- tests/contracts/phase-02-slice-11-dec203-test-observer-inventory.test.ts:
  287 LF; 0bd0091ff76592f2d2334d760140dbbc23ea2d939738003aa1e43b2888c22a5d.
- tests/contracts/helpers/dec203-test-observer-fixture.ts:
  159 LF; 78a2a14ae36b7012b7f9f6281267420cdda8805a4b2bb2614665f5f869962583.
- tests/contracts/helpers/dec203-test-observer-proc.ts:
  295 LF; 143954cc16edd4f90c14926e49641d0b8398db1082ac259d7bb7325c5260cee9.

## Actual root observations

Pinned Node 22.23.1 and pnpm 11.24.0. Narrow mocked proc schedules drive the real
observer/functions. Readonly pinned Node/GCC profiles and one exclusively owned
temporary fixture are real; no compiler, child process or actual FLOCK is used.

- Baseline RED: 7 PASS / 5 FAIL at 20:07:17Z. The five expected churn cases failed.
- First GREEN: 12/12 at 20:12:22Z.
- Delete final semantic policy: 11 PASS / 1 FAIL at 20:16:03Z; OT02 detects a
  coherent unknown target being accepted.
- Delete immediate bounds: 8 PASS / 4 FAIL at 20:16:24Z; all four OT07 controls
  detect bounds being deferred past churn.
- Both mutations were restored to exact sampler SHA 39af64e4 before continuing.
- Final clean unit run: 12/12 at 20:16:49Z.
- Integrated lease133 + producer FD34 + TEST observer12: 179/179 at 20:17:18Z.
- Every unit run reported owned fixture inventory [] before and after.

The final unit and mutation runs protected 192 pins. Exactly two unimported files
were excluded while another author added pending-exec RED controls: the native
pre-ready driver and pending-exec-controls.mjs. Do not describe these runs as an
all-194-current-source freeze. Historical seven manifests remain immutable.

Before the mirror correction, the mechanical TEST10-to-12 extraction was reversed
exactly and its 42 existing EX/INV/STAT controls passed with scoped ESLint at
20:05:29Z. That historical 194-pin observation is not a later semantic proof.

## Remaining gate

The inventory suite's setup directly invokes compiler process/session absence
helpers; it does not prove the observer itself invokes those helpers in the right
order. Real-caller absence-order controls and the reviewed bounded pending-exec
implementation remain open. No further diagnostic or signal authority is inferred.
PR01 and Phase 2 remain OPEN; no tracking checkbox is cleared.

Receipts directory: /tmp/wejammin-native-s12-20261017.Adf0uP

- dec203-test-observer-unit-red.json
- dec203-test-observer-mirror-static-inverse.json
- dec203-test-observer-unit-green.json
- dec203-test-observer-final-policy-deletion-red.json
- dec203-test-observer-immediate-bounds-deletion-red.json
- dec203-test-observer-mutations-exact-restoration.json
- dec203-test-observer-unit-final-green.json
- dec203-test-observer-integrated-pure179-green.json
