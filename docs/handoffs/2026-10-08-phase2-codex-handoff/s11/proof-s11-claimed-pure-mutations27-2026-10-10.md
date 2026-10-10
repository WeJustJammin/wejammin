# Slice 11 —27 pure source mutations caught; final restored controls GREEN

Baseline: clean pushed2b4aa99b22bd0553f43a92e83084934e73266b90.
Actual baseline focused209/209 and regression1325/1325; enclosing regression/
static command timed out during types, then separate static chain exited0.

Root changed one of the two new pure source modules at a time through native
patches. All27 targets were unique in actual baseline source. No QA/private
parser/helper/SQL/factory/receiving source changed. Every mutant and restored
control used fresh activeCI=0/shared flock and executed both suites/all209 cases.
All27 mutants exit1 with actual assertion failures, never import/setup failures.
One D7 failed case raises an executed TypeError on a missing claimedJob,
alongside assertion failures; this is not an import/setup error.
Before each control, both production SHA and all frozen test/private-parser SHA
were checked exactly. All27 controls exit0/209 passed. No source mutant remains.

Independent read-only audit matched all27 table rows to the54 exact logs and
the final1325 receipt, and independently matched both current production SHA.
The stdout logs establish CI0/test counts and failures; flock, command exit codes
and historical QA/parser SHA checks are root-orchestration attestations, not
values embedded in those stdout logs. Do not promote them to independently
log-verifiable historical proof. The final static chain is separately confirmed
by root exit0, after the reviewer snapshot.

| Mutant | Isolated change                                             | Failed | Passed |
| ------ | ----------------------------------------------------------- | -----: | -----: |
| I1     | Receipt version replaced by expected preclaim               |     31 |    178 |
| I2     | Synthetic preclaim+1 receipt version                        |     31 |    178 |
| I3     | Canonical job ID comparison removed                         |      1 |    208 |
| I4     | Outer-token comparison removed                              |      1 |    208 |
| I5     | Expected preclaim comparison removed                        |      2 |    207 |
| I6     | Valid19 preclaim narrowed to18                              |      1 |    208 |
| I7     | Valid19 original version narrowed to18                      |      1 |    208 |
| I8     | Original envelope projected to eight fields                 |      5 |    204 |
| I9     | Queued-only state restriction                               |      1 |    208 |
| I10    | Inherited input eventId mutated                             |      2 |    207 |
| I11    | Input prototype replaced with equal-looking clone           |      3 |    206 |
| I12    | Current-clock receipt expiry invented                       |     12 |    197 |
| D1     | Acquired job version comparison removed                     |      1 |    208 |
| D2     | Original aggregateVersion comparison removed                |      1 |    208 |
| D3     | Original correlationId comparison removed                   |      1 |    208 |
| D4     | Original causationId comparison removed                     |      2 |    207 |
| D5     | EventId + originatingEventId comparisons removed (compound) |      1 |    208 |
| D6     | Job ID + event aggregateId comparisons removed (compound)   |      1 |    208 |
| D7     | Static request type trusted without parsing                 |     15 |    194 |
| D8     | Complete response replaced by plan only                     |      8 |    201 |
| D9     | Caller-owned response returned instead of parsed output     |      8 |    201 |
| D10    | Valid19 plan version narrowed to18                          |      1 |    208 |
| D11    | Valid19 original version narrowed to18                      |      1 |    208 |
| D12    | UUIDv4-only claim token restriction                         |      1 |    208 |
| D13    | Nested response job prevented from extending                |     99 |    110 |
| D14    | Response object prototypes replaced by equal-looking clones |      8 |    201 |
| D15    | Inherited response job.id mutated                           |      1 |    208 |

Every row totals209. Raw logs follow
`.lane-logs/parent-s11-claim-pure-{i1..i12,d1..d15}[-control]-20261010.log`;
the IDs denote individual files, not shell brace expansion used by a receipt.
Control durations/counts and mutant failure titles remain in those actual logs.

D5 removes both original event-ID comparisons, which are redundant through
internal parser relations. D6 removes both external job/aggregate-ID checks.
Their proof belongs to each compound group, never either guard individually.
The three fixed event literals remain enforced by the private parsers; no
independent external-literal comparison proof is claimed.

I10/I11 and D13-D15 distinguish the strengthened inherited-value, exact
prototype identity and nested extensibility oracles. Their mutations operate
only on controlled caller fixtures; they prove nonmutation assertions, not
persisted SQL/owner authority or genuine worker integration.

Exact baseline production SHA:

- Builder46 lines: `b6d1640379c2de589dfa58b5957cbae61fccc00384281c80da2c4c17c7bbd628`.
- Decoder38 lines: `640b3208d996327a466c0a7dbb72af1a30a4d511a7f1c57509d557004852c601`.

Final restored gates, each fresh activeCI=0/shared flock:37 suites1325/1325,
21.49s, actual exit0; separately contracts/DB-type/progress/format/ESLint/type/
diff chain actual exit0. Both production and every frozen QA/private-parser SHA
match after all gates. Logs:
`.lane-logs/parent-s11-claim-pure-mutations27-restored1325-20261010.log` and
`parent-s11-claim-pure-mutations27-restored-static-20261010.log`.

No DB reset/reload or broader authority/acceptance closure. Claimed worker entry, plan/report/lease handoff,
Signal/attempt, genuine nonzero/completed/lifecycle, receiving ACK/heartbeat/
stage fences, DEC163, full Validation Cmd and external gates remain unproven.
Slice11 stays0/122.
