# DEC203 lifetime capability — source GREEN candidate

Status: author UNRUN; source implementation only, not verified GREEN.
Author: inherited native gpt-6.1-sol/ultra.
Worktree: `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`.
Only the six NEW production paths and this NEW report were written.

## Authority and RED identity

Release: `briefs/codex-dec203-peer-lifetime-green.md:7–102`.
Locked lifetime plan SHA
`22ae73078eb919f5d30eb662b9ea6091758e11d3c49ca4d31e337e2ce2f582ce`;
locked build/facade plan SHA
`9a63dbcd28d458132c2f3e06f2124b8240209af0931d7d4c11186b59544f3569`.
Both plans and all ten frozen TEST files were read before source edits.

Root reports actual48-case missing-API RED:0PASS/48FAIL/0skip/cancel,
all48 ERR_MODULE_NOT_FOUND, not native behavior or kernel-support evidence.
Receipt SHA
`ef9a0a70dffa01a9e03d74147e50143b9aeeb44b0b4460c9f8909fc7b259039d`.
Canonical11-entry TEST/report manifest SHA
`6098300b1abe962e490e7c2683a0f7783ceda80f36470255711d6293828d18a8`.

## Initial author source freeze (historical)

All filenames below are under `infra/database-upgrades/native-tracing/`.
These counts and hashes precede root normalization and the LB16 repair below;
they are author bytes, not a formatter/parser/compiler result.

| New file | LF | Bytes | SHA256 |
| --- | ---: | ---: | --- |
| `peer-lifetime.mjs` |202|5842|`818cadec6d3609c175fe38f5112e70a182ac9bfd0344aa582b1242269f2588a5`|
| `peer-lifetime-build.mjs` |185|5388|`96b6d91008752f075d39540f98a221ad238bd544e9830e9756822aeaff77046e`|
| `peer-lifetime-compiler.mjs` |250|6672|`5d369154a3d40d7f9028afd1499998a078e98ead22288ef951a7c61a329ef11d`|
| `peer-lifetime-output.mjs` |37|916|`e7f99e1b67c3f9948acb0f91db40330d0b89d973067499d2a748c9fcc95b8b6b`|
| `peer-lifetime.c` |137|5195|`fa0789269dd31b96740050ee8346f8f4c45845c9c54a16c1dbea1bd32c6b3519`|
| `peer-lifetime-state.h` |196|6085|`d8c3be71b3b85bde1d8a9e330c032f510e505f9546264a25dbc1fdb9de18f5ad`|

Normal formatting remains root-owned. The three MJS files other than the
250-line compiler have substantial headroom; C and header are ordinary functions,
not macro-packed implementations. Estimated normal C/header sizes are below250
and280 respectively, not measured promises. No additional helper is requested.
Stop for a precise extension if root's actual normal preview exceeds300.

## Implemented boundaries requiring independent review

- `peer-lifetime.mjs:92–202`: module-local WeakMap across only this module's
  readers; entry owns actual native handle, build records, closed/exited state.
  Shared facade methods select the actual receiver's owner. Foreign/Proxy/copy-
  module receivers refuse before native access. Public handles have only read/close.
- `peer-lifetime.mjs:104–136`: source/toolchain/output attestation brackets a
  native read even when that native call fails; the first failure is retained.
  Closed-token priority remains; the original cached-exit shortcut is corrected
  by the later LB16 section below.
- `peer-lifetime.mjs:146–198`: open cleans a newly acquired native handle on
  post-acquisition failure. Reader close revokes its own entire set synchronously,
  attempts all native closes despite input drift, then performs owned-output
  cleanup asynchronously; repeated close returns the same settlement promise.
- `peer-lifetime-build.mjs:34–185`: exact three own data-valued options, fixed
  C/header paths, Node22.23.1/API8 gate, fixed compiler argv/environment via the
  compiler copy, and six deeply frozen metadata keys. supportSources has exactly
  the one local-header artifact; Node headers remain the four separate records.
