# Progress Decisions

Canonical project decisions are compiled at .memory/wiki/decisions.md. This file records implementation-progress-local decisions only.

## 2026-10-02 — Approve the Slice 09 activation producer amendment

- Owner approved private CMS review/decision/assignment ownership, protected
  CMS-03A-09 through CMS-03A-14 producers, approval-only review access, stable
  private binding evidence, real scans/transforms and the minimum source/template
  prerequisites in Slice 09. The owner remains the sole admin.
- Cascade the originating IA/BE/FE contracts, capability/route inventory and
  dependent plans; add open criteria and recompute the depth floor. Approval
  creates no real identities, assignments, grants, deployment or acceptance.
- Retain verified private-binding transport and AC250 regressions. The 17 open
  activation criteria and new criteria need implementation evidence. AC209/AC211
  remain post-deployment/post-launch and AC265/AC266 mandatory pre-release.
- Exact scope and approved source digest:
  [owner approval record](../verification/2026-10-02-slice-09-activation-amendment-approval.md).

## 2026-09-03 — Serialize the shared default Playwright server graph

- The root Playwright configuration uses one worker and disables full
  parallelism. Two workers reproducibly raced Astro/Cloudflare SSR transforms,
  dropping virtual Astro modules or React refresh bindings.
- The production-built S09 route stays excluded from the default suite and is
  owned by `playwright.s09-real.config.ts`, whose dedicated two-server graph
  verifies that route independently.
- Browser tests synchronize interactive islands through their explicit
  hydration readiness contract when an SSR control can move during hydration.

## 2026-09-05 — Use Cloudflare-native queries and email behind a database claim

- Production cron obtains registry telemetry from Workers Logs, production DLQ
  backlog from Cloudflare GraphQL, and current registry state from a
  service-role Supabase snapshot RPC. Provider-specific I/O stays in the Worker;
  thresholds and redaction stay in `@wejammin/observability`.
- A private forced-RLS table plus service-only claim/completion RPCs own
  deduplication and digest-only delivery receipts. Raw claim tokens, provider
  responses, email bodies, and secrets are never persisted.
- The observability token is production-environment-only and limited to Workers
  Observability Write, Account Analytics Read, and zone Analytics Read scoped
  to the Email Service zone. Account Analytics Read covers queue analytics but
  does not grant the zone-level `emailSendingAdaptive` dataset. The deployment
  token keeps its existing separate permissions; no Workers Scripts Edit
  permission is added to the observability token.

## 2026-09-14 — Authenticate the AC265 runner through GitHub OIDC

- The protected AC265 hosted runner uses a fresh GitHub-hosted `ubuntu-24.04`
  VM and exchanges GitHub Actions OIDC directly with a staging-only route on
  the existing Hono Worker. No new identity, hosting, or secret-store provider
  is introduced.
- The verifier accepts RS256 tokens only from GitHub's fixed issuer and JWKS,
  with audience `urn:wejammin:ac265:staging-runner:v1`. It binds immutable
  repository and owner IDs, the protected `main` ref, staging environment,
  exact workflow ref and SHA, workflow run and attempt, and the candidate
  source revision. A name-based subject is never sufficient by itself.
- Only a SHA-256 of the OIDC `jti` may cross into private forced-RLS
  authorization state. Raw runner credentials, JWTs, sessions, and provider
  responses are neither logged nor persisted. This handshake is an enabling
  control-plane boundary, not AC265 hosted acceptance evidence.

## 2026-09-14 — Bound GitHub Actions run timestamp skew

- GitHub Actions run `34818589300` returned `created_at` one second after
  `run_started_at`. The AC265 provenance verifier treats those provider fields
  as independent timestamp sources and accepts at most five seconds of positive
  created/start skew; exactly five seconds passes and six seconds fails.
- The tolerance does not relax workflow, repository, branch, source SHA, run
  attempt, conclusion, or artifact-origin checks. `run_started_at` must still
  precede completion, and the exact CI run must still complete before the
  staging workflow starts.

## 2026-09-25 — Source AC265 staging identities from Cloud Identity Free with one narrow read grant

- The dedicated AC265 staging test identities come from **Cloud Identity Free**
  on the owner-controlled `wejamm.in` domain, with **no paid Google Workspace**.
  Google-side setup (new Cloud Identity account and administrator, domain
  verification, terms acceptance) remains owner-performed and outstanding; the
  runner may not create identities, grants, or tenants.
- The `entitled_read` role needs `cms.schema_registry.read` **without**
  `cms.schema_designer`, because the server resolver selects `ownerFull` first
  when `cms.schema_designer` is present. The owner approved **exactly one**
  narrowly scoped, expiring `cms.schema_registry.read` staging test-account grant
  as an explicit exception. The existing owner account stays the **sole admin**
  and no test account receives `cms.schema_designer` or admin/design authority.
- Confirmed read-only on the staging dashboard this session: App Authenticator
  (TOTP) is `Enabled` on the Free plan; SMS/phone MFA is disabled and Pro-only.
  Enrolled factors were **not** confirmed, so `admin_step_up` still needs a real
  enrolled factor and a completed current-context step-up. This also retires the
  stale `supabase/config.toml` comment claiming MFA requires the Pro plan.
- Record: [2026-09-25 decision record](../verification/2026-09-25-ac265-free-identity-and-read-grant-decision.md).
