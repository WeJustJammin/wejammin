# Web

The WeJammin public web surface uses Astro hybrid rendering with React islands.
Run workspace commands from the repository root:

```sh
pnpm dev:web
pnpm --filter @wejammin/web type-check
pnpm --filter @wejammin/web build
pnpm test:e2e
```

## Cloudflare deployment boundary

The web surface is promoted as a Cloudflare Worker SSR artifact. Astro emits
`dist/server/entry.mjs`, `dist/server/wrangler.json`, and `dist/client`. CI adds
generated `wrangler.staging.json` and `wrangler.production.json` configs beside
the entrypoint; each promotion selects its matching config so code, bindings,
and static assets always come from the same immutable CI artifact.

Server-rendered requests reach the API through the `PLATFORM_API` service
binding: `wejammin-api-staging` in staging and `wejammin-api` in production. The
API origin is never exposed to browser code. Astro sessions are disabled and
image handling uses passthrough mode, so deployment does not provision KV or
Cloudflare Images. This topology stays within the existing Workers Paid
authorization and introduces no additional paid service.

## Contents

Astro routes and layouts live under `src/`; static assets live under `public/`;
the Cloudflare adapter is configured in `astro.config.mjs`.
`client-chunk-boundaries.mjs` keeps shared browser contracts together so the
production bundle cannot split their Zod initialization into a circular chunk;
the Slice 12 production-built Chrome test verifies island hydration.

## Ownership

This surface owns public and authenticated web composition, SSR output, and
bounded browser islands. API transport, domain rules, and persistence belong to
the Worker and package boundaries.

## Extension

Add a focused route or component under `src/` and keep interactive behavior in
a bounded React island. Update the route's server contract before adding a
browser request or cache.

## Conventions

Prefer server-rendered semantic HTML, `@wejammin/ui` tokens, strict TypeScript,
and explicit loading/error states. Keep secrets and service-role credentials
out of browser code. Validate with the root commands before promotion.

## Related links

- [Local bootstrap](../../docs/local-bootstrap.md)
- [API Worker](../worker/README.md)
- [Shared contracts](../../packages/contracts/README.md)
- [Shared UI](../../packages/ui/README.md)
