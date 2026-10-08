# Platform runbooks

## Contents

Safe operational endpoint, job/outbox reconciliation, retention, and SLO procedures for the foundation platform.

- [Jobs and outbox reconciliation](./jobs-outbox-reconciliation.md) — recover undispatched work and expired leases with canonical-state checks.
- [Upload admission reconciliation](./upload-admission-reconciliation.md) — reconcile upload intents without persisting signed URLs or bypassing canonical object state.
- [Provider and webhook reconciliation](./provider-webhook-reconciliation.md) — resolve duplicate deliveries and unknown provider outcomes while production providers remain disabled.
- [Release and recovery gates](./release-recovery-gates.md) — promote immutable artifacts and keep protected writes closed while hosted PITR evidence is unavailable.
- [Initial CMS owner](./initial-cms-owner.md) — initialize the sole approved staging owner once through the audited operator-only boundary.
- [Sole administrator MFA lockout](./sole-admin-mfa-lockout.md) — recover the only administrator's authenticators through the Supabase dashboard with an audit note.
- [CMS editorial entry authoring](./cms-editorial.md) — triage typed refusals, provision and rotate the signed-cursor Vault key, reconcile lost responses by idempotency key, and handle presence-sweep and restore-chain failures for the nine Slice 10 operations.

## Ownership

The Infrastructure owner maintains these runbooks and their registry references.

## Extension rules

New entries require a matching closed-registry owner and must use sanitized labels instead of private dependency names.

## Conventions and related material

Use provider-neutral symptoms, bounded checks, and named escalation routes. Related contracts live in `packages/contracts/src/platform-registries.ts`.
