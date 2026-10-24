# Lane s12_governed_red report (CMS-03C-06 submit)

Worktree /home/rob/.codex/worktrees/phase2-slice12/WeJammin, branch claude/phase2-slice12, HEAD
b16edb54a7a1b698ed8ca15b6085046d4270626e. Nothing staged, committed or reset; the eight preserved
20261013300000-20261013300700 migrations and the primary/Slice 11 checkouts were not touched.

## Files (lane-owned only)

- supabase/tests/phase_02_slice_12_governed_submit.sql - the RED test (CMS-03C-06).
- supabase/tests/phase_02_slice_12_governed_submit/000-fixtures.sqlinc - subjects, builders, capture, snapshot.
- supabase/tests/phase_02_slice_12_governed_submit/README.md - support index.
- docs/handoffs/2026-10-12-claude-s12/lane-codex-governed-red-report.md - this report.

## Run history (all logs preserved unchanged)

| Run | TAP log | sha256 | rc | Result |
| --- | --- | --- | --- | --- |
| 1 | alt-tap-051324-924592.tap | 3135b967...dd244 | 1 | 29 assertions, 14 failed - accepted intended missing-RPC RED |
| 2 | alt-tap-053650-1058180.tap | d652e4ef...0aa6 | 1 | parse abort at protected create (incomplete TAP) |
| 3 | alt-tap-054145-1081494.tap | 5fd7ab10...ead6 | 1 | parse abort at mint helper (incomplete TAP) |
| 4 | alt-tap-054721-1107471.tap | 9849c004...1466 | 1 | completed 32 assertions; SETUP-BLOCKED (controls 9-11 NULL) |
| 5 | alt-tap-123147-2667116.tap | a17f98fb...63ab | 1 | parse abort at test line 260 (incomplete TAP; context-fix applied) |
| 6 | alt-tap-123651-2691685.tap | f715b3c6...cecf | 1 | completed 33 assertions; clean intended missing-RPC RED (all controls pass) |

## Run 6 - ACCEPTED intended RED (single missing-RPC closure)

One-character closure of the s12gov_evidence control (test line 50: three closing parens before ->>), read-back and a
lexical scan (ignoring comments, quoted strings and dollar-quoted bodies) confirmed all three files balanced (net 0,
minDepth 0). Command and toolchain as before (node v22.23.1, pnpm 11.24.0); reset ok. TAP plan present (1..33), a
completed run. Result: 33 assertions, 16 failed / 17 passed.

All mandatory fixture controls pass: ok 8 (protected CMS-03A-01 create), ok 9 (the production policy-evidence seam now
resolves the protected member), ok 10 (both subjects resolve to draft), ok 11 (subject hash shape), ok 12 (the internal
projection wrappers restored app.cms_rpc to its prior empty value before the public commands), ok 13 (the protected
template binds exactly the two expected ids). The context-restore control (ok 12) confirms the bounded fix set
app.cms_rpc='true' only for the internal reads and restored it before any public command.

Every one of the 16 failures is the intended missing platform_api.cms_submit_governed_review(jsonb): has_function
absent (14,15); SQLSTATE 42883 / "does not exist" where 00000 / DEPENDENCY_UNAVAILABLE was expected (16,32); body NULL
(17-21, 25-26); subject draft (22); audit 0 (23); live reviews 0 (29,30); message token (27). The append-only-store
equality oracles (24, 28, 31, 33) pass vacuously while the command is absent.

This supersedes the SETUP-BLOCKED Run 4: the root-traced context precondition was the cause, and the bounded test-only
fix resolved it. No production, migration, spec, contract or tracker edit; no assertion weakened.

## Run 5 - SETUP/PARSE failure (context-fix applied, no plan)

