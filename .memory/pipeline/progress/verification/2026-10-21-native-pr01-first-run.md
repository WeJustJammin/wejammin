# First native PR01 run — 2026-10-21

Diagnostic first-run evidence. This is a formal native RED, not acceptance, and not a
canonical receipt.

## Exact command

```text
/usr/bin/env -i PATH=/usr/bin:/bin LANG=C LC_ALL=C TZ=UTC /home/rob/.cache/chrome-gate-runtime/node-v22.23.1-linux-x64/bin/node --test --test-concurrency=1 --test-name-pattern='^PR01:' tests/native/phase-02-slice-11-native-bootstrap-pre-ready.mjs
```

## Actual result

- Terminal 1; test duration 6744.273115ms (total run 6849.079832ms); test 1 pass 0 fail 1.
- Outer exit and actual close code 1; signal null.
- Harness assertion 230 expected outer code 0, observed 1.

## Diagnostic

- `validatedPrefixOnly` and `debugOnly` true.
- Roles: outer, owner-compiler, owner, coordinator, lease-compiler.
- `localTerminal`: state closed, failure code `DEC203_SUPERVISOR_IDENTITY_CHANGED`.
- `ownerWait`: pid 107526, startTime 5933601, exitCode 1, signal null.
- Owner-channel states: input `eof` (separate); ownerInput `finished`, ownerStdout `eof`, ownerStderr `eof`, commands `finished`, events `eof`.
- Owner compiler: terminal 0, stdout/stderr EOF, session absent.
- No PR02–04 and no database gates ran.

## Bounds

- Source pins unchanged at launch (32 at launch).
- The PR01 session (34646) is closed and must not be polled again.
- The result is an actual first-run TAP observation, not a canonical receipt.
- No owner-compiler native success and no global process absence is inferred.
- The native cause remains a hypothesis, not confirmed; no diagnostic run has occurred, and the native gate is held.
- No tests, process, cleanup or runtime commands were run to produce this note.

## Related UI final proof (separate track)

- Negative replay RED 2/2 on the same line-236 assertion; raw
  `e3d7b6eff1f636c865af67278f14362166c7453e34ef4637c5c53ea09ca9f33c`.
- Restored hook 246 lines (SHA `203a597bd62a4335d814f62ddc84ed529dede295898844846c30ba40694d877b`) and test 271 lines (SHA `96df82d4c12f475e8e72eeb1fc6686453a10a78c104365e4d8af8c4f58c491ae`); final GREEN 92/92 across 15 files; raw
  `66ddde8a3d1bbeafbd47bddcb3c64e77bdb7dff64480b058112e202a3dad7dac`.
- Scoped ESLint, `pnpm type-check` and `progress:check` were terminal 0.
- The final-GREEN existing `createDesigner` test emitted an act warning that is under
  source-only investigation and is not warnings-clean.

## Second named PR01 diagnostic run (2026-10-21)

- Session 38522: terminal 1, test 1 fail 1; test duration 6831.282613ms (total
  6940.658668ms).
- The only temporary production-observer change was the child CLOEXEC failure label
  `IDENTITY_CHANGED` → `REFUSED`, with the condition left strict and unchanged. The
  original observer is `e5105e1d21aac61110f0c261734b3aaf732b83b1ef6cca6d590ef91cc70f4d39`
  (diagnostic `476dbc183b7c9ba0a3f03cbe71af7b8d5c51a6a0822e55e9a6cf201e042c932e`) and was
  restored byte-exact; all other 31 pins unchanged. No `REFUSED` was hit, so the startup
  hypothesis is NOT confirmed.
- This run produced exit/actualClose 0, signal null, local closed `CANCELLED`, and
  `ownerWait` 156265 start 5991479 exit 0 — but the test FAILED on bound-artifact drift
  (`Artifacts.capture` 231 / observer 277): expected
  `54:111877:33225:1000:1000:75424:1792611681517996500:1792611681518004779`, actual
  `54:111877:33152:1000:1000:75424:1792611681517996500:1792611681760439537` (modes
  100711 → 100600, same inode/device/size/mtime, with changed mode and ctime).
- Main traced a confirmed independent premature test capture: `IsealFiles` `fchmod` at 201,
  then the readonly reader at 208, then it closes the original O_RDWR writer at 225; the test
  captures at GCC absence before sealing. A regression test is being authored; no fix yet.
