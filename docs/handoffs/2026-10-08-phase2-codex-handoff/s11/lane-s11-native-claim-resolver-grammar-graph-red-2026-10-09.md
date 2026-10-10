# Slice 11 — genuine resolver grammar and precompile graph QA, RED first

## Locked scope and ownership

Preparation-only QA. Existing genuine46 and observer206 frozen and already
executed: API14 failed/32 passed; decoder206 GREEN and isolated member-count
mutation13 failed/193 passed with exact restoration. No SQL implementation.
Main orchestration/review6.1 ultra; native authors6astra high. Root checkpoint,
push, exact-origin verification and current handoff BEFORE dispatch.

- Native A ONLY NEW
  `tests/postgrest/phase-02-slice-11-claim-resolver-grammar.apispec.ts`.
- Native B ONLY NEW
  `tests/postgrest/phase-02-slice-11-claim-resolver-graph.apispec.ts`.

Each test file<=400 lines. No existing source/helper/test/contract/SQL changes.
Use existing fixture/oracles; local small helper inside owned spec if necessary.
Read actual current schemas/producers/SQL and applicable skills/rules first.
Author tooling ONLY pure ctx JavaScript fs/path and native apply_patch; NO
commands, shell, child_process, imports that execute code, scripts/tests/DB/
network/Git/formatter/TS/package tools or nested agents. Root owns execution.
Fixed safe diagnostics; never print payloads, JWTs, event IDs or lease values.
FINAL FREEZE includes exact paths, line counts, titles and UNRUN status.

## A: distinguish valid grammar from live semantic binding

Real public CMS03A10 producers and actual protected BE00 claim receipts only.
Use valid existing live claim for syntactically valid, stale full19-digit
claimedJob.version values (including9223372036854775807); expect CONFLICT, not
input rejection. Above-bigint-max, leading-zero/fraction/scientific/sign/wrong
JSON types remain INVALID_REQUEST. Derive exact valid grammar from current
CmsVersionSchema/private request, not the older18-digit cms_worker_positive.

At least one actual BE00 claim with a valid UUIDv7 lease token and one with
uppercase spelling of a valid token must resolve200 with the full stored
six-object projection, unchanged original event, real receipt version, both
nonmutation observers. Build token from randomUUID with only version nibble
changed; do not fake persisted rows or substitute a claim receipt. A nil token
is accepted by CmsUuid syntax but cannot be produced by claim_job: use nil as
otherwise-valid wrong-token request to existing live claim, expect CONFLICT.
Maximum UUID may be another positive only if current actual producer admits it.
Do not widen original Queue event UUID grammar, invent version adjacency or
rewrite the stored event. No unresolved new policy decisions.

## B: field graph changes before another compile/attempt

Create actual public draft/dry-run and actual live claim. Independently SELECT
baseline stored projection/plan/report/job/original event. Append one optional
field through actual public CMS field endpoint, with actual candidate version,
fresh If-Match/idempotency key and normal authorized owner. Assert201 and stored
field existence/changed graph. Do NOT compile, create a replacement attempt,
call a worker/plan lease or mutate cached hashes/report/source rows.

Confirm actual persisted cache behavior: unchanged compiled artifact and cached
candidate hashes (if current producer does so), same candidate dryRunId/plan/
report/job/original event and still-live claim. Then old claimed resolver must
CONFLICT because current target definition graph differs from compiled graph,
despite coherent cached fingerprints. Both observers around resolver read.
If actual field producer refreshes cached hashes, report exact source evidence;
do not force stale rows or claim graph-only isolation. Root decides amendment.

## Root gate and limits

Read actual diffs, format/caps, independent6.1 oracle review, focused static
checks. Serialize freshCI0/flock main54322 pre-reset/run/closing-reset. Existing46
must remain behavior-identical. No55322/acceptance promotion/full validation.
Real nonzero provisional preparation, completed nullable-source replay and
receiving/heartbeat/per-stage fences remain required open work; these new probes
do not prove them. SQL GREEN requires coherent scoped snapshot and recomputed
read-only graph; never call compile writers or require premature sealed evidence.
