# DEC-197 local upgrade proof: explicit ALT reset target

Implementation protocol, not a new product decision or acceptance waiver.
Native `gpt-6.1-sol` / `ultra`. Actual execution remains UNRUN.

## Owner-approved amendment — 2026-10-16

Read `codex-dec197-upgrade-reset-identity-renewal.md` before implementation. Actual normal CLI reset recreates container/cluster identity. The human explicitly approved verified reset-only renewal while retaining fail-closed rejection of every unexpected identity change. This narrowly supersedes physical continuity across the runner's own verified reset in the initial protocol below; all target/source/lock/epoch/rollback/commit/restoration gates remain. No native upgrade acceptance or new default/remote/clone authority follows from this approval.

## Why this replaces the unimplemented clone proposal

Root read-only diagnostics found PostgreSQL17.6, database `postgres` OID5,
owner `postgres`, active client count0, nondefault database ACL and one database
configuration row. A key-only query found `app.settings.jwt_exp` and
`app.settings.jwt_secret`. No values were read. PostgreSQL physical cloning does
not copy database settings/ACLs. Omitting them would not prove source-environment
equivalence; reading/copying secrets is not authorized. A genuine reset/replay on
the already-authorized ALT avoids clone provisioning, ACL reconstruction and DROP.

## Sealed target, never a generic postgres exception

The plan accepts only this exact explicit target descriptor, with no defaults:

```text
kind: wejammin-alt-reset-v1
projectId: wejammin_ev
workdir: /home/rob/.codex/worktrees/phase2-slice10/orchestration/altdb
container: supabase_db_wejammin_ev
database: postgres
dbPort: 55322
apiPort: 55321
locks, in order:
  /tmp/wejammin-supabase-ci.lock exclusive
  /tmp/wejammin-quiet.lock shared
  /tmp/wejammin-altdb.lock exclusive
  /tmp/wejammin-reset.lock exclusive
```

The pure constructor copies/freezes and validates the complete descriptor; no
caller-supplied bare database/container string grants reset authority. Actual
adapter attests real config/project/ports/container/cluster identity/database
OID/owner and root-owned four-lock lease before any reset. It refuses stale,
missing, default, foreign or mismatched targets/leases. Root releases actual
runtime separately. No primary checkout/default stack/hosted endpoint fallback.

The fourth lock spelling above matches the actual staged runner, not the earlier
summary-derived `wejammin-supabase-reset.lock`. Root's two metadata-only queries
held canonical CI/quiet/ALT plus that incorrectly named extra lock; they did not
reset or mutate the database and are not full four-lock execution receipts.

## Seven APIs, revised resource lifecycle

Keep the proposed seven names: `resolveMigrationSource`, `buildUpgradePlan`,
`buildPsqlInvocation`, `classifyMigrationOutcome`, `compareRollback`,
`assertCommittedReceivingCatalog`, `runReceivingUpgrade`.

Plans retain immutable complete source/copy/prefix-byte binding. The independent
adapter rebuilds actual repository inventory and applied migration history;
agreement between two caller-provided arrays is not completeness evidence.

IO order is `preparePrefix` (read-only target/lock/inventory attestation),
`resetBefore`, `setupWorld`, `observe(before)`, `executeMigration`,
`observe(after)`, `restoreBaseline`, `writeReceipt`.

Preflight/attestation failure never authorizes reset or restoration. Once a
validated reset is attempted, final restoration is mandatory, including an
ambiguous reset failure. ResetBefore returns an independently verified prefix
digest and fresh reset epoch. Setup/observer/execution envelopes bind the same
target/epoch. Final restore returns a different reset epoch and independently
verified ordinary promoted baseline. No passing receipt on restoration failure.
There are no createDatabase/dropDatabase steps or databaseDropped receipts.

The target-predecessor prefix digest and current ordinary promoted-baseline
digest are distinct: after promotion the latter includes the target migration.
Preflight independently binds both; resetBefore verifies prefixSha256, whereas
restoreBaseline verifies baselineSha256. Never invent equality between them.

Negative and positive run on the SAME explicitly attested database/OID, with
independent real prefix resets. Receipts distinguish reset epochs, not invented
independent databases. Each setup/before/migration/after client has a distinct PID.
Do not demand raw local OID equality across resets; negative before/after within
one epoch must retain exact raw 070 snapshots, including OIDs, ACLs and row text.

Negative setup commits the real guarded 060 historical consumer world, validates
all TAP, then proves committed visibility from another client. Positive starts
from a separate verified prefix reset and an explicitly empty consumer world,
never deleting the negative fixture to fake emptiness. Full unchanged 080 bytes
execute in a fresh client; its own BEGIN/COMMIT are the only migration wrapper.
Negative: first exact direct-FK23503, only subsequent25P02, terminal ROLLBACK and
exact fresh-observer equality. Positive: real COMMIT and full receiving semantics.

## Exact psql invocation

The command is `docker`; argv is exactly:

```text
exec -i -e PGAPPNAME=<applicationName> <container>
psql -X -U postgres -d postgres
-v ON_ERROR_STOP=<0 negative|1 positive> -v VERBOSITY=verbose
-A -t -c <SESSION_SQL> -f -
```

`SESSION_SQL` is the following exact read-only command, with no outer transaction:

```sql
select pg_catalog.jsonb_build_object('witness','DEC197_MIGRATION_SESSION_V1','database',pg_catalog.current_database(),'databaseOid',(select oid::text from pg_catalog.pg_database where datname=pg_catalog.current_database()),'backendPid',pg_catalog.pg_backend_pid(),'applicationName',pg_catalog.current_setting('application_name'))::text;
```

Stdin is the byte-identical complete migration, with no prefix/suffix. `-c` then
`-f -` run in one client; the SELECT independently identifies that actual backend
without changing migration bytes. Do not use `-q`, a shell, arbitrary extra
commands/targets, `-1`, `--single-transaction` or injected metadata. Command tags
must remain observable. Database/application identifiers stay within63UTF8bytes.
Runner mocks record IO entry before validating the complete literal invocation.

## Remaining gates

Unit mocks prove decisions only. Complete catalog semantics and strict command
binding corrections remain required. Local prefix/session adapter tests precede
their implementation. No package/CI registration, clone, DROP, reset, service
startup or real replay is authorized by authoring this brief. Root separately
reviews/releases runtime and preserves the canonical DB→validate gate order.
