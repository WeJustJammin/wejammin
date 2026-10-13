# Web server boundaries

This directory contains server-only Astro composition for authentication,
authorization, and private Worker service bindings. Modules validate every
untrusted value and return disclosure-safe responses; they never become a
second domain-policy or persistence layer.

## Contents

- `infrastructure-context.ts` — verified route context and fail-closed shell
  projection.
- `infrastructure-surface-projection.ts` — capability-gated safe props for
  upload and read-only evidence islands.
- `job-status-boundary.ts` — same-origin JobStatus response policy.
- `job-status-platform-api.ts` — opaque Bearer forwarding through the private
  `PLATFORM_API` Worker binding.
- `service-binding-cookies.ts` — runtime-aware, fail-closed forwarding for
  repeated allowlisted authentication cookies.
- `proxy-request-body.ts` — hands a proxied browser request's body stream to the
  upstream request unread. Every first-party forwarder uses it, so BE00 step 2
  (same-origin, size ceiling, session-bound CSRF) runs in the Worker before any
  byte is read; `proxy-body-untouched.test.ts` drives every non-GET route with a
  body that counts pulls. A route that must read its own body (a form whose CSRF
  token travels in the body) checks same-origin first.
- `bounded-request-body.ts` — bounded read for a public route that must parse
  its own form body (`/auth/start`): a malformed or oversize `Content-Length`
  is refused unread, and an undeclared (chunked) stream is cancelled once it
  crosses the ceiling instead of being buffered by `request.formData()`.

## Content schema registry map

- `content-schema-registry-context.ts` — public read-context resolver and
  compatibility exports.
- `content-schema-registry-context-support.ts` — session, authority, port, and
  request-port construction primitives.
- `content-schema-registry-context-types.ts` — narrow schemas and port types
  shared by context composition and platform read adapters.
- `content-schema-registry-context-presentation.ts` — disclosure-safe page and
  state projections.
- `content-schema-registry-context-outcomes.ts` — dependency/error outcome
  mapping and degraded-page construction.
- `content-schema-registry-platform-api.ts` — compatibility barrel for the
  private platform binding and CMS mutation/read ports.
- `content-schema-registry-platform-shared.ts` — shared binding, path, cookie,
  and upstream response helpers.
- `content-schema-registry-platform-reads.ts` — canonical read/refetch ports.
- `content-schema-registry-platform-input.ts` — bounded JSON/form mutation
  parsing.
- `content-schema-registry-platform-mutation-support.ts` — mutation path,
  contract, security, and response helpers.
- `content-schema-registry-platform-mutation.ts` — the human mutation forwards:
  CMS-03A-01..04, 09..12 and 14, plus the owner-only grant commands 15..17
  (the facade binds `{grantId}` like `{reviewId}`; the Worker owns ownership).
- `content-schema-review-context.ts` and `content-schema-review-platform-api.ts`
  — the protected review route resolver and read ports (CMS-03A-13). The
  owner-only `assignments[]` summary is kept only when the server lets the
  caller assign.
- `cms-capability-grant-contracts.ts`, `cms-capability-grant-platform-api.ts`
  and `cms-capability-grant-context.ts` — the owner-only DEC-119/DEC-120 grant
  console: page query (the person filter never enters it), the 90-day
  `termWindow`, the CMS-03A-18 read ports, the owner navigation probe and the
  page resolver. An upstream 2xx is the only owner proof.

## CMS editorial map

These modules are first-party proxies over the private `PLATFORM_API` binding.
The corresponding CMS-03B Worker routes are registered locally; each proxy
relays only a bounded, contract-valid upstream result and never synthesizes
editorial data. A missing owner-controlled policy or cursor signing key still
fails closed (`docs/runbooks/platform/cms-editorial.md`).

- `cms-editorial-platform-shared.ts` — allowlisted cookie forwarding, the
  same-origin check, the CSRF cookie/header match, bounded printable tokens,
  disclosure-safe local `ApiError` construction, and the allowlisted
  forward/copy header sets.