- Normalizing the mode alone is insufficient (raw 600 with `fchmod` 600 still changes
  ctime); the proposal is to wait independently for writer closure before binding the strict
  artifact.
- Strict: no acceptance and no PR02–04/DB/canonical change; the initial producer IDENTITY
  cause is unresolved and separate, not fixed by the timing proposal. No input hash or
  identity guard was weakened.

## AS-OF 2026-10-21: native sealed-output observer fix and sequential PR01/PR02

- Native sealed-output TEST observer fix is final at 52/52 units; the causal guard-removal
  replay scored 38 pass / 14 fail, and the restored final scored 52/52. Scoped ESLint, Node
  syntax, `pnpm type-check` and `progress:check` were all terminal 0.
- New helper 84 lines SHA-256
  `79a635a686c5e37917ed9616a026cc7abd3a20e7f7b3a731781a2f9b323dbb8c`, observer 298 lines
  SHA `d2b5e6b08c8a74695709be68ef35ef1f41cae28c827345a7118f0b891bd51c2f`, unit 345 lines
  SHA `1ecbefeabde8cb3aa354ff27655214e1fbeb6648eca6b62e1b9b2488321447cd`.
- After that test fix, the real PR01 run (session 2703) still failed
  `DEC203_SUPERVISOR_IDENTITY_CHANGED` (1 fail; duration 6648.893102ms), so the production
  cause is unresolved. A two-failure-label-only sampler diagnostic variant (session 66912)
  passed 1/1 in 6658.436701ms; both hypotheses remain unconfirmed and the variant is diagnostic
  only.
- The original 32 were independently verified restored, after which the actual restored-source
  PR01 run (session 3254) passed 1/1 with no fail/cancel/skip in 6973.047048ms (test
  6886.869727), passing the entire shared callback. That pass is scoped to that one restored
  run — no stable production fix or authority is established.
- Sequential PR02 (actual restored source, session 70329) was terminal 1: tests 1 / pass 0 /
  fail 1 / cancel 0 / skip 0, total duration 5580.646584ms (test duration 5512.934795ms). The invoke harness
  assertion 230 expected outer 0 and got 1; actualClose 1/null; local terminal closed with
  `DEC203_SUPERVISOR_IDENTITY_CHANGED`; `ownerWait` PID 374424 startTime 6271505 exit 1 signal
  null; input EOF and channels finished/EOF; owner compiler 0/EOF/session absent. The prefix
  had roles outer/owner-compiler/owner/coordinator/lease-compiler and two pre-adoption
  inventories, not a successful adoption.
- Failure-path probe `0fae252aec54a0073b3598f77ccd36921a4f2b5231667330cd282605ab5efbc4` (300
  lines; inverse original `c181d73b…`) mapped only the default IDENTITY at `processes:86` to
  `REFUSED`, leaving all successful ensure paths untouched. Scoped Prettier/ESLint/Node syntax
  were all 0, after which PR01 (session 19629) was terminal 1, 1 fail, duration 6119.674414ms
  (test 6057.715958) with the failure still the original `IDENTITY_CHANGED`; `processes:86` was
  not matched in this failure, so no hypothesis is confirmed. `ownerWait` 424078 start 6329260
  exit 1, closed EOF/finished; owner compiler 0/EOF/session absent. All other 34 pins are
  original/repaired.
- PR01–04 share the full callback (processes/frames/builds/lease/compilerBoundary/inventories/
  terminal) but are separate fresh native runs. PR01 is not shown to prove only the build path,
  and PR02 is not the first or only FLOCK-assertion case.
- The first failing gate stops the sequence: PR03, PR04, DB and `validate` were NOT run. The
  PR01 restored-source pass stays historical scoped evidence, not a fixed production cause or a
  full gate. Producer-mediated F_GETFD/SETTLED/FINISH means no workflow authority; the precise
  original assertion is still being traced, no new authority or privilege was taken.
- Restoration caution: the failure-path probe is being replaced with a second reviewed
  failure-only two-site probe (not yet launched); do not claim all 32 production files are
  currently restored until ROOT confirms restoration.

## AS-OF 2026-10-21: two-site failure-only probe locates the guard

- Native two-site resources failure-only variant SHA-256
  `676f56cfe665965268a1d93ea4751e9dd3c8c648ccbe3b15a526f2132f059a8b` (300 lines) maps
  `observe:68` → `REFUSED` and `processes:293` → `UNAVAILABLE`, with all other errors and the
  ensure success paths and conditions unchanged.
