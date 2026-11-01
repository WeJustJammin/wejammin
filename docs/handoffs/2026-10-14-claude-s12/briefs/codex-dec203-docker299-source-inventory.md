# DEC-203 Docker 29.9 source inventory

Root public-source research, 2026-10-18. This is not a wire manifest, binary
reproducibility proof, daemon attestation, forwarding release or native acceptance.

## Local client observation

Root ran only `/usr/bin/docker --version` with PATH `/usr/bin:/bin` and LC_ALL C;
no Docker endpoint, daemon, container, database, or secret was queried. Exit0:
`Docker version 29.9.0, build f415da838b`. Before/after executable hash and identity
matched: rootUID, device38, inode12811765; SHA256
`dea20a67e395f7bf1447601c3c9d4736a503a69252d07a3ec989e55f9b477e40`.
This output does not prove that the binary was built from the public source.

## Public immutable source

[Official commit metadata](https://api.github.com/repos/docker/cli/commits/f415da838b)
resolves full commit `f415da838bed6a0e12ca6cb86ba198fdac6beb9c`,
tree `687900947292b56d41aeab392077094aca50dcec`. JSON response SHA256
`86d51ec7c625d15e0eae71b32c780ccd59ca2f48605a377334031736b9e3b28a`.
All paths below are relative to this immutable root:
`https://raw.githubusercontent.com/docker/cli/f415da838bed6a0e12ca6cb86ba198fdac6beb9c/`.

| Path | Bytes | SHA256 |
| --- | ---: | --- |
| `vendor/github.com/moby/moby/client/client.go` | 15089 | `2e11ceb1d14dc1f69b0e8d405c693c7bd90f23d3bdcd70fc093d4b6ad0b46a19` |
| `vendor/github.com/moby/moby/client/ping.go` | 5980 | `05c120f73a01ab489db3c93e08a0e846ca5391547f5ba910d9de4880af8ca119` |
| `vendor/github.com/moby/moby/client/container_exec.go` | 6591 | `ffc718c14350bfdd3a3a753e750d1ac1b0c0f353cc2f17247afb0b4f8c7b8b00` |
| `vendor/github.com/moby/moby/client/container_copy.go` | 4790 | `d58a839f5e4f2ffbdd0a028d3b512015ecc574d0ed39693825644571134bfb04` |
| `vendor/github.com/moby/moby/client/hijack.go` | 5831 | `e90ace95d459bd38c13277b0c2df54ccbc303255064543730b15ab919ff6f59e` |
| `vendor/github.com/moby/moby/client/request.go` | 14570 | `a28ba54b0f6159a57b7d4e43f6e79bafd31357182f321b4036bacd3c1bdf27d6` |
| `cli/command/container/exec.go` | 7714 | `e8506681c89f7f914a7e5b33a6502be041056a86be277cd2c2d79c6a172f0da2` |

The version-tag `v29.9.0` client.go response has exactly the same SHA as the
immutable-commit response. `container_archive.go` returned404; it supplies no
evidence. The official client directory identifies `container_copy.go` instead.

## Verified source facts and implications

- `client.go:105-115,303-368` declares API range1.40–1.56 and negotiates the
  version. It does not justify inventing one fixed daemon API version.
- `ping.go:108-163` sends unversioned HEAD `/_ping`, can fall back to GET, and
  reads the `Api-Version` response header. Policy must account for this handshake
  before versioned operations, under the same private ingress/peer boundary.
- `container_exec.go:34-65` sends the create request to the bound container's exec
  endpoint, including Env, then parses the actual response ID. Blanket rejection
  of Env would reject the existing approved `PGAPPNAME` invocation.
- `container_exec.go:132-143` attaches through the exec-start endpoint with the
  pinned attach request; `hijack.go:45-121` supplies Connection/Upgrade and requires
  a101 switching-protocols response. These facts do not yet close opaque stream,
  multiplexing, half-close, HTTP framing or backpressure semantics.
- `container_exec.go:173-190` parses exec inspection separately. The CLI
  `exec.go:201-217` inspects after interactive I/O and propagates nonzero exit.
  HTTP success and stream closure therefore cannot stand in for exec exit status.
- `container_copy.go:28-44` can stat an archive path through HEAD; `:63-85` copies
  to a container through PUT archive with path and conditional overwrite/UID-GID
  query fields. Exact invoked copy branches and allowable destinations still need
  transitive CLI/Supabase source closure; these are not an unrestricted allowlist.

## Still OPEN

Root follow-up17:36UTC fetched the same immutable CLI commit's vendored
`vendor/github.com/moby/moby/api/types/container/exec.go`:1211bytes, SHA256
`a9dab441b8ab8f8e40d4a6a096385f6c92fa9c8e15993febf9633facba5aafc6`.
`ExecInspectResponse:13–24` includes Running bool, nullable `ExitCode *int`,
ContainerID and numeric Pid. This establishes client decoding shape, not daemon
terminal-Pid semantics or the actual negotiated server schema. A guessed
`moby/moby/v29.9.0/daemon/exec.go` URL returned404 and supplies no evidence.
Keep terminal Pid and versioned daemon behavior source-gated; a nullable
ExitCode must never be silently coerced to successful zero.

No actual daemon negotiation or API version was observed. Complete lifecycle,
volume/network/inspect/remove/start/wait branches, exact JSON schemas, versioned
field differences, copy CLI transitive behavior and error cleanup need further
source review. Supabase's separate source inventory establishes create → copies /
pre-start archives → start, not the old three-command projection. A source-derived
finite manifest must cover initial pinned-container probes and later recovery too.

No whole-stream8MiB limit is selected. Bound memory and monotonic time/counters;
derive any total byte limits from actual authorized workloads before approval.
Do not retain/hash secret archive/env/SQL payloads merely because framing is
observed. Specify class-specific nonsecret witnesses and data minimization first.
Docker-to-Podman fallback is not authority for another executable or daemon;
unregistered fallback must refuse before exec. All process/writer/lifetime/FD
transfer, causal ownership and observer-inclusive drain gates remain OPEN.
