# DEC-203 mandatory ingress binding — bounded GREEN plan

Status: source-only PLAN, not an implementation release or acceptance receipt.
Author: native inherited gpt-6.1-sol/ultra. Worktree:
`/home/rob/.codex/worktrees/phase2-slice12/WeJammin`.
Only this NEW claimed document is written. No production, fixture, test, runtime,
package, configuration, tracker or other report is changed. No child is spawned.

## Approach

Make private ingress mandatory in the existing injected host binding, using a
small shape/filesystem helper and retaining all existing executable checks.
Cascade the raw host fixture setup without changing its historical process or
Docker trace stories. Matching DTOs and injected observations remain decisions,
not authenticated ingress ownership, lifetime or native integration evidence.

## Scope

In: exact eight-key DTO, lossless independently observed ingress identity, the
existing child-only environment rule, complete fixture/type consumer inventory,
and proposed root-owned validation. Production/fixture paths below are PROPOSED,
unreleased; their absence/presence was checked before proposing them.

Out: a listener/proxy, forwarding, peer lifetime, process ancestry, operation
policy, trace producer, cancellation/drain redesign, reset authority, a native
adapter/default, daemon/context selection, packages/services/privileges, native080
or canonical acceptance. The five-field peer primitive is not altered or treated
as PID-instance authorization. No grants or elevated rights are needed.

## Steps

1. Freeze and run the final ingress TEST additions before GREEN code. Preserve the
   genuine IB02 legacy-admission RED separately from positive-premise failures;
   add whole-string decimal-whitespace and equal-inode/different-device controls.
   The root brief38's exact five observation cases below must also be frozen,
   independently reviewed and actually RED under root execution before any
   eight-path implementation release. They are a mandatory gate, not later QA.
2. Add NEW `infra/database-upgrades/delivery-receiving-upgrade-host-ingress.mjs`
   with pure `assertIngress(ingress): void` and injected async
   `verifyIngress(fs, ingress): Promise<void>`; no top-level filesystem/process I/O.
3. Amend `infra/database-upgrades/delivery-receiving-upgrade-host-executables.mjs`
   to require ingress, call its pure validator and compare child DOCKER_HOST to
   the private endpoint. Bracket its unchanged executable verification with
   complete ingress observation rounds. Keep all other old guards intact.
4. Extract the raw artifact/binding setup from the296-line host launcher fixture
   into NEW `tests/contracts/phase-02-slice-11-delivery-receiving-upgrade-host-binding-fixtures.ts`.
   Add independent literal ingress facts and a faithful injected FS wrapper there;
   keep the launcher process/trace/effect/fault bodies unchanged by inverse proof.
5. Pass that fixture FS wrapper through the existing host renewal and lifecycle
   fixtures. Preserve their current spawn awaits, raw observations, controls,
   operation sequencing, leases, completion/recovery and assertion bodies.
6. Preserve the new ingress fixture's legacy negative explicitly: remove ingress
   from its cloned harness binding and set only that legacy clone's DOCKER_HOST
   to the immutable upstream. Keep all IB01–24 assertions and independent facts.
7. Update the existing database-upgrades README module map only after its exact
   path is claimed. Keep every utility naturally formatted at or below300 lines;
   do not compact code or create an unclaimed helper.
8. Validate under root authority: normalize and source-review the exact claimed
   bytes; run final ingress plus all old host/local/main consumer cohorts,
   type/lint checks and targeted mutants; retain exact receipts and exclusions.
   Do not activate a real proxy, reset or default adapter as part of this step.

## Contract and implementation details

Authority is the full root brief, especially26–36. The root object has exactly
daemon, executables, artifacts, package, environment, derivedEnvironment, dotenv,
ingress. Ingress has exactly parent, socket, endpoint, upstreamEndpoint; each
identity has exactly path, device, inode, mode, uid. No optional/legacy branch,
DTO upgrade, inferred ambient context or silently supplied default is permitted.

Both paths must be nonempty absolute canonical lexical paths: normalization must
equal the original and NUL/CR/LF must be absent. Do not trim or ban ordinary legal
path whitespace. Socket is exactly join(parent.path, 'docker.sock'); its UTF-8
byte length is strictly below108. The endpoint is exactly 'unix://' + socket.path
and differs from the immutable 'unix:///run/docker.sock'. The upstreamEndpoint
and existing daemon.endpoint both remain that immutable upstream literal.
Only environment.DOCKER_HOST changes its comparison to ingress.endpoint. Keep
the exact environment key set, PATH, package, launcher, NODE_PATH and dotenv guards.

