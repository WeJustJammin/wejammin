# CI/CD environment configuration

The CI workflow requires no application or provider secrets. It runs only trusted repository code on the `wejammin` self-hosted runner label with read-only repository permissions.

Only the credentials listed below are authorized. They belong in protected GitHub environments, never repository-level plaintext, workflow arguments, artifacts, or logs. Adding any provider secret requires a new owner approval that names the service and exact cost.

## Staging environment secrets

| Name                                            | Owner            | Purpose                                                                                       |
| ----------------------------------------------- | ---------------- | --------------------------------------------------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`                          | Hosting          | Deploy Workers/assets with least-privilege edit permissions.                                  |
| `SUPABASE_ACCESS_TOKEN`                         | Data             | Manage the staging Supabase project through the CLI.                                          |
| `SUPABASE_DB_PASSWORD`                          | Data             | Apply and verify staging database migrations.                                                 |
| `SUPABASE_SECRET_KEY`                           | Data             | Rotatable server-only API access; never exposed to Astro client code.                         |
| `AC265_PUBLICATION_CONTEXT_BUNDLE_B64`          | Release evidence | Base64-encoded bounded AC265 protected context bundle for the protected publication workflow. |
| `AC265_SOURCE_MANIFEST_SIGNING_PRIVATE_KEY_PEM` | Release evidence | Ed25519 private key used only to sign the finalized AC265 publication manifest.               |
| `AC265_HOSTED_VERIFICATION_CONTEXT_BUNDLE_B64`  | Release evidence | Per-attempt staging-only trust bundle for the protected hosted-evidence verifier.             |
| `AC265_RUNNER_MAPPING_SIGNING_PRIVATE_KEY_PEM`  | Release evidence | Ed25519 private key for protected runner-mapping attestations only.                           |
| `AC265_OUTAGE_TARGET_SIGNING_PRIVATE_KEY_PEM`   | Release evidence | Distinct Ed25519 private key for protected outage-target attestations only.                   |

`AC265_PUBLICATION_CONTEXT_BUNDLE_B64` is the owner-controlled trust root for
an AC265 publication run. It is configured only in the protected `staging`
environment; its reviewer, main-branch restriction, and audit history govern
changes. The bundle carries the signed authority manifest, pinned public keys,
authorization/candidate bindings, separate CI and staging provenance, and
archive digests. The bundle signature does not independently authenticate a
replacement of this secret. Populate and rotate it externally under the
release-evidence owner process; no live value is configured in this repository.

`AC265_SOURCE_MANIFEST_SIGNING_PRIVATE_KEY_PEM` is a distinct protected
`staging` secret. It must match the public key pinned by the authorized context
bundle, must never be embedded in that bundle, and is exposed only to the
publication step after the bundle and artifact provenance checks succeed. Its
non-secret identifier is configured as the protected staging environment
variable `AC265_SOURCE_MANIFEST_SIGNING_KEY_ID`. Neither live value is
configured by this repository change.

`AC265_HOSTED_VERIFICATION_CONTEXT_BUNDLE_B64` is the protected staging-only
trust root for the AC265 hosted-scope verifier. The release-evidence owner mints
it only after an exact hosted V3 report exists, pins that report body's digest,
the trusted cutoff, approved signed sources and public keys, and rotates it
for every acceptance attempt. It is never a dispatch input, log value, or
retained artifact. Listing it here authorizes the configuration slot; it does
not assert that a live bundle exists or that AC265 has passed.

`AC265_RUNNER_MAPPING_SIGNING_PRIVATE_KEY_PEM` and
`AC265_OUTAGE_TARGET_SIGNING_PRIVATE_KEY_PEM` are separate staging-only keys
for the two domain-separated protected attestation workflows. Their key IDs
are the non-secret staging environment variables
`AC265_RUNNER_MAPPING_SIGNING_KEY_ID` and
`AC265_OUTAGE_TARGET_SIGNING_KEY_ID`. Configure each only with its matching
owner-approved public key and scoped source; do not reuse the source-manifest
key, copy keys to production, or treat a signed fixture as hosted evidence.

## Production environment secrets

Production uses the four Cloudflare/Supabase provider credential names above
in the protected `production` environment with distinct values. The AC265
bundles and signing keys above remain staging-only. Production also uses the
production-only
`CLOUDFLARE_OBSERVABILITY_API_TOKEN` and the manual-only
`CLOUDFLARE_QUEUE_EXERCISE_TOKEN`. Configure the observability token for the
WeJammin account with Workers Observability Write (shown as **Edit** in the
Cloudflare dashboard) and Account Analytics Read, plus Zone Analytics Read for
only the exact Email Sending zone; it must not have Workers Scripts Edit. The
standalone verifier uses that write-scoped capability only for a non-persisting
`dry: true` query and requires the provider response to attest `run.dry: true`.
The scheduled S09 alert boundary uses it only to read structured Workers Logs
and Queue metrics. The manual AC211 collection
workflow uses the same read-only scopes to assemble bounded aggregate evidence;
the protected AC209 exercise also uses its Analytics Read scope for the bounded
Email Sending delivery query. Because Email Sending analytics is a zone-level
GraphQL dataset, both the Zone Analytics Read permission and the token's Zone
Resources must name the parent Cloudflare DNS zone (`wejamm.in`). Set
`CLOUDFLARE_EMAIL_ZONE_ID` to that DNS zone's ID, not the Email Sending
subdomain tag returned for `alerts.wejamm.in`. The automated preflight proves
access to that configured zone; confirm the token's exclusion of every other
zone in its Cloudflare resource policy. Before production promotion, dispatch
`Verify production Cloudflare observability` from `main` with that exact main
SHA and proceed only after the protected read-only check passes. It never
retains raw provider responses.
The read-only AC209 diagnostic workflow uses the same token for both of its
probes in one step: the per-event Email Sending window query and the hourly
`emailSendingAdaptiveGroups` corroboration probe. Both are read-only, and
neither sends email, mutates a queue, or closes an acceptance criterion. The
corroboration probe reads only the aggregated `count` and the
`datetimeHour`/`status` dimensions, so it needs no permission beyond the Zone
Analytics Read already required for the parent zone.
The queue-exercise token must be
restricted to the WeJammin account with Workers Queues Write and no deployment,
zone-management, Email Sending management, or billing permission. It exists
only for the serialized, reviewer-approved AC209 workflow, which preflights
empty exact queues and can purge only the correlated peek ref.
The deployment token and interactive Wrangler OAuth credential must never be
substituted for it. Required reviewers,
main-branch restrictions, and serialized deployment concurrency remain in
force. Staging values must never be copied into production or vice versa.
The protected production workflow exercises both provider APIs with
`infra/verify-cloudflare-observability.ts` before migrations or deployment and
fails with a secret-safe permission error when either scope is unavailable.

The production environment reports required-reviewer rule `64231612` for the
business account `WeJustJammin` (reviewer ID `305953066`),
`prevent_self_review: false`,
`can_admins_bypass: false`, and the sole custom deployment branch policy
`{ name: "main", type: "branch" }`. This single-business-account repository
keeps production `workflow_dispatch`/manual-only while allowing the dispatching
owner to provide the explicit protected-environment approval. Administrator
bypass remains disabled.

## AC266 manual evidence environment secrets

The protected `ac266-manual-evidence` environment contains only these two
strict, privacy-bounded report inputs:

| Name                            | Owner         | Purpose                                                   |
| ------------------------------- | ------------- | --------------------------------------------------------- |
| `AC266_VOICEOVER_REPORT_BASE64` | Accessibility | Exact base64-encoded macOS/Safari/VoiceOver report bytes. |
| `AC266_NVDA_REPORT_BASE64`      | Accessibility | Exact base64-encoded Windows/Firefox/NVDA report bytes.   |

Reports must satisfy `ac266-manual-a11y-v1`: opaque operator IDs, bounded
structured observations, no free-text notes, and no names, email addresses,
content, cookies, credentials, screenshots, or recordings. The workflows run
on isolated GitHub-hosted `ubuntu-24.04` runners, materialize bytes only below
the run-specific `runner.temp` directory, and upload sanitized manifests only.
Keep the secrets until the protected combined-sidecar verifier has
re-materialized and verified the exact bytes; then remove or rotate them.

The environment is restricted to `main`, exposes only
`STAGING_WEB_ORIGIN=https://staging.wejamm.in`, requires reviewer
`WeJustJammin`, and disables administrator bypass. This single-account setup
allows owner self-approval, so it is not independent review.

