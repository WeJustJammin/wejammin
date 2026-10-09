# Infrastructure job policies

This directory contains pure application decisions for long-running jobs and
their durable boundaries. Adapters own I/O; these modules validate server facts
and return deterministic plans.

## Contents

- `read.ts` resolves owner, acting-party, operator, and disclosure-safe read
  decisions.
- `transition.ts` guards quoted-version compare-and-swap state transitions.
- `acceptance.ts` validates a queued job and its identifier-only outbox event
  before an atomic commit.
- `dispatch.ts` handles leases, replay, stale/future versions, terminal jobs,
  and restore-independent queue decisions.
- `consumer.ts` composes persisted claim/effect/outcome decisions. Acquired
  effects receive the actual private claim receipt without rewriting the
  preclaim job or original queue envelope; the receipt is not enduring authority.
- `consumer-claimed-lease.test.ts` pins receipt identity, exact final CAS,
  non-adjacent controlled-port versions and existing refusal boundaries.
- `offline.ts` revalidates temporary intents without treating local state as
  canonical.
- `realtime.ts` coalesces identifier/version hints and authorizes canonical
  refetch instructions.
- `restore.ts` opens external effects only after epoch, integrity, and
  reconciliation checks pass.

The barrel at `../jobs.ts` is the supported package subpath. No module talks to
the database, queue, browser, or provider directly.

## Ownership

The application package owns these pure decisions. Worker, database, browser,
queue, and provider adapters consume them without moving I/O into this folder.

## Extension rules

Add one focused policy module and colocated tests per new decision boundary.
Keep I/O behind injected ports and export supported behavior through `../jobs.ts`.

## Conventions and related material

Use strict contract types, deterministic return values, terminal-state guards,
and disclosure-safe denials. See the platform jobs/outbox reconciliation runbook
for adapter and recovery behavior.
