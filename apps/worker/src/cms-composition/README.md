# CMS composition Worker domain

## Contents

`block-registry-digest.ts` recomputes the BE03c canonical block registry
digest from 03a's safe server-resolved registry records. Its adjacent test
covers canonical ordering, reachability, and fail-closed integrity checks.
`template-routes.ts` composes the protected CMS-03C-01 version write and
designer-context read from `template-version-routes.ts` and
`template-context-routes.ts`; `template-shared.ts` and `template-respond.ts`
keep their contracts and safe response handling in focused modules.
`template-detail-routes.ts` serves the designer-scoped current-definition read
used to inspect an existing version after a conflict.
`../cms-composition-production.ts` binds it to the server-only
`platform_api.cms_define_template` RPC and the shared session/rate controls.
`../cms-composition-production-detail.ts` binds the latest read only to the
named private RPC, with response validation before browser projection.
`locale-routes.ts` serves the protected CMS-03C-04 locale-variant authoring
write, with its types, guards, and responses in the matching
`locale-routes-*` modules. `../cms-composition-production-locale.ts` binds it to the named,
server-only locale RPC and the shared session/rate controls.
`pattern-instance-routes.ts` serves the protected CMS-03C-02 insertion
boundary; `pattern-instance-contracts.ts` and
`pattern-instance-responses.ts` contain its port guards and safe envelope.
`../cms-composition-production-pattern.ts` binds only the named private
`cms_insert_pattern_instance` RPC. That RPC is not deployed or implemented:
missing-function errors fail closed as 503, not as a missing composition.
Pattern source creation, activation, selector read, and linked-update authority
still await locked contract decisions; this route alone does not complete CMS-12.
`taxonomy-routes.ts` serves the protected CMS-03C-03 term action; its
`taxonomy-contracts.ts` and `taxonomy-responses.ts` keep port validation and
safe responses separate from route orchestration.
`related-content-routes.ts` serves the protected CMS-03C-05 related-content
rule write, with port types, envelope validation, detail sanitization, and
response handling in the matching `related-content-*` helper modules. Its
contract tests are split by concern:
`related-content-admission.test.ts` (origin/CSRF/header/query gates),
`related-content-errors.test.ts` (port failure status and detail
sanitization), `related-content-envelope.test.ts` (malformed port envelopes
and fail-closed 502 mapping), and `related-content-success.test.ts` (201
success, deadline abort, telemetry resilience). Shared fixtures live in
`related-content-routes.test-support.ts`; add new tests to the file matching
the concern and reuse the helper instead of copying fixtures.

## Ownership

This directory owns server-side composition policy. The digest helper does not
fetch records or grant capabilities: a protected Worker adapter must resolve
records from 03a and supply the content-type compatibility policy before a
template or pattern mutation or publication preflight can use its result.

## Extension

Add further protected composition routes and durable adapters only after their
contract tests are red. Recompute the digest at every BE03c checkpoint; never
persist an unverified caller digest as authoritative evidence.

## Conventions

Keep release credentials and executable payload out of composition. A safe
registry record with unknown or extra fields fails validation. A withdrawn,
missing, duplicate, or incompatible reachable block fails before mutation.

## Related links

See `.memory/wiki/specs/be/03c-composition-taxonomy-localization.md` and
`packages/contracts/src/cms-composition/`.
