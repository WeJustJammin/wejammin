# AuthoringContextType.typeKey — approved contract evolution

Status: migration tests/source work in progress; database and hosted verification not run.

## Owner approval and classification

On 2026-10-20 the owner explicitly approved adding the server-derived `typeKey` to protected `AuthoringContextType`, coordinating BE/FE specifications, shared schema, SQL projection, consumers and tests through `/evolve-contract`. This is response data for CMS-03C-17 selection, not a new capability or caller-chosen authority. Entry-create and authoring-context request contracts remain unchanged.

The addition is **breaking for strict response parsers**: the old parser rejects the added member; the new required schema must reject an old payload without it. Do not describe this as harmless additive compatibility, make the field optional, weaken strict parsing or synthesize a key. This work is a coordinated evolution of the in-progress first-party Phase 2 implementation at `/api/v1`; it is not permission to deploy a mixed client/Worker/database release or to change a hosted contract. Before any deployment, all first-party consumers and the projection must be promoted together after the migration, canonical validation and hosted gates pass. Unknown external consumers or a required mixed-version rollout require an explicit versioned compatibility plan, not an unannounced in-place rollout.

## Source and consumer inventory

The exact-source `rg` scan for `AuthoringContextType`, `AuthoringContextResource`, `authoring-context`, or `authoring_context` found 81 files under apps, packages, supabase, tests and scripts (excluding JSON files). Matches include documentation, route registration and historical evidence, not 81 independent live consumers.

- Shared runtime contract: `packages/contracts/src/cms-editorial/authoring-context.ts`; schema exports/validators; OpenAPI generator/registries.
- Producer: private `cms_authoring_context_type(uuid)` in migration `20261005010800_cms_entry_authoring_context.sql`; existing author/editor-scoped wrapper and ACL remain unchanged. Source is the joined `cms_content_types.type_key`, never a caller member or display label.
- Worker: authoring-context routes and production safe-read adapters/session-RPC body path; strict schemas reject drift.
- Web: protected read proxy, entry-create/draft/conflict page loaders, create form capture/submission and schema-decoded field fixtures. Response-only `typeKey` must not enter the frozen initial-create prefill/body.
- Regression groups: shared authoring-context contracts; Worker route/production-safe-read tests; web protected read tests; create/draft/conflict loaders and route tests; PostgREST fixtures, pgTAP authoring visibility/bounds/artifact tests, and real-browser support.
- Generated artifacts must be regenerated through `contracts:generate`, not hand-edited. RPC identity/signature is unchanged; database type drift still requires the normal database-type gate, not a fabricated generated result.

## Migration and security plan

The installed CLI reported `2.116.0`. Its `migration new --help` was checked, then `supabase migration new cms_authoring_context_type_key` created `supabase/migrations/20261020203606_cms_authoring_context_type_key.sql`. No upgrade, stack command, connection or migration apply was run.

After RED tests, replace only the private projection's result with the same existing fields plus `'typeKey', type_row.type_key`. Preserve its SQL language, STABLE behavior, fixed empty search path, definer owner, compiled-artifact/owner/hash joins and existing eligibility wrappers. Revoke PUBLIC/anon/authenticated/service_role access to the private helper, retaining only its existing definer access. No new table, public wrapper, grant, audit/outbox effect, or request argument.

Rollback is a coordinated consumer/projection rollback: restore the prior response parser/consumers together with the prior helper body from migration `20261005010800`. Do not drop the helper or execute that historical migration wholesale. No user-data transformation or deletion is involved. The rollback procedure and pgTAP SQL remain unexecuted until the native/database prerequisites clear.

## Validation order

1. RED: real shared schema tests for required key/grammar, legacy/new strict-parser mismatch, owner/private-member refusal, unchanged request authority, and response-only capture.
2. Author pgTAP projection assertions, clearly UNRUN while the DB gate is held.
3. GREEN: schema, producer source, consumer/fixture updates and spec cascade; root independent review of exact changes.
4. Focused unit/contract tests, generated OpenAPI check, scoped format/lint/type checks.
5. Native prerequisite, then serialized `pnpm db:verify`, then `pnpm validate`; stop on the first canonical failure. Do not claim a database, browser, Slice 12 or phase pass from focused tests.

## Intermediate validation — source and focused tests only

- Root observed contract RED: 8 tests, 3 pass/5 fail, no pending; receipt `s12-typekey-contract-20261020-red.json`.
- Root reviewed the new migration body against its existing helper: removing only the added `'typeKey', type_row.type_key,` line makes the function bodies byte-equal. Fixed search path, joins, owner and final private-helper ACL are retained. The transaction-local schema-CREATE grant/revoke brackets the explicit owner assignment as in existing migration practice; no grant survives for a new caller.
- Focused schema, Worker authoring/admission and telemetry regression GREEN: 91/91, no pending. Receipt `.lane-logs/s12-typekey-contract-20261020-green.json`, SHA-256 `617b9771fb63498464051974b3c705d1e36dbd9253b2ab434e4fd500e96f9c03`.
- Expanded consumer discovery also searched `creatableTypes|selectedType`: 14 additional matches were classified as shared-fixture consumers, dynamic real-response reads, request DTOs or host-lane work. No historical receipt was rewritten.
- Before generation, root structurally compared the current generated document with the generator's output. Removing only the two projected `typeKey` properties and their required entries made the whole documents equal. Initial OpenAPI SHA-256: `cb2c6833b49a4a4e2e6a852e60a593bbb37fb3a2a2d66b7207d6e28db62c34ca`.
- `contracts:generate` and fresh `contracts:check` both exited 0. Host integration, database/pgTAP, canonical validation, browser/hosted and phase gates remain incomplete. These focused results do not authorize deployment.

## Documentation consulted

The Supabase skill required checking the [current changelog](https://supabase.com/changelog.md) and [database-function guidance](https://supabase.com/docs/guides/database/functions.md). The changelog flags a PostgreSQL minor-upgrade security advisory; this projection change neither changes installed PostgreSQL nor uses the affected operator/index/encryption features. Existing fixed search path and caller/ACL boundaries are retained; this is not a privilege-error workaround.
