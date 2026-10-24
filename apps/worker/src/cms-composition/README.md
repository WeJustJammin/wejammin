# CMS composition Worker domain

## Contents

`block-registry-digest.ts` recomputes the BE03c canonical block registry
digest from 03a's safe server-resolved registry records. Its adjacent test
covers canonical ordering, reachability, and fail-closed integrity checks.
`template-routes.ts` composes the protected CMS-03C-01 version write and
designer-context read from `template-version-routes.ts` and
`template-context-routes.ts`; `template-shared.ts` and `template-respond.ts`
keep their contracts and safe response handling in focused modules.
`template-detail-routes.ts` serves the designer-scoped current-definition read
used to inspect an existing version after a conflict.
`../cms-composition-production.ts` binds it to the server-only
`platform_api.cms_define_template` RPC and the shared session/rate controls.
`../cms-composition-production-detail.ts` binds the latest read only to the
named private RPC, with response validation before browser projection.
Template route test fixtures and harnesses live in
`template-context-routes.test-support.ts` and
`template-detail-routes.test-support.ts` (fixture data and an app/dependency
harness only; the behavioral assertions stay in the adjacent
`template-context-routes.test.ts` and `template-detail-routes.test.ts`). Reuse
those helpers for extensions instead of copying fixtures.
`locale-routes.ts` serves the protected CMS-03C-04 locale-variant authoring
write, with its types, guards, and responses in the matching
`locale-routes-*` modules. `../cms-composition-production-locale.ts` binds it to the named,
server-only locale RPC and the shared session/rate controls. Its route tests are split
by concern: `locale-routes.test.ts` (success, admission, session and CORS gates),
`locale-routes-refusals.test.ts` (rate buckets, provider scrubbing, fallback-chain and
locale-limit refusals) and `locale-routes-binding-and-order.test.ts` (response binding,
the no-fallback set, fences, BE00 order and body ceiling); shared fixtures live in
`locale-routes.test-support.ts`. Add a test to the file matching its concern.
`locale-read-routes.ts` serves the protected `cmsLocaleVariantRead` GET (DEC-205:
`/api/v1/cms/entries/{entryId}/locales/{locale}`), registered by `registerCmsLocaleRoutes`; its
shared quota loop (`locale-routes-quota.ts`, 300/600 per minute) and deadline/telemetry runner
(`locale-routes-run.ts`) are generic over the operation, and
`../cms-composition-production-locale-read.ts` is its production port (RPC
`cms_get_locale_variant`; `FORBIDDEN` becomes the typed 403 `capability_missing`). Tests:
`locale-read-routes.test.ts`, `locale-read-admission.test.ts`, `locale-read-refusals.test.ts`,
fixtures in `locale-read.test-support.ts`.
`pattern-instance-routes.ts` serves the protected CMS-03C-02 insertion
boundary; `pattern-instance-contracts.ts` and
`pattern-instance-responses.ts` contain its port guards and safe envelope;
`pattern-instance-details.ts` allowlists a typed refusal's `details`
(`reasonCode` of the operation's own BE03c 1304 list on its one status, or
bounded 422 violations, nothing else).
`block-rules-refusal.ts` (DEC-210) turns the producer's `block_rules_violated` DETAIL pointer into the port refusal's one bounded violation
(only the operation's own pointer grammar of `@wejammin/contracts` `CMS_BLOCK_RULES_POINTERS`); the three detail projections
(`pattern-definition-response.ts`, `pattern-instance-details.ts`, `pattern-update-details.ts`) publish it through `cmsBlockRulesDetails`.
`capability-details.ts` (`forbiddenDetails(operationId, source)`) is the 403 filter of the template routes
(`template-respond.ts`: the detail read uses its own `cmsTemplateLatestRead` row, the context read, which has no
row, follows CMS-03C-01), the locale route (`locale-routes-support.ts`) and the CMS-03C-13/14/15 routes
(`pattern-update-details.ts`). It relays a 403 token only when it is a 403 token of that operation's
`CMS_SLICE_12_OPERATION_REASONS` row (BE03c 1323), so the pre-contract `CAPABILITY_REQUIRED` never crosses the
wire. The related-content route filters its own 403 in `related-content-details.ts` (`typedReason`), not here.
`conflict-details.ts` (`conflictReasonDetails(operationId, source)`) is the 409 counterpart for the template routes: a 409 that
names a 409 token of the operation's row (CMS-03C-01 carries `block_registry_digest_mismatch`, BE03c 1273, DEC-186) relays
`{ reasonCode }` alone; `../cms-composition-production-template-errors.ts` maps the exact `P0001` + token pair to that 409.
`../cms-composition-production-pattern.ts` binds only the named private
`cms_insert_pattern_instance` RPC. A provider 4xx that carries no product token
(a missing function, a bad service credential, a raw SQLSTATE) is the scrubbed
500, never a missing composition (BE03c 1298-1302; see `provider-fault-guard.ts`).
Pattern source creation (CMS-03C-12), governed activation (CMS-03C-09), the selector read and the
linked-update routes (CMS-03C-13/14/15) are separate routes described below; this route is only the
CMS-03C-02 insertion boundary.
`taxonomy-routes.ts` serves the protected CMS-03C-03 term action; its
`taxonomy-contracts.ts` and `taxonomy-responses.ts` keep port validation and
safe responses separate from route orchestration (`validTerm` binds the answer to
the TERM row: its own version, not the vocabulary `expectedVersion`; `taxonomy-term-details.ts`
publishes only the operation's own BE03c 1304 reasons). `../cms-composition-production-taxonomy.ts`
binds only `platform_api.cms_act_taxonomy_term` through the taxonomy transport below; a
`canonical_overlap` / `canonical_source_unavailable` refusal must carry its mandatory
domain (and canonical id) or it is an invalid dependency answer (`taxonomy-term-failure.ts`).
`related-content-routes.ts` serves the protected CMS-03C-05 related-content
rule write, with port types, envelope validation, detail sanitization, and
response handling in the matching `related-content-*` helper modules. Its
contract tests are split by concern:
`related-content-admission.test.ts` (origin/CSRF/header/query gates),
`related-content-errors.test.ts` (port failure status and detail
sanitization), `related-content-envelope.test.ts` (malformed port envelopes
and fail-closed 502 mapping), and `related-content-success.test.ts` (201
success, deadline abort, telemetry resilience). Shared fixtures live in
`related-content-routes.test-support.ts`; add new tests to the file matching
the concern and reuse the helper instead of copying fixtures.

`pattern-definition-routes.ts` serves the protected CMS-03C-12 pattern
version write and `pattern-definition-latest-routes.ts` the latest read; ports,
response handling and bounds live in `pattern-definition-ports.ts` and
`pattern-definition-response.ts`, and
`../cms-composition-production-pattern-definition.ts` with
`../cms-composition-production-pattern-definition-latest.ts` bind them to the
named `platform_api` RPCs. `taxonomy-definition-routes.ts` composes the
CMS-03C-16 taxonomy version write (`taxonomy-definition-write-route.ts`) and the
versions read (`taxonomy-definition-versions-route.ts`) and the two reads of the
term store, `cmsTaxonomyTermsRead` and CMS-03C-17 (`taxonomy-read-routes.ts`; strict query admission in
`taxonomy-read-query.ts`, page-to-request binding in `taxonomy-read-pages.ts`: a bare 400 for a
malformed query, a 422 pointer only for the selector's grammar and limit) over
`taxonomy-definition-shared.ts` and `taxonomy-definition-response.ts`; its
production binding is `../cms-composition-production-taxonomy-definition.ts`
(readers in `../cms-composition-production-taxonomy-reads.ts`). Every taxonomy RPC
(CMS-03C-03, -16, -17 and both reads) goes through one transport,
`../cms-composition-production-taxonomy-context.ts`, which rebuilds the RPC context from a fresh
session resolution of the same Request and re-proves the operation's capability;
`taxonomy-rpc-table.ts` is the one table of RPC names, deadlines and rate rows, pinned to the
registry by `taxonomy-registry.test.ts`. To add a taxonomy operation, add its row to that table,
its input type to `taxonomy-definition-shared.ts` and its refusal tests before the route.
The governed-review transport serves CMS-03C-06 (submit), -07 (decision), -08
(assignment), -09 (activation, scheduling and retirement), -10 (detail) and -11
(queue). The Worker has no parser of its own for the activation and detail answers: it
relays only what the strict contract accepts (`validGovernedActivation`,
`validGovernedDetail`), so an answer without the DEC-191 `supersededVersion` or
`activationSchedule` member, or with one of the wrong type, is the local 502.
`governed-review-policy.ts` is the one table of per-operation
facts (path, quota, deadline, step-up, Worker gate, documented statuses, RPC,
request pointers) and `governed-review-registry.test.ts` pins it to the frozen
registry rows. `governed-review-routes.ts` mounts the submit route and composes
`governed-review-command-routes.ts` (decision and assignment: BE00 order, strict
body, key and If-Match, gate, recent MFA, quotas, an optional `prepare` hook after
the quotas), `governed-activation-routes.ts` (CMS-03C-09 over the same registrar;
`prepare` verifies a scheduled `activateAt` through the pinned Time authority,
`governed-activation-time-details.ts` rebuilds the typed time-refusal details,
and `retire` is forwarded unchanged while the database holds it) and
`governed-review-read-routes.ts` (detail and queue). `governed-review-ports.ts`
holds the port types, gate and quotas, `governed-review-validate.ts` binds every
success to its request, and `governed-review-errors.ts` /
`governed-review-response.ts` build the catalog-bound responses.
`../cms-composition-production-governed-review.ts` composes the production
dependencies; `...-ports.ts` holds the six RPC ports, `...-rpc.ts` the
transport and `...-errors.ts` the token mapping and the committed refusal
envelope of the decision. Each production adapter answers a provider 4xx that
carries no product token (see `provider-fault-guard.ts`) as a scrubbed 500,
never as a caller refusal (BE03c 1298-1302); the template and pattern-instance
adapters apply it through `../cms-composition-production-failure.ts`
(`mapCmsCompositionRpcFailure`: the guard, then the unchanged 03b editorial
mapping). One `governed-review-preflight.ts` answers `OPTIONS` for every
governed path, merging the methods of operations that share one (06 and 11). To
add a governed operation, add
its row to `GOVERNED_POLICIES`, its port type to `governed-review-ports.ts` and
its validator to `governed-review-validate.ts`, then write its refusal tests
(`governed-review-ops-table.test-support.ts` and
`governed-review-ops-tokens.test-support.ts`) before the route. The scheduled half of
CMS-03C-09 (CMS-03C-19, job type `cms.governed_activation.execute`) is not an HTTP
route: it is the `scheduled` sweep `../cms-governed-activation-sweep.ts`.

`composition-instances-routes.ts` registers `cmsCompositionInstancesRead` (DEC-206,
`GET /api/v1/cms/entries/{entryId}/compositions`) through the same family: strict path, cursor and
`limit` admission (1-50, canonical integer, default 25 applied here; a bad limit is a 400, the error
matrix has no 422 for this read) in `composition-instances-query.ts`, the answer binding in
`composition-instances-answers.ts` (via `compositionInstancesPageHonours` of the contracts), no
entity tag (`NO_ETAG`), and a 409/422 from its port folded to the scrubbed 500. It shares the
family's dependency bundle (`readInstances`) and production adapter.

`pattern-update-routes.ts` registers the three linked-update routes: the pattern
selector CMS-03C-13 (`pattern-selector-routes.ts`; strict query admission in
`pattern-selector-query.ts`), the three-way update diff CMS-03C-14
(`pattern-update-diff-routes.ts`) and the accept/detach command CMS-03C-15 (its
`registerCmsPatternUpdateCommandRoute`). `pattern-update-operations.ts` is the one
table of RPC names, deadlines, rate rows and answer-size ceilings, pinned to the
registry by `pattern-update-registry.test.ts`; `pattern-update-ports.ts` holds the
port types, session/capability/quota admission and the validators of the dependency
answers live in `pattern-update-answers.ts` (an answer that does not honour its
request is a local 502). Safe reads share `pattern-update-read.ts`, responses and the
route deadline `pattern-update-response.ts`, and the `details` allowlist
`pattern-update-details.ts` (its 403 goes through `capability-details.ts`).
`../cms-composition-production-pattern-update.ts` binds the three named
`platform_api` RPCs through `../cms-composition-production-pattern-update-rpc.ts`
(fresh request-bound context, one call, no retry) and maps refusals by token in
`../cms-composition-production-pattern-update-failure.ts`. The selector route is
registered before `/api/v1/cms/patterns/:patternKey` so `selector` never reaches the
latest-read route. To add a linked-update operation, add its row to the operations
table, its validator to `pattern-update-answers.ts` and its refusal tests first.

## Ownership

This directory owns server-side composition policy. The digest helper does not
fetch records or grant capabilities: a protected Worker adapter must resolve
records from 03a and supply the content-type compatibility policy before a
template or pattern mutation or publication preflight can use its result.

Slice 12 observability (BE03c Observability, P2-S12-AC-051/052/263/264) lives in the `observability-*` modules.
`observability-registry.ts` is the executable list of the Slice 12 metrics, their closed label values, the
seven trace stages and the log-field allowlist (`metricKeyConforms` proves a key is registered).
`observability-facts.ts` keeps the closed facts of a request per `Request` (the decoded subject kind, decision
or update action, the stages reached, the published refusal reduced to its catalog code, reason token and
canonical domain); `observability-instrument.ts` wraps a family's session resolver and ports at registration so
a request lists only the stages it really entered; `observability-metrics.ts` and
`observability-no-fallback.ts` turn facts into counters; `observability-observation.ts` builds the
`observation` every route telemetry event carries and `compositionRequestLog`, the one allowlisted log line
every production closure (`../cms-composition-production-*.ts`) writes. To add a route: call `noteRefusal` where
its error response is built, add `observation: observeRequest(...)` to its telemetry event, wrap its
dependencies with `instrumentComposition`, and extend the registry and its test before emitting a new counter.
`locale-observability.ts` (DEC-208, DEC-213) is the scheduled database-side locale sample: each `* * * * *` tick it reads
`[T - 3 min, T - 2 min)` (T the scheduled time floored to the minute) through the service-role RPC
`cms_locale_observability_read`, strict-parses the three-integer answer, adds `fanoutRows` to `cms_locale_fanout_total` and
`staleFieldsAppended` to `cms_locale_stale_total`, sets the gauge `cms_locale_stale_legal_fields` and evaluates the stale
locale legal-field alert; a failed, timed-out or malformed read is logged with allowlisted fields and swallowed, counted by
`cms_locale_observability_read_failed_total` and raises `locale_observability_unavailable` for that firing (DEC-220: stateless, the
Worker keeps no failure history). It is composed
by `../event-consumers/production.ts` and run by `observeCmsLocaleActivity` in `../async-entrypoint.ts`; tests:
`locale-observability.test.ts` (window, parser, port), `locale-observability-probe.test.ts`, `locale-observability-failures.test.ts` (failed-read counter and alert), `../async-entrypoint-locale-observability.test.ts`,
`../production-async-entrypoint-locale-observability.test.ts`. `linked-scan/` (see its README) is the `cms.pattern.linked_update_scan`
job: each run increments `cms_pattern_linked_update_pending_total` by the `pending_diff` rows it appended (P2-S12-AC-212), so that
counter is emitted. A metric whose event happens in a consumer that does not exist yet is listed in `CMS_SLICE_12_UNEMITTED_METRICS`
with the missing seam; the list is currently empty. Alert policy: `packages/observability/src/cms-composition-alert-*.ts`.

## Extension

Add further protected composition routes and durable adapters only after their
contract tests are red. Recompute the digest at every BE03c checkpoint; never
persist an unverified caller digest as authoritative evidence.

## Conventions

Keep release credentials and executable payload out of composition. A safe
registry record with unknown or extra fields fails validation. A withdrawn,
missing, duplicate, or incompatible reachable block fails before mutation.

## Related links

See `.memory/wiki/specs/be/03c-composition-taxonomy-localization.md` and
`packages/contracts/src/cms-composition/`.
