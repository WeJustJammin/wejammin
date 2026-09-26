# Phase 2: Identity, admin, CMS/settings

**Status**: in-progress  
**Progress**: 9/17 slices (53%)  
**Criteria (2026-09-26)**: 1,996 active / 2,000 authored; AC209, AC211, AC265, and AC266 remain authored and unchecked outside the active Phase 2 implementation-completion denominator. Slice 09 is 279/279 active with 283 authored IDs.  
**Current gate (2026-09-26)**: DEC-105 moves AC265 to a mandatory pre-release production-readiness/release gate. Slice 09 implementation is complete at **279/279 active** (**283 authored IDs**); Phase 2 is **9/17**. AC265 is a mandatory pre-release gate and does not block Slice 10 implementation, which is now unblocked. AC265 and AC266 remain separate pre-release gates requiring genuine hosted and real-device evidence. AC209 remains a production-rollout/post-deployment evidence gate that must pass before alerting is declared ready; AC211 remains post-launch operational SLO acceptance mandatory after initial launch. All four remain authored, unchecked, and never passed, waived, simulated, or inferred.  
**Prior gate (superseded 2026-09-26 by DEC-105)**: DEC-104 supersedes DEC-101's Slice 10 dependency sentence and defers the production-evidence closure of P2-S09-AC-209 and P2-S09-AC-211. AC265 is the only Slice 10 implementation prerequisite. Slice 09 remains blocked at **279/280 active** (**283 authored IDs**); Phase 2 remains **8/17**. AC209 is a production-rollout/post-deployment evidence gate that does not gate Slice 10 implementation or the initial controlled production deployment and must pass before alerting is declared ready; AC211 is post-launch operational SLO acceptance that does not gate the initial launch and is mandatory after initial launch; AC266 remains the pre-release production-readiness/release gate. All three remain authored, unchecked, and never passed, waived, simulated, or inferred.  
**Prior gate (superseded 2026-09-25 by DEC-104)**: CP-04e is promoted through PR #93 at exact main SHA `15032d0e333c1931008c8d363a60a4840b3a6bb2`; exact-main CI `35673427068` succeeded with jobs `106574760348`, `106574760514`, and `106576054809`, and staging `35673923999` succeeded with job `106576288369` and GitHub deployment `6581175667`. API deployment `62bb526d-3755-4f6d-a534-f798ae339248` published version `0164eae4-b06c-4e1e-a342-7cf6a3100bf5`; web deployment `62e2fbcb-c1f3-49a5-96cb-686b2cb20e3e` published version `87ec18d2-9075-4f76-a2ce-73d0124d028a`. Workspace artifact `10672800366`, test evidence `10672235833`, staging candidate `10672316126`, and staging deployment artifact `10672405997` are digest-bound in the CP-04e record; migration `20260921060000` is included. Staging p95 was **33.31 ms / 500 ms** across 20 samples with zero errors; accessibility was **0/0** across three routes. These are staging promotion proofs only, not production evidence or hosted AC265 acceptance. AC211 run `35673313035` passed preflight but had insufficient samples (`commands=0`, `protectedRpcs=0`, `acceptances=0`, `queueFirstAttempts=0`; `dataset=1`, `registry=0`, `productionRegistry=0`, `releaseRegistry=0`), so no artifact or SLO verdict exists. At that checkpoint Slice 09 was **279/282 active** (**283 authored IDs**), Phase 2 was **8/17**, AC209/AC211/AC265 were open, Slice 10 was locked, and AC266 was owner-deferred. DEC-104 later moved AC209 and AC211 outside the active denominator.  
**Prior CP-04d gate (superseded 2026-09-21)**: Slice 09 remains blocked at **279/282 active** (**283 authored IDs**) with depth ratio **0.986**; Phase 2 remains **8/17** slices. PR #91 is the latest promoted CP-04d implementation baseline at exact SHA `289ed3a2f4f92da383aa1464340f804777496257`; exact-main CI `35656504913` succeeded across all three jobs, and automatic staging run `35657406613` succeeded on `run_attempt=1` with deployment `6578526934`. Candidate artifact `10665966829` has digest `sha256:d51c0104d8ea7933e5d4a45af021b0ac2067a24150739390edb58e171cab827c`; deployment evidence artifact `10665756858` has digest `sha256:2724a98beb5e2152b7c601697c95042af508ee94d2e62da7ee143495362c9664`; source `artifactDigest` is `0e92da9874c0fae7e0d62fb4419678a83f00a8986087de558dc101c465451c04`; promoted migration is `20260921050000`; provider deployment IDs are `dac978c4-fe9d-4c86-9cf4-53d96a42d45e` and `b27ddb9f-0ab3-4c07-88da-5ff8ea0b2f7b`. Staging p95 was **29.956710999999927 ms** against the **500 ms** threshold, with automated axe digest `6a7f59d9792a176e3032a9b410c6a0c1bb03850f27ed2918bc98fe82fddbbcf4` and serious/critical counts **0/0**. These are exact-main CI and staging promotion proofs only; staging proof does not equal hosted AC265 acceptance. CP-04d adds the signed source-manifest contract, server-derived authorization window, separate manifest digest, canonical ordering, immutable reserve-to-finalize/readback authority, truthful `sourceSetComplete`/`kindComplete` fields that never assert acceptance, and resolver/semantic-subject/protected-context hardening. Known focused TypeScript evidence is **16 files / 104 tests**. Focused database authority evidence is **78/78 assertions** and concurrency evidence is **6/6** (**84/84 total**). After a fresh reset, `pnpm db:test` passed **61 files / 2,208 tests**; `pnpm db:lint` passed with unrelated existing warnings, and `pnpm db:types:check` passed. Final local `pnpm validate` passed **562 files** with **4,498 passed + 1 skipped / 4,499**, 100% coverage (**13,184 statements, 9,862 branches, 2,164 functions, 12,263 lines**); Slice 09 evidence passed, Playwright passed **101/101 functional** and **5/5 real-route** checks, builds and bundle budgets passed, and local API p95 was **1.2129150000000095 ms**. Final local `pnpm db:verify` passed after a fresh reset with migrations through `20260921050000`; database lint had existing warnings only, **61 files / 2,208 tests** passed, and generated types matched. The initial validate failure was root-caused to a fixture `PUBLIC_KEY_PEM` re-export issue; after the fix, focused **8/8** and **12-repeat** stability checks passed before the successful rerun. The CP-04d foundation is private construction evidence only: no live hosted producer/source population, protected signer execution, retained hosted artifact, independently authenticated receipt, or complete hosted matrix exists; AC265 remains open. Read-only AC209 verifier `35612514031` failed with `provider_graphql_error` after all preflight/protection/workspace gates, with no effects or receipt. AC211 also remains open. AC266 is owner-deferred because the required real devices are unavailable; it remains unchecked and excluded from active Phase 2 completion. Slice 10 remains locked only on AC209, AC211, and AC265; AC266 remains a mandatory post-Phase 2 production-readiness/release gate.  
**Plan**: [Phase 2 plan](../../../wiki/specs/phases/phase-2.md)  
**Updated**: 2026-09-26
**Prior remote evidence**: Before this remediation, PR #9 head `67264c5e9b5196d00ac3f0aa272896a010c872d7` produced synthetic merge `a79dfe30db60e4f54024f064fc2fdf2d01033919` and passing CI run `33841270472`. That run is not evidence for the remediation; no merge or deployment is claimed

