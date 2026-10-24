# Lane governed-fix3 - the governed digest recompute enforces block compatibility for patterns

- Date: 2026-10-14
- Lane: `claude_s12_governed_fix3_sql` (staged-runner lane `governed-fix3`), model Sonnet 5.5
- Worktree: `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`, branch `claude/phase2-slice12`, HEAD `b16edb54a7a1b698ed8ca15b6085046d4270626e`

## Status

GREEN. Final run G1: 7 files, 604 tests, 0 failures, no harness abort. RED was observed first for the right reason (R2): after a
pattern's bound type moved to an artifact outside the block's range, the recompute still returned a digest and the governed submit
SUCCEEDED (a review was opened). A pattern whose bound type is incompatible is now refused at the recompute, hence at submit,
decision, activation and recheck, with the pattern producer's own incompatible-block refusal.

## Scope

`review-block-compat.md` finding 1 / section 5. The pattern branch of `platform_private.cms_governed_current_digest` checked the
registry and the withdrawn lifecycle only; templates re-enforce the compiler range at every governed step through
`cms_template_block_digest`. Fix: after the pattern block loop, call `platform_private.cms_pattern_blocks_compatible`
(`20261014090200`) over the tree and the subject's `typeIds` and raise `VALIDATION_FAILED` / `P0001` / DETAIL `["/blockTree"]`,
exactly the refusal `cms_create_pattern_version` raises for an incompatible block (`20261014020400:236-238`).

Decisions:
- Anchored patch (one anchor, asserted exactly once; `already applied` detected by the replacement text; every non-body `pg_proc`
  attribute compared before and after; 55000 on any surprise), like `20261014040000` / `20261014080000`. The anchor is
  `end loop;` followed by the `return ...cms_jcs_sha256(tuples);` line, so the check sits between the loop and the fold.
- Token and DETAIL are the producer's (brief). A missing block (VALIDATION_FAILED, no DETAIL) and a withdrawn block (CONFLICT) are
  still refused earlier in the loop with their existing tokens; a deprecated block is admitted (fix2 behaviour intact).
- `typeIds` absent or empty binds no type, so the check is vacuous and the digest is the unchanged registry fold (this keeps the
  existing governed_fix cases, which drive the function with a bare `blockTree`, byte-for-byte valid).
- No new grants, no contract change, no spec ambiguity resolved by invention. The frozen recheck already maps any raise to
  `changed` (`20261013300400:220-223`).

Unchanged, PROVEN (three independent ways):
1. md5 oracles (030-identity) computed by script from the applied `300400` body with the two promoted patches applied to the text,
   not from the function under test: the template branch and declarations (`28ad23e7...`), the pattern block loop up to `end loop;`
   (`3d38a260...`), and the closing fold plus taxonomy fall-through (`d3efc219...`) are byte-identical in the live body.
2. Behavioural: all 36 pre-existing governed_fix cases (digest values, ordering, dedupe, deprecated, withdrawn, template, taxonomy,
   ACL/owner) and the 32-case fix2 flow pass unchanged; in-range subjects in 010 recompute to independently folded hashes.
3. Parity matrix (020): 7 range shapes x 6 bound-type sets: the pattern and template recompute admit exactly the same 8 pairs and
   refuse the same 34.

## Files

