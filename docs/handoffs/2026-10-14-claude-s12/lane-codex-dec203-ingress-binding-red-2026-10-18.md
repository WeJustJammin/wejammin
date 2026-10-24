# DEC-203 private ingress binding TEST freeze

Status: extended167-case source-only author freeze, UNRUN. Exactly three NEW paths are authored in
`/home/rob/.codex/worktrees/phase2-slice12/WeJammin`. No production, existing fixture,
trace, binding, package, runner or policy file was changed. Root owns formatting,
syntax/type/lint checks, test collection/execution, independent review and GREEN.
The issue852 fallback was used only for explicitly approved literal Node filesystem
source reads, hashes and counts. No project module was imported or parsed, no test,
formatter, native probe, listener, socket, CLI, database, Docker, Git or network ran.

## Authority and source baseline

- Exact TEST claim and contract: `briefs/codex-dec203-isolated-native-tracing.md:26–34`.
  Eight mandatory binding keys, no optional/legacy-ingress mode; four ingress keys;
  five identity keys; canonical lossless decimal identities; current Node UID;
  full modes `0o040700`/`0o140600`; exact private endpoint and immutable upstream.
- Reviewed design remains `lane-codex-dec203-binding-contract-2026-10-18.md`, SHA
  `56a4e11d9e35815635ce79c93155347b3b72890e77dd1604cd485a2c59ced8f3`.
  Its real lifetime, all-client, operation-policy and native proof gates remain OPEN.
- Actual production exports under test are `assertBinding` and `verifyExecutables`
  in `infra/database-upgrades/delivery-receiving-upgrade-host-executables.mjs`:
  closed seven-key receiving guard at53–64, existing daemon/environment guards
  at66–113, observed artifact checks at123–194. Receiving source SHA
  `f8cc3b6d39e232ca391e68e2c8b158429ff4af51933e422663e847ef6b81dda0`.
- Reused frozen in-memory ports: `tests/contracts/phase-02-slice-11-delivery-receiving-upgrade-host-renewal-fixtures.ts:47–195`,
  SHA `042912266ca4b73582ab37e54d31c2063e8b12a2ac1706e29df476656b0b2d59`;
  `phase-02-slice-11-delivery-receiving-upgrade-host-launcher-fixtures.ts:23–92`,
  SHA `891aa4da86a3c37cab447ea9fad87d70459261859f5ea09f80fefe259866f7e3`.
  Their synthetic artifact/profile records are reused, never rewritten on disk.
  Existing `local-boundary-fixtures.ts:28–87` blocks native filesystem/process use.
- Existing `renewal-fixtures.ts:148–164` imports the real module inside each case
  and asserts actual exports; there is no future helper, collector stub or mock
  implementation of either validator.

## Independent fixture facts and oracles

`phase-02-slice-11-dec203-ingress-fixtures.ts:33–127` creates a fresh in-memory fixture
per case. The private parent is `/unit/dec203-private-01`; socket is its exact
`docker.sock`; child DOCKER_HOST is the private Unix endpoint, while the daemon
and upstream endpoint remain `unix:///run/docker.sock`. No actual pathname is made.

The DTO and raw stat observations are separate literal objects, not shared objects
or DTO echoes. Parent device/inode are independently written as
`9007199254740993`/`9007199254740997`; socket inode is `9007199254741009`.
BigInt stat observations preserve them losslessly. Numeric stat observations emulate
Number rounding instead: decrement-by-one faults deliberately alias under an unsafe
Number conversion. UID is obtained from the current test Node process, not from a
request, environment variable or mocked process PID. The two full modes and kinds
are independent observations. The legacy executable filesystem delegates unchanged
to the frozen fixture; no raw production or native artifact is used.

The new `profilePremises` checks literal eight/four/five-key sets, modes, UID,
private/upstream endpoints and paths. IB01 requires `assertBinding` return undefined,
with zero injected filesystem/process calls: shape validation is not a capability.
IB03 requires successful real verification, actual parent/socket lstat and realpath
calls, and reads of all five executable artifacts plus the JS launcher.

