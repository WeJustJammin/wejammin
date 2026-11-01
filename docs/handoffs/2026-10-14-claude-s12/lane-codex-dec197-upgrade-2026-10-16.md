# DEC-197 upgrade witnesses — native author freeze

Author: native `gpt-6.1-sol`, reasoning `ultra`, 2026-10-16.
Worktree: `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`.
Status: **UNRUN test fragments and source-parity tests; NOT upgrade proof.**
No runtime, tests, parser, formatter, DB, Docker, network or Git commands run by
this author. No runner, production, config, existing fixture or applied migration
edited. Five exact files were claimed before release in S12 Dispatch.

## Governing boundary and inspected precedent

- [Root brief, lines 56–61](/home/rob/.codex/worktrees/phase2-slice12/WeJammin/docs/handoffs/2026-10-14-claude-s12/briefs/codex-dec197-receiving-contracts.md:56): actual forward migration over labelled historical orphan consumers; complete DDL rollback and unchanged existing rows/security. Fresh empty reset alone is insufficient.
- Existing [consumer migration](/home/rob/.codex/worktrees/phase2-slice12/WeJammin/supabase/migrations/20261010165000_cms_projection_consumer_state.sql:27) intentionally deferred `projection_id` FK. Publication IDs are real publication VERSION IDs, not lineage IDs. Its immutable source SHA-256 remains `e9bbd0f78fd8f6240fb4e3a543ad11e51081338abcf6cbba47679b5038bfc6ec`.
- Actual [176-line WIP migration](/home/rob/.codex/worktrees/phase2-slice12/WeJammin/supabase/migrations-wip/dec197/20261016030000_delivery_receiving_contracts.sql:1) has its own `begin;`/`commit;`; direct validated consumer FK is first at lines 169–171, composite FK second at 172–174. No backfill or `NOT VALID` accommodation.
- Verified real precedent: [taxonomy lineage parity](/home/rob/.codex/worktrees/phase2-slice12/WeJammin/tests/contracts/phase-02-slice-12-taxonomy-lineage-witness-parity.test.ts:21) selects promoted/WIP and compares a marked region; [populated lineage witness](/home/rob/.codex/worktrees/phase2-slice12/WeJammin/supabase/tests/phase_02_slice_12_taxonomy_definition/populated-lineage.sql:152) replays copied text in an exception subtransaction. That proves neither this migration's own transaction boundaries nor committed cross-session rollback. DEC-197 deliberately requires stronger full-byte parity and independent-session replay.
- [Verbose pgTAP runner](/home/rob/.codex/worktrees/phase2-slice12/WeJammin/infra/run-pgtap-verbose.mjs:44) mounts only `supabase/tests`; recursive discovery selects `.sql`, not these `.sqlinc` files. Copying the actual migration here makes it transportable without pretending WIP is inside that mount.
- Migration-management and contract-first TDD guidance shaped the actual-body copy, explicit fail-closed protocol and staged test-before-runner boundary. Author freeze does not waive root validation.

## Authored files and static choices

1. `supabase/tests/phase_02_slice_11_delivery_receiving/060-upgrade-world.sqlinc`
   requires a real pre-receiver schema, empty isolated consumer baseline, original
   validated publication FK, no projection FK, enabled forced RLS/policy/grant and
   enabled original CMS guard. It reuses the same guarded existing builders as
   `000-world.sqlinc`, but never imports that file's receiving-table inserts.
   Two real revision/review/publication producers are not exception-swallowed;
   returned publication VERSION IDs/hashes must resolve to real stored rows.
   Labelled consumer A/route and B/cache exercise distinct state/error/version/
   timestamp values and historical, intentionally unresolved projection UUIDs.
   Existing CMS write context is used; no guard disabling, dummy receiving parent,
   backfill or producer/history inference. Caller owns setup BEGIN/COMMIT and must
   fail on SQL or included fixture TAP failure before replay.