## CP-04a approved outage-target attestation (promoted foundation)

CP-04a adds a strict service-role-only approved-target read over the CP-01
target rows, a canonical target projection with the stored target digest, and
a distinct domain-separated Ed25519 attestation for the exact target bytes.
The protected manual main/staging entrypoint and workflow are fail-closed, and
the verifier/policy require the signed target attestation rather than accepting
a caller-provided authenticity callback.

Focused AC265 verification passes **54 files / 483 tests** with
`pnpm type-check` green. Exact-runtime `pnpm validate` exits 0 with **549
Vitest files, 4,366 passed + 1 intentional skip (4,367 total)**, 100% coverage,
101 functional Chromium checks, five production-built checks, green
builds/bundle checks, and local API p95 **1.377056 ms**. After a clean reset,
all `pnpm db:verify` components are green: **57 pgTAP files / 2,087
assertions**, database lint, and generated-type checks pass. Independent
security review found no CP-04a blocker; a protected orchestrator remains a
required trust boundary. PR #86 / exact-main SHA
`4fa8691d24177d0a528335f3c3d06ef50d67d3a9`, CI `35597438023`, and staging
workflow `35598236704` / deployment `6568074493` are green. Live target-signing
key/configuration, seeded CP-01 target or registry rows, retained target or
attestation artifact, attestation workflow run, hosted browser matrix,
independently authenticated receipt, or AC265 acceptance remain absent. Slice
09 remained **279/282 active** and Slice 10 remained locked on AC209, AC211, and
AC265. See the [CP-04a verification record](../verification/2026-09-21-ac265-approved-outage-target-attestation.md).

## CP-04b approved outage-target registration (promoted private foundation)

CP-04b adds the contract, bounded RPC, and forward-only database boundary for
registering an owner-approved outage target. PR #88 promotes this private
foundation to staging; the migration keeps immutable policy and registration
ledgers empty, and the service-role-only RPC derives target scope from
authenticated authorization/candidate context and server policy, binds exact
correlation and idempotency references, and returns only a redacted registered
envelope. No live policy or target is seeded, and no hosted route is exposed.

The RPC client suite passes **15 tests**; together with the registration
contract/public-export tests this is **3 files / 24 tests**. The registration
SQL has **35 pgTAP assertions**, including direct registration-to-lease
acquisition proving that a registered target remains valid for the exact CP-01
60-second lease. The separate two-connection concurrency proof has **2
assertions**. The policy requires **exact 120-second target validity**, leaving
a bounded 60-second acquisition window before the exact 60-second lease;
future-dated or too-short policy windows return generic conflict.

