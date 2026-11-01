# Native taxonomy transport component handoff

## Current CAS transport correction — supersedes earlier 140-test checkpoint

Root found private RPC JSON incorrectly quoted its successor operand. Corrected
production test first: JSON expects `7`, HTTP header still expects `"7"`, first
creation explicitly lacks `p_request.ifMatch`. Targeted RED: 1 successor failure,
1 first-version control pass, 14 cases filtered by `-t` (none marked skip).
Log `/tmp/wejammin-taxonomy-cas-red.7kOfos.log`, SHA-256
`aa23146681756928df1ce5afe8fff24e8043ad20ad571ff7d476918b39acb830`.

Exact source delta: factory line 145 sends `{ ifMatch: input.ifMatch }`; helper
line 84 alone quotes that decoded operand into the HTTP If-Match header. Parser
and incoming header matching are unchanged. This aligns with version validation
in `20260902080000_content_schema_registry_authority.sql:198-205` and neighboring
template RPC equality at `20261013100200_cms_define_template_per_owner.sql:110-112`.
No actual taxonomy SQL execution is claimed.

Before → after SHA-256 (factory, helper and production test respectively):

```text
1b038896c9525cffd427fef5cbd791b9008a567c32992eb8f75e736a12935c3d → 54c0a86953889df902f6925a84e48b1638e769a1fb9431ce1f98603739476f5b
0f990a020ab1ef5a995ec2007af6de3397553c0ab5abbd24d345df15e6e09f71 → 069867132723762053bc373e40cc76e4e5cab48218dc94b88ce59fe7b20fab2b
9659fef45160669e39abec998b96990192d9d43c6b667cbb0725e6bb2e7e9efe → d85522b49b7440ef2ef59240fddea76c9b5274d3fe4add83039d79bc486ff50b
```

In-memory exact inverse restored all three before-hashes. Inverse changes only
the two source lines, test title, JSON expected value and added first-version
absence assertion (including its mechanical wrapping). Test `expect` call count
increased 31→32; all 140 cases retained. No broader refactor.

First GREEN attempt passed targeted 2 and full 140, then stopped at Prettier's
single edited-test warning before lint/typecheck. Log
`/tmp/wejammin-taxonomy-cas-green.Mddknz.log`, SHA-256
`f034138fe5273bb45525b849e734c6520558696da6fe480f0b1433eaa3da661f`.
Root then released scoped mechanical formatting of that test only.

Final `/tmp/wejammin-taxonomy-cas-final.C7op15.log`, SHA-256
`f98c791997c489297ea16b73b4ae341b1f921cd21c0f5cb6af8a20c8eda44122`:
4 files/140 tests pass; scoped Prettier, ESLint, diff check and Worker tsc all 0.
Log includes exact commands, Node 22.23.1/pnpm 11.24.0 outputs, pinned PATH,
non-login Bash and shared quiet-lock receipt. Source/QA frozen for independent
review; no DB, canonical, public contract or acceptance changes.

## Current checkpoint — 2026-10-13, supersedes initial RED snapshot

CMS-03C-16 and `cmsTaxonomyVersionsRead` components and scoped QA are authored.
Source/QA frozen for fresh independent review; no independent clearance or whole
AC completion claimed. Shared Worker assembly belongs to the separate integration
lane. No public contract, registry, Web, database, canonical-provider, acceptance
checkbox or signature edits in this lane.

Owned production manifest, all under `apps/worker/src/`:

- `cms-composition/taxonomy-definition-shared.ts`
- `cms-composition/taxonomy-definition-routes.ts`
- `cms-composition/taxonomy-definition-write-route.ts`
- `cms-composition/taxonomy-definition-versions-route.ts`
- `cms-composition/taxonomy-definition-response.ts`
- `cms-composition-production-taxonomy-definition.ts`
- `cms-composition-production-taxonomy-definition-versions.ts`

Owned QA: `cms-composition/taxonomy-definition-admission.test.ts`,
`taxonomy-definition-write.test.ts`, `taxonomy-definition-versions.test.ts`,
`taxonomy-definition-production.test.ts`, `taxonomy-definition.test-support.ts`.
These paths are no longer proposals or unwritten placeholders.

Exports are `CmsTaxonomyDefinitionDependencies` from the shared module,
`registerCmsTaxonomyDefinitionRoutes<E extends Env>(app: Hono<E>, dependencies:
CmsTaxonomyDefinitionDependencies): void`, and
`createProductionCmsTaxonomyDefinitionDependencies(options:
CmsEditorialProductionOptions): CmsTaxonomyDefinitionDependencies`.
Port signatures remain those recorded below. Internal write `ifMatch` is unquoted
or null; only the RPC HTTP header quotes it. Both ports bind the original Request,
verified session, fixed operation and request ID; no caller authority forwarding.

