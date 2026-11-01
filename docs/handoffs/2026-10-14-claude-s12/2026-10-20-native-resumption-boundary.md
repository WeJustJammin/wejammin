# Slice 12 native resumption boundary — 2026-10-20

Phase 2 remains incomplete. This is a current-state diagnostic record, not a
native, database, hosted, slice-completion or phase-completion receipt.

## Current native dispatch checkpoint — 2026-10-21

- The exact `Phils-Charm/deepseek-v4.1-flash` route returned HTTP 402 (out of credits). Human authorization then allowed native execution. Delegated execution inherits native `gpt-6.1-sol` at `high`; main remains `gpt-6.1-sol` at `ultra`.
- The latest fresh native sequence passed PR01 (32145), PR02 (2516), and PR03 (88783), then stopped at PR04 session 63224 CLOSED 1 with first error `closed diagnostic target`; TEST `observe.mjs:159`, sample 227, harness 127. Producer actual exit 0 with `CANCELLED` is **not** a pass.
- Main source review found the target guard after coherent FD + process bracketing; the ordering hypothesis is not proved. At this 2026-10-21 checkpoint, root was investigating transient `/proc` metadata and no new diagnostic, fix, or run had occurred; subsequent evidence is recorded below.
- No counters, checkbox arrays, criterion wording, denominators, completion signatures, canonical receipts, JSON, or source edits. Historical evidence and unrelated dirty work remain preserved.

## Native PR04 diagnostic follow-up — 2026-10-21

- Main's message-only TEST probe `156093…300` left the guard predicate unchanged; inverse ROOT verification passed. Static/session `89616` CLOSED 0 (format/lint/syntax/progress) and three unit files were 71 pass/0 fail; raw `.lane-logs/s12-pr04-target-probe-static-unit-20261021.json` SHA `c62ac74577e81f0f2bd3fcb08fa069cfd738d6912e8b66b162522d2b66870763`.
- One PR04 session `87613` CLOSED 1 (`test 6575.833431ms`, total `6653.087129ms`) did not reproduce the TEST target. Producer actual exit/close `1/null`; local closed `IDENTITY_CHANGED`; owner `1727172/start 8119918/exit 0/null`; channels finished/eof; owner compiler `0/eof/session absent`; 3 inventory records; no cause proved. Restored exact TEST `d2b5…298`.
- Two-boundary probe reused the same TEST plus resources `f8210b9be40cc9e918618c0911e547f4db54b437f7458f3916d1cf6fedf70833` (300); only default-ensure actual-caller-processes `293:3` maps were `UNAVAILABLE`. No raw target/stack/PID logging, new reads, or predicate changes. Static/session `31938` CLOSED 1 (format/lint/syntax passed); four unit files had 97 tests, 93 pass/4 fail only FS02 and FS07×3 because diagnostic mapping changed IDENTITY→UNAVAILABLE; this is intentional mapping control, not GREEN.
- One PR04 session `83544` CLOSED 0 (`test 6405.434469ms`, total `6488.943558ms`, 1 pass, others 0); neither refusal reproduced, so no cause confirmation or acceptance credit. Root restored both exact TEST `d2b5…298` and resources `c181…295`.
- Historical 2026-10-21 window plan: Main selected at most three new named PR04 diagnostic invocations, stopping at first failure; data-only, no retry until GREEN. Probes were reapplying and the window had not executed at that checkpoint. No DB/`validate`/full-factory/native-080/canonical/counter/checkbox credit; no privilege/global-permission renewal.

## Native PR04 finite-window result — 2026-10-21

- The finite window stopped at the first failure on attempt 2; no attempt 3 ran. Attempt 1 session `37257` CLOSED 0 (tests/pass 1, other 0; test `8345.784842ms`, total `8413.258761ms`). Attempt 2 session `30694` CLOSED 1 (tests 1/pass 0/fail 1/other 0; test `8500.516284ms`, total `8568.543091ms`).
- Attempt 2 producer actual exit/close was `1/null`; local closed `UNAVAILABLE`, uniquely mapping the failed default-ensure caller-processes `293:3`. Owner `1752958/start 8149806/exit 0/null`; input EOF; channels finished/EOF; owner compiler `0/EOF/session absent`; 3 inventory records. This locates the final FD-target guard but does not prove target class, native safety, or pass.
- Root restored both exact TEST `d2b5…298` and resources `c181…295`. At that checkpoint, root was source-reviewing a class-only failure probe in existing diagnostic-values; the follow-up is recorded below.

## Native PR04 class-only `/proc/locks` checkpoint — 2026-10-21

- Production diagnostic-values temporary preformat `69707…232` was followed by root Prettier `a841bb82cbfe73318d03f9d570274968f5e78a327bbe7545d8575476af037b1a231`. The original predicate is unchanged; only failed `/proc` classes receive existing error tokens, and exact `/proc/locks` maps `UNAVAILABLE`. Root inverse baseline is proven at `d6d233de0eacc3c1aabcddf35317d15d16df09458fd5f521ada29dbd8d9d1bca217`.
- Initial static format failed, then scoped format/lint/syntax plus four unit files passed 97/97 with 0 fail and 0 pending; session `19584` CLOSED 0. Raw `.lane-logs/s12-pr04-class-probe-static-unit-20261021.json` SHA `f7c281388594d0f6e6829784acf83ceda1bb28a24f9cf7ab82d92ab67504a606`.
- Separate 15 fixed-literal self-checks CLOSED 0 with no `/proc` reads. The native window (at most 3) stopped on its first attempt: PR04 session `64867` CLOSED 1 (tests 1/pass 0/fail 1/other 0; test `6148.025107ms`, total `6247.506107ms`), producer actual exit/close `1/null`, local `UNAVAILABLE`, owner `1773836/start 8172869/exit 0/null`, input EOF, channels finished/EOF, owner compiler `0/EOF/session absent`, 3 inventory records. This locates the mandatory `/proc/locks` metadata conflict; it does not prove target class, native safety, or pass. All diagnostic probes are now absent.
- Main reviewed `UNAVAILABLE` source collisions: the other JS site is initial Linux/version admission already passed; native transport errors remain separate failure paths. No acceptance claim. Root restored exact values `d6d233…217`.
- Main wrote private additive DEC203 selection docs through `evolve-contract`: `briefs/codex-dec203-proc-locks-metadata-selection.md` and the DEC203 subentry in `decisions.md`. Selection is only literal `/proc/locks` with strict flags `02400000/02500000`, full mode `0100444`, UID/GID 0, pidfd null, and independently named dev/inode/owner metadata; no compiler phase, wildcard, new authority, public contract, or DB change. Historical pin manifests remain immutable.
- Historical at that checkpoint: RED tests were authoring only and no semantic source release had occurred; the frozen RED/source-release checkpoint follows.

## DEC203 `/proc/locks` contract freeze and source-release checkpoint — 2026-10-21

- `evolve-contract` selected exact private metadata binding, not a public API or DB change. The first post-format contract test was 402 LF over cap (session `61254`: 61 tests, 48 pass, 13 intended failures, 0 pending); a cohesive type-only helper plus shared invalid-row matrix fixed it without minification. Agent B's boundary additions were 428/403 LF over cap; a pure observation-fixture helper plus named-identity negatives fixed those caps.
- Frozen test artifacts: `proc-locks-metadata.test.ts` 353 LF SHA `b835aae3fdd2d9a86ddb1bc4447d970356326045770ad349d822d7022ffd28a4`; `types` 50 LF SHA `e0c76e70176abc47443bbe885d9c0db40566e367be1a293e2e823276bdd20410`; `fd-snapshot.test.ts` 376 LF SHA `3676f70d284e2cbc474dc76930d1c7bd8f1e875d40f1989752dfac1d6d69894e`; `test-observer-inventory.test.ts` 395 LF SHA `46ac92335a7910119fb206036d000f40429069d1b3dffd2a327b7cb1403a6302`; `dec203-test-observer-proc.ts` 300 LF SHA `450383a50e097abb280b5f67c998632fd3c02993696550ba0d1fddef8895521a`; observation fixture 99 LF SHA `3b6ab7f7430f41ec2ba21d3200f530236639c0206b4d8c632e5d03e5b4a4b4d6`.
- Mechanical whole anchored `processes→protocol` guard inverse is exact (`ff934…299`, `097bce…234`; current `a3744dff…524f292`, `b610347c…ac90243`). Scoped format/lint/syntax plus three unchanged unit files passed 207/207, 0 fail/pending; session `28566` CLOSED 0; raw `.lane-logs/s12-proc-locks-mechanical-anchor-green-20261021.json` SHA `374788205697caba412d3917a68011402ee154babe86ec0a49aaa495775145ff`.
- Final actual RED session `81816` CLOSED 1: three files, 145 tests, 128 pass, 17 intended positive failures, 0 pending; raw `.lane-logs/s12-proc-locks-frozen-final-red-20261021.json` SHA `c6d5f37334475ae3ca6ed4b525ccaac220991dea83b4e45af692890dc6877982`. No setup or missing-API failures.
- Historical at that checkpoint: the GREEN source release was bounded and had no semantic GREEN result or native rerun; the independent-review checkpoint follows.

