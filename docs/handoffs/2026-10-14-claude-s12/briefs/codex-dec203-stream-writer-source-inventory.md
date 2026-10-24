# DEC-203 per-writer stream evidence: source inventory

Root public Linux6.17 research, 2026-10-18. Candidate direction only. No private
API, kernel support, Node integration, forwarding or authority is selected here.
The actual local kernel is different; source semantics need real native tests.

## Immutable source inputs

All paths use `https://raw.githubusercontent.com/torvalds/linux/v6.17/`:

| Path | Bytes | SHA256 |
| --- | ---: | --- |
| `net/unix/af_unix.c` | 94176 | `4ceb96094d9e65166901d3a9017a9049a5ef3eaec7252f40b5667d45a49c2887` |
| `net/core/scm.c` | 12628 | `48606905560f10bc68bd9bf6a4679762b65a2bcd38ea4d34b635af7f6bb835a1` |
| `include/net/scm.h` | 2933 | `cb25a2647fbfec403f71c838bc36c3bccc568d4b00b69452aa8666ee67d207f0` |

Root fetched and indexed all three official files. No local socket operation,
policy change, syscall feature probe, unrelated process observation or secret
access occurred for this research.

## Verified source relationships

- `af_unix.c:816-818` treats credential delivery or pidfd delivery as a request
  to preserve sender credentials. `:2039-2056` attaches current thread-group PID
  and current UID/GID when needed and no explicit SCM sender is already present.
- `af_unix.c:2062-2068` compares queued sender PID, UID/GID and security data.
  `:3036-3044` stops stream aggregation when that sender identity changes. Thus
  a stream is not necessarily one connector's bytes for its whole lifetime.
- `af_unix.c:3113-3115` hands receive-side SCM state to `scm_recv_unix`.
  `scm.c:542-551` conditionally adds a pidfd when receiver-side pidfd delivery
  is enabled, before releasing its credential reference.
- `scm.c:465-496` uses `pidfd_prepare(..., PIDFD_STALE, ...)`. Insufficient
  ancillary space sets MSG_CTRUNC. Missing SCM PID produces no pidfd; allocation
  failure can leave a negative result to be encoded. A receiver must not treat
  absent, truncated or negative ancillary results as a usable lifetime handle.
- `scm.c:49-66` validates explicitly supplied credentials against current
  identity or namespace capabilities. Per-message credentials are not protection
  against a privileged host adversary. Namespace/capability assumptions must be
  explicit and joined to the owned supervisor history, not inferred from a number.
- `scm.h:69-98` retains actual PID references and defaults to current thread-group
  identity, not a caller JSON request's declared PID.

## Candidate, NOT selected architecture

### Listener-before-first-byte source follow-up — 2026-10-18T17:34Z

Root fetched the same immutable `af_unix.c` plus `net/core/sock.c`
(112574bytes, SHA256 `25305e30f6a89ac625b6b244128410295da1b4ac25327cd875126f7c4718cf05`)
and `include/uapi/asm-generic/socket.h` (4116bytes, SHA256
`23df5ed2dca8ae80ec5ae21f05b5b6a0d4138bab7851a3e0da087e0b73df3c55`).
All official Linuxv6.17 URLs share the prefix above. `sock.c:1547–1566`
sets the receive credential/pidfd flags; `:1869–1881` reports them.
The generic ABI header defines SO_PASSCRED16 and SO_PASSPIDFD76; actual build
ABI and kernel behavior still require native controls, not numeric guessing.

`af_unix.c:1762–1765` copies the listening socket's `sk_scm_recv_flags`
to the newly connected server socket during connect. `:1889–1901` accepts
and grafts that same queued socket. This supports an exclusively native listener
that enables both options before listening, rather than a Node/libuv reader
paused after it may have consumed bytes. It does not prove the current custom
kernel or actual queued-before-accept behavior. Those need real two-writer tests.

Root releases only one new design document to native_pattern_green_20261016:
`lane-codex-dec203-native-stream-ingress-plan-2026-10-18.md`, naturally≤300lines.
Specify a fixed-source Node-API8 owner of listener/accept/recvmsg and exact private
resource/byte/writer capability semantics, received-FD cleanup and actual TDD
controls. No production/TEST source, forwarding, binding integration or acceptance
is released. Existing peer and lifetime helper interfaces/bytes stay frozen.

### Receive-side rights refusal source follow-up — 2026-10-18T17:40Z

The same generic socket header defines SO_PASSRIGHTS83 at148. The same
`sock.c:1568–1573,1883–1888` sets/gets the Unix receive-rights flag.
`af_unix.c:1118` defaults it on; stream send at2496–2500 rejects a queued
SCM_RIGHTS payload with EPERM when the destination's receive-rights flag is off
(datagram2254–2257 and OOB2367–2370 also reject). The listener's receive flags
are copied to the newly connected server socket at1765. Proposed native listener
design should consider setting receive-rights off before listening and checking
that state after accept. Actual option support, inheritance and queued-before-
accept refusal remain native test gates; no unsupported fallback is selected.

