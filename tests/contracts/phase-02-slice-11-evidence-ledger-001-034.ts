import type { EvidenceLedgerEntry } from './phase-02-evidence-ledger';

// Slice 11 evidence ledger fragment P2-S11-AC-001..034. Rules: see
// tests/contracts/phase-02-slice-11-evidence-ledger.ts and the guard tests/contracts/phase-02-slice-11-evidence-guard.test.ts.
export const S11_EVIDENCE_LEDGER_001_034: readonly EvidenceLedgerEntry[] = [
  {
    criterion: 'P2-S11-AC-001',
    text: 'Freeze revision hash and dependencies at review; enforce author/reviewer separation and protected-risk approval with recent MFA.',
    clauses: [
      {
        text: 'Freeze revision hash and dependencies at review',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-submit-contracts.apispec.ts',
            title:
              'CMS-03B-05 frozen submission and admission contracts [CMS-03B-05] freezes exact hashes, manifest, version set, policy and dependency rows with six atomic effect groups; fresh-evidence replay changes none',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-review-refusals.apispec.ts',
            title:
              'CMS-03B-05 refusals through the real stack [CMS-03B-05] a tampered manifest is 409 dependency_changed with the current dependency hash and a wrong frozenHash is 422 at /frozenHash',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_submit.sql',
            title:
              'the review is open at version 1 and freezes the revision hash, the dependency hash, the activation evidence and the strictest-of workflow policy evidence of the manifest [P2-S11-AC-005]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_submit.sql',
            title:
              'the ReviewDependency rows are exactly the (kind, ref_id) identities of the frozen manifest, written with the review [P2-S11-AC-113]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_submit.sql',
            title:
              'the row stores the server-derived submitter, owner, frozen hash, manifest, policy evidence and capability slots [P2-S11-AC-120]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_submit_refusals.sql',
            title:
              'a frozen hash that is not the stored payload hash is VALIDATION_FAILED at /frozenHash [P2-S11-AC-005]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_submit_refusals.sql',
            title:
              'a submitted manifest that differs from the rebuilt one in any member is 409 dependency_changed carrying only the CURRENT dependencyHash [P2-S11-AC-005]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_decision_invalidation.sql',
            title:
              'the review is invalidated (dependency_changed) at version 2 with no decidedAt, and the envelope names no review or reviewer [P2-S11-AC-111]',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-contracts.test.ts',
            title:
              '[P2-S10-AC-038] CMS-03B-05 frozenHash rejects a frozenHash that is not exactly 64 lowercase hex',
          },
        ],
      },
      {
        text: 'enforce author/reviewer separation',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_decision_refusals.sql',
            title:
              'the review submitter and the revision author are 403 separation_of_duties even with an effective assignment [P2-S11-AC-108]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_review_decisions_schema.sql',
            title:
              'decision: the review submitter never records its decision [P2-S11-AC-121]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_review_decisions_schema.sql',
            title:
              'decision: the author of the reviewed revision never records its decision [P2-S11-AC-121]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_assign_refusals.sql',
            title:
              'an absent, non-member, ungranted, publisher-only, submitter, revision-author, banned, shadow, lapsed, deactivated or ended-tenure reviewer is one byte-identical reviewer_not_eligible [P2-S11-AC-069]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-assignment-lifecycle.apispec.ts',
            title:
              'CMS-03B-18 assignment lifecycle [CMS-03B-18] absent nonmember ungranted and submitter reviewers share one exact eligibility refusal without effects',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-publish.apispec.ts',
            title:
              'CMS-03B-09 publish through the real stack [CMS-03B-09] the author of the revision may not publish it even with a standing publisher grant: 403 separation_of_duties and no effects',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_schedule_refusals.sql',
            title:
              'the human who authored the revision cannot schedule its publish (E11) [P2-S11-AC-107]',
          },
        ],
      },
      {
        text: 'protected-risk approval with recent MFA.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_submit.sql',
            title:
              'a protected policy freezes riskClass protected, two required decisions and the specialist slot from the manifest evidence [P2-S11-AC-120]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_decision.sql',
            title:
              'the specialist approves: the first unfilled specialist slot they hold is satisfied and the review is approved [P2-S11-AC-109]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_decision.sql',
            title:
              'a second base-only approve is refused specialist_slot_unsatisfiable (no approval left for the unfilled specialist slot) and changes nothing [P2-S11-AC-109]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_review_decisions_schema.sql',
            title:
              'decision: the specialist slot decision of a protected review is recorded, MFA 30 s ahead is inside the skew [P2-S11-AC-109]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_review_decisions_schema.sql',
            title:
              'decision: an MFA instant older than 600 s plus the 30 s skew is refused [P2-S11-AC-109]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_review_decisions_schema.sql',
            title:
              'decision: a decision without the binding MFA instant is refused [P2-S11-AC-121]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_decision_refusals.sql',
            title:
              'a stale, future, unverified or absent proof is STEP_UP_REQUIRED, ahead of concealment [P2-S11-AC-108]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-decision-contracts.apispec.ts',
            title:
              'CMS-03B-06 exact decision contracts [CMS-03B-06] none proof returns exact STEP_UP_REQUIRED recovery before any RPC or reservation',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-decision-contracts.apispec.ts',
            title:
              'CMS-03B-06 exact decision contracts [CMS-03B-06] stale proof returns exact STEP_UP_REQUIRED recovery before any RPC or reservation',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-decision-contracts.apispec.ts',
            title:
              'CMS-03B-06 exact decision contracts [CMS-03B-06] future proof returns exact STEP_UP_REQUIRED recovery before any RPC or reservation',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-contracts.test.ts',
            title:
              '[P2-S10-AC-040] CMS-03B-05 riskClass is server-derived requires the configured two-person workflow for protected policy evidence',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S11-AC-002',
    text: 'Resolve local schedule input to one UTC instant with IANA zone and tzdb version; reject gaps and ambiguous folds.',
    clauses: [
      {
        text: 'Resolve local schedule input to one UTC instant with IANA zone and tzdb version',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/time-authority/time-authority.test.ts',
            title:
              '[P2-S11-AC-103] the pinned time authority resolves a schedule through the verified snapshot',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/time-authority/schedule-time.test.ts',
            title:
              '[P2-S11-AC-104] Time authority steps 1-2: zone name and pinned version accepts canonical, link, three-segment and fixed-offset zone names',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/time-authority/schedule-time.test.ts',
            title:
              '[P2-S11-AC-104] Time authority steps 1-2: zone name and pinned version refuses another tz release with the pinned one, after the zone check',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/time-authority/schedule-time.test.ts',
            title:
              '[P2-S11-AC-104] Time authority steps 3-6: gaps, folds and disambiguation selects the smaller instant for earlier and the larger for later',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/time-authority/schedule-time.test.ts',
            title:
              '[P2-S11-AC-105] Time authority steps 7-8: the resolved instant and the horizon requires resolvedUtc to equal the selected instant, with the expected value in the refusal',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/time-authority/tzdb-zone.test.ts',
            title:
              '[P2-S11-AC-104] resolving a local time to the set of instants finds exactly one instant outside any change',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-schedule-time.apispec.ts',
            title:
              'CMS-03B-07 pinned time authority through the real stack [CMS-03B-07] a non-UTC zone and the earlier instant of a fold round-trip through the Worker time authority and the database sanity bounds',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-schedule-time.apispec.ts',
            title:
              'CMS-03B-07 pinned time authority through the real stack [CMS-03B-07] later fold persists the verified instant',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-schedule-time.apispec.ts',
            title:
              'CMS-03B-07 pinned time authority through the real stack [CMS-03B-07] three-segment zone persists the verified instant',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-schedule-time.apispec.ts',
            title:
              'CMS-03B-07 pinned time authority through the real stack [CMS-03B-07] negative twelve-hour edge persists the verified instant',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-schedule-time.apispec.ts',
            title:
              'CMS-03B-07 pinned time authority through the real stack [CMS-03B-07] positive fourteen-hour edge persists the verified instant',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-schedule-time.apispec.ts',
            title:
              'CMS-03B-07 pinned time authority through the real stack [CMS-03B-07] unknown zone returns exact safe time details and no effects',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-schedule-time.apispec.ts',
            title:
              'CMS-03B-07 pinned time authority through the real stack [CMS-03B-07] pinned tzdb mismatch returns exact safe time details and no effects',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-schedule-time.apispec.ts',
            title:
              'CMS-03B-07 pinned time authority through the real stack [CMS-03B-07] one nanosecond UTC mismatch is refused before any RPC',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-schedule.apispec.ts',
            title:
              'CMS-03B-07 schedule through the real stack [CMS-03B-07] accepts a future UTC schedule (202 scheduled, never published; Location; strong ETag) and a replay adds nothing',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_tzdb.sql',
            title:
              'it returns the pinned IANA release tag (DEC-153: 2026e) [P2-S11-AC-103]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_schedule_refusals.sql',
            title:
              'a tzdbVersion other than the pinned one is 422 tzdb_version_mismatch carrying the pinned value [P2-S11-AC-104]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_schedule_refusals.sql',
            title:
              'a local time more than 14 h after or 12 h before the resolved UTC (no real zone offset) is 422 resolved_utc_mismatch [P2-S11-AC-105]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-schedule-time.test.ts',
            title:
              'E8 refusals, in order 2: another tzdb release is tzdb_version_mismatch with the pinned release',
          },
        ],
      },
      {
        text: 'reject gaps',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/time-authority/schedule-time.test.ts',
            title:
              '[P2-S11-AC-104] Time authority steps 3-6: gaps, folds and disambiguation refuses a nonexistent local time with the earlier and later alternatives',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/time-authority/tzdb-zone.test.ts',
            title:
              '[P2-S11-AC-104] resolving a local time to the set of instants reports a spring-forward gap with the transition and both offsets',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-schedule-time.test.ts',
            title:
              'E8 refusals, in order 4: a spring-forward gap names both shifted alternatives',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-schedule-time.apispec.ts',
            title:
              'CMS-03B-07 pinned time authority through the real stack [CMS-03B-07] a nonexistent local time is the Worker 422 with its two alternatives and reaches no RPC',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-schedule-time.apispec.ts',
            title:
              'CMS-03B-07 pinned time authority through the real stack [CMS-03B-07] spring gap and unresolved fold expose exactly both pinned alternatives',
          },
        ],
      },
      {
        text: 'ambiguous folds.',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/time-authority/schedule-time.test.ts',
            title:
              '[P2-S11-AC-104] Time authority steps 3-6: gaps, folds and disambiguation refuses an ambiguous local time without a disambiguation, listing both instants',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/time-authority/tzdb-zone.test.ts',
            title:
              '[P2-S11-AC-104] resolving a local time to the set of instants reports a fall-back fold with the earlier and later instants',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-schedule-time.test.ts',
            title:
              'E8 refusals, in order 6: a fall-back fold without a choice names earlier then later',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-schedule-time.apispec.ts',
            title:
              'CMS-03B-07 pinned time authority through the real stack [CMS-03B-07] spring gap and unresolved fold expose exactly both pinned alternatives',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-schedule-time.apispec.ts',
            title:
              'CMS-03B-07 pinned time authority through the real stack [CMS-03B-07] a non-UTC zone and the earlier instant of a fold round-trip through the Worker time authority and the database sanity bounds',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S11-AC-003',
    text: 'Bind preview tokens to user, acting context, revision, full version set, audience, locale, route, expiry, and nonce; recheck every open.',
    clauses: [
      {
        text: 'Bind preview tokens to user, acting context',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_mint.sql',
            title:
              'the row holds the server-derived person, user and acting context, the capability snapshot (BE04c actingContextVersion), the exact binding, state active at version 1 and only the token SHA-256 [P2-S11-AC-118]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_mint.sql',
            title:
              "each token is bound to its own minting person and that person's capability snapshot [P2-S11-AC-118]",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_verify.sql',
            title:
              'a forwarded token presented by another person is the canonical denial, revoked false [P2-S11-AC-075]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_verify.sql',
            title:
              'another acting-context version is the canonical denial [P2-S11-AC-074]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_verify.sql',
            title:
              'the stored capability snapshot equals cms_acting_context_version of the minting person (BE04c actingContextVersion), and a minting person with no scope is denied [P2-S11-AC-118]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview-verifier.apispec.ts',
            title:
              'CMS-03B-19 production adapter over actual PostgREST [CMS-03B-19] forwarded actor has the complete identical null-detail denial and zero writes',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview-verifier.apispec.ts',
            title:
              'CMS-03B-19 production adapter over actual PostgREST [CMS-03B-19] acting context has the complete identical null-detail denial and zero writes',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview.apispec.ts',
            title:
              'CMS-03B-08 preview mint and the CMS-03B-19 verifier through the real stack [CMS-03B-08] mints a once-only token (201, no-store, no Location), replays it byte-identically and the verifier adapter accepts the bound binding',
          },
        ],
      },
      {
        text: 'revision, full version set',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_mint.sql',
            title:
              'the token is 43 unpadded base64url characters and the resource echoes the exact binding with revoked false [P2-S11-AC-117]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_mint.sql',
            title:
              'the token is the HMAC-SHA-256 of "cms.preview.token.v1" and the JCS { tokenId, nonce, entryId, revisionId } under the Vault key, recomputed by an independent oracle [P2-S11-AC-117]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_verify.sql',
            title:
              'the valid result carries the canonical person as userId, the entry and revision ids, the STORED VersionSet and the exact expiry [P2-S11-AC-073]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_mint_refusals.sql',
            title:
              'a version set that differs from the one recomputed from canonical state (schema hash, block ids, template, settings version) is 409 version_set_stale [P2-S11-AC-089]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_mint_refusals.sql',
            title:
              'a version set that is not an object, lacks a member or carries an unknown one is VALIDATION_FAILED at /versionSet [P2-S11-AC-024]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview-scopes.apispec.ts',
            title:
              'CMS-03B-08 scope and transport boundaries [CMS-03B-08] stale schemaHash is checked against canonical state without effects',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview-scopes.apispec.ts',
            title:
              'CMS-03B-08 scope and transport boundaries [CMS-03B-08] stale settingsVersion is checked against canonical state without effects',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview-scopes.apispec.ts',
            title:
              'CMS-03B-08 scope and transport boundaries [CMS-03B-08] stale taxonomyVersionIds is checked against canonical state without effects',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview-scopes.apispec.ts',
            title:
              'CMS-03B-08 scope and transport boundaries [CMS-03B-08] stale blockVersionIds is checked against canonical state without effects',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview-scopes.apispec.ts',
            title:
              'CMS-03B-08 scope and transport boundaries [CMS-03B-08] stale patternVersionIds is checked against canonical state without effects',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview-scopes.apispec.ts',
            title:
              'CMS-03B-08 scope and transport boundaries [CMS-03B-08] owner scope mints with exact binding, lifetime and three-group append delta',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview-verifier.apispec.ts',
            title:
              'CMS-03B-19 production adapter over actual PostgREST [CMS-03B-19] sends only the token hash and returns the complete bound resource without any writes',
          },
        ],
      },
      {
        text: 'audience, locale, route',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_verify.sql',
            title:
              'another route (case, trailing slash, prefix) is the canonical denial: the route must equal the minted one exactly [P2-S11-AC-074]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_verify.sql',
            title:
              'another locale (case variant or other language) is the canonical denial [P2-S11-AC-074]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_verify.sql',
            title: 'another audience is the canonical denial [P2-S11-AC-074]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_verify.sql',
            title:
              'route equality is on the exact code points: the NFC route verifies, its NFD spelling is the canonical denial [P2-S11-AC-074]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview-verifier.apispec.ts',
            title:
              'CMS-03B-19 production adapter over actual PostgREST [CMS-03B-19] route has the complete identical null-detail denial and zero writes',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview-verifier.apispec.ts',
            title:
              'CMS-03B-19 production adapter over actual PostgREST [CMS-03B-19] locale has the complete identical null-detail denial and zero writes',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview-verifier.apispec.ts',
            title:
              'CMS-03B-19 production adapter over actual PostgREST [CMS-03B-19] audience has the complete identical null-detail denial and zero writes',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview-scopes.apispec.ts',
            title:
              'CMS-03B-08 scope and transport boundaries [CMS-03B-08] query route has one exact safe violation and no mint effects',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview-scopes.apispec.ts',
            title:
              'CMS-03B-08 scope and transport boundaries [CMS-03B-08] uppercase audience has one exact safe violation and no mint effects',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_mint.sql',
            title:
              'the minted token verifies through cms_verify_preview_token for its person, acting-context version, route, locale and audience [P2-S11-AC-074]',
          },
        ],
      },
      {
        text: 'expiry, and nonce',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_mint.sql',
            title:
              'the token expires exactly 900 seconds after it was created and the resource reports that instant [P2-S11-AC-117]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_verify.sql',
            title:
              'an expired token (15 minutes 10 seconds old) is the canonical denial [P2-S11-AC-074]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_verify.sql',
            title:
              'a token with ten seconds of life left still verifies (the expiry is exact, not rounded) [P2-S11-AC-074]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_mint.sql',
            title:
              'a new Idempotency-Key mints a new token with a fresh nonce; both tokens stay valid until their own expiry [P2-S11-AC-117]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_mint.sql',
            title:
              'a replay after the token expired is the typed preview_expired (a new key mints a new token) [P2-S11-AC-117]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_preview_tokens_schema.sql',
            title: 'token: expiry and creation never move [P2-S11-AC-117]',
          },
        ],
      },
      {
        text: 'recheck every open.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_verify.sql',
            title:
              'a token whose minting person lost the entry assignment stops verifying although its row is still active: canonical denial, revoked false [P2-S11-AC-074]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_verify.sql',
            title:
              'a lapsed standing cms.author grant ends the minting scope: canonical denial (the acting-context version moved as well) [P2-S11-AC-074]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_verify.sql',
            title:
              'a token of an entry that left `active` is the canonical denial even before its row is revoked [P2-S11-AC-074]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_verify.sql',
            title:
              'a member with no preview scope on the entry cannot verify a row bound to them (scope is rechecked on every open) [P2-S11-AC-074]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_verify.sql',
            title:
              "revoking the reviewer assignment ends that reviewer's preview scope [P2-S11-AC-074]",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_verify.sql',
            title:
              'the verifier writes nothing: token rows (with their xmin), audit, outbox and idempotency are unchanged by valid and denied calls [P2-S11-AC-076]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_revoke.sql',
            title:
              'CMS-03B-19 answers valid false / revoked true for the bound owner of a revoked token [P2-S11-AC-118]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview-verifier.apispec.ts',
            title:
              'CMS-03B-19 production adapter over actual PostgREST [CMS-03B-19] sends only the token hash and returns the complete bound resource without any writes',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview-verifier.apispec.ts',
            title:
              'CMS-03B-19 production adapter over actual PostgREST [CMS-03B-19] acting context has the complete identical null-detail denial and zero writes',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S11-AC-004',
    text: 'Publish only after current revocation, accessibility, settings, schema, template, block, media, relation, route, locale, and privacy gates re-pass.',
    clauses: [
      {
        text: 'Publish only after current revocation',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_publish_refusals.sql',
            title:
              'a counted approver whose standing cms.reviewer grant lapsed fails the revocation category: 422 preflight_failed (reviewer_authority_changed) [P2-S11-AC-096]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_preflight.sql',
            title:
              'publish: the same lapse fails the publish phase [P2-S11-AC-110]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_preflight.sql',
            title:
              'publish: a caller with no cms.publisher grant fails publisher_authority_ended [P2-S11-AC-096]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_preflight.sql',
            title:
              'publish phase with a current publisher passes [P2-S11-AC-096]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_publish.sql',
            title:
              'the owner-party publisher publishes an approved revision [P2-S11-AC-029]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_publication_lineage_schema.sql',
            title:
              'lineage: a publish row is not appended for an entry that is no longer active [P2-S11-AC-114]',
          },
        ],
      },
      {
        text: 'accessibility',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_publish_refusals.sql',
            title:
              'absent evidence and a failed checker run make accessibility unavailable: 503 DEPENDENCY_UNAVAILABLE with dependencyClass preflight [P2-S11-AC-097]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_publish_refusals.sql',
            title:
              'a blocked checker run is a failed accessibility category (blocking_finding): 422 preflight_failed [P2-S11-AC-101]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_publish_refusals.sql',
            title:
              'evidence older than 60 s or from another provider version is 409 preflight_evidence_stale; evidence bound to other rows is 409 dependency_changed with the current hash [P2-S11-AC-102]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-publish.apispec.ts',
            title:
              'CMS-03B-09 publish through the real stack [CMS-03B-09] an unavailable accessibility proof is 503 DEPENDENCY_UNAVAILABLE with Retry-After and nothing is committed',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-publish-preflight.apispec.ts',
            title:
              'CMS-03B-09 publication admission and preflight composition [CMS-03B-09] healthy Worker evidence is bound to the approved revision and real publish command',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-publish-preflight.apispec.ts',
            title:
              'CMS-03B-09 publication admission and preflight composition [CMS-03B-09] failed input load sends an own null proof and a strict preflight refusal without effects',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-quality-gate.test.ts',
            title:
              'the composed browser gate returns blocked evidence for a revision with a blocking finding',
          },
        ],
      },
      {
        text: 'settings, schema',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_publish_refusals.sql',
            title:
              'an expectedVersionSet that is not exactly the version set frozen on the approved review (schema, settings or taxonomy member) is 409 version_set_stale [P2-S11-AC-033]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-publish.apispec.ts',
            title:
              'CMS-03B-09 publish through the real stack [CMS-03B-09] a stale expected version set is 409 version_set_stale and a wrong frozenHash is 422 at /frozenHash',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_publish_refusals.sql',
            title:
              'a stale frozen manifest returns the committed-refusal envelope {kind, reasonCode, details} carrying only the CURRENT dependencyHash [P2-S11-AC-033]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-publish.apispec.ts',
            title:
              'CMS-03B-09 publish through the real stack [CMS-03B-09] a stale frozen manifest is the COMMITTED refusal: HTTP 200 on the wire, 409 dependency_changed with the current hash for the browser, the review stays invalidated and a replay answers the same 409',
          },
        ],
      },
      {
        text: 'template, block',
        citations: [],
      },
      {
        text: 'media',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_publish_refusals.sql',
            title:
              'a failed category refuses 422 preflight_failed; the DETAIL lists all 17 {category, outcome, reasonCode} entries and nothing else [P2-S11-AC-097]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_preflight.sql',
            title:
              'a non-empty media value fails the media gate [P2-S11-AC-094]',
          },
        ],
      },
      {
        text: 'relation, route, locale, and privacy gates re-pass.',
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Publish-phase refusal through cms_publish_revision is exercised only for revocation, accessibility, media and the version-set/manifest equality checks. The template and block gates, and the relation, route, locale and privacy gates, are proven failing only through the shared evaluator in the submit phase (supabase/tests/phase_02_slice_11_helpers_preflight.sql); no test drives the publish (or schedule) command, or the evaluator with phase publish, with a withdrawn block, inactive template, unavailable relation target, internal route link, no_fallback locale field or held entry, so those clauses are uncited. Settings and schema are cited through the version-set equality check, not through the preflight categories at publish phase.',
  },
  {
    criterion: 'P2-S11-AC-005',
    text: 'CMS-03B-05: define strict Zod request, path, query, header, and success contracts and complete the declared happy path — CMS-03B-05 — CMS-08 — POST /api/v1/cms/entries/{entryId}/reviews — ReviewSubmissionRequest → 201 EditorialReviewResource.',
    clauses: [
      {
        text: 'CMS-03B-05: define strict Zod request, path, query, header, and success contracts',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/workflow-requests.test.ts',
            title:
              '[P2-S11-AC-005][P2-S11-AC-011][P2-S11-AC-017][P2-S11-AC-023][P2-S11-AC-029] transport views for the five Slice 11 commands binds the path id, the command headers and the exact request body for each command',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/workflow-requests.test.ts',
            title:
              '[P2-S11-AC-005][P2-S11-AC-011][P2-S11-AC-017][P2-S11-AC-023][P2-S11-AC-029] transport views for the five Slice 11 commands rejects an unknown member, a missing header block and a malformed body',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/workflow-requests.test.ts',
            title:
              '[P2-S11-AC-005][P2-S11-AC-011][P2-S11-AC-017][P2-S11-AC-023][P2-S11-AC-029] transport views for the five Slice 11 commands keeps the body strict: a caller capability, MFA instant or risk class is an unknown key',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-contracts.test.ts',
            title:
              '[P2-S10-AC-038] CMS-03B-05 frozenHash rejects a frozenHash that is not exactly 64 lowercase hex',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-contracts.test.ts',
            title:
              '[P2-S10-AC-039] CMS-03B-05 dependencyManifest bounds rejects unknown manifest keys',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-contracts.test.ts',
            title:
              '[P2-S10-AC-040] CMS-03B-05 riskClass is server-derived rejects caller-supplied riskClass as an unknown key',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-contracts.test.ts',
            title:
              'CMS-03B-05/06/07/08/09 path and header transports binds the exact review submission path parameters and headers',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/workflow-resources.test.ts',
            title:
              '[P2-S11-AC-005][P2-S11-AC-011] EditorialReviewResource (CMS-03B-05, CMS-03B-06) rejects unknown keys, including any ownership or authority identifier',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/workflow-resources.test.ts',
            title:
              '[P2-S11-AC-005][P2-S11-AC-011] EditorialReviewResource (CMS-03B-05, CMS-03B-06) requires every member and the exact closed state',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/routes-slice11.test.ts',
            title:
              '[P2-S11-AC-005][P2-S11-AC-008] CMS-03B-05 submit review row binds the submission contracts, 201, a strong review ETag and Location',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-admission.test.ts',
            title:
              'BE00 step 6: strict query, path and body refuses any query string on a command CMS-03B-05',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-admission.test.ts',
            title:
              'BE00 step 6: strict query, path and body refuses an unknown body member as 422 with a stable pointer CMS-03B-05',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_submit.sql',
            title:
              'the response is exactly EditorialReviewResource (17 members) [P2-S11-AC-005]',
          },
        ],
      },
      {
        text: 'complete the declared happy path — CMS-03B-05 — CMS-08 — POST /api/v1/cms/entries/{entryId}/reviews — ReviewSubmissionRequest → 201 EditorialReviewResource.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-review-chain.apispec.ts',
            title:
              'CMS-03B-15 -> 05 -> 18 -> 06 -> 16 -> 17 through the real stack [CMS-03B-05] submit freezes the preparation into an open review (201, Location, strong ETag) exactly once',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-submit-contracts.apispec.ts',
            title:
              'CMS-03B-05 frozen submission and admission contracts [CMS-03B-05] reference-free preparation passes every submit category in exact registry order and commits through the real command',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-submit-contracts.apispec.ts',
            title:
              'CMS-03B-05 frozen submission and admission contracts [CMS-03B-05] freezes exact hashes, manifest, version set, policy and dependency rows with six atomic effect groups; fresh-evidence replay changes none',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_submit.sql',
            title:
              'an entry assignee freezes the current draft revision for review [P2-S11-AC-005]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_submit.sql',
            title:
              'the review is open at version 1 and freezes the revision hash, the dependency hash, the activation evidence and the strictest-of workflow policy evidence of the manifest [P2-S11-AC-005]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-admission.test.ts',
            title:
              'registers every browser command at its registry path success envelope CMS-03B-05',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S11-AC-006',
    text: 'CMS-03B-05: reject unknown fields and every invalid request value with the exact stable field violation, safe message, and no state mutation.',
    clauses: [
      {
        text: 'CMS-03B-05: reject unknown fields',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-admission.test.ts',
            title:
              'BE00 step 6: strict query, path and body refuses an unknown body member as 422 with a stable pointer CMS-03B-05',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-submit-contracts.apispec.ts',
            title:
              'CMS-03B-05 frozen submission and admission contracts [CMS-03B-05] forged-evidence is refused before RPC and before every durable effect',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/workflow-requests.test.ts',
            title:
              '[P2-S11-AC-005][P2-S11-AC-011][P2-S11-AC-017][P2-S11-AC-023][P2-S11-AC-029] transport views for the five Slice 11 commands keeps the body strict: a caller capability, MFA instant or risk class is an unknown key',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_submit_refusals.sql',
            title:
              'a caller riskClass or owner, a missing member, a malformed id and an If-Match that disagrees with the entry version are INVALID_REQUEST [P2-S11-AC-006]',
          },
        ],
      },
      {
        text: 'every invalid request value with the exact stable field violation, safe message',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-submit-contracts.apispec.ts',
            title:
              'CMS-03B-05 frozen submission and admission contracts [CMS-03B-05] json is refused before RPC and before every durable effect',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-submit-contracts.apispec.ts',
            title:
              'CMS-03B-05 frozen submission and admission contracts [CMS-03B-05] media is refused before RPC and before every durable effect',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-submit-contracts.apispec.ts',
            title:
              'CMS-03B-05 frozen submission and admission contracts [CMS-03B-05] weak-etag is refused before RPC and before every durable effect',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-submit-contracts.apispec.ts',
            title:
              'CMS-03B-05 frozen submission and admission contracts [CMS-03B-05] missing-key is refused before RPC and before every durable effect',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-submit-contracts.apispec.ts',
            title:
              'CMS-03B-05 frozen submission and admission contracts [CMS-03B-05] path-body is refused before RPC and before every durable effect',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-review-refusals.apispec.ts',
            title:
              'CMS-03B-05 refusals through the real stack [CMS-03B-05] a tampered manifest is 409 dependency_changed with the current dependency hash and a wrong frozenHash is 422 at /frozenHash',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_submit_refusals.sql',
            title:
              'a non-lowercase-hex hash, a non-object or over-bound manifest and a non-decimal version are VALIDATION_FAILED at their pointer [P2-S11-AC-006]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-admission.test.ts',
            title:
              'BE00 step 6: strict query, path and body refuses a path identifier that is not a UUID as 400 CMS-03B-05',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-admission.test.ts',
            title:
              'BE00 step 6: strict query, path and body refuses a body identifier that disagrees with the path as 422 CMS-03B-05',
          },
        ],
      },
      {
        text: 'no state mutation.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-submit-contracts.apispec.ts',
            title:
              'CMS-03B-05 frozen submission and admission contracts [CMS-03B-05] forged-evidence is refused before RPC and before every durable effect',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-submit-contracts.apispec.ts',
            title:
              'CMS-03B-05 frozen submission and admission contracts [CMS-03B-05] path-body is refused before RPC and before every durable effect',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-review-refusals.apispec.ts',
            title:
              'CMS-03B-05 refusals through the real stack [CMS-03B-05] a tampered manifest is 409 dependency_changed with the current dependency hash and a wrong frozenHash is 422 at /frozenHash',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_submit_refusals.sql',
            title:
              'every refusal above left no review, dependency row, reservation, audit record or outbox event behind [P2-S11-AC-009]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S11-AC-007',
    text: 'CMS-03B-05: derive actor and acting context server-side; enforce principal, capability, ownership, scope, and RLS with the specified 401, 403, and 404 boundary.',
    clauses: [
      {
        text: 'CMS-03B-05: derive actor and acting context server-side',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-submit-contracts.apispec.ts',
            title:
              'CMS-03B-05 frozen submission and admission contracts [CMS-03B-05] freezes exact hashes, manifest, version set, policy and dependency rows with six atomic effect groups; fresh-evidence replay changes none',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-admission.test.ts',
            title:
              'registers every browser command at its registry path hands the port the validated input and the server-derived session CMS-03B-05',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-workflow.test.ts',
            title:
              'commands bind the named RPC with a server-built request CMS-03B-05',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_submit.sql',
            title:
              'the row stores the server-derived submitter, owner, frozen hash, manifest, policy evidence and capability slots [P2-S11-AC-120]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_submit.sql',
            title:
              'an editor assigned with cms.editor may submit; the submitter identity stays server-side [P2-S11-AC-007]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_submit_refusals.sql',
            title:
              'a caller riskClass or owner, a missing member, a malformed id and an If-Match that disagrees with the entry version are INVALID_REQUEST [P2-S11-AC-006]',
          },
        ],
      },
      {
        text: 'enforce principal, capability, ownership, scope, and RLS',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-submit-contracts.apispec.ts',
            title:
              'CMS-03B-05 frozen submission and admission contracts [CMS-03B-05] anonymous is refused before RPC and before every durable effect',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-admission.test.ts',
            title:
              'BE00 steps 4 and 5: session answers an unauthenticated caller 401 before any port CMS-03B-05',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-review-refusals.apispec.ts',
            title:
              'CMS-03B-05 refusals through the real stack [CMS-03B-05] a session without an author capability is 403 at the Worker; one claiming it without the database grant is capability_missing from the database',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-quota.test.ts',
            title:
              'BE00 step 7: capability, step-up and quota refuses a session without the registry capability with capability_missing CMS-03B-05',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_submit_refusals.sql',
            title:
              'a visible entry with no assignment is 403 capability_missing [P2-S11-AC-007]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_submit_refusals.sql',
            title:
              "a deactivated cms.author grant revokes the creator's assignments (DEC-143) and the submit is 403 capability_missing [P2-S11-AC-007]",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_submit_refusals.sql',
            title:
              'a non-member, an absent entry, another acting party, a revision of another entry and an absent revision are one indistinguishable NOT_FOUND [P2-S11-AC-007]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_submit_evidence_replay.sql',
            title:
              'another assignee reusing the key and the body does not receive the stored response: the reservation is per actor, so the live review is re-proved [P2-S11-AC-007]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_submit_evidence_replay.sql',
            title:
              'the same actor and key under another acting party is NOT_FOUND: the acting-party boundary is re-proved before the reservation, so no response is replayed across parties [P2-S11-AC-007]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_schema_posture.sql',
            title:
              'posture: row-level security is enabled and forced on every Slice 11 table [P2-S11-AC-119]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_schema_posture.sql',
            title:
              'posture: anon, authenticated and service_role hold no privilege on any Slice 11 table [P2-S11-AC-119]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_submit.sql',
            title:
              'cms_submit_review is a private SECURITY DEFINER of the CMS definer (empty search_path) that no API role, service_role included, can execute [P2-S11-AC-010]',
          },
        ],
      },
      {
        text: 'with the specified 401, 403, and 404 boundary.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-submit-contracts.apispec.ts',
            title:
              'CMS-03B-05 frozen submission and admission contracts [CMS-03B-05] anonymous is refused before RPC and before every durable effect',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-review-refusals.apispec.ts',
            title:
              'CMS-03B-05 refusals through the real stack [CMS-03B-05] a session without an author capability is 403 at the Worker; one claiming it without the database grant is capability_missing from the database',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-submit-contracts.apispec.ts',
            title:
              'CMS-03B-05 frozen submission and admission contracts [CMS-03B-05] a nonmember target and absent entry have identical safe 404 semantics with their own request identities',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_submit_refusals.sql',
            title:
              'a non-member, an absent entry, another acting party, a revision of another entry and an absent revision are one indistinguishable NOT_FOUND [P2-S11-AC-007]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_submit_refusals.sql',
            title:
              'a visible entry with no assignment is 403 capability_missing [P2-S11-AC-007]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S11-AC-008',
    text: 'CMS-03B-05: enforce declared idempotency, If-Match or CAS, duplicate, replay, pagination, cache, rate, deadline, and concurrency rules.',
    clauses: [
      {
        text: 'CMS-03B-05: enforce declared idempotency',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-submit-contracts.apispec.ts',
            title:
              'CMS-03B-05 frozen submission and admission contracts [CMS-03B-05] completed idempotency binds frozenHash and retains all fourteen effect fingerprints',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-submit-contracts.apispec.ts',
            title:
              'CMS-03B-05 frozen submission and admission contracts [CMS-03B-05] completed idempotency binds dependencyManifest and retains all fourteen effect fingerprints',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-submit-contracts.apispec.ts',
            title:
              'CMS-03B-05 frozen submission and admission contracts [CMS-03B-05] completed idempotency binds version and retains all fourteen effect fingerprints',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-submit-contracts.apispec.ts',
            title:
              'CMS-03B-05 frozen submission and admission contracts [CMS-03B-05] completed idempotency binds path and retains all fourteen effect fingerprints',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-submit-contracts.apispec.ts',
            title:
              'CMS-03B-05 frozen submission and admission contracts [CMS-03B-05] missing-key is refused before RPC and before every durable effect',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_submit.sql',
            title:
              'the idempotency reservation is completed with the command [P2-S11-AC-008]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_submit.sql',
            title:
              'the same key with a changed request is IDEMPOTENCY_MISMATCH [P2-S11-AC-008]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_submit_evidence_replay.sql',
            title:
              'a same-key retry whose only change is the freshly rebuilt Worker evidence replays the stored response instead of a spurious 409 IDEMPOTENCY_MISMATCH [P2-S11-AC-008]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-quota.test.ts',
            title:
              'BE00 step 8: Idempotency-Key and strong If-Match requires a printable Idempotency-Key CMS-03B-05',
          },
        ],
      },
      {
        text: 'If-Match or CAS',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-review-refusals.apispec.ts',
            title:
              'CMS-03B-05 refusals through the real stack [CMS-03B-05] a stale entry version is 409 VERSION_MISMATCH carrying only the expected and current versions',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-submit-contracts.apispec.ts',
            title:
              'CMS-03B-05 frozen submission and admission contracts [CMS-03B-05] weak-etag is refused before RPC and before every durable effect',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_submit_refusals.sql',
            title:
              'a stale entry version is VERSION_MISMATCH with the expected and current versions [P2-S11-AC-008]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-quota.test.ts',
            title:
              'BE00 step 8: Idempotency-Key and strong If-Match requires an exact strong If-Match CMS-03B-05',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-submit-contracts.apispec.ts',
            title:
              'CMS-03B-05 frozen submission and admission contracts [CMS-03B-05] superseded revisions refuse revision_not_submittable using the current entry operand',
          },
        ],
      },
      {
        text: 'duplicate, replay',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-review-refusals.apispec.ts',
            title:
              'CMS-03B-05 refusals through the real stack [CMS-03B-05] a second submission of an under-review revision is 409 revision_not_submittable',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-submit-contracts.apispec.ts',
            title:
              'CMS-03B-05 frozen submission and admission contracts [CMS-03B-05] freezes exact hashes, manifest, version set, policy and dependency rows with six atomic effect groups; fresh-evidence replay changes none',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-review-chain.apispec.ts',
            title:
              'CMS-03B-15 -> 05 -> 18 -> 06 -> 16 -> 17 through the real stack [CMS-03B-05] submit freezes the preparation into an open review (201, Location, strong ETag) exactly once',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_submit.sql',
            title:
              'an exact replay returns the stored response although the revision is now under review, and adds no second review, dependency, audit record or event [P2-S11-AC-008]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_submit_refusals.sql',
            title:
              'a superseded revision and a revision under an open, approved or rejected review are 409 revision_not_submittable [P2-S11-AC-005]',
          },
        ],
      },
      {
        text: 'pagination, cache',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-admission.test.ts',
            title:
              'BE00 step 6: strict query, path and body refuses any query string on a command CMS-03B-05',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-admission.test.ts',
            title:
              'registers every browser command at its registry path success envelope CMS-03B-05',
          },
        ],
      },
      {
        text: 'rate, deadline',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-quota.test.ts',
            title:
              'BE00 step 7: capability, step-up and quota enforces the user and party buckets from the registry row CMS-03B-05',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-quota.test.ts',
            title:
              'BE00 step 7: capability, step-up and quota answers an exhausted bucket 429 with the rate headers CMS-03B-05',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-quota.test.ts',
            title:
              'port boundary is 504 when the port outlives the route deadline CMS-03B-05',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-workflow.test.ts',
            title:
              'transport constants follow the registry names an RPC, deadline, quota and rate class equal to each registry row',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/routes-slice11.test.ts',
            title:
              '[P2-S11-AC-005][P2-S11-AC-008] CMS-03B-05 submit review row limits 30/60 per minute in the review class, 15 s, Tier 2',
          },
        ],
      },
      {
        text: 'concurrency rules.',
        citations: [
          {
            tool: 'race',
            file: 'supabase/tests/phase_02_slice_11_races/012-review-submit-race.mjs',
            title: 'C1: one open review, its dependency rows and one event',
          },
          {
            tool: 'race',
            file: 'supabase/tests/phase_02_slice_11_races/012-review-submit-race.mjs',
            title: 'C2: one review and one event (the duplicate replayed)',
          },
          {
            tool: 'race',
            file: 'supabase/tests/phase_02_slice_11_races/012-review-submit-race.mjs',
            title:
              'C3: a revision append BLOCKS behind a submit parked after taking the entry row FOR SHARE (a review never freezes a draft superseded in between)',
          },
          {
            tool: 'race',
            file: 'supabase/tests/phase_02_slice_11_races/012-review-submit-race.mjs',
            title:
              'C4: a submit BLOCKS behind an append holding the entry row FOR UPDATE',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_submit_refusals.sql',
            title:
              'a stale entry version is VERSION_MISMATCH with the expected and current versions [P2-S11-AC-008]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S11-AC-009',
    text: 'CMS-03B-05: map every declared domain, dependency, timeout, rate, and internal failure to typed ApiError and preserve safe recovery.',
    clauses: [
      {
        text: 'CMS-03B-05: map every declared domain',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-review-refusals.apispec.ts',
            title:
              'CMS-03B-05 refusals through the real stack [CMS-03B-05] a second submission of an under-review revision is 409 revision_not_submittable',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-review-refusals.apispec.ts',
            title:
              'CMS-03B-05 refusals through the real stack [CMS-03B-05] a stale entry version is 409 VERSION_MISMATCH carrying only the expected and current versions',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-review-refusals.apispec.ts',
            title:
              'CMS-03B-05 refusals through the real stack [CMS-03B-05] a tampered manifest is 409 dependency_changed with the current dependency hash and a wrong frozenHash is 422 at /frozenHash',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-review-refusals.apispec.ts',
            title:
              'CMS-03B-05 refusals through the real stack [CMS-03B-05] an archived entry fails the revocation preflight category: preflight_failed with the 17-entry report and no review',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-review-refusals.apispec.ts',
            title:
              'CMS-03B-05 refusals through the real stack [CMS-03B-05] a session without an author capability is 403 at the Worker; one claiming it without the database grant is capability_missing from the database',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-workflow-refusals.test.ts',
            title:
              'typed refusals the database raises 409 dependency_changed with the hash, and a stale operand with safe versions',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/refusals.test.ts',
            title:
              '[P2-S11-AC-009][P2-S11-AC-021][P2-S11-AC-027][P2-S11-AC-033] closed Slice 11 reason catalog names for each browser operation exactly the ordered tokens its matrix row allows',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_submit_refusals.sql',
            title:
              'a failed category refuses 422 preflight_failed; the DETAIL lists all 17 {category, outcome, reasonCode} entries and nothing else [P2-S11-AC-097]',
          },
        ],
      },
      {
        text: 'dependency',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-submit-contracts.apispec.ts',
            title:
              'CMS-03B-05 frozen submission and admission contracts [CMS-03B-05] command transport outage is exact retryable 503 with numeric retry and rate headers, no effects',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-review-refusals.apispec.ts',
            title:
              'CMS-03B-05 refusals through the real stack [CMS-03B-05] an unavailable accessibility proof is 503 DEPENDENCY_UNAVAILABLE with Retry-After and no review',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-quota.test.ts',
            title:
              'port boundary is 503 when the port is not composed CMS-03B-05',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-quota.test.ts',
            title:
              'BE00 step 7: capability, step-up and quota passes a quota dependency failure through as its typed refusal CMS-03B-05',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_submit_refusals.sql',
            title:
              'absent evidence and a failed checker run make accessibility unavailable: 503 DEPENDENCY_UNAVAILABLE with dependencyClass preflight (DEC-159: the Worker adds retryable) [P2-S11-AC-097]',
          },
        ],
      },
      {
        text: 'timeout',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-quota.test.ts',
            title:
              'port boundary is 504 when the port outlives the route deadline CMS-03B-05',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-operations.test.ts',
            title:
              'accessibility proof (CMS-03B-05, -07, -09) answers a gate that outlives the route deadline as a gateway timeout',
          },
        ],
      },
      {
        text: 'rate',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-quota.test.ts',
            title:
              'BE00 step 7: capability, step-up and quota answers an exhausted bucket 429 with the rate headers CMS-03B-05',
          },
        ],
      },
      {
        text: 'internal failure to typed ApiError',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-quota.test.ts',
            title:
              'port boundary is 502 when the success payload breaks the resource contract CMS-03B-05',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-workflow-refusals.test.ts',
            title:
              'typed refusals the database raises drops a token the operation does not register and an unregistered raise',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-errors-typed.test.ts',
            title:
              'transport statuses publishes the canonical 502, 504 and 500 envelopes',
          },
        ],
      },
      {
        text: 'preserve safe recovery.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-submit-contracts.apispec.ts',
            title:
              'CMS-03B-05 frozen submission and admission contracts [CMS-03B-05] command transport outage is exact retryable 503 with numeric retry and rate headers, no effects',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-review-refusals.apispec.ts',
            title:
              'CMS-03B-05 refusals through the real stack [CMS-03B-05] a stale entry version is 409 VERSION_MISMATCH carrying only the expected and current versions',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-errors.test.ts',
            title:
              '409 projection drops malformed versions and defaults the recovery to reload',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-errors.test.ts',
            title:
              '409 projection requires the dependency hash for dependency_changed and publishes only that member',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-errors-typed.test.ts',
            title:
              'transport statuses publishes the registered preflight unavailability',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-quota.test.ts',
            title:
              'port boundary projects a typed port refusal through the operation boundary CMS-03B-05',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_submit_refusals.sql',
            title:
              'every refusal above left no review, dependency row, reservation, audit record or outbox event behind [P2-S11-AC-009]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S11-AC-010',
    text: 'CMS-03B-05: commit audit and outbox effects atomically where applicable, reconcile lost responses without duplicate effects, and emit redacted telemetry.',
    clauses: [
      {
        text: 'CMS-03B-05: commit audit and outbox effects atomically where applicable',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-submit-contracts.apispec.ts',
            title:
              'CMS-03B-05 frozen submission and admission contracts [CMS-03B-05] freezes exact hashes, manifest, version set, policy and dependency rows with six atomic effect groups; fresh-evidence replay changes none',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_submit.sql',
            title:
              'exactly one audit record and one identifier-only cms.entry.review-changed.v1 commit with the review [P2-S11-AC-010]',
          },
          {
            tool: 'race',
            file: 'supabase/tests/phase_02_slice_11_races/012-review-submit-race.mjs',
            title: 'C1: one open review, its dependency rows and one event',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_submit_refusals.sql',
            title:
              'every refusal above left no review, dependency row, reservation, audit record or outbox event behind [P2-S11-AC-009]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-review-refusals.apispec.ts',
            title:
              'CMS-03B-05 refusals through the real stack [CMS-03B-05] an archived entry fails the revocation preflight category: preflight_failed with the 17-entry report and no review',
          },
        ],
      },
      {
        text: 'reconcile lost responses without duplicate effects',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-submit-contracts.apispec.ts',
            title:
              'CMS-03B-05 frozen submission and admission contracts [CMS-03B-05] freezes exact hashes, manifest, version set, policy and dependency rows with six atomic effect groups; fresh-evidence replay changes none',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_submit.sql',
            title:
              'an exact replay returns the stored response although the revision is now under review, and adds no second review, dependency, audit record or event [P2-S11-AC-008]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_submit_evidence_replay.sql',
            title:
              'the evidence-only retry left every relevant row byte-identical: the nine-table {count, full-row sha256} digest is unchanged, so no review, dependency, decision, assignment, settings snapshot, idempotency reservation (including its request_hash bytes and response_ref), audit record or outbox event of any name was added or rewritten [P2-S11-AC-008]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-review-chain.apispec.ts',
            title:
              'CMS-03B-15 -> 05 -> 18 -> 06 -> 16 -> 17 through the real stack [CMS-03B-05] submit freezes the preparation into an open review (201, Location, strong ETag) exactly once',
          },
          {
            tool: 'race',
            file: 'supabase/tests/phase_02_slice_11_races/012-review-submit-race.mjs',
            title: 'C2: one review and one event (the duplicate replayed)',
          },
        ],
      },
      {
        text: 'emit redacted telemetry.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-facts.test.ts',
            title:
              'telemetry logs one redacted event with closed labels and the hashed entry',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-telemetry.test.ts',
            title:
              'review metrics counts a submitted review by risk class and outcome',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-workflow-telemetry.test.ts',
            title:
              'Slice 11 telemetry classes CMS-03B-05 writes the command, rpc and acceptance events',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-workflow-logging.test.ts',
            title:
              'route telemetry through the production sink writes every command and read event without a single rejected event',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S11-AC-011',
    text: 'CMS-03B-06: define strict Zod request, path, query, header, and success contracts and complete the declared happy path — CMS-03B-06 — CMS-08 — POST /api/v1/cms/reviews/{reviewId}/decision — EditorialDecisionRequest → 200 EditorialReviewResource.',
    clauses: [
      {
        text: 'CMS-03B-06: define strict Zod request, path, query, header, and success contracts',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/workflow-requests.test.ts',
            title:
              '[P2-S11-AC-011] CMS-03B-06 decision headers requires JSON, a printable key of 8-128 characters and a quoted strong version',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/workflow-requests.test.ts',
            title:
              '[P2-S11-AC-005][P2-S11-AC-011][P2-S11-AC-017][P2-S11-AC-023][P2-S11-AC-029] transport views for the five Slice 11 commands binds the path id, the command headers and the exact request body for each command',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/workflow-requests.test.ts',
            title:
              '[P2-S11-AC-005][P2-S11-AC-011][P2-S11-AC-017][P2-S11-AC-023][P2-S11-AC-029] transport views for the five Slice 11 commands keeps the body strict: a caller capability, MFA instant or risk class is an unknown key',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-contracts.test.ts',
            title:
              '[P2-S10-AC-041] CMS-03B-06 decision/reason rejects closed decision verbs and empty or oversized reasons',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-contracts.test.ts',
            title:
              '[P2-S10-AC-042] CMS-03B-06 stepUpAt/capability are server-derived rejects caller-supplied stepUpAt and capability as unknown keys',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-contracts.test.ts',
            title:
              'CMS-03B-05/06/07/08/09 path and header transports binds the decision path parameter',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/workflow-resources.test.ts',
            title:
              '[P2-S11-AC-005][P2-S11-AC-011] EditorialReviewResource (CMS-03B-05, CMS-03B-06) rejects unknown keys, including any ownership or authority identifier',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/routes-slice11.test.ts',
            title:
              '[P2-S11-AC-011][P2-S11-AC-014] CMS-03B-06 decision row binds the decision contracts, 200 on the existing review and no Location',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-11-openapi-refinements.test.ts',
            title:
              '[P2-S11-AC-011] decision reason publishes 2000 code points, NFC and its forbidden characters agrees with the runtime over limits, normalization, control and bidi characters and markup',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-admission.test.ts',
            title:
              'BE00 step 6: strict query, path and body refuses any query string on a command CMS-03B-06',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-admission.test.ts',
            title:
              'BE00 step 6: strict query, path and body refuses an unknown body member as 422 with a stable pointer CMS-03B-06',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_decision.sql',
            title:
              'the response is exactly EditorialReviewResource (17 members) [P2-S11-AC-011]',
          },
        ],
      },
      {
        text: 'complete the declared happy path — CMS-03B-06 — CMS-08 — POST /api/v1/cms/reviews/{reviewId}/decision — EditorialDecisionRequest → 200 EditorialReviewResource.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-review-chain.apispec.ts',
            title:
              'CMS-03B-15 -> 05 -> 18 -> 06 -> 16 -> 17 through the real stack [CMS-03B-06] the assigned reviewer approves with a fresh step-up (200, review version + 1) and a replay adds nothing',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-decision-policy.apispec.ts',
            title:
              'CMS-03B-06 ordinary decision policy and persistence [CMS-03B-06] approve appends one assignment-bound decision with exact policy, count, privacy and atomic effects; replay is inert',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-decision-policy.apispec.ts',
            title:
              'CMS-03B-06 ordinary decision policy and persistence [CMS-03B-06] reject appends one assignment-bound decision with exact policy, count, privacy and atomic effects; replay is inert',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_decision.sql',
            title:
              'the assigned reviewer approves an open review [P2-S11-AC-011]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_decision.sql',
            title:
              'the single required approve reaches approved at version 2 with decidedAt set and the frozen policy evidence [P2-S11-AC-109]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_decision.sql',
            title:
              'a reject sets the review rejected immediately and terminally at version 2 [P2-S11-AC-109]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-admission.test.ts',
            title:
              'registers every browser command at its registry path success envelope CMS-03B-06',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S11-AC-012',
    text: 'CMS-03B-06: reject unknown fields and every invalid request value with the exact stable field violation, safe message, and no state mutation.',
    clauses: [
      {
        text: 'CMS-03B-06: reject unknown fields',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-decision-refusals.apispec.ts',
            title:
              'CMS-03B-06 refusals through the real stack [CMS-03B-06] caller-capability admission refuses before RPC and leaves all durable groups unchanged',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-admission.test.ts',
            title:
              'BE00 step 6: strict query, path and body refuses an unknown body member as 422 with a stable pointer CMS-03B-06',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/workflow-requests.test.ts',
            title:
              '[P2-S11-AC-005][P2-S11-AC-011][P2-S11-AC-017][P2-S11-AC-023][P2-S11-AC-029] transport views for the five Slice 11 commands keeps the body strict: a caller capability, MFA instant or risk class is an unknown key',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_decision_refusals.sql',
            title:
              'a caller capability or stepUpAt is an unknown key, and a missing reason or malformed review id is INVALID_REQUEST [P2-S11-AC-012]',
          },
        ],
      },
      {
        text: 'every invalid request value with the exact stable field violation, safe message',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-decision-contracts.apispec.ts',
            title:
              'CMS-03B-06 exact decision contracts [CMS-03B-06] empty reason is 422 at reason before RPC with no effects',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-decision-contracts.apispec.ts',
            title:
              'CMS-03B-06 exact decision contracts [CMS-03B-06] 2001 code points reason is 422 at reason before RPC with no effects',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-decision-contracts.apispec.ts',
            title:
              'CMS-03B-06 exact decision contracts [CMS-03B-06] non-NFC reason is 422 at reason before RPC with no effects',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-decision-contracts.apispec.ts',
            title:
              'CMS-03B-06 exact decision contracts [CMS-03B-06] markup reason is 422 at reason before RPC with no effects',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-decision-contracts.apispec.ts',
            title:
              'CMS-03B-06 exact decision contracts [CMS-03B-06] bidi reason is 422 at reason before RPC with no effects',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-decision-refusals.apispec.ts',
            title:
              'CMS-03B-06 refusals through the real stack [CMS-03B-06] path-body admission refuses before RPC and leaves all durable groups unchanged',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-decision-refusals.apispec.ts',
            title:
              'CMS-03B-06 refusals through the real stack [CMS-03B-06] json admission refuses before RPC and leaves all durable groups unchanged',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-decision-refusals.apispec.ts',
            title:
              'CMS-03B-06 refusals through the real stack [CMS-03B-06] media admission refuses before RPC and leaves all durable groups unchanged',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-decision-refusals.apispec.ts',
            title:
              'CMS-03B-06 refusals through the real stack [CMS-03B-06] missing-key admission refuses before RPC and leaves all durable groups unchanged',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-decision-contracts.apispec.ts',
            title:
              'CMS-03B-06 exact decision contracts [CMS-03B-06] body expectedVersion and strong If-Match disagreement is exact 400 before RPC',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_decision_refusals.sql',
            title:
              'an unknown decision, an empty, over-long, non-NFC, control, separator, bidi, markup or brace reason, and a non-string reason are VALIDATION_FAILED at their pointer [P2-S11-AC-012]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_decision_refusals.sql',
            title:
              'If-Match must equal expectedVersion (INVALID_REQUEST) and be a positive decimal (VALIDATION_FAILED) [P2-S11-AC-012]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-admission.test.ts',
            title:
              'BE00 step 6: strict query, path and body refuses a path identifier that is not a UUID as 400 CMS-03B-06',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-admission.test.ts',
            title:
              'BE00 step 6: strict query, path and body refuses a body identifier that disagrees with the path as 422 CMS-03B-06',
          },
        ],
      },
      {
        text: 'no state mutation.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-decision-contracts.apispec.ts',
            title:
              'CMS-03B-06 exact decision contracts [CMS-03B-06] empty reason is 422 at reason before RPC with no effects',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-decision-contracts.apispec.ts',
            title:
              'CMS-03B-06 exact decision contracts [CMS-03B-06] markup reason is 422 at reason before RPC with no effects',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-decision-refusals.apispec.ts',
            title:
              'CMS-03B-06 refusals through the real stack [CMS-03B-06] caller-capability admission refuses before RPC and leaves all durable groups unchanged',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-decision-refusals.apispec.ts',
            title:
              'CMS-03B-06 refusals through the real stack [CMS-03B-06] path-body admission refuses before RPC and leaves all durable groups unchanged',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-decision-contracts.apispec.ts',
            title:
              'CMS-03B-06 exact decision contracts [CMS-03B-06] body expectedVersion and strong If-Match disagreement is exact 400 before RPC',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_decision_refusals.sql',
            title:
              'every refusal above left no decision, review change, reservation, audit record or outbox event behind [P2-S11-AC-015]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S11-AC-013',
    text: 'CMS-03B-06: derive actor and acting context server-side; enforce principal, capability, ownership, scope, and RLS with the specified 401, 403, and 404 boundary.',
    clauses: [
      {
        text: 'CMS-03B-06: derive actor and acting context server-side',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-decision-policy.apispec.ts',
            title:
              'CMS-03B-06 ordinary decision policy and persistence [CMS-03B-06] approve appends one assignment-bound decision with exact policy, count, privacy and atomic effects; replay is inert',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-admission.test.ts',
            title:
              'registers every browser command at its registry path hands the port the validated input and the server-derived session CMS-03B-06',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-workflow.test.ts',
            title:
              'commands bind the named RPC with a server-built request CMS-03B-06',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_decision.sql',
            title:
              'the decision row stores the server-derived reviewer, slot, assignment, MFA instant, frozen reviewed hash, reason and its SHA-256 comment hash [P2-S11-AC-109]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_decision_refusals.sql',
            title:
              'a caller capability or stepUpAt is an unknown key, and a missing reason or malformed review id is INVALID_REQUEST [P2-S11-AC-012]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-decision-refusals.apispec.ts',
            title:
              'CMS-03B-06 refusals through the real stack [CMS-03B-06] caller-capability admission refuses before RPC and leaves all durable groups unchanged',
          },
        ],
      },
      {
        text: 'enforce principal, capability, ownership, scope, and RLS',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-decision-refusals.apispec.ts',
            title:
              'CMS-03B-06 refusals through the real stack [CMS-03B-06] anonymous admission refuses before RPC and leaves all durable groups unchanged',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-admission.test.ts',
            title:
              'BE00 steps 4 and 5: session answers an unauthenticated caller 401 before any port CMS-03B-06',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-decision-contracts.apispec.ts',
            title:
              'CMS-03B-06 exact decision contracts [CMS-03B-06] none proof returns exact STEP_UP_REQUIRED recovery before any RPC or reservation',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-decision-contracts.apispec.ts',
            title:
              'CMS-03B-06 exact decision contracts [CMS-03B-06] stale proof returns exact STEP_UP_REQUIRED recovery before any RPC or reservation',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-decision-contracts.apispec.ts',
            title:
              'CMS-03B-06 exact decision contracts [CMS-03B-06] future proof returns exact STEP_UP_REQUIRED recovery before any RPC or reservation',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-quota.test.ts',
            title:
              'BE00 step 7: capability, step-up and quota refuses a session without the registry capability with capability_missing CMS-03B-06',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-quota.test.ts',
            title:
              'BE00 step 7: capability, step-up and quota answers a stale MFA proof 401 STEP_UP_REQUIRED before quota and RPC CMS-03B-06',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-decision-refusals.apispec.ts',
            title:
              'CMS-03B-06 refusals through the real stack [CMS-03B-06] step-up, the Worker gate, the assignment gate, a stale version and a decided review',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-decision-policy.apispec.ts',
            title:
              'CMS-03B-06 ordinary decision policy and persistence [CMS-03B-06] revoked assignment loses decision authority and concealed review matches absence',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_decision_refusals.sql',
            title:
              'a readable review without an EFFECTIVE assignment (window over, not started, submitter, publisher, owner) is 403 capability_missing [P2-S11-AC-013]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_decision_refusals.sql',
            title:
              'a non-member, a scope-less member, an absent review, another acting party and a reviewer whose assignment was revoked are one indistinguishable NOT_FOUND [P2-S11-AC-013]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_decision_refusals.sql',
            title:
              'the review submitter and the revision author are 403 separation_of_duties even with an effective assignment [P2-S11-AC-108]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_decision_refusals.sql',
            title:
              'a lapsed or deactivated standing cms.reviewer grant is 403 capability_missing; an ended membership leaves no scope at all (404) [P2-S11-AC-108]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_decision_refusals.sql',
            title:
              'a stale, future, unverified or absent proof is STEP_UP_REQUIRED, ahead of concealment [P2-S11-AC-108]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_schema_posture.sql',
            title:
              'posture: row-level security is enabled and forced on every Slice 11 table [P2-S11-AC-119]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_review_decisions_schema.sql',
            title:
              "decision: another reviewer's assignment cannot authorize this reviewer [P2-S11-AC-121]",
          },
        ],
      },
      {
        text: 'with the specified 401, 403, and 404 boundary.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-decision-contracts.apispec.ts',
            title:
              'CMS-03B-06 exact decision contracts [CMS-03B-06] stale proof returns exact STEP_UP_REQUIRED recovery before any RPC or reservation',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-decision-refusals.apispec.ts',
            title:
              'CMS-03B-06 refusals through the real stack [CMS-03B-06] anonymous admission refuses before RPC and leaves all durable groups unchanged',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-decision-refusals.apispec.ts',
            title:
              'CMS-03B-06 refusals through the real stack [CMS-03B-06] step-up, the Worker gate, the assignment gate, a stale version and a decided review',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-decision-policy.apispec.ts',
            title:
              'CMS-03B-06 ordinary decision policy and persistence [CMS-03B-06] revoked assignment loses decision authority and concealed review matches absence',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_decision_refusals.sql',
            title:
              'a readable review without an EFFECTIVE assignment (window over, not started, submitter, publisher, owner) is 403 capability_missing [P2-S11-AC-013]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_decision_refusals.sql',
            title:
              'a non-member, a scope-less member, an absent review, another acting party and a reviewer whose assignment was revoked are one indistinguishable NOT_FOUND [P2-S11-AC-013]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S11-AC-014',
    text: 'CMS-03B-06: enforce declared idempotency, If-Match or CAS, duplicate, replay, pagination, cache, rate, deadline, and concurrency rules.',
    clauses: [
      {
        text: 'CMS-03B-06: enforce declared idempotency',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-decision-contracts.apispec.ts',
            title:
              'CMS-03B-06 exact decision contracts [CMS-03B-06] completed idempotency binds decision and adds no second decision or other effects',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-decision-contracts.apispec.ts',
            title:
              'CMS-03B-06 exact decision contracts [CMS-03B-06] completed idempotency binds reason and adds no second decision or other effects',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-decision-contracts.apispec.ts',
            title:
              'CMS-03B-06 exact decision contracts [CMS-03B-06] completed idempotency binds version and adds no second decision or other effects',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-decision-contracts.apispec.ts',
            title:
              'CMS-03B-06 exact decision contracts [CMS-03B-06] completed idempotency binds path and adds no second decision or other effects',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-decision-refusals.apispec.ts',
            title:
              'CMS-03B-06 refusals through the real stack [CMS-03B-06] missing-key admission refuses before RPC and leaves all durable groups unchanged',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-decision-policy.apispec.ts',
            title:
              'CMS-03B-06 ordinary decision policy and persistence [CMS-03B-06] approve appends one assignment-bound decision with exact policy, count, privacy and atomic effects; replay is inert',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_decision.sql',
            title:
              'the idempotency reservation is completed with the decision [P2-S11-AC-014]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_decision.sql',
            title:
              'the same key with a changed reason is IDEMPOTENCY_MISMATCH [P2-S11-AC-014]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-quota.test.ts',
            title:
              'BE00 step 8: Idempotency-Key and strong If-Match requires a printable Idempotency-Key CMS-03B-06',
          },
        ],
      },
      {
        text: 'If-Match or CAS',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-decision-contracts.apispec.ts',
            title:
              'CMS-03B-06 exact decision contracts [CMS-03B-06] body expectedVersion and strong If-Match disagreement is exact 400 before RPC',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-decision-contracts.apispec.ts',
            title:
              'CMS-03B-06 exact decision contracts [CMS-03B-06] matching stale operands reach the RPC and return exact authorized CAS versions without effects',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_decision_refusals.sql',
            title:
              'a stale review version is VERSION_MISMATCH with the expected and current versions [P2-S11-AC-014]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_decision_refusals.sql',
            title:
              'If-Match must equal expectedVersion (INVALID_REQUEST) and be a positive decimal (VALIDATION_FAILED) [P2-S11-AC-012]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-quota.test.ts',
            title:
              'BE00 step 8: Idempotency-Key and strong If-Match requires an exact strong If-Match CMS-03B-06',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-quota.test.ts',
            title:
              'BE00 step 8: Idempotency-Key and strong If-Match refuses an If-Match that disagrees with the body expectedVersion as 400 CMS-03B-06',
          },
        ],
      },
      {
        text: 'duplicate, replay',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_decision_refusals.sql',
            title:
              'a second decision by the same human is 409 duplicate_decision [P2-S11-AC-108]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_decision.sql',
            title:
              'an exact replay returns the stored response and adds no decision, audit record, event or reservation [P2-S11-AC-014]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_decision.sql',
            title:
              'one human records at most one decision per review [P2-S11-AC-108]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_decision.sql',
            title:
              'a second attempt on the approved review is review_not_open [P2-S11-AC-108]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-decision-policy.apispec.ts',
            title:
              'CMS-03B-06 ordinary decision policy and persistence [CMS-03B-06] approve appends one assignment-bound decision with exact policy, count, privacy and atomic effects; replay is inert',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-decision-refusals.apispec.ts',
            title:
              'CMS-03B-06 refusals through the real stack [CMS-03B-06] step-up, the Worker gate, the assignment gate, a stale version and a decided review',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-review-chain.apispec.ts',
            title:
              'CMS-03B-15 -> 05 -> 18 -> 06 -> 16 -> 17 through the real stack [CMS-03B-06] the assigned reviewer approves with a fresh step-up (200, review version + 1) and a replay adds nothing',
          },
        ],
      },
      {
        text: 'pagination, cache',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-admission.test.ts',
            title:
              'BE00 step 6: strict query, path and body refuses any query string on a command CMS-03B-06',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-admission.test.ts',
            title:
              'registers every browser command at its registry path success envelope CMS-03B-06',
          },
        ],
      },
      {
        text: 'rate, deadline',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-quota.test.ts',
            title:
              'BE00 step 7: capability, step-up and quota enforces the user and party buckets from the registry row CMS-03B-06',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-quota.test.ts',
            title:
              'BE00 step 7: capability, step-up and quota answers an exhausted bucket 429 with the rate headers CMS-03B-06',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-quota.test.ts',
            title:
              'port boundary is 504 when the port outlives the route deadline CMS-03B-06',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-workflow.test.ts',
            title:
              'transport constants follow the registry names an RPC, deadline, quota and rate class equal to each registry row',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/routes-slice11.test.ts',
            title:
              '[P2-S11-AC-011][P2-S11-AC-014] CMS-03B-06 decision row limits 30/60 per minute in the review class, 15 s, Tier 2',
          },
        ],
      },
      {
        text: 'concurrency rules.',
        citations: [
          {
            tool: 'race',
            file: 'supabase/tests/phase_02_slice_11_races/011-review-decision-race.mjs',
            title:
              'B1: one decision row, the review open at version 2 with one recorded decision, one event',
          },
          {
            tool: 'race',
            file: 'supabase/tests/phase_02_slice_11_races/011-review-decision-race.mjs',
            title:
              'B3: one decision row and one event (the duplicate replayed)',
          },
          {
            tool: 'race',
            file: 'supabase/tests/phase_02_slice_11_races/011-review-decision-race.mjs',
            title:
              'B4: one decision row (unique reviewer per review) and one event',
          },
          {
            tool: 'race',
            file: 'supabase/tests/phase_02_slice_11_races/011-review-decision-race.mjs',
            title:
              'B5: a decision BLOCKS behind a session holding the review row FOR UPDATE (the command takes the review lock)',
          },
          {
            tool: 'race',
            file: 'supabase/tests/phase_02_slice_11_races/011-review-decision-race.mjs',
            title:
              'B7: a decision and an assignment revoke both wait on the review row lock',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S11-AC-015',
    text: 'CMS-03B-06: map every declared domain, dependency, timeout, rate, and internal failure to typed ApiError and preserve safe recovery.',
    clauses: [
      {
        text: 'CMS-03B-06: map every declared domain',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-decision-refusals.apispec.ts',
            title:
              'CMS-03B-06 refusals through the real stack [CMS-03B-06] step-up, the Worker gate, the assignment gate, a stale version and a decided review',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-decision-refusals.apispec.ts',
            title:
              'CMS-03B-06 refusals through the real stack [CMS-03B-06] a stale frozen manifest is the COMMITTED refusal: 200 kind refusal on the wire, 409 dependency_changed for the browser, the review stays invalidated and no decision is recorded',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-decision-contracts.apispec.ts',
            title:
              'CMS-03B-06 exact decision contracts [CMS-03B-06] matching stale operands reach the RPC and return exact authorized CAS versions without effects',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-workflow-refusals.test.ts',
            title:
              'typed refusals the database raises 403 capability_missing and separation_of_duties',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-workflow-refusals.test.ts',
            title:
              'typed refusals the database raises 409 dependency_changed with the hash, and a stale operand with safe versions',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/refusals.test.ts',
            title:
              '[P2-S11-AC-009][P2-S11-AC-021][P2-S11-AC-027][P2-S11-AC-033] closed Slice 11 reason catalog names for each browser operation exactly the ordered tokens its matrix row allows',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_decision_refusals.sql',
            title:
              'an approved, rejected or invalidated review is review_not_open, and the state is evaluated before the CAS operand [P2-S11-AC-108]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_decision.sql',
            title:
              'a second base-only approve is refused specialist_slot_unsatisfiable (no approval left for the unfilled specialist slot) and changes nothing [P2-S11-AC-109]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_decision_invalidation.sql',
            title:
              'a stale frozen manifest returns the committed-refusal envelope {kind, reasonCode, details} instead of raising (so the invalidation commits) [P2-S11-AC-108]',
          },
        ],
      },
      {
        text: 'dependency',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-decision-contracts.apispec.ts',
            title:
              'CMS-03B-06 exact decision contracts [CMS-03B-06] command transport outage is exact retryable 503 and preserves all durable rows',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-quota.test.ts',
            title:
              'port boundary is 503 when the port is not composed CMS-03B-06',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-quota.test.ts',
            title:
              'BE00 step 7: capability, step-up and quota passes a quota dependency failure through as its typed refusal CMS-03B-06',
          },
        ],
      },
      {
        text: 'timeout',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-quota.test.ts',
            title:
              'port boundary is 504 when the port outlives the route deadline CMS-03B-06',
          },
        ],
      },
      {
        text: 'rate',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-quota.test.ts',
            title:
              'BE00 step 7: capability, step-up and quota answers an exhausted bucket 429 with the rate headers CMS-03B-06',
          },
        ],
      },
      {
        text: 'internal failure to typed ApiError',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-quota.test.ts',
            title:
              'port boundary is 502 when the success payload breaks the resource contract CMS-03B-06',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-errors-typed.test.ts',
            title:
              'transport statuses publishes the canonical 502, 504 and 500 envelopes',
          },
        ],
      },
      {
        text: 'preserve safe recovery.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-decision-contracts.apispec.ts',
            title:
              'CMS-03B-06 exact decision contracts [CMS-03B-06] none proof returns exact STEP_UP_REQUIRED recovery before any RPC or reservation',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-decision-contracts.apispec.ts',
            title:
              'CMS-03B-06 exact decision contracts [CMS-03B-06] stale proof returns exact STEP_UP_REQUIRED recovery before any RPC or reservation',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-decision-contracts.apispec.ts',
            title:
              'CMS-03B-06 exact decision contracts [CMS-03B-06] future proof returns exact STEP_UP_REQUIRED recovery before any RPC or reservation',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-decision-contracts.apispec.ts',
            title:
              'CMS-03B-06 exact decision contracts [CMS-03B-06] command transport outage is exact retryable 503 and preserves all durable rows',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-decision-contracts.apispec.ts',
            title:
              'CMS-03B-06 exact decision contracts [CMS-03B-06] matching stale operands reach the RPC and return exact authorized CAS versions without effects',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-decision-refusals.apispec.ts',
            title:
              'CMS-03B-06 refusals through the real stack [CMS-03B-06] a stale frozen manifest is the COMMITTED refusal: 200 kind refusal on the wire, 409 dependency_changed for the browser, the review stays invalidated and no decision is recorded',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-errors.test.ts',
            title:
              '401 projection publishes STEP_UP_REQUIRED with the configured MFA methods when the row declares step-up',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-errors.test.ts',
            title:
              '409 projection drops malformed versions and defaults the recovery to reload',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-quota.test.ts',
            title:
              'port boundary projects a typed port refusal through the operation boundary CMS-03B-06',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_decision_refusals.sql',
            title:
              'every refusal above left no decision, review change, reservation, audit record or outbox event behind [P2-S11-AC-015]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S11-AC-016',
    text: 'CMS-03B-06: commit audit and outbox effects atomically where applicable, reconcile lost responses without duplicate effects, and emit redacted telemetry.',
    clauses: [
      {
        text: 'CMS-03B-06: commit audit and outbox effects atomically where applicable',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-decision-policy.apispec.ts',
            title:
              'CMS-03B-06 ordinary decision policy and persistence [CMS-03B-06] approve appends one assignment-bound decision with exact policy, count, privacy and atomic effects; replay is inert',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-decision-policy.apispec.ts',
            title:
              'CMS-03B-06 ordinary decision policy and persistence [CMS-03B-06] reject appends one assignment-bound decision with exact policy, count, privacy and atomic effects; replay is inert',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_decision.sql',
            title:
              'exactly one audit record and one identifier-only cms.entry.review-changed.v1 at the new review version commit with the decision [P2-S11-AC-016]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_decision_invalidation.sql',
            title:
              'the invalidation committed exactly one cms.entry.review-changed.v1 [P2-S11-AC-111]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_decision_refusals.sql',
            title:
              'every refusal above left no decision, review change, reservation, audit record or outbox event behind [P2-S11-AC-015]',
          },
          {
            tool: 'race',
            file: 'supabase/tests/phase_02_slice_11_races/011-review-decision-race.mjs',
            title:
              'B1: one decision row, the review open at version 2 with one recorded decision, one event',
          },
        ],
      },
      {
        text: 'reconcile lost responses without duplicate effects',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-decision-policy.apispec.ts',
            title:
              'CMS-03B-06 ordinary decision policy and persistence [CMS-03B-06] approve appends one assignment-bound decision with exact policy, count, privacy and atomic effects; replay is inert',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-review-chain.apispec.ts',
            title:
              'CMS-03B-15 -> 05 -> 18 -> 06 -> 16 -> 17 through the real stack [CMS-03B-06] the assigned reviewer approves with a fresh step-up (200, review version + 1) and a replay adds nothing',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_decision.sql',
            title:
              'an exact replay returns the stored response and adds no decision, audit record, event or reservation [P2-S11-AC-014]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_decision_invalidation.sql',
            title:
              'an exact replay returns the same typed outcome with no second effect [P2-S11-AC-014]',
          },
          {
            tool: 'race',
            file: 'supabase/tests/phase_02_slice_11_races/011-review-decision-race.mjs',
            title:
              'B3: one decision row and one event (the duplicate replayed)',
          },
        ],
      },
      {
        text: 'emit',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-telemetry.test.ts',
            title: 'review metrics counts a decision by decision and outcome',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-telemetry.test.ts',
            title:
              'review metrics counts a committed invalidation refused on a decision',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-facts.test.ts',
            title:
              'telemetry labels a refused decision and a revoke from the validated request',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-workflow-telemetry.test.ts',
            title:
              'Slice 11 telemetry classes CMS-03B-06 writes the command, rpc and acceptance events',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-workflow-logging.test.ts',
            title:
              'route telemetry through the production sink writes every command and read event without a single rejected event',
          },
        ],
      },
      {
        text: 'redacted telemetry.',
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'No test serializes the CMS-03B-06 telemetry event and asserts that the review id, the decision reason text, the reviewed hash and the reviewer identity are absent from it; only CMS-03B-05 (workflow-command-facts) and CMS-03B-08 (token) have an operation-specific redaction assertion, so the redaction half of this clause is unproven.',
  },
  {
    criterion: 'P2-S11-AC-017',
    text: 'CMS-03B-07: define strict Zod request, path, query, header, and success contracts and complete the declared happy path — CMS-03B-07 — CMS-09 — POST /api/v1/cms/publication-schedules — PublicationScheduleRequest → 202 PublicationScheduleResource.',
    clauses: [
      {
        text: 'CMS-03B-07: define strict Zod request, path, query, header, and success contracts',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/workflow-requests.test.ts',
            title:
              '[P2-S11-AC-005][P2-S11-AC-011][P2-S11-AC-017][P2-S11-AC-023][P2-S11-AC-029] transport views for the five Slice 11 commands binds the path id, the command headers and the exact request body for each command',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/workflow-requests.test.ts',
            title:
              '[P2-S11-AC-005][P2-S11-AC-011][P2-S11-AC-017][P2-S11-AC-023][P2-S11-AC-029] transport views for the five Slice 11 commands rejects an unknown member, a missing header block and a malformed body',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-schedule-contracts.test.ts',
            title:
              '[P2-S10-AC-043] CMS-03B-07 localDateTime/timezone rejects local datetimes carrying an offset or Z suffix',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-schedule-contracts.test.ts',
            title:
              '[P2-S10-AC-043] CMS-03B-07 localDateTime/timezone refuses an out-of-range or impossible local datetime',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-schedule-contracts.test.ts',
            title:
              '[P2-S10-AC-043] CMS-03B-07 localDateTime/timezone refuses a malformed timezone name',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-schedule-contracts.test.ts',
            title:
              '[P2-S10-AC-044] CMS-03B-07 resolvedUtc/tzdbVersion/disambiguation rejects a resolvedUtc without an explicit offset and an over-long tzdbVersion',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-schedule-contracts.test.ts',
            title:
              '[P2-S10-AC-045] CMS-03B-07 action accepts exactly publish, unpublish, expire, and archive',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-schedule-contracts.test.ts',
            title:
              'CMS-03B-05/06/07/08/09 path and header transports binds the schedule headers without a route-level audience key',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/workflow-resources.test.ts',
            title:
              '[P2-S11-AC-017] PublicationScheduleResource (CMS-03B-07) rejects unknown keys and every missing member',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/workflow-resources.test.ts',
            title:
              '[P2-S11-AC-017] PublicationScheduleResource (CMS-03B-07) keeps the closed state, action, disambiguation and reason vocabularies',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/routes-slice11.test.ts',
            title:
              '[P2-S11-AC-017][P2-S11-AC-020] CMS-03B-07 schedule row accepts with 202, a strong schedule ETag and Location, and emits no event at acceptance',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-11-openapi-refinements.test.ts',
            title:
              '[P2-S11-AC-017] publication-schedule localDateTime publishes its calendar and clock ranges agrees with the runtime over every month and day of leap, century and ordinary years',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-admission.test.ts',
            title:
              'BE00 step 6: strict query, path and body refuses any query string on a command CMS-03B-07',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-admission.test.ts',
            title:
              'BE00 step 6: strict query, path and body refuses an unknown body member as 422 with a stable pointer CMS-03B-07',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_schedule.sql',
            title:
              'the response is exactly PublicationScheduleResource (19 members) [P2-S11-AC-017]',
          },
        ],
      },
      {
        text: 'complete the declared happy path — CMS-03B-07 — CMS-09 — POST /api/v1/cms/publication-schedules — PublicationScheduleRequest → 202 PublicationScheduleResource.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-schedule.apispec.ts',
            title:
              'CMS-03B-07 schedule through the real stack [CMS-03B-07] accepts a future UTC schedule (202 scheduled, never published; Location; strong ETag) and a replay adds nothing',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-schedule-actions.apispec.ts',
            title:
              'CMS-03B-07 exact action and audience schedule identity [CMS-03B-07] publish acceptance changes only schedule, reservation, audit and accessibility groups',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-schedule-actions.apispec.ts',
            title:
              'CMS-03B-07 exact action and audience schedule identity [CMS-03B-07] unpublish acceptance changes only schedule, reservation, audit and accessibility groups',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-schedule-actions.apispec.ts',
            title:
              'CMS-03B-07 exact action and audience schedule identity [CMS-03B-07] expire acceptance changes only schedule, reservation, audit and accessibility groups',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-schedule-actions.apispec.ts',
            title:
              'CMS-03B-07 exact action and audience schedule identity [CMS-03B-07] archive acceptance changes only schedule, reservation, audit and accessibility groups',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-schedule-actions.apispec.ts',
            title:
              'CMS-03B-07 exact action and audience schedule identity [CMS-03B-07] nine-digit fractional schedule accepted by Worker remains accepted by SQL',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_schedule.sql',
            title:
              'the owner-party publisher schedules a publish of an approved revision [P2-S11-AC-017]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_schedule.sql',
            title:
              'a new schedule is pending at version 1 with no job, no actual instant, no deviation, no reason and no attempt [P2-S11-AC-122]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_schedule.sql',
            title:
              'unpublish, expire and archive are scheduled against an approved review too [P2-S11-AC-017]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-admission.test.ts',
            title:
              'registers every browser command at its registry path success envelope CMS-03B-07',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S11-AC-018',
    text: 'CMS-03B-07: reject unknown fields and every invalid request value with the exact stable field violation, safe message, and no state mutation.',
    clauses: [
      {
        text: 'CMS-03B-07: reject unknown fields',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-admission.test.ts',
            title:
              'BE00 step 6: strict query, path and body refuses an unknown body member as 422 with a stable pointer CMS-03B-07',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/workflow-requests.test.ts',
            title:
              '[P2-S11-AC-005][P2-S11-AC-011][P2-S11-AC-017][P2-S11-AC-023][P2-S11-AC-029] transport views for the five Slice 11 commands rejects an unknown member, a missing header block and a malformed body',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/workflow-requests.test.ts',
            title:
              '[P2-S11-AC-005][P2-S11-AC-011][P2-S11-AC-017][P2-S11-AC-023][P2-S11-AC-029] transport views for the five Slice 11 commands keeps the body strict: a caller capability, MFA instant or risk class is an unknown key',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_schedule_refusals.sql',
            title:
              'an unknown key (entryId, riskClass), a missing member, a malformed revision id, If-Match disagreeing with expectedVersion and a non-object proof are INVALID_REQUEST [P2-S11-AC-018]',
          },
        ],
      },
      {
        text: 'every invalid request value with the exact stable field violation, safe message',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-schedule-time.apispec.ts',
            title:
              'CMS-03B-07 pinned time authority through the real stack [CMS-03B-07] unknown zone returns exact safe time details and no effects',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-schedule-time.apispec.ts',
            title:
              'CMS-03B-07 pinned time authority through the real stack [CMS-03B-07] pinned tzdb mismatch returns exact safe time details and no effects',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-schedule-time.apispec.ts',
            title:
              'CMS-03B-07 pinned time authority through the real stack [CMS-03B-07] ordinary earlier choice returns exact safe time details and no effects',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-schedule-time.apispec.ts',
            title:
              'CMS-03B-07 pinned time authority through the real stack [CMS-03B-07] ordinary later choice returns exact safe time details and no effects',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-schedule-time.apispec.ts',
            title:
              'CMS-03B-07 pinned time authority through the real stack [CMS-03B-07] a nonexistent local time is the Worker 422 with its two alternatives and reaches no RPC',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-schedule-time.apispec.ts',
            title:
              'CMS-03B-07 pinned time authority through the real stack [CMS-03B-07] spring gap and unresolved fold expose exactly both pinned alternatives',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-schedule-time.apispec.ts',
            title:
              'CMS-03B-07 pinned time authority through the real stack [CMS-03B-07] one nanosecond UTC mismatch is refused before any RPC',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-schedule-time.apispec.ts',
            title:
              'CMS-03B-07 pinned time authority through the real stack [CMS-03B-07] below minimum reports exact 60-second and 366-day live-clock bounds',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-schedule-time.apispec.ts',
            title:
              'CMS-03B-07 pinned time authority through the real stack [CMS-03B-07] above maximum reports exact 60-second and 366-day live-clock bounds',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-schedule-actions.apispec.ts',
            title:
              'CMS-03B-07 exact action and audience schedule identity [CMS-03B-07] header/body CAS disagreement is 400 before any RPC or reservation',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-schedule-actions.apispec.ts',
            title:
              'CMS-03B-07 exact action and audience schedule identity [CMS-03B-07] non-JSON body is exact 415 before RPC and changes nothing',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_schedule_refusals.sql',
            title:
              'every invalid field is VALIDATION_FAILED at its RFC 6901 pointer: action, a real local date and time without offset or leap second at most nine fraction digits, the zone grammar, an offset instant, the tzdb tag, disambiguation, the audience grammar, expectedVersion and If-Match [P2-S11-AC-018]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_schedule_refusals.sql',
            title:
              'several invalid fields are reported together, in request order, and nothing else is echoed [P2-S11-AC-018]',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-schedule-contracts.test.ts',
            title:
              '[P2-S10-AC-043] CMS-03B-07 localDateTime/timezone refuses an out-of-range or impossible local datetime',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-quota.test.ts',
            title:
              'BE00 step 8: Idempotency-Key and strong If-Match refuses an If-Match that disagrees with the body expectedVersion as 400 CMS-03B-07',
          },
        ],
      },
      {
        text: 'no state mutation.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-schedule-time.apispec.ts',
            title:
              'CMS-03B-07 pinned time authority through the real stack [CMS-03B-07] unknown zone returns exact safe time details and no effects',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-schedule-time.apispec.ts',
            title:
              'CMS-03B-07 pinned time authority through the real stack [CMS-03B-07] pinned tzdb mismatch returns exact safe time details and no effects',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-schedule-time.apispec.ts',
            title:
              'CMS-03B-07 pinned time authority through the real stack [CMS-03B-07] spring gap and unresolved fold expose exactly both pinned alternatives',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-schedule-time.apispec.ts',
            title:
              'CMS-03B-07 pinned time authority through the real stack [CMS-03B-07] one nanosecond UTC mismatch is refused before any RPC',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-schedule-time.apispec.ts',
            title:
              'CMS-03B-07 pinned time authority through the real stack [CMS-03B-07] below minimum reports exact 60-second and 366-day live-clock bounds',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-schedule-actions.apispec.ts',
            title:
              'CMS-03B-07 exact action and audience schedule identity [CMS-03B-07] header/body CAS disagreement is 400 before any RPC or reservation',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-schedule-actions.apispec.ts',
            title:
              'CMS-03B-07 exact action and audience schedule identity [CMS-03B-07] non-JSON body is exact 415 before RPC and changes nothing',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_schedule_refusals.sql',
            title:
              'every raised refusal above left no schedule, review change, lineage row, reservation, event or audit record behind [P2-S11-AC-018]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_schedule_refusals.sql',
            title: 'the refused time rules scheduled nothing [P2-S11-AC-105]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S11-AC-019',
    text: 'CMS-03B-07: derive actor and acting context server-side; enforce principal, capability, ownership, scope, and RLS with the specified 401, 403, and 404 boundary.',
    clauses: [
      {
        text: 'CMS-03B-07: derive actor and acting context server-side',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-admission.test.ts',
            title:
              'registers every browser command at its registry path hands the port the validated input and the server-derived session CMS-03B-07',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-workflow.test.ts',
            title:
              'commands bind the named RPC with a server-built request CMS-03B-07',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-schedule.apispec.ts',
            title:
              'CMS-03B-07 schedule through the real stack [CMS-03B-07] readable nonpublisher is exactly 403 and hidden and absent revisions are identical safe 404s',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_schedule.sql',
            title:
              'the schedule row stores the server-derived owner, publisher, review and its version, dependency and activation hashes and the verified time fields [P2-S11-AC-122]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_schedule.sql',
            title:
              'the response carries no publisher, author, submitter, reviewer, party, account or review identifier [P2-S11-AC-019]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_schedule_refusals.sql',
            title:
              'an unknown key (entryId, riskClass), a missing member, a malformed revision id, If-Match disagreeing with expectedVersion and a non-object proof are INVALID_REQUEST [P2-S11-AC-018]',
          },
        ],
      },
      {
        text: 'enforce principal, capability, ownership, scope, and RLS',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-schedule-actions.apispec.ts',
            title:
              'CMS-03B-07 exact action and audience schedule identity [CMS-03B-07] anonymous schedule is exact 401 reauthentication with no effects',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-admission.test.ts',
            title:
              'BE00 steps 4 and 5: session answers an unauthenticated caller 401 before any port CMS-03B-07',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-schedule.apispec.ts',
            title:
              'CMS-03B-07 schedule through the real stack [CMS-03B-07] a missing, stale or future-dated step-up is 401 before any RPC and reserves nothing',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-quota.test.ts',
            title:
              'BE00 step 7: capability, step-up and quota answers a stale MFA proof 401 STEP_UP_REQUIRED before quota and RPC CMS-03B-07',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-quota.test.ts',
            title:
              'BE00 step 7: capability, step-up and quota refuses a session without the registry capability with capability_missing CMS-03B-07',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-schedule.apispec.ts',
            title:
              'CMS-03B-07 schedule through the real stack [CMS-03B-07] readable nonpublisher is exactly 403 and hidden and absent revisions are identical safe 404s',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_schedule_refusals.sql',
            title:
              'a visible target without the owner-party cms.publisher grant is 403 capability_missing: the entry assignee, the assigned reviewer and the owner [P2-S11-AC-019]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_schedule_refusals.sql',
            title:
              'a non-member, a member with no scope on the entry and an absent revision are the same byte-identical NOT_FOUND [P2-S11-AC-019]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_schedule_refusals.sql',
            title:
              'a stale, future-dated (beyond the 30 s skew), unverified or absent proof is STEP_UP_REQUIRED, even for a caller who could not see the target [P2-S11-AC-047]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_schedule_refusals.sql',
            title:
              'the human who authored the revision cannot schedule its publish (E11) [P2-S11-AC-107]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_schema_posture.sql',
            title:
              'posture: row-level security is enabled and forced on every Slice 11 table [P2-S11-AC-119]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_schema_posture.sql',
            title:
              'posture: anon, authenticated and service_role hold no privilege on any Slice 11 table [P2-S11-AC-119]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_schedule.sql',
            title:
              'cms_schedule_publication is a private SECURITY DEFINER of the CMS definer (empty search_path) that no API role, service_role included, can execute [P2-S11-AC-022]',
          },
        ],
      },
      {
        text: 'with the specified 401, 403, and 404 boundary.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-schedule-actions.apispec.ts',
            title:
              'CMS-03B-07 exact action and audience schedule identity [CMS-03B-07] anonymous schedule is exact 401 reauthentication with no effects',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-schedule.apispec.ts',
            title:
              'CMS-03B-07 schedule through the real stack [CMS-03B-07] a missing, stale or future-dated step-up is 401 before any RPC and reserves nothing',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-schedule.apispec.ts',
            title:
              'CMS-03B-07 schedule through the real stack [CMS-03B-07] readable nonpublisher is exactly 403 and hidden and absent revisions are identical safe 404s',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_schedule_refusals.sql',
            title:
              'a visible target without the owner-party cms.publisher grant is 403 capability_missing: the entry assignee, the assigned reviewer and the owner [P2-S11-AC-019]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_schedule_refusals.sql',
            title:
              'a non-member, a member with no scope on the entry and an absent revision are the same byte-identical NOT_FOUND [P2-S11-AC-019]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S11-AC-020',
    text: 'CMS-03B-07: enforce declared idempotency, If-Match or CAS, duplicate, replay, pagination, cache, rate, deadline, and concurrency rules.',
    clauses: [
      {
        text: 'CMS-03B-07: enforce declared idempotency',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-schedule.apispec.ts',
            title:
              'CMS-03B-07 schedule through the real stack [CMS-03B-07] changed same-key schedule body is exact idempotency mismatch and preserves all effects',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-schedule.apispec.ts',
            title:
              'CMS-03B-07 schedule through the real stack [CMS-03B-07] accepts a future UTC schedule (202 scheduled, never published; Location; strong ETag) and a replay adds nothing',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_schedule.sql',
            title:
              'the idempotency reservation is completed with the 202 acceptance [P2-S11-AC-020]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_schedule.sql',
            title:
              'the same key with a changed audience is IDEMPOTENCY_MISMATCH [P2-S11-AC-020]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_schedule.sql',
            title:
              'a lost-response retry with the same key and a freshly evaluated accessibility proof is a replay, not an IDEMPOTENCY_MISMATCH (the proof is server-built, not part of the command identity) [P2-S11-AC-020]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-quota.test.ts',
            title:
              'BE00 step 8: Idempotency-Key and strong If-Match requires a printable Idempotency-Key CMS-03B-07',
          },
        ],
      },
      {
        text: 'If-Match or CAS',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-schedule.apispec.ts',
            title:
              'CMS-03B-07 schedule through the real stack [CMS-03B-07] stale approved-review CAS is exact VERSION_MISMATCH with no effects',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-schedule-actions.apispec.ts',
            title:
              'CMS-03B-07 exact action and audience schedule identity [CMS-03B-07] header/body CAS disagreement is 400 before any RPC or reservation',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_schedule_refusals.sql',
            title:
              'a stale approved-review version is 409 VERSION_MISMATCH carrying only the expected and current versions [P2-S11-AC-020]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_schedule_refusals.sql',
            title:
              'an invalidation advances the review version, so a command against an invalidated approval is VERSION_MISMATCH [P2-S11-AC-020]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-quota.test.ts',
            title:
              'BE00 step 8: Idempotency-Key and strong If-Match requires an exact strong If-Match CMS-03B-07',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-quota.test.ts',
            title:
              'BE00 step 8: Idempotency-Key and strong If-Match refuses an If-Match that disagrees with the body expectedVersion as 400 CMS-03B-07',
          },
        ],
      },
      {
        text: 'duplicate, replay',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-schedule-actions.apispec.ts',
            title:
              'CMS-03B-07 exact action and audience schedule identity [CMS-03B-07] publish acceptance changes only schedule, reservation, audit and accessibility groups',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-schedule.apispec.ts',
            title:
              'CMS-03B-07 schedule through the real stack [CMS-03B-07] accepts a future UTC schedule (202 scheduled, never published; Location; strong ETag) and a replay adds nothing',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_schedule.sql',
            title:
              'a second schedule of the same action, local time, timezone and audience under another key is a CONFLICT and changes nothing [P2-S11-AC-020]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_schedule.sql',
            title:
              'an exact replay returns the stored resource, marks x-cms-idempotent-replay and adds no schedule, audit record, event or reservation [P2-S11-AC-020]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_schedule.sql',
            title:
              'another audience, another local time or another action is a different identity (the audience is part of the key) [P2-S11-AC-020]',
          },
        ],
      },
      {
        text: 'pagination, cache',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-admission.test.ts',
            title:
              'BE00 step 6: strict query, path and body refuses any query string on a command CMS-03B-07',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-admission.test.ts',
            title:
              'registers every browser command at its registry path success envelope CMS-03B-07',
          },
        ],
      },
      {
        text: 'rate, deadline',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-quota.test.ts',
            title:
              'BE00 step 7: capability, step-up and quota enforces the user and party buckets from the registry row CMS-03B-07',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-quota.test.ts',
            title:
              'BE00 step 7: capability, step-up and quota answers an exhausted bucket 429 with the rate headers CMS-03B-07',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-quota.test.ts',
            title:
              'port boundary is 504 when the port outlives the route deadline CMS-03B-07',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-workflow.test.ts',
            title:
              'transport constants follow the registry names an RPC, deadline, quota and rate class equal to each registry row',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/routes-slice11.test.ts',
            title:
              '[P2-S11-AC-017][P2-S11-AC-020] CMS-03B-07 schedule row limits 20/40 per minute in the schedule class, 15 s acceptance, Tier 2',
          },
        ],
      },
      {
        text: 'concurrency rules.',
        citations: [
          {
            tool: 'race',
            file: 'supabase/tests/phase_02_slice_11_races/015-schedule-accept-race.mjs',
            title:
              'S3: a revision append BLOCKS behind a schedule parked after taking the entry row FOR SHARE and its authority locks',
          },
          {
            tool: 'race',
            file: 'supabase/tests/phase_02_slice_11_races/015-schedule-accept-race.mjs',
            title:
              'S3: the append then invalidated the review and cancelled the pending schedule (approval_invalidated)',
          },
          {
            tool: 'race',
            file: 'supabase/tests/phase_02_slice_11_races/015-schedule-accept-race.mjs',
            title:
              'S4: a schedule BLOCKS behind an append holding the entry row FOR UPDATE',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_schedule.sql',
            title:
              'a second schedule of the same action, local time, timezone and audience under another key is a CONFLICT and changes nothing [P2-S11-AC-020]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_schedule_refusals.sql',
            title:
              'a stale approved-review version is 409 VERSION_MISMATCH carrying only the expected and current versions [P2-S11-AC-020]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S11-AC-021',
    text: 'CMS-03B-07: map every declared domain, dependency, timeout, rate, and internal failure to typed ApiError and preserve safe recovery.',
    clauses: [
      {
        text: 'CMS-03B-07: map every declared domain',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-schedule.apispec.ts',
            title:
              'CMS-03B-07 schedule through the real stack [CMS-03B-07] a publisher whose grant ends before the schedule is 422 authority_ends_before_schedule',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-schedule.apispec.ts',
            title:
              'CMS-03B-07 schedule through the real stack [CMS-03B-07] stale approved-review CAS is exact VERSION_MISMATCH with no effects',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-schedule-time.apispec.ts',
            title:
              'CMS-03B-07 pinned time authority through the real stack [CMS-03B-07] a nonexistent local time is the Worker 422 with its two alternatives and reaches no RPC',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-schedule-time.apispec.ts',
            title:
              'CMS-03B-07 pinned time authority through the real stack [CMS-03B-07] spring gap and unresolved fold expose exactly both pinned alternatives',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-schedule-time.apispec.ts',
            title:
              'CMS-03B-07 pinned time authority through the real stack [CMS-03B-07] the database horizon is 422 schedule_out_of_horizon with minUtc and maxUtc',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-schedule-time.apispec.ts',
            title:
              'CMS-03B-07 pinned time authority through the real stack [CMS-03B-07] unknown zone returns exact safe time details and no effects',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-schedule-time.apispec.ts',
            title:
              'CMS-03B-07 pinned time authority through the real stack [CMS-03B-07] pinned tzdb mismatch returns exact safe time details and no effects',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-schedule.apispec.ts',
            title:
              'CMS-03B-07 schedule through the real stack [CMS-03B-07] changed same-key schedule body is exact idempotency mismatch and preserves all effects',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-workflow-refusals.test.ts',
            title:
              'typed refusals the database raises 422 time-authority RPC recheck keeps the pinned release',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/refusals.test.ts',
            title:
              '[P2-S11-AC-009][P2-S11-AC-021][P2-S11-AC-027][P2-S11-AC-033] closed Slice 11 reason catalog names for each browser operation exactly the ordered tokens its matrix row allows',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-errors-typed.test.ts',
            title:
              '422 projection keeps violations beside a typed time-authority token',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_schedule_refusals.sql',
            title:
              'a tzdbVersion other than the pinned one is 422 tzdb_version_mismatch carrying the pinned value [P2-S11-AC-104]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_schedule_refusals.sql',
            title:
              'a schedule under 60 s ahead, in the past or over 366 days ahead is 422 schedule_out_of_horizon with the minUtc and maxUtc window [P2-S11-AC-105]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_schedule_refusals.sql',
            title:
              'a cms.publisher grant that ends before the resolved UTC day is 422 authority_ends_before_schedule [P2-S11-AC-107]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_schedule_refusals.sql',
            title:
              'a failed category refuses 422 preflight_failed; the DETAIL lists all 17 {category, outcome, reasonCode} entries and nothing else [P2-S11-AC-097]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_schedule_refusals.sql',
            title:
              'a stale frozen manifest returns the committed-refusal envelope {kind, reasonCode, details} carrying only the CURRENT dependencyHash [P2-S11-AC-021]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_schedule_refusals.sql',
            title:
              'a revision whose latest review is invalidated, rejected or open, or that was never reviewed, cannot be scheduled: CONFLICT [P2-S11-AC-038]',
          },
        ],
      },
      {
        text: 'dependency',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-schedule.apispec.ts',
            title:
              'CMS-03B-07 schedule through the real stack [CMS-03B-07] an unavailable accessibility proof is 503 with Retry-After and no schedule',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-quota.test.ts',
            title:
              'port boundary is 503 when the port is not composed CMS-03B-07',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-quota.test.ts',
            title:
              'BE00 step 7: capability, step-up and quota passes a quota dependency failure through as its typed refusal CMS-03B-07',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-workflow-refusals.test.ts',
            title:
              'typed refusals the database raises 503 preflight unavailability names the preflight class',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_schedule_refusals.sql',
            title:
              'absent evidence and a failed checker run make accessibility unavailable: 503 DEPENDENCY_UNAVAILABLE with dependencyClass preflight [P2-S11-AC-097]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-schedule-time.test.ts',
            title:
              'integrity of the pinned snapshot answers every schedule command 503 when the snapshot failed its hash check',
          },
        ],
      },
      {
        text: 'timeout',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-quota.test.ts',
            title:
              'port boundary is 504 when the port outlives the route deadline CMS-03B-07',
          },
        ],
      },
      {
        text: 'rate',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-quota.test.ts',
            title:
              'BE00 step 7: capability, step-up and quota answers an exhausted bucket 429 with the rate headers CMS-03B-07',
          },
        ],
      },
      {
        text: 'internal failure to typed ApiError',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-quota.test.ts',
            title:
              'port boundary is 502 when the success payload breaks the resource contract CMS-03B-07',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-operations.test.ts',
            title:
              'response invariants bind the resource to the request CMS-03B-07 refuses a schedule that differs from the request in any time member',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-errors-typed.test.ts',
            title:
              'transport statuses publishes the canonical 502, 504 and 500 envelopes',
          },
        ],
      },
      {
        text: 'preserve safe recovery.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-schedule.apispec.ts',
            title:
              'CMS-03B-07 schedule through the real stack [CMS-03B-07] a missing, stale or future-dated step-up is 401 before any RPC and reserves nothing',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-schedule.apispec.ts',
            title:
              'CMS-03B-07 schedule through the real stack [CMS-03B-07] an unavailable accessibility proof is 503 with Retry-After and no schedule',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-schedule.apispec.ts',
            title:
              'CMS-03B-07 schedule through the real stack [CMS-03B-07] stale approved-review CAS is exact VERSION_MISMATCH with no effects',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-schedule-time.apispec.ts',
            title:
              'CMS-03B-07 pinned time authority through the real stack [CMS-03B-07] a nonexistent local time is the Worker 422 with its two alternatives and reaches no RPC',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-schedule-time.apispec.ts',
            title:
              'CMS-03B-07 pinned time authority through the real stack [CMS-03B-07] spring gap and unresolved fold expose exactly both pinned alternatives',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-errors-typed.test.ts',
            title:
              '422 projection keeps violations beside a typed time-authority token',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-errors.test.ts',
            title:
              '409 projection drops malformed versions and defaults the recovery to reload',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-errors-typed.test.ts',
            title:
              'transport statuses publishes the registered preflight unavailability',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-quota.test.ts',
            title:
              'port boundary projects a typed port refusal through the operation boundary CMS-03B-07',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S11-AC-022',
    text: 'CMS-03B-07: commit audit and outbox effects atomically where applicable, reconcile lost responses without duplicate effects, and emit redacted telemetry.',
    clauses: [
      {
        text: 'CMS-03B-07: commit audit and outbox effects atomically where applicable',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-schedule.apispec.ts',
            title:
              'CMS-03B-07 schedule through the real stack [CMS-03B-07] accepts a future UTC schedule (202 scheduled, never published; Location; strong ETag) and a replay adds nothing',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-schedule-actions.apispec.ts',
            title:
              'CMS-03B-07 exact action and audience schedule identity [CMS-03B-07] publish acceptance changes only schedule, reservation, audit and accessibility groups',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-schedule-actions.apispec.ts',
            title:
              'CMS-03B-07 exact action and audience schedule identity [CMS-03B-07] unpublish acceptance changes only schedule, reservation, audit and accessibility groups',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-schedule-actions.apispec.ts',
            title:
              'CMS-03B-07 exact action and audience schedule identity [CMS-03B-07] expire acceptance changes only schedule, reservation, audit and accessibility groups',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-schedule-actions.apispec.ts',
            title:
              'CMS-03B-07 exact action and audience schedule identity [CMS-03B-07] archive acceptance changes only schedule, reservation, audit and accessibility groups',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_schedule.sql',
            title:
              'exactly one audit record commits with the schedule [P2-S11-AC-022]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_schedule.sql',
            title:
              'no outbox event commits: cms.publication.changed.v1 is emitted only by an executed publication [P2-S11-AC-017]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_evidence_audit.sql',
            title:
              'the schedule wrote exactly one summary row: operation, outcome, blocking count, checker key and version [P2-S11-AC-101]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_schedule_refusals.sql',
            title:
              'every raised refusal above left no schedule, review change, lineage row, reservation, event or audit record behind [P2-S11-AC-018]',
          },
        ],
      },
      {
        text: 'reconcile lost responses without duplicate effects',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-schedule.apispec.ts',
            title:
              'CMS-03B-07 schedule through the real stack [CMS-03B-07] accepts a future UTC schedule (202 scheduled, never published; Location; strong ETag) and a replay adds nothing',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_schedule.sql',
            title:
              'an exact replay returns the stored resource, marks x-cms-idempotent-replay and adds no schedule, audit record, event or reservation [P2-S11-AC-020]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_schedule.sql',
            title:
              'a lost-response retry with the same key and a freshly evaluated accessibility proof is a replay, not an IDEMPOTENCY_MISMATCH (the proof is server-built, not part of the command identity) [P2-S11-AC-020]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_evidence_audit.sql',
            title:
              'an exact replay writes no second summary row [P2-S11-AC-101]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_schedule_refusals.sql',
            title:
              'an exact replay returns the same committed refusal [P2-S11-AC-020]',
          },
        ],
      },
      {
        text: 'emit',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-workflow-telemetry.test.ts',
            title:
              'Slice 11 telemetry classes CMS-03B-07 writes the command, rpc and acceptance events',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-telemetry.test.ts',
            title:
              'refusal metrics counts each refused preflight category by phase',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-workflow-logging.test.ts',
            title:
              'route telemetry through the production sink writes every command and read event without a single rejected event',
          },
        ],
      },
      {
        text: 'redacted telemetry.',
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'No test serializes the CMS-03B-07 telemetry event and asserts that request identifiers (entry, revision, review, schedule ids), frozen hashes and the schedule time members are absent from it; only CMS-03B-05 (workflow-command-facts) and CMS-03B-08 (token) have an operation-specific redaction assertion, so the redaction half of this clause is unproven.',
  },
  {
    criterion: 'P2-S11-AC-023',
    text: 'CMS-03B-08: define strict Zod request, path, query, header, and success contracts and complete the declared happy path — CMS-03B-08 — CMS-13 — POST /api/v1/cms/previews — PreviewRequest → 201 PreviewTokenResource.',
    clauses: [
      {
        text: 'CMS-03B-08: define strict Zod request, path, query, header, and success contracts',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/workflow-requests.test.ts',
            title:
              '[P2-S11-AC-005][P2-S11-AC-011][P2-S11-AC-017][P2-S11-AC-023][P2-S11-AC-029] transport views for the five Slice 11 commands binds the path id, the command headers and the exact request body for each command',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/workflow-requests.test.ts',
            title:
              '[P2-S11-AC-005][P2-S11-AC-011][P2-S11-AC-017][P2-S11-AC-023][P2-S11-AC-029] transport views for the five Slice 11 commands rejects an unknown member, a missing header block and a malformed body',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-schedule-contracts.test.ts',
            title:
              '[P2-S10-AC-046] CMS-03B-08 versionSet rejects unknown keys and mismatched artifact/compiler couplings',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-schedule-contracts.test.ts',
            title:
              '[P2-S10-AC-047] CMS-03B-08 audience/route rejects a backslash route that browser normalization would treat as cross-origin',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-schedule-contracts.test.ts',
            title:
              '[P2-S10-AC-047] CMS-03B-08 audience/route refuses an audience with unsafe characters or outside 1-48',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-schedule-contracts.test.ts',
            title:
              'CMS-03B-05/06/07/08/09 path and header transports binds preview and publication headers as key-plus-If-Match JSON commands',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/workflow-resources.test.ts',
            title:
              '[P2-S11-AC-023] PreviewTokenResource (CMS-03B-08) accepts the exact derived token and rejects unknown keys',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/workflow-resources.test.ts',
            title:
              '[P2-S11-AC-023] PreviewTokenResource (CMS-03B-08) allows only a 43-character unpadded base64url token',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/routes-slice11.test.ts',
            title:
              '[P2-S11-AC-023][P2-S11-AC-026] CMS-03B-08 preview row mints with 201, no public ETag, no Location and no event',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-11-openapi-refinements.test.ts',
            title:
              '[P2-S11-AC-023] preview route publishes its length, leading-slash and normalization rules agrees with the runtime over enumerated normalization cases',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-admission.test.ts',
            title:
              'BE00 step 6: strict query, path and body refuses any query string on a command CMS-03B-08',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-admission.test.ts',
            title:
              'BE00 step 6: strict query, path and body refuses an unknown body member as 422 with a stable pointer CMS-03B-08',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_mint.sql',
            title:
              'the response is exactly PreviewTokenResource (9 members) [P2-S11-AC-023]',
          },
        ],
      },
      {
        text: 'complete the declared happy path — CMS-03B-08 — CMS-13 — POST /api/v1/cms/previews — PreviewRequest → 201 PreviewTokenResource.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview.apispec.ts',
            title:
              'CMS-03B-08 preview mint and the CMS-03B-19 verifier through the real stack [CMS-03B-08] mints a once-only token (201, no-store, no Location), replays it byte-identically and the verifier adapter accepts the bound binding',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview-scopes.apispec.ts',
            title:
              'CMS-03B-08 scope and transport boundaries [CMS-03B-08] owner scope mints with exact binding, lifetime and three-group append delta',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview-scopes.apispec.ts',
            title:
              'CMS-03B-08 scope and transport boundaries [CMS-03B-08] publisher scope mints with exact binding, lifetime and three-group append delta',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview-scopes.apispec.ts',
            title:
              'CMS-03B-08 scope and transport boundaries [CMS-03B-08] reviewer scope mints with exact binding, lifetime and three-group append delta',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-response-headers.test.ts',
            title:
              'CMS-03B-08 public preview response headers returns the accepted 201 token no-store/noindex (RPC replay=false)',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-response-headers.test.ts',
            title:
              'CMS-03B-08 public preview response headers returns the accepted 201 token no-store/noindex (RPC replay=true)',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_mint.sql',
            title: 'an entry assignee mints a preview token [P2-S11-AC-023]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_mint.sql',
            title:
              'an entry editor assignee, an active reviewer assignee of a review of the revision and an owner-party publisher each mint [P2-S11-AC-025]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_mint.sql',
            title:
              'the token is 43 unpadded base64url characters and the resource echoes the exact binding with revoked false [P2-S11-AC-117]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-admission.test.ts',
            title:
              'registers every browser command at its registry path success envelope CMS-03B-08',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S11-AC-024',
    text: 'CMS-03B-08: reject unknown fields and every invalid request value with the exact stable field violation, safe message, and no state mutation.',
    clauses: [
      {
        text: 'CMS-03B-08: reject unknown fields',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview-scopes.apispec.ts',
            title:
              'CMS-03B-08 scope and transport boundaries [CMS-03B-08] caller evidence has one exact safe violation and no mint effects',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview-scopes.apispec.ts',
            title:
              'CMS-03B-08 scope and transport boundaries [CMS-03B-08] caller version has one exact safe violation and no mint effects',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-admission.test.ts',
            title:
              'BE00 step 6: strict query, path and body refuses an unknown body member as 422 with a stable pointer CMS-03B-08',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_mint_refusals.sql',
            title:
              'a missing, unknown (evidence, owner, capability) or malformed member, a non-uuid id and a disagreeing If-Match/expectedVersion are INVALID_REQUEST [P2-S11-AC-024]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_mint_refusals.sql',
            title:
              'a version set that is not an object, lacks a member or carries an unknown one is VALIDATION_FAILED at /versionSet [P2-S11-AC-024]',
          },
        ],
      },
      {
        text: 'every invalid request value with the exact stable field violation, safe message',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview-scopes.apispec.ts',
            title:
              'CMS-03B-08 scope and transport boundaries [CMS-03B-08] query route has one exact safe violation and no mint effects',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview-scopes.apispec.ts',
            title:
              'CMS-03B-08 scope and transport boundaries [CMS-03B-08] fragment route has one exact safe violation and no mint effects',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview-scopes.apispec.ts',
            title:
              'CMS-03B-08 scope and transport boundaries [CMS-03B-08] dot segment has one exact safe violation and no mint effects',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview-scopes.apispec.ts',
            title:
              'CMS-03B-08 scope and transport boundaries [CMS-03B-08] encoded slash has one exact safe violation and no mint effects',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview-scopes.apispec.ts',
            title:
              'CMS-03B-08 scope and transport boundaries [CMS-03B-08] uppercase audience has one exact safe violation and no mint effects',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview-scopes.apispec.ts',
            title:
              'CMS-03B-08 scope and transport boundaries [CMS-03B-08] missing key rejects before RPC and preserves all effects',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview-scopes.apispec.ts',
            title:
              'CMS-03B-08 scope and transport boundaries [CMS-03B-08] missing If-Match rejects before RPC and preserves all effects',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview-scopes.apispec.ts',
            title:
              'CMS-03B-08 scope and transport boundaries [CMS-03B-08] malformed JSON rejects before RPC and preserves all effects',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview-scopes.apispec.ts',
            title:
              'CMS-03B-08 scope and transport boundaries [CMS-03B-08] non-JSON media rejects before RPC and preserves all effects',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_mint_refusals.sql',
            title:
              'a malformed locale (one letter, underscore, 36 characters, non-string) is VALIDATION_FAILED at /locale [P2-S11-AC-024]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_mint_refusals.sql',
            title:
              'an audience outside ^[a-z0-9_-]{1,48}$ (case, padding, empty, 49 characters, space) is VALIDATION_FAILED at /audience, matched as submitted [P2-S11-AC-024]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_mint_refusals.sql',
            title:
              'a route that is empty, relative, a URL, protocol-relative, carries a query, fragment, backslash, control character, dot or empty segment, percent-encoded dot/slash/backslash, or exceeds 2,048 characters is VALIDATION_FAILED at /route [P2-S11-AC-024]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_mint_refusals.sql',
            title:
              'a zero, non-decimal, non-string or over-int64 expectedVersion is VALIDATION_FAILED at /expectedVersion [P2-S11-AC-024]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-admission.test.ts',
            title:
              'BE00 step 6: strict query, path and body refuses malformed JSON as 400 CMS-03B-08',
          },
        ],
      },
      {
        text: 'no state mutation.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview-scopes.apispec.ts',
            title:
              'CMS-03B-08 scope and transport boundaries [CMS-03B-08] query route has one exact safe violation and no mint effects',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview-scopes.apispec.ts',
            title:
              'CMS-03B-08 scope and transport boundaries [CMS-03B-08] caller evidence has one exact safe violation and no mint effects',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview-scopes.apispec.ts',
            title:
              'CMS-03B-08 scope and transport boundaries [CMS-03B-08] malformed JSON rejects before RPC and preserves all effects',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview-scopes.apispec.ts',
            title:
              'CMS-03B-08 scope and transport boundaries [CMS-03B-08] non-JSON media rejects before RPC and preserves all effects',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_mint_refusals.sql',
            title:
              'every refusal and every probed success was rolled back: no token, reservation, audit record, event or settings snapshot remains [P2-S11-AC-027]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S11-AC-025',
    text: 'CMS-03B-08: derive actor and acting context server-side; enforce principal, capability, ownership, scope, and RLS with the specified 401, 403, and 404 boundary.',
    clauses: [
      {
        text: 'CMS-03B-08: derive actor and acting context server-side',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview-scopes.apispec.ts',
            title:
              'CMS-03B-08 scope and transport boundaries [CMS-03B-08] owner scope mints with exact binding, lifetime and three-group append delta',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview-scopes.apispec.ts',
            title:
              'CMS-03B-08 scope and transport boundaries [CMS-03B-08] publisher scope mints with exact binding, lifetime and three-group append delta',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview-scopes.apispec.ts',
            title:
              'CMS-03B-08 scope and transport boundaries [CMS-03B-08] reviewer scope mints with exact binding, lifetime and three-group append delta',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-admission.test.ts',
            title:
              'registers every browser command at its registry path hands the port the validated input and the server-derived session CMS-03B-08',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-workflow.test.ts',
            title:
              'commands bind the named RPC with a server-built request CMS-03B-08',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_mint.sql',
            title:
              'the row holds the server-derived person, user and acting context, the capability snapshot (BE04c actingContextVersion), the exact binding, state active at version 1 and only the token SHA-256 [P2-S11-AC-118]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_mint.sql',
            title:
              "each token is bound to its own minting person and that person's capability snapshot [P2-S11-AC-118]",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_mint.sql',
            title:
              'the resource carries no person, account, acting-party, token-hash or capability-snapshot identifier [P2-S11-AC-025]',
          },
        ],
      },
      {
        text: 'enforce principal, capability, ownership, scope, and RLS',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview-scopes.apispec.ts',
            title:
              'CMS-03B-08 scope and transport boundaries [CMS-03B-08] no session is a strict 401 before RPC with all effects unchanged',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-admission.test.ts',
            title:
              'BE00 steps 4 and 5: session answers an unauthenticated caller 401 before any port CMS-03B-08',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview-scopes.apispec.ts',
            title:
              'CMS-03B-08 scope and transport boundaries [CMS-03B-08] an unassigned reviewer sees a tenant-visible 403 and no token or reservation',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview.apispec.ts',
            title:
              'CMS-03B-08 preview mint and the CMS-03B-19 verifier through the real stack [CMS-03B-08] an unscoped confirmed member is refused by the database, not by the Worker',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-quota.test.ts',
            title:
              'BE00 step 7: capability, step-up and quota leaves scope to the RPC where the row declares rpc_scope CMS-03B-08',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_mint.sql',
            title:
              'an entry editor assignee, an active reviewer assignee of a review of the revision and an owner-party publisher each mint [P2-S11-AC-025]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_mint_refusals.sql',
            title:
              'a member with no scope, an unassigned reviewer, a reviewer assigned to another revision, a revoked reviewer assignment, a revoked entry assignment and a lapsed standing grant are 403 capability_missing with no detail [P2-S11-AC-025]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_mint_refusals.sql',
            title:
              'a non-member, an absent entry, a revision of another entry, an absent revision, another acting party and an archived or held entry are the one concealed NOT_FOUND with no detail [P2-S11-AC-025]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_schema_posture.sql',
            title:
              'posture: row-level security is enabled and forced on every Slice 11 table [P2-S11-AC-119]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_preview_tokens_schema.sql',
            title:
              'token: the owner is the entry owner, never another party [P2-S11-AC-117]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_mint.sql',
            title:
              'cms_mint_preview is a private SECURITY DEFINER of the CMS definer (empty search_path) that no API role, service_role included, can execute [P2-S11-AC-028]',
          },
        ],
      },
      {
        text: 'with the specified 401, 403, and 404 boundary.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview-scopes.apispec.ts',
            title:
              'CMS-03B-08 scope and transport boundaries [CMS-03B-08] no session is a strict 401 before RPC with all effects unchanged',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview-scopes.apispec.ts',
            title:
              'CMS-03B-08 scope and transport boundaries [CMS-03B-08] an unassigned reviewer sees a tenant-visible 403 and no token or reservation',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview-scopes.apispec.ts',
            title:
              'CMS-03B-08 scope and transport boundaries [CMS-03B-08] hidden and absent entries have identical strict safe 404 bodies with own RPC identities',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview.apispec.ts',
            title:
              'CMS-03B-08 preview mint and the CMS-03B-19 verifier through the real stack [CMS-03B-08] an unscoped confirmed member is refused by the database, not by the Worker',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_mint_refusals.sql',
            title:
              'a member with no scope, an unassigned reviewer, a reviewer assigned to another revision, a revoked reviewer assignment, a revoked entry assignment and a lapsed standing grant are 403 capability_missing with no detail [P2-S11-AC-025]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_mint_refusals.sql',
            title:
              'a non-member, an absent entry, a revision of another entry, an absent revision, another acting party and an archived or held entry are the one concealed NOT_FOUND with no detail [P2-S11-AC-025]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S11-AC-026',
    text: 'CMS-03B-08: enforce declared idempotency, If-Match or CAS, duplicate, replay, pagination, cache, rate, deadline, and concurrency rules.',
    clauses: [
      {
        text: 'CMS-03B-08: enforce declared idempotency',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview.apispec.ts',
            title:
              'CMS-03B-08 preview mint and the CMS-03B-19 verifier through the real stack [CMS-03B-08] mints a once-only token (201, no-store, no Location), replays it byte-identically and the verifier adapter accepts the bound binding',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview-scopes.apispec.ts',
            title:
              'CMS-03B-08 scope and transport boundaries [CMS-03B-08] changed route under the same key is an effect-free idempotency conflict',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview-scopes.apispec.ts',
            title:
              'CMS-03B-08 scope and transport boundaries [CMS-03B-08] missing key rejects before RPC and preserves all effects',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_mint.sql',
            title:
              'the idempotency reservation is completed with the command [P2-S11-AC-026]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_mint.sql',
            title:
              'the same key with a changed request is IDEMPOTENCY_MISMATCH [P2-S11-AC-026]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_mint_refusals.sql',
            title:
              'the Idempotency-Key of a refused command is not consumed: the corrected request under the same key mints [P2-S11-AC-026]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-quota.test.ts',
            title:
              'BE00 step 8: Idempotency-Key and strong If-Match requires a printable Idempotency-Key CMS-03B-08',
          },
        ],
      },
      {
        text: 'If-Match or CAS',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview.apispec.ts',
            title:
              'CMS-03B-08 preview mint and the CMS-03B-19 verifier through the real stack [CMS-03B-08] a stale version set is 409 version_set_stale and a stale entry version is 409 VERSION_MISMATCH with the safe versions',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview-scopes.apispec.ts',
            title:
              'CMS-03B-08 scope and transport boundaries [CMS-03B-08] stale schemaHash is checked against canonical state without effects',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview-scopes.apispec.ts',
            title:
              'CMS-03B-08 scope and transport boundaries [CMS-03B-08] stale settingsVersion is checked against canonical state without effects',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview-scopes.apispec.ts',
            title:
              'CMS-03B-08 scope and transport boundaries [CMS-03B-08] stale taxonomyVersionIds is checked against canonical state without effects',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview-scopes.apispec.ts',
            title:
              'CMS-03B-08 scope and transport boundaries [CMS-03B-08] stale blockVersionIds is checked against canonical state without effects',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview-scopes.apispec.ts',
            title:
              'CMS-03B-08 scope and transport boundaries [CMS-03B-08] stale patternVersionIds is checked against canonical state without effects',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview-scopes.apispec.ts',
            title:
              'CMS-03B-08 scope and transport boundaries [CMS-03B-08] missing If-Match rejects before RPC and preserves all effects',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_mint_refusals.sql',
            title:
              'a stale entry If-Match is VERSION_MISMATCH carrying the expected and current versions only [P2-S11-AC-026]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_mint_refusals.sql',
            title:
              'the entry-version check runs before the version-set check (a stale CAS wins over a stale set) [P2-S11-AC-026]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_mint_refusals.sql',
            title:
              'a version set that differs from the one recomputed from canonical state (schema hash, block ids, template, settings version) is 409 version_set_stale [P2-S11-AC-089]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-quota.test.ts',
            title:
              'BE00 step 8: Idempotency-Key and strong If-Match requires an exact strong If-Match CMS-03B-08',
          },
        ],
      },
      {
        text: 'duplicate, replay',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview.apispec.ts',
            title:
              'CMS-03B-08 preview mint and the CMS-03B-19 verifier through the real stack [CMS-03B-08] mints a once-only token (201, no-store, no Location), replays it byte-identically and the verifier adapter accepts the bound binding',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_mint.sql',
            title:
              'an exact replay re-derives the identical token (same resource) and adds no second token row, audit record, reservation or event [P2-S11-AC-117]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_mint.sql',
            title:
              'a new Idempotency-Key mints a new token with a fresh nonce; both tokens stay valid until their own expiry [P2-S11-AC-117]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_mint.sql',
            title:
              'an exact replay after the entry version moved still returns the same token: replay is answered before the If-Match check [P2-S11-AC-026]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_mint.sql',
            title:
              'a replay after the token expired is the typed preview_expired (a new key mints a new token) [P2-S11-AC-117]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_mint.sql',
            title:
              'a replay after the token was revoked is the typed preview_expired [P2-S11-AC-117]',
          },
        ],
      },
      {
        text: 'pagination, cache',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-admission.test.ts',
            title:
              'BE00 step 6: strict query, path and body refuses any query string on a command CMS-03B-08',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview-scopes.apispec.ts',
            title:
              'CMS-03B-08 scope and transport boundaries [CMS-03B-08] preview token response prohibits indexing as well as storage',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-response-headers.test.ts',
            title:
              'CMS-03B-08 public preview response headers returns the accepted 201 token no-store/noindex (RPC replay=false)',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-admission.test.ts',
            title:
              'registers every browser command at its registry path success envelope CMS-03B-08',
          },
        ],
      },
      {
        text: 'rate, deadline',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-quota.test.ts',
            title:
              'BE00 step 7: capability, step-up and quota enforces the user and party buckets from the registry row CMS-03B-08',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-quota.test.ts',
            title:
              'BE00 step 7: capability, step-up and quota answers an exhausted bucket 429 with the rate headers CMS-03B-08',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-quota.test.ts',
            title:
              'port boundary is 504 when the port outlives the route deadline CMS-03B-08',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-workflow.test.ts',
            title:
              'transport constants follow the registry names an RPC, deadline, quota and rate class equal to each registry row',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/routes-slice11.test.ts',
            title:
              '[P2-S11-AC-023][P2-S11-AC-026] CMS-03B-08 preview row limits 60/120 per minute in the preview class, 8 s, Tier 1',
          },
        ],
      },
      {
        text: 'concurrency rules.',
        citations: [
          {
            tool: 'race',
            file: 'supabase/tests/phase_02_slice_11_races/020-preview-mint-race.mjs',
            title: 'M1: one token row and one audit record exist',
          },
          {
            tool: 'race',
            file: 'supabase/tests/phase_02_slice_11_races/020-preview-mint-race.mjs',
            title: 'M1: the minted token verifies for its owner',
          },
          {
            tool: 'race',
            file: 'supabase/tests/phase_02_slice_11_races/020-preview-mint-race.mjs',
            title: 'M2: one token row exists',
          },
          {
            tool: 'race',
            file: 'supabase/tests/phase_02_slice_11_races/020-preview-mint-race.mjs',
            title:
              'M3: the grant revocation waits on the share locks the parked mint holds',
          },
          {
            tool: 'race',
            file: 'supabase/tests/phase_02_slice_11_races/020-preview-mint-race.mjs',
            title:
              'M4: the mint waits on the authority rows the uncommitted revocation holds',
          },
          {
            tool: 'race',
            file: 'supabase/tests/phase_02_slice_11_races/020-preview-mint-race.mjs',
            title:
              'M5: archiving the entry waits on the entry row the parked mint holds FOR SHARE',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S11-AC-027',
    text: 'CMS-03B-08: map every declared domain, dependency, timeout, rate, and internal failure to typed ApiError and preserve safe recovery.',
    clauses: [
      {
        text: 'CMS-03B-08: map every declared domain',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview.apispec.ts',
            title:
              'CMS-03B-08 preview mint and the CMS-03B-19 verifier through the real stack [CMS-03B-08] a stale version set is 409 version_set_stale and a stale entry version is 409 VERSION_MISMATCH with the safe versions',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview-scopes.apispec.ts',
            title:
              'CMS-03B-08 scope and transport boundaries [CMS-03B-08] stale schemaHash is checked against canonical state without effects',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview-scopes.apispec.ts',
            title:
              'CMS-03B-08 scope and transport boundaries [CMS-03B-08] stale settingsVersion is checked against canonical state without effects',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview-scopes.apispec.ts',
            title:
              'CMS-03B-08 scope and transport boundaries [CMS-03B-08] changed route under the same key is an effect-free idempotency conflict',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview.apispec.ts',
            title:
              'CMS-03B-08 preview mint and the CMS-03B-19 verifier through the real stack [CMS-03B-08] an unscoped confirmed member is refused by the database, not by the Worker',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview-scopes.apispec.ts',
            title:
              'CMS-03B-08 scope and transport boundaries [CMS-03B-08] hidden and absent entries have identical strict safe 404 bodies with own RPC identities',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_mint.sql',
            title:
              'a replay after the token expired is the typed preview_expired (a new key mints a new token) [P2-S11-AC-117]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_mint.sql',
            title:
              'when no current key reproduces the stored hash the replay is preview_expired, never a different token [P2-S11-AC-117]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-workflow-refusals.test.ts',
            title:
              'typed refusals the database raises 409 idempotency mismatch and a database outage',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/refusals.test.ts',
            title:
              '[P2-S11-AC-009][P2-S11-AC-021][P2-S11-AC-027][P2-S11-AC-033] closed Slice 11 reason catalog names for each browser operation exactly the ordered tokens its matrix row allows',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_mint_refusals.sql',
            title:
              'a version set that differs from the one recomputed from canonical state (schema hash, block ids, template, settings version) is 409 version_set_stale [P2-S11-AC-089]',
          },
        ],
      },
      {
        text: 'dependency',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_mint_refusals.sql',
            title:
              'without an active Vault signing key a scoped caller gets DEPENDENCY_UNAVAILABLE (nothing is minted) while a caller without scope still gets only the 403 [P2-S11-AC-027]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-quota.test.ts',
            title:
              'port boundary is 503 when the port is not composed CMS-03B-08',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-quota.test.ts',
            title:
              'BE00 step 7: capability, step-up and quota passes a quota dependency failure through as its typed refusal CMS-03B-08',
          },
        ],
      },
      {
        text: 'timeout',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-quota.test.ts',
            title:
              'port boundary is 504 when the port outlives the route deadline CMS-03B-08',
          },
        ],
      },
      {
        text: 'rate',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-quota.test.ts',
            title:
              'BE00 step 7: capability, step-up and quota answers an exhausted bucket 429 with the rate headers CMS-03B-08',
          },
        ],
      },
      {
        text: 'internal failure to typed ApiError',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-response-headers.test.ts',
            title:
              'CMS-03B-08 public preview response headers refuses a mismatched token binding with a scrubbed 502',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-quota.test.ts',
            title:
              'port boundary is 502 when the success payload breaks the resource contract CMS-03B-08',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-operations.test.ts',
            title:
              'response invariants bind the resource to the request CMS-03B-08 refuses a token bound to anything the caller did not ask for',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-errors-typed.test.ts',
            title:
              'transport statuses publishes the canonical 502, 504 and 500 envelopes',
          },
        ],
      },
      {
        text: 'preserve safe recovery.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview.apispec.ts',
            title:
              'CMS-03B-08 preview mint and the CMS-03B-19 verifier through the real stack [CMS-03B-08] a stale version set is 409 version_set_stale and a stale entry version is 409 VERSION_MISMATCH with the safe versions',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-quota.test.ts',
            title:
              'port boundary projects a typed port refusal through the operation boundary CMS-03B-08',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-errors.test.ts',
            title:
              '409 projection drops malformed versions and defaults the recovery to reload',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-errors-typed.test.ts',
            title: 'transport statuses keeps the bounded rate details of a 429',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_mint_refusals.sql',
            title:
              'every refusal and every probed success was rolled back: no token, reservation, audit record, event or settings snapshot remains [P2-S11-AC-027]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_mint.sql',
            title:
              'a replay after the token was revoked is the typed preview_expired [P2-S11-AC-117]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S11-AC-028',
    text: 'CMS-03B-08: commit audit and outbox effects atomically where applicable, reconcile lost responses without duplicate effects, and emit redacted telemetry.',
    clauses: [
      {
        text: 'CMS-03B-08: commit audit and outbox effects atomically where applicable',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview-scopes.apispec.ts',
            title:
              'CMS-03B-08 scope and transport boundaries [CMS-03B-08] owner scope mints with exact binding, lifetime and three-group append delta',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview-scopes.apispec.ts',
            title:
              'CMS-03B-08 scope and transport boundaries [CMS-03B-08] publisher scope mints with exact binding, lifetime and three-group append delta',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview-scopes.apispec.ts',
            title:
              'CMS-03B-08 scope and transport boundaries [CMS-03B-08] reviewer scope mints with exact binding, lifetime and three-group append delta',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_mint.sql',
            title:
              'exactly one audit record commits and NO outbox event is emitted (BE03b: audit, no outbox) [P2-S11-AC-028]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_mint.sql',
            title:
              'the plaintext token is persisted nowhere: not in the token table, the idempotency record, the audit trail or the outbox [P2-S11-AC-117]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_mint_refusals.sql',
            title:
              'every refusal and every probed success was rolled back: no token, reservation, audit record, event or settings snapshot remains [P2-S11-AC-027]',
          },
          {
            tool: 'race',
            file: 'supabase/tests/phase_02_slice_11_races/020-preview-mint-race.mjs',
            title: 'M1: one token row and one audit record exist',
          },
        ],
      },
      {
        text: 'reconcile lost responses without duplicate effects',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview.apispec.ts',
            title:
              'CMS-03B-08 preview mint and the CMS-03B-19 verifier through the real stack [CMS-03B-08] mints a once-only token (201, no-store, no Location), replays it byte-identically and the verifier adapter accepts the bound binding',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_mint.sql',
            title:
              'an exact replay re-derives the identical token (same resource) and adds no second token row, audit record, reservation or event [P2-S11-AC-117]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_mint.sql',
            title:
              'the stored idempotent response is the resource WITHOUT the token (the token is re-derived on replay) [P2-S11-AC-117]',
          },
          {
            tool: 'race',
            file: 'supabase/tests/phase_02_slice_11_races/020-preview-mint-race.mjs',
            title: 'M1: one token row and one audit record exist',
          },
        ],
      },
      {
        text: 'emit redacted telemetry.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-operations.test.ts',
            title:
              'published validators CMS-03B-08 publishes the token once and neither validator nor log keeps it',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-workflow-telemetry.test.ts',
            title:
              'Slice 11 telemetry classes CMS-03B-08 writes the command, rpc and acceptance events',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-workflow-logging.test.ts',
            title:
              'route telemetry through the production sink writes every command and read event without a single rejected event',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_mint.sql',
            title:
              'the plaintext token is persisted nowhere: not in the token table, the idempotency record, the audit trail or the outbox [P2-S11-AC-117]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S11-AC-029',
    text: 'CMS-03B-09: define strict Zod request, path, query, header, and success contracts and complete the declared happy path — CMS-03B-09 — CMS-13 — POST /api/v1/cms/publications — PublicationRequest → 202 PublicationResource.',
    clauses: [
      {
        text: 'CMS-03B-09: define strict Zod request, path, query, header, and success contracts',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/workflow-requests.test.ts',
            title:
              '[P2-S11-AC-005][P2-S11-AC-011][P2-S11-AC-017][P2-S11-AC-023][P2-S11-AC-029] transport views for the five Slice 11 commands binds the path id, the command headers and the exact request body for each command',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/workflow-requests.test.ts',
            title:
              '[P2-S11-AC-005][P2-S11-AC-011][P2-S11-AC-017][P2-S11-AC-023][P2-S11-AC-029] transport views for the five Slice 11 commands rejects an unknown member, a missing header block and a malformed body',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-schedule-contracts.test.ts',
            title:
              '[P2-S10-AC-048] CMS-03B-09 frozenHash/expectedVersionSet rejects a non-canonical frozenHash and an invalid version set',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/publication-schedule-contracts.test.ts',
            title:
              'CMS-03B-05/06/07/08/09 path and header transports binds preview and publication headers as key-plus-If-Match JSON commands',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/workflow-resources.test.ts',
            title:
              '[P2-S11-AC-029] PublicationResource (CMS-03B-09) rejects unknown keys and a wrong event type',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/workflow-resources.test.ts',
            title:
              '[P2-S11-AC-029] PublicationResource (CMS-03B-09) keeps the closed state and projection vocabularies',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/workflow-resources.test.ts',
            title:
              '[P2-S11-AC-029] PublicationResource (CMS-03B-09) derives the state from the action: only a publish row is active or superseded (E3)',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/routes-slice11.test.ts',
            title:
              '[P2-S11-AC-029][P2-S11-AC-032] CMS-03B-09 publication row accepts with 202, a strong lineage ETag and Location, and emits the publication event',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-admission.test.ts',
            title:
              'BE00 step 6: strict query, path and body refuses any query string on a command CMS-03B-09',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-admission.test.ts',
            title:
              'BE00 step 6: strict query, path and body refuses an unknown body member as 422 with a stable pointer CMS-03B-09',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_publish.sql',
            title:
              'the response is exactly PublicationResource (14 members) [P2-S11-AC-029]',
          },
        ],
      },
      {
        text: 'complete the declared happy path — CMS-03B-09 — CMS-13 — POST /api/v1/cms/publications — PublicationRequest → 202 PublicationResource.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-publish.apispec.ts',
            title:
              'CMS-03B-09 publish through the real stack [CMS-03B-09] publishes an approved review (202, Location, strong ETag) exactly once and a replay adds nothing',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-publish.apispec.ts',
            title:
              'CMS-03B-09 publish through the real stack [CMS-03B-09] a counted approver who is not the revision author publishes normally (202 active)',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-publish-lineage.apispec.ts',
            title:
              'CMS-03B-09 append-only publication lineage [CMS-03B-09] first and successor publications independently match JCS hashes and exact fourteen-group append effects',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_publish.sql',
            title:
              'the owner-party publisher publishes an approved revision [P2-S11-AC-029]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_publish.sql',
            title:
              'the first row of a lineage is an active head at version 1 whose lineage id is its own id, with projectionState pending [P2-S11-AC-114]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_publish.sql',
            title:
              'a second publish appends version 2 of the same lineage (stable id, new row id); another audience starts its own lineage at version 1 [P2-S11-AC-114]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-admission.test.ts',
            title:
              'registers every browser command at its registry path success envelope CMS-03B-09',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S11-AC-030',
    text: 'CMS-03B-09: reject unknown fields and every invalid request value with the exact stable field violation, safe message, and no state mutation.',
    clauses: [
      {
        text: 'CMS-03B-09: reject unknown fields',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-publish-preflight.apispec.ts',
            title:
              'CMS-03B-09 publication admission and preflight composition [CMS-03B-09] unpublish action is rejected before RPC with a closed field violation',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-publish-preflight.apispec.ts',
            title:
              'CMS-03B-09 publication admission and preflight composition [CMS-03B-09] caller owner is rejected before RPC with a closed field violation',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-publish-preflight.apispec.ts',
            title:
              'CMS-03B-09 publication admission and preflight composition [CMS-03B-09] caller evidence is rejected before RPC with a closed field violation',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-admission.test.ts',
            title:
              'BE00 step 6: strict query, path and body refuses an unknown body member as 422 with a stable pointer CMS-03B-09',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_publish_refusals.sql',
            title:
              'an unknown key (action), a missing member, malformed ids, If-Match disagreeing with expectedVersion and a non-object proof are INVALID_REQUEST [P2-S11-AC-030]',
          },
        ],
      },
      {
        text: 'every invalid request value with the exact stable field violation, safe message',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-publish-preflight.apispec.ts',
            title:
              'CMS-03B-09 publication admission and preflight composition [CMS-03B-09] uppercase audience is rejected before RPC with a closed field violation',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-publish-preflight.apispec.ts',
            title:
              'CMS-03B-09 publication admission and preflight composition [CMS-03B-09] padded audience is rejected before RPC with a closed field violation',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-publish-preflight.apispec.ts',
            title:
              'CMS-03B-09 publication admission and preflight composition [CMS-03B-09] oversized audience is rejected before RPC with a closed field violation',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-publish-preflight.apispec.ts',
            title:
              'CMS-03B-09 publication admission and preflight composition [CMS-03B-09] malformed JSON is a strict transport refusal with no effects',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-publish-preflight.apispec.ts',
            title:
              'CMS-03B-09 publication admission and preflight composition [CMS-03B-09] non-JSON media is a strict transport refusal with no effects',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-publish-preflight.apispec.ts',
            title:
              'CMS-03B-09 publication admission and preflight composition [CMS-03B-09] conflicting body/header operands are strict 400 before the accessibility load',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-publish.apispec.ts',
            title:
              'CMS-03B-09 publish through the real stack [CMS-03B-09] a stale expected version set is 409 version_set_stale and a wrong frozenHash is 422 at /frozenHash',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_publish_refusals.sql',
            title:
              'every invalid field is VALIDATION_FAILED at its RFC 6901 pointer: frozenHash, the version set shape, the audience grammar, expectedVersion and If-Match [P2-S11-AC-030]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_publish_refusals.sql',
            title:
              'several invalid fields are reported together, in request order [P2-S11-AC-030]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_publish_refusals.sql',
            title:
              "a frozenHash that is not the approved review's frozen hash is 422 at /frozenHash [P2-S11-AC-030]",
          },
        ],
      },
      {
        text: 'no state mutation.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-publish-preflight.apispec.ts',
            title:
              'CMS-03B-09 publication admission and preflight composition [CMS-03B-09] unpublish action is rejected before RPC with a closed field violation',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-publish-preflight.apispec.ts',
            title:
              'CMS-03B-09 publication admission and preflight composition [CMS-03B-09] uppercase audience is rejected before RPC with a closed field violation',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-publish-preflight.apispec.ts',
            title:
              'CMS-03B-09 publication admission and preflight composition [CMS-03B-09] malformed JSON is a strict transport refusal with no effects',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-publish-preflight.apispec.ts',
            title:
              'CMS-03B-09 publication admission and preflight composition [CMS-03B-09] conflicting body/header operands are strict 400 before the accessibility load',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-publish.apispec.ts',
            title:
              'CMS-03B-09 publish through the real stack [CMS-03B-09] a stale expected version set is 409 version_set_stale and a wrong frozenHash is 422 at /frozenHash',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_publish_refusals.sql',
            title:
              'every raised refusal above left no lineage row, review change, schedule, reservation, event or audit record behind [P2-S11-AC-030]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S11-AC-031',
    text: 'CMS-03B-09: derive actor and acting context server-side; enforce principal, capability, ownership, scope, and RLS with the specified 401, 403, and 404 boundary.',
    clauses: [
      {
        text: 'CMS-03B-09: derive actor and acting context server-side',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-admission.test.ts',
            title:
              'registers every browser command at its registry path hands the port the validated input and the server-derived session CMS-03B-09',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-workflow.test.ts',
            title:
              'commands bind the named RPC with a server-built request CMS-03B-09',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-publish-preflight.apispec.ts',
            title:
              'CMS-03B-09 publication admission and preflight composition [CMS-03B-09] healthy Worker evidence is bound to the approved revision and real publish command',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_publish.sql',
            title:
              "the lineage row stores the server-derived publisher, the review's dependency hash and activation evidence hash, the frozen version set and the publication hash [P2-S11-AC-114]",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_publish.sql',
            title:
              'the response carries no publisher, author, submitter, reviewer, party, account or review identifier [P2-S11-AC-031]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-publish-preflight.apispec.ts',
            title:
              'CMS-03B-09 publication admission and preflight composition [CMS-03B-09] caller owner is rejected before RPC with a closed field violation',
          },
        ],
      },
      {
        text: 'enforce principal, capability, ownership, scope, and RLS',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-publish-preflight.apispec.ts',
            title:
              'CMS-03B-09 publication admission and preflight composition [CMS-03B-09] missing session is strict 401 before any RPC or persisted effect',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-admission.test.ts',
            title:
              'BE00 steps 4 and 5: session answers an unauthenticated caller 401 before any port CMS-03B-09',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-publish.apispec.ts',
            title:
              'CMS-03B-09 publish through the real stack [CMS-03B-09] a missing, stale or future-dated step-up is 401 STEP_UP_REQUIRED before any RPC and any idempotency reservation',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-quota.test.ts',
            title:
              'BE00 step 7: capability, step-up and quota answers a stale MFA proof 401 STEP_UP_REQUIRED before quota and RPC CMS-03B-09',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-publish.apispec.ts',
            title:
              'CMS-03B-09 publish through the real stack [CMS-03B-09] a session without cms.publisher is 403 at the Worker; a session claiming it without the database grant is capability_missing from the database',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-quota.test.ts',
            title:
              'BE00 step 7: capability, step-up and quota refuses a session without the registry capability with capability_missing CMS-03B-09',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-publish.apispec.ts',
            title:
              'CMS-03B-09 publish through the real stack [CMS-03B-09] the author of the revision may not publish it even with a standing publisher grant: 403 separation_of_duties and no effects',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_publish_refusals.sql',
            title:
              'a visible target without the owner-party cms.publisher grant is 403 capability_missing: the entry assignee, the assigned reviewer and the owner [P2-S11-AC-031]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_publish_refusals.sql',
            title:
              'a non-member, a member with no scope, an absent revision and a revision of another entry are the same byte-identical NOT_FOUND [P2-S11-AC-031]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_publish_refusals.sql',
            title:
              'the human who authored the revision cannot publish it (E11) [P2-S11-AC-107]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_schema_posture.sql',
            title:
              'posture: row-level security is enabled and forced on every Slice 11 table [P2-S11-AC-119]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_publish.sql',
            title:
              'cms_publish_revision is a private SECURITY DEFINER of the CMS definer (empty search_path) that no API role, service_role included, can execute [P2-S11-AC-034]',
          },
        ],
      },
      {
        text: 'with the specified 401, 403, and 404 boundary.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-publish-preflight.apispec.ts',
            title:
              'CMS-03B-09 publication admission and preflight composition [CMS-03B-09] missing session is strict 401 before any RPC or persisted effect',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-publish.apispec.ts',
            title:
              'CMS-03B-09 publish through the real stack [CMS-03B-09] a missing, stale or future-dated step-up is 401 STEP_UP_REQUIRED before any RPC and any idempotency reservation',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-publish.apispec.ts',
            title:
              'CMS-03B-09 publish through the real stack [CMS-03B-09] a session without cms.publisher is 403 at the Worker; a session claiming it without the database grant is capability_missing from the database',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-publish.apispec.ts',
            title:
              'CMS-03B-09 publish through the real stack [CMS-03B-09] the author of the revision may not publish it even with a standing publisher grant: 403 separation_of_duties and no effects',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-publish-preflight.apispec.ts',
            title:
              'CMS-03B-09 publication admission and preflight composition [CMS-03B-09] hidden and absent targets share the exact safe 404 with distinct request and RPC identities',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_publish_refusals.sql',
            title:
              'a visible target without the owner-party cms.publisher grant is 403 capability_missing: the entry assignee, the assigned reviewer and the owner [P2-S11-AC-031]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_publish_refusals.sql',
            title:
              'a non-member, a member with no scope, an absent revision and a revision of another entry are the same byte-identical NOT_FOUND [P2-S11-AC-031]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S11-AC-032',
    text: 'CMS-03B-09: enforce declared idempotency, If-Match or CAS, duplicate, replay, pagination, cache, rate, deadline, and concurrency rules.',
    clauses: [
      {
        text: 'CMS-03B-09: enforce declared idempotency',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-publish.apispec.ts',
            title:
              'CMS-03B-09 publish through the real stack [CMS-03B-09] publishes an approved review (202, Location, strong ETag) exactly once and a replay adds nothing',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-publish-lineage.apispec.ts',
            title:
              'CMS-03B-09 append-only publication lineage [CMS-03B-09] first and successor publications independently match JCS hashes and exact fourteen-group append effects',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_publish.sql',
            title:
              'the idempotency reservation is completed with the 202 acceptance [P2-S11-AC-032]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_publish.sql',
            title:
              'the same key with a changed audience is IDEMPOTENCY_MISMATCH [P2-S11-AC-032]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_publish.sql',
            title:
              'a lost-response retry with the same key and a freshly evaluated accessibility proof is a replay, not an IDEMPOTENCY_MISMATCH [P2-S11-AC-032]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-quota.test.ts',
            title:
              'BE00 step 8: Idempotency-Key and strong If-Match requires a printable Idempotency-Key CMS-03B-09',
          },
        ],
      },
      {
        text: 'If-Match or CAS',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-publish.apispec.ts',
            title:
              'CMS-03B-09 publish through the real stack [CMS-03B-09] a stale review version is 409 VERSION_MISMATCH with the safe expected and current versions',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-publish-preflight.apispec.ts',
            title:
              'CMS-03B-09 publication admission and preflight composition [CMS-03B-09] conflicting body/header operands are strict 400 before the accessibility load',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_publish_refusals.sql',
            title:
              'a stale approved-review version is 409 VERSION_MISMATCH carrying only the expected and current versions [P2-S11-AC-032]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_publish_refusals.sql',
            title:
              'an invalidation advances the review version, so a command against an invalidated approval is VERSION_MISMATCH [P2-S11-AC-032]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-quota.test.ts',
            title:
              'BE00 step 8: Idempotency-Key and strong If-Match requires an exact strong If-Match CMS-03B-09',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-quota.test.ts',
            title:
              'BE00 step 8: Idempotency-Key and strong If-Match refuses an If-Match that disagrees with the body expectedVersion as 400 CMS-03B-09',
          },
        ],
      },
      {
        text: 'duplicate, replay',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-publish.apispec.ts',
            title:
              'CMS-03B-09 publish through the real stack [CMS-03B-09] publishes an approved review (202, Location, strong ETag) exactly once and a replay adds nothing',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-publish.apispec.ts',
            title:
              'CMS-03B-09 publish through the real stack [CMS-03B-09] a stale frozen manifest is the COMMITTED refusal: HTTP 200 on the wire, 409 dependency_changed with the current hash for the browser, the review stays invalidated and a replay answers the same 409',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-publish-lineage.apispec.ts',
            title:
              'CMS-03B-09 append-only publication lineage [CMS-03B-09] first and successor publications independently match JCS hashes and exact fourteen-group append effects',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_publish.sql',
            title:
              'an exact replay returns the stored resource, marks x-cms-idempotent-replay and adds no lineage row, audit record, event or reservation [P2-S11-AC-032]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_publish_refusals.sql',
            title:
              'an exact replay returns the same committed refusal [P2-S11-AC-032]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_publication_lineage_schema.sql',
            title:
              'lineage: a second lineage for the same entry, locale and audience is refused by the lineage key [P2-S11-AC-115]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_publication_lineage_schema.sql',
            title:
              'lineage: a successor of a row that is no longer the head loses with publication_conflict [P2-S11-AC-115]',
          },
        ],
      },
      {
        text: 'pagination, cache',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-admission.test.ts',
            title:
              'BE00 step 6: strict query, path and body refuses any query string on a command CMS-03B-09',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-admission.test.ts',
            title:
              'registers every browser command at its registry path success envelope CMS-03B-09',
          },
        ],
      },
      {
        text: 'rate, deadline',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-quota.test.ts',
            title:
              'BE00 step 7: capability, step-up and quota enforces the user and party buckets from the registry row CMS-03B-09',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-quota.test.ts',
            title:
              'BE00 step 7: capability, step-up and quota answers an exhausted bucket 429 with the rate headers CMS-03B-09',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-response-headers.test.ts',
            title:
              'CMS-03B-09 public publication response headers returns the exact 429 quota tuple before any RPC',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-quota.test.ts',
            title:
              'port boundary is 504 when the port outlives the route deadline CMS-03B-09',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-workflow.test.ts',
            title:
              'transport constants follow the registry names an RPC, deadline, quota and rate class equal to each registry row',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/routes-slice11.test.ts',
            title:
              '[P2-S11-AC-029][P2-S11-AC-032] CMS-03B-09 publication row limits 20/40 per minute in the publish class, 15 s acceptance, Tier 2',
          },
        ],
      },
      {
        text: 'concurrency rules.',
        citations: [
          {
            tool: 'race',
            file: 'supabase/tests/phase_02_slice_11_races/014-publication-execute-race.mjs',
            title:
              'E2: exactly one event and one audit record per appended row, no typed conflict and no deadlock',
          },
          {
            tool: 'race',
            file: 'supabase/tests/phase_02_slice_11_races/014-publication-execute-race.mjs',
            title:
              'E5: a revision append BLOCKS behind a publish parked after taking the entry row FOR SHARE and its authority locks',
          },
          {
            tool: 'race',
            file: 'supabase/tests/phase_02_slice_11_races/014-publication-execute-race.mjs',
            title:
              'E6: a publish BLOCKS behind an append holding the entry row FOR UPDATE',
          },
          {
            tool: 'race',
            file: 'supabase/tests/phase_02_slice_11_races/016-lineage-append-race.mjs',
            title:
              'L1: a second append to the same head BLOCKS on the lineage advisory lock while the first is parked before its insert',
          },
          {
            tool: 'race',
            file: 'supabase/tests/phase_02_slice_11_races/016-lineage-append-race.mjs',
            title:
              'L2: versions 1..6 exactly (no duplicate, no gap), each answered once, one event per row',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S11-AC-033',
    text: 'CMS-03B-09: map every declared domain, dependency, timeout, rate, and internal failure to typed ApiError and preserve safe recovery.',
    clauses: [
      {
        text: 'CMS-03B-09: map every declared domain',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-publish.apispec.ts',
            title:
              'CMS-03B-09 publish through the real stack [CMS-03B-09] the author of the revision may not publish it even with a standing publisher grant: 403 separation_of_duties and no effects',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-publish.apispec.ts',
            title:
              'CMS-03B-09 publish through the real stack [CMS-03B-09] a stale review version is 409 VERSION_MISMATCH with the safe expected and current versions',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-publish.apispec.ts',
            title:
              'CMS-03B-09 publish through the real stack [CMS-03B-09] a stale expected version set is 409 version_set_stale and a wrong frozenHash is 422 at /frozenHash',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-publish.apispec.ts',
            title:
              'CMS-03B-09 publish through the real stack [CMS-03B-09] a stale frozen manifest is the COMMITTED refusal: HTTP 200 on the wire, 409 dependency_changed with the current hash for the browser, the review stays invalidated and a replay answers the same 409',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-publish-preflight.apispec.ts',
            title:
              'CMS-03B-09 publication admission and preflight composition [CMS-03B-09] open review cannot publish and leaves all fourteen groups unchanged',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-publish-preflight.apispec.ts',
            title:
              'CMS-03B-09 publication admission and preflight composition [CMS-03B-09] rejected review cannot publish and leaves all fourteen groups unchanged',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-workflow-refusals.test.ts',
            title:
              'typed refusals the database raises 403 capability_missing and separation_of_duties',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-workflow-refusals.test.ts',
            title:
              'typed refusals the database raises 422 preflight_failed carries bare entries from an object DETAIL',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/refusals.test.ts',
            title:
              '[P2-S11-AC-009][P2-S11-AC-021][P2-S11-AC-027][P2-S11-AC-033] closed Slice 11 reason catalog names for each browser operation exactly the ordered tokens its matrix row allows',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_publish_refusals.sql',
            title:
              'a failed category refuses 422 preflight_failed; the DETAIL lists all 17 {category, outcome, reasonCode} entries and nothing else [P2-S11-AC-097]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_publish_refusals.sql',
            title:
              'an expectedVersionSet that is not exactly the version set frozen on the approved review (schema, settings or taxonomy member) is 409 version_set_stale [P2-S11-AC-033]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_publish_refusals.sql',
            title:
              'a revision whose latest review is invalidated, rejected or open, or that was never reviewed, cannot be published: CONFLICT [P2-S11-AC-033]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_publication_lineage_schema.sql',
            title:
              'lineage: a successor of a row that is no longer the head loses with publication_conflict [P2-S11-AC-115]',
          },
        ],
      },
      {
        text: 'dependency',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-publish.apispec.ts',
            title:
              'CMS-03B-09 publish through the real stack [CMS-03B-09] an unavailable accessibility proof is 503 DEPENDENCY_UNAVAILABLE with Retry-After and nothing is committed',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-publish-preflight.apispec.ts',
            title:
              'CMS-03B-09 publication admission and preflight composition [CMS-03B-09] command transport outage preserves every group and carries retry and quota headers',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-publish-preflight.apispec.ts',
            title:
              'CMS-03B-09 publication admission and preflight composition [CMS-03B-09] failed input load sends an own null proof and a strict preflight refusal without effects',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-response-headers.test.ts',
            title:
              "CMS-03B-09 public publication response headers retains admitted quota on retryable 503 'preflight'",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-response-headers.test.ts',
            title:
              "CMS-03B-09 public publication response headers retains admitted quota on retryable 503 'cms_editorial'",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-quota.test.ts',
            title:
              'port boundary is 503 when the port is not composed CMS-03B-09',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-quota.test.ts',
            title:
              'BE00 step 7: capability, step-up and quota passes a quota dependency failure through as its typed refusal CMS-03B-09',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_publish_refusals.sql',
            title:
              'absent evidence and a failed checker run make accessibility unavailable: 503 DEPENDENCY_UNAVAILABLE with dependencyClass preflight [P2-S11-AC-097]',
          },
        ],
      },
      {
        text: 'timeout',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-quota.test.ts',
            title:
              'port boundary is 504 when the port outlives the route deadline CMS-03B-09',
          },
        ],
      },
      {
        text: 'rate',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-response-headers.test.ts',
            title:
              'CMS-03B-09 public publication response headers returns the exact 429 quota tuple before any RPC',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-quota.test.ts',
            title:
              'BE00 step 7: capability, step-up and quota answers an exhausted bucket 429 with the rate headers CMS-03B-09',
          },
        ],
      },
      {
        text: 'internal failure to typed ApiError',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-response-headers.test.ts',
            title:
              'CMS-03B-09 public publication response headers does not advertise Retry-After on nonretryable 502',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-response-headers.test.ts',
            title:
              'CMS-03B-09 public publication response headers does not advertise Retry-After on nonretryable 500',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-quota.test.ts',
            title:
              'port boundary is 502 when the success payload breaks the resource contract CMS-03B-09',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-errors-typed.test.ts',
            title:
              'transport statuses publishes the canonical 502, 504 and 500 envelopes',
          },
        ],
      },
      {
        text: 'preserve safe recovery.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-publish.apispec.ts',
            title:
              'CMS-03B-09 publish through the real stack [CMS-03B-09] a missing, stale or future-dated step-up is 401 STEP_UP_REQUIRED before any RPC and any idempotency reservation',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-publish.apispec.ts',
            title:
              'CMS-03B-09 publish through the real stack [CMS-03B-09] a stale review version is 409 VERSION_MISMATCH with the safe expected and current versions',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-publish.apispec.ts',
            title:
              'CMS-03B-09 publish through the real stack [CMS-03B-09] a stale frozen manifest is the COMMITTED refusal: HTTP 200 on the wire, 409 dependency_changed with the current hash for the browser, the review stays invalidated and a replay answers the same 409',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-publish.apispec.ts',
            title:
              'CMS-03B-09 publish through the real stack [CMS-03B-09] an unavailable accessibility proof is 503 DEPENDENCY_UNAVAILABLE with Retry-After and nothing is committed',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-publish-preflight.apispec.ts',
            title:
              'CMS-03B-09 publication admission and preflight composition [CMS-03B-09] command transport outage preserves every group and carries retry and quota headers',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-response-headers.test.ts',
            title:
              "CMS-03B-09 public publication response headers retains admitted quota on retryable 503 'preflight'",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-response-headers.test.ts',
            title:
              'CMS-03B-09 public publication response headers returns the exact 429 quota tuple before any RPC',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-errors-typed.test.ts',
            title:
              '422 projection publishes preflight_failed with at most seventeen bare entries',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-errors.test.ts',
            title:
              '409 projection requires the dependency hash for dependency_changed and publishes only that member',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-quota.test.ts',
            title:
              'port boundary projects a typed port refusal through the operation boundary CMS-03B-09',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_publish_refusals.sql',
            title:
              'every raised refusal above left no lineage row, review change, schedule, reservation, event or audit record behind [P2-S11-AC-030]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S11-AC-034',
    text: 'CMS-03B-09: commit audit and outbox effects atomically where applicable, reconcile lost responses without duplicate effects, and emit redacted telemetry.',
    clauses: [
      {
        text: 'CMS-03B-09: commit audit and outbox effects atomically where applicable',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-publish-lineage.apispec.ts',
            title:
              'CMS-03B-09 append-only publication lineage [CMS-03B-09] first and successor publications independently match JCS hashes and exact fourteen-group append effects',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-publish-lineage.apispec.ts',
            title:
              'CMS-03B-09 append-only publication lineage [CMS-03B-09] independent audiences start distinct version-one lineages with exact bound hashes',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_publish.sql',
            title:
              'exactly one identifier-only cms.publication.changed.v1 with the row id as publicationVersionId commits [P2-S11-AC-116]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_publish.sql',
            title:
              'exactly one audit record commits with the lineage row [P2-S11-AC-034]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_publish.sql',
            title:
              'each appended row emitted exactly one cms.publication.changed.v1 (three rows, three events) [P2-S11-AC-116]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_publish_refusals.sql',
            title:
              'every raised refusal above left no lineage row, review change, schedule, reservation, event or audit record behind [P2-S11-AC-030]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_evidence_audit.sql',
            title:
              "the row references the publication's outbox event and joins its audit record by correlation id [P2-S11-AC-101]",
          },
          {
            tool: 'race',
            file: 'supabase/tests/phase_02_slice_11_races/014-publication-execute-race.mjs',
            title:
              'E2: exactly one event and one audit record per appended row, no typed conflict and no deadlock',
          },
          {
            tool: 'race',
            file: 'supabase/tests/phase_02_slice_11_races/016-lineage-append-race.mjs',
            title:
              'L1: exactly one cms.publication.changed.v1 per appended row',
          },
        ],
      },
      {
        text: 'reconcile lost responses without duplicate effects',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-publish.apispec.ts',
            title:
              'CMS-03B-09 publish through the real stack [CMS-03B-09] publishes an approved review (202, Location, strong ETag) exactly once and a replay adds nothing',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-publish-lineage.apispec.ts',
            title:
              'CMS-03B-09 append-only publication lineage [CMS-03B-09] first and successor publications independently match JCS hashes and exact fourteen-group append effects',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-publish.apispec.ts',
            title:
              'CMS-03B-09 publish through the real stack [CMS-03B-09] a stale frozen manifest is the COMMITTED refusal: HTTP 200 on the wire, 409 dependency_changed with the current hash for the browser, the review stays invalidated and a replay answers the same 409',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_publish.sql',
            title:
              'an exact replay returns the stored resource, marks x-cms-idempotent-replay and adds no lineage row, audit record, event or reservation [P2-S11-AC-032]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_publish.sql',
            title:
              'a lost-response retry with the same key and a freshly evaluated accessibility proof is a replay, not an IDEMPOTENCY_MISMATCH [P2-S11-AC-032]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_evidence_audit.sql',
            title:
              'an exact replay of the publication writes no second summary row [P2-S11-AC-101]',
          },
        ],
      },
      {
        text: 'emit',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-workflow-telemetry.test.ts',
            title:
              'Slice 11 telemetry classes CMS-03B-09 writes the command, rpc and acceptance events',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-telemetry.test.ts',
            title:
              'refusal metrics counts a separation-of-duties refusal by operation',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-telemetry.test.ts',
            title: 'refusal metrics counts a lineage conflict',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-workflow-logging.test.ts',
            title:
              'route telemetry through the production sink writes refusal events (step-up, typed preflight failure, outage) without rejection',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-workflow-logging.test.ts',
            title:
              'route telemetry through the production sink writes every command and read event without a single rejected event',
          },
        ],
      },
      {
        text: 'redacted telemetry.',
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'No test serializes the CMS-03B-09 telemetry event and asserts that request identifiers (entry, revision, review, publication ids), frozen hashes and the version set are absent from it; only CMS-03B-05 (workflow-command-facts) and CMS-03B-08 (token) have an operation-specific redaction assertion, so the redaction half of this clause is unproven.',
  },
];