- Scoped format/lint/syntax were 0, after which the actual PR01 diagnostic (session 61215) was
  terminal 1, test 1 fail 1 cancel 0 skip 0, total duration 5688.845346ms (test duration 5622.738644ms). The
  failure was `REFUSED`, matching `observe:68` (the inherited coordinatorFD CLOEXEC guard), not
  `processes:293`. `ownerWait` 439847/start 6347806 exit 1/null; local closed inputEOF channels
  finished/EOF; owner compiler 0, EOF, session absent.
- Resources were then byte-exact restored to the original `c181d73b…` (295 lines); ROOT
  independently read that original hash. This is precise guard-location evidence, not actual
  startup-ordering proof and not a repair or acceptance.
- Root-selected implementation design under TDD: the complete non-CLOEXEC topology, locks,
  identity and no-alias validation must still run. Initial pending deferral requires BOTH no
  previously qualified valid lease snapshot AND a current empty coordinator children list; any
  compiler already present makes an absent CLOEXEC a hard refusal even before first
  qualification. All non-flag lease topology checks run before any potential pending deferral, so
  wrong identities, aliases, locks, channels or pidfds are not masked. Before the first valid
  coordinator lease snapshot only, an absent inherited 3–10 CLOEXEC bit means an incomplete
  sample → false / no inventory / no authority; the first all-valid lease snapshot privately
  latches qualified, and any later missing bit remains a hard `IDENTITY_CHANGED`, including
  postAdoption. Native self assertPrecompile, F_GETFD, compiler boundary, deadlines and
  frame/schema/authority remain unchanged.
- Pending: the semantic code is UNWRITTEN and a new mocked observer RED is being authored,
  including a unit for this stricter pending boundary. A whole-function `assertPrecompile`
  extraction from `observe` to the existing `build` is being authored to preserve the 300 cap,
  with the old export re-exported and its body byte-identical — not yet frozen, reviewed or
  validated. No new source names or modules, and no release of PR03/04/DB/`validate`. This is
  pending implementation/TDD; all counters and BLOCKER-007 remain unchanged, and earlier probe
  outcomes are preserved.

## AS-OF 2026-10-21: mechanical extraction verified; semantic TDD pending

The native gate is stopped at PR02. The two-site failure-only probe located the refusal at the
original `observe:68` inherited coordinatorFD CLOEXEC guard (not `processes:293`, with the
resource diagnostic recording total duration 5688.845346ms and test duration 5622.738644ms).

- Mechanical extraction is DONE and verified. `observe` `e5105e1d…` (298 lines) became
  `08b726fe1b1f6667b27fe7b62e35203b277c7cdae63c96fbb1a325ee597b658d` (280 lines), and `build`
  `2dd98cedcb32a5ce223f406e8fdd1c82280ec9d00b7803a31ee656b041d5be65` (232 lines) became
  `078dad1653243e82b769228b8235f6e3976256012e9c30a24b28362c5a554b97` (255 lines). ROOT proved
  the full inverse hashes of both originals, that the whole moved `assertPrecompile()` (19
  lines) is byte-exact, that the old export is re-exported, and that all other 30 production pins
  are original; the static import DAG is acyclic (17 MJS) with no new source names. The resource
  original `c181d73b…` is restored with no diagnostic variant left.
- Actual sequential check (session 17500) was terminal 0: Prettier on 2 production files, ESLint
  on 2 with `max-warnings 0`, Node `--check` on 2, then the existing 8 exact unit files at
  412/412 pass, 0 fail, 0 pending; raw
  `.lane-logs/s12-native-precompile-extraction-green-20261021.json` SHA-256
  `ed296d03b0015c55d2f1d90485793e3c4675843e7e4ab3e817fb59b94f407dc1`. Separately, pinned Node
  inert imports and `observer.assertPrecompile === build.assertPrecompile` with arity 0 were
  actual terminal 0; no factory, capability or native execution ran in that check.
- Semantic startup fix is UNWRITTEN and a new mocked actual-observer RED is under authoring. No
  PR03/04, DB, `validate`, counter or acceptance change.

## AS-OF 2026-10-21: meaningful TDD RED reached; semantic implementation pending

The native gate is stopped at PR02 with the refusal at the original `observe:68` inherited
coordinatorFD CLOEXEC qualification, and the TDD RED is now meaningful. The semantic single-file
`observe` fix is RELEASED to the execution actor but not yet written, frozen or validated.