## Independent-review and semantic-GREEN checkpoint — 2026-10-21

- Semantic candidate: production `processes` 300 LF SHA `9d8f8821d9640eeb7d0065a34c091ad8fdcf0d2f294aad250b6de5f421eefb37`, `diagnostic-values` 247 LF SHA `cf72b8662c03656d7693d0f99c6ed06cfc152129cc0e94461ef735ded4e1183b`; protocol mechanical `b610…243` frozen. TEST artifacts: 2907eac9e…; `observe` 300 LF SHA `c4704820333b024707eb2250b7a5d5b2dd5378585bbeb57696ec7a563eb753e9`; `values` 282 LF SHA `52799d69fdb4ee59238903a122def13cb3f59ebfc7a79fdb0d48bec85a142dac`; `assertions` 296 LF SHA `17b125…`.
- Root independently proved production semantic inverses exact mechanical `a374…292` / original `d6d233…217`, and TEST-artifact inverse exact `e91655db6edefe2dab7d41893777e8d911fdbb22d608b5ec465c2f6814438106`.
- Review found required FD metadata could bypass the compiler guard. New TEST case “TEST refuses metadata disguised as required compiler stdio” was targeted RED in session `76912` CLOSED 1 (selected 1, fail 1, 62 filtered, pending 0); raw `.lane-logs/s12-proc-locks-required-stdio-red-20261021.json` SHA `e51b8d95564f94df5c4c4f50b04ab2cfe2e59dcdf15a756db9cbb46594026831`. The guard now sends every metadata row, including required rows, into target checks.
- Supplemental strict TS initially failed session `41128` on Node 25 declarations only; fixes added literal bigint types, existing `getuid` narrowing, and FS08 tuple typing with no runtime change. First full GREEN session `50282` CLOSED 1 (static format/lint 7 MJS + 7 TS, syntax 7, supplemental TS pass, 11 unit files: 586 tests, 583 pass, 3 fail, 0 pending). Remaining failures were oracle defects: OT08×2 expected 9 rows but fixture has exact 8 `[0,3,4,5,6,7,8,9]`; OT10 injected EACCES expected `ERR_ASSERTION`.
- Historical at that checkpoint: corrected TEST observer and session `80743` rerun were still pending; the completed scoped GREEN and causal replay state follows.

## Scoped GREEN and causal OLD-SEMANTICS replay checkpoint — 2026-10-21

- Session `80743` CLOSED 0: 11 files, 586 tests, 586 pass, 0 fail, 0 pending; format/lint (7 MJS + 7 TS), syntax 7, supplemental strict TS (Node 25 declarations only), configured `pnpm type-check`, and progress check all exit 0. Raw `.lane-logs/s12-proc-locks-oracle-repaired-green-20261021.json` SHA `f17571d97ddb70720258e55acd62c729a335c4fa1b7cd1dfd22d6815f8c1f5cf`.
- Root wrote local 14-file freeze verification `verification/2026-10-21-proc-locks-metadata-green-source-pins.json`, explicitly not native or phase acceptance. Causal OLD-SEMANTICS replay is underway: producer 2 reverts to mechanical `a374…292` / `d6d233…217`, protocol `b610…243` retained; TEST 4 reverts exact old `e91655…255` / `d2b5…298` / `880fea…253` / `666e87…295`. TS is frozen (observer oracle `a8a97f…395` and required-stdio regression present, shared typed fixture plus `getuid`/tuple fixes).
- Historical at that checkpoint: no native run had occurred on the old variant and the 18-failure expectation was pending; the replay result and GOLD restoration state follow.

## OLD-SEMANTICS replay result and GOLD restoration checkpoint — 2026-10-21

- Causal OLD-SEMANTICS replay session `80562` CLOSED 1: 11 files, 586 tests, 568 pass, 18 intended failures, 0 pending. Raw `.lane-logs/s12-proc-locks-old-semantic-replay-20261021.json` SHA `c356502a38f761fbe6e221f80e84709b3400cab677bfed3b5cec4aaf4a8df629`.
- Exactly 17 selected metadata-positive cases plus the OT10 exact-EACCES discriminator failed as intended; no setup or unrelated failures. Actors are restoring the 14-manifest GOLD now: production 2 remains exact `9d8f…300` / `cf72…247`, protocol `b610…243` retained, and TEST 4 restoration is in progress. No mutant or native job is running.
- Historical plan at that checkpoint: root would verify all 14 GOLD manifests and run the pure descriptor guard-removal negative; the canonical guard-negative result follows.

## Canonical descriptor guard-negative checkpoint — 2026-10-21

- Canonical guard-negative session `39609` CLOSED 1: 586 tests, 569 pass, 17 fail, 0 pending; raw `.lane-logs/s12-proc-locks-descriptor-guard-canonical-negative-20261021.json` SHA `ae5abe34eba9c85d4a5c39ac2e98cff3a146230e36d287e1576982024e49a276`.
- Exactly five FS14+12 PROD guard-refusal cases failed, proving the guard discriminator. The prior 16-failure control used noncanonical missing-CLOEXEC input `00400000`; one TS literal was corrected to canonical `0400000`. Current test SHA `79a42d6d7a81ccb942b7ed8a3fc3dc88a7d3b0e12b0ac060da6bd1f46b3c22e8`, 385 LF.
- Historical at that checkpoint: 14-pin v1 remained immutable and v2 was pending final restore-GREEN; the restored-final result follows.

## Restored-final scoped GREEN and native PR01 boundary — 2026-10-21

- Restored final scoped session `66977` CLOSED 0: 11 files, 586 pass, 0 fail, 0 pending. Format/lint 14, syntax 7, supplemental Node 25 declaration strict TS, configured `pnpm type-check`, and progress checks passed. Raw `.lane-logs/s12-proc-locks-restored-final-green-20261021.json` SHA `7c75c81f9c127f8e856814e503bc23d5ecb0b4fcdf91ec84b12636d3a8300f46`.
- Root 14-pin drift is empty; selected source 32 / MJS 17, missing imports empty, DAG cycles empty, all selected caps ≤300. Node 22/GCC exact expected SHAs verified. Root wrote local source-freeze v2 `verification/2026-10-21-proc-locks-metadata-green-source-pins-v2.json` (not native or phase acceptance); v1 remains untouched.
- Historical at that checkpoint: restored native PR01 was starting under root only; the sequential native result follows.

## Restored native PR01–PR04 result — 2026-10-21

- Sequential restored native runs: PR01 session `20862` CLOSED 0 (test `7135.40826ms`, total `7206.97156ms`); PR02 `82164` CLOSED 0 (`7409.83804ms`, total `7477.695093ms`); PR03 `29983` CLOSED 0 (`7105.618945ms`, total `7175.855187ms`). Fourteen-pin drift was empty between each run.
- PR04 session `15839` CLOSED 1 (`7716.126399ms`, total `7785.365682ms`) on a new TEST assertion at `processes.mjs:63`: `owner-compiler argv actual []` versus the exact fixed GCC command, via main line 112 after invoke returned. The run stopped at this first failure; it did not reproduce `closed diagnostic target`.
- Historical at that checkpoint: main was tracing the empty `processInfo`/cmdline snapshot and no retry or fix was authorized; the bounded empty-argv selection follows.

