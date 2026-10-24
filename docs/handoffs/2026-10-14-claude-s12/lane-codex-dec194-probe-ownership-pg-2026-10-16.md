# DEC-194 real PostgreSQL probe ownership — author checkpoint

Status: **FROZEN UNRUN — root's normalized split preview passed**.
Native author: `gpt-6.1-sol`, `ultra`.
Root's initial four-path and subsequent exact split Dispatch claims precede
their author releases. No runtime,
syntax/parser check, formatter, tests, DB, Docker, API, services, network, or Git
commands executed by author. Static text reads/counts/hashes are not validation.

## Exact owned paths

- `tests/postgrest/phase-02-slice-12-dec194-probe-ownership.pg.mjs`: standalone
  seven-case diagnostic, deliberately outside Vitest discovery.
- `tests/postgrest/support/phase-02-slice-12-dec194-probe-ownership-pg-kit.mjs`:
  explicit ALT/worktree admission and fixture orchestration; original API retained.
- `tests/postgrest/support/phase-02-slice-12-dec194-probe-ownership-pg-process.mjs`:
  owned psql child transport, admission, bounded polling, drain, and close.
- `tests/postgrest/support/phase-02-slice-12-dec194-probe-ownership-pg-catalog.mjs`:
  unchanged SQL literals, identity/rendering, full catalog queries, guarded DDL.
- `tests/postgrest/support/phase-02-slice-12-dec194-probe-ownership-pg-manifest.mjs`:
  fsynced safe recovery receipts, exact state admission, and baseline capture.
- `tests/postgrest/support/phase-02-slice-12-dec194-probe-ownership-pg-fixture.sqlinc`:
  pure private ownership instrumentation; **not a production RPC/probe surrogate**.
- This new report. Previous 384-line RPC-isolation report is frozen/unchanged.

Worktree: `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`.
Primary `/home/rob/Projects/WeJammin` remains read-only.
Existing ownership SQL, Worker, alt-stack, observation probe, APIs, other tests,
production code, and configuration remain frozen.

## Future root release — not executed

Runtime remains held pending root review and a separate explicit release.
Root must hold and record all four actual locks throughout the diagnostic:

| Lock | Required ownership |
| --- | --- |
| `/tmp/wejammin-supabase-ci.lock` | exclusive |
| `/tmp/wejammin-quiet.lock` | shared |
| `/tmp/wejammin-altdb.lock` | exclusive |
| `/tmp/wejammin-reset.lock` | root's actual reset exclusion |

No env flag is evidence that those locks are held. Do not reacquire locks already
held by root through a conflicting nested process. After root authorizes runtime,
the guarded invocation from the claimed worktree is:

```sh
S12_DEC194_OWNERSHIP_ROOT_RELEASE=2026-10-16-local-alt-pg-ownership \
S12_DEC194_OWNERSHIP_DB_CONTAINER=supabase_db_wejammin_ev \
node tests/postgrest/phase-02-slice-12-dec194-probe-ownership.pg.mjs
```

Both explicit values are mandatory; no container/API/default-stack fallback.
The module verifies the exact non-primary worktree realpath before any child.
The named container is an explicit root-approved target, not an independently
observed immutable container-identity claim. No services start/reset/provision.
No `openDec194AltStack`, race-kit, credential helper, Supabase CLI, HTTP, Auth,
request claims, role alteration, or provider is imported/called.

The only transport is `docker exec -i` into `supabase_db_wejammin_ev` and
`psql -X -q -At -v ON_ERROR_STOP=1 -v VERBOSITY=verbose -U postgres -d postgres -f -`.
No credential is read or emitted. Preflight requires `postgres` database/user,
the jobs relation, and the administrative session's existing `read committed`
isolation. It does not change the default or establish production RPC isolation.

## Actual SQL boundary and fixtures

Positive cases load the frozen
`tests/postgrest/support/phase-02-slice-12-dec194-probe-ownership.sqlinc` and split
its exact `DEC194_ACTIVATE` / `DEC194_CLEANUP` sections. Only generated strict
identifiers and captured numeric OIDs are substituted. Both transactions,
jobs `ACCESS EXCLUSIVE` lock, catalog guard, and explicit RESTRICT drops remain
unchanged. The source SHA-256 is emitted in the future run receipt.

Each scenario owns a fresh nonce schema, foreign-fixture schema, and bounded
trigger names. Private fixture tables `world`/`observations` are empty with RLS;
functions `bootstrap`, `facts`, `snapshot`, and `observe_job` match object types
only. The foreign fixture's `foreign_hook` returns NEW. These functions neither
write jobs nor invoke application RPCs. Privileges are revoked from public and
application roles on newly owned instrumentation only. No role is altered.