- Frozen RED artifacts (tests frozen): `tests/contracts/phase-02-slice-11-dec203-coordinator-startup.test.ts`
  344 lines SHA-256 `2ded22c4b33c75d5de23f204d8cb545997cbfb6edfff3d8d3c53e2357e0361d3`; fixture
  `tests/contracts/helpers/dec203-coordinator-startup-fixture.ts` 277 lines SHA-256
  `f1934a3a0e2680a5d50e34ebeac3aa452e71e51f5653194f1797fc47fe0a1f1b`; type helper 71 lines SHA-256
  `833647a6e08012b467a58e12282f5b2935c5fb8791d4ef04391f6b58c4661810`. ROOT fixed a positive-oracle
  defect before runtime (`process(name)` full capture vs nested process), added 8 qualified
  regression cases, strict planned mocks, fresh fixture images and a type-only no-back-edge split.
- Actual `vitest` RED (session 57098) terminal 1: 30 tests, 21 pass, 9 fail, 0 pending; raw
  `.lane-logs/s12-coordinator-startup-unit-red-20261021.json` SHA-256
  `3588c8eb8470b48938bd5b3e300efdc59ff3a5aaa2daf7f850418a4d0cc4a7d1`. Only the initial pending CS03
  (FD3–10) and CS04 fail on the actual `IDENTITY`; baseline positive and all hard
  corruption/qualified/compiler/latch/postAdopt controls pass. No loader/setup failure counted RED.
- Format/lint on all 3 files terminal 0. Supplemental strict `noEmit` first raised TS2688 (no
  workspace `@types/node`; none in the lock; protected deps unchanged), then a TS2322 lockRow
  literal widening repaired with an explicit `StartupLockRow` return type, then 0 — using bundled
  `@types/node` 25.9.5 as diagnostic only, not a Node22 or canonical gate. Runtime pinned Node
  22.23.1.
- Source support (not timing proof): official Node v22.23.1 sources re-fetched under bounded
  concurrency 4 MATCH the inventory pins — `node.cc` 58177 bytes SHA-256
  `878553644444ef00f8d3c2a144b5b6ff542c9235cff774f23dd4e9ddb364a73a`, uv `core.c` 48102 bytes SHA-256
  `bebf5062eefb617a1d03e5e78f864b6384e14fb7055d534c3a092fc2132f4ac4`; `node.cc` 895–899 invokes
  `uv_disable_stdio_inheritance`, `core.c` 800–808 attempts CLOEXEC on the first 16 FDs, and the
  local unchanged `receiving-lease-owner.c` 43–64 clears `FD_CLOEXEC` 3–10 before `execve` Node.
- Latest weekly usage 20%. No native rerun and no PR03/04, DB, `validate`, counter or
  canonical-receipt credit change.

## AS-OF 2026-10-21: semantic observe written/frozen; focused GREEN; causal controls pending

The semantic single-file observer is WRITTEN and frozen production GOLD:
`infra/database-upgrades/native-tracing/receiving-bootstrap-observe.mjs` 285 lines SHA-256
`e415bd96b259e93a706f294f62d4ac60b77003c60bc634eb8e50030673d5d664`, with `build` unchanged at
`078dad1653243e82b769228b8235f6e3976256012e9c30a24b28362c5a554b97`. Main independently reviewed
the exact diff: the source-only old-semantics inverse is byte-exact `08b726…`, and all other 30
original production pins are unchanged.

- Actual FIRST GREEN (session 8702) CLOSED 0: scoped Prettier/lint/Node 22 syntax 0 and 9 files at
  442 tests, 442 pass, 0 fail, 0 pending; raw `.lane-logs/s12-coordinator-startup-green-20261021.json`
  SHA-256 `30e87c04e782d504964f160490fdadaf4a8524438c2c5a89b3d6b5bb7a1502c2`. The original frozen
  three unit/helper/type pins are unchanged.
- Actual causal old-semantics replay was terminal 1: 30 tests, 21 pass, 9 fail, 0 pending, with ONLY
  CS03 (FD3–10) and CS04 failing on the actual `IDENTITY` (same RED); raw
  `.lane-logs/s12-coordinator-startup-old-semantic-replay-20261021.json` SHA-256
  `3ca244d88ee088f1fcf455fd467c66118640c9b56adc85cbd9c4540b278d59c5`.
- The no-latch mutant control is still pending (no native on the mutant), and the native rerun
  stays HELD until the restored validation.