## Repository security controls

Before changing `WeJustJammin/nevrite-music` from PRIVATE to PUBLIC, a
full-history safety audit scanned 309 commits, 17,443 objects, and 12,175 text
blobs and found no committed production credentials, private keys, or provider
tokens. Secret scanning, push protection, vulnerability alerts, and automated
security fixes are enabled. Environment secrets remain protected and must never
be placed in repository contents, workflow arguments, artifacts, or logs.

The Cloudflare deployment token is restricted to the WeJammin account with Cloudflare
Pages Edit and Workers Scripts Edit, plus zone-scoped Workers Routes Edit for
the production custom-domain binding. Create separate staging and production
tokens; never reuse the interactive Wrangler OAuth credential in CI.

## Environment variables

Non-secret GitHub environment variables include `CLOUDFLARE_ACCOUNT_ID`, `STAGING_WEB_ORIGIN`, `STAGING_API_ORIGIN`, `SUPABASE_PROJECT_REF`, `SUPABASE_URL`, and the protected staging attestation key identifiers `AC265_SOURCE_MANIFEST_SIGNING_KEY_ID`, `AC265_RUNNER_MAPPING_SIGNING_KEY_ID`, and `AC265_OUTAGE_TARGET_SIGNING_KEY_ID`. Production also records `PRODUCTION_API_ORIGIN` for the post-deploy health gate, `PRODUCTION_ALERT_EMAIL_SHA256` and `PRODUCTION_ALERT_SENDER_SHA256` for redacted AC209 address verification, `CLOUDFLARE_EMAIL_ZONE_ID` for the exact Email Sending analytics zone, `CLOUDFLARE_PLATFORM_QUEUE_ID` for the exact production queue and AC211 Queue Analytics query, and `STAGING_SUPABASE_PROJECT_REF` so promotion can independently match staging migration evidence to the configured staging project. Browser-safe application values are variables rather than secrets: `PUBLIC_APP_ORIGIN`, `PUBLIC_SUPABASE_URL`, and `PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Administrative keys and database passwords remain secrets. No third-party application-provider credential is authorized.

`AC209_PRESENCE_ALTERNATE_ZONE_TAG` is a non-secret protected production
environment variable for the read-only AC209 email presence probe. It is **unset
by default**, and an unset or empty value means "no alternate candidate tag", so
a default dispatch sends no extra request. Setting it to a zone identifier makes
the probe read one bounded, count-only Email Sending window for that tag in
addition to the exact parent zone, and report only whether that read succeeded.
That is a cross-zone read, so it may be set only when the observability token's
zone resources already permit the tag; the variable never expands token scope,
the probe never changes token authorization, and no cross-zone read is performed
while the variable is unset. The alternate read is inventory only: it never
feeds the parent-zone classification, never contributes to AC209 acceptance, and
neither tag identifier is retained in the artifact. Editing or setting this
variable requires owner authorization, as with every other environment variable
above.

## Cost control

Workers Paid runs under DEC-103's soft $10/month operational budget. Cloudflare's enabled account-level `Billing Budget Alert` is set to exactly `$10` and delivers to the owner email. Both Worker environments retain a 50 ms per-invocation CPU cap; any expected increase above the budget requires a new owner decision before configuration changes.
