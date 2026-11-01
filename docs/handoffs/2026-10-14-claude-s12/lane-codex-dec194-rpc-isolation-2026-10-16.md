# DEC-194 real RPC isolation — native author handoff

Author: native gpt-6.1-sol / ultra. Date: 2026-10-16.
Status: **SIZE EXTRACTION AUTHOR UNRUN / ROOT19 REVALIDATION HELD**.
No production acceptance claim.

## Exact ownership

Initial RPC claim: these five new paths, relative to
`/home/rob/.codex/worktrees/phase2-slice12/WeJammin`:

- `tests/postgrest/phase-02-slice-12-dec194-isolation.apispec.ts`
- `tests/postgrest/support/phase-02-slice-12-dec194-alt-stack.ts`
- `tests/postgrest/support/phase-02-slice-12-dec194-isolation-worker.ts`
- `tests/postgrest/support/phase-02-slice-12-dec194-isolation-probe.sqlinc`
- This report.

The lifecycle RED extension added four exact new paths and changed only the
approved API-spec teardown delegation and this report. Initial stack/Worker/probe
helpers were frozen during RED. The subsequent seven-path GREEN claim below changes
only released safety helpers; the observation probe/spec/assertions stay frozen.
No production, old test, config, migration, provider, primary checkout or service edit.
Author performed source/config reads, absolute apply_patch edits and file hashes/counts only.
No author runtime, test, lint, formatter, browser, DB, Docker, network or Git execution.
Supabase/data-access skills kept the real protected RPC boundary and private grants;
their normal CLI/docs/query verification is held by the explicit author restrictions.

## What the baseline is designed to prove

One integrated Vitest case has three dependent, separately identified phases:

| ID | Actual production entry | Actual public/private RPC pair |
| --- | --- | --- |
| DEC194-RPC-001 | `createCmsTaxonomyApp(createProductionCmsTaxonomyDependencies(...))` | `cms_act_taxonomy_term` |
| DEC194-RPC-002 | `createTaxonomyMergeConvergeEffect` with a real BE00 claim | `cms_run_taxonomy_merge_converge` |
| DEC194-RPC-003 | `runProductionCmsTaxonomyMergeReconcileSweep` | `cms_reconcile_taxonomy_merge_converge` |

Worker TypeScript executes in the existing Vitest real-API harness, not hosted workerd.
Requests use unchanged production RPC adapters, bodies, profiles, opaque apikey-only
credential handling and 15000 ms deadlines. The forwarding decorator adds
nonce/producer observation headers and composes the unchanged deadline signal with
the test run's cancellation signal; the actual HTTP response is returned unchanged.
The recovery function has no fetch seam: its temporary forwarding global is restored
in `finally`. No production import is mocked and no surrogate RPC exists.

Each actual `platform_private.jobs` AFTER INSERT trigger observation requires this
run's fresh UUID header and the real convergence job type. It records only producer,
nonce/job ID, safe isolation enum, PID, transaction ID and whitelisted booleans:
gateway-derived service claim, current role, RPC flag, actual public/private caller
frames and common BE00 acceptance frame. Raw PG_CONTEXT, request claims, SQL and
credentials are never persisted or printed. Functions/tables are in an unexposed
run-owned schema with no PUBLIC/anon/authenticated/service_role grants and RLS enabled.
The trigger does not alter or replace any production function or returned success.

Baseline requires exactly one observation for each producer, actual
`current_setting('transaction_isolation') = 'read committed'` INSIDE acceptance,
all authority/caller flags true, three distinct transaction IDs and positive PIDs.
It cross-checks each real accepted job's outbox, audit and completed derived
idempotency receipt, preserving complete earlier acceptance rows, plus recovery's
durable failed-Q to recovered-R identity. Current assignment counts establish
10001 -> 5001 -> 1 remaining, then unchanged one-row work after recovery enqueue.
Successful baseline prints only the safe three-row observation record for receipts.

## Fixture provenance — NOT production proof

The existing guarded S09 actor/tenure, S12 governed-type and taxonomy worlds are
read as SQL SOURCE, not imported JavaScript or default-stack helpers. Their local
claims/session GUC seams, direct fixture memberships/negative-control grants and
facet rows are **fixture-only**, before the probe trigger exists or HTTP tag is used.
The author received root clarification explicitly allowing that ordinary bootstrap.
Real governed producer chains provide the active type/vocabulary and standing grant.
Exactly 10001 labelled entry/revision/assignment rows are synthetic fixture writes.
Two real fixture term creations precede the actual tested merge.