The CP-04b baseline `pnpm validate` passed **551 Vitest files, 4,387
passed + 1 intentional skip**, with **13,143/13,143 statements, 9,850/9,850
branches, 2,160/2,160 functions, and 12,224/12,224 lines** (100%). The
evidence-map gate passed; Playwright passed **101 functional + 5 production-built
Slice 09 real-route checks**. Builds, bundle budgets, and performance are green;
API p95 is **1.491154 ms**. Fresh `pnpm db:verify` passed **59
pgTAP files / 2,124 assertions**; database lint exits 0 with **46 longstanding
warnings** (39 never-read, 6 unused, 1 immutable/stable), and generated
database types match. Architecture compile passed **1,632 nodes / 10,125 edges**
with 55 known lint issues.

CP-04b is promoted as code/staging evidence only and provides no live
policy/target, signing-key configuration, retained target/attestation/evidence
artifact, hosted matrix, independently authenticated receipt, or AC265
acceptance. PR #88 implementation main SHA is
`52b66272e61331827c59ac1e169868474a2c09c8`; PR CI `35611484121`, exact-main
CI `35612415141`, and staging `35613284966` passed; deployment `6570861931`
succeeded. Promotion artifact `10645302055` has digest
`sha256:12f05e8371586996dc413b85b75167934045f342091defff5197435b8b707782`.
Staging p95 was **32.589357 ms** and the automated axe digest was
`df2522f8512dcea587146f5bce43ad5232b94964d5048825ffdb745286dd772d`.
Historical read-only AC209 verifier `35612514031` failed with
`provider_graphql_error` after all preflight/protection/workspace gates and
produced no effects or receipt; that failure has since cleared, and the current
reading is in the [2026-09-24 protected-run record](../verification/2026-09-24-ac209-ac211-protected-run-evidence.md).
Slice 09 remained **279/282 active** at that checkpoint; AC265 remained open and Slice 10
remained locked on AC209, AC211, and AC265. Superseded by DEC-104 — see the current
gate above. AC266 remains unchecked,
owner-deferred, and mandatory at the post-Phase 2 production-readiness/release
gate. See the [CP-04b verification
record](../verification/2026-09-21-ac265-approved-outage-target-registration.md).

## CP-04c hosted artifact attestation and branded resolver (promoted private foundation)

CP-04c is promoted as a private construction foundation only. PR #90 merged
at exact main SHA `e7525fa9ea80bbdf2325e8ce08d18930d6485b15`; exact-main CI
`35634692281` succeeded, and staging workflow `35635650934` failed on
`run_attempt=1` only at transient web release-identity propagation before
succeeding on `run_attempt=2`. Deployment `6574859596` succeeded at
`https://staging.wejamm.in`; the exact staging endpoints now serve
`e7525fa9ea80bbdf2325e8ce08d18930d6485b15`; that CP-04c promotion record
predates the CP-04d retry hardening now promoted in PR #91.
Candidate artifact `10656615428` has digest
`sha256:5568778c8bec9eacd8090ae2020518caa070ce82b1a901aa4c7fe9a95f03d592`;
deployment evidence artifact `10655784856` has digest
`sha256:02422c5ef8b4988fe50bdc7d02771c286ac81c148e51bac6bc80927736ec461d`;
staging p95 was `49.30431599999997 ms` and automated axe digest
`00968b6a806db4993ab895f83fcb592af81a65ec925f9b38e6aa3140c0f87d87`.
Strict Ed25519 attestation over exact artifact bytes and a branded resolver
enforce exact artifact kind/reference/key/subject/run/candidate/runner bindings
with a maximum source set of **256**. The upstream authenticated
manifest/registry/run authority and external replay ledger remain open; no
hosted artifact, hosted matrix, independently authenticated receipt, or AC265
acceptance is claimed. Focused local verification passes **5 files / 74 tests**
and `pnpm type-check` is green. At that checkpoint Phase 2 was **8/17** with
**1,999/2,000 active criteria**; Slice 09 was **279/282 active** (**283 authored
IDs**), AC209/AC211/AC265 were open, Slice 10 was locked, and AC266 remained
owner-deferred as the mandatory post-Phase 2 production-readiness/release
gate.

## CP-04d signed source-manifest and authority foundation (local/private only)

CP-04d adds the strict signed artifact-source manifest contract and verifier
boundary. Manifest bytes use domain-separated Ed25519 signatures, canonical
code-point ordering, exact source references, and a manifest digest that is
separate from the request hash. Authorization windows are server-derived. The
protected authority ledger implements immutable reserve-to-finalize/readback
state, idempotent replay protection, and concurrency-safe source bindings;
readback exposes truthful `sourceSetComplete` and `kindComplete` fields only,
never an acceptance result. The resolver, semantic-subject serializer, and
protected verification context reject structural/callback-only substitutions
and snapshot mutable inputs before use.