Device is canonical nonnegative decimal text; inode is canonical positive decimal
text. Validate the entire canonical spelling, including final line terminators
and spaces; no multiline/prefix match, Number coercion, trimming or parseInt.
A digit-only check plus
canonical BigInt text round-trip is sufficient. Do not add an invented decimal
length/product cap. Zero device is valid; zero inode is not. Distinct identity
means `(parent.device,parent.inode) != (socket.device,socket.inode)`, not unequal
inode alone. Equal inode on different devices must remain valid.

The exact numeric full modes are parent0o040700 and socket0o140600. Both uid values
must be safe nonnegative integers equal to the current Node getuid result, not an
environment/request identity. Missing UID support refuses; no zero/ambient fallback.
The pure validator must read actual current-process getuid() for this comparison.
That required UID read is allowed; filesystem I/O, spawn/child launches, /proc or
other process inspection and environment/request UID fallback are forbidden.
No other process operation or ownership/reset capability is granted.

For observations, always request fs.lstat(path, { bigint: true }); compare bigint
dev/ino directly with BigInt(expected text). Compare full bigint mode and uid
against the exact expected values, without converting dev/ino through Number.
Require parent.isDirectory(), socket.isSocket(), and no symbolic link; do not use
stat-following as a substitute. Require fs.realpath(path) === expected.path.
Each identity round uses lstat→realpath→lstat and validates both stat images.
Two complete parent/socket rounds bracket the existing verifyExecutables body,
including all artifact byte/mode/inode and PATH/package-link observations.

Keep the existing executable descriptor schema and numeric identity checks
unchanged; ingress's decimal strings are not a reason to rewrite old artifacts.
No injected fs default/native fallback is added. Missing methods, rejected I/O,
ENOENT, symlink, wrong kind/mode/UID, changed realpath or either identity image
refuse; there is no absent-ingress recovery path or successful partial result.
Use the existing DEC197 requireFact/Error convention with fixed non-secret
messages for malformed ingress or changed ingress facts. Preserve unexpected
observer errors as failure, never success; emit no raw DTO/environment diagnostics.

These are repeated pathname snapshots, not atomic directory/socket pinning.
A same-UID writer can change a name after the last check; binding validation
cannot authenticate the producer or prove uninterrupted ownership/current peer
lifetime. Actual producer-owned descriptor/lifetime fencing remains future work.

## Complete consumer and fixture cascade

| Path under infra/database-upgrades | Current effect / proposed edit |
| --- | --- |
| delivery-receiving-upgrade-host-executables.mjs:53–113,162–195 | Only existing production edit: mandatory key/private environment plus helper calls. |
| NEW delivery-receiving-upgrade-host-ingress.mjs | Two private helper exports above; target helpers and Node path/buffer/process built-ins only. No import from runner or tests. |
| delivery-receiving-upgrade-host-request.mjs:19–30,55–111 | No edit: snapshot already copies/freezes every ingress member when receiving nativeBinding. |
| delivery-receiving-upgrade-host-reset.mjs:18–20,98–109 | No edit: construction already calls assertBinding; actual completion observes before launch. |
| delivery-receiving-upgrade-host-boundary.mjs:66–71,121–123 | No edit: existing verification consumes helper through verifyExecutables. Existing post-observation lease recheck remains. |
| delivery-receiving-upgrade-host-drain.mjs:9–18 | No edit: child env already copies the sealed binding environment. |
| delivery-receiving-upgrade-host-trace.mjs:154–165 | No edit: trace.daemon remains upstream. Do not rewrite it to private ingress or manufacture new ancestry. |
| delivery-receiving-upgrade-host-source.mjs | No edit: only generic snapshot/sameValue imports, not a second binding schema. |
| README.md:138–160 | Proposed documentation-only host-ingress row and injected/native boundary, separately claimed. |

All filenames in the following table are under tests/contracts; the long common
prefix is `phase-02-slice-11-delivery-receiving-upgrade-`.