2. `supabase/tests/phase_02_slice_11_delivery_receiving/070-upgrade-snapshot.sqlinc`
   emits one versioned JSONB document. `observer` contains DB/PID/user; compare only
   `snapshot`. Capture every old consumer and publication-version row as ordered
   JSON TEXT, avoiding JS numeric bigint loss. Catalog inventory includes project
   namespaces; relations/owners/raw ACLs/RLS; ordered columns/defaults; validated
   FK columns/targets/actions and all constraints; indexes; identity/other sequence
   settings and text-valued counters; user/internal triggers; policies; routine
   definitions/owners/ACLs/security/configuration; implicit row types; default ACLs;
   non-secret role attributes/memberships. Explicit receiving table/type/guard/
   sequence names resolve to null pre-upgrade. Planner statistics, temp schemas
   and observer PID are excluded from comparable catalog state.
3. `supabase/tests/phase_02_slice_11_delivery_receiving/080-forward-migration.sqlinc`
   is the actual entire migration, including all comments, BEGIN, COMMIT and final
   LF. No wrapper, extraction marker or explanatory byte is added to this file.
4. `tests/contracts/phase-02-slice-11-delivery-receiving-witness-parity.test.ts`
   compares full Buffers. Promoted source wins only if WIP is absent or byte-equal;
   divergent dual sources refuse. WIP is fallback only when promoted is missing;
   neither source refuses, read errors propagate. It never normalizes whitespace,
   strips comments, extracts a region or mutates a disk fixture.
5. This report records the separately claimable runner contract below. No runner
   file or registration was authored in this claim.

Parity identities, all **UNRUN**: `DR-UP-P01` actual full-byte equality; P02/P03
promoted-only/WIP-only selection; P04 identical dual-source selection; P05/P06
body/newline dual-source divergence; P07 missing sources; P08 read failure;
P09–P17 body byte, missing BEGIN, missing COMMIT, header, explanation, extra LF,
missing final byte, CRLF, truncation mutations. Mutations call the same throwing
parity guard as P01; missing mutation targets fail arrangement rather than pass.

Static copy inspection: source and `080` are each 9,597 bytes / 176 lines,
SHA-256 `1117a83f72496887c6b36d100b7fa2635aa4673d699841932291967b1516f3b6`.
This source observation is not a Vitest pass or an executed migration receipt.

Authored executable-file freeze (static read only; all **UNRUN**):

| File suffix | Lines | SHA-256 |
| --- | ---: | --- |
| `060-upgrade-world.sqlinc` | 129 | `e1ef8092640104c91c587712f81fbb586b3b6f29deeb9f151ee94a1bd1685d9a` |
| `070-upgrade-snapshot.sqlinc` | 147 | `7909a26861a3cefbfd98a7f944061f2202377257abc1f0f055027f95b43bda32` |
| `080-forward-migration.sqlinc` | 176 | `1117a83f72496887c6b36d100b7fa2635aa4673d699841932291967b1516f3b6` |
| `phase-02-slice-11-delivery-receiving-witness-parity.test.ts` | 164 | `06247692904dc951b4f080e46d626e1bdbeb36534493b76551f5a79a2b99239f` |

## Runner contract proposal — later claimed tests, implementation still absent

Original proposed boundaries; later test claims are recorded below:

- `tests/contracts/phase-02-slice-11-delivery-receiving-upgrade-runner.test.ts`
  — test-first injectable runner/plan coverage, no DB at import or unit-test time.
- `infra/database-upgrades/delivery-receiving-upgrade-plan.mjs`
  — pure source/prefix/command/outcome/snapshot decisions; no top-level execution.
- `infra/run-delivery-receiving-upgrade.mjs`
  — guarded CLI and injected I/O orchestration of separate committed sessions.

Proposed API (implementation choices, not existing exports):

```ts
resolveMigrationSource({ repository, readOptional }):
  { path: string; bytes: Buffer; sha256: string };
buildUpgradePlan({ repository, targetMigration, mode, runId, prefixManifest,
  target, source, witness }): UpgradePlan;
buildPsqlInvocation({ target, applicationName, script, mode }):
  { command: string; args: readonly string[]; input: Buffer };
classifyMigrationOutcome({ mode, status, stdout, stderr }): MigrationOutcome;
compareRollback({ before, after }): void;
assertCommittedReceivingCatalog({ before, after }): void;
runReceivingUpgrade({ io, plan }): Promise<UpgradeReceipt>;
```

