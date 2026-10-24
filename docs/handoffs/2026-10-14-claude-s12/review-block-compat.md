# Review — lane `claude_s12_block_compat_sql` (root ruling B)

Reviewer did not author anything under review. Worktree `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`,
HEAD `b16edb54a7a1b698ed8ca15b6085046d4270626e` (verified). Static only: no DB, no tests, no edits outside this
file. Lane report read at SHA `f2e4547c8c6a933c133be48bccb5c04eb63737c21e05bcd54d20f6adb7af881f`. File hashes not
re-verified (brief item 5 excluded); TAP files under `.lane-logs/` read for the RED/GREEN reasons only.

## 1. Spec conformance (ruling B, BE03a :1098-1101, :2761; BE03c :209, :317-327, :1361, :1567)

- `20261014090000` helpers. `cms_compiler_version_rank` ranks only members of the closed registry
  (`cms_compiler_registry_valid`, `20260902080000:533-540`, both IMMUTABLE) as `integer[3]`, missing components 0:
  `1 = 1.0 = 1.0.0 < 1.9`. The `::integer` casts are guarded by the registry test, so no cast error is reachable.
  `cms_block_range_covers` is true only for an object with both keys as strings, both and the version registry-valid,
  `min <= v <= max`; `coalesce(..., false)` makes a NULL range (LEFT JOIN miss) and every NULL branch false. Correct.
- `20261014090100` (`cms_template_block_digest`). Mechanical diff against the applied body `20260927240000:6-96`:
  exactly one hunk, the 13-line `renderer_manifest->'blocks'|'blockDefinitions'` EXISTS replaced by
  `cms_block_range_covers(block_row.compatibility_range, artifact.compiler_version)` (WIP `:85-86`). Signature,
  plpgsql/volatile/SECURITY DEFINER/`search_path ''`, per-block `FOR SHARE` (`:54-59`), lifecycle resolution and
  `CONFLICT` (`:63-71`), `VALIDATION_FAILED` tokens, `collate "C"` ordering (`:52`), the six-member tuple (`:92-99`)
  and `cms_jcs_sha256` are byte-identical. The predicate has no input into the tuple, so no digest VALUE changes;
  only the admitted set changes (real compiled chains now admissible, raw manifest-only fixtures no longer). Owner
  `wejammin_cms_definer` (`20261003120500:138`) and ACL survive `CREATE OR REPLACE`; the revoke is restated (`:108`).
- `20261014090200` (`cms_pattern_blocks_compatible`). Diff against `20261014020300:110-152`: the manifest EXISTS is
  replaced by a LEFT JOIN to the registered row (`(block_key, block_version)` unique, `20260902080000:1463`, so at
  most one row) plus `cms_block_range_covers` (`:36-39`, `:53-54`); closure, type join, `NOT EXISTS` shape and the
  comment-only change otherwise. Lifecycle still decided by `cms_pattern_registry_digest` (withdrawn refused,
  deprecated admitted: BE03c :396, :1514-1515). Caller `20261014020400:236-238` untouched; refusal stays
  `VALIDATION_FAILED` + DETAIL `["/blockTree"]`.
- Ruling on dotted-numeric ordering: correct and necessary. Text order would put `'1' < '1.0.0'` and refuse the
  ordinary `1.0.0..1.9` range for the only compiler the real producer writes (`'1'`, `20261010166000:233,248`).
  BE03a does not state the ordering; this is an implementation decision (decision-classification rule) and
  should become a DEC (lane report request 3; I concur).
- Ruling on fail-closed: correct. Note that `cms_register_block`'s validator (`20260902080000:954-958`) requires
  both keys registry-valid but does NOT require `min <= max`, so an inverted range IS producer-writable; the lane
  tests it through the real producer (`bc.inverted`). Key-less and out-of-registry ranges are producer-unreachable.
- AC-194 / BE03a :2761 reading: sound. `compatibility_range` is not a member of the safe
  `BlockDefinitionRegistryRecord` (BE03c :303-309; AC-145 oracle), but BE03a :2761 directs 03a to "expose ...
  compatibility ranges" to 03c and, in the same bullet, names a DB-internal `platform_private` resolver as the
  03a↔03c seam; BE03c :1567 has 03c "validate compatibility against those exact artifacts". The check runs inside
  `platform_private` SECURITY DEFINER functions over 03a's table; no contract changes. AC-194's literal "consumes
  only the safe ... projection" then applies to the Worker/browser consumer. Root should record this reading as a
  DEC (or an AC-194 clarification) so the tracker text does not read as contradicted.

