# DEC-197 local ALT upgrade adapter — TEST author handoff

Native author/correction: `gpt-6.1-sol` / `ultra`. Status: **AUTHOR UNRUN; frozen for root review/RED**.
Worktree: `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`.
Protected primary remained read-only. Current correction claims exactly six local
TS files and this report; the original065 witness remains frozen and untouched.

No implementation, old test, SQL witness, migration, tracker, package or CI edit.
No runtime, parser, test, formatter, DB, Docker, CLI, Git or network execution.
Static filesystem reads, source/hash analysis and absolute `apply_patch` only.
Root owns normalization/line-limit verification, actual RED and any GREEN release.

## Binding authority and source

The full root brief is
`docs/handoffs/2026-10-14-claude-s12/briefs/codex-dec197-upgrade-alt-reset.md`:
exact target/locks at lines18–45, lifecycle/prefix-versus-baseline at lines57–78,
real setup/rollback/commit at lines80–86, literal migration invocation at lines89–109.
This is implementation protocol B, not a product-policy change or acceptance waiver.

Canonical fourth lock is `/tmp/wejammin-reset.lock`, matching the actual staged
runner at `lanes/lane-db-alt-staged.sh:18,90`. Root's earlier two metadata-only
queries held the other three canonical locks plus a differently named extra lock;
they performed no DB mutation and are NOT full four-lock execution receipts.

Existing guarded negative source remains `060-upgrade-world.sqlinc:5–42,66–129`.
The new positive065 only asserts a separately reset legacy-empty/pre-receiving
world and emits its world document. It inserts/deletes nothing and does not run060.
Existing070 remains unchanged, including raw catalog OIDs/ACLs and bigint row TEXT
at `070-upgrade-snapshot.sqlinc:24–146`. Its scope is not whole-cluster equivalence:
database settings, database-level metadata and event triggers are not its inventory.
The unchanged target transaction/first FK/terminal COMMIT are at migration lines5,
169–171 and176. All080 bytes, including BEGIN/COMMIT/final LF, are retained.

## Minimal local adapter API contract

Both future modules are still ABSENT and unreleased:

- `infra/database-upgrades/delivery-receiving-upgrade-local-prefix.mjs`
- `infra/database-upgrades/delivery-receiving-upgrade-local-session.mjs`

Constructors are `createLocalPrefixAdapter({fs,process,clock,lease})` and
`createLocalSessionAdapter({fs,process,clock,lease})`. There are no host defaults.
Injected raw boundaries only:

- `fs`: asynchronous filesystem methods matching the MemoryFs double; no business
  attestation/reset/comparator callbacks and no broad recursive removal port.
- `process`: current Node PID, `run({command,args,input?,cwd?})` yielding raw exit
  status/stdout/stderr, and Node-shaped `spawn(command,args,options)` yielding pipes.
- `clock`: now/setTimeout/clearTimeout; timeout only kills its owned child.
- `lease`: expected raw ownerPid/path/fd/dev/inode/mode records, not a Boolean grant.

Prefix adapter methods: `preparePrefix(plan)`, `resetBefore(plan,attestation)` and
`restoreBaseline(plan,attestation)`. Session methods: `setupWorld(plan,reset)`,
`observe(phase,plan,reset)` and `executeMigration(invocation,plan,reset)`.
Shared DTOs/types/constants are consumed read-only from the receiving author's
`phase-02-slice-11-delivery-receiving-upgrade-target-fixtures.ts`. Identity/envelopes
include first-observed containerId, clusterId and databaseOid; owner is identity
metadata. Plan grants only the complete literal ALT target, never bare postgres.

Raw preflight reads exact config, actual regular source files, `/proc/locks`,
ancestor/current PID status, inherited fd links/fdinfo and current lock-file inode.
The fdinfo lock record supplies open-file-description evidence: matching inode
alone is insufficient. READ/WRITE must match each lock's shared/exclusive mode.
The first preflight captures actual container/cluster/DB identity; there is no
pre-known unit container ID authority. Every mutation rechecks it. Replacement
means failure, including cleanup failure, never resetting the replacement.

The raw process double accepts only the literal narrow INSPECT_TEMPLATE,
ALT_TARGET_SQL/APPLIED_HISTORY_SQL declared in local-boundary-fixtures and the
literal argv expectations in local-fixtures.
No Docker Env/status output, JWT values, role/service/config changes or passwords.
The database-settings query emits row count/key names only. Actual Docker public
label/port projection and SQL must still be verified against the real stack.