`rejectsShape` first requires the valid eight-key profile, then mutates only the
chosen literal field. It requires a refusal Error, excludes a forbidden-host-I/O
guard as the refusal, and preserves zero filesystem/process calls. For malformed
parent paths, `changePath` keeps the dependent socket, endpoint and DOCKER_HOST
coherent with `join(parent,'docker.sock')`; redundant separators and dot segments
cannot be rejected only because an unrelated dependent field was left inconsistent.

`rejectsObservation` first successfully verifies the valid profile. Only then are
filesystem call counters cleared, the chosen raw fact changed, and verification
required to refuse with the DTO unchanged. Clearing counters never discards a failed
premise, error or process call. IB18 requires an actual affected-path observation
from the fault invocation: lstat for stat faults, realpath for canonical-path faults,
either for absence. No validator is replaced or forced to succeed. All promises are
awaited. `noProcess` requires zero injected spawn/run/boundary-observer calls.

## Original152-case count

| Cohort | Identities / derivation | Cases |
|---|---|---:|
| Valid/legacy controls | IB01–05:1+1+1+2+1 | 6 |
| Closed/missing/non-record shapes | IB06–09,20,22:8+4+4+10+4+3 | 33 |
| Identity values/types/paths/modes | IB10–14:32+2+10+14+8 | 66 |
| Endpoint/environment/package selectors | IB15 literal table | 15 |
| UTF-8 limit, distinct IDs, upstream alias | IB16,17,21:2+1+1 | 4 |
| Independent filesystem faults | IB18:2 identities×8 faults | 16 |
| Retained executable/launcher guards | IB19:6 artifacts×2 faults | 12 |
| Total | 6+33+66+15+4+16+12 | 152 |

Controls include zero device IDs, positive inode IDs beyond safe Number precision,
and a107-byte UTF-8 path. Negative bounds include108-byte ASCII and109-byte UTF-8
paths whose JavaScript character lengths alone would pass. The coherent `/run`
fixture separately makes socket/endpoint equal the upstream while preserving their
join relationship; constructor refusal must not depend only on mismatched fields.

## Root-reported original152 RED and its limits

Root reports actual152 execution:3PASS/149FAIL/0pending. IB02 failed its expected-throw
assertion because the unchanged seven-key legacy profile was admitted: genuine
mandatory-ingress admission RED. Log SHA
`abb22527360a7d890d52589a83fc0594f0e8cc6e2e0a779518431d064331fc57`;
JSON SHA `168f490d503d284f298aa9268231729acf24207a20833eecc4e2ff4b6ec39b1d`.
These receipts are ROOT-reported, not executed or independently replayed by this author.
The receiving guard rejects the new eight-key profile
before filesystem observation. Thus most other cases first fail their new positive
premise; those are NOT independent evidence for each late identity/observation fault.
IB06 separately removes ingress from the otherwise valid PRIVATE-environment profile,
so future optional-ingress acceptance cannot hide behind the legacy environment rule.
IB16/21 may already refuse only because the new key is unknown; that is not coverage
of length or upstream-alias semantics. After GREEN, valid premises must pass and
each negative mutation must independently discriminate. Missing export/import or
invalid fixture is a setup failure, not ingress behavior RED. No actual result for
the new167-case identity is claimed.

## Historical152-case authored-byte freeze

All paths below are NEW. Counts describe author bytes before root normalization.

| Path | Lines / bytes | SHA256 |
|---|---:|---|
| `tests/contracts/phase-02-slice-11-dec203-ingress-binding.test.ts` | 207 / 8902 | `47dfd2135f71692fc923fa0fe0a9559b6ec8240e04a7e6c3d6f54f8247e0cf12` |
| `tests/contracts/phase-02-slice-11-dec203-ingress-fixtures.ts` | 211 / 8107 | `7d80e2668d3d10a25f3827b34e07f6b18935720c9fe86092527bdd85015e17f3` |
| `docs/handoffs/2026-10-14-claude-s12/lane-codex-dec203-ingress-binding-red-2026-10-18.md` | This report; hash sent separately | — |