Authorized bounded test-only repair: pg_temp.s12gov_evidence / pg_temp.s12gov_resolve (new
supabase/tests/phase_02_slice_12_governed_submit/010-projection.sqlinc) set app.cms_rpc='true' around the internal
projection reads and restore the exact prior value on success AND on exception; the internal controls call them; a
control asserts app.cms_rpc is restored to empty before the public commands. Command and toolchain as before (node
v22.23.1, pnpm 11.24.0); reset ok, no preserved-migration parse error. The run aborted with a syntax error at the
test's final line, so the plan was never emitted (incomplete TAP):

    psql:.../phase_02_slice_12_governed_submit.sql:260: ERROR:  syntax error at or near ";"

8 fixture assertions executed and passed (ok 1-8, including the protected CMS-03A-01 create). The context fix did not
get exercised because the file does not parse. This is a SETUP/parse failure in my own lane file, NOT the intended RED
and NOT evidence about the context hypothesis. Per root instruction, STOP after the single run: no fix, no rerun.

## Run 4 - SETUP-BLOCKED (not an accepted RED)

Command (native exec_command, login:false, shell:bash), pinned PATH; same shell node v22.23.1, pnpm 11.24.0. Reset ok,
no preserved-migration parse error. TAP plan present (1..32), so this is a completed run, not a parse abort. Result:
32 assertions, 19 failed / 13 passed. The intended missing-RPC assertions (13-22, 24-26, 28-29, 31) fail as expected,
but the mandatory setup controls 9, 10 and 11 fail with (test result was NULL), so the run is SETUP-BLOCKED and is NOT
an accepted intended RED:

- ok 8: the protected content type IS created through the production CMS-03A-01 command.
- NOT ok 9: the production cms_editorial_workflow_policy_evidence seam returns NULL (not 'protected') for the protected
  version.
- NOT ok 10: both subjects resolve to draft is NULL.
- NOT ok 11: the subject content hash shape is NULL.
- ok 12: the protected template binds exactly the two expected content type ids (typeA + protectedType).
- ok 6 (unchanged): the seam resolves the ordinary h11doc version, so the seam itself works.

Root's read-only trace hypothesis (STATIC, UNVERIFIED): the direct cms_editorial_workflow_policy_evidence /
cms_governed_subject_resolve calls run as the NOBYPASSRLS wejammin_cms_definer without app.cms_rpc='true', so
cms_rpc_context_valid() is false and the forced-RLS read returns NULL; reference points cited by root: 20261003120300
lines 18-21, 20260902080000 lines 1600-1608, 20261003120410 lines 74 and 86-87, and governed helper ownership 339.
The earlier malformed-binding diagnosis is NOT established and is withdrawn. No fix is authorized or made; no new
producer, no production edit, no further run.

## Cases authored

Subject A (single-member ordinary basis) ran in Run 1. Subject B (two-member protected basis, strictest-of) asserts
riskClass=protected, requiredDecisionCount=2, requiredCapabilities=[cms.reviewer, cms.reviewer.policy], and the exact
two-member policyBasisHash sorted by (policyKey, policyVersion, contentTypeId) (BE03c:1317), so cms.disclosure.policy
precedes editorial; the expected array is built and sorted independently, not read from the basis helper. Refusals:
403 capability_missing, 409 subject_not_submittable (one live review), and an unresolvable bound policy 503
DEPENDENCY_UNAVAILABLE. None of these is claimed proven while the command is absent and the setup controls are red.

## No-effect oracle (SCOPED)

s12gov_snapshot(subject) hashes the FULL CONTENT of the subject's review and dependency rows plus the subject row, and
the append-only audit_private.audit_events / platform_private.outbox_events row COUNTS. It does NOT cover
idempotency_records and covers audit/outbox by count only, so it is NOT a full-store atomicity proof; the
append-only-store oracles pass vacuously while the command is absent. Root decides the refusal-snapshot scope before
any future GREEN.

## GREEN authoring (CMS-03C-06), 2026-10-13 - NOT yet executed

DB execution NOT released. Authored (no staging/commit):