`readOptional` distinguishes ENOENT from all read errors. Plan binds full source,
copy and actual applied-prefix hashes before any DB call; dual-source divergence,
copy drift or target/later migration in the prefix fails closed. `mode` is the
closed negative/positive case set. Each script is a Buffer, not shell-expanded
SQL. Prefix manifest lists ordered actual migration paths/hashes and target
exclusion. Injected `io` owns processes, explicit ALT resets, snapshot parsing,
artifacts and cleanup; source-only imports launch nothing.

Runner test matrix required before implementation:

- strict promoted/WIP/missing/read-error/full-byte source and copy decisions;
  drift in header, body, BEGIN, COMMIT, terminal LF refuses before side effects;
- prefix sorted and complete through target predecessor; reject duplicate
  versions, target/later versions, missing file, changed hash or guessed baseline;
- exact sealed ALT descriptor/run IDs, no shell interpolation or broad reset;
  reject missing/foreign/default descriptors and bare `postgres` authority;
- independent negative/positive reset epochs on the same attested database/OID;
  setup COMMIT before fresh observer; observer PIDs differ across migration;
- negative migration's own BEGIN/COMMIT with continue-on-error mode, positive
  stop-on-error mode; reject `--single-transaction`, external BEGIN/ROLLBACK,
  exception-DO replay or body truncation;
- only first `23503` at `projection_consumer_state_projection_fk` plus subsequent
  aborted-transaction `25P02` and terminal `ROLLBACK` is expected refusal;
  exit 0 alone, any different first error/constraint, missing terminal tag,
  setup/TAP failure, connection/role failure or unexpected successful migration
  is failure, not controlled negative;
- ordered full rollback snapshot equality, absent receiving objects/sequence,
  both labelled historical rows still committed and exact; reject ANY altered
  row, policy, ACL, owner, guard definition/enabled state, sequence, index or FK;
- positive requires exit 0, terminal COMMIT and independent committed catalog:
  real receiving tables/identity sequence/guard/indexes/checks and both validated
  ordered consumer FKs; preserve pre-existing consumer columns, rows, old FK,
  RLS/policy/CMS grant/guard exactly, while permitting only intended new objects;
- test absent/premature BEGIN/COMMIT mutations at the outcome/poststate seam:
  partial DDL must fail negative; session-close rollback must fail positive;
- cleanup/restore on success, expected refusal, setup/replay/observer failure,
  timeout and signal; original failure survives secondary cleanup failure;
  no final green receipt until verified cleanup and ordinary baseline restored.

## Runtime protocol status — disposable proposal superseded

The original disposable-database/clone proposal below is historical, unimplemented
unit-contract planning, NOT runtime authority. Root inspected ALT configuration
and selected the safer explicit resettable ALT `postgres` target instead. No
CREATE/DROP of `postgres`, generic `postgres` allowance, fake owned-DB receipt or
clone fallback is authorized. Runtime/CLI/configuration remain unreleased.

Retained requirements: independently verified real promoted prefix before EACH
negative/positive case; committed legitimate historical consumers; fresh setup,
migration and observer sessions; exact whole-file replay with its own transaction;
narrow direct-FK `23503`/later `25P02`/terminal ROLLBACK negative; COMMIT plus
complete observed catalog positive; exact old row/security preservation; final
independently verified baseline reset. Existing CI/TAP discovery is not upgrade
proof. Root owns locks, actual target/reset verification and normal gate wiring.

Retarget now follows the fully read root-owned `codex-dec197-upgrade-alt-reset.md`.
Its exact read-only `-c` session marker followed by `-f -` precedes replay;
migration stdin remains byte-exact, without extra SQL or an outer transaction.
Mock IO cannot establish any actual target, prefix, session or reset fact.

## Original five-file witness freeze