The staging verifier retry hardening is implemented in the promoted baseline:
it prevalidates inputs and retries the complete release contract for **13
attempts at 5 seconds**. Known focused TypeScript evidence is **16 files / 104
tests**. Focused database authority evidence is **78/78 assertions** and
concurrency evidence is **6/6** (**84/84 total**). After a fresh reset,
`pnpm db:test` passed **61 files / 2,208 tests**; `pnpm db:lint` passed with
unrelated existing warnings, and `pnpm db:types:check` passed. Final local
`pnpm validate` passed **562 files** with **4,498 passed + 1 skipped / 4,499**,
100% coverage (**13,184 statements, 9,862 branches, 2,164 functions, 12,263
lines**); Slice 09 evidence passed, Playwright passed **101/101 functional**
and **5/5 real-route** checks, builds and bundle budgets passed, and local API
p95 was **1.2129150000000095 ms**. Final local `pnpm db:verify` passed after a
fresh reset with migrations through `20260921050000`; database lint had
existing warnings only, **61 files / 2,208 tests** passed, and generated types
matched. The initial validate failure was root-caused to a fixture
`PUBLIC_KEY_PEM` re-export issue; after the fix, focused **8/8** and
**12-repeat** stability checks passed before the successful rerun. PR #91
merged to `main` at exact SHA
`289ed3a2f4f92da383aa1464340f804777496257`; exact-main CI `35656504913`
succeeded across all three jobs, and automatic staging run `35657406613`
succeeded on `run_attempt=1` with deployment `6578526934`. Candidate artifact
`10665966829` has digest
`sha256:d51c0104d8ea7933e5d4a45af021b0ac2067a24150739390edb58e171cab827c`;
deployment evidence artifact `10665756858` has digest
`sha256:2724a98beb5e2152b7c601697c95042af508ee94d2e62da7ee143495362c9664`;
source `artifactDigest` is
`0e92da9874c0fae7e0d62fb4419678a83f00a8986087de558dc101c465451c04`;
migration `20260921050000` and provider deployments
`dac978c4-fe9d-4c86-9cf4-53d96a42d45e` and
`b27ddb9f-0ab3-4c07-88da-5ff8ea0b2f7b` are recorded. Staging p95 was
**29.956710999999927 ms** against the **500 ms** threshold; automated axe
digest is `6a7f59d9792a176e3032a9b410c6a0c1bb03850f27ed2918bc98fe82fddbbcf4`,
serious/critical **0/0**. These are exact-main CI and staging promotion proofs
only; staging proof does not equal hosted AC265 acceptance. This remains
private construction evidence: no hosted producer/source population, protected
signer execution, retained hosted artifact, independently authenticated
receipt, or complete hosted matrix exists. AC265 remains open, Slice 10 remains
locked, and AC266 remains owner-deferred as the mandatory post-Phase 2
production-readiness/release gate. See the [CP-04d verification
record](../verification/2026-09-21-ac265-hosted-artifact-source-manifest.md).

## CP-04e protected source-manifest publication (staging promotion only)

CP-04e implements the protected context-capsule loader, exact CI/staging
selector and archive-digest binding, quota-bounded ZIP reader, typed
register/finalize/readback client, canonical signing, finalized readback
verification, and main-only protected workflow. Focused root verification
passed **11 files / 52 tests**. Final local `pnpm validate` passed **572 files**
with **4,543 passed + 1 skipped / 4,544** at 100% coverage; fresh `pnpm
db:verify` passed **62 files / 2,211 tests** through migration
`20260921060000`.

CP-04e is promoted through PR #93 at exact main SHA
`15032d0e333c1931008c8d363a60a4840b3a6bb2`. Exact-main CI `35673427068`
passed database `106574760348`, quality `106574760514`, and immutable-build
`106576054809`; staging `35673923999` passed job `106576288369` with GitHub
deployment `6581175667`. API deployment
`62bb526d-3755-4f6d-a534-f798ae339248` published version
`0164eae4-b06c-4e1e-a342-7cf6a3100bf5`; web deployment
`62e2fbcb-c1f3-49a5-96cb-686b2cb20e3e` published version
`87ec18d2-9075-4f76-a2ce-73d0124d028a`. Workspace, test, staging-candidate,
and staging-deployment artifacts are `10672800366`, `10672235833`,
`10672316126`, and `10672405997`; the internal manifest digest is
`9192affb6097e48caf3aa86aa776a441f2031c2743f969cc1c2d244ed7148835`.
Migration `20260921060000` is included. Staging p95 was **33.31 ms / 500 ms**
across 20 samples with zero errors; accessibility was **0/0** across three
routes. These are staging promotion proofs only, not production evidence or
hosted AC265 acceptance. No live protected context capsule, signing
configuration, protected publication run, retained hosted artifact,
authenticated receipt, or complete hosted matrix exists. AC265 remains open;
AC209 and AC211 were open at that checkpoint; Slice 10 was locked. Totals were **8/17**
slices, **1,999/2,000 active criteria**, and Slice 09 **279/282 active** with
**283 authored IDs**. AC266 remains owner-deferred and mandatory for the
post-Phase 2 production-readiness/release gate. See the [CP-04e verification
record](../verification/2026-09-21-ac265-hosted-artifact-source-manifest-publication.md).