### Private producer boundary and proof limits

The fixed named transports are `cms_create_taxonomy_version` and
`cms_list_taxonomy_versions`, with derived private `(p_request jsonb) -> jsonb`
wrappers. The root-approved read result is exactly
`{ taxonomyId: string, page: TaxonomyVersionsPage }`; the adapter validates the
requested taxonomyId witness and every row before unwrapping the unchanged public
page. Empty pages require the witness. Hidden or absent lineages must instead
producer-refuse concealed 404; an unproven bare empty page becomes 502.

Authority: public `taxonomy-version.ts:92-113` is strict `{items,pageVersion}` and
permits empty lists; BE03c:166 requires concealed 404; BE03c:1447 fixes RPC names
without a private return signature. The envelope is a private implementation
boundary, not a public schema/API change. Actual SQL read producer, provisioning,
PostgREST/RLS, atomic replay/CAS, persistent lineage, concurrency and hosted
acceptance remain UNRUN. Mock ports/fetch responses prove only Worker transport.
Browser/accessibility, real providers, DB verification and full validation remain
outside this bounded lane. No AC checkbox was changed.

### Review defect, RED and fix

Independent review blocked the historical 72-test GREEN: known caller tokens
incorrectly overrode upstream provider 5xx. New create/read cases produced 48
meaningful failures, 18 passes and 4 filtered tests before repair:
`/tmp/wejammin-taxonomy-provider-red.rHW3Oq.log`, SHA-256
`8675cabd1c24d53c86370eafd631a5ff4453262400fbde583c54da32970fb6d4`.

Owned `taxonomy-definition-response.ts:91-112` now preserves exact explicit
INTERNAL_ERROR 500 and recognized SQLSTATE 40001 CAS 409, then maps actual upstream
5xx to DEPENDENCY_UNAVAILABLE 503 before caller-token dispatch (BE03c:1304).
Local invalid-response 502 and local deadline 504 remain distinct. No shared
mapper was edited. Tests assert exact catalog messages/details and absence of
private owner, SQL prose and reason fields, plus no-store/CORS/request ID behavior.

Real provider-backed session-resolver tests, without a resolveSession override,
refresh the same Request and reject changed authUserId/sessionId/personId or
actingPartyId before RPC. Stale stepUpAt becomes private `stepUpVerified: false`
while both step-up-none operations succeed. New final-error controls use a
schema-valid 50-violation ApiError exceeding a tighter 1024-byte cap and verify a
bounded typed 502; impossible below-minimum registrar/factory budgets reject.

### Fresh focused receipt

Pinned Node `v22.23.1`, pnpm `11.24.0`; PATH prefix
`/home/rob/.local/share/wejammin-toolchain/bin`; non-login Bash and shared
`/tmp/wejammin-quiet.lock`. Worktree unchanged from initial receipt below.

```sh
pnpm exec vitest run apps/worker/src/cms-composition/taxonomy-definition-admission.test.ts apps/worker/src/cms-composition/taxonomy-definition-write.test.ts apps/worker/src/cms-composition/taxonomy-definition-versions.test.ts apps/worker/src/cms-composition/taxonomy-definition-production.test.ts --maxWorkers=1 --reporter=verbose
```

Exit 0: 4 files passed, 140 tests passed. Log
`/tmp/wejammin-taxonomy-reviewed-green.mQ3Ck2.log`, SHA-256
`b5e1678710a2541e7b9080bc50cd024d85db538b68bcef1142252bb360de1a38`.
Fresh scoped `prettier --check`, `eslint --max-warnings=0`, and Worker
`tsc --noEmit -p apps/worker/tsconfig.json --pretty false` all exit 0. All 12 owned
TS files are at most 278 lines. Independent re-review remains pending.

