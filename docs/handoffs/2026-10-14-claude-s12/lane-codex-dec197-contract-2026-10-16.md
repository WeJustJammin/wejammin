# DEC-197 private receiving contracts — author freeze, 2026-10-16

Status: contract-first setup authored and statically read back; **UNRUN**.
Author dispatch identity: native `gpt-6.1-sol` / `ultra`, as recorded in the
Slice 12 Dispatch Log claim `native_receiving_contract_20261016`. No proxy
execution route used. Root owns executable validation and independent review.

Active checkout: `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`.
Protected primary `/home/rob/Projects/WeJammin` received no author writes.
Exactly the seven claimed paths were edited: the five new `cms-delivery`
files, additive package-root export, and this new report. No tracking or
acceptance checkbox was changed. Existing unrelated work is preserved.

## Governing sources and choices

- Root brief: `docs/handoffs/2026-10-14-claude-s12/briefs/codex-dec197-receiving-contracts.md`, including its corrected native implementation plan.
- BE04a `04a-navigation-routes-discovery.md:470` and `:482`: sealed, globally
  numbered complete manifest, exactly six storage fields, activation nullability
  and ordering; compilation attempt outcomes remain separate.
- BE04c `04c-public-delivery-cache.md:345-346`: exact thirteen projection
  columns, seven storage states, varchar maxima, JSON root kinds, direct
  receiving references and same-publication relationship. Only single-record
  value rules are expressible in these Zod schemas.
- IA04 `04-cms-delivery-media.md:126`, `:156`, `:166` and its deep dive
  `:29`, `:56`: global manifest and derived ownership; neither row gains
  `owner_id` or generic additional timestamps.
- Existing `CmsVersionSchema`, `CmsUuidSchema` and `CmsHashSchema` are reused
  directly. Bigint ordinals/versions remain positive canonical decimal strings,
  up to signed bigint maximum, with no number coercion.
- Existing `parseInstant` is reused for timestamp validation and activation
  comparison by exact whole seconds/nanoseconds. No millisecond `Date`
  conversion or string ordering is used.
- Storage JSON uses typed custom validators backed by the cycle/non-JSON
  preflight guard, with explicit object/array root kinds. Only the `JsonValue`
  TypeScript type is reused from `api-error.ts`; its depth/key/item/byte
  validators are not imported.
  Shared acyclic objects and null-prototype objects remain valid. Varchar bounds
  count Unicode characters, with no new minimum, trimming or locale grammar.
- Inferred storage types describe mapped JSON-safe records, explicitly not
  assignability to generated Supabase raw `Row` types. The existing public
  `PublicationProjectionStateSchema` remains `pending/converged/degraded`.

## Authored artifacts

`packages/contracts/src/cms-delivery/storage.ts` exports strict
`RouteManifestVersionStorageSchema` and `PublicationProjectionStorageSchema`,
their inferred types, and separately named three/seven-state lifecycle schemas
and types. `cms-delivery/index.ts` exports that module; the root index receives
only `export * from './cms-delivery/index.ts';`. README documents mapping,
extension and proof limits.

Manifest keys: `id`, `version_no`, `publication_set_hash`, `state`,
`generated_at`, `activated_at` (required key, nullable value).

Projection keys: `id`, `publication_id`, `route_manifest_id`, `locale`,
`audience`, `render_payload`, `render_hash`, `discovery_hash`, `required_refs`,
`state`, `version`, `created_at`, `updated_at` (all required and non-null).

`manifest-storage.test.ts` contains proof families `DEC-197-M01` through `M15`:
exact six keys and inferred string/null types; each missing/undefined/null key;
owner/generic extra refusal; positive bigint edges and malformed/unsafe numeric
rejection; all three states and excluded attempt/candidate/summary states;
state-dependent activation nullability; offset-equivalent equality, one-nanosecond
forward/backward boundaries and cross-second/offset ordering; malformed instants,
UUID/hash errors and root-kind refusal.

`projection-storage.test.ts` contains proof families `DEC-197-P01` through `P19`:
exact thirteen keys and inferred JSON-safe types; each missing/undefined/null
key; extra-key refusal; all seven states versus the unchanged three-state public
summary; bigint/UUID/hash boundaries; empty/non-BCP47 and ASCII/astral varchar
edges; exact JSON root kinds, all JSON value kinds and non-JSON rejection;
cycles/getter/symbol/prototype handling; shared/null-prototype objects; payloads
past the API error depth, 128-key/item and 262144-byte caps; precise timestamps
without inventing an updated-after-created constraint; root-kind refusal.

