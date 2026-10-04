# Web library

The web library contains browser-safe helpers that support the Astro shell and
its bounded React islands. Modules here coordinate presentation concerns such
as infrastructure job reads, realtime hints, and accessibility metadata; they
do not own API policy, persistence, or provider credentials.

## Contents

- `infrastructure-jobs.ts` — typed same-origin JobStatus reads with cache and
  conditional-request handling.
- `infrastructure-realtime.ts` — a browser-side adapter for validated
  realtime hints; canonical job data remains server-owned.
- `infrastructure-accessibility.ts` — shared accessibility metadata for the
  infrastructure workbench.
- `auth-scope-sync.ts` — loaded by every served document: when another tab signs
  out or signs in as someone else (the shared `wj_step_up_scope` cookie changes or
  disappears), this tab clears its step-up storage, freezes and reloads, and
  swallows any interaction that arrives first so a retained command cannot be
  submitted under the new session. A values-free BroadcastChannel signal and the
  cookie re-read on focus, pageshow, visibility and interaction drive it.

## Ownership

This directory owns web transport adapters and presentation-facing helpers.
The Astro server boundary owns authentication and authorization, the Worker
owns domain policy, and shared contracts own wire shapes. Secrets, access
tokens, provider payloads, and direct database access must not be introduced
here.

## Extension

Add a focused module when a helper is reused by more than one web surface. Keep
server-only behavior under `src/server/`, keep interactive state in a bounded
React island, and add a unit or integration test for each success, failure,
and cache/replay branch. Update the owning route contract before adding a new
browser request.

## Conventions

Use strict TypeScript and imports from `@wejammin/contracts` for validation.
Treat browser responses as untrusted, use same-origin credentials with
no-store requests, and fail closed when authentication, authorization, or
canonical realtime data is unavailable. Keep modules small and provider
neutral.

## Related links

- [Web surface](../../README.md)
- [Web server boundary](../server/README.md)
- [Shared contracts](../../../../packages/contracts/README.md)
- [Infrastructure specification](../../../../.memory/wiki/specs/2026-08-02-architecture-design.md)