Only five claimed test/report paths authored. All executable verification remains
UNRUN. Parent owns focused parity/type/lint checks, runner-test RED, runner GREEN,
actual isolated negative/positive transaction proof and independent review. These
fragments do not close DEC-197, Slice 11, Slice 12 or any hosted acceptance gate.

## Runner test-only continuation — 2026-10-16

Native author remains `gpt-6.1-sol` / `ultra`. Root separately reports the frozen
source-parity suite **17 PASS**; that is root's result, not author execution or
upgrade proof. The five original witness files remain untouched in this new
claim except this owned report. Root claimed runner tests, then additionally
claimed the pure-plan suite/shared fixtures and finally two snapshot-only splits
before their author release. Five new TypeScript paths in this continuation:

- `tests/contracts/phase-02-slice-11-delivery-receiving-upgrade-runner.test.ts`
- `tests/contracts/phase-02-slice-11-delivery-receiving-upgrade-plan.test.ts`
- `tests/contracts/phase-02-slice-11-delivery-receiving-upgrade-fixtures.ts`
- `tests/contracts/phase-02-slice-11-delivery-receiving-upgrade-snapshot.test.ts`
- `tests/contracts/phase-02-slice-11-delivery-receiving-upgrade-snapshot-fixtures.ts`

The shared IO fixture takes snapshot documents as data, avoiding fixture-module
cycles. Source/prefix/outcome, snapshot semantics and runner ordering remain in
separate bounded suites. These helpers contain representative unit data, not a
replacement migration or purported actual catalog dump.
No implementation module, CLI, package/config or DB driver is authored here.

Case-local dynamic imports target the two proposed implementation modules.
`DR-UR-A01` is the single explicit seven-export availability check. When modules
are absent, behavioral cases skip with the availability error: the expected
initial RED is **availability-only**, not a behavioral regression, attempted
migration or genuine DDL proof. Node child-process entry points are blocked in
the unit fixtures; injected IO is the only runner boundary used by these cases.
Module collection never imports the absent implementation or a DB adapter.

The seven API names remain the proposal above. Tests make these inputs concrete:

- `buildUpgradePlan` also receives resolved `source` `{path, bytes, sha256}`, full
  `witness` Buffer, and `prefixManifest` `{expectedPaths, entries}`. Each entry has
  `{path, bytes, sha256}`; absent bytes are invalid. The manifest must match its
  complete ordered expected-path inventory, contain only real pre-target versions,
  and have correct per-file hashes. Unit defaults read the local actual migration
  inventory/bytes only when an available-implementation case runs. This does NOT
  establish what a DB has applied: the real CLI must independently discover and
  verify the actual prefix under locks; self-supplied manifest agreement is not
  a database-prefix receipt.
- Plan includes `applicationName`, source/copy/prefix SHA-256 and complete sealed
  `target`. Both modes use the same explicit ALT descriptor; copied target/locks
  are deeply frozen and byte inputs copied. Forged source/target/mode/app plans
  refuse before any IO. ASCII filename-sorted digest records are UTF8
  `<filename>\t<sha256(actual bytes)>\n`, independently rebuilt by the adapter.
- `buildPsqlInvocation` receives the complete script Buffer and returns Docker
  command/argument vector/input. No shell or outer transaction. Negative uses
  continue-on-error; positive stop-on-error; verbose SQLSTATE/constraint details
  are required. Returned input owns its bytes rather than aliasing caller memory.
- `classifyMigrationOutcome` receives mode/status/stdout/stderr and parses the
  actual migration marker into `session`, alongside `expected`, `firstSqlstate`,
  `constraint`, `transactionTag`. No caller-supplied PID authenticates a backend. Negative
  needs status zero, first `23503` at the direct FK, only later `25P02`, final
  ROLLBACK; positive needs zero/no SQL error/final COMMIT. Misleading DETAIL text,
  wrong constraints, setup/connection/unrelated errors and exit zero alone fail.