`include/net/sock.h` (87704bytes, SHA256
`3e8ec10a3bb01e5ea527ca2261c6bdbe39d12dc8d9f03a0ee55da22f421f3479`)
confirms at534–543 that `sk_scm_recv_flags` overlays the credential, security,
pidfd and rights bits. This ties the exact inherited byte to those options;
it remains public source evidence, not execution on the local custom kernel.

`net/core/scm.c:183–239` validates outgoing ancillary layout and permits only
SCM_RIGHTS or validated SCM_CREDENTIALS at SOL_SOCKET, rejecting other socket
control types; `:249–251` destroys accumulated SCM state on error. This supports
rejecting unrequested ancillary state, not guessing integers in unknown payloads
or pretending every received control record is an owned fd. Defensive recognized-
descriptor cleanup still needs actual resource tests. Receive-rights refusal does
not stop an ingress socket from being passed through a different Unix channel;
per-writer identity/history and image-at-send remain separate open requirements.

Root read-only local-header check18:02UTC found SCM_PIDFD0x04 in
`/usr/include/bits/socket.h:375–376` and SO_PASSPIDFD76/SO_PASSRIGHTS83 in
`/usr/include/asm-generic/socket.h:135,148`. These are local source observations,
not a compiled feature test or successful getsockopt/recvmsg. Fixed builds still
must use the actual headers; no numeric fallback or positive kernel claim follows.

An exclusively owned recvmsg path using receiver-side credential/pidfd ancillary
delivery might distinguish an inherited or SCM_RIGHTS-passed socket's writer from
its connection-time peer. This could supplement continuous owned process history
without pretending SO_PEERCRED/SO_PEERPIDFD authenticates each request writer.
Any such proposal needs its own concrete private contract and independent review.
Do not retrofit the frozen peer primitive or current lifetime helper with raw
descriptor/PID adoption hooks.

## Required gates before any release

- Verify exact socket-option numbers/semantics and enablement timing. Show sender
  attribution is active before the first byte; listener inheritance and queued
  pre-option bytes have not been established by the ranges inspected here.
- Choose one exclusive reader. A normal Node/libuv stream read must not consume
  bytes or ancillary data before the native recvmsg path; pausing a Socket after
  bytes were already read is insufficient. Actual Node22 accept/read ownership,
  close/error behavior and backpressure need native evidence.
- Define exact nonblocking/EOF/error/ancillary contracts, control-buffer bounds,
  MSG_CTRUNC/MSG_TRUNC refusal, complete handling of every received owned fd,
  one-close/no-retry cleanup and no leaked or caller-owned descriptor closure.
- Bind each delivered writer lifetime to genuine ProcessRef/ImageRef history and
  current run/phase/permit before forwarding. Numeric SCM PID alone is not proof.
  Missing or unknown writers, changed image, exit, revocation and mixed-writer
  HTTP messages must refuse without creating another daemon authority.
- Keep HTTP bodies/archives opaque and bounded-memory. No secret payload retention
  or hashing merely to identify a writer. The causal response/operation/terminal
  policy remains separate.
- Native tests must use two actual controlled writers sharing/passing one socket,
  prove their real process identities independently, and distinguish both from
  the connector. Exercise actual queue boundaries and per-message pidfd lifetime,
  including exit, missing/truncated data, closure and complete descriptor drain.

This is not a claim that the candidate closes FD theft/transfer or all-client
causality. It changes no binding, service, default stack, package or gate.

## EOF sentinel and returned flag source — root19:01Z

The same pinned Linuxv6.17 af_unix.c zeroes scm at2953. An empty queue with
RCV_SHUTDOWN takes2998–3022, still calls scm_recv_unix at3115, then returns0
at3126. Pinned scm.c513–521 emits SCM_CREDENTIALS even from that zero cookie;
483–484 emits no SCM_PIDFD when scm.pid is null. UID/GID are translated through
the receiver's user namespace. This explains a possible all-zero ucred sentinel
on the current initial-host profile; it is not a live writer or actual-host proof.

Additional primary source
[net/socket.c](https://raw.githubusercontent.com/torvalds/linux/v6.17/net/socket.c),
93,463 bytes, SHA256
`c75fa9787c9b45a947b016f12c7d5b7d03edbe10fe3894ec29b6cef4b473973a`:
2823 initializes returned msg_flags with requested MSG_CMSG_CLOEXEC/COMPAT;
2847 removes only COMPAT when returning the flags. CMSG_CLOEXEC therefore cannot
be treated as an unexpected receive flag when this reader requested it.

Root-selected interpretation, independently STATIC CLEAR: recvmsg0 may have no control, or one
exact SOL_SOCKET/SCM_CREDENTIALS all-zero ucred on this host profile, and no fd,
pidfd, rights, duplicate, unknown, malformed or truncated control. Only the known
returned CMSG_CLOEXEC bit is permitted; CTRUNC/TRUNC and other flags still refuse.
The complete fd ledger/cleanup check still runs for zero-byte results. Unknown
namespace-translated sentinels refuse rather than widening this selected case.
No Segment/Writer/credit or attribution is created; only true EOF can be cached.
Main-plan118 says no unexpected control, while125–133 applies the positive
credential/pidfd tuple to nonempty bytes. Actual kernel EOF controls remain required.