Slice 08 is complete (51/51). Slice 09 local QA-GREEN passes. PR #13 merged as
exact main SHA `7250754dcdc9c1b7a863aa41d79772e6ab7092ab`; CI run
`33950299169`, staging run `33950592657` / deployment `6278097284`, and
business-account-approved production run `33950658266` / deployment
`6278109516` all passed. GitHub Actions and deployment actor: `WeJustJammin`.
Owner-confirmed Supabase production project `gzqgpdlfwbqhutvrkaeo` is
`ACTIVE_HEALTHY` in `us-east-1`, and its non-secret GitHub production bindings are
configured for confirmed origin `https://wejamm.in`; production credentials,
and exact-candidate preflight now pass. At the owner's direction, production
rule `64231612` now names only business account `WeJustJammin` (`305953066`),
allows the dispatching owner to approve, disables administrator bypass, and
retains the sole custom `main` policy. The corrected production workflow applied
all migrations, deployed API version `b5ab753d-8388-490d-b6a0-ba3096f074b4`
and web version `68a414d7-2f74-40d8-a9fd-367404573b93`, and retained artifact
`9964724622` with digest `sha256:388dee00a587e04f88e4a1dfbf8c48b5e0c50507910f220dc900173bf3630077`.
The corrected release passes the complete local gate: 418 Vitest files / 3,101
tests at 100% coverage, 102 Playwright checks, all builds/contracts/format/lint/
type/performance checks, and database verification with 45 pgTAP files / 1,670
tests plus regenerated type parity.

The 2026-09-05 follow-up implements the production operational-alert boundary:
bounded Cloudflare Workers Logs and Queue GraphQL queries, a service-only
Supabase snapshot/claim/completion authority, twelve fixed alert conditions,
and redacted Cloudflare Email Sending delivery. Its local gate passes 423
Vitest files / 3,143 tests at 100% coverage plus 102 Playwright checks. It is
not deployment evidence: the production-only observability token, exact-SHA
promotion, post-configuration delivery receipt, and full UTC-day SLO/DLQ
window remain outstanding.

The operational-alert provider boundary is deployed and live-verified. PR #18 merged the
root-cause empty-result handling as exact main SHA
`c995ce31821e39ac6f27538813f536f9af6b39f2`; CI `33960218010`, staging
`33960712969` / deployment `6279914420`, and business-account-approved
production `33960764747` / deployment `6279925490` passed. Cloudflare records
two consecutive successful scheduled executions at `06:31:00.649` and
`06:31:54.674 EDT`, after the last pre-deployment envelope error at
`06:29:54.678 EDT`. The current complete local gate passes 423 Vitest files /
3,148 tests at 100% coverage, 102 Playwright checks, and 45 pgTAP files / 1,678
tests. No genuine alert email has been delivered, so AC209 remains open on its
receipt requirement rather than its provider-deployment requirement.

PR #29 merged and deployed the 2026-09-06 AC211 collector. Current full
`pnpm validate` passes 434/434 Vitest files /
3,256 tests plus one intentional skip at 100% coverage, 101/101 functional
Playwright checks, and 5/5 production-built Slice 09 checks. The candidate does
not produce an AC211 release claim: no complete retained production UTC-day
report exists. Protected run `34189916813` attempted 2026-09-07 UTC and failed
closed for insufficient natural samples; the next eligible complete day is
2026-09-08 UTC and could be collected only after `2026-09-09T00:00:00Z` at
that time. At that time, eligibility was 2026-09-14 UTC, with earliest dispatch
at `2026-09-15T00:01:00Z`, subject to natural sample floors. The later
collection run `34424101528` produced zero qualifying samples and no AC211
report; AC211 remains open.
AC209 still requires a genuine provider/mailbox
receipt; AC265 still requires the approved 9-role/10-scenario hosted report,
role/identity lifecycle, MFA/step-up, teardown, and complete hosted matrix;
AC266 still requires the manual assistive-technology
browser pairs. Slice 09 remains 279/283 and Phase 2 remains 8/17.

The auth-provider transport is also deployed and live-verified. PR #20 fixed
the cached Worker app's stale default fetch context. After two exact-main runs
reproduced timeout-only failures in two repository-wide checks, PR #21 retained
every assertion and added shared-runner headroom. Exact SHA
`b22a914327291e2895bbcc7dc8f60837c8faa0d6` passed CI `33965293079`, staging
`33965655238` / deployment `6280862362`, and protected production
`33965764707` / deployment `6280885024`. Both staging auth origins and five
sequential production requests return HTTP `200` with the valid catalog;
Cloudflare records those production requests at info level with 21 successes
and 0 errors in the 15-minute window.