| Path | Lines | SHA-256 |
| --- | --- | --- |
| supabase/migrations-wip/governed-fix3/20261014100000_cms_governed_digest_pattern_compat.sql | 77 | 47b6f8d66be1088c975c1372acedc8a36f3cd72c1e08e35198a82661e367a416 |
| supabase/tests/phase_02_slice_12_governed_fix3.sql (new main suite, 42 cases) | 27 | 126c2ae1c8b7bd06d3ab4cd2c1f6f5cd02cabb5feb58ff7f3ca49e906192f741 |
| supabase/tests/phase_02_slice_12_governed_fix3/010-pattern-compat.sqlinc | 100 | 7486ecd054ab57df6326eb6a327e68ee07f4ae95af8ecfee37b33f3263e32dda |
| supabase/tests/phase_02_slice_12_governed_fix3/020-template-parity.sqlinc | 36 | 432bc6ac80f61fca7e8ba82dc031e09a29bd57e5a704a91f289465868645f6cd |
| supabase/tests/phase_02_slice_12_governed_fix3/030-identity.sqlinc | 39 | 000f4c1c898add8c8cc1d41a86c255c6a9d4b2ef27c27ae5bcdc396fdc36cd44 |
| supabase/tests/phase_02_slice_12_governed_fix3/040-replay.sqlinc | 136 | 2b4226891c1b92f3321736ecd190c275a033ac3845260b42debf67743ae1dd2e |
| supabase/tests/phase_02_slice_12_governed_fix3/compat-flow.sql (standalone, 32 cases) | 194 | b8c5711c77767702025b71a142d284bfebd3cf747e27ff877225e571c824910c |
| supabase/tests/phase_02_slice_12_governed_fix3/README.md | 24 | fab07004093b5cdee6d7a7d0f0cfa189fd51257f0d4f23637028dc9a82bc962d |
| supabase/tests/phase_02_slice_12_block_compatibility/README.md (new, requested by the review) | 29 | fb25a295f9546619f7a65918ff95d2aa544389095a6077582afeeafbf5796458 |
| docs/handoffs/2026-10-14-claude-s12/lane-governed-fix3-report.md | this file | - |

No existing file was edited. `040-replay.sqlinc` embeds two byte-identical copies of the migration's `do $amend$` block (extracted by
script); if the migration changes, regenerate it. `010`, `compat-flow.sql` reuse the block-compat and pattern-definition fixtures
read-only (`\ir`), they do not edit them.

What the tests cover:
- 010 (direct digest): 5 in-range admissions (exact, two real types, dotted-numeric 1.0.0..1.9 over {1, 1.9}, 1.9..1.9 over a 1.9
  type, deprecated in range), 2 vacuous bindings (no `typeIds`, empty list), 11 refusals (1.9..1.9 vs 1; 1..1 vs 1.9; every-type
  rule both orders; inverted; unregistered artifact compiler `2`; unregistered bound; missing max; empty range; unknown type id;
  one bad block in a tree) with the producer SQLSTATE/message/DETAIL, plus withdrawn (CONFLICT) and missing (VALIDATION_FAILED, no
  DETAIL) keeping their earlier tokens.
- compat-flow (real producer + governed commands, lane list `governed-b,governed-fix3`): three drafts over real types; control
  recompute equals stored digest; draft `b` walks submit, assign, decide, activate to `active`; type 1's active version is replaced
  by a 1.9 successor, then the recompute raises the producer refusal, the governed submit is refused (`P0001` / `VALIDATION_FAILED`,
  every captured table unchanged, draft stays `draft`, no review opened); type 2 moves to compiler `1.0.0` (still covered, dotted
  numeric) and draft `c` is still submittable into `review`.

## Runs

All via `lane-db-alt-staged.sh`, lane list `governed-b,governed-fix3`, ALT stack.

| # | Time | Files | Result |
| - | ---- | ----- | ------ |
| R1 | 16:37 | fix3 main + flow; WIP dir EMPTY | main 42 tests / 20 fail, flow 32 / 16 fail. Genuine RED on #15-25, 29-32, 36, 39, 42 of the main suite. Harness defects of mine, fixed before R2: #26-27 expected a `-` DETAIL marker (PG_EXCEPTION_DETAIL is `''`); the flow created no draft because idempotency key `fix3-a` is under the 8-character minimum (`INVALID_REQUEST`), so nothing downstream was classifiable. TAP `.lane-logs/alt-staged-governed-b+governed-fix3-163735-1318954.tap` |
| R2 | 16:39 | same; WIP dir EMPTY (RED) | main 42 / 18 fail, flow 32 / 6 fail, all genuine RED, no harness abort. Main #15-25 out-of-range shapes recompute to a digest; #29-32 parity (34 pairs the template refuses and the pattern admits); #36 source oracle; #39, #42 replay applies the patch to an unpatched body. Flow #23-28: the recompute returned a digest and the governed submit succeeded (state `review`, one review). Controls pass. TAP `.lane-logs/alt-staged-governed-b+governed-fix3-163912-1328174.tap`, SHA-256 `242710cb317153ec5a7c08c68e4654c12f02475b31daa6cbc96ce85aa2bddb7e` |
| G1 | 16:40 | + migration (11 WIP migrations staged: 10 governed-b + this one); fix3 main 42, fix3 flow 32, governed_fix 36, fix2 `deprecated-pattern-flow.sql` 32, governed_submit 74, block_compatibility 45, pattern_definition 343 | **604 tests, 0 fail.** TAP `.lane-logs/alt-staged-governed-b+governed-fix3-164008-1334026.tap`, SHA-256 `aaf0a2f81878bcecb6aa3b62c2487891b79c12d07c6fecd2d988c9704aec7299` |