- Snapshot methods consume exact `070` `{witness, observer, snapshot}` documents.
  Only observer PID may differ without invalidating rollback equality; DB/user,
  witness version, full row-text and every catalog/security section matter.
  Positive accepts intended new catalog entries but preserves all old images and
  requires committed receiving objects, columns/identity/checks/indexes/types,
  validated ordered direct/composite FKs, sequence, forced RLS and invoker guard.
  Representative unit catalog data is NOT a captured DB catalog or SQL receipt.

Injected Promise IO is `preparePrefix(plan)`, `resetBefore(plan, attestation)`,
`setupWorld(plan, reset)`, `observe(phase, plan, reset)`,
`executeMigration(invocation, plan, reset)`, `restoreBaseline(plan, attestation)`,
then `writeReceipt(receipt)`. Attestation carries complete target, observed containerId, clusterId,
databaseOid/owner, both digests and lease `{ownerPid, locks}`; raw lock records are
`{ownerPid,path,fd,dev,inode,mode}`. Mock records do NOT prove a real lease.
Reset returns verified prefix digest/fresh resetEpoch; setup/observer/execution
envelopes bind target/containerId/clusterId/databaseOid/epoch. Observer wraps exact070 `document`.
Restoration verifies ordinary baselineSha256 and a different epoch; baseline may
include the promoted target and must not be equated with predecessor prefix.
Preflight failure authorizes no reset/restoration. Every attempted validated reset,
even one throwing ambiguously, requires restoration. Original failure identity
survives secondary restoration failure. No receipt passes failed restoration or
receipt write. There is no create/drop operation or `databaseDropped` field.
Injected timeout/signal tests prove cleanup decisions, not real process handling.

`DR-UR-S*` covers source selection/read failure; `P*` byte binding, copy/prefix and
ownership rejection; `I*` invocation transport; `O*` outcome classification;
`R*` exact rollback and lossless bigint row-text mutations; `C*` committed catalog
and old security preservation; `X*` orchestration, sessions, labels, expected
negative/positive, reset authority, timeout/signal and cleanup failures. `A01` alone is
initial availability RED. All new author tests remain **UNRUN**. Root owns actual
RED/GREEN, formatting/line limits, type/lint, independent review and the separately
authorized real ALT-reset/transaction protocol. Mock IO cannot prove actual
database isolation, transaction boundaries, applied prefix or genuine DDL rollback.

### Runner author freeze — all UNRUN

Suffixes below share `tests/contracts/phase-02-slice-11-delivery-receiving-upgrade-`.
Line counts are static author bytes, not a formatter/runtime receipt. Root owns
normal formatting and the under-400 formatted-file gate before actual unit RED.

| Suffix | Lines | SHA-256 |
| --- | ---: | --- |
| `fixtures.ts` | 198 | `dd5367d59d0792095ed6750e0d60b7aaa940bad2c3184541029a0b0eb950033e` |
| `plan.test.ts` | 172 | `310665dc008757901f2dd6a919eed9f0b18f9eed0bb0cac7e21ada05d54fbcc0` |
| `runner.test.ts` | 186 | `2e35c925a06165bc25156851320e903922b239940906283ee1047187f5e06a31` |
| `snapshot-fixtures.ts` | 131 | `9bd53657f2e13aea34388850ea7058a1f3301dfed24697ab95c34bd05a62ddc0` |
| `snapshot.test.ts` | 90 | `4000a05d853e52a75e5e70018d1b2ffa7cc79f9d90ef76c97181f9c4483c59eb` |

No implementation exports exist by this author's release. Expected initial RED
is availability-only; behavioral skips are not passing behavior or DDL evidence.

### Import-only correction after invalid root attempt

Root's first three-suite run was **INVALID baseline**, not valid availability RED:
87 collected tests, 0 PASS, 1 availability failure, 86 SKIP, plus snapshot-suite
collection `ReferenceError: directFk is not defined`. Receipt:
`/tmp/wejammin-native-receiving-proto-red-BkaHbW/upgrade-runner-availability-red.json`,
SHA-256 `a64dc2788c5a7023c081076ec419cbb4e85d224048170bfc42904478b6bd97b2`.
These are root-reported results, not author execution. The snapshot fixture used
both FK constants without importing them after the test-only split.