| File suffix | Minimal proposed action |
| --- | --- |
| NEW host-binding-fixtures.ts | Move launcher constants/artifact installation/description and binding creation, currently launcher12–18,28–92, into raw fixture setup. Return binding, executable aliases still used below, and the ingress-aware FS port. Keep literal independent DTO/stat facts; no production validator/transition builder. |
| host-launcher-fixtures.ts | Import the extracted setup and return its FS port. Preserve lower raw process, shell→Node story, command/response bodies, daemon work, live/start/close and fault functions byte-for-byte except setup references required by extraction. Reconstruct the original296-line source by an exact guarded inverse. |
| host-renewal-fixtures.ts:59–64,189–194 | Consume launcher.fs as options.fs. Keep mock.fs and its fault seams intact. Existing raw boundary spreads all binding members automatically. |
| host-lifecycle-fixtures.ts:54–58,87–110,167 | Consume installed.fs in options; leave installed.binding/raw boundary/trace sequencing and all operations intact. |
| phase-02-slice-11-dec203-ingress-fixtures.ts:37–62 | Reflect.deleteProperty(legacy,'ingress') and explicit upstream DOCKER_HOST on the cloned legacy object only. The positive new ingress profile stays independently literal, not copied from the shared helper's observations. |
| host-lifecycle-operation-fixtures.ts:7–11 | No edit: Trace is inferred from harness and no trace shape changes. |
| host-renewal.test.ts / host-boundaries.test.ts / host-lifecycle.test.ts | No assertion or stimulus edits proposed. Preserve old negative counts and reasons, including HB02's existing mode-only raw lstat override. |
| local-boundary-fixtures.ts:28–87,96–215 | No edit: native process/fs guards and general MemoryFs remain untouched. No global synthetic socket/UID behavior. |
| phase-02-slice-11-dec203-ingress-binding.test.ts | No assertion changes proposed; source author owns the separate edge additions. |

The new host fixture helper returns a narrow forwarding FS object, not a mutated
global MemoryFs contract. Non-ingress methods/paths delegate dynamically to the
original mock.fs, including writes used by local-prefix staging and later test
fault overrides. Only the two explicit ingress paths supply separately written
directory/socket BigIntStat observations, with correct numeric-vs-bigint behavior
for the requested option. Do not echo mutated binding members to synthesize stat.
This preserves HB02 even though its original lstat override omits options: the
ingress wrapper handles its own two paths, while artifact paths still reach that
exact override. Do not cache a bound old method that would bypass later faults.
Keep the fixture DAG acyclic: the new raw binding helper may import the common
renewal fixture utilities/type and existing binary constant, but never the host
harness or new ingress fixture. Launcher imports the helper; harness/lifecycle
import launcher; the DEC203 fixture imports harness, not the reverse.

No existing central NativeBinding TypeScript declaration was found: host APIs use
unknown/inferred binding shapes; OwnedPort is independent of binding fields.
New helper types may describe the literal ingress/FS return locally. Do not
widen assertions with any, optional ingress, union-with-legacy or validator mocks.
Source inventory searched apps/packages/infra/scripts/tests for actual host-module
consumers: no application/package/script consumer was found; only the paths above
and test fixture imports occur. No CLI/default native producer exists to amend here.

## Evidence, gates and source pins

Root's original152 injected run is historical:3PASS/149FAIL/0pending. The current
actual167 run, including IB23's14 whitespace cases and IB24's tuple positive,
completed3PASS/164FAIL/0pending. Root supplied full receipt SHA256
cf160f290d95ceb59e5dc93df438384741ca2a58915bce7abc730881947f6f4b
and JSON SHA256
29a8fb2e0ca47bce00cc9d65721809d6163ebfa3e38888b32022e6df35752196.
IB02 is genuine old seven-key admission RED. Most other failures are positive
eight-key premises rejected before their late fault;164 failures are not164
independently isolated ingress defects. Their names or collection are not proof.
Root separately reports native33PASS in3.75s,
receipt SHA15e1ddb7f870f555355362c3edffab98ef1c0a7230d290690b8ac75a7bd12a73;
that kernel primitive receipt does not prove this injected binding or integration.

Root validation must preserve all old test identities/assertions and show the
valid ingress premise before each independent late fault. Retain all six old
artifact byte/mode/identity, PATH, package and selector refusals. Discriminate
Number rounding, final-newline decimal acceptance, inode-only inequality,
stat-following, omitted UID/full mode, skipped realpath and omitted observation
rounds with isolated mutants/new controls where current tests do not establish
that boundary. IB18's stable faults do not prove timed replacement detection.
The following exact five source-only TEST cases from root brief38 are mandatory
before GREEN implementation release, with independent review, normal cap checks
and root-owned actual RED receipts; none is optional deferred coverage:

| Required case | Injected observation oracle |
| --- | --- |
| 1. Positive ordering audit | Complete parent AND socket lstat→realpath→lstat rounds occur both before and after actual executable verification. |
| 2. Parent within-round drift | Independently change parent identity between its first and second lstat; refuse with DTO unchanged. |
| 3. Socket within-round drift | Independently change socket identity between its first and second lstat; refuse with DTO unchanged. |
| 4. Parent during-artifact drift | Independently change parent identity during an actual artifact read after the initial round; final observation refuses. |
| 5. Socket during-artifact drift | Independently change socket identity during an actual artifact read after the initial round; final observation refuses. |

