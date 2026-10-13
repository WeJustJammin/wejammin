# Slice 11 private claim parser — 31 mutation receipts

Date: 2026-10-09 session (executed after UTC crossed 2026-10-10).

All 31 parent-run mutations exited 1 with `activeCI=0`, serialized through
`/tmp/wejammin-supabase-ci.lock`. Each source change was reverted before the next
mutation. Failure titles and assertion classes below come from actual logs,
not predicted counts. No author ran commands or changed tests during this series.

## Actual results

Log prefix: `.lane-logs/parent-s11-schema-mutant-`; suffix: `-20261009.log`.

| Mutation ID                         | Failed | Passed | Total | Failure class  |
| ----------------------------------- | -----: | -----: | ----: | -------------- |
| all8-output-freezes                 |     13 |    406 |   419 | AssertionError |
| freeze-request-claim                |      4 |    415 |   419 | AssertionError |
| freeze-request-outer                |      4 |    415 |   419 | AssertionError |
| freeze-response-job                 |      9 |    410 |   419 | AssertionError |
| freeze-response-report              |      9 |    410 |   419 | AssertionError |
| freeze-response-candidate           |      9 |    410 |   419 | AssertionError |
| freeze-response-plan-scope          |      9 |    410 |   419 | AssertionError |
| freeze-response-outer               |      9 |    410 |   419 | AssertionError |
| freeze-response-plan                |      9 |    410 |   419 | AssertionError |
| own-count                           |     20 |    399 |   419 | AssertionError |
| own-presence                        |     18 |    401 |   419 | AssertionError |
| event-narrowing                     |      4 |    415 |   419 | AssertionError |
| request-aggregate                   |      1 |    418 |   419 | AssertionError |
| shape-abort                         |     12 |    407 |   419 | TypeError      |
| event-version-admission             |      2 |    417 |   419 | SyntaxError    |
| v4-only-claim-token                 |      1 |    418 |   419 | AssertionError |
| relation-job-originatingEventId     |      1 |    242 |   243 | AssertionError |
| relation-requestedEvent-aggregateId |      1 |    242 |   243 | AssertionError |
| relation-report-jobId               |      1 |    242 |   243 | AssertionError |
| relation-report-planId              |      1 |    242 |   243 | AssertionError |
| relation-report-ownerId             |      1 |    242 |   243 | AssertionError |
| relation-candidate-ownerId          |      1 |    242 |   243 | AssertionError |
| relation-planScope-ownerId          |      1 |    242 |   243 | AssertionError |
| relation-report-contentTypeId       |      1 |    242 |   243 | AssertionError |
| relation-candidate-contentTypeId    |      1 |    242 |   243 | AssertionError |
| relation-report-targetVersionId     |      1 |    242 |   243 | AssertionError |
| relation-candidate-id               |      1 |    242 |   243 | AssertionError |
| relation-report-sourceVersionId     |      3 |    240 |   243 | AssertionError |
| relation-candidate-supersedesId     |      3 |    240 |   243 | AssertionError |
| relation-candidate-dryRunId         |      1 |    242 |   243 | AssertionError |
| relation-planScope-dryRunId         |      1 |    242 |   243 | AssertionError |

All eight individual private freeze removals fail existing successful-output
loops at `Object.isFrozen`, independently of descriptor snapshots. Combined
removal now fails 13 positives (four request, nine response); before the two
assertions it incorrectly passed all 419. Existing Queue freezing is unchanged.

Every response relation removal fails its exact `independently rejects equality`
case with the other fourteen intact. `candidate.id` uses the paired target
fixture; `candidate.supersedesId` uses the paired source fixture. The two source
relations additionally fail their successor/first-null null-safe cases, hence
three failures each rather than one. No relation proof relies on a malformed
UUID or another failed relation.

Own-count removal admits 20 hidden own extras; own-presence removal admits 18
count-preserving inherited replacements. The two plan own-presence controls
remain masked by the unchanged legacy plan parser; do not count them as isolated
private hasOwn proof. Disabling shape abort produces 12 actual TypeErrors, not
16: the separate event-version admission still rejects malformed event objects.
Removing version admission produces two actual BigInt SyntaxErrors. A v4-only
claim-token mutation rejects the valid UUIDv7 positive. Event narrowing and
request aggregate removal fail their otherwise-valid dedicated controls.

## Exact restoration

Three restored source SHA-256 values (under `apps/worker/src/content-schema-registry/`):

- `schema-dry-run-claim-request.ts`: `cb8dd1975fe8fc164118d20ea5e9157b38c449022ee902822c3bebfccc4442c8`
- `schema-dry-run-claim-response.ts`: `4defc891b52d68de240cce642cd7bf0750ebc75f418a48717a1eeb2589fa18cd`
- `schema-dry-run-claim-shape.ts`: `b9fc420395b69fa18e3552a4f869967174d11281df6ef3079a6afe299475a14e`

Restored 34 suites / 910 tests passed; format, ESLint, type, contracts and progress
checks exited 0 with fresh `activeCI=0` and the same lock. Receipt:
`.lane-logs/parent-s11-schema-mutations31-restored-regression910-static-20261009.log`.
Independent 6.1 saved-receipt/static audit found no bounded evidence mismatch;
reviewer executed no tests or SQL and finished reads before the next author wave.

This is private parser behavior proof only. It does not establish genuine
RPC resolution, external claim-context binding, persisted provenance, live job
lease authority, per-stage SQL fences, receiving continuation or Slice acceptance.
Full validation, genuine seven-case API RED, owner partials and external gates
remain open; Slice 11 remains 0/122.
