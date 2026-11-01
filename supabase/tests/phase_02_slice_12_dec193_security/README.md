# DEC-193 effective-content security — test-only RED

Author execution: **UNRUN**. Root owns source review, staging and actual RED.
No production migration/function, existing test/fixture, contract, grant, guard or
shared tracker was changed. Both new SQL files are below 400 lines.

Driver: `../phase_02_slice_12_dec193_security.sql`. It reuses the existing signed
block registration, governed pattern activation, real old-pin placement and
complete persistent-store snapshots from the resolution fixture. It includes
that fixture only, not the resolution suite's subsequent assertions/mutations.
Stage the pattern-updates and DEC-193 storage/resolution/writer dependencies in
their existing order first. All writes are inside the driver's final ROLLBACK.

## Existing policy, not a new sanitizer

BE03b:1807 requires `preflight.security` to re-run executable-content/unsafe-link
rules over effective values and block props. BE03b:2056 supplies write-time safety.
The actual existing `20261005017570_cms_preflight_evaluation.sql:133–187`
`cms_text_is_executable`/`cms_json_executable_leaves` implementation is the only
policy used here. It recursively inspects string leaves in arbitrary JSON.
No reserved JSON-key policy, object coercion or new SQL lexical detector is
invented. Safe arrays deliberately contain keys named `script`, `style` and
`onload` whose values are harmless; exact values must survive.

Current `20261016040800_cms_detached_tree_registry.sql:96–104` checks selected
effective JSON bounds but omits that existing executable-leaf detector. The
current private preflight security branch scans ordinary props/bindings but not
the effective `detached_tree` content. These tests target those real seams, not
new helper names or a fabricated provider response.

## Discriminating cases

- Four detector-premised unsafe alternatives: whitespace-obfuscated executable
  URL in a nested object/array; scalar template expression; iframe in an array;
  HTML event attribute. Real public accept `yours` and detach must return the
  existing exact VALIDATION_FAILED pointer and preserve every captured full row.
- Two-root detach orders a safe first root before an unsafe second root. The
  failed whole RPC must roll back any first append, idempotency reservation,
  audit/outbox effect or review invalidation, not merely reject an isolated row.
- The same unsafe local root alternative is discarded by the complete safe
  `theirs` choice. That real public command must succeed; validating all B/L/T
  alternatives instead of selected effective content is not acceptable.
- JSON null, number, boolean, string and array succeed through real public
  accept and detach. Linked overrides and detached root props are checked for
  exact JSON equality, including present null. Successful operations preserve
  old full composition/revision images, append one version, advance entry CAS,
  publish the strong ETag and expose only the existing public items envelope.
- Missing author assignment and concealed cross-owner access keep their existing
  refusal/no-effect behavior. Actual calls use service_role and restore role;
  public service-only and private detector/registry/preflight ACLs are checked.
- Separate unsafe/safe legacy tree-only fixtures have empty ordinary props and
  bindings, no unsafe stored field values and no unsafe superseded tree. The
  actual private preflight must report exact security provider/version, outcome,
  reason and blocking count: unsafe_content/1 versus passed/null/0. Other category
  outcomes are not claimed. Shared captured CMS mutation-store and full field-value
  images remain unchanged. E7 preflight only looks up an existing exact settings
  snapshot; the approved lookup fixture below precedes these before-images.

## Honest fixture and failure boundaries

Unsafe local O and the two tree-only inputs are explicitly labelled legacy
append fixtures copied from real placed rows under the normal `app.cms_rpc`
write guard, retaining actual positive pattern provenance. They are not unsafe
producer acceptance proof. No trigger/RLS/guard is disabled and no private
execution grant is added. Seeded props/tree equality and enabled guard are
explicit premises.

Preflight resolves/checks its exact existing scalar jsonb signature, then invokes
the real function dynamically with a valid request. Missing/wrong signature is
an explicit TAP failure, not a skip or setup-time future-helper abort. SQL errors
are recorded separately from its actual nullable answer; there is no fake result.
Its diagnostic CMS context is saved/restored, including after a raised call.

The direct legacy fixture does not execute an ordinary settings write tail.
E7's current `cms_settings_snapshot` is lookup-only, so a missing prerequisite
raises `DEPENDENCY_UNAVAILABLE` before any provider result. Before the preflight
before-images, count-only premises require the exact ownerOrg active/version 1,
ordinal 1/registry 1 empty `[]` snapshot to be missing, then present. The seed uses
the existing guarded S11 E7 test pattern and literal empty-array JCS hash
`4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945`, saving/restoring
`app.cms_rpc` on success or exception. This is lookup-fixture-only evidence, not
writer/materializer or provider proof; no guard, settings value or provider is
replaced. Both real preflight calls and their exact provider assertions remain.

No parser, formatter, import, test, DB, Docker, network or Git execution by the
author. No runtime count, GREEN, production transaction, actual HTTP, hosted gate
or slice-completion claim follows from these UNRUN sources.
