# DEC-197 injected upgrade APIs — author freeze

Author: native `gpt-6.1-sol` / `ultra`, 2026-10-16.
Worktree: `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`.
Status: **UNRUN production source, not unit GREEN or real upgrade proof.**

## Authority and read boundary

Root released the exact nine original new paths in S12 Dispatch, then separately
claimed/released the focused catalog-security, catalog-constraints and
catalog-relations-contract splits: twelve new paths total.
Only released implementation/documentation paths were written. No test, locked
specification, WIP/promoted migration, existing fixture, package/CI configuration,
local adapter or protected primary-checkout file was edited.

Read the full root-owned
[ALT-reset brief](/home/rob/.codex/worktrees/phase2-slice12/WeJammin/docs/handoffs/2026-10-14-claude-s12/briefs/codex-dec197-upgrade-alt-reset.md),
the complete 176-line migration and byte-identical `080` copy, complete `070`
observer query, both `060`/`065` setup protocols, all ten main API test/support
files, and the locked DEC-197 and BE04a/04c receiving contracts. Migration,
Supabase/security, adversarial-review, minimal-development, contract-first and
verification guidance informed the source/authority and evidence boundaries.

Root's supplied initial receipt is **301 cases: one expected missing-module
availability failure, 300 skips, no collection error; scoped ESLint zero**.
That is an availability-only RED, not behavioral or PostgreSQL proof. These APIs
were authored after that release; this author ran no tests, imports, parser,
formatter, processes, network, database, reset, service control or Git command.
Source reads, literal comparisons and hashes used context-mode; edits used
`apply_patch`. A bounded inherited-model child authored only the released catalog
modules; this author read them independently before handoff.

## Implementation

The plan module exposes six pure APIs: `resolveMigrationSource`,
`buildUpgradePlan`, `buildPsqlInvocation`, `classifyMigrationOutcome`,
`compareRollback`, `assertCommittedReceivingCatalog`. The root runner exposes
`runReceivingUpgrade({ io, plan })`. Imports perform no external I/O.

- Optional source reads are injected. Missing means `undefined`, never a caught
  arbitrary read error. Both promoted and WIP sources must agree if present.
- Plans copy complete source, witness and prefix buffers; freeze structural
  metadata; reject copy/hash drift, missing/misordered/duplicate predecessor
  entries, duplicate versions, target/later entries, foreign paths/modes and
  unsafe run IDs. Prefix digest records are exact filename/tab/hash/LF bytes.
  Node cannot freeze nonempty Buffer contents: runner rehashes/rebinds before I/O
  boundaries to detect modification instead of claiming byte-level freezing.
- Target construction accepts only the complete explicit ALT descriptor and
  four exact ordered locks, including `/tmp/wejammin-reset.lock`. A bare database
  string grants no reset authority. First observed container/cluster/OID and
  database owner bind subsequent envelopes; there is no hardcoded observed ID.
- Invocation is the exact Docker/psql argument vector, including `-X`, verbose
  diagnostics, mode-specific `ON_ERROR_STOP`, the exact 336-byte read-only session
  SELECT followed by `-f -`, and copied whole-file stdin. No shell, quiet flag,
  outer transaction, SQL prefix/suffix or caller-supplied session metadata.
- Outcome classification parses the actual single JSON session marker independent
  of object-key order and validates PID/OID/identifier shape. Negative needs first
  direct-FK `23503`, at least one subsequent error and only `25P02` thereafter,
  zero exit status and terminal ROLLBACK. Positive needs zero/no SQL error/final
  COMMIT. Unknown/non-verbose errors, misleading detail, duplicate/missing marker,
  additional transaction boundaries and malformed metadata fail closed.
- Snapshot validation requires the versioned `070` document, fresh postgres
  observer, every catalog section, exact row-text arrays and receiving inventory.
  Rollback compares all snapshot data, including raw OIDs/ACLs and JSON row-text
  bigint/timestamp bytes; only observer PID is excluded from the snapshot digest.
  The prestate must genuinely lack receiving objects/FKs.
- Historical setup links both distinct labelled consumers to the committed real
  publication VERSION IDs/hashes in a separate observer, without manufacturing
  IDs or receiving parents. Positive requires empty consumers; any pre-existing
  publication-version images remain preserved, not deleted or assumed absent.
