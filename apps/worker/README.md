# WeJammin API Worker

Run locally from the repository root:

```sh
pnpm dev:worker
```

Deploy only through an explicit environment command:

```sh
pnpm --filter @wejammin/worker deploy:staging
pnpm --filter @wejammin/worker deploy:production
```

Production deployment requires the protected GitHub `production` environment. Never use a generic deploy command because Wrangler environments map to separate Cloudflare services.

Generate Cloudflare binding types after changing `wrangler.jsonc`:

```sh
pnpm --filter @wejammin/worker cf-typegen
```

## Contents

`src/` contains the Hono composition root and transport handlers. `wrangler.jsonc`
contains non-secret deployment configuration; local secret examples remain in
`.dev.vars.example`.

## Local queue and cost boundary

Queue bindings and the one-minute outbox sweep are declared independently in
the production, `local`, and `staging` Wrangler environments because Queue
bindings are not inherited. Hosted staging uses `platform-jobs-staging` and
`platform-jobs-staging-dlq`; production reserves `platform-jobs` and
`platform-jobs-dlq`, preventing cross-environment delivery. `src/async-entrypoint.ts` is the injectable
transport seam: it validates producer envelopes, delegates queue messages to
application orchestration, acknowledges only successful work, and retries when
orchestration is missing, fails, or requests a retry. The scheduled handler
keeps platform retries enabled when the one-minute outbox sweep is unavailable
or incomplete. Each minute it also runs the CMS publication schedule sweep
(`src/cms-publication-schedule-sweep.ts`, CMS-03B-20): it claims at most 25 due
schedules, runs the Worker-resident accessibility checker for each, and executes
them with the claimed schedule version and lease; the retry ladder belongs to the
database. Its RPC port is importable only by that sweep, and the CMS-03B-19
preview-token verifier only by the future delivery adapter
(`src/cms-editorial-principals.test.ts` pins both).

Exercise the local queue without a provider call with:

```sh
pnpm --filter @wejammin/worker exec wrangler dev --env local
```

Cloudflare Workers Paid is the only approved hosted cost for this foundation;
the Worker uses Cloudflare-native Queues, cron triggers, and observability and
declares no third-party observability or provider credentials. Keep usage within
the approved $10 soft ceiling.

## Ownership

The Worker owns versioned API transport, middleware composition, queue
consumers, and scheduled entry points. Contracts, domain rules, persistence,
and provider adapters stay in their named packages.

## Extension

Add a route behind `/api/v1` only after its Zod contract and acceptance tests
exist. Keep handlers thin: validate input, build the request context, call an
application port, and map the result to the shared error envelope.

## Conventions

Use strict TypeScript, server-derived authorization, correlation IDs, and
sanitized structured logs. Never put secrets in `wrangler.jsonc`, browser
bundles, or committed source. Run the Worker type-check and root validation
before deployment.

## Related links

- [Local bootstrap](../../docs/local-bootstrap.md)
- [Worker composition](src/README.md)
- [Shared contracts](../../packages/contracts/README.md)
- [Infrastructure scripts](../../infra/README.md)