A labelled BE00 fixture acceptance and terminal cancellation provide a fresh unique
canonical sentinel. Before any tested mutation, the production canonical reader over
Kong/PostgREST must match the same ALT SQL job identity/type/state/version. All three
tested jobs are also re-read through that production reader and matched to ALT SQL.
The continuation's claim and both setup outcomes use actual BE00 HTTP adapters.
After the continuation creates a further job, the previous delivery is settled
succeeded and the further job is claimed/settled failed. Only these three fixture
jobs' created/updated timestamps shift together by 20 minutes. No job state,
version, token, lease or result is forged. Diagnostic SQL reads set only the scoped
CMS read flag in a separate postgres connection, never an HTTP request claim.

## Root-only prerequisites and execution boundary

Author has NOT checked running state. Parent reports the ALT DB is
`supabase_db_wejammin_ev`, host port 55322; REST/Kong must be separately released.
The helper refuses protected primary/default/hosted targets and has no fallback:

- Exact ALT config workdir: `/home/rob/.codex/worktrees/phase2-slice10/orchestration/altdb`.
- Exact API `http://127.0.0.1:55321`; DB55322; project `wejammin_ev`.
- Exact running DB/REST/Kong container names ending `_wejammin_ev`.
- ALT CLI status uses explicit `--workdir`; URI/port/upstream/schema checks must pass.
- Existing opaque gateway credential is read internally; no JWT is minted or logged.
- Fresh staged ALT required: no CMS terms and no fixed S09 owner identity yet.
- Stage all six DEC-194 WIP migrations, including 190030/40/50 serialized bodies,
  under root's existing stage6 procedure; this harness does not migrate/reset/start.

Root must hold the repository's existing lock order: Supabase CI lock, quiet shared
lock, then ALT DB lock. No existing service is stopped by this harness. The existing
minimal local API startup pattern is package.json's Supabase start exclude list
(Auth/Realtime/Storage/UI/edge/analytics/pooler omitted, REST/Kong retained), with
explicit ALT workdir. Root must verify current CLI help before separately executing.

The focused API spec is already included by `vitest.postgrest.config.ts`; do not run
the broad default-stack API glob against this fresh fixture. Root runtime command:

```sh
S12_DEC194_RPC_ROOT_RELEASE=2026-10-16-local-alt \
S12_DEC194_RPC_FIXTURE_RELEASE=2026-10-16-local-alt \
S12_DEC194_RPC_CLEANUP_RELEASE=2026-10-16-local-alt \
pnpm exec vitest run --config vitest.postgrest.config.ts \
  tests/postgrest/phase-02-slice-12-dec194-isolation.apispec.ts
```

These are future root release gates, not author authorization or executed commands.
The 150-second setup budget applies only to labelled SQL fixture construction;
it does not raise the Worker's 15-second protected command budget.

## Optional non-RC sensitivity — never production protection

On a SEPARATELY fresh root-controlled run, root may set
`S12_DEC194_RPC_NON_RC_EXPECTED='repeatable read'` (or `serializable`). The root alone
must first change the actual ALT role/REST transaction configuration under locks.
The test never changes isolation or a role. It sends a nonce-scoped sensitivity header.
At the actual ordinary acceptance insertion the private test trigger verifies the
same caller/service flags, reads the real isolation enum, and deliberately raises
`DEC194_PROBE_NON_RC_REPEATABLE_READ` / `..._SERIALIZABLE`. An ignored/mismatched
override raises `DEC194_PROBE_OVERRIDE_IGNORED`, which FAILS the sensitivity case.
The case requires the exact observed token, no committed observation, unchanged
full-row store digest/acceptance snapshots and unchanged assignment/term facts.
It returns before continuation/recovery: this optional mode proves instrumentation
sensitivity for ordinary merge only, NOT three non-RC protections or a baseline pass.

