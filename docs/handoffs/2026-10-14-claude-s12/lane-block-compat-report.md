# Lane report — block-compat (`claude_s12_block_compat_sql`)

## Status

GREEN. Root ruling B implemented as three forward WIP migrations; the new real-chain suite went RED (13 failures,
all in-range admissions) and then GREEN (45/45) on identical test bytes; the regression run (8 files, 629 tests)
and the populated-lineage witness (38) pass. Nothing promoted, committed or staged.

## Scope

Root ruling B (`review-blockcompat.md`): block compatibility for templates and patterns is not a renderer-manifest
`blocks` allowlist. A block is compatible with a content type when it is registered, its lifecycle admits it
(templates: `supported`; patterns: not withdrawn) and its registered `compatibility {minSchemaCompiler,
maxSchemaCompiler}` covers the `compiler_version` of the active artifact of EVERY `compatibleTypeIds` member.
WIP range used: 20261014090000-20261014090200.

## What changes, precisely

1. `20261014090000_cms_block_compiler_range.sql` (new helpers, private, owner `wejammin_cms_definer`, no API role
   may execute):
   - `cms_compiler_version_rank(text) -> integer[]`: dotted-numeric position over the CLOSED compiler registry
     (`cms_compiler_registry_valid`: `'1','1.0','1.0.0','1.9'`); `1 = 1.0 = 1.0.0 < 1.9`; NULL outside the registry.
   - `cms_block_range_covers(jsonb, text) -> boolean`: true only when the range has BOTH keys as strings, both and
     the version are registry-valid and `min <= version <= max`; otherwise false (fail closed).
2. `20261014090100_cms_template_block_digest_compiler_range.sql`: `CREATE OR REPLACE` of
   `platform_private.cms_template_block_digest` (replaces the rule of `20260927240000:54-83`). The ONLY body change
   is the compatibility predicate: the `renderer_manifest->'blocks'|'blockDefinitions'` `exists(...)` (13 lines) is
   replaced by `cms_block_range_covers(block_row.compatibility_range, artifact.compiler_version)`. A diff of the new
   function against the `20260927240000` body shows exactly that hunk plus a `comment on function` and the kept
   `revoke`. Signature, language, volatility, SECURITY DEFINER, empty `search_path`, owner and ACL are kept by
   `CREATE OR REPLACE`. Lifecycle resolution, the per-block `FOR SHARE`, ordering, refusal tokens (unregistered or
   out of range `VALIDATION_FAILED`, not supported `CONFLICT`) and the digest tuple
   `{blockKey, blockVersion, releaseDigest, propsSchemaHash, rendererRef, lifecycle}` are byte-identical, so every
   digest the function could return before is unchanged (asserted: template `bc.exact` digest equals the
   independently folded tuple hash; existing `template_authority` digest assertion and `governed_fix` digest
   suites still pass). The governed recompute (`20261013300400:93-95`) delegates its template branch here, so it
   follows the new rule; its comment at `:133` ("renderer-manifest compatibility included") is now stale and is
   immutable, recorded here.
3. `20261014090200_cms_pattern_blocks_compiler_range.sql`: `CREATE OR REPLACE` of
   `platform_private.cms_pattern_blocks_compatible` (replaces `20261014020300:110-152`). Same closure of reachable
   blocks (nested patterns included), same active-owner-type/active-version join, same `NOT EXISTS` shape; the
   manifest predicate is replaced by a LEFT JOIN to the registered block row and `cms_block_range_covers`. A block
   row that does not exist covers nothing (the digest refuses it first). Lifecycle is still decided by
   `cms_pattern_registry_digest` (withdrawn refused, deprecated admitted). Caller `cms_create_pattern_version`
   untouched.

## Implementation decisions (named by the review; stated per decision-classification)

- Registry ordering: dotted-numeric per component (1 = 1.0 = 1.0.0 < 1.9), never string order (as text
  `'1' < '1.0.0'`, which would reject the common `1.0.0..1.9` range for a `1` artifact; the suite covers it).
- Fail closed: a range lacking either key, a non-string key, a bound or artifact `compiler_version` outside the
  registry, or an inverted range covers nothing. The real producer always writes both registry-valid keys; only
  raw legacy fixtures can hold a defective range.
