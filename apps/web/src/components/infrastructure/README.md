# Infrastructure components

## Contents

This directory contains the bounded presentation pieces for the server-first
infrastructure routes. `InfrastructureWorkbench` composes the list, detail,
access, recovery, and confirmation regions; `useInfrastructureWorkbench` owns
URL-addressable view state and recovery effects.

## Ownership

The web surface owns composition and interaction semantics. Server-derived
authority, canonical records, and command effects remain outside this folder.

## Extension

Add one focused component or hook per responsibility, keep components below
200 lines, and compose them through `InfrastructureWorkbench`. Put shared state
normalization in `infrastructure-workbench-state.ts` instead of duplicating it.

## Conventions

Components receive server-derived state and access decisions as props. They do
not create a global store, infer authority from URL state, or treat
`BroadcastChannel` hints as canonical data. Invalidation messages trigger a
canonical refetch only; server responses remain the source of truth.

Protected command and upload controls stay disabled until the route supplies a
server-backed command callback. Selecting a local file never claims upload,
verification, or readiness.

## Related links

See [`../../lib/`](../../lib/) for shared web helpers and
[`../../../README.md`](../../../README.md) for the web application boundary.

## Step-up recovery (FE00, DEC-111)

A 401 `STEP_UP_REQUIRED` is the `step_up_required` view state
(`returnTo`, `allowedMethods`), never a `capability_gate`; `capability_gate`
only carries `request_capability` (403). The status region links to
`/step-up?returnTo=<relative path>` through `stepUpRecoveryHref`. Provider
evidence errors use the `step-up` owner and `StepUpRecoveryLink`.