These tests exercise schema values, not database behavior. Passing hex-64
validation would not establish the complete frozen set or its RFC8785 hash.
Neither lifecycle enum proves a permitted transition or write authorization.

## Static evidence and freeze hashes

SHA-256 was calculated from on-disk bytes using Node built-ins for static
inspection only. No tests, project scripts/runtime, lint, formatter, type-check,
build, database, git or network commands were run by this author.

| Claimed artifact | Lines | SHA-256 |
|---|---:|---|
| `packages/contracts/src/cms-delivery/storage.ts` | 146 | `a4906fe9a74f8b84ed5080d5c649fe447a81f60fce6b286ced855060e52cfbc7` |
| `packages/contracts/src/cms-delivery/index.ts` | 1 | `779e1f21c2e26c190795a42b7f3dd2acee7e69d80076fdfc9ea58e2736652ad1` |
| `packages/contracts/src/cms-delivery/README.md` | 49 | `9bc3d1fb69e6e5b48adb0fb47c00f1ddce94fb505fb44817325031ce0fc8345b` |
| `packages/contracts/src/cms-delivery/manifest-storage.test.ts` | 208 | `803e1b1f3cbf747358c5398d96b6868b6ba5ff2ed0665a9d523711eb2fe47d2c` |
| `packages/contracts/src/cms-delivery/projection-storage.test.ts` | 337 | `13195cbac9dc23e64bb07f269fc96576fb69cb45c52a416099bca8c52d4aadaa` |
| `packages/contracts/src/index.ts` | 31 | `8333fad2928c47ee8c400891807f3317d67692b6743c320743ca10a5c416a706` |

Governing source fingerprints at author freeze:

- BE04a: `8914f158ff26c5d01795d4c5e879f73a2744f867f520018a686509d1bedf2a62`.
- BE04c: `c031910979a773e08bd1a6c8ede20623692489f91c47331333ad2aa8b61b846d`.
- IA04: `438bcdafc8321cae279fa4ae81dc4a25de37a2463c9426824f2daaa4f82ef282`.
- IA04 deep dive: `d4d496d5150948b56d2b6767885bc668d764b317c7f868ac0b377118d7febd2c`.
- Applied consumer migration remains `e9bbd0f78fd8f6240fb4e3a543ad11e51081338abcf6cbba47679b5038bfc6ec`, matching the brief.

## Root continuation

1. Freeze these author bytes for focused contract tests, formatting/lint/type
   checks and a native independent read-only review. All executable results,
   type assertions and formatting status remain **UNRUN**, with no RED/GREEN or
   coverage claim here.
2. Reconcile any attributable failures against BE04a/BE04c without weakening
   contract assertions; record fresh root validation receipts and hashes.
3. Only after accepted contracts, proceed to the separately released SQL RED
   frontier and real receiving-table/FK/security/upgrade proofs. This setup
   implements no SQL migration, compiler/writer, activation pointer, public DTO,
   route, OpenAPI, browser/client validator or generated database type change.
   No S11 closure, S13 AC164, S15 acceptance or hosted proof is claimed.

No new owner decisions, reusable patterns or blockers were introduced: this
lane applies the already approved DEC-197 choices. Tracking and final validation
remain with root under the existing Dispatch Log claim.

## Native test-only continuation — own JSON member preservation

Status: **UNRUN**, frozen for root actual RED. Native `gpt-6.1-sol` / `ultra`
continues under the new two-path QA claim: only
`projection-storage.test.ts` and this existing report were edited in this pass.
All production and the existing manifest tests remained frozen.

Independent review reported P2 data loss at the installed Zod record/JSON seam:
valid own `__proto__` JSON members are silently dropped. BE04c `:345` requires
object/array JSON storage values and defines no reserved-key blacklist. This
test pass specifies positive round-trip preservation; no production fix or
global primitive change is authored here.

Three additional parameterized cases are appended after the existing cases:

- `DEC-197-P20`: own `__proto__` member at the `render_payload` root.
- `DEC-197-P21`: own `__proto__` member in a nested payload object.
- `DEC-197-P22`: own `__proto__` member nested inside a `required_refs` item.