The [historical pre-configuration verification report](../../../wiki/specs/audits/verify-infrastructure-2026-09-05-0824.md)
records the exact-SHA execution and repaired release protection. External acceptance
remains blocked at 279/283: AC209 genuine live delivery receipt, AC211 full
UTC-day SLO/DLQ telemetry, AC265 business-owned Google OAuth configuration and
authorized test identities for the complete hosted matrix, and AC266 manual
assistive-technology evidence remain open. Google is disabled with blank
credentials in both Supabase projects, and Google Cloud requires owner
acceptance of its Terms of Service before client setup. The prior audit remains linked
for history: [2026-09-04-1353](../../../wiki/specs/audits/verify-infrastructure-2026-09-04-1353.md)
and [2026-09-04-1255](../../../wiki/specs/audits/verify-infrastructure-2026-09-04-1255.md).

The 2026-09-08 hosted OAuth retest supersedes the pre-configuration Google
statements above: exact staged SHA
`10f320b97ccce0c62fba2ee27a3b792f08f83285` passed CI `34224641678` and staging
`34225256920` / deployment `6327379740`; the Supabase provider registry is
`enabled` and verified at version `16`; and a live external-browser callback
retained five cookies, completed the session, reached the protected registry
route, and created one real Google identity. AC265 remains open for the
approved 9-role/10-scenario hosted report, role/identity lifecycle, MFA/step-up,
teardown, and complete hosted Auth/RLS/IdP evidence. AC209, AC211, and AC266
remain open; Slice 09 stays at 279/283 and Slice 10 remains locked.

|                                                                Slice | Status      |                      Criteria | Depends on       | Link                                |
| -------------------------------------------------------------------: | ----------- | ----------------------------: | ---------------- | ----------------------------------- |
|         01 Authentication, recovery, session, and identity bootstrap | complete    |                       103/103 | Phase 1          | [→](../slices/phase-02-slice-01.md) |
|      02 Login methods, provider linking, and duplicate-account merge | complete    |                         47/47 | Slice 01         | [→](../slices/phase-02-slice-02.md) |
|          03 Person records, role facets, aliases, and acting context | complete    |                       301/301 | Slice 01         | [→](../slices/phase-02-slice-03.md) |
|            04 Organizations, type assignments, and membership tenure | complete    |                       156/156 | Slice 03         | [→](../slices/phase-02-slice-04.md) |
|                      05 Shadow parties, invitations, and claim proof | complete    |                       258/258 | Slice 03         | [→](../slices/phase-02-slice-05.md) |
|                       06 Public profiles and credit-backed portfolio | complete    |                       121/121 | Slices 03 and 05 | [→](../slices/phase-02-slice-06.md) |
|           07 Typed settings registry, effective values, and rollback | complete    |                       176/176 | Slice 01         | [→](../slices/phase-02-slice-07.md) |
|             08 Admin shell, task inbox, capability grants, and audit | complete    |                         51/51 | Slices 03 and 07 | [→](../slices/phase-02-slice-08.md) |
|        09 Content schemas, relations, activation, and block registry | complete    | 279/279 active (283 authored) | Slices 07 and 08 | [→](../slices/phase-02-slice-09.md) |
|        10 Entry authoring, conflict resolution, and revision restore | not started |                          0/60 | Slice 09         | [→](../slices/phase-02-slice-10.md) |
|                 11 Review, scheduling, preview, and safe publication | not started |                          0/45 | Slice 10         | [→](../slices/phase-02-slice-11.md) |
|             12 Templates, reusable patterns, and taxonomy governance | not started |                          0/50 | Slice 09         | [→](../slices/phase-02-slice-12.md) |
|                      13 Menus, routes, slugs, and discovery metadata | not started |                         0/174 | Slices 11 and 12 | [→](../slices/phase-02-slice-13.md) |
|          14 Governed media ingest, rights, renditions, and lifecycle | not started |                          0/65 | Slices 09 and 13 | [→](../slices/phase-02-slice-14.md) |
| 15 Public delivery, exact-version preview, convergence, and recovery | not started |                          0/72 | Slices 11–14     | [→](../slices/phase-02-slice-15.md) |
|                  16 Content quality and privacy lifecycle foundation | not started |                          0/28 | Slices 08 and 15 | [→](../slices/phase-02-slice-16.md) |
|  17 Phase 2 integration, infrastructure verification, and close gate | not started |                          0/10 | Slices 01–16     | [→](../slices/phase-02-slice-17.md) |

## Slice checklist