- AC-194 / BE03a :2761 reading: the safe `BlockDefinitionRegistryRecord` is the browser/Worker projection and never
  carries `compatibilityRange` (AC-145 oracle unchanged); the compatibility test runs DB-side inside
  `platform_private` over 03a's table, as the digest already reads `release_digest`, `props_schema_hash` and
  `renderer_ref` from the full row. No contract change.

## Files

| Path | Lines | SHA-256 |
| --- | --- | --- |
| `supabase/migrations-wip/block-compat/20261014090000_cms_block_compiler_range.sql` | 72 | `29da3ce595286aa4debb8bfb4982d4d5862b3ded5b613deebcf5b9113c5deab3` |
| `supabase/migrations-wip/block-compat/20261014090100_cms_template_block_digest_compiler_range.sql` | 111 | `07eca8be375a23092e73d8bbd76f1d78ad612344e50cd5a77fda7b339407f7fc` |
| `supabase/migrations-wip/block-compat/20261014090200_cms_pattern_blocks_compiler_range.sql` | 64 | `9639be27c2f8891dc2d98945ae5df78c65c3c18968da372cc8352cbe6a13f2a5` |
| `supabase/tests/phase_02_slice_12_block_compatibility.sql` | 24 | `cf248ce1cfd59b34fe20addde5f27a8e0d7a9d9804056b19b075a5b58f6029cc` |
| `supabase/tests/phase_02_slice_12_block_compatibility/000-fixtures.sqlinc` | 146 | `a212d8ab61808df86e63ad3c46515ab4ffa57a75f2b4373543d79ac0f3c923b4` |
| `supabase/tests/phase_02_slice_12_block_compatibility/010-patterns.sqlinc` | 92 | `c2500058ef7589266b4045a65f267a2574e0812a831e9991260fcc0568400947` |
| `supabase/tests/phase_02_slice_12_block_compatibility/020-templates.sqlinc` | 77 | `33b80e798574024ceef9dbd64d4638a82d0a4340da73eae032f61167f993b149` |
| `supabase/tests/phase_02_slice_12_template_authority.sql` (corrected) | 718 | `ee13e1823e2c069051c4e4a87ac8179e8b2d78f10d1d4a3f5568be2f3a460982` |
| `supabase/tests/phase_02_slice_12_pattern_definition/000-fixtures.sqlinc` (corrected) | 205 | `ac106ced9de42838c4ecded4d750caad75ac91a1319f8ef91f48e5d4dce19203` |
| `supabase/tests/phase_02_slice_12_pattern_definition/047-block-compat.sqlinc` (rewritten) | 49 | `df781640c2a6c038e9ac3fbbdedd18904ec91bfbb5171a8a62675f27ee779abf` |
| `supabase/tests/phase_02_slice_12_pattern_definition/README.md` (two lines) | 37 | `652fc88a4ada6566ddc69b998b2321fa95ac6581ecd3e36f0ab4576393f5a80a` |

All new SQL files are under 300 lines. The new suite uses only real producers: signed `cms_register_block`
(six blocks with real ranges), signed lifecycle advance (deprecate, withdraw), S09 type chains
(`s09d_create_type` + `s09d_to_active`), `platform_api.cms_define_template` and
`platform_api.cms_create_pattern_version`. Two labelled fixture clones, both under `app.cms_rpc`, no trigger
disabled: (a) active types cloned from chain type 1 whose artifact carries `compiler_version` `1.9` and `2` (the real
compiler only ever writes `1`; a range test needs an artifact on the other side of a boundary); (b) three block rows
cloned from a registered block with a defective `compatibility_range` (unregistered bound `2`, missing
`maxSchemaCompiler`, `{}`) that the producer's validator cannot write. Setup asserts that the real chain types carry
`compiler_version` 1 and no `blocks`/`blockDefinitions` member.