Latest weekly usage is 21% (2026-10-21 21:38 UTC; prior 20% is historical). BLOCKER-007 remains
active; no counter, canonical, native or DB credit change.

## AS-OF 2026-10-21: PR01–PR03 passed; PR04 identity refusal under investigation (gate stopped)

On the restored GOLD observer, the actual native sequential run passed PR01–PR03 and then STOPPED
at PR04.

- Causal controls complete, restored validation passed: the no-latch negative (session 9624)
  CLOSED 1 with 30 tests, 21 pass, 9 fail, 0 pending (ONLY CS07 and CS09 failing on FD3–10; raw
  `.lane-logs/s12-coordinator-startup-no-latch-negative-20261021.json` SHA-256
  `20ccf440c52791ad97488313fc6b6db45427bf0bef5aaddd3ad16630376f9860`); the observer was then
  restored byte-exact to GOLD `e415bd96…` and no negative variant remains. Final restored
  validation (session 95460) CLOSED 0: format 5 / lint 5 / syntax 2, 9 unit files 442 pass 0 fail 0
  pending, a supplemental strict TS diagnostic (existing Node 25 types, NOT Node22 compatibility),
  configured `pnpm type-check` 0 and `progress:check` 0; final raw
  `.lane-logs/s12-coordinator-startup-restored-final-green-20261021.json` SHA-256
  `e11babea8ee4578314a69defa14cf5d088b9f3f9d02fce333d51b7007e56bb02`.
- Actual native PR01 (session 23742) CLOSED 0: tests/pass 1, fail/cancel/skip/todo 0; test
  8386.950156ms, total 8460.37854ms. PR02 (58189) CLOSED 0: 1 pass, 0 others; test 9267.399364ms,
  total 9354.464123ms. PR03 (55742) CLOSED 0: 1 pass, 0 others; test 8224.035781ms, total
  8298.045713ms. Each retained the explicit native F_GETFD + inner SETTLED/FINISH
  producer-mediated diagnostic (not direct TEST sightings; no workflow authority).
- PR04 (session 82729) CLOSED terminal 1: tests 1 / pass 0 / fail 1 / cancel 0 / skip 0 / todo 0;
  test 6711.682555ms, total 6806.013819ms. Harness assertion 230 asserted exit 0 but the actual
  exit/actualClose code was 1 with signal null. Validated-prefix diagnostic only: failure
  `DEC203_SUPERVISOR_IDENTITY_CHANGED`; `ownerWait` pid 745605, start 6728516, exit 1, null; local
  state closed, input eof, ownerInput/commands finished, ownerStdout/ownerStderr/events eof; owner
  compiler exit 0, stdout/stderr eof, session absent; roles outer/owner-compiler/owner/coordinator/
  lease-compiler with 3 inventory records. No guard or phase beyond the exact prefix is inferred.
- Main independently rechecked all 35 gold production/sealed-TEST pins, the pinned Node/GCC hashes,
  13+2 immutable JSON, 9 recovery CJS files and the 17 slice checkbox arrays — all unchanged.

The gate is STOPPED AT PR04 after the actual sequential PR01–PR03 successes; PR04's identity refusal
is under investigation pending source review. No blind retry, no PR04 pass, and no full-factory/DB/
`validate`/counter/canonical acceptance credit. The GOLD observer and meaningful TDD controls are
preserved.

## AS-OF 2026-10-21: PR04 gate stop; two-site refusal sites identified; error-only diagnostic pending

The original restored-source PR04 failure remains the gate STOP. Main is source-reviewing two exact
existing sampler refusal sites — `processes:86` valid-stat Z/X liveness rejection and
`processes:293` final FD target allowlist — with no semantic change authorized. A NEW error-only
two-site diagnostic is being prepared under a root-selected finite reproduction window of at most 4
fresh PR04 invocations, stopping at the first failure.

- A temporary failure-only resources class label (299 lines SHA-256
  `b662a5c3202f8babe01a1d54ffb28c4ef26b12a4fd36cc6fdadadaafb0d7f1fe`) was main-reviewed: exact
  inverse `c181d73b…`, other 31 production pins unchanged, scoped format/lint/Node22 syntax 0, and
  30 isolated VM label+cause cases PASS 30 (not native proof).