Before any override root must privately record exact previous values AND absence
at both global and `IN DATABASE postgres` scopes for `service_role` and authenticator,
plus relevant REST configuration. Use filtered `pg_db_role_setting`/`pg_roles` reads
for `default_transaction_isolation`, not a published full environment/secret dump.
Restore the EXACT previously existing enum at the EXACT scope, or RESET that setting
only when previously absent; preserve unrelated role settings. Root must separately
release/reload or recreate only the ALT REST connection pool as needed after change
AND restoration, then establish the actual baseline enum through a fresh real RPC.
A mere SQL SHOW, role catalog, config read, notification, service restart or test
title cannot substitute for the in-RPC observation. No automatic ALTER ROLE, REST
reload/restart, startup, teardown of services or reset is implemented.

## Cleanup and remaining gates

After the separately released test, `afterAll` first closes admission and awaits
owned work, then drops only verified owned objects behind the cleanup release gate.
Canonical fixture identities, subjects, assignments, jobs, receipts/audit/outbox
remain for root inspection. Root owns any fresh-ALT reset and existing-service
restoration separately; this harness performs no canonical deletion or reset.
On partial setup failure, inspect ALT privately before retrying; never fall back
to the primary/default project or reuse another test's world.

Required next: independent readback; root formatting/type/lint; root-reviewed API
startup/stage6/fixture/probe/cleanup under locks; focused baseline real HTTP result
with safe observation receipt; optional sensitivity only if separately released;
then exact operational restoration evidence. No hosted/provider/Auth/MFA, deployment,
PostgREST race linearization or externally owned acceptance gate is claimed here.

## Initial RPC author static receipts (before teardown extraction)

Unformatted physical lines / SHA256 (source reads only):

| File suffix | Lines | SHA256 |
| --- | ---: | --- |
| `dec194-isolation.apispec.ts` | 195 | `f93a1510d991635ed278376cc0f19d3e2c70ae87ff264d8285d46134aa309d59` |
| `dec194-alt-stack.ts` | 176 | `cf93f20baedca80532a10bebcbe69e0c7cce5203e1d86e1c5aee93079a4194ed` |
| `dec194-isolation-worker.ts` | 159 | `483f109c397cb6da4c9c3b82e3ea9292fab387619b1e9f67dc6989f8a9f44296` |
| `dec194-isolation-probe.sqlinc` | 145 | `1c799390d9f239912a5379ef743cb827b04a4c2d6de551af0c4fb42c61f10298` |

Relative import targets exist by static filesystem read. No parser/type/lint/test
execution was performed. Root formatting may change hashes and line counts; recheck
the 300-line utility / 400-line test limits then. All execution results remain
**UNRUN** until root supplies actual artifacts; no prediction is a pass.

## Lifecycle/ownership RED extension — author UNRUN

Root independent review found these blockers; actual ALT startup/runtime remains held:

- P1: Worker helper continuation gives the production effect a never-aborted
  signal. Its retry budget can outlive the spec's 60-second case and synchronous
  probe DROP. Recovery's temporary global fetch also needs abort-and-awaited
  quiescence before deletion, including forwarding fetches after an outer deadline.
- P2: failed trigger CREATE does not confer ownership. The old cleanup can delete
  a same-name pre-existing or rebound trigger, and schema CASCADE can reach unowned
  dependencies. Successful creation plus current catalog binding must govern deletion.

Root Dispatch approved this six-path test/extraction-only claim:

- NEW `tests/postgrest/support/phase-02-slice-12-dec194-lifecycle.test.ts`
- NEW `tests/postgrest/support/phase-02-slice-12-dec194-probe-ownership.test.ts`
- NEW `tests/postgrest/support/phase-02-slice-12-dec194-unit-test-support.ts`
- NEW `tests/postgrest/support/phase-02-slice-12-dec194-lifecycle.ts`
- Existing RPC API spec: only import and `afterAll` delegation changed.
- This report.

At RED freeze, `finishDec194IsolationRun({ stack, worker })` did EXACTLY
the previous `stack?.cleanupProbe()`. It adds no cancellation, admission, tracking,
ownership check, async wait or implementation fix. Tests call this actual teardown
entry with existing real Worker APIs, never a nonexistent shutdown method.