Suite matrix (45 tests; patterns and templates mirror each other): in range (`1..1`, `1.0.0..1.9`, `1.9..1.9` vs a
1.9 type, two real types, a real plus a 1.9 type), out of range (`1.9..1.9` vs 1, `1..1` vs 1.9), every member must
be covered (one-of-two, both orders), inverted range, artifact outside the registry, range bound outside the
registry, missing key, empty range, unregistered block, deprecated (pattern admitted, template CONFLICT), withdrawn
(pattern VALIDATION_FAILED, template CONFLICT), refusal detail `["/blockTree"]`, refused calls store nothing (row
counts), admitted digests equal the independently folded tuple hash.

## Runs

| # | time | stamp | lane list | files | result | TAP SHA-256 |
| - | ---- | ----- | --------- | ----- | ------ | ----------- |
| R1 | 11:50:57 | 115057-186279 | governed-b,block-compat (0 block-compat WIP, 10 total) | new suite, 45 tests | RED 32 pass / 13 fail; failing 8-12, 24, 27-33; first failing test 8 `have VALIDATION_FAILED want OK` | `440516993a6fb206ab49f52a319bcf958e68953bd0eaf445c8e0290065161288` |
| G1 | 11:52:30 | 115230-195714 | governed-b,block-compat (13 WIP) | new suite, 45 tests | GREEN 45/45, 0 failures | `b5b4607b7ff51e1378821f23af4c22824580553caccbce9a964e45426289f34a` |
| G2 | 11:54:06 | 115406-204579 | governed-b,block-compat (13 WIP) | block_compatibility 45, template_authority 70, pattern_definition 343, governed_submit 74, governed_fix 36, governed_fix/deprecated-pattern-flow 32, template_detail 14, 09 template_compat_guard 15 | GREEN 629/629, 0 failures | `2bdb101b9274f71a1cc1e357e3e91d6727218d29abf44463d10a4817de95022b` |
| G3 | 11:55:14 (lock 11:58:13) | 115514-212133 | governed-b,block-compat (13 WIP) | pattern_definition/populated-lineage.sql (reuses 000-fixtures), 38 tests | GREEN 38/38 | `4077f3f87bf6a50bfefbe904613cba117de6231c3fd9a1e08109db2aaab0c4e2` |

TAPs under `/home/rob/.codex/worktrees/phase2-slice12/WeJammin/.lane-logs/alt-staged-governed-b+block-compat-<stamp>.tap`;
manifests alongside (G2 manifest SHA-256 `cb325b171778f5bd67ce82daa5969322b14b59dd89f022858562a7de496040f0`).

R1 classification: genuine missing feature (the current rule refuses every real-chain block-bearing draft because
compiled artifacts never carry `blocks`); setup tests 1-7 passed, so no harness failure. The out-of-range /
fail-closed / withdrawn refusals pass under the old rule for the wrong reason; they became non-vacuous once the
admissions passed in G1. No run was repeated on identical bytes; G1 and G2 differ by the migration-independent
test corrections listed below.

## Test corrections

All spec-cited (BE03a :1098-1101, :2761; BE03c :209, :1361, :1567), minimal, none weakens an assertion: each
replaces the invented renderer-manifest rule with the spec rule and keeps the same refusal expectation.

1. `phase_02_slice_12_template_authority.sql` (diff vs HEAD, `git diff -U0`):
   - `:538` hand-inserted block `profile.header` v1: `compatibility_range` `'{}'` -> `'{"minSchemaCompiler":"1","maxSchemaCompiler":"1"}'`.
   - `:569-573` hand-inserted artifact: `compiler_version` `'s12-test'` -> `'1'`; `renderer_manifest` was the invented
     `{"blocks":[{"blockKey":"profile.header","blockVersion":1}]}` and is now the compiler's three-member shape
     `{"relations":[],"templateBindings":[],"capabilityBindings":[]}`.
   - `:618-620` assertion "rejects a registered block absent from the active type renderer" (asserted the invented
     rule): now inserts block `profile.header` v2 with range `1.9..1.9` (new row id `...308`, nonce hash `9`*64) and
     defines a template whose slot allows v2 against the compatible type (artifact compiled at `1`); expects the same
     `VALIDATION_FAILED`; description "rejects a registered block whose compiler range excludes the active type
     compiler_version". The `compatibleTypeIds` override to the Slice 10 `typeId` was dropped because that type's
     compiler version is not set by this suite.
   - Remaining assertions in the file (positive admission, digest tuple, deprecated/withdrawn CONFLICT, no partial
     row) are unchanged and still pass.
