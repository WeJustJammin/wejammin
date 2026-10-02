# Propagation scan — CMS-03B-04 restore-chain identity

**Status:** scan only; awaiting owner choice for the chain identifier.
**Origin:** IA03 CMS-07 and BE03b CMS-03B-04 restore contract.
**Decision type:** registered migration-chain model with 03a/03b, SQL, route,
and Slice 10 test cascade. No restore success path is enabled by this scan.

## Unresolved chain identity

- `RevisionRestoreRequest.migrationChainId` is a required UUID. The route
  accepts it, and the contract requires a registered migration chain from the
  source revision's schema to the one active schema, but does not specify which
  record kind the UUID identifies.
- The current database has `cms_schema_migration_plans` for individual
  from/to edges, including their completion evidence, but no row identified
  by `migrationChainId` that binds an ordered path. The production editorial
  port map also omits CMS-03B-04, and no `cms_restore_revision` RPC exists.
  Treating a caller's arbitrary list of plan IDs or seam names as authority
  would violate the contract.
- A chain manifest alone does not execute conditional/breaking transforms.
  Restore must still refuse a missing registered row-transform executor or
  unproven non-fabricating translation; same-schema and additive paths cannot
  silently stand in for the full requirement.

## Affected targets

- BE03b's twelve-table private inventory and CMS-03B-04 persisted-model,
  idempotency, epoch-fencing, and migration-chain rules; BE03a plan lifecycle
  and immutable completion evidence; IA03 schema-migration/restore relationship.
- An immutable, owner-bound chain identity with exact source/target schema
  IDs, ordered plan IDs (at most 64), a content hash, approval/provenance,
  and a lifecycle that cannot be edited after use. Each edge must be a
  completed, matching 03a plan; the last target must be the current active
  schema at restore time. No caller-supplied step order may be trusted.
- Forward-only private SQL, forced RLS and closed grants, `cms_restore_revision`
  with transactional CAS/idempotency/audit/outbox, production adapter/route
  wiring, browser interaction, pgTAP and hosted role tests, generated types,
  OpenAPI/graph references, and Slice 10 progress.

## Proposed correction for confirmation

Make `migrationChainId` identify a private, immutable chain-manifest row rather
than a single 03a plan or a caller-computed UUID. Require server verification
of every ordered edge and its transform executor before translating old
revision values. Do not pre-create a chain or accept an empty/missing registry
as a successful restore. If the owner instead chooses an existing plan ID,
the locked contract must define how that ID uniquely and immutably identifies
the whole ordered chain before any success path is wired.

The apply shard must wait for owner confirmation, then use contract-first
RED→GREEN tests and a forward-only migration. The current route remains
fail-closed in the meantime.