- ONE named PR04 diagnostic (session 63175) CLOSED 0: pass 1, fail/cancel/skip/todo 0, test
  8381.766324ms, total 8508.655685ms. Neither the observe nor the processes failure label was hit,
  so there is NO cause confirmation, acceptance or stable-fix evidence.
- The actor restored resources exactly to
  `c181d73bfa7903a73edb624832d9869571123011ae0c0f03755cdf01ed65b597` (295 lines); the observer
  `e415bd96…` and build `078dad16…` are unchanged.

Every modified-variant pass remains non-acceptance. No new global/privileged scan, services, signals,
cleanup, DB/`validate` or counter/canonical credit change; the first-fail and prior meaningful TDD
evidence are preserved.

## AS-OF 2026-10-21: PR04 guard located at processes:86; process-facts RED under authoring

The finite at-most-4 PR04 reproduction window STOPPED after the FIRST attempt, and the first-fail
location is now positively identified.

- Two-site resources variant (299 lines SHA-256
  `6083352563a9fbb1c96e6d8e6063fc2278ec05345787de60d5ebbffc1a5ea476`) was main-proven as the
  exact inverse `c181…` with the other 31 production pins unchanged; scoped format/lint/Node22
  syntax 0; 40 isolated exact-site VM label+cause cases PASS 40 (not native proof).
- FIRST attempt (session 76407) CLOSED 1: tests 1 / pass 0 / fail 1 / cancel 0 / skip 0 / todo 0;
  test 6563.994103ms, total 6761.160335ms. The failure `REFUSED` positively locates the first
  matching actual `processes:86` guard, NOT the FD-target `processes:293`. The raw stat value (Z vs
  X) is not logged, so the exact state is not directly observed. Same prefix closure: actual
  exit/close 1, null; owner 797291 / start 6793725 / exit 1 / null; local closed / input eof / all
  channel closures; owner compiler 0 / eof / session absent. Attempts 2–4 were NOT RUN.
- Resources were actor-restored exact
  `c181d73bfa7903a73edb624832d9869571123011ae0c0f03755cdf01ed65b597` (295 lines); observer
  `e415bd96…`, build `078dad16…` and `processes` `c066…` are unchanged.

Main's source-research confirms the guard combines structural field validity with Z/X exclusion. A
meaningful NEW process-facts RED unit is under authoring
(`tests/contracts/phase-02-slice-11-dec203-process-facts.test.ts`, currently not frozen or
validated). Planned private behavior: a syntactically/stat-identity-valid Z/X throws the existing
marked-incomplete `HISTORY_GAP` / no facts, allowing ONLY the existing finite observer retry;
malformed/numeric/start-time/nonpositive stat ancestry stay hard, and the live UID/metadata guards
are unchanged — no exit/wait/drain/authority proof. No production semantic change is released until
the actual meaningful RED.

Source support (not actual state/timing proof): the official Linux man-pages
`https://man7.org/linux/man-pages/man5/proc_pid_stat.5.html` SHA-256
`0f04d78946538fd84db1536845abeb236da51a04844989f34ea7ee7cb0b6700f` (20647 bytes) documents `Z`
(Zombie) and `X` (Dead), supporting the interpretation but not the actual failed state or timing.
The gate remains STOP at PR04; no DB/`validate`/counter/canonical credit.

## AS-OF 2026-10-21: process-facts RED reached (44 cases, 4 fail); semantic fix released

The meaningful process-facts RED is reached, and the single-file semantic fix has been released (not
yet written, frozen or GREEN).

- NEW unit `tests/contracts/phase-02-slice-11-dec203-process-facts.test.ts` 268 lines SHA-256
  `4b9bb99a58efd57edc8437b25e0c9d8c69687180104f3b6e385fcef01048d080`, 44 runtime cases. Main fully
  read and reviewed it: six zero/negative ppid/group/session hard controls across live+Z+X; malformed
  records/numeric/start-time hard; invalid PID with no reads; an actual `observationRace` and strict
  planned-FS mocks; live S → both Z/X controls; no native proof. One 83-column unbreakable literal
  module path matches the existing unit and Prettier (no false ≤80 claim).
- Actual RED (session 47865) CLOSED 1: 44 tests, 40 pass, 4 fail, 0 pending — ONLY PF03 (valid Z/X)
  and PF10 (live S→Z/X) fail on the actual `IDENTITY` rather than the required marked-incomplete;
  the baseline and all 40 hard guards PASS, with no setup/loader failure. Raw
  `.lane-logs/s12-process-facts-unit-red-20261021.json` SHA-256
  `0bcbe8d2254a357189e8870f41e459d3f3a0654fb3ea20c6a935bdb08fec66d4`.
