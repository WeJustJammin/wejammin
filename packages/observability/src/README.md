# Observability source

## Contents

- Structured log contracts, scrubbing, sampling, and native object emission
- Content schema registry operational thresholds, types, and evaluation
- Slice 12 composition alert codes, thresholds, snapshot contract, and evaluation

## Ownership

This directory owns bounded structured logging and the side-effect-free content
schema registry operational alert policy. Runtime provider adapters remain in
their owning application or infrastructure package; this package accepts no
provider credentials and emits no alerts itself.

## Extension

Add validated log fields or alert conditions here before consuming them in an
application adapter. Preserve exact thresholds and add focused policy tests.

## Conventions

`logging.ts` validates and scrubs structured log objects before emitting them.
The `content-schema-registry-alert-*` modules define the locked S09 thresholds,
snapshot contract, evaluator, and public package barrel used by both Worker and
infrastructure boundaries.

The `cms-composition-alert-*` modules hold the BE03c Observability (Slice 12) policy: DLQ above 0, outbox age
above two minutes, an activation blocked above 15 minutes, a stale locale legal-field count above 0, a failed locale observability read
(DEC-220: stateless, one failed read alerts for its own firing and delivery dedupes) and a target-filter anomaly. The outbox and blocked-activation numbers are read from the Slice 09 thresholds so the two
policies cannot drift; the public barrel is `cms-composition-alerts.ts`.

## Related links

- `apps/worker/src/content-schema-registry/operational-alert-production.ts`
- `infra/observability/README.md`
- `tests/observability/phase-02-slice-09-alert-policy.test.ts`
- `tests/observability/phase-02-slice-12-alert-policy.test.ts`
