# Slice 11 — private genuine claimed preparation QA gate

Production baseline f0e1f010 remains unwired. Entry40/broader1462 GREEN,
all14 distinguishing mutants caught with restored40 controls; final restored
1462/static GREEN and all16 hashes exact. No acceptance closure.
Implementation-owned private verification seam; no new owner policy.

## Sources / scope

- BE03a2305–2329: dry-run preparation without early activation.
- Existing claimed-dry-run-fixture.ts169–191 public draft/queued attempt;
  originalEvent94–104 preserves eight stored fields. claimAttempt195–227 drops
  actual expiry/full preclaim job and is insufficient alone for JobEffectInput.
- async-runtime-parsing.ts67–137: actual canonical job and whole receipt decoding.
  Application runtime-types.ts55–69/124–130 define exact request/receipt/input.
- production-worker-runtime-cms.ts176–179: operation/request/signal port invokes
  actual createSupabaseRpc(env,operation,{p_request:request},signal).
- Existing private response parser, storedProjection/attemptState SELECT oracles
  and observeRead27-table snapshots remain frozen. Transport forwards through
  child fetch signal; do not assert original signal identity on HTTP child.
- s11Environment() in phase-02-slice-11-session.ts uses existing local runtime
  credential provider. Never read/print .env, JWTs or credential values.

## Disjoint native write claims / fixed helper interface

A sole NEW tests/postgrest/support/phase-02-slice-11-claimed-preparation-fixture.ts,
utility <=300 formatted lines. B sole NEW
tests/postgrest/phase-02-slice-11-claimed-preparation.apispec.ts, test <=400.
No existing fixture/test/SQL/source/README/tracking edits by authors.

Helper export prepareClaimedPreparationFixture() returns:
attempt (ClaimAttempt), input (JobEffectInput with actual claimedLease),
signal (AbortSignal), worker (new private claimed-entry instance),
calls (ordered operation/request/original signal/optional actual response),
wire (ordered operation/plain parsed body/status/profile, no auth fields).
Export matching PreparationCall/PreparationWire types if needed.
Use separate real setup transport and real recording stage transport;
neither mocks/replaces outcomes. All HTTP responses delegated unchanged.
Recording fetch inspects only RPC path/body/status/profile; never auth headers.

Setup uses public prepareClaimAttempt, actual read_canonical_job and
parseCanonicalJob. Actual claim_job uses jobId/expectedVersion=job.version,
fresh UUID token, leaseSeconds840, nowMs=Date.now() in typed application
request; actual wire four p_* fields match production. parseLease(raw,exact
request) keeps actual acquired version/expiry; never synthesize +1 or expiry.
Input retains preclaim job and actual stored original event untouched.
Stage port is exact p_request adapter; observeRead wraps readPlan ONLY.

## Two genuine cases / assertion matrix

1. Public first-empty candidate + real BE00 receipt through private entry:
   capture independent storedProjection and original event before invocation;
   parse actual initial six-object resolver reply and compare whole stored
   projection. Require acquired/preclaim distinction and exact two-key wire
   plus original eight fields; preserve receipt including expiry unchanged.
   Assert original signal identity at every port, platform_api profile and
   exactly one p_request wrapper per stage HTTP wire.
   Exact stage history readPlan/claimLease/heartbeatLease/readSourceRows/
   processDryRunBatch/finalizeDryRun. Initial stage CAS equals resolved plan
   version, not acquired job version; later tokens come from actual plan lease,
   not BE00 token. Require result processed, retained public report ID/request
   identity, outcome completed/state ready/activationSwitched false.
   Independently SELECT sealed ready report/plan actual zero counts/hashes,
   cleared plan lease, no active version/switch, candidate still non-active.
   Original event and claimed job rows unchanged by entry; no ACK/processed
   outcome inferred. Whole first invocation is NOT a read-only observation.

2. Same still-live actual receipt after genuine sealing:
   establish case1 via real path, capture persisted state/digests, invoke again.
   Exactly one additional two-key resolver/read; no stage/activation/ACK calls.
   Whole current parsed reply/retained actual report/request/result matches
   stored rows, truthful ready state. Plan/report/job/event/global snapshots
   unchanged after replay. This is READY preparation replay, NOT completed
   nonzero migration or public activation. Do not fake completed state.

Firstness/emptiness independently read scoped persisted candidate/source/
active/entry census; no synthetic null IDs or forced active state, report,
plan, job or approval. Reuse safe SELECT helpers; no direct fixture SQL writes.
No receiving/factory/export/startup wiring, durable continuation/ACK mapping,
BE00 heartbeat/per-stage enduring authority or new policy/default/error codes.
No activated event admitted. Existing nonzero/completed/public-approval
lifecycle remains open;0/122.

## Execution ownership

Native authors: pure fs/path reads + apply_patch within sole claim only;
no shell/child_process/executable imports/scripts/tests/DB/Git/network/
formatters/packages/secrets/nested agents. Freeze/release claims after sources.
Root: source review/formatter/caps/independent refutation, then actual main-stack
54322 PostgREST verification fresh CI0/shared flock with pre/post db reset and
closed cleanup. Never55322 or primary checkout. Preserve old76 API/1462 units.
Actual RED must distinguish setup vs assertion failure; no source change or
acceptance status inferred until root evidence. Full Validation Cmd still due.