## Empty-argv observation selection and final RED checkpoint — 2026-10-21

- Main wrote the bounded private TEST-observation brief `docs/handoffs/2026-10-14-claude-s12/briefs/codex-dec203-empty-argv-selection.md`. Source-causal finding: `processInfo` splits zero bytes to `['']`, pops to `[]`, and save keeps the first record; Linux 6.17 `get_mm_cmdline` returns 0 before `env_end` initialization, without proving which transition caused the read.
- Selection is zero-byte-only incomplete using existing code and the original budget; no empty-process save or pending resolve. Exact nonempty-cmdline hard checks and I/O brackets remain.
- Final RED session `5676` CLOSED 1: 10 total, 9 pass, 1 fail, 0 pending; only CO06 (races 0, expected 1) failed. Malformed/EACCES controls pass. Raw `.lane-logs/s12-empty-argv-sampler-final-red-20261021.json` SHA `0b5916184a0ae770a471b0991738b9a3b9c13eb52b274c2c96150e6b2d516a05`.
- Historical at that checkpoint: the minimal GREEN helper was released but UNRUN; the typed GREEN, old-parser replay, and restored-final results follow.

## Empty-argv helper GREEN and restored-final checkpoint — 2026-10-21

- Helper GREEN candidates: `values` 293 LF SHA `e49fca7382052972cff3b3c78aa9748e9fa130b2eb86c4de6d9e9692ab2214f8`, `processes` 299 LF SHA `45ad6935b4daab31760fb7c3671679f6d8954a3b0fe652a4e956f6e8822b8ea6`; whole-function inverses exactly prior `values` `52799…282` / `processes` `74d66…300`, with no I/O or bracket changes.
- Initial scoped session `78595` stopped at strict supplemental TSC TS2379 optional-error shape; type-only caller `TS error: Error | undefined` fixed it (385 LF SHA `0b4ba39177051c4f01c5cf2af930d12bb47e0f6b702540bfabdbebffb30de8ac`). Typed GREEN session `34722` CLOSED 0: 589 pass, all gates; receipt `cedd32…490`.
- Old-parser-only replay session `95955` CLOSED 1: 589 total, 588 pass, 1 intended CO06 failure; raw `.lane-logs/s12-empty-argv-old-parser-replay-20261021.json` SHA `145dc7b26484cf9c5abee9930c1e6a7842ad70115609bece01d52f5e42eb409f`. Guard is exactly restored.
- Final session `44558` CLOSED 0: 11 files, 589 pass, 0 fail/pending; format/lint 16, syntax 8, supplemental strict TSC 8, configured type-check/progress pass. Raw `.lane-logs/s12-empty-argv-restored-final-green-20261021.json` SHA `e312a99236b01b4055040d7209fd74d917cf67a2e11b70d52a49a851b7842b40`. Source-freeze v3 `verification/2026-10-21-bootstrap-observation-green-source-pins-v3.json` has 16-pin drift empty, 13 TEST helpers, DAG cycles empty, caps ≤300; v1/v2 untouched.
- Historical at that checkpoint: fresh PR01 session `29243` was running root-only; no other Node 22/pnpm/GCC jobs were active, and no acceptance, canonical receipt, or count credit was claimed. The completed four-case native v3 result follows.

## Native v3 four-case fresh pass checkpoint — 2026-10-21

- Four separate native cases passed with cooperative harness closure and 16-pin drift empty before each: PR01 session `29243` CLOSED 0 (`test 6499.428188ms`, total `6566.907686ms`); PR02 `29382` CLOSED 0 (`6970.272301ms`, total `7031.887511ms`); PR03 `73110` CLOSED 0 (`6727.135738ms`, total `6792.845183ms`); PR04 `59763` CLOSED 0 (`6849.333294ms`, total `6909.070749ms`). Every test reported pass 1/fail 0/cancel 0/skip 0.
- This is a pre-ready four-case fresh native pass only. No full-factory, native-080, DB, `validate`, counter, canonical-receipt, or external-acceptance credit is claimed; no other native jobs ran and no source hashes changed.

## Native-finality capability-audit proposal — historical approval-pending checkpoint — 2026-10-21

- Root source-reviewed the full supervisor-authority contract and native-finality plan. Full-factory release remains held until genuine inputs; Gap C sections 3/4/7/8 require a separate owner-approved read-only capability/source check before backend-handle producer/native-finality tests. Existing grants are closed; no renewal is inferred.
- Historical proposal only: `.memory/pipeline/progress/verification/2026-10-21-native-finality-capability-audit-proposal.md` scoped one unprivileged window to the exact sealed target container `supabase_db_wejammin_ev` (database `postgres`) and daemon `unix:///run/docker.sock`; selected Docker ID/image/running/PID/labels, one read-only `pg_stat_activity` metadata census, and only target init plus bounded cgroup-member identity/namespace/cgroup/NSpid two-frame checks (max 256). Stop on EACCES or conflict. No global `/proc`, cmdline, env, FD, pidfd, ptrace, privilege, signal, lock, service, stack, reset, migration, write, or native-080 action. Command/helper pin review was required before execution; no inspection had run at that checkpoint. Human scope approval was pending; no acceptance, counter, checkbox, or canonical credit.

## Native-finality capability-audit approval — historical; result below — 2026-10-22

- Human approved one bounded read-only audit; root recorded `.memory/pipeline/progress/verification/2026-10-22-native-finality-capability-audit-approval.md`. The exact proposal SHA is `89e158a1c7e2336da93b57b7fc41c274d016a5753fd4735af6d9eb80241c6528`; target is `supabase_db_wejammin_ev` / project `wejammin_ev` / database `postgres`, daemon `unix:///run/docker.sock`.
- At that checkpoint the audit was UNRUN; root had to review pinned commands/helper before execution. Existing old grants remained closed; weekly usage was 26%, below the 98% handoff threshold.

## Native-finality capability-audit result — fail-closed — 2026-10-22

- Result: `.memory/pipeline/progress/verification/2026-10-22-native-finality-capability-audit-result.md`. The one human `call_83b29a533835441fa07af2cd22f5d2e2` grant is consumed and CLOSED. Frozen plan SHA `021667eb556a3c62855dc900e87094cc1a04032c4ab40ef4990a12263868c156`.
- Initial Docker selection CLOSED 0 with exact target/project binding: container `supabase_db_wejammin_ev`, project `wejammin_ev`, ID `426291fe29f74115758b9ceeb4733b18a4e9d0e77b2991f91e1dc22847c1c78b`, image `sha256:28f0e16a019e648089fc1a6d333549a55548f6019c15ae4bd7cd58b989027518`, init `4316`. The single metadata census Docker CLOSED 2 (stderr 48: `psql: error: definition of service "" not found\n`, stdout 0); wrapper CLOSED 1. It stopped immediately: no retry/fallback/post-inspect/metadata-helper/proc/sysfs and no derived target/result. Failure is selected `PGSERVICE=''` (empty is not absent), not host-unsupported proof; census/server-backend activity is unproved.
- Source-only helper checks: formatted helper SHA `ef654bab4fff8a2647dbf74b05d337f2f5bc2e6f1c19a755ba89966974dc4af6`; 21 new mocked plus prior 589 = 610/610, static/config typing/progress session `37753` CLOSED 0. These are not native-finality evidence. Full-factory/RUN_ACK, native-080, `db:verify`, `validate`, and acceptance remain held; 9/17 and Slice 12 0/296 are unchanged, canonical receipt absent, and native-v3 16-pin set unchanged. A clean-container-env rerun requires new human approval; proposal `.memory/pipeline/progress/verification/2026-10-22-native-finality-clean-environment-window-proposal.md` is UNAPPROVED/UNRUN; no retry is authorized.

## Runtime and checkout

- Orchestrator: `gpt-6.1-sol`, `ultra`, verified in this thread's current
  `turn_context`. Execution agent: `Phils-Charm/deepseek-v4.1-flash`, `high`.