- `cms-workflow-platform-command.ts` — the six Slice 11 browser commands
  (CMS-03B-05 submit, -06 decision, -07 schedule, -08 preview, -09 publish, -18
  assignment) over one admission kit driven by the generated registry row and
  the generated request, header and resource schemas. A 2xx it cannot verify
  (status, strict resource, identity binding, validator, Location) is a 502
  carrying `x-cms-editorial-outcome: unknown`.
- `cms-workflow-platform-reads.ts` — the three Slice 11 protected reads
  (CMS-03B-15 workflow, -16 review detail, -17 reviewer queue): a typed query,
  no mutation header, and only a strict resource bound to the asked identity.
- `cms-workflow-platform-errors.ts` — the Slice 11 error-detail projector: a
  step-up recovery action, an operation's own reason token with its structured
  members (preflight list, time-authority alternatives), nothing verbatim.
- `cms-editorial-platform-bounded.ts` — the locked 256 KiB body cap for this
  command family plus declared-then-streamed byte reads that cancel their
  source on overflow, so no contract parse ever sees an unbounded buffer. It
  also owns the upstream-error relay: only a cap-bounded valid `ApiError` of a
  declared code/status pair is relayed, and even then the message is the
  route's canonical text and the details are rebuilt from
  `cms-editorial-platform-error-details.ts` (Codex review M2); nothing the
  upstream wrote is republished verbatim.
- `cms-editorial-platform-error-details.ts` — the BE03b:1239 detail allowlists
  per status and the per-operation typed reasons (`valueWrite`, `history`,
  `restore`, `read`), plus the Worker-identical `details.violations` shape for
  local Zod failures. A new typed reason is added here, in the Worker's
  `cms-editorial/error-vocabulary.ts` and in BE03b together.
- `cms-editorial-platform-write.ts` — the transport the four commands share:
  admission, CSRF, JSON media, dispatch with the browser's `request.signal`,
  and classification. Outcome-unknown contract: a transport loss, a
  post-dispatch 5xx or an unverifiable 2xx carries
  `x-cms-editorial-outcome: unknown`; the client keeps its `Idempotency-Key`
  and replays the byte-identical request. A definite 4xx, or a refusal before
  dispatch, never carries it and rotates the key.
- `cms-editorial-platform-mutation.ts` — CMS-03B-10 create proxy: same-origin,
  CSRF match, a JSON media type (valid JSON under another type is a 415, never
  re-stamped), a bounded `Idempotency-Key`, a locally validated JSON body, no
  `If-Match` (CMS-03B-10 declares none, and a supplied one is refused rather
  than dropped), a body read under the cap, and a 201 relayed only when it is
  the strict create resource and its bounded `Location` names that entry.
- `cms-editorial-platform-reads.ts` — CMS-03B-11 protected draft read and
  CMS-03B-03 revision-history read. Both reject malformed addressing,
  write-only headers, and body/media claims before forwarding; a 415 explains
  that protected reads have no request media. A structurally malformed id or
  query value is a 400 INVALID_REQUEST with a violation pointer (DEC-145), the
  Worker's own status. Both require bounded, strict resources. Draft detail requires a canonical strong `ETag`; history
  validates URL-owned filters, the locked 400 boundary for malformed
  cursor/limit/compare/locale values, a page-version `ETag`, and signed-cursor
  length before forwarding.
- `cms-editorial-platform-reads-collection.ts` — the CMS-03B-13 entry-list,
  CMS-03B-14 authoring-context, and CMS-03B-12 conflict-detail reads, re-exported
  by `cms-editorial-platform-reads.ts` so callers keep one import. Each carries no
  body or write header, forwards only its allowlisted query, and relays a bounded
  strict resource bound to its strong `ETag`; the authoring-context read never
  grants schema-registry read.
- `cms-editorial-platform-read-admission.ts` — the admission shared by every
  protected editorial read: no `Idempotency-Key`, `If-Match`, body, or media
  type (a 400 or 415 before any upstream call), and the entry route prefix.
