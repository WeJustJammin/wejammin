# Profile ownership components

## Contents

Authenticated route shell, bounded shadow-party and claim workbench, semantic
list/detail views, strict command forms, account-free remedy form, shared
actions, transport helpers, and Slice 05 tests.

`use-profile-ownership-step-up-draft.ts` keeps the tab-scoped FE00 step-up draft
(DEC-111) for the claim conversion form: only the allowlisted `reasonCode`
field and the interrupted `Idempotency-Key` are stored, restored once on return,
and never replayed without explicit re-confirmation.

## Ownership

This directory owns the bounded Phase 2 Slice 05 browser surface for shadow
parties, invitations, remedies, claim challenges, and proof submission.
`ProfilesVerificationRoute` selects the server-approved shell;
`ShadowClaimOwnershipWorkbench` composes canonical projections and typed
commands without becoming an authorization boundary.

## Extension rules

Keep identity, acting context, CSRF, and canonical claim state server-derived.
Add operations through shared Zod request/resource contracts and the
same-origin Astro facade. Deferred PRF-API-09–16 and cross-shard portfolio or
credential controls stay unmounted until their owning slice is implemented.

## Conventions

Use native controls and named regions, preserve valid drafts on typed failure,
keep opaque proof material out of URLs and logs, and refetch authoritative data
after successful commands or invalidation.

## Related links

- `docs/ARCHITECTURE.md`
- `.memory/wiki/specs/fe/02-profiles-verification.md`
- `.memory/wiki/specs/be/02a-shadow-claim-ownership.md`
