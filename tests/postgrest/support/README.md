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
  (CMS actor, CMS editorial, admin and configuration, identity, profile, workers,
  service principal), plus the exact outcome a real caller gets once the gate has
  passed.
- `claim-gate-success.ts`: the entries where a real person (the CMS owner) gets a
  success through the same gate.
- `claim-gate-check.ts`: the drift check (exact manifest/catalog equality both ways
  and the gate against the EXECUTE grants) the claim-gate suites assert.
- `claim-gate-probes.ts`: the behaviour probes (exact outcomes for ghost, forged,
  ungranted, real and actorless service-principal callers); `claim-gate-check.ts`
  re-exports them so import sites are unchanged. Split to keep each module within
  the 300-line utility limit.
- `claim-gate-mutants.ts`: the shared-gate mutations, with the entries that must
  fail for each.
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
  (`EFFECT_TABLES`, `decodeSnapshot`) with fixed safe rejections; no imports.
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
- `phase-02-slice-11-migration-diagnostics.ts` (scoped preparation): closed,
  bounded RPC/status/result/plan-boolean observer; cloned responses only, original
  transport/operands unchanged. No IDs, tokens, raw bodies, lease data or content.

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

An actorless internal operation (CMS-03B-20 execute) uses the `service-principal`
family: it resolves no caller, so it is ineligible for the caller-binding
ghost/forged probes and has no shared caller helper to mutate. Its boundary is the
service_role EXECUTE grant plus the Worker module boundary (DEC-156), proven by the
manifest suite's ACL check and `apps/worker/src/cms-editorial-principals.test.ts`.

## Conventions and related material

- Related: `tests/postgrest/README.md` (suites and how to run them),
  `supabase/tests/README.md` (pgTAP) and `apps/worker/src/content-schema-registry`
  (the production adapters composed here).