| ID | Behavioral assertion against frozen helper APIs |
| --- | --- |
| LIFE-001 | Close during real jittered retry pause; producer settled before DROP, no later retry/timer. |
| LIFE-002 | Held continuation fetch receives abort; no DROP before deferred cancellation acknowledgment. |
| LIFE-003 | Recovery abort/drain; actual `finally` restores global fetch before DROP. |
| LIFE-004 | All three simultaneous producers cancel and settle; first two acknowledgments cannot release cleanup. |
| LIFE-005 | Actual RPC remains pending at14999ms, expires at15000ms; its still-pending forwarding fetch must drain before DROP. |
| LIFE-006 ×7 | Closed ordinary/continuation/recovery/canonical check/read/claim/settle refuse before network or SQL. |
| OWN-001 | Failed CREATE preserves exact pre-existing same-name trigger binding. |
| OWN-002 | Same name/OID rebound to a foreign function survives cleanup. |
| OWN-003 | Unowned dependent trigger and owned schema survive unsafe CASCADE; cleanup fails closed. |
| Controls ×3 | Completed real Worker adapters retain typed successes; unchanged owned cleanup works; fixture-only cleanup preserves neighbors. |

18 cases were authored. RED-stage prediction: 15 meaningful defect failures and three
passing controls. Root's actual matching receipt is recorded below.
No unit/runtime/formatter/type/lint execution was performed by the author.

The only mocked behavior is external `execFileSync`, fetch, environment gates and
time. Production Worker effects, retry/transport adapters, stack APIs and teardown
are real. The process mock is mandatory before constructing the stack and never
delegates to host commands. Fake fetch never delegates to the network. Existing
local source/ALT config files are only read, so units require no running service,
database, role change or secret. Credentials returned by the fake process are
synthetic `sb_secret_unit_only`/unit DB values, not local credentials.

The command-boundary catalog fixture models CREATE success/duplicate-name error,
catalog metadata, DROP effects and schema dependency behavior. Tests assert final
catalog contents and ordered fetch/abort/ack/drop observations, not source tokens.
It is a bounded mock, not a PostgreSQL SQL interpreter or transactional DDL proof;
actual ownership cleanup still requires root source review and later real ALT proof.
Even failing unit assertions release held fake fetches and drain real Worker retries
before restoring globals. The teardown wait itself is excluded from active-producer
counts, so the oracle does not count its own cleanup promise as outstanding work.

Root focused no-DB RED command (not executed):

```sh
pnpm exec vitest run --config vitest.config.ts \
  tests/postgrest/support/phase-02-slice-12-dec194-lifecycle.test.ts \
  tests/postgrest/support/phase-02-slice-12-dec194-probe-ownership.test.ts
```

Use ordinary Vitest config, not the `*.apispec.ts` PostgREST project. A setup abort,
missing-method error or stuck fake cleanup is not acceptable RED; repair only that
fixture under an exact follow-up claim before releasing implementation. Root owns
format/type/lint and meaningful RED before separate lifecycle/ownership GREEN.
All real ALT startup, staging, HTTP isolation execution and operational cleanup
remain HELD. TDD/Vitest/testing-strategist guidance shaped these behavioral boundaries;
passing mocked units would establish harness safety only, never RPC isolation.

Extension freeze receipts (unformatted physical lines / SHA256):

| File suffix | Lines | SHA256 |
| --- | ---: | --- |
| `dec194-lifecycle.test.ts` | 162 | `db2c9703d5183c9c6ccdf14fe576128c0e784da28fc76a93c3ec614bcaa12b28` |
| `dec194-probe-ownership.test.ts` | 89 | `4fc55145f1c8b8bf4e997f8123f8227dfaea5863f5c87d7f49de1be0883e44ed` |
| `dec194-unit-test-support.ts` | 164 | `f085c8978873bd72423479eca8a8d4e96b6665f709bd41d8d16354c43795c82d` |
| `dec194-lifecycle.ts` | 10 | `9833b842de72da211ac0a50b180ff46bd92185639c2ddc85b4bdbb45d2b344e4` |
| `dec194-isolation.apispec.ts` | 196 | `3aed66d5a44ecf1e5765533b82fde2f2613de7a9d269ebdb569ae1774e19bd6c` |

At RED freeze, relative import targets existed and initial ALT/Worker/probe hashes
were unchanged; no fix was present. These are historical RED source receipts, not
current GREEN source hashes. Author execution stayed UNRUN.

## Safety GREEN author checkpoint — not executed

Root observed the frozen 18-case RED: three controls PASS, 15 meaningful lifetime,
admission and catalog-state FAIL; no skips or collection error.
Artifact: `/tmp/wejammin-native-receiving-proto-red-BkaHbW/dec194-rpc-safety-red.json`.
SHA256: `0a4e45b9834511149a41a3d078748ac5e7f617670039872b378b11d21ea7bd37`.
This is parent-supplied root execution evidence, not an author run or actual DB proof.

