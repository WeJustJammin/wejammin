# DEC-203 propagation scan — isolated per-run native tracing

Date: 2026-10-17. Status: source-only scan; no implementation, runtime, parser,
database, Docker, network, process, or acceptance evidence. This is the only new
path in this claim. Root owns binding/integration decisions.

## Decision and authority

DEC-203 approves an isolated per-run tracing adapter with reviewed binding changes,
without persistent services or default-stack changes (`.memory/wiki/decisions.md:5324-5333`).
It does not waive DEC-197 authority, source, lock, identity, drain, restoration, or
receipt rules.

DEC-197 seals one explicit ALT target and four locks (`briefs/codex-dec197-upgrade-alt-reset.md:20-44`),
requires the exact `docker` invocation and byte-identical migration (`:92-114`),
and retains no-default/no-service/no-secret boundaries (`:116-122`). Identity
renewal remains reset-only, owned, awaited, drained, and fail-closed
(`briefs/codex-dec197-upgrade-reset-identity-renewal.md:17-24`).

## Downstream impact classification

### Explicitly affected

1. **Binding and endpoint split.** `host-executables.mjs:53-121` currently models
   `daemon.endpoint` as `unix:///run/docker.sock` and requires
   `environment.DOCKER_HOST === daemon.endpoint`, exact executable/package
   artifacts, and empty dotenv. Preserve `daemon.endpoint` as the independently
   attested upstream daemon endpoint. A reviewed DEC-203 amendment must add an
   ephemeral per-run `ingress` descriptor (`endpoint`, `upstreamEndpoint` equal to
   `daemon.endpoint`, and run-owned lifetime) and allow only the spawned CLI's
   `DOCKER_HOST` to equal that ingress endpoint. No caller-supplied endpoint,
   default socket, or target substitution is authority.

2. **Actual peer attribution.** `host-boundary.mjs:65-123` consumes observations
   but does not authenticate their producer. The adapter must capture each private
   ingress connection's actual kernel peer credentials (`SO_PEERCRED`, then `/proc`
   start-ticks) and bind them to the registered child. A declared `actorPid` or
   Docker response ID is not evidence. If the approved Node/host capability cannot
   read peer credentials, return typed native-producer-unavailable; do not invent
   them or silently add a helper/privilege.

3. **Raw trace preservation.** `host-trace.mjs:23-64,152-234` requires actual
   PID/PPid/startTicks/executable/argv, raw `/proc` bytes, shell→Node history,
   compiled-native child, three Docker subprocesses, and raw responses. Keep the
   existing CLI process chain and exact `buildPsqlInvocation` output
   (`delivery-receiving-upgrade-plan.mjs:191-228`). Add ingress request/response
   capture and observed peer metadata only; capture history from `/proc` at the
   real events. Never synthesize `execHistory` from expected argv.

4. **Registry and drain.** `host-request.mjs:55-111` requires six independent
   process ports and `nativeBinding`; `host-reset.mjs:82-111` validates trace then
   drains; `host-drain.mjs:119-168` requires no descendants, terminal owned Docker
   work, and complete backend absence. Extend the planned opaque per-run registry
   to own ingress sockets/connections and every setup/observer/migration client.
   The planned `drainOwnedClient` seam must close ingress only after child close,
   raw streams, descendants, daemon jobs, and PostgreSQL backends settle. Missing
   peer, stale PID/start-ticks, open connection, or unexplained backend remains
   uncertain and blocks restoration.

5. **Cancellation and facade.** Current local cancellation only signals direct
   children and waits handles (`local-child.mjs:130-148,240-247`; `local-session.mjs:243-247`).
   The native facade must call the new drain seam for setup, before/after observers,
   migration, cancellation, timeout, and signal. The pure runner remains injected
   only (`run-delivery-receiving-upgrade.mjs:93-102`); no `db:verify` or package
   wiring changes.

### Implicit assumptions requiring review

- `local-target.mjs:16-20` hard-codes the Supabase shim under the phase2-slice11
  worktree, while this claim is phase2-slice12 and the approved ALT workdir is
  phase2-slice10 (`codex-dec197-upgrade-alt-reset.md:24-31`). Host fixtures and
  expectations repeat the phase2-slice11 path (`host-launcher-fixtures.ts:12-16,20-22;
  host-renewal.test.ts:51-62`). This may be an intentional shared executable,
  but source does not prove that. The adapter must independently attest the exact
  owner-approved artifact/path/package; never fall back to PATH or rename it.
- A private Unix ingress changes only the environment, not command/argv/stdin;
  `buildPsqlInvocation` must remain `docker exec ... psql ... -f -`. Any wrapper,
  direct HTTP replacement, extra flag, or invented command would violate the
  existing trace and migration-byte contracts.
- The tree has no SO_PEERCRED capture implementation. The binding amendment must
  state the approved capability or retain fail-closed refusal; `/proc` scans,
  declared actor fields, and response IDs are not substitutes for kernel peer
  identity.
- Ingress and upstream are distinct identities: recheck the upstream daemon ID/
  endpoint through the private path, but never overwrite the bound upstream value
  with the ephemeral ingress path. No secrets or raw request bodies may enter
  receipts/logs; retain bounded in-memory bytes and hashes only as needed for
  authenticity (`alt-reset.md:12-18`; `host-executables.mjs:97-112`).

### Consistent, unchanged boundaries

The exact ALT descriptor, four-lock lease, reset-only identity renewal, executable
and source attestation, no default/remote/provider/clone path, no generic backend
termination, exact 080 bytes, old-catalog/security preservation, and independent
baseline restoration remain unchanged (`native-bridge-plan-2026-10-18.md:7-17,158-181`).
Existing host tests are decision tests only; they explicitly say synthetic raw
observations do not prove native attribution or DB drain
(`host-renewal.test.ts:21-24`; launcher fixtures `:20-22`).

## Bounded review proposal

1. Add RED cases before implementation for: upstream/ingress mismatch; non-private
   or reused ingress; forged actorPid/response ID; SO_PEERCRED PID/UID/GID or
   start-ticks mismatch; missing/foreign process history; changed Docker bytes;
   open ingress/daemon/backend work at each cancellation phase; secret leakage;
   exact CLI argv/stdin preservation; and ordinary-baseline restoration refusal.
2. Amend only binding/trace DTO contracts needed for `daemon.endpoint` (upstream),
   per-run `ingress.endpoint`, observed peer credentials, and request/response
   hashes. Keep one-use object handles and caller-owned target/lease authority.
3. Implement the adapter as one per-run Node process/socket capability using the
   approved CLI chain and ephemeral ingress; no persistent service, default stack,
   namespace, new OS dependency, or privilege assumption. If peer credentials or
   causal upstream capture are unavailable, return typed refusal.
4. Independently review the RED/GREEN source, then run native negative/positive
   080, cancellation, and restoration only under the four locks. No receipt or
   acceptance claim follows from this scan.

