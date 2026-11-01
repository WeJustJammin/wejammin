# DEC-197 injected local adapters — GREEN author handoff

Native author: `gpt-6.1-sol` / `ultra`. Date: 2026-10-16.
Author status: **UNRUN**. This is implementation-source delivery, not a passing
unit, real reset, upgrade, PostgreSQL atomicity or acceptance receipt.

## Authority and inputs

Worktree: `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`.
Protected primary `/home/rob/Projects/WeJammin` remained read-only.
Exact nine-path implementation claim is recorded immediately before Acceptance
Criteria in `.memory/pipeline/progress/slices/phase-02-slice-12.md`, heading
`DEC-197 injected local prefix/session adapters GREEN` (2711–2713 at author read).
No test, source migration, main pure API, runner, spec or other WIP was edited.
README changes are append-only. All writes used absolute `apply_patch`.

Read source inputs directly: the complete ALT-reset protocol brief, all six frozen
local test/support files, shared target DTO, existing pure target/plan/outcome
contracts and directory README. The actual 15-file 060/065/070/JWT include closure
was inspected statically: no unexpected standalone metacommands were found.
Normative implementation protocol:
`briefs/codex-dec197-upgrade-alt-reset.md` :16–45 (authority), :47–86 (lifecycle and
independent sessions), :88–109 (literal transport), :112–118 (remaining gates).

Root release reports a corrected 86-case RED: four raw-boundary controls PASS,
82 expected missing-module failures, zero skipped cases/collection errors; all
original 79 identities plus seven additions retained, caps and scoped lint clean.
Root also reports independent final test review CLEAR for all three earlier gaps.
Those are root-provided observations, not author-executed results. This author
did not run any test, formatter, parser, CLI, DB, Docker, network or Git command.

## Delivered API and direction

- `createLocalPrefixAdapter({ fs, process, clock, lease })` exports
  `preparePrefix(plan)`, `resetBefore(plan, attestation)`, and
  `restoreBaseline(plan, attestation)`.
- `createLocalSessionAdapter(same)` exports `setupWorld(plan, reset)`,
  `observe(phase, plan, reset)`, `executeMigration(invocation, plan, reset)`, and
  an explicit owned-client `cancel(error)` method.
- Five focused helpers cover target, inventory, staging, child/lease lifetime and
  observer/fixture parsing. No helper imports a test, runner or native I/O module.
  Dependency DAG: prefix/session → focused helpers; staging/observer → inventory;
  inventory → target → child → pure target contract.

`fs`, `process`, `clock` and the raw four-lock lease are mandatory explicit ports.
Pure built-ins are limited to Buffer, path and crypto. No default host filesystem,
process, environment, network, CLI registration or import-time I/O was added.
This provides no executable real-host binding by itself.

## Safety and evidence boundaries

Preflight independently rebuilds sorted actual regular SQL files, detects bad or
duplicate versions/symlinks, binds every caller entry to actual bytes and rejects
matched omissions. It checks both promoted/WIP target copies when present and the
complete unchanged 080 witness, ALT config, tests/seed links and seed bytes.
Manifest encoding is `<filename>\t<sha256(actual bytes)>\n`; predecessor prefix and
ordinary promoted baseline remain separate, including after target promotion.
Applied history is queried independently as exact ordered version/name pairs; no
database-stored content-hash proof is invented. Staging supplies the byte binding.

Target proof requires the exact sealed ALT descriptor and config project/ports,
explicit narrow Docker identity/port probe, cluster/database OID/owner and actual
ancestor-held inherited FD locks. For each canonical lock, current file and both
owner/current FD dev/inode must match; fdinfo must expose the appropriate FLOCK
READ/WRITE open-file-description lock also present in `/proc/locks`. Display
ordinals are not identity. Closed/replaced FD, replaced path, missing OFD lock,
wrong mode/ancestor or replacement container refuses before mutation.
Initial container identity is observed, not hardcoded. Identity and nonsecret
metadata are privately pinned and rechecked across mutation/session boundaries.
Probes read database ACL/configuration row count/key names only; no GUC values,
Docker environment, Auth/provider credentials, identities or services are read.

