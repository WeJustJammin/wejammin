# Slice 11 — pure claimed source first run; input oracle RED

Baseline exact clean pushedf97d644a89d712324be201b91dbea3e26b5f082c before
native disjoint author wave. Both authors froze/released claims. Parent fully
read modules: builder46/decoder38 formatted lines; README updated. Two
independent source reviews found no bounded defect; source verdict is not runtime
or SQL authority proof. Existing contracts/helpers/test files unchanged.

Actual parent gates, each fresh activeCI=0/shared flock:

- Input first run exit1:101 failed/101,1.94s. All failures are the same
  `unchanged` snapshot assertion at test:78, after output/refusal assertions.
- Decoder first run exit0:108/108,1.53s.
- Combined37 suites:1 failed/36 passed;101 failed/1224 passed/1325,22.19s.
  Existing1116 and decoder108 pass. First/only failure location is input:78.
- Contracts, DB-type/progress/format/ESLint/type/diff checks all exit0.
  This is a bounded static gate, not the full project validation command.

Logs: `.lane-logs/parent-s11-claim-input101-green-20261010.log` (historical
filename, actual RED), `parent-s11-claim-binding108-first-20261010.log`,
`parent-s11-claim-pure1325-oracle-red-20261010.log`,
`parent-s11-claim-pure-oracle-red-static-20261010.log`.

Root diagnosis: copied inherited descriptor maps include an own
`constructor` key. Vitest4.1.11 strict `typeEquality` compares
`a.constructor === b.constructor`; fresh descriptor records differ by
identity despite identical descriptor values. Actual failure reports no visual
difference. Pure descriptor control confirms own constructor=true, fresh map
constructors unequal, constructor descriptor values equal; pair-array
constructors equal. No production change is warranted by this failure.

Next checkpoint precedes a native amendment limited to the input test's local
snapshot representation: ordered own-key/descriptor pairs, retaining all
descriptor attributes/scalar values, prototype/input identity and frozen/
extensibility assertions. Do not remove `constructor` or weaken nonmutation
checks. Production modules, decoder test, shared helpers and contracts stay
frozen. Rerun actual209 then1325/static, and only after GREEN execute planned
distinguishing mutants with exact restoration.

No SQL reload/reset, lease-authority, genuine preparation, receiving/heartbeat/
stage fence or acceptance closure. Slice11 remains0/122.
