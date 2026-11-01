# Real-API support modules

## Contents

- `stack.ts`: reads the local API URL and JWT signing material at runtime (from
  `supabase status -o env`, falling back to the running PostgREST container's JWKS),
  mints test JWTs and calls `/rest/v1/rpc/<name>` through Kong; no secret lives in
  source.
- `cms-app.ts`: composes the production CMS Hono app on real `fetch`; only the
  session resolver and rate limiter are supplied by the suite.
- `cms-release.ts`: a real Ed25519 release-worker principal that signs CMS-03A-05
  and CMS-03A-08 requests.

- `claim-gate-manifest.ts`: the checked-in list of claim-gated `platform_api`
  functions (name, grant class, and the helper family that resolves the caller).
- `claim-gate-fixtures*.ts`: one VALID request per manifest entry, split by family
  (CMS actor, CMS editorial, CMS governed review, CMS composition (taxonomy,
  pattern, related content, locale variant, composition instances), admin and
  configuration, identity, profile, workers, service principal), plus the exact
  outcome a real caller gets once the gate has passed.
- `claim-gate-success.ts`: the entries where a real person (the CMS owner) gets a
  success through the same gate.
- `claim-gate-check.ts`: the drift check (exact manifest/catalog equality both ways
  and the gate against the EXECUTE grants) the claim-gate suites assert.
- `claim-gate-probes.ts`: the behaviour probes (exact outcomes for ghost, forged,
  ungranted, real and actorless service-principal callers); `claim-gate-check.ts`
  re-exports them so import sites are unchanged. Split to keep each module within
  the 300-line utility limit.
- `claim-gate-outcome.ts`: how a call is compared with its expected outcome
  (`<status>:<message>`); a fixture's optional `successKeys` also pins the member
  names of a successful body, so a gate-less stub answering `{}` cannot pass for an
  actorless operation whose only evidence is its own result shape.
- `claim-gate-mutants.ts`: the shared-gate mutations, with the entries that must
  fail for each.
- `claim-gate-restore.ts`: guaranteed restoration for the mutation suite. A
  journal snapshots a function (definition, owner, comment, EXECUTE grants)
  before it is mutated and restores and verifies it; a guard stops a body that is
  past its own deadline or whose test timed out (vitest does not cancel it) and,
  after every test, restores anything still mutated and compares a fingerprint of
  every function of the gate schemas with the baseline.
- `claim-gate-world.ts`: the committed fixtures the claim-gate suites share.
- `phase-02-slice-11-assert.ts`: the DB/stack FACADE for the Slice 11 strict
  assertions; it re-exports the pure assertion core and the effect helpers so
  existing consumers keep one import site. Importing it loads `stack.ts` (a real
  `supabase status`/docker probe), so pure controls import the cores directly.
- `phase-02-slice-11-assert-core.ts`: the PURE strict assertions (`expectSafeError`
  with exact closed details and the MIME boundary, `expectSafeEqual` over real
  deep equality, `sameInstant` at nanosecond resolution, the safe evidence-shape
  probes). No stack import.
- `phase-02-slice-11-snapshot-core.ts`: the PURE effect-snapshot decoder
  (`EFFECT_TABLES`, `decodeSnapshot`) with fixed safe rejections, plus the SQL-side
  per-table digest builder (`tableDigestSql`) shared by the global and scoped digests; no imports.
- `phase-02-slice-11-world-scope-core.ts`: PURE world scope for sweep suites
  (`claimsInWorld`, `expectWorldClaims`, `scopedSnapshotSql`): judge only the claims
  and rows reachable from the suite's own schedule ids. No stack import.
- `phase-02-slice-11-world-scope.ts`: DB-bearing `scopedSnapshotDigest(worldIds)`
  (the fourteen effect groups restricted to the world); re-exports the claim helpers.
  Rule and rationale: `tests/postgrest/README.md` "Shared database".
- `phase-02-slice-11-claimed-dry-run-fixture.ts`: public CMS draft/dry-run
  producers, actual BE00 claim receipts and original events; wraps resolver reads
  with both nonmutation observers. Contains runtime database/API calls.
- `phase-02-slice-11-claimed-dry-run-oracles.ts`: independent stored-row
  projections and complete accepted/refused/superseded-attempt assertions.
  Depends on the fixture; the fixture never imports this module.
- `phase-02-slice-11-claim-resolver-snapshot-core.ts`: PURE closed decoder for
  the additional thirteen whole-row table groups, with fixed safe diagnostics.
- `phase-02-slice-11-claim-resolver-snapshot.ts`: runtime-only SELECT adapter
  for those groups and same-length lease-token projection controls; importing
  the adapter does not discover credentials or execute database commands.
- `phase-02-slice-11-effect.ts`: the DB-bearing durable-effect snapshot builder
  (`snapshotDigest`, the SELECT-only idempotency projection, `expectUnchanged`)
  that hashes every row of every effect table SQL-side; re-exports the snapshot
  core. Calls `psql` at run time.
- `phase-02-slice-11-safe-diagnostics.ts`: PURE diagnostic privacy primitives --
  `deepEqual` (Node `isDeepStrictEqual`), the best-effort `stableSerialize` and
  `valueDigest` (diagnostic only), and the diagnostic-only code allowlist.
- `phase-02-slice-11-meta-controls.ts`: PURE safe meta-controls that run a control,
  inspect the real failure surfaces (message, stack, own enumerable AND
  non-enumerable data properties incl. `cause`/`actual`/`expected`, stringified
  operands) and report only `caught`/`leaked` booleans plus a digest.
- `phase-02-slice-11-log-capture.ts`: PURE cycle-safe inspection of `console.*`
  arguments (object/array markers) returning leak booleans and a digest.
- `phase-02-slice-11-schedule-support.ts`: DB-BEARING CMS-03B-07 request/row
  helpers (`utcScheduleBody`, `postSchedule`, `scheduleRow`, `SCHEDULES`); imports
  `./stack`, so pure controls must not import it.
- `phase-02-slice-11-fixture-time.ts`: PURE schedule fixture instants from the host
  tz data (`farFutureWholeSecond`, `nextFallBackFold`, `ordinaryZonedTime`,
  `isSuiteSafe`). Every schedule a suite leaves pending must resolve at least
  `SUITE_SAFE_LEAD_MS` (6 h) ahead and inside the 366-day horizon: the sweep suites
  assert the global claim holds only their own rows. Never use a fixed calendar
  date or a short `Date.now()` lead for a schedule that stays pending.
- `phase-02-slice-11-read-fixtures.ts`: shared refusal fixtures for the split
  Slice 11 read/command-refusal suites (submit body/request, frozen-manifest
  drift).

- `phase-02-slice-11-submit-support.ts` / `submit-policy-support.ts` /
  `decision-support.ts`: prepared05/06 command/context, frozen dependency/policy
  and immutable-guard rejection assertions; no new activation authority shortcut.
- `phase-02-slice-11-preview-support.ts` / `publish-support.ts`: prepared08/09/19
  strict resources, hash-only verifier, persistence and lineage/effect assertions.
- `phase-02-slice-11-sweep-support.ts`: transparent real claim/load/execute observer
  and named transport faults; forwards actual responses except named faults. Real
  clock/replay/stored-summary helpers are in `schedule-support.ts`; no fake lease.
- `phase-02-slice-11-read-support.ts` / `assignment-support.ts`: controlled queue
  membership/traversal, request identities and ordinary assignment effects. The
  explicitly privileged local cursor artifact signer is SELECT-only and retains
  Vault material server-side; no API EXECUTE privilege is added.

- `phase-02-slice-11-session.ts`: real local authenticated bind/register/read,
  opt-in production token/cookie/session capture, actual stored receipt/grant/
  assignment capability projection. Controlled local provider adapter is not
  hosted Auth/MFA proof; no stored MFA timestamp is invented.
- `phase-02-slice-11-schema-lifecycle.ts`: fresh public draft/successor, real
  worker transport, independent reviewer decision and server-derived activation
  operands; SQL reads evidence only. S11 type helper now uses this chain instead
  of fabricating activation rows. Initial7-case runtime is RED before dry-run
  processing; first-plan null-ID/parser mismatch is source-identified, exact
  early-exit diagnostics pending. No ordinary authority acceptance yet.
- `phase-02-slice-11-migration-diagnostics.ts`: closed,
  bounded RPC/status/result/plan-boolean observer; cloned responses only, original
  transport/operands unchanged. No IDs, tokens, raw bodies, lease data or content.
  Parent runtime confirms first-plan null IDs cause Worker dead-letter before
  any batch; independent source safety review passes. No authority acceptance.

- `phase-02-slice-12-composition-stack.ts`: the Slice 12 CMS-03C request chain (browser
  request -> first-party web proxy -> private binding -> the production template, latest-template
  and locale Hono routes -> production RPC adapters -> Kong -> PostgREST). Only the verified
  session (`as(...)`) and an always-allow rate limiter are supplied; `loseNextResponse` and
  `failNextRpc` inject the two transport faults; `createDesignerOwner` adds the
  `cms.template_designer` grant to an isolated CMS owner.
- `phase-02-slice-12-locale-world.ts`: an isolated owner with one active two-locale content type
  (`en-US` source, `fr-FR` chain `["en-US"]`, a localized `title` and an unlocalized `note`) and
  `seedLocaleEntry`, which creates an entry through the real editorial chain and reads back the
  source revision, its payload hash and the entry version CMS-03C-04 needs.

These additions are preparation, not acceptance proof. The inherited
frozen-review trigger bypass remains an execution/authority hold pending legal
successor replacement. New helpers do not legalize it.
Changed-table append counts and unchanged-table digests alone also do not prove
every historical row in a changed table remained untouched.

## Ownership

The database owner maintains these modules. They include shared strict and
digest-only assertions as well as fixtures/effect helpers; suites in the parent
directory own scenario-level acceptance. DB-bearing facades are not pure imports.

## Extension

Adding a claim-gated `platform_api` function means one manifest entry, one family,
one fixture (a request that passes every check before the identity gate) and, when
a real person can succeed without domain rows, a success control; the manifest suite
fails until all four exist. Add a module only when two or more suites need the same production composition. Build
it from production functions, never from a stand-in, and never set a GUC (claims
travel only inside a minted JWT).

The Slice 12 BE03c operations (governed review CMS-03C-06 .. 11, governed activation,
taxonomy, pattern, related-content, locale-variant and composition-instance routes) are
all `service-role` / `cfg-actor` entries: every wrapper is EXECUTE-granted to service_role
only and resolves its caller through `cms_actor`. Their fixtures live in
`claim-gate-fixtures-governed.ts` and `claim-gate-fixtures-composition.ts`; each states in
its header which pre-gate checks the request must satisfy and why the post-gate outcome is
what it is. The signed-cursor readers need the Vault key `claim-gate-world.ts` seeds.

An actorless internal operation (CMS-03B-20 execute, the dependency recheck run)
uses the `service-principal` family: it resolves no caller, so it is ineligible for
the caller-binding ghost/forged probes and has no shared caller helper to mutate.
Its boundary is the service_role EXECUTE grant plus the Worker module boundary
(DEC-156), proven by the manifest suite's ACL check, the mutation suite's ACL
mutant for every such entry, and `apps/worker/src/cms-editorial-principals.test.ts`.
An RPC that reads no claims (for example `cms_dependency_recheck_resolve_event`
and `cms_takedown_preview_tokens`) is NOT listed: the drift check fails a listed
function that no longer reads claims. Its exposure is enumerated by the Slice 09
API surface guard.

- `phase-02-slice-12-dec194-alt-environment.ts`, `phase-02-slice-12-dec194-alt-stack.ts`,
  `phase-02-slice-12-dec194-isolation-worker.ts`, `-lifecycle.ts`: support for the explicit
  local ALT-only suite `../phase-02-slice-12-dec194-isolation.alt-apispec.ts`. It is not
  collected by `vitest.postgrest.config.ts`; run it with `pnpm db:api-test:dec194-alt`
  (`vitest.postgrest-alt.config.ts`). Prerequisites and release variables are listed under
  "ALT-only suites" in `../README.md`.

## Conventions and related material

- Related: `tests/postgrest/README.md` (suites and how to run them),
  `supabase/tests/README.md` (pgTAP) and `apps/worker/src/content-schema-registry`
  (the production adapters composed here).
- `phase-02-b08-preparation-support.ts`: tracked boundary #128 helpers: delivers a queue
  message through the production async entrypoint over real `fetch` (recording the RPCs,
  never rewriting them), reads Job, report, plan, evidence and processed-event rows, polls
  the Job through the production status read and parser, builds a populated type with a
  successor draft, and starts CMS-03A-10 attempts. SQL reads evidence; the one write is the
  declared Job-lease expiry control `expireJobLease`.