Root subsequently normalized the main to288lines/9551bytes, SHA
`720965378dbe992a3b000068d75a79ac2d719e494addbfc911d2edbc15cd7ab1`,
and helper to251lines/8282bytes, SHA
`94f6632e68549ba5314841978899d2297d08a95adf635bd1779037deeed0847c`.
Those are the receiving source identities for the bounded edge amendment below.

## Bounded canonical-decimal and tuple-identity extension

All original152 assertion bodies and case registrations remain byte-identical after
the inverse below. IB23 adds LF, CRLF and trailing-space spellings (`'1\n'`,
`'1\r\n'`, `'1 '`) for each identity/decimal field:2parts×2fields×3=12cases.
Device-only `'0 '` contributes two more. These are canonical-spelling negatives,
not a claim of a present regex bug. In particular, this report does NOT claim that
a plain JavaScript `$` anchor without multiline accepts a final line terminator.
The extra cases guard coercion/trimming or multiline acceptance; this author ran
no regex probe. All14 still require the same valid-profile premise before mutation.

IB24 adds one positive through the fixture's closed, default-false
`sameInodeDifferentDevice` branch. The parent remains literal device
`9007199254740993`, inode `9007199254740997`; the socket uses literal device
`9007199254740995`, inode `9007199254740997`. The DTO and raw BigInt observations
are assigned independently, and the callback asserts all eight literal values
before requiring real `verifyExecutables` success and zero process calls. No raw
observation is copied from the DTO. Distinct identity means the `(device,inode)`
TUPLE: equal inode numbers on different devices must not be rejected. This is a
synthetic structural-policy control, not proof of a real cross-device listener.

Current finite source count is152+14+1=167. The added cases make no native/lifetime
claim, and none has executed. Existing late-oracle limitations above still apply.

Exact source inverse for the receiving root-normalized152 files:

1. Main: remove only the two `decimalEdges`/`equalInodeControl` import-content
   lines and the appended IB23 loop plus IB24 registration, including their added
   preceding separator. Result is288lines/9551bytes/SHA `720965378d...7ab1` exactly.
2. Helper: restore the original one-line `ingressFixture(parentPath = ...)`
   signature, remove only the six-line default-false branch, and remove the appended
   `decimalEdges` and `equalInodeControl` exports plus their preceding separator.
   Result is251lines/8282bytes/SHA `94f6632e...847c` exactly. Normal existing fixture
   calls keep the original default profile and all independent facts unchanged.

| Current path | Lines / bytes | SHA256 |
|---|---:|---|
| `tests/contracts/phase-02-slice-11-dec203-ingress-binding.test.ts` | 299 / 9910 | `2003b6b6175f3e05aeb07495a3648fc2334af369ec19719a29c00d8d862e3c18` |
| `tests/contracts/phase-02-slice-11-dec203-ingress-fixtures.ts` | 286 / 9530 | `32a1e3ede4b67fd6cf0d99ab09220c4244b76139c6fb925fef3b388cec7a62bd` |
| This report | Final hash accompanies freeze | — |

Root owns the final normal-format≤300 checks, syntax/type/lint checks, complete167
collection/run and independent review. No extra path or limit increase is assumed.
Preserve all old cohorts/fixtures; future mandatory-ingress fixture cascade requires
its own release. Production bindings remain PLAN-only, not implemented by this lane.

No private ingress lifetime, current peer identity, continuous supervisor history,
Docker protocol/witness completeness, all-client quiescence/drain, real artifact
ownership, reset renewal/restoration, native080 or canonical acceptance is proved.
No binding/trace implementation or real proxy/reset integration is released here.