“Foreign” means foreign to the helper's acquired authority, **not foreign to the
harness**. Every such function/trigger is created by this diagnostic and tracked
by exact generated name/OID/binding. Harness mutations themselves recheck saved
catalogs under the same jobs DDL lock before changing a recorded fixture.

## Seven behavioral cases awaiting real PostgreSQL

| ID | Required observation |
| --- | --- |
| PGOWN001 | Actual activation returns real own trigger/function identity; unchanged acquired cleanup removes trigger/schema. |
| PGOWN002 | Actual zero-acquisition cleanup removes only fixture schema; jobs catalog and foreign fixture stay unchanged. |
| PGOWN003 | Harness preexisting same-name foreign hook makes actual activation refuse duplicate CREATE (`42710`); actual zero-acquisition cleanup preserves exact foreign trigger/binding/schema. |
| PGOWN004 | Empirically require CREATE OR REPLACE to retain trigger OID and change function OID; actual acquired cleanup refuses `P0001`/ownership marker and preserves full state. |
| PGOWN005 | Harness extra trigger depends on own observe function; actual cleanup fails RESTRICT (`2BP01`) after its first trigger drop, with both trigger OIDs/definitions and full fixture catalogs restored. Guarded extra-trigger teardown then unchanged actual cleanup succeeds. |
| PGOWN006 | A holds jobs DDL lock after uncommitted same-name foreign rebind. Capture A's actual post-rebind catalog inside A. Start unchanged B cleanup; before A COMMIT require B active/Lock, B ungranted jobs AccessExclusiveLock, A granted lock, and A in pg_blocking_pids(B). Commit/await A, then B must refuse ownership and preserve A's exact committed catalog. |
| PGOWN007 | Remove exactly one ownership-guard block from an in-memory copy of rendered actual cleanup. Against a harness-owned same-OID rebind, require mutant SQL to succeed/delete synthetic foreign trigger/schema and require the same preservation oracle to fail. Source unchanged, no CASCADE; this is a killed negative control, not positive helper proof. |

No sleep establishes ordering. Poll cadence only retries the actual lock/activity
predicate. B must remain incomplete before the observed barrier. The same-OID
premise and SQLSTATE expectations must be demonstrated, not presumed from source.
Unsupported/different real behavior fails the diagnostic; it is not relabeled PASS.

## Restoration, owned clients, and fail-closed recovery

Before fixtures, keep the full original jobs-trigger catalog in memory: complete
`pg_trigger` rows, definitions, function bindings, and each trigger's complete
`pg_depend` rows, sorted by OID. Also record
jobs count and SHA-256 of sorted full-row JSON text. Raw jobs never leave SQL;
only count/digest leave the database. Each successful case and final exit require
exact original trigger equality and identical jobs count/digest.

Fixture snapshots include namespaces, functions, relations, types, attributes,
constraints, and their recorded catalog dependencies. Expected trigger changes
are admitted only from actual acquired identity, immediately captured CREATE
result, or an explicit recorded removal. Unknown OID/binding/catalog changes
cannot be silently adopted during teardown.

Unique `PGAPPNAME` values identify owned child sessions. Every child close is
tracked immediately. SQL administrative limits: connect 5s, statement 15s,
lock 10s, idle-in-transaction 20s; drain has a 35s observation deadline.
Held clients receive ROLLBACK/end on failure. All owned child closes and absence
of owned `pg_stat_activity` rows must be observed before fixture teardown.
No unrelated backend cancellation/termination or force operation exists.
These limits do not modify production Worker deadlines, retry, or transport.

Teardown is a single psql transaction: acquire jobs DDL lock, recheck exact full
expected jobs catalog and saved schema catalogs, then explicitly drop only
manifest-owned triggers/functions/tables/schemas with RESTRICT. No CASCADE,
schema wildcard, reset, or broad cleanup. Unrecognized object/dependency/ownership
drift aborts the transaction and leaves residuals for root; no cleanup proceeds
while any owned client remains active. Restrict failures roll back earlier drops.

Before fixture DDL, a safe intent is synchronously written/fsynced to a private
`/tmp/wejammin-dec194-pg-ownership-*/fixture-manifest.jsonl`; committed OIDs,
function/table identities, trigger bindings, client application names, and local
PIDs follow immediately. Streaming CREATE identities are recorded even while a
held transaction is uncommitted; release intent (COMMIT/ROLLBACK/body completion)
and matching application-name close result distinguish its later outcome.
Its exact path is printed. Output contains synthetic
identifiers, case IDs, aggregate digests, safe SQLSTATE categories, and assertion
source locations, never raw baseline catalogs, job rows, secrets, or SQL errors.