- Unit Prettier/lint 0 and a supplemental strict TS diagnostic 0 (same existing Node25 type root as
  the only extra, not a Node22 canonical gate).
- Main RELEASED the exact single-file semantic fix to the execution actor AFTER the actual RED (not
  yet written, frozen or GREEN). On the current `processes` original `c066…` (299 lines): the
  structure-only initial guard stays, then after all numeric/start-time checks the Z/X branch first
  validates positive stat ancestry and then calls the existing `incomplete()`; the live metadata
  guard bytes are unchanged, with no facts/exit/drain/authority/retry-budget change. Planned
  candidate `ff9341d6642cfdba96086153983fa50a5cd46834c4ce498f166130147fdcdadd` (299 lines).

All other 31 production pins stay gold; resource original `c181…` restored; observer `e415bd96…`
and build `078dad16…`. The gate remains STOP at PR04 pending semantic GREEN, causal controls,
restored validation and a new sequential native run. No DB/`validate`/counter/canonical credit.

## AS-OF 2026-10-21: process semantic written/frozen; first GREEN; causal controls pending

The `processes` semantic fix is WRITTEN and frozen, with the first GREEN reached.

- Production `infra/database-upgrades/native-tracing/receiving-bootstrap-processes.mjs` 299 lines
  SHA-256 `ff9341d6642cfdba96086153983fa50a5cd46834c4ce498f166130147fdcdadd`. Main reviewed the
  exact diff and independently proved the inverse `c066…`, all other 31 production pins gold, and
  the new unit frozen (`4b9bb99…`). The only change is the shape `ensure` plus the Z/X branch after
  all numeric/start-time checks, with positive ancestry before the existing `incomplete()`; the live
  guard bytes are unchanged.
- Actual first GREEN (session 42512) CLOSED 0: scoped Prettier/lint/Node22 syntax 0; 10 unit files
  at 486 PASS, 0 fail, 0 pending. Raw `.lane-logs/s12-process-facts-green-20261021.json` SHA-256
  `9a0fd0f7e12cb7d61f342ab0eee40881b7869af355ce27f6d8931c0417ffd956`.
- The causal old-semantics replay has now been released to the execution actor; the
  terminal-ancestry-guard removal mutant and the restored final validation are pending. No native
  runs on the negative variants, and the gate stays STOP at PR04 until the restored validation and a
  new sequence.

Earlier 44-case RED, the exact native guard location and all holds are preserved. No
DB/`validate`/counter/canonical credit.

## AS-OF 2026-10-21: causal process controls complete; GOLD restored; final validation running

The causal process controls are COMPLETE and the production GOLD is RESTORED; only the final
validation is running.

- OLD replay (session 11225) CLOSED 1: 44 tests, 40 pass, 4 fail, 0 pending — ONLY PF03 (Z/X) and
  PF10 (S→Z/X). Raw `.lane-logs/s12-process-facts-old-semantic-replay-20261021.json` SHA-256
  `ba0999826aa712ba0c21516fcfa0486e1f931534e7f36cd6479453899986df7a`.
- Then the intermediate GOLD `ff934…` was verified before removing ONLY the terminal ancestry guard
  → mutant `667ce87b1da3a510854a946cf34f39f39d0e523aa369c3d43844a52a2ed47638` (298 lines). Main
  independently proved the single-line inverse `ff934…` and that unit `4b9bb99…` is unchanged.
- Actual negative (session 21980) CLOSED 1: 44 tests, 32 pass, 12 fail, 0 pending — ONLY the 12 PF08
  zero/negative ppid/group/session × Z/X cases failed on the actual marked `HISTORY_GAP` instead of
  the hard `IDENTITY`; no fixture/setup failure. Raw
  `.lane-logs/s12-process-facts-no-ancestry-negative-20261021.json` SHA-256
  `b88b8083bcfe06aa5b07a5f3ea731c0464ecc3f0fae76bd476bf2a011d5667c5`.
- The actor then restored the EXACT GOLD
  `ff9341d6642cfdba96086153983fa50a5cd46834c4ce498f166130147fdcdadd` (299 lines); no negative
  variant remains, and no native ran on the negative variants. Main checked all 32 composite gold +
  4 frozen TS pins and they all match.
