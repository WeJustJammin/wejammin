# Native pattern-definition transport — RED and component handoff

Latest release: residual review remedies implemented; **191 focused tests pass**,
including both full-app probes after root-owned integration. ESLint and Worker
types pass. Independent re-review and acceptance remain open; final section has receipts.
Earlier receipts below are historical, preserved without rewriting their evidence.

Date: 2026-10-13. Lane: `native_s12_placement_ceiling` (new QA-only claim).
Model: `gpt-6-astra`; effort: `ultra`.
Worktree: `/home/rob/.codex/worktrees/phase2-slice12/WeJammin` only.

## Historical first-RED result and stop boundary

Two contract-valid anonymous requests through the existing production runtime and
`createWorkerApp` returned **404 instead of the required 401**. This is the first
missing-route behavioral RED, not an import-resolution or setup failure.
Runtime testing stopped here. No GREEN repair, production registration, RPC,
database, network, canonical validation, Web, contract or tracking work was done.
No acceptance checkbox or depth signature is closed by this receipt.

Executed: one suite, two failed assertions, nine tests excluded by the explicit
name filter. The nine exclusions are runner selection, not source `.skip`/`.todo`.
The other three test suites were authored but were not executed. Their downstream
assertions remain unverified; they are not additional observed REDs or coverage.

The failing tests are `pattern-definition-admission.test.ts:17` and `:30`.
Each validates its input with the locked request schema before sending it.
The observed failure is at `expectError`'s status assertion in
`pattern-definition.test-support.ts:217`; neither test reached its later error
envelope, session-call or no-fetch assertions.

Current-source explanation: `worker-types.ts:74` exposes no pattern-definition
dependency; `worker-route-composition.ts:208` registers existing composition
routes but neither new operation. Its `:146` fallback returns generic 404
`NOT_FOUND`. `production-worker-runtime-cms.ts:239` likewise constructs no
pattern-definition adapter. This is source evidence, not an inferred SQL result.

## Governing contracts and source-qualified plan

All source paths below are worktree-relative. `BE03c` means
`.memory/wiki/specs/be/03c-composition-taxonomy-localization.md`.

| Boundary          | Locked source and oracle                                                                                                                                                                                                                               |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Create            | BE03c:174; `packages/contracts/src/platform-registries.ts:2080`: POST `/api/v1/cms/patterns/versions`, CMS-03C-12, 201 draft, designer capability, no step-up, 30/user + 60/party per minute, 15-second deadline.                                      |
| Latest            | BE03c:165; registry:2099: GET `/api/v1/cms/patterns/{patternKey}`, cmsPatternLatestRead, 200 detail, caller-owner scope, 60/user + 60/party per minute, 15 seconds, no body/query/idempotency/If-Match/CSRF mutation.                                  |
| Conditional write | `packages/contracts/src/cms-composition/pattern-version.ts:37` and `conditional-if-match.ts:24`: first `expectedVersion: null` forbids If-Match; successor requires the exact strong quoted parent.                                                    |
| Projection        | `pattern-version.ts:62`, `:74`, `:80`; definition-state.ts; BE03c:29: latest accepts every closed lifecycle state, binds the path key, and uses immutable definition `version`/`patternVersion` for its ETag; internal lifecycle counter is forbidden. |
| Catalog           | `packages/contracts/src/cms-composition/error-catalog.ts:57`, `:103`, `:107`, `:136`: composition codes and scrubbed fixed messages. `refusals.ts:24`, `:35`, `:70`, `:178`, `:193`: closed status/reason ownership.                                   |
| Budgets           | BE03c:1487: these operations' requests, decoded successes and errors remain 262,144 bytes. The placement-only 1 MiB allowance does not apply. Preserve any tighter option.                                                                             |
| RPC names         | BE03c:1447: `cms_create_pattern_version` and `cms_pattern_latest`. Existing template adapter `cms-composition-production.ts:177` and detail reader establish the neighboring server-context transport style.                                           |

