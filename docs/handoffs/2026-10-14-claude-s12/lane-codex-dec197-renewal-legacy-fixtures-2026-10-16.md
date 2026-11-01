# DEC-197 legacy runner DTO fixture cascade — UNRUN

Native `gpt-6.1-sol` / `ultra`, 2026-10-16. Worktree:
`/home/rob/.codex/worktrees/phase2-slice12/WeJammin`.

## Release and observed diagnostic

Exact three-path claim is Slice12 Dispatch:2891: target-fixtures.ts, fixtures.ts
and this new report. No assertion file, new renewal test, local fixture, production
module, source inventory, SQL, README or tracker changed.

The approved 143-line `briefs/codex-dec197-renewal-contract-plan.md` was read in
full, particularly immutable authority/closed transitions14-46, failure recovery
59-100, and the separately claimed legacy fixture cascade122-126. Current pure
transition validator and runner source were read, not executed. TDD/surgical scope
keeps production validation strict and updates only the injected boundary DTOs.

Root's existing six-main-suite diagnostic was read as data:
`/tmp/wejammin-native-receiving-proto-red-BkaHbW/upgrade-legacy-main-renewal-dto-diagnostic.json`,
SHA-256 `e61e2546cbb046bb5cbec24efa731ff060b83426b2400b8f54aa595a26c37a73`.
It contains 314 cases, 300 PASS, 14 FAIL, zero skips. The failures are T03x3,
X01x2, X03x4, X04x2, X05x1 and X06x2. All route through world()'s previously
missing closed transition, before the intended migration/error assertions.
This report claims no post-change runtime result.

## Minimal fixture change

Target-fixtures:158-251 adds closedIdentity and runnerResetFixtures. The latter
receives the plan hashes/target/mode and actual fixture observedContainerId. It
applies that observed ID before capturing any transition. Existing identities,
owner/OID, baseline digest and `unit-prefix-${mode}` / `unit-restored-${mode}`
epoch strings are preserved; legacy physical A0=A1=A2 remains unchanged.

The independent factory spells out the 11 approved transition fields, including
literal kind, purpose/sequence1 or2, copied five-field from/to identities, epochs,
source/witness and the distinct prefix/baseline inventory digests. Every identity
includes a separately cloned target. No production transition constructor,
validator or native module is used to generate expected DTOs. Existing ordinary
reset()/envelope() fixtures and signatures remain unchanged for local-session
input consumers; the runner still rejects a result without its closed transition.

world():168 selects these enriched reset/restoration outputs. Normal transitions
are created exactly once, before tests mutate output fields. They are not rebuilt
at resetBefore/restoreBaseline call time. Consequently existing container, cluster,
OID, epoch, digest and marker mutants retain their original deliberate mismatch;
there is no automatic transition repair or global identity replacement.

world():237-246 records failedPrefix only after resetBefore actually throws,
then rethrows the same error object. Only this branch selects the precomputed
recovery metadata at restoreBaseline:266-276. Its exact recoveryAttempt is
`{purpose:'prefix',sequence:1,from:A0,to:A0,acceptedEpoch:null}`, and its baseline
transition has fromEpoch:null. The independently captured unchanged identity
models the existing failed-prefix fixture; it never adopts a mutated reset DTO.
All top-level restoration output fields remain those exposed to existing mutants.
Normal restoration has no recoveryAttempt. Events, same-plan/reset assertions,
error injection and receipt collection are otherwise unchanged. A failed prefix
remains an error/no-receipt scenario, not a successful renewal.

The new renewal suite's valid output/IO overrides remain untouched, as do the
local suite's raw observations. These injected fixtures do not establish native
operation ownership, reset execution, backend drain or database acceptance.

## Static readback and freeze

Both modified helpers were read back completely, with expanded standard source
below 300 lines and no new trailing whitespace. No formatter was executed.
Removing the appended target helper exactly reproduces the original 4030 bytes,
SHA-256 `3c8b0c0e1c701b5533d3f4989ad3e366c0166c160fa3f6c481e1f146585f36f4`.
In-memory reversal of only the declared world edits reproduces its original
8086 bytes, SHA-256 `dad51472dccc5a120deb39c4fc0b5cd31936c1fea4af54a80d8a32015a623bfa`.

| Path | Lines | Bytes | SHA-256 |
| --- | ---: | ---: | --- |
| `tests/contracts/phase-02-slice-11-delivery-receiving-upgrade-target-fixtures.ts` | 251 | 6297 | `3a7dd8ce4e4adf587e5467ee8f2d8ea4a0ae5b5e6e6b6e76744b1bb22a65f9ac` |
| `tests/contracts/phase-02-slice-11-delivery-receiving-upgrade-fixtures.ts` | 285 | 8250 | `f3e145f7fdc6706fb4f4ba6943d4a32cc001506e00a6bdcf9f452e34714f8ede` |

Report self-hash is supplied externally. Author **UNRUN**: no parser, formatter,
tests, imports/runtime, processes, database, network, Git or CI execution.
Root owns normalization, old314/new28/local14 checks and independent review;
native bridge/attribution/restoration acceptance remains a separate gate.