Stages use owned temporary directories, exact regular copied bytes/hashes and
explicit per-file verification before reset. Link swaps use a temporary symlink
on the ALT link's filesystem and atomic rename, retaining the original raw target.
Cleanup verifies dev/inode/content ownership and uses only explicit unlink/rmdir.
Unknown contents are preserved and reported as failure, not recursively removed.
After a validated reset phase begins, ordinary-baseline restoration is required
even after an ambiguous thrown reset; original primary errors are preserved.
Restoration independently verifies history/staged bytes and returns a different
epoch. A foreign replacement is never reset to make restoration appear successful;
lost authority or unknown cleanup contents refuse a passing restoration receipt.

Setup expands only confined regular fixture files, rejecting traversal, symlinks
and cycles. It holds the same client open after BEGIN/fixture/finish, validates
complete sequential TAP with exactly one positive plan and no failure/SKIP/TODO,
validates the world/session witness, then rechecks authority before sending COMMIT.
Positive uses 065 on a separately reset empty world, not deletion of negative rows.
Fresh before/after observers run full 070 inside read-only transactions and retain
bigint/JSON row strings. Actual marker PIDs, not OS child PIDs or caller metadata,
must be distinct across setup/before/migration/after within a session adapter.

Migration input is copied and compared against complete 080 bytes and literal argv
before client admission; no wrapper, SAVEPOINT, extra SQL or transaction option is
added. Raw child status/stdout/stderr are returned intact. Controlled 23503/25P02
classification remains the separate pure classifier's obligation; unrelated error
codes and nonzero exits are never manufactured into successful refusal here.
The child seam handles stream errors, timeout and cancellation by signalling only
owned children and awaiting actual close plus pending owned validation work.
Exit alone does not authorize cleanup or settlement; cancellation closes admission.

## Source-only verification and remaining gates

TDD and minimal-surgical-development guidance kept implementation restricted to
the released seams and frozen discriminating tests. Verification-before-completion
requires the explicit UNRUN status: author source inspection is not runtime proof.
Root requested normal-format previews before final freeze; preview results and
final manifest are recorded below after root readback, not inferred from raw lines.

Root formatter-only second preview reports status0 for every module: prefix194,
session251, target243, inventory214, staging195, child249 and observer233 normalized
lines, all below300. The original target preview329 was corrected by extracting
the process/FD lease attestor into child; dependency direction remains acyclic.
This author did not run that formatter or mutate sources with formatting.

Pre-format author-freeze source manifest (root formatting will change these
hashes; preserve this as the delivery image, not a later runtime receipt):

| Path under `infra/database-upgrades/` | Bytes | SHA-256 |
| --- | ---: | --- |
| `delivery-receiving-upgrade-local-prefix.mjs` | 5222 | `22e131adcb425e3aff97f42370d484984e0ac0b6d6553cd69928c934ad020158` |
| `delivery-receiving-upgrade-local-session.mjs` | 6610 | `9ac8a77117faf3ac4ebf3b4e4b8946b1c5aa68932301837747abd0bc3be9e8dc` |
| `delivery-receiving-upgrade-local-target.mjs` | 7465 | `dbf386ae048cceaa56acf00d0bb88fb69a3b60c52e669ff1e2e32de4d9416c2d` |
| `delivery-receiving-upgrade-local-inventory.mjs` | 6058 | `31fb938b580ab2d1397f138248b1cb15488689b99336646df54b93ab879a89be` |
| `delivery-receiving-upgrade-local-staging.mjs` | 5139 | `451e8cea3736ae64292cfe8f311bdfa9367697f37108bf6ecace0378a9e2730b` |
| `delivery-receiving-upgrade-local-child.mjs` | 7402 | `030bb3d4d7721e89e235b15dbedd5302d70b0dba95e46e3cc1169138dcecbf62` |
| `delivery-receiving-upgrade-local-observer.mjs` | 6886 | `1a2175b271a6d435e641f8512f4647a01f31ec2fac1f7e97c145ab66d53ada59` |
| `README.md` (append-only) | 9208 | `e085d8c472fdda19644390ad86e90bdb7ebbb2748752eee1b4ab6b43b1aeb488` |

Root next: normal formatting/size checks, frozen local 86-case run, scoped lint and
independent read-only review. A unit GREEN establishes injected decisions only.
Then separately authorize/bind real filesystem/process/clock/lease ports; prove
live proc FD/OFD details, CLI/container/config identity, history, independent
committed fixture visibility, complete 070/080 behavior, target-preserving reset
and cleanup/restoration under all four canonical locks. Keep negative and positive
epochs separate. Real-host runtime must measure the many pre-mutation identity
probes; performance and actual timeout behavior remain unmeasured.

