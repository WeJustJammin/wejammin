# Slice 11 — claimed entry14 mutants caught / restored1462 GREEN

Baseline clean exact origin: f0e1f010e9b64a1a5391595fef29788270ce42c3.
Parent controlled temporary source mutations only; frozen QA unchanged.
Every mutant/control ran fresh activeCI=0 with shared
flock /tmp/wejammin-supabase-ci.lock. All40 focused cases actually executed.
Every mutant exit1 included executed AssertionError failures, not import-only
RED. Every restored control exit0 passed40/40.

| ID  | Isolated regression                                          | Mutant failed/passed/total | Restored control |
| --- | ------------------------------------------------------------ | -------------------------- | ---------------- |
| E1  | trusted dry_run clamp changed to activation                  | 8/32/40                    | 40/40            |
| E2  | stage CAS taken from acquired BE00 version                   | 11/29/40                   | 40/40            |
| E3  | resolver wire uses preclaim instead of acquired version      | 29/11/40                   | 40/40            |
| E4  | retained report ID replaced by plan ID                       | 12/28/40                   | 40/40            |
| E5  | retained request identity replaced by unfrozen clone         | 4/36/40                    | 40/40            |
| E6  | normalized resolution retryable flag inverted                | 6/34/40                    | 40/40            |
| E7  | extra legacy three-key reread inserted before stages         | 12/28/40                   | 40/40            |
| E8  | normalized resolution code replaced with generic unavailable | 5/35/40                    | 40/40            |
| L1  | foreign plan ID operand disabled                             | 2/38/40                    | 40/40            |
| L2  | foreign completed plan bypasses identity precedence          | 1/39/40                    | 40/40            |
| L3  | completed replay version exception removed                   | 2/38/40                    | 40/40            |
| L4  | terminal ACK success/failure outcomes inverted               | 4/36/40                    | 40/40            |
| L5  | successful blocked release does not unmark acquired event    | 1/39/40                    | 40/40            |
| L6  | durable DLQ rejection swallowed                              | 1/39/40                    | 40/40            |

E1–E8 mutate claimed-schema-migration-preparation.ts.
L1–L3 mutate migration-worker-resolved-admission.ts.
L4–L6 mutate migration-worker-event-recovery.ts.
Each mutation is independent, with exact baseline restoration before control
and before the next mutation. Root SHA guard covers all five production files
plus eleven frozen pure producers/QA/private parsers/new QA/support (16 total).
No active mutation remains; final source/QA/parser hashes exactly match
the preceding GREEN manifest. No DB reset or SQL reload performed.

Raw pairs:
.lane-logs/parent-s11-claimed-entry-{e1..e8,l1..l6}[-control]-20261010.log

Final fresh CI0/flock restored regression:
55 suites1462/1462,31.17s,exit0.
.lane-logs/parent-s11-claimed-entry-mutations14-restored1462-20261010.log

Separate bounded contracts/db types/progress/nine-file format+ESLint/
whole-project type-check/git diff check: exit0. Final16 SHA exact; dirty0
at source checkpoint f0e1f010 before this evidence/tracking update.
.lane-logs/parent-s11-claimed-entry-mutations14-restored-static-20261010.log

## Evidence boundaries

Raw stdout independently records activeCI/counts/functional assertion failures.
Historical process exit/flock acquisition/source restoration provenance is
root orchestration attestation, not an independently reconstructable log claim.
L4 proves ACK outcome policy, not independent token/identity fences.
L6 proves rejection causality; unchanged six-case QA separately exercises
fresh in-flight work after rejection, but engine eviction was not mutated.
These are scoped distinguishing mutations, not exhaustive mutation coverage.

Independent 6.1 evidence review read all28 logs: counts match, every mutant
has executed AssertionError failures, every control40GREEN and final1462GREEN.
Qualified no finding in receipt claims; historical mutation/lock/exit/SHA
provenance remains root-attested. E1 includes normalized dependency-invalid
response diffs; no blanket exception-free failing-path claim is made.
Controlled units do not prove persisted
report/provenance, actual public nonzero/completed lifecycle, live enduring
claim authority, durable continuation/BE00 heartbeat, production receiving/
ACK mapping or deployed dispatch. Full Validation Cmd/DEC163/later slices/
external gates remain open;0/122. Next private genuine PostgREST integration
requires a fresh clean pushed checkpoint and scoped native QA before execution.
