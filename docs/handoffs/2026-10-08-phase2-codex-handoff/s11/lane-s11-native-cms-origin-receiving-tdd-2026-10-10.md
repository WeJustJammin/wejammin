# Slice11 immutable CMS origin receiving — test-first contract

## Scope and existing source

The current generic receiver parses job.requested, reads canonical Job, then
calls executeJobDispatch (async-runtime80–116). Consumer32–72 re-reads Job,
checks restore and CAS-claims actual canonical version. dispatch244–251 skips
older event versions and retries future event versions. This blackholes a
genuine immutable CMS origin after a queued continuation or expired reclaim.

Existing schema-dry-run-origin-verifier22lines verifies the exact strict
eight-field origin through protected cms_get_schema_migration_plan originEvent
branch. Its boolean is immutable identity only, explicitly not a claim or stage
permission. Keep its source, DTO, SQL and all existing35 source/QA paths frozen
during this new test-only wave. Source23 origin proofs remain unchanged.
No new RPC/grant/owner, wire field, GUC, schema or purpose permission.

## Selected private receiving integration (producer UNRUN)

Add optional AsyncJobRuntimeDependencies callback
verifyCmsSchemaDryRunOrigin({env,envelope,signal}):Promise<boolean>.
Production composition supplies existing protected Supabase RPC transport and
existing strict verifier. The production port requires an actual boolean RPC
body before handing it to that verifier; malformed JSON or nonboolean bodies
raise a safe reader error. This callback is private code-owned, never selected
by message payload. Use parsed genuine job.requested envelope unchanged.
Receiver creates its own nonaborted signal for this read; no delivery-signal
input exists and no controller goes to the callback. Check cancellation before
and after the await as retry, never interpret cancellation as server false.

For canonical cms.schema.dry_run while nonterminal:

- Missing callback or reader exception: locally catch and retry before
  claim/effect/write, including nonretryable AsyncRpcManualReviewError from
  raw malformed JSON/content-length, not the inherited outer ACK catch.
- Exact false/non-true: ACK untrusted origin, no Job/processed writes.
- Literal true: pass private verifiedImmutableJobOrigin boolean through the
  consumer to dispatch; do not rewrite envelope or claim current event version.
- Clamp that verified first canonical CMS type through the existing private
  eventJobType binding. A consumer reread of another type must refuse even
  when its version equals the incoming origin version; comparison alone is
  not an identity guard. Wrong-id reread likewise creates no claim/effect/write.
- The flag bypasses only event/current version comparison, and only with actual
  bound canonicalJob id/type cms.schema.dry_run. It is not standalone authority.

Other Job types retain stale/future version rules even if the private flag is
true. Invalid grammar/binding, duplicate/terminal skip, restore, active-lease
refusal, actual claim CAS, outcome CAS, processed/ACK sequencing stay intact.
Terminal canonical Jobs remain existing effect-free skip, no mandatory reader.
Core outcome uses actual claim receipt, never event version. Consumer re-read
handles current version advancing between receiver's read and claim.
Existing queued producer returns completed/processed:null; first continuation
retries without origin marker/ACK, later terminal marker precedes ACK.

No current-stage/enduring SQL authority, heartbeat, recovery/error mapping,
production CMS preparation callback, public lifecycle or acceptance closure.
These remain separate mandatory work. No new Job type or business retry
policy. The registered immutable-origin distinction is derived consistency:
IA00 INF-05 requires workers to lease/retry from canonical state; IA00 Job
retry advances queued state; architecture257 requires loading canonical
entity/expected version from PostgreSQL before effects. An unchanged accepted
outbox origin cannot serve as current execution CAS after those advances.
BE00 and BE03a receive the narrow explicit distinction; live authority/CAS/
lease/restore safeguards remain unchanged. Other Job types retain existing
versioned handling. This is not permission to replay stale entity commands.

## Native author: one new QA path only

apps/worker/src/async-entrypoint-cms-origin-admission.test.ts; target <=350lines.
Use actual createAsyncEntrypoint/createAsyncJobDependencies/executeJobDispatch,
existing origin verifier and production protected RPC over strict file-local
fake fetch. No real network/DB. Capture complete ordered arguments/counts,
environment/envelope identity values, current claim receipt, immutable fixtures.
No fake replacement for core dispatch/claim/apply/processed helpers.

Declare future callback on a structurally typed dependencies object variable;
current implementation ignores the extra property so tests compile before
producer. Do not import nonexistent APIs, change producer/config, use any/asT,
suppress diagnostics, or count type/import/setup failures as functional RED.
Browser-safe typed helpers; no node:util import in Worker project.

Required bounded cases (parameterize controls):

1. Genuine older original envelope/current queued Job/nonadjacent real claim
   receipt enters effect and terminal apply/processed/ACK using current receipt.
2. Two deliveries of the same frozen origin: first queued apply→retry, no
   processed/ACK; second current queued version differs, fresh claim receipt,
   terminal apply→processed→one ACK. No adjacent-version arithmetic.
3. Wrong whole tuple/server false has no claim/effect/write even when incoming
   version matches current; verify exact origin read once.
4. Missing/unavailable verifier retries, never ACK/claim/effect/write; include
   actual protected RPC malformed-response exception and nonboolean body,
   not only503. Exercise real production factory negative wiring too.
5. Restore-fenced genuine CMS cannot claim/effect; verifier true followed by a
   canonical reread with wrong id/type cannot claim/effect/write. Non-CMS stale
   ACK and future retry unchanged, neither invokes CMS origin reader.
   Malformed/wire-flag input rejected.
6. Deferred terminal processed barrier prevents early ACK; no sleeps/network.
7. Terminal CMS with missing/throwing verifier preserves existing terminal
   ACK without any origin RPC, effect, outcome or processed write.

Assert predicate booleans for precise private history without dumping request,
token, raw fixture response or credentials. Preserve all upstream tests/titles.
Root executes genuine RED, freezes SHA, reviews independently, then checkpoints
before separately selected producer claim. No author commands/tests/format/Git/
DB/runtime/network/docs/memory. Edit only after clean pushed exact-origin
checkpoint is announced. Native6astrahigh; root6.1ultra. Claim released after QA.