Suggested root unit command (not executed by author):

```sh
pnpm exec vitest run tests/contracts/phase-02-slice-11-delivery-receiving-upgrade-local-prefix.test.ts tests/contracts/phase-02-slice-11-delivery-receiving-upgrade-local-session.test.ts tests/contracts/phase-02-slice-11-delivery-receiving-upgrade-local-safety.test.ts --reporter=json --outputFile=/tmp/ROOT-OWNED-LOCAL-GREEN.json
```

No local DB/auth/hosted acceptance or canonical validation is claimed. No migration
promotion, services/roles/config change, secret read or package/CI wiring occurred.

## Root-aborted comparator attempt and TEST-only correction

Root's first actual 86-case local behavior attempt was CPU-bound and produced no
JSON receipt; root verified its owned Vitest parent3214105/worker3214152 and sent
SIGINT only to that parent. This incomplete attempt is not GREEN, RED behavior or
DB evidence. Root identified the staged-file oracle's deep `toEqual` of the full
roughly6MB prefix as the same Buffer-index enumeration cost already measured in
the main fixture comparator (about2.9seconds/MB by root). Production remains frozen.

A separate exact four-path TEST-only claim authorizes this correction: existing
plan-assertions utility, local-fixtures utility, new local-comparator test, and
this report. The existing private `exactValue` algorithm and `expectPlanEqual`
API are unchanged. A generic `expectValueEqual(actual, expected, location)` wrapper
delegates to that same comparator; only local `expectStaged` changes from deep
`toEqual` to the wrapper. It still copies and compares every staged Buffer byte
using native `Buffer.equals`, every non-Buffer own key, own data descriptor and
metadata value, array kind/length/position. Stored hashes never substitute for
bytes. No prefix limit, file omission, raw-process spy or stage-capture change was
made; all original86 case identities/assertion inputs remain untouched.

The new comparator file has14 small independent cases (`DR-UL-C01`–`C09`, including
parameterized controls): independently allocated copied-array positive; corruption
of the first/last byte with unchanged correct stored hash; name/regular/hash
metadata changes; extra enumerable/nonenumerable/symbol own keys; inherited-value
missing own key; accessor refusal without invoking its getter; reversed order;
sparse missing element with unchanged length; and substituted own key with
unchanged own-key count. These exercise the exact comparison seam, without loading
the large real prefix, importing production, mocking decisions or using host I/O.

TDD/debug-by-test guidance keeps the correction in the assertion harness after
root identified the harness bottleneck. Author correction remains **UNRUN**:
no test/parser/formatter/runtime/DB/Docker/network/Git operation was executed.
Root owns normalization, the complete local suite plus these14 controls, main
314-case regression and independent review. No observed speedup or passing result
is claimed by this source-only correction.

Pre-format correction delivery image (all paths under `tests/contracts/`):

| File suffix `phase-02-slice-11-delivery-receiving-` | Physical lines | Bytes | SHA-256 |
| --- | ---: | ---: | --- |
| `upgrade-plan-assertions.ts` | 57 | 1909 | `051670ff39457062d927f0ec9d912ce06e35841bf0b40b70b147189f27350327` |
| `upgrade-local-fixtures.ts` | 280 | 8677 | `7a7593b178192e1b186b17ced7152d6bb807ad7b7f462b22589b8d9f0b35c0bf` |
| `upgrade-local-comparator.test.ts` | 141 | 4967 | `1555ebbf8a51a3edb30cfae6edddb08650126bd488d7dd3ba5473a04bb3e43b7` |

## Prefix lifetime TEST-only follow-up

Root now reports actual100/100 local PASS (original86 plus comparator14), followed
by independent local implementation review identifying one P2 serialization gap.
Current prefix source checks `!state.attempted` before awaited proofs and marks it
afterward (`local-prefix.mjs` :143–150 at review). Restoration :164–189 also has no
exclusive in-flight gate. Thus a same-adapter reset/reset can both pass admission,
and reset/restore or restore/restore can concurrently replace or remove stages.
The normal runner's intended sequential usage does not prove adapter exclusivity.
This is root-provided runtime/review evidence; author did not rerun the100 cases.