Every case creates the special-key object with `JSON.parse`, proves the input
and parsed target have an own enumerable data property using `Object.hasOwn`
and its property descriptor, and compares the complete parsed record to its
input. Prototype checks allow ordinary or null prototypes, reject inheriting
the nested marker through a mutated prototype, and prove `Object.prototype`
has no injected marker before or after parsing. The fixtures do not use the
object-literal `__proto__` setter and do not reject valid JSON keys.

Static preservation check: removing only the appended P20–P22 block recovers
the exact root-formatted prior projection-test bytes, SHA-256
`80355485202ebdb9336ce35e557ecf9cef5866398e874732039c832c3685a3dd`.
The prior 157 combined structural cases are retained; three new cases are
authored, with no runtime case-count or failure claim in this pass.

Freeze fingerprints for this continuation (earlier table records historical
author bytes, before root formatting):

- Projection tests: 395 lines, SHA-256 `c6e4ca3ab000f6ef0ba2cde4fa67b8917b69fb7ce3700f2caceb1f214eefaca2`.
- Frozen storage: 148 lines, SHA-256 `29daf08f3cf50d7322f4bd5c60e66d768bba97757e811a7892755d493011500a`, unchanged across this pass.
- Frozen manifest tests: 228 lines, SHA-256 `300c36fd860871e5c055b8328e295160258ddf4b999b0cd8a4a5a7b90447883f`, unchanged across this pass.

No tests, runtime, formatter, lint, type-check, build, database, git or network
commands were run by this author. Root must observe the actual three-case RED
before releasing a bounded production correction, then rerun the preserved
suite and independent review. This pass makes no RED/GREEN, acceptance or
completion claim.

## Native production continuation — lossless private JSON validators

Status: correction authored and statically read back; **UNRUN**. Native
`gpt-6.1-sol` / `ultra` continues under the new GREEN claim for only
`storage.ts` and this report. Both test files are frozen and unchanged.

Root observed actual RED at
`/tmp/wejammin-native-receiving-proto-red-BkaHbW/red.json`, SHA-256
`981d36618a2285df4694e9ac541091278cbdb2ab5249454ab6dbfcdc30a92556`:
160 cases, 157 PASS, three meaningful own-JSON-data losses, zero setup failure.
Those results are root's reported pre-correction evidence, not an author run
or a post-correction GREEN claim.

The two private JSON field schemas now use typed `z.custom` predicates.
`render_payload` explicitly requires a non-null, non-array object;
`required_refs` explicitly requires an array. Both still call the unchanged
`isStorageJsonValue` preflight guard first. Validation retains the accepted JSON
value rather than reparsing through generic record/JSON schemas, preserving
own `__proto__` data properties and existing ordinary/null prototypes. It does
not copy members, assign `__proto__`, set prototypes or mutate JSON input.
Readonly inferred JSON field types remain the same.

Cycle/non-JSON rejection, varchar limits, bigint strings, exact instants,
strict row keys, nullability and lifecycle vocabularies are unchanged. No key
blacklist, global JSON primitive, public/client/OpenAPI or SQL edit is included.
This section supersedes the original generic JSON-wrapper implementation
description; the historical author-freeze fingerprints remain historical.

Static readback: replacing only the new validators and their explanatory
comment with the old wrappers recovers prior storage SHA-256
`29daf08f3cf50d7322f4bd5c60e66d768bba97757e811a7892755d493011500a`.
The JSON preflight guard and every other source byte are therefore unchanged.
Current storage: 150 lines, SHA-256
`6bf6b80ecc2feed1baac92cb4bfb43408d6fd0661665c9b61fa02864d9af20e8`.
Frozen projection tests remain
`c6e4ca3ab000f6ef0ba2cde4fa67b8917b69fb7ce3700f2caceb1f214eefaca2`;
frozen manifest tests remain
`300c36fd860871e5c055b8328e295160258ddf4b999b0cd8a4a5a7b90447883f`.

No runtime, tests, formatter, lint, type-check, build, database, git or network
commands were run by this author. Root next: focused 160-case GREEN, type/lint/
format checks and independent correction review before accepting this change.
No acceptance, SQL release or slice completion is claimed by this author.