- `peer-lifetime-build.mjs:67–107`: before/after load and active-operation checks
  retain file/directory identity and byte pins. This is not descriptor-atomic
  dlopen or hostile-same-UID isolation. Actual native exports must have one own key.
- `peer-lifetime.c:30–137`: actual native receiver type check and private API8
  type tag precede unwrap. Native callbacks are receiver-based, not pointer-bound
  to the method's origin. Before wrap, C owns allocation cleanup; after successful
  wrap only the finalizer frees it, including failed post-wrap construction.
- `peer-lifetime-state.h:44–113`: original caller fd is never closed. Independently
  acquired socket duplicate and kernel SO_PEERPIDFD fd are privately held and
  CLOEXEC; observed original/duplicate identity, Unix/stream/connected/peer checks
  precede acceptance. Missing/unsupported/ambiguous capability refuses; no PID lookup.
- `peer-lifetime-state.h:115–194`: exact zero-timeout one-pidfd poll, fdinfo, poll;
  terminal IN or HUP takes precedence over ERR and latches exit. Inconsistent,
  nonterminal error or unknown states never mean alive. Exactly one matching
  positive fdinfo Pid is required for success; nonpositive/malformed observations
  still receive the second exit check. Close detaches each slot before its sole
  attempt, attempts both and never retries EINTR/EBADF. Finalizer makes no JS call.

The only project-local C include is the literal `peer-lifetime-state.h`.
That header includes platform headers only; Node-API C includes node_api.h and
math.h directly. The fixed local support closure and all four Node headers are
captured/rechecked with compiler/source/output records. Platform headers/toolchain
remain trusted OS inputs, not a new hermetic compilation claim.

## Exact extraction/inverse evidence — filesystem/string analysis only

The new compiler inverse replaces exactly `./peer-lifetime.c` with
`./peer-credentials.c`, and exported `compileLifetime(` with `compilePeer(`.
It reproduces all original compiler bytes, SHA
`bc4361112d4f2977ab21caa3876a93f5cb101cfd0de7c3941c016fff246551f4`.
All30s/5s monotonic deadline, fence, one-signal, pending-record, stream/session
absence, diagnostic and uncertain-retention code is otherwise byte-identical.
The build coordinator additionally retains the uncertain input/build record.

Function blocks below include their final LF, not their separator blank lines:

| Inverse block | Exact original SHA256 |
| --- | --- |
| Socket helpers: only PIDFD invalid-socket token reverted | `6b826f61a30768dd9618ecb5662765e37538ab25e77b661dd2c4bd188ef06eb4` |
| Runtime/options helpers, unchanged | `91a96b72bc88c4864d1e84ce668fa00127824501057fada83bd35e9c76bf8551` |
| Output identity helper, unchanged | `afb25b4398bdc8dae95e46e9eea6985fcdcc3a03ab8d41151be6f824f5b3d558` |
| Reservation: only private name and fixed output basename reverted | `8d0f5c976784307b223a2fb94aa88a4da5d90d8bef8e476c1269ddc703e0f7b8` |

Each inverse compared equal to the actual frozen source block, not merely a
matching title or token. The original Socket getter is copied unchanged too.
Load, coordinator/facade and native state code are new/adapted logic; their
behavior is not established by those mechanical inverses. The adapted loader
uses Reflect.ownKeys for the closed native-export check while keeping build/load
error family and artifact-failure precedence.

## Protected-source readback

All11 TEST/report entries still match root's canonical manifest exactly after
authoring. No TEST/fixture/oracle was changed to accommodate these sources.
The four original production files also retain these full hashes:

| Frozen file | SHA256 |
| --- | --- |
| `peer-credentials.mjs` | `171031e458814f4e48b9e9d38e05c31aaf492834ac602c98e0b6d5d0c5f1ef21` |
| `peer-credentials.c` | `d328ec58d5443db33ad0fdf1cb87981e51e4b3b362dc02cc1177b835c01edc4c` |
| `peer-artifacts.mjs` | `38a022186e7555e02696022daa71fc7eed1de540243116fc4a14e9ae21b8b65f` |
| `peer-build.mjs` | `bc4361112d4f2977ab21caa3876a93f5cb101cfd0de7c3941c016fff246551f4` |