Prefix and baseline independently hash ASCII filename-sorted UTF8 lines:
`<filename>\t<sha256(actual file bytes)>\n`. Prefix excludes target/later versions;
baseline is the complete current promoted inventory and may contain the target
after promotion. No agreement between caller arrays establishes completeness.
Actual applied version/name history must independently match the reset inventory;
it is not misrepresented as a stored byte-hash proof. Verified staging binds the
source bytes actually supplied to CLI reset, and seed/source drift refuses reset.
Reset epochs differ even when clock now is unchanged. OIDs are not compared across
separate resets; negative before/after within one epoch remain exact raw images.

Setup/observer clients also run the literal read-only SESSION_SQL via `-c`, then
their script via `-f -`. Phase apps are `<plan.applicationName>-setup|-before|-after`;
migration uses the plan app unchanged. Setup expands trusted relative `\\ir` closure
under the real test root; no container fixture mount/copy or host path fallback.
Escapes, cycles and symlink input refuse before spawning. Setup streams BEGIN,
world, finish and `DEC197_SETUP_READY_V1`, withholding COMMIT until complete TAP and
world/session identity pass. It rechecks the lease immediately before COMMIT.
Observer streams BEGIN READ ONLY/exact070/ROLLBACK and validates one matching
document. Transport promises settle only after child close, not merely exit/error.

Migration execution returns raw status/stdout/stderr plus the reset envelope;
there is no trusted out-of-band backendPid. It preserves nonzero exits/unexpected
SQLSTATEs rather than inventing controlled refusal. The receiving author's real
classifier/runner owns exact first23503/subsequent25P02/ROLLBACK classification,
parsed marker identity/distinct PID checks, rollback comparison, committed catalog
semantics and mandatory restoration/receipt ordering. These local tests do not
mock those business decisions or duplicate their acceptance claim.

## Test identities and expected RED

- `DR-UL-P01–P07`: independent inventory/hash, matched omission, actual source drift,
  malformed/symlink/duplicate versions, literal target/config and real lease facts;
  stale/replaced lock, container, cluster, seed and target-source refusal.
- `DR-UL-P08–P17`: target-after-promotion prefix/baseline distinction, exact CLI
  vector, independent applied history, ambiguous reset restoration, cleanup failure,
  no preflight cleanup authority, forged attestation, first identity capture,
  replacement cleanup refusal, absent FS dependency and unrelated stage preservation.
- `DR-UL-S01–S08`: exact full080 input/argv, no outer wrapper, committed setup only
  after complete passing TAP, failure/skip/TODO/truncation/bailout refusal, actual
  COMMIT visibility, fresh read-only observer/row text, include closure safety.
- `DR-UL-S09–S15`: owned-child timeout/error/close settlement, raw failure evidence,
  lost lease before client/COMMIT, exit-versus-close and same-cluster replacement.
- `DR-UP-P01–P05`: real legacy relation, zero consumers, absent receiving
  relations/types/guard, original validated publication FK and no receiving FKs.

Every local case dynamically loads its real missing module inside the case body.
No import-time missing-module abort, availability skip or fake implementation is
intended. Root's original availability-only result is recorded below; no behavioral
GREEN follows from missing modules. Root must verify final collection/identities.
Author ran no suites and claims no migration atomicity, actual prefix reset,
Auth fidelity, hosted acceptance or secret-value equivalence.

## Correction after independent pre-IO/staged-byte review

Root reports the initial normalized baseline:79 tests,1 control PASS,78 case-local
missing-module FAIL,0 SKIP, no collection error. This is availability evidence,
not adapter behavior or DDL proof. Root also found two scoped lint errors.

Raw `vi.fn` call entries precede argument validation. `noClient` now checks
`spawn.mock.calls=[]` as well as children; `noMutationProcess` accounts for EVERY
run entry against accepted literal read-only probes and already-recorded reset
attempts. `noReset` additionally requires no filesystem writes. Thus rejected bad
argv/options, an unrecognized mutating command, or a second attempted cleanup
reset cannot masquerade as no side effect. B01/B02 directly demonstrate that the
old children/accepted-reset bookkeeping would miss such entries.

Each reset capture now retains ordered filename, regular-file flag, exact Buffer
bytes and SHA-256 at the raw reset boundary, before reset-command assertions.
History probes read explicit simulated applied history, not current directory
listings; a successful raw reset advances that simulated history from its capture,
while explicit wrong-history overrides remain independent. P08 verifies exact
prefix AND ordinary-baseline bytes; P09 verifies prefix bytes even on history
refusal. P18 pairs unchanged staging with empty/corrupt-file controls: corruption
must be intercepted and refused before ANY raw reset/mutating process entry.
This double never executes SQL or establishes a genuine applied-byte receipt.

