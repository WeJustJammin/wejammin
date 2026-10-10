# Slice 11 implementation lane "worker" report (2026-10-10)

Worktree `/home/rob/.codex/worktrees/phase2-slice11/WeJammin`, branch `claude/phase2-slice11`, HEAD `9b9b588e` at start (the orchestrator moved it to `352c397a` while I worked; I committed nothing,
staged, stashed or reset). No production file was edited: items 2-6 close test-evidence gaps over behaviour that already exists, and
item 1 is stopped on a spec conflict (below). Every new test was mutation-checked (a deliberately broken variant fails it) in place of
a RED-then-fix cycle, because there is no production change to drive.

## Files added (all new, none pre-existing, none outside the assignment except where noted)

| File | Lines | Items |
|---|---|---|
| `apps/worker/src/cms-editorial/workflow-telemetry-redaction.test.ts` | 189 | 2 |
| `apps/worker/src/cms-editorial/workflow-telemetry-redaction.test-support.ts` | 210 | 2 |
| `apps/worker/src/cms-editorial/workflow-telemetry-redaction-cases.test-support.ts` | 232 | 2 |
| `apps/worker/src/cms-editorial/workflow-read-etag.test.ts` | 176 | 3 |
| `apps/worker/src/cms-publication-schedule-sweep-deadline.test.ts` | 227 | 4 |
| `tests/contracts/phase-02-slice-11-preview-verifier-seam.test.ts` | 324 | 5 |
| `tests/contracts/phase-02-slice-11-feature-ledger.test.ts` | 205 | 6 |
| `docs/handoffs/2026-10-10-claude-s11/lane-worker-green.log` | log | all |

Ownership note: the brief lists `apps/worker/src/cms-editorial/*sweep*`, but the sweep lives at
`apps/worker/src/cms-publication-schedule-sweep.ts` (outside `cms-editorial/`). I added a NEW sibling test file there rather than
editing `cms-publication-schedule-sweep.test.ts`, so no other lane's edits to the existing sweep test can collide. Move or rename if you
want it under another path. The redaction suite is split across three files to stay under the 400-line test-file limit.

## Item 1 (AC-050, AC-053, AC-056): STOPPED, locked global rule conflicts. No test written, no code touched.

The task said to stop and report both citations if a locked global rule conflicts. One does.

**Says 422** (BE03b, `.memory/wiki/specs/be/03b-editorial-workflow-publication.md`):
- line 290, CMS-03B-15 `response bounds`: preparation non-null only for a submittable draft, at most 17 preflight results, 16 schedules,
  64 publications, `dependencyManifest`/`versionSet` satisfy the Slice 10 contracts -> "422 response-contract failure".
- line 292, CMS-03B-16 `decisions / assignments`: at most 8 decisions, 32 assignments, exposed members -> "422 response-contract failure".
- line 285, CMS-03B-12 `paths / preimages`; line 300, `All browser responses` envelope -> "422 response-contract failure".
- Contract and error matrix lines 1907-1909: the 422 column of CMS-03B-15/16 is `response bounds`.
- `.memory/wiki/specs/phases/phase-2.md` lines 2999, 3002, 3005 (AC-050, AC-053, AC-056) repeat it; AC-053 also lists
  "read dependency or deadline (502/503/504)" as a separate, different cause.