- [x] **Slice 01**: Authentication, recovery, session, and identity bootstrap → [log](../slices/phase-02-slice-01.md)
- [x] **Slice 02**: Login methods, provider linking, and duplicate-account merge → [log](../slices/phase-02-slice-02.md)
- [x] **Slice 03**: Person records, role facets, aliases, and acting context → [log](../slices/phase-02-slice-03.md)
- [x] **Slice 04**: Organizations, type assignments, and membership tenure → [log](../slices/phase-02-slice-04.md)
- [x] **Slice 05**: Shadow parties, invitations, and claim proof → [log](../slices/phase-02-slice-05.md)
- [x] **Slice 06**: Public profiles and credit-backed portfolio → [log](../slices/phase-02-slice-06.md)
- [x] **Slice 07**: Typed settings registry, effective values, and rollback → [log](../slices/phase-02-slice-07.md)
- [x] **Slice 08**: Admin shell, task inbox, capability grants, and audit → [log](../slices/phase-02-slice-08.md)
- [x] **Slice 09**: Content schemas, relations, activation, and block registry — 279/279 active (283 authored); AC265 and AC266 remain mandatory pre-release, AC209 post-deployment alerting readiness, AC211 post-launch SLO acceptance → [log](../slices/phase-02-slice-09.md)
- [ ] **Slice 10**: Entry authoring, conflict resolution, and revision restore → [log](../slices/phase-02-slice-10.md)
- [ ] **Slice 11**: Review, scheduling, preview, and safe publication → [log](../slices/phase-02-slice-11.md)
- [ ] **Slice 12**: Templates, reusable patterns, and taxonomy governance → [log](../slices/phase-02-slice-12.md)
- [ ] **Slice 13**: Menus, routes, slugs, and discovery metadata → [log](../slices/phase-02-slice-13.md)
- [ ] **Slice 14**: Governed media ingest, rights, renditions, and lifecycle → [log](../slices/phase-02-slice-14.md)
- [ ] **Slice 15**: Public delivery, exact-version preview, convergence, and recovery → [log](../slices/phase-02-slice-15.md)
- [ ] **Slice 16**: Content quality and privacy lifecycle foundation → [log](../slices/phase-02-slice-16.md)
- [ ] **Slice 17**: Phase 2 integration, infrastructure verification, and close gate → [log](../slices/phase-02-slice-17.md)

## Gates

- [x] Owner approves Phase 2 plan — explicitly approved 2026-08-31.
- [x] Slice 08 `/verify-infrastructure` local auth/admin checkpoint passes; remote activation remains explicitly gated.
- [x] Slice 09 exact-SHA execution — PR #13 merge `7250754dcdc9c1b7a863aa41d79772e6ab7092ab`, CI `33950299169`, staging `33950592657` / deployment `6278097284`, production `33950658266` / deployment `6278109516`, and expanded migration `20260902080000` all verified; actor `WeJustJammin`.
- [x] `main` remains pull-request-only with strict completion of the exact three
      GitHub Actions checks, administrator enforcement, linear history, and
      conversation resolution; the unavailable second-identity approval and
      last-push approval requirements are disabled for this single-business-account
      repository.