Each fault must first pass valid-profile and observed-verification controls,
preserve all167 existing assertions and independently literal fixture bytes,
leave the DTO unchanged and make zero injected spawn/run/boundary-observer calls.
The required actual getuid() read remains allowed. These five cases live only in
the separately claimed ingress-observation.test.ts and its own RED report;
this plan does not release their author or change any test/fixture/production file.
Root must distinguish failed positive premises from reached timed-fault oracles.
Injected ordering/drift evidence is not a native filesystem race or lifetime proof.
Full host reset recovery/immutable authority and old main/local cohorts must
remain GREEN. Native producer/socket replacement races remain outside this plan.

Readback source pins, before any future implementation; SHA256 values below are
complete bytes, not runtime evidence. This clarification updates the root brief
pin for its required five-case gate and later independent TEST claims. The table
retains the normalized284-line ingress helper after its author286-line freeze;
the RED report still labels its own author bytes. These are observed source pins,
not assertions of final release or execution.

| File shorthand | LF | SHA256 |
| --- | ---: | --- |
| root brief |102|8fd0e815f3d47ba5f275affe6e2ae8a515069f1ce355f2b7efe4e519ec0b1b93|
| ingress RED report |176|8b2186d884387d23dcaa31c61d42d5897b19460eb52b8faa12d0598c9ecd1401|
| host-executables.mjs |195|f8cc3b6d39e232ca391e68e2c8b158429ff4af51933e422663e847ef6b81dda0|
| host-request.mjs |212|eb40163cd62a3655550c464eca0915187cab65b10559785b5ff92c9fdc84f4a3|
| host-boundary.mjs |124|2a48495b3476cedafffe772112e389c225e588546d981527003271a2d4984b84|
| host-reset.mjs |146|43e8676f1007a1af498b8b70c4f1329ce2bec803e33bd931b23ed946f3636282|
| host-drain.mjs |168|b0cbc6a49c7a1f07ae66149deaf1c2f8764ba30e67daf63869bb241740e59000|
| host-trace.mjs |235|3937da931fcc716f0197a6fe737fb81baec094eb06aba1917457d00227853a55|
| host-source.mjs |168|0f36d4ba072b52698efed4013067882f320b295e34852633b4ffccb61d858b14|
| host-launcher-fixtures.ts |296|891aa4da86a3c37cab447ea9fad87d70459261859f5ea09f80fefe259866f7e3|
| host-renewal-fixtures.ts |281|042912266ca4b73582ab37e54d31c2063e8b12a2ac1706e29df476656b0b2d59|
| host-lifecycle-fixtures.ts |216|adb97f7ccf0d0fc0d4f26d9c5a1282d5277e910cc786c495714efbeec7ac9fb6|
| host-lifecycle-operation-fixtures.ts |136|7d8964a450fb7f56a7d4710c4785ae16e9e253eb67c4c70c080a320ad1796b47|
| host-renewal.test.ts |398|1af423611ff6c74eee88091ba8111428592bf31642b346dfe47827a6f8b245dc|
| host-boundaries.test.ts |217|d62a5338504320c514b91b34c19077e346ddb98caac26e79b7e00fd923790eb3|
| host-lifecycle.test.ts |396|1742ad1bab2661df7eb44f0bd4cef5c5633b19fb565184894ac1534c126e07ec|
| local-boundary-fixtures.ts |284|ad31c478fa085b3b6a7db3fc3282ebb2d024d011e6c98d421d1c84491b314a6b|
| ingress-binding.test.ts edge snapshot |299|2003b6b6175f3e05aeb07495a3648fc2334af369ec19719a29c00d8d862e3c18|
| ingress-fixtures.ts normalized edge snapshot |284|a39d99401580b1b6cb8d19fd335e1e51f72bbd05f8e14dd8a8e350ad893a0b04|
| database-upgrades README.md |160|1863eff94e609a5997264a6fa08d16f1789ce6373aa6f90b3871d83e55346d53|

## Assumptions

The reviewed root brief is the binding contract for this bounded implementation;
its DTO does not acquire the broader design's unfinished lifetime/operation fields.
The proposed helper split and exact future eight-path code/fixture/README write
set need root claim/release before any implementation. Existing tests stay frozen
apart from the specifically claimed raw fixture setup correction. No runtime,
parser, import, formatter, tests, compiler, process/socket, database, Docker, Git
or network was executed by this author. Only source reads, text/hash/count analysis
and this apply_patch document write occurred. No completion/acceptance is claimed.