- Writable checkout: `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`,
  branch `claude/phase2-slice12`, HEAD `b16edb54a7a1b698ed8ca15b6085046d4270626e`.
- Primary and Slice 11 checkouts remain read-only. Existing dirty work is retained.

## Historical temporary evidence cannot authorize a new inspection

Direct host `ls` and separate read-only filesystem checks find
`/tmp/wejammin-native-s12-20261017.Adf0uP` absent. Its tooling, selected-source
manifests, one-run approval and consumption receipt cannot be reverified.
Repository handoffs remain historical references; they do not prove whether the
old approval was consumed. Do not recreate it, assume it was unused, or reuse it.

The former approved tuples from `CLAUDE-RESUME-NATIVE-2026-10-19.md` no longer
match: PIDs 3151412 and 3413674 are absent; current PIDs 709 and 721 have UID 0 and
different start times and ancestry. No old PID-specific privilege grant applies.

## Fresh unprivileged observations

A metadata-only `/proc` scan examined current UID-1000 executable links and
working-directory links without reading environment, secrets or command lines.
It found no classified native/compiler/Supabase/PostgreSQL actor, but four
executable links refused ordinary access with `EACCES`. This does **not** prove
global absence or native readiness. Each following tuple was stable across a
fresh before/after `/proc/PID/stat` and directory-UID bracket:

| PID  | PPID | process group | session | startTime | UID  | executable read |
| ---- | ---- | ------------- | ------- | --------- | ---- | --------------- |
| 729  | 1    | 729           | 729     | 677       | 1000 | EACCES          |
| 739  | 729  | 729           | 729     | 679       | 1000 | EACCES          |
| 2519 | 2480 | 2519          | 2519    | 1317      | 1000 | EACCES          |
| 2566 | 2542 | 2566          | 2566    | 1322      | 1000 | EACCES          |

All four canonical lock paths are absent, rather than verified idle retained
inodes: `wejammin-supabase-ci.lock`, `wejammin-quiet.lock`,
`wejammin-altdb.lock`, `wejammin-reset.lock` under `/tmp`. No lock was created or
acquired during these checks. The pinned Node 22.23.1 binary, GCC and checked
Node-API header hashes still match the native test's fixed profile.

## Required next authority and evidence

### Latest current status: 2026-10-21 fresh sequence stopped at PR04; new TEST closed-target refusal under investigation

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

The GOLD facts of the current semantic sequence are preserved (the old native guard location, the TDD
controls, the restored final validation). Main is source-reviewing the TEST inventory guard ordering
before any diagnostic, retry or semantic change; no new global/privileged reads or cleanup.

### Prior status (superseded 2026-10-21 by the fresh PR04 TEST refusal): fresh native sequence: PR01–PR02 passed; PR03 running

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

### Prior status (superseded 2026-10-21 by the fresh PR01–PR02 passes): restored final validation passed; fresh sequential native started (PR01)

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

### Prior status (superseded 2026-10-21 by the passed final validation): causal process controls complete; GOLD restored; final validation running

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

### Prior status (superseded 2026-10-21 by the causal-controls-complete checkpoint): process semantic written/frozen; first GREEN; causal controls pending

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

### Prior status (superseded 2026-10-21 by the process first-GREEN): process-facts RED reached (44 cases, 4 fail); semantic fix released

The meaningful process-facts RED is reached, and the single-file semantic fix has been released (not
yet written, frozen or GREEN).

- NEW unit `tests/contracts/phase-02-slice-11-dec203-process-facts.test.ts` 268 lines SHA-256
  `4b9bb99a58efd57edc8437b25e0c9d8c69687180104f3b6e385fcef01048d080`, 44 runtime cases. Main fully
  read and reviewed it: six zero/negative ppid/group/session hard controls across live+Z+X; malformed
  records/numeric/start-time hard; invalid PID with no reads; an actual `observationRace` and strict
  planned-FS mocks; live S → both Z/X controls; no native proof. One 83-column unbreakable literal
  module path matches the existing unit and Prettier (no false ≤80 claim).
- Actual RED (session 47865) CLOSED 1: 44 tests, 40 pass, 4 fail, 0 pending — ONLY PF03 (valid Z/X)
  and PF10 (live S→Z/X) fail on the actual `IDENTITY` rather than the required marked-incomplete; the
  baseline and all 40 hard guards PASS, with no setup/loader failure. Raw
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

### Prior status (superseded 2026-10-21 by the process-facts RED): PR04 guard located at processes:86; process-facts RED under authoring

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
the actual meaningful RED. Source support (not state/timing proof): official Linux man-pages
`.../proc_pid_stat.5.html` SHA-256 `0f04d78946538fd84db1536845abeb236da51a04844989f34ea7ee7cb0b6700f`
(20647 bytes) documents `Z` (Zombie) and `X` (Dead). The gate remains STOP at PR04; no
DB/`validate`/counter/canonical credit.

### Prior status (superseded 2026-10-21 by the processes:86 location): PR04 gate stop; two-site refusal sites identified; error-only diagnostic pending

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

### Prior status (superseded 2026-10-21 by the two-site refusal checkpoint): PR01–PR03 passed; PR04 identity refusal under investigation (gate stopped)

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

The gate is STOPPED AT PR04 after the actual sequential PR01–PR03 successes; PR04's identity refusal
is under investigation pending source review. No blind retry, no PR04 pass, and no full-factory/DB/
`validate`/counter/canonical acceptance credit; the GOLD observer and meaningful TDD controls are
preserved.

### Prior status (superseded 2026-10-21 by the PR04 stop): semantic observe written/frozen; focused GREEN; causal controls pending

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

### Prior status (superseded 2026-10-21 by the focused-GREEN checkpoint): meaningful TDD RED reached; semantic implementation pending

The native gate is stopped at PR02, with the refusal located at the original `observe:68`
inherited coordinatorFD CLOEXEC qualification, and the TDD RED is now meaningful. The
semantic single-file `observe` fix has been RELEASED to the execution actor but is not yet
written, frozen or validated.

- Frozen RED artifacts (all tests frozen): `tests/contracts/phase-02-slice-11-dec203-coordinator-startup.test.ts`
  344 lines SHA-256 `2ded22c4b33c75d5de23f204d8cb545997cbfb6edfff3d8d3c53e2357e0361d3`; fixture
  `tests/contracts/helpers/dec203-coordinator-startup-fixture.ts` 277 lines SHA-256
  `f1934a3a0e2680a5d50e34ebeac3aa452e71e51f5653194f1797fc47fe0a1f1b`; type helper 71 lines SHA-256
  `833647a6e08012b467a58e12282f5b2935c5fb8791d4ef04391f6b58c4661810`. ROOT independently reviewed
  the unit+fixture+type helper: it fixed a positive-oracle defect before runtime
  (`process(name)` full capture vs nested process), added 8 qualified regression cases, strict
  planned mocks, fresh fixture images, and a type-only no-back-edge split to preserve caps.
- Actual `vitest` RED (session 57098) was terminal 1: 30 tests, 21 pass, 9 fail, 0 pending; raw
  `.lane-logs/s12-coordinator-startup-unit-red-20261021.json` SHA-256
  `3588c8eb8470b48938bd5b3e300efdc59ff3a5aaa2daf7f850418a4d0cc4a7d1`. Only the initial pending CS03
  (FD3–10) and CS04 fail on the actual `IDENTITY`; the baseline positive and all hard
  corruption/qualified/compiler/latch/postAdopt controls pass. No loader/setup failure is counted
  as RED.
- Actual format/lint on all 3 files were terminal 0. A supplemental strict `noEmit` check first
  raised TS2688 because the workspace has NO installed `@types/node` (none in the lock; protected
  deps were NOT changed); using the existing desktop-bundled `@types/node` 25.9.5 as a diagnostic
  ONLY (not a Node22-compatibility or canonical gate) then surfaced a TS2322 lockRow literal
  widening, repaired with an explicit `StartupLockRow` return type, after which the supplementary
  strict check was 0. All runtime is pinned Node 22.23.1.

