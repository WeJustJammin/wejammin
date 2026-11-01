# Content schema registry operational evidence

## Contents

- Alert policy, thresholds, contracts, evaluator, and provider-free boundary
- Local verification command and production observability handoff

- Slice 12 (BE03c Observability) alert policy and provider-free delivery seam
  (`cms-composition-alert-policy.ts`, `cms-composition-alert-boundary.ts`)

## Ownership

The `infra/observability` modules own redacted S09 aggregate evaluation and
delivery seams. Callers provide the native telemetry sink; these modules do not
own provider credentials, dashboards, or request data.

## Extension

Add new aggregate policies as bounded modules with explicit thresholds and
redacted output. Extend the focused tests before wiring a native provider or
scheduled query.

## Conventions

Keep telemetry fields compatible with the structured observability contracts;
never accept request bodies, cookies, tokens, content values, or capability
graphs in this boundary.

The Slice 12 policy evaluates DLQ depth, outbox age, a blocked activation, the stale locale legal-field count,
a failed locale observability read (DEC-220, stateless) and the target-filter anomaly from a redacted aggregate snapshot (runbook `cms-composition`); like Slice 09 it
is provider-free and the repository deploys no provider-side rule for it yet.

## Related links

- `tests/observability/phase-02-slice-09-alert-policy.test.ts`
- `tests/observability/phase-02-slice-09-alert-boundary.test.ts`
- `tests/observability/phase-02-slice-12-alert-policy.test.ts`
- `docs/local-bootstrap.md`

`content-schema-registry-alert-policy.ts` is the public, tested, side-effect-free
policy adapter and compatibility barrel for the redacted S09 aggregate-
measurement policy. Its focused
`content-schema-registry-alert-thresholds.ts`,
`content-schema-registry-alert-types.ts`, and
`content-schema-registry-alert-evaluator.ts` modules keep thresholds, contracts,
and evaluation independently bounded. The companion
`content-schema-registry-alert-boundary.ts` is the provider-free delivery seam:
it consumes the policy result and emits only page-worthy alert records to a
caller-provided sink. Production telemetry already emits the operation, SLO,
alert route, and runbook attributes consumed by the native Cloudflare/Supabase
observability boundary; neither module accepts request bodies, cookies, tokens,
content values, or capability graphs.

The production Worker now connects this policy to Cloudflare Workers Logs,
Queue metrics, Cron Triggers, Email Service, and service-only Supabase claim and
receipt RPCs through
`apps/worker/src/content-schema-registry/operational-alert-production.ts`.
Deployment still must prove the scoped provider token, exact production config,
and one post-configuration redacted delivery receipt before AC209 closes. The
policy intentionally does not fabricate an alert when an aggregate measurement
is missing or non-finite.

Run the local contract evidence with:

```bash
pnpm exec vitest run tests/observability/phase-02-slice-09-alert-policy.test.ts
```
