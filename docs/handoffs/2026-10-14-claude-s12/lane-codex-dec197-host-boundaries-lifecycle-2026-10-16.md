# DEC197 host boundaries and lifecycle — TEST-only author freeze

Status: **UNRUN**. Native author `gpt-6.1-sol / ultra`; worktree `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`.

Root's 15:30 UTC dispatch claim authorizes only the four NEW test/helper files below and this NEW report. Existing 104 tests, existing fixtures, production, canonical decisions and other lanes remain untouched. Parent-owned prior result is 104/104 PASS, receipt SHA256 `0e8470675cdbb3bb96a8bb4dc4b1379fcd15c377d10575ed5888f9a94cb0283b`; it is not execution evidence for these new cases.

## Authored cases

22 new identities: 14 boundary cases and 8 lifecycle cases. Parameterized rows count separately; no skips, TODOs or future-export collection imports.

| Family | Count | Independent oracle |
| --- | ---: | --- |
| DR-HB-01 | 1 | Current four-field artifact profile succeeds, one spawn, actual A0→A1 completion. |
| DR-HB-02 | 6 | Supabase shim, shell, Node, compiled native, Docker and JS launcher: after binding, only stable observed `lstat.mode` changes; bytes/dev/inode and descriptor remain identical. Refuse complete and first recovery, zero spawn. |
| DR-HB-03 | 7 | Attached/separate/equal `-H`, separate/equal `--host`, separate/equal `--context`. Command argv and historical raw kernel cmdline agree; complete and first recovery refuse, one total spawn. |
| DR-HL-01 | 1 | Actual host plus local-prefix adapters: actual staged/applied P then B, A0→A1→A2, closed transitions, distinct handles, original link restoration, no recovery diagnostic. |
| DR-HL-02 | 1 | Same host port and immutable artifact/lease/source binding reused after restoration; fresh preflight A2, distinct A3/A4 operations, four epochs, 20 distinct historical PIDs. |
| DR-HL-03 | 2 | Nonzero and signal failed P: actual runner preserves the actual host's original error identity; fresh trace/descendant/daemon/backend/boundary re-observation must precede B. Failed P has null accepted epoch; restored A2/B exists, no setup/observe/migration or receipt. |
| DR-HL-04 | 4 | After successful P, stale prior identity, foreign source/witness, foreign lease and repeated purpose refuse synchronously with unchanged spawn/read/write counters; legitimate B restoration still succeeds. |

## Source-backed defects and preserved contract

- `delivery-receiving-upgrade-host-executables.mjs:27–45` accepts descriptors with `path/sha256/dev/inode` only; `:118–130` checks mode stability within a read and any executable bit, not mode equality to the original attestation. DR-HB-01 proves this current profile is the intended positive baseline; DR-HB-02 does not introduce a new descriptor member that would fail shape validation before the attack. The future attested-mode DTO cascade is deliberately not implemented here.
- `delivery-receiving-upgrade-host-trace.mjs:95–110` rejects `-H`, `-H=`, `--host` and `--context` forms but its `:104–106` expression misses attached `-Htcp://foreign:2375`. DR-HB-03 changes both argv and captured raw cmdline, retaining matching PID/start/parent/executable facts, so an unrelated raw-argv mismatch cannot mask that case.
- `delivery-receiving-upgrade-host-reset.mjs:18–43,46–79,98–138` supplies the real private operation registry, single active slot, accepted-prior/source binding and fresh failed-reset recovery. Tests call those methods, not replacements that return accepted transition DTOs.
- `delivery-receiving-upgrade-local-prefix.mjs:89–127` explicitly permits a new preflight after restoration; DR-HL-02 tests this reuse instead of inventing a terminal-per-factory rule.
- `delivery-receiving-upgrade-local-reset-state.mjs:169–218,224–293` supplies actual staging/reset/transition/recovery/restoration behavior. `infra/run-delivery-receiving-upgrade.mjs:97–114,196–235` marks a reset attempted before awaiting, always restores after an attempted reset, preserves original failure and writes no passing receipt on failure. DR-HL-03 drives that real runner path.

Source paths above are under `/home/rob/.codex/worktrees/phase2-slice12/WeJammin/infra/database-upgrades/` unless prefixed `infra/`.

## Fixture authority and limits

The new lifecycle fixture injects only raw in-memory filesystem/process/clock/lease observations. It calls the existing frozen launcher-artifact installer **once** per harness, creates the actual host port once, and connects its methods to the actual local-prefix adapter. Wrappers record calls while invoking the real methods. No production validator, transition builder, accepted completion or recovery decision is mocked.

Every queued reset receives a distinct child, Node/Bun/Docker PID chain, start ticks, historical trace, raw create-response bytes and gateway exec ID. Historical process captures remain available after current `/proc` entries are retired. Terminal daemon facts and independent backend emptiness are separate observations. The exact fixed S11 Supabase command and reset argv remain unchanged; shell→Node preserves raw argv0 `node` while executable identity remains the independently resolved absolute Node path. These are small unit images, not real binaries.

