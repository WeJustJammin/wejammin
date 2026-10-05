# Real-database integration suites

## Contents

`*.dbspec.ts` suites that run production Worker modules against the disposable local
Supabase database (container `supabase_db_wejammin`, override with `S09_DB_CONTAINER`)
through `docker exec psql`. They are selected only by `vitest.db-integration.config.ts`
and never by the default `vitest run`.

| Suite                                         | Proves                                                                                                                                                                                                                    |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `phase-02-slice-09-event-consumers.dbspec.ts` | The production event-consumer composition (`createProductionEventConsumers`) over the real `platform_api` boundary: outbox relay claim, MFA reconciler, reconciling-age gauge, in-app security notifier and dead letters. |

## Running

1. `pnpm db:start` (once) and `pnpm db:reset`.
2. `pnpm test:db-integration`.
3. `pnpm db:reset` again: the suite commits users, factors, intents and dead letters that
   the pgTAP suites expect absent.

A missing container or an unmigrated database fails the suite loudly; nothing is skipped.

## Adding a suite

Name it `*.dbspec.ts`, call RPCs only as `service_role` through the shared `psql` helper
pattern in the existing suite, never insert a producer row by hand, and document the reset
requirement in the file header.