Root claimed exactly this report and `snapshot-fixtures.ts` for correction before
release. Added imports of the already-exported `directFk` and `compositeFk` only;
all expected images and assertions preserved. No implementation or other file
edited. Correction remains **UNRUN** by native `gpt-6.1-sol` / `ultra`; root must
rerun a clean availability baseline. Initial invalid receipt is not behavioral
RED, DDL evidence or permission to implement from a passing regression claim.

Corrected snapshot fixture freeze: 131 lines, SHA-256
`9a0aad8b5e1160c392050715c4275d0ddd72d66c5db36ec7b23b60fcf456914a` (static read only).

### Clean root availability RED and test-size-only split

Root subsequently reports a clean **availability-only RED**: 152 tests,
1 expected availability failure, 151 SKIP, no collection errors. Receipt:
`/tmp/wejammin-native-receiving-proto-red-BkaHbW/upgrade-runner-clean-availability-red.json`,
SHA-256 `ab17456ccfff3a40934dd591877553d76d936352d7a115d0391b6bc4fefa4579`.
This replaces the invalid collection attempt as the availability baseline, not as
behavioral/DDL evidence. All implementation methods remain unavailable.

Root's formatter PREVIEW ONLY projected fixture/plan/runner/snapshot-fixture/
snapshot-test line counts of 299/441/335/401/279. Before this release root claimed
the additional exact new `tests/contracts/phase-02-slice-11-delivery-receiving-upgrade-outcome.test.ts`.
Moved the exact `DR-UR-O01/O02/O03` registration bodies/matrix unchanged from the
plan suite into that outcome suite; `apiCase` still imports implementation only
inside cases. Only now-unused plan imports moved with those cases. Removed two
blank lines only from the snapshot fixture, targeting a 399-line formatted file.
All 152 identities, values, images and assertions are preserved; root must verify
actual formatted bounds and rerun four suites. No implementation, runtime,
formatter, DB, configuration or other test-semantic edits by this author.
Native `gpt-6.1-sol` / `ultra`; this size-only refactor remains **UNRUN**.

Static post-refactor freeze (preformat); moved outcome-body bytes compared equal:

| Upgrade suffix | Lines | SHA-256 |
| --- | ---: | --- |
| `plan.test.ts` | 137 | `1831ad88d274def12dde9f89e1cc474dce05144f0a773eed8abee6ff9f96a3da` |
| `outcome.test.ts` | 44 | `a1f5593062e2b6becd0458ebaf1ea80deeee4bd6aa07082c152e1238e4237e93` |
| `snapshot-fixtures.ts` | 129 | `579546e70765ebaac794c6ca50a13aa9a99085e8dbbef848254c0660f1cfe660` |

### Independent BLOCK-2 correction and explicit ALT-reset retarget

Read review agent `/root/review_web_polish_a_61_20261016` final directly. Its two
P1 findings are valid: undefined CHECK definitions/no-op guard positive control,
and unordered/unbound effective invocation. Root reports formatted availability
baseline 152 tests / 1 expected availability FAIL / 151 SKIP, lint 0, receipt SHA
`0be2832704ae22c3f4a60c571a413190202e218cb649046d4e9df4aa004cd1c5`.

New `catalog-fixtures.ts`, `catalog-security-fixtures.ts`, `catalog.test.ts` carry
full new 070-shaped column/default/CHECK/PK/unique/index/sequence/function/trigger
semantics, including index/sequence attributes, implicit array types and RI
triggers on old relations. Guard body statically equals target source, SHA
`202ad25c8213513b893cfd9d979b314c5dca4069c10ac6ec6d362e641e408866`;
whole source/copy still equal SHA `1117a83f72496887c6b36d100b7fa2635aa4673d699841932291967b1516f3b6`.
`before()` raw images/ACLs/rows are unchanged. K01/K02 mutations discriminate
tautological/missing checks, disabled/no-op guard, invalid/missing keys, index and
sequence weakening, extra receiving policies and API table/sequence/function
grants. These source-derived semantic images are NOT captured catalog evidence.