- The final validation (session 47201) is RUNNING (format 7 / lint 7 / syntax 3 / supplemental TS 4
  diagnostic / 10 unit files / project typecheck / progress). The final GREEN is not claimed until
  the actual result, and the fresh sequential PR01–04 is HELD until that terminal 0.

Latest integrity audit: 15 immutable JSON, 9 recovery CJS and 17 checkbox arrays unchanged; the
primary checkout has only the two original untracked cms-editorial dirs and no stray new test; the
owned HEAD `b16edb54…` / branch `claude/phase2-slice12` unchanged; canonical S12 receipt ABSENT. The
gate remains historically STOP at PR04 with no DB/`validate`/counter/canonical credit.

## AS-OF 2026-10-21: restored final validation passed; fresh sequential native started (PR01)

The restored final validation PASSED and the fresh sequential native sequence has just started.

- Final validation (session 47201) CLOSED 0: 7 format/lint files, 3 MJS syntax, 4 TS supplemental
  strict diagnostic (Node25 types as the only extra, NOT Node22 compatibility), 10 unit files at 486
  tests PASS, 0 fail, 0 pending; configured `pnpm type-check` 0 and `progress:check` 0. Raw
  `.lane-logs/s12-process-facts-restored-final-green-20261021.json` SHA-256
  `b48b8097d87b9150c07cb2c007ccee74b9e826f2cc589f33b8ae727d9d4bce7f`.
- Main rechecked the gold 35 production/sealed-TEST pins and the Node/GCC exact hashes plus canonical
  paths — all match; no negative variant remains. The composite production 32 is now original except
  `build` `078dad…`, observer `e415…` and `processes` `ff934…`; resources original `c181…`.
- The fresh sequential native sequence has just STARTED as PR01 alone (session 32145), with no other
  Node22/pnpm/GCC jobs during native. No actual native pass is claimed until the results are sent.

The old PR04 failure remains historical with the gate pending the fresh sequence; no DB/`validate`/
full-factory/counter/canonical credit.

## AS-OF 2026-10-21: fresh native sequence PR01–PR02 passed; PR03 running

On the restored semantic GOLD, the fresh sequential native sequence passed PR01 and PR02, and PR03 is
running.

- Fresh PR01 (session 32145) CLOSED 0: tests/pass 1, fail/cancel/skip/todo 0; test 7670.740549ms,
  total 7738.621901ms. PR02 (session 2516) CLOSED 0: 1 pass, 0 others; test 7992.03286ms, total
  8073.491241ms. Each retained the explicit native F_GETFD + inner SETTLED/FINISH producer-mediated
  diagnostic (not direct TEST sightings; no workflow authority).
- PR03 is now running alone (session 88783). No PR03/PR04 result and no DB yet; no actual native pass
  is claimed beyond the confirmed PR01/PR02 closures.

The restored final validation (session 47201) passed and the causal controls are complete with GOLD
restored. The old PR04 failure remains historical with the gate pending the fresh sequence; no
DB/`validate`/full-factory/counter/canonical credit.

## AS-OF 2026-10-21: fresh sequence stopped at PR04 with a new TEST closed-target refusal

The fresh sequential native sequence passed PR01–PR03 and STOPPED at PR04 with a NEW TEST observer
failure that is DIFFERENT from the old producer identity refusal.

- PR04 (session 63224) CLOSED 1: tests 1 / pass 0 / fail 1, cancel/skip/todo 0; test 7740.266787ms,
  total 7829.886294ms. First error "closed diagnostic target", TEST `observe.mjs:159` inventory,
  sample 227, harness 127.
- DIFFERENT from the old producer IDENTITY refusal: the validated-prefix producer actual exit /
  actualClose was 0 with null; local state closed with failureCode `CANCELLED`; owner 894591 / start
  6915089 / exit 0, null; input eof, ownerInput/commands finished, ownerStdout/ownerStderr/events eof;
  owner compiler 0 / eof / session absent. The prefix had 4 inventory records and lease artifacts, but
  no pass or phase beyond the exact validated prefix is inferred. No raw unknown target was emitted or
  inferred.
- Fresh PR01 (32145), PR02 (2516) and PR03 (88783) successes remain scoped; PR04 is NOT a pass. No
  DB/`validate`/full-factory/counter/canonical credit.

The GOLD facts of the current semantic sequence are preserved; Main is source-reviewing the TEST
inventory guard ordering before any diagnostic, retry or semantic change, with no new
global/privileged reads or cleanup.
