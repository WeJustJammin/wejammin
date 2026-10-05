# Slice 09 activation transport and disclosure — local remediation

**Date:** 2026-10-01  
**Status:** scoped local remediation verified; no criterion closed.
Slice 09 remains **261/279 active** and Phase 2 remains **8/17**.

## Scope and authority

The existing private activation transport, BE00 step-up error envelope, and
AC250 confirmation disclosure are being corrected without new public routes
or real grants. The separate [producer contract amendment](2026-10-01-slice-09-activation-contract-amendment-proposal.md)
is owner-pending. It is not implemented or accepted by this checkpoint.
Slices 10–17 remain gated on Slice 09 completion.

## Root verification checkpoints

- Root reproduced a transport regression against the existing global privacy
  assertion: **1 failed / 9 passed**. The only changed RPC context was
  `CMS-03A-04`, which must carry the already validated, server-only binding ID
  to the private activation authority check. The old all-RPC assertion was
  reconciled to that exact exception, retaining all seven non-activation
  ID-free checks, top-level body privacy, public session privacy, and telemetry
  privacy. The focused binding/privacy suites then passed **10/10**.
- The earlier disclosure helpers were orphaned from the production page
  loader. They were returned to RED; a helper-only GREEN result was not
  treated as AC250 acceptance. Production now calls the protected authorized
  acting-context reader, matches the server-derived party, and forwards the
  safe label and private freshness projection into the page and island.
- Root verified the actual Astro detail page spreads that page into
  `ContentSchemaRegistryWorkbenchIsland`. The expanded integration test
  resolves a full `cms.schema_designer` page before rendering the actual
  island/confirmation. Separate denied and degraded responses must not read
  labels or render an activation form. Root reproduced a **1 failed / 4
  passed** snapshot because the render test's fixture clock and component
  clock differed. The deterministic test now aligns `Date.now()` with its
  trusted fixture clock and restores it afterward; production expiry behavior
  was not relaxed.
- Root independently verified the earlier error-mapping and disclosure
  snapshot at **32/32** across five focused suites. A subsequent read-only
  audit found the HTTP detail filter still removed `step_up` recovery fields;
  the exact wire response is now corrected. The fresh DeepSeek wire agent
  reported **5 failed / 2 passed** before the fix, then **7/7** at the actual
  `errorResponse` boundary. Wrong-code, malformed, private, or injected details
  stay filtered; `UNAUTHENTICATED` retains reauthentication disclosure.
- Root's subsequent combined binding, privacy, actual page-to-island, and
  HTTP-wire snapshot passed **22/22** across four files.
- Earlier full `pnpm validate` attempts stopped on formatting in in-flight
  files. After freeze, an attempt reached lint and found two unused test
  destructures; those were removed so the test spreads the actual page exactly
  as Astro does. A fresh complete gate then passed. Earlier attempts are not
  final validation.

## Final local application gate

Fresh pinned Node **22.23.1** / pnpm **11.24.0** `pnpm validate` exited **0**
after code freeze and diagnostic cleanup:

- Contracts, local migrated database types, progress consistency, formatting,
  lint, and type checking passed.
- Vitest: **781 files; 6,745 passed / 1 skipped**. Configured coverage is
  **16,224/16,224 statements, 12,298/12,298 branches, 2,594/2,594 functions,
  and 15,025/15,025 lines**, all 100%.
- Slice 09 evidence-test stage passed, including its declared local-only
  boundary checks; this creates no hosted acceptance evidence.
- Google Chrome: **105 functional** and **12 production-built** checks passed.
  The retained pre-existing Slice 10/12 checks are regression checks of dirty
  code, not authorization to resume those slices or evidence they are accepted.
- Workspace builds and bundle budgets passed.
- Local API smoke: **20 samples, zero errors, p95 1.401267 ms** against the
  **500 ms** local threshold. This is not AC211 production volume or SLO proof.

Root `git diff --check` also passed. No commit, push, PR, or deployment was
performed. Macro contract/implementation/QA tasks stay open for the unapproved
production producers and the 18 reopened acceptance criteria.

## Database RED→GREEN and retained rejection gates

`20261001191923_cms_activate_schema_trusted_binding_context.sql` is applied
to the **local** database. Root compared its function body with the prior
authority migration: after reverting the documented nested allowlist expansion
and ignoring comments/whitespace, the bodies are identical. No new grant is
introduced and the compatibility triggers remain present.

Root replayed the old function inside a rollback-only transaction against the
expanded 13-assertion suite. Exactly one assertion was RED: the valid trusted
envelope returned `STEP_UP_REQUIRED` rather than the expected downstream
`APPROVAL_INVALID`. Rollback restored the migrated function; no migration
history or persisted fixture identity was changed by this reproduction.

The migrated function passed **13/13**. Negative cases include stale,
expired, revoked, wrong-person with the same party, wrong-party, missing,
binding-only, unknown-nested, and unknown-top-level contexts. An absent review
still refuses activation, failed calls leave no partial mutation, and execute
privileges remain service-role-only. Fresh root `pnpm db:test` passed
**90 files / 3,033 assertions**.

One task-created temporary diagnostic test was moved out of the source tree,
not deleted: `/tmp/wejammin-s09-debug-1HHB5T/zz-debug-projection.test.ts`.

## Hosted MFA is distinct from application recovery

[Read-only Google Chrome inspection](2026-10-01-slice-09-staging-mfa-inspection.md)
confirmed TOTP enabled on `wejammin-staging`; SMS is disabled and Pro-only.
Local `supabase/config.toml` defaults are not evidence of hosted settings.
The CMS adapter still has no configured method source and therefore returns
an empty method list rather than inferring methods from caller/RPC details.
This is not proof of enrollment, challenge completion, or real activation.

## Boundaries that remain open

The verified local transport patch preserves actor, capability, owner,
person, party, active/expiry, recent-MFA, review, and exact-evidence gates.
Passing that context gate stops at `APPROVAL_INVALID` when real review
evidence is absent; fixtures do not establish a production review producer.

No deployment, provider configuration write, persistent account, review assignment,
signed evidence, or acceptance artifact was created by this local work.
The 17 activation-chain criteria and AC250 remain unchecked. AC209/AC211
remain post-deployment/post-launch and AC265/AC266 remain pre-release gates.