**Says 502** (global BE00, `.memory/wiki/specs/be/00-infrastructure.md`):
- line 590: "`DEPENDENCY_UNAVAILABLE` uses 502 when a contacted dependency returns an invalid response".
- line 585 (Boundary Mapping, Provider adapter): "502 invalid upstream response"; line 172 (error table): `DEPENDENCY_UNAVAILABLE` 502/503/504.
- Echoed by BE03b line 2078 ("Invalid upstream response maps 502"), BE03a line 2577/2718 ("502 invalid upstream data is not retried until
  the adapter or registry version changes"), BE03b line 1915 (502/503/504 details). BE00 line 577 puts 422 only on Hono request
  parse/semantic validation. `.memory/wiki/decisions.md` has no entry on either side (grep: no "response-contract", "BAD_GATEWAY", "502").

**Shipped behaviour**: every Slice 10 and Slice 11 route answers a schema-breaking port payload as 502 `BAD_GATEWAY`
(`workflow-read.ts` line 236; `workflow-command.ts` `if (accepted === null) return fail(BAD_GATEWAY)`; also `conflict-detail-routes.ts`,
`detail-routes.ts`, `list-routes.ts`, `authoring-context-routes.ts`, `create-routes.ts`, `history-routes.ts`, `restore-routes.ts`,
`conflict-routes.ts`). The runbook `docs/runbooks/platform/cms-editorial.md` line 178 documents 502 as "the database answer failed the
strict response contract". The registry (`routes-errors.ts:192-204`) declares both `VALIDATION_FAILED: 422` and `BAD_GATEWAY: 502`.
Existing tests pin 502 (e.g. `workflow-read-operations.test.ts` "refuses a workflow of another entry or another revision").

Options for the owner (one decision; I recommend B):

| Option | What changes | Pros | Cons |
|---|---|---|---|
| A. Honour BE03b/AC wording: 422 | `registerWorkflowRead`/`registerWorkflowCommand` map a contract breach to 422 `VALIDATION_FAILED` with a fixed-pointer safe body; Slice 10 rows with the same wording (CMS-03B-12) and the runbook follow; one RED Worker test per breach | Matches the three locked criteria verbatim | Contradicts BE00:590/585 and BE03a:2718; tells a client its input was wrong when the server's own payload broke; `metricOutcome` would log it as `invalid` not `failed`, hiding it from the BAD_GATEWAY burst alert (runbook line 381); inconsistent with ~10 shipped routes unless all are changed |
| B. Keep 502, amend the wording | Amend BE03b 285/290/292/300 + matrix and AC-050/053/056 through the DEC-155 wording batch; replace the `{ x: 1 }` payload test with one test per breach asserting 502 | Matches BE00 and every shipped route; non-retryable 502 is the right class for a server-side contract fault | Needs an owner ruling to change locked criteria text |
| C. Both: 422 for the enumerated bounds, 502 for any other breach | Per-breach mapping in the read/command pipelines | Satisfies the literal criteria and BE00 for the rest | Two statuses for one failure class; most code, and still contradicts BE00:590 for the enumerated cases |

Once ruled, the test set is fixed by the criteria: a port success payload with (a) a preparation on a non-draft revision, (b) 18
preflight results, (c) 17 schedules, (d) 65 publications, (e) a broken `dependencyManifest`, (f) a broken `versionSet`; and for
CMS-03B-16 (g) `invalidatedReason` without `invalidated`, (h) `decidedAt` without a decided state, (i) recorded > required, (j) a
protected review with fewer than 2 decisions, (k) 9 decisions, (l) 33 assignments, (m) an extra decision member. Each asserts the
ruled status and a body with no payload text. I can write them within minutes of the ruling.

## Item 2 (AC-016, AC-022, AC-034): redaction of CMS-03B-06, -07, -09 telemetry

Suite `'CMS-03B-06'|'CMS-03B-07'|'CMS-03B-09' telemetry redaction` (3 operations x 11-12 scenarios), plus
`the redaction check`, `CMS-03B-06 decision labels`, `CMS-03B-07 and CMS-03B-09 preflight labels`. 49 tests, all green.

What each scenario asserts against the one event the real route emits: every event member is in the closed
`CmsEditorialTelemetryEvent` set; every metric key is a plain counter or a declared family with closed label values (outcome, decision,
the 17 preflight categories, phase, operation); `errorCode` equals the code the client saw; and the serialized event contains none of
the session user id, acting party id, idempotency key, entry/revision/review/assignment/schedule/publication ids, decision reason text,
schedule instants and timezone, tzdb version, audience, any hash (frozen, dependency, version-set), a PII email sent in the request,
or upstream refusal text. Scenarios per operation: success, admission refusals (stale MFA, unauthenticated, 429, unknown member
carrying PII) and the port refusals the operation can publish (separation_of_duties, dependency_changed with a hash, duplicate_decision,
stale CAS version, preflight_failed, publication_conflict, version_set_stale, authority_ends_before_schedule, 503, 500). Also:
`entityIdHash` is `sha256:` of the entry id and the only identity of an accepted command, absent on a refusal.

Mutation evidence (temporary files, deleted; 14 and 37 tests failed):
- `workflowMetrics` leaking the review id into a label: `AssertionError: expected [ ...(2) ] to deeply equal []` in every CMS-03B-06
  scenario (finding `metric cms_review_decision_total{...review="123e4567-..."}` and `leaks the review id`).
- an emitted event with an extra member: `expected [ 'event member detail' ] to deeply equal []` in 37 of 49 tests.
- `the redaction check` also feeds the checker synthetic leaky events (extra member, free-form label, foreign error code, leaked id,
  reason, upstream text) and requires each finding, so the checker itself cannot silently pass.

## Item 3 (AC-052): composite ETag

`apps/worker/src/cms-editorial/workflow-read-etag.test.ts`, suite `CMS-03B-15 composite ETag`, 7 tests, green. The ETag moves for a
schedule version change, a schedule state change, a schedule appearing or disappearing, a publication version change, a publication
`projectionState` change and a revoked tombstone row; it keeps the entry/revision/review prefix readable (only the digest carries the
schedule change); it does NOT move for the same representation under another request id and Accept header, nor for the same members in a
different key order (resource and nested schedule); it is caller-scoped. Written against current behaviour: the digest is over the whole
parsed body, so this pins the by-construction guarantee (`workflow-read-routes.ts:89-95`). No mutation run (no production hook to mutate).

## Item 4 (AC-082): 15,000 ms sweep deadline

`apps/worker/src/cms-publication-schedule-sweep-deadline.test.ts`, suite `the 15,000 ms job deadline`, 4 tests, green, fake timers
(`setTimeout`/`clearTimeout` only). A claim that never answers: abort signal still clear at 14,999 ms and sweep unsettled, aborted at
15,000 ms, sweep rejects "CMS publication schedule sweep requested retry", log `DEPENDENCY_UNAVAILABLE` retryable, secret not logged. An
execute that never answers: same boundary, then the tick finishes (`execute_failed` retryable, `completed` logged, no schedule or lease id
logged). Claim answering at 14,999 ms then execute answering at 14,999 ms of its own window: no abort (each call gets its own 15,000 ms).
Drift guard: `ASYNC_RPC_DEADLINE_MS === CMS_SCHEDULE_DEADLINE_MS === 15000` and the transport refuses a deadline of 15,001.
Mutation: forcing the sweep's RPC client to a 5,000 ms deadline via `vi.mock('./async-runtime')` fails three tests
(`expected true to be false` on `signal.aborted` at 14,999 ms; one 15 s test timeout). The sweep needed no change: it relies on the
transport default, which now has a behavioural test.

## Item 5 (AC-073): preview verifier equals the BE04c seam

`tests/contracts/phase-02-slice-11-preview-verifier-seam.test.ts`, 9 tests, green. It parses the `Shard 03 preview-token verifier` row of
`.memory/wiki/specs/be/04c-public-delivery-cache.md` (line 88) and drives the contract from it: the six request members
(`tokenHash`, `actorPersonId`, `actingContextVersion`, `route`, `locale`, `audience`) each required, strict, typed as the row says
(lowercase SHA-256 hex, uuid, 64 lowercase hex, the `^[a-z0-9_-]{1,48}$` audience grammar checked on boundaries against the regex taken
from the row, route <= 4,096); both result branches with their member lists (valid: `userId`/`entryId`/`revisionId` uuid,
`exactVersionSet` object, `expiresAt` RFC3339, `revoked: false`; denied: five nulls and a boolean `revoked`, each null refusing a value);
`previewVerificationDenial()` equals the denied branch; the 500 ms timeout, 75 ms/150 ms retries, read-safe and 30 s circuit equal the
`CMS_PREVIEW_VERIFIER_*` constants and `readSafe: true`; one RPC `platform_api.cms_verify_preview_token` for `shard04_delivery`. Titles
carry `[P2-S11-AC-073]`. Mutation of the parsed row (timeout 400 ms, retries 75/200, audience {1,64}, extra response member,
`actorPersonId` as hex) failed 11 tests across five variants; no variant survived. No contract drift found.

## Item 6 (AC-035, AC-038, AC-041): feature-ledger traceability

`tests/contracts/phase-02-slice-11-feature-ledger.test.ts`, 11 tests, green. Titles carry all three criterion ids. Asserts: each criterion
in `phase-2.md` names the expected ledger id and operations (AC-035 -> 25.02.03 with CMS-03B-15..18; AC-038 -> 25.02.04 with CMS-03B-20;
AC-041 -> 25.03.04 with CMS-03B-19); the BE03b Feature Ledger Coverage table owns exactly {05,06,15,16,17,18}, {07,20}, {08,09,19} for
them; `feature-ledger.md` assigns the three rows (and only those) to `P2-S11`; the Phase 2 plan's Slice 11 feature row and BE endpoint row
equal them; each operation is owned by one row only; each resolves to exactly one of `cmsEditorialRoutePolicies` (browser) or
`CMS_EDITORIAL_INTERNAL_OPERATIONS` (19 and 20, internal only); CMS-08/09/13 map to Slice 11. Mutations (ledger slice changed, BE03b
ownership dropped, plan endpoints dropped, criterion pointer changed) failed 6 tests across four variants; none survived.
Open (unchanged, DEC-155): the AC-041 criterion text is truncated ("revocation sta"); this test does not and cannot prove that clause.

## Verification

- `lane-worker-green.log`: the five new files, `Test Files 5 passed (5)`, `Tests 80 passed (80)` (49 + 7 + 4 + 9 + 11).
- Wider run (before the redaction file was split into three): `apps/worker/src/cms-editorial` + both sweep tests + `async-runtime.test.ts`
  + the two contract tests: `Test Files 91 passed (91)`, `Tests 1555 passed (1555)`. The split redaction suite was rerun alone: 49 passed.
- `eslint --max-warnings=0` clean on all new files; prettier applied. `tsc` over the three Worker test files reports no error in them
  (the only two errors are pre-existing `crypto` global typing in `packages/contracts` when compiled through src paths in a scratch
  config, now deleted). `tests/contracts` files are not covered by `tsc --build`; they pass ESLint and vitest.

## Changed or replaced tests

None. No existing test was edited, weakened or removed.

## Left open

1. Item 1 (AC-050, AC-053, AC-056) awaits the 422-versus-502 ruling above.
2. The evidence-ledger fragments (`tests/contracts/phase-02-slice-11-evidence-ledger-*.ts`) belong to the ledger lane. The new titles above
   (items 2-6, notably `P2-S11-AC-073`-prefixed ones and the AC-035/038/041 traceability titles) are what they should now cite; item 4's
   file is `apps/worker/src/cms-publication-schedule-sweep-deadline.test.ts`.
3. Completion checklist: no new pattern or blocker beyond item 1 (a pending owner decision, not a recorded DEC); progress-tracker and
   session-close updates are the orchestrator's.
