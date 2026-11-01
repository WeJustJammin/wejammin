# DEC203 pending-demand attestation — TEST-source freeze

Author: native_pattern_green_20261016, native gpt-6.1-sol / ultra.
Status: source-only UNRUN. No observed RED/GREEN, native support or acceptance claim.

## Exact scope

Only these two new paths were written in the S12 worktree:

- `tests/native/helpers/dec203-stream-ingress-pending-cases.mjs`
- This handoff.

The helper exports only `pendingCases(check)`. It registers two callbacks when
called and allocates no fixture/process/socket at import. Root alone adds its
import and registration to the existing driver; that driver remains untouched here.
All existing TEST assertions, six native C/header sources and MJS production remain
read-only. Source hashes of the thirteen checked production/TEST inputs were unchanged
before/after authoring, including the C six, facade, scheduler, harness and driver.

## Frozen TEST source

`tests/native/helpers/dec203-stream-ingress-pending-cases.mjs`:

- Raw LF: 138.
- Bytes: 4646.
- SHA256: `9edb9026fde3f584c6b96faf4098bc970f599f95747f85b6de663ed173bee9f0`.

No parser/import/formatter/compiler/test/process/socket/signal/network/Git/DB action
was performed by this author. Only filesystem source reads, hashes/counts and
apply_patch were used. The runtime actions below describe authored TESTs, not actions
already executed.

## Cases and deterministic boundary

NS23: `pending accept duplicate attests owned source drift before LIMIT`.
Build a genuine ingress from the existing copied-subject fixture. Connect the fixed
real writer fixture, accept its stream and verify exact `AAAA` bytes with writer A.
No second connector is created. Start a fresh accept demand and immediately attach
both Promise handlers. Synchronously append a comment only to the tracked copied
`stream-ingress.c`, verify changed bytes, then immediately call duplicate accept.

NS24: `pending receive duplicate attests owned source drift before LIMIT`.
Use the same real construction path and independently verify exact `bbbb` bytes with
writer B. With both writers held live and no remaining literal bytes, start receive,
own its Promise immediately, mutate the tracked copied C source synchronously and
immediately call duplicate receive.

Neither boundary awaits between first demand, mutation and duplicate call. The
existing asynchronous Fixture.drift helper is deliberately not used at that boundary:
its filesystem awaits could permit the real ten-millisecond scheduler to settle the
first demand before the duplicate. Only a copied, tracked nonbinary source is changed;
the loaded addon is never overwritten, replaced or truncated.

Both target assertions require error code AND message
`DEC203_STREAM_IDENTITY_CHANGED`, not LIMIT. Mutation remains through that assertion.
The existing valid duplicate LIMIT controls in NS11/NS15 remain byte-unchanged;
foreign, closed and invalid-argument exemptions are not changed or reinterpreted.

## Owned cleanup and first failure

The first Promise is converted immediately into an owned fulfilled/rejected outcome,
so later scheduler rejection cannot become unhandled. In finally, genuine ingress
close is called before the cleanup helper's first await, stopping its scheduler and
revoking all retained descendants. Its Promise is also immediately observed.
The original demand must reject with IDENTITY_CHANGED or explicit cleanup's
CAPABILITY_CLOSED, never fulfill; code and message must match. Both pending settlement
and close use the existing bounded helper. A rejected close retains its actual error.

Exact original source bytes are restored and read back in a nested finally even when
pending settlement or close fails. Existing peer.stop is then explicitly awaited;
its unchanged FINISH protocol proves actual child/control/stdio settlement or reports
uncertainty. Fixture after-hooks retain their existing idempotent cleanup. No new
process wrapper, signal, force-kill, arbitrary command or resource-adoption seam exists.
Target failure remains primary; any cleanup failures are retained behind it in an
AggregateError rather than swallowed or substituted as passing cleanup.

## Normative contradiction and expected RED

Frozen main plan214 and interface111–115/169–178 require owner-build attestation on
every nonclosed valid-argument operation, including one made while another demand is
pending. Current `stream-ingress-facades.mjs`83–85 tests pending at84 and throws LIMIT
before observedStream at85. Its inspected SHA256 is
`812f69d473a3cd7e1de850604bf9d2e18d495feb91003f97db2b3deae35e8c9c`.

If genuine build/writer controls reach each discriminator, the current source is
expected to yield two specific code mismatches: actual DEC203_STREAM_LIMIT versus
required DEC203_STREAM_IDENTITY_CHANGED. Setup/native/compiler failures are not this
RED and must be reported separately. No failure has been observed by this author.

Root owns registration, normal-format/parser checks, actual RED, independent review,
any later exact production release and all native/integration validation. Actual
kernel/ancillary/NAPI/resource-fault, image/history/HTTP/daemon/backend/adapter080 and
hosted/canonical acceptance gates remain open; these two cases cannot clear them.