Regression set requested by the brief (governed_fix, governed_submit, block_compatibility, pattern_definition) all pass in G1, plus
the fix2 standalone flow.

## Test corrections

None. No existing assertion or file changed.

## Spec citations

- BE03c :317-327 (the server recomputes the digest at pattern create, pattern activate and 03b publication preflight; a missing,
  withdrawn or incompatible block reference fails closed before mutation or publication), :1361 (CMS-03C-12 rejects a missing,
  withdrawn or incompatible block; the digest is recomputed again at activation and at 03b publication preflight), :1500 (template
  activation only after exact compatibility checks), :396 (a registered, non-withdrawn version).
- BE03a :1098-1101 (compatibility range), :2761; `review-block-compat.md` section 5; design note `20261013300400:9-11`.
- `[P2-S12-AC-193]` (digest recompute at pattern activate): this lane closes the review's stated reason to hold that clause open.

## Open items / BOUNDARY

- No spec line names the token a governed-time incompatible refusal uses. I used the producer's (P0001, `VALIDATION_FAILED`, DETAIL
  `["/blockTree"]`) as the brief instructs; the frozen recheck maps any raise to `changed`, so only the submit surface exposes it.
  Not a stub, no tracking issue (no network in this lane).
- The 03b publication-preflight pattern provider (BE03c :1399: reasons `pattern_not_active`, `pattern_digest_changed` only) does not
  evaluate compatibility either, although :320-323 says "before publication". Out of this lane (Slice 13 / 03b provider). Question
  for root.
- Reachability today: every real artifact is compiled at `'1'` and ranges are immutable, so with the real compiler the verdict is
  time-invariant; the fix closes the gap for the first second compiler version. The flow's successor version is the ONE
  producer-unreachable state in this lane, labelled in the file: a successor active version whose artifact carries another
  registry-valid compiler, built under `app.cms_rpc` (no trigger disabled, predecessor's own workflow policy and activation
  evidence, predecessor superseded as CMS-03A activation does). It inserts an `active` row directly, the exception the review of
  the block-compat lane already accepted for the same technique.
- `040-replay.sqlinc` is a verbatim copy, not a contract-parity-tested one (same caveat as fix2's `030-replay.sqlinc`).

## Requests to root

1. Promote `supabase/migrations-wip/governed-fix3/20261014100000_cms_governed_digest_pattern_compat.sql` (sorts after the promoted
   `20261014090200`; it requires that migration's `cms_pattern_blocks_compatible` and `080000`'s body, both promoted).
2. Run the canonical gates with the new tests. `phase_02_slice_12_governed_fix3.sql` runs alone (no pattern producer needed).
   `phase_02_slice_12_governed_fix3/compat-flow.sql` needs the pattern producer and governed submit/assign/decide/activate promoted
   (it is standalone like `deprecated-pattern-flow.sql`; add it to the gate list if `db:test` globs `supabase/tests/*.sql` only).
3. Record in the tracker: AC-193's "recomputes the digest at pattern activate" clause now holds for compatibility as well as
   lifecycle; the 03b publication-preflight provider gap (above) remains for Slice 13.