Source support (not actual timing proof): the official immutable Node v22.23.1 primary sources were
re-fetched under bounded concurrency 4 and MATCH the existing source-inventory pins — `node.cc`
58177 bytes SHA-256 `878553644444ef00f8d3c2a144b5b6ff542c9235cff774f23dd4e9ddb364a73a` and uv
`core.c` 48102 bytes SHA-256 `bebf5062eefb617a1d03e5e78f864b6384e14fb7055d534c3a092fc2132f4ac4`.
`node.cc` 895–899 invokes `uv_disable_stdio_inheritance` during initialization and `core.c` 800–808
attempts CLOEXEC on the first 16 FDs, while the local unchanged `receiving-lease-owner.c` 43–64
clears `FD_CLOEXEC` 3–10 before `execve` Node. This supports the startup interpretation, not proof
of the actual failed-observation timing; the URLs are the existing `source-inventory.md` immutable
prefix, so no code excerpts are duplicated here.

Latest weekly usage is 20%. No native rerun and no PR03/04, DB, `validate`, counter or
canonical-receipt credit changes; BLOCKER-007 remains active with its current need.

### Prior status (superseded 2026-10-21 by the meaningful TDD RED checkpoint): native gate stopped at PR02; extraction verified; semantic TDD pending

The native gate is stopped at PR02; the first PR01 run and its downstream sequence remain prior
history below. The two-site failure-only probe located the refusal at the original
`observe:68` inherited coordinatorFD CLOEXEC guard (not `processes:293`); the resource
diagnostic recorded total duration 5688.845346ms (test duration 5622.738644ms).

Mechanical extraction is DONE and verified. `observe` `e5105e1d…` (298) became
`08b726fe1b1f6667b27fe7b62e35203b277c7cdae63c96fbb1a325ee597b658d` (280), and `build`
`2dd98cedcb32a5ce223f406e8fdd1c82280ec9d00b7803a31ee656b041d5be65` (232) became
`078dad1653243e82b769228b8235f6e3976256012e9c30a24b28362c5a554b97` (255). ROOT proved the
full inverse hashes of both originals, the whole moved `assertPrecompile()` (19 lines)
byte-exact, the old export re-exported, and all other 30 production pins original; the static
import DAG is acyclic (17 MJS) with no new source names, and the resource original `c181d73b…`
is restored with no diagnostic variant left.

Actual sequential check (session 17500) terminal 0: Prettier 2 production files, ESLint 2 with
`max-warnings 0`, Node `--check` 2, then the existing 8 exact unit files 412/412 pass 0 fail 0
pending; raw `.lane-logs/s12-native-precompile-extraction-green-20261021.json` SHA-256
`ed296d03b0015c55d2f1d90485793e3c4675843e7e4ab3e817fb59b94f407dc1`. Separately, pinned Node
inert imports and `observer.assertPrecompile === build.assertPrecompile` / arity 0 were actual
terminal 0 (no factory, capability or native execution). Semantic startup fix is UNWRITTEN and a
new mocked actual-observer RED is under authoring; no PR03/04/DB/`validate` or acceptance change.

### Prior status (superseded 2026-10-21 by the extraction checkpoint): first native PR01 run returned terminal 1

The first actual PR01 native run executed the exact command
`/usr/bin/env -i PATH=/usr/bin:/bin LANG=C LC_ALL=C TZ=UTC /home/rob/.cache/chrome-gate-runtime/node-v22.23.1-linux-x64/bin/node --test --test-concurrency=1 --test-name-pattern='^PR01:' tests/native/phase-02-slice-11-native-bootstrap-pre-ready.mjs`
and returned terminal 1 with a test duration of 6744.273115ms (total 6849.079832ms) and test 1 pass 0 fail 1. The outer exit and actual
close code were 1 with signal null, and harness assertion 230 expected outer code 0 but
observed 1. The diagnostic was validatedPrefixOnly/debugOnly true with roles outer,
owner-compiler, owner, coordinator and lease-compiler; `localTerminal` was state closed
with failure code `DEC203_SUPERVISOR_IDENTITY_CHANGED` and `ownerWait` pid 107526
startTime 5933601 exitCode 1 signal null. Owner-channel states: input `eof` (separate), ownerInput `finished`, ownerStdout `eof`, ownerStderr `eof`, commands `finished`, events `eof`;
the owner compiler was terminal 0 with stdout/stderr EOF and session absent. No PR02–04
or database gates ran, and the source pins were unchanged at launch (32 at launch).

This is a formal native RED, not acceptance; the native cause remains a hypothesis, not confirmed (no diagnostic run yet)
and the native gate is held. The PR01 session (34646) is closed and must not be polled
again. The result is an actual first-run TAP observation, not a canonical receipt. No
owner-compiler native success and no global process absence is claimed. Note:
`.memory/pipeline/progress/verification/2026-10-21-native-pr01-first-run.md`.

UI final proof is separate and closed for its scope: the negative replay was RED 2/2 on
the same line-236 assertion (raw `e3d7b6ef…`), then the restored hook 246 lines (SHA `203a597b…`) and test 271 lines (SHA `96df82d4…`)
produced final GREEN 92/92 across 15 files (raw `66ddde8a…`); scoped ESLint,
`pnpm type-check` and `progress:check` were terminal 0. The final-GREEN existing
`createDesigner` test emitted an act warning that is under source-only investigation and
is not warnings-clean. The earlier PR01-pending status is superseded; earlier AS-OF
history is preserved.

A second named PR01 diagnostic run (session 38522) was also terminal 1 with test 1 fail 1
(test 6831.282613ms, total 6940.658668ms). Its only temporary change — relabeling the child
CLOEXEC failure `IDENTITY_CHANGED` → `REFUSED`, condition strict and unchanged — was
restored byte-exact (observer `e5105e1d…`, diagnostic `476dbc18…`, all other 31 pins
unchanged); no `REFUSED` was hit, so the startup hypothesis is not confirmed. That run gave
exit/actualClose 0 with local closed `CANCELLED` and `ownerWait` exit 0, but the test failed
on bound-artifact drift (modes 100711 → 100600; same inode/device/size/mtime, with changed mode and ctime)
traced to a premature test capture before sealing; a regression test is being authored with
no fix yet, and normalizing the mode alone is insufficient. Strict: no acceptance and no
PR02–04/DB/canonical change; the IDENTITY cause remains unresolved and separate.

AS-OF update: that act warning is now fixed. `CmsTemplateDesigner.interaction.test.tsx` is
225 lines (SHA `6e5e50b9…`); its initial RED (raw `91d03c95…`), first GREEN (raw
`1ea43ac1…`), negative replay (raw `d467fc3f…`) and final warning-free GREEN (raw
`a7c5a3cb…`, 15 files 92 pass 0 fail, no warning/stderr) closed the item, with scoped
Prettier unchanged and ESLint `max-warnings 0` at terminal 0 and a fresh full TSC/progress
still pending (superseded: both now terminal 0). The prior warning-open statements above are historical. Native PR01 remains
RED with no acceptance.

AS-OF update: the native sealed-output observer fix is final at 52/52 units (guard-removal
replay 38 pass / 14 fail, restored 52/52; helper 84 SHA `79a635a6…`, observer 298 SHA
`d2b5e6b0…`, unit 345 SHA `1ecbefea…`; all 32 production files byte-exact). The real PR01 run
(session 2703) still failed `DEC203_SUPERVISOR_IDENTITY_CHANGED` (1 fail, 6648.893102ms); a
two-label sampler variant (66912) passed 1/1 diagnostically; the restored-source PR01 (3254)
passed 1/1 (6973.047048ms) across the whole shared callback. Sequential PR02 (70329) was
terminal 1 with `DEC203_SUPERVISOR_IDENTITY_CHANGED` (1 fail, 5580.646584ms), failing before
successful adoption; PR03/04, DB and `validate` were not run. PR01–04 share the full callback
(processes/frames/builds/lease/compilerBoundary/inventories/terminal) but are separate fresh
runs, and each pass claim is scoped to its one run with no stable production fix or authority.
The prior UI TSC/progress pending note is superseded (both terminal 0). No canonical receipt or
checkbox credit; BLOCKER-007 active.