On FAIL/residual: keep the durable manifest and root lock receipts. Inspect only
those exact generated objects and owned application names. If child drain or
catalog recheck cannot be proven, leave objects intact and escalate. Do not
terminate unrelated sessions or use CASCADE to make restoration appear green.

## Proof limits and next gate

Author produced code only. All seven predictions, mutation kill, real lock wait,
cleanup atomicity, SQLSTATEs, session drain, and restoration are **UNRUN**.
Root's prior 19-case mocked helper GREEN is not PostgreSQL evidence and is not
reused as acceptance here. This ownership-only fixture says nothing about actual
Worker/PostgREST request-derived claims, production RPC effects, DEC-194 isolation,
API startup, hosted behavior, or production acceptance. Those gates remain held.

Root next: independent static review; separately release/run this DB-only check
under all four locks; retain actual case output, manifest, original/restored
digests and template hash. Only an actual seven-case PASS with clean restoration
can support the bounded ownership claim. Real API/RPC startup still needs a
distinct review/release afterward.

## Split checkpoint and static receipts

Root's read-only Prettier preview reported runner 378 normalized lines (within
400), but original kit 627 (over the 300-line utility cap). The earlier physical
341-line count was insufficient. Root then claimed/released exactly three NEW
support modules plus existing kit/runner/report for the focused split. No limit
increase, minification, behavior change, fixture change, or case/oracle change.
Runner and SQL fixture bytes remain untouched during this split.

Source-text relocation comparison found all 17 moved SQL template literals
byte-identical before replacing the old kit. This is a text-preservation check,
not a parser/SQL/runtime check. Root then reported its read-only normalized
preview successful: entry 378 lines (cap 400), kit 200, process 221, catalog 138,
manifest 157 (each utility cap 300). No author formatter invoked. The split is
now frozen UNRUN; this preview proves formatting size only, not syntax/behavior.

Historical pre-split static receipt (old kit is superseded; not current proof):

Static file-byte receipt only; no semantic or syntax validation implied:

| Path suffix | Physical lines | SHA-256 |
| --- | ---: | --- |
| `probe-ownership.pg.mjs` | 228 | `01afc9d79aeb89480a4a9f64bbad6f87d6cc8ea0a716e09445abce0790d78aa0` |
| `probe-ownership-pg-kit.mjs` | 341 | `188b21e55e14ddd8f007d4e403f840f72372f349bd14c99da284688637f2a639` |
| `probe-ownership-pg-fixture.sqlinc` | 33 | `85a62a657b96e744851346950f985f78656d7bb6204860bd72334bd7a6f61318` |
| Frozen actual `probe-ownership.sqlinc` (read-only) | 46 | `33de400702d9616b893ef3213f20c9fbc1dca940405965478ce0897b1f6f484c` |

Current split byte receipt, before root's later mechanical formatting:

| Path suffix | Root normalized preview | SHA-256 |
| --- | ---: | --- |
| `probe-ownership.pg.mjs` (unchanged) | 378 | `01afc9d79aeb89480a4a9f64bbad6f87d6cc8ea0a716e09445abce0790d78aa0` |
| `probe-ownership-pg-kit.mjs` | 200 | `718c95e908fe561a8450ab80702cc0f50cf8925169e81a5cf259359aa58ff988` |
| `probe-ownership-pg-process.mjs` | 221 | `2af8d8ffd166cfefd305a14f078e2a4af099f22a29f5499fc22baf2ea13b26f3` |
| `probe-ownership-pg-catalog.mjs` | 138 | `65b4241178160858c31fb39d3216673fe7d17bb76ea91a8af8b51a551da76530` |
| `probe-ownership-pg-manifest.mjs` | 157 | `f3003d7e8e0ae7e32d534c8c07e2076aa136ee158de1ee48bf48f974d4c8dcb2` |

Static relative-import existence checks passed. All dependency leaves are Node
built-ins or these claimed support modules. No module was imported/executed to
obtain these receipts. Original SQL fixture and actual ownership templates retain
their preceding hashes. Root owns next full read, mechanical normalization/new
hashes, syntax-only `node --check` (not import), scoped lint, and a separate actual
four-lock DB-only release. All real DB behavior and API startup remain held.
