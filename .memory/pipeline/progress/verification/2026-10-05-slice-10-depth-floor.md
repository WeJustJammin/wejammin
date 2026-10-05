# Slice 10 DEC-133 depth-floor cascade (2026-10-05)

## Result

- Prior Slice 10 floor: 75.
- Additive floor: 30 independently testable obligations.
- New Slice 10 floor: 105 authored/active, 0 checked.
- Phase 2: 3008 authored / 3004 active, 2448 active-checked.
- AC209, AC211, AC265, and AC266 remain authored, unchecked external gates outside the active denominator.

## Formula

Existing AC005/016/020/022/024/025/027/030/031/037/038-048/053/054/056/067/073-075 are reworded because they already own D2/D3/D5/D6/A2 and the affected validation rows. Additive rows exist only for five newly independent test surfaces: DEC-133 object structure, DEC-112 rich-text grammar, CMS-03B-12 conflict detail, CMS-03B-13 assigned-entry list, and CMS-03B-14 authoring context. Each contributes six non-overlapping obligations: contract/shape, validation, authority/privacy, runtime bounds, safe failure, and consumer/verification behavior. 5 × 6 = 30.

## Additive ledger

| Criterion | Class | Owner | Exact obligation | Source |
|---|---|---|---|---|
| AC076 | additive | BE03a | DEC-133 object structure accepts exactly one typed depth-1 `properties[]` declaration with 0–32 properties and rejects nested object/list property kinds. | BE03a §§Request/Response Contracts, Validation and Error Matrix, Compilation Pipeline |
| AC077 | additive | BE03a | DEC-133 object properties use unique stable keys and only `scalar`, `enum`, or `rich_text` child kinds, each with an explicit required flag. | BE03a §§Request/Response Contracts, Validation and Error Matrix, Compilation Pipeline |
| AC078 | additive | BE03b | DEC-133 object property constraints are strict and kind-specific; unknown keys, missing required keys, incompatible constraints, and mismatched values return typed 422 errors without mutation. | BE03b §§Request/Response Contracts, Validation, Error Handling |
| AC079 | additive | BE03a | DEC-133 object structure is normalized into the immutable SchemaArtifact and definition hash so review, activation, write, restore, preview, and publication bind the same bytes. | BE03a §§Compilation Pipeline, Hashing, Invariants |
| AC080 | additive | BE03b | TypeScript and PostgreSQL validators enforce the same DEC-133 object structure and value semantics across create, append, conflict resolution, restore, draft read, preview, and publication. | BE03b §§Request/Response Contracts, Database Schema, Verification and Test Strategy |
| AC081 | additive | FE03 | The native object editor renders property controls from the preparation projection, preserves values and focus across typed failures/conflicts, exposes labels and descriptions, and never asks the user to edit JSON. | FE03 §§Component Contracts, Accessibility, Error and Recovery, Testing Obligations |
| AC082 | additive | BE03b | `rich_text.v1` admits only paragraph, heading levels 2–4, bulleted/numbered list with list items, and quote blocks with the locked recursive bounds. | BE03b §§Rich text value grammar, Validation, Verification and Test Strategy |
| AC083 | additive | BE03b | `rich_text.v1` admits only bold/italic/code marks and https/mailto/safe internal-route links, rejects inline embeds and unsafe schemes, and never accepts raw HTML. | BE03b §§Rich text value grammar, Validation, Security |
| AC084 | additive | BE03a | `rich_text.v1` normalizes to RFC 8785/JCS bytes and the TypeScript and PostgreSQL validators produce parity for canonical hashes, bounds, and typed errors. | BE03a §§Protected Validator Registry, Compilation Pipeline, Verification |
| AC085 | additive | BE03a | `rich_text.v1` is a protected immutable validator key/version whose artifact reference and hash are frozen into the schema artifact and revalidated before every editorial transition. | BE03a §§Protected Validator Registry, Activation, Compilation Pipeline |
| AC086 | additive | FE03 | The constrained native rich-text editor exposes semantic block, list, mark, and link controls with keyboard/focus/error behavior and never exposes a raw JSON or HTML editor. | FE03 §§Component Contracts, Accessibility, Responsive, Testing Obligations |
| AC087 | additive | FE03 | The typed rich-text renderer maps only validated AST nodes to native elements without `dangerouslySetInnerHTML`, and fails closed with a safe recoverable state for unknown or invalid nodes. | FE03 §§Component Contracts, Security, Error and Recovery, Testing Obligations |
| AC088 | additive | BE03b | CMS-03B-12 registers a strict protected GET conflict-detail contract and returns one readable open conflict with bounded base/theirs/yours typed preimages, provenance, and a strong ETag. | BE03b §§Route Registry, Request/Response Contracts |
| AC089 | additive | BE03b | CMS-03B-12 rejects malformed entry/conflict UUIDs, undeclared queries or bodies, and out-of-bound preimages before any existence or dependency work. | BE03b §§Validation, Error Handling |
| AC090 | additive | BE03b | CMS-03B-12 derives session and acting context, requires current editorial read authority, and makes hidden, wrong-scope, closed, or absent conflicts indistinguishable 404 responses. | BE03b §§Middleware & Policies, Authorization Matrix |
| AC091 | additive | BE03b | CMS-03B-12 is no-store, uses the conflict ETag, and enforces the declared read rate, deadline, cancellation, and bounded response limits. | BE03b §§Route Registry, Performance, Reliability |
| AC092 | additive | BE03b | CMS-03B-12 maps only its declared safe typed errors, omits unreadable values and all owner/resolver/authority identifiers, and never relays upstream text. | BE03b §§Error Handling, Security, Privacy |
| AC093 | additive | BE03b | CMS-03B-12 is read-only with no audit/outbox mutation; telemetry is redacted to operation, outcome, latency, safe counts, and request ID. | BE03b §§Observability, Verification and Test Strategy |
| AC094 | additive | BE03b | CMS-03B-13 registers a strict protected assigned-entry list GET and returns a bounded keyset page of RevisionSummary rows plus an optional signed next cursor. | BE03b §§Route Registry, Request/Response Contracts |
| AC095 | additive | BE03b | CMS-03B-13 validates the closed filter/sort/cursor grammar and page bounds and rejects bodies, mutation headers, and undeclared query keys before reads. | BE03b §§Validation, Error Handling |
| AC096 | additive | BE03b | CMS-03B-13 derives session/acting context, returns only currently readable assigned entries, and reveals no hidden owner, assignment, capability, or authority identifier. | BE03b §§Middleware & Policies, Authorization Matrix, Privacy |
| AC097 | additive | BE03b | CMS-03B-13 signs and binds cursors to actor/context/filter/sort, is no-store, and enforces declared read rate, deadline, cancellation, and page limits. | BE03b §§Route Registry, Performance, Reliability |
| AC098 | additive | BE03b | CMS-03B-13 maps malformed/expired cursor, auth, rate, dependency, and internal failures to declared safe errors with truthful retry/degraded behavior and no upstream-text relay. | BE03b §§Error Handling, Failure Recovery |
| AC099 | additive | FE03 | CMS-03B-13 is read-only and is consumed by an accessible server-first entry list with native links, announced result/empty/filter states, keyboard order, and no optimistic rows. | FE03 §§Page Route Contracts, Component Contracts, Accessibility, Testing Obligations |
| AC100 | additive | BE03b | CMS-03B-14 registers the literal authoring-context GET and returns a strict server-derived preparation projection for visible active types, schema artifacts, validator references, workflow policy, and activation evidence. | BE03b §§Route Registry, Request/Response Contracts |
| AC101 | additive | BE03b | CMS-03B-14 accepts only its closed bounded query grammar, never accepts caller-supplied schema/artifact/policy/approval authority, and rejects body or mutation headers. | BE03b §§Validation, Error Handling |
| AC102 | additive | BE03b | CMS-03B-14 derives session and acting context, requires author/editor scope, conceals inaccessible types, and never grants or implies `cms.schema_registry.read`. | BE03b §§Middleware & Policies, Authorization Matrix, Privacy |
| AC103 | additive | BE03b | CMS-03B-14 is matched before the entry UUID route, returns an ETag-bound no-store projection, and enforces declared read rate, deadline, cancellation, and response bounds. | BE03b §§Route Registry, Performance, Reliability |
| AC104 | additive | BE03b | CMS-03B-14 maps validation, auth, rate, dependency, and internal failures to declared safe typed errors and preserves the user form without fabricating preparation evidence. | BE03b §§Error Handling, Failure Recovery |
| AC105 | additive | FE03 | CMS-03B-14 is read-only and the create/editor surfaces consume its projection to render accessible native controls, revalidate on submit, and preserve server authority. | FE03 §§Page Route Contracts, Component Contracts, State Management, Testing Obligations |