A failure-path probe (`0fae252a…`, 300 lines, inverse original `c181d73b…`) mapped only the
default IDENTITY at `processes:86` to `REFUSED` and left ensure paths untouched; PR01 (session 19629) was terminal 1 on the original `IDENTITY_CHANGED` with `processes:86` not matched, so no
hypothesis is confirmed. All other 34 pins are original/repaired, and a second reviewed probe is
being authored — do not claim all 32 currently restored until ROOT confirms.

A second native two-site resources failure-only variant (`676f56cf…`, 300 lines) maps
`observe:68` → `REFUSED` and `processes:293` → `UNAVAILABLE` with other errors and ensure paths
unchanged; the actual PR01 diagnostic (session 61215) was terminal 1 on `REFUSED` matching
`observe:68` (the inherited coordinatorFD CLOEXEC guard), not `processes:293`, and resources
were byte-exact restored to the original `c181d73b…`. This is guard-location evidence, not
startup ordering or repair. Root-selected TDD design: the complete non-CLOEXEC topology, locks,
identity and no-alias validation still runs; initial pending deferral needs both no prior
qualified lease snapshot and an empty current coordinator children list, any present compiler
making absent CLOEXEC a hard refusal; non-flag lease topology checks precede any deferral.
Semantic code is UNWRITTEN and a new mocked observer RED (with a stricter-boundary unit) is being
authored, plus a body-identical whole-function `assertPrecompile` extraction to keep the 300 cap
— pending implementation/TDD, no release of PR03/04/DB/`validate`, BLOCKER-007 unchanged.

### Prior status (superseded 2026-10-21 by the first native PR01 run): bounded lock recovery completed

The approved bounded recovery (approval pin
`bd691128db16c1e2835c9f3accd4f5b76bee8035f9af880033f6a4891aa435d7`) is complete and
closed. The single privileged batch (former session `15549`) is now terminal exit 0 with
no live handle, and its eight ordered outputs were `/usr/lib/systemd/systemd`, `/`,
`/usr/lib/systemd/systemd-executor`, `/`, `/bin/postgrest`, `/`, `/bin/postgrest`, `/`.
The before fence `2026-10-21T18:10:54.420Z` and after fence `2026-10-21T19:13:43.240Z`
both matched all four six-field tuples and all five pins; there were no renewals,
substitutions, signals or cleanup.

The conditional creator ran exactly once (`19:15:33.264Z`→`.266Z`, Node v22.23.1
UID/GID 1000, terminal 0, COMPLETE 4/4, final mismatch 0) and freshly exclusive-created
the four empty regular 0644 lock files on device 54 at inodes 109668 (supabase-ci),
109669 (quiet), 109670 (altdb) and 109671 (reset); no existing file was overwritten or
removed. The one postflight (`19:16:25.768Z`→`.797Z`) was also terminal 0. Raw hashes:
preflight `b133b802…` (117561 bytes), create `4a5a1e2b…` (4724 bytes) and postflight
`f36cd7ff…` (119127 bytes). Frozen result:
`.memory/pipeline/progress/verification/2026-10-21-native-lock-recovery-result.json`
(SHA `fd7d41a4…`).

This is a point-in-time diagnostic, not native/Database/Phase acceptance and not a
workflow lease. No service, container, namespace or ownership mapping is inferred from
the image paths. BLOCKER-007 remains **active**, now pending the formal PR01 native run
and its gated sequence rather than missing files or read approval. UI work is separate:
initial RED 2/2 became GREEN 92/92 with lint/TSC/progress at 0, but the final negative
replay and final GREEN are still underway, so the UI path is not yet closed.

### Prior status (superseded 2026-10-21 by the completed bounded recovery): bounded lock recovery in progress (AS-OF 18:15Z)

The approved bounded recovery (approval pin
`bd691128db16c1e2835c9f3accd4f5b76bee8035f9af880033f6a4891aa435d7`) is now in
progress. Its operator consumption record is
`.memory/pipeline/progress/verification/2026-10-21-native-lock-recovery-operator-consumption.json`,
SHA-256 `a8b1be019ae728362fe1a2bae8889bf384c044b758756fb8a75ef5cbda05a298` (a new
file created by apply_patch after an absence check; this is not a runtime `O_EXCL`
claim, and the fixed raw stage carries the `O_EXCL` guards).

One unprivileged global preflight ran `2026-10-21T18:10:12.918Z`→`18:10:12.957Z` with
terminal 0, Node v22.23.1 UID 1000, raw SHA-256
`b133b8021f0ac53129b2d6cda411fb72d2be5a795c2b9448bec4965bb50bfd8c`, 117561 bytes, a
private canonical 0600 file with genuine full persist. 442 numeric `/proc` entries
reconciled as 255 UID-excluded + 186 UID-1000 identities + 1 DIR_FILTER ENOENT (its UID
is not classified). 186 identities were stable with 182 readable exe and 182 readable
cwd; only the four approved opaque PIDs returned `EACCES` with their exact tuples, and
no readable pinned native candidate was found apart from the actual inspector. All four
lock paths were ENOENT in both frames; the kernel file was 7318 bytes each with no cap
or parser error and no matching rows — which does not prove the locks are unheld and is
not global absence.

Before the whole single privileged batch, the fence at `2026-10-21T18:10:54.420Z`
matched all four tuples and all five pins. The batch
`/usr/bin/pkexec /usr/bin/readlink --` over the ordered eight paths is **LIVE** in the
same session `15549`, with no output and no closure yet. Retain and poll that same
session; no signals, restart, retry or alternate privileged route. After terminal
completion a post-fence is required even on failure, and any nonzero, invalid eight-line
output, tuple mismatch or uncertain closure must be rejected. Lock creation is **not**
launched, the postflight is **not** launched, and PR01, database and final gates remain
held.

AS-OF `2026-10-21T18:15Z`; the live batch may finish while this is read, so treat this
as a snapshot, not a final outcome. ROOT integrates the result separately. Last observed
weekly usage 16% (below 98%). The tooling review
`.memory/pipeline/progress/verification/2026-10-21-native-lock-recovery-tooling-review.md`
(SHA `3de1984d…`) covers source/VM 23/23 plus 6-syntax only, with no acceptance.

### Prior status (superseded 2026-10-21 by the in-progress recovery): bounded lock recovery approved, unrun

The owner approved one bounded recovery: a single `pkexec`/`readlink` batch of the exe
and cwd links for PIDs 712, 723, 4377 and 4630 with before/after six-field and pin
brackets; one unprivileged global preflight and one postflight; and, only if admission
checks pass, exclusive creation of the four fixed absent lock files
(`/tmp/wejammin-supabase-ci.lock`, `/tmp/wejammin-quiet.lock`,
`/tmp/wejammin-altdb.lock`, `/tmp/wejammin-reset.lock`) as UID/GID 1000 regular mode 0644. No retries, substitutions, command-line/environment/secret reads, signals,
cleanup, service, stack or database changes, and no reuse of any consumed grant. Final
owner-approval pin:
`bd691128db16c1e2835c9f3accd4f5b76bee8035f9af880033f6a4891aa435d7`.

This approved plan supersedes the prior "needs owner direction" latest status. The
recovery is **unrun**: nothing has been launched, no lock file has been created, no
privileged read has executed, no preflight has run and native PR01 has not started.
BLOCKER-007 remains **active**; its current need is to complete independent source/VM
and native precheck and to execute only if the actual admission checks pass — this is
not a request for new approval.

The frozen postflight result pin is
`a51f1b4d1adde381a2c2db06642132cb67b4e061ee24b411715b6783e88f5dca`; Slice 12 stays
0/296 and Phase 2 stays 9/17 with PR01, database and final gates held.

### Prior status (superseded 2026-10-21 by the approved bounded recovery): unprivileged native preflight completed