- Catalog expectations derive from actual SQL, not test imports or fixed unit
  OIDs: columns/defaults/identity/nullability; CHECK definitions; ordered keys and
  validated NO ACTION FKs; indexes and sequence; forced RLS/default-deny ACLs;
  exact invoker guard definition/configuration; implicit row/array types; and
  complete enabled, correctly linked RI triggers on new and existing relations.
  All old catalog/row images must survive exactly; unapproved additions refuse.
  PG17 table owner ACL includes MAINTAIN `m`; RI trigger functions are unqualified
  quoted names under `070`'s `pg_catalog` search path. No stale PG16 alternative
  or permissive normalization was retained to fit an incorrect fixture.
- Runner order is prepare → reset → committed setup → before → migration → after
  → restore ordinary baseline → write receipt. Preflight failure authorizes no
  reset/restoration. Every attempted validated reset, including an ambiguous
  thrown reset, requires restoration using the original attested authority.
  Setup/before/migration/after PIDs must be distinct; envelopes share one case
  epoch. Restoration requires a different epoch and independently verified
  ordinary baseline digest, not assumed equal to the predecessor prefix digest.
  Original failure identity survives simultaneous restoration failure. No passing
  receipt is written or returned after failed restoration or receipt write.

## Static observations and outstanding gates

Literal-only comparison confirms complete migration/`080` equality and exact guard
body equality (1,498 bytes), plus the session SELECT's exact brief equality (336
bytes). Module dependencies form an acyclic pure graph; only Node Buffer/crypto/
path utilities are imported outside these modules. No default filesystem/process
adapter, environment reader, CLI entry, reset command, package/CI wiring or
provider integration exists in this claim.

The real adapter must independently discover repository inventory/applied history,
verify the actual root-owned lease and pin immediately before side effects, run
and drain real sessions, validate committed TAP/setup visibility, attest fresh
reset epochs and restore the ordinary promoted baseline. Matching caller arrays,
unit DTOs or injected booleans do not establish these facts. There is no create/
drop-database operation or `databaseDropped` receipt.

Root owns normal formatting and line-limit checks, seven-API import availability,
all behavioral unit/lint/type tests, independent review, separately released local
adapter work, and actual locked ALT negative/positive/restoration evidence. No
Slice 11/12 completion, hosted acceptance, actual isolation or DDL claim is made.

### Source manifest

Static author bytes before root normalization; line counts count LF-terminated
lines, not a formatter result. Root reports the final read-only normal-format
preview fits all ten utility modules: target167, outcome105, snapshot269, plan229,
contract281, constraints243, security270, catalog148, relations-contract145,
runner178. The separately released relations-contract split moves exact table/
column/index records only. This preview is not import/behavior/DDL verification.
All twelve claimed paths are formally author-frozen. Hashes become historical
if root formats; root next owns normalization, unit/lint/parser and independent
review. No additional author adapter/runtime authority is granted.

All suffixes below except the runner are under `infra/database-upgrades/`.

| Path/suffix | Author lines | SHA-256 |
| --- | ---: | --- |
| `delivery-receiving-upgrade-target.mjs` | 120 | `c566072f8056be3b4b15142f7aaff2a9f986b74ee1484128f2aff6105d75a7ca` |
| `delivery-receiving-upgrade-outcome.mjs` | 69 | `cb81ce2f7a7672e4155a28d817d2c8f7ce78af413cd7898af180e13fb4fe5b38` |
| `delivery-receiving-upgrade-snapshot.mjs` | 138 | `d18046ac06cfae607ef93119b9818e19d69396b8c5679f16855bee1c22d1f43b` |
| `delivery-receiving-upgrade-plan.mjs` | 134 | `da28f0efcd05146cd47be3e1aaa085efc5fba22d2797a67f6fe62204f2615b48` |
| `delivery-receiving-upgrade-catalog-contract.mjs` | 122 | `7181f52c8c235c3c3201dd42af96cadab1a66b6d0420f9b899c3c7b61928e839` |
| `delivery-receiving-upgrade-catalog-constraints.mjs` | 113 | `9c58112539e4dc8da28da9f3ca084e12bdaebff5594463c92eda47e022fb9ec1` |
| `delivery-receiving-upgrade-catalog-security.mjs` | 115 | `06740f72c637a3ca23371d6bec2d6fcc1275da8dabd298f7eb795b54266c034b` |
| `delivery-receiving-upgrade-catalog.mjs` | 90 | `d513ae50c20c82407e79a7d7383f3de389095da4cc3217be03806cc22e3f8013` |
| `delivery-receiving-upgrade-catalog-relations-contract.mjs` | 52 | `c394fc921733406c170dd70927b8b6793c299bf9ea6e4ebad1291ba65486fdd6` |
| `README.md` | 66 | `ea9d42c03be5eb661105770497c079806206b402f36aa3d79b6a6922f8c8f661` |
| `infra/run-delivery-receiving-upgrade.mjs` | 126 | `c6e9e1a93cf93801cabc02a2ca0ce6bbbdfd871e95a41e41a0ef6bfa90229428` |