At simulated spawn, the fixture reads the actual currently linked MemoryFs staging directory, records full file bytes and hashes, and derives the raw applied-migration history from those files. Neither request inventory nor returned transition determines the observed stage/history. Literal P/B expectations, physical identity sequence, daemon exec facts, prior history and restored symlink are asserted independently in the tests. The real local staging implementation performs the link switch and cleanup.

Failed-P cases hold an explicit deferred raw-boundary observation during first recovery. While held, only the first child has spawned and fresh trace plus all three drain observations have occurred. Explicit release permits B; the runner must reject with the exact original host failure object. No wall-clock sleep or timing guess is an oracle.

These are injected contract/unit tests, **not native host, kernel peer-credential, Docker causality, database identity, daemon-drain or real lock-FD proof**. No real process is spawned by the author. Native facade/attribution and production operational acceptance remain separate root gates.

## Original frozen author manifest

Paths below share prefix `tests/contracts/phase-02-slice-11-delivery-receiving-upgrade-`. Counts are physical lines before root-owned formatting.

| Suffix | Lines | SHA256 |
| --- | ---: | --- |
| `host-boundaries.test.ts` | 98 | `b79313993952fab160c09877da3411583fd46a9cbe87769c918f192b958bba55` |
| `host-lifecycle.test.ts` | 339 | `c352ad20b1bca0664390c923dfed7fb35b073385c8857665de915d6c95188827` |
| `host-lifecycle-fixtures.ts` | 183 | `9e99f78620667d51e8e7c92fac09fd28ae8b7f3ec3a6a76494881add14ecc86d` |
| `host-lifecycle-operation-fixtures.ts` | 116 | `12663cdaf0aef07d3140f83de7e3dfbea2fab2999a802a5d8027835b6dca1604` |

## Original handoff

Author performed source reads, bounded static counting/hashing and absolute `apply_patch` only. No formatter, parser, test/import execution, native/project commands, database, Docker, network or Git. No observed RED/GREEN result is claimed.

From current source, the intended discriminating REDs are the six mode-only attacks and the attached `-H` attack; the remaining positive/control/lifecycle outcomes are unobserved. Fixture-invalid failures must be diagnosed as such, not credited as implementation RED. TDD/testing-strategy guidance kept literal independent expected values, raw-vs-accepted authority separation and explicit failure ordering in scope.

Root next: full source read; format and enforce tests ≤400/helpers ≤300; run the two new test files together with the unchanged 104-case cohort; distinguish genuine defects from fixture failures; independent review before any separately claimed production/descriptor changes. No author edits after this freeze without a new dispatch claim.

## Constructor-closure TEST-only follow-up — UNRUN

Root subsequently reported the original 22 cases complete: **15 PASS / 7 FAIL / 0 skip**. Exactly six stable observed-mode attacks and attached `-H` improperly resolved; all eight actual host/local-prefix lifecycle cases and other controls passed. Root-owned JSON: `/tmp/wejammin-native-receiving-proto-red-BkaHbW/upgrade-host-22-first-behavior.json`, SHA256 `64fb1449b2facce4529c640559e1b115dd7e0fe6dcbe5b1dd906386059cda7d2`. This is parent-supplied execution evidence, not author execution. Root normalized the original four code files to 140/396/216/136 lines without assertion changes; the earlier manifest remains the historical pre-format author receipt.

The new dispatch releases **only** existing `host-boundaries.test.ts` and this report. Production, launcher fixture, HB01–HB03 and all lifecycle/old 104 cases remain frozen. One new identity, `DR-HB-04`, brings the authored boundary/lifecycle cohort to **23 cases**; preserved old 104 plus these 23 totals 127 for subsequent root validation.

DR-HB-04 first clones the existing binding and removes only mode fields. The first production assertion requires this missing-mode four-field profile to refuse construction with zero spawns. Against the current constructor, acceptance of that profile is the intended causal RED; no newly added field is present to trigger the old unknown-field guard first.

Only after that assertion, the case constructs a valid attested full-mode profile using independently checked literal unit `lstat.mode` values: `0o100755` for five executables and `0o100600` for JS. It requires valid construction without launching. For each of six artifacts it then requires refusal for a missing mode, invalid scalar/type/range modes, directory rather than regular-file type, and an extra descriptor field. The >uint32 control retains the low regular-file bits, preventing a type-bit check alone from masking the numeric bound. The intended contract is full raw numeric mode, safe integer in 0..uint32, including regular-file type—not a masked/coerced permission value.

Malformed-input refusals are **not claimed as observed RED**, nor as discriminating evidence while the old unknown-field guard rejects valid new mode profiles. Valid full-mode construction must pass before those later controls become meaningful. No fixture profile or production code has been changed for this TEST-first freeze.

Static preservation check: removing the appended DR-HB-04 block reconstructs the prior normalized boundary file exactly, SHA256 `bd15b53e1e04e63af5103c92b2b76d799677b59d9393743c03e015e782ce4705`. HB02's observed `lstat` mutations, HB03's consistent raw argv/cmdline changes and HB01's four-field positive remain byte-identical.

