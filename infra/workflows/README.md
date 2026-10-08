# Deployment workflow scripts

## Contents

This directory contains the bounded shell entrypoints used by GitHub Actions
for immutable builds and release promotion. The workflow files retain event,
identity, environment, and credential scope while these scripts own repeatable
filesystem and validation operations.

### Entry points

- `diagnose-content-schema-registry-slo.mjs` emits four count-only historical
  telemetry comparisons inside the protected AC211 job. It uses the existing
  observability credential, one returned event maximum per query, a 10-second
  request timeout, and a 2 MiB response cap. Raw events and secrets never enter
  output. Missing counts remain null, not zero. Diagnostic failures warn but
  never replace or bypass the subsequent normal evidence collector.

- `diagnose-content-schema-registry-queue-shape.mjs` answers the next AC211
  failure-forensics question after a `malformed_queue_analytics_row` failure:
  which Queue Analytics field drifted. It reuses the collector's exact query
  string, envelope classification, and row classifier, so its verdict is the
  collection verdict rather than a second opinion. It emits only closed value
  classes (row type, dimension presence and key count, date/count/action/outcome
  classes) plus the exact rejected gate and bounded row counts. Provider values,
  timestamps, queue identifiers, raw rows, and secrets never enter output, and
  the emitted row list is capped. It is read-only, writes no evidence file,
  and a failure warns without replacing or bypassing the normal collector.
  The gate vocabulary and envelope classification live in
  `content-schema-registry-slo-queue-shape.ts`, and the closed value-class
  descriptors live in `content-schema-registry-slo-queue-value-classes.ts`. The
  collector imports the former, so the two cannot drift apart.

  Cloudflare documents the `outcome` dimension as applicable only to
  `DeleteMessage`
  (https://developers.cloudflare.com/queues/observability/metrics/). Protected
  run `36038432808` showed that real `ReadMessage` and `WriteMessage` rows
  still carry a value there, and collection failed closed on `outcome_shape`
  because of it. The row gate now treats a non-delete outcome as inapplicable:
  an absent, null, or bounded string placeholder is accepted and never counted
  toward `dlqMessages`, while a non-string, a string past the 64-character
  bound, or the `dlq` marker on a non-delete row still rejects the row.
  `DeleteMessage` keeps its closed `success`/`dlq`/`fail` vocabulary, so
  `dlq` remains the only way a message can count as a DLQ message.

- `ac209-email-diagnostics.ts` and its entrypoint
  `diagnose-production-ac209-email.ts` answer one AC209 failure-forensics
  question for the old exercise window: whether the Email Sending dataset was
  readable and enabled for the observability token, whether the window query
  returned zero rows, an identity mismatch, a terminal-status mismatch, a full
  page, or duplicate/multiple matches, and the documented requester limits.
  It reuses the exact settings and event shapes documented for
  `zones(...).settings.emailSendingAdaptive` and `emailSendingAdaptive`, is
  read-only, and writes one redacted report of bounded counts, booleans, and
  closed non-PII codes. It never retains raw addresses, subjects, provider
  message identifiers, provider bodies, or secrets, closes no acceptance
  criterion, and replaces neither the delivery verifier nor the visible receipt
  inspection. Dispatch contract:
  `.github/workflows/diagnose-production-ac209-email.yml`.

- `build-immutable-artifacts.sh` builds the workspace and packages both web
  runtime configurations for the immutable CI artifact.
- `ac209-email-presence-contract.ts` declares the contract for
  `ac209-email-presence.ts` and its entrypoint
  `probe-production-ac209-email-presence.ts`, which answer the one question the
  hour-bounded correlation gate cannot: whether the exact parent zone's Email
  Sending dataset holds any telemetry at all. The probe samples two trailing
  windows - 24 hours and 30 days - from one instant with `limit: 1` and reports a
  bounded row count, a presence boolean, and one closed classification
  (`recent_present`, `recent_missing`, `zone_wide_missing`, or
  `provider_unavailable`). It selects only the non-PII `status` field, required
  by the GraphQL rule that every selection set be non-empty, and never publishes
  its value; no address, subject, or provider message identifier is ever selected
  or retained. An unavailable window carries a closed code from
  `AC209_EMAIL_PRESENCE_UNAVAILABLE_CODES` rather than free text, so the retained
  artifact cannot carry a provider message or a token, and the wide window is
  checked against the provider duration ceiling at module load. It is read-only,
  performs no mutation, and closes no acceptance criterion. Dispatching it does
  not close AC209 and does not replace the correlation gate, the delivery
  verifier, or the visible receipt inspection.

  It also accepts an optional second candidate tag through
  `AC209_PRESENCE_ALTERNATE_ZONE_TAG`. The Email Sending dashboard path shows a
  sending-domain identifier beside the parent zone id, and Cloudflare documents
  `zoneTag` as a zone id without stating how a sending-domain tag resolves. The
  optional tag is inventoried over the recent window in the same dispatch and
  reported as its own closed value (`not_configured`, a bounded count, or a
  closed code). It is inventory only: it never feeds the parent-zone
  classification, never contributes to AC209 acceptance, and is never retained -
  neither tag id appears in the artifact. Omitting the variable makes no extra
  request.
  Dispatch contract: `.github/workflows/probe-production-ac209-email-presence.yml`.

  A second, sibling entry answers the dataset-ownership question that the sending
  probe alone cannot. Cloudflare documents that emails sent from a Worker through
  the `send_email` binding appear in the Email Routing summary as dropped, even
  when they were delivered successfully
  (https://developers.cloudflare.com/email-service/platform/limits/), while also
  publishing two separate zone-level datasets, `emailSendingAdaptive` and
  `emailRoutingAdaptive`
  (https://developers.cloudflare.com/email-service/observability/metrics-analytics/).
  `ac209-email-routing-presence-contract.ts` declares the routing contract and the
  combined report, `ac209-email-routing-presence.ts` implements both, and
  `probe-production-ac209-datasets.ts` is the entrypoint. The rules that are not
  dataset-specific - the probe-instant reader, the closed provider-failure mapper,
  and the bounded single-row reader - live once in
  `ac209-email-dataset-presence-shared.ts` and are shared by both probes, so the
  two halves cannot drift into different instant semantics or page bounds. One
  dispatch reads the
  sending dataset and the routing dataset from a single probe instant and reports
  them side by side: four requests total, two bounded windows per dataset, each
  with `limit: 1` and each selecting only the non-PII `status` field. Neither
  verdict is derived from the other, and the routing read reuses the sibling's
  request boundary, zone-record reader, and closed failure vocabulary rather than
  restating provider-shape rules.

  Interpretation stays deliberately cautious. A routing `dropped` row does not by
  itself prove that the Email Sending dataset should be empty, and an unreadable
  routing dataset does not prove that it holds events; in particular, an
  unavailable routing dataset is reported as a closed code rather than as an empty
  reading, which is the expected shape when Email Routing is not enabled on the
  zone. The probe enables nothing, mutates nothing, closes no acceptance
  criterion, and replaces neither the correlation gate, the delivery verifier, nor
  the visible receipt inspection. Dispatch contract:
  `.github/workflows/probe-production-ac209-email-datasets.yml`.

- `ac209-email-routing-day-counts-contract.ts` owns the query, the window
  constants, and the provenance rationale. `ac209-email-routing-day-counts-schema.ts`
  owns the Zod schemas and is
  re-exported by the contract, so one schema file holds one domain and the
  dependency stays one-way (a DAG). `ac209-email-routing-day-counts.ts` and
  `probe-production-ac209-routing-day-counts.ts` answer the magnitude
  question the events probe cannot. That probe issues `limit: 1`, so its
  `routing_wide30d=1` reading proves only that at least one routing row exists;
  it cannot give a count. Cloudflare documents `emailRoutingAdaptiveGroups` as
  the aggregated counterpart carrying `count` plus `dimensions`, and documents
  that `*AdaptiveGroups` datasets take `Date`-typed filters (`date_geq`,
  `date_leq`) for day-level filtering while `*Adaptive` events datasets take
  `Time` filters. This diagnostic therefore issues one bounded query over an
  inclusive 31-day UTC window, selecting only `count` and the two grouped
  dimensions `date` and `status` - never a sender, recipient, subject, provider
  message identifier, session, routing rule, or error detail. The window is 30
  elapsed days. The provider reports two distinct limits on these settings
  nodes - `notOlderThan` (the retention horizon) and `maxDuration` (the widest
  single-request span) - so the window is sized against the smaller of the two
  and reuses the sibling presence contract's `AC209_EMAIL_PRESENCE_WIDE_WINDOW_MS` as
  the one named reference for that span.
- `ac209-email-sending-groups-contract.ts` owns the query, the page and window
  bounds, and the provenance rationale for the bounded, read-only Email Sending
  _groups_ corroboration probe; `ac209-email-sending-groups-schema.ts` holds its
  strict Zod row/report shapes, and the contract re-exports them so the
  dependency stays one-way (a DAG). `ac209-email-sending-groups.ts` and
  `probe-production-ac209-sending-groups.ts` answer the magnitude question the
  events diagnostic cannot: when the per-event window query returns zero rows,
  an operator cannot tell an empty zone from a missing identity, so this probe
  reports the provider's own `count` per `datetimeHour` x `status` group for
  the same operator-supplied UTC window, using Cloudflare's documented hourly
  `emailSendingAdaptiveGroups` shape
  (https://developers.cloudflare.com/email-service/observability/metrics-analytics/).
  The hourly `Time` filters are used because the day-level `Date` forms would
  collapse a sub-hour exercise window into one day. Because a bucket labelled
  `20:00` covers the whole hour and the filter compares bucket labels, the query
  asks for exactly the buckets that OVERLAP the requested window: an unaligned
  start would exclude the very bucket holding the activity and report a false
  zero, while asking for an aligned end's own hour would add an hour the operator
  never requested. The artifact records the requested and queried windows plus
  `granularity: 'utc_hour_bucket'` and `hourRounded`, so the counts are never
  mistaken for an exact sub-hour total. The window is capped at 7 days because
  720 hourly buckets cannot fit one page, and the provider's hour label is
  normalized from every documented form - including `...T14:00:00Z` without a
  fractional part - to one canonical spelling. Only `count` and the two
  documented non-PII dimensions are selected, so no address, subject, provider
  message identifier, or sending domain can be read or retained, and the
  provider's `status` label is published only as a one-way digest under the
  shared `ac209-email-log-safety.ts` rule. A page that reaches the row bound
  fails closed as `provider_result_truncated` rather than publishing a partial
  total; the bound is deliberately set so that guard is reachable inside the
  shared response cap, and a module-load guard ties the two together. The
  artifact pins `diagnosticOnly: true`, `pageComplete: true`, the sampling
  caveat, and `observation: 'provider_reported_grouped_totals'`. It is
  read-only, performs no mutation, sends no email, closes no acceptance
  criterion, and cannot substitute for the unique per-event predicate AC209
  acceptance requires - a grouped total carries no identity.
  Dispatch contract: `.github/workflows/diagnose-production-ac209-email.yml`,
  which runs it in the same token-bearing step as the events diagnostic and
  retains both redacted artifacts.

  The numbers are the provider's own, and the artifact is explicit that they are
  NOT presented as exact underlying event counts. Cloudflare documents that any
  node whose name carries the `Adaptive` suffix may be served from a sample,
  with sampling returning an estimate - low volume is commonly unsampled but is
  not a guarantee (https://developers.cloudflare.com/analytics/graphql-api/sampling/).
  `emailRoutingAdaptiveGroups` carries that suffix, so the report states
  `sampling: 'provider_may_sample_adaptive_dataset'` as a required literal, records
  `observation: 'provider_reported_grouped_totals'` as provenance, and records
  `pageComplete` - pinned true, since a truncated page fails closed and never
  reaches an artifact, so no separate always-false flag is carried alongside it
  - only to say the row bound did not cut the page short. A complete page is not
    evidence of unsampled data: completeness and sampling are independent
    properties. If the provider later exposes a documented
    sample-interval field for this dataset it can be surfaced; none is invented now.

  The row bound is deliberately low (100) and a full page fails closed as
  `provider_result_truncated`, because a page cut short by the bound cannot
  support a complete-window total; a partial sum published as authoritative would
  be worse than a failure. Every other provider condition also fails closed into a
  closed code rather than degrading into an empty reading, and a bare UTC day is
  enforced so a day label cannot be a timestamp. The `status` label is bounded and
  shape-checked, then published only as a one-way SHA-256 digest, because it
  reaches a CI log line and a retained artifact as provider-owned text that
  Cloudflare types as a plain `string` with no documented value list. A control
  character, newline, tab, or multi-byte glyph is rejected before the digest, and
  the artifact carries a `zoneTagSha256` digest of the requested zone so a reader
  can confirm which zone produced the numbers without the report retaining the
  raw identifier. It issues exactly one provider query. Investigation only: it
  performs no mutation, closes no acceptance
  criterion, and cannot attribute a grouped count to any particular message,
  since attribution would require the per-event identity this diagnostic
  deliberately does not read. Dispatch contract:
  `.github/workflows/probe-production-ac209-routing-day-counts.yml`.

- `ac209-email-routing-event-contract.ts` owns the per-event query, the row and
  window bounds, and the provenance rationale. `ac209-email-routing-event-schema.ts`
  owns the Zod schemas and is re-exported by the contract, so one schema file
  holds one domain and the dependency stays one-way (a DAG).
  `ac209-email-routing-event.ts` and
  `probe-production-ac209-routing-events.ts` answer the shape question the other
  two routing diagnostics cannot: the presence probe issues `limit: 1`, so it
  proves only at-least-one; the day-count diagnostic reports a provider-reported
  magnitude per UTC DAY and deliberately reads no per-event field. This one asks
  how the provider's ROUTING events distributed inside one exact hour - the hour
  an existing AC209 diagnostic already asked the Email Sending dataset for, which
  is what makes the two readings comparable at all.

  Exactly one bounded query is issued against `emailRoutingAdaptive` over the
  caller's hour, selecting only `datetime`, `status`, `action`, `isLastEvent`,
  and `messageId`. Nothing else is selected, so no address, subject, session,
  routing rule, authentication result, or provider error detail is read, and the
  row guard rejects any provider key outside that selection set rather than
  keeping it. The artifact carries bounded counts, the provider's own `status`
  and `action` label tallies as one-way SHA-256 digests, the final-event count,
  and one-way SHA-256 digests of the in-window message identifiers. The
  identifiers themselves are never retained, logged, or published: they exist
  only long enough to be hashed, and they appear in the retained artifact as
  digests only, never in the CI log line. An operator who holds a candidate
  identifier can hash it and test set membership; no raw identifier is recoverable
  from a digest. `messageId` is the
  one optional selected field, because a routing event may legitimately carry
  none, and `messageIdDigestCoverage` records `complete` or `partial` accordingly
  so a non-match against a partial set cannot be read as absence.

  Interpretation is deliberately narrow, and the parent guard for this change is
  encoded in the artifact rather than only in prose. Cloudflare documents that a
  Worker `send_email` binding send appears in the Email Routing summary as
  dropped even when it was delivered successfully
  (https://developers.cloudflare.com/email-service/platform/limits/) and that
  outbound success belongs to the Email Sending dataset; routing rows and sending
  rows may therefore both exist for the same send. This diagnostic reads ONE
  dataset over ONE hour, so it does not establish which dataset should hold any
  transport, does not refute a reading of the Email Sending dataset, and cannot
  show that either dataset is missing data it ought to hold. A zero-row hour is
  not proof that no routing event occurred, because the dataset name carries the
  `Adaptive` suffix, which Cloudflare documents as possibly served from a sample
  (https://developers.cloudflare.com/analytics/graphql-api/sampling/); the
  required `sampling: 'provider_may_sample_adaptive_dataset'` literal records that
  caveat, and `observation: 'provider_reported_per_event_rows'` records the
  provenance so a count can never read as a delivery claim. That sampling literal
  is the documented sampling indicator rather than a substitute for one:
  Cloudflare documents sampling as a property of the dataset - carried by the
  `Adaptive` name and stated in the dataset description, both discoverable through
  introspection - and documents no per-response or numeric sampling field for this
  dataset, so the designation is known from the query itself and no field is
  invented. A third pinned literal, `underlyingEventAbsence: 'not_established'`,
  records the inference this diagnostic refuses to make: an empty or sparse hour is
  an observation about the rows the provider returned, never proof that the
  underlying routing events did not occur, because the dataset may be sampled and
  provider retention bounds also apply. Pinning it structurally means a reader
  cannot strip the caveat and leave a report that reads as proof of absence.

  The row bound is deliberately low (50) and a full page fails closed as
  `provider_result_truncated`, because a distribution computed from a truncated
  page would be worse than a failure. Every other provider condition fails closed
  into a closed code rather than degrading into an empty reading, and an unusable
  or over-wide window is rejected before any provider call is made. In-window rows
  are re-checked locally so an out-of-window row can never enter a distribution or
  a digest set. The `status` and `action` labels are bounded and shape-checked,
  then reduced to one-way SHA-256 digests before they reach the log line or the
  artifact, so no raw provider text is emitted on either surface: Cloudflare types
  both as plain `string` and documents no value list, so a label is unvetted text
  that may carry a workflow-command token or personal data, and the digest removes
  both risks while keeping the tallies comparable. A printable label is digested
  for the same reason, because printable ASCII is not a safety property. The
  artifact carries a `zoneTagSha256` digest of the requested zone so a reader can confirm
  which zone produced the numbers without the report retaining the raw identifier.
  Investigation only: it performs no mutation, sends no email, changes no
  provider setting, closes no acceptance criterion, and cannot attribute any count
  to a particular message. The redacted artifact is retained for seven days
  (`retention-days: 7`, matching the sibling AC209 probes), after which its review
  window closes; the message-identifier digests live only inside that artifact and
  never in the workflow log. Dispatch contract:
  `.github/workflows/probe-production-ac209-routing-events.yml`.

- `write-ci-gate-evidence.sh` derives the release gate set from successful CI
  job results and the built artifact boundary.
- `verify-ci-release-gates.sh` runs the contract, production-registry, and SLO
  runbook checks that supply independent gate evidence.
- `verify-system-chrome.sh` fails closed unless the runner provides the
  installer-provided Google Chrome binary, so browser gates never silently fall
  back to the Playwright-bundled Chromium download.
- `run-browser-gates.sh` runs `pnpm test:e2e` against the local Supabase stack
  (start, reset to this checkout's migrations, always stop) while holding the
  host lock `infra/verify-database.sh` takes, because the Slice 10 real-route
  specs drive the production Worker, PostgREST and the newest SQL.
- `verify-staging-artifacts.sh` validates the workflow-derived staging
  identity, origins, and downloaded artifact boundary.
- `record-staging-artifacts.sh` records deterministic SHA-256 entries for the
  downloaded staging artifact.
- `deploy-api-worker.sh` injects the approved server configuration and a
  permission-bounded temporary Wrangler secrets file for either hosted
  environment.
- `prepare-staging-candidate.sh` copies the verified artifact and manifest into
  the promotion candidate directory.
- `finalize-staging-candidate.sh` writes the complete release-promotion
  evidence after public staging verification succeeds.
- `collect-staging-axe-evidence.sh` paginates and binds the current protected
  staging deployment/status record to the promoted SHA and run metadata, runs
  the redacted AC266 axe collector, independently hashes and verifies its
  strict report, and leaves `promotion-candidate/accessibility/axe.json` plus
  `axe.sha256` for the staging artifact upload. It requires the preceding
  staging verification to observe the served Cloudflare web response header
  `x-wejammin-release` equal to the promoted SHA. The GitHub deployment ID and
  Cloudflare Worker version ID remain distinct identities and must be retained
  separately. It writes the validated report digest, deployment identity, and
  collection timestamps to the following workflow step through `GITHUB_ENV`.
- `verify-staging-axe-evidence.sh` rechecks the canonical sidecar and report
  digest at finalization, then revalidates the report against the collected
  identity and time bounds so later workflow steps cannot mutate retained AC266
  evidence.
- `collect-content-schema-registry-axe-evidence.ts` runs the canonical hosted
  paths with Playwright and axe, retaining only bounded rule summaries and
  exact hosted identity.
- `content-schema-registry-axe-report-verifier.ts` validates the retained axe
  report independently and recomputes its SHA-256 before the full sidecar
  verifier accepts it.
- `verify-production-candidate.sh` validates production promotion evidence,
  artifact identity, and manifest checksums before deployment.
- `read-production-candidate.sh` validates workflow-run identity before the
  promoted revision is checked out.
- `verify-production-environment.ts` verifies the dispatch confirmation,
  repository identity, exact `main` revision, and live `production`
  environment protection without referencing protected secrets.
- `apply-hosted-migrations.sh` applies forward-only Supabase migrations for a
  hosted environment, verifies the exact remote version, and records expansion.
- `verify-staging-migration-evidence.mjs` binds the staging migration history to
  the exact project, source revision, and CI run before candidate promotion.
- `verify-content-schema-registry-release-evidence.ts` validates the strict S09
  production-observability, hosted-E2E, and manual-accessibility sidecar against
  independently supplied immutable build/deployment/origin identity and
  streams the approved report tree within path-derived entry/depth budgets, then
  recomputes every referenced digest from descriptor-pinned bounded reads. It
  performs no provider calls and a pass does not replace protected-workflow
  source review.
- `verify-content-schema-registry-slo-source.ts` pins bearer-authenticated
  requests to the canonical GitHub REST origin, compares two complete bounded
  deployment-status snapshots, and proves the latest status belongs to the
  requested source SHA and exact `Deploy production` workflow job and attempt.
  The deployment must identify `ref=main` and `task=deploy`; its creation and
  status times must agree with the linked job/run before setting the SLO boundary.
- `content-schema-registry-slo-deployment-provenance.ts` requires that job and
  run to match the active `Deploy production` workflow ID, path, name, manual
  event, `main` branch, source SHA, and repository identity. Every GitHub
  response remains timeout- and size-bounded.
- `ac266-manual-accessibility-report-cli.ts` exposes the offline
  `pnpm ac266:reports` operator command. `template` creates intentionally
  incomplete VoiceOver/Safari and NVDA/Firefox drafts; `prepare` strictly
  validates the completed private reports against one staging candidate and
  writes bounded, owner-only base64 files for the two protected GitHub secrets.
  It performs no network calls or uploads and never turns a template into
  accessibility evidence.
- `content-schema-registry-slo-provider.ts` performs bounded Workers
  Observability pagination and Queue Analytics aggregation, normalizing only the
  allowlisted fields needed by AC211.
- `collect-content-schema-registry-slo-evidence.ts` validates exact
  service/operation/event identity, recomputes the locked percentiles and DLQ
  ratio, and atomically publishes three digest-linked redacted reports.
- `collect-content-schema-registry-alert-configuration.ts` orchestrates the
  protected AC209 configuration capture. Its contract module locks all sixteen
  conditions and thresholds; its provider client reads only the documented
  active deployment, exact-version binding targets, observability settings, and
  schedule fields. `ac209-wrangler-version-attestation.ts` obtains the same
  exact version's tag, message, and upload provenance through the pinned
  Wrangler CLI. Raw provider payloads and the alert address are discarded
  before the atomic redacted artifact is written.
- `ac209-email-sending-settings-capability.ts` owns the AC209 Email Sending
  Settings-node contract the exercise enforces before any mutation. The events
  probe in `ac209-email-sending-analytics.ts` accepts an empty window because
  zero rows still prove read access, so it cannot distinguish a disabled dataset
  or a field unavailable to the requester from a successful read of nothing.
  This gate reads `zones(...).settings.emailSendingAdaptive` and fails closed
  unless `enabled` is true, every field the event query selects appears in
  `availableFields`, and `maxPageSize`/`maxNumberOfFields` cover the 50-row
  bound and all seven selections. It is an independent second preflight: both
  gates run before the step records `cleanup_required=true`. A `maxDuration` or
  `notOlderThan` horizon below the exercise's own one-hour analytics window is
  rejected too, because such a requester would abort the run at the evidence
  stage after the queue boundary had already opened. The settings-node
  readers and query live here and are reused by `ac209-email-diagnostics.ts`,
  so the enforcing gate and the read-only diagnostic cannot disagree about the
  same provider payload. It is read-only, performs no mutation, closes no
  acceptance criterion, and reports only closed diagnostic codes.
  `verify-cloudflare-observability.ts` runs the same gate when it verifies the
  production monitoring token, so the deploy path and the exercise path reject
  the same capability shortfalls. Both limits are reported as one closed
  `provider_resource_unavailable` code, so the deploy verifier's message names
  the verified capability rather than a permission result.

- `ac209-queue-exercise.ts` runs the bounded AC209 queue marker exercise and
  re-exports its contracts plus `cleanupAc209QueueMarker` for cancellation-safe
  exact-marker cleanup.
- `ac209-queue-contracts.ts` contains the validated queue exercise/cleanup
  inputs, runtime bounds, redacted report types, and error boundary.
- `ac209-queue-provider.ts` owns bounded Cloudflare Queue API requests,
  pagination, peeks, exact marker matching, and source-consumer verification.
- `ac209-queue-cleanup.ts` polls both exact queues, purges only matching opaque
  references, rejects ambiguous full pages/provider error shapes, and proves
  marker absence before reporting cleanup.
- `exercise-production-ac209.ts` binds that exact-version configuration to one
  reviewer-approved production queue exercise. The queue adapters require empty
  exact source/DLQ preflights, observe real retry exhaustion, retain the marker
  and message identities only as SHA-256 digests, hold the DLQ message while the
  bounded Email Sending query and service-only Supabase receipt verification
  complete, and purge only the correlated peek ref in `finally`.
  Queue, Email Analytics, and Supabase response bodies are size-bounded during
  streaming, timeout-bounded, and rejected on invalid UTF-8. The database check
  receives `notBefore = exercise.startedAt`, so an earlier delivery for the same
  release cannot satisfy the run.
  Before either preflight the step requires an eligible alert cooldown; the
  events capability probe and the Settings-node gate then both have to pass
  before `cleanup_required=true` is recorded and the queue boundary opens, so a
  cooldown, capability, or settings shortfall performs no queue access and no
  cleanup.
  `cleanup-production-ac209.ts` is the idempotent `always()` safety step: it
  rechecks the pre-generated opaque marker across both exact queues and either
  proves absence or purges only its matching refs. Neither path performs a
  queue-wide purge. The 75-minute workflow invokes this safety step only after
  the exact-version configuration collector succeeds. The retained exercise
  report explicitly leaves Gmail inbox verification pending. The marker is
  derived from the immutable GitHub
  repository/run IDs, so rerunning the same workflow run after a hard
  cancellation recovers the same marker. If the first rerun removes a delayed
  marker during fail-closed preflight, rerun that same run once more to perform
  the exercise from verified-empty queues.
  Migration `20260910030000_ac209_operational_alert_verification.sql` is an
  expand phase that temporarily accepts the deployed five-field completion
  caller; require `providerMessageId` only in a later forward migration after
  the new Worker is verified live.

- `ac209-exercise-stage-diagnostic.ts` holds the one closed stage-diagnostic
  vocabulary for the AC209 exercise. The workflow log line and the retained
  failure receipt both derive from this table, so the two outputs cannot drift,
  and neither has a free-text slot that could carry a provider response body,
  token, address, marker, subject, or provider message identifier.

- `ac209-production-exercise-failure-receipt.ts` and its
  `ac209-production-exercise-failure-contract.ts` schema build the one artifact
  a failed exercise previously did not leave behind. Success-only upload meant a
  fail-closed run retained nothing, so a production failure was invisible except
  in log text. The receipt records `status: unsuccessful` and
  `outcome: no_acceptance` plus the allowlisted stage/code, an optional queue
  boundary and provider status, and the cleanup disposition
  (`not_required` or `unverified`; there is deliberately no `verified` value,
  because proof of marker absence comes from the separate `always()` cleanup
  step, which cannot write this artifact). It carries no marker, address,
  provider identifier, subject, payload, or token, and it can never satisfy a
  success verifier: the schema literals and the distinct
  `production-ac209-exercise-failure-` artifact name both keep it separate from
  success evidence. An identity it cannot verify is recorded as null rather than
  guessed, and a capture failure never replaces the fail-closed exercise result.
  Cleanup still happens through the existing `always()` safety step; the receipt
  records that the marker must be treated as possibly resident when the process
  cannot prove otherwise. The receipt closes no acceptance criterion.

  Two limits are deliberate. First, the receipt holds closed vocabulary only, so
  it narrows _where_ a failure happened and never _what the provider said_: a
  provider rejection is recorded as its boundary and HTTP status, and the
  provider's own error text is neither read nor retained. A transport timeout, an
  unreadable response body, or a rejected purge still names its boundary and
  records a null status, because the provider never returned one.

  Second, a missing failure receipt does not mean the run failed before the
  exercise step. The receipt is written by the exercise process, so it is absent
  in three distinct cases: the marker preparation or exact-version configuration
  collector failed before that step ran, the exercise failed before the receipt
  could be captured, or capture itself failed. A reviewer must read the failing
  step's outcome and the retained `AC209_DIAGNOSTIC` log line to tell those cases
  apart; the absence of the artifact alone never identifies the cause, and no
  cause may be inferred from it. Only a failure in the marker preparation or
  configuration collector is genuinely a preflight failure.

- `register-ac265-approved-registry.ts` is the manual entrypoint that submits an
  already-formed strict register request to the CP-02 approved-registry RPCs.
  This is registration transport/plumbing only: CP-02, unlike CP-04b, pins no
  approval policy table, so the dispatch input and the `staging` environment
  (currently unreviewed) do NOT prove that the referenced safe resources or the
  runner mapping are owner-approved. The owner-approval binding remains open.
  Its sibling bounded service-role client
  `ac265-approved-registry-registration-rpc.ts` POSTs only the strict register
  request to exactly `ac265_approved_safe_resource_register` or
  `ac265_approved_runner_mapping_register` at the exact
  `https://<ref>.supabase.co` origin, with no-redirect/no-store transport, a
  64 KiB streamed response cap, fatal UTF-8 decoding, a fixed 10-second
  deadline, and a single generic failure boundary. It rejects any redirect,
  non-200 status, duplicate JSON member, or `{status:'conflict'}` response and
  binds every register result field (authorization, idempotency, resource kind
  and locator, environment, hosting project, Supabase project ref, and
  redaction) to the submitted request before returning. The entrypoint reads
  the request only from the exact runner-temp JSON file, requires the full
  registration environment, and appends only the server-derived
  resource reference/kind or mapping id to `GITHUB_OUTPUT` and
  `GITHUB_STEP_SUMMARY`. It deliberately does not seed rows, create identities
  or grants, or verify underlying resource safety, and it closes no AC265
  criterion.

- `run-ac265-outage-lease-control.ts` is the manual entrypoint for exactly
  one bounded CP-01 outage-lease control operation: acquire, consume, or
  release. It is foundation transport only and grants no AC265 acceptance. It
  chooses no dependency, route, duration, limit, or target: the operation and
  the authorization, target, idempotency, and (for consume/release) lease
  reference and digest all arrive as operator-supplied inputs, while the
  control plane owns every timestamp, the canonical reference digest, the
  fixed 60-second one-request policy, and the conflict decision. Its sibling
  bounded service-role client `ac265-outage-lease-rpc.ts` POSTs only the
  strict request to exactly `ac265_hosted_outage_lease_acquire`,
  `ac265_hosted_outage_lease_consume`, or `ac265_hosted_outage_lease_release`
  at the exact `https://<ref>.supabase.co` origin, with no-redirect/no-store
  transport, a 64 KiB streamed response cap, fatal UTF-8 decoding, and a fixed
  10-second deadline. `ac265-outage-lease-transport.ts` owns that shared
  transport and the failure/conflict classification, while
  `runner-temp-artifact-boundary.ts` owns the held-descriptor runner-temp,
  summary, and exclusive-record filesystem boundary used by this entrypoint.
  That boundary module is new and local to these files; the earlier
  outage-target and runner-mapping entrypoints still carry their own copies of
  the same pattern, and deduplicating them is not part of this change. The
  client accepts only a schema-valid success result whose
  authorization, target, idempotency, environment, state, and redaction fields
  are bound to the submitted request and whose lease digest it independently
  recomputes from the returned lease reference; every other rejection collapses
  to one generic failure boundary. The control plane's deliberate refusal
  envelope `{status:'conflict'}` is reported as a distinct conflict outcome so
  an operator can tell a refusal from a transport or trust failure. The
  entrypoint writes exactly one exclusive redacted record at
  `${RUNNER_TEMP}/ac265-outage-lease/outage-lease-control.json`, appends a
  redacted summary, and emits the lease reference only as a job-scoped step
  output because that reference is a one-use capability. It exercises no
  outage, seeds no approved target, registers
  no dependency or route, contacts no hosted resource, creates no identity or
  grant, and closes no AC265 criterion.

- `ac265-retained-report-producer.ts` is the retained hosted E2E report
  producer. It takes the exact report bytes the assembler emitted plus the
  independently trusted run facts, validates them on the raw-byte boundary, and
  publishes one owner-only report at the sidecar-declared relative path. Its
  ordering is deliberate: the bytes are validated in full before the report
  root is created, inspected, or written, so a rejected report leaves no
  directory behind. The returned digest is SHA-256 over the exact bytes written,
  not over a canonical re-serialization, and `serializeAc265RetainedReportV3`
  owns that one byte form. This produces a retained artifact for the existing
  verifier; it brokers no sessions, issues no receipts, and claims no criterion.

  - `ac265-retained-report-redactor.ts` is the value-level redaction boundary.
    Four layers must all pass: provenance parsing with structural classes, the
    strict `ac265-hosted-e2e-v3` schema, provenance equality for every identity
    field, reference, digest, and the run window, and prohibited-content
    inspection. There is deliberately no global high-entropy scan: the
    contract's own UUIDs, revisions, and digests are high-entropy by design and
    a secret can be made to match a digest.
  - `ac265-retained-report-provenance.ts` parses and validates the trusted run
    facts and owns the field-aware identity classes, reference patterns, and the
    shared failure boundary. `ac265-retained-report-provenance-parsers.ts` owns
    the contract, receipt-slot, session-handle, and resource-binding parsers it
    composes, so both files stay inside the utility size cap.
  - `ac265-retained-report-trusted-digests.ts` derives the trusted receipt and
    evidence digests by resolving each reference through the authenticated
    resolver and hashing the returned bytes, so no digest is ever taken from the
    report or from a caller.
  - `ac265-retained-report-publication.ts` is the narrow byte-level boundary.
    It carries no assembler, broker, or resolver and requires complete trusted
    provenance, so it is not a path that skips authentication.
  - `ac265-retained-report-binding.ts` binds a schema-valid report to those
    trusted facts, so a valid report from another run, identity, receipt set, or
    resource set is rejected instead of republished.
  - `ac265-retained-report-prohibited-content.ts` owns the focused marker
    vocabulary applied to decoded member names and string leaves.
  - `ac265-retained-report-run-manifest.ts` integrates the protected run
    manifest into the producer boundary. It reads the exact canonical
    `ac265-hosted-run-manifest-v1` bytes through the CP-04g digest-bound
    `readAc265HostedRunManifestV1Bytes`, so duplicate members, schema drift, and
    insertion-ordered (non-canonical) members fail closed rather than being
    re-canonicalized onto a different digest, and it binds the manifest's
    criterion, contract version, run, identity, session references, resource
    references, and control policy to the contract parsed from the same runner
    contract bytes the report is assembled from. The producer requires those
    bytes and their trusted digest, binds them before assembly and before any
    directory is created, and returns the verified digest so a consumer can
    recompute it over the returned bytes.
  - `ac265-retained-report-writer.ts` owns atomic, exclusive publication: an
    owner-only temporary file, `fsync`, and `link` publication that cannot
    replace an existing or racing destination, with symlinked roots and path
    components rejected and temporary artifacts removed on failure.

- `ac265-hosted-artifact-attestation-issuer.ts` is the live, fail-closed
  producer half of the CP-04c hosted-artifact boundary. It signs exact
  caller-supplied `server_receipt` and `execution_evidence` bytes into the
  canonical, domain-separated `HostedArtifactAttestationV1` companion that the
  CP-04c resolver authenticates as one member of the `Ac265HostedArtifactSource`
  tuple the calling harness assembles; the resolver never consumes the
  companion on its own. It never synthesizes receipts,
  credentials, or identity: the caller supplies the bytes and the run binding,
  and the signer refuses anything else. Key pinning is self-describing — the
  key ID is derived as `ac265-hosted-artifact-ed25519-<sha256(SPKI DER)[0..32]>`
  and any key ID that does not name the exact public half of the supplied
  private key is rejected. Subject digests are derived from the bytes, never
  accepted as a caller-supplied digest. Receipt bytes must be complete,
  duplicate-member-free `ac265-hosted-e2e-receipt-v1` envelopes, and an
  execution-evidence payload's own `kind` must match the kind its declared
  descriptor maps to (`role` → `role_assertion`, `scenario` →
  `scenario_observation`, `session_teardown` → `session_teardown`), so a
  self-consistent payload the CP-04c verifier must reject is never signed.
  Canonical byte form is not required of either input: the digest is over the
  exact bytes and the resolver digests those same bytes. No live signing key is configured by
  this code; while the distinct artifact-attestation issuer key and its
  `artifactTrustedKeys` pinning remain owner decisions, the publishing boundary
  stays unwired and AC265 stays open.

  - `ac265-hosted-artifact-attestation-issuer-inputs.ts` owns the shared
    validators, the execution-evidence subject vocabulary, and the SPKI-derived
    key-ID derivation.
  - `ac265-hosted-artifact-attestation-issuer-contract.ts` owns the issuer
    request/result/run-binding interfaces and the trusted-key surface.
  - `ac265-hosted-artifact-attestation-issuer-signing.ts` owns the single
    signing pass: request-shape validation, window checks against the pinned
    key validity, and the canonical detached signature.

- `issue-ac265-hosted-artifact-attestations.ts` is the protected entrypoint
  that runs on an isolated runner. It reads one bounded, duplicate-member-free
  request document listing the exact artifact members the caller already holds,
  reads each member through no-follow bounded reads, re-derives each subject
  from the member bytes, and publishes only the signed companions plus a
  digest index under an owner-only `0700` directory created fresh beneath
  `RUNNER_TEMP`. The index is a handoff record for the calling harness, not a
  resolver input: the harness still builds each `Ac265HostedArtifactSource`
  from the artifact bytes, the published attestation companion, and its own
  expectation, exactly as the CP-04c fixtures do. An existing output directory
  fails closed, so the entrypoint never overwrites prior evidence. Identity
  comes only from environment values; `GITHUB_STEP_SUMMARY` and every artifact
  member must resolve beneath `RUNNER_TEMP`, and a path outside it fails
  closed. It emits a redacted step summary and no artifact bytes or private
  material.

  - `issue-ac265-hosted-artifact-attestation-contract.ts` owns the entrypoint
    constants, the request/source member sets, and the issuance summary type.
  - `issue-ac265-hosted-artifact-attestation-files.ts` owns the bounded
    no-follow reads and the exclusive owner-only publication with digest-bound
    readback.
  - `issue-ac265-hosted-artifact-attestation-sources.ts` owns declared-source
    parsing and the byte-derived subject digests for both artifact kinds.

- `ac265-session-broker-rpc.ts` is the bounded service-role client for the
  run-scoped session broker control plane (CP-05). It exposes exactly three
  entry points — authorize, resolve, teardown — and POSTs only the strict
  request to exactly `ac265_session_broker_authorize`,
  `ac265_session_broker_resolve`, or `ac265_session_broker_teardown` at the
  exact `https://<ref>.supabase.co` origin, with no-redirect/no-store
  transport, a 128 KiB streamed response cap, fatal UTF-8 decoding, and a fixed
  10-second deadline. Every response is rebound to the submitted request:
  authorization, run, identity, idempotency reference, role, handle reference,
  and environment must echo, and each handle digest is recomputed locally from
  the reference bytes so a caller cannot assert a digest for a handle it does
  not hold. The control plane's deliberate refusal envelope
  `{status:'conflict'}` is reported as a distinct typed conflict outcome so an
  operator can tell a refusal from a transport or trust failure. The client
  stores no session state, resolves no material, and closes no AC265 criterion;
  a live resolve still requires an owner-provisioned broker, a live runner
  authorization, and the exact run identity.

- `ac265-hosted-runner-contract-composer.ts` composes the canonical
  `ac265-hosted-runner-v1` contract bytes and digest. It is the producer the
  retained-report assembler and the V3 verifier already expect but that no
  component previously supplied; before it, every consumer required exact
  runner-contract bytes the run had no way to derive. Authority is derived,
  never accepted. The CP-03 authenticated runner-mapping attestation supplies
  the run, candidate identity, role/resource bindings, and scenario/role
  bindings; the CP-04a authenticated outage-target attestation supplies the
  dependency and route; the authenticated CP-05 session-broker authorization
  supplies the nine role-matched session references; and the CP-01 acquire
  result supplies the run-scoped one-use outage lease. The bounded controls and
  fixed scenario parameters come from `ac265-hosted-runner-policy-v1.ts`
  rather than being restated, so the two cannot drift apart.

  The two protected sources must describe the same attempt: the mapping, the
  target, and the broker authorization all have to agree on the run, and the
  authorization must digest the same candidate identity and pin the same
  staging project. The lease must have been acquired under that same
  authorization and for exactly the authenticated target. The safe-resource
  manifest is precisely the reference set the approved mapping binds — one per
  locked kind — so a kind the mapping does not authorize fails closed instead of
  being invented or narrowed. Every reference digest is recomputed from its
  exact UTF-8 bytes, and a lease or attestation outside the trusted run window
  is rejected. The result is frozen and its byte accessor returns caller-owned
  copies, so a consumer cannot corrupt bytes after the digest was computed.

  It returns contract bytes only and is a reference container, never session
  state or credentials. It creates no live authority, identity, session,
  receipt, or fault, closes no AC265 criterion, and does not establish hosted
  acceptance. Contract coverage lives in
  `tests/contracts/phase-02-slice-09-ac265-hosted-runner-contract-composer.test.ts`
  and
  `tests/contracts/phase-02-slice-09-ac265-hosted-runner-contract-composer-bindings.test.ts`.

  - `ac265-session-broker-rpc-transport.ts` owns the shared endpoint, secret,
    bounded-response, deadline, and conflict-classification boundary.
  - `ac265-session-broker-rpc-parsers.ts` owns result parsing and rebinding.
  - `ac265-session-broker-rpc-entrypoints.ts` owns the three public entry
    points and their local digest preconditions.

## Conventions

Scripts accept identity only through environment values derived by the calling
workflow. Staging derives identity from its successful upstream CI run;
production derives the staging run ID and source SHA from an explicit
`workflow_dispatch` and verifies both against the GitHub Actions API before the
protected production job starts. The preflight also requires the immutable
staging workflow ID/path, required reviewers, disabled administrator bypass,
and either protected branches or one exact custom `main` branch policy. Only
the production migration entrypoint contacts Supabase; its access token and
database password remain scoped to that protected-environment step. The
standalone Cloudflare observability preflight reuses the production environment
guard before entering the protected job, then scopes its capability token to
one read-only verifier step. Its Workers Observability request sets `dry: true`
and fails unless the provider response attests `run.dry: true`. Other
Cloudflare credentials remain scoped to individual workflow steps.

### Verification

Run `bash <script>` only from a checked-out repository with the workflow
environment supplied. Migration tests replace the `pnpm` provider boundary
with a local fake and never contact Supabase. Contract coverage lives in
`tests/release-identity-contract.test.ts`, `tests/workflow-evidence-scripts.test.ts`,
`tests/web-ssr-deployment-contract.test.ts`, `tests/environment-contract.test.ts`,
`tests/production-environment-preflight.test.ts`, and
`tests/cloudflare-observability-preflight-workflow-contract.test.ts`.

## Extension

Add one focused script per repeatable workflow concern. Keep provider calls in
bounded adapters invoked by their protected workflow steps, pass identity
through explicit environment values, and preserve `set -euo pipefail` in every
shell entrypoint. Production promotion
must retain its manual trigger, preflight identity/protection checks, and
protected environment gate.

## Ownership

The deployment workflow owner maintains these scripts with the corresponding
`.github/workflows/*.yml` files. Changes must preserve explicit production
dispatch, full release evidence, and fail-closed artifact checks.

## Related links

- [CI workflow](../../.github/workflows/ci.yml)
- [Staging deployment](../../.github/workflows/deploy-staging.yml)
- [Production deployment](../../.github/workflows/deploy-production.yml)
- [Production Cloudflare observability verification](../../.github/workflows/verify-production-cloudflare-observability.yml)
- [Infrastructure guidance](../README.md)