This report is not a passing verification receipt.

## Qualified catalog-neighbor correction — author UNRUN

Root separately claimed/released exactly `catalog.mjs`, `catalog-contract.mjs`,
`snapshot.mjs` and this report for reviewer P2. No source writes occurred while
root's original API run was active; root explicitly released writes after its
completion. Tests, strict catalog-security/constraints helpers, byte-bound plan,
runner, source SQL and `080` remain untouched by this correction.

Root reports the original five-module API suite now **301/301 PASS, zero skips**
after its lossless test-fixture comparison correction:
`/tmp/wejammin-native-receiving-proto-red-BkaHbW/upgrade-main-first-behavior.json`,
SHA-256 `29933786ae8914f5cceecced5da272de437d582d69729f2b7f1dae9d4c7726b7`.
Earlier whole-suite/40-second runner attempts were incomplete diagnostics, not
acceptance receipts. Their comparator cost did not justify weakening copied
production byte bindings. This author ran none of these tests.

The separate frozen neighbor suite gives the actual new RED: **13 cases, 4 PASS,
9 meaningful false-refusal FAIL, zero skips**,
`/tmp/wejammin-native-receiving-proto-red-BkaHbW/upgrade-neighbor-red.json`,
SHA-256 `e196aca95e01e27ff611f9d1fe76969ab66f0290e4e92320def053948b7ab5e7`.
It preserves legal unchanged public-schema same-name tables/enum/array/sequence/
routine, private unrelated constraints/triggers with receiving names, and the
private `publication_projection_cache` prefix neighbor. Changed neighboring ACLs
or trigger definitions must still refuse. These are unit catalog images, not
captured PostgreSQL or actual upgrade evidence.

Correction uses exact identities instead of reserving an entire prefix:

- Schema-object lookup requires `platform_private`, exact object name and the
  empty identity-argument signature for the receiving guard function.
- CHECK/key/FK identity combines its exact name with the OID of its expected
  schema-qualified owning relation. A same-name CHECK on another relation is
  historical data, not an already-installed receiver.
- Existing strict helpers receive an immutable-by-convention read-only view:
  receiving constraints selected by owner/name, receiving row/array types by
  schema/name, guard trigger by manifest relation/name, and RI triggers by the
  actual new FK constraint OIDs. This constructs new arrays/containers only;
  no input or historical row is mutated. Strict semantic/ACL/guard validation is
  unchanged. Full original poststate—not the view—still undergoes exact old-row
  preservation and unapproved-addition refusal, so filtering cannot conceal a
  changed neighbor or extra object.
- Snapshot absence checks use the exact source-derived table/index/type/sequence/
  guard identities and consumer-owned FK names, not a name-prefix expression.
  An unchanged private cache relation therefore survives both positive upgrade
  and exact rollback. Snapshot's new pure contract import adds no cycle: contract
  depends only on target/relations metadata, never on snapshot or catalog.

No author runtime/import/parser/test/formatter/DB/network/Git execution occurred.
Root owns normalization, the fresh 13-case GREEN, original 301 regression, scoped
lint/parser checks and independent review. No genuine upgrade/adapter/DDL or slice
completion claim follows from this correction.

Current correction-only static source manifest, before root normalization:

| Upgrade suffix | LF lines | SHA-256 |
| --- | ---: | --- |
| `catalog.mjs` | 166 | `ee177a2dad973d138a90909af757f98485d13311c0279bbec2fa26b32621d6d9` |
| `catalog-contract.mjs` | 286 | `bf2f0cc88f9115427e08ce9eee16d7bbcd518b5ce5a2e7ed2c199e803ba3ba96` |
| `snapshot.mjs` | 274 | `27adc1dc7d840aca9f864f6e4b772a65d31a6cfc65d7a9a1cdd613dccdd6f284` |

The original twelve-path hash table above is historical; these three hashes
supersede its corresponding rows, not any root verification receipt.
