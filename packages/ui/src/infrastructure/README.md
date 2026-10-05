# Infrastructure navigation and presentation

## Contents

Shared navigation and presentation policies for infrastructure-facing UI
surfaces. Navigation owns URL, invalidation, and network helpers; presentation
owns typed state, access, responsive, and UI contracts.

## Ownership

This is the authoritative extraction-safe home for browser navigation and
presentation policy. Application modules own server use-case policy instead.

## Extension

Add one pure module below 300 lines, expose it through a small barrel, and add
boundary tests before consumers use the new behavior.

## Conventions

Modules depend only on `@wejammin/contracts`. Server-derived authority remains
authoritative; role labels, drafts, and invalidation hints never grant access
or replace canonical data.

## Related links

See the [architecture design](../../../../.memory/wiki/specs/2026-08-02-architecture-design.md),
[frontend contract](../../../../.memory/wiki/specs/fe/00-infrastructure.md), and
[UI package guide](../../README.md).

## Step-up presentation

`presentInfrastructureState` maps `step_up_required` to a
`/step-up?returnTo=` recovery (`gateRendered: false`); it never emits the
`capability_gate` presentation for a 401 `STEP_UP_REQUIRED`.
