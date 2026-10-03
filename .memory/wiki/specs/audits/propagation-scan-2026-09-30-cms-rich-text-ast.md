# Propagation scan — approved CMS rich-text AST

**Status:** spec-gap scan only; no rich-text format, validator, or renderer is
approved by this record. Slice 10 remains open.
**Origin:** Architecture §Security and content safety; IA03 field kinds;
BE03b CMS-03B-01/10/11 value validation; BE03a protected validator registry;
FE03 editor input; Phase 2 Slice 10 AC-031, AC-050..052, AC-073..075.

## Current locked boundary

The architecture and BE03b require rich text to be an approved structured
AST, never executable HTML. BE03b caps JSON depth, keys, arrays, and bytes but
does not define the AST node/mark/link grammar, version identity, normalization,
or renderer contract. BE03a permits a `rich_text` field kind, yet the private
validator-key registry lists no executable rich-text validator; its key/version
lookup alone cannot prove a value safe. The shared draft-value helper had
accepted arbitrary strings for `rich_text`. Local forward-only migration
`20260927540000_cms_rich_text_admission_gate.sql` now preflights existing
non-null stored values and refuses all non-null rich text until a real
approved validator is present. This fail-closed correction is not rich-text
feature completion and has not been promoted.

## Reference classification

| Source | Classification | Consequence |
| ------ | -------------- | ----------- |
| Architecture approved structured AST and safe renderer | Explicit requirement | Raw HTML, active URLs, scripts, CSS, and expressions cannot enter or render. |
| IA03 `rich_text` field kind | Consistent but incomplete | Kind is named without an accepted value grammar. |
| BE03b values validation and security controls | Implicit assumption | Request bounds and AST requirement lack the node schema and validator identity needed by independent implementations. |
| BE03a validator registry | Explicit implementation gap | Key/version membership has no approved rich-text validator or runtime semantics. |
| FE03 native editor | Downstream dependency | Editor serialization, retained input, and accessible preview cannot be built against an undefined AST. |
| Phase 2 Slice 10 criteria | Downstream dependency | Scalar refusal improves safety but cannot satisfy the complete authoring/read flow. |

## Decisions needed before a full implementation

1. Choose a versioned AST grammar: permitted block and inline nodes, marks,
   link URL schemes, Unicode normalization, maximum children/depth, and whether
   media embeds are excluded or represented by separate governed references.
2. Name the private validator key/version and specify where the executable
   validator and its immutable code digest are registered and approved.
3. Define canonical serialization and hash behavior across API, PostgreSQL,
   browser editor, immutable revision snapshot, and renderer. Existing values,
   if any, need an explicit migration or a release-stopping preflight.
4. Define safe rendering and accessibility output under CSP; no HTML string
   fallback or client-only sanitizer can provide source authority.

## Cascade after an approved choice

Amend the architecture/IA03/BE03a/BE03b/FE03 contracts and Slice 10 test
inventory under the progressive lock. Implement a versioned validator and
renderer, protected registry evidence, strict Zod and PostgreSQL admission,
canonical hash checks, editor serialization, and negative tests for unknown
nodes/marks, active URLs, HTML/script/CSS/template injection, oversize/depth,
schema drift, and unauthorized reads. Replace the temporary non-null refusal
only after RED→GREEN tests prove the approved grammar across all surfaces.


<!-- spec-graph: auto-generated -->
## Related Specs

### Phases into
- [[specs/phases/phase-2|Phase 2 — Identity, admin, CMS/settings]]