- `cms-editorial-platform-revision.ts`, `cms-editorial-platform-conflict.ts`,
  and `cms-editorial-platform-restore.ts` — first-party CMS-03B-01/02/04
  mutation proxies. Each checks same-origin, CSRF, bounded strict input,
  idempotency, and an exact strong `If-Match` that agrees with the body's
  `expectedVersion` (422 `/expectedVersion` otherwise) before forwarding. A 201
  is returned only after the new revision, `Location` and the strong `ETag`
  (`"{entryVersion}"`, the next valid `If-Match`) agree. The
  restore route reaches the Worker's protected migration-chain RPC
  (`CMS-03B-04`); the proxy itself grants no restore capability, and a chain the
  database cannot prove is a typed 409 with nothing created.

## CMS composition map

- `cms-composition-platform-mutation-forward.test.ts`,
  `cms-composition-platform-mutation-error-relay.test.ts`, and
  `cms-composition-platform-mutation-fail-closed.test.ts` — the CMS-03C-01
  mutation suite split under the 400-line test cap: forwarding/input, error
  relay and sanitization, and fail-closed success validation. Shared
  request/resource fixtures live in
  `cms-composition-platform-mutation-test-support.ts`.
- `cms-composition-platform-mutation.ts` — CMS-03C-01 template-version
  creation proxy over private `PLATFORM_API`. It enforces same-origin and CSRF
  checks, bounded validated JSON, idempotency and strong successor validators;
  only strict 201 resources and documented error details cross back to Astro.
  The Worker, not this proxy, decides template-designer authorization.
- `cms-composition-platform-detail.ts` — protected current-definition proxy;
  validates the path, strict editable projection, and matching strong ETag.
- `cms-composition-platform-locale.ts` — CMS-03C-04 locale-authoring proxy.
  It binds the UUID/locale path to a strict, capped request, checks same-origin
  CSRF and the entry-version `If-Match`, forwards only session cookies and
  allowlisted headers, and relays a 201 only for the matching draft variant and
  expected aggregate ETag. Provider errors are reduced to the locale error
  catalog and bounded reconciliation facts. The endpoint lives at
  `pages/api/v1/cms/entries/[entryId]/locales/[locale]/variants.ts`; this
  transport does not constitute a CMS-15 authoring UI or hosted proof.
- `cms-composition-platform-pattern.ts` — CMS-03C-02 first-party insertion
  proxy. It validates same-origin CSRF, strong precondition and idempotency
  headers, a bounded strict body, and the private Worker's exact 201 resource
  and ETag. It filters upstream errors and cannot author or activate pattern
  sources; the named private insertion RPC is not yet implemented.

The hardening suite for the CMS-03B-10 create and CMS-03B-11 draft-read
proxies is split under the same cap into
`cms-editorial-platform-proxies-hardening-create.test.ts` (header tuple,
body cap, 201 validation) and
`cms-editorial-platform-proxies-hardening-draft-read.test.ts` (ETag gate,
body cap, verbatim query), with shared request/resource/stream fixtures in
`cms-editorial-platform-proxies-hardening-test-support.ts`.

## Ownership

This directory owns server request composition only. The API Worker verifies
Supabase sessions, resolves current authority, and applies domain policy. The
browser library owns no credentials, and shared contracts own every wire
shape. Tokens remain inside request-scoped closures and must never enter HTML,
logs, error envelopes, or client props.

## Extension

Add a focused module for each server boundary and construct its ports through
an identity-tracked factory. New cookie formats require a locked authentication
contract before implementation. Unknown credentials, missing bindings, invalid
upstream bodies, and unsupported provider state fail closed.

## Conventions

Use strict TypeScript, bounded response reads, `Cache-Control: no-store`, and
allowlisted forwarded headers. Treat Cloudflare service bindings as private
transports, not authority sources. Read repeated authentication cookies through
the Workers `Headers.getAll('Set-Cookie')` API before the standard
`getSetCookie()` fallback, then allowlist every returned cookie independently.
A runtime exposing only a folded `Set-Cookie` value fails closed. Add
integration tests for success,
conditional reads, authentication failure, disclosure collapse, and dependency
failure.

## Related links

- [Web surface](../../README.md)
- [Browser-safe library](../lib/README.md)
- [Shared contracts](../../../../packages/contracts/README.md)
- [Infrastructure specification](../../../../.memory/wiki/specs/2026-08-02-architecture-design.md)
