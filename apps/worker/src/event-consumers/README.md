# Event consumers

## Contents

Registered Queue consumers for the platform jobs queue. Each consumer receives an
identifier-only envelope (`packages/contracts/src/consumer-queue-events.ts`), rereads
current state through a protected `platform_api` RPC, and returns an outcome the queue
entrypoint applies (`ack`, or `retry` with an optional delay).

| Consumer                         | Event                                         | Spec  | What it does                                                                                                                                                                                        |
| -------------------------------- | --------------------------------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `identity.auth-state-reconciler` | `identity.mfa-factor.changed.v1`              | BE01a | Polls the provider factor status for a `reconciling` factor and settles it `verified`, `pending` or `removed`. A status read only: it never resends a provider effect.                              |
| `identity.security-notifier`     | `identity.security-notification.requested.v1` | BE01a | Rereads the immutable security event and sends `mfa_factor_added`, `mfa_factor_removed` or `mfa_factors_reset` under one notification id: retries at 15, 60 and 300 seconds, then the platform DLQ. |
| `cms.capability-grant-consumer`  | `cms.capability.grant.changed.v1`             | BE03a | Refetches the current grant, applies only that state through the authorization refresh seam, never treats the event as permission proof.                                                            |

Cross-cutting rules, all in `admit.ts`: a message that is not exactly the consumer's v1
envelope is recorded durably (`consumer_dead_letter_event`) and acknowledged; an unknown
event version is a dead letter with reason `UNKNOWN_EVENT_VERSION`; if the dead letter
cannot be recorded the message is retried, never dropped. `registry.ts` routes by event
family (any version), so an unknown version still reaches its consumer.

`reconciling-age.ts` is the BE01a reconciling-age gauge, sampled once per scheduled
outbox-sweep tick; a failed sample is reported and never fails the sweep.

## Ownership

This directory owns consumer admission, routing, retry and dead-letter
behavior for the platform jobs queue. The database owns every durable decision
through protected `platform_api` RPCs; a consumer rereads current state and
never treats an event as proof of permission.

## Files

- `types.ts`, `rpc-names.ts`, `retry-schedule.ts`, `deadline.ts` – shared consumer vocabulary.
- `admit.ts`, `dead-letter.ts` – admission and the durable dead-letter port.
- `auth-state-reconciler*.ts`, `provider-factor-status.ts` – reconciler, its RPC port and the Supabase Auth admin status read.
- `security-notifier*.ts`, `in-app-notification-provider.ts` – notifier, its RPC source, the provider seam, its breaker and the in-app store provider.
- `capability-grant-consumer.ts` – grant consumer and its RPC source.
- `reconciling-age.ts` – gauge probe and RPC port.
- `registry.ts`, `production.ts` – routing and production composition (called from `../production-async-entrypoint.ts`).

## Extension

Adding a consumer:

1. Add the family to `CONSUMER_EVENT_TYPE` and an envelope schema in `consumer-queue-events.ts`.
2. Write the consumer with `admitConsumerEvent`, a typed read port and `runWithDeadline`; return `retryAfterAttempt(attempts)` for retries.
3. Add its RPC names to `rpc-names.ts`, route it in `registry.ts` and compose it in `production.ts`.
4. Tag each proving test title with its `[P2-S09-AC-NNN]` criterion.

## Notification boundary (in-app only)

The architecture disables external transactional email, so the bound security-notification
boundary is the in-app notification store. `production.ts` defaults the notifier to
`withNotificationBreaker(createRpcInAppNotificationProvider(rpc))`
(`in-app-notification-provider.ts`), which records the typed intent through the protected
`in_app_notification_record` RPC: identifiers and the approved template code only, the
account-holder recipient resolved server-side from the immutable outbox request, idempotent by
notification id (a queue replay returns the original delivery attempt). A store failure retries on
the unchanged 15/60/300 second schedule. `createUnconfiguredNotificationProvider()` remains for a
deployment that must refuse delivery, and `ProductionEventConsumerOptions.notificationProvider`
replaces the default.

## Conventions

- Envelopes are identifier-only and validated by `admitConsumerEvent`.
- Retries follow `retryAfterAttempt`; an unrecordable dead letter retries.
- Tests sit next to their source and carry the `[P2-S09-AC-NNN]` criterion tag.

## Related links

- `../async-entrypoint.ts` (queue routing)
- `../authentication/` (MFA provider breaker and persistence)