All original79 identities/negative controls remain; S15 retains its migration
identity and adds setup replacement with the same cluster/OID. Every pre-client
refusal checks raw spawn entry. New groups add only paired stage and double-oracle
controls. Removed the unused manual-clock delay formal without changing timer
behavior; the missing-module Error now retains the caught import error as cause.
Root's draft formatter preview was275/284/195/385/393/184 lines for fixture,
boundary/process/prefix/session/safety respectively, before the final P15 assertion.
Final normalization, actual rerun/lint and independent readback remain root gates.

## Frozen author manifest

Root's mechanical formatting exposed fixture/test line overages. The separately
claimed mechanical extraction moved raw state/run/spawn doubles into
local-process-fixtures, moved P06/S08/S12/S15 verbatim into local-safety.test, and
shared the unchanged noReset assertions through local-fixtures. Case-identity
multisets were compared statically before/after and matched. No oracle was changed.
The correction preserves all global host mocks; only the unused clock formal
changed in the boundary helper. Local implementation modules remain absent/held.

Paths relative to the worktree. Counts are current static author lines; final root
normalization/runtime verification remains separate. The original root formatting
is retained on moved bodies; newly extracted imports/return layout remain UNRUN.

| Path | Lines | Bytes | SHA-256 |
| --- | ---: | ---: | --- |
| `tests/contracts/phase-02-slice-11-delivery-receiving-upgrade-local-prefix.test.ts` | 368 | 14378 | `df23c3559ac182261224f27dfbf65f309ef64729bead7cce6d6f02210c4e98e8` |
| `tests/contracts/phase-02-slice-11-delivery-receiving-upgrade-local-session.test.ts` | 393 | 13683 | `ff1804ab0d2749fb5fa4024bd696868f788ce9653a8830622ba8f83a05326973` |
| `tests/contracts/phase-02-slice-11-delivery-receiving-upgrade-local-safety.test.ts` | 160 | 6403 | `a9be49ed8fb8af3ddc430861ad403c49ebf0027d7d1525eae5150845a311acf5` |
| `tests/contracts/phase-02-slice-11-delivery-receiving-upgrade-local-fixtures.ts` | 264 | 8497 | `98f5f7988a62ab0623f597f71004d3ce873b1b1a53ee921693c9aeaf494b2470` |
| `tests/contracts/phase-02-slice-11-delivery-receiving-upgrade-local-boundary-fixtures.ts` | 284 | 8993 | `ad31c478fa085b3b6a7db3fc3282ebb2d024d011e6c98d421d1c84491b314a6b` |
| `tests/contracts/phase-02-slice-11-delivery-receiving-upgrade-local-process-fixtures.ts` | 175 | 5887 | `ba534ea752231a197cba6f0a660084bbe6455be31458f163dc6a0a71a045c397` |
| `supabase/tests/phase_02_slice_11_delivery_receiving/065-upgrade-empty-world.sqlinc` | 41 | 2046 | `97476c103a8ad750a124663c4bd3aeb0400c6c1c6f467abb92e7fc5202eb735b` |

Frozen read-only witnesses:060 SHA `e1ef8092640104c91c587712f81fbb586b3b6f29deeb9f151ee94a1bd1685d9a`;
070 SHA `7909a26861a3cefbfd98a7f944061f2202377257abc1f0f055027f95b43bda32`;
080/target both9597 bytes, SHA `1117a83f72496887c6b36d100b7fa2635aa4673d699841932291967b1516f3b6`.

Root's focused unit command suggestion, not executed by author:

```sh
pnpm exec vitest run tests/contracts/phase-02-slice-11-delivery-receiving-upgrade-local-prefix.test.ts tests/contracts/phase-02-slice-11-delivery-receiving-upgrade-local-session.test.ts tests/contracts/phase-02-slice-11-delivery-receiving-upgrade-local-safety.test.ts --reporter=json --outputFile=/tmp/ROOT-OWNED-RECEIPT.json
```

Root should first review/normalize these owned tests, preserve their semantic
oracles, verify test files<400 and utility fixtures<=300 normalized lines, observe
genuine RED with no setup abort,
then independently review before releasing only the minimal implementation paths.
Actual ALT reset/session/atomicity execution remains separately authorized work.
TDD and adversarial-review skills shaped the negative controls and the explicit
separation between injected unit decisions and real database evidence.