Existing matrices exercise first/successor definition ETags, declared unbuilt
domains, curator/party admission before quotas, 30/60 write and 60/60 read quotas,
15s/8s deadlines, strict requested-lineage projection and bounded errors.
Request, RPC payload, RPC response/error and final serialized response caps remain
256 KiB (never placement's 1 MiB); tighter options remain effective. Boundary
fixtures are schema-valid and measure actual serialized bytes, not just headers.
No test was skipped or weakened to obtain GREEN. Historical receipts below are
preserved as provenance, not current implementation status or acceptance.

## Historical initial RED planning snapshot — superseded

Scope: CMS-03C-16 and `cmsTaxonomyVersionsRead`; QA only. No production repair,
registration, contract, registry, database, Web, canonical-provider, acceptance
checkbox, or signature changes. No SQL producer or hosted acceptance claimed.

### Authored evidence at initial RED

- `apps/worker/src/cms-composition/taxonomy-definition-admission.test.ts`
- `apps/worker/src/cms-composition/taxonomy-definition.test-support.ts`
- This report.

The harness calls existing `createProductionWorkerAppRuntime` and
`createWorkerApp`; no future module or invented taxonomy port is imported.
Outbound injected and global fetch are guarded by a throwing mock. Fixtures pass
the current locked request schemas before requests are dispatched.

Four collected cases:

1. Existing template route reaches typed 401: positive harness control, passed.
2. Valid first taxonomy version (`expectedVersion: null`, no If-Match) must reach
   taxonomy 401: failed, actual generic 404. This is the intended behavioral RED.
3. Valid successor (`expectedVersion: "7"`, strong `If-Match: "7"`) must reach
   taxonomy 401: not executed after fail-fast.
4. Valid versions GET, no body/query/Idempotency-Key/If-Match, must reach taxonomy
   401: not executed after fail-fast.

The first fixture declares `instrument` overlap. Schema-valid admission does not
prove authenticated creation accepts an unbuilt provider: that gate remains
unwritten. Assertions after the failing status check (typed error, scrubbed
details, CORS, no-store, request ID, no ETag) have not executed for taxonomy.

### Initial focused receipt

Worktree: `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`.
Pinned PATH prefix: `/home/rob/.local/share/wejammin-toolchain/bin`.
Verified Node `v22.23.1`, pnpm `11.24.0`. Non-login Bash
(`bash --noprofile --norc -c`), shared `/tmp/wejammin-quiet.lock`.

```sh
pnpm exec vitest run apps/worker/src/cms-composition/taxonomy-definition-admission.test.ts --bail=1 --maxWorkers=1 --reporter=verbose
```

Exit 1; 1 file failed; 4 collected, 1 passed, 1 failed, 2 not executed by bail.
Failure: `expected 404 to be 401`; no missing-module, fixture-parse, or outbound
dependency failure. The focused behavioral run stopped here; no GREEN repair.

Log: `/tmp/wejammin-taxonomy-transport-red.7mwjDm.log`.
SHA-256: `2f34c19566298220e4ec2b4867649f170af7901b886b56037d5015987bc932a4`.

Prettier initially reported formatting in the two new TS files; scoped formatting
only was applied after RED. Final scoped `prettier --check` and
`eslint --max-warnings=0` passed. No behavioral rerun, project typecheck, coverage,
DB verification, or full validation was performed after the intentional RED.
No `.skip`, `.todo`, nonexistent-module import, or passing placeholder was added.

### Initially unwritten implementation gates

| Gate                  | Required future oracle                                                                                                                                                                                                                                                                                                                            |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Human/owner authority | Both routes require verified current human, confirmed acting party and `cms.taxonomy_curator`; both have step-up `none`, so `mfaFresh: false` must succeed with otherwise valid authority. Missing capability returns lowercase `capability_missing`; conceal absent/cross-owner targets. Recheck current authority, not a stale caller snapshot. |
| Admission order       | CMS origin and preflight, write cookie-bound CSRF, actual decoded JSON bytes, session, strict body/path/query, capability, user and party quotas, conditional headers. Unknown owner/context/RPC selectors must fail closed. Reads reject body, query keys, Idempotency-Key and If-Match; no read CSRF requirement.                               |
| First/successor write | JSON null and no If-Match for first; exact strong quoted parent for successor. Reject weak/wildcard/multiple/mismatched headers. Public ETag/version is definition version, never private lifecycle counter. 201 strict draft projection binds taxonomy key, shape, allowlists, declared domains and successor version.                           |
| Creation semantics    | Accept declared unbuilt canonical domains at create; only later governance/actions enforce provider availability. No activation, review, provider call or event falsely implied by definition creation.                                                                                                                                           |
| Idempotency/rates     | Required write key; distinguish exact replay from key/body conflict; user 30 and party 60 per minute on write, 60/60 on read. Assert actor/scope/rate class, refusal short-circuit, reset and Retry-After; mock replay is not database uniqueness/atomicity proof.                                                                                |
| Versions projection   | At most 50, unique strictly descending taxonomyVersion. Bind every row, including singleton, to requested taxonomyId. Reject cross-lineage/malformed/private fields; strong ETag comes from pageVersion, including empty page.                                                                                                                    |
| Budgets/deadlines     | Requests, success and errors capped at 262144 bytes; actual streamed bytes as well as declared length, exact cap and cap+1, tighter options, abort/deadline propagation. Write 15000ms, read 8000ms. Placement's 1MiB exception never applies.                                                                                                    |
| Typed refusal         | Exhaust operation/status/reason allowlist, taxonomy-family messages, 401 recovery, safe details, Retry-After, request/correlation IDs, no raw SQL/provider/owner data in HTTP or logs. Mutation-sensitive invalid-response tests, not source-name assertions.                                                                                     |
| Production binding    | Only named RPCs below; server-only credentials/profiles, exact operation and request IDs, request-bound verified owner context, no caller header forwarding or body context override. Missing/wrong/expired context refuses before fetch; response schema and request binding independently enforced.                                             |

Reserved but not authored: `taxonomy-definition-write.test.ts`,
`taxonomy-definition-versions.test.ts`, `taxonomy-definition-production.test.ts`.
These are not empty passing files: authenticated handler and adapter matrices
await real claimed ports. This checkpoint does not clear any whole AC.

### Initial future exclusive implementation manifest — historical proposal

All under `apps/worker/src/`; obtain fresh claims before creating any:

- `cms-composition/taxonomy-definition-shared.ts`: private operation/input,
  dependency/result, quota and telemetry types.
- `cms-composition/taxonomy-definition-routes.ts`: public registrar only.
- `cms-composition/taxonomy-definition-write-route.ts`: CMS-03C-16 admission.
- `cms-composition/taxonomy-definition-versions-route.ts`: versions admission.
- `cms-composition/taxonomy-definition-response.ts`: safe taxonomy projection and
  typed refusal/header helpers.
- `cms-composition-production-taxonomy-definition.ts`: normalized server
  dependencies, context/session/rate composition and write RPC adapter.
- `cms-composition-production-taxonomy-definition-versions.ts`: bounded read RPC
  adapter; split keeps every owned file below 300 lines.

Proposed private signatures, using existing public contract types:

```ts
registerCmsTaxonomyDefinitionRoutes<E extends Env>(
  app: Hono<E>, dependencies: CmsTaxonomyDefinitionDependencies,
): void;
createProductionCmsTaxonomyDefinitionDependencies(
  options: CmsEditorialProductionOptions,
): CmsTaxonomyDefinitionDependencies;
createVersion(
  input: CmsTaxonomyDefinitionWriteInput, signal: AbortSignal,
): Promise<CmsTaxonomyDefinitionResult<TaxonomyVersionResource>>;
readVersions(
  input: CmsTaxonomyDefinitionVersionsInput, signal: AbortSignal,
): Promise<CmsTaxonomyDefinitionResult<TaxonomyVersionsPage>>;
```

Both inputs carry literal operationId, original Request, requestId and verified
CmsEditorialSession. Write adds TaxonomyVersionRequest body, idempotencyKey and
`ifMatch: string | null`; read adds only taxonomyId. Dependency shape also needs
resolveSession, rateLimit, humanOrigins, now and telemetry, using existing seams.

Named RPCs are normative: `cms_create_taxonomy_version` and
`cms_list_taxonomy_versions`. Private `(p_request jsonb) -> jsonb` wrappers follow
the separately agreed SQL plan. POST to `/rest/v1/rpc/<fixed name>`, platform_api
profile; write p_request carries validated body, key, conditional strong If-Match,
server context and correlationId; read carries taxonomyId and server context.
These are adapter plans, not evidence that either SQL function exists or works.

Root must separately claim integration edits in WorkerDependencies/runtime/route
composition. Those shared files, existing template/placement files and public
contracts are outside this lane. Real PostgREST/SQL/RLS atomicity and replay
evidence, independent native review, then complete validation remain separate
gates; no DB/network execution was performed here.

### Normative and existing-source anchors at initial RED

- `packages/contracts/src/cms-composition/taxonomy-version.ts:19-24,47-115`:
  first/successor transport, unbuilt-domain rule, projections, versions ordering.
- `packages/contracts/src/cms-composition/conditional-if-match.ts`: exact
  null/no-header versus successor strong-header coupling.
- `packages/contracts/src/platform-registries.ts:142-164,2174-2189,2207-2218`:
  policies, capabilities, step-up none, quotas, 15s/8s deadlines.
- `.memory/wiki/specs/be/03c-composition-taxonomy-localization.md:166,178,401-402,1295-1304,1447`:
  routes, unbuilt domains, typed taxonomy refusal family and fixed RPC names.
- `apps/worker/src/cms-editorial-production-types.ts:65`:
  ordinary 256KiB response ceiling; not placement override.
- `apps/worker/src/cms-composition/template-version-routes.ts:63-180` and
  `cms-composition-production-detail.ts:29-88`: existing admission/transport seams
  to reuse read-only, not taxonomy behavior proof.
- `apps/worker/src/production-worker-runtime.ts:123-132`:
  existing production-composition harness entrypoint.
