# Phase 2 / Slice 09: Content schemas, relations, activation, and block registry

**Status**: complete  
**Complexity**: L  
**Surface scope**: web  
**Depends on**: Slices 07 and 08  
**Spec depth floor**: 283  
**Acceptance criteria (authored)**: 283  
**Active release denominator**: 279 (AC266 owner-deferred under DEC-101; AC209 and AC211 deferred under DEC-104; AC265 deferred to pre-release under DEC-105)  
**Slice 09 implementation-completion denominator**: 279  
**Phase 2 implementation-completion denominator**: 1996  
**Slice 10 implementation prerequisites**: none.  
**Authored criterion policy**: Slice 09 is **279/279 active**; 283 authored Slice 09 IDs remain, with AC209, AC211, AC265, and AC266 authored and unchecked outside the active implementation denominator.  
**AC209 evidence status**: production-rollout/post-deployment evidence gate; remains authored and unchecked. Does not gate Slice 10 implementation or the initial controlled production deployment, and must pass before alerting is declared ready.  
**AC211 evidence status**: post-launch operational SLO acceptance; remains authored and unchecked. Does not gate the initial launch and is mandatory after initial launch.  
**AC265 evidence status**: mandatory pre-release hosted acceptance; remains authored and unchecked. AC265 is a mandatory pre-release gate and does not block Slice 10 implementation. Nine real staging role cases, ten hosted scenarios, signed exact artifact provenance, and the authenticated receipt are still required before release.  
**AC266 evidence status**: owner-deferred pre-release gate — AC266 is a mandatory pre-release production-readiness/release gate; remains unchecked and **open** and excluded from active Phase 2 implementation completion; not passed, accepted, waived, simulated, or inferred. It has no proven standalone acceptance path until the hosted-scope acceptance route binds its separate manual and axe verifiers.  
**Plan source**: [Phase 2 plan](../../../wiki/specs/phases/phase-2.md)  
**Preflight gate**: strict current-disk floor reconciled — [contract reconciliation](../verification/2026-09-02-slice-09-contract-reconciliation.md)
**Local QA-GREEN (active)**: 279/279 verified; 283 authored IDs remain — [evidence and external gates](../../../wiki/specs/audits/phase-02-slice-09-qa-green.md)

## 2026-09-21 AC265 CP-04c hosted artifact foundation (local/private only)

- CP-04c adds strict Ed25519 attestation over exact artifact bytes and a
  branded resolver with exact artifact kind/reference/key/subject/run/candidate/
  runner bindings. The resolver bounds its source set at **256** entries and
  fails closed outside exact membership.
- PR #90 promoted this private foundation at exact main SHA
  `e7525fa9ea80bbdf2325e8ce08d18930d6485b15`; exact-main CI
  `35634692281` succeeded, and staging workflow `35635650934` failed on
  `run_attempt=1` only at transient web release-identity propagation before
  succeeding on `run_attempt=2`. Deployment `6574859596` succeeded at
  `https://staging.wejamm.in`; the exact staging endpoints now serve the
  `e7525fa9ea80bbdf2325e8ce08d18930d6485b15` main SHA. The CP-04c promotion
  record predates the CP-04d retry hardening now promoted in PR #91. Candidate
  artifact `10656615428` has digest
  `sha256:5568778c8bec9eacd8090ae2020518caa070ce82b1a901aa4c7fe9a95f03d592`;
  deployment evidence artifact `10655784856` has digest
  `sha256:02422c5ef8b4988fe50bdc7d02771c286ac81c148e51bac6bc80927736ec461d`;
  staging p95 was `49.30431599999997 ms` and the automated axe digest was
  `00968b6a806db4993ab895f83fcb592af81a65ec925f9b38e6aa3140c0f87d87`.
- This is a locally validated private construction foundation only. Upstream
  authenticated manifest/registry/run authority and the external replay ledger
  remain open; no hosted artifact, hosted matrix, independently authenticated
  receipt, or AC265 acceptance is claimed. Focused local verification passes
  **5 files / 74 tests** and `pnpm type-check` is green.
- At that checkpoint totals were unchanged: Slice 09 remained **279/282 active**
  (**283 authored IDs**), Phase 2 remained **8/17** with **1,999/2,000 active
  criteria**, AC209/AC211/AC265 were open, Slice 10 was locked, and AC266 remained
  owner-deferred as a mandatory post-Phase 2 production-readiness/release gate.

## 2026-09-21 AC265 CP-04d signed source-manifest and authority foundation (local/private only)

- CP-04d adds a strict signed artifact-source manifest with canonical code-point
  ordering, exact source references, a server-derived authorization window, and
  a manifest digest separate from the request hash.
- The authority ledger implements immutable reserve-to-finalize/readback state,
  concurrency-safe source bindings, and replay protection. Readback exposes
  truthful `sourceSetComplete` and `kindComplete` fields only; neither field
  asserts acceptance. Resolver, semantic-subject, and protected-context
  boundaries reject structural/callback-only substitutes and snapshot mutable
  inputs before use.
- Staging verification now prevalidates inputs and retries the complete release
  contract for **13 attempts at 5 seconds**. Known focused TypeScript evidence
  is **16 files / 104 tests**. Focused database authority evidence is **78/78
  assertions** and concurrency evidence is **6/6** (**84/84 total**). After a
  fresh reset, `pnpm db:test` passed **61 files / 2,208 tests**;
  `pnpm db:lint` passed with unrelated existing warnings, and
  `pnpm db:types:check` passed. Final local `pnpm validate` passed **562 files**
  with **4,498 passed + 1 skipped / 4,499**, 100% coverage (**13,184
  statements, 9,862 branches, 2,164 functions, 12,263 lines**); Slice 09
  evidence passed, Playwright passed **101/101 functional** and **5/5
  real-route** checks, builds and bundle budgets passed, and local API p95 was
  **1.2129150000000095 ms**. Final local `pnpm db:verify` passed after a fresh
  reset with migrations through `20260921050000`; database lint had existing
  warnings only, **61 files / 2,208 tests** passed, and generated types matched.
  The initial validate failure was root-caused to a fixture `PUBLIC_KEY_PEM`
  re-export issue; after the fix, focused **8/8** and **12-repeat** stability
  checks passed before the successful rerun.
- PR #91 merged to `main` at exact SHA
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
  serious/critical **0/0**. These are exact-main CI and staging promotion
  proofs only; staging proof does not equal hosted AC265 acceptance. This
  remains local/private construction evidence: no hosted producer/source
  population, protected signer execution, retained hosted artifact,
  independently authenticated receipt, or complete hosted matrix exists.
  The fresh AC211 collection run `35673313035` passed preflight but failed
  closed for insufficient samples: `commands=0`, `protectedRpcs=0`,
  `acceptances=0`, `queueFirstAttempts=0`; `dataset=1`, `registry=0`,
  `productionRegistry=0`, and `releaseRegistry=0`. No artifact or SLO verdict
  exists, so AC211 remains open. At that checkpoint totals were **279/282 active**
  (**283 authored IDs**), **8/17** Phase 2 slices, and **1,999/2,000 active
  criteria**; AC209, AC211, and AC265 were open and Slice 10 was locked. AC266
  remained owner-deferred, and DEC-104 later moved AC209 and AC211 outside the
  active implementation denominator. See the [CP-04d
  verification record](../verification/2026-09-21-ac265-hosted-artifact-source-manifest.md).

## 2026-09-21 AC265 CP-04e protected publication (staging promotion only)

- Added the real protected context-capsule loader, exact CI/staging run,
  artifact, and archive-digest binding, quota-bounded ZIP handling, typed
  register/finalize/readback transport, canonical signing, finalized readback
  verification, and a main-only publication workflow retaining one allowlisted
  redacted bundle.
- Focused root verification passed **11 files / 52 tests**. Final local `pnpm
validate` passed **572 files** with **4,543 passed + 1 skipped / 4,544** and
  100% coverage. Fresh `pnpm db:verify` passed **62 files / 2,211 tests** after
  migration `20260921060000`.
- CP-04e is promoted through PR #93 at exact main SHA
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
  hosted AC265 acceptance. No protected context secret or signing configuration
  was populated and no genuine protected publication, retained hosted artifact,
  authenticated receipt, or complete hosted matrix ran. AC265 was open at that
  checkpoint. Totals were **279/282 active** (**283 authored IDs**), **8/17**
  Phase 2 slices, and **1,999/2,000 active criteria**; AC209/AC211 were open and
  Slice 10 was locked. AC266 remained owner-deferred, and DEC-104 later moved
  AC209 and AC211 outside the active implementation denominator. See the [CP-04e
  verification
  record](../verification/2026-09-21-ac265-hosted-artifact-source-manifest-publication.md).

## Tasks

- [x] Contract: lock Zod, data, registry, event, and route contracts
- [x] `QA` RED: failing contract, permission, unit, integration, component, accessibility, and applicable E2E tests
- [x] `BE` data, API, and policy implementation
- [x] `FE` Astro SSR and bounded React-island implementation
- [x] `QA` GREEN, adversarial verification, and canonical validation (latest
      promoted private foundation PR #91 main SHA
      `289ed3a2f4f92da383aa1464340f804777496257`; exact-main CI `35656504913`
      succeeded across all three jobs, and automatic staging run `35657406613`
      succeeded on `run_attempt=1` with deployment `6578526934`. Candidate
      artifact `10665966829` has digest
      `sha256:d51c0104d8ea7933e5d4a45af021b0ac2067a24150739390edb58e171cab827c`;
      deployment evidence artifact `10665756858` has digest
      `sha256:2724a98beb5e2152b7c601697c95042af508ee94d2e62da7ee143495362c9664`;
      source `artifactDigest` is
      `0e92da9874c0fae7e0d62fb4419678a83f00a8986087de558dc101c465451c04`;
      migration `20260921050000`; provider deployments are
      `dac978c4-fe9d-4c86-9cf4-53d96a42d45e` and
      `b27ddb9f-0ab3-4c07-88da-5ff8ea0b2f7b`; staging p95 was
      `29.956710999999927 ms` against the `500 ms` threshold; automated axe
      digest `6a7f59d9792a176e3032a9b410c6a0c1bb03850f27ed2918bc98fe82fddbbcf4`
      reported serious/critical `0/0`. These are exact-main CI and staging
      promotion proofs only; staging proof does not equal hosted AC265
      acceptance. Final canonical validation under
      exact Node `22.23.1` and pnpm `11.24.0` passed **551 Vitest files, 4,387
      passed + 1 intentional skip**, with **13,143/13,143 statements,
      9,850/9,850 branches, 2,160/2,160 functions, and 12,224/12,224 lines**
      at 100% coverage. The evidence-map gate passed; Playwright passed **101
      functional + 5 production-built Slice 09 real-route checks**. Builds,
      bundle budgets, and performance are green with API p95 **1.491154 ms**;
      `pnpm db:verify` passed **59 pgTAP files / 2,124 assertions**, with
      database lint and generated-type parity. Architecture compile passed
      **1,632 nodes / 10,125 edges** with 55 known lint issues. See the [CP-04b
      verification record](../verification/2026-09-21-ac265-approved-outage-target-registration.md).
      AC265 preflight `34824500796`
      passed, while authorization foundation run `34824651793` failed at
      `staging_prepare`; CP-01 is promoted and staging-green but seeds no
      target, while CP-02 is promoted but seeds no
      registry rows and does not establish hosted acceptance; CP-03 is promoted
      as code and staging deployment only, with no live signing-key
      configuration, registry rows, retained mapping/attestation artifact,
      attestation workflow run, independently authenticated receipt, or browser
      evidence. CP-04a is promoted but has no live target-signing key, seeded
      target, retained target/attestation artifact, protected workflow run,
      hosted matrix, or receipt; no hosted acceptance is claimed.
      CP-04b is promoted through PR #88 as a private registration foundation:
      implementation main SHA `52b66272e61331827c59ac1e169868474a2c09c8`, PR
      CI `35611484121`, exact-main CI `35612415141`, staging `35613284966`,
      deployment `6570861931`, and promotion artifact `10645302055` with digest
      `sha256:12f05e8371586996dc413b85b75167934045f342091defff5197435b8b707782`.
      Staging p95 was `32.589357 ms` and automated axe digest was
      `df2522f8512dcea587146f5bce43ad5232b94964d5048825ffdb745286dd772d`.
      No live policy/target/key, retained target/attestation/evidence artifact,
      hosted matrix, or independently authenticated receipt exists. Read-only
      AC209 verifier `35612514031` failed with `provider_graphql_error` after
      all preflight/protection/workspace gates, with no effects or receipt.
      AC266 is owner-deferred because the required real devices are unavailable,
      remains unchecked and excluded from active Phase 2 completion; the three
      active external release checks remain open.)
- [x] Documentation, runbooks, graph, feature ledger, and progress tracking

## Acceptance Criteria

