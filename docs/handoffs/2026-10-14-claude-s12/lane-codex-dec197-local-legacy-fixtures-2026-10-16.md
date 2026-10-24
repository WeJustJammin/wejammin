# DEC-197 old local-suite owned-port compatibility

Date: 2026-10-16. Author: native gpt-6.1-sol / ultra.

Status: exact source changes frozen, author **UNRUN**. This is a TEST-fixture
compatibility candidate, not a passing-runtime receipt or native reset proof.
Root owns normalization, independent review, and all actual runs.

## Released four-path scope

- MODIFY `tests/contracts/phase-02-slice-11-delivery-receiving-upgrade-local-fixtures.ts`
- MODIFY `tests/contracts/phase-02-slice-11-delivery-receiving-upgrade-local-prefix.test.ts`
  only the P09 stimulus assignment.
- NEW `tests/contracts/phase-02-slice-11-delivery-receiving-upgrade-local-owned-reset-fixtures.ts`
- NEW this report.

No production, shared raw-process/boundary fixture, target DTO fixture,
renewal/host fixture, or other test file was changed. Every existing test
assertion remains byte-identical; the only test-file edit is the released
history-fault assignment.

## Root-observed antecedent

The original local 106-case cluster now reports 87 PASS, 19 FAIL, 0 SKIP,
confirming missing owned-port capabilities and the early P09 history premise.
Root supplied result SHA-256:

`99fae994c7a76335cb552f104c3a00cc972d12ddc735464104f565f7278d7687`

This follows the approved ownership/renewal contract cascade. The new pure/local
renewal cluster's root-observed 42 PASS is separate evidence. Earlier 106 PASS
predates this interface change and is not a passing receipt for these bytes.

## Opt-in boundary design

Only the old `fixture()` builder attaches the three trusted process-boundary
methods. `rawProcess` is unchanged and remains capability-free by default.
The new renewal `smallLocal()` calls `rawProcess` directly, so its missing-port
L02 control still receives no implicit capabilities or fallback.

The new helper maintains a private WeakMap, active/latest handle, registered /
running / settled state, drain status, and one-use recovery flag. Handles are
fresh frozen opaque objects. Unknown, stale, repeated-execution, overlapping,
or repeated-recovery handles refuse. Registration copies the expected inventory
bytes and independently captures the external raw identity; no epoch or reset
transition is created by the fixture.

Completion calls and awaits the existing `raw.process.run` vi.fn exactly once
for the stored reset command. It does not invoke a captured implementation,
replace the raw mock, spawn a client, or synthesize applied-history success.
Existing getMockImplementation holds, attempted-call accounting, exact argv
checks, staged captures, `state.resetError`, and original thrown error objects
therefore remain on the same boundary. The raw promise must settle before
recovery can observe the handle.

After that recorded raw reset, the fixture compares every captured staged
field/byte and independently computes its inventory digest. These checks occur
after raw entry, so they cannot substitute for a production before-reset
staging refusal: the existing no-mutation/count assertions still detect an
incorrect attempt. No production validator is imported or mocked.

This older raw model performs owned resets without changing physical identity.
Completion/recovery independently observe the raw state and require that image
to remain unchanged. Thus the old initial-identity assertions remain exact,
including the case that first observes a non-default container ID. Actual
physical renewal is covered by the separate literal renewal fixtures/tests;
this bridge does not pretend to exercise daemon recreation.

Recovery accepts only the same latest private handle after a settled raw
operation, or a registered operation that never entered the raw port. It
independently proves the unchanged raw image, does not issue another reset,
does not alter applied history, and consumes its authority once. Production
still decides whether history/source/lease observations authorize restoration.
Incomplete history therefore remains a manual-recovery boundary.

## P09 stimulus and ordinary DTO distinction

The new production begin boundary verifies prior applied history before reset.
Old P09 assigned corrupt history before calling reset but asserted one reset
attempt; that stimulus now exercises the earlier admission gate instead of the
intended post-reset verification.

P09 now assigns `mock.ownedReset.historyAfterReset = history`. The helper copies
that fault into the raw history response only after the existing reset settles,
before production's independent post-reset probe. Missing / extra / duplicate /
renamed mutations and every assertion, including exactly one reset and full
staged bytes, are unchanged. Ordinary `state.history` still means an immediate
raw observation override; it was not silently delayed or weakened globally.

The old session `mock.reset` remains an ordinary reset-input DTO. It is not a
runner-owned reset producer and receives no fabricated transition. Real prefix
production must still produce and validate its own transition; all session
argv/stdin/TAP/COMMIT, observer, lease, PID, source, timeout and close-drain
assertions remain untouched. Forbidden spawn/unknown-command calls still pass
through their original recording mocks and cannot disappear from noClient /
noMutationProcess checks.

## Static freeze

| File | LF lines | SHA-256 |
| --- | ---: | --- |
| New owned-reset fixture helper | 175 | `29e3ea273c2d102501832d5eaac0c372aee11b1db85b691e7501f24f2174b74a` |
| Modified old local fixture builder | 283 | `4acd9c4759fb86f0a7f97728f0021821c983400a7f2c2a6d76099a700584235f` |
| P09 stimulus-only test file | 386 | `67d75c046fda399480eefaf61fe2e2df1aa173774a7a0e1066510413f3a6d3e3` |
| Unchanged shared raw-process fixture | 195 | `620fcf57d87acdd61030c2bce4992a4f88ee9afac480cd49d7412a984c5af30f` |

The new P09 assignment occurs once. Reversing only that assignment reconstructs
pre-edit test SHA-256
`c26f1c52d03455c61a80916afea8ab5af66ec3295a47da231d6e6cb0c26d9ce8`.
Both edited/new utilities remain under 300 normal-format lines before root's
formatter. The shared raw process implementation was not changed.

Author performed file edits and read-only text/hash analysis only. No formatter,
parser, import, test, native process, database, network, or Git operation ran.
Root must run the old 106 cases together with the new 42 renewal cases and the
relevant typed/lint gates, then verify retained mutants/negative controls as
required. This report establishes no native ownership, backend drain, physical
renewal, hosted acceptance, or passing receipt beyond the supplied antecedents.