No writes to binding721, old34 native tests, original reports/briefs/plans,
generic helpers, package/configuration or any migration were performed.
Those broad cohorts were not executed or independently revalidated by this author.

## Required root gates and remaining risks

Root must read all new logic, normalize/check300-line gates, run syntax-only
checks without importing top-level TEST drivers, lint and actual new48 cases
under the admitted Node/compiler/header environment. Preserve original34 and
binding721 cohorts and their real assertion identities. Record actual supported
or unavailable results separately from missing-API RED.

Actual SO_PEERPIDFD support is UNPROVEN. An unavailable branch is not positive
acceptance; real kernel peer identity/live/exit/stale-open, receiver safety,
original-fd non-retargeting and no-owned-fd-leak observations remain root gates.
Rare allocation/NAPI/close/poll/error paths are source-reviewed candidates, not
actually induced fault evidence. A normal successful loop cannot establish them.
The actual half-open Socket premise and deterministic fd-reuse premise may still
fail independently of these sources; classify setup separately, without bypasses.

No accepted-Socket registry, continuous history, forwarding/proxy, daemon/API,
reset, native080 or canonical/Phase2 acceptance is implemented or claimed.
Connection-time peer capability is not per-byte writer attribution.

The TDD skill kept the frozen root-observed RED separate from author implementation;
surgical-development guidance limited reuse to the named generic exports and
new fixed-source copies. Author used only native filesystem source reads,
text/hash/count/inverse analysis and apply_patch. No parser, project import,
formatter, compiler, test, process/socket orchestration, signal, DB, Docker,
Git, network, secret access, install, privilege or policy action was run.

## LB16 bounded repair — root-observed49-case RED

Root released only `peer-lifetime.mjs` and this report for this correction.
Root reports an actual safe-fixture49-case run:48PASS/1FAIL/0skip/cancel,
status1. The sole failure was `LB16 latched peer exit still attests owned source`:
actual `DEC203_PIDFD_PEER_EXITED`, expected `DEC203_IDENTITY_CHANGED`.
Receipt `/tmp/wejammin-native-s12-20261017.Adf0uP/dec203-lifetime-49-safe-fixture-red.log`,
SHA256 `ccb32f116ed66df49db76247a2212b9db969edb8596f19fd2a8a1e8cb4e8305d`.
Root reports all100 guarded pins stable. Current safe12 TEST manifest SHA256:
`fd0dd725232dd54c43195a30041580b067c2aa47dfbe3101f7b2e29ab6574703`.
These are root-reported execution facts, not this author's execution or acceptance.
Earlier missing-API/UNPROVEN statements above describe the initial author handoff.

The cache decision now occurs inside `observed(entry.owner.build, ...)` in
`peer-lifetime.mjs:127–140`. Every nonclosed public read therefore attests its
actual owner's inputs before evaluating cached exit, and the existing observed
wrapper performs the after-check while retaining the primary failure. Intact
inputs still yield the cached peer-exit token. Closed-first priority, the native
error latch, receiver-owner registry, and all other code remain unchanged.

Current raw wrapper freeze:211 LF,5895 bytes, SHA256
`89a40508e3230327c9728d9768398ffbbce7f2a5381b2def90aef8432f37fbe5`.
Exact inverse: replace only the expanded observed callback with the old one-line
native-read callback and reinsert the identical cached-exit guard immediately
before the try. The moved block occurs once. Filesystem/string analysis recovers
all5869 original bytes and SHA256
`508020b639fdc8f80bea6a63fce9b6738ce8f910a19e02a825756f4bbfb7ec30`.

No TEST, native C/header, compiler, generic helper or other production path was
edited. Author UNRUN: source read/hash/count/inverse analysis and apply_patch only;
no parser/import/formatter/lint/compiler/test/process/socket/Git/network action.
Root owns normalization, review and actual49-case rerun; no new GREEN or broader
forwarding/history/native080 acceptance is claimed by this repair.