- supabase/migrations/20261013300800_cms_submit_governed_review.sql (202 lines): platform_private.cms_submit_governed_review(jsonb),
  SECURITY DEFINER, search_path '', volatile, owned by wejammin_cms_definer, no direct grants. Implements BE03c:168/:1345/:1467/:1502:
  structure; concealment (absent/cross-owner/non-member NOT_FOUND); lock order (subject FOR UPDATE via cms_governed_subject_resolve(...,true),
  then cms_governed_lock_graph FOR SHARE, then authority recheck -> capability_missing); draft/equal-hash/no-live-review else
  subject_not_submittable; fail-closed strictest-of basis and recomputed digest; reserve idempotency after preconditions; the open review +
  dependency rows + draft -> review (lifecycle_version + 1, definition version immutable per DEC-188) + one audit; no outbox event.
- supabase/migrations/20261013300810_cms_submit_governed_review_public.sql (40 lines): platform_api.cms_submit_governed_review(jsonb),
  SECURITY DEFINER, owned by the CMS definer, EXECUTE granted to service_role ONLY (predecessor transport ACL, not broadened),
  residual lock-failure -> CONFLICT, app.cms_rpc restored.
- QA: header refreshed to Run 6 (33 assertions, 17 pass / 16 fail, setup-clean) and DEC-188/189; a +1 lifecycle_version vs immutable
  definition version assertion added to the subject-A happy path (no existing check weakened); +1 total assertion (34 when run).

Helper dependencies (preserved 20261013300000-00700, read-only): cms_actor, cms_acting_party, cms_correlation, cms_valid_uuid,
cms_exact_keys, cms_reserve, cms_complete, cms_record_audit, cms_jcs_sha256, cms_entry_tenant_visible, cms_person_holds_capability,
identity_actor_person, cms_governed_subject_resolve, cms_governed_lock_graph, cms_governed_policy_basis, cms_governed_current_digest,
cms_governed_dependency_refs, cms_governed_review_resource, cms_governed_owner_capability, and the three version-table lifecycle guards.

## Correction round 2 (root review), 2026-10-13 - authoring proof

- (1) Authority fence. New exclusive supabase/migrations/20261013300790_cms_governed_authority_lock.sql (78 lines):
  platform_private.cms_lock_governed_authority(actor, acting_party, capability) FOR SHARE locks the submitter person,
  the acting-party membership tenure, the exact owner-capability (cms.template_designer / cms.taxonomy_curator) grant
  and the owner-initialization receipt, in that order. 00800 takes it BEFORE the subject FOR UPDATE, then re-proves the
  capability under the locks (capability_missing otherwise).
- (2) Replay seam. 00800 looks up an existing COMPLETED same-fingerprint idempotency row (actor, operation 'CMS-03C-06',
  cms_key_hash(key), digest(cms_request_hash(request) || uuid_send(acting_party))) AFTER visibility + capability and
  BEFORE the draft/live checks, returning the stored response only to a caller that still holds visibility and the
  capability; it never newly reserves here, and a revoked/hidden caller never receives the cached body. The reserve
  after the preconditions maps IDEMPOTENCY_MISMATCH to CONFLICT. QA 020-idempotency.sqlinc proves same-key/same-body
  identical + no new row, same-key/different-body CONFLICT + no new idempotency row.
- (3) subjectKind:null. 00800 now requires jsonb_typeof(subjectKind) = string and membership in the closed set BEFORE
  any concealment, so a null/absent kind is 400 INVALID_REQUEST; QA asserts it.
- (4) Kind branches. Taxonomy: 422 canonical_source_unavailable unless cms_canonical_domain_current(domain).provider_state
  = 'built' for EVERY declared canonicalDomain. Pattern: pattern_version_not_active unless every nested pattern is
  active, then the digest equality and every bound content type active. (Real pattern/taxonomy producer proof remains
  open; the fixture has no pattern/taxonomy subject.)
- (5) Lifecycle flag. 00800 saves the prior app.cms_governed_lifecycle and restores the EXACT value on success AND on
  exception (not a hard reset).

## Open

- Run 4 is SETUP-BLOCKED on controls 9-11; root's context-gate hypothesis is static and unverified. No further
  fixture fix, producer work, SQL run, or spec/production edit is authorized. Preserve all receipts and owned files.
- No GREEN, no migration, no spec/contract edit.