Mock entry is recorded before argument validation, preventing assertions from
disguising an IO call as pre-IO refusal. Both I01 and actual mocked execution assert
the COMPLETE ordered literal invocation: docker/exec/PGAPPNAME/exact ALT/psql/-X/
postgres/ON_ERROR_STOP/verbose/-A/-t/-c/exact SESSION_SQL/-f/-; full unchanged stdin.
No shell, arbitrary target/extra command, quiet flag or outer transaction fits.
Database/application identifiers are bounded to63UTF8bytes, including multibyte
63/64-byte controls. T01/T02/T03 add descriptor, epoch, restoration and independently
parsed marker controls; all relevant earlier S/P/I/O/R/C/X properties remain.
Obsolete clone/owned-name cases are retargeted, not runtime clone proof.

NEW approved `target-fixtures.ts` centralizes shared DTOs/literals with registry's
separate local-adapter test author. Exact fourth lock is `/tmp/wejammin-reset.lock`,
NOT the summary-derived spelling. Local raw-FD/proc/ancestor/lease and independent
inventory/applied-history proof remain registry/root responsibilities, never mock
booleans. Root's read-only formatter preview reports all ten TS files below400
formatted lines; latest preview outcome371/runner358/catalog297 (pre final small
catalog additions). No author formatter ran. Root next owns format, actual new
availability baseline/lint and independent review before implementation release.
All corrections remain author **UNRUN**, native `gpt-6.1-sol` / `ultra`; no genuine
DDL, committed visibility, real PID/reset, actual isolation or acceptance claim.
Final four-path DTO claim adds actual first-preflight `containerId`, never Plan
input authority. X01 accepts a consistently different initial ID; X07/X08/X09/X11
reject missing/replaced IDs independently of cluster/OID, through restoration.
Registry local tests must prove actual pre-side-effect pin rechecks and refusal to
reset a replacement container; mock output rejection is not that runtime proof.

### Corrected author freeze — static bytes, all UNRUN

Suffixes share `tests/contracts/phase-02-slice-11-delivery-receiving-upgrade-`.
Author-freeze hashes precede later root normalization; catalog rows refreshed below.
Root normalized ten TS files before the targeted container-ID amendment.

| Suffix | Lines | SHA-256 |
| --- | ---: | --- |
| `fixtures.ts` | 352 | `82cfdda4c048f914dfe59eb5884c8cf65c46705e39ef1758fcaea746e202ab2d` |
| `plan.test.ts` | 335 | `df86831d4b3259cc3b40ba73fab1d26575c5bed2159fcb802b701b3d52003845` |
| `runner.test.ts` | 372 | `36284b1fe2dc4f57f251f8e52858400b80001a6990cadaaea3893cd9731b3574` |
| `snapshot-fixtures.ts` | 180 | `3bc831beb039ea034bbf2d2adffe3a99a0beabeb5fe96c631ff90fe6b8da3f61` |
| `snapshot.test.ts` | 278 | `8207e164841a2214515bcd6d0676fa5abdd3e0eb30c0ef727658e5252a6b9fe2` |
| `outcome.test.ts` | 371 | `6757c85541fffaf4b0dac7bacea693aec8321a89f8b0111b80c1069dcc1405ff` |
| `catalog-fixtures.ts` | 294 | `95197de593733e179c32148779ac82e5aaec770beb0ee11f1016f967db5aff3c` |
| `catalog-security-fixtures.ts` | 241 | `3f5b507cc5abfb75d49ac5935422218bb51292d53d2f2de3e1e213a1addb9ab5` |
| `catalog.test.ts` | 306 | `942e7f0e7c929ff742cc186ca87e90382389e4357c07e26f99c33f589f367b66` |
| `target-fixtures.ts` | 156 | `3c8b0c0e1c701b5533d3f4989ad3e366c0166c160fa3f6c481e1f146585f36f4` |

Static readback confirms exact336-byte SESSION_SQL parity with root brief, exact
guard-body parity and full176-line source/080 equality. These are text comparisons,
not parser/type/test/DB results. This three-path correction freezes only the two
catalog builders and this report; all other paths remain untouched and frozen.

