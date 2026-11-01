# Investigation brief — block compatibility for templates and patterns (read-only, reviewer tier)

Question for root: how do the specs define a block's "compatibility" for a template slot and for a
pattern (BE03c :1361 "rejects a missing, withdrawn or incompatible block"), and must the CMS-03A type
compiler write a `blocks` member into the compiled renderer manifest?

Evidence that prompted it (`docs/handoffs/2026-10-14-claude-s12/lane-pattern-def-report.md`, `## Fix pass`,
Requests to root 3): the new pattern check `cms_pattern_blocks_compatible` mirrors the template rule, but
the type compiler never writes `blocks` into a renderer manifest, so under real type chains every
block-bearing template or pattern is refused as incompatible.

Do:
1. Read the template compatibility implementation (`supabase/migrations/20260927200000_cms_template_authority.sql`,
   `2026092723*`, `2026092724*`, `20261002210000_*`, the named template compatibility resolver DEC-108 in
   BE03c ~223–300), the block registry record and digest invariants (BE03c ~301–330), the pattern check
   (`supabase/migrations-wip/pattern-def/20261014020300_*`/`020400_*`), and the type compiler / renderer
   manifest (BE03a `.memory/wiki/specs/be/03a-*.md`, IA03, FE03, `.memory/wiki/decisions.md`, and the compiler
   SQL/TS — find with `grep -rn "renderer_manifest\|rendererManifest" supabase/migrations packages apps | head`).
2. Establish exactly which artifact the spec says declares which blocks a content type's renderer
   supports, who writes it, and whether existing producers write it. Cite file:line for every claim.
3. Determine whether real (non-fixture) template creation with a block slot can succeed today; check the
   existing template suites' fixtures (do they hand-insert manifests with `blocks`?).
4. Conclude one of: (A) spec defines it and a producer is incomplete — name the producer, the spec lines,
   and the minimal forward fix and its slice owner; (B) spec defines it and the check is wrong — name the
   correct check; (C) spec is silent/contradictory — state the precise owner question with 2–3 options.
Read-only; report `docs/handoffs/2026-10-14-claude-s12/review-blockcompat.md`; end with
`VERDICT: A|B|C` and a ≤15-line summary in your final message.