ROOT completed the one approved unprivileged native-preflight window. It ran genuine
terminal exit 0 with no live session, no privilege and no signals/cleanup/service/
stack/database action. Window `2026-10-21T17:38:14.222Z`→`17:38:14.253Z`, Node
v22.23.1 UID 1000. The private raw report is
`.lane-logs/s12-native-postflight-20261021.json`, SHA-256
`3becb1998138a31e1196b3b6d8f78f45d3999e85d073aae16e492abdd28b29f5`, 115491 bytes,
canonical regular mode 0600 UID 1000, with genuine write/fsync/close.

446 numeric `/proc` entries reconciled as 259 UID-excluded + 183 UID-1000 identities
read + 4 directory-filter ENOENT (their UID is not classified and is not claimed). All
183 identities were stable across the before/after brackets with 0 unstable; 179 had
readable exe and 179 readable cwd links. The same four known PIDs (712, 723, 4377, 4630) denied both links with `EACCES` and kept the same six-field identities as the
completed fixed-eight-read record. All four fixed lock paths were ENOENT in both the
BEFORE and AFTER frames; `/proc/locks` was 7318 bytes each with no truncation or parser
error, but zero matching rows does not prove the locks are unheld because no named
inodes exist. Lock frames: UNKNOWN.

The original eight-read grant is exhausted and the new one-window approval is now
consumed and closed, with no renewal or fallback; no lock file was created and no
further `/proc` read occurred. Native PR01 preflight is NOT clear. Result:
`.memory/pipeline/progress/verification/2026-10-21-native-postflight-result.json`;
checker review:
`.memory/pipeline/progress/verification/2026-10-21-native-postflight-checker-review.md`.

Next: owner direction on the missing mandatory coordination files and the current
metadata uncertainty. No reboot or cleanup cause is inferred; no role, ownership,
service, container or native-quiescence mapping is claimed. Slice 12 stays 0/296 and
Phase 2 stays 9/17 with PR01, database and final gates held.

### Prior status (superseded 2026-10-21 by the completed unprivileged preflight): fixed-eight inspection completed

ROOT completed all eight exact privileged reads. Each was terminal exit 0 with a
single absolute output path, and all four six-field process tuples and all five
executable/transport pins were unchanged across every before/after bracket. No repeat,
fallback, signal, cleanup, service or stack action occurred, and no live handle
remains. The final frozen result is
`.memory/pipeline/progress/verification/2026-10-21-fixed-eight-link-pkexec-inspection-result.json`,
SHA-256 `edd8e9d355dfe7eec0226ae7c77b15a80c4a3938d363b511114c618ca7154d6b`; completion
post-fence `2026-10-21T16:55:48.859Z`. The approval
(`27624789360cb0b58a18b2ac4011cd8b9945710569c650754e1d68bc1a5a1103`) and the
one-run consumption claim
(`be27302ef8748a9d3b29da9711db83391f7e2b3556be36801f5f9e4602360913`) remain immutable.

Observed link targets (exact `readlink` output only):

| PID  | exe                                 | cwd |
| ---- | ----------------------------------- | --- |
| 712  | `/usr/lib/systemd/systemd`          | `/` |
| 723  | `/usr/lib/systemd/systemd-executor` | `/` |
| 4377 | `/bin/postgrest`                    | `/` |
| 4630 | `/bin/postgrest`                    | `/` |

These are exact executable/cwd link outputs only. No container, service, stack,
namespace, role, ownership assignment, native quiescence or host path canonicality is
proved, and no actor absence is claimed; necessary services remain preserved. The
fixed eight-read authorization is exhausted and closed — no repeat, substitution,
renewal, fallback or further privileged read is authorized.

Needs: a fresh ordinary native preflight and current source review before any native
PR01 run, with canonical `db:verify` preceding `validate`. PR01, database and phase
gates remain unrun and held; Slice 12 stays 0/296 and Phase 2 stays 9/17; no diagnostic
result is acceptance evidence. BLOCKER-007 is not globally resolved by this inspection.

### Prior status (superseded 2026-10-21 by the completed fixed-eight inspection): approved fixed-eight inspection in flight

The owner approved the eight exact fixed `pkexec` vectors proposed below (one `exe`
and one `cwd` read per PID for 712, 723, 4377, 4630; two `readlink` invocations per
PID, eight total) with the same six-field and binary-pin brackets and all existing
exclusions. This is a new approval, not the earlier unprivileged authority and not
reuse of the consumed `sudo` or old-tuple `pkexec` approvals. The owner record was
reformatted by Main before consumption; its final SHA-256 is
`27624789360cb0b58a18b2ac4011cd8b9945710569c650754e1d68bc1a5a1103`.

A new exclusive single-run consumption claim was created at `2026-10-21T16:22:47.609Z`
before any privileged call:
`.memory/pipeline/progress/verification/2026-10-21-fixed-eight-link-pkexec-operator-consumption.json`,
SHA-256 `be27302ef8748a9d3b29da9711db83391f7e2b3556be36801f5f9e4602360913`. It is
consumed, not renewable or reusable; the remaining exact vectors stay part of the
same run with no new claim, renewal, substitution, retry or fallback.

AS-OF this snapshot the run is in flight, all completed invocations terminal exit 0
with a single absolute output path and unchanged six-field tuples and file pins:

| ordinal | target  | result                              | before → after                |
| ------- | ------- | ----------------------------------- | ----------------------------- |
| 1       | 712 exe | `/usr/lib/systemd/systemd`          | 16:23:06.285Z → 16:31:05.408Z |
| 2       | 712 cwd | `/`                                 | 16:31:46.155Z → 16:38:26.861Z |
| 3       | 723 exe | `/usr/lib/systemd/systemd-executor` | 16:38:27.868Z → 16:42:37.215Z |

Ordinal 4 (723 cwd) was dispatched after a fresh fixed fence and has a live tool
handle with no output and no exit code yet; per the last snapshot that handle was
`sessionId 50033`, but treat this strictly AS-OF — read the authoritative mutable
result
`.memory/pipeline/progress/verification/2026-10-21-fixed-eight-link-pkexec-inspection-result.json`
for the current live handle and state. Ordinals 5–8 are unstarted. Authentication
state is unknown; a system prompt may still require the owner, and no observed UI
prompt is claimed. No partial data promotes global absence, native quiescence,
database or gate/slice acceptance; PID 723 cwd and 4377/4630 remain unresolved here.
Phase 2 stays 9/17 and Slice 12 stays 0/296 with all canonical gates held.

### Prior status (superseded 2026-10-21 by the approved fixed-eight inspection): unprivileged UID-1000 metadata refresh

On 2026-10-21 the owner approved a new **unprivileged** UID-1000 process metadata and
readable executable/working-directory link refresh (no command lines, environment,
secrets, signals, cleanup or system changes). This is not a privileged grant and
renews or substitutes no `sudo`/`pkexec` authority. Approval:
`.memory/pipeline/progress/verification/2026-10-21-uid1000-metadata-owner-approval.json`.

The single observational window ran at `2026-10-21T08:04:00.814Z` →
`2026-10-21T08:04:00.822Z`: 399 numeric `/proc` entries, 249 excluded by the UID
filter, 150 UID-1000 identities read with all 150 six-field before/after brackets
stable, 0 filter errors and 0 unstable identities. This is one window, not a globally
atomic or continuous inventory and not global-absence proof. Full raw rows remain only
in the git-ignored local `.lane-logs/s12-uid1000-metadata-20261021.json`, SHA-256
`91e2fb3fdd706bbc26598d135117fac99dcf3d0db7658acba6941716cd9eb75b`.

Exactly four UID-1000 actors deny **both** executable and working-directory links with
`EACCES`, stable across their brackets:

| PID  | PPID | process group | session | startTime | UID  |
| ---- | ---- | ------------- | ------- | --------- | ---- |
| 712  | 1    | 712           | 712     | 567       | 1000 |
| 723  | 712  | 712           | 712     | 569       | 1000 |
| 4377 | 4335 | 4377          | 4377    | 2069      | 1000 |
| 4630 | 4579 | 4630          | 4630    | 2087      | 1000 |

These actors are opaque; they are not classified from ancestry or names, and native
readiness remains unresolved. Result:
`.memory/pipeline/progress/verification/2026-10-21-uid1000-metadata-refresh-result.json`.