Private/public `(p_request jsonb) -> jsonb` wrappers and the exact proposed wire
members follow the parent-approved SQL/transport plan and neighboring template
adapter; they are proposed implementation signatures, not evidence of available
RPCs. The original native planning brief had no persisted artifact; this report
persists the source-qualified transport plan without inventing public contracts.

## Authored test manifest

All five files live in `apps/worker/src/cms-composition/` and import only existing
interfaces. The support file uses `createProductionWorkerAppRuntime` with an
existing session seam, quota seam and controlled fetch; the real Worker handles
HTTP admission. It does not fabricate a pattern-definition dependency/port.

| File / lines                                  | Authored behavioral cases; status                                                                                                                                                                                                      |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pattern-definition-admission.test.ts` / 132  | Valid anonymous create/latest **observed RED**. Foreign origin, cookie-write CSRF, media, declared/streamed 256 KiB + 1 request, designer capability: authored, not executed.                                                          |
| `pattern-definition-write.test.ts` / 156      | First/null and exact-parent successor; no step-up; weak/missing/mismatched/multiple If-Match; caller authority/private members; malformed JSON; exact 256 KiB request; draft/key/version/parent/digest bindings: unrun.                |
| `pattern-definition-latest.test.ts` / 98      | Every contract lifecycle state, definition ETag, path/query/header rejection, cookie read without write CSRF, key/version binding, forbidden private fields and scrubbed hidden/absent 404: unrun.                                     |
| `pattern-definition-production.test.ts` / 257 | Named RPC and server-derived identity; 30/60 vs 60/60 quotas; default decoded success and error byte boundaries; tighter success cap; user/party quota refusal; 15-second session timeout; nine typed creation refusal reasons: unrun. |
| `pattern-definition.test-support.ts` / 250    | Strict valid fixtures, request constructors, composition envelope oracle, byte-exact synthetic responses and existing-runtime harness. No network or SQL implementation.                                                               |

Synthetic padded JSON is a decoder-budget fixture, not a real maximum producer.
The oversized error control cannot supply its `CONFLICT` token after rejection;
the test expects the existing raw-400 fallback rather than a conflict. This is
an explicit neighboring-transport convention, not a new public error code.
The write strict-body cases reject caller actor/party/capability/context authority;
the RPC oracle also prevents caller authority headers from replacing server context.

Still needed after implementation release: execute and independently review the
whole authored matrix; test malformed/throwing session and quota envelopes,
missing/invalid idempotency, structural block-tree bounds, provider/body-read
timeouts, all catalog statuses, error content type/malformed body, configured
upper-cap handling and tighter error caps, outgoing serialized-body ceiling, and
successor RPC If-Match/idempotency/correlation exact wire controls. No universal
matrix completeness or downstream acceptance is claimed from this first RED.

## Execution receipts

Logs: `/tmp/wejammin-s12-native-pattern-red-OsAu96/`.
All commands used non-login Bash and
`PATH=/home/rob/.local/share/wejammin-toolchain/bin:$PATH`.
Version receipt: Node `22.23.1`, pnpm `11.24.0`; Vitest reported `4.1.11`.

```sh
flock -s /tmp/wejammin-quiet.lock pnpm exec vitest run apps/worker/src/cms-composition/pattern-definition-admission.test.ts -t "mounts CMS-03C-12|mounts cmsPatternLatestRead"
```

Exit 1: two expected 401/actual 404 assertion failures; 1 suite / 11 collected /
2 selected / 9 name-filtered. Log `first-route-red.log` SHA-256:
`df293451d48a872da49d35c2297956c584070faee6b592bed18651699d1e541e`.

Static commands target exactly the five manifest TypeScript files (full command
arguments are recorded in the logs): shared quiet lock + `pnpm exec prettier
--write`, `pnpm exec eslint`, and `pnpm exec tsc --noEmit -p
apps/worker/tsconfig.json`. Initial ESLint found two unused mock parameters;
the sole correction replaced them with a typed `vi.fn` signature, preserving its
runtime body and every assertion. Final ESLint and Worker type-check exit 0.
No runtime rerun followed that type-only helper correction, honoring the stop.
Scoped Prettier and `git diff --check` passed; a separate source scan covers
untracked files, confirms no trailing whitespace or test bypass directives, and
checks the ≤300-line limit. The final receipt is `final-verification.log`.

| Log                               | SHA-256                                                            |
| --------------------------------- | ------------------------------------------------------------------ |
| `versions.log`                    | `cf9fb41b8896a206f36b0ae5972eb867e5ce18dcf91f93605f5ff2a786014ae2` |
| `eslint.log` (initial diagnostic) | `bc630dcfa4af9926e6d17889934a2430b69ef32a25655ef970d5468b417b5349` |
| `typecheck.log`                   | `498b9702a6e33982d41b92fc8e35363664c3ed70eb0b9f581a2d5d9d96365272` |
| `final-static.log`                | `e56d461af11ea28c186af9b1e1d3fddb3ed427405e3a5fa9b6636b6cb8205999` |

## Ownership, preservation and next claim

Dispatch Log: `.memory/pipeline/progress/slices/phase-02-slice-12.md:808`;
`CODEX-LANES.md:27`, `:73` records all six new paths absent before dispatch.
Only those six files were authored. All old placement files, existing tests,
shared runtime/registration, contracts, migrations, lockfiles, index and primary
checkout were untouched by this task. `source-baseline.sha256` records five
existing runtime/registration source hashes captured before the RED; readback
after static checks matched all five. This is scoped provenance, not a claim to
have snapshotted every concurrently dirty file.

Candidate **future, unclaimed** implementation files/signatures:

- `apps/worker/src/cms-composition/pattern-definition-routes.ts`:
  `registerCmsPatternDefinitionRoutes<E extends Env>(app: Hono<E>, dependencies: CmsPatternDefinitionDependencies): void`.
- `apps/worker/src/cms-composition/pattern-definition-latest-routes.ts`:
  `registerCmsPatternDefinitionLatestRoutes<E extends Env>(app: Hono<E>, dependencies: CmsPatternDefinitionDependencies): void`.
- `apps/worker/src/cms-composition/pattern-definition-ports.ts` if splitting is needed:
  typed `definePattern(input, signal)` and `readLatest(input, signal)` results;
  shared request/requestId/server-session context; create body/idempotencyKey and
  unquoted validated `ifMatch: string | null`; latest `patternKey`; no caller authority.
- `apps/worker/src/cms-composition-production-pattern-definition.ts`:
  `createProductionCmsPatternDefinitionDependencies(options: CmsEditorialProductionOptions): CmsPatternDefinitionDependencies`.

Root-only integration candidates: `worker-types.ts`, `worker-route-composition.ts`,
`production-worker-runtime-cms.ts`, `production-worker-runtime.ts` and any existing
runtime dependency assembly required by those types. None is released to this lane.
Choose narrow owned helpers to keep each authored implementation file ≤300 lines.

Independent review should check exact conditional-null semantics, immutable
definition ETags, strict latest projection, fixed catalog/reason ownership, quota
order and both byte-reader paths. Real SQL ownership/graph/CAS/idempotency,
revocation, races, atomic no-partial-effects and actual producer maximums remain
separate unproven boundaries. Full canonical validation and all acceptance remain open.

## Historical component-authoring release addendum

Root subsequently released the six proposed source files plus existing QA files.
No shared source, contract, database, Web, configuration or primary-checkout edit
was performed by this lane. No subagent was started. Native model/effort unchanged.
Contract-first/TDD skills kept the public contracts fixed and required the full
behavioral RED run before component authoring; debugging-by-test identified two
additional real projection/mapping defects before their fixes.

### Current implementation and integration manifest

| Source (under `apps/worker/src/`)                         | Export / responsibility                                                                                                                                                                     | Lines |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| `cms-composition/pattern-definition-routes.ts`            | `registerCmsPatternDefinitionRoutes<E extends Env>(app: Hono<E>, dependencies: CmsPatternDefinitionDependencies): void`; POST/OPTIONS, strict admission, conditional parent, draft binding. | 148   |
| `cms-composition/pattern-definition-latest-routes.ts`     | `registerCmsPatternLatestRoutes` with the same signature; GET/OPTIONS, owner-key addressing and strict latest projection.                                                                   | 134   |
| `cms-composition/pattern-definition-ports.ts`             | `CmsPatternDefinitionDependencies`, `PatternWriteInput`, `PatternLatestInput`; immutable-version guards, session validation and quotas.                                                     | 188   |
| `cms-composition/pattern-definition-response.ts`          | Closed error projection, fixed reserved-key pointer, strong definition ETag, final serialized ceiling, route deadline/caller abort.                                                         | 264   |
| `cms-composition-production-pattern-definition.ts`        | `createProductionCmsPatternDefinitionDependencies(options: CmsEditorialProductionOptions): CmsPatternDefinitionDependencies`.                                                               | 120   |
| `cms-composition-production-pattern-definition-latest.ts` | Named no-retry JSONB RPC transport, server context, bounded payload/read, typed mapping, deadline/body cleanup and latest reader.                                                           | 186   |

Write port: `definePattern(input, signal)` receives literal `operationId:
'CMS-03C-12'`, original `request: Request`, `requestId`, verified `session`, parsed
`body`, `idempotencyKey` and internal **unquoted** `ifMatch: string | null`.
Latest port: `readLatest(input, signal)` receives literal
`operationId: 'cmsPatternLatestRead'`, the same request/session context and
`patternKey`. Only the outbound HTTP If-Match header is quoted; the JSONB operand
is bare. Public RPC names remain exactly `cms_create_pattern_version` and
`cms_pattern_latest`. SQL creation, permissions and ownership checks are not proven.

Root integration must add the dependency to Worker assembly/registration and
construct the production factory. Register the static write route before the
dynamic latest route. Extend the read-only shared
`cms-editorial-production-types.ts` `CmsEditorialRateLimitInput.operationId`
union with `CMS-03C-12` and `cmsPatternLatestRead`; the factory deliberately does
not cast around that missing shared type. No unsafe widening or alternate limiter
was introduced to conceal this required root integration.

### Current tests and real RED → GREEN evidence

Before behavior implementation: four existing-app suites, **92 failed**;
all failures were assertions at the missing-route/envelope boundary, no missing
imports or fixture setup errors. Then the harness gained an explicit split:
the original two `mounts ...` probes still use the complete production runtime
and `createWorkerApp`; other tests mount the **real owned registrars and factory**
on isolated Hono. This is component evidence, not global registration evidence.
The harness does not mock route handlers or implement a replacement HTTP policy.

Added adversarial cases cover acting-party/session/quota failures, missing/invalid
idempotency, exact RPC successor binding, outbound JSONB overhead above 256 KiB,
exact/+1 final serialization using a schema-valid synthetic fractional timestamp,
larger-option clamp, tighter error cap, canceled early-refusal response bodies,
stalled provider headers/body and no retry. Lifecycle-state/latest-key and private
field tests remain. These are synthetic transport fixtures, not actual producer maxima.

Two additional behavioral defect cycles were captured and repaired:

- Five reserved-key cases initially lacked the normative fixed `/patternKey`
  violation (four schema refusals and one typed SQL refusal). BE03c:217 supplied
  the oracle; the response projector now emits the same scrubbed fixed pointer.
- Three provider HTTP 502/503/504 faults initially became 403 when the body named
  `capability_missing`. Transport mapping now preserves dependency faults instead
  of allowing that token to reclassify them as caller refusals.

Final unfiltered run: **4 suites, 122 tests, 120 passed / 2 failed, zero skipped**.
The only failures are still 404 versus expected 401 in the original full-app
probes. All component tests, including both new defect controls, pass. Current
QA line counts: admission 215, write 293, latest 195, production 257, support 274.

### Current receipts and limitations

New log directory: `/tmp/wejammin-s12-pattern-component-EKu4R0/`.
Commands use the same pinned versions, non-login Bash and shared quiet lock.
Every log contains its complete command. `focused-final.log` runs all four
pattern-definition test files, **without a name filter**. ESLint on all eleven
owned TypeScript files exits 0. Worker type-check exits 2: the pattern factory
has the expected shared-operation-union incompatibility; concurrent taxonomy
factory diagnostics are also present. Type-check is not claimed green.

| Receipt                                           | SHA-256                                                            |
| ------------------------------------------------- | ------------------------------------------------------------------ |
| `matrix-red.log` / 92 RED                         | `d97ca0645f97c78614be0bbd452346c51b1f081a5d19643372d9423a3fd20434` |
| `reserved-pointer-red.log` / 5 RED                | `2f7711179c45cf787b345c5b6ba6d0a136912b0dca123efcb7ac1e024d1636b8` |
| `provider-status-red.log` / 3 RED                 | `db7a2fbdc681aa22c0aa0d7f75463020b7222a405b0c754de9c5811a75ab7808` |
| `focused-final.log` / 120 pass, 2 integration RED | `d7a04a0307b384079ce14340bf4dac8e327cd956ec9e1d7426b6b5b3ce07ee91` |
| `lint-final.log` / exit 0                         | `8537db3f1cad349c7bbe79f0ed2518c787024a381a6bfffa9e2a5327c6ab2b85` |
| `types-final.log` / exit 2                        | `85399ebb96989dbe37fd16163fd07f026d801f483e8eeaed90c10191e96d38e3` |

Readiness means ready for native independent review and root-owned integration,
not accepted or globally green. Review the six component files, harness split,
error-token ownership, SQL wire agreement, budget/abort cleanup and original
integration probes. Entire byte/typed-error universality, actual SQL producer
maximum, real authority/CAS/idempotency/races and no-partial-effects remain
separate proof obligations. No acceptance criterion or signature is closed.

## Independent-review remedies and latest freeze

Reviewer `native_s12_resume_audit` identified two P2 defects and a coverage gap.
BE03c:1274–1304 binds scrubbed catalog errors and provider-fault 503; :1487 keeps
these operations at 256 KiB. Contracts and the shared error mapper stayed unchanged.

- HTTP 500 with generic uppercase `FORBIDDEN`/`NOT_FOUND`/`VALIDATION_FAILED`
  previously became caller errors. A pattern-local guard now permits only actual
  `40001` serialization tokens or intentional `INTERNAL_ERROR` through that path.
  Both operations have refusal tests and preserved VERSION_MISMATCH,
  STALE_EDIT_PRESENCE and P0001/INTERNAL_ERROR controls.
- A real invalid write with 50 violations previously emitted 3408 bytes under
  `maxResponseBytes: 1024`. Final errors now obey the configured cap; oversized
  projections become the minimal closed `INTERNAL_ERROR`/500 envelope, never
  truncated JSON. Factory and registrars reject limits too small for that envelope.
  Exact-minimum and one-byte-less controls pass; larger options remain clamped.
- New auth-provider and capability-provider fixtures use the **real production
  session resolver**, not `options.resolveSession`. Endpoint tests bind the original
  Request, sessionId/person/party and stale-proof false context. Direct adapter
  controls reject changed resolved user/party and prevent a forged fresh boolean
  from overriding the cached stale proof. No hosted Auth/SQL execution is claimed.

The combined review RED had 8 failing cases and 3 passing preservation controls.
Disabling only the final-error byte guard reproduced the exact 3408 > 1024 failure.
The response file was restored byte-for-byte before GREEN; before/after SHA-256:
`532c0d0944bef4414607a7c41067dc81935a2ee2e4d16706a12f9126b3091c77`.
Latest unfiltered result: **4 suites / 139 tests pass, zero skipped**. ESLint,
Worker type-check, formatting and scoped checks pass. Every authored source/test
is ≤297 lines. Sources/tests frozen again for native review and root joint checks;
shared type/registration integration was performed by its separate owner, not this lane.

Logs: `/tmp/wejammin-s12-pattern-review-fix-juVXxF/`; full commands in each log,
same pinned Node/pnpm and shared quiet lock. Final source hashes: `authored-final.sha256`.

| Latest receipt                 | SHA-256                                                            |
| ------------------------------ | ------------------------------------------------------------------ |
| `review-red.log`               | `f611b7b25d4e188f7bc06275c8f688fc8ac8773189dd91371f23bd5ed7da821b` |
| `error-guard-mutation-red.log` | `a5c8e1d27c13aabeda78e2815996ced9df6aa06f3410bba5744220dc36ff16e6` |
| `focused-final.log` / 139 PASS | `3f105963d8a263ae2e250e132170b397c357f73fd37021f43899d3e192ca4d0c` |
| `lint-final.log` / exit 0      | `79cd9e2a54162ecab8af7b9caa9c826ba83ffd2c18d86e855ad16df5834f5161` |
| `types-final.log` / exit 0     | `498b9702a6e33982d41b92fc8e35363664c3ed70eb0b9f581a2d5d9d96365272` |

No canonical/DB/actual-producer/atomicity proof or acceptance closure follows.

## Residual provider/parser review and outbound refresh — current freeze

Root released the additional exact `pattern-definition-provider-boundary.test.ts`
claim after READY/disjointness checks. No shared integration, SQL, contracts, Web,
configuration or other source was edited. The twelve TypeScript files are frozen;
maximum physical length is 299 lines. This report preserves older receipts rather
than presenting them as current acceptance evidence.

Normative basis: BE03c:1294–1304 distinguishes catalog errors and actual provider
fault/timeout 503; shared `cms-editorial-production-transport.ts:150–180` generates
502 for invalid response parsing and the local deadline remains 504. BE03c:1473,
:1479 and pattern-version contracts bind designer/owner-scoped operations.
Outbound refresh is root-authorized defense matching the taxonomy adapter, not
a newly invented product requirement. Shared session.ts:65–67 still requires SQL
to recheck authority independently.

Corrections and behavioral evidence:

- `cms-composition-production-pattern-definition-latest.ts:44–79`: actual upstream
  500/502/503/504 faults become 503. Only exact recognized `40001` CAS tokens and
  intentional INTERNAL_ERROR precede that gate. Existing three preservation cases
  now exercise both operations under every one of those upstream statuses.
- The same file at :160–164 preserves a failed parser result before considering
  valid provider error tokens. Malformed JSON, wrong media, invalid UTF-8, declared
  oversize and streamed oversize errors remain local 502, including HTTP 400 bodies.
  Valid 400 controls still return 400; exact/plus-one 1024-byte and 256-KiB limits,
  and a configured 1-MiB option clamped to 256 KiB, are exercised for both routes.
- `cms-composition-production-pattern-definition.ts:63–112` requires prior server
  WeakMap proof on the identical Request, resolves that Request again, compares
  user/session/person/acting-party identities and checks the current designer
  capability before RPC. Refreshed proof, not an input boolean, supplies context.
  `latest.ts:121–139` bounds this refresh with the same transport deadline and
  removes its abort listener; no mutation retry was added.
- New QA :123–188 changes the actual synthetic provider result between admission
  and outbound dispatch: all four identities, expiry, account state and capability
  revocation. Every refusal asserts no RPC. QA :190–262 proves a refreshed stale
  step-up proof stays false yet succeeds for NONE, and a stalled refresh returns
  local 504 without RPC. QA :264–299 rejects missing and copied-Request proof.
- The default harness now uses Auth/capability providers through the real resolver
  (`pattern-definition.test-support.ts:164–210`), not a session override. Explicit
  throwing/stalled resolver tests remain admission-failure tests only.

The new suite produced **44 behavioral failures and 8 passing controls, 52 total**
before production edits. Failures were wrong HTTP statuses, missing second resolver
calls, and unwanted RPC success—not module/setup failures. A separate extension of
the intentional-token controls then produced **3 behavioral failures** before the
exact-token exceptions moved ahead of the common provider gate. Its 38 filtered
tests were not source skips. The final unfiltered run has **191 passed, zero skipped**:
the existing 139 cases remain plus the 52 new cases; no assertions were removed.

Earlier assertions that preserved actual upstream 502/504 or turned oversized
HTTP-400 error bodies into caller 400 were incorrect oracles. They were corrected
only after the independent new regression suite demonstrated the defects. The
older cached-proof controls did not prove outbound provider refresh; the new
provider-changing tests supply that missing Worker-boundary evidence. No SQL proof
is inferred from synthetic providers or fetch responses.

Provenance: `/tmp/wejammin-s12-pattern-residual-CXlGU3/baseline.sha256` captures the
prior twelve-file source/test/report baseline; manifest SHA-256
`e0a49e76767e0aca17ac143216617182a37b2c5f17be75f2eb2651df1073ddd8`.
Source edits used scoped apply_patch after RED. The new file did not exist at that
baseline. Initial `residual-red.log` used the wrong Vitest working directory and
found no tests: explicitly **not RED evidence**. A mock tuple annotation caused
intermediate type-check failures; fixed without changing runtime assertions.

All current commands/logs reside in that same directory. Checks use pinned
Node 22.23.1 / pnpm 11.24.0, non-login Bash and the shared quiet lock. The focused
command is `flock -s /tmp/wejammin-quiet.lock pnpm exec vitest run` followed by the
five explicit pattern test paths, recorded verbatim in `focused-final.log`.
Scoped ESLint, Prettier, diff check and Worker type-check all exit 0.

| Current receipt                                      | SHA-256                                                            |
| ---------------------------------------------------- | ------------------------------------------------------------------ |
| `provider-boundary-red.log` / 44 RED, 8 PASS         | `49d0e033be6896dd0633155591511b1e9ebee27b17e841d2eb10867e44d7c3a4` |
| `preservation-red.log` / 3 RED                       | `1637b6f82fe0c91f77edf6d248bdefce3fcd1f8d0cfadfc8a715d71a56b1ddeb` |
| `focused-final.log` / 191 PASS                       | `50507024fb5a8edf44200f501d2d6625eebdd7571483c9d7c91a0cf4e8964d00` |
| `lint-final.log` / exit 0                            | `14f96171861d7969487fcc90023e51676d64de4fa62ad6e39205ef2ae7c828f6` |
| `types-final.log` / exit 0                           | `edd0553b122b3548a01cd3257b8895a713f804c80a6836d1d5bf287d15f60daf` |
| `format-final.log` / exit 0                          | `70e420ecba5bceeef2f66da1c971cfc432677977a2944fa378c8f45e706ace45` |
| `source-tests-final.sha256` / twelve frozen TS files | `2bf9e4935f73d9b1ae385cfe209068106943e8090397d3b9f4d7b004df649757` |

Native independent re-review and root joint checks are pending. Real SQL producer,
hosted authority, concurrent revocation/CAS/idempotency, atomicity/no-effects,
canonical validation and all acceptance/signature closures remain OPEN.