PG17 spelling correction (native author UNRUN): root's read-only observation
under all four canonical locks confirms owner-table `arwdDxtm` and unqualified
`EXECUTE FUNCTION "RI_FKey_*"()`. Only the two positive-builder literals changed;
all301 test identities and negative controls remain intact. No schema replay:
`/tmp/wejammin-native-receiving-proto-red-BkaHbW/dec197-pg17-catalog-spellings.log`
SHA-256 `f1ed0d4ce0529780a3001e2b8ee6a334c27b8c7af57e6cd7763900182950c566`.
Root owns formatting, actual301-case rerun/lint and independent readback.

### Current six-path test-only freeze — native gpt-6.1-sol / ultra

Root reports the first301-case attempt consumed4m13 without a JSON receipt and
was interrupted with owned processes cleaned; X01-only timed out after40s
(status124), while pure module imports took18ms. Root measured native Vitest
deep equality of a copied1MB Buffer at2919ms; the actual prefix has460 files,
6.428MB. These observations explain the fixture-comparison change; they are
neither a passing test receipt nor genuine DDL/rollback proof.

The main fixture retains its API reexports. Types and source builders move
unchanged into separate leaf modules; the plan assertion uses Buffer.equals
for every source, witness and prefix byte, while recursively checking complete
own keys and primitive metadata. It does not substitute hashes for bytes.
All original301 case identities, IO-entry-before-validation checks and complete
argv assertions remain in place. No production or other existing TS path changed.

New `DR-UR-N01` controls retain eight complete070-shaped catalog neighbors:
public receiving-name tables/type/sequence/routine, relation-local CHECK/trigger
names on unrelated OIDs, and private publication_projection_cache. `N02` keeps
the cache through exact rollback; `N03` still rejects changed neighbor ACL or
trigger history. `DR-UR-B01/B02` verify copied-plan equality and byte/metadata/
extra-key/missing-key mutation sensitivity. Thirteen new registrations are
authored; root must establish the actual total and meaningful catalog RED.

Source-backed boundaries: catalog.mjs noPreexisting52–58/calls97–110 and
catalog-contract.mjs named264–270 currently key names without namespace or
relation identity; catalog-constraints.mjs142–214 and catalog-security.mjs206–230
also resolve names. Snapshot.mjs124–151 treats the private receiving-name prefix
as owned. These are observations of the frozen implementation, not author fixes.
The new unchanged-neighbor controls require actual RED before catalog changes.

Current author byte manifest (suffix prefix as above; LF-count lines):

| Suffix | Lines | Bytes | SHA-256 |
| --- | ---: | ---: | --- |
| `fixtures.ts` | 251 | 8037 | `5ae68cc9d6d28cb63f3f573167433c876aaa7dd4a1e4e19fbd6be07c729b4242` |
| `types.ts` | 67 | 1855 | `86ea3fd739d5ec4176821ba7977cb59da2fefd1b86bd6753b78493c2d256f498` |
| `source-fixtures.ts` | 50 | 1950 | `9c6e5705880da227e450c9f0b747a502a55b38391a93fcc45bf8965c6876cc6d` |
| `plan-assertions.ts` | 38 | 1712 | `9082794d7ce76bce2cfdffd19c50fade28739a829516b7d495988d5495412718` |
| `catalog-neighbors.test.ts` | 195 | 9600 | `ba26d5d75fd56c8885718d597d4ee618ed9a44b965aa9524d7c2af124e3af87e` |

Root's read-only normalization preview:276/67/54/49/352 lines respectively,
all within utility300/test400 limits. Author used static reads/text comparisons
only: moved type/constants/input bodies match their original bytes. No author
parser, formatter, tests, process, DB, Docker, network or Git execution. All six
claimed paths now frozen UNRUN. Production exists but remains frozen; no current
main GREEN is claimed. Root owns normalization, new-neighbor RED, original five
plus new sixth-module execution, scoped lint and independent review.