The new exact two-path TEST-only claim adds only
`tests/contracts/phase-02-slice-11-delivery-receiving-upgrade-local-prefix-lifetime.test.ts`
and this report. All seven production modules, existing test/support files,
comparison helper and fourteen comparator controls remain frozen.

Six deterministic cases (`DR-UL-L01`–`L05`, L03 parameterized) require fail-closed
overlap refusal before additional filesystem/process mutation:

- L01 holds the first actual read-only inspect port entry after reset admission
  but before its first awaited proof completes; a simultaneous second reset must
  refuse, catching the pre-check/post-await-mark race.
- L02 holds the equivalent first preflight boundary; concurrent preflight must
  refuse without replacing the first operation's eventual state/authority.
- L03 holds the first raw reset call before its implementation runs, proving one
  actual entry and zero accepted captures. Both reset/reset (existing refusal
  control after marking) and reset/restore must refuse while the first owns the
  stage lifetime, then permit the first to complete and restore normally.
- L04 holds an ordinary-baseline restoration's raw reset entry and refuses a
  second restoration without extra entry, link swap or cleanup of the first stage.
- L05 holds an ambiguous reset failure, refuses concurrent restoration while it
  remains live, preserves exact original Error identity after draining, then proves
  required ordinary-baseline restoration succeeds once the failed operation ends.

All barriers are explicit deferred promises attached to the injected raw process
port. Existing `vi.fn` entry recording happens before the held implementation;
accepted reset records are checked separately. No arbitrary sleep, fixed-count
microtask drain, elapsed-time inference or hidden mock-decision guard is used.
Every overlapping call must settle refused before the first barrier is released;
snapshots of real raw reset-call count and MemoryFs write log prove no second
mutation. Finally blocks always release and drain the first operation, including
on an assertion failure. Full lossless staged-byte checks and original-link /
distinct restoration-epoch assertions are retained on successful lifetimes.

This chooses fail-closed rejection, not a new queued reset/restore semantic.
The author remains **UNRUN** (no test/parser/formatter/runtime/DB/process/network/
Git operation). Root must observe meaningful new RED, then separately release the
minimal prefix-only GREEN fix and rerun the prior100 plus these6 cases, lint and
independent review. No production fix or passing new test result is claimed here.

Lifetime test pre-format delivery image:228 physical lines,8436 bytes,
SHA-256 `25c4e2b6a943d287b31b529facdc00ba982c927ce17e3a8088107df11b2033b2`.

## Prefix lifetime GREEN author follow-up

Root reports normalized six-case RED: one existing post-mark reset/reset refusal
control PASS, five meaningful overlap failures, zero skipped cases.
Receipt basename `upgrade-prefix-lifetime-red.json`, SHA-256
`750f8c2e6289b40364d3206dd3a7ab216dca16dc89f87ac274a12648df254ff1`.
This author did not execute or independently regenerate that receipt.

The separately released two-path GREEN claim changes only local-prefix and this
report. One adapter-private `busy` flag and `exclusive` wrapper now surround all
three returned methods. The flag is checked and set synchronously before calling
the admitted async operation, hence before its first awaited proof. Overlap rejects
without queuing or touching operation state. `finally` releases only after the
complete admitted operation settles, including reset's awaited owned-link recovery
or restoration's awaited reset/link/cleanup sequence. A refused overlapping call
never clears another operation's flag.

All existing operation bodies are unchanged. `state.attempted` still becomes true
only after validated pre-reset proofs, remains true after an ambiguous reset error,
and grants required restoration after the failed operation has drained. The same
primary Error object is rethrown; secondary cleanup failures and failed restoration
remain failures. No inventory, identity, lease, bounds, staged-byte proof, link
ownership, epoch, source hash, raw process invocation or validation was weakened.
There is no new public API, dependency, queue, timer or host I/O.

GREEN source author remains **UNRUN**; no parser, formatter, tests, DB, Docker,
process, Git or network operation was executed. Root owns normal-format preview,
all106 local tests, main314 regression and independent review before any passing
claim. This minimal admission fix does not establish actual host binding or DDL
atomicity and is unrelated to DEC-194's separately observed HTTP results.

Prefix lifetime-fix pre-format delivery image:210 physical lines,5998 bytes,
SHA-256 `85a839f3f258ca144fc961dbd064c5c1ee1c619a109fbe70dc2e39e31afac175`.
