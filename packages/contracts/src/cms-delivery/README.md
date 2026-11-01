# Private CMS delivery storage contracts

`storage.ts` defines JSON-safe mapped receiving records for
`platform_private.route_manifest_version` (BE04a) and
`platform_private.publication_projection` (BE04c). Their strict snake_case
objects contain exactly six and thirteen fields. These are private storage
contracts, not public response DTOs or generated Supabase raw `Row` types.
The package root exports them; browser/client validators and OpenAPI do not.

Bigint ordinals/versions reuse `CmsVersionSchema` and remain canonical positive
decimal strings through signed bigint maximum `9223372036854775807`. Mapping
must preserve database bigint values losslessly before parsing; coercing an
unsafe JavaScript number cannot recover the original ordinal. Timestamp strings
use the existing exact instant parser (seconds plus nanoseconds); manifest
activation must be null exactly while `ready`, otherwise at or after generation.
No timestamp is converted through millisecond `Date` arithmetic.

Manifest storage states are `ready`, `active`, `superseded`. Projection storage
states are `building`, `ready`, `blocked`, `failed_retryable`, `active`,
`superseded`, `revoked`. The existing public editorial aggregate
`PublicationProjectionStateSchema` remains `pending`, `converged`, `degraded`.

Projection `locale` and `audience` match varchar maxima of 16 and 48 Unicode
characters. The receiving registry supplies neither a minimum nor a BCP47
grammar. `render_payload` requires a JSON object; `required_refs` requires a JSON
array. Nested values allow JSON primitives, arrays and plain/null-prototype
objects, rejecting non-finite numbers, undefined, bigint, functions, symbols,
custom object prototypes and cycles. Error-detail depth/key/item/byte limits
are not storage constraints. Shared acyclic objects are valid.

The schemas check record shape and values only. They do not prove FK existence,
same-publication relationships, RLS/grants, global ordinal allocation, unique
keys/indexes, transition/immutability/write-once rules, deletion refusal or
single-active atomicity. Lowercase hex-64 validation does not prove a complete
frozen publication set or compute its RFC8785 SHA-256. SQL tests and future
guarded compiler/writer behavior own those proofs. `publication_id` references
the publication VERSION row, per DEC-167; ownership is derived, with no owner
column. No delivery writer or pointer activation is implemented here.

Extend this cluster only from the exact governing registry. Add neighboring
positive and negative tests for every new key, value bound and relationship
expressible within one record; preserve the separation from
[editorial public contracts](../cms-editorial/README.md). Database receiving
behavior and application exposure require their own reviewed implementation.

Sources: [BE04a registry](../../../../.memory/wiki/specs/be/04a-navigation-routes-discovery.md),
[BE04c registry](../../../../.memory/wiki/specs/be/04c-public-delivery-cache.md),
[IA04 typed models](../../../../.memory/wiki/specs/ia/04-cms-delivery-media.md),
[IA04 canonical fields](../../../../.memory/wiki/specs/ia/deep-dives/04-cms-delivery-media.md).

## Contents

- `storage.ts`: the strict private storage schemas for the route manifest version
  and publication projection records.
- `index.ts`: the barrel exported from the package root.
- `manifest-storage.test.ts` and `projection-storage.test.ts`: positive and
  negative tests for each record.

## Ownership

The CMS delivery contract owners (BE04a and BE04c) maintain this cluster. It
holds only record shape and value contracts; database behavior (keys, grants,
transitions, activation) belongs to SQL and its tests, and public response DTOs
belong to the editorial contracts.

## Extension

Follow the extension paragraph above: derive every new key and bound from the
governing registry, add neighboring positive and negative tests beside it in the
matching `*-storage.test.ts`, and export it through `index.ts`. Keep `storage.ts`
under the 300-line utility limit by moving a new record family to its own file.

## Conventions

Schemas are strict (unknown keys rejected), snake_case, JSON-safe, and parse
bigint values as canonical decimal strings. Use the shared exact-instant parser
for timestamps, never millisecond `Date` arithmetic. No `any`.

## Related links

- [Editorial public contracts](../cms-editorial/README.md)
- [Contracts package](../../README.md)
- The Sources list above (BE04a, BE04c, IA04)