- [x] Production release identity corrected — production requires exact business-account reviewer `WeJustJammin`, allows explicit owner self-approval, disables administrator bypass, and retains its sole custom `main` branch policy. The rejected personal account is no longer used by the live rule or verifier.
- [x] Production evidence artifact `9964724622` retained all five hidden promotion files for exact SHA `7250754d...`; digest `sha256:388dee00a587e04f88e4a1dfbf8c48b5e0c50507910f220dc900173bf3630077`.
- [x] Slice 09 operational-alert provider execution — exact SHA `c995ce31821e39ac6f27538813f536f9af6b39f2`, CI `33960218010`, staging `33960712969` / deployment `6279914420`, production `33960764747` / deployment `6279925490`, and two consecutive successful production cron events verified; actor `WeJustJammin`.
- [x] Slice 09 hosted auth-provider transport — PR #20 fetch-context correction plus PR #21 CI stabilization, exact SHA `b22a914327291e2895bbcc7dc8f60837c8faa0d6`, CI `33965293079`, staging `33965655238` / deployment `6280862362`, production `33965764707` / deployment `6280885024`, HTTP `200` staging/production catalogs, and 0 Cloudflare errors in the observed production window verified; actor `WeJustJammin`.
- [x] Slice 09 implementation is complete under DEC-105 at 279/279 active; this is not production-readiness acceptance. AC265 still requires the approved 9-role/10-scenario hosted report, role/identity lifecycle, MFA/step-up, teardown, exact artifact provenance, and hosted Auth/RLS/IdP evidence before release. AC266 remains a separate real-device pre-release gate. AC209 still requires a genuine post-deployment alert receipt before alerting readiness; AC211 requires post-launch production-window SLO/DLQ telemetry.
- [x] Slice 09 exact-main observability preflight — CI `34013034252` and staging `34013296132` passed for `3bf66a610b013bf9600889780ee26319559fb31c`; protected production `34016439881` failed before migrations/deployment with `Cloudflare Account Analytics permission check failed`, proving the release path fails closed without the required token scope.
- [x] Slice 09 rotated-secret retest — production secret metadata changed at `2026-09-06T07:07:48Z`; protected production `34018343506` consumed the replacement and repeated the Account Analytics failure before mutation. Workers Observability still passed, isolating the remaining fault to effective Account Analytics permission/resource scope.
- [x] Slice 09 safe diagnostic deployment — PR #25 merged as exact main SHA `ccfefa7862900357586fef9031b314e7b30989b4`; CI `34019423084` and staging `34019696293` passed. Protected production `34019780775` classified the Account Analytics result as `malformed response` before mutation. Cloudflare's valid `errors: null` success envelope reproduced the fault; parser-fix RED failed 1/18 and GREEN passes 18/18.
- [x] Slice 09 corrected preflight promotion — PR #26 merged as exact main SHA `6d33bd189a51b4e041e582feb604d5fe22ddce78`; CI `34020909710`, staging `34021192537`, and protected production `34021249248` passed. Observability scopes, remote migration parity, release identity, API Worker `e1891c96-f8d9-47e4-ac5c-0671d17d3696`, and web Worker `6565d60c-ab9f-483d-8b3c-bb44f9ad9ba5` are verified.
- [x] Slice 09 scheduled-runtime parser correction — Queue Analytics repeated the invalid `errors: null` assumption. Focused RED failed 1/29; GREEN passes 29/29. Full `pnpm validate` passes 424/424 Vitest files, 3,169/3,169 tests at 100% coverage, and 102/102 Playwright checks. PR #27 merged as exact main SHA `93c2fd837cffa89baea9d43a9f482000c5739440`; CI `34022522801`, staging `34022811556` / deployment `6291019997`, and protected production `34022888837` / deployment `6291034733` passed. API Worker `1b2d3c02-d3e9-4681-9fde-7d05f06e0cd5`, web Worker `a5d3d651-29ff-4226-bff2-d11376671b6d`, artifact `9986107430`, and one natural scheduled event with outcome `ok` and zero exceptions are verified. A genuine provider/mailbox receipt remains required before AC209 can close.
- [x] Slice 09 AC265 candidate provenance preflight scaffold — PR #71 merged at `origin/main` SHA `03329530ce1375de63d1d5a0ecee6b5ce8ccb50d`; exact-main CI `34776703106` attempt 1 and staging `34777077865` attempt 1 / deployment `6425379348` passed. Candidate artifact `staging-verified-candidate` (`10323417853`) passed read-only hosted preflight run `34777223023` with `candidate_provenance_verified`. The main-only preflight workflow, strict provenance, authenticated policy mapping/outage-target contracts, and fail-closed collector port boundary remain scaffolding only; no protected collector/service protocol or hosted AC265 acceptance exists. AC265 remains open; see [session evidence](../sessions/2026-09-13.md).
- [x] Slice 09 AC211/AC266 evidence-tooling hardening — PR #74 merged at exact `main` SHA `f8e10db06b5e70ea6262a3531f7fab69965febc3`; exact-main CI `34792878043` and staging `34793282345` / deployment `6428325619` passed. Local `pnpm validate` passes 522 Vitest files / 4,091 passed + 1 skipped at 100% coverage; Playwright passes 101 functional plus 5 real-route checks; `pnpm db:verify` passes 50 pgTAP files / 1,818 checks with types matching. Focused AC211 and AC266 suites pass 59/59 and 83/83; adversarial reviews have no remaining findings. The tooling is landed, but no external criterion is closed. Slice 09 remains 279/283 and Slices 10–17 remain locked.
- [x] Slice 09 historical exact-main follow-up — PR #80 SHA `918f598525de772c82b0a0bcd82348ea8f5d523d`, CI `34823698333`, staging `34824312138` / deployment `6433521892`, and AC265 preflight `34824500796` passed. Authorization foundation `34824651793` failed at `staging_prepare`; AC209 run `34813947512` failed with `provider_graphql_error` and no receipt; AC211 run `35560241699` passed preflight but collection failed for insufficient samples (`commands=0`, `protectedRpcs=0`, `acceptances=0`, `queueFirstAttempts=0`) with no artifact. No active external criterion closed; AC266 is owner-deferred and unchecked.
- [x] Slice 09 exact-main CP-04d implementation promotion — PR #91 SHA `289ed3a2f4f92da383aa1464340f804777496257`, exact-main CI `35656504913`, and staging `35657406613` attempt 1 / deployment `6578526934` passed. This is private construction evidence only; At that checkpoint AC209, AC211, and AC265 were open, Slice 10 was locked, and AC266 was owner-deferred as a mandatory pre-release gate; DEC-105 later unblocked Slice 10 implementation without closing any of those criteria.
- [ ] AC266 post-Phase 2 production-readiness/release evidence remains deferred and is excluded from the active Phase 2 completion denominator.
- [ ] Slice 17 close-gate `/verify-infrastructure` passes.
- [ ] `/validate-phase` passes after every slice is complete.