Root then released exactly seven GREEN paths: existing Worker helper, ALT stack,
lifecycle seam, unit-test-support wiring, this report, NEW
`phase-02-slice-12-dec194-probe-ownership.sqlinc` and NEW
`phase-02-slice-12-dec194-unit-catalog.ts`. Both are under `tests/postgrest/support/`.
All 18 callbacks/assertions, the API spec and original observation probe are unchanged.

Lifecycle changes:

- One owner closes admission synchronously, aborts once and caches its close promise.
- All seven public async operation families are tracked; closed calls reject before
  fetch/SQL. Already admitted but not yet started work rechecks admission too.
- Forwarded requests compose original and owner signals. Their entire real fetch
  AND observation body-read promise remains tracked even after the outer RPC deadline.
- Close waits for both producer and request sets. The continuation receives the owned
  signal, interrupting the real retry pause. Recovery's global fetch restoration runs
  inside its tracked `finally` before teardown may delete anything.
- Explicit signal listeners are removed on request settlement. No deadline/retry/body,
  production function or grant changed; 15000 ms remains the protected RPC ceiling.

Ownership changes:

- Activation acquires a jobs-table ACCESS EXCLUSIVE DDL lock, creates the trigger,
  captures actual trigger/function OIDs and namespace/name binding, then commits.
  The helper records ownership only after that successful transaction and typed reply.
- Cleanup uses ONE psql session/transaction: take the same DDL lock; recheck exact
  acquired trigger OID, function OID, jobs relation, name and private function binding;
  conditionally drop that trigger; explicitly drop only the six known functions/tables
  and then the owned schema, every DROP with RESTRICT; commit.
- Failed CREATE never authorizes a named-trigger DROP. Missing/replaced binding raises
  before deletion. An unowned dependency makes RESTRICT abort the entire transaction,
  rolling back earlier owned drops. Ownership state is retained on failure for root
  inspection, not forgotten or repaired by an unsafe retry. No CASCADE is used.

The unit catalog extension is a bounded recognized external SQL protocol, not a
general SQL engine: exact locked activation/capture and locked guard/drop sequences
are recognized, catalog changes are published only on successful simulated commit,
and dependency failure preserves the complete prior state. The old unsafe standalone
protocol remains recognized as a negative control, so a reverted helper still
deletes foreign state and fails the original behavioral assertions. There is no
early pg_trigger read return that swallows mixed DDL; unknown catalog/DDL throws.
No assertion, expected union, producer callback or frozen oracle was changed.

Required before acceptance: root formatting/caps/types/lint, expanded safety GREEN,
independent safety readback, then separately claimed real PostgreSQL duplicate-name,
rebound OID/function, unowned-dependency rollback and atomic-DDL-lock controls. A mock
catalog cannot establish PostgreSQL locking, rollback or dependency behavior. Client
cancellation acknowledgment is not itself proof of server transaction cancellation.
Actual ALT HTTP/isolation startup and all role/REST operations remain HELD.

Author performed only source edits, import-target/hash/count reads and static SQL
literal/protocol comparison (no target-code evaluation). No formatter, tests, build,
lint, type checker, DB, Docker, API, services, network or Git ran. GREEN is UNRUN.

GREEN author freeze source receipts (unformatted physical lines / SHA256):

| File suffix | Lines | SHA256 |
| --- | ---: | --- |
| `dec194-isolation-worker.ts` | 173 | `1392c17e0d4ad16896ee2a9ccf3b5bc6f7379793914c82605c74254dc8698ce2` |
| `dec194-alt-stack.ts` | 193 | `c62adcbf37d5f249784ef260461427c3a5d3323836d46333aa888ef755993578` |
| `dec194-lifecycle.ts` | 58 | `45dd8f9ffd9ea883e4fd59496deebf1245849c7bf654e5b76fc923038798cd40` |
| `dec194-probe-ownership.sqlinc` | 46 | `33de400702d9616b893ef3213f20c9fbc1dca940405965478ce0897b1f6f484c` |
| `dec194-unit-catalog.ts` | 120 | `f7860e946ae553a04d87e6650b5652c32f69359a159ffecc7339552f7b1c7b28` |
| `dec194-unit-test-support.ts` | 131 | `bc8a01e79786904ed760d34ab49d335bcc2d6296bdba6a1f6f7f5e2e432b3507` |