Next: a **NEW** fixed-PID read-only privileged proposal for these four current tuples,
explicitly **UNAPPROVED** and requiring separate explicit human approval, with no
substitution or automatic renewal. The recommended shape is
`/usr/bin/pkexec /usr/bin/readlink -- /proc/PID/exe` and `/proc/PID/cwd`, once per
link per PID (two `readlink` invocations per PID, eight total), with a six-field
identity bracket before and after each invocation and a stop on nonzero, mismatch or
uncertainty. This is broader than the earlier exe-only scope and authorizes no shell
target, command line, environment, secret, signal, cleanup, service, host-policy,
stack or database action. Fresh ordinary binary pins at `2026-10-21T08:08:03.715Z`
remain `pkexec` 37/139723/root/mode35309/26720/`72cd7706…`, `readlink`
37/9129108/root/mode33261/76088/`092f87a1…` and pinned Node
52/77902051/uid1000/mode33261/124835376/`93956de2…`. This supersedes the older
need-for-unprivileged-refresh status below; the prior four-PID 729/739/2519/2566 tuples
and the consumed `sudo` grant are not applicable here.

### Prior status (superseded 2026-10-21 by the unprivileged refresh): pkexec approval stopped at unprivileged preflight

On 2026-10-21 the owner approved a new fixed-target, one-run `pkexec` inspection
of the same four six-field tuples, with at most two executable-link reads per PID
(eight total) and all existing exclusions. This is a new approval, recorded in
`.memory/pipeline/progress/verification/2026-10-21-four-pid-pkexec-owner-approval.json`;
it is not reuse of the consumed 2026-10-20 `sudo` approval, and it does not apply
to replacement process instances.

The required unprivileged preflight ran before any privileged action and stopped on
process-identity mismatch. Every expected instance mismatched or was absent:

| PID  | expected (ppid/group/session/startTime/uid) | observed                |
| ---- | ------------------------------------------- | ----------------------- |
| 729  | 1/729/729/677/1000                          | absent (ENOENT)         |
| 739  | 729/729/729/679/1000                        | 712/739/739/578/1000    |
| 2519 | 2480/2519/2519/1317/1000                    | 712/2476/2476/1840/1000 |
| 2566 | 2542/2566/2566/1322/1000                    | 712/2430/2430/1842/1000 |

The preflight ran at `2026-10-21T07:28:26.656Z` with a fixed-target metadata-only
recheck at `2026-10-21T07:31:45.131Z`; all four observations and all three binary
metadata/hash pins were byte-equivalent, and both tool handles were terminal exit 0.
Zero privileged invocations and zero executable-link reads occurred, and no
consumption claim was created. The observed start-time and ancestry changes are
source-based; a reboot is not inferred and the current process executables are not
classified. Result:
`.memory/pipeline/progress/verification/2026-10-21-four-pid-pkexec-preflight-result.json`.

Next: owner direction for a fresh UNPRIVILEGED metadata-only preflight (stat, UID,
exe and cwd links; no command line, environment, secrets, signals or mutations)
before proposing any new fixed privileged scope. The approved 2026-10-21 `pkexec`
scope does not apply to the observed processes, is not consumed, and is not reusable
or auto-renewable.

### Historical status (superseded 2026-10-21): newly approved sudo inspection stopped on exit 1

The user subsequently approved the exact fresh four-PID inspection through the
interactive question reply. Approval and separate pre-call consumption are
recorded in `.memory/pipeline/progress/verification/2026-10-20-four-pid-owner-approval.json`
and `2026-10-20-four-pid-operator-consumption.json`. This is a new approval, not
reuse of the absent historical one.

The first fixed invocation for PID 729 returned exit 1 with no stdout. Stderr was
discarded, so its cause is not established. Fresh post-call tuple and binary
observations were unchanged. The tool reported terminal completion, with no live
session retained. The inspection stopped after one invocation; the remaining
targets were not attempted. No automatic retry or alternative route is allowed
under that consumed approval. Result:
`.memory/pipeline/progress/verification/2026-10-20-four-pid-inspection-result.json`.

An alternative owner-approved one-run `pkexec` inspection could retain the same
four six-field tuples, fixed `/usr/bin/readlink -- /proc/PID/exe` target commands,
at most two reads per PID, and all existing exclusions. Its only added mechanism
would be the local authentication route; a graphical authentication prompt may
require the owner. At the time of this historical record, this alternative had
**not** executed or been approved. **Historical/superseded 2026-10-21**: the owner
subsequently approved this fixed-target `pkexec` route, and its unprivileged
preflight stopped on process-identity mismatch before any privileged action — see
the current status section above.
Ordinary file checks find `/usr/bin/pkexec` canonical, regular, root-owned,
mode104755, device37/inode139723/26720 bytes, SHA-256
`72cd770659617b11f0872bfac159cdd5e41b0e44bbc01f9d3cd88d18e89861cd`.
This observation neither establishes that route will work nor authorizes it.

### Original fresh-inspection scope (now consumed)

The prior one-run inspection authorization explicitly excludes PID substitution
and automatic renewal. A fresh narrowly bounded approval is needed to inspect
only the executable links of the four tuples above with privileged read-only
`readlink`, preserving all six identity fields before and after. This authorizes
no signals, cleanup, environment or secret reads, services, host-policy changes,
database/reset activity, default-stack changes or validation credit.

The proposed privileged operation is restricted to the following fixed command
shape, at most two executable-link reads per approved tuple (eight total), with
no shell and no alternate program, PID or path:

```text
/usr/bin/sudo -n -- /usr/bin/readlink -- /proc/729/exe
/usr/bin/sudo -n -- /usr/bin/readlink -- /proc/739/exe
/usr/bin/sudo -n -- /usr/bin/readlink -- /proc/2519/exe
/usr/bin/sudo -n -- /usr/bin/readlink -- /proc/2566/exe
```

Ordinary binary observations find both paths canonical, regular, non-symlink and
root-owned. Current device/inode/size are `37/44037/289976` for sudo (mode104755)
and `37/9129108/76088` for readlink (mode100755). SHA-256 values are respectively
`fe945435e24e1c733fb559a05d6f607dd8203799e84dd885e724a81944041d14` and
`092f87a1632ad9102757d676c85150556b71cc377642f2d55f04c9df9af63aa1`.
These are file observations only; neither privileged command has executed.

Before any approved inspection: independently review and pin its actual transport
and executable identities, record a new exclusive one-run consumption claim, and
retain its genuine status and closure. Do not reconstruct old temporary receipts
or treat a failed or uncertain call as unused permission. Then perform a fresh
ordinary postflight. Only a satisfied preflight permits the normal native PR01
case; canonical `pnpm db:verify` still precedes `pnpm validate` thereafter.

## Independent tracking repair and frontend checks

The current canonical phase plan contains 3,325 unique acceptance-criterion rows,
without duplicates. Excluding exactly Slice 09 AC209, AC211, AC265 and AC266
yields 3,321 active rows. Slice 12 contributes 296, including the eleven
owner-approved DEC-202 checks. The 2026-10-17 DEC-202 depth-floor record already
specifies these totals, while parts of the progress policy still require the
historical 3,310/3,314 totals. The initial progress verifier returned exit 1 for
that mismatch. The regression-first repair now passes 24/24 policy tests, scoped
format/lint and a fresh progress verifier (exit 0); no criterion has been checked
and no slice has advanced on the strength of these diagnostics. Detailed record:
`.memory/pipeline/progress/verification/2026-10-20-dec202-progress-reconciliation.md`.

Fresh independent template-recovery validation passes 18/18 tests across
`CmsTemplateEditDesigner.uncertain-pending.test.tsx`,
`CmsTemplateEditDesigner.stale-type.test.tsx`, and
`CmsTemplateLatestCheck.announcer.test.tsx`. These are simulated-DOM unit checks,
not real-browser, database, native or full acceptance evidence. No frontend
production source changed during this validation. Receipt:
`.lane-logs/s12-template-recovery-20261020.json`, SHA-256
`d936f22ca921d662b6bcbad845e2befae38ded7d6dd185e71233e4aad063d26e`.
