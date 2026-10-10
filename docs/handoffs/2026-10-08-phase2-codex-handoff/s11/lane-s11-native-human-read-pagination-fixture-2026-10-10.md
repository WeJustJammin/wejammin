# Slice 11 human-read pagination fixture correction

Status: selected test-only correction after actual full API gate RED. Native
claims UNRUN until root clean pushed exact-origin checkpoint. Native gpt-6-astra/
high; root gpt-6.1-sol/ultra owns all commands and verification.

## Disjoint two-path scope

Only tests/postgrest/worker-round-trip.apispec.ts and new private test support
module tests/postgrest/support/worker-round-trip-pagination.ts. Read complete
original file, registry request/page contracts and real public create/list adapters.
No production/SQL/schema/grant/package/lock/settings or other fixture mutation.
QA files hard400/target350. Existing spec319; use private helper for added witnesses,
never extract unrelated tests or add unauthorized file.

Actual parent-s11-origin24-queued7-db-verify-validate-20261010.log5333–5390 proves
both unfiltered owner reads succeed but return a legitimate nonnull nextCursor.
Default25 shared committed resources make the two null expectations stale. Locked
BE03a1938–1941 allows bounded nonempty cursor OR null; SQL registry reader327–350
emits real continuation when more rows exist. Never force reader to omit cursor.

Preserve leaf titles exactly:

1. human CMS read: the owner lists content types through the production adapter
2. human CMS read: the same read as the owner directly (authenticated JWT) succeeds, and a stranger forging the owner does not

Preserve their original unfiltered read requests and actual success/status oracles.
Replace only impossible global nextCursor:null checks with full
ContentSchemaRegistryListPageSchema validation (safeParse success or equivalent
strict parse with assertion), preserving items array and full page semantics.
Retain both existing forged-user UNAUTHENTICATED and forged-party FORBIDDEN checks
unchanged. All other six leaf test bodies/title tokens remain exact.

## Required deterministic continuation witness in each selected leaf

Using existing normal authorized CMS03A01 public creation (no synthetic CMS rows,
SQL inserts, settings mutation, new real accounts or grant bypass), create two
public draft content types under a unique valid alphanumeric keyPrefix, with
first key < second key (for example prefix_a then prefix_b). Use owner identity and
existing trusted request/context seams, then list resourceKind content_type,
limit1, key/asc under that exact prefix. First page must contain exactly first
created contentTypeId and bounded nonempty cursor. A draft response id is the
version ID, not the content type ID: parse ContentTypeVersionResourceSchema and
compare each list record id to its creation result.contentTypeId. Parse query
through ContentSchemaRegistryListQuerySchema to supply required typed defaults,
not casts. Second request keeps query/context equal
plus that actual cursor, must contain exactly second created contentTypeId, disjoint rows,
terminal nextCursor null. Validate both full page contracts. Run witness through
the production adapter in leaf1 and direct authenticated protected RPC in leaf2,
not a fake reader. Stable ownership/context, no credentials logged.

Prefer one shared bounded helper for creation/query/witness. Preserve request/RPC
exact grammar; no as-any/unvalidated types. Do not merely delete cursor assertions
or check a permissive null-or-string without actual page progression. Return exact
changed leaf identities (unchanged title strings), public commands added and source
claim release. If existing public creation cannot satisfy prefix or exact query
contract, stop before broadening scope and report primary evidence.

Authors filesystem reads/apply_patch only; no commands/scripts/tests/format/Git/
DB/runtime/network/docs/memory/settings. Root freezes/formats/refutes, verifies
six other case bodies exact, runs real focused API then db:verify/validate under
freshCI0/sharedflock, records honest first failure/postreset/canonical handoff.
Settings-read insertion RED remains untouched. No hosted/acceptance claim;0/122.