- [x] **P2-S09-AC-001** — Keep content-type, field, relation, template, and block identities immutable, versioned, and removed only by deprecation or retirement; keys are never reused. [Architecture](../../../wiki/2026-08-02-architecture-design.md#phasing) §Phasing
- [x] **P2-S09-AC-002** — Keep dynamic schema storage normalized in definition/version tables with strictly validated JSONB; runtime DDL, general ORM/EAV escape hatches, and caller-authored executable validators are forbidden. [Architecture](../../../wiki/2026-08-02-architecture-design.md#phasing) §Phasing
- [x] **P2-S09-AC-003** — Make CMS-03A-01 create the type, initial version, fields, relations, template bindings, capability bindings, locale/workflow references, and compiled artifact reference in one atomic idempotent transaction. [Architecture](../../../wiki/2026-08-02-architecture-design.md#phasing) §Phasing
- [x] **P2-S09-AC-004** — Limit CMS-03A-02 and CMS-03A-03 to edits of an existing unactivated draft; no child definition is independently committed or exposed. [Architecture](../../../wiki/2026-08-02-architecture-design.md#phasing) §Phasing
- [x] **P2-S09-AC-005** — Treat sourceLocale as the canonical authoring locale and defaultLocale as the governed delivery fallback root; no_fallback fields do not borrow it. [Architecture](../../../wiki/2026-08-02-architecture-design.md#phasing) §Phasing
- [x] **P2-S09-AC-006** — Resolve workflowKey/workflowVersion and owner/capability references through protected registries; caller strings never create authority. [Architecture](../../../wiki/2026-08-02-architecture-design.md#phasing) §Phasing
- [x] **P2-S09-AC-007** — Compile each definition deterministically to strict Zod/OpenAPI/editor/database/renderer artifacts and reject unknown fields. [Architecture](../../../wiki/2026-08-02-architecture-design.md#phasing) §Phasing
- [x] **P2-S09-AC-008** — Persist one immutable content-addressed SchemaArtifact with compiler version, contract reference, manifests, and artifact hash; repeated compilation is hash-stable. [Architecture](../../../wiki/2026-08-02-architecture-design.md#phasing) §Phasing
- [x] **P2-S09-AC-009** — Classify compatibility as additive, conditional, breaking, or unknown and require the corresponding migration and evidence gates before activation. [Architecture](../../../wiki/2026-08-02-architecture-design.md#phasing) §Phasing
- [x] **P2-S09-AC-010** — Require activation to have zero unresolved references, valid template/block compatibility, exact dry-run evidence, and a valid migration plan for conditional or breaking changes. [Architecture](../../../wiki/2026-08-02-architecture-design.md#phasing) §Phasing
- [x] **P2-S09-AC-011** — Encode relation optionality with finite bounds: one uses min 0 or 1 and max 1, while many records explicit finite min/max bounds. [Architecture](../../../wiki/2026-08-02-architecture-design.md#phasing) §Phasing
- [x] **P2-S09-AC-012** — Keep block implementation code-owned; CMS stores only an immutable registered version and props identity/evidence, and human administration cannot register or mutate it. [Architecture](../../../wiki/2026-08-02-architecture-design.md#phasing) §Phasing
- [x] **P2-S09-AC-013** — Keep protected registry list/detail projections inside Shard 03, authenticated, capability-scoped, tenant/acting-context filtered, no-store, and separate from public delivery. [Architecture](../../../wiki/2026-08-02-architecture-design.md#phasing) §Phasing
- [x] **P2-S09-AC-014** — Make Shard 04 consume immutable publication projections only; public routes never select draft or control-plane registry tables. [Architecture](../../../wiki/2026-08-02-architecture-design.md#phasing) §Phasing
- [x] **P2-S09-AC-015** — Apply the IA common envelope and its complete per-model exceptions matrix, including the closed resource-state enums consumed from BE03b/BE03c; owner_id is an ownership reference and never an authority grant. [Architecture](../../../wiki/2026-08-02-architecture-design.md#phasing) §Phasing
- [x] **P2-S09-AC-016** — Use closed definition states and monotonic versioning; active definitions are immutable, blocked may return to draft only through an audited transition, and migration state is separate. [Architecture](../../../wiki/2026-08-02-architecture-design.md#phasing) §Phasing
- [x] **P2-S09-AC-017** — Reject CMS types, fields, relations, templates, and blocks that impersonate reserved identity, rights, money, entitlement, credential, evidence, institution, or authority concepts. [Architecture](../../../wiki/2026-08-02-architecture-design.md#phasing) §Phasing
- [x] **P2-S09-AC-018** — Register exactly the eight BE03a operations CMS-03A-01 through CMS-03A-08 with their declared method, path, operation ID, request schema, success status, auth, middleware, rate, timeout, cache, SLO, and event behavior. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-019** — Require discovered Hono routes and generated OpenAPI to match every BE03a route-registry row with no missing, extra, duplicate, or stale operation. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-020** — Run request ID/media/query guards and strict Zod parsing before authorization; never authorize a body that has not passed structural parsing. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-021** — Enforce the 256 KiB raw JSON ceiling, maximum depth 8, maximum keys 128, maximum arrays 128, and field-specific string/object bounds. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-022** — Require Idempotency-Key of 8–128 printable ASCII on every mutation and reject missing, malformed, aliased, or replay-mismatched keys. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-023** — Require exact quoted positive-decimal If-Match on A02, A03, A04, and A08; A01 has no If-Match for a new type and reads have none. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-024** — Replay the same committed idempotency key and request as the same result, but return typed conflict for changed body, actor, path, version, or digest. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-025** — Apply BE00 canonical middleware order, cms-console CORS and CSRF to human mutations, and no browser CSRF authority to release-worker requests. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-026** — Accept only the exact four release header names and map them to keyId, issuedAt, nonce, and signature; aliases and JSON copies are invalid. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-027** — Verify release raw bytes and release headers before JSON parsing; release requests use the non-browser signed principal and release-only CORS policy. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-028** — Bind the Ed25519 signing input to operation ID, exact received header values, lowercase sha256(rawBody), fixed domain separator, and immutable field order. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-029** — Key rate buckets and the concurrent-definition cap to verified actor, acting party, or release principal; activation and registration use separate limits. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-030** — Enforce each route's declared limit, 15,000 ms deadline, no-store policy, response target, and Tier 2 SLO from the route registry. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-031** — Return BE00 ApiError with code, message, requestId, and bounded safe details for every declared failure; never return raw exceptions. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-032** — Implement the exhaustive 400, 401, 403, 404, 409, 415, 422, 429, 502, 503, 504, and applicable 500 mapping for all eight operations. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-033** — Use 400 for malformed structure, 401 for missing/expired or invalid principal, and 415 for unsupported media before domain mutation. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-034** — Return 403 when a readable resource exists but capability is insufficient, and indistinguishable 404 when owner/scope/resource existence is concealed. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-035** — Bound error details to BE00's allowlist: at most 50 JSON-pointer violations, safe reason codes, and no hidden policy predicates or private values. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-036** — Derive actor, acting party, ownership, and capability context server-side; ignore caller-supplied authority metadata. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-037** — Resolve RLS predicates through a schema-qualified immutable helper and execute mutations only through named schema-qualified RPCs. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-038** — Allow a remote compiler/registry adapter only with Zod response validation, 2,000 ms RPC timeout, 15s/60s/300s pre-effect retries with jitter, five-failure/60s circuit breaking, and 502/503/504 mapping. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-039** — CMS-03A-01 ContentTypeDraftRequest is a strict object with exactly typeKey, label, ownerCapability, sourceLocale, defaultLocale, workflowKey, workflowVersion, defaultTemplateVersionId, fields, relations, templateBindings, and capabilityBindings. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-040** — CMS-03A-01 typeKey is lowercase ASCII matching ^[a-z][a-z0-9_]{1,63}$ and is rejected when built-in, reserved, retired, or already used. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-041** — CMS-03A-01 label is Unicode length 2–120 and normalized to NFC. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-042** — CMS-03A-01 ownerCapability is length 1–128 and resolves to a protected capability-registry member. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-043** — CMS-03A-01 sourceLocale and defaultLocale each satisfy the BCP 47 contract with the distinct authoring and fallback semantics. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-044** — CMS-03A-01 workflowKey matches the protected lowercase key grammar and workflowVersion is a positive decimal version. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-045** — CMS-03A-01 defaultTemplateVersionId is UUID or null; a present reference must be readable, immutable, and compatible. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-046** — CMS-03A-01 fields is an array of 0–128 strict FieldDefinitionInput values and rejects partial aggregate insertion. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-047** — CMS-03A-01 each initial field carries stableFieldId, FieldKey, closed kind, constraints, protected validator pair, default mode/value, localization mode, editorConfig, and lifecycle. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-048** — CMS-03A-01 relations is a bounded array of complete allowlisted RelationBindingInput values. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-049** — CMS-03A-01 templateBindings is a bounded array of immutable template-version UUID references with a maximum of 32. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-050** — CMS-03A-01 capabilityBindings is a bounded array of protected capability key/version references with a maximum of 32. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-051** — CMS-03A-01 capability bindings remain references and never grant authority by their presence. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-052** — CMS-03A-01 has no parent path and no If-Match create precondition; unique type-key locking serializes competing creates. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-053** — CMS-03A-01 inserts the type/version aggregate and matching SchemaArtifact under the deferred composite foreign key in one transaction. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-054** — CMS-03A-01 returns strict 201 ContentTypeVersionResource with ResourceMeta and the complete authorized type/version projection. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-055** — CMS-03A-01 derives owner/created-by and returns ETag, Location, X-Request-Id, and Cache-Control: no-store without exposing unauthorized child data. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-056** — CMS-03A-02 FieldSchemaChangeRequest is a strict object with the exact field shape plus migrationPlanId and rejects unknown keys. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-057** — CMS-03A-02 path contentTypeId and versionId are UUIDs and versionId must belong to contentTypeId after structural validation. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-058** — CMS-03A-02 stableFieldId is UUID when changing/deprecating an existing field and is omitted only for a new field. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-059** — CMS-03A-02 key matches ^[a-z][a-z0-9_]{1,63}$; key identity cannot be silently changed or reused. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-060** — CMS-03A-02 kind is exactly one of short_text, long_text, rich_text, boolean, integer, decimal, date, datetime, enum, taxonomy, relation, media, object, or list. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-061** — CMS-03A-02 constraints are a strict kind-specific object capped at 64 keys, depth 4, and 8 KiB, with minLength/maxLength/minimum/maximum/enumValues/itemKind refinements and min ≤ max. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-062** — CMS-03A-02 validatorKey and validatorVersion are both null or both protected registry references; free-form pattern, expression, code, or regex execution is rejected. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-063** — CMS-03A-02 required is boolean and cannot be added over populated data without a proven complete non-fabricating migration. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-064** — CMS-03A-02 defaultMode is none, literal, or inherited; literal requires defaultValue and none/inherited forbid it, preserving missing/null distinction. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-065** — CMS-03A-02 localizationMode is exactly none, localized, or no_fallback and is not inferred from defaultLocale. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-066** — CMS-03A-02 editorConfig is strict with label 1–120, helpText ≤500 when present, and order integer 0–10000. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-067** — CMS-03A-02 lifecycle is active, deprecated, or retired; physical lifecycle is one state and no deletion shortcut exists. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-068** — CMS-03A-02 migrationPlanId is required nullable UUID: null is permitted only when the change is additive/no-data, and a UUID is required for conditional or breaking compatibility. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-069** — CMS-03A-02 writes only an unactivated draft under exact If-Match/CAS and preserves immutable stable identity. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-070** — CMS-03A-02 rejects validation, authorization, or persistence failure without a partial field row or aggregate mutation. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-071** — CMS-03A-02 returns strict 201 FieldDefinitionVersionResource with stable ID, key/kind, validator/default/localization/lifecycle, version, hash, and migration plan. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-072** — CMS-03A-03 RelationBindingRequest is a strict object with exactly fieldId, targetKind, targetType, projectionKey, cardinality, min, max, ordered, and onUnavailable. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-073** — CMS-03A-03 fieldId is a UUID for a relation-kind FieldDefinitionVersion in the same type version. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-074** — CMS-03A-03 targetKind is exactly content or domain and targetType is a lowercase allowlisted key of length 1–96. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-075** — CMS-03A-03 projectionKey is a named allowlisted projection key of length 1–128; arbitrary SQL, table names, and dynamic projections are rejected. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-076** — CMS-03A-03 cardinality is exactly one or many and is stored as declared relation metadata. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-077** — CMS-03A-03 min is finite integer 0–128, max is finite non-null integer 1–128, and min cannot exceed max. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-078** — CMS-03A-03 cardinality one requires min 0 or 1 and max exactly 1; many always records explicit finite bounds. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-079** — CMS-03A-03 ordered is boolean and preserves declared order semantics in the relation definition. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-080** — CMS-03A-03 onUnavailable is omit, block, or placeholder; missing behavior is not silently treated as omit. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-081** — CMS-03A-03 placeholder fallback is exactly {status: unavailable, reason: unavailable} with no target identifier, type, key, title, data, or existence distinction. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-082** — CMS-03A-03 target authority is resolved by each consumer read and a relation binding never grants authority. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-083** — CMS-03A-03 writes only a draft under exact If-Match/CAS, unique field/version binding, and no mutation on invalid bounds. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-084** — CMS-03A-03 returns strict 201 RelationDefinitionResource with target, projection, cardinality, bounds, ordering, and unavailable behavior. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-085** — CMS-03A-04 SchemaActivationRequest is a strict object with expectedVersion, dryRunId, approvalIds, migrationPlanId, and optional expectedActivationEvidenceHash. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-086** — CMS-03A-04 expectedVersion is a positive decimal string and exact strong If-Match must match the candidate version. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-087** — CMS-03A-04 dryRunId is UUID for an immutable report containing counts, hashes, compiler version, and result. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-088** — CMS-03A-04 approvalIds is an array of 1–8 UUID references with no duplicates. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-089** — CMS-03A-04 approval IDs are request references only; the server resolves distinct humans, capabilities, assignment, and recent MFA. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-090** — CMS-03A-04 frozen WorkflowPolicyEvidence contains key, version, policyHash, riskClass, requiredDecisionCount 1–8, requiredCapabilities, and approvalEvidenceHash. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-091** — CMS-03A-04 protected policy requires a named capability, at least two required decisions, distinct humans, and recent acting-context-bound MFA. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-092** — CMS-03A-04 ordinary policy uses the server-resolved policy count and never assumes a universal two-approval rule. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-093** — CMS-03A-04 migrationPlanId is UUID or null; null is valid only for additive/no-data activation. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-094** — CMS-03A-04 expectedActivationEvidenceHash is optional lowercase 64-hex equality evidence; mismatch returns conflict and never changes server policy. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-095** — CMS-03A-04 rechecks zero unresolved field/relation/template/block references and all allowlists before switching. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-096** — CMS-03A-04 verifies exact dry-run counts/hashes/compiler version and matching immutable SchemaArtifact before activation. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-097** — CMS-03A-04 locks candidate and current active rows, then performs one compare-and-swap activation decision. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-098** — CMS-03A-04 never mutates a previously active version; the old active version remains readable until the switch commits. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-099** — CMS-03A-04 creates or advances SchemaMigrationPlan only after compatibility, evidence, and migration gates pass. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-100** — CMS-03A-04 returns 202 with SchemaActivationResource and jobId when work is queued, otherwise the declared synchronous success resource. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-101** — CMS-03A-04 records cms.schema.activated.v1 with the immutable activation-evidence snapshot only after the committed switch. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-102** — CMS-03A-04 invalidates approval/evidence when candidate hash, compiler, dependency, reference, or authority changes and forces review again. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-103** — CMS-03A-05 BlockRegistrationRequest is a strict object with the exact key/version, props, renderer, children, slot, data, accessibility, compatibility, lifecycle, and releaseDigest fields. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-104** — CMS-03A-05 blockKey matches ^[a-z][a-z0-9._-]{0,95}$ and blockVersion is positive safe integer; the pair is never reused. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-105** — CMS-03A-05 accepts lifecycle supported only; deprecated and withdrawn are derived solely from CMS-03A-08 events. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-106** — CMS-03A-05 propsSchemaRef is a protected artifact reference with no traversal or URL semantics. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-107** — CMS-03A-05 propsSchemaHash is lowercase 64-hex and remains immutable identity beside propsSchemaRef. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-108** — CMS-03A-05 propsSchemaSnapshot is a strict normalized object with schemaVersion, fields, name/kind/required/constraints, and additionalProperties false. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-109** — CMS-03A-05 propsSchemaSnapshot is capped at 128 fields with bounded nested JSON and rejects unknown runtime keywords or executable content. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-110** — CMS-03A-05 propsSnapshotHash equals lowercase SHA-256 of exact RFC 8785/JCS UTF-8 normalized snapshot bytes. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-111** — CMS-03A-05 propsSnapshotAttestation uses algorithm Ed25519, a trusted ReleaseKeyId, and canonical padded base64 for a 64-byte signature. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-112** — CMS-03A-05 attestation signing binds block key/version, props ref/hash, normalized snapshot hash, and releaseDigest in the locked domain-separated byte order. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-113** — CMS-03A-05 rendererRef is a registered code-manifest reference of length 1–160; URLs, source text, and uploaded modules are rejected. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-114** — CMS-03A-05 allowedChildren is a strict BlockKey array capped at 32 and slotRules enforce maxDepth 1–16 and maxNodes 1–512. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-115** — CMS-03A-05 dataSourcePermissions is an allowlisted key array capped at 32; arbitrary data sources and projections are rejected. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-116** — CMS-03A-05 accessibility is strict with nameRequired, keyboard true, focusOrder document or managed, and statusAnnouncement. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-117** — CMS-03A-05 compatibility is strict with bounded minSchemaCompiler and maxSchemaCompiler values. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-118** — CMS-03A-05 releaseDigest is lowercase 64-hex and binds the signed release manifest. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-119** — CMS-03A-05 raw body and exact release headers are verified before JSON parsing against the trusted non-revoked Ed25519 key. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-120** — CMS-03A-05 rejects more than five minutes clock skew, nonce replay within at least ten minutes, unknown/revoked keys, and conflicting digest. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-121** — CMS-03A-05 persists immutable outer release evidence and props-attestation evidence; failed audit/outbox leaves no accepted registration. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-122** — CMS-03A-05 returns strict 201 BlockDefinitionVersionResource with full worker-only registration and verification evidence. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-123** — CMS-03A-05 never exposes release body, signature, nonce, attestation, or verification evidence to browser FE state. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-124** — CMS-03A-06 ContentSchemaRegistryListQuery is strict and rejects unknown query keys before authorization or database access. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-125** — CMS-03A-06 resourceKind is optional but, when present, is one of the eight declared RegistryResourceKind discriminators. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-126** — CMS-03A-06 keyPrefix is optional, lowercase allowlisted, and bounded to ^[a-z][a-z0-9._-]{0,63}$. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-127** — CMS-03A-06 lifecycle is a closed union and accepts only values compatible with the selected lifecycle-bearing resourceKind. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-128** — CMS-03A-06 state is a separate closed union for state-only resources and is never interpreted as a lifecycle value. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-129** — CMS-03A-06 rejects lifecycle on content_type_version, relation_definition, schema_artifact, template_binding, or capability_binding and rejects state on lifecycle-bearing kinds. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-130** — CMS-03A-06 applies omitted-resourceKind lifecycle filters only to compatible lifecycle-bearing kinds and returns no state-only matches. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-131** — CMS-03A-06 limit defaults to 25 and is integer 1–100; response items are capped at 100. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-132** — CMS-03A-06 cursor is opaque, 1–512 characters, and binds query/filter/sort/direction and acting scope. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-133** — CMS-03A-06 sort is key, createdAt, updatedAt, or version and direction is asc or desc with deterministic immutable-ID tie-break. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-134** — CMS-03A-06 returns 200 ContentSchemaRegistryListPage with discriminated ContentSchemaRegistryRecord items and nullable nextCursor. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-135** — CMS-03A-06 each list resource is capability-safe and discriminated; block rows use BlockDefinitionRegistryRecord rather than full worker resource. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-136** — CMS-03A-06 requires authenticated cms.schema_registry.read or schema-designer read scope and omits concealed rows. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-137** — CMS-03A-06 sends Cache-Control: no-store and never selects public delivery or control-plane private payloads. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-138** — CMS-03A-06 rejects Idempotency-Key, If-Match, request bodies, and all mutation effects; only rate/telemetry counters may change. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-139** — CMS-03A-07 accepts only strict contentTypeId and versionId UUID path parameters belonging to one type; labels cannot substitute for IDs. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-140** — CMS-03A-07 rejects query strings and request bodies; Idempotency-Key and If-Match are absent and Content-Type is not required. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-141** — CMS-03A-07 requires authenticated schema-registry-read or schema-designer read scope with acting-context/RLS recheck. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-142** — CMS-03A-07 returns 403 for a known readable parent lacking required detail capability and 404 for hidden, absent, or mismatched type/version. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-143** — CMS-03A-07 returns 200 ContentSchemaRegistryDetail with one ContentTypeVersionResource and bounded fields, relations, schemaArtifact, templateBindings, capabilityBindings, and blockDefinitions. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-144** — CMS-03A-07 always includes capability-safe SchemaArtifact identity/hash and never has an optional artifact omission flag. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-145** — CMS-03A-07 projects only safe BlockDefinitionRegistryRecord fields and excludes snapshot, attestation, release keys/body/nonce hashes, verification timestamps, source, and executable evidence. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-146** — CMS-03A-07 sends Cache-Control: no-store and never selects public delivery tables or private control-plane payloads. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-147** — CMS-03A-07 has zero mutation side effects on success or failure: no insert/update/delete, idempotency reservation, audit/outbox mutation, migration lease, or state transition. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-148** — CMS-03A-07 maps projection dependency-invalid-response, dependency-unavailable, dependency-deadline-exceeded, and internal failures to safe declared errors; no hidden existence or capability graph leaks. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-149** — CMS-03A-08 BlockLifecycleAdvanceRequest is strict with fromLifecycle, toLifecycle, expectedVersion, and releaseDigest. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-150** — CMS-03A-08 blockDefinitionVersionId is an existing UUID path resource; no new key/version can be created by the lifecycle route. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-151** — CMS-03A-08 fromLifecycle is supported or deprecated and must equal the server-derived current lifecycle. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-152** — CMS-03A-08 toLifecycle is deprecated or withdrawn and the only allowed transitions are supported → deprecated → withdrawn. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-153** — CMS-03A-08 expectedVersion is a positive decimal string and is checked under lock with exact strong If-Match. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-154** — CMS-03A-08 releaseDigest is lowercase 64-hex and must match the registered immutable block release. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-155** — CMS-03A-08 verifies operation-specific raw body and exact four release headers with Ed25519 before parsing or state lookup. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-156** — CMS-03A-08 claims the durable (releaseKeyId, sha256(nonce)) receipt before accepting lifecycle mutation and retains it at least ten minutes. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-157** — CMS-03A-08 locks the block version, checks expected lifecycle/version/digest, and rejects stale or duplicate transitions. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-158** — CMS-03A-08 appends one immutable lifecycle event and never updates the BlockDefinitionVersion row or mutable lifecycle column. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-159** — CMS-03A-08 commits lifecycle event, nonce receipt consumption, audit, and outbox atomically; failure rolls all effects back. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-160** — CMS-03A-08 returns strict 201 BlockLifecycleEventResource with event identity, transition, digest, release verification, and event type. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-161** — CMS-03A-08 treats duplicate idempotency or digest replay as exact replay only when the signed nonce/body is identical; conflicts never append another event. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-162** — CMS-03A-08 derives effective lifecycle from initial supported registration plus ordered immutable events and never stores a duplicate mutable lifecycle state. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-163** — CMS-03A-08 emits cms.block.lifecycle.changed.v1 only after commit with identifier-only safe payload. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-164** — CMS-03A-08 keeps all lifecycle controls, nonce evidence, and WEBHOOK_REJECTED outcomes on the release-worker boundary; no browser mutation path exists. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Route Registry, Route field validation matrix, Request/Response Contracts, Database Schema, Middleware & Policies, Data Flow, Error Handling, Observability, Testing Strategy
- [x] **P2-S09-AC-165** — Every one of the eleven BE03a tables carries the IA envelope id, owner_id, closed state, monotonic version, created_at, and updated_at, except only the documented physical-state/timestamp-renewal cases. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Database Schema (lines 976–1041), Middleware & Policies (lines 1043–1067)
- [x] **P2-S09-AC-166** — Immutable and append-only rows pin updated_at = created_at and reject UPDATE/DELETE; only advisory presence is allowed to renew timestamps in the broader IA model. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Database Schema (lines 976–1041), Middleware & Policies (lines 1043–1067)
- [x] **P2-S09-AC-167** — cms_content_types persists UUID identity, owner/state/version/timestamps, immutable type_key, owner_capability, built_in, and created_by with unique never-reused key and scoped indexes. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Database Schema (lines 976–1041), Middleware & Policies (lines 1043–1067)
- [x] **P2-S09-AC-168** — cms_content_type_versions persists parent/type/version identity, workflow/locale/template/artifact references, definition hash, compatibility, supersedes/dry-run data, and server-frozen activation evidence with unique active-version constraint. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Database Schema (lines 976–1041), Middleware & Policies (lines 1043–1067)
- [x] **P2-S09-AC-169** — cms_content_type_template_bindings persists parent version, template UUID, position, envelope, unique parent/template pair, and immutable-after-activation binding resolved by named compatibility RPC. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Database Schema (lines 976–1041), Middleware & Policies (lines 1043–1067)
- [x] **P2-S09-AC-170** — cms_content_type_capability_bindings persists parent version, protected capability key/version, envelope, unique binding, and reference-only semantics that never grant authority. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Database Schema (lines 976–1041), Middleware & Policies (lines 1043–1067)
- [x] **P2-S09-AC-171** — cms_field_definition_versions persists stable field identity, key/kind, constraints, validator/default/localization/editor/lifecycle data, unique type-version field/key, and deprecation without physical deletion. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Database Schema (lines 976–1041), Middleware & Policies (lines 1043–1067)
- [x] **P2-S09-AC-172** — cms_relation_definitions persists relation field FK, target kind/type/projection, cardinality, finite bounds, ordering, unavailable behavior, unique field binding, and allowlisted target resolution without authority escalation. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Database Schema (lines 976–1041), Middleware & Policies (lines 1043–1067)
- [x] **P2-S09-AC-173** — cms_schema_migration_plans persists source/target versions, additive/conditional/breaking classification, transform, dry-run report, durable cursor/count/hash/error counters, worker state, and unique version pair. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Database Schema (lines 976–1041), Middleware & Policies (lines 1043–1067)
- [x] **P2-S09-AC-174** — cms_schema_artifacts persists one compiled terminal artifact per type version with compiler, contract ref, manifests, immutable hash, composite ownership FK, and no update/delete. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Database Schema (lines 976–1041), Middleware & Policies (lines 1043–1067)
- [x] **P2-S09-AC-175** — cms_block_definition_versions persists registered physical state, immutable block key/version, props ref/hash/snapshot/attestation, renderer/children/slot/data/accessibility/compatibility, release digest, and outer verification evidence. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Database Schema (lines 976–1041), Middleware & Policies (lines 1043–1067)
- [x] **P2-S09-AC-176** — cms_release_nonce_receipts persists unique release key plus nonce hash, issued/expiry/consumed times, operation, raw/signature hashes, verification outcome, and at-least-ten-minute retention before signed acceptance. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Database Schema (lines 976–1041), Middleware & Policies (lines 1043–1067)
- [x] **P2-S09-AC-177** — cms_block_definition_lifecycle_events persists recorded envelope, existing block FK, from/to lifecycle, release digest/evidence, unique transition, append-only immutability, and derived-lifecycle ordering. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Database Schema (lines 976–1041), Middleware & Policies (lines 1043–1067)
- [x] **P2-S09-AC-178** — All eleven table uniques, foreign keys, partial active indexes, and owner/time/query indexes are enforced in PostgreSQL; keys and immutable evidence are never reused or rewritten. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Database Schema (lines 976–1041), Middleware & Policies (lines 1043–1067)
- [x] **P2-S09-AC-179** — The deferred composite SchemaArtifact FK is checked in the same transaction; every UUID FK and registry reference is validated before any aggregate becomes visible. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Database Schema (lines 976–1041), Middleware & Policies (lines 1043–1067)
- [x] **P2-S09-AC-180** — The SQL API exposes only the eight named cms_* RPCs for these operations; anon/authenticated roles have no direct table INSERT/UPDATE/DELETE grants. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Database Schema (lines 976–1041), Middleware & Policies (lines 1043–1067)
- [x] **P2-S09-AC-181** — RLS is enabled and forced on every table, reads are scope/acting-context filtered, WITH CHECK re-resolves allowlists/current state, and a schema-qualified immutable helper is used. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Database Schema (lines 976–1041), Middleware & Policies (lines 1043–1067)
- [x] **P2-S09-AC-182** — Service-role access is limited to named migration/worker functions with empty search_path; workers receive only bounded IDs/version/counters and cannot directly mutate tables. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Database Schema (lines 976–1041), Middleware & Policies (lines 1043–1067)
- [x] **P2-S09-AC-183** — CMS-03A-01 commits child definitions, artifact, idempotency completion, audit, and outbox effects atomically; failed audit/outbox rolls back the aggregate. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Database Schema (lines 976–1041), Middleware & Policies (lines 1043–1067)
- [x] **P2-S09-AC-184** — CMS-03A-06 and CMS-03A-07 use projection-only RPCs and perform no definition/migration/idempotency/audit/outbox mutation on success or failure. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Database Schema (lines 976–1041), Middleware & Policies (lines 1043–1067)
- [x] **P2-S09-AC-185** — Retention preserves active/superseded definitions and migration evidence; retirement is state, key uniqueness is forever, and legal hold/incident fencing blocks purge. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Database Schema (lines 976–1041), Middleware & Policies (lines 1043–1067)
- [x] **P2-S09-AC-186** — Definition states follow draft → review → approved → scheduled or active → superseded or retired, with blocked → draft only through audited transition; active versions are immutable. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Data Flow (lines 1071–1137), Error Handling (lines 1149–1166), Observability (lines 1168–1176), Testing Strategy (lines 1178–1210)
- [x] **P2-S09-AC-187** — Migration states follow draft → dry_running → ready or blocked → running → verifying → completed, failed_retryable, or failed_terminal; cursor, counts, transform/compiler hash, and source/target hashes are durable. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Data Flow (lines 1071–1137), Error Handling (lines 1149–1166), Observability (lines 1168–1176), Testing Strategy (lines 1178–1210)
- [x] **P2-S09-AC-188** — A failed migration keeps the old active version readable, never deletes rows, and cannot retry a changed transform; worker lease expiry resumes through CAS. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Data Flow (lines 1071–1137), Error Handling (lines 1149–1166), Observability (lines 1168–1176), Testing Strategy (lines 1178–1210)
- [x] **P2-S09-AC-189** — Activation is compare-and-swap; evidence, approval, reference, compiler, allowlist, or dependency changes invalidate the candidate and require review again. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Data Flow (lines 1071–1137), Error Handling (lines 1149–1166), Observability (lines 1168–1176), Testing Strategy (lines 1178–1210)
- [x] **P2-S09-AC-190** — BE00 event envelopes contain eventId, eventType, schemaVersion, occurredAt, producer, correlationId, causationId, aggregateType, aggregateId, decimal aggregateVersion, and IDs only. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Data Flow (lines 1071–1137), Error Handling (lines 1149–1166), Observability (lines 1168–1176), Testing Strategy (lines 1178–1210)
- [x] **P2-S09-AC-191** — cms.schema.activated.v1 includes schema/version IDs and the immutable activation-evidence snapshot; no field values, private content, or authority are emitted. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Data Flow (lines 1071–1137), Error Handling (lines 1149–1166), Observability (lines 1168–1176), Testing Strategy (lines 1178–1210)
- [x] **P2-S09-AC-192** — Consumers process events at least once, deduplicate by event identity, enforce monotonic aggregate version, and route unknown versions to DLQ. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Data Flow (lines 1071–1137), Error Handling (lines 1149–1166), Observability (lines 1168–1176), Testing Strategy (lines 1178–1210)
- [x] **P2-S09-AC-193** — Every A01 failure maps to its declared validation/auth/scope/key/idempotency/RPC error and leaves no partial aggregate or false success. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Data Flow (lines 1071–1137), Error Handling (lines 1149–1166), Observability (lines 1168–1176), Testing Strategy (lines 1178–1210)
- [x] **P2-S09-AC-194** — Every A02 failure maps to its declared validation/auth/hidden-parent/immutable-key/stale-version/migration/RPC error and leaves the prior draft unchanged. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Data Flow (lines 1071–1137), Error Handling (lines 1149–1166), Observability (lines 1168–1176), Testing Strategy (lines 1178–1210)
- [x] **P2-S09-AC-195** — Every A03 failure maps to its declared validation/auth/hidden-parent/duplicate-relation/allowlist/bounds/RPC error and leaves the prior schema unchanged. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Data Flow (lines 1071–1137), Error Handling (lines 1149–1166), Observability (lines 1168–1176), Testing Strategy (lines 1178–1210)
- [x] **P2-S09-AC-196** — Every A04 failure maps to its declared validation/auth/MFA/policy/approval/artifact/dry-run/compatibility/stale-state/RPC error and preserves the old active version. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Data Flow (lines 1071–1137), Error Handling (lines 1149–1166), Observability (lines 1168–1176), Testing Strategy (lines 1178–1210)
- [x] **P2-S09-AC-197** — Every A05 failure maps to its declared signature/principal/manifest/props/digest/duplicate/dependency/RPC error and creates no second registration. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Data Flow (lines 1071–1137), Error Handling (lines 1149–1166), Observability (lines 1168–1176), Testing Strategy (lines 1178–1210)
- [x] **P2-S09-AC-198** — Every A06 failure maps malformed query/cursor, UNAUTHENTICATED, FORBIDDEN, VALIDATION_FAILED, RATE_LIMITED, DEPENDENCY_INVALID_RESPONSE, DEPENDENCY_UNAVAILABLE, DEPENDENCY_DEADLINE_EXCEEDED, and INTERNAL_ERROR safely without registry mutation. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Data Flow (lines 1071–1137), Error Handling (lines 1149–1166), Observability (lines 1168–1176), Testing Strategy (lines 1178–1210)
- [x] **P2-S09-AC-199** — Every A07 failure maps malformed UUID/header, UNAUTHENTICATED, FORBIDDEN, NOT_FOUND, RATE_LIMITED, DEPENDENCY_INVALID_RESPONSE, DEPENDENCY_UNAVAILABLE, DEPENDENCY_DEADLINE_EXCEEDED, and INTERNAL_ERROR safely without registry mutation. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Data Flow (lines 1071–1137), Error Handling (lines 1149–1166), Observability (lines 1168–1176), Testing Strategy (lines 1178–1210)
- [x] **P2-S09-AC-200** — Every A08 failure maps to its declared signature/principal/path/lifecycle/digest/nonce/idempotency/dependency error and appends no lifecycle event. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Data Flow (lines 1071–1137), Error Handling (lines 1149–1166), Observability (lines 1168–1176), Testing Strategy (lines 1178–1210)
- [x] **P2-S09-AC-201** — Mutation clients retry 503/504 only with the same idempotency key after status reconciliation; protected reads retry canonical query/path without mutation headers. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Data Flow (lines 1071–1137), Error Handling (lines 1149–1166), Observability (lines 1168–1176), Testing Strategy (lines 1178–1210)
- [x] **P2-S09-AC-202** — Unknown or ambiguous mutation outcomes remain pending/degraded and are reconciled by idempotency/status, never guessed as active or successful. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Data Flow (lines 1071–1137), Error Handling (lines 1149–1166), Observability (lines 1168–1176), Testing Strategy (lines 1178–1210)
- [x] **P2-S09-AC-203** — Relation reads recheck current target visibility and apply omit, block, or the exact opaque placeholder without copying target authority or private fields. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Data Flow (lines 1071–1137), Error Handling (lines 1149–1166), Observability (lines 1168–1176), Testing Strategy (lines 1178–1210)
- [x] **P2-S09-AC-204** — Reserved-concept, arbitrary-code/style, draft/control-plane leak, BOLA, approval-bypass, and migration-corruption tests remain blocking security gates. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Data Flow (lines 1071–1137), Error Handling (lines 1149–1166), Observability (lines 1168–1176), Testing Strategy (lines 1178–1210)
- [x] **P2-S09-AC-205** — Registry dependency failures map invalid upstream data to 502, unavailable/open circuit to 503, and deadline to 504 without mutation. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Data Flow (lines 1071–1137), Error Handling (lines 1149–1166), Observability (lines 1168–1176), Testing Strategy (lines 1178–1210)
- [x] **P2-S09-AC-206** — Structured logs contain operation, request/trace/correlation IDs, actor/acting classes, safe IDs/hashes, expected/current version when authorized, outcome, code, duration, dependency, and retryability only. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Data Flow (lines 1071–1137), Error Handling (lines 1149–1166), Observability (lines 1168–1176), Testing Strategy (lines 1178–1210)
- [x] **P2-S09-AC-207** — Logs and provider diagnostics exclude request bodies, field labels/values, capability graphs, renderer/source, signatures, tokens, private domain data, and PII. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Data Flow (lines 1071–1137), Error Handling (lines 1149–1166), Observability (lines 1168–1176), Testing Strategy (lines 1178–1210)
- [x] **P2-S09-AC-208** — Emit the declared per-operation request, latency, error, rate, conflict, allowlist, migration, activation, block, nonce, outbox, queue-retry, and DLQ metrics. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Data Flow (lines 1071–1137), Error Handling (lines 1149–1166), Observability (lines 1168–1176), Testing Strategy (lines 1178–1210)
- [ ] **P2-S09-AC-209** — Alert on activation blocked >15m, migration retry >3, nonce rejection spikes, DLQ >0, outbox age >2m, conflict >5%/5m, or unknown event versions. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Data Flow (lines 1071–1137), Error Handling (lines 1149–1166), Observability (lines 1168–1176), Testing Strategy (lines 1178–1210)
- [x] **P2-S09-AC-210** — Trace validation → session/acting context → capability → idempotency → RPC/SQL → audit/outbox → worker/refetch with allowlisted diagnostics only. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Data Flow (lines 1071–1137), Error Handling (lines 1149–1166), Observability (lines 1168–1176), Testing Strategy (lines 1178–1210)
- [ ] **P2-S09-AC-211** — Meet Tier 2 command p95 <1,200 ms, protected RPC p95 <300 ms, acceptance p99 <1,000 ms, queue first-attempt p95 <60 s, and DLQ <0.1% daily. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Data Flow (lines 1071–1137), Error Handling (lines 1149–1166), Observability (lines 1168–1176), Testing Strategy (lines 1178–1210)
- [x] **P2-S09-AC-212** — A failed audit/outbox write rolls back the mutation while telemetry loss never rolls back a committed definition. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Data Flow (lines 1071–1137), Error Handling (lines 1149–1166), Observability (lines 1168–1176), Testing Strategy (lines 1178–1210)
- [x] **P2-S09-AC-213** — A failed signed registration/lifecycle event rolls back nonce claim and event/outbox append; duplicate release admission cannot be made valid by idempotency replay. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Data Flow (lines 1071–1137), Error Handling (lines 1149–1166), Observability (lines 1168–1176), Testing Strategy (lines 1178–1210)
- [x] **P2-S09-AC-214** — Contract tests prove route/OpenAPI/request/success/error/CORS/auth/rate/timeout/cache/SLO parity for all eight operations. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Data Flow (lines 1071–1137), Error Handling (lines 1149–1166), Observability (lines 1168–1176), Testing Strategy (lines 1178–1210)
- [x] **P2-S09-AC-215** — Persistence/concurrency tests prove every SQL check/FK/unique/state/immutable rule, RLS force, grant revocation, RPC path, CAS, nonce claim, and zero-side-effect protected GET. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Data Flow (lines 1071–1137), Error Handling (lines 1149–1166), Observability (lines 1168–1176), Testing Strategy (lines 1178–1210)
- [x] **P2-S09-AC-216** — Security tests fuzz depth/keys/arrays/Unicode/regex/SQL-like strings/signature bytes and reject executable or arbitrary projection inputs. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Data Flow (lines 1071–1137), Error Handling (lines 1149–1166), Observability (lines 1168–1176), Testing Strategy (lines 1178–1210)
- [x] **P2-S09-AC-217** — Performance/recovery tests benchmark 128-field definitions and prove old-active fallback, activation rollback, worker resume, DLQ replay, and no duplicate switch. [BE03a](../../../wiki/be/03a-content-schema-registry.md) §§Data Flow (lines 1071–1137), Error Handling (lines 1149–1166), Observability (lines 1168–1176), Testing Strategy (lines 1178–1210)
- [x] **P2-S09-AC-218** — CmsContentModelingRoute props are minimal serializable disclosure-safe values; Astro verifies session, expiry, acting context, route visibility, and initial data before composing HTML. [FE03](../../../wiki/fe/03-cms-content-modeling.md) §§ContentSchemaRegistryWorkbench, Protected registry state contract, Page and Route Definitions, Server/URL/client state, Protected schema-registry operation metadata, Responsive, Accessibility, Performance, Form/auth security, Data Mapping, Error class ownership, Testing Obligations
- [x] **P2-S09-AC-219** — The route renders useful semantic HTML server-first with one h1, named landmarks, skip link to main, route h1 focus, title/state context, and 320 CSS-pixel/200% zoom reflow. [FE03](../../../wiki/fe/03-cms-content-modeling.md) §§ContentSchemaRegistryWorkbench, Protected registry state contract, Page and Route Definitions, Server/URL/client state, Protected schema-registry operation metadata, Responsive, Accessibility, Performance, Form/auth security, Data Mapping, Error class ownership, Testing Obligations
- [x] **P2-S09-AC-220** — ContentSchemaRegistryWorkbench has children never, the exact protected named variants, separate typed list/detail AsyncState props, actor/acting IDs, query/path/cursor/version, and canonical-refetch callback. [FE03](../../../wiki/fe/03-cms-content-modeling.md) §§ContentSchemaRegistryWorkbench, Protected registry state contract, Page and Route Definitions, Server/URL/client state, Protected schema-registry operation metadata, Responsive, Accessibility, Performance, Form/auth security, Data Mapping, Error class ownership, Testing Obligations
- [x] **P2-S09-AC-221** — FE03 consumes generated BE03a Zod/OpenAPI types and the exact eight operation IDs; no hand-written DTO or client authority type is allowed. [FE03](../../../wiki/fe/03-cms-content-modeling.md) §§ContentSchemaRegistryWorkbench, Protected registry state contract, Page and Route Definitions, Server/URL/client state, Protected schema-registry operation metadata, Responsive, Accessibility, Performance, Form/auth security, Data Mapping, Error class ownership, Testing Obligations
- [x] **P2-S09-AC-222** — The CMS-03A-01 form sends only the named ContentTypeDraftRequest fields, idempotency/JSON/CSRF headers, and renders the authoritative 201 resource. [FE03](../../../wiki/fe/03-cms-content-modeling.md) §§ContentSchemaRegistryWorkbench, Protected registry state contract, Page and Route Definitions, Server/URL/client state, Protected schema-registry operation metadata, Responsive, Accessibility, Performance, Form/auth security, Data Mapping, Error class ownership, Testing Obligations
- [x] **P2-S09-AC-223** — The CMS-03A-02 form sends exact path IDs, FieldSchemaChangeRequest including required nullable migrationPlanId, idempotency/If-Match/JSON/CSRF headers, and renders the 201 field resource. [FE03](../../../wiki/fe/03-cms-content-modeling.md) §§ContentSchemaRegistryWorkbench, Protected registry state contract, Page and Route Definitions, Server/URL/client state, Protected schema-registry operation metadata, Responsive, Accessibility, Performance, Form/auth security, Data Mapping, Error class ownership, Testing Obligations
- [x] **P2-S09-AC-224** — The CMS-03A-03 form sends exact path IDs, RelationBindingRequest, idempotency/If-Match/JSON/CSRF headers, and renders the 201 relation resource. [FE03](../../../wiki/fe/03-cms-content-modeling.md) §§ContentSchemaRegistryWorkbench, Protected registry state contract, Page and Route Definitions, Server/URL/client state, Protected schema-registry operation metadata, Responsive, Accessibility, Performance, Form/auth security, Data Mapping, Error class ownership, Testing Obligations
- [x] **P2-S09-AC-225** — The CMS-03A-04 confirmation sends SchemaActivationRequest, step-up/MFA, idempotency/If-Match/JSON headers, and renders 202 job or synchronous activation resource. [FE03](../../../wiki/fe/03-cms-content-modeling.md) §§ContentSchemaRegistryWorkbench, Protected registry state contract, Page and Route Definitions, Server/URL/client state, Protected schema-registry operation metadata, Responsive, Accessibility, Performance, Form/auth security, Data Mapping, Error class ownership, Testing Obligations
- [x] **P2-S09-AC-226** — CMS-03A-05 has no browser route, form, trigger, upload, idempotency key, or optimistic mutation state; only protected safe metadata may be displayed. [FE03](../../../wiki/fe/03-cms-content-modeling.md) §§ContentSchemaRegistryWorkbench, Protected registry state contract, Page and Route Definitions, Server/URL/client state, Protected schema-registry operation metadata, Responsive, Accessibility, Performance, Form/auth security, Data Mapping, Error class ownership, Testing Obligations
- [x] **P2-S09-AC-227** — CMS-03A-08 has no browser lifecycle control or mutation facade; only authorized safe block metadata refetch after a worker event hint is allowed. [FE03](../../../wiki/fe/03-cms-content-modeling.md) §§ContentSchemaRegistryWorkbench, Protected registry state contract, Page and Route Definitions, Server/URL/client state, Protected schema-registry operation metadata, Responsive, Accessibility, Performance, Form/auth security, Data Mapping, Error class ownership, Testing Obligations
- [x] **P2-S09-AC-228** — CMS-03A-06 renders a protected list with typed resourceKind/keyPrefix/lifecycle/state/limit/cursor/sort/direction URL state and no record payload in the URL. [FE03](../../../wiki/fe/03-cms-content-modeling.md) §§ContentSchemaRegistryWorkbench, Protected registry state contract, Page and Route Definitions, Server/URL/client state, Protected schema-registry operation metadata, Responsive, Accessibility, Performance, Form/auth security, Data Mapping, Error class ownership, Testing Obligations
- [x] **P2-S09-AC-229** — CMS-03A-07 renders protected detail from exact contentTypeId and versionId path state; labels/list positions cannot infer either identifier. [FE03](../../../wiki/fe/03-cms-content-modeling.md) §§ContentSchemaRegistryWorkbench, Protected registry state contract, Page and Route Definitions, Server/URL/client state, Protected schema-registry operation metadata, Responsive, Accessibility, Performance, Form/auth security, Data Mapping, Error class ownership, Testing Obligations
- [x] **P2-S09-AC-230** — The registry represents idle, loading, empty/no-records, filter-miss, success, validation, auth, capability, not-found, conflict where applicable, rate, dependency, and degraded states explicitly. [FE03](../../../wiki/fe/03-cms-content-modeling.md) §§ContentSchemaRegistryWorkbench, Protected registry state contract, Page and Route Definitions, Server/URL/client state, Protected schema-registry operation metadata, Responsive, Accessibility, Performance, Form/auth security, Data Mapping, Error class ownership, Testing Obligations
- [x] **P2-S09-AC-231** — The registry reads URL/server state as canonical, keeps only bounded island-local disclosure/filter/focus state, and forbids a global client store. [FE03](../../../wiki/fe/03-cms-content-modeling.md) §§ContentSchemaRegistryWorkbench, Protected registry state contract, Page and Route Definitions, Server/URL/client state, Protected schema-registry operation metadata, Responsive, Accessibility, Performance, Form/auth security, Data Mapping, Error class ownership, Testing Obligations
- [x] **P2-S09-AC-232** — Realtime and BroadcastChannel payloads carry invalidation hints only; each tab refetches canonical authorized data and no tab writes another tab's cache. [FE03](../../../wiki/fe/03-cms-content-modeling.md) §§ContentSchemaRegistryWorkbench, Protected registry state contract, Page and Route Definitions, Server/URL/client state, Protected schema-registry operation metadata, Responsive, Accessibility, Performance, Form/auth security, Data Mapping, Error class ownership, Testing Obligations
- [x] **P2-S09-AC-233** — Unsaved protected registry data is never persisted as draft/offline intent; reconnect revalidates identity, authority, input, and version. [FE03](../../../wiki/fe/03-cms-content-modeling.md) §§ContentSchemaRegistryWorkbench, Protected registry state contract, Page and Route Definitions, Server/URL/client state, Protected schema-registry operation metadata, Responsive, Accessibility, Performance, Form/auth security, Data Mapping, Error class ownership, Testing Obligations
- [x] **P2-S09-AC-234** — CMS-03A-06 and CMS-03A-07 list/detail data never enters public/private/offline caches, localStorage, IndexedDB, BroadcastChannel bodies, analytics, Realtime bodies, search, or sitemaps. [FE03](../../../wiki/fe/03-cms-content-modeling.md) §§ContentSchemaRegistryWorkbench, Protected registry state contract, Page and Route Definitions, Server/URL/client state, Protected schema-registry operation metadata, Responsive, Accessibility, Performance, Form/auth security, Data Mapping, Error class ownership, Testing Obligations
- [x] **P2-S09-AC-235** — The role matrix renders registry reads only for entitled/owner/guardian/junior/business/staff/admin protected variants; Free is not-rendered and roles never authorize client-side. [FE03](../../../wiki/fe/03-cms-content-modeling.md) §§ContentSchemaRegistryWorkbench, Protected registry state contract, Page and Route Definitions, Server/URL/client state, Protected schema-registry operation metadata, Responsive, Accessibility, Performance, Form/auth security, Data Mapping, Error class ownership, Testing Obligations
- [x] **P2-S09-AC-236** — ActionBar uses native controls, stable pending labels, expectedVersion/operationId, named consequences, and returns focus to the trigger. [FE03](../../../wiki/fe/03-cms-content-modeling.md) §§ContentSchemaRegistryWorkbench, Protected registry state contract, Page and Route Definitions, Server/URL/client state, Protected schema-registry operation metadata, Responsive, Accessibility, Performance, Form/auth security, Data Mapping, Error class ownership, Testing Obligations
- [x] **P2-S09-AC-237** — CapabilityGate hides protected names in not-rendered state, shows reason/recovery for disabled, focuses step-up heading, and never broadens disclosure. [FE03](../../../wiki/fe/03-cms-content-modeling.md) §§ContentSchemaRegistryWorkbench, Protected registry state contract, Page and Route Definitions, Server/URL/client state, Protected schema-registry operation metadata, Responsive, Accessibility, Performance, Form/auth security, Data Mapping, Error class ownership, Testing Obligations
- [x] **P2-S09-AC-238** — FilterBar has persistent labels, URL Apply/Reset, scoped Escape behavior, and polite result-count announcements. [FE03](../../../wiki/fe/03-cms-content-modeling.md) §§ContentSchemaRegistryWorkbench, Protected registry state contract, Page and Route Definitions, Server/URL/client state, Protected schema-registry operation metadata, Responsive, Accessibility, Performance, Form/auth security, Data Mapping, Error class ownership, Testing Obligations
- [x] **P2-S09-AC-239** — DataTable is semantic wide, uses priority-list mobile treatment, labelled sort buttons, stable keys, and named bulk count/scope where applicable. [FE03](../../../wiki/fe/03-cms-content-modeling.md) §§ContentSchemaRegistryWorkbench, Protected registry state contract, Page and Route Definitions, Server/URL/client state, Protected schema-registry operation metadata, Responsive, Accessibility, Performance, Form/auth security, Data Mapping, Error class ownership, Testing Obligations
- [x] **P2-S09-AC-240** — ConfirmationStep is inline first, exposes consequence/scope/version/step-up/idempotency, focuses heading, and requires Escape-before-commit behavior. [FE03](../../../wiki/fe/03-cms-content-modeling.md) §§ContentSchemaRegistryWorkbench, Protected registry state contract, Page and Route Definitions, Server/URL/client state, Protected schema-registry operation metadata, Responsive, Accessibility, Performance, Form/auth security, Data Mapping, Error class ownership, Testing Obligations
- [x] **P2-S09-AC-241** — OfflineStatus and SyncConflict use text plus icon, preserve refused intents, expose server/local versions, and never auto-overwrite. [FE03](../../../wiki/fe/03-cms-content-modeling.md) §§ContentSchemaRegistryWorkbench, Protected registry state contract, Page and Route Definitions, Server/URL/client state, Protected schema-registry operation metadata, Responsive, Accessibility, Performance, Form/auth security, Data Mapping, Error class ownership, Testing Obligations
- [x] **P2-S09-AC-242** — Protected list/detail routes use server guards, safe 303 sign-in returnTo normalization, 403 visible-capability handling, and disclosure-safe 404 omission. [FE03](../../../wiki/fe/03-cms-content-modeling.md) §§ContentSchemaRegistryWorkbench, Protected registry state contract, Page and Route Definitions, Server/URL/client state, Protected schema-registry operation metadata, Responsive, Accessibility, Performance, Form/auth security, Data Mapping, Error class ownership, Testing Obligations
- [x] **P2-S09-AC-243** — Deep links/bookmarks refetch exact current authority/version; stale, retired, unreadable, or mismatched detail never falls back to public data. [FE03](../../../wiki/fe/03-cms-content-modeling.md) §§ContentSchemaRegistryWorkbench, Protected registry state contract, Page and Route Definitions, Server/URL/client state, Protected schema-registry operation metadata, Responsive, Accessibility, Performance, Form/auth security, Data Mapping, Error class ownership, Testing Obligations
- [x] **P2-S09-AC-244** — At mobile ≤768 px the registry uses four columns/16 px gutter, list-then-detail stack, Back-before-detail, one-column forms, and 44 px controls without horizontal scroll at 320 px. [FE03](../../../wiki/fe/03-cms-content-modeling.md) §§ContentSchemaRegistryWorkbench, Protected registry state contract, Page and Route Definitions, Server/URL/client state, Protected schema-registry operation metadata, Responsive, Accessibility, Performance, Form/auth security, Data Mapping, Error class ownership, Testing Obligations
- [x] **P2-S09-AC-245** — At tablet 769–1024 px it uses eight columns/20 px gutter/24 px margins, collapsible sidebar, and two columns only for independent fields. [FE03](../../../wiki/fe/03-cms-content-modeling.md) §§ContentSchemaRegistryWorkbench, Protected registry state contract, Page and Route Definitions, Server/URL/client state, Protected schema-registry operation metadata, Responsive, Accessibility, Performance, Form/auth security, Data Mapping, Error class ownership, Testing Obligations
- [x] **P2-S09-AC-246** — At desktop ≥1025 px it uses twelve columns/24 px gutter/max 1440 px, stable list/detail split, action rail, and virtualization above 100 rows. [FE03](../../../wiki/fe/03-cms-content-modeling.md) §§ContentSchemaRegistryWorkbench, Protected registry state contract, Page and Route Definitions, Server/URL/client state, Protected schema-registry operation metadata, Responsive, Accessibility, Performance, Form/auth security, Data Mapping, Error class ownership, Testing Obligations
- [x] **P2-S09-AC-247** — Native links/buttons/inputs/selects/textareas provide visible names, correct keyboard operation, logical Tab order, focus ring, and no pointer-only control. [FE03](../../../wiki/fe/03-cms-content-modeling.md) §§ContentSchemaRegistryWorkbench, Protected registry state contract, Page and Route Definitions, Server/URL/client state, Protected schema-registry operation metadata, Responsive, Accessibility, Performance, Form/auth security, Data Mapping, Error class ownership, Testing Obligations
- [x] **P2-S09-AC-248** — Form validation uses persistent labels, linked descriptions, JSON-pointer errors, first-invalid summary focus, polite status, and server authority after blur feedback. [FE03](../../../wiki/fe/03-cms-content-modeling.md) §§ContentSchemaRegistryWorkbench, Protected registry state contract, Page and Route Definitions, Server/URL/client state, Protected schema-registry operation metadata, Responsive, Accessibility, Performance, Form/auth security, Data Mapping, Error class ownership, Testing Obligations
- [x] **P2-S09-AC-249** — Tables/filters expose caption, headers, sort direction, result count, active-filter summary, 24 CSS px minimum targets (44 preferred), and no ARIA grid without full grid behavior. [FE03](../../../wiki/fe/03-cms-content-modeling.md) §§ContentSchemaRegistryWorkbench, Protected registry state contract, Page and Route Definitions, Server/URL/client state, Protected schema-registry operation metadata, Responsive, Accessibility, Performance, Form/auth security, Data Mapping, Error class ownership, Testing Obligations
- [x] **P2-S09-AC-250** — High-risk activation confirmation exposes consequence, scope, version, acting context, and step-up; modal focus containment/Escape/return focus applies only when inline is insufficient. [FE03](../../../wiki/fe/03-cms-content-modeling.md) §§ContentSchemaRegistryWorkbench, Protected registry state contract, Page and Route Definitions, Server/URL/client state, Protected schema-registry operation metadata, Responsive, Accessibility, Performance, Form/auth security, Data Mapping, Error class ownership, Testing Obligations
- [x] **P2-S09-AC-251** — Reduced-motion mode removes nonessential animation; statuses combine text/icon/structure and never rely on color. [FE03](../../../wiki/fe/03-cms-content-modeling.md) §§ContentSchemaRegistryWorkbench, Protected registry state contract, Page and Route Definitions, Server/URL/client state, Protected schema-registry operation metadata, Responsive, Accessibility, Performance, Form/auth security, Data Mapping, Error class ownership, Testing Obligations
- [x] **P2-S09-AC-252** — Reads show loading only after 250 ms, use known-layout skeletons, preserve safe prior shell, and announce parsed results within the FE timing contract. [FE03](../../../wiki/fe/03-cms-content-modeling.md) §§ContentSchemaRegistryWorkbench, Protected registry state contract, Page and Route Definitions, Server/URL/client state, Protected schema-registry operation metadata, Responsive, Accessibility, Performance, Form/auth security, Data Mapping, Error class ownership, Testing Obligations
- [x] **P2-S09-AC-253** — 429 honors Retry-After and preserves input; safe 502/503/504 attempts are bounded and mutation retries reconcile status first. [FE03](../../../wiki/fe/03-cms-content-modeling.md) §§ContentSchemaRegistryWorkbench, Protected registry state contract, Page and Route Definitions, Server/URL/client state, Protected schema-registry operation metadata, Responsive, Accessibility, Performance, Form/auth security, Data Mapping, Error class ownership, Testing Obligations
- [x] **P2-S09-AC-254** — FE maps 400/422 inline, 401 reauthentication, 403 CapabilityGate, 404 disclosure-safe, 409 SyncConflict, 429 countdown, and 5xx degraded states to exact accessible recovery. [FE03](../../../wiki/fe/03-cms-content-modeling.md) §§ContentSchemaRegistryWorkbench, Protected registry state contract, Page and Route Definitions, Server/URL/client state, Protected schema-registry operation metadata, Responsive, Accessibility, Performance, Form/auth security, Data Mapping, Error class ownership, Testing Obligations
- [x] **P2-S09-AC-255** — Astro verifies Supabase token server-side on every protected route/write, checks expiry/revocation/acting context, and client role strings never authorize. [FE03](../../../wiki/fe/03-cms-content-modeling.md) §§ContentSchemaRegistryWorkbench, Protected registry state contract, Page and Route Definitions, Server/URL/client state, Protected schema-registry operation metadata, Responsive, Accessibility, Performance, Form/auth security, Data Mapping, Error class ownership, Testing Obligations
- [x] **P2-S09-AC-256** — Cookie mutations enforce Secure/HttpOnly same-site cookies, strict Origin/Referer and CSRF binding; no GET mutates. [FE03](../../../wiki/fe/03-cms-content-modeling.md) §§ContentSchemaRegistryWorkbench, Protected registry state contract, Page and Route Definitions, Server/URL/client state, Protected schema-registry operation metadata, Responsive, Accessibility, Performance, Form/auth security, Data Mapping, Error class ownership, Testing Obligations
- [x] **P2-S09-AC-257** — Controls serialize named Zod fields only, use allowlist sanitizers, render text safely, forbid executable HTML/CSS/script/expression, and never trust client validation. [FE03](../../../wiki/fe/03-cms-content-modeling.md) §§ContentSchemaRegistryWorkbench, Protected registry state contract, Page and Route Definitions, Server/URL/client state, Protected schema-registry operation metadata, Responsive, Accessibility, Performance, Form/auth security, Data Mapping, Error class ownership, Testing Obligations
- [x] **P2-S09-AC-258** — Tokens, evidence bodies, contact data, media URLs, drafts, release headers, raw bodies, signatures, and private IDs stay out of URL, logs, analytics, Realtime, and client persistence. [FE03](../../../wiki/fe/03-cms-content-modeling.md) §§ContentSchemaRegistryWorkbench, Protected registry state contract, Page and Route Definitions, Server/URL/client state, Protected schema-registry operation metadata, Responsive, Accessibility, Performance, Form/auth security, Data Mapping, Error class ownership, Testing Obligations
- [x] **P2-S09-AC-259** — FE maps every browser-visible BE03a request/response/error field to the owning form/state/component, explicitly omits ownerId from browser response envelopes, and excludes DB-only release evidence fields. [FE03](../../../wiki/fe/03-cms-content-modeling.md) §§ContentSchemaRegistryWorkbench, Protected registry state contract, Page and Route Definitions, Server/URL/client state, Protected schema-registry operation metadata, Responsive, Accessibility, Performance, Form/auth security, Data Mapping, Error class ownership, Testing Obligations
- [x] **P2-S09-AC-260** — The browser accepts only safe BlockDefinitionRegistryRecord projection and never parses full block registration/lifecycle resources or WEBHOOK_REJECTED. [FE03](../../../wiki/fe/03-cms-content-modeling.md) §§ContentSchemaRegistryWorkbench, Protected registry state contract, Page and Route Definitions, Server/URL/client state, Protected schema-registry operation metadata, Responsive, Accessibility, Performance, Form/auth security, Data Mapping, Error class ownership, Testing Obligations
- [x] **P2-S09-AC-261** — The registry route starts at ≤90 KB initial app JS, workbench hydrated entry ≤35 KB, detail/editor modules split, and no barrel import; list >100 virtualizes. [FE03](../../../wiki/fe/03-cms-content-modeling.md) §§ContentSchemaRegistryWorkbench, Protected registry state contract, Page and Route Definitions, Server/URL/client state, Protected schema-registry operation metadata, Responsive, Accessibility, Performance, Form/auth security, Data Mapping, Error class ownership, Testing Obligations
- [x] **P2-S09-AC-262** — The app meets LCP <2.5 s, INP <200 ms, CLS <0.1, and no input task >50 ms under the FE03 performance contract. [FE03](../../../wiki/fe/03-cms-content-modeling.md) §§ContentSchemaRegistryWorkbench, Protected registry state contract, Page and Route Definitions, Server/URL/client state, Protected schema-registry operation metadata, Responsive, Accessibility, Performance, Form/auth security, Data Mapping, Error class ownership, Testing Obligations
- [x] **P2-S09-AC-263** — Vitest covers AsyncState/access variants, exact error copy, timing, rollback/focus, and absence of unauthorized props. [FE03](../../../wiki/fe/03-cms-content-modeling.md) §§ContentSchemaRegistryWorkbench, Protected registry state contract, Page and Route Definitions, Server/URL/client state, Protected schema-registry operation metadata, Responsive, Accessibility, Performance, Form/auth security, Data Mapping, Error class ownership, Testing Obligations
- [x] **P2-S09-AC-264** — Integration tests prove generated Zod fixtures, all eight operation field/error mappings, ETag/idempotency/rate UI behavior, and invalidation-only realtime. [FE03](../../../wiki/fe/03-cms-content-modeling.md) §§ContentSchemaRegistryWorkbench, Protected registry state contract, Page and Route Definitions, Server/URL/client state, Protected schema-registry operation metadata, Responsive, Accessibility, Performance, Form/auth security, Data Mapping, Error class ownership, Testing Obligations
- [ ] **P2-S09-AC-265** — Playwright covers all nine role cases under the approved Phase 2 launch overlay: guardian/junior/business-mandate denial without disclosure or mutation, positive access only with verified current authority, forbidden denial, and disabled prerequisites without mutation. Retain all ten hosted scenarios: IdP sign-in, server-authoritative RLS, keyboard/landmarks/live regions, three breakpoints, 200% zoom, offline/reconnect, stale multi-tab, auth expiry, 429, and outage. Retain step-up and session teardown proof; skips and local fixtures do not satisfy hosted acceptance. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §§Conditional Rendering Matrix, Testing Obligations
- [ ] **P2-S09-AC-266** — Accessibility release checks pass axe with zero serious/critical issues, contrast/non-color cues, VoiceOver/NVDA smoke, target size, focus, and no trap. [FE03](../../../wiki/fe/03-cms-content-modeling.md) §§ContentSchemaRegistryWorkbench, Protected registry state contract, Page and Route Definitions, Server/URL/client state, Protected schema-registry operation metadata, Responsive, Accessibility, Performance, Form/auth security, Data Mapping, Error class ownership, Testing Obligations
- [x] **P2-S09-AC-267** — Record each strict floor checkpoint in both canonical phase plan and Slice 09 tracker with contiguous P2-S09-AC IDs and identical descriptions/source ownership. [Engineering Standards](../../../wiki/ENGINEERING-STANDARDS.md) §§Tests, Performance, Async/Recovery, Accessibility, Security, Migration/CI
- [x] **P2-S09-AC-268** — Keep later-only editorial, composition, taxonomy, locale, and public-delivery behavior in S10–S17; S09 retains only registry-owned or shared boundary obligations after owner coverage review. [Engineering Standards](../../../wiki/ENGINEERING-STANDARDS.md) §§Tests, Performance, Async/Recovery, Accessibility, Security, Migration/CI
- [x] **P2-S09-AC-269** — Trace all eight BE03a operations, five feature-ledger rows, IA CMS-01/02/03/04/10, FE registry ownership, and BE03b/03c consumed boundaries to an acceptance criterion. [Engineering Standards](../../../wiki/ENGINEERING-STANDARDS.md) §§Tests, Performance, Async/Recovery, Accessibility, Security, Migration/CI
- [x] **P2-S09-AC-270** — Execute Contract → QA-RED → data/API and SSR/island implementation → QA-GREEN → refactor, retaining failing-test evidence and canonical validation output. [Engineering Standards](../../../wiki/ENGINEERING-STANDARDS.md) §§Tests, Performance, Async/Recovery, Accessibility, Security, Migration/CI
- [x] **P2-S09-AC-271** — Run explicit formatting, progress-consistency, diff-check, and per-slice contiguous-ID/count/mirror checks before marking the reconciliation complete. [Engineering Standards](../../../wiki/ENGINEERING-STANDARDS.md) §§Tests, Performance, Async/Recovery, Accessibility, Security, Migration/CI
- [x] **P2-S09-AC-272** — Do not edit IA, BE, FE, implementation, or schema source documents during this phase-plan reconciliation. [Engineering Standards](../../../wiki/ENGINEERING-STANDARDS.md) §§Tests, Performance, Async/Recovery, Accessibility, Security, Migration/CI
- [x] **P2-S09-AC-273** — Document every warning/fail with exact current source path/line anchor and an explicit owner decision; current settled sources have no unresolved S09 ambiguity. [Engineering Standards](../../../wiki/ENGINEERING-STANDARDS.md) §§Tests, Performance, Async/Recovery, Accessibility, Security, Migration/CI
- [x] **P2-S09-AC-274** — Update phase totals, slice counts, feature/endpoint maps, progress mirrors, and reconciliation evidence together without staging unrelated dirty work. [Engineering Standards](../../../wiki/ENGINEERING-STANDARDS.md) §§Tests, Performance, Async/Recovery, Accessibility, Security, Migration/CI
- [x] **P2-S09-AC-275** — Re-read the current IA03/deep-dive, BE03a, BE03b/03c consumed boundaries, and FE03 after source mtimes settle before freezing the floor. [Engineering Standards](../../../wiki/ENGINEERING-STANDARDS.md) §§Tests, Performance, Async/Recovery, Accessibility, Security, Migration/CI
- [x] **P2-S09-AC-276** — Record the exact A06/A07 dependency-invalid-response, dependency-unavailable, dependency-deadline-exceeded, and internal-error owners in the floor. [Engineering Standards](../../../wiki/ENGINEERING-STANDARDS.md) §§Tests, Performance, Async/Recovery, Accessibility, Security, Migration/CI
- [x] **P2-S09-AC-277** — Record the exact A08 release signature, nonce receipt, lifecycle CAS, append-only event, and worker-only browser boundary in the floor. [Engineering Standards](../../../wiki/ENGINEERING-STANDARDS.md) §§Tests, Performance, Async/Recovery, Accessibility, Security, Migration/CI
- [x] **P2-S09-AC-278** — Prove the final browser resource envelopes use closed state enums and omit ownerId/worker-only fields before implementation. [Engineering Standards](../../../wiki/ENGINEERING-STANDARDS.md) §§Tests, Performance, Async/Recovery, Accessibility, Security, Migration/CI
- [x] **P2-S09-AC-279** — Prove required-nullable migrationPlanId is present in BE03a and FE03 source contracts for field changes and activation. [Engineering Standards](../../../wiki/ENGINEERING-STANDARDS.md) §§Tests, Performance, Async/Recovery, Accessibility, Security, Migration/CI
- [x] **P2-S09-AC-280** — Keep A06/A07 no-store GETs free of idempotency, If-Match, body, audit, outbox, migration, and definition-state effects. [Engineering Standards](../../../wiki/ENGINEERING-STANDARDS.md) §§Tests, Performance, Async/Recovery, Accessibility, Security, Migration/CI
- [x] **P2-S09-AC-281** — Keep A05/A08 release headers, raw body, signatures, nonce evidence, and WEBHOOK_REJECTED entirely outside browser state. [Engineering Standards](../../../wiki/ENGINEERING-STANDARDS.md) §§Tests, Performance, Async/Recovery, Accessibility, Security, Migration/CI
- [x] **P2-S09-AC-282** — Verify S10/S11/S12/S15 existing owner criteria cover removed later-only S09 editorial/composition/public topics; transfer count is zero. [Engineering Standards](../../../wiki/ENGINEERING-STANDARDS.md) §§Tests, Performance, Async/Recovery, Accessibility, Security, Migration/CI
- [x] **P2-S09-AC-283** — Compute phase arithmetic from current per-slice counts: 1905 original total minus 188 old S09 plus 283 strict S09 equals 2000. [Engineering Standards](../../../wiki/ENGINEERING-STANDARDS.md) §§Tests, Performance, Async/Recovery, Accessibility, Security, Migration/CI

## TDD Evidence

### Contract lock

- Strict Zod request/response/error contracts cover all eight BE03a operations,
  immutable registry resources, release evidence, activation, events, and
  browser-safe projections.
- The 283-item floor is contiguous and mirrored from the locked Phase 2 plan;
  later editorial, composition, taxonomy, locale, and public-delivery behavior
  remains owned by S10–S17.

### QA RED

- The retained independent baseline records 283 criteria as 252 PASS, 19 FAIL,
  and 12 UNVERIFIED before remediation.
- Real RED findings included the 133,098/92,160-byte initial-route budget
  breach, sub-100% coverage, hydration failure, activation recovery defects,
  and signed release/block-registry defects.

### QA GREEN

- Local PostgreSQL, contract, Worker, SSR/island, browser, security, recovery,
  performance, bundle, and adversarial gates pass.
- Canonical validation passes 418/418 Vitest files and 3,096/3,096 tests at
  exact 100% coverage, 102/102 default Chromium tests, all builds and bundle
  budgets, and local performance smoke.
- The dedicated production-built S09 route passes 5/5; the clean database suite
  passes 45 files / 1,670 assertions; independent psql recovery sessions pass,
  including expired zero-row lease takeover and single-owner activation/DLQ
  races.
- Full evidence and the four non-local release gates are recorded in the
  [QA-GREEN disposition](../../../wiki/specs/audits/phase-02-slice-09-qa-green.md).

## Verification

- `pnpm validate`: PASS — 418/418 Vitest files, 3,096/3,096 tests, 100%
  statements/branches/functions/lines, and 102/102 Playwright tests.
- `pnpm db:reset && pnpm db:test && pnpm db:types:check`: PASS.
- `pnpm db:verify`: PASS — 33/33 migrations, 45/45 pgTAP files and 1,670/1,670
  assertions, with generated database types matching the migrated schema.
- Prior PR merge-candidate CI: PASS — GitHub run `33841270472` completed all three
  jobs for synthetic merge `a79dfe30db60e4f54024f064fc2fdf2d01033919`,
  whose parents are baseline `9b2cff7849b25dd12ffae6287b1024e50654bc14`
  and branch head `67264c5e9b5196d00ac3f0aa272896a010c872d7`.
  This is committed PR candidate evidence, not exact-main-SHA, staging, or
  production evidence.
- Post-remediation focused workflow and migration-contract tests: PASS — 30/30
  tests cover fail-closed hosted migration ordering, step-scoped credentials,
  immutable `staging-migration-evidence`, full-history parity behavior,
  old-candidate rejection, and production's exact staging-project binding. This
  local verification does not establish GitHub CI or deployment evidence.
- Clean Worker artifact regression: PASS — Wrangler emits the executable
  `runtime-entry.js` module through `--outdir`, the build copies it to the
  immutable `dist/index.js` release path, syntax validation passes, and the API
  p95 smoke imports the freshly built artifact with zero errors.
- Dedicated S09 pgTAP: PASS — 247 assertions, including fenced event claim,
  release, ACK, dead-letter, expiry takeover, and retry ownership.
- Independent psql recovery harness: PASS — committed sessions exercised
  zero-row lease expiry takeover, concurrent activation, and a DLQ replay race
  with exactly one fenced owner.
- Dedicated production-built S09 Playwright route: 5/5 PASS.
- Operational release-evidence and protected-promotion verification: 6/6
  focused files and 74/74 tests PASS. The sidecar is independently bound to the
  expected artifact identity, retained files are SHA/root checked, workflow
  readers reject ambiguous or forged identity, production reviewer rules
  require self-review prevention, and all release/promotion CLIs fail closed
  when invoked through symlinks.
- Final structural audit, diff check, contiguous-ID/count/mirror checks, and
  progress consistency: PASS.
- Fresh `/verify-infrastructure`: FAIL / BLOCKED — the
  [post-deploy report](../../../wiki/specs/audits/verify-infrastructure-2026-09-04-1703.md)
  records exact main SHA `5d6e49f34b678c59da2ac4f7059f08e6dc3b4790`, CI run
  `33917604565` with all three required jobs green, immutable workspace
  artifact `9953929511` (`sha256:2a89077d...`), staging run `33918141133`
  and successful job `101169994068`, deployment `6272586576`, and hosted
  migration through `20260902080000` in `expanded` state with full history
  parity. Independent candidate artifact `9953965534` and deployment-evidence
  artifact `9953965990` are retained; deployed API/web versions are
  `0f6ef117-c377-4229-ab0b-72c815346414` /
  `e3b79e94-99d2-4447-ac22-be3c5e485bb1`. Public checks record web `200`,
  protected routes `303`, API health `200`/`ok`, CMS API `401`, and p95
  `42.649115ms` over `20/20` with zero errors. `/api/v1/ready` remains
  `503`/`not_ready` by intentional fail-closed behavior with no readiness
  checker; `/api/v1/auth/providers` remains `503 DEPENDENCY_UNAVAILABLE` at
  the hosted-auth boundary, and Google is disabled. No production telemetry or
  provider receipt, authorized hosted Auth/RLS/IdP matrix, or manual
  VoiceOver/Safari and NVDA/Firefox accessibility smoke is claimed. Slice 09
  remains 279/283. The 13:53 and 12:55 audit records remain preserved in the
  [prior post-remediation report](../../../wiki/specs/audits/verify-infrastructure-2026-09-04-1353.md)
  and [12:55 audit](../../../wiki/specs/audits/verify-infrastructure-2026-09-04-1255.md).

- Fresh release-evidence correction merged through PR #13 as exact main SHA
  `7250754dcdc9c1b7a863aa41d79772e6ab7092ab`. CI `33950299169`, staging
  `33950592657` / deployment `6278097284`, and production `33950658266` /
  deployment `6278109516` all passed. Production applied all migrations,
  deployed API Worker `b5ab753d-8388-490d-b6a0-ba3096f074b4` and web Worker
  `68a414d7-2f74-40d8-a9fd-367404573b93`, and retained five-file evidence
  artifact `9964724622` (`sha256:388dee00...`). Independent public checks pass
  web root/sign-in/degraded rendering and protected-route redirect contracts;
  Auth providers remain intentionally fail-closed at `503` until AC265 setup.

- 2026-09-05 operational-alert implementation checkpoint: the production
  Worker now aggregates bounded `cms.registry.*` logs, Supabase registry state,
  and the production Queue DLQ backlog; evaluates all twelve locked alert
  conditions; claims a deduplicated database receipt; sends only redacted
  safe-code content through the `PLATFORM_ALERT_EMAIL` binding; and completes a
  digest-only receipt. Production deployment requires the environment-scoped
  `CLOUDFLARE_OBSERVABILITY_API_TOKEN` with Workers Observability Write and
  Account Analytics Read, while staging remains independent of that secret.
  Local validation passes 423 Vitest files / 3,143 tests at 100% coverage, 102
  Playwright checks, build/bundle/performance gates, and database type parity.
  This checkpoint implements the provider boundary but does not claim AC209 or
  AC211: exact-SHA deployment, a post-configuration delivered alert receipt,
  and the complete production UTC-day SLO/DLQ evidence are still required.

- 2026-09-05 production provider recovery: PR #16 merged the bounded Cloudflare
  query/error-sanitization correction as `6ff9bedacdab916f5de71a8b39460b14718941f7`;
  PR #17 merged current-envelope compatibility as
  `1c969366926e9fe5db50cdd1f523207a477d243e`; and PR #18 merged the
  root-cause empty-result decoder as
  `c995ce31821e39ac6f27538813f536f9af6b39f2`. Exact-SHA CI run
  `33960218010` passed after one unchanged rerun confirmed an unrelated late
  upload-admission promise rejection was transient, staging run `33960712969`
  / deployment `6279914420` passed, and business-account-approved production
  run `33960764747` / deployment `6279925490` passed. Retained staging and
  production artifacts are `9967847252`, `9967847034`, and `9967870332`.
  Fresh Cloudflare production logs record two consecutive successful scheduled
  executions at `2026-09-05 06:31:00.649 EDT` and
  `2026-09-05 06:31:54.674 EDT`; the last `Invalid Workers Logs response` is
  pre-deployment at `2026-09-05 06:29:54.678 EDT`. Local validation passes 423
  Vitest files / 3,148 tests at 100% coverage, 102 Playwright checks, all
  build/bundle/performance gates, and 45 pgTAP files / 1,678 tests. Gmail still
  reports no message from `platform.on-call@alerts.wejamm.in`, so no live
  delivery receipt is claimed and AC209 remains open.

- 2026-09-05 hosted auth-provider transport recovery: PR #20 merged the
  active-request-context Worker fetch correction as
  `fcdf0ac027453bc764fd835859a059253dfd2b1f`. Two exact-main reruns then
  reproduced timeout-only failures in the repository-wide AST scan and
  two-build SSR deployment contract while the other 3,146 tests passed. PR #21
  retained every assertion and added shared-runner time-budget headroom; its
  merge `b22a914327291e2895bbcc7dc8f60837c8faa0d6` passed exact-main CI
  `33965293079`, staging `33965655238` / deployment `6280862362`, and
  business-account-approved production `33965764707` / deployment
  `6280885024`. Retained artifacts are `9969324579`, `9969307786`,
  `9969340186`, `9969340453`, and `9969392638`. Both staging auth origins and
  five sequential production requests now return HTTP `200` with the valid
  provider catalog; Cloudflare records the five production requests at info
  level with 21 successes and 0 errors in the 15-minute window. Google remains
  `temporarily_unavailable`: both Supabase projects have the provider disabled
  with blank OAuth credentials, and Google Cloud requires owner acceptance of
  its Terms of Service before business-owned client setup. The
  [current infrastructure report](../../../wiki/specs/audits/verify-infrastructure-2026-09-05-0824.md)
  records the evidence and keeps AC265 open.

- 2026-09-06 production DLQ-alert verification: PR #23 merged the fail-closed
  Queue Analytics response correction as exact main SHA
  `2e806ed8b399b024181878dd71e5834bfa73579f`; CI run `33969135163`, staging
  run `33969454591`, and business-account-approved production run
  `33969517664` all passed. Cloudflare Queue Analytics, queried through the
  business Wrangler OAuth session at `2026-09-06T04:29:37.083Z`, reported
  `platform-jobs=0` and `platform-jobs-dlq=1`. Production Worker version
  `9bd444fe-e7ed-499c-88f5-a3a8762ddb5c` then ran the one-minute schedule and
  failed closed with `Invalid Queue analytics response`; the durable delivery
  ledger remained empty. The exact deployed query succeeds through the
  business OAuth session, isolating the remaining fault to the protected
  `CLOUDFLARE_OBSERVABILITY_API_TOKEN` scope/resource configuration. PR #24
  adds a secret-safe pre-mutation release check for Workers Observability Write
  plus Account Analytics Read. Its local gate passes 424 Vitest files / 3,154
  tests at 100% coverage, 102 Playwright checks, all build/bundle/performance
  gates, and 45 pgTAP files / 1,678 tests. AC209 remains open until the
  production secret is rotated and a genuine delivered receipt is retained.

- 2026-09-06 exact-main observability preflight: PR #24 is current `main` SHA
  `3bf66a610b013bf9600889780ee26319559fb31c`. CI `34013034252` and staging
  `34013296132` passed. Protected production run `34016439881` reached the new
  permission check and failed with `Cloudflare Account Analytics permission
check failed` before migrations or deployment. Existing production Worker
  version `9bd444fe-e7ed-499c-88f5-a3a8762ddb5c` remained active at 100%.
  Public staging and production provider catalogs remain HTTP `200`. Business
  Wrangler OAuth can read Queue Analytics, but its scope cannot read Workers
  Observability or manage API tokens; user-token and account-token endpoints
  both return HTTP `403`. The retained report is
  [verify-infrastructure-2026-09-06-0300.md](../../../wiki/specs/audits/verify-infrastructure-2026-09-06-0300.md).

- 2026-09-06 rotated-secret retest and diagnostics: production secret metadata
  changed at `2026-09-06T07:07:48Z`. Protected run `34018343506` consumed the
  replacement and again passed Workers Observability before failing Account
  Analytics, with no migration or deployment mutation. TDD added fixed safe
  classifications for HTTP, GraphQL permission, GraphQL resource, and malformed
  responses: RED 8/12, GREEN 12/12. Full `pnpm validate` passes 424 Vitest files /
  3,162 tests at 100% coverage, 102 Playwright checks, build, bundle, and
  performance smoke. AC209 remains open; Slice 09 stays 279/283.

- 2026-09-06 exact-main parser diagnosis: PR #25 merged as
  `ccfefa7862900357586fef9031b314e7b30989b4`; CI `34019423084` and staging
  `34019696293` passed. Protected production `34019780775` stopped before
  migration/deployment and safely classified Account Analytics as `malformed
response`; Workers Observability passed. Cloudflare's documented successful
  GraphQL envelope permits `errors: null`, while the verifier rejected every
  non-array value. Regression RED failed 1/18 with `invalid errors envelope`;
  GREEN passes 18/18 after accepting `null`. AC209 remains open; Slice 09 stays
  279/283 pending exact-main production and genuine delivery evidence. Clean
  `pnpm validate` passes 424 Vitest files / 3,168 tests at 100% coverage, all 102
  Playwright checks, builds, bundle budgets, and API p95 smoke.

- 2026-09-06 successful observability promotion and runtime follow-up: PR #26
  merged as exact main SHA `6d33bd189a51b4e041e582feb604d5fe22ddce78`;
  CI `34020909710`, staging `34021192537`, and protected production
  `34021249248` passed. Production verified both Cloudflare scopes, remote
  migration parity, release identity, API Worker version
  `e1891c96-f8d9-47e4-ac5c-0671d17d3696`, web Worker version
  `6565d60c-ab9f-483d-8b3c-bb44f9ad9ba5`, and artifact `9985578911`. The
  scheduled runtime repeated the valid `errors: null` rejection in its Queue
  Analytics parser; runtime RED failed 1/29 and GREEN passes 29/29. No manual
  dispatch or delivery-ledger read path exists. AC209 remains open pending
  exact-main runtime promotion and genuine mailbox/provider receipt; Slice 09
  stays 279/283. Full `pnpm validate` passes 424 Vitest files / 3,169 tests at
  100% coverage, all 102 Playwright checks, builds, bundle budgets, and API p95
  smoke.

- 2026-09-06 scheduled-runtime exact-main promotion: PR #27 merged as
  `93c2fd837cffa89baea9d43a9f482000c5739440`; CI `34022522801`, staging
  `34022811556` / deployment `6291019997`, and protected production
  `34022888837` / deployment `6291034733` passed. Production re-verified both
  Cloudflare scopes and remote migration parity, deployed API Worker version
  `1b2d3c02-d3e9-4681-9fde-7d05f06e0cd5` and web Worker version
  `a5d3d651-29ff-4226-bff2-d11376671b6d`, and retained artifact `9986107430`
  with digest
  `sha256:6e18252a24f02cb790a56bf5b10e3685b3e491b2567ecec97e09f1f86991fcc2`.
  Native production tail captured a natural scheduled event at
  `2026-09-06T08:54:51.000Z` with outcome `ok` and zero exceptions. AC209
  remains open because no threshold fired and no genuine provider/mailbox
  receipt exists; Slice 09 stays 279/283.

- 2026-09-06 AC211 collector production deployment: PR #29 merged the
  collector, provider, and source-verifier implementation and it is deployed.
  Full `pnpm validate` passes 432/432 Vitest files,
  3,233/3,233 tests at 100% coverage, and 102/102 Playwright checks. The
  latest verified production candidate is exact main SHA
  `621f7b99745318948720afa4d670ae1a707d3365`; CI `34031918191`, staging
  `34032219768`, protected production run `34032282370` / deployment
  `6292744330`, artifact `9989024106` with digest
  `sha256:e21aeb18405deab77f8b12d43f00903481ce16fe9580ea778425ca53fffea33a`, API Worker
  `a726691a-64bc-47e5-bc5e-6b52088efbff`, and web Worker
  `18b0287a-8af7-47e8-ad43-e5bdc29a10ab` are verified. Protected secret
  verification passed and `CLOUDFLARE_PLATFORM_QUEUE_ID` is set and verified;
  no complete retained production UTC-day report exists. Protected run
  `34189916813` attempted 2026-09-07 UTC and failed closed for insufficient
  natural samples; the next eligible complete day is 2026-09-08 UTC and can be
  collected only after `2026-09-09T00:00:00Z`, so AC211 remains open and Slice
  09 stays 279/283.

- 2026-09-06 blocker remediation audit: read-only inspection of production run
  `34032282370` reconfirmed the observability permission preflight. Current API
  Worker version `a726691a-64bc-47e5-bc5e-6b52088efbff` contains the
  `PLATFORM_ALERT_EMAIL` Send Email binding. Cloudflare Email Sending is enabled
  for `alerts.wejamm.in`, its bounce MX/SPF/DKIM/DMARC records are present, and
  `admin.wejammin@gmail.com` is a verified destination. No secret rotation,
  inbound Email Routing change, manual email dispatch, or synthetic threshold
  is warranted. AC209 is reduced to the genuine threshold-triggered
  provider/mailbox receipt; Slice 09 remains 279/283.

- 2026-09-06 AC209/AC265 focused remediation: current production Worker version
  `a726691a-64bc-47e5-bc5e-6b52088efbff` recorded 504 successful scheduled
  invocations after deployment with zero script exceptions. Cloudflare's
  zone-level `emailSendingAdaptive` individual and aggregate queries returned
  zero outbound events across the latest 30-day window ending
  `2026-09-06T20:37:15.119Z`; AC209 therefore has no genuine provider receipt
  to retain. Fresh staging and production provider-catalog requests returned
  HTTP 200 at `2026-09-06T20:43:30.654Z`, with Google still
  `temporarily_unavailable`. No threshold, traffic, OAuth state, or identity was
  synthesized. AC265 retained-report verification now parses a strict redacted
  hosted body, binds it to protected release identity, streams the fixed report
  tree, and pins each bounded read to one descriptor and byte buffer. It rejects
  symlinks, special files, and unreferenced evidence. Focused
  regression RED failed 7/24 checks; GREEN passes 54/54. This hardens future
  evidence without claiming a hosted run. Final `pnpm validate` passes 433
  Vitest files / 3,248 tests at 100% coverage, 102/102 Playwright checks, and all
  remaining repository gates. AC209 and AC265 remain open; Slice 09 stays
  279/283.

- 2026-09-07 evidence and CI gate stabilization: the executable evidence gate
  now runs separately from coverage, strips parent Vitest and npm lifecycle
  state before spawning bounded child commands, and is enforced in CI with a
  45-minute quality-job ceiling. Functional browser gates use one isolated
  worker, while the production-built Slice 09 route owns a dedicated five-test
  performance/auth suite. Full local `pnpm validate` passes 433/433 Vitest
  files and 3,248/3,248 tests at 100% coverage, 101/101 functional Playwright
  checks, 5/5 production-built Slice 09 Playwright checks, builds, bundle
  budgets, and performance smoke. A fresh staging catalog request returned
  HTTP 200 with Google `temporarily_unavailable`; direct staging Supabase
  authorization returned HTTP 400 `validation_failed` because Google remains
  disabled. No alert, OAuth flow, identity, or accessibility evidence was
  synthesized. AC209, AC211, AC265, and AC266 remain open; Slice 09 stays
  279/283 and Slice 10 remains locked.

- 2026-09-08 four-gate remediation: AC209 production configuration and three
  fresh scheduled evaluations are healthy, but the retained 31-day Email
  Sending window contains zero events and no genuine receipt. AC211 run
  `34187499317` exposed Cloudflare request-schema drift; PR `34` moved
  `view: events` to the required top level and added completed-run/empty-result
  guards. Full local validation passes 434/434 Vitest files, 3,256 tests plus
  one intentional skip at 100% coverage, 101/101 functional Playwright checks,
  and 5/5 production-built Slice 09 checks. Exact-main CI `34189412445` and
  staging `34189831032` pass for SHA
  `ad1efe40963e3273714dfdee85c9a97a89d1123b`; corrected collector run
  `34189916813` reaches the real provider dataset and fails closed because
  production samples are insufficient. AC265 recheck confirms Google disabled,
  zero hosted users/identities, and no approved OAuth client. AC266 hosted
  Chromium axe, media, zoom, and keyboard checks pass, but the two signed real
  platform reports cannot run on the Linux-only host/runners. No external
  acceptance item closed; Slice 09 remains 279/283 and Slice 10 remains locked.

- 2026-09-08 hosted OAuth remediation follow-up: the exact staged candidate
  `10f320b97ccce0c62fba2ee27a3b792f08f83285` passed CI `34224641678` and
  staging `34225256920` / deployment `6327379740`. Google is now configured
  through Supabase Auth, and the provider registry is `enabled` and verified at
  version `16`. A live external-browser callback retained five distinct
  cookies, completed the session boundary, reached the protected registry route,
  and created one real Google identity. This supersedes the pre-configuration
  Google-disabled result above; AC265 remains open for the approved
  9-role/10-scenario hosted report, role/identity lifecycle, MFA/step-up, and
  teardown evidence. AC209, AC211, and AC266 remain open; Slice 09 stays
  279/283 and Slice 10 remains dependency-locked.

## Depth Ratio

- Authored acceptance items: 279/283 verified; authored depth ratio: 0.986.
- Active implementation completion: 279/279; active depth ratio: 1.000. AC209, AC211, AC265, and AC266 are
  excluded from the active implementation denominator while remaining
  authored, unchecked, and mandatory on their own timelines.

## Completion Signature

- Date: 2026-09-26; runtime entrypoint: Node 22.23.1 / pnpm 11.24.0.
- Slice 09 implementation: complete at 279/279 active; authored 279/283
  verified (0.986) with four genuine-evidence criteria still unchecked.
- `pnpm validate`: exit 0; 644 Vitest files, 5,456 passed + 1 skipped,
  100% coverage; Chrome E2E, build, bundle, and performance gates passed.
- `pnpm db:verify`: exit 0; 65 pgTAP files / 2,324 tests; generated types match.
- `scripts/check-progress-consistency.mjs --json`: exit 0, `consistent`,
  Phase 2 9/17. This signs implementation completion only, not AC209, AC211,
  AC265, AC266, or production readiness.

## Blocking release evidence (current as of 2026-09-26)

DEC-105 moves AC265 out of the active implementation denominator. AC265 is a mandatory pre-release hosted gate and does not block Slice 10 implementation.
AC266 remains the pre-release real-device gate. Both AC265 and AC266 must pass
before production readiness/release; neither is waived by Slice 09
implementation completion. AC209 is a production-rollout/post-deployment gate that must pass before alerting is declared ready. AC211 is post-launch operational SLO acceptance that is mandatory after initial launch. Each remains authored and unchecked.

- P2-S09-AC-209 (production-rollout/post-deployment evidence gate, unchecked):
  retain a genuine post-configuration redacted live-delivery
  receipt. The read-only Email Routing day-count probe
  [run 36067233068](https://github.com/WeJustJammin/wejammin/actions/runs/36067233068)
  succeeded from exact `main` `20338c72` and reported **9 delivered routing rows
  across 4 days** (2026-09-22/1, 2026-09-12/4, 2026-09-11/3, 2026-09-05/1) in
  the 31-day window; the Email Sending dataset still reports **zero** in both
  windows (`zone_wide_missing`). Grouped routing counts carry only `date` and
  `status`, so none is attributable to the 2026-09-22 control alert, and the
  provider may sample adaptive datasets. The earlier `provider_graphql_error`
  on `emailSendingAdaptive` is repaired: the read-only dataset presence probe
  [run 36059761536](https://github.com/WeJustJammin/wejammin/actions/runs/36059761536)
  reached that dataset directly and returned zero rows instead of a provider
  error, so the error condition itself is cleared and what remains is the
  absence of sending telemetry. The read-only email diagnostic
  [run 36069837542](https://github.com/WeJustJammin/wejammin/actions/runs/36069837542)
  then queried that node over the exact hour of the verified send and returned
  `settings=available` with `rowsReturned=0` and classification `zero_rows`,
  confirming the query path is healthy and the dataset is empty for that hour.
  Neither run yields a correlated Sending event or a delivered `dlq_nonempty`
  row, so a fresh exercise is deferred until the evidence path works. The open
  gate is the correlated
  provider event plus a delivered `dlq_nonempty` row for the exact release.
  Per-event routing probe
  [run 36083336932](https://github.com/WeJustJammin/wejammin/actions/runs/36083336932)
  went further and found exactly **one** provider-reported `delivered` per-event
  row inside that same hour, marked final, with one complete message-id digest;
  its `action` label is `unknown`. No comparable message identifier is held from
  the send itself, so the row is not attributable to the control alert and AC209
  stays open on the same gate.
- P2-S09-AC-211 (post-launch operational SLO acceptance, unchecked): collection
  [run 36038007951](https://github.com/WeJustJammin/wejammin/actions/runs/36038007951)
  (UTC day 2026-09-23) passed preflight and failed closed for insufficient
  samples: `commands=0`, `protectedRpcs=0`, `acceptances=0`, and
  `queueFirstAttempts=0`, against floors of 200/200/200/1. No artifact was
  produced. The Sep-22 run `35846440023` had failed earlier on
  `malformed_queue_analytics_row`; that row-shape defect is fixed and promoted
  in `21929176`, and this run's queue envelope was accepted with
  `rowCount=0`, so the remaining blocker is genuine production volume. No
  complete retained UTC-day report exists; retain a later complete day with at
  least 200 samples, all five SLO results, and daily queue/DLQ counts.
- P2-S09-AC-265 (mandatory pre-release hosted gate, unchecked): the latest candidate authorization
  attempt used PR #80 SHA
  `918f598525de772c82b0a0bcd82348ea8f5d523d`, which passed CI `34823698333`
  and staging `34824312138` / deployment `6433521892`. Preflight `34824500796`
  passed, but authorization foundation run `34824651793` failed at
  `staging_prepare`; no hosted browser matrix or accepted 9-role/10-scenario
  report exists. PR #91 is the promoted CP-04d implementation baseline at exact SHA
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
  `29.956710999999927 ms` against the `500 ms` threshold; automated axe digest
  `6a7f59d9792a176e3032a9b410c6a0c1bb03850f27ed2918bc98fe82fddbbcf4`,
  serious/critical `0/0`. These are exact-main CI and staging promotion proofs
  only; staging proof does not equal hosted AC265 acceptance. CP-01 through CP-04b provide
  promoted staging-only outage-lease, safe-resource/runner-mapping registry,
  signed mapping/target attestation, target-read, and target-registration
  foundations. They intentionally seed no live policy, target, registry row,
  signing key, retained attestation/evidence artifact, hosted matrix, or
  independently authenticated receipt. CP-04c PR #90 remains the prior
  artifact-attestation and branded-resolver foundation; CP-04d PR #91 is the
  latest promoted private source-manifest and authority foundation. The
  promotion does not represent a hosted producer/source population,
  protected signer execution, retained hosted artifact, external replay
  evidence, or hosted acceptance. The canonical mapping/resource and target sources, role/session
  broker, MFA/step-up, evidence service, teardown, durable uniqueness, and
  complete hosted Auth/RLS/IdP matrix remain open.
- P2-S09-AC-266 (pre-release real-device gate, unchecked): owner-deferred
  because the required real devices are
  unavailable. Retain operator-attested VoiceOver/Safari and NVDA/Firefox
  manual smoke against the exact hosted candidate when devices are available;
  Linux-hosted automation cannot replace either real-platform report.

Operational controls outside the 283-item authored acceptance count are verified for
this candidate: fail-closed staging migration executed before app deployment,
immutable migration evidence retained, exact-main-SHA CI/staging/deployment
identity recorded, two consecutive production cron evaluations succeeded, and
the staging/production auth-provider catalog transport is healthy.
Slice 09 implementation is complete at 279/279 active; all four deferred
acceptance gates remain open and mandatory. AC265 and AC266 must pass before
production readiness/release. AC209 must pass before alerting is declared
ready, and AC211 is mandatory after initial launch. None is passed, accepted,
or waived. Slice 10 implementation is unblocked by DEC-105.

## 2026-09-21 AC266 owner-deferred phase propagation

- The authored Slice 09 ledger remains **283 IDs**. Active Phase 2 completion
  excludes unchecked AC266: Slice 09 is **279/282 active**, and Phase 2 has
  **1,999 active criteria out of 2,000 authored**.
- AC266 remains owner-deferred because the required real devices are
  unavailable. It is excluded from active Phase 2 completion, but remains
  mandatory for post-Phase 2 production-readiness/release.
- AC211 run `35560241699` passed preflight but collection failed for insufficient
  samples (`commands=0`, `protectedRpcs=0`, `acceptances=0`,
  `queueFirstAttempts=0`); no artifact exists. AC209, AC211, and AC265 remain
  the only Slice 10 blockers. Slice 10 remains locked on those three criteria.

## 2026-09-21 AC265 CP-04a approved outage-target attestation

- Added the now-promoted service-role-only
  `ac265_approved_outage_target_read` RPC over the CP-01 approved-target rows.
  The read returns a redacted canonical target projection and the stored
  `targetSha256`; it does not seed a target or expose a hosted route.
- Added the strict canonical `ac265-approved-outage-target-v1` contract and a
  distinct domain-separated Ed25519 attestation binding the exact target bytes,
  target/reference, run-scoped hosting/Supabase/deployment/dependency/route
  scope, key ID, and validity window. The protected manual main/staging
  entrypoint and workflow, verifier, and policy require this signed target;
  callback authenticity injection is not accepted.
- Focused AC265 verification passes **54 files / 483 tests** with
  `pnpm type-check` green. Exact-runtime `pnpm validate` exits 0 with **549
  Vitest files, 4,366 passed + 1 intentional skip (4,367 total)**, 100%
  coverage, 101 functional Chromium checks, five production-built checks,
  green builds/bundle checks, and local API p95 **1.377056 ms**.
- After a clean reset, all `pnpm db:verify` components are green: **57 pgTAP
  files / 2,087 assertions**, database lint, and generated-type checks pass.
- Independent security review found no CP-04a blocker; a protected orchestrator
  remains a required trust boundary. PR #86 / exact-main SHA
  `4fa8691d24177d0a528335f3c3d06ef50d67d3a9`, CI `35597438023`, and staging
  workflow `35598236704` / deployment `6568074493` are green.
- No live target-signing key/configuration, seeded target or registry rows,
  retained target/attestation artifact, attestation workflow run, hosted
  browser matrix, independently authenticated receipt, or AC265 acceptance
  exists despite code promotion. At that checkpoint AC265 was open at
  **279/282 active** and Slice 10 was locked on AC209, AC211, and AC265; AC266
  remained unchecked and owner-deferred as the mandatory post-Phase 2
  production-readiness/release gate.
- See the [CP-04a verification record](../verification/2026-09-21-ac265-approved-outage-target-attestation.md).

## 2026-09-21 AC265 CP-04b approved outage-target registration (promoted private foundation)

- Added the local contract, bounded service-role-only RPC, and forward-only
  migration for owner-approved outage-target registration. The migration keeps
  immutable policy and registration ledgers empty; registration derives target
  scope from authenticated authorization/candidate context and server policy,
  binds exact correlation/idempotency references, and returns only a redacted
  registered envelope. No live policy or target is seeded and no hosted route
  is exposed.
- The RPC client suite passes **15 tests**; together with the registration
  contract/public-export tests this is **3 files / 24 tests**. The registration
  SQL passes **35 pgTAP assertions**, including direct registration-to-lease
  acquisition proving that the registered target remains valid for the exact
  CP-01 60-second lease. The separate two-connection concurrency proof passes
  **2 assertions**. The policy requires **exact 120-second target validity**,
  leaving a bounded 60-second acquisition window before the exact 60-second
  lease; future-dated or too-short policy windows return generic conflict.
- The CP-04b baseline `pnpm validate` passed **551 Vitest files, 4,387
  passed + 1 intentional skip**, with **13,143/13,143 statements, 9,850/9,850
  branches, 2,160/2,160 functions, and 12,224/12,224 lines** (100%). The
  evidence-map gate passed; Playwright passed **101 functional + 5 production-built
  Slice 09 real-route checks**. Builds, bundle budgets, and performance are
  green; API p95 is **1.491154 ms**. Fresh `pnpm db:verify` passed
  **59 pgTAP files / 2,124 assertions**, with database lint exiting 0 after **46
  longstanding warnings** (39 never-read, 6 unused, 1 immutable/stable) and
  generated database types matching. Architecture compile passed **1,632 nodes /
  10,125 edges** with 55 known lint issues. PR #88 implementation main SHA
  `52b66272e61331827c59ac1e169868474a2c09c8`, PR CI `35611484121`, exact-main
  CI `35612415141`, staging `35613284966`, and deployment `6570861931` are
  green. Promotion artifact `10645302055` has digest
  `sha256:12f05e8371586996dc413b85b75167934045f342091defff5197435b8b707782`;
  staging p95 was **32.589357 ms** and automated axe digest was
  `df2522f8512dcea587146f5bce43ad5232b94964d5048825ffdb745286dd772d`.
- CP-04b is promoted as code/staging evidence only and has no live
  policy/target, signing-key configuration, retained target/attestation/evidence
  artifact, hosted matrix, independently authenticated receipt, or AC265
  acceptance. Read-only AC209 verifier `35612514031` failed with
  `provider_graphql_error` after all preflight/protection/workspace gates and
  produced no effects or receipt. AC265 remains open at **279/282 active**;
  Slice 10 remains locked on AC209, AC211, and AC265. AC266 remains unchecked,
  owner-deferred, and mandatory at the post-Phase 2 production-readiness/
  release gate. See the [CP-04b verification
  record](../verification/2026-09-21-ac265-approved-outage-target-registration.md).

## 2026-09-09 external-evidence remediation update

- AC209: production configuration and scheduled evaluations remain healthy;
  no genuine threshold-triggered delivery receipt exists.
- AC211: run `34296129205` truthfully failed the complete 2026-09-08 UTC day
  for insufficient natural samples; count-only failure diagnostics are ready
  for the next eligible complete-day run after `2026-09-10T00:00:00Z`.
- AC265: one real Google hosted identity flow is proven. The remaining nine-role
  gate conflicts with the adult-only launch policy and deferred mandate scope.
  The prior Slice 13 attribution was incorrect: BE03a inherits authority from
  BE01; Slice 13 covers navigation. See the
  [source audit and scope proposal](../verification/2026-09-09-ac265-scope-conflict.md).
  Scope correction approved on 2026-09-09: deferred guardian/junior/business
  mandate cases require exercised denial; authorized cases and all ten scenarios
  remain mandatory. No identity grants were changed. Hosted execution remains open.
- AC266: exact-release axe/provider evidence collection is implemented and
  locally validated. Exact-main staging run `34362941970` on
  `a4a411d2edd3c83057392fd86f87c93fd72e220c` passed served-release,
  provider-version, hosted axe, and final axe binding, but published no
  verified candidate because natural API p95 was `526.912447 ms` against the
  locked `<500 ms` budget. The follow-up preserves the threshold and makes
  both CI/staging streamed JSON producers fail at source through `pipefail`
  with silent pnpm output. Signed
  VoiceOver/Safari and NVDA/Firefox reports remain required.
- AC266 follow-up: PR `44` merged as
  `54852db03394ae2763b3241c100837c0a229fe11`; exact-main CI
  `34367574498` passed. Staging `34368311674` passed its public contract probe
  but failed closed when an axe browser document observed a different release
  header during edge propagation. All three live canonical paths later served
  the exact SHA. The collector now retries only this redacted mismatch five
  times at three-second intervals with a fresh context, while all path/status/
  origin/navigation/axe failures remain immediate. Staging CLI verification
  now rejects any expected-release override that differs from `DEPLOY_SHA`.
- AC266 exact-main result: PR `45` merged as
  `8c319243c459017e3298c00c11a071671a0459d7`; CI `34373503215` and staging
  `34374213155` / deployment `6354008407` passed. Verified-candidate artifact
  `10113208945` binds all ten promotion gates, 34 migrations, and both staging
  Workers at 100% traffic to that SHA. Natural API p95 was `71.92763 ms` over
  20/20 samples with zero retries/errors. Retained Chromium axe evidence covers
  all three canonical paths with zero violations and zero Serious/Critical
  findings. AC266 stays open only because signed VoiceOver/Safari and
  NVDA/Firefox manual reports are still required; automated evidence is not a
  substitute.

Validated with Node `22.23.1` and pnpm `11.24.0`: 443 Vitest files, 3,308
passing tests plus one intentional skip, 100% coverage, 101 functional
Playwright checks, 5 production-built Slice 09 checks, builds, bundle budgets,
and performance smoke. Status remains **279/283**; Slice 10 remains locked.

## 2026-09-13 release-candidate hardening

- Added per-tab acting-context selector isolation, same-origin-only binding
  headers, canonical session/context verification, and metadata-free dependent
  surface invalidation for accepted, ambiguous, and revoked context changes.
- Bound CMS and private relationship reads/commands to the current tab. The
  relationship projection stays read-only until bounded canonical organization
  and membership pagination verifies the target/version; public ORG-02 remains
  anonymous. Live server-to-browser revocation publication is not claimed.
- Added audited bounded idempotency expiry cleanup and scheduled sweep handling,
  while preserving manual-review `noRetry` work. Added fail-closed AC265 hosted
  prerequisite validation without claiming a hosted matrix run.
- `pnpm db:verify` passed 50 files and 1,818 assertions. Full `pnpm validate`
  passed 478 Vitest files, 3,699 tests plus one intentional skip, 100% coverage,
  all executable Slice 09 evidence checks, 101 functional and 5 production-built
  browser tests, builds, bundle budgets, and performance smoke.

AC209, AC211, AC265, and AC266 remain externally open. Status remains
**279/283**; Slice 10 and dependent Slices 11–17 remain locked pending genuine
hosted/manual acceptance evidence.

## 2026-09-13 AC266 manual-evidence prerequisite hardening

- Added strict `ac266-manual-a11y-v1` report contracts for the two locked
  platform pairs. Reports require the exact authenticated and authorized CMS
  workbench path/state, matching OS/browser/screen-reader product families,
  UTC timestamps, opaque operator IDs, all 11 structured checks, explicit
  heading/status observations, and operator-attested complete target
  measurements. Free-text notes and unknown fields fail closed.
- Added protected intake and finalizer workflows for digest-bound report
  secrets. Raw report bytes exist only in a run-ID/run-attempt-specific private
  runner-temp directory; cleanup runs in the implementation and an `always()`
  step. Only sanitized 30-day manifests are uploaded.
- Bound finalization to the exact repository, workflow, main SHA, staging run
  and attempt, candidate artifact, deployment, hosted origin, and trusted
  intake cutoff. Real GitHub deployment histories with
  `waiting`/`queued`/`in_progress` are parsed, while any newer active,
  failed, inactive, or successful deployment overlapping a report window
  rejects the evidence.
- Moved both report-secret jobs to isolated GitHub-hosted `ubuntu-24.04`
  runners. The three project self-hosted runners are persistent and continue
  to execute same-repository PR CI, so they are not an acceptable boundary for
  these raw report secrets.
- Created protected environment `ac266-manual-evidence` (ID `21821361680`)
  with the exact staging origin, `main`-only policy, required business-account
  reviewer, and administrator bypass disabled. Owner self-approval remains
  possible in the single-account repository and is not independent review.
- The dedicated AC266 manifest is a prerequisite, not the combined release
  sidecar. The current combined verifier still requires the exact source report
  bytes to be privately re-materialized, parsed, matched to the manifest, and
  removed by a protected assembly step.
- Clean Node 22.23.1/pnpm 11.24.0 verification passes 486 Vitest files,
  3,785 tests plus one intentional skip, 100% statement/branch/function/line
  coverage, every executable Slice 09 evidence check, 101 functional and five
  production-built browser tests, builds, bundle budgets, and performance
  smoke. `pnpm db:verify` separately passes 50 pgTAP files and 1,818 tests with
  migrated database-type parity.

Earlier dated entries use “signed” as shorthand for manual sign-off. No
cryptographic report signature exists; the implemented boundary uses an opaque
operator attestation, exact byte digests, protected workflow provenance, and
environment approval.

No VoiceOver/Safari or NVDA/Firefox report was created, accepted, or inferred,
and no protected AC266 workflow was dispatched. AC266 is owner-deferred and
remains unchecked; Slice 09 remains **279/283** with depth ratio **0.986**, and
Slices 10–17 remain dependency-locked.

## 2026-09-13 AC209 zone-diagnostic follow-up

- AC266 prerequisite hardening merged as exact main SHA
  `47b5ff2ca788f4470254c0161e636246719b98da`. CI `34749050376` and staging
  `34749287577` / deployment `6419900767` passed, and the verified-candidate
  artifact now contains the exact staging run/attempt identity sidecar.
- Reconciled live `ac266-manual-evidence` environment `21821361680` after
  detecting administrator-bypass drift. Administrator bypass is again disabled;
  reviewer `WeJustJammin`, owner self-review, and the sole custom `main` branch
  policy remain intact. No AC266 report secret or manual report exists.
- Protected production attempts `34749383380` and `34749687614` used that
  exact candidate. Both passed immutable promotion identity and protection
  preflight plus explicit production-environment approval, then failed closed
  at `Verify Cloudflare observability permissions` with sanitized
  `provider_graphql_error`. Migrations, release-evidence verification, Worker
  deployments, and production health checks did not run; production remains
  on `c8f0cbd52cb6140ee1a756f106fa329f8c23b0e2`.
- TDD now classifies bounded HTTP-200 GraphQL error messages without retaining
  provider detail: explicit authentication/authorization phrases map to
  `provider_permission_denied`, fixed query/schema/resource phrases map to
  `provider_resource_unavailable`, and mixed, unknown, or oversized messages
  remain `provider_graphql_error`. Schema classification precedes permission
  matching so a field named `forbidden` cannot be misclassified. RED reproduced
  five original classification gaps, the authentication gap, and the schema
  precedence gap; GREEN passes 64 focused collector tests and 124 related
  AC209/Cloudflare tests. Independent adversarial review found no remaining
  P0–P2 issue.
- Final Node 22.23.1/pnpm 11.24.0 `pnpm validate` passes 486 Vitest files,
  3,789 tests plus one intentional skip, 100% coverage, all executable Slice 09
  evidence checks, 101 functional and five production-built browser tests,
  builds, bundle budgets, and API p95 smoke (`1.669135 ms`). `pnpm db:verify`
  passes 50 pgTAP files / 1,818 tests with migrated type parity.

No acceptance item is inferred from diagnostics. AC209 still requires the
effective zone-scoped token and genuine delivery evidence; AC211, AC265, and
AC266 remain open. Slice 09 remains **279/283** with depth ratio **0.986**, and
Slices 10–17 remain dependency-locked.

## 2026-09-13 AC209 production attempt 2

- Exact main SHA `5c1af8cb7be676ec3e0bca4be5f28ceb91aeb776` passed CI
  `34751474024` and staging `34751910125`.
- Protected production run `34752000687`, attempt 2, was approved and then
  failed closed at the Cloudflare Email Sending capability check before any
  migration or deployment. Production remains unchanged on
  `c8f0cbd52cb6140ee1a756f106fa329f8c23b0e2` / deployment `6417116181`.
- Cloudflare Email Sending domain onboarding/DNS remains required. No genuine
  provider/mailbox receipt or production mutation occurred; AC209 remains open.

## 2026-09-13 AC265 hosted contract hardening (local only)

- Added local `ac265-hosted-runner-v1` contract guidance for immutable candidate
  identity, trusted run bounds, exact role/scenario mappings, authenticated
  receipts, isolation, redaction, and bounded cleanup. The contract explicitly
  does not authorize or prove hosted execution.
- Hardened the report/receipt temporal contract to require caller-supplied
  maximum run duration, keep the report within that bound, constrain each
  receipt's `issuedAt` to the execution window and trusted cutoff, and require
  the cleanup receipt to be issued at or after cleanup completion.
- Focused temporal-coherence suite passes 68/68 tests, including per-receipt
  window/cutoff checks and inclusive cleanup/report-end boundaries. This is
  local contract verification only: no protected hosted runner, complete
  9-role/10-scenario report, or AC265 acceptance is claimed.
- Final AC265/retained-evidence suite passes 22 files / 201 tests after
  adversarial review. Full `pnpm validate` passes 507 Vitest files / 3,981 tests
  plus one intentional skip at exact 100% coverage, all executable Slice 09
  evidence gates, 101 functional plus five real-Slice-09 Playwright checks,
  builds, bundle budgets, and performance smoke. Separate database verification
  remains green at 50 pgTAP files / 1,818 tests with type parity.

## 2026-09-23 AC265 CP-02 registry registration transport (plumbing only, unmerged)

This is an isolated worktree feature branch (`codex/ac265-cp02-registry-population`
from `origin/main`); nothing here is pushed, merged, or deployed, and no registry
row, identity, or grant is created.

Independent security review found a policy blocker, so this work is now
described honestly as registration transport/plumbing only. CP-02 (unlike
CP-04b) pins no approval policy table, so a `workflow_dispatch` request body
plus the currently unreviewed `staging` environment does NOT prove
owner-approved safe resources or mapping. The owner-approval binding for the
CP-02 population gate remains OPEN; this commit does not close it and is not
acceptance evidence.

- Added the missing TypeScript register transport for the already-promoted
  CP-02 migration. No migration and no contract change: the strict
  `ac265-hosted-approved-registry-control-v1` schemas are consumed as-is, so
  `contracts:check` is unaffected.

```text
infra/workflows/ac265-approved-registry-registration-rpc.ts   (new bounded service-role client; transport only)
infra/workflows/register-ac265-approved-registry.ts           (new manual registration entrypoint; owner-approval binding open)
tests/ac265-approved-registry-registration-rpc.test.ts        (new, RED-first)
tests/ac265-approved-registry-registration-entrypoint.test.ts (new, RED-first)
tests/ac265-approved-registry-registration-workflow-contract.test.ts (new)
.github/workflows/register-ac265-approved-registry.yml        (new, main-only/staging; transport only)
```

- The bounded service-role client POSTs only the strict register request to
  exactly `ac265_approved_safe_resource_register` or
  `ac265_approved_runner_mapping_register` at `https://<projectRef>.supabase.co`
  (`^[a-z0-9]{20}$`), with printable secret <= 8192, `redirect: 'error'`,
  `cache: 'no-store'`, a 64 KiB streamed response cap, content-length rejection,
  fatal UTF-8 decoding, a fixed 10-second abort deadline, duplicate-member
  rejection, awaited body cancellation, and one generic failure per RPC.
- The register results have no `status` field (unlike CP-04b): success is bound
  by echoing `authorizationRef`, `idempotencyRef`, `environment === 'staging'`,
  `hostingProjectId === 'wejammin-staging'`, `supabaseProjectRef === projectRef`,
  and `redacted === true`, plus `locatorSha256` and `resource.kind` for the
  safe-resource result and a full role/scenario mapping-to-resources re-binding
  for the mapping result. Any `{status:'conflict'}` response fails generically.
- The registration entrypoint reads only `$RUNNER_TEMP/ac265-registry-registration-request.json`
  (<= 32 KiB, strict schema, safe path/realpath checks), requires the full
  registration environment, and appends only the server-derived resource reference
  and kind, or the mapping id, to `GITHUB_OUTPUT` and `GITHUB_STEP_SUMMARY`.
- The workflow is manual-only (`workflow_dispatch`), main-only
  (`if: github.ref == 'refs/heads/main'`), `runs-on: ubuntu-24.04`,
  `timeout-minutes: 10`, `environment: staging`, `permissions: { contents: read }`,
  pinned `actions/checkout` SHA, and uses `.github/actions/setup`. It needs no
  signing key; `SUPABASE_SECRET_KEY` already exists in `.github/SECRETS.md`.
- RED proof: both new test files first failed with `Cannot find module` before
  the client and entrypoint existed. GREEN (actual completed local runs, not
  aspirational): RPC client 20 tests, entrypoint 8 tests, workflow contract 6
  tests — 34 new tests, and 49 across those three plus the untouched CP-04b
  client suite. These ran in this worktree at 01:51–01:59 local on the pinned
  workspace; a confirming focused re-run after the Prettier reformat
  (`--maxWorkers=1`, 02:17 local, after the concurrent PR #96 CI coverage gate
  ended) again reported 3 files / 34 tests passed. Prettier and ESLint are clean
  on the new files. Full `pnpm validate`/Playwright remain deliberately unrun to
  avoid host contention, per operator direction.
- Boundary: this transport registers only opaque, server-derived registry rows
  behind the existing forced-RLS/service-role RPCs. It does not seed identities,
  mandates, grants, or resources, does not verify underlying resource safety or
  owner approval, mints no receipt or attestation, and provides no hosted
  runner. It closes no AC265 criterion and is not acceptance evidence.

## 2026-09-23 AC265 CP-02 owner-approved population gate (local only, unmerged)

Independent security review found that a dispatched request body plus the
unreviewed `staging` environment does not prove owner-approved safe
resources or mapping, and CP-02 (unlike CP-04b) pinned no approval policy. This
adds an Option A forward-only, fail-closed approval gate so the registry RPCs
cannot be used as a population path until an owner-approved policy exists.

- New forward-only migration `20260923090000_ac265_approved_registry_population_gate.sql`
  creates three EMPTY private pinned policy tables
  (`ac265_approved_registry_resources`, `ac265_approved_registry_role_kinds`,
  `ac265_approved_registry_scenario_roles`: forced RLS, no direct grants,
  immutable insert-only, guard function revoked from every runtime role).
  It redefines `platform_api.ac265_approved_safe_resource_register(jsonb)` and
  `platform_api.ac265_approved_runner_mapping_register(jsonb)` with
  `create or replace` to require EXACT SET EQUALITY against those pins,
  bidirectionally, before any registry insert. The strict
  `ac265-hosted-approved-registry-control-v1` contracts are unchanged; no
  server-derived field is invented.
- It seeds no owner row, value, resource, identity, grant, or mandate. With the
  tables empty both RPCs fail closed and return only the generic
  `{"status":"conflict"}` sentinel, so the owner-approval binding remains
  OPEN. The gate is enforced inside the RPCs rather than by a row trigger
  because the register contract exposes only the conflict sentinel.
- Design decision (flagged): the pin is staging-wide (one locator digest per
  kind), following CP-04b's single-pinned-policy-reference pattern; there is no
  per-authorization dimension. The existing pgTAP suites were updated
  accordingly: `ac265_approved_runner_registry.sql` seeds the disposable pins
  (locators 1..4), and `ac265_approved_runner_registry_concurrency.sql`
  normalizes its per-authorization locator sets to that single pinned set and
  seeds the pins as the superuser fixture connection (never through
  service_role).

- Security-review correction: the first gate draft mixed a 1-column kind branch
  with 2-column role/scenario branches under one `UNION ALL`, which is
  invalid SQL (42601) rather than a conflict. The mapping gate is now three
  SEPARATE equal-arity bidirectional `EXCEPT` predicates (a: kind, one column;
  b: role-to-kind, two; c: scenario-to-role, two), verified programmatically to
  have uniform select arity within each predicate. The pgTAP suite also proves
  the missing-policy mapping case (all pins removed) returns only the conflict
  sentinel and writes no registry parent.
- `approval_ref` is documented as an opaque, documentation-only
  owner-approval locator: it is not an independently verified signature and
  grants no safety. Pins deliberately carry no time validity because they are
  immutable; expiry would require a further owner-approved forward migration.
  The pin proves only that a submitted digest equals a pinned digest, not that
  the underlying resource is real, synthetic, or safe.
- New pgTAP suite `ac265_approved_registry_population_gate.sql` proves the
  boundary: table/RLS/grant/immutability shape, fail-closed with no pins, a
  matching (kind, locator) registering, a non-pinned locator failing closed, a
  mapping equal to the pins registering, and drift in either direction (wrong
  role kind, missing scenario member) rejected by the gate with only the
  sentinel. Drift cases use fresh idempotency refs so the gate, not replay,
  rejects them.
- NOT YET RUN: the local Supabase stack was reserved by the parent's validation
  and then by PR #96 CI on this shared host, so `pnpm db:verify`/pgTAP and
  `db:types:check` are pending operator release. Expected follow-up once
  free: apply the migration, run `pnpm db:verify`, and regenerate
  `packages/data-access/src/database.types.ts` (the new private tables make
  the committed types stale, exactly as CP-04b's migration required). Closes no
  AC265 criterion; no hosted acceptance is claimed.
  AC209, AC211, AC265, and AC266 remain open. Slice 09 stays **279/283** with
  depth ratio **0.986**; Slices 10–17 remain dependency-locked.

## 2026-09-23 AC265 CP-04f frozen run-manifest contract and builder (local/private only)

- Adds the bounded frozen run-manifest contract `ac265-hosted-run-manifest-v1`
  at `packages/contracts/src/content-schema-registry/operational-release-evidence-hosted-run-manifest.ts`
  and its fail-closed builder at `infra/workflows/ac265-hosted-run-manifest.ts`.
  The manifest carries exactly the membership the runner contract names: the
  version, criterion, runner contract version, run ID, run correlation ID,
  immutable candidate identity, the nine role-matched `ac265-session://`
  references, the four approved `ac265-resource://` references, and the bounded
  control policy. It carries no session state, credentials, resource contents,
  or mappings.
- Session and resource references reuse the existing locked schemas rather than
  re-declaring them, so role alignment, nine-way distinctness, exactly-one-per
  locked resource kind, and v4 staging shapes are enforced by the same rules as
  the runner contract. The builder additionally re-derives every reference's
  lowercase SHA-256 digest and fails closed on drift, then emits canonical
  code-point-ordered UTF-8 bytes, a manifest SHA-256, and the exact canonical
  runner-contract bytes plus their SHA-256 for the retained V3 binding.
- Red→Green: the two new suites (`phase-02-slice-09-ac265-hosted-run-manifest-contract`
  and `-builder`) pass 12 tests covering pinned versions, missing/extra/duplicated
  role and resource references, role-mismatched and digest-mismatched references,
  control-policy bound violations, sensitive-member rejection, canonical
  byte-stability under member reordering, and the absence of any approval,
  attestation, broker, or mapping-resolution surface.
- Open contract reading requiring owner confirmation: the runner contract names
  a run correlation ID in the manifest but no AC265 module defines its format or
  source. This slice binds it as a UUID supplied by the protected orchestrator
  and never derives it from the run ID. Confirming that reading (or defining a
  different source) is a documented decision, not an inferred semantic.
- Verification is focused only: pinned Node 22.23.1 / pnpm 11.24.0 focused
  Vitest, `pnpm type-check`, ESLint on changed files, Prettier, and
  `pnpm progress:check` pass. Full `pnpm validate`, `pnpm db:verify`, and the
  broader contract suite are deferred to avoid contending for the shared local
  database and host with the CP-02 agent, and no hosted, provider, or
  acceptance evidence is claimed.
- This is local/private construction only. It establishes no protected session
  broker, approval source, hosted runner, receipt, report, or AC265 acceptance;
  AC265 and Slice 10 remain exactly as open and locked as before.

### 2026-09-23 independent-review fixes (CP-04f H1/H2)

- **H1 canonicalization defect (fixed).** The first cut sorted object members but
  left array elements untouched, so reordering the four safe resource references
  or any scenario's role list produced a different `runnerContractSha256` and
  `manifestSha256` for the same logical contract, contradicting the
  byte-stability claim. A RED test that reverses `resourceRefs` now passes:
  canonicalization normalizes exactly the two collections the locked contract
  treats as sets — `resourceRefs` to the locked resource-kind declaration order
  and each `scenarioRoleBindings[scenario]` list to the locked role declaration
  order — so one logical contract yields one digest.
- Normalization deliberately excludes ordered sequences. `roleResourceBindings`
  arrays, the session-handle record, and the resource-reference record are left
  in caller order because the V3 verifier deep-compares them against the
  independently attested `ac265-approved-runner-mappings-v1` bytes. Only the
  two set-like collections are reordered, and no role or scenario key is added,
  dropped, or renamed.
- **H2 mutable-byte defect (fixed).** The build result previously exposed
  `manifestBytes`/`runnerContractBytes` as the held `Buffer` instances, so a
  caller could mutate bytes after the digests were computed and silently break
  integrity; `Object.freeze` cannot be used on a non-empty `Buffer` with
  elements. The result now exposes `manifestBytes()`/`runnerContractBytes()`
  copy-on-read accessors returning caller-owned `Uint8Array` values. A RED test
  mutates every byte of both returned buffers and proves the published digests
  and subsequent reads are unchanged.
- **Documented limits.** `correlationId` is a non-authority correlation label:
  the schema accepts any UUID version, including nil and v1, so it is neither a
  v4 identifier nor asserted unique, and it carries no anti-replay, ordering,
  binding, or ownership meaning. `controls` carries the shared bounded control
  schema only; pinned policy values are enforced by the separately versioned
  `ac265-hosted-runner-policy-v1` comparison at verification time, not by this
  builder.
- **Verifier compatibility, bounded claim.** The builder emits
  `runnerContractBytes` as the exact canonical UTF-8 bytes it digests, and
  `runnerContractSha256` binds those same bytes, matching what the retained
  verifier hashes via `sha256Bytes(runnerContractBytes)`. This does not claim V3
  integration: the retained V3 path parses raw protected bytes supplied by
  trusted context, and wiring this builder into it is a separate step.
- Re-verified with pinned Node 22.23.1 / pnpm 11.24.0: 15 focused tests across
  both suites, `pnpm type-check`, ESLint `--max-warnings=0`, and Prettier. Full
  `pnpm validate` and `pnpm db:verify` remain deferred while the CP-02 agent
  holds the shared local database and host.

### 2026-09-23 re-review fixes (CP-04f H1c and scenario-order over-normalization)

- **V3 compatibility blocker (fixed).** The H1 fix over-reached: it normalized
  each `scenarioRoleBindings[scenario]` array to locked role declaration order,
  but `assertAc265HostedRunnerPolicyV1` compares those arrays to the
  independently attested `ac265-approved-runner-mappings-v1` bytes with
  `isDeepStrictEqual`, which is position-sensitive on arrays. A legitimate
  approval whose array read `[owner_full, entitled_read, ...]` was rewritten to
  `[entitled_read, owner_full, ...]`, so the verifier rejected a correct
  contract. Scenario-order normalization is removed entirely.
- `scenarioRoleBindings` and `roleResourceBindings` are now both left untouched.
  Their element order is approval-source-significant, so a reordered sequence is
  a different mapping and must move the digest instead of being normalized to
  match; there is no canonical set normalization for those collections. Only
  `resourceRefs` is normalized, and it remains order-stable.
- **H1c (fixed).** Bytes and digest were computed from a normalized copy while
  the returned frozen `manifest` retained the caller's original reference order,
  so `sha256(canonicalManifestBytes(result.manifest))` did not reproduce
  `manifestSha256` for reversed input. The builder now parses the normalized
  candidate and returns that same frozen object, so the returned manifest, the
  published bytes, and the digest describe one value.
- RED first: a rehash-under-reversed-references case failed with mismatched
  digests, and a reversed-scenario case failed because the digest did not move.
  Both now pass, and the scenario test additionally asserts the scenario order
  is retained verbatim in the canonical bytes and that the digest changes.
- Re-verified with pinned Node 22.23.1 / pnpm 11.24.0: 16 focused tests across
  both suites, `pnpm type-check`, ESLint `--max-warnings=0`, Prettier, and
  `pnpm progress:check`. Full `pnpm validate` and `pnpm db:verify` remain
  deferred while the CP-02 agent holds the shared local database and host.

### 2026-09-23 dedicated staging test accounts - owner decision recorded

- The owner decided on 2026-09-23 to provision dedicated staging test accounts
  for the nine locked AC265 roles. The decision and its unresolved gates are
  recorded in the
  [AC265 dedicated staging test accounts decision record](../verification/2026-09-23-ac265-dedicated-staging-test-accounts-decision.md).
  Nothing was provisioned and no criterion moved.
- Open gates recorded there: the Cloud Identity Free vs existing Google org
  choice is pending, the 2026-09-10 sole-admin-principal decision still governs
  privileged admin test identity and is not superseded, the separate async
  question on that privileged identity is unanswered, and the Chrome browser
  bridge is unavailable on this host. No credential, identity, grant, tenant, or
  resource was created.

### 2026-09-23 AC265 run-manifest read-side boundary (CP-04g, local/private only)

- Adds the missing read half for the frozen run manifest. The builder could emit
  canonical bytes and a digest, but nothing could read a manifest back from
  bytes, so a hosted consumer would have had to hand-roll a loose parse.
- `infra/workflows/ac265-hosted-run-manifest-crypto.ts` now owns one canonical
  form and one parse boundary: `parseAc265HostedRunManifestV1Bytes` rejects
  non-bytes, empty, and over-64 KiB input, duplicate JSON object members, schema
  drift, and any encoding that is not already canonical;
  `canonicalizeAc265HostedRunManifestV1` canonicalizes a value;
  `canonicalAc265HostedRunManifestBytes` and
  `canonicalAc265HostedRunnerContractBytes` produce canonical bytes;
  `verifyAc265HostedRunManifestSha256` binds a digest fail-closed; and
  `readAc265HostedRunManifestV1Bytes` is the digest-bound read entrypoint, so a
  consumer cannot read manifest bytes without proving them against the expected
  digest.
- The builder consumes the shared module instead of its own private copies, so
  the build and parse sides cannot drift. `lockedOrder`, the resource-reference
  normalization, the code-point canonical serializer, the digest helper, and the
  reference-digest checks now exist once. The builder re-exports
  `AC265_HOSTED_RUN_MANIFEST_MAX_BYTES`, `canonicalManifestBytes`, and
  `sha256Bytes` so existing imports are unaffected.
- Order semantics are pinned in the new suite. Only `resourceRefs` is
  order-insensitive, matching the V3 verifier's keyed-map read; a reversed
  resource set yields one digest in both the manifest and runner-contract byte
  paths. Approved `scenarioRoleBindings` order stays significant because the V3
  verifier deep-compares it against the independently attested
  `ac265-approved-runner-mappings-v1` bytes, so a reordered approval moves the
  runner-contract digest instead of being normalized to match.
- Exported canonical byte functions return a fresh plain `Uint8Array`, not a
  `Buffer` and never a retained internal alias, so a caller cannot mutate bytes
  after the digest was computed.
- Focused evidence: 3 files / 26 tests pass, covering 10 new read-boundary cases
  plus the existing builder and contract suites; ESLint `--max-warnings=0`,
  Prettier, and `pnpm progress:check` are clean under pinned Node 22.23.1 /
  pnpm 11.24.0. Full `pnpm validate` and `pnpm db:verify` remain deferred while
  PR #98 CI and the main/staging chain own the shared runner.
- Chronology note: the test file was authored before the implementation module,
  but an independent reviewer's focused run found 3/10 failures from `Buffer`
  versus `Uint8Array` equality and one over-generic expected error message. A
  passing pre-fix run was therefore never observed, so this record does not claim
  an observed RED; the failures were test and format integration defects rather
  than missing behavior.
- This is local/private construction only. No report-v3 contract change, no
  seeded identity, resource, grant, or registry row, and no hosted acceptance.
  The external gates listed in the decision record above are unchanged.

### 2026-09-23 AC265 CP-04h retained-report producer and redactor (local/private only)

- Adds the missing producer half of the retained-report path. Until now the
  repository could assemble a V3 report in memory and verify one from bytes,
  but nothing could publish the report the verifier reads. This adds the
  integrated producer plus the value-level redaction boundary it uses.
- `infra/workflows/ac265-retained-report-producer.ts` exposes the single
  production entrypoint `produceAc265RetainedHostedE2eReportV3({ assembly,
provenance, reportRoot, declaredReportPath })`. It calls the existing
  `assembleAc265HostedE2eReportV3` with the caller's exact runner-contract
  bytes, authenticated artifact resolver, and receipt references; serializes
  the assembled report exactly once into the retained byte form; derives every
  trusted receipt/evidence digest by resolving each reference through the
  resolver and hashing the returned bytes; then redacts, binds, and publishes
  those exact bytes. The published digest is SHA-256 over the bytes written, not
  over a canonical re-serialization, so the digest the retained verifier checks
  describes the artifact on disk.
- `infra/workflows/ac265-retained-report-redactor.ts` is the value-level
  boundary: provenance parsing with field-aware structural classes, the strict
  `ac265-hosted-e2e-v3` schema, provenance equality for every identity field /
  receipt slot / session digest / resource binding / window, and a focused
  prohibited-content pass over decoded member names and string leaves. There is
  deliberately no global high-entropy scan: the contract's own UUIDs,
  revisions, and digests are high-entropy by design and a secret can be shaped
  to match a digest, so structure plus provenance plus vocabulary is the guard.
- Supporting modules keep each file inside the 300-line utility cap and give
  the boundary one owner each: `-provenance.ts` (trusted facts, identity
  classes, reference patterns), `-binding.ts` (report-to-facts equality),
  `-prohibited-content.ts` (marker vocabulary), `-trusted-digests.ts`
  (resolver-derived digests), `-writer.ts` (exclusive atomic publication), and
  `-publication.ts` (the narrow byte-level boundary). The byte-level function is
  not exported from the producer: it lives in the explicitly named publication
  module, carries no assembler/broker/resolver, and requires complete trusted
  provenance, so there is no producer-named path that skips authentication.
- Redaction binding is layered and fails closed with one opaque message, so a
  rejection never echoes the material it rejected. Enforced: identity equality
  plus field classes (`ciRunId`/`stagingRunId` numeric, `deploymentId` numeric
  or `deployment-<n>`, `buildId` `ci-<n>[-<attempt>]`/`build-<n>[-<attempt>]`,
  `hostingProjectId` pinned `wejammin-staging`); slot-exact receipt refs AND
  digests (candidate, each role, each scenario, cleanup) so swapping two refs in
  the same run fails; session-handle and resource ref/digest equality against
  the authenticated runner contract, so a forged digest cannot stand in as
  proof; contract bytes bound to an externally trusted digest recomputed from
  those exact bytes; the report window inside deployment and trusted-cutoff
  bounds; and duplicate-JSON-member rejection on the raw bytes before
  `JSON.parse`. Cleanup is required to finish inside the window, not equal to
  `completedAt`, matching the locked schema.
- Publication is exclusive and idempotent: an owner-only (`0600`) temporary
  file in the destination directory, `link` publication that cannot replace an
  existing or racing destination, a post-publish readback confirming the
  destination holds exactly the intended bytes, an existing report with
  identical bytes treated as a no-op, an existing report with different bytes
  rejected, root and every existing path component rejected if symlinked,
  missing directories created `0700`, existing files bounded and read with
  `O_NOFOLLOW|O_NONBLOCK` plus an `fstat` regular-file check and the 10 MiB cap,
  and temporary artifacts removed on every failure path. Validation runs before
  any directory is created, so a rejected report leaves no artifact behind.
- RED/GREEN honesty: the first RED run failed only as module-not-found for both
  new suites, so that run proves absence, not behavior; a later run surfaced
  three genuine behavioral failures (a marker vocabulary that missed bare
  `Bearer`, identity free-form slots that admitted a person name, and an
  integration test that needed the full retained tree). This record therefore
  does not claim a clean behavioral RED. Four independent review rounds then
  found real defects, each fixed with a regression test: deployment IDs falsely
  rejected because the class demanded an alphabetic prefix; receipt binding
  reduced to set membership so two swapped refs passed; receipt/evidence
  digests only syntax-checked so a fabricated 64-hex value passed; cleanup
  equality stricter than the contract; and trusted session/resource digests not
  cross-checked against the authenticated contract.
- Focused evidence: 5 files / 60 tests pass, including the integrated
  assemble→derive→redact→bind→write path checked by the existing
  `verifyContentSchemaRegistryRetainedReports`, a sidecar-declared path that is
  not `hosted/e2e.json`, root-contains-only-the-declared-path, symlinked root /
  destination / intermediate directory rejection, an oversized existing report,
  a racing destination, and forged-digest and swapped-slot rejections. Under
  pinned Node 22.23.1 / pnpm 11.24.0, full `pnpm validate` passed with a
  verified exit status of 0 (captured with `set -o pipefail`): 587 test files,
  4826 passed + 1 skipped / 4827, 100% coverage (13,262 statements, 9,890
  branches, 2,174 functions, 12,340 lines), S09 evidence 7 passed, Playwright
  101/101 functional and 5/5 real-route, build and bundle budgets passed, and
  local API p95 1.366 ms against the 500 ms threshold. The local Supabase stack
  was started for this validation (migrations through `20260923090000`).
- Caller requirement recorded, not assumed: the CP-04f canonical builder emits
  code-point-ordered runner-contract bytes whose digest differs from the
  insertion-ordered `JSON.stringify` bytes used by the test harness for the same
  contract. The producer binds the trusted digest to the exact bytes supplied
  (`sha256Ac265RetainedReportBytes(runnerContractBytes)`), so the protected
  caller must pass the canonical bytes together with the digest of those same
  canonical bytes — exactly what the retained verifier hashes from its trusted
  context. A regression test documents the two forms and their differing
  digests.
- This is local/private construction only. No hosted acceptance, session
  broker, receipt issuer, evidence service, fault-control plane, or reseeded
  registry is added or implied; no identity, credential, resource, or grant was
  created; no AC265 criterion is closed and no contributor count moves. Totals
  remain 279/282 active (283 authored IDs), Phase 2 8/17, and 1,999/2,000 active
  criteria; AC209, AC211, and AC265 remain open, Slice 10 remains locked, and
  AC266 remains owner-deferred as the mandatory post-Phase 2
  production-readiness/release gate.

### 2026-09-23 AC265 run-manifest producer-side integration (CP-04i, local/private only)

- Closes the producer-side gap left open by CP-04f/CP-04g: the frozen
  `ac265-hosted-run-manifest-v1` builder and its digest-bound read boundary
  existed, but nothing in the retained V3 path imported them, so the protected
  run manifest could not reach the report producer at all.
- `infra/workflows/ac265-retained-report-run-manifest.ts` is the new binding
  owner. `parseAc265RetainedReportRunManifest` reads the manifest through the
  CP-04g `readAc265HostedRunManifestV1Bytes` boundary, so the bytes must hash to
  the independently trusted digest and must already be the CP-04f canonical
  form: duplicate members, schema drift, and insertion-ordered members fail
  closed instead of being quietly re-canonicalized onto a different digest. The
  bytes are snapshotted before verification and the digest is recomputed over
  that snapshot, so a caller mutating its array afterwards cannot change what
  the digest and the manifest describe. Membership (`criterion`,
  `contractVersion` against `schemaVersion`, `runId`, `identity`,
  `sessionHandles`, `resourceRefs`, `controls`) is then deep-compared against
  the runner contract parsed from the same `assembly.runnerContractBytes` the
  report is assembled from, so the two artifacts cannot validate each other and
  a manifest for another run, candidate, session set, resource set, or control
  policy is rejected even though it is internally valid.
- `produceAc265RetainedHostedE2eReportV3` now requires `runManifestBytes` and
  `expectedRunManifestSha256` in its strict key set, binds the manifest before
  assembly and before any directory is created, and returns `runManifestSha256`
  plus a copy-on-read `runManifestBytes()` accessor. A caller recomputing
  SHA-256 over the returned bytes reproduces the published digest, which is the
  regression the new suite pins. No criterion closes; no verifier, report
  schema, or contract module changed.
- Red→Green: the new suite
  `tests/contracts/phase-02-slice-09-ac265-retained-report-run-manifest.test.ts`
  covers the digest-equality canary, absent bytes/digest, insertion-ordered
  rejection (proving canonicalization is not silently applied), malformed
  digests, run/identity/session-reference drift, unknown request fields,
  byte-snapshot immutability, and that a rejected binding leaves no report on
  disk. Two of the first three failures were test-construction defects rather
  than absent behavior and were fixed; a scratch probe then confirmed the
  legacy four-key request still published while any manifest-bearing request
  threw, so the remaining RED proved the missing behavior rather than a harness
  fault. The scratch file was removed and is not part of the change.
- Full `pnpm validate` on the final tree passed with a verified exit status of
  **0** (pinned Node 22.23.1 / pnpm 11.24.0, `set -o pipefail`): **589 test
  files, 4834 passed + 1 skipped / 4835**, 100% coverage (13,262 statements,
  9,890 branches, 2,174 functions, 12,340 lines), S09 evidence 9 groups / 46
  passed with 5 skipped, Playwright **101/101 functional** and **5/5
  real-route**, build and bundle budgets passed, and local API p95 **1.751 ms**
  against the 500 ms threshold. The local Supabase stack was started for this
  validation, migrations through `20260923090000`.
- Browser policy: the repository's Playwright configs select
  `devices['Desktop Chrome']` without a `channel`, which launches Playwright's
  bundled Chromium rather than system Google Chrome. The first full run was
  stopped at the E2E stage for that reason and is not evidence; a second run hit
  a `127.0.0.1:8787` port collision with a concurrent agent's E2E server and
  executed zero E2E tests. The conclusive run used a temporary local
  `channel: 'chrome'` override in both configs and was verified at the process
  level to use `/opt/google/chrome/chrome` (Google Chrome 154.0.8037.57). Both
  overrides were reverted with `apply_patch` afterwards and are absent from this
  change; `git diff` for both config files is empty.
- Contract reading recorded, not inferred: the run manifest is a protected
  caller input because the locked `ac265-hosted-e2e-v3` schema is strict and
  carries no manifest member, so binding it into the report body would have
  meant a contract change. The manifest's correlation ID remains
  caller-supplied and is deliberately not part of the cross-binding.
- Independent-review fixes: `resourceRefs` is now compared through the same
  kind-keyed normalization the CP-04f builder applies, because the locked
  schema defines that collection as a four-element set rather than a sequence —
  the previous raw-order comparison wrongly rejected a valid contract that
  listed the same four references in another order (RED reproduced by disabling
  the fix). The stale pre-manifest `Ac265RetainedReportProductionResult` alias,
  which had no importers, was removed. Both byte inputs are now bounded by the
  existing `MAX_RETAINED_REPORT_BYTES` cap before parsing instead of decoding an
  oversized contract first. Re-verified: 12 tests in the suite, 5 files / 40
  tests focused, 108 files / 929 passed in `tests/contracts`, ESLint, Prettier,
  `tsc --build`, `progress:check`, and `git diff --check` clean. Port-bound
  Playwright gates were not re-run because the E2E port slot was owned by
  another task.
- Bounded claim recorded: the manifest digest is bound at the producer boundary
  and returned to the protected caller, and is not carried into any retained
  artifact. `ac265-hosted-e2e-v3` is strict with no manifest member and the
  release-evidence sidecar references only the report, so this is a locally
  verifiable property, not hosted proof; carrying it into retained evidence
  would require a decision to change a locked schema.
- This is local/private construction only. No hosted acceptance, session
  broker, receipt issuer, evidence service, fault-control plane, seeded
  identity, resource, grant, or registry row is added or implied. Totals remain
  279/282 active (283 authored IDs), Phase 2 8/17, and 1,999/2,000 active
  criteria; AC209, AC211, and AC265 remain open, Slice 10 remains locked, and
  AC266 remains owner-deferred.

### 2026-09-24 AC265 hosted-artifact attestation issuer (CP-04j, local/private only)

- Adds the missing live producer for the CP-04c/CP-04d hosted-artifact
  attestation path. The repository could already authenticate exact receipt and
  execution-evidence bytes and resolve them through a branded resolver, but
  `createAc265HostedArtifactAttestation` had no non-test callsite, so nothing
  could produce the signed companions the resolver consumes. See the [CP-04j
  verification record](../verification/2026-09-24-ac265-hosted-artifact-attestation-issuer.md).
- Designation: this entry is CP-04j because the CP-04i label is already owned by
  the run-manifest producer-side integration recorded above. No duplicate
  CP-04i designation is carried into this integration.
- `infra/workflows/ac265-hosted-artifact-attestation-issuer.ts` (with its
  `-inputs`, `-contract`, and `-signing` siblings) signs caller-supplied
  artifact bytes into canonical `HostedArtifactAttestationV1` companions with
  pinned key material, and `issue-ac265-hosted-artifact-attestations.ts` (with
  its `-contract`, `-files`, and `-sources` siblings) runs the protected
  issuance entrypoint that reads one bounded request document plus the exact
  artifact members, derives every subject from the bytes, and publishes the
  signed companions with a digest index beneath `RUNNER_TEMP`.
- Run identity is v4-only and lowercase-exact through one shared
  `HostedArtifactAttestationRunIdSchema` enforced by the issuer, the
  entrypoint, the CP-04c attestation contract, and the resolver trust clone. An
  earlier revision on the source branch widened three of those gates to a
  version-agnostic form while the entrypoint still enforced v4-only, which made
  a v7 acceptance path unreachable; that was corrected on the branch — the
  widened gates restored to v4-only, the entrypoint gate folded onto the same
  shared schema, and direct end-to-end coverage added for a non-v4 rejection
  and a v4 issuance — before this integration.
- Publication properties: the output directory must be exactly
  `${RUNNER_TEMP}/ac265-hosted-artifact-attestations` and must not pre-exist;
  it is created `0700` with the mode re-asserted on a held descriptor. Each
  attestation and the index are written `O_CREAT|O_EXCL|O_NOFOLLOW` at `0600`
  with `fsync` and a digest-bound readback. Request and artifact reads use one
  held `O_RDONLY|O_NOFOLLOW` descriptor with `fstat` size rechecks and symlink
  rejection. No secret is read, written, generated, or configured.
- Focused evidence at the source SHA: **10 files / 120 tests** pass, including
  the positive assembly control that signs the real envelopes through
  the protected entrypoint and requires the protected resolver to return
  byte-identical receipt and evidence bytes, plus negative controls for
  bare-subject receipt, foreign run ID, mutated identity, declared-subject
  contradiction, kind/reference swap, duplicate reference, unbounded source set,
  unsafe member name, symlinked request, symlinked artifact, foreign signing
  key, out-of-window attestation, pre-existing output directory, and malformed
  request document. Evidence-payload kind is pinned to its descriptor kind
  (`role` → `role_assertion`, `scenario` → `scenario_observation`,
  `session_teardown` → `session_teardown`), so a self-consistent payload
  whose kind contradicts its descriptor fails closed instead of being signed
  into evidence the CP-04c verifier must reject. The focused 10 files / 120 tests above were measured on this
  final source tree; only the record's full-repository test totals, its other
  full-repository gates, and the browser gate were measured on the source branch
  and are not re-run for this static-only integration.
- Recorded boundaries, not acceptance: the request `runId` and the source
  `issuedAt`/`expiresAt` window are caller-asserted here and must be derived
  from authenticated runner context by a future protected harness; the
  reference-to-content digest binding belongs to the CP-04d source manifest and
  is not duplicated; a mid-loop failure can leave partial signed attestations in
  the fresh owner-only directory with no index, which fails closed on read; the
  execution-evidence `artifactSha256` references UI evidence this producer
  never sees and needs a future independently authenticated evidence service;
  and `createAc265HostedArtifactAttestation` remains byte-opaque, with the
  protected wrapper as the only production entrypoint. None of these is an
  owner decision or a hosted-acceptance claim.
- This is local/private construction only. No hosted acceptance, session
  broker, receipt issuer, artifact store, evidence service, seeded identity,
  credential, resource, grant, or registry row is added or implied; the distinct
  artifact-attestation issuer key and its `artifactTrustedKeys` pinning remain
  owner decisions. Totals remain 279/282 active (283 authored IDs), Phase 2
  8/17, and 1,999/2,000 active criteria; AC209, AC211, and AC265 remain open,
  Slice 10 remains locked, and AC266 remains owner-deferred.

## 2026-09-24 AC211 queue analytics row-shape diagnostic (local only, unmerged)

- Diagnosis basis: collection run `35846440023` (UTC day 2026-09-22) passed
  preflight and then failed inside
  `infra/workflows/content-schema-registry-slo-provider-queue.ts` with
  `malformed_queue_analytics_row`, before any sample counts were computed. Runs
  `35560241699` and `35673313035` never reached that parser path — they failed
  later at the sample-sufficiency gate — so the queue date gate was untested in
  those windows and the actual provider date shape remains **unverified**. No
  date-format relaxation, no widened action/outcome vocabulary, and no
  fabricated production sample was introduced.
- The collector rejection is now self-diagnosing. A shared module
  `infra/workflows/content-schema-registry-slo-queue-shape.ts` owns the row gate
  order (`row_not_object`, `dimensions_shape`, `date_missing`,
  `date_not_string`, `date_format`, `count_shape`, `action_type_missing`,
  `action_type_not_string`, `action_type_unknown`, `outcome_shape`,
  `count_sum_overflow`) and the response-envelope classification. The collector
  now throws `malformed queue analytics row (<gate>)` and imports that module, so
  collector and diagnostic verdicts cannot drift apart. Detail codes are closed
  and value-free: no provider value, timestamp, identifier, or secret is added
  to any log.
- A new read-only shape diagnostic
  (`infra/workflows/content-schema-registry-slo-queue-shape-diagnostic.ts` plus
  entrypoint `diagnose-content-schema-registry-queue-shape.mjs`) reuses the
  collector exact query string and classifiers and emits only closed value
  classes (row type, dimension presence and key count, date/count/action/outcome
  classes), bounded row counts, and the exact rejected gate, capped at 12 emitted
  rows. It is wired into the existing protected workflow
  `collect-production-ac211.yml` as a warning-only step before collection; it
  writes no evidence, closes no criterion, and cannot bypass the collection gate.
- RED/GREEN: the two new collector tests first failed at the pinned base commit
  with the bare message against expected `(row_not_object)` and
  `(count_sum_overflow)`. GREEN: 19/19 across the three directly touched suites,
  72/72 across the eight-file AC211 surface, and a full local `pnpm test` of
  589 files / 4,835 passed plus one intentional skip.
- Independent review found a verdict-parity defect, now fixed: the aggregate
  `count_sum_overflow` check lived only in the collector's own loop, so the
  diagnostic reported `accepted` for a payload the collector rejects (two
  ReadMessage rows of 64,000 each). Reproduced against the pre-fix source as
  `expected 'accepted' to be 'rejected'`. `classifyQueueAnalyticsRows` in
  `content-schema-registry-slo-queue-shape.ts` now owns the whole-row walk in the
  collector's precedence — each row's shape gate first, then the running
  `queueAttempts`/`dlqMessages` overflow check — and both the collector and the
  diagnostic call it, so one verdict governs both. The diagnostic additionally
  reports `summaryGate` and closed `queueAttemptsClass`/`dlqMessagesClass`
  labels instead of raw sums. Eight parity cases compare the collector and
  diagnostic verdicts directly, including Read and Delete overflow; the
  warning-only workflow test now asserts the guard body executes no `exit`,
  closes before the collector, chains no `&&`/`||`, and leaves the collector
  unconditional (verified by temporarily sabotaging the guard and confirming the
  test fails). Full local `pnpm test` after the fix: 589 files / 4,845 passed
  plus one intentional skip.
- Local validation under pinned Node `22.23.1` / pnpm `11.24.0`:
  `format:check`, `lint`, `type-check`, `contracts:check`, `progress:check`,
  `db:types:check`, `test:evidence:s09`, `build`, `bundle:check`, and
  `performance:smoke` all exited 0 (local API p95 18.79 ms against the 500 ms
  threshold, zero errors). E2E ran Chrome-only against system Google Chrome
  `154.0.8037.57` via a temporary `channel: 'chrome'` override: 101/101
  functional and 5/5 real-route passed. The override was reverted and
  `playwright.config.ts` is byte-identical to HEAD
  (`62f50862821d8e14963e0bfd2e16119e`); the committed change carries no
  Playwright configuration diff.
- This closes no criterion and moves no contributor count. Totals remain
  279/282 active (283 authored IDs), Phase 2 8/17, and 1,999/2,000 active
  criteria; AC209, AC211, and AC265 remain open, Slice 10 remains locked, and
  AC266 remains owner-deferred as the mandatory post-Phase 2
  production-readiness/release gate.
- Next evidence: the diagnostic must be merged to `main` and the protected
  workflow dispatched again for a complete UTC day. That run is the first one
  that can reveal the real provider row shape; until it lands, the date shape
  stays unverified and the diagnostic is only a hint, never acceptance.

## 2026-09-25 AC265 identity source and single read-grant exception (decision recorded)

- The owner decided on 2026-09-25 to source the dedicated AC265 staging test
  identities from **Cloud Identity Free** on `wejamm.in` with **no paid Google
  Workspace**, and to approve **exactly one** narrowly scoped, expiring
  `cms.schema_registry.read` staging test-account grant as an explicit exception
  to the earlier sole-admin / no-other-CMS-authority rule, keeping the existing
  owner account as the **sole admin** with no `cms.schema_designer` and no
  admin/design permission. Both are recorded in the
  [AC265 Cloud Identity Free and read-grant decision record](../verification/2026-09-25-ac265-free-identity-and-read-grant-decision.md),
  which resolves gates 1-2 of the
  [2026-09-23 dedicated-accounts record](../verification/2026-09-23-ac265-dedicated-staging-test-accounts-decision.md).
  That record's privileged-admin-question gate stays unanswered, and no second
  privileged identity is authorized.
- Nothing was provisioned and no criterion moved. Outstanding: Google-side Cloud
  Identity account/administrator creation, `wejamm.in` domain verification and
  terms acceptance; TOTP enrollment is unconfirmed (the App Authenticator feature
  is enabled on the project, not the administrator's factor); the step-up surface
  decision is still open; `staff_case_scoped` remains a scope blocker.