2. `phase_02_slice_12_pattern_definition/000-fixtures.sqlinc` (untracked directory, no git diff; edits described):
   - new signed registrations `s12pd.high` (`1.9..1.9`) and `s12pd.wide` (`1.0.0..1.9`) beside `s12pd.block` (`1..1`);
   - `s12pd_types` are now the real chain types (`insert into s12pd_types select ... from s12pd_chain_types`) instead
     of 65 cloned types carrying an invented `{"blocks":[...]}` manifest; `s12pd_block_manifest` removed;
   - `s12pd_make_compatible_type(p_key, p_compiler)` now clones chain type 1 with another `compiler_version` and
     is used once for the single variant `compiler-1-9`; the `definitions-member` and `other-block-version` variants
     (a `blockDefinitions` member, a manifest listing another block version) are removed because the spec has no such
     members;
   - setup assertion "renderer manifest lists the fixture block" -> "real active compiled type, compiler_version 1,
     no renderer-manifest block member"; one new assertion for the variant type.
3. `047-block-compat.sqlinc` rewritten with the same five scenarios in range terms: incompatible chain type ->
   `s12pd.high` over chain type 1 (refused, detail `["/blockTree"]`); one-of-two -> chain 1 plus variant 1.9 with
   `s12pd.block` (refused); other-block-version -> `s12pd.block` over the variant alone (refused); definitions-member
   -> `s12pd.high` over the variant (accepted); compatible-both -> `s12pd.wide` over chain 2 plus variant (accepted).
   Each refusal still asserts `VALIDATION_FAILED`, `P0001` and unchanged full-row snapshots.
4. `phase_02_slice_12_pattern_definition/README.md`: the `000` and `047` bullets updated to describe the above.

Raw fixtures with `compatibility_range '{}'` that the review lists outside my claim are left untouched and are
unaffected: `phase_02_slice_11_helpers/003-registry.sqlinc:22` and `phase_02_slice_11_criteria_publish_gates.sql:50`
raw-insert blocks and templates, never call `cms_template_block_digest` or the pattern compat function (no test
references either function except the two suites above), and are shared helpers the lane rules forbid editing.

## Spec citations

BE03a :1098-1101 (BlockRegistrationRequest.compatibility), :2761 (expose compatibility ranges to 03c), :2246-2255
(compiled artifact set, compiler never writes `blocks`); BE03c :209, :321, :396, :1361, :1514-1515, :1567, :1606;
IA03 :44-45, :65-66; IA deep dive :227, :400. Tracker P2-S12-AC-001, AC-101, AC-104, AC-193; P2-S09-AC-007 (no
compiler change), AC-145 (safe record unchanged). See `review-blockcompat.md` section 2.

## Open items / BOUNDARY

- No BOUNDARY: the compatibility input exists in the spec. The ordering and fail-closed decisions are recorded above.
- The pattern branch of the governed recompute (`cms_governed_current_digest`, `20261013300400:96-128`) checks
  lifecycle and registry only, not the range; compatibility is enforced at pattern definition
  (`cms_create_pattern_version`) as before. BE03c :396 says the digest is "recomputed again at activation"; a range
  check there would be a separate change (the recompute function is outside this lane's claim).
- Out of scope, observed (from the review): `cms_template_designer_context` filters blocks by `owner_id` (`20260927320000:68`)
  versus AC-145's platform-registry reading.

## Requests to root

1. Promote `supabase/migrations-wip/block-compat/20261014090000..090200_*.sql` after independent review, in order,
   after the already promoted `20261014080000`.
2. Independent review of the Test corrections section (template_authority `:538,:569-573,:618-620`; pattern-definition
   `000`, `047`, README).
3. Consider a DEC entry recording the two implementation decisions (dotted-numeric order; fail closed on a defective
   range) and the AC-194/BE03a :2761 reading, so the 2026-10-04 SQL comment is no longer the only written policy.
4. Optional: decide whether the pattern branch of the governed recompute should also evaluate the range (see Open items).