## Reword-only map

- AC005: For `rich_text`, the request must satisfy the canonical `rich_text.v1` AST and protected validator binding; an invalid or noncanonical AST is a typed 422 with no mutation.
- AC016: Comparison output covers field, block, and relation domains using privacy-safe stable identities.
- AC020: More than 512 authorized changes is refused with the typed comparison-unavailable response and never partially returned.
- AC022: Restore preparation binds an immutable migration-chain manifest derived from at most 64 completed 03a plan edges.
- AC024: Authorization also covers every chain edge and conceals an unreadable source or chain.
- AC025: The idempotency business hash and CAS bind the selected migration-chain identity.
- AC027: Audit/outbox evidence records only chain identity/hash and safe counts, never migrated values.
- AC030: Relation changes are keyed by stable field ID rather than version-specific relation-definition ID.
- AC031: The `object` kind is valid only with the DEC-133 typed depth-1 `properties[]` structure; `rich_text` is valid only as canonical `rich_text.v1`.
- AC037: Restore sets `parentRevisionIds = [currentDraftRevisionId, sourceRevisionId]` and preserves the verified migration-chain identity.
- AC038: This is a contract-only dependency-manifest rule; runtime completion requires the served preparation and write path.
- AC039: This is a contract-only bounded dependency-manifest rule; runtime completion requires authoritative server derivation.
- AC040: `riskClass` is server-derived from frozen policy and dependencies; any caller-supplied `riskClass` is an unknown key.
- AC041: This is a contract-only review-decision rule until the protected decision operation is implemented.
- AC042: The caller supplies neither `stepUpAt` nor `capability`; every CMS-03B-06 decision requires server-verified recent binding-bound MFA and eligible assigned-reviewer capability.
- AC043: This is a contract-only schedule rule until authoritative timezone and persistence paths are implemented.
- AC044: This is a contract-only publication-action rule until the protected operation exists.
- AC045: This is a contract-only preview-token rule until mint/open/revocation paths exist.
- AC046: This is a contract-only bounded version-set rule until server derivation and revalidation exist.
- AC047: This is a contract-only preview-binding rule until the protected preview path exists.
- AC048: This is a contract-only unpublish/expire/archive rule until the protected operation exists.
- AC053: The editor obtains bounded authorized base/theirs/yours preimages only through CMS-03B-12 before submitting a resolution.
- AC054: Conflict-detail and resolution both conceal hidden records, never expose resolver/authority identities, and preserve typed values.
- AC056: Comparison spans field, block, and relation domains; restore requires an exact immutable migration-chain manifest and refuses more than 512 changes.
- AC067: The canonical draft resource includes server-derived `revisionNumber`, `schemaVersionId`, and bounded `openConflict` identity.
- AC073: Object values satisfy the frozen typed depth-1 property structure and rich-text values satisfy `rich_text.v1`; unknown/mismatched content is refused.
- AC074: Returned object and rich-text values are validated against the same compiled artifact and protected validator versions used at write time.
- AC075: The response includes server-derived `revisionNumber`, `schemaVersionId`, and bounded `openConflict`; it never fabricates a draft or authority metadata.

## Synchronization

The phase plan and slice tracker retain AC001-075, append contiguous AC076-105, use identical criterion descriptions after link normalization, and keep every Slice 10 row unchecked until implementation evidence exists.