Frozen lifecycle test, ownership test, API spec and observation-probe hashes match
their earlier receipts. Relative imports exist by static read. Root owns normalized
line caps, formatting, independent review and all actual validation results.

## Overlapping recovery restoration — RED receipt and GREEN author checkpoint

Parent root observed actual safety GREEN: 18 PASS, no abort/skip,
`dec194-rpc-safety-green.json`, SHA256
`8fb879c91c5c7df39310957de2b15d779efa4112d1d5f01cabe3a509c3936cc8`.
Independent review then found one remaining P2: overlapping sweep A saves F and
installs FA; B saves FA and installs FB. Completion A then B restores F then stale
FA, despite both promises draining. Thus 18 GREEN does not clear global restoration.

Root claimed exactly lifecycle.test.ts and this report for one TEST-ONLY regression.
NEW LIFE-007 starts both actual production sweep functions through the unchanged
held-fetch boundary, acknowledges A, proves B still pending, then acknowledges B.
After both settle and actual teardown finishes it requires original global fetch,
DROP's restoredFetch=true, zero active work/fetches/timers and no later RPC at60s.
All prior 18 callbacks/assertions were unchanged during this TEST-ONLY extension.
Root then observed actual19-case RED:18PASS/1meaningful LIFE-007 stale-fetch FAIL,
no abort/skip; SHA256
`879953af3dc384c7bbc437d3fac16c981e594477cc97abb121fd47c00538c20a`.

Root released only Worker helper + this report for GREEN. One run now captures the
original fetch once and installs ONE shared recovery forwarder while its reference
count is positive. Both admitted sweeps still execute; only LAST finally restores
the original, regardless of completion order. No serialization/rejection of normal
overlap, production body/deadline/retry, cancel/drain or SQL behavior changed.
An unexpected foreign override is never overwritten: recovery records an ownership
error, closes admission/aborts, and close drains then rejects, preventing DROP under lost
global ownership. The19 test callbacks and every other helper/spec/SQL stay frozen.
Author GREEN is UNRUN. Root owns19GREEN + independent readback; actual ALT startup,
real PostgreSQL ownership controls and RPC acceptance stay HELD. No author formatter,
tests, runtime, DB, Docker, API, services, network or Git execution.

LIFE-007 author freeze: lifecycle.test.ts191 physical lines, SHA256
`319a7f3873b807803dbddecbdda5e0bed69da32283686ec1e8bcc6737a0d867d`.
Removing only the new case recovers the exact prior lifecycle file SHA
`db2c9703d5183c9c6ccdf14fe576128c0e784da28fc76a93c3ec614bcaa12b28`.
The test hash remains unchanged for GREEN; unit-support/unit-catalog are unchanged.
Overlap GREEN author freeze: Worker194 lines SHA256
`933a5bae7189db8659b41e1dc6da2ad4f172951bd4753856feb32fff0ddac6be`.

## Normal-format size extraction — author UNRUN

Root reports prior normalized19/19 PASS, scoped lint0 and independent lifetime CLEAR.
Exact five-path claim moves DTOs to worker-types and command/config/container preflight to alt-environment.
Old exports remain compatible; DAG: Worker -> stack -> environment; Worker -> types (type-only).
Static inverse comparison recovers Worker bytes apart from DTO relocation; preflight and stack after nonce are byte-identical.
Surgical/clean-code guidance limits this to relocation: no RPC/SQL/lifetime/secret-boundary change. No author parser/runtime/formatter/DB/network/Git; root owns formatting/caps, unchanged19-case revalidation and readback.

| Extracted source suffix | Physical lines | SHA256 |
| --- | ---: | --- |
| `dec194-isolation-worker.ts` | 294 | `9c57b5d0fe14299115547461f54466eff64269660a7a6c8f36cbf71f8529a04f` |
| `dec194-alt-stack.ts` | 206 | `bf238eee1f16bb91a6f9dc3d65da92ea7c2760d7738636c602060fa31ff4e28e` |
| `dec194-worker-types.ts` | 19 | `b7bd2c9a41f60cd1a1f9b9a9b5d3383268e0102163df5a82f9ce8f3b148bf959` |
| `dec194-alt-environment.ts` | 152 | `ec82cbc16a817c79e73f63274f880f106931fe751982f6fc46eea702a0691d0e` |
