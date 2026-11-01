# Slice 11 — unwired claimed entry GREEN / mechanical extraction

Baseline: clean pushed 4d88a3a8ad938ec2118803864901f7e6cf796186.
Native A/B gpt-6-astra/high produced disjoint scoped files; root formatted,
read the new entry/imports/delegation and mechanically compared extracted
bodies against that exact baseline. Independent 6.1 reviews found no bounded
production gap. Static review is not executable or persisted proof.

## Actual parent gates

Every executable gate used fresh activeCI=0 and flock
/tmp/wejammin-supabase-ci.lock. Root attests lock/exit provenance; raw logs
independently retain CI/counts/results.

- Focused claimed boundary26 + stage8 + legacy-equivalence6:
  three suites40/40,2.49s,exit0.
  .lane-logs/parent-s11-claimed-entry-production-focused40-20261010.log
- Broader application jobs/async runtime/production compatibility/private
  parsers/pure seams/all migration worker suites/new entry:
  55 suites1462/1462,30.57s,exit0.
  .lane-logs/parent-s11-claimed-entry-production-broader-20261010.log
- Separate bounded chain contracts:check,db:types:check,progress:check,
  changed/new nine-file Prettier and ESLint,whole-project type-check,
  git diff --check: exit0.
  .lane-logs/parent-s11-claimed-entry-production-static-20261010.log
- All11 frozen pure producer/QA/private parser/new QA/support SHA256 values
  still exact. No QA edits or receiving/factory/SQL changes in producer wave.

## Mechanical equivalence

Root compared byte-identical admission union, original legacy admission
prefix through successful plan parsing, extracted ACK/release block after
removing only the new export keywords, resolved-admission body and admitted
execution body. Delegation carries runtime,{event,job},plan,signal,attempt
and original startedAt; reverse admission dependency is type-only.
These comparisons establish extraction identity, not correctness of inherited
legacy behavior or new live authority.

## Production manifest

Relative apps/worker/src/content-schema-registry/:

| File                                    | Formatted lines | SHA256                                                           |
| --------------------------------------- | --------------: | ---------------------------------------------------------------- |
| claimed-schema-migration-preparation.ts |              90 | 98391ff254bd3cb0b261f4cf81b445a481372b0047769421f7deb99d359c65e9 |
| migration-worker-admission.ts           |             211 | d19a895d35f0502f65cd9bfd2ea29c8d199b51db649baa5bea6df991d91517d7 |
| migration-worker-execution.ts           |             140 | 6fe0b823918095bd92b180308d17e47ceab8ef6f8420d2c04af03215eb08b410 |
| migration-worker-event-recovery.ts      |             142 | 9242a0e2073b41df62c94cbd1b9f2d83823403e54a456e4025647dd2a6a78a37 |
| migration-worker-resolved-admission.ts  |             185 | 2da238d20a75b5dba4acca4d7c1baf5f4fcc5da648862563e5bdb66ba472e689 |

New entry makes one acquired-receipt/original-event read, requires complete
caller binding, derives stage CAS from the resolved plan, retains actual
report/request separately and clamps dry_run after dependency spread.
Shared legacy admission/execution/recovery bodies are extracted without
new result codes, defaults, retry/ACK policy or plan-only coalescing.

## Limits / next gate

Controlled unit GREEN is not genuine public/PostgREST preparation, completed
replay, durable continuation, BE00 heartbeat, receiving ACK mapping or
enduring per-stage claim authority. Entry remains private and unwired.
Full Validation Cmd, DEC163 behavior, later slices and external acceptance
remain open; Slice11 still0/122. No DB reset/reload in this producer gate.
Next: checkpoint clean/exact origin before parent-controlled distinguishing
source mutations with exact restoration and GREEN controls, then private
genuine integration TDD. No action4/startup wiring authorization inferred.
