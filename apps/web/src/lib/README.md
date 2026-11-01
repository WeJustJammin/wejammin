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

- `cms-editorial-page-actions.ts` (the bundled self-installing entry) and
  `cms-editorial-page-actions-core.ts` — the document-level handling the CMS
  editorial pages need beyond their islands: the create type selector, the
  review behavior of the CMS-07 restore confirmation (`cms-editorial-restore-review.ts`:
  focus, Escape and Cancel; `cms-editorial-restore-draft.ts` and
  `cms-editorial-restore-feedback.ts`: a kept confirmation and the typed failure
  summary) and the delegation of its submit. The restore command itself (sent as
  the real JSON command, then the app route of the entry is opened) is
  `cms-editorial-page-actions-restore.ts`, imported dynamically on the first
  restore submit and when the review opens, because it brings the command's
  contract schemas while the document shell ships the core to every CMS route
  (AC-106). `cms-editorial-page-actions-dom.ts` holds the status line and storage
  helpers both share.
- `cms-contract-validators.ts` — the lazy loader of the zod validators of the CMS
  editorial islands (`@wejammin/contracts/cms-editorial/validators`). An island
  ships no zod; code that must check a payload or an input writes
  `loadedCmsValidators() ?? (await loadCmsValidators())` (async) or
  `withCmsValidators(use, unavailable)` (form handlers), and a control receiving
  focus calls `warmCmsValidators`. A cold route load fetches none of it.

- `read-deadline.ts` — `startReadDeadline(signal?, ms?)`: the 8,000 ms deadline of a protected
  browser read (`BROWSER_READ_DEADLINE_MS`). Pass its `signal` to the fetch, `clear()` it in a
  `finally`; `expired()` tells a timeout (show the failed state) from a caller abort (show nothing).
  Every CMS browser read uses it; do not declare a local deadline constant.
  `read-within-deadline.ts` — `withinDeadline(deadline, work)` races a fetch or body read against that
  deadline, so a fetcher that ignores its signal still cannot hold the read open (`read-within-deadline.test.ts`).
  `run-read-under-deadline.ts` — `runReadUnderDeadline(run, onEnd, parent?)`: the two together, the wrapper a read uses
  to end: its answer, or `onEnd` at the deadline, on a caller abort or on a throw.

- `safe-read-retry.ts` — the FE03 :1172-1173 network contract of a safe protected read.
  `retryingSafeRead`: a 502, 503 or 504 whose ApiError declares `details.retryable` is retried
  twice, after 250 ms and 750 ms, and the last answer is returned for the caller's degraded
  state. `rateLimitWaitSeconds` / `rateLimitMessage`: a 429's `Retry-After` (or the ApiError's
  `details.retryAfterSeconds`; 1 to 86400 whole seconds; leading zeros such as `007` are well-formed per RFC 9110 delay-seconds; a disagreeing pair is unstated) and the
  sentence that announces it and says the input is kept. Reads only: a mutation reconciles and
  reuses its idempotency key. Used by the taxonomy, pattern, editorial, workflow and grant reads;
  a new browser read of a CMS surface wraps its fetch in `retryingSafeRead` and reads a 429
  with `rateLimitWaitSeconds`.

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
