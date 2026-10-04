# Infrastructure source

Versioned Cloudflare and Supabase policy plus bounded setup, verification, and recovery scripts live here. Infrastructure code consumes immutable artifacts and typed environment contracts; product behavior does not live in this directory.

## Contents

Scripts cover database type synchronization, local database verification
(including `run-pgtap-verbose.mjs`, the verbose-TAP pgTAP run behind
`pnpm db:test:tap` that the evidence collector requires),
staging health checks, production Cloudflare observability permission
verification, and OpenAPI generation from the contract registry.
Provider manifests and workflow policy remain in their respective top-level
configuration directories.

## Ownership

Infrastructure owns reproducible verification and deployment-support commands.
It does not own product behavior, application secrets, or unapproved provider
mutations.

## Extension

Add a focused script with explicit inputs, safe defaults, and a deterministic
exit status. Add its contract test under `tests/` and document any provider
action in the dedicated setup workflow before invoking it.

## Conventions

Use immutable artifact digests, typed environment inputs, HTTPS for remote
origins, and local-only database mutations during bootstrap. Keep scripts
bounded and shell commands reviewable.

## Related links

- [Local bootstrap](../docs/local-bootstrap.md)
- [Cross-surface tests](../tests/README.md)
- [Worker deployment boundary](../apps/worker/README.md)