## 2. Security

No new grants to any API role: both helpers `revoke all ... from public, anon, authenticated, service_role`
(`090000:67-70`); owner handoff follows the `020300:182-188` precedent exactly (`grant create` → `alter owner` →
`revoke create`). `search_path = ''` with `pg_catalog`/`platform_private` qualification throughout. Error tokens
and DETAIL unchanged; no PII, no secrets, no new concealment surface (private functions only). Clean.

## 3. Tests

New suite `phase_02_slice_12_block_compatibility.sql` (45): real producers only (signed `cms_register_block` for
six blocks with real ranges, signed lifecycle advances, S09 chains, `platform_api.cms_define_template`,
`platform_api.cms_create_pattern_version`). R1 TAP (`115057-186279`): the 13 failures are exactly the five pattern
and five template in-range admissions plus the three assertions that depend on them (deprecated admission, stored
row count, digest equality) — genuine missing feature, no harness failure. Every refusal assertion fails against
the new code if the range predicate is removed (admission → `OK` ≠ `VALIDATION_FAILED`), so none is vacuous on the
new rule; the stored-nothing baselines (`010:71,84`; `020:76`) and the independently folded tuple hashes (`010:88-92`,
`020:26-30`) are real oracles.

Fixture clones (brief question):
- (a) `bc_make_type` (`000:28-77`): active types cloned from chain type 1 with artifact `compiler_version` `1.9`
  and `2`. The `1.9` clone is legitimate: the registry admits `1.9`, the range semantics on both sides of a boundary
  are spec-defined, and no producer emits anything but `'1'`; it is labelled, built under `app.cms_rpc` with the
  chain's own policy/evidence columns, and mirrors the pattern-def precedent. The `2` clone is NOT a spec-required
  state: 03a's activation and drift guards refuse a non-registry `compiler_version` (`20261005018400:134`,
  `20261005012000:309`); it is a defensive witness of the fail-closed decision. Keep it, but its label should say so
  (minor). Both do flip rows to `active` directly, which the lane rules' never-list names; acceptable here only
  because the state is producer-unreachable and labelled — root should note the exception.
- (b) `bc_clone_block` (`000:116-135`): rows with unregistered bound, missing `maxSchemaCompiler`, `{}`. No producer
  can write them and no spec text requires handling them; they witness the recorded fail-closed decision, which is
  the right default because raw `'{}'` fixtures exist in the repo (`phase_02_slice_11_helpers/003-registry.sqlinc:22`,
  and `template_authority.sql:538` before correction). Legitimate as decision witnesses, not spec witnesses.
- `[P2-S12-AC-104]` on the range refusals is partial DB-boundary coverage (AC-104 is the HTTP mapping AC), as the
  pattern-def oracles already do; the tracker must not mark AC-104 done on this basis (minor, no change needed).

Test corrections — all spec-cited, minimal, none weakens:
- `template_authority.sql:538` `'{}'` → `{"minSchemaCompiler":"1","maxSchemaCompiler":"1"}` (BE03a :1098-1101):
  required for the positive test at `:604` to mean anything under the spec rule.
- `:569-573` `compiler_version 's12-test'` → `'1'`; manifest → the compiler's three-member shape (BE03a :2246-2255,
  AC-007 oracle). Strengthens fidelity; the hand-made `editor_manifest '{}'` is unchanged and immaterial.
- `:618-650` the assertion of the invented rule becomes a range refusal (block v2 registered `1.9..1.9` vs artifact
  `'1'`), same `VALIDATION_FAILED`; dropping the Slice 10 `typeId` override is correct (that type's compiler version
  is not fixed by this suite). Observation: this refusal also held under the old rule (manifest absent), so it does
  not by itself discriminate old from new; the positive test at `:604` does (RED under the old rule). Together OK.
- Pattern-def `000-fixtures.sqlinc`: `s12pd_types` are now the 65 real chains (removes 65 raw clones carrying an
  invented `{"blocks":[...]}` manifest — a strengthening); `s12pd.high`/`s12pd.wide` registered through the signed
  producer; one labelled `1.9` variant; the setup assertion now asserts the compiler's shape (`:138-145`). No stale
  reference to `s12pd_block_manifest`/`blockDefinitions` remains (grep). `047-block-compat.sqlinc`: three refusals
  through `s12pd_refused` (P0001 + token + full-row snapshot) and two admissions, all in range terms, each
  discriminating. `README.md`: bullets `000`/`047` accurate; line 3 "authored and unrun" is pre-existing stale text.

## 4. Conventions