Current test-only freeze: `tests/contracts/phase-02-slice-11-delivery-receiving-upgrade-host-boundaries.test.ts`, **204 physical lines**, SHA256 `07dc565a1daef4fd951bb4a4dcf83993a965f8d5fc28d085ac80618d9428e9a7`.

Author again used source reads, static hashes/counts and absolute `apply_patch` only: no formatter, parser/import, tests, native process, DB, Docker, network or Git. New case remains **UNRUN**, with no native-host proof. Root next owns format/read, actual first-assertion RED and independent review before the separately proposed five-path GREEN release. No further author edits without another dispatch.

## GREEN source freeze — author UNRUN

Root subsequently reported DR-HB-04 **1 FAIL / 14 filtered**, specifically because the constructor accepted missing attested modes. Parent-owned receipt `upgrade-host-constructor-first-red.json`, SHA256 `c70486e460c7af052fa23338c559a7900ea39c6798bdfed391eb599d47c92631`. This is the observed missing-mode acceptance RED, not an unknown-new-field refusal. The earlier original 22-case receipt retains its seven genuine mode/attached-H failures. No author execution is implied by either parent-reported receipt.

Root then released exactly five existing paths: the two production files below, shared launcher fixture, boundary test and this report. Changes are limited to:

- `host-executables.mjs`: closed artifact descriptors now require full raw `mode`, a safe integer in 0..`0xffffffff` with regular-file type bits. `verifyFile()` retains all original regular-file/byte/hash/dev/inode/within-read-mode/executable-bit checks and additionally requires **both** observations equal the immutable attested mode. Mode is never learned from a later observation or reduced to permission bits. The static error label now includes mode.
- `host-trace.mjs`: creation-command selector expression is `/^(?:-H|--(?:context|host)(?:=|$))/`, rejecting attached `-H` while retaining existing separate/equal and long-option refusals. No process/provider CLI is executed by this source change.
- `host-launcher-fixtures.ts`: the existing `describe()` captures `stat.mode` alongside bytes/hash/dev/inode before binding construction. This single producer covers all five executable descriptors and JS, and therefore their trace references and both host harnesses.
- `host-boundaries.test.ts`: only HB01's authorized title, exact keys and literal full-mode assertions cascade. HB02/HB03/HB04 attacks remain unchanged, as do all lifecycle and old 104 test files. Case IDs remain preserved; authored total remains 127 including the constructor-closure case.

No other native-binding consumers require edits. `host-request.mjs:20–29,32–52,110` recursively copies/freezes the entire descriptor and compares exact fields; `host-executables.mjs` boundary equality and `host-trace.mjs` executable/captured-process equality therefore include mode automatically. Existing harness `structuredClone()` and lifecycle raw recursive copies also retain it. The native facade is still absent: these changes strengthen the injected consumer contract, not the authority or availability of a real producer.

Bounded static inverse checks reproduced each pre-edit source hash exactly after removing only its authorized delta: production executables `5eb70549246848deb1d38abc0c9b1811e7fb4b9dca4335d1c784af0d65906f7d`, trace `5c51e8b525215c536ce0a9fa3f1a9d351889ac0447a186af99a3c99307a022fe`, launcher `2fbb8c44f659698da8764108f938f7a058fc185a0e1fc5096f68ad737941e9ae`, boundary `a97a9ea9ab990c750509419bc930dc52cd01879460e3f07b53eb178de20469e2`. In particular, the boundary inverse changes HB01 alone; HB02/HB03/HB04 reconstruct byte-for-byte.

Current source-author manifest, before any further root formatting:

| Path suffix | Lines | SHA256 |
| --- | ---: | --- |
| `infra/database-upgrades/delivery-receiving-upgrade-host-executables.mjs` | 195 | `f8cc3b6d39e232ca391e68e2c8b158429ff4af51933e422663e847ef6b81dda0` |
| `infra/database-upgrades/delivery-receiving-upgrade-host-trace.mjs` | 235 | `3937da931fcc716f0197a6fe737fb81baec094eb06aba1917457d00227853a55` |
| `tests/contracts/phase-02-slice-11-delivery-receiving-upgrade-host-launcher-fixtures.ts` | 296 | `891aa4da86a3c37cab447ea9fad87d70459261859f5ea09f80fefe259866f7e3` |
| `tests/contracts/phase-02-slice-11-delivery-receiving-upgrade-host-boundaries.test.ts` | 217 | `d62a5338504320c514b91b34c19077e346ddb98caac26e79b7e00fd923790eb3` |

All changes remain **author UNRUN**. Only source reads, bounded static transformations/hash/count checks and absolute `apply_patch` were used; no project parser/import, formatter, tests, native process, DB, Docker, network or Git. TDD and surgical-change guidance kept the DTO cascade after causal RED and left the attack mutations intact. Root owns formatting, actual full 127-case validation, independent review and updated normalized hashes. No passing or native-host proof is claimed; no further author edits without another dispatch.
