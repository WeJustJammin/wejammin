# Propagation scan — complete CMS-07 revision comparison

**Status:** cross-layer spec-gap scan only; owner contract choice pending. This
scan does not approve a new diff shape, widen read authority, or count CMS-07
as accepted.
**Origin:** IA03 AC-CMS-07 and CMS-07 interaction; BE03b CMS-03B-03 endpoint
and `RevisionHistoryPage`; FE03 CMS-07 history row; Phase 2 Slice 10
P2-S10-AC-002, P2-S10-AC-018–021, and P2-S10-AC-056–058.

## Locked boundary and current implementation

IA03 requires a schema-aware comparison of **field, block, and relation**
changes between two readable revisions with their recorded schema, template,
and taxonomy versions. BE03b returns up to 512 safe `RevisionHistoryChange`
items with a JSON Pointer, kind, and nullable left/right hashes; FE03 permits
only safe summaries and diff hashes. Neither locked document defines how a
block or relation maps to one stable pointer, how its canonical snapshot is
hashed across versions, or how a missing or hidden target is represented.

The private `cms_list_revisions` implementation currently hashes stable
field-ID payloads only. Its own comment explicitly excludes relation-level
diffs for lack of a locked pointer convention; it also does not read the
revision-bound composition instances. `RevisionHistoryCompareSchema` calls
the result “safe field diffs.” Thus a successful 200 can appear to be a
complete comparison while omitting block and relation changes. The protected
SSR page now renders the returned hashes, but cannot fill in missing domains.

## Adversarial paths and spec gaps

| Path        | Defined behavior                                                                                                        | Missing decision and risk                                                                                                                                                                                                                         |
| ----------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Happy       | Compare requested readable revision with newest readable revision at the requested locale; field hashes use stable IDs. | Define stable block and relation pointer identities, canonical hash input, ordering, and version-aware normalization so a changed block/relation is not silently absent.                                                                          |
| Malicious   | Both revisions must remain readable; response contains hashes, not raw values.                                          | Decide whether a hidden/deleted relation target is represented by an opaque hash, omitted with a typed unavailable result, or blocks comparison. Never return a target ID or private props through a path or error.                               |
| Incompetent | Changes are bounded to 512; kinds are added/removed/changed/unchanged.                                                  | Specify behavior when combined field, block, and relation changes exceed 512, or when an immutable schema/template/taxonomy version or block registry digest cannot be resolved. A truncated or field-only 200 would falsely assert completeness. |
| Concurrent  | Source revisions are immutable; history uses an entry page-version and signed cursor.                                   | Define the snapshot boundary for a comparison when the latest revision moves during a read, and whether a follow-up request must use the returned right revision as a fixed precondition.                                                         |

SPEC GAP: IA/BE comparison coverage — IA03's field/block/relation guarantee is
not realized by the current BE03b `RevisionHistoryPage` semantics or private
RPC — a field-only 200 can hide meaningful changes — amend the locked BE/FE
contracts to require all three domains or explicitly narrow IA03 by owner
decision. Do not count existing field-only proof as full CMS-07 acceptance.

SPEC GAP: BE pointer and hash identity — JSON Pointer syntax alone does not
define whether a relation path is keyed by stable field, ordered position,
target, or aggregate; composition has revision-bound paths, block versions,
props, bindings, and pattern links — a guessed key could disclose target IDs
or misidentify changes — approve canonical, privacy-safe per-domain identities
and hashes before adding a producer.

SPEC GAP: BE failure/size policy — the combined change cap is 512, but no
complete-result refusal, pagination, or explicit truncation contract exists
when the cap is exceeded or a recorded version cannot be interpreted — return
a typed, non-disclosing refusal rather than a partial success after the
contract is defined.

## Cascade after owner decision

Amend IA03, BE03b, and FE03 under the progressive decision lock; then update
the shared Zod contract, private comparison RPC through a forward-only
migration, Worker and first-party browser rendering, OpenAPI if the response
shape changes, and Slice 10 traceability. Test every field/block/relation kind,
version drift, deletion and hidden-target handling, 512-item overflow,
cross-owner concealment, and a production-built Chrome comparison. A local
green test is not hosted acceptance.


<!-- spec-graph: auto-generated -->
## Related Specs

### Phases into
- [[specs/phases/phase-2|Phase 2 — Identity, admin, CMS/settings]]

### References
- [[specs/phases/phase-2|Phase 2 — Identity, admin, CMS/settings]]