72/111/64-line migrations, 146/92/77-line includes; precedent shape matched; no TODO; no `any`. Minor:
`supabase/tests/phase_02_slice_12_block_compatibility/` has three files and no `README.md`, while every sibling
Slice 12 test directory has one (`.claude/rules/extensibility.md`). Nit: `cms_block_range_covers` is STABLE though
pure (its callee is IMMUTABLE); harmless.

## 5. Governed recompute: must the pattern branch also enforce the range? — YES (follow-up lane)

Facts. Template branch of `cms_governed_current_digest` delegates to `cms_template_block_digest`
(`20261013300400:92-95`), so templates re-enforce lifecycle AND range at submit (`300800:192`), decision and
activation (`cms_governed_frozen_status` `300400:218-224`, activation core `070200:63`) and recheck. The pattern
branch (`300400:96-128`, patched by `040000`/`080000`) checks registry + withdrawn only; `cms_pattern_blocks_compatible`
is called only by `cms_create_pattern_version` (`020400:237`). Asymmetry.

Spec. BE03c :317-327: the server "recomputes this digest at ... pattern create, pattern activate, and 03b publication
preflight" and "Missing, withdrawn, incompatible ... block references fail closed before mutation or publication";
:1361: the create procedure "rejects a missing, withdrawn or incompatible block ... the digest is recomputed again at
activation and at 03b publication preflight"; :1500 (templates) activation "only after exact compatibility checks".
The implementation's own design note `300400:9-11` ("A missing, withdrawn or incompatible block raises, as the
template digest does") shows parity was intended and never implemented for patterns.

Dependency currency. `cms_governed_dependency_refs` freezes `content_type` as the ACTIVE VERSION ID and `block` as
the row id (`300400`); `cms_governed_frozen_status` returns `changed` on any identity difference (`:198-213`) and
requires an active version per bound type (`:235-245`); the artifact is immutable and 1:1 with its version (BE03a
:2133; join `artifact.content_type_version_id = version_row.id`); `compatibility_range` is immutable. So WITHIN a
review the create-time verdict cannot drift silently (new type version → `dependency_changed`; withdrawal → digest).
The residual gap is between pattern create and (re)submit: a type whose active version changed after the draft was
created is frozen at submit (`300800:179-186`) with no range evaluation anywhere afterwards; templates close the
same window through the digest function. Reachability today: none — every real artifact is `'1'` and ranges are
immutable, so the verdict is time-invariant until a second compiler version ships.

Recommendation. Forward anchored patch (like `040000`/`080000`; `300400` is applied) adding, after the pattern loop,
`if not platform_private.cms_pattern_blocks_compatible(p_owner_id, p_subject->'blockTree', p_subject->'typeIds')
then raise exception 'VALIDATION_FAILED' using errcode = 'P0001'; end if;` — submit then refuses like the template
branch, and frozen-status maps the raise to `changed`/`dependency_changed` (`300400:220-223`). Separate lane, RED
first: pattern created over a real type; the type's active version replaced by a `1.9`-artifact clone (same
labelled technique); submit refused; template parity case. The 03b publication-preflight pattern provider (BE03c
:1399: reasons `pattern_not_active`, `pattern_digest_changed` only) likewise does not evaluate compatibility; BE03c
:320-323 says "before publication" — Slice 13 question for root. Severity: major, pre-existing, outside this lane's
claim, unreachable with today's single compiler; it does not block promotion of `090000-090200` but AC-193's
"recomputes the digest at ... pattern activate" clause should not be closed until parity lands.

## Findings

1. `supabase/migrations/20261013300400_cms_governed_frozen_status.sql:96-128` — major (pre-existing, outside lane
   claim) — pattern branch of the governed recompute never evaluates block↔type compatibility; templates do —
   BE03c :320-327, :1361; parity intended per `:9-11` — follow-up anchored patch + RED tests (section 5).
2. `supabase/tests/phase_02_slice_12_block_compatibility/` — minor — no `README.md` in a 3-file test directory;
   every sibling has one — add one describing the clone labels and the matrix.
3. `supabase/tests/phase_02_slice_12_block_compatibility/000-fixtures.sqlinc:77,83` — minor — the `compiler_version`
   `'2'` clone is a state 03a refuses at activation, not a spec-required one — label it as a defensive fail-closed
   witness (comment change only).
4. Tracker/DEC — minor — record: dotted-numeric ordering, fail-closed on defective/inverted ranges, AC-194 /
   BE03a :2761 DB-side reading, and the clone-fixture exception to the "never insert active rows" rule.

VERDICT: CLEAR
