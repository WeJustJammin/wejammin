# Observability policy tests

## Contents

Vitest suites for the alert policies and provider-free alert boundaries in
`infra/observability/`:

- `phase-02-slice-09-alert-policy.test.ts` and
  `phase-02-slice-09-alert-boundary.test.ts`: content-schema-registry aggregate
  alerts (P2-S09-AC-209).
- `phase-02-slice-12-alert-policy.test.ts`: CMS composition alerts (P2-S12-AC-264).

## Ownership

The owner of each `infra/observability` policy module owns its test here. These
tests prove policy and boundary behavior only; they are not deployment or
hosted-provider evidence.

## Extension

Add one `phase-02-slice-<n>-<subject>.test.ts` file per policy, importing the
policy and boundary modules by relative path. Name the `describe` block with the
acceptance identifier in brackets and test thresholds at, just below and just
above each boundary value.

## Conventions

Assert redacted, aggregate output only: no ids, tokens, request data or label
text may appear in emitted measurements. Use fixed numeric inputs and a
test-owned sink; read no network and no provider configuration.

## Related links

- `infra/observability/README.md`
- `tests/contracts/README.md`
