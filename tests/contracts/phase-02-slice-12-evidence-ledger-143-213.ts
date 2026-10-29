import type { EvidenceLedgerEntry } from './phase-02-evidence-ledger';

// Slice 12 evidence ledger, criteria AC143-AC213. Aggregated by
// tests/contracts/phase-02-slice-12-evidence-ledger.ts and the guard tests/contracts/phase-02-slice-12-evidence-guard.test.ts.
// Filled by evidence lane C (2026-10-12): citations name only tests whose assertions produce and check the
// condition of the clause; every uncited clause is named in `limitation`; unbuilt behaviour stays unverified.
// Re-cited 2026-10-24 from the refuted proposals by docs/handoffs/2026-10-22-claude-s12/recite/apply.mjs (a rerun reproduces it).
export const S12_EVIDENCE_LEDGER_143_213: readonly EvidenceLedgerEntry[] = [
  {
    criterion: 'P2-S12-AC-143',
    text: "CMS-03C-19 claims only due `pending` or `failed_retryable` schedules and executes only a claimed schedule whose `lease_id` still matches (a stale lease is refused with no effect), re-reading the review (`approved` at the schedule's stored `expected_version`), the subject (`scheduled` with an equal hash), the policy basis, the dependencies and the canonical providers, and rechecking that the schedule creator's designer or curator grant is unrevoked and has not ended before the fire instant.",
    clauses: [
      {
        text: 'CMS-03C-19 claims only due `pending` or `failed_retryable` schedules',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_schedule/020-claim.sqlinc',
            title:
              'no schedule is due yet: the claim answers an empty array and takes no schedule [P2-S12-AC-149]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_schedule/020-claim.sqlinc',
            title:
              'the next claim takes exactly the remaining due schedules in resolved order; the schedule due in ten minutes is not claimed, and an executing schedule is not claimed twice [P2-S12-AC-149]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_schedule/040-retry.sqlinc',
            title:
              'a failed_retryable schedule is not claimed before its retry instant, and the released lease no longer authorizes an execution [P2-S12-AC-152]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_schedule/040-retry.sqlinc',
            title:
              'once due the retry is claimed again with a NEW lease at schedule version 4, keeping its attempt count [P2-S12-AC-152]',
          },
        ],
      },
      {
        text: 'executes only a claimed schedule whose `lease_id` still matches (a stale lease is refused with no effect)',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_schedule/030-execute.sqlinc',
            title:
              "execute takes exactly { scheduleId, expectedVersion, leaseId }; an absent schedule is NOT_FOUND, a lease that is not the claim's or a schedule that is not executing is CONFLICT, a version that is not the one relied on is VERSION_MISMATCH [P2-S12-AC-150]",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_schedule/030-execute.sqlinc',
            title:
              'the fence refusals name the expected and the current review version and leave the schedule, subject, review and append-only stores identical [P2-S12-AC-150]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_schedule_ladder/010-ladder.sqlinc',
            title:
              'the executor that finally presents the lease of the exhausted schedule is refused CONFLICT with no effect [P2-S12-AC-153]',
          },
        ],
      },
      {
        text: "re-reading the review (`approved` at the schedule's stored `expected_version`)",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_schedule/030-execute.sqlinc',
            title:
              "execute takes exactly { scheduleId, expectedVersion, leaseId }; an absent schedule is NOT_FOUND, a lease that is not the claim's or a schedule that is not executing is CONFLICT, a version that is not the one relied on is VERSION_MISMATCH [P2-S12-AC-150]",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_schedule/055-fire-approval.sqlinc',
            title:
              'an approval that stopped counting between acceptance and fire blocks the schedule approval_invalidated: schedule blocked, subject blocked (lifecycle 5), the review untouched, no event, one audit record [P2-S12-AC-146]',
          },
        ],
      },
      {
        text: 'the subject (`scheduled` with an equal hash)',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db3_schedule_subject.sql',
            title:
              'control: every claimed schedule has its review approved at exactly the version the schedule relied on, so only the subject disjuncts can differ [P2-S12-AC-143]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db3_schedule_subject.sql',
            title:
              'a subject that is not `scheduled` at fire, with its review approved at its version, blocks the schedule approval_invalidated: review untouched, subject blocked, no event, one audit record [P2-S12-AC-143]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db3_schedule_subject.sql',
            title:
              'a subject whose content hash differs from the frozen one at fire, with its review approved at its version, blocks the schedule approval_invalidated: review untouched, subject blocked, no event, one audit record [P2-S12-AC-143]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db3_schedule_subject.sql',
            title:
              'control: with the transparent wrapper installed and no fault named the claimed schedule completes, the subject is active, one event [P2-S12-AC-143]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db3_schedule_subject.sql',
            title:
              'control: the pinned reader is restored byte for byte (source, owner, ACL) [P2-S12-AC-143]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db3_schedule_subject.sql',
            title:
              'control: the stored subject hash really equals the frozen hash, so the difference came only from the substituted read [P2-S12-AC-143]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db3_schedule_subject.sql',
            title: 'control: no renamed-aside reader remains [P2-S12-AC-143]',
          },
        ],
      },
      {
        text: 'the policy basis',
        citations: [],
      },
      {
        text: 'the dependencies',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_schedule/050-blocked.sqlinc',
            title:
              'a changed frozen dependency at fire time blocks the schedule dependency_changed: schedule blocked, subject blocked (lifecycle 5), the review untouched, no event, one audit record [P2-S12-AC-146]',
          },
        ],
      },
      {
        text: 'the canonical providers',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_schedule_fire.sql',
            title:
              'a declared canonical domain with an unbuilt provider at fire time blocks the schedule canonical_source_unavailable: subject blocked, no event, one audit record [P2-S12-AC-143]',
          },
        ],
      },
      {
        text: "rechecking that the schedule creator's designer or curator grant is unrevoked",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_schedule/030-execute.sqlinc',
            title:
              'a creator whose designer grant was revoked blocks the schedule activation_authority_ended: schedule blocked, subject blocked (lifecycle 5), review still approved, no event, one audit record [P2-S12-AC-146]',
          },
        ],
      },
      {
        text: 'has not ended before the fire instant.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_schedule_fire.sql',
            title:
              'a creator grant that ENDED (term passed, not revoked) before the fire instant blocks the schedule activation_authority_ended: subject blocked, review untouched, no event, one audit record [P2-S12-AC-144]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_schedule_fire.sql',
            title:
              'a creator grant that ends after the fire instant still executes the schedule: completed, subject active, one event [P2-S12-AC-144]',
          },
        ],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven (uncited clause): "the policy basis": BOUNDARY (db1): a policy basis that changes between acceptance and fire is unreachable by any lawful state (the frozen basis and the current basis are both immutable); the AC-083 seam (rename-aside wrapper) exists only for the activate and schedule commands, not for cms_execute_governed_activation. No test drives the policy-basis recheck at fire.',
  },
  {
    criterion: 'P2-S12-AC-144',
    text: "CMS-03C-19 grants EXECUTE only to the registered Worker `scheduled` sweep principal (PUBLIC, anon, authenticated and every other role revoked), re-derives the schedule creator's designer or curator authority at the fire instant by checking revocation and a grant end before the fire instant only, never rechecking MFA (DEC-120), and carries only identifiers, versions and correlation data in claims.",
    clauses: [
      {
        text: 'CMS-03C-19 grants EXECUTE only to the registered Worker `scheduled` sweep principal (PUBLIC, anon, authenticated',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_schedule/060-privileges.sqlinc',
            title:
              'anon and authenticated may execute neither platform API function of the scheduled sweep [P2-S12-AC-148]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_schedule/060-privileges.sqlinc',
            title:
              'service_role may not execute the private claim and execute implementations, only the platform API wrappers [P2-S12-AC-148]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_schedule/060-privileges.sqlinc',
            title:
              'the wrappers are service_role only; every function is SECURITY DEFINER with an empty search_path owned by the CMS definer; the private functions and helpers are executable by no API role [P2-S12-AC-148]',
          },
        ],
      },
      {
        text: 'and every other role revoked)',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_acl.sql',
            title:
              'the claim wrapper grants EXECUTE to service_role (the registered sweep principal) and its owner only [P2-S12-AC-144]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_acl.sql',
            title:
              'the execute wrapper grants EXECUTE to service_role and its owner only [P2-S12-AC-144]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_acl.sql',
            title: 'the private claim function is owner-only [P2-S12-AC-144]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_acl.sql',
            title: 'the private execute function is owner-only [P2-S12-AC-144]',
          },
        ],
      },
      {
        text: "re-derives the schedule creator's designer or curator authority at the fire instant by checking revocation",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_schedule/030-execute.sqlinc',
            title:
              'a creator whose designer grant was revoked blocks the schedule activation_authority_ended: schedule blocked, subject blocked (lifecycle 5), review still approved, no event, one audit record [P2-S12-AC-146]',
          },
        ],
      },
      {
        text: 'a grant end before the fire instant only',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_schedule_fire.sql',
            title:
              'a creator grant that ENDED (term passed, not revoked) before the fire instant blocks the schedule activation_authority_ended: subject blocked, review untouched, no event, one audit record [P2-S12-AC-144]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_schedule_fire.sql',
            title:
              'a creator grant that ends after the fire instant still executes the schedule: completed, subject active, one event [P2-S12-AC-144]',
          },
        ],
      },
      {
        text: 'never rechecking MFA (DEC-120)',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_schedule_fire.sql',
            title:
              'a schedule whose creator step-up is older than the 600 s window at fire still completes: MFA is never rechecked [P2-S12-AC-144]',
          },
        ],
      },
      {
        text: 'carries only identifiers, versions and correlation data in claims.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_schedule/020-claim.sqlinc',
            title:
              'a claimed record is exactly ClaimedGovernedActivation: identifiers and versions only, never content (8 members) [P2-S12-AC-149]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-145',
    text: 'CMS-03C-19 mirrors CMS-03B-20: the Worker `scheduled` sweep runs every minute with batch 25, claims under `FOR UPDATE SKIP LOCKED` with a version CAS from `pending` or `failed_retryable` to `executing` and a five-minute `lease_id` and `lease_until`, and applies the retry ladder in which a `failed_retryable` outcome sets `attempt_count` + 1 and `next_attempt_at` to now + 15 s, 60 s and 300 s for the first, second and third failure and a fourth consecutive retryable failure blocks the schedule with `retries_exhausted`.',
    clauses: [
      {
        text: 'CMS-03C-19 mirrors CMS-03B-20: the Worker `scheduled` sweep runs every minute with batch 25',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/worker-wrangler-config.test.ts',
            title:
              'Worker Wrangler queue and schedule contract schedules the outbox sweep once per minute in every environment',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-governed-activation-sweep-wiring.test.ts',
            title:
              'scheduled governed activation sweep wiring runs the governed activation sweep with the platform bindings on every tick',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-governed-activation-sweep.test.ts',
            title:
              'a quiet tick claims the bounded batch once and logs only the count',
          },
        ],
      },
      {
        text: 'claims under `FOR UPDATE SKIP LOCKED`',
        citations: [],
      },
      {
        text: 'with a version CAS from `pending` or `failed_retryable` to `executing` and a five-minute `lease_id` and `lease_until`',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_schedule/020-claim.sqlinc',
            title:
              'a claim moves the two schedules to executing (version 2) with a five-minute lease and emits no event; the other schedules stay pending or cancelled [P2-S12-AC-149]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_schedule/040-retry.sqlinc',
            title:
              'once due the retry is claimed again with a NEW lease at schedule version 4, keeping its attempt count [P2-S12-AC-152]',
          },
        ],
      },
      {
        text: 'applies the retry ladder in which a `failed_retryable` outcome sets `attempt_count` + 1 and `next_attempt_at` to now + 15 s, 60 s and 300 s for the first, second and third failure and a fourth consecutive retryable failure blocks the schedule with `retries_exhausted`.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_schedule/040-retry.sqlinc',
            title:
              'the first failure sets attempt_count 1 and the 15 s retry step, releases the lease, keeps the subject scheduled, emits no event and writes one audit record [P2-S12-AC-152]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_schedule_ladder/010-ladder.sqlinc',
            title:
              'failure 2: the schedules are claimed again after 15 s; attempt_count 2 and the retry 60 s ahead [P2-S12-AC-152]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_schedule_ladder/010-ladder.sqlinc',
            title:
              'failure 3: attempt_count 3 and the last retry 300 s ahead [P2-S12-AC-152]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_schedule_ladder/010-ladder.sqlinc',
            title:
              'the fourth failure blocks the schedule retries_exhausted (three attempts spent) and the subject blocked, with no event and one audit record [P2-S12-AC-152]',
          },
        ],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven (uncited clauses): "claims under `FOR UPDATE SKIP LOCKED`": missing test: the claim\'s `FOR UPDATE SKIP LOCKED` under concurrency -- a race module (new supabase/tests/phase_02_slice_12_governed_schedule_races/ one-claim-while-another-holds-the-row, modelled on supabase/tests/phase_02_slice_11_races/013-schedule-claim-race.mjs) in which session A holds the row lock of a due schedule and session B\'s cms_claim_due_governed_activations returns without waiting and without that schedule, and two concurrent claims never return the same schedule; or at minimum a catalog assertion on the function source. The sequential claims in 020-claim.sqlinc prove the CAS and the lease but not SKIP LOCKED. BE03c line 188 (mirrors CMS-03B-20).',
  },
  {
    criterion: 'P2-S12-AC-146',
    text: 'CMS-03C-19 returns an expired `executing` lease to `failed_retryable` with `attempt_count` + 1 before claiming, returns a repeated execution of a `completed` schedule as `already_completed` with no effect, blocks a terminal failure with the closed `reasonCode` (`approval_invalidated`, `dependency_changed`, `activation_authority_ended`, `canonical_source_unavailable`, `retries_exhausted`) making the subject `blocked` with the prior active version intact, cancels a schedule whose review is invalidated (`cancelled`, `approval_invalidated`) and returns the subject to `draft`, and runs a late schedule and records its `deviation_seconds`.',
    clauses: [
      {
        text: 'CMS-03C-19 returns an expired `executing` lease to `failed_retryable` with `attempt_count` + 1 before claiming',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_schedule_ladder/010-ladder.sqlinc',
            title:
              'the claim first returns the expired lease of l2 to failed_retryable (attempt_count 1, the 15 s step), then claims the two due schedules at their fourth attempt [P2-S12-AC-153]',
          },
        ],
      },
      {
        text: 'returns a repeated execution of a `completed` schedule as `already_completed` with no effect',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_schedule/030-execute.sqlinc',
            title:
              'a repeated run on a completed schedule answers already_completed with the recorded instant and deviation, whatever lease it presents, and has no effect [P2-S12-AC-151]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_schedule/030-execute.sqlinc',
            title:
              'the repeated runs wrote no second event, audit record or state change [P2-S12-AC-151]',
          },
        ],
      },
      {
        text: 'blocks a terminal failure with the closed `reasonCode` (`approval_invalidated`, `dependency_changed`, `activation_authority_ended`',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_schedule/030-execute.sqlinc',
            title:
              'a creator whose designer grant was revoked blocks the schedule activation_authority_ended: schedule blocked, subject blocked (lifecycle 5), review still approved, no event, one audit record [P2-S12-AC-146]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_schedule/055-fire-approval.sqlinc',
            title:
              'an approval that stopped counting between acceptance and fire blocks the schedule approval_invalidated: schedule blocked, subject blocked (lifecycle 5), the review untouched, no event, one audit record [P2-S12-AC-146]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_schedule/050-blocked.sqlinc',
            title:
              'a changed frozen dependency at fire time blocks the schedule dependency_changed: schedule blocked, subject blocked (lifecycle 5), the review untouched, no event, one audit record [P2-S12-AC-146]',
          },
        ],
      },
      {
        text: '`canonical_source_unavailable`',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_schedule_fire.sql',
            title:
              'a declared canonical domain with an unbuilt provider at fire time blocks the schedule canonical_source_unavailable: subject blocked, no event, one audit record [P2-S12-AC-143]',
          },
        ],
      },
      {
        text: '`retries_exhausted`) making the subject `blocked`',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_schedule_ladder/010-ladder.sqlinc',
            title:
              'the fourth failure blocks the schedule retries_exhausted (three attempts spent) and the subject blocked, with no event and one audit record [P2-S12-AC-152]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_schedule_ladder/010-ladder.sqlinc',
            title:
              'the claim that finds the lease of a fourth attempt expired exhausts the ladder itself: schedule blocked retries_exhausted, the scheduled subject blocked (lifecycle 5), no event, one audit record [P2-S12-AC-153]',
          },
        ],
      },
      {
        text: 'with the prior active version intact',
        citations: [],
      },
      {
        text: 'cancels a schedule whose review is invalidated (`cancelled`, `approval_invalidated`) and returns the subject to `draft`',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation/060-invalidation.sqlinc',
            title:
              'invalidating an approved review whose subject is scheduled cancels the schedule (cancelled, approval_invalidated, version 2) in the same transaction [P2-S12-AC-145]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation/060-invalidation.sqlinc',
            title:
              'the review is invalidated, the subject returns scheduled -> draft (lifecycle 5), one invalidation and one cancellation audit record are written and no event is emitted [P2-S12-AC-145]',
          },
        ],
      },
      {
        text: 'runs a late schedule and records its `deviation_seconds`.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_schedule/030-execute.sqlinc',
            title:
              'a completed execution records the actual instant and the signed deviation from the scheduled instant (a late run still activates) [P2-S12-AC-150]',
          },
        ],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven (uncited clause): "with the prior active version intact": missing test: a terminal block (any closed reasonCode) leaves the PRIOR active version of the lineage intact (still active, activated_at unchanged, no supersession). Re-checked 2026-10-29: schedule_fire.sql asserts the blocked subject (state blocked, activated_at null) and no event but its fixtures activate no prior version of the lineage, and no other test asserts the prior active version after a fire-time block.',
  },
  {
    criterion: 'P2-S12-AC-147',
    text: 'CMS-03C-19 performs the `activate` switch for a due schedule, sets the schedule `completed` with `actual_at_utc` and `deviation_seconds`, and commits one activation event, the audit record and the schedule CAS atomically as CMS-03B-20 does; verification covers execution with only a revocation and grant-end recheck, worker lease expiry, the retry ladder and every `reasonCode`, a late run and a repeated run, and the absence of both RPCs from browser routes and generated OpenAPI.',
    clauses: [
      {
        text: 'CMS-03C-19 performs the `activate` switch for a due schedule',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_schedule/030-execute.sqlinc',
            title:
              'the scheduled execution supersedes the previous active version and commits exactly one cms.template.activated.v1 (aggregate version 5) and one audit record [P2-S12-AC-150]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_schedule/030-execute.sqlinc',
            title:
              'the schedule completes at version 3, the subject goes scheduled -> active (lifecycle 4 -> 5, definition version 2) and the review records the activation instant at version 3 [P2-S12-AC-150]',
          },
        ],
      },
      {
        text: 'sets the schedule `completed` with `actual_at_utc` and `deviation_seconds`',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_schedule/030-execute.sqlinc',
            title:
              'the schedule completes at version 3, the subject goes scheduled -> active (lifecycle 4 -> 5, definition version 2) and the review records the activation instant at version 3 [P2-S12-AC-150]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_schedule/030-execute.sqlinc',
            title:
              'a completed execution records the actual instant and the signed deviation from the scheduled instant (a late run still activates) [P2-S12-AC-150]',
          },
        ],
      },
      {
        text: 'commits one activation event, the audit record and the schedule CAS',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_schedule/030-execute.sqlinc',
            title:
              'the scheduled execution supersedes the previous active version and commits exactly one cms.template.activated.v1 (aggregate version 5) and one audit record [P2-S12-AC-150]',
          },
        ],
      },
      {
        text: 'atomically as CMS-03B-20 does',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_schedule_fire.sql',
            title:
              'a failure of the final schedule CAS leaves no event, no audit record and no state change: the switch, event, audit and CAS are one atomic unit [P2-S12-AC-147]',
          },
        ],
      },
      {
        text: 'verification covers execution with only a revocation and grant-end recheck',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_schedule_fire.sql',
            title:
              'a creator grant that ENDED (term passed, not revoked) before the fire instant blocks the schedule activation_authority_ended: subject blocked, review untouched, no event, one audit record [P2-S12-AC-144]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_schedule_fire.sql',
            title:
              'a schedule whose creator step-up is older than the 600 s window at fire still completes: MFA is never rechecked [P2-S12-AC-144]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_schedule/030-execute.sqlinc',
            title:
              'a creator whose designer grant was revoked blocks the schedule activation_authority_ended: schedule blocked, subject blocked (lifecycle 5), review still approved, no event, one audit record [P2-S12-AC-146]',
          },
        ],
      },
      {
        text: 'worker lease expiry',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_schedule_ladder/010-ladder.sqlinc',
            title:
              'the claim that finds the lease of a fourth attempt expired exhausts the ladder itself: schedule blocked retries_exhausted, the scheduled subject blocked (lifecycle 5), no event, one audit record [P2-S12-AC-153]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_schedule_ladder/010-ladder.sqlinc',
            title:
              'the claim first returns the expired lease of l2 to failed_retryable (attempt_count 1, the 15 s step), then claims the two due schedules at their fourth attempt [P2-S12-AC-153]',
          },
        ],
      },
      {
        text: 'the retry ladder',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_schedule_ladder/010-ladder.sqlinc',
            title:
              'the claim that finds the lease of a fourth attempt expired exhausts the ladder itself: schedule blocked retries_exhausted, the scheduled subject blocked (lifecycle 5), no event, one audit record [P2-S12-AC-153]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_schedule_ladder/010-ladder.sqlinc',
            title:
              'failure 3: attempt_count 3 and the last retry 300 s ahead [P2-S12-AC-152]',
          },
        ],
      },
      {
        text: 'every `reasonCode`',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_schedule_fire.sql',
            title:
              'a creator grant that ENDED (term passed, not revoked) before the fire instant blocks the schedule activation_authority_ended: subject blocked, review untouched, no event, one audit record [P2-S12-AC-144]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_schedule_fire.sql',
            title:
              'a declared canonical domain with an unbuilt provider at fire time blocks the schedule canonical_source_unavailable: subject blocked, no event, one audit record [P2-S12-AC-143]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_schedule_fire.sql',
            title:
              'a subject that is no longer scheduled / an approval that is no longer approved at fire blocks the schedule approval_invalidated with no event [P2-S12-AC-143]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_schedule/050-blocked.sqlinc',
            title:
              'a changed frozen dependency at fire time blocks the schedule dependency_changed: schedule blocked, subject blocked (lifecycle 5), the review untouched, no event, one audit record [P2-S12-AC-146]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_schedule_ladder/010-ladder.sqlinc',
            title:
              'the fourth failure blocks the schedule retries_exhausted (three attempts spent) and the subject blocked, with no event and one audit record [P2-S12-AC-152]',
          },
        ],
      },
      {
        text: 'a late run',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_schedule/030-execute.sqlinc',
            title:
              'a completed execution records the actual instant and the signed deviation from the scheduled instant (a late run still activates) [P2-S12-AC-150]',
          },
        ],
      },
      {
        text: 'a repeated run',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_schedule/030-execute.sqlinc',
            title:
              'a repeated run on a completed schedule answers already_completed with the recorded instant and deviation, whatever lease it presents, and has no effect [P2-S12-AC-151]',
          },
        ],
      },
      {
        text: 'the absence of both RPCs from browser routes and generated OpenAPI.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-governed-review-openapi.test.ts',
            title:
              'Slice 12 governed review registry rows and generated OpenAPI (CMS-03C-06 to CMS-03C-11) [P2-S12-AC-136] keeps the internal CMS-03C-18 to CMS-03C-21 operations and their records out of the browser inventory and OpenAPI',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-governed-activation-import-graph.test.ts',
            title:
              'CMS-03C-19 module boundary (import graph) never reaches the RPCs from the HTTP route layer (the governed routes import no sweep, port or name module)',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-148',
    text: 'CMS-03C-20 is the database RPC `platform_private.cms_resolve_locale_field(p_entry_id uuid, p_locale text, p_field_id uuid)` returning the strict `LocaleFieldResolution` (`fieldId`, `locale`, `mode` `none`, `localized` or `no_fallback`, `outcome` `resolved` or `missing`, `provenance` `authored`, `localized_fallback` or `missing`, `resolvedFromLocale`, `stale`, `blocking`, and `reasonCode` `no_fallback_missing`, `no_fallback_stale` or null) and the registered preflight provider `cms.locale.no_fallback_gate`; it is the one resolver used by the 03b `locale` preflight provider, the Shard 04 delivery projection and editorial reads, and it has no browser route.',
    clauses: [
      {
        text: 'CMS-03C-20 is the database RPC `platform_private.cms_resolve_locale_field(p_entry_id uuid, p_locale text, p_field_id uuid)` returning the strict `LocaleFieldResolution` (`fieldId`, `locale`, `mode` `none`, `localized` or `no_fallback`, `outcome` `resolved` or `missing`, `provenance` `authored`, `localized_fallback` or `missing`, `resolvedFromLocale`, `stale`, `blocking`, and `reasonCode` `no_fallback_missing`, `no_fallback_stale` or null)',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_resolution/002-resolver.sqlinc',
            title:
              'the resolution has exactly the nine LocaleFieldResolution members and carries no value or text [P2-S12-AC-148]',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/locale-resolution.test.ts',
            title:
              'CMS-03C-20 locale field resolution (DEC-121, DEC-138) [P2-S12-AC-148] returns the nine members with their closed vocabularies',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/locale-resolution.test.ts',
            title:
              'CMS-03C-20 locale field resolution (DEC-121, DEC-138) [P2-S12-AC-148] takes the entry, the target locale and the field id of the RPC',
          },
        ],
      },
      {
        text: 'the registered preflight provider `cms.locale.no_fallback_gate`',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_gate/001-gate.sqlinc',
            title:
              'the locale category is served by cms.locale.no_fallback_gate version 1 (database) as a newer registry row [P2-S12-AC-240]',
          },
        ],
      },
      {
        text: 'it is the one resolver used by the 03b `locale` preflight provider',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_locale_gate.sql',
            title:
              'the CMS-03C-20 resolver answers the same reason code as the gate for the missing no_fallback field [P2-S12-AC-148]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_locale_gate.sql',
            title:
              'the resolver reports no blocking reason for the same value: gate verdict and resolver agree [P2-S12-AC-148]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_locale_gate.sql',
            title:
              'the resolver answers no_fallback_stale for the same field: one resolver behind the gate and the delivery-side call [P2-S12-AC-148]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_acl.sql',
            title:
              'the 03b locale preflight gate runs the shared resolver core cms_locale_resolutions, the resolver cms_resolve_locale_field also uses [P2-S12-AC-148]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_acl.sql',
            title: 'the field resolver is the same core [P2-S12-AC-148]',
          },
        ],
      },
      {
        text: 'the Shard 04 delivery projection',
        citations: [],
      },
      {
        text: 'editorial reads',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_variant_read/001-shape-and-grants.sqlinc',
            title:
              'the resolutions come from the CMS-03C-20 resolver core, not a second implementation [P2-S12-AC-152]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_variant_read/002-read.sqlinc',
            title:
              'the resolutions are exactly the CMS-03C-20 resolver output for every localizable field, ascending by field id [P2-S12-AC-152]',
          },
        ],
      },
      {
        text: 'it has no browser route.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_resolution/002-resolver.sqlinc',
            title:
              'no platform_api (browser reachable) wrapper of the resolver exists [P2-S12-AC-150]',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-governed-review-openapi.test.ts',
            title:
              'Slice 12 governed review registry rows and generated OpenAPI (CMS-03C-06 to CMS-03C-11) [P2-S12-AC-136] keeps the internal CMS-03C-18 to CMS-03C-21 operations and their records out of the browser inventory and OpenAPI',
          },
        ],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven (uncited clause): "the Shard 04 delivery projection": BOUNDARY (db1): the Shard 04 delivery projection is a later shard with no boundary stub, no migration, Worker or SQL function calling the resolver except the gate and the editorial read (gaps_db1_acl.sql "no function calls cms_resolve_locale_field yet ..." only records that absence). Nothing to test until Shard 04 is built.',
  },
  {
    criterion: 'P2-S12-AC-149',
    text: "CMS-03C-20 resolves a field by its `localizationMode`: with `none` the value is the source-locale value, and with `localized` (fallback permitted) it is the field in the target locale's own revision when present, otherwise the first locale of the active version's `fallbackChains[locale]` (ordered, at most 16, ending at the default locale) that has a value, recording `resolvedFromLocale` and provenance `localized_fallback`, otherwise `missing`; the `no_fallback` and stale clauses are owned by AC051 and AC052.",
    clauses: [
      {
        text: "CMS-03C-20 resolves a field by its `localizationMode`: with `none` the value is the source-locale value, and with `localized` (fallback permitted) it is the field in the target locale's own revision when present, otherwise the first locale of the active version's `fallbackChains[locale]` (ordered, at most 16, ending at the default locale) that has a value, recording `resolvedFromLocale` and provenance `localized_fallback`, otherwise `missing`; the `no_fallback` and stale clauses are owned by AC051 and AC052.",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_resolution/002-resolver.sqlinc',
            title:
              'a none field resolves to the source-locale value in any locale [P2-S12-AC-149]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_resolution/002-resolver.sqlinc',
            title:
              'a localized field resolves to the field in the target locale own revision when present [P2-S12-AC-149]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_resolution/002-resolver.sqlinc',
            title:
              'a localized field without a target value walks the active fallback chain and records resolvedFromLocale [P2-S12-AC-149]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_resolution/002-resolver.sqlinc',
            title:
              'the chain is walked in order: fr-CA takes the fr-FR value before the default locale [P2-S12-AC-149]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_resolution/002-resolver.sqlinc',
            title:
              'the walk covers the whole chain and ends missing when no member holds a value [P2-S12-AC-149]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_resolution/002-resolver.sqlinc',
            title:
              'a localized field with no value in the locale, its chain or the default is missing and does not block [P2-S12-AC-149]',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/locale-resolution.test.ts',
            title:
              'CMS-03C-20 locale field resolution (DEC-121, DEC-138) [P2-S12-AC-149] resolves a none-mode field to the source-locale value without fallback',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/locale-resolution.test.ts',
            title:
              'CMS-03C-20 locale field resolution (DEC-121, DEC-138) [P2-S12-AC-149] walks the fallback chain for a localized field and records where the value came from',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/content-schema-registry/locale-config-schemas.test.ts',
            title:
              'CMS-03A-01 locale configuration refuses a cycle and a chain that does not end at the default',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/content-schema-registry/locale-config-schemas.test.ts',
            title:
              'locale configuration OpenAPI projection bounds supportedLocales and fallbackChains on the draft request',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-150',
    text: 'CMS-03C-20 is executable only by the registered non-browser callers (the publication preflight `locale` provider, the Shard 04 delivery projection and the editorial reads; PUBLIC, anon, authenticated and every other role have EXECUTE revoked), returns identifiers, enums and booleans only and never locale text, and is absent from the browser route inventory and generated OpenAPI.',
    clauses: [
      {
        text: 'CMS-03C-20 is executable only by the registered non-browser callers (the publication preflight `locale` provider,',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_acl.sql',
            title:
              'the registered callers of the resolver core are exactly the publication preflight gate, the CMS-03C-04 editorial reader and the field resolver [P2-S12-AC-150]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_acl.sql',
            title:
              'CMS-03C-20 cms_resolve_locale_field is executable by its owner only: PUBLIC, anon, authenticated, service_role and every other role are revoked [P2-S12-AC-150]',
          },
        ],
      },
      {
        text: 'the Shard 04 delivery projection',
        citations: [],
      },
      {
        text: 'and the editorial reads',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_acl.sql',
            title:
              'the registered callers of the resolver core are exactly the publication preflight gate, the CMS-03C-04 editorial reader and the field resolver [P2-S12-AC-150]',
          },
        ],
      },
      {
        text: 'PUBLIC, anon, authenticated',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_resolution/002-resolver.sqlinc',
            title:
              'PUBLIC, anon, authenticated and service_role have EXECUTE revoked [P2-S12-AC-150]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_resolution/002-resolver.sqlinc',
            title:
              'the resolver is STABLE, SECURITY DEFINER with an empty search_path and owned by the CMS definer [P2-S12-AC-151]',
          },
        ],
      },
      {
        text: 'and every other role have EXECUTE revoked)',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_acl.sql',
            title:
              'CMS-03C-20 cms_resolve_locale_field is executable by its owner only: PUBLIC, anon, authenticated, service_role and every other role are revoked [P2-S12-AC-150]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_acl.sql',
            title: 'the resolver core is owner-only as well [P2-S12-AC-150]',
          },
        ],
      },
      {
        text: 'returns identifiers, enums and booleans only and never locale text',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_resolution/002-resolver.sqlinc',
            title:
              'a resolution never carries locale text: only identifiers, enums and booleans [P2-S12-AC-150]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_resolution/002-resolver.sqlinc',
            title:
              'the resolution has exactly the nine LocaleFieldResolution members and carries no value or text [P2-S12-AC-148]',
          },
        ],
      },
      {
        text: 'is absent from the browser route inventory and generated OpenAPI.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_resolution/002-resolver.sqlinc',
            title:
              'no platform_api (browser reachable) wrapper of the resolver exists [P2-S12-AC-150]',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-governed-review-openapi.test.ts',
            title:
              'Slice 12 governed review registry rows and generated OpenAPI (CMS-03C-06 to CMS-03C-11) [P2-S12-AC-136] keeps the internal CMS-03C-18 to CMS-03C-21 operations and their records out of the browser inventory and OpenAPI',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI inventory [P2-S12-AC-275] documents none of CMS-03C-18 to CMS-03C-21, their RPCs, providers or contracts',
          },
        ],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven (uncited clause): "the Shard 04 delivery projection": BOUNDARY (db1): the Shard 04 delivery projection is not built, so it cannot be a registered caller to assert (gaps_db1_acl.sql "no function calls cms_resolve_locale_field yet" records only that no caller exists).',
  },
  {
    criterion: 'P2-S12-AC-151',
    text: 'CMS-03C-20 is read-only and deterministic, performing no insert, update, delete, audit row or outbox row, so a retry is harmless and identical inputs resolve identically.',
    clauses: [
      {
        text: 'CMS-03C-20 is read-only and deterministic, performing no insert, update, delete, audit row or outbox row, so a retry is harmless and identical inputs resolve identically.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_resolution/002-resolver.sqlinc',
            title:
              'identical inputs resolve identically: 24 field and locale pairs, read twice [P2-S12-AC-151]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_resolution/002-resolver.sqlinc',
            title:
              'resolving 48 times inserts no variant, revision, value, audit row, outbox row or idempotency receipt [P2-S12-AC-151]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_resolution/002-resolver.sqlinc',
            title:
              'the resolver is STABLE, SECURITY DEFINER with an empty search_path and owned by the CMS definer [P2-S12-AC-151]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-152',
    text: 'CMS-03C-20 is consumed by the 03b `locale` preflight provider, by the Shard 04 delivery projection (which adds no resolution rule of its own) and by `CmsLocaleVariantForm` per-field resolution, so a field blocked at publication is never resolved differently at delivery; verification covers the resolver for each `localizationMode`, the fallback chain walk and `resolvedFromLocale`, and the absence of the RPC from browser routes.',
    clauses: [
      {
        text: 'CMS-03C-20 is consumed by the 03b `locale` preflight provider',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_locale_gate.sql',
            title:
              'the CMS-03C-20 resolver answers the same reason code as the gate for the missing no_fallback field [P2-S12-AC-148]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_locale_gate.sql',
            title:
              'the resolver reports no blocking reason for the same value: gate verdict and resolver agree [P2-S12-AC-148]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_locale_gate.sql',
            title:
              'the resolver answers no_fallback_stale for the same field: one resolver behind the gate and the delivery-side call [P2-S12-AC-148]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_acl.sql',
            title:
              'the 03b locale preflight gate runs the shared resolver core cms_locale_resolutions, the resolver cms_resolve_locale_field also uses [P2-S12-AC-148]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_acl.sql',
            title:
              'the registered callers of the resolver core are exactly the publication preflight gate, the CMS-03C-04 editorial reader and the field resolver [P2-S12-AC-150]',
          },
        ],
      },
      {
        text: 'by the Shard 04 delivery projection (which adds no resolution rule of its own)',
        citations: [],
      },
      {
        text: 'by `CmsLocaleVariantForm` per-field resolution',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_variant_read/001-shape-and-grants.sqlinc',
            title:
              'the resolutions come from the CMS-03C-20 resolver core, not a second implementation [P2-S12-AC-152]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_variant_read/002-read.sqlinc',
            title:
              'the resolutions are exactly the CMS-03C-20 resolver output for every localizable field, ascending by field id [P2-S12-AC-152]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_variant_read/002-read.sqlinc',
            title: 'fr-CA resolutions equal the resolver [P2-S12-AC-152]',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-locale/CmsLocaleVariantForm.test.tsx',
            title:
              'CmsLocaleVariantForm: what the page shows (FE03 :891, :1122, :1336) shows each resolution as text and never another language’s text for a no_fallback field',
          },
        ],
      },
      {
        text: 'so a field blocked at publication is never resolved differently at delivery',
        citations: [],
      },
      {
        text: 'verification covers the resolver for each `localizationMode`',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_resolution/002-resolver.sqlinc',
            title:
              'a none field resolves to the source-locale value in any locale [P2-S12-AC-149]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_resolution/002-resolver.sqlinc',
            title:
              'a localized field resolves to the field in the target locale own revision when present [P2-S12-AC-149]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_resolution/002-resolver.sqlinc',
            title:
              'a no_fallback field is never resolved through fallbackChains: en-US holds terms, fr-FR does not, it blocks [P2-S12-AC-051]',
          },
        ],
      },
      {
        text: 'the fallback chain walk and `resolvedFromLocale`',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_resolution/002-resolver.sqlinc',
            title:
              'a localized field without a target value walks the active fallback chain and records resolvedFromLocale [P2-S12-AC-149]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_resolution/002-resolver.sqlinc',
            title:
              'the chain is walked in order: fr-CA takes the fr-FR value before the default locale [P2-S12-AC-149]',
          },
        ],
      },
      {
        text: 'the absence of the RPC from browser routes.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_locale_resolution/002-resolver.sqlinc',
            title:
              'no platform_api (browser reachable) wrapper of the resolver exists [P2-S12-AC-150]',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI inventory [P2-S12-AC-275] documents none of CMS-03C-18 to CMS-03C-21, their RPCs, providers or contracts',
          },
        ],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven (uncited clauses): "by the Shard 04 delivery projection (which adds no resolution rule of its own)": BOUNDARY (lane gaps-db1): the Shard 04 delivery projection is not built; acl.sql proves cms_resolve_locale_field has no caller yet (gd_referrers = empty), so there is no consumer to test. Needs the Shard 04 delivery slice: pgTAP asserting the projection output equals cms_resolve_locale_field per localizationMode and that its body holds no localization rule. "so a field blocked at publication is never resolved differently at delivery": BOUNDARY: "never resolved differently at delivery" needs the unbuilt Shard 04 delivery projection (see clause 1). The gate-versus-resolver agreement is cited under clause 0 but proves only the publication side.',
  },
  {
    criterion: 'P2-S12-AC-153',
    text: 'CMS-03C-21 is the database RPC `platform_private.cms_related_content_public_targets(p_source_entry_id uuid, p_locale text, p_audience text)` returning an ordered array of at most 128 strict `RelatedPublicTarget` records (`entryId`, `source` `pin` or `derived`, a nullable `reasonCode` and `position` 0-127); it has no browser route and is absent from the browser route inventory.',
    clauses: [
      {
        text: 'CMS-03C-21 is the database RPC `platform_private.cms_related_content_public_targets(p_source_entry_id uuid, p_locale text, p_audience text)` returning an ordered array of at most 128 strict `RelatedPublicTarget` records (`entryId`, `source` `pin` or `derived`, a nullable `reasonCode` and `position` 0-127); it has no browser route and is absent from the browser route inventory.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/002-shape-and-grants.sqlinc',
            title:
              'CMS-03C-21 answers one jsonb array of RelatedPublicTarget [P2-S12-AC-153]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/002-shape-and-grants.sqlinc',
            title:
              'CMS-03C-21 is a private SECURITY DEFINER function of the CMS definer with PUBLIC, anon, authenticated and service_role execute revoked [P2-S12-AC-155]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_public_targets/001-projection.sqlinc',
            title:
              'the projection satisfies the RelatedPublicTarget list contract [P2-S12-AC-153]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_public_targets/001-projection.sqlinc',
            title:
              'the first target is exactly { entryId, source: pin, reasonCode: null, position: 0 } [P2-S12-AC-153]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_public_targets/001-projection.sqlinc',
            title: 'pins carry source pin and a null reason [P2-S12-AC-153]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_public_targets/003-bound.sqlinc',
            title: 'the last position is 127 [P2-S12-AC-153]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_public_targets/003-bound.sqlinc',
            title:
              'the projection is cut at exactly 128 targets [P2-S12-AC-154]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_public_targets/003-bound.sqlinc',
            title: 'the 128-target list satisfies the contract [P2-S12-AC-153]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_public_targets/002-recompute-and-ties.sqlinc',
            title: 'a null source is invalid [P2-S12-AC-153]',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/related-public-target.test.ts',
            title:
              'CMS-03C-21 related public targets (D11, OD-5) [P2-S12-AC-153] takes the source entry, the locale and the audience of the RPC',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/related-public-target.test.ts',
            title:
              'CMS-03C-21 related public targets (D11, OD-5) [P2-S12-AC-153] bounds position 0 to 127 and the reason code grammar and refuses any other member',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/related-public-target.test.ts',
            title:
              'CMS-03C-21 related public targets (D11, OD-5) [P2-S12-AC-154] returns at most 128 targets, pins first in position order and then derived candidates in rank order',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/002-shape-and-grants.sqlinc',
            title:
              'CMS-03C-21 has no platform_api wrapper and so no browser route [P2-S12-AC-153]',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI inventory [P2-S12-AC-275] documents none of CMS-03C-18 to CMS-03C-21, their RPCs, providers or contracts',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono inventory [P2-S12-AC-275] mounts no internal service operation, RPC, job or provider path (CMS-03C-18 to CMS-03C-21)',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-154',
    text: "CMS-03C-21 returns eligible pins first in `position` order (public eligibility: the target's lineage head is an `active` `publish` row for `(locale, audience)` and no hold applies), then derived candidates in rank order, always removes exclusions, and refills a vacated slot only from eligible derived candidates.",
    clauses: [
      {
        text: "CMS-03C-21 returns eligible pins first in `position` order (public eligibility: the target's lineage head is an `active` `publish` row for `(locale, audience)` and no hold applies), then derived candidates in rank order, always removes exclusions, and refills a vacated slot only from eligible derived candidates.",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_public_targets/001-projection.sqlinc',
            title:
              'only the pins whose lineage head is an active publish row for (en-US, public) are projected, in pin position order [P2-S12-AC-154]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_public_targets/001-projection.sqlinc',
            title:
              'the locale scopes the lineage head: fr-FR projects only the pin published in fr-FR [P2-S12-AC-154]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_public_targets/001-projection.sqlinc',
            title:
              'the audience scopes the lineage head: members projects only the members pin [P2-S12-AC-154]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_public_targets/001-projection.sqlinc',
            title:
              'a locale with no publication projects nothing [P2-S12-AC-154]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_public_targets/002-recompute-and-ties.sqlinc',
            title:
              'an archived entry disappears from the pins at the next call [P2-S12-AC-157]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_public_targets/002-recompute-and-ties.sqlinc',
            title:
              'the derived list follows: the archived x6, held x7, foreign-owned c1 and unpublished c3 are gone, the newly published x5 leads (exclusion of c3 still wins) [P2-S12-AC-157]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_public_targets/001-projection.sqlinc',
            title:
              'pin c2 first, then the four best-ranked eligible candidates (two shared terms: srcp, c6, c5 by head created_at desc; then c3 with one); the excluded c1 and the pinned c2 are not candidates [P2-S12-AC-231]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_public_targets/001-projection.sqlinc',
            title:
              "published-revision ranking: score 2 (c6 c5 c1 by head created_at desc), score 1 (c3 c2), score 0 (xo x7 x6 srcm c7 c4); a deprecated, superseded or revoked term counts for nothing; the draft's term3 is ignored [P2-S12-AC-231]",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_public_targets/001-projection.sqlinc',
            title:
              'pin c3 first (not repeated as a candidate), then the three most recent same-type candidates [P2-S12-AC-232]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_public_targets/001-projection.sqlinc',
            title:
              'with c1 excluded again the slot is refilled by the next eligible candidate c3, never by c1 [P2-S12-AC-154]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_public_targets/001-projection.sqlinc',
            title:
              'without the exclusion, c1 (two shared terms, oldest head) takes the fourth derived slot [P2-S12-AC-154]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_public_targets/001-projection.sqlinc',
            title:
              'all same-type eligible candidates by head created_at desc; the article-typed c5 and the excluded c3 are absent [P2-S12-AC-232]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_public_targets/002-recompute-and-ties.sqlinc',
            title:
              'before revocation: pin c1, then the five most recent candidates: maxCandidates bounds the derived candidates only, the pin does not count against it (BE03c 1383) [P2-S12-AC-154]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_public_targets/003-bound.sqlinc',
            title: 'the 32 pins come first in pin order [P2-S12-AC-154]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_public_targets/003-bound.sqlinc',
            title:
              'the remaining 96 slots are derived candidates [P2-S12-AC-154]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_public_targets/003-bound.sqlinc',
            title:
              'pins 32 + derived candidates bounded to 64 (excluded b033..b064 are never candidates) = 96 targets [P2-S12-AC-154]',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/related-public-target.test.ts',
            title:
              'CMS-03C-21 related public targets (D11, OD-5) [P2-S12-AC-154] returns at most 128 targets, pins first in position order and then derived candidates in rank order',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-155',
    text: 'CMS-03C-21 is executable only by the registered non-browser callers (the Shard 04 delivery projection and the Slice 11 related-content recheck; PUBLIC, anon, authenticated and every other role have EXECUTE revoked), never returns a draft, hidden, unpublished or other-owner target, and never lets a recommendation grant access.',
    clauses: [
      {
        text: 'CMS-03C-21 is executable only by the registered non-browser callers',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db4_related_acl.sql',
            title:
              'no platform_api wrapper exposes CMS-03C-21: the operation has no browser route [P2-S12-AC-155]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db4_related_acl.sql',
            title:
              'CMS-03C-21 cms_related_content_public_targets is executable by its owner wejammin_cms_definer and by no other role, PUBLIC included [P2-S12-AC-155]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db4_related_acl.sql',
            title:
              "no non-superuser role outside the definer's membership can execute CMS-03C-21: anon, authenticated, service_role, authenticator and every other role are revoked [P2-S12-AC-155]",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db4_related_acl.sql',
            title:
              'service_role (the sweep principal of other operations) calling CMS-03C-21 is denied 42501 [P2-S12-AC-155]',
          },
        ],
      },
      {
        text: '(the Shard 04 delivery projection and the Slice 11 related-content recheck',
        citations: [],
      },
      {
        text: 'PUBLIC, anon, authenticated',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/002-shape-and-grants.sqlinc',
            title:
              'CMS-03C-21 is a private SECURITY DEFINER function of the CMS definer with PUBLIC, anon, authenticated and service_role execute revoked [P2-S12-AC-155]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/002-shape-and-grants.sqlinc',
            title:
              'CMS-03C-21 has no platform_api wrapper and so no browser route [P2-S12-AC-153]',
          },
        ],
      },
      {
        text: 'and every other role have EXECUTE revoked)',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db4_related_acl.sql',
            title:
              'CMS-03C-21 cms_related_content_public_targets is executable by its owner wejammin_cms_definer and by no other role, PUBLIC included [P2-S12-AC-155]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db4_related_acl.sql',
            title:
              'the public-eligibility head predicate CMS-03C-21 calls is owner-only as well [P2-S12-AC-155]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db4_related_acl.sql',
            title:
              'the derived-candidate reader CMS-03C-21 calls is owner-only as well [P2-S12-AC-155]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db4_related_acl.sql',
            title:
              "no non-superuser role outside the definer's membership can execute CMS-03C-21: anon, authenticated, service_role, authenticator and every other role are revoked [P2-S12-AC-155]",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db4_related_acl.sql',
            title:
              'anon, with schema USAGE, calling CMS-03C-21 is denied 42501 by the function ACL [P2-S12-AC-155]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db4_related_acl.sql',
            title:
              'authenticated, with schema USAGE, calling CMS-03C-21 is denied 42501 by the function ACL [P2-S12-AC-155]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db4_related_acl.sql',
            title:
              'service_role (the sweep principal of other operations) calling CMS-03C-21 is denied 42501 [P2-S12-AC-155]',
          },
        ],
      },
      {
        text: 'never returns a draft, hidden, unpublished or other-owner target',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_public_targets/001-projection.sqlinc',
            title:
              'only the pins whose lineage head is an active publish row for (en-US, public) are projected, in pin position order [P2-S12-AC-154]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_public_targets/001-projection.sqlinc',
            title:
              'an unpublished (tombstoned), other-locale and other-audience entry is never a candidate [P2-S12-AC-155]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_public_targets/002-recompute-and-ties.sqlinc',
            title:
              'an archived entry disappears from the pins at the next call [P2-S12-AC-157]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_public_targets/002-recompute-and-ties.sqlinc',
            title:
              'an entry now owned by another party disappears: a recommendation never crosses owners [P2-S12-AC-155]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_public_targets/002-recompute-and-ties.sqlinc',
            title:
              'the derived list follows: the archived x6, held x7, foreign-owned c1 and unpublished c3 are gone, the newly published x5 leads (exclusion of c3 still wins) [P2-S12-AC-157]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_public_targets/002-recompute-and-ties.sqlinc',
            title:
              'an unpublished entry (tombstone head) disappears [P2-S12-AC-157]',
          },
        ],
      },
      {
        text: 'never lets a recommendation grant access.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_public_targets/001-projection.sqlinc',
            title:
              'only the pins whose lineage head is an active publish row for (en-US, public) are projected, in pin position order [P2-S12-AC-154]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_public_targets/002-recompute-and-ties.sqlinc',
            title:
              'an entry now owned by another party disappears: a recommendation never crosses owners [P2-S12-AC-155]',
          },
        ],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven (uncited clause): "(the Shard 04 delivery projection and the Slice 11 related-content recheck": BOUNDARY: neither registered caller exists yet (the Shard 04 delivery projection is a later shard; the Slice 11 related-content recheck does not call CMS-03C-21); the owner-only EXECUTE and the empty caller inventory are cited on the first part, and the callers are proven when their shards land (the AC-150 shape).',
  },
  {
    criterion: 'P2-S12-AC-156',
    text: 'CMS-03C-21 is read-only, bounded to 128 targets, recomputed at every projection, preview and publication and never stored, performing no insert, update, delete, audit row or outbox row.',
    clauses: [
      {
        text: 'CMS-03C-21 is read-only, bounded to 128 targets, recomputed at every projection, preview and publication and never stored, performing no insert, update, delete, audit row or outbox row.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_public_targets/002-recompute-and-ties.sqlinc',
            title:
              'three projections wrote no rule, audit, outbox, idempotency, entry or publication row [P2-S12-AC-156]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/002-shape-and-grants.sqlinc',
            title:
              'CMS-03C-21 is a STABLE read: no insert, update, delete, audit or outbox row [P2-S12-AC-156]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_public_targets/002-recompute-and-ties.sqlinc',
            title:
              'the projection is deterministic: the same inputs give the same list [P2-S12-AC-156]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_public_targets/003-bound.sqlinc',
            title:
              'the projection is cut at exactly 128 targets [P2-S12-AC-154]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_public_targets/002-recompute-and-ties.sqlinc',
            title:
              'a pinned entry published after the pin appears at its pin position: nothing was stored at write time [P2-S12-AC-156]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_public_targets/002-recompute-and-ties.sqlinc',
            title:
              'an archived entry disappears from the pins at the next call [P2-S12-AC-157]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_public_targets/001-projection.sqlinc',
            title:
              'preview ranking uses the draft terms {term1, term2}: srcp joins the score-2 group at the top [P2-S12-AC-231]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-157',
    text: 'CMS-03C-21 lets a target that becomes unpublished or unavailable disappear from the output while its editorial explanation and history stay private, so a stale or unavailable target is never exposed.',
    clauses: [
      {
        text: 'CMS-03C-21 lets a target that becomes unpublished or unavailable disappear from the output while its editorial explanation and history stay private, so a stale or unavailable target is never exposed.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_public_targets/002-recompute-and-ties.sqlinc',
            title:
              'an archived entry disappears from the pins at the next call [P2-S12-AC-157]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_public_targets/002-recompute-and-ties.sqlinc',
            title:
              'an entry now owned by another party disappears: a recommendation never crosses owners [P2-S12-AC-155]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_public_targets/002-recompute-and-ties.sqlinc',
            title:
              'an unpublished entry (tombstone head) disappears [P2-S12-AC-157]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_public_targets/002-recompute-and-ties.sqlinc',
            title:
              'the derived list follows: the archived x6, held x7, foreign-owned c1 and unpublished c3 are gone, the newly published x5 leads (exclusion of c3 still wins) [P2-S12-AC-157]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_public_targets/002-recompute-and-ties.sqlinc',
            title:
              'the stored pins are untouched by their targets leaving the public list (editorial history stays private) [P2-S12-AC-157]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_public_targets/002-recompute-and-ties.sqlinc',
            title:
              'a revoked rule set projects nothing; its history stays private [P2-S12-AC-157]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/002-shape-and-grants.sqlinc',
            title:
              'no API role holds a direct privilege on the rule table [P2-S12-AC-261]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_public_targets/001-projection.sqlinc',
            title:
              'the projection satisfies the RelatedPublicTarget list contract [P2-S12-AC-153]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-158',
    text: 'CMS-03C-21 is consumed by the Shard 04 delivery projection (which re-implements neither resolution nor eligibility) and by the Slice 11 related-content recheck; verification covers pins-first ordering, the deterministic `shared-terms` and `same-type-recent` ranking and tie-breaks, the 128-target bound, refill only from eligible derived candidates, recomputation at every projection, and the absence of the RPC from browser routes.',
    clauses: [
      {
        text: 'CMS-03C-21 is consumed by the Shard 04 delivery projection (which re-implements neither resolution nor eligibility)',
        citations: [],
      },
      {
        text: 'by the Slice 11 related-content recheck',
        citations: [],
      },
      {
        text: 'verification covers pins-first ordering',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_public_targets/001-projection.sqlinc',
            title:
              'only the pins whose lineage head is an active publish row for (en-US, public) are projected, in pin position order [P2-S12-AC-154]',
          },
        ],
      },
      {
        text: 'the deterministic `shared-terms` and `same-type-recent` ranking and tie-breaks',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_public_targets/001-projection.sqlinc',
            title:
              "published-revision ranking: score 2 (c6 c5 c1 by head created_at desc), score 1 (c3 c2), score 0 (xo x7 x6 srcm c7 c4); a deprecated, superseded or revoked term counts for nothing; the draft's term3 is ignored [P2-S12-AC-231]",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_public_targets/001-projection.sqlinc',
            title:
              'pin c3 first (not repeated as a candidate), then the three most recent same-type candidates [P2-S12-AC-232]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_public_targets/002-recompute-and-ties.sqlinc',
            title:
              'shared-terms: srcp (newest, two shared), then the tied c5/c6 by entry id ascending, then c2 (one shared), then the zero-share group x5 xo srcm and the tied c7/c4 by entry id ascending [P2-S12-AC-231]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_public_targets/002-recompute-and-ties.sqlinc',
            title:
              'same-type-recent: head created_at desc with the tied c7/c4 by entry id ascending; the article c5 is outside the type [P2-S12-AC-232]',
          },
        ],
      },
      {
        text: 'the 128-target bound',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_public_targets/003-bound.sqlinc',
            title:
              'the projection is cut at exactly 128 targets [P2-S12-AC-154]',
          },
        ],
      },
      {
        text: 'refill only from eligible derived candidates',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_public_targets/001-projection.sqlinc',
            title:
              'with c1 excluded again the slot is refilled by the next eligible candidate c3, never by c1 [P2-S12-AC-154]',
          },
        ],
      },
      {
        text: 'recomputation at every projection',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_public_targets/002-recompute-and-ties.sqlinc',
            title:
              'a pinned entry published after the pin appears at its pin position: nothing was stored at write time [P2-S12-AC-156]',
          },
        ],
      },
      {
        text: 'the absence of the RPC from browser routes.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_related_content/002-shape-and-grants.sqlinc',
            title:
              'CMS-03C-21 has no platform_api wrapper and so no browser route [P2-S12-AC-153]',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI inventory [P2-S12-AC-275] documents none of CMS-03C-18 to CMS-03C-21, their RPCs, providers or contracts',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono inventory [P2-S12-AC-275] mounts no internal service operation, RPC, job or provider path (CMS-03C-18 to CMS-03C-21)',
          },
        ],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven (uncited clauses): "CMS-03C-21 is consumed by the Shard 04 delivery projection (which re-implements neither resolutio..." and "by the Slice 11 related-content recheck": missing test: neither named consumer exists (no code other than tests calls cms_related_content_public_targets; the Shard 04 delivery projection is unbuilt and the Slice 11 related-content recheck has no call site), so "consumed by the Shard 04 delivery projection (which re-implements neither resolution nor eligibility) and by the Slice 11 related-content recheck" and "recomputation at every projection" by those consumers are untested. Layer: pgTAP in the Shard 04 delivery-projection suite and the Slice 11 recheck suite asserting each calls the RPC (function-body or behavioural equality with the RPC) and carries no eligibility/ranking SQL of its own (spec BE03c Related-content eligibility and derived rules, D11/OD-5).',
  },
  {
    criterion: 'P2-S12-AC-159',
    text: 'cmsTemplateContextRead registers GET /api/v1/cms/templates/context with an empty request and returns the strict `TemplateDesignerContext`: at most 64 owned active compiled content-type selectors (`id`, `typeKey`, `activeVersionId`, `activeVersion`, `sourceLocale`) and at most 128 owned registered, currently supported block selectors (`blockKey`, `blockVersion`), excluding owner IDs, grant records, renderer refs, manifests and policy internals; generated OpenAPI and the discovered Hono route match the registry row.',
    clauses: [
      {
        text: 'cmsTemplateContextRead registers GET /api/v1/cms/templates/context with an empty request',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-template-openapi.test.ts',
            title:
              'Slice 12 CMS-03C-01 canonical OpenAPI authority registers a separate protected, no-store CMS-11 context read',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI cmsTemplateContextRead [P2-S12-AC-275] publishes auth, CORS, CSRF, idempotency, If-Match, rate, timeout, cache and SLO extensions equal to the fixture',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI cmsTemplateContextRead [P2-S12-AC-275] documents the BE03c parameters, and a JSON body exactly for a write',
          },
        ],
      },
      {
        text: 'returns the strict `TemplateDesignerContext`',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/template.test.ts',
            title:
              'CMS-03C-01 template definition contracts accepts only a bounded, disclosure-safe designer context',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-context-routes.test.ts',
            title:
              'CMS-11 protected template context read fails closed on malformed provider data',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-12-template-reads.apispec.ts',
            title:
              "cmsTemplateContextRead through the real stack [P2-S12-AC-159] [P2-S12-AC-161] returns only the caller owner's active content types, strictly, with no-store",
          },
        ],
      },
      {
        text: 'at most 64',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/template.test.ts',
            title:
              'CMS-03C-01 template definition contracts accepts only a bounded, disclosure-safe designer context',
          },
        ],
      },
      {
        text: 'owned',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-12-template-reads.apispec.ts',
            title:
              "cmsTemplateContextRead through the real stack [P2-S12-AC-159] [P2-S12-AC-161] returns only the caller owner's active content types, strictly, with no-store",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_fix_template_reads_rpc_context.sql',
            title:
              'and only that one: no content type of another owner [P2-S12-AC-159]',
          },
        ],
      },
      {
        text: 'active compiled',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_template.sql',
            title:
              'an active type with an active version and a compiled artifact lists typeKey, activeVersionId and activeVersion equal to the stored rows [P2-S12-AC-159]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_template.sql',
            title:
              'a retired type and an active type with no active version are excluded [P2-S12-AC-159]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_template.sql',
            title:
              'an active compiled type of ANOTHER owner is excluded [P2-S12-AC-159]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_template.sql',
            title:
              'among the gap fixture types only the active, owned, active-version type is listed [P2-S12-AC-159]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_template.sql',
            title:
              'a stored schema artifact can only be compiled, so every listed active version has a compiled artifact [P2-S12-AC-159]',
          },
        ],
      },
      {
        text: 'content-type selectors (`id`, `typeKey`, `activeVersionId`, `activeVersion`, `sourceLocale`)',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-12-template-reads.apispec.ts',
            title:
              "cmsTemplateContextRead through the real stack [P2-S12-AC-159] [P2-S12-AC-161] returns only the caller owner's active content types, strictly, with no-store",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_fix_template_reads_rpc_context.sql',
            title:
              "it lists the caller owner's active compiled content type [P2-S12-AC-159]",
          },
        ],
      },
      {
        text: 'at most 128 owned registered, currently supported block selectors (`blockKey`, `blockVersion`)',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_template.sql',
            title:
              '129 owned supported candidates are cut at exactly 128 selectors [P2-S12-AC-159]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_template.sql',
            title:
              'the first selector is the lowest owned supported key: the deprecated, foreign and withdrawn blocks sort before it and are absent [P2-S12-AC-159]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_template.sql',
            title:
              'the cut keeps the first 128 keys in C-collation order, dropping gap.b128 [P2-S12-AC-159]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_template.sql',
            title:
              "a deprecated block, a withdrawn block and another owner's block are not selectors [P2-S12-AC-159]",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_template.sql',
            title:
              'every block selector is exactly {blockKey, blockVersion} [P2-S12-AC-159]',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/template.context-bounds.test.ts',
            title:
              'TemplateDesignerContext bounds accepts exactly 128 registered block selectors and refuses 129',
          },
        ],
      },
      {
        text: 'excluding owner IDs, grant records, renderer refs, manifests and policy internals',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/template.test.ts',
            title:
              'CMS-03C-01 template definition contracts accepts only a bounded, disclosure-safe designer context',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_context.sql',
            title:
              'context contains only bounded safe active type and block selectors',
          },
        ],
      },
      {
        text: 'generated OpenAPI',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-template-openapi.test.ts',
            title:
              'Slice 12 CMS-03C-01 canonical OpenAPI authority registers a separate protected, no-store CMS-11 context read',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI cmsTemplateContextRead [P2-S12-AC-275] is generated at its BE03c method and path with its operation id',
          },
        ],
      },
      {
        text: 'the discovered Hono route match the registry row.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-template-openapi.test.ts',
            title:
              'Slice 12 CMS-03C-01 canonical OpenAPI authority registers a separate protected, no-store CMS-11 context read',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-context-routes.test.ts',
            title:
              'CMS-11 protected template context read returns only validated owner-scoped selectors with no-store',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono cmsTemplateContextRead [P2-S12-AC-275] mounts its method and path, and a CORS preflight route at the same path',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-160',
    text: 'cmsTemplateContextRead accepts an empty request only: no request body, no CSRF requirement, no `Idempotency-Key`, no `If-Match` and no owner selector, with the owner and acting context derived server-side, and an invalid query is 400.',
    clauses: [
      {
        text: 'cmsTemplateContextRead accepts an empty request only',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-template-openapi.test.ts',
            title:
              'Slice 12 CMS-03C-01 canonical OpenAPI authority registers a separate protected, no-store CMS-11 context read',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-context-routes.test.ts',
            title:
              "CMS-11 protected template context read rejects 'query selector' before authorization or the RPC",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-context-routes.test.ts',
            title:
              "CMS-11 protected template context read rejects 'nonempty body claim' on a read before authorization or the RPC",
          },
        ],
      },
      {
        text: 'no request body',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-context-routes.test.ts',
            title:
              'CMS-11 protected template context read answers request media on a read with 415 and an empty allowlist (BE00)',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-context-routes.test.ts',
            title:
              "CMS-11 protected template context read rejects 'request media' on a read before authorization or the RPC",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-context-routes.test.ts',
            title:
              "CMS-11 protected template context read rejects 'nonempty body claim' on a read before authorization or the RPC",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-context-routes.test.ts',
            title:
              "CMS-11 protected template context read rejects 'transfer encoding' on a read before authorization or the RPC",
          },
        ],
      },
      {
        text: 'no CSRF requirement',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-template-openapi.test.ts',
            title:
              'Slice 12 CMS-03C-01 canonical OpenAPI authority registers a separate protected, no-store CMS-11 context read',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-context-routes.test.ts',
            title:
              'CMS-11 protected template context read returns only validated owner-scoped selectors with no-store',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI cmsTemplateContextRead [P2-S12-AC-275] publishes auth, CORS, CSRF, idempotency, If-Match, rate, timeout, cache and SLO extensions equal to the fixture',
          },
        ],
      },
      {
        text: 'no `Idempotency-Key`, no `If-Match`',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-context-routes.test.ts',
            title:
              "CMS-11 protected template context read rejects 'idempotency key' on a read before authorization or the RPC",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-context-routes.test.ts',
            title:
              "CMS-11 protected template context read rejects 'write precondition' on a read before authorization or the RPC",
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI cmsTemplateContextRead [P2-S12-AC-275] publishes auth, CORS, CSRF, idempotency, If-Match, rate, timeout, cache and SLO extensions equal to the fixture',
          },
        ],
      },
      {
        text: 'no owner selector',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-context-routes.test.ts',
            title:
              "CMS-11 protected template context read rejects 'query selector' before authorization or the RPC",
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/pages/api/v1/cms/templates/context.test.ts',
            title:
              'same-origin template context read rejects query authority and malformed provider data',
          },
        ],
      },
      {
        text: 'with the owner and acting context derived server-side',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-context.test.ts',
            title:
              'CMS-03C-01 production template adapter reads only the named protected context RPC with server-derived identity',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-context.test.ts',
            title:
              'CMS-03C-01 production template adapter rejects invalid context operation and mismatched verified session before transport',
          },
        ],
      },
      {
        text: 'an invalid query is 400.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-context-routes.test.ts',
            title:
              "CMS-11 protected template context read rejects 'query selector' before authorization or the RPC",
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/pages/api/v1/cms/templates/context.test.ts',
            title:
              'same-origin template context read rejects query authority and malformed provider data',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-161',
    text: 'cmsTemplateContextRead serves only an authenticated human with confirmed acting-party membership and an active `cms.template_designer` grant, rechecks the actor, acting party, confirmed membership and current designer grant on every read in a private RPC that the browser and authenticated database roles cannot call or read through its source tables, answers a denied read as 403, and never reserves permission for a later write.',
    clauses: [
      {
        text: 'cmsTemplateContextRead serves only an authenticated human',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-12-template-reads.apispec.ts',
            title:
              'cmsTemplateContextRead through the real stack [P2-S12-AC-161] no session is 401, no designer capability is 403, and a revoked database grant is 403 from the database',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-context-routes.test.ts',
            title:
              "CMS-11 protected template context read fails closed for 'unauthenticated' session",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-context-routes.test.ts',
            title:
              "CMS-11 protected template context read fails closed for 'malformed human' session",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-context-routes.test.ts',
            title:
              "CMS-11 protected template context read fails closed for 'no acting party' session",
          },
        ],
      },
      {
        text: 'with confirmed acting-party membership',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_template_context.sql',
            title:
              'an invited (unconfirmed) tenure is refused FORBIDDEN [P2-S12-AC-161]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_template_context.sql',
            title:
              'a tenure in state ended is refused FORBIDDEN [P2-S12-AC-161]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_template_context.sql',
            title:
              'a confirmed tenure whose end date has passed is refused FORBIDDEN [P2-S12-AC-161]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_template_context.sql',
            title:
              'control: restoring the confirmed unended tenure restores the read [P2-S12-AC-161]',
          },
        ],
      },
      {
        text: 'an active `cms.template_designer` grant',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-12-template-reads.apispec.ts',
            title:
              'cmsTemplateContextRead through the real stack [P2-S12-AC-161] no session is 401, no designer capability is 403, and a revoked database grant is 403 from the database',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-context-routes.test.ts',
            title:
              'CMS-11 protected template context read denies missing designer authority before invoking the RPC',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_context.sql',
            title: 'authorized template designer can read context',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_context.sql',
            title:
              'revoked designer grant denies context without disclosing records',
          },
        ],
      },
      {
        text: 'rechecks the actor, acting party, confirmed membership',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_template_context.sql',
            title:
              'an invited (unconfirmed) tenure is refused FORBIDDEN [P2-S12-AC-161]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_template_context.sql',
            title:
              'a confirmed tenure whose end date has passed is refused FORBIDDEN [P2-S12-AC-161]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_template_context.sql',
            title:
              'an acting party the actor is not a member of is refused FORBIDDEN [P2-S12-AC-161]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_template_context.sql',
            title:
              'an authenticated user with no person binding is refused FORBIDDEN [P2-S12-AC-161]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_template_context.sql',
            title:
              'an unknown actor is refused UNAUTHENTICATED [P2-S12-AC-161]',
          },
        ],
      },
      {
        text: 'current designer grant on every read',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_context.sql',
            title: 'authorized template designer can read context',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_context.sql',
            title:
              'revoked designer grant denies context without disclosing records',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-12-template-reads.apispec.ts',
            title:
              'cmsTemplateContextRead through the real stack [P2-S12-AC-161] no session is 401, no designer capability is 403, and a revoked database grant is 403 from the database',
          },
        ],
      },
      {
        text: 'in a private RPC that the browser and authenticated database roles cannot call',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_context.sql',
            title: 'browser roles cannot execute the context RPC directly',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_09_r8_api_surface.sql',
            title:
              'every amendment and supporting RPC is service-role only: never anon, PUBLIC or authenticated [P2-S09-AC-180]',
          },
        ],
      },
      {
        text: 'read through its source tables',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_09_evidence_misc.sql',
            title:
              'no cms_ table grants any direct privilege to anon, authenticated or service_role [P2-S09-AC-181]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_fix_template_reads_rpc_context.sql',
            title:
              "it lists the caller owner's active compiled content type [P2-S12-AC-159]",
          },
        ],
      },
      {
        text: 'answers a denied read as 403',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-context-routes.test.ts',
            title:
              'CMS-11 protected template context read denies missing designer authority before invoking the RPC',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-context.test.ts',
            title:
              'CMS-03C-01 production template adapter maps context RPC denial and refuses malformed or unavailable projections',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-12-template-reads.apispec.ts',
            title:
              'cmsTemplateContextRead through the real stack [P2-S12-AC-161] no session is 401, no designer capability is 403, and a revoked database grant is 403 from the database',
          },
        ],
      },
      {
        text: 'never reserves permission for a later write.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_template_context.sql',
            title:
              'a context read writes no audit, outbox, idempotency or template row [P2-S12-AC-161]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_template_context.sql',
            title:
              'after a successful context read and a grant end, CMS-03C-01 is refused FORBIDDEN: the read reserved no permission [P2-S12-AC-161]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_template_context.sql',
            title: 'the refused POST created no template row [P2-S12-AC-161]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-162',
    text: 'cmsTemplateContextRead is a no-store, read-only call that accepts neither `Idempotency-Key` nor `If-Match` and enforces read buckets of 60/min/user and 60/min/party, a 15,000 ms deadline and the Tier 2 target.',
    clauses: [
      {
        text: 'cmsTemplateContextRead is a no-store',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-context-routes.test.ts',
            title:
              'CMS-11 protected template context read returns only validated owner-scoped selectors with no-store',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/pages/api/v1/cms/templates/context.test.ts',
            title:
              'same-origin template context read is dynamic, forwards only approved cookies, and validates its body',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI cmsTemplateContextRead [P2-S12-AC-275] publishes auth, CORS, CSRF, idempotency, If-Match, rate, timeout, cache and SLO extensions equal to the fixture',
          },
        ],
      },
      {
        text: 'read-only call that accepts neither `Idempotency-Key` nor `If-Match`',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-context-routes.test.ts',
            title:
              "CMS-11 protected template context read rejects 'idempotency key' on a read before authorization or the RPC",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-context-routes.test.ts',
            title:
              "CMS-11 protected template context read rejects 'write precondition' on a read before authorization or the RPC",
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI cmsTemplateContextRead [P2-S12-AC-275] publishes auth, CORS, CSRF, idempotency, If-Match, rate, timeout, cache and SLO extensions equal to the fixture',
          },
        ],
      },
      {
        text: 'enforces read buckets of 60/min/user and 60/min/party',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-worker-rate.test.ts',
            title:
              '[P2-S12-AC-275] Worker quota cmsTemplateContextRead [P2-S12-AC-275] asks for its BE03c user and party buckets in order, then answers the denied party bucket with the BE00 429',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI cmsTemplateContextRead [P2-S12-AC-275] publishes auth, CORS, CSRF, idempotency, If-Match, rate, timeout, cache and SLO extensions equal to the fixture',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-context-routes.test.ts',
            title:
              'CMS-11 protected template context read publishes the BE00 429 details and RateLimit headers on the context route',
          },
        ],
      },
      {
        text: 'a 15,000 ms deadline',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-context-routes.test.ts',
            title:
              'CMS-11 protected template context read enforces a total deadline and catches unexpected execution failures',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-worker-policy.test.ts',
            title:
              '[P2-S12-AC-275] Worker deadline cmsTemplateContextRead [P2-S12-AC-275] ends a stalled request with 504 at exactly its BE03c timeout and not before',
          },
        ],
      },
      {
        text: 'the Tier 2 target.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-12-latency-templates.apispec.ts',
            title:
              'Slice 12 template latency through the real stack [cmsTemplateContextRead] the designer context: p95 under the Tier 2 target of 1,200 ms [P2-S12-AC-162]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-163',
    text: 'cmsTemplateContextRead answers a denied read as 403, an invalid query as 400, a malformed provider projection as 502 and a dependency or deadline failure as 503 or 504 with a typed ApiError, and the POST independently rechecks all authority and compatibility so a stale context never authorizes a write.',
    clauses: [
      {
        text: 'cmsTemplateContextRead answers a denied read as 403, an invalid query as 400, a malformed provider projection as 502 and a dependency or deadline failure as 503 or 504 with a typed ApiError',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-context-routes.test.ts',
            title:
              'CMS-11 protected template context read denies missing designer authority before invoking the RPC',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-context-routes.test.ts',
            title:
              "CMS-11 protected template context read rejects 'query selector' before authorization or the RPC",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-context-routes.test.ts',
            title:
              'CMS-11 protected template context read fails closed on malformed provider data',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-context-routes.test.ts',
            title:
              "CMS-11 protected template context read fails closed for 'throw' context provider",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-context-routes.test.ts',
            title:
              'CMS-11 protected template context read enforces a total deadline and catches unexpected execution failures',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-context.test.ts',
            title:
              'CMS-03C-01 production template adapter maps context RPC denial and refuses malformed or unavailable projections',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI cmsTemplateContextRead [P2-S12-AC-275] answers exactly its success statuses and its BE03c error matrix statuses',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI cmsTemplateContextRead [P2-S12-AC-275] references the success resource component and the BE00 ApiError for every error',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-12-template-reads.apispec.ts',
            title:
              'cmsTemplateContextRead through the real stack [P2-S12-AC-161] no session is 401, no designer capability is 403, and a revoked database grant is 403 from the database',
          },
        ],
      },
      {
        text: 'the POST independently rechecks all authority and compatibility so a stale context never authorizes a write.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_authority.sql',
            title:
              'CMS-03C-01 confirmed member without designer grant cannot define templates',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_authority.sql',
            title: 'CMS-03C-01 anonymous caller cannot define templates',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_authority.sql',
            title:
              'CMS-03C-01 refuses nonexistent or inactive compatible types',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_authority.sql',
            title:
              'CMS-03C-01 rejects a registered block whose compiler range excludes the active type compiler_version',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-routes.test.ts',
            title:
              'CMS-03C-01 protected template-version route fails closed on missing identity, wrong capability and absent acting party',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-12-template-version.apispec.ts',
            title:
              "CMS-03C-01 define a template version through the real stack [P2-S12-AC-005] a value the contract accepts and the database refuses (a compatible type that is not the caller's active type, a reserved concept key) is a 422 with no row",
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-12-template-version.apispec.ts',
            title:
              'CMS-03C-01 authority through the real stack [P2-S12-AC-006] no session is 401, no designer capability is 403 before the database, a missing database grant is 403 from the database, and none writes',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-164',
    text: 'cmsTemplateContextRead is consumed by the protected `CmsTemplateDesigner`, `CmsTemplateEditDesigner` and `CmsPatternVersionDesigner`, which load their picker options (active content types and supported blocks) from this same-origin no-store GET before enabling the form, disable submission with the corresponding sign-in, capability, rate-wait or retry state when the context is missing, denied or degraded, and neither extend the general auth-session resource nor grant designer authority in the browser; verification covers each denied or degraded state and that the POST revalidates authority.',
    clauses: [
      {
        text: 'cmsTemplateContextRead is consumed by the protected `CmsTemplateDesigner`, `CmsTemplateEditDesigner`',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition/CmsTemplateDesigner.test.tsx',
            title:
              'CMS-11 template designer shell renders a native form with protected selectors and no privileged evidence fields',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-12-template-real-route.spec.ts',
            title:
              'CMS-11 keeps a stale tab’s unsent values through a real-route conflict and explicit rebase',
            project: 'real-route-chrome',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-12-template-edit.spec.ts',
            title:
              'Phase 2 Slice 12 protected template edit > without validated protected projections, a valid key does not fabricate an editable draft',
            project: 'chrome',
          },
        ],
      },
      {
        text: '`CmsPatternVersionDesigner`',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-pattern-designer/load-pattern-designer-page.test.ts',
            title:
              'loadPatternDesignerPage: a new pattern serves only the selectors the form needs and the CSRF token',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-pattern-designer/CmsPatternVersionDesigner.test.tsx',
            title:
              'CmsPatternVersionDesigner: prerequisites explains a missing session and a missing content type, and cannot submit',
          },
        ],
      },
      {
        text: 'which load their picker options (active content types and supported blocks) from this same-origin no-store GET before enabling the form',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition/CmsTemplateDesigner.test.tsx',
            title:
              'CMS-11 template designer shell renders a native form with protected selectors and no privileged evidence fields',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition/CmsTemplateDesigner.test.tsx',
            title:
              'CMS-11 template designer shell disables submission when a selector or CSRF prerequisite is absent',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/pages/api/v1/cms/templates/context.test.ts',
            title:
              'same-origin template context read is dynamic, forwards only approved cookies, and validates its body',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-12-template-edit.spec.ts',
            title:
              'Phase 2 Slice 12 protected template edit > without validated protected projections, a valid key does not fabricate an editable draft',
            project: 'chrome',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-12-template-real-route.spec.ts',
            title:
              'CMS-11 keeps a stale tab’s unsent values through a real-route conflict and explicit rebase',
            project: 'real-route-chrome',
          },
        ],
      },
      {
        text: 'disable submission with the corresponding sign-in, capability, rate-wait or retry state when the context is missing, denied or degraded',
        citations: [],
      },
      {
        text: 'neither extend the general auth-session resource nor',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-template-context-session-isolation.test.ts',
            title:
              'Slice 12 template picker context and the general auth-session resource [P2-S12-AC-164] the session resource is exactly the six authentication members and names no CMS, designer or capability member',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-template-context-session-isolation.test.ts',
            title:
              'Slice 12 template picker context and the general auth-session resource [P2-S12-AC-164] the session resource refuses a capabilities member instead of extending itself',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-template-context-session-isolation.test.ts',
            title:
              'Slice 12 template picker context and the general auth-session resource [P2-S12-AC-164] the session resource refuses a cmsCapabilities member instead of extending itself',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-template-context-session-isolation.test.ts',
            title:
              'Slice 12 template picker context and the general auth-session resource [P2-S12-AC-164] the session resource refuses a templateDesigner member instead of extending itself',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-template-context-session-isolation.test.ts',
            title:
              'Slice 12 template picker context and the general auth-session resource [P2-S12-AC-164] the session resource refuses a cmsTemplateContext member instead of extending itself',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-template-context-session-isolation.test.ts',
            title:
              'Slice 12 template picker context and the general auth-session resource [P2-S12-AC-164] the session resource refuses a contentTypes member instead of extending itself',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-template-context-session-isolation.test.ts',
            title:
              'Slice 12 template picker context and the general auth-session resource [P2-S12-AC-164] authSessionRead and authSessionRefresh answer SessionResource and carry no designer capability, while the context read is the one protected route that does',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-template-context-session-isolation.test.ts',
            title:
              'Slice 12 template picker context and the general auth-session resource [P2-S12-AC-164] the picker context is exactly its two selector members and shares no member with the session resource',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-context-session-isolation.test.ts',
            title:
              'GET /api/v1/auth/session beside the CMS-11 picker context [P2-S12-AC-164] never serves a session reader that widens the resource with designer authority',
          },
        ],
      },
      {
        text: 'grant designer authority in the browser',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/template.test.ts',
            title:
              'CMS-03C-01 template definition contracts accepts the exact bounded draft request and resource without browser authority fields',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition/CmsTemplateDesigner.test.tsx',
            title:
              'CMS-11 template designer shell renders a native form with protected selectors and no privileged evidence fields',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-template-context-session-isolation.test.ts',
            title:
              'Slice 12 template picker context and the general auth-session resource [P2-S12-AC-164] the picker context refuses an authority or session member capabilities so it can grant no designer authority in the browser',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-template-context-session-isolation.test.ts',
            title:
              'Slice 12 template picker context and the general auth-session resource [P2-S12-AC-164] the picker context refuses an authority or session member canDefine so it can grant no designer authority in the browser',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-template-context-session-isolation.test.ts',
            title:
              'Slice 12 template picker context and the general auth-session resource [P2-S12-AC-164] the picker context refuses an authority or session member designer so it can grant no designer authority in the browser',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-template-context-session-isolation.test.ts',
            title:
              'Slice 12 template picker context and the general auth-session resource [P2-S12-AC-164] the picker context refuses an authority or session member authenticated so it can grant no designer authority in the browser',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-template-context-session-isolation.test.ts',
            title:
              'Slice 12 template picker context and the general auth-session resource [P2-S12-AC-164] the picker context refuses an authority or session member actingPartyId so it can grant no designer authority in the browser',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-template-context-session-isolation.test.ts',
            title:
              'Slice 12 template picker context and the general auth-session resource [P2-S12-AC-164] the picker context refuses an authority or session member ownerId so it can grant no designer authority in the browser',
          },
        ],
      },
      {
        text: 'verification covers each denied or degraded state',
        citations: [],
      },
      {
        text: 'that the POST revalidates authority.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-12-template-version.apispec.ts',
            title:
              "CMS-03C-01 define a template version through the real stack [P2-S12-AC-005] a value the contract accepts and the database refuses (a compatible type that is not the caller's active type, a reserved concept key) is a 422 with no row",
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-12-template-version.apispec.ts',
            title:
              'CMS-03C-01 authority through the real stack [P2-S12-AC-006] no session is 401, no designer capability is 403 before the database, a missing database grant is 403 from the database, and none writes',
          },
        ],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven (uncited clauses): "disable submission with the corresponding sign-in, capability, rate-wait or retry state when the context is missing, denied or degraded" and "verification covers each denied or degraded state": the template pages read cmsTemplateContextRead on the server (templates/new.astro, templates/[templateKey].astro) and answer a missing session with the 303 sign-in redirect (proved under AC-265) and a 403, 429 (with Retry-After) or 5xx with a notice and no form; no test induces those three answers (the real-route template port is a fixture without a fault seam and the inline Astro logic has only source-text tests).',
  },
  {
    criterion: 'P2-S12-AC-165',
    text: "cmsTemplateLatestRead registers GET /api/v1/cms/templates/{templateKey} with `TemplateLatestQuery` (path) and returns the strict `TemplateVersionDetail` of the caller owner's latest version of the key: the `TemplateVersionResource` plus `slots`, `bindings`, `locale` and `audience`, with no owner or authority field; generated OpenAPI and the discovered Hono route match the registry row.",
    clauses: [
      {
        text: 'cmsTemplateLatestRead registers GET /api/v1/cms/templates/{templateKey} with `TemplateLatestQuery` (path)',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-template-openapi.test.ts',
            title:
              'Slice 12 CMS-03C-01 canonical OpenAPI authority registers a protected current-definition read for edit and conflict reconciliation',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI cmsTemplateLatestRead [P2-S12-AC-275] publishes auth, CORS, CSRF, idempotency, If-Match, rate, timeout, cache and SLO extensions equal to the fixture',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI cmsTemplateLatestRead [P2-S12-AC-275] documents the BE03c parameters, and a JSON body exactly for a write',
          },
        ],
      },
      {
        text: "returns the strict `TemplateVersionDetail` of the caller owner's latest version of the key",
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/template-detail.test.ts',
            title:
              'CMS-11 protected latest-template detail contract returns a complete editable definition with a strong current version',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_detail.sql',
            title: 'read returns the current version, not a stale first draft',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-detail-routes.test.ts',
            title:
              'CMS-11 protected current-template detail HTTP route reads only the validated latest definition with a strong ETag and no-store',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-12-template-reads.apispec.ts',
            title:
              "cmsTemplateLatestRead through the real stack [P2-S12-AC-165] returns the caller owner's LATEST version as a strict detail with a strong ETag and no-store",
          },
        ],
      },
      {
        text: 'the `TemplateVersionResource` plus `slots`, `bindings`, `locale` and `audience`, with no owner or authority field',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/template-detail.test.ts',
            title:
              'CMS-11 protected latest-template detail contract returns a complete editable definition with a strong current version',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_detail.sql',
            title:
              'detail carries exact editable fields but no private authority data',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-12-template-reads.apispec.ts',
            title:
              "cmsTemplateLatestRead through the real stack [P2-S12-AC-165] returns the caller owner's LATEST version as a strict detail with a strong ETag and no-store",
          },
        ],
      },
      {
        text: 'generated OpenAPI',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-template-openapi.test.ts',
            title:
              'Slice 12 CMS-03C-01 canonical OpenAPI authority registers a protected current-definition read for edit and conflict reconciliation',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI cmsTemplateLatestRead [P2-S12-AC-275] is generated at its BE03c method and path with its operation id',
          },
        ],
      },
      {
        text: 'the discovered Hono route match the registry row.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono cmsTemplateLatestRead [P2-S12-AC-275] mounts its method and path, and a CORS preflight route at the same path',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-166',
    text: "cmsTemplateLatestRead accepts only a path `templateKey` that matches the template grammar and is not a reserved key (`context`, `versions`, `new`), resolves it only within the caller's owner scope, rejects a body, `Idempotency-Key` and `If-Match`, and answers a hidden or absent key with the same 404.",
    clauses: [
      {
        text: 'cmsTemplateLatestRead accepts only a path `templateKey` that matches the template grammar',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-detail-routes.test.ts',
            title:
              'CMS-11 protected current-template detail HTTP route rejects invalid selectors after authentication and before authorization or the read',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/template.test.ts',
            title:
              'CMS-03C-01 template definition contracts enforces immutable template-key grammar and a positive version field',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/pages/api/v1/cms/templates/template-detail.test.ts',
            title:
              'same-origin current-template detail proxy rejects invalid path or query selectors before transport',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-12-template-reads.apispec.ts',
            title:
              'cmsTemplateLatestRead through the real stack [P2-S12-AC-166] a malformed key and the reserved keys are 400 and never reach the database',
          },
        ],
      },
      {
        text: 'is not a reserved key (`context`, `versions`, `new`)',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/key-grammar.test.ts',
            title:
              'BE03c key grammar (E13, E14, lineage ids) [P2-S12-AC-189] refuses a reserved template key with the key_reserved reason and keeps near-misses valid',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-12-template-reads.apispec.ts',
            title:
              'cmsTemplateLatestRead through the real stack [P2-S12-AC-166] a malformed key and the reserved keys are 400 and never reach the database',
          },
        ],
      },
      {
        text: "resolves it only within the caller's owner scope",
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-12-template-reads.apispec.ts',
            title:
              'cmsTemplateLatestRead through the real stack [P2-S12-AC-166] [P2-S12-AC-167] a key only another owner holds is the same 404 as an unused key, and each owner reads its own definition of a shared key',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_fix_template_reads_rpc_context.sql',
            title:
              'owner B still reads its own key on the same path [P2-S12-AC-167]',
          },
        ],
      },
      {
        text: 'rejects a body, `Idempotency-Key` and `If-Match`',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-detail-routes.test.ts',
            title:
              "CMS-11 protected current-template detail HTTP route rejects 'idempotency key' on a detail read before authorization or the RPC",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-detail-routes.test.ts',
            title:
              "CMS-11 protected current-template detail HTTP route rejects 'write precondition' on a detail read before authorization or the RPC",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-detail-routes.test.ts',
            title:
              "CMS-11 protected current-template detail HTTP route rejects 'request media' on a detail read before authorization or the RPC",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-detail-routes.test.ts',
            title:
              "CMS-11 protected current-template detail HTTP route rejects 'nonempty body claim' on a detail read before authorization or the RPC",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-detail-routes.test.ts',
            title:
              "CMS-11 protected current-template detail HTTP route rejects 'transfer encoding' on a detail read before authorization or the RPC",
          },
        ],
      },
      {
        text: 'answers a hidden or absent key with the same 404.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-12-template-reads.apispec.ts',
            title:
              'cmsTemplateLatestRead through the real stack [P2-S12-AC-166] [P2-S12-AC-167] a key only another owner holds is the same 404 as an unused key, and each owner reads its own definition of a shared key',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_fix_template_reads_rpc_context.sql',
            title: 'and it is identical to an unused key [P2-S12-AC-167]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-detail-routes.test.ts',
            title:
              'CMS-11 protected current-template detail HTTP route preserves concealed not-found and rejects malformed dependency data',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-167',
    text: "cmsTemplateLatestRead serves only `cms.template_designer` in the caller's owner scope (a caller without the capability is 403), resolves the key only within that scope so that a key held by another owner is the same 404 as an unused key, and serializes no owner or authority field.",
    clauses: [
      {
        text: 'cmsTemplateLatestRead serves only `cms.template_designer`',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-detail-routes.test.ts',
            title:
              'CMS-11 protected current-template detail HTTP route requires the live designer capability before reading',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_detail.sql',
            title: 'authorized designer reads the current template definition',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_detail.sql',
            title: 'revoked designer grant denies the current template read',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-12-template-reads.apispec.ts',
            title:
              'cmsTemplateLatestRead through the real stack [P2-S12-AC-167] no session is 401, no designer capability is 403, and a revoked database grant is 403 from the database',
          },
        ],
      },
      {
        text: "in the caller's owner scope",
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-12-template-reads.apispec.ts',
            title:
              'cmsTemplateLatestRead through the real stack [P2-S12-AC-166] [P2-S12-AC-167] a key only another owner holds is the same 404 as an unused key, and each owner reads its own definition of a shared key',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_fix_template_reads_rpc_context.sql',
            title:
              'owner B still reads its own key on the same path [P2-S12-AC-167]',
          },
        ],
      },
      {
        text: '(a caller without the capability is 403)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-detail-routes.test.ts',
            title:
              'CMS-11 protected current-template detail HTTP route requires the live designer capability before reading',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-detail.test.ts',
            title:
              'CMS-11 protected latest-template production adapter rejects invalid operation, key, and both missing authority cases before transport',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_detail.sql',
            title: 'revoked designer grant denies the current template read',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-12-template-reads.apispec.ts',
            title:
              'cmsTemplateLatestRead through the real stack [P2-S12-AC-167] no session is 401, no designer capability is 403, and a revoked database grant is 403 from the database',
          },
        ],
      },
      {
        text: 'resolves the key only within that scope so that a key held by another owner is the same 404 as an unused key',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-12-template-reads.apispec.ts',
            title:
              'cmsTemplateLatestRead through the real stack [P2-S12-AC-166] [P2-S12-AC-167] a key only another owner holds is the same 404 as an unused key, and each owner reads its own definition of a shared key',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_fix_template_reads_rpc_context.sql',
            title: "owner B reading owner A's key is NOT_FOUND [P2-S12-AC-167]",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_fix_template_reads_rpc_context.sql',
            title: 'and it is identical to an unused key [P2-S12-AC-167]',
          },
        ],
      },
      {
        text: 'serializes no owner or authority field.',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/template-detail.test.ts',
            title:
              'CMS-11 protected latest-template detail contract returns a complete editable definition with a strong current version',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/template-detail.test.ts',
            title:
              'CMS-11 protected latest-template detail contract rejects hidden renderer data and malformed editable fields',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_detail.sql',
            title:
              'detail carries exact editable fields but no private authority data',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-detail-routes.test.ts',
            title:
              'CMS-11 protected current-template detail HTTP route preserves concealed not-found and rejects malformed dependency data',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/pages/api/v1/cms/templates/template-detail.test.ts',
            title:
              'same-origin current-template detail proxy fails closed on mismatched or private provider fields',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-168',
    text: 'cmsTemplateLatestRead is a no-store, read-only call that accepts neither `Idempotency-Key` nor `If-Match`, carries the strong ETag `"{version}"` of the returned version, and enforces read buckets of 60/min/user and 60/min/party, a 15,000 ms deadline and the Tier 2 target.',
    clauses: [
      {
        text: 'cmsTemplateLatestRead is a no-store',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-detail-routes.test.ts',
            title:
              'CMS-11 protected current-template detail HTTP route reads only the validated latest definition with a strong ETag and no-store',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/pages/api/v1/cms/templates/template-detail.test.ts',
            title:
              'same-origin current-template detail proxy forwards only approved identity material and exact validated definition',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-12-template-reads.apispec.ts',
            title:
              "cmsTemplateLatestRead through the real stack [P2-S12-AC-165] returns the caller owner's LATEST version as a strict detail with a strong ETag and no-store",
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI cmsTemplateLatestRead [P2-S12-AC-275] publishes auth, CORS, CSRF, idempotency, If-Match, rate, timeout, cache and SLO extensions equal to the fixture',
          },
        ],
      },
      {
        text: 'read-only call that accepts neither `Idempotency-Key` nor `If-Match`',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-detail-routes.test.ts',
            title:
              "CMS-11 protected current-template detail HTTP route rejects 'idempotency key' on a detail read before authorization or the RPC",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-detail-routes.test.ts',
            title:
              "CMS-11 protected current-template detail HTTP route rejects 'write precondition' on a detail read before authorization or the RPC",
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI cmsTemplateLatestRead [P2-S12-AC-275] publishes auth, CORS, CSRF, idempotency, If-Match, rate, timeout, cache and SLO extensions equal to the fixture',
          },
        ],
      },
      {
        text: 'carries the strong ETag `"{version}"` of the returned version',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-detail-routes.test.ts',
            title:
              'CMS-11 protected current-template detail HTTP route reads only the validated latest definition with a strong ETag and no-store',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/pages/api/v1/cms/templates/template-detail.test.ts',
            title:
              'same-origin current-template detail proxy forwards only approved identity material and exact validated definition',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-12-template-reads.apispec.ts',
            title:
              "cmsTemplateLatestRead through the real stack [P2-S12-AC-165] returns the caller owner's LATEST version as a strict detail with a strong ETag and no-store",
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI cmsTemplateLatestRead [P2-S12-AC-275] declares the ETag exactly as BE03c states it, and the rate-limit headers on 429',
          },
        ],
      },
      {
        text: 'enforces read buckets of 60/min/user and 60/min/party',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-worker-rate.test.ts',
            title:
              '[P2-S12-AC-275] Worker quota cmsTemplateLatestRead [P2-S12-AC-275] asks for its BE03c user and party buckets in order, then answers the denied party bucket with the BE00 429',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI cmsTemplateLatestRead [P2-S12-AC-275] publishes auth, CORS, CSRF, idempotency, If-Match, rate, timeout, cache and SLO extensions equal to the fixture',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-detail-routes.test.ts',
            title:
              'CMS-11 protected current-template detail HTTP route publishes the BE00 429 details and RateLimit headers on the detail route',
          },
        ],
      },
      {
        text: 'a 15,000 ms deadline',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-detail-routes.test.ts',
            title:
              'CMS-11 protected current-template detail HTTP route returns the deadline even when a session dependency never resolves',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-worker-policy.test.ts',
            title:
              '[P2-S12-AC-275] Worker deadline cmsTemplateLatestRead [P2-S12-AC-275] ends a stalled request with 504 at exactly its BE03c timeout and not before',
          },
        ],
      },
      {
        text: 'the Tier 2 target.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-12-latency-templates.apispec.ts',
            title:
              'Slice 12 template latency through the real stack [cmsTemplateLatestRead] the latest version of a 64-slot template: p95 under the Tier 2 target of 1,200 ms [P2-S12-AC-168]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-169',
    text: 'cmsTemplateLatestRead maps a malformed path (400 `INVALID_REQUEST`), a missing session (401), a missing capability (403 `TEMPLATE_FORBIDDEN`), a hidden or absent key (404 `TEMPLATE_NOT_FOUND`), an unsupported body (415), the read limit (429), a dependency failure (502/503/504 `DEPENDENCY_UNAVAILABLE`) and an internal failure (500) to typed ApiError of catalog `cms.03c.template.v1`, and as a safe read is retried by a browser caller at most twice, after 250 ms and 750 ms (FE03), while server, queue and job callers retry it at most three times at 15 s, 60 s and 300 s with jitter (DEC-211).',
    clauses: [
      {
        text: 'cmsTemplateLatestRead maps a malformed path (400 `INVALID_REQUEST`)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-detail-routes.test.ts',
            title:
              'CMS-11 protected current-template detail HTTP route rejects invalid selectors after authentication and before authorization or the read',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-detail-routes.test.ts',
            title:
              "CMS-11 protected current-template detail HTTP route rejects 'idempotency key' on a detail read before authorization or the RPC",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-detail-routes.test.ts',
            title:
              "CMS-11 protected current-template detail HTTP route rejects 'write precondition' on a detail read before authorization or the RPC",
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-12-template-reads.apispec.ts',
            title:
              'cmsTemplateLatestRead through the real stack [P2-S12-AC-166] a malformed key and the reserved keys are 400 and never reach the database',
          },
        ],
      },
      {
        text: 'a missing session (401)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-detail-routes.test.ts',
            title:
              "CMS-11 protected current-template detail HTTP route fails closed when 'unauthenticated'",
          },
        ],
      },
      {
        text: 'a missing capability (403 `TEMPLATE_FORBIDDEN`)',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-12-template-reads.apispec.ts',
            title:
              'cmsTemplateLatestRead through the real stack [P2-S12-AC-167] no session is 401, no designer capability is 403, and a revoked database grant is 403 from the database',
          },
        ],
      },
      {
        text: 'a hidden or absent key (404 `TEMPLATE_NOT_FOUND`)',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-12-template-reads.apispec.ts',
            title:
              'cmsTemplateLatestRead through the real stack [P2-S12-AC-166] [P2-S12-AC-167] a key only another owner holds is the same 404 as an unused key, and each owner reads its own definition of a shared key',
          },
        ],
      },
      {
        text: 'an unsupported body (415)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-detail-routes.test.ts',
            title:
              'CMS-11 protected current-template detail HTTP route answers request media on a read with 415 and an empty allowlist (BE00)',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-detail-routes.test.ts',
            title:
              "CMS-11 protected current-template detail HTTP route rejects 'request media' on a detail read before authorization or the RPC",
          },
        ],
      },
      {
        text: 'the read limit (429)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-detail-routes.test.ts',
            title:
              'CMS-11 protected current-template detail HTTP route publishes the BE00 429 details and RateLimit headers on the detail route',
          },
        ],
      },
      {
        text: 'a dependency failure (502/503/504 `DEPENDENCY_UNAVAILABLE`)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/phase-02-slice-12-dependency-unavailable.test.ts',
            title:
              "[P2-S12-AC-008] CMS-03C dependency failures are DEPENDENCY_UNAVAILABLE 'cmsTemplateLatestRead' a port failure of 502 answers that status as DEPENDENCY_UNAVAILABLE with the bound message and closed details",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/phase-02-slice-12-dependency-unavailable.test.ts',
            title:
              "[P2-S12-AC-008] CMS-03C dependency failures are DEPENDENCY_UNAVAILABLE 'cmsTemplateLatestRead' the 15-second route deadline answers 504 DEPENDENCY_UNAVAILABLE",
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-12-template-reads.apispec.ts',
            title:
              'cmsTemplateLatestRead through the real stack [P2-S12-AC-169] a dependency that never answers is 503 DEPENDENCY_UNAVAILABLE',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/phase-02-slice-12-dependency-unavailable.test.ts',
            title:
              "[P2-S12-AC-008] CMS-03C dependency failures are DEPENDENCY_UNAVAILABLE 'cmsTemplateLatestRead' a port failure of 503 answers that status as DEPENDENCY_UNAVAILABLE with the bound message and closed details",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/phase-02-slice-12-dependency-unavailable.test.ts',
            title:
              "[P2-S12-AC-008] CMS-03C dependency failures are DEPENDENCY_UNAVAILABLE 'cmsTemplateLatestRead' a port failure of 504 answers that status as DEPENDENCY_UNAVAILABLE with the bound message and closed details",
          },
        ],
      },
      {
        text: 'an internal failure (500)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-detail-routes.test.ts',
            title:
              'CMS-11 protected current-template detail HTTP route contains an unexpected execution error in the generic 500 envelope',
          },
        ],
      },
      {
        text: 'to typed ApiError of catalog `cms.03c.template.v1`',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/error-catalog.test.ts',
            title:
              'BE03c normative application error catalog [P2-S12-AC-008] names the six catalogs with their exact ids and operation tokens',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/error-catalog.test.ts',
            title:
              'BE03c normative application error catalog [P2-S12-AC-008] maps every status to the exact catalog code and never uses a status as a code',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/error-catalog.test.ts',
            title:
              'BE03c normative application error catalog [P2-S12-AC-274] resolves an operation to its catalog, shared catalogs included',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-12-template-reads.apispec.ts',
            title:
              'cmsTemplateLatestRead through the real stack [P2-S12-AC-169] a dependency that never answers is 503 DEPENDENCY_UNAVAILABLE',
          },
        ],
      },
      {
        text: 'as a safe read is retried by a browser caller at most twice, after 250 ms and 750 ms (FE03)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition/cms-template-edit-reconcile.retry.test.ts',
            title:
              'readLatestCmsTemplateVersion retry (FE03 :1173) retries a declared-retryable 502 after 250 ms, then 750 ms, and uses the version that answers',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition/cms-template-edit-reconcile.retry.test.ts',
            title:
              'readLatestCmsTemplateVersion retry (FE03 :1173) is unavailable after the second retry still answers a declared 503',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition/cms-template-edit-reconcile.retry.test.ts',
            title:
              'readLatestCmsTemplateVersion retry (FE03 :1173) does not retry a 500',
          },
        ],
      },
      {
        text: 'while server, queue and job callers retry it at most three times at 15 s, 60 s and 300 s with jitter (DEC-211).',
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven (uncited clause): "while server, queue and job callers retry it at most three times at 15 s, 60 s and 300 s with jitter (DEC-211).": BOUNDARY: no queue or job caller of cmsTemplateLatestRead exists; its two server-side callers (the SSR page templates/[templateKey].astro and the same-origin forwarder pages/api/v1/cms/templates/[templateKey].ts, both through readCmsTemplateDetail) each make one pass-through fetch with no retry, a 15 s / 60 s / 300 s schedule cannot run inside the 15,000 ms request deadline of BE03c 170, and the 15/60/300 s ladder (CONSUMER_RETRY_DELAYS_SECONDS in event-consumers/retry-schedule.ts, BE00 550) is used by queue and job consumers only, none of which reads cmsTemplateLatestRead. Missing spec: a line naming the server, queue or job caller of cmsTemplateLatestRead and the retry-versus-request-deadline rule.',
  },
  {
    criterion: 'P2-S12-AC-170',
    text: "cmsTemplateLatestRead is consumed by the protected `CmsTemplateEditDesigner` at `/app/cms-content-modeling/templates/:templateKey`, which prefills the form from the owner's latest version, sends its `version` as `expectedVersion` to create a successor through CMS-03C-01, reconciles a 409 by refetching this read, reuses the idempotency key for an unchanged uncertain attempt, and never resolves `context`, `versions` or `new` as a template key; verification covers the prefill, the successor `expectedVersion`, the 409 reconciliation and the 403/404 split.",
    clauses: [
      {
        text: 'cmsTemplateLatestRead is consumed by the protected `CmsTemplateEditDesigner` at `/app/cms-content-modeling/templates/:templateKey`',
        citations: [
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-12-template-real-route.spec.ts',
            title:
              'CMS-11 keeps a stale tab’s unsent values through a real-route conflict and explicit rebase',
            project: 'real-route-chrome',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-12-template-edit.spec.ts',
            title:
              'Phase 2 Slice 12 protected template edit > without validated protected projections, a valid key does not fabricate an editable draft',
            project: 'chrome',
          },
        ],
      },
      {
        text: "which prefills the form from the owner's latest version",
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition/cms-template-designer-request.test.ts',
            title:
              'CMS-11 template draft request loads every editable field from canonical detail and builds a version-checked successor',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition/CmsTemplateEditDesigner.interaction.test.tsx',
            title:
              'CMS-11 successor edit and reconciliation keeps unsent values through conflict and requires an explicit latest-version rebase',
          },
        ],
      },
      {
        text: 'sends its `version` as `expectedVersion` to create a successor through CMS-03C-01',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition/cms-template-designer-request.test.ts',
            title:
              'CMS-11 template draft request loads every editable field from canonical detail and builds a version-checked successor',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition/cms-template-designer-submit.test.ts',
            title:
              'CMS-11 first-party draft submission posts a successor with exact strong If-Match and accepts only a newer authoritative draft',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition/CmsTemplateEditDesigner.interaction.test.tsx',
            title:
              'CMS-11 successor edit and reconciliation keeps unsent values through conflict and requires an explicit latest-version rebase',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-12-template-real-route.spec.ts',
            title:
              'CMS-11 keeps a stale tab’s unsent values through a real-route conflict and explicit rebase',
            project: 'real-route-chrome',
          },
        ],
      },
      {
        text: 'reconciles a 409 by refetching this read',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition/CmsTemplateEditDesigner.interaction.test.tsx',
            title:
              'CMS-11 successor edit and reconciliation keeps unsent values through conflict and requires an explicit latest-version rebase',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition/cms-template-edit-reconcile.test.ts',
            title:
              'CMS-11 canonical reconciliation read reads only the same-origin protected latest version and checks identity and ETag',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-12-template-real-route.spec.ts',
            title:
              'CMS-11 keeps a stale tab’s unsent values through a real-route conflict and explicit rebase',
            project: 'real-route-chrome',
          },
        ],
      },
      {
        text: 'reuses the idempotency key for an unchanged uncertain attempt',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition/CmsTemplateEditDesigner.interaction.test.tsx',
            title:
              'CMS-11 successor edit and reconciliation retains the key after an uncertain same-version reconciliation read',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-12-template-uncertain-real-route.spec.ts',
            title:
              'Phase 2 Slice 12 uncertain template mutation > an unknown outcome keeps values, reuses the idempotency key, and reconciles before retry',
            project: 'real-route-chrome',
          },
        ],
      },
      {
        text: 'never resolves `context`, `versions` or `new` as a template key',
        citations: [
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-12-template-edit.spec.ts',
            title:
              'Phase 2 Slice 12 protected template edit > [P2-S12-AC-265] [P2-S12-AC-189] the reserved key context never resolves as a template key',
            project: 'chrome',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-12-template-edit.spec.ts',
            title:
              'Phase 2 Slice 12 protected template edit > [P2-S12-AC-265] [P2-S12-AC-189] the reserved key versions never resolves as a template key',
            project: 'chrome',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/key-grammar.test.ts',
            title:
              'BE03c key grammar (E13, E14, lineage ids) [P2-S12-AC-189] refuses a reserved template key with the key_reserved reason and keeps near-misses valid',
          },
        ],
      },
      {
        text: 'verification covers the prefill, the successor `expectedVersion`, the 409 reconciliation and the 403/404 split.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition/cms-template-unavailable-copy.test.ts',
            title:
              'cmsTemplateUnavailableCopy (the edit page notice, FE03 :877, :1066) answers 403 with its fixed sentence',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition/cms-template-unavailable-copy.test.ts',
            title:
              'cmsTemplateUnavailableCopy (the edit page notice, FE03 :877, :1066) answers 404 with its fixed sentence',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-12-template-reads.apispec.ts',
            title:
              'cmsTemplateLatestRead through the real stack [P2-S12-AC-167] no session is 401, no designer capability is 403, and a revoked database grant is 403 from the database',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-12-template-reads.apispec.ts',
            title:
              'cmsTemplateLatestRead through the real stack [P2-S12-AC-166] [P2-S12-AC-167] a key only another owner holds is the same 404 as an unused key, and each owner reads its own definition of a shared key',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-171',
    text: "cmsPatternLatestRead registers GET /api/v1/cms/patterns/{patternKey} with `PatternLatestQuery` (path) and returns the strict `PatternVersionDetail` of the caller owner's latest version of the key in any state: the `PatternVersionResource` plus the `blockTree` of 1-32 root nodes; generated OpenAPI and the discovered Hono route match the registry row.",
    clauses: [
      {
        text: "cmsPatternLatestRead registers GET /api/v1/cms/patterns/{patternKey} with `PatternLatestQuery` (path) and returns the strict `PatternVersionDetail` of the caller owner's latest version of the key in any state: the `PatternVersionResource` plus the `blockTree` of 1-32 root nodes; generated OpenAPI and the discovered Hono route match the registry row.",
        citations: [
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI cmsPatternLatestRead [P2-S12-AC-275] publishes auth, CORS, CSRF, idempotency, If-Match, rate, timeout, cache and SLO extensions equal to the fixture',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI cmsPatternLatestRead [P2-S12-AC-275] documents the BE03c parameters, and a JSON body exactly for a write',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI cmsPatternLatestRead [P2-S12-AC-275] is generated at its BE03c method and path with its operation id',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono cmsPatternLatestRead [P2-S12-AC-275] mounts its method and path, and a CORS preflight route at the same path',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-pattern-openapi.test.ts',
            title:
              'Slice 12 pattern registry rows and generated OpenAPI (CMS-03C-12 to CMS-03C-15) [P2-S12-AC-171] cmsPatternLatestRead registers GET /api/v1/cms/patterns/{patternKey} with its auth, step-up, concurrency, rate and SLO policy',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-pattern-openapi.test.ts',
            title:
              'Slice 12 pattern registry rows and generated OpenAPI (CMS-03C-12 to CMS-03C-15) [P2-S12-AC-171] cmsPatternLatestRead generates the documented parameters, request body, success statuses and error matrix',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/pattern-version.test.ts',
            title:
              'PatternVersionResource and detail [P2-S12-AC-171] adds the blockTree of 1 to 32 root nodes to the detail and keeps the tree rules',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/pattern-node.test.ts',
            title:
              'pattern block tree (CMS-03C-12 blockTree) [P2-S12-AC-101] requires 1 to 32 root nodes',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition/080-latest-read.sqlinc',
            title:
              'the designer reads the latest version of an owned key [P2-S12-AC-171]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition/080-latest-read.sqlinc',
            title: 'the latest of two versions is definition 2 [P2-S12-AC-171]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition/080-latest-read.sqlinc',
            title: 'the stored forest is returned exactly [P2-S12-AC-171]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition/080-latest-read.sqlinc',
            title:
              'the read is the creation resource of that version plus the tree [P2-S12-AC-171]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition/080-latest-read.sqlinc',
            title:
              'the latest read follows the lineage: an active v1 does not hide the newer draft v2 [P2-S12-AC-172]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-latest.test.ts',
            title:
              'cmsPatternLatestRead immutable definition projection returns latest active with the definition version ETag',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-latest.test.ts',
            title:
              'cmsPatternLatestRead immutable definition projection returns latest approved with the definition version ETag',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-latest.test.ts',
            title:
              'cmsPatternLatestRead immutable definition projection returns latest blocked with the definition version ETag',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-latest.test.ts',
            title:
              'cmsPatternLatestRead immutable definition projection returns latest draft with the definition version ETag',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-latest.test.ts',
            title:
              'cmsPatternLatestRead immutable definition projection returns latest retired with the definition version ETag',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-latest.test.ts',
            title:
              'cmsPatternLatestRead immutable definition projection returns latest review with the definition version ETag',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-latest.test.ts',
            title:
              'cmsPatternLatestRead immutable definition projection returns latest scheduled with the definition version ETag',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-latest.test.ts',
            title:
              'cmsPatternLatestRead immutable definition projection returns latest superseded with the definition version ETag',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/server/cms-pattern-platform-latest.test.ts',
            title:
              'cmsPatternLatestRead proxy: forwarding forwards a bare GET with the session cookies only and returns the verified detail',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-172',
    text: "cmsPatternLatestRead accepts only a path `patternKey` that matches the pattern grammar and is not a reserved key (`context`, `versions`, `selector`, `nestable`, `new`), resolves it only within the caller's owner scope, rejects a body, `Idempotency-Key` and `If-Match`, and answers a hidden or absent key with the same 404.",
    clauses: [
      {
        text: "cmsPatternLatestRead accepts only a path `patternKey` that matches the pattern grammar and is not a reserved key (`context`, `versions`, `selector`, `nestable`, `new`), resolves it only within the caller's owner scope, rejects a body, `Idempotency-Key` and `If-Match`, and answers a hidden or absent key with the same 404.",
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/pattern-version.test.ts',
            title:
              'cmsPatternLatestRead path contract [P2-S12-AC-172] accepts only a grammar-valid, non-reserved path patternKey and no other member',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-latest.test.ts',
            title:
              'cmsPatternLatestRead immutable definition projection rejects malformed path or unexpected query /api/v1/cms/patterns/Invalid_Key',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-latest.test.ts',
            title:
              'cmsPatternLatestRead immutable definition projection rejects malformed path or unexpected query /api/v1/cms/patterns/profile%20header',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-latest.test.ts',
            title:
              'cmsPatternLatestRead immutable definition projection rejects malformed path or unexpected query /api/v1/cms/patterns/profile-header?ownerPartyId=caller',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-latest.test.ts',
            title:
              'cmsPatternLatestRead immutable definition projection rejects the unsupported latest-read header idempotency-key',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-latest.test.ts',
            title:
              'cmsPatternLatestRead immutable definition projection rejects the unsupported latest-read header if-match',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-admission.test.ts',
            title:
              "CMS-03C-12 and cmsPatternLatestRead Worker admission rejects unsupported request media before the session ('the cmsPatternLatestRead read')",
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/server/cms-pattern-platform-latest.test.ts',
            title:
              'cmsPatternLatestRead proxy: admission (nothing reaches the Worker) refuses an Idempotency-Key',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/server/cms-pattern-platform-latest.test.ts',
            title:
              'cmsPatternLatestRead proxy: admission (nothing reaches the Worker) refuses an If-Match',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/server/cms-pattern-platform-latest.test.ts',
            title:
              'cmsPatternLatestRead proxy: admission (nothing reaches the Worker) refuses a content type',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/pages/api/v1/cms/patterns/patterns-routes.test.ts',
            title:
              'first-party cmsPatternLatestRead endpoint answers the key selector with a 400 and never reaches the binding',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition/080-latest-read.sqlinc',
            title:
              'detail is the exact safe resource plus the tree; no owner, creator or lifecycle member [P2-S12-AC-176]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title: 'latest-absent: exact SQL message token [P2-S12-AC-104]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title:
              'latest-hidden-owner: exact SQL message token [P2-S12-AC-104]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title: 'latest-reserved: exact SQL message token [P2-S12-AC-104]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title: 'latest-malformed: exact SQL message token [P2-S12-AC-104]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title: 'latest-extra-key: exact SQL message token [P2-S12-AC-104]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-latest.test.ts',
            title:
              'cmsPatternLatestRead immutable definition projection keeps an absent or policy-hidden definition indistinguishable',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-provider-fault.test.ts',
            title:
              "pattern definition 'latest': provider 4xx without a product token keeps the product answer for P0001 NOT_FOUND",
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-173',
    text: "cmsPatternLatestRead serves only `cms.template_designer` in the caller's owner scope (a caller without the capability is 403), resolves the key only within that scope so that another owner's identical key is the same 404 as an unused key, and serializes no owner or authority field.",
    clauses: [
      {
        text: "cmsPatternLatestRead serves only `cms.template_designer` in the caller's owner scope (a caller without the capability is 403)",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title:
              'latest-no-capability: exact SQL message token [P2-S12-AC-104]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title:
              'latest-no-capability: expected refusal preserves every captured full row [P2-S12-AC-104]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-admission.test.ts',
            title:
              "CMS-03C-12 and cmsPatternLatestRead Worker admission requires a designer capability before rate admission ('the cmsPatternLatestRead read')",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-admission.test.ts',
            title:
              "CMS-03C-12 and cmsPatternLatestRead Worker admission requires an acting party even for a designer ('the cmsPatternLatestRead read')",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-production.test.ts',
            title:
              "'cmsPatternLatestRead' existing-runtime transport boundary uses the named RPC and server-bound context, not caller authority headers",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title:
              'anon: real database role cannot execute the latest-read wrapper [P2-S12-AC-173]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title:
              'authenticated: real database role cannot execute the latest-read wrapper [P2-S12-AC-173]',
          },
        ],
      },
      {
        text: "resolves the key only within that scope so that another owner's identical key is the same 404 as an unused key",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_pattern_types.sql',
            title:
              'a key another owner holds is exactly the outcome of an unused key [P2-S12-AC-173]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_pattern_types.sql',
            title:
              'with a shared key each organization reads its OWN lineage: the owner its active pattern, the other organization its own row [P2-S12-AC-173]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_pattern_types.sql',
            title:
              'control: the key held only by the other organization is readable by that organization and hidden from the owner [P2-S12-AC-173]',
          },
        ],
      },
      {
        text: 'serializes no owner or authority field.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition/080-latest-read.sqlinc',
            title:
              'detail is the exact safe resource plus the tree; no owner, creator or lifecycle member [P2-S12-AC-176]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-latest.test.ts',
            title:
              'cmsPatternLatestRead immutable definition projection refuses an unbound or private provider projection: {"lifecycleVersion":"99"}',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-latest.test.ts',
            title:
              'cmsPatternLatestRead immutable definition projection refuses an unbound or private provider projection: {"lifecycle_version":"99"}',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-latest.test.ts',
            title:
              'cmsPatternLatestRead immutable definition projection refuses an unbound or private provider projection: {"ownerPartyId":"private provider"}',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-latest.test.ts',
            title:
              'cmsPatternLatestRead immutable definition projection refuses an unbound or private provider projection: {"patternKey":"another-pattern"}',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-latest.test.ts',
            title:
              'cmsPatternLatestRead immutable definition projection refuses an unbound or private provider projection: {"patternVersion":8}',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-latest.test.ts',
            title:
              'cmsPatternLatestRead immutable definition projection refuses an unbound or private provider projection: {"state":"unknown"}',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-latest.test.ts',
            title:
              'cmsPatternLatestRead immutable definition projection refuses an unbound or private provider projection: {"version":"8"}',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-latest.test.ts',
            title:
              'cmsPatternLatestRead immutable definition projection refuses an unbound or private provider projection: {}',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/pattern-version.test.ts',
            title:
              'PatternVersionResource and detail [P2-S12-AC-171] adds the blockTree of 1 to 32 root nodes to the detail and keeps the tree rules',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-174',
    text: 'cmsPatternLatestRead is a no-store, read-only call that accepts neither `Idempotency-Key` nor `If-Match`, carries the strong ETag `"{version}"` of the returned version, and enforces read buckets of 60/min/user and 60/min/party, a 15,000 ms deadline and the Tier 2 target.',
    clauses: [
      {
        text: 'cmsPatternLatestRead is a no-store, read-only call that accepts neither `Idempotency-Key` nor `If-Match`, carries the strong ETag `"{version}"` of the returned version, and enforces read buckets of 60/min/user and 60/min/party, a 15,000 ms deadline',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-latest.test.ts',
            title:
              'cmsPatternLatestRead immutable definition projection returns latest active with the definition version ETag',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-latest.test.ts',
            title:
              'cmsPatternLatestRead immutable definition projection returns latest approved with the definition version ETag',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-latest.test.ts',
            title:
              'cmsPatternLatestRead immutable definition projection returns latest blocked with the definition version ETag',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-latest.test.ts',
            title:
              'cmsPatternLatestRead immutable definition projection returns latest draft with the definition version ETag',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-latest.test.ts',
            title:
              'cmsPatternLatestRead immutable definition projection returns latest retired with the definition version ETag',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-latest.test.ts',
            title:
              'cmsPatternLatestRead immutable definition projection returns latest review with the definition version ETag',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-latest.test.ts',
            title:
              'cmsPatternLatestRead immutable definition projection returns latest scheduled with the definition version ETag',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-latest.test.ts',
            title:
              'cmsPatternLatestRead immutable definition projection returns latest superseded with the definition version ETag',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI cmsPatternLatestRead [P2-S12-AC-275] publishes auth, CORS, CSRF, idempotency, If-Match, rate, timeout, cache and SLO extensions equal to the fixture',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-latest.test.ts',
            title:
              'cmsPatternLatestRead immutable definition projection rejects the unsupported latest-read header idempotency-key',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-latest.test.ts',
            title:
              'cmsPatternLatestRead immutable definition projection rejects the unsupported latest-read header if-match',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition/080-latest-read.sqlinc',
            title:
              'the public CAS version is the definition number as a decimal string [P2-S12-AC-171]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition/080-latest-read.sqlinc',
            title:
              'a read changes no captured full row and emits nothing [P2-S12-AC-171]',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/server/cms-pattern-platform-latest.test.ts',
            title:
              'cmsPatternLatestRead proxy: an upstream success must be this key at this version is a retryable 502 for a weak ETag',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/server/cms-pattern-platform-latest.test.ts',
            title:
              'cmsPatternLatestRead proxy: an upstream success must be this key at this version is a retryable 502 for an ETag that is not the version',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-worker-rate.test.ts',
            title:
              '[P2-S12-AC-275] Worker quota cmsPatternLatestRead [P2-S12-AC-275] asks for its BE03c user and party buckets in order, then answers the denied party bucket with the BE00 429',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-production.test.ts',
            title:
              "'cmsPatternLatestRead' existing-runtime transport boundary stops denied user quota before RPC",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-production.test.ts',
            title:
              "'cmsPatternLatestRead' existing-runtime transport boundary stops denied party quota before RPC",
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-pattern-openapi.test.ts',
            title:
              'Slice 12 pattern registry rows and generated OpenAPI (CMS-03C-12 to CMS-03C-15) [P2-S12-AC-171] cmsPatternLatestRead registers GET /api/v1/cms/patterns/{patternKey} with its auth, step-up, concurrency, rate and SLO policy',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-production.test.ts',
            title:
              "'cmsPatternLatestRead' existing-runtime transport boundary ends a stalled session at the 15 second route deadline",
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-worker-policy.test.ts',
            title:
              '[P2-S12-AC-275] Worker deadline cmsPatternLatestRead [P2-S12-AC-275] ends a stalled request with 504 at exactly its BE03c timeout and not before',
          },
        ],
      },
      {
        text: 'the Tier 2 target.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-12-latency-patterns.apispec.ts',
            title:
              'Slice 12 pattern read latency through the real stack [cmsPatternLatestRead] the latest version of a 512-node lineage: p95 under the Tier 2 target of 1,200 ms [P2-S12-AC-174]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-175',
    text: 'cmsPatternLatestRead maps a malformed path (400), a missing session (401), a missing designer capability (403), a hidden or absent key (404), an unsupported body (415), the read limit (429), a read dependency or deadline (502/503/504 `DEPENDENCY_UNAVAILABLE`) and an internal failure (500) to typed ApiError of catalog `cms.03c.composition.v1`.',
    clauses: [
      {
        text: 'cmsPatternLatestRead maps a malformed path (400), a missing session (401), a missing designer capability (403), a hidden or absent key (404), an unsupported body (415), the read limit (429), a read dependency or deadline (502/503/504 `DEPENDENCY_UNAVAILABLE`) and an internal failure (500) to typed ApiError of catalog `cms.03c.composition.v1`.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-latest.test.ts',
            title:
              'cmsPatternLatestRead immutable definition projection rejects malformed path or unexpected query /api/v1/cms/patterns/Invalid_Key',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-latest.test.ts',
            title:
              'cmsPatternLatestRead immutable definition projection rejects malformed path or unexpected query /api/v1/cms/patterns/profile%20header',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-latest.test.ts',
            title:
              'cmsPatternLatestRead immutable definition projection rejects malformed path or unexpected query /api/v1/cms/patterns/profile-header?ownerPartyId=caller',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-admission.test.ts',
            title:
              'CMS-03C-12 and cmsPatternLatestRead Worker admission mounts cmsPatternLatestRead and rejects a valid anonymous key read with 401',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-admission.test.ts',
            title:
              "CMS-03C-12 and cmsPatternLatestRead Worker admission requires a designer capability before rate admission ('the cmsPatternLatestRead read')",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-latest.test.ts',
            title:
              'cmsPatternLatestRead immutable definition projection keeps an absent or policy-hidden definition indistinguishable',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-admission.test.ts',
            title:
              "CMS-03C-12 and cmsPatternLatestRead Worker admission rejects unsupported request media before the session ('the cmsPatternLatestRead read')",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-production.test.ts',
            title:
              "'cmsPatternLatestRead' existing-runtime transport boundary stops denied user quota before RPC",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-production.test.ts',
            title:
              "'cmsPatternLatestRead' existing-runtime transport boundary stops denied party quota before RPC",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-latest.test.ts',
            title:
              'cmsPatternLatestRead immutable definition projection refuses an unbound or private provider projection: {"lifecycleVersion":"99"}',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-latest.test.ts',
            title:
              'cmsPatternLatestRead immutable definition projection refuses an unbound or private provider projection: {"lifecycle_version":"99"}',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-latest.test.ts',
            title:
              'cmsPatternLatestRead immutable definition projection refuses an unbound or private provider projection: {"ownerPartyId":"private provider"}',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-latest.test.ts',
            title:
              'cmsPatternLatestRead immutable definition projection refuses an unbound or private provider projection: {"patternKey":"another-pattern"}',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-latest.test.ts',
            title:
              'cmsPatternLatestRead immutable definition projection refuses an unbound or private provider projection: {"patternVersion":8}',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-latest.test.ts',
            title:
              'cmsPatternLatestRead immutable definition projection refuses an unbound or private provider projection: {"state":"unknown"}',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-latest.test.ts',
            title:
              'cmsPatternLatestRead immutable definition projection refuses an unbound or private provider projection: {"version":"8"}',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-latest.test.ts',
            title:
              'cmsPatternLatestRead immutable definition projection refuses an unbound or private provider projection: {}',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-latest.test.ts',
            title:
              'cmsPatternLatestRead immutable definition projection keeps generic HTTP 500 provider tokens as dependency faults: {"code":"FORBIDDEN"}',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-latest.test.ts',
            title:
              'cmsPatternLatestRead immutable definition projection keeps generic HTTP 500 provider tokens as dependency faults: {"code":"NOT_FOUND"}',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-latest.test.ts',
            title:
              'cmsPatternLatestRead immutable definition projection keeps generic HTTP 500 provider tokens as dependency faults: {"code":"P0001","message":"FORBIDDEN"}',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-latest.test.ts',
            title:
              'cmsPatternLatestRead immutable definition projection keeps generic HTTP 500 provider tokens as dependency faults: {"code":"P0001","message":"VALIDATION_FAILED"}',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-production.test.ts',
            title:
              "'cmsPatternLatestRead' existing-runtime transport boundary ends a stalled session at the 15 second route deadline",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-latest.test.ts',
            title:
              'cmsPatternLatestRead immutable definition projection preserves intentional SQL P0001/INTERNAL_ERROR semantics',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/error-catalog.test.ts',
            title:
              'BE03c normative application error catalog [P2-S12-AC-008] names the six catalogs with their exact ids and operation tokens',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/error-catalog.test.ts',
            title:
              'BE03c normative application error catalog [P2-S12-AC-274] resolves an operation to its catalog, shared catalogs included',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/error-catalog.test.ts',
            title:
              'BE03c normative application error catalog [P2-S12-AC-008] maps every status to the exact catalog code and never uses a status as a code',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/server/cms-pattern-platform-errors.test.ts',
            title:
              'cmsPatternLatestRead upstream refusals are relayed from the composition catalog relays a 400 with the catalog code and message only',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/server/cms-pattern-platform-errors.test.ts',
            title:
              'cmsPatternLatestRead upstream refusals are relayed from the composition catalog relays a 401 with the catalog code and message only',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/server/cms-pattern-platform-errors.test.ts',
            title:
              'cmsPatternLatestRead upstream refusals are relayed from the composition catalog relays a 403 with the catalog code and message only',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/server/cms-pattern-platform-errors.test.ts',
            title:
              'cmsPatternLatestRead upstream refusals are relayed from the composition catalog relays a 404 with the catalog code and message only',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/server/cms-pattern-platform-errors.test.ts',
            title:
              'cmsPatternLatestRead upstream refusals are relayed from the composition catalog relays a 415 with the catalog code and message only',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/server/cms-pattern-platform-errors.test.ts',
            title:
              'cmsPatternLatestRead upstream refusals are relayed from the composition catalog relays a 429 with the catalog code and message only',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/server/cms-pattern-platform-errors.test.ts',
            title:
              'cmsPatternLatestRead upstream refusals are relayed from the composition catalog relays a 500 with the catalog code and message only',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/server/cms-pattern-platform-errors.test.ts',
            title:
              'cmsPatternLatestRead upstream refusals are relayed from the composition catalog relays a 502 with the catalog code and message only',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/server/cms-pattern-platform-errors.test.ts',
            title:
              'cmsPatternLatestRead upstream refusals are relayed from the composition catalog relays a 503 with the catalog code and message only',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/server/cms-pattern-platform-errors.test.ts',
            title:
              'cmsPatternLatestRead upstream refusals are relayed from the composition catalog relays a 504 with the catalog code and message only',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-provider-fault.test.ts',
            title:
              "pattern definition 'latest': provider 4xx without a product token keeps the product answer for P0001 NOT_FOUND",
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-176',
    text: "cmsPatternLatestRead is consumed by the protected `CmsPatternVersionDesigner` and `CmsGovernedReviewPanel` at `/app/cms-content-modeling/patterns/:patternKey`, which address the owner's latest version by key, prefill the node list from it, send the read version as `expectedVersion` for a successor and show the version's lifecycle; verification covers the prefill, the successor `expectedVersion`, the 403/404 split and that the reserved keys never resolve as `:patternKey`.",
    clauses: [
      {
        text: 'cmsPatternLatestRead is consumed by the protected `CmsPatternVersionDesigner` and `CmsGovernedReviewPanel` at `/app/cms-content-modeling/patterns/:patternKey`',
        citations: [
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-12-definition-pages-real-route.spec.ts',
            title:
              '[P2-S12-AC-105] [P2-S12-AC-176] opens /patterns/:patternKey and mounts the designer and the review panel from the latest read',
            project: 'real-route-chrome',
          },
        ],
      },
      {
        text: "which address the owner's latest version by key, prefill the node list from it, send the read version as `expectedVersion` for a successor and show the version's lifecycle",
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-pattern-designer/load-pattern-designer-page.test.ts',
            title:
              'loadPatternDesignerPage: a saved pattern serves the latest version as the edit preimage and the panel facts',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-pattern-designer/CmsPatternVersionDesigner.test.tsx',
            title:
              'CmsPatternVersionDesigner: explicit tree controls keeps a saved nested pattern movable and removable but not editable',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-pattern-designer/pattern-tree-state.test.ts',
            title: 'fromWireTree round-trips through the editable model',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-pattern-designer/CmsPatternVersionDesigner.results.test.tsx',
            title:
              'CmsPatternVersionDesigner: editing a saved pattern prefills from the latest version, keeps the key read-only and sends the read version',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-pattern-designer/pattern-designer-request.test.ts',
            title:
              'buildPatternVersionRequest sends the read version as expectedVersion for a successor',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-pattern-designer/pattern-designer-submit.test.ts',
            title:
              'submitPatternVersion: the request sends the strong If-Match that names expectedVersion on a successor',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedPatternPanel.test.tsx',
            title:
              'patternSubjectOf takes the subject id, hash, key, version and lifecycle exactly as the latest read served them',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedReviewPanel.test.tsx',
            title:
              'CmsGovernedReviewPanel lifecycle (CMS-03C-06) states the active lifecycle in words and offers no submit action',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedReviewPanel.test.tsx',
            title:
              'CmsGovernedReviewPanel lifecycle (CMS-03C-06) states the approved lifecycle in words and offers no submit action',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedReviewPanel.test.tsx',
            title:
              'CmsGovernedReviewPanel lifecycle (CMS-03C-06) states the blocked lifecycle in words and offers no submit action',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedReviewPanel.test.tsx',
            title:
              'CmsGovernedReviewPanel lifecycle (CMS-03C-06) states the retired lifecycle in words and offers no submit action',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedReviewPanel.test.tsx',
            title:
              'CmsGovernedReviewPanel lifecycle (CMS-03C-06) states the review lifecycle in words and offers no submit action',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedReviewPanel.test.tsx',
            title:
              'CmsGovernedReviewPanel lifecycle (CMS-03C-06) states the scheduled lifecycle in words and offers no submit action',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedReviewPanel.test.tsx',
            title:
              'CmsGovernedReviewPanel lifecycle (CMS-03C-06) states the superseded lifecycle in words and offers no submit action',
          },
        ],
      },
      {
        text: 'verification covers the prefill, the successor `expectedVersion`, the 403/404 split and that the reserved keys never resolve as `:patternKey`.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-pattern-designer/CmsPatternVersionDesigner.results.test.tsx',
            title:
              'CmsPatternVersionDesigner: editing a saved pattern prefills from the latest version, keeps the key read-only and sends the read version',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-pattern-designer/pattern-designer-request.test.ts',
            title:
              'buildPatternVersionRequest sends the read version as expectedVersion for a successor',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-pattern-designer/pattern-designer-submit.test.ts',
            title:
              'submitPatternVersion: the request sends the strong If-Match that names expectedVersion on a successor',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-pattern-designer/load-pattern-designer-page.test.ts',
            title:
              'loadPatternDesignerPage: a saved pattern shows the disclosure-safe 404 for a concealed or absent key',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-pattern-designer/load-pattern-designer-page.test.ts',
            title:
              'loadPatternDesignerPage: a new pattern shows one fixed notice for a 403',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-pattern-designer/load-pattern-designer-page.test.ts',
            title:
              'loadPatternDesignerPage: a saved pattern answers the key "" with a 400 before any read',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-pattern-designer/load-pattern-designer-page.test.ts',
            title:
              'loadPatternDesignerPage: a saved pattern answers the key "Bad_Key" with a 400 before any read',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-pattern-designer/load-pattern-designer-page.test.ts',
            title:
              'loadPatternDesignerPage: a saved pattern answers the key "context" with a 400 before any read',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-pattern-designer/load-pattern-designer-page.test.ts',
            title:
              'loadPatternDesignerPage: a saved pattern answers the key "new" with a 400 before any read',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-pattern-designer/load-pattern-designer-page.test.ts',
            title:
              'loadPatternDesignerPage: a saved pattern answers the key "selector" with a 400 before any read',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-pattern-designer/load-pattern-designer-page.test.ts',
            title:
              'loadPatternDesignerPage: a saved pattern answers the key "versions" with a 400 before any read',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-pattern-designer/pattern-latest-read.test.ts',
            title:
              'readLatestPatternVersion never reads a malformed or reserved key',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-12-definition-pages-real-route.spec.ts',
            title:
              '[P2-S12-AC-176] a saved pattern is a 403 notice, not a form, for a session without the template designer capability',
            project: 'real-route-chrome',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-177',
    text: 'cmsTaxonomyVersionsRead registers GET /api/v1/cms/taxonomies/{taxonomyId}/versions with `TaxonomyVersionsQuery` (path) and returns the strict `TaxonomyVersionsPage` of at most 50 `TaxonomyVersionResource` items, newest first, and `pageVersion`; generated OpenAPI and the discovered Hono route match the registry row.',
    clauses: [
      {
        text: 'cmsTaxonomyVersionsRead registers GET /api/v1/cms/taxonomies/{taxonomyId}/versions with `TaxonomyVersionsQuery` (path) and returns the strict `TaxonomyVersionsPage` of at most 50 `TaxonomyVersionResource` items, newest first, and `pageVersion`; generated OpenAPI and the discovered Hono route match the registry row.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI cmsTaxonomyVersionsRead [P2-S12-AC-275] publishes auth, CORS, CSRF, idempotency, If-Match, rate, timeout, cache and SLO extensions equal to the fixture',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI cmsTaxonomyVersionsRead [P2-S12-AC-275] documents the BE03c parameters, and a JSON body exactly for a write',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI cmsTaxonomyVersionsRead [P2-S12-AC-275] is generated at its BE03c method and path with its operation id',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono cmsTaxonomyVersionsRead [P2-S12-AC-275] mounts its method and path, and a CORS preflight route at the same path',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-taxonomy-version-openapi.test.ts',
            title:
              'Slice 12 taxonomy registry rows and generated OpenAPI (CMS-03C-16, CMS-03C-17 and the vocabulary reads) [P2-S12-AC-177] cmsTaxonomyVersionsRead registers GET /api/v1/cms/taxonomies/{taxonomyId}/versions with its auth, step-up, concurrency, rate and SLO policy',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/taxonomy-version.test.ts',
            title:
              'TaxonomyVersionResource and cmsTaxonomyVersionsRead [P2-S12-AC-177] lists at most 50 versions of one vocabulary, newest first, with a page version',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition/070-versions-read.sqlinc',
            title: 'read: strict page members',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition/070-versions-read.sqlinc',
            title: 'read: every version of the lineage, newest first',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition/070-versions-read.sqlinc',
            title: 'read: at most fifty versions of a longer lineage',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition/070-versions-read.sqlinc',
            title: 'read: a truncated page starts at the newest version',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition/070-versions-read.sqlinc',
            title: 'read: a truncated page drops the oldest versions',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition/070-versions-read.sqlinc',
            title:
              'read: page version is the high-water update instant of the page in microseconds',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-definition-versions.test.ts',
            title:
              'taxonomy versions isolated boundary returns newest-first versions and a page-version strong ETag without MFA',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-definition-versions.test.ts',
            title:
              'taxonomy versions isolated boundary fails closed for invalid page rows 0',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-definition-versions.test.ts',
            title:
              'taxonomy versions isolated boundary fails closed for invalid page rows 1',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-definition-versions.test.ts',
            title:
              'taxonomy versions isolated boundary fails closed for invalid page rows 2',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-definition-versions.test.ts',
            title:
              'taxonomy versions isolated boundary fails closed for invalid page rows 3',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-definition-versions.test.ts',
            title:
              'taxonomy versions isolated boundary fails closed for invalid page rows 4',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-definition-versions.test.ts',
            title:
              'taxonomy versions isolated boundary fails closed for invalid page rows 5',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/server/cms-taxonomy-platform-read-versions.test.ts',
            title:
              'cmsTaxonomyVersionsRead proxy forwards a bare GET with the session cookies only and returns the verified page',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-178',
    text: 'cmsTaxonomyVersionsRead accepts only a UUID `taxonomyId` path (the vocabulary lineage id) with no query key (400 otherwise), rejects a body, `Idempotency-Key` and `If-Match`, and answers a hidden or absent vocabulary with the same 404.',
    clauses: [
      {
        text: 'cmsTaxonomyVersionsRead accepts only a UUID `taxonomyId` path (the vocabulary lineage id) with no query key (400 otherwise), rejects a body, `Idempotency-Key` and `If-Match`, and answers a hidden or absent vocabulary with the same 404.',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/taxonomy-version.test.ts',
            title:
              'TaxonomyVersionResource and cmsTaxonomyVersionsRead [P2-S12-AC-178] accepts only a UUID lineage taxonomyId path',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI cmsTaxonomyVersionsRead [P2-S12-AC-275] documents the BE03c parameters, and a JSON body exactly for a write',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-definition-versions.test.ts',
            title:
              'taxonomy versions isolated boundary rejects query ?cursor=opaque',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-definition-versions.test.ts',
            title:
              'taxonomy versions isolated boundary rejects query ?limit=50',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-definition-versions.test.ts',
            title:
              'taxonomy versions isolated boundary rejects query ?ownerId=private',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-definition-versions.test.ts',
            title:
              'taxonomy versions isolated boundary rejects invalid lineage path and content type',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-definition-versions.test.ts',
            title:
              'taxonomy versions isolated boundary rejects write/body header idempotency-key',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-definition-versions.test.ts',
            title:
              'taxonomy versions isolated boundary rejects write/body header if-match',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-definition-versions.test.ts',
            title:
              'taxonomy versions isolated boundary rejects write/body header transfer-encoding',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/server/cms-taxonomy-platform-read-versions.test.ts',
            title:
              'cmsTaxonomyVersionsRead proxy refuses a malformed id before the Worker',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/server/cms-taxonomy-platform-read-versions.test.ts',
            title:
              'cmsTaxonomyVersionsRead proxy refuses a query before the Worker',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/server/cms-taxonomy-platform-read-versions.test.ts',
            title:
              'cmsTaxonomyVersionsRead proxy refuses an Idempotency-Key before the Worker',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/server/cms-taxonomy-platform-read-versions.test.ts',
            title:
              'cmsTaxonomyVersionsRead proxy refuses an If-Match before the Worker',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/server/cms-taxonomy-platform-read-versions.test.ts',
            title:
              'cmsTaxonomyVersionsRead proxy refuses a media type before the Worker',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/pages/api/v1/cms/taxonomies/taxonomies-routes.test.ts',
            title:
              'vocabulary routes forward through the private binding to the same path answers a malformed vocabulary id with a 400 and never reaches the binding',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title: 'read-absent: exact refusal message',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title: 'read-successor-id: exact refusal message',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title: 'read-other-owner: exact refusal message',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title: 'read-hidden-scope: exact refusal message',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition/070-versions-read.sqlinc',
            title:
              'read: absent, hidden, cross-owner and non-lineage ids expose one complete refusal',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title: 'read-id-text: exact refusal message',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title: 'read-extra-limit: exact refusal message',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title: 'read-extra-cursor: exact refusal message',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title: 'read-extra-ifMatch: exact refusal message',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title: 'read-extra-idempotencyKey: exact refusal message',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-definition-production.test.ts',
            title:
              'taxonomy fixed production RPC boundary preserves hidden 404 instead of returning an empty versions page',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-179',
    text: "cmsTaxonomyVersionsRead serves only `cms.taxonomy_curator` in the caller's owner scope (a caller without the capability is 403; a hidden or absent vocabulary is 404) over the owner's vocabulary lineage, and serializes no owner or authority field.",
    clauses: [
      {
        text: "cmsTaxonomyVersionsRead serves only `cms.taxonomy_curator` in the caller's owner scope (",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition/070-versions-read.sqlinc',
            title: 'read: curator reads their lineage',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title: 'read-not-curator: exact refusal message',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title: 'read-revoked: exact refusal message',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title: 'read-other-owner: exact refusal message',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title: 'read-absent: exact refusal message',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title: 'read-hidden-scope: exact refusal message',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition/070-versions-read.sqlinc',
            title:
              'read: absent, hidden, cross-owner and non-lineage ids expose one complete refusal',
          },
        ],
      },
      {
        text: 'a caller without the capability is 403',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-definition-versions.refusals.test.ts',
            title:
              'cmsTaxonomyVersionsRead capability refusal at the production boundary answers the private capability_missing refusal as 403 TAXONOMY_FORBIDDEN with reasonCode capability_missing',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title: 'read-not-curator: exact refusal message',
          },
        ],
      },
      {
        text: 'a hidden or absent vocabulary is 404',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title: 'read-other-owner: exact refusal message',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title: 'read-absent: exact refusal message',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title: 'read-hidden-scope: exact refusal message',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition/070-versions-read.sqlinc',
            title:
              'read: absent, hidden, cross-owner and non-lineage ids expose one complete refusal',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-definition-production.test.ts',
            title:
              'taxonomy fixed production RPC boundary preserves hidden 404 instead of returning an empty versions page',
          },
        ],
      },
      {
        text: ") over the owner's vocabulary lineage",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition/070-versions-read.sqlinc',
            title: 'read: every version of the lineage, newest first',
          },
        ],
      },
      {
        text: 'serializes no owner or authority field.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition/070-versions-read.sqlinc',
            title: 'read: no owner, authority or lifecycle counter on any item',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-definition-versions.test.ts',
            title:
              'taxonomy versions isolated boundary fails closed for invalid page rows 0',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-definition-versions.test.ts',
            title:
              'taxonomy versions isolated boundary fails closed for invalid page rows 1',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-definition-versions.test.ts',
            title:
              'taxonomy versions isolated boundary fails closed for invalid page rows 2',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-definition-versions.test.ts',
            title:
              'taxonomy versions isolated boundary fails closed for invalid page rows 3',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-definition-versions.test.ts',
            title:
              'taxonomy versions isolated boundary fails closed for invalid page rows 4',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-definition-versions.test.ts',
            title:
              'taxonomy versions isolated boundary fails closed for invalid page rows 5',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/taxonomy-version.test.ts',
            title:
              'TaxonomyVersionResource and cmsTaxonomyVersionsRead [P2-S12-AC-177] lists at most 50 versions of one vocabulary, newest first, with a page version',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-180',
    text: 'cmsTaxonomyVersionsRead is a no-store, read-only call that accepts neither `Idempotency-Key` nor `If-Match`, carries an ETag on the page version, and enforces read buckets of 60/min/user and 60/min/party, an 8,000 ms deadline and the Tier 1 p95 < 750 ms target.',
    clauses: [
      {
        text: 'cmsTaxonomyVersionsRead is a no-store, read-only call that accepts neither `Idempotency-Key` nor `If-Match`, carries an ETag on the page version, and enforces read buckets of 60/min/user and 60/min/party, an 8,000 ms deadline',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI cmsTaxonomyVersionsRead [P2-S12-AC-275] publishes auth, CORS, CSRF, idempotency, If-Match, rate, timeout, cache and SLO extensions equal to the fixture',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/server/cms-taxonomy-platform-read-versions.test.ts',
            title:
              'cmsTaxonomyVersionsRead proxy forwards a bare GET with the session cookies only and returns the verified page',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-definition-versions.test.ts',
            title:
              'taxonomy versions isolated boundary returns newest-first versions and a page-version strong ETag without MFA',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-definition-versions.test.ts',
            title:
              'taxonomy versions isolated boundary rejects write/body header idempotency-key',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-definition-versions.test.ts',
            title:
              'taxonomy versions isolated boundary rejects write/body header if-match',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-definition-versions.test.ts',
            title:
              'taxonomy versions isolated boundary rejects write/body header transfer-encoding',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/server/cms-taxonomy-platform-read-versions.test.ts',
            title:
              'cmsTaxonomyVersionsRead proxy refuses an Idempotency-Key before the Worker',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/server/cms-taxonomy-platform-read-versions.test.ts',
            title:
              'cmsTaxonomyVersionsRead proxy refuses an If-Match before the Worker',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/server/cms-taxonomy-platform-read-versions.test.ts',
            title:
              'cmsTaxonomyVersionsRead proxy answers a local 502 for a weak ETag',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/server/cms-taxonomy-platform-read-versions.test.ts',
            title:
              'cmsTaxonomyVersionsRead proxy answers a local 502 for an ETag that is not the page version',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition/070-versions-read.sqlinc',
            title:
              'read: page version is the high-water update instant of the page in microseconds',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-worker-rate.test.ts',
            title:
              '[P2-S12-AC-275] Worker quota cmsTaxonomyVersionsRead [P2-S12-AC-275] asks for its BE03c user and party buckets in order, then answers the denied party bucket with the BE00 429',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-worker-policy.test.ts',
            title:
              '[P2-S12-AC-275] Worker deadline cmsTaxonomyVersionsRead [P2-S12-AC-275] ends a stalled request with 504 at exactly its BE03c timeout and not before',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI cmsTaxonomyVersionsRead [P2-S12-AC-275] declares the ETag exactly as BE03c states it, and the rate-limit headers on 429',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition/070-versions-read.sqlinc',
            title:
              'read: writes no row in any store, including audit, reservation and outbox',
          },
        ],
      },
      {
        text: 'the Tier 1 p95 < 750 ms target.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-12-latency-taxonomy.apispec.ts',
            title:
              'Slice 12 taxonomy latency through the real stack [cmsTaxonomyVersionsRead] a lineage of 50 versions: p95 under the Tier 1 target of 750 ms [P2-S12-AC-180]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-181',
    text: 'cmsTaxonomyVersionsRead maps a malformed path, query or cursor (400), a missing session (401), a missing curator capability (403 `TAXONOMY_FORBIDDEN`), a hidden or absent vocabulary (404 `TAXONOMY_NOT_FOUND`), an unsupported body if sent (415), a query-bound failure (422), the read limit (429), a read dependency or deadline (502/503/504 `DEPENDENCY_UNAVAILABLE`) and an internal failure (500) to typed ApiError of catalog `cms.03c.taxonomy.v1`.',
    clauses: [
      {
        text: 'cmsTaxonomyVersionsRead maps a malformed path, query or cursor (400), a missing session (401)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-definition-versions.test.ts',
            title:
              'taxonomy versions isolated boundary rejects query ?cursor=opaque',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-definition-versions.test.ts',
            title:
              'taxonomy versions isolated boundary rejects write/body header idempotency-key',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-definition-versions.test.ts',
            title:
              'taxonomy versions isolated boundary rejects invalid lineage path and content type',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-definition-admission.test.ts',
            title:
              'taxonomy definition production-composed Worker admission cmsTaxonomyVersionsRead reaches typed 401 without body/query/write headers',
          },
        ],
      },
      {
        text: 'a missing curator capability (403 `TAXONOMY_FORBIDDEN`)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-definition-versions.refusals.test.ts',
            title:
              'cmsTaxonomyVersionsRead capability refusal at the production boundary answers the private capability_missing refusal as 403 TAXONOMY_FORBIDDEN with reasonCode capability_missing',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title: 'read-not-curator: exact refusal message',
          },
        ],
      },
      {
        text: 'a hidden or absent vocabulary (404 `TAXONOMY_NOT_FOUND`), an unsupported body if sent (415)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-definition-versions.test.ts',
            title:
              'taxonomy versions isolated boundary rejects invalid lineage path and content type',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-definition-production.test.ts',
            title:
              'taxonomy fixed production RPC boundary preserves hidden 404 instead of returning an empty versions page',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono cmsTaxonomyVersionsRead [P2-S12-AC-275] answers an unsupported media type with the declared 415 ApiError before any session work',
          },
        ],
      },
      {
        text: 'a query-bound failure (422)',
        citations: [],
      },
      {
        text: 'the read limit (429), a read dependency or deadline (502/503/504 `DEPENDENCY_UNAVAILABLE`) and an internal failure (500) to typed ApiError of catalog `cms.03c.taxonomy.v1`.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-definition-provider-fault.test.ts',
            title:
              "taxonomy 'versions read': provider 4xx without a product token scrubs payload without any code to 500 INTERNAL_ERROR",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-definition-provider-fault.test.ts',
            title:
              "taxonomy 'versions read': a response-contract failure is a retryable 502 answers a malformed 2xx body as 502 with retryable true (BE00 172)",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-definition-admission.test.ts',
            title:
              "taxonomy provider status and refreshed authority 'read' provider503 cannot become a caller refusal through 'TAXONOMY_FORBIDDEN'",
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-worker-rate.test.ts',
            title:
              '[P2-S12-AC-275] Worker quota cmsTaxonomyVersionsRead [P2-S12-AC-275] asks for its BE03c user and party buckets in order, then answers the denied party bucket with the BE00 429',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-worker-policy.test.ts',
            title:
              '[P2-S12-AC-275] Worker deadline cmsTaxonomyVersionsRead [P2-S12-AC-275] ends a stalled request with 504 at exactly its BE03c timeout and not before',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI cmsTaxonomyVersionsRead [P2-S12-AC-275] answers exactly its success statuses and its BE03c error matrix statuses',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] cmsTaxonomyVersionsRead [P2-S12-AC-275] the fixture error statuses equal the BE03c Contract and error matrix row',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/error-catalog.test.ts',
            title:
              'BE03c normative application error catalog [P2-S12-AC-008] maps every status to the exact catalog code and never uses a status as a code',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/error-catalog.test.ts',
            title:
              'BE03c normative application error catalog [P2-S12-AC-274] resolves an operation to its catalog, shared catalogs included',
          },
        ],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven (uncited clause): "a query-bound failure (422)": BOUNDARY (lane gaps-db2): the versions read takes only a path id (TaxonomyVersionsApiRequestSchema is {taxonomyId}, BE03c 171); it has no query or body bound that can produce 422, so no test can drive a real 422 for this operation. The 422 member is declared in the shared route matrix only. Needs a spec decision (drop 422 from the operation) or a bound.',
  },
  {
    criterion: 'P2-S12-AC-182',
    text: "cmsTaxonomyVersionsRead is consumed by the protected `CmsTaxonomyVersionDesigner` and `CmsGovernedReviewPanel` at `/app/cms-content-modeling/taxonomies/:taxonomyId`, which read the vocabulary's versions (newest first, at most 50) to show each version's lifecycle, review summary and permitted actions, while term actions render only against an `active` version and `taxonomy_not_active` links to the vocabulary's governed review; verification covers the 403/404 split, the 50-version bound and the active-version gating of term actions.",
    clauses: [
      {
        text: 'cmsTaxonomyVersionsRead is consumed by the protected `CmsTaxonomyVersionDesigner` and `CmsGovernedReviewPanel` at `/app/cms-content-modeling/taxonomies/:taxonomyId`',
        citations: [
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-12-definition-pages-real-route.spec.ts',
            title:
              '[P2-S12-AC-129] [P2-S12-AC-182] opens /taxonomies/:taxonomyId and mounts the designer and the review panel from the versions read',
            project: 'real-route-chrome',
          },
        ],
      },
      {
        text: "which read the vocabulary's versions (newest first, at most 50) to show each version's lifecycle, review summary and permitted actions",
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-taxonomy-designer/CmsTaxonomyVersionDesigner.test.tsx',
            title:
              'CmsTaxonomyVersionDesigner: a saved vocabulary prefills the rules, keeps the key read-only and lists every version',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-taxonomy-pages/load-taxonomy-page.test.ts',
            title:
              'loadTaxonomyPage: a saved vocabulary serves the newest version as the edit preimage, the history, the active version and the first term page',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-taxonomy-designer/taxonomy-versions-read.test.ts',
            title: 'verifiedVersionsPage refuses more than 50 versions',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-taxonomy-designer/taxonomy-versions-read.test.ts',
            title: 'verifiedVersionsPage refuses versions not newest first',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-taxonomy-pages/load-taxonomy-page.test.ts',
            title:
              'loadTaxonomyPage: a saved vocabulary the newest-50 bound on finding the active version (BE03c 406) says the search stopped at the newest 50 when 50 versions hold no active one',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedTaxonomyPanel.test.tsx',
            title:
              'CmsGovernedTaxonomyPanel shows the review summary it was served and links to that review',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedTaxonomyPanel.test.tsx',
            title:
              'CmsGovernedTaxonomyPanel offers no submit control for a version that is not a draft',
          },
        ],
      },
      {
        text: "while term actions render only against an `active` version and `taxonomy_not_active` links to the vocabulary's governed review",
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermForm.test.tsx',
            title:
              'CmsTaxonomyTermForm: the term list renders no action control against a vocabulary with no active version, and links its review',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermForm.test.tsx',
            title:
              'CmsTaxonomyTermForm: create opens a labelled form, sends the exact request under the active version and shows the result',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermForm.refusals.test.tsx',
            title:
              'CmsTaxonomyTermForm: a refused term action (FE03 :887) links a refusal for a vocabulary with no active version to the governed review',
          },
        ],
      },
      {
        text: 'verification covers the 403/404 split, the 50-version bound and the active-version gating of term actions.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-taxonomy-designer/taxonomy-versions-read.test.ts',
            title: 'verifiedVersionsPage refuses more than 50 versions',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-taxonomy-pages/load-taxonomy-page.test.ts',
            title:
              'loadTaxonomyPage: a saved vocabulary shows one fixed notice for a versions 403',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-taxonomy-pages/load-taxonomy-page.test.ts',
            title:
              'loadTaxonomyPage: a saved vocabulary shows one fixed notice for a versions 404',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-taxonomy-designer/taxonomy-versions-read.test.ts',
            title: 'readTaxonomyVersions reports a 403 as rejected',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-taxonomy-pages/load-taxonomy-page.test.ts',
            title:
              'loadTaxonomyPage: a saved vocabulary the newest-50 bound on finding the active version (BE03c 406) says the search stopped at the newest 50 when 50 versions hold no active one',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermForm.test.tsx',
            title:
              'CmsTaxonomyTermForm: the term list renders no action control against a vocabulary with no active version, and links its review',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermForm.test.tsx',
            title:
              'CmsTaxonomyTermForm: create opens a labelled form, sends the exact request under the active version and shows the result',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermForm.refusals.test.tsx',
            title:
              'CmsTaxonomyTermForm: a refused term action (FE03 :887) links a refusal for a vocabulary with no active version to the governed review',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-183',
    text: 'cmsTaxonomyTermsRead registers GET /api/v1/cms/taxonomies/{taxonomyId}/terms with the strict `TaxonomyTermListQuery` and returns the strict `TaxonomyTermListPage` of at most 50 `TaxonomyTermListItem` rows (`termId`, `termKey`, `lifecycle`, `version`, `parentId`, `successorId`, at most 64 `labels` and at most 64 `aliases`), a `nextCursor` of at most 512 characters or null and `pageVersion`, ordered by the signed keyset `(termKey ASC, termId ASC)`.',
    clauses: [
      {
        text: 'cmsTaxonomyTermsRead registers GET /api/v1/cms/taxonomies/{taxonomyId}/terms with the strict `TaxonomyTermListQuery` and returns the strict `TaxonomyTermListPage` of at most 50 `TaxonomyTermListItem` rows (`termId`, `termKey`, `lifecycle`, `version`, `parentId`, `successorId`, at most 64 `labels` and at most 64 `aliases`), a `nextCursor` of at most 512 characters or null and `pageVersion`, ordered by the signed keyset `(termKey ASC, termId ASC)`.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono cmsTaxonomyTermsRead [P2-S12-AC-275] mounts its method and path, and a CORS preflight route at the same path',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI cmsTaxonomyTermsRead [P2-S12-AC-275] is generated at its BE03c method and path with its operation id',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/taxonomy-term-list.test.ts',
            title:
              'cmsTaxonomyTermsRead contract [P2-S12-AC-184] takes the vocabulary path with an optional lifecycle, cursor and a limit defaulting to 25',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/taxonomy-term-list.test.ts',
            title:
              'cmsTaxonomyTermsRead contract [P2-S12-AC-184] bounds the limit 1 to 50, the cursor at 512 and closes lifecycle and every other key',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/taxonomy-term-list.test.ts',
            title:
              'cmsTaxonomyTermsRead contract [P2-S12-AC-183] returns the eight-member term item with at most 64 labels and 64 aliases',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/taxonomy-term-list.test.ts',
            title:
              'cmsTaxonomyTermsRead contract [P2-S12-AC-183] bounds a page at 50 items with an opaque cursor of at most 512, a page version and 256 KiB',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-terms-read.test.ts',
            title:
              'cmsTaxonomyTermsRead keyset order tie-break (termKey, then termId) accepts equal keys in ascending term id order and refuses descending',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-terms-read.test.ts',
            title:
              'cmsTaxonomyTermsRead route answers an out-of-order page from the port as 502',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-terms-read.test.ts',
            title:
              'cmsTaxonomyTermsRead route answers more items than the limit from the port as 502',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_reads/020-terms-read.sqlinc',
            title: 'the page is exactly TaxonomyTermListPage [P2-S12-AC-183]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_reads/020-terms-read.sqlinc',
            title:
              'each item is exactly TaxonomyTermListItem (8 members) and carries no owner, actor or authority member [P2-S12-AC-185]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_reads/020-terms-read.sqlinc',
            title:
              'all seven terms, every lifecycle, in termKey ASC order [P2-S12-AC-183]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_reads/020-terms-read.sqlinc',
            title:
              'every item equals the independently built row: id, key, lifecycle, version, parent, successor, the CURRENT label of each locale and the aliases [P2-S12-AC-183]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_reads/030-terms-read-pages.sqlinc',
            title:
              'the cursor is a signed envelope of at most 512 characters that names its key, signature, query binding and expiry [P2-S12-AC-186]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_reads/030-terms-read-pages.sqlinc',
            title:
              'the cursor continues strictly after the last key of the previous page [P2-S12-AC-183]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_reads/030-terms-read-pages.sqlinc',
            title:
              'three pages are exactly the unpaged list: no gap, no repeat [P2-S12-AC-183]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_reads/030-terms-read-pages.sqlinc',
            title:
              'the last page lists the remainder and has no cursor [P2-S12-AC-183]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_reads/020-terms-read.sqlinc',
            title:
              'a final page has no cursor and a decimal-string pageVersion [P2-S12-AC-186]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-184',
    text: 'cmsTaxonomyTermsRead accepts only a UUID `taxonomyId` path, an optional `lifecycle` of `active`, `deprecated` or `merged`, a signed context-bound `cursor` of at most 512 characters and a `limit` of 1-50 (default 25), rejects every other key, a body and any mutation header, and refuses a response over 256 KiB as a 502 `DEPENDENCY_UNAVAILABLE` response-contract failure.',
    clauses: [
      {
        text: 'cmsTaxonomyTermsRead accepts only a UUID `taxonomyId` path, an optional `lifecycle` of `active`, `deprecated` or `merged`, a signed context-bound `cursor` of at most 512 characters and a `limit` of 1-50 (default 25), rejects every other key, a body and any mutation header, and refuses a response over 256 KiB as a 502 `DEPENDENCY_UNAVAILABLE` response-contract failure.',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/taxonomy-term-list.test.ts',
            title:
              'cmsTaxonomyTermsRead contract [P2-S12-AC-184] takes the vocabulary path with an optional lifecycle, cursor and a limit defaulting to 25',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/taxonomy-term-list.test.ts',
            title:
              'cmsTaxonomyTermsRead contract [P2-S12-AC-184] bounds the limit 1 to 50, the cursor at 512 and closes lifecycle and every other key',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-terms-read.test.ts',
            title:
              'cmsTaxonomyTermsRead route refuses an unknown key with a bare 400 before capability, quota and port',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-terms-read.test.ts',
            title:
              'cmsTaxonomyTermsRead route refuses an unknown lifecycle with a bare 400 before capability, quota and port',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-terms-read.test.ts',
            title:
              'cmsTaxonomyTermsRead route refuses limit 0 with a bare 400 before capability, quota and port',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-terms-read.test.ts',
            title:
              'cmsTaxonomyTermsRead route refuses limit 51 with a bare 400 before capability, quota and port',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-terms-read.test.ts',
            title:
              'cmsTaxonomyTermsRead route refuses a cursor over 512 characters with a bare 400 before capability, quota and port',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-terms-read.test.ts',
            title:
              'cmsTaxonomyTermsRead route accepts a 512-character cursor and limit 50',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-terms-read.test.ts',
            title:
              'cmsTaxonomyTermsRead route applies the limit default, passes lifecycle and the opaque cursor through verbatim',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-terms-read.test.ts',
            title:
              'cmsTaxonomyTermsRead route refuses a malformed vocabulary id and any request that carries a body or write header',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_reads/030-terms-read-pages.sqlinc',
            title:
              'a cursor replayed against another limit, filter or vocabulary, or with a forged payload or expiry, is 409: the client restarts from page one [P2-S12-AC-187]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_reads/030-terms-read-pages.sqlinc',
            title: 'paging composes with the lifecycle filter [P2-S12-AC-184]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-taxonomy-reads.test.ts',
            title:
              'cmsTaxonomyTermsRead production port: platform_api.cms_list_taxonomy_terms (BE03c 167, 1447, 1480) bounds the actual private RPC witness at 262145 bytes whatever the option says',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-taxonomy-reads.test.ts',
            title:
              'cmsTaxonomyTermsRead production port: platform_api.cms_list_taxonomy_terms (BE03c 167, 1447, 1480) bounds the actual private RPC witness at 262144 bytes whatever the option says',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/error-catalog.test.ts',
            title:
              'BE03c normative application error catalog [P2-S12-AC-274] resolves a status to the catalog code of an operation and refuses a status outside the catalog',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-185',
    text: "cmsTaxonomyTermsRead serves only `cms.taxonomy_curator` in the caller's owner scope (a caller without the capability is 403; a hidden or absent vocabulary is 404), lists merged terms with their `successorId`, and serializes no owner or authority field.",
    clauses: [
      {
        text: "cmsTaxonomyTermsRead serves only `cms.taxonomy_curator` in the caller's owner scope (a caller without the capability is 403; a hidden or absent vocabulary is 404), lists merged terms with their `successorId`, and serializes no owner or authority field.",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_reads/040-terms-read-authority.sqlinc',
            title:
              'a readable member without the curator capability (editor, author, reviewer) is 403 capability_missing [P2-S12-AC-185]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_reads/040-terms-read-authority.sqlinc',
            title:
              'a caller outside the owner organization gets the concealing 404 [P2-S12-AC-185]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_reads/040-terms-read-authority.sqlinc',
            title:
              'a foreign vocabulary, a real curator of another organization and the id of a successor version row all give the very same complete refusal as an absent id [P2-S12-AC-185]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_reads/040-terms-read-authority.sqlinc',
            title: 'the hidden vocabulary refusal is 404 [P2-S12-AC-185]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-terms-read.test.ts',
            title:
              'cmsTaxonomyTermsRead route a caller without cms.taxonomy_curator is 403 capability_missing and consumes no quota',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-terms-read.test.ts',
            title:
              'cmsTaxonomyTermsRead route relays the port refusal 404 as TAXONOMY_NOT_FOUND',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-taxonomy-reads.test.ts',
            title:
              'cmsTaxonomyTermsRead production port: platform_api.cms_list_taxonomy_terms (BE03c 167, 1447, 1480) maps the raised capability_missing to 403',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-taxonomy-reads.test.ts',
            title:
              'cmsTaxonomyTermsRead production port: platform_api.cms_list_taxonomy_terms (BE03c 167, 1447, 1480) maps the raised NOT_FOUND to 404',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_reads/020-terms-read.sqlinc',
            title:
              'a merged term is listed WITH its successor, so the redirect is visible to the curator (BE03c 1480) [P2-S12-AC-185]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_reads/020-terms-read.sqlinc',
            title:
              'successorId exists exactly when the term is merged [P2-S12-AC-185]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-terms-read.test.ts',
            title:
              'cmsTaxonomyTermsRead route accepts the merged term with its successor when the lifecycle filter names merged',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_reads/020-terms-read.sqlinc',
            title:
              'each item is exactly TaxonomyTermListItem (8 members) and carries no owner, actor or authority member [P2-S12-AC-185]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_reads/020-terms-read.sqlinc',
            title:
              'no owner, actor, creator, membership, capability or binding word appears anywhere in the body [P2-S12-AC-185]',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/taxonomy-term-list.test.ts',
            title:
              'cmsTaxonomyTermsRead contract [P2-S12-AC-183] shows a merged term with its surviving successor and no other lifecycle with one',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-186',
    text: 'cmsTaxonomyTermsRead is a no-store, read-only call that accepts neither `Idempotency-Key` nor `If-Match`, carries an ETag on the page version and a signed cursor bound to the query and acting context, and enforces read buckets of 120/min/user and 240/min/party, an 8,000 ms deadline and the Tier 1 p95 < 750 ms target.',
    clauses: [
      {
        text: 'cmsTaxonomyTermsRead is a no-store, read-only call that accepts neither `Idempotency-Key` nor `If-Match`, carries an ETag on the page version and a signed cursor bound to the query',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-terms-read.test.ts',
            title:
              'cmsTaxonomyTermsRead route serves the page with a quoted page-version ETag, no-store and the CORS echo',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-terms-read.test.ts',
            title:
              'cmsTaxonomyTermsRead route refuses a malformed vocabulary id and any request that carries a body or write header',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-registry.test.ts',
            title:
              'registry rows of the Worker-served taxonomy reads cmsTaxonomyTermsRead: curator, GET, no CSRF, no preconditions, 8,000 ms',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] cmsTaxonomyTermsRead [P2-S12-AC-275] the platform registry row equals the fixture on auth, CORS, CSRF, idempotency, If-Match, rate, timeout, cache and SLO',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] cmsTaxonomyTermsRead [P2-S12-AC-275] the fixture matches the BE03c Route Registry row on method, path, request, success, rate, timeout, tier, CSRF, CORS, step-up, idempotency, If-Match and ETag',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_reads/030-terms-read-pages.sqlinc',
            title:
              'the cursor is a signed envelope of at most 512 characters that names its key, signature, query binding and expiry [P2-S12-AC-186]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_reads/030-terms-read-pages.sqlinc',
            title:
              'a cursor replayed against another limit, filter or vocabulary, or with a forged payload or expiry, is 409: the client restarts from page one [P2-S12-AC-187]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_reads/020-terms-read.sqlinc',
            title:
              'a final page has no cursor and a decimal-string pageVersion [P2-S12-AC-186]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_reads/020-terms-read.sqlinc',
            title:
              'the reads so far changed no term, label, assignment, audit, outbox, idempotency or job row: the read is mutation-free [P2-S12-AC-186]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_reads/020-terms-read.sqlinc',
            title:
              'a committed term action adds the term and strictly advances the page version (the ETag) [P2-S12-AC-186]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_reads/020-terms-read.sqlinc',
            title:
              'a second read of unchanged data returns the identical page and version [P2-S12-AC-186]',
          },
        ],
      },
      {
        text: 'acting context',
        citations: [],
      },
      {
        text: 'enforces read buckets of 120/min/user and 240/min/party, an 8,000 ms deadline',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-registry.test.ts',
            title:
              'registry rows of the Worker-served taxonomy reads cmsTaxonomyTermsRead: curator, GET, no CSRF, no preconditions, 8,000 ms',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-registry.test.ts',
            title:
              'rate table of cmsTaxonomyTermsRead matches its registry row rate class, user and party ceilings and a 60-second window',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-registry.test.ts',
            title:
              'transport table of cmsTaxonomyTermsRead matches its registry row deadline, method and the write/read class',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-terms-read.test.ts',
            title:
              'cmsTaxonomyTermsRead route charges the user then the party bucket of the terms read class',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-worker-policy.test.ts',
            title:
              '[P2-S12-AC-275] Worker deadline cmsTaxonomyTermsRead [P2-S12-AC-275] ends a stalled request with 504 at exactly its BE03c timeout and not before',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] cmsTaxonomyTermsRead [P2-S12-AC-275] the platform registry row equals the fixture on auth, CORS, CSRF, idempotency, If-Match, rate, timeout, cache and SLO',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] cmsTaxonomyTermsRead [P2-S12-AC-275] the fixture matches the BE03c Route Registry row on method, path, request, success, rate, timeout, tier, CSRF, CORS, step-up, idempotency, If-Match and ETag',
          },
        ],
      },
      {
        text: 'the Tier 1 p95 < 750 ms target.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-12-latency-taxonomy.apispec.ts',
            title:
              'Slice 12 taxonomy latency through the real stack [cmsTaxonomyTermsRead] first page of 50 terms: p95 under the Tier 1 target of 750 ms [P2-S12-AC-186]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-12-latency-taxonomy.apispec.ts',
            title:
              'Slice 12 taxonomy latency through the real stack [cmsTaxonomyTermsRead] cursor page of 50 terms: p95 under the Tier 1 target of 750 ms [P2-S12-AC-186]',
          },
        ],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven (uncited clause): "acting context": BOUNDARY: the actor member of the cursor binding is shown (a page-1 cursor replayed by another actor of the same party is CONFLICT), but the acting-party member is unreachable: the owner-scope concealment answers NOT_FOUND before the cursor hash is compared (migration 20261014120600:95-96; lane BOUNDARY B1).',
  },
  {
    criterion: 'P2-S12-AC-187',
    text: 'cmsTaxonomyTermsRead answers a structurally malformed cursor with 400 and an expired, tampered or foreign-bound cursor with 409 (the client restarts from the first page), and maps session, capability, concealment, read-limit, read-dependency and internal failures to typed ApiError of catalog `cms.03c.taxonomy.v1` with no audit or outbox effect.',
    clauses: [
      {
        text: 'cmsTaxonomyTermsRead answers a structurally malformed cursor with 400 and an',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_reads/030-terms-read-pages.sqlinc',
            title:
              'a structurally malformed cursor (not base64, not JSON, wrong members, not a string, over 512 octets) is 400 [P2-S12-AC-187]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-terms-read.test.ts',
            title:
              'cmsTaxonomyTermsRead route refuses a cursor over 512 characters with a bare 400 before capability, quota and port',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-terms-read.test.ts',
            title:
              'cmsTaxonomyTermsRead route relays the port refusal 400 as INVALID_REQUEST',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-taxonomy-reads.test.ts',
            title:
              'cmsTaxonomyTermsRead production port: platform_api.cms_list_taxonomy_terms (BE03c 167, 1447, 1480) maps the raised INVALID_REQUEST to 400',
          },
        ],
      },
      {
        text: 'expired',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_terms_cursor.sql',
            title:
              'a correctly signed cursor whose expiresAt has elapsed is refused 409 CONFLICT [P2-S12-AC-187]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_terms_cursor.sql',
            title:
              'a cursor expiring at the current second is already expired (the boundary is exclusive) [P2-S12-AC-187]',
          },
        ],
      },
      {
        text: 'tampered or foreign-bound cursor with 409 (the client restarts from the first page), and maps session, capability, concealment, read-limit, read-dependency and internal failures to typed ApiError of catalog `cms.03c.taxonomy.v1` with no audit or outbox effect.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_reads/030-terms-read-pages.sqlinc',
            title:
              'a cursor replayed against another limit, filter or vocabulary, or with a forged payload or expiry, is 409: the client restarts from page one [P2-S12-AC-187]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-terms-read.test.ts',
            title:
              'cmsTaxonomyTermsRead route relays the port refusal 409 as TAXONOMY_VERSION_CONFLICT',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-taxonomy-reads.test.ts',
            title:
              'cmsTaxonomyTermsRead production port: platform_api.cms_list_taxonomy_terms (BE03c 167, 1447, 1480) maps the raised CONFLICT to 409',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-taxonomy-pages/load-taxonomy-page.test.ts',
            title:
              'loadTaxonomyPage: a saved vocabulary restarts a stale cursor from the first page (409)',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-reads-admission.test.ts',
            title:
              'production-composed Worker admission of the taxonomy term-store routes cmsTaxonomyTermsRead reaches the typed 401, not a 404',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-taxonomy-reads.test.ts',
            title:
              'cmsTaxonomyTermsRead production port: platform_api.cms_list_taxonomy_terms (BE03c 167, 1447, 1480) maps the raised UNAUTHENTICATED to 401',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_reads/040-terms-read-authority.sqlinc',
            title:
              'a request without a verified human is 401 UNAUTHENTICATED [P2-S12-AC-187]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-terms-read.test.ts',
            title:
              'cmsTaxonomyTermsRead route a caller without cms.taxonomy_curator is 403 capability_missing and consumes no quota',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-terms-read.test.ts',
            title:
              'cmsTaxonomyTermsRead route relays the port refusal 404 as TAXONOMY_NOT_FOUND',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_reads/040-terms-read-authority.sqlinc',
            title:
              'a foreign vocabulary, a real curator of another organization and the id of a successor version row all give the very same complete refusal as an absent id [P2-S12-AC-185]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-terms-read.test.ts',
            title:
              'cmsTaxonomyTermsRead route relays the quota refusal with its headers and never reaches the port',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-terms-read.test.ts',
            title:
              'cmsTaxonomyTermsRead route relays the port refusal 503 as DEPENDENCY_UNAVAILABLE',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-terms-read.test.ts',
            title:
              'cmsTaxonomyTermsRead route relays the port refusal 504 as DEPENDENCY_UNAVAILABLE',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-taxonomy-reads.test.ts',
            title:
              'cmsTaxonomyTermsRead production port: platform_api.cms_list_taxonomy_terms (BE03c 167, 1447, 1480) a provider 5xx is a retryable 503 and a nonsettling transport is a 504 at the 8,000 ms read ceiling',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-taxonomy-reads.test.ts',
            title:
              'cmsTaxonomyTermsRead production port: platform_api.cms_list_taxonomy_terms (BE03c 167, 1447, 1480) maps the raised INTERNAL_ERROR to 500',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-taxonomy-reads.test.ts',
            title:
              'cmsTaxonomyTermsRead production port: platform_api.cms_list_taxonomy_terms (BE03c 167, 1447, 1480) scrubs the provider fault payload without any code to 500',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_reads/030-terms-read-pages.sqlinc',
            title:
              'paging, cursor faults and query refusals changed no store: reads are mutation-free [P2-S12-AC-186]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_reads/040-terms-read-authority.sqlinc',
            title: 'no refusal changed any store [P2-S12-AC-185]',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/error-catalog.test.ts',
            title:
              'BE03c normative application error catalog [P2-S12-AC-274] resolves an operation to its catalog, shared catalogs included',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-taxonomy-reads.test.ts',
            title:
              'cmsTaxonomyTermsRead production port: platform_api.cms_list_taxonomy_terms (BE03c 167, 1447, 1480) maps the raised capability_missing to 403',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-taxonomy-reads.test.ts',
            title:
              'cmsTaxonomyTermsRead production port: platform_api.cms_list_taxonomy_terms (BE03c 167, 1447, 1480) maps the raised NOT_FOUND to 404',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-188',
    text: "cmsTaxonomyTermsRead is consumed by the protected `CmsTaxonomyTermForm`, which lists the vocabulary's terms with their lifecycle, keeps the term list cursor as URL state without serializing a protected value, shows a merged term's survivor redirect, renders `canonical_overlap` as \"This matches a canonical {domain} record. Reference the canonical record instead\" with the canonical id as copyable text and never creates the term, and links `taxonomy_not_active` to the vocabulary's governed review; verification covers term keyset order, cursor binding and merged terms listed with their successor.",
    clauses: [
      {
        text: "cmsTaxonomyTermsRead is consumed by the protected `CmsTaxonomyTermForm`, which lists the vocabulary's terms with their lifecycle, keeps the term list cursor as URL state without serializing a protected value, shows a merged term's survivor redirect, renders `canonical_overlap` as \"This matches a canonical {domain} record. Reference the canonical record instead\" with the canonical id as copyable text and never creates the term, and links `taxonomy_not_active` to the vocabulary's governed review; verification covers term keyset order, cursor binding and merged terms listed with their successor.",
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermForm.test.tsx',
            title:
              'CmsTaxonomyTermForm: the term list lists every term with labels, aliases, lifecycle and the survivor redirect',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermForm.test.tsx',
            title:
              'CmsTaxonomyTermForm: the term list says where an off-page survivor is, and shows an empty list in words',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermForm.test.tsx',
            title:
              'CmsTaxonomyTermForm: the term list keeps the filter and the cursor in the URL: a GET filter form and pager links',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-taxonomy-pages/load-taxonomy-page.test.ts',
            title:
              'loadTaxonomyPage: a saved vocabulary forwards the URL state of the term list and never any other member of the page URL',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermForm.refusals.test.tsx',
            title:
              'CmsTaxonomyTermForm: a refused term action (FE03 :887) shows a canonical overlap with its domain and the canonical id as copyable text, never a link',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermForm.refusals.test.tsx',
            title:
              'CmsTaxonomyTermForm: a refused term action (FE03 :887) copies the canonical id, and says so when copying is unavailable',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-taxonomy-terms/term-status-copy.test.ts',
            title:
              'failureCopy names the canonical domain of an overlap in words, for each of the six domains',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermForm.refusals.test.tsx',
            title:
              'CmsTaxonomyTermForm: a refused term action (FE03 :887) links a refusal for a vocabulary with no active version to the governed review',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-taxonomy-terms/taxonomy-terms-read.test.ts',
            title:
              'readTaxonomyTerms puts the filter, the signed cursor and the limit in the query, encoded',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-taxonomy-terms/taxonomy-terms-read.test.ts',
            title:
              'verifiedTermsPage accepts a merged term with its successor, an empty page and a continuation cursor',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-taxonomy-terms/taxonomy-terms-read.test.ts',
            title:
              'verifiedTermsPage refuses a merged term without a successor',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-terms-read.test.ts',
            title:
              'cmsTaxonomyTermsRead keyset order tie-break (termKey, then termId) accepts equal keys in ascending term id order and refuses descending',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_reads/020-terms-read.sqlinc',
            title:
              'all seven terms, every lifecycle, in termKey ASC order [P2-S12-AC-183]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_reads/030-terms-read-pages.sqlinc',
            title:
              'a cursor replayed against another limit, filter or vocabulary, or with a forged payload or expiry, is 409: the client restarts from page one [P2-S12-AC-187]',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-taxonomy-pages/load-taxonomy-page.test.ts',
            title:
              'loadTaxonomyPage: a saved vocabulary restarts a stale cursor from the first page (409)',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-189',
    text: 'Reserved keys (E13): `templateKey` must not equal `context`, `versions` or `new` and `patternKey` must not equal `context`, `versions`, `selector` or `new`, enforced in the contracts schema and in a SQL CHECK on `cms_template_versions.template_key` and `cms_pattern_versions.pattern_key`, so that a reserved key is 422 `TEMPLATE_VALIDATION_FAILED` (or `COMPOSITION_VALIDATION_FAILED`) at `/templateKey` or `/patternKey` with `details.reasonCode` `key_reserved` and can never resolve as the `{templateKey}` or `{patternKey}` of a latest read.',
    clauses: [
      {
        text: 'Reserved keys (E13): `templateKey` must not equal `context`, `versions` or `new` and `patternKey` must not equal `context`, `versions`, `selector` or `new`, enforced in the contracts schema and in a SQL CHECK on `cms_template_versions.template_key`',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/key-grammar.test.ts',
            title:
              'BE03c key grammar (E13, E14, lineage ids) [P2-S12-AC-189] reserves exactly the template and pattern keys that collide with fixed routes',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/key-grammar.test.ts',
            title:
              'BE03c key grammar (E13, E14, lineage ids) [P2-S12-AC-189] refuses a reserved template key with the key_reserved reason and keeps near-misses valid',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/key-grammar.test.ts',
            title:
              'BE03c key grammar (E13, E14, lineage ids) [P2-S12-AC-189] refuses a reserved pattern key with the key_reserved reason',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/template-keys.test.ts',
            title:
              'CMS-03C-01 template keys, audience and lineage (E13, E4) [P2-S12-AC-189] refuses a reserved templateKey at /templateKey with the key_reserved reason',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/pattern-version.test.ts',
            title:
              'CMS-03C-12 pattern version request [P2-S12-AC-189] refuses a reserved patternKey at /patternKey with key_reserved',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_fix_template_key_audience.sql',
            title:
              'E13: a CHECK refuses the reserved template keys [P2-S12-AC-189]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_fix_template_key_audience.sql',
            title:
              'E13: a direct insert of the reserved key context violates the CHECK [P2-S12-AC-189]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_fix_template_key_audience.sql',
            title:
              'E13: a direct insert of the reserved key versions violates the CHECK [P2-S12-AC-189]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_fix_template_key_audience.sql',
            title:
              'E13: a direct insert of the reserved key new violates the CHECK [P2-S12-AC-189]',
          },
        ],
      },
      {
        text: '`cms_pattern_versions.pattern_key`',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_pattern/010-storage-and-registry.sqlinc',
            title:
              'the table CHECK cms_pattern_versions_pattern_key_not_reserved refuses the raw keys context, versions and new [P2-S12-AC-189]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_pattern/010-storage-and-registry.sqlinc',
            title:
              'control: the fourth reserved key selector is refused by the same CHECK [P2-S12-AC-189]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_pattern/010-storage-and-registry.sqlinc',
            title:
              'control: a non-reserved raw key inserts, so the CHECK discriminates by key [P2-S12-AC-189]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_persistence.sql',
            title:
              'the table CHECK names the reserved pattern route keys context, versions, selector and new, and no other key but the DEC-232 nestable [P2-S12-AC-189]',
          },
        ],
      },
      {
        text: 'so that a reserved key is 422 `TEMPLATE_VALIDATION_FAILED` (or `COMPOSITION_VALIDATION_FAILED`) at `/templateKey` or `/patternKey` with `details.reasonCode` `key_reserved` and can never resolve as the `{templateKey}` or `{patternKey}` of a latest read.',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/template-keys.test.ts',
            title:
              'CMS-03C-01 template keys, audience and lineage (E13, E4) [P2-S12-AC-189] refuses a reserved templateKey at /templateKey with the key_reserved reason',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/pattern-version.test.ts',
            title:
              'CMS-03C-12 pattern version request [P2-S12-AC-189] refuses a reserved patternKey at /patternKey with key_reserved',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/phase-02-slice-12-template-key-audience.test.ts',
            title:
              'E13 reserved template keys at the route refuses the reserved key context with 422, key_reserved and a /templateKey pointer, before the port',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/phase-02-slice-12-template-key-audience.test.ts',
            title:
              'E13 reserved template keys at the route refuses the reserved key versions with 422, key_reserved and a /templateKey pointer, before the port',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/phase-02-slice-12-template-key-audience.test.ts',
            title:
              'E13 reserved template keys at the route refuses the reserved key new with 422, key_reserved and a /templateKey pointer, before the port',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-12-template-version.apispec.ts',
            title:
              'CMS-03C-01 define a template version through the real stack [P2-S12-AC-005] [P2-S12-AC-189] a reserved key is a 422 whose reasonCode and pointer name /templateKey, and writes nothing',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-write.test.ts',
            title:
              'CMS-03C-12 pattern definition write contract gives reserved key context its typed request pointer',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-write.test.ts',
            title:
              'CMS-03C-12 pattern definition write contract gives reserved key versions its typed request pointer',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-write.test.ts',
            title:
              'CMS-03C-12 pattern definition write contract gives reserved key selector its typed request pointer',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-write.test.ts',
            title:
              'CMS-03C-12 pattern definition write contract gives reserved key new its typed request pointer',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-write.test.ts',
            title:
              'CMS-03C-12 pattern definition write contract gives the SQL reserved-key refusal the same fixed pointer',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title: 'reserved-context: exact SQL message token [P2-S12-AC-104]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title: 'reserved-versions: exact SQL message token [P2-S12-AC-104]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title: 'reserved-selector: exact SQL message token [P2-S12-AC-104]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title: 'reserved-new: exact SQL message token [P2-S12-AC-104]',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/template-detail.test.ts',
            title:
              'cmsTemplateLatestRead path contract [P2-S12-AC-166] accepts only a grammar-valid, non-reserved path templateKey and no other member',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-12-template-reads.apispec.ts',
            title:
              'cmsTemplateLatestRead through the real stack [P2-S12-AC-166] a malformed key and the reserved keys are 400 and never reach the database',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/pattern-version.test.ts',
            title:
              'cmsPatternLatestRead path contract [P2-S12-AC-172] accepts only a grammar-valid, non-reserved path patternKey and no other member',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/server/cms-pattern-platform-latest.test.ts',
            title:
              'cmsPatternLatestRead proxy: admission (nothing reaches the Worker) refuses the reserved key selector',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/server/cms-pattern-platform-latest.test.ts',
            title:
              'cmsPatternLatestRead proxy: admission (nothing reaches the Worker) refuses the reserved key context',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/server/cms-pattern-platform-latest.test.ts',
            title:
              'cmsPatternLatestRead proxy: admission (nothing reaches the Worker) refuses the reserved key versions',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/server/cms-pattern-platform-latest.test.ts',
            title:
              'cmsPatternLatestRead proxy: admission (nothing reaches the Worker) refuses the reserved key new',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-190',
    text: "Per-owner uniqueness (E14): `UNIQUE (template_key, version)`, `UNIQUE (pattern_key, version)` and `UNIQUE (taxonomy_key, version)` are replaced by `UNIQUE (owner_id, <key>, version)` by forward migration, every lookup by key (the latest reads, parents and selectors) is scoped to the caller's owner party, and a key held by another owner is indistinguishable from an unused key, so that no cross-owner existence signal such as a 409 is possible.",
    clauses: [
      {
        text: 'Per-owner uniqueness (E14): `UNIQUE (template_key, version)`, `UNIQUE (pattern_key, version)` and `UNIQUE (taxonomy_key, version)` are replaced by `UNIQUE (owner_id, <key>, version)` by forward migration',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_fix_template_per_owner.sql',
            title:
              'E14: the global UNIQUE (template_key, version) is gone [P2-S12-AC-190]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_fix_template_per_owner.sql',
            title:
              'E14: UNIQUE (owner_id, template_key, version) is the key constraint [P2-S12-AC-190]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition/080-schema-guards.sqlinc',
            title: 'E14: the global (taxonomy_key, version) unique is gone',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition/080-schema-guards.sqlinc',
            title: 'E14: (owner_id, taxonomy_key, version) is unique',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition/070-storage.sqlinc',
            title:
              'the key uniqueness is per owner (E14), under its original constraint name',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition/070-storage.sqlinc',
            title:
              'another owner may hold the same key and version: uniqueness is per owner, never disclosed as a conflict (E14)',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition/070-storage.sqlinc',
            title: 'one owner cannot hold a key version twice [P2-S12-AC-100]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_fix_template_populated.sql',
            title:
              'the global UNIQUE (template_key, version) was dropped [P2-S12-AC-190]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_fix_template_populated.sql',
            title:
              'owner B defines the key owner A already holds on the populated table [P2-S12-AC-190]',
          },
        ],
      },
      {
        text: 'every lookup by key (the latest reads, parents',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_pattern/020-cross-owner.sqlinc',
            title:
              "B's successor of a key only A holds is the complete NOT_FOUND [P2-S12-AC-190]",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_pattern/020-cross-owner.sqlinc',
            title:
              'both latest reads are the complete NOT_FOUND [P2-S12-AC-190]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_pattern/020-cross-owner.sqlinc',
            title:
              "control: B's latest read of the shared key returns B's own lineage, never A's [P2-S12-AC-190]",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_pattern_types.sql',
            title:
              'with a shared key each organization reads its OWN lineage: the owner its active pattern, the other organization its own row [P2-S12-AC-173]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_fix_template_per_owner.sql',
            title:
              'a key held by another owner is indistinguishable from an unused key on a successor [P2-S12-AC-006] [P2-S12-AC-190]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title: 'other-owner-parent: exact refusal message',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-12-template-reads.apispec.ts',
            title:
              'cmsTemplateLatestRead through the real stack [P2-S12-AC-166] [P2-S12-AC-167] a key only another owner holds is the same 404 as an unused key, and each owner reads its own definition of a shared key',
          },
        ],
      },
      {
        text: 'selectors)',
        citations: [],
      },
      {
        text: "is scoped to the caller's owner party",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_pattern/020-cross-owner.sqlinc',
            title:
              "B's successor of a key only A holds is the complete NOT_FOUND [P2-S12-AC-190]",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_pattern/020-cross-owner.sqlinc',
            title:
              'both latest reads are the complete NOT_FOUND [P2-S12-AC-190]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_pattern/020-cross-owner.sqlinc',
            title:
              "control: B's latest read of the shared key returns B's own lineage, never A's [P2-S12-AC-190]",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_pattern_types.sql',
            title:
              'with a shared key each organization reads its OWN lineage: the owner its active pattern, the other organization its own row [P2-S12-AC-173]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_fix_template_per_owner.sql',
            title:
              'a key held by another owner is indistinguishable from an unused key on a successor [P2-S12-AC-006] [P2-S12-AC-190]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title: 'other-owner-parent: exact refusal message',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-12-template-reads.apispec.ts',
            title:
              'cmsTemplateLatestRead through the real stack [P2-S12-AC-166] [P2-S12-AC-167] a key only another owner holds is the same 404 as an unused key, and each owner reads its own definition of a shared key',
          },
        ],
      },
      {
        text: 'a key held by another owner is indistinguishable from an unused key, so that no cross-owner existence signal such as a 409 is possible.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_pattern/020-cross-owner.sqlinc',
            title:
              'a successor of a key held by another owner answers byte-identically to a successor of an unused key (SQLSTATE, message, DETAIL) [P2-S12-AC-190]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_pattern/020-cross-owner.sqlinc',
            title:
              "B's latest read of a key only A holds is byte-identical to a latest read of an unused key [P2-S12-AC-190]",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_pattern/020-cross-owner.sqlinc',
            title:
              "B's first version of a key A holds succeeds with its own patternId, owner and version 1: a key is unique per owner, never a 409 [P2-S12-AC-190]",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_pattern_types.sql',
            title:
              'a key another owner holds is exactly the outcome of an unused key [P2-S12-AC-173]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_fix_template_per_owner.sql',
            title:
              "owner B first-creating a key owner A holds succeeds, so no 409 leaks A's key [P2-S12-AC-190]",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition/030-create.sqlinc',
            title: 'per-owner key yields distinct lineages',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title: 'other-owner-same-key: ordinary authorized create succeeds',
          },
        ],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven (uncited clause): "selectors)": BOUNDARY: the owner predicate of cms_list_pattern_selector (and the taxonomy selector) is not isolated by any test; an ACTIVE foreign row is not producible in the fixtures, and the AC-108 control uses a draft clone that the active filter excludes anyway.',
  },
  {
    criterion: 'P2-S12-AC-191',
    text: "Lineage ids: `templateId`, `patternId` and `taxonomyId` are the stable lineage ids of (owner, key), the `id` of the version-1 row carried on every successor row as `template_id`, `pattern_id` and `taxonomy_id`; a version number is unique within its lineage, a successor names its parent through `supersedes_id`, and a partial unique index on each lineage id `WHERE state = 'active'` allows one active version per lineage.",
    clauses: [
      {
        text: 'Lineage ids: `templateId`, `patternId` and `taxonomyId` are the stable lineage ids of (owner, key), the `id` of the version-1 row carried on every successor row as `template_id`, `pattern_id` and `taxonomy_id`; a version number is unique within its lineage, a successor names its parent through `supersedes_id`',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_fix_template_per_owner.sql',
            title:
              'the lineage id template_id is a NOT NULL uuid [P2-S12-AC-191]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_fix_template_per_owner.sql',
            title:
              'a version number is unique within its lineage [P2-S12-AC-191]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_fix_template_per_owner.sql',
            title:
              'a first version is its own lineage: templateId equals the version-1 id [P2-S12-AC-191]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_fix_template_per_owner.sql',
            title:
              'a successor carries the lineage of version 1 [P2-S12-AC-191]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_fix_template_per_owner.sql',
            title:
              'the successor names its same-owner parent through supersedes_id [P2-S12-AC-191]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_fix_template_per_owner.sql',
            title:
              'the same key under a different owner has a different lineage [P2-S12-AC-191]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_fix_template_populated.sql',
            title:
              'every row, in every lifecycle state, has a lineage id [P2-S12-AC-191]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_fix_template_populated.sql',
            title:
              'the lineage of a chain is the id of its version-1 row [P2-S12-AC-191]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition/080-schema-guards.sqlinc',
            title: 'lineage: a version number is unique within its lineage',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition/060-review-successor.sqlinc',
            title: 'third version keeps the version-one lineage id',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition/060-review-successor.sqlinc',
            title: 'third version points to its immediate predecessor',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition/080-schema-guards.sqlinc',
            title: 'a successor naming a foreign lineage is refused',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition/070-storage.sqlinc',
            title: 'the first forest row is its own lineage [P2-S12-AC-103]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition/070-storage.sqlinc',
            title:
              "the successor carries its parent's lineage id [P2-S12-AC-103]",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition/070-storage.sqlinc',
            title:
              'a successor naming its exact parent is accepted [P2-S12-AC-103]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition/020-create-successor.sqlinc',
            title: 'successor preserves lineage identity [P2-S12-AC-103]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition/populated-lineage.sql',
            title:
              'the lineage, type list and node count are NOT NULL; only the first version has no parent',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition/070-storage.sqlinc',
            title:
              'one active version per lineage and the lineage and per-owner unique keys exist [P2-S12-AC-100]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition/070-storage.sqlinc',
            title: 'one owner cannot hold a key version twice [P2-S12-AC-100]',
          },
        ],
      },
      {
        text: "a partial unique index on each lineage id `WHERE state = 'active'` allows one active version per lineage.",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_fix_template_per_owner.sql',
            title:
              'at most one active version per lineage: partial UNIQUE (template_id) WHERE state = active [P2-S12-AC-191]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_fix_template_per_owner.sql',
            title:
              'a second active version in the same lineage violates the partial unique index [P2-S12-AC-191]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition/080-schema-guards.sqlinc',
            title: 'lineage: at most one active version per vocabulary',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_persistence.sql',
            title:
              'the pattern lineage index is UNIQUE on (pattern_id) and PARTIAL WHERE state = active: one active version per lineage [P2-S12-AC-191]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-192',
    text: 'Template audience (E4): `audience` follows the BE04c audience grammar `^[a-z0-9_-]{1,48}$`, matched as submitted and never trimmed, in the contracts schema and in a SQL CHECK on `cms_template_versions.audience`, so that an audience outside the grammar is refused 422 `TEMPLATE_VALIDATION_FAILED` with a bounded JSON-pointer violation at `/audience`.',
    clauses: [
      {
        text: 'Template audience (E4): `audience` follows the BE04c audience grammar `^[a-z0-9_-]{1,48}$`, matched as submitted and never trimmed, in the contracts schema and in a SQL CHECK on `cms_template_versions.audience`, so that an audience outside the grammar is refused 422 `TEMPLATE_VALIDATION_FAILED` with a bounded JSON-pointer violation at `/audience`.',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/template-keys.test.ts',
            title:
              'CMS-03C-01 template keys, audience and lineage (E13, E4) [P2-S12-AC-025] enforces the BE04c audience grammar ^[a-z0-9_-]{1,48}$ as submitted, never trimmed',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/phase-02-slice-12-template-key-audience.test.ts',
            title:
              'E4 audience grammar at the route refuses an audience of a trailing newline with 422 at /audience, before the port',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/phase-02-slice-12-template-key-audience.test.ts',
            title:
              'E4 audience grammar at the route refuses an audience of Public with 422 at /audience, before the port',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/phase-02-slice-12-template-key-audience.test.ts',
            title:
              'E4 audience grammar at the route refuses an audience of a leading space with 422 at /audience, before the port',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/phase-02-slice-12-template-key-audience.test.ts',
            title:
              'E4 audience grammar at the route refuses an audience of a trailing space with 422 at /audience, before the port',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/phase-02-slice-12-template-key-audience.test.ts',
            title:
              'E4 audience grammar at the route refuses an audience of 49 characters with 422 at /audience, before the port',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/phase-02-slice-12-template-key-audience.test.ts',
            title:
              'E4 audience grammar at the route accepts the conforming audience aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa as submitted',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/phase-02-slice-12-template-key-audience.test.ts',
            title:
              'E4 audience grammar at the route relays a database refusal at /audience as one bounded violation',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_fix_template_key_audience.sql',
            title: 'E4: a CHECK enforces the audience grammar [P2-S12-AC-192]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_fix_template_key_audience.sql',
            title:
              'E4: the audience CHECK is validated on a clean table [P2-S12-AC-192]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_fix_template_key_audience.sql',
            title:
              'E4: the RPC refuses audience with a trailing newline at /audience [P2-S12-AC-192] [P2-S12-AC-025]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_fix_template_key_audience.sql',
            title:
              'E4: the RPC refuses audience Public (uppercase) at /audience [P2-S12-AC-192] [P2-S12-AC-025]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_fix_template_key_audience.sql',
            title:
              'E4: the RPC refuses audience with a leading space at /audience [P2-S12-AC-192] [P2-S12-AC-025]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_fix_template_key_audience.sql',
            title:
              'E4: the RPC refuses audience with a trailing space at /audience [P2-S12-AC-192] [P2-S12-AC-025]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_fix_template_key_audience.sql',
            title:
              'E4: the RPC refuses audience of 49 characters at /audience [P2-S12-AC-192] [P2-S12-AC-025]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_fix_template_key_audience.sql',
            title:
              'E4: a direct insert of audience with a trailing newline violates the CHECK [P2-S12-AC-192]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_fix_template_key_audience.sql',
            title:
              'E4: a direct insert of audience Public violates the CHECK [P2-S12-AC-192]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_fix_template_key_audience.sql',
            title:
              'E4: a direct insert of audience of 49 characters violates the CHECK [P2-S12-AC-192]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_fix_template_key_audience.sql',
            title:
              'E4: a direct insert of a conforming audience succeeds [P2-S12-AC-192]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-12-template-version.apispec.ts',
            title:
              'CMS-03C-01 define a template version through the real stack [P2-S12-AC-005] [P2-S12-AC-025] [P2-S12-AC-192] an audience outside ^[a-z0-9_-]{1,48}$ is a 422 at /audience and writes nothing',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_fix_template_key_audience.sql',
            title:
              'E4: the stored audience is exactly as submitted, never trimmed or folded [P2-S12-AC-025]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-193',
    text: 'blockRegistryDigest: the server resolves every reachable block from the 03a safe registry and computes the lowercase SHA-256 of the RFC 8785/JCS array of the reachable, deduplicated `{blockKey,blockVersion,releaseDigest,propsSchemaHash,rendererRef,lifecycle}` tuples sorted by the UTF-8 bytes of `blockKey` and then numeric `blockVersion`; a client-supplied digest is only an equality expectation, compared with the server result and never stored in place of it, so the recomputed server digest is authoritative; and the server recomputes the digest at template create, template activate, pattern create, pattern activate and 03b publication preflight.',
    clauses: [
      {
        text: 'blockRegistryDigest: the server resolves every reachable block from the 03a safe registry and computes the lowercase SHA-256 of the RFC 8785/JCS array of the reachable',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_authority.sql',
            title:
              'CMS-03C-01 empty reachable-block set hashes exact canonical JSON []',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_authority.sql',
            title:
              'CMS-03C-01 persisted digest equals exact server-derived safe tuple hash',
          },
        ],
      },
      {
        text: 'deduplicated `{blockKey,blockVersion,releaseDigest,propsSchemaHash,rendererRef,lifecycle}` tuples sorted by the UTF-8 bytes of `blockKey`',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_fix/010-digest.sqlinc',
            title:
              'the digest folds each reachable block once, ordered by key (byte order) then version [BE03c digest invariants]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_fix/010-digest.sqlinc',
            title:
              'the digest is independent of node order in the tree [BE03c digest invariants]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition/045-props-digest.sqlinc',
            title:
              'digest sorts reachable safe tuples by block key independent of forest order [P2-S12-AC-193]',
          },
        ],
      },
      {
        text: 'then numeric `blockVersion`',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_digest.sql',
            title:
              'the pattern digest folds one key at versions 1, 2 and 10 in numeric order, not text order [P2-S12-AC-193]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_digest.sql',
            title:
              'the pattern digest is not the text-order fold [.. @1, .. @10, .. @2] [P2-S12-AC-193]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_digest.sql',
            title:
              'the template digest folds one key at versions 1, 2 and 10 in numeric order, not text order [P2-S12-AC-193]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_digest.sql',
            title:
              'the template digest is not the text-order fold [.. @10, .. @2] [P2-S12-AC-193]',
          },
        ],
      },
      {
        text: 'a client-supplied digest is only an equality expectation, compared with the server result and never stored in place of it, so the recomputed server digest is authoritative',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_authority.sql',
            title:
              'CMS-03C-01 refuses caller digest that differs from current registry with the typed token [BE03c 323-327, 1273; DEC-186]',
          },
        ],
      },
      {
        text: 'the server recomputes the digest at template create',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_digest/010-refusals.sqlinc',
            title:
              'matching digest after a refusal: the response carries the recomputed digest',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_digest/010-refusals.sqlinc',
            title:
              'mismatching digest: the closed token block_registry_digest_mismatch, not the generic CONFLICT [BE03c 1273, DEC-186]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_authority.sql',
            title:
              'CMS-03C-01 persisted digest equals exact server-derived safe tuple hash',
          },
        ],
      },
      {
        text: 'template activate',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_recheck/075-digest-locks.sqlinc',
            title:
              'a lock failure raised while the digest is recomputed by the activation recheck is the typed CONFLICT of CMS-03C-09, not the committed refusal dependency_changed [DEC-221]',
          },
        ],
      },
      {
        text: 'pattern create',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition/025-agreement.sqlinc',
            title:
              'first definition digest equals the governed recompute [P2-S12-AC-193]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition/025-agreement.sqlinc',
            title:
              'successor digest equals the governed recompute [P2-S12-AC-193]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title: 'digest-mismatch: exact SQL message token [P2-S12-AC-104]',
          },
        ],
      },
      {
        text: 'pattern activate',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_pattern/040-activation-recheck.sqlinc',
            title:
              'after a reachable block is deprecated, activating an approved pattern_version answers dependency_changed and invalidates the review [P2-S12-AC-193]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_pattern/040-activation-recheck.sqlinc',
            title:
              'after a reachable block is deprecated, scheduling an approved pattern_version answers dependency_changed and invalidates the review [P2-S12-AC-193]',
          },
        ],
      },
      {
        text: '03b publication preflight.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_preflight.sql',
            title:
              'a reachable block that was not frozen changes the reachable-set digest [P2-S11-AC-095]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_preflight.sql',
            title:
              'a frozen block digest that differs fails block_digest_changed [P2-S11-AC-095]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_preflight.sql',
            title:
              'the legacy pin reaches the current pattern provider and fails only its stale registry digest [DEC-199; P2-S11-AC-093]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-194',
    text: 'Block registry consumption: 03c consumes only the safe `BlockDefinitionRegistryRecord` projection (`id`, `version`, `blockKey`, `blockVersion`, `propsSchemaRef`, `propsSchemaHash`, `rendererRef`, `releaseDigest`, `lifecycle`, with the literal `resourceKind` `block_definition_registry_record` and no release principal, signature or raw manifest), never registers, updates or deletes a block, and before every template or pattern validation refetches the record or consumes the latest `cms.block.lifecycle.changed.v1`, so that a missing, withdrawn, incompatible, duplicate or unreachable block fails closed before mutation and a deprecated block follows the fixed compatibility policy.',
    clauses: [
      {
        text: 'Block registry consumption: 03c consumes only the safe `BlockDefinitionRegistryRecord` projection (`id`, `version`, `blockKey`, `blockVersion`, `propsSchemaRef`, `propsSchemaHash`, `rendererRef`, `releaseDigest`, `lifecycle`, with the literal `resourceKind` `block_definition_registry_record` and no release principal, signature or raw manifest)',
        citations: [],
      },
      {
        text: 'never registers, updates or deletes a block,',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_governed/080-template-gates.sqlinc',
            title:
              'a successful CMS-03C-01 create over a registered block leaves the block registry, its lifecycle events and the release nonce receipts byte-identical [P2-S12-AC-194]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_pattern/010-storage-and-registry.sqlinc',
            title:
              'a successful pattern create changes the pattern table and leaves the block registry, its lifecycle events and the release nonce receipts byte-identical [P2-S12-AC-194]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_pattern/010-storage-and-registry.sqlinc',
            title:
              'no function outside the 03a register and lifecycle commands writes the block registry tables: 03c never registers, updates or deletes a block [P2-S12-AC-194]',
          },
        ],
      },
      {
        text: 'and before every template or pattern validation refetches the record or consumes the latest `cms.block.lifecycle.changed.v1`, so that a missing, withdrawn, incompatible, duplicate or unreachable block fails closed before mutation and a deprecated block follows the fixed compatibility policy.',
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven (uncited clauses): "Block registry consumption: 03c consumes only the safe `BlockDefinitionRegistryRecord` projection (`id`, `version`, `blockKey`, `blockVersion`, `propsSchemaRef`, `propsSchemaHash`, `rendererRef`, `releaseDigest`, `lifecycle`, with the literal `resourceKind` `block_definition_registry_record` and no release principal, signature or raw manifest)": missing test or spec ruling: no test shows that every 03c reader of the block registry reads only the nine-member projection; CMS-03C-12 reads props_schema_snapshot and the production SQL carries no resourceKind. "and before every template or pattern validation refetches the record or consumes the latest `cms.block.lifecycle.changed.v1`, so that a missing, withdrawn, incompatible, duplicate or unreachable block fails closed before mutation and a deprecated block follows the fixed compatibility policy.": missing test: refetch-or-consume before every template and pattern validation, and the duplicate and unreachable block outcomes, through the production path.',
  },
  {
    criterion: 'P2-S12-AC-195',
    text: 'Definition immutability: the definition fields of TemplateVersion, PatternVersion and TaxonomyVersion never change after creation (an edit is a successor version through CMS-03C-01, -12 or -16), activation makes the definition immutable, and the lifecycle columns `state` (`draft`, `review`, `approved`, `scheduled`, `active`, `superseded`, `retired`, `blocked`), `version`, `activated_at`, `retired_at` and `updated_at` advance only through the governed RPCs CMS-03C-06 to -09.',
    clauses: [
      {
        text: 'Definition immutability: the definition fields of TemplateVersion, PatternVersion and TaxonomyVersion never change after creation (an edit is a successor version through CMS-03C-01, -12 or -16)',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_09_p241_dec123_successor_binding.sql',
            title:
              'the template version a default reference names cannot change its content: the reference is immutable [P2-S09-AC-045]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_09_p241_dec123_successor_binding.sql',
            title:
              'nor can its compatible-type set, which the resolver reads, be rewritten after a reference was accepted [P2-S09-AC-045]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_composition_authority.sql',
            title: 'pattern definition cannot mutate in place',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition/070-storage.sqlinc',
            title:
              "a draft's definition hash is immutable in place [P2-S12-AC-100]",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition/070-storage.sqlinc',
            title:
              'the compatible type list is immutable in place [P2-S12-AC-101]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_authority.sql',
            title: 'taxonomy definition is immutable after creation',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_fix_template_per_owner.sql',
            title:
              'the lineage id of a stored row can never change [P2-S12-AC-191]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_fix_template_per_owner.sql',
            title:
              'the owner of a stored row can never change, so the per-owner key cannot be transplanted [P2-S12-AC-190]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title: "immutable definition: shape = 'hierarchical'",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title: "immutable definition: taxonomy_key = 's12td-renamed'",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title:
              'immutable definition: allowlisted_type_keys = \'["zz"]\'::jsonb',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title:
              'immutable definition: allowlisted_field_keys = \'["zz"]\'::jsonb',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title:
              'immutable definition: canonical_overlap_domains = \'["role"]\'::jsonb',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title:
              'immutable definition: taxonomy_id = extensions.gen_random_uuid()',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title: 'immutable definition: supersedes_id = null',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title: "immutable definition: content_hash = repeat('b', 64)",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title: 'immutable definition: version = 99',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title:
              'immutable definition: created_by = extensions.gen_random_uuid()',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title:
              'immutable definition: owner_id = extensions.gen_random_uuid()',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title:
              "immutable definition: created_at = created_at - interval '1 day'",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title:
              'immutable definition: lifecycle_version = lifecycle_version + 1',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title: 'immutable definition: activated_at = now()',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title: 'immutable definition: retired_at = now()',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_fix_template_per_owner.sql',
            title:
              'a successor carries the lineage of version 1 [P2-S12-AC-191]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition/020-create-successor.sqlinc',
            title: 'successor preserves lineage identity [P2-S12-AC-103]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition/060-review-successor.sqlinc',
            title: 'third version points to its immediate predecessor',
          },
        ],
      },
      {
        text: 'activation makes the definition immutable',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_governed/040-lifecycle.sqlinc',
            title:
              'a definition field of an ACTIVE template version is immutable [P2-S12-AC-195]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_governed/040-lifecycle.sqlinc',
            title:
              'a definition field of an ACTIVE taxonomy version is immutable [P2-S12-AC-195]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_pattern/010-storage-and-registry.sqlinc',
            title:
              'a definition field of an ACTIVE pattern version is immutable [P2-S12-AC-195]',
          },
        ],
      },
      {
        text: 'the lifecycle columns `state` (`draft`, `review`, `approved`, `scheduled`, `active`, `superseded`, `retired`, `blocked`), `version`, `activated_at`, `retired_at` and `updated_at` advance only through the governed RPCs CMS-03C-06 to -09.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_governed/040-lifecycle.sqlinc',
            title:
              'a direct UPDATE cannot advance the state and lifecycle_version of a draft template version outside the governed RPCs [P2-S12-AC-195]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_governed/040-lifecycle.sqlinc',
            title:
              'a direct UPDATE cannot stamp activated_at on a template version [P2-S12-AC-195]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_governed/040-lifecycle.sqlinc',
            title:
              'a direct UPDATE cannot stamp retired_at on a taxonomy version [P2-S12-AC-195]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_governed/040-lifecycle.sqlinc',
            title:
              'a direct UPDATE of updated_at alone is refused on a draft template version [P2-S12-AC-195]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_governed/040-lifecycle.sqlinc',
            title:
              'a persisted attempt to poison updated_at of a taxonomy version in review is refused [P2-S12-AC-195]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_governed/040-lifecycle.sqlinc',
            title:
              'only the submit, move, activate, supersede and retire governed functions UPDATE the template, pattern and taxonomy version tables [P2-S12-AC-195]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_governed/040-lifecycle.sqlinc',
            title:
              'a direct UPDATE of state alone cannot activate an approved taxonomy version [P2-S12-AC-195]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_pattern/010-storage-and-registry.sqlinc',
            title:
              'a direct UPDATE cannot advance the state and lifecycle_version of a draft pattern version outside the governed RPCs [P2-S12-AC-195]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_pattern/010-storage-and-registry.sqlinc',
            title:
              'a direct UPDATE cannot stamp activated_at on a pattern version [P2-S12-AC-195]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_pattern/010-storage-and-registry.sqlinc',
            title:
              'a direct UPDATE of updated_at alone is refused on a draft pattern version [P2-S12-AC-195]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-196',
    text: 'Governed review tables: CMS-03C-06 to CMS-03C-11 serve the closed, code-owned `subject_kind` set (`template_version`, `pattern_version`, `taxonomy_version`) through one set of private tables keyed by `(subject_kind, subject_id)` (`cms_governed_reviews`, `cms_governed_review_decisions`, `cms_governed_review_assignments`, `cms_governed_review_dependencies` and, for scheduled activation, `cms_governed_activation_schedules`) so that slot semantics, MFA, assignment, strictest-policy counting and invalidation have one implementation; a later subject kind is added only by forward migration; and the 03a `cms_schema_reviews` set and the 03b editorial review tables keep their own tables and operations.',
    clauses: [
      {
        text: 'Governed review tables: CMS-03C-06 to CMS-03C-11 serve the closed, code-owned `subject_kind` set (`template_version`, `pattern_version`, `taxonomy_version`) through one set of private tables keyed by `(subject_kind, subject_id)` (`cms_governed_reviews`, `cms_governed_review_decisions`, `cms_governed_review_assignments`, `cms_governed_review_dependencies` and, for scheduled activation, `cms_governed_activation_schedules`) so that slot semantics, MFA, assignment, strictest-policy counting and invalidation have one implementation; a later subject kind is added only by forward migration; and the 03a `cms_schema_reviews` set and the 03b editorial review tables keep their own tables and operations.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_persistence.sql',
            title:
              'the governed review table exists in platform_private [P2-S12-AC-196]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_persistence.sql',
            title:
              'the governed decision table exists in platform_private [P2-S12-AC-196]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_persistence.sql',
            title:
              'the governed assignment table exists in platform_private [P2-S12-AC-196]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_persistence.sql',
            title:
              'the governed dependency table exists in platform_private [P2-S12-AC-196]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_persistence.sql',
            title:
              'the governed activation schedule table exists in platform_private [P2-S12-AC-196]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_persistence.sql',
            title:
              'the review set is keyed by (subject_kind, subject_id): the live-subject unique index is on exactly that pair [P2-S12-AC-196]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_persistence.sql',
            title:
              'cms_governed_reviews carries NOT NULL subject_kind and subject_id [P2-S12-AC-196]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_persistence.sql',
            title:
              'cms_governed_activation_schedules carries NOT NULL subject_kind and subject_id [P2-S12-AC-196]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_persistence.sql',
            title:
              'a CHECK closes cms_governed_reviews.subject_kind to exactly template_version, pattern_version and taxonomy_version [P2-S12-AC-196]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_persistence.sql',
            title:
              'a CHECK closes cms_governed_activation_schedules.subject_kind to the same three kinds [P2-S12-AC-196]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_persistence.sql',
            title:
              'the decision, assignment, dependency and schedule tables each hang off the one review row by (review_id, owner_id) [P2-S12-AC-196]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_persistence.sql',
            title:
              'no foreign key joins the governed review set to the 03a cms_schema_reviews set or the 03b editorial review tables, in either direction [P2-S12-AC-196]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_persistence.sql',
            title:
              'the 03a and 03b review tables carry no subject_kind or subject_id: they keep their own keys [P2-S12-AC-196]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-197',
    text: 'Subject state machine: `draft` becomes `review` at submission and `review` becomes `approved` when the last required approval lands; a rejection or invalidation returns the subject from `review` (or from `approved`, `scheduled` or `blocked`) to `draft` through an audited transition while the review stays `rejected` or `invalidated`; `approved` becomes `active` or `scheduled`; `scheduled` becomes `active` at execution or `blocked` when execution fails terminally; `blocked` becomes `active` or `scheduled` through a new activation command while its review is still `approved` and current; `active` becomes `superseded` in the transaction that activates a newer version of the lineage, or `retired`; `superseded` and `retired` are terminal; and the review states are `open` to `approved`, `rejected` or `invalidated` and `approved` to `invalidated`, with assignment create and revoke never changing the review state.',
    clauses: [
      {
        text: 'Subject state machine: `draft` becomes `review` at submission and `review` becomes `approved` when the last required approval lands; a rejection or invalidation returns the subject from `review` (or from `approved`, `scheduled` or `blocked`) to `draft` through an audited transition while the review stays `rejected` or `invalidated`; `approved` becomes `active` or `scheduled`; `scheduled` becomes `active` at execution or `blocked` when execution fails terminally; `blocked` becomes `active` or `scheduled` through a new activation command while its review is still `approved` and current; `active` becomes `superseded` in the transaction that activates a newer version of the lineage, or `retired`; `superseded` and `retired` are terminal; and the review states are `open` to `approved`, `rejected` or `invalidated` and `approved` to `invalidated`, with assignment create and revoke never changing the review state.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_governed/030-reject-audit.sqlinc',
            title:
              'control: the rejection moves the review to rejected and the subject from review back to draft [P2-S12-AC-197]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_governed/030-reject-audit.sqlinc',
            title:
              'the rejecting decision writes exactly one cms.governed.review.decide audit record, the audited transition of the subject back to draft [P2-S12-AC-197]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_governed/030-reject-audit.sqlinc',
            title:
              'the rejection audit record names the rejecting reviewer and the owner acting party [P2-S12-AC-197]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_submit.sql',
            title: 'submit moves the draft subject to review [P2-S12-AC-205]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_decision/030-happy.sqlinc',
            title:
              'the last required approval moves the review to approved at version 2 with the decision counted and decidedAt set [P2-S12-AC-070]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_decision/040-flows.sqlinc',
            title:
              'the second distinct approval fills the base slot, approves the review at version 3 and moves the subject to approved [P2-S12-AC-073]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_decision/040-flows.sqlinc',
            title:
              'a rejection sets the review rejected at version 2 with decidedAt, terminally [P2-S12-AC-073]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_decision/040-flows.sqlinc',
            title:
              'the reject decision satisfies the base slot and returns the subject to draft (lifecycle 3, definition version 1) [P2-S12-AC-073]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_decision.sql',
            title:
              'the invalidation is committed: review invalidated dependency_changed at version 2, no decision, the subject back to draft, one audit record and status 409 [P2-S12-AC-074]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation/060-invalidation.sqlinc',
            title:
              'the review is invalidated reviewer_authority_changed at version 3, the subject returns to draft (lifecycle 4), no event is emitted and the refusal is stored as 409 [P2-S12-AC-084]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation/060-invalidation.sqlinc',
            title:
              'the review is invalidated, the subject returns scheduled -> draft (lifecycle 5), one invalidation and one cancellation audit record are written and no event is emitted [P2-S12-AC-145]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_schedule/050-blocked.sqlinc',
            title:
              'a blocked subject whose dependency is still changed returns to draft through the committed invalidation of its review (blocked -> draft, lifecycle 6) [P2-S12-AC-146]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation/030-activate.sqlinc',
            title:
              'activation moves the subject approved -> active (lifecycle 3 -> 4, definition version 1) and records activated_at on the review whose version advances to 3 [P2-S12-AC-082]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation/050-schedule-accept.sqlinc',
            title:
              'scheduling moves the subject approved -> scheduled (lifecycle 3 -> 4), emits NO event, writes one audit record and stores status 202 [P2-S12-AC-142]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_schedule/030-execute.sqlinc',
            title:
              'the schedule completes at version 3, the subject goes scheduled -> active (lifecycle 4 -> 5, definition version 2) and the review records the activation instant at version 3 [P2-S12-AC-150]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_schedule/030-execute.sqlinc',
            title:
              'a creator whose designer grant was revoked blocks the schedule activation_authority_ended: schedule blocked, subject blocked (lifecycle 5), review still approved, no event, one audit record [P2-S12-AC-146]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_schedule/030-execute.sqlinc',
            title:
              'a blocked subject whose review is still approved and current activates through a new CMS-03C-09 command (lifecycle 6, one event); the blocked schedule row is evidence and stays [P2-S12-AC-146]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_schedule_ladder/010-ladder.sqlinc',
            title:
              'a subject blocked by retries_exhausted whose review is still approved is scheduled again (blocked -> scheduled, lifecycle 6): a new pending row beside the blocked evidence row, no event [P2-S12-AC-146]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation/040-supersession.sqlinc',
            title:
              'the previous active version becomes superseded (lifecycle +1, activated_at kept, never retired) in the same transaction and exactly one version of the lineage is active [P2-S12-AC-083]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation/095-retire.sqlinc',
            title:
              'retirement moves the subject active -> retired (lifecycle 4 -> 5, retired_at stamped) with definition version, activated_at and every definition column untouched; the review row differs only in version 3 -> 4 and updated_at [P2-S12-AC-087]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation/040-supersession.sqlinc',
            title:
              'a superseded version cannot be activated again, with its stale or its current review version [P2-S12-AC-085]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation/095-retire.sqlinc',
            title:
              'a retired version can be neither activated nor scheduled again: retired is terminal [P2-S12-AC-083]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_assignment/020-create.sqlinc',
            title:
              'creating an assignment leaves the review version, state and the subject untouched [P2-S12-AC-079]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_assignment.sql',
            title:
              'revoking an assignment that authorized no counted approval leaves the review open at version 1, writes one audit record and stores status 200 [P2-S12-AC-079]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_decision/030-happy.sqlinc',
            title:
              'a further decision on an approved review is refused review_not_open [P2-S12-AC-074]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-198',
    text: "Governed policy basis: the review count and slots are the strictest DEC-110 workflow policy among the content types the subject is bound to (a template or pattern version's `compatibleTypeIds`; for a taxonomy version the content types of the caller's owner scope whose keys appear in `allowedTypeKeys`), each resolved through the fail-closed `cms_editorial_workflow_policy_evidence` seam; the basis is the array of `{ contentTypeId, policyKey, policyVersion, policyHash }` sorted by `(policyKey, policyVersion, contentTypeId)`; `risk_class` is `protected` if any member is protected, `required_decision_count` is the largest member count and `required_capabilities` is the base slot `cms.reviewer` followed by each specialist capability in order of first appearance (at most 16); a subject with no resolvable bound type uses the registry member `editorial.default` version 1 (`CMS_GOVERNED_DEFAULT_POLICY`); and `policy_basis_hash` is the lowercase SHA-256 of the JCS basis array.",
    clauses: [
      {
        text: "Governed policy basis: the review count and slots are the strictest DEC-110 workflow policy among the content types the subject is bound to (a template or pattern version's `compatibleTypeIds`; for a taxonomy version the content types of the caller's owner scope whose keys appear in `allowedTypeKeys`)",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_governed/050-policy-basis.sqlinc',
            title:
              'the three-member ordinary basis hashes as the JCS SHA-256 of the array and stays ordinary, one decision, the base slot only [P2-S12-AC-198]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_governed/050-policy-basis.sqlinc',
            title:
              'the effective risk is protected and the count is the largest member count (2) [P2-S12-AC-198]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_governed/050-policy-basis.sqlinc',
            title:
              'a taxonomy basis holds the resolved policy of each owner-scope type named by allowedTypeKeys and no member for a key naming no owner type, and no default member beside them [P2-S12-AC-198]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_governed/050-policy-basis.sqlinc',
            title:
              'the mixed taxonomy basis resolves protected, two decisions and the policy specialist slot [P2-S12-AC-198]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_pattern/030-submit-gates.sqlinc',
            title:
              'a pattern_version basis holds one editorial member per compatibleTypeIds member, ordered by contentTypeId [P2-S12-AC-198]',
          },
        ],
      },
      {
        text: 'each resolved through the fail-closed `cms_editorial_workflow_policy_evidence` seam',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_submit.sql',
            title:
              'control: the production policy-evidence seam resolves the protected member for the protected version (else the basis fixture is broken) [P2-S12-AC-064]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_submit.sql',
            title:
              'a bound content type whose workflow policy does not resolve is refused 503 DEPENDENCY_UNAVAILABLE [P2-S12-AC-064]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_submit.sql',
            title:
              'the dependency refusal commits no review for the unresolvable subject [P2-S12-AC-064]',
          },
        ],
      },
      {
        text: 'the basis is the array of `{ contentTypeId, policyKey, policyVersion, policyHash }` sorted by `(policyKey,',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_governed/050-policy-basis.sqlinc',
            title:
              'three types sharing the policy key editorial form three basis members ordered by contentTypeId (byte order) [P2-S12-AC-198]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_governed/050-policy-basis.sqlinc',
            title:
              'a four-member basis is sorted by (policyKey, policyVersion, contentTypeId): legal, policy, security, editorial [P2-S12-AC-198]',
          },
        ],
      },
      {
        text: 'policyVersion,',
        citations: [],
      },
      {
        text: 'contentTypeId)`',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_governed/050-policy-basis.sqlinc',
            title:
              'three types sharing the policy key editorial form three basis members ordered by contentTypeId (byte order) [P2-S12-AC-198]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_governed/050-policy-basis.sqlinc',
            title:
              'a four-member basis is sorted by (policyKey, policyVersion, contentTypeId): legal, policy, security, editorial [P2-S12-AC-198]',
          },
        ],
      },
      {
        text: '`risk_class` is `protected` if any member is protected, `required_decision_count` is the largest member count',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_submit.sql',
            title:
              'the strictest-of basis over an ordinary and a protected member yields protected, two decisions, the union of slots and the sorted two-member basis hash [P2-S12-AC-064]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_submit.sql',
            title:
              'the review is open at version 1 and freezes the subject definition hash, the single-member policy basis and the block digest [P2-S12-AC-064]',
          },
        ],
      },
      {
        text: '`required_capabilities` is the base slot `cms.reviewer` followed by each specialist capability in order of first appearance',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_governed/050-policy-basis.sqlinc',
            title:
              'required_capabilities is the base slot then each specialist in order of first appearance across the sorted basis, not the order the types were listed [P2-S12-AC-198]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_governed/050-policy-basis.sqlinc',
            title:
              'the mixed taxonomy basis resolves protected, two decisions and the policy specialist slot [P2-S12-AC-198]',
          },
        ],
      },
      {
        text: '(at most 16)',
        citations: [],
      },
      {
        text: 'a subject with no resolvable bound type uses the registry member `editorial.default` version 1 (`CMS_GOVERNED_DEFAULT_POLICY`)',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition/060-review-successor.sqlinc',
            title:
              'no-bound-type review uses the real seeded default policy basis',
          },
        ],
      },
      {
        text: '`policy_basis_hash` is the lowercase SHA-256 of the JCS basis array.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_submit.sql',
            title:
              'the strictest-of basis over an ordinary and a protected member yields protected, two decisions, the union of slots and the sorted two-member basis hash [P2-S12-AC-064]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_submit.sql',
            title:
              'the frozen policy-basis hash and review content hash equal the server recomputation from the fixture [P2-S12-AC-064]',
          },
        ],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven (uncited clauses): "policyVersion,": BOUNDARY: the policy registry holds only version 1 members (CMS_GOVERNED_DEFAULT_POLICY and the DEC-110 seeds), so the middle sort key cannot be exercised through any producer. "(at most 16)": BOUNDARY (lane gaps-db2): the 16-capability bound cannot be exercised -- the code-owned registry holds four specialist capabilities and only version 1 members, so no honest producer exceeds five slots. The CHECK of 1 to 16 capabilities is cited under AC-251.',
  },
  {
    criterion: 'P2-S12-AC-199',
    text: "Submitting a `template_version` requires the state `draft`, a compatibility-resolver success for the active version of every `compatibleTypeIds` member and a recomputed `blockRegistryDigest` equal to the stored one, and freezes the dependency kinds `block` (each reachable block record) and `content_type` (each compatible content type's active version id) into `cms_governed_review_dependencies`.",
    clauses: [
      {
        text: 'Submitting a `template_version` requires the state `draft`',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_submit/030-hash-refusal.sqlinc',
            title:
              'a non-draft subject with the correct hash stays 409 subject_not_submittable [P2-S12-AC-251]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_submit.sql',
            title:
              'an owner-capability holder submits an existing draft template_version [P2-S12-AC-064]',
          },
        ],
      },
      {
        text: 'a compatibility-resolver success for the active version of every `compatibleTypeIds` member',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_governed/080-template-gates.sqlinc',
            title:
              'a template naming a content type with no active version is refused VALIDATION_FAILED at submit [P2-S12-AC-199]',
          },
        ],
      },
      {
        text: 'a recomputed `blockRegistryDigest` equal to the stored one',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_governed/080-template-gates.sqlinc',
            title:
              'a stored block_registry_digest that differs from the recomputed one refuses the submit subject_not_submittable [P2-S12-AC-199]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_governed/080-template-gates.sqlinc',
            title:
              'control: the same copied draft with the true digest submits, so the refusal above is the digest and nothing in the copy [P2-S12-AC-199]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_governed/080-template-gates.sqlinc',
            title:
              'the review stores the block registry digest recomputed independently from the registered tuple [P2-S12-AC-199]',
          },
        ],
      },
      {
        text: "freezes the dependency kinds `block` (each reachable block record) and `content_type` (each compatible content type's active version id) into `cms_governed_review_dependencies`.",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_submit.sql',
            title:
              'the review freezes its dependency identity, the bound content-type version [P2-S12-AC-249]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_recheck/050-block.sqlinc',
            title:
              'fixture: an approved template review freezes the registered block as a block dependency [P2-S12-AC-202]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-200',
    text: 'Submitting a `pattern_version` requires the state `draft`, every nested pattern `active`, compatible and acyclic, and a recomputed digest equal to the stored one, and freezes the dependency kinds `block`, `pattern` (each nested pattern version) and `content_type`.',
    clauses: [
      {
        text: 'Submitting a `pattern_version` requires the state `draft`, every nested pattern `active`,',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_pattern/030-submit-gates.sqlinc',
            title:
              'a pattern version that is no longer draft is refused subject_not_submittable and nothing is written [P2-S12-AC-200]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_pattern/030-submit-gates.sqlinc',
            title:
              'submitting a pattern whose pinned nested version is no longer active is refused 409 subject_not_submittable (a stored dependency, DEC-180 R5) with no effects [P2-S12-AC-200]',
          },
        ],
      },
      {
        text: 'compatible and acyclic,',
        citations: [],
      },
      {
        text: 'and a recomputed digest equal to the stored one, and freezes the dependency kinds `block`, `pattern` (each nested pattern version) and `content_type`.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_pattern/030-submit-gates.sqlinc',
            title:
              'a stored block_registry_digest that differs from the recomputed one refuses the pattern submit with no effects [P2-S12-AC-200]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_pattern/030-submit-gates.sqlinc',
            title:
              'a pattern nesting an active pattern that uses a registered block freezes exactly one block (registry id), one content_type (active version id) and one pattern (nested version row id) dependency [P2-S12-AC-200]',
          },
        ],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven (uncited clause): "compatible and acyclic,": BOUNDARY (lane gaps-db2): a nested cycle after creation cannot be produced (the lineage is immutable and the cycle guard runs at create time only). Nested compatibility is driven only through the block-compatibility recompute at submit (the gap wave\'s "a pattern naming a content type with no active version is refused VALIDATION_FAILED at /blockTree" and wave 1\'s compat-flow.sql candidate), not through a nested pattern whose compatible type set stopped matching.',
  },
  {
    criterion: 'P2-S12-AC-201',
    text: 'Submitting a `taxonomy_version` requires the state `draft` and a registered provider for every declared canonical domain (else 422 `canonical_source_unavailable` with `details.domain`), and freezes the dependency kinds `content_type` (each content type named by `allowedTypeKeys`) and `canonical_domain` (the provider registry row of each declared domain).',
    clauses: [
      {
        text: 'Submitting a `taxonomy_version` requires the state `draft`',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_governed/060-taxonomy-gates.sqlinc',
            title:
              'a taxonomy version already in review is refused subject_not_submittable [P2-S12-AC-201]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_governed/060-taxonomy-gates.sqlinc',
            title:
              'the refused resubmission writes no review, dependency, audit record or event and leaves the lifecycle counter alone [P2-S12-AC-201]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_governed/060-taxonomy-gates.sqlinc',
            title:
              'the draft-only gate admits the same taxonomy version again once it is draft [P2-S12-AC-201]',
          },
        ],
      },
      {
        text: 'a registered provider for every declared canonical domain (else 422 `canonical_source_unavailable` with `details.domain`)',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title: 'submit-instrument: exact refusal message',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title: 'submit-rights: exact refusal message',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title:
              'instrument: canonical-source refusal identifies its declared domain',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title:
              'rights: canonical-source refusal identifies its declared domain',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title:
              'instrument: canonical refusal leaves the actual created draft intact',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition/060-review-successor.sqlinc',
            title:
              'built declared domain submits through the real governed command',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition/060-review-successor.sqlinc',
            title:
              'no declared domains submits while five registry providers remain unbuilt',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-refusals.test.ts',
            title:
              'CMS-03C-06 SQL refusal transport (tokens of 20261013300820) carries the canonical domain of canonical_source_unavailable (BE03c 1375, DEC-180 G11)',
          },
        ],
      },
      {
        text: 'freezes the dependency kinds `content_type` (each content type named by `allowedTypeKeys`)',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_governed/060-taxonomy-gates.sqlinc',
            title:
              "a taxonomy review freezes one content_type dependency per named owner type (ref_id = the type's active version id) and nothing else [P2-S12-AC-201]",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_governed/060-taxonomy-gates.sqlinc',
            title:
              'a taxonomy naming no owner type freezes no content_type dependency [P2-S12-AC-201]',
          },
        ],
      },
      {
        text: '`canonical_domain` (the provider registry row of each declared domain).',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition/060-review-successor.sqlinc',
            title:
              'built-domain review freezes exactly its real provider registry identity',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-202',
    text: 'Governed review invalidation producers: the consumers of `cms.block.lifecycle.changed.v1` (a withdrawn block), `cms.schema.activated.v1` (a changed bound policy or type version) and `cms.pattern.activated.v1` enqueue the idempotent job `cms.governed_review.recheck` (a typed platform-queue message, DEC-166; capability-grant revocation does not enqueue it and instead invalidates synchronously in the revoking transaction, AC-204, DEC-207), which selects live reviews through `cms_governed_review_dependencies (review_id, kind, ref_id)` of kind `block`, `pattern`, `content_type` or `canonical_domain`.',
    clauses: [
      {
        text: 'Governed review invalidation producers: the consumers of `cms.block.lifecycle.changed.v1` (a withdrawn block), `cms.schema.activated.v1` (a changed bound policy or type version) and `cms.pattern.activated.v1` enqueue the idempotent job `cms.governed_review.recheck` (a typed platform-queue message, DEC-166; capability-grant revocation does not enqueue it and instead invalidates synchronously in the revoking transaction, AC-204, DEC-207), which selects live reviews through `cms_governed_review_dependencies (review_id, kind, ref_id)` of kind `block`, `pattern`, `content_type`',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-recheck/source-consumers.test.ts',
            title:
              '[P2-S12-AC-202] the governed recheck producers are exactly the consumers of the withdrawn-block, schema-activated and pattern-activated events',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-recheck/source-consumers.test.ts',
            title:
              '[P2-S12-AC-202] the governed recheck producers enqueue the typed job for cms.block.lifecycle.changed.v1: its identity is looked up as dependency kind block',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-recheck/source-consumers.test.ts',
            title:
              '[P2-S12-AC-202] the governed recheck producers enqueue the typed job for cms.schema.activated.v1: its identity is looked up as dependency kind content_type',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-recheck/source-consumers.test.ts',
            title:
              '[P2-S12-AC-202] the governed recheck producers enqueue the typed job for cms.pattern.activated.v1: its identity is looked up as dependency kind pattern',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-recheck/source-consumers.test.ts',
            title:
              '[P2-S12-AC-202] the governed recheck producers name one consumer per event type',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-recheck/contract.test.ts',
            title:
              '[P2-S12-AC-202] the typed cms.governed_review.recheck message accepts the governed dependency kind canonical_domain',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-recheck/contract.test.ts',
            title:
              '[P2-S12-AC-202] the typed cms.governed_review.recheck message accepts the governed dependency kind block',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-recheck/contract.test.ts',
            title:
              '[P2-S12-AC-202] the typed cms.governed_review.recheck message accepts the governed dependency kind content_type',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-recheck/contract.test.ts',
            title:
              '[P2-S12-AC-202] the typed cms.governed_review.recheck message accepts the governed dependency kind pattern',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-recheck/contract.test.ts',
            title:
              '[P2-S12-AC-202] the typed cms.governed_review.recheck message rejects a person or capability member',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-recheck/processor.test.ts',
            title:
              '[P2-S12-AC-202] the governed recheck processor hands a source event of another family to the editorial recheck alone',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-recheck/processor.test.ts',
            title:
              '[P2-S12-AC-202] the governed recheck processor retries without touching the editorial recheck when the governed job cannot be enqueued',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_recheck/060-resolver.sqlinc',
            title:
              'a committed cms.block.lifecycle.changed.v1 resolves to the block dependency lookup of its block version [P2-S12-AC-202]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_recheck/060-resolver.sqlinc',
            title:
              'a committed cms.schema.activated.v1 resolves to the content_type dependency lookup of its schema version [P2-S12-AC-202]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_recheck/060-resolver.sqlinc',
            title:
              'an event of another family (a capability revocation) is not a governed source: { found: false } [P2-S12-AC-202]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_recheck_pattern/010-pattern.sqlinc',
            title:
              'a committed cms.pattern.activated.v1 resolves to the pattern dependency lookup of its pattern version [P2-S12-AC-202]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_recheck/050-block.sqlinc',
            title:
              'after the withdrawal the recheck invalidates the review dependency_changed (version + 1, subject back to draft) [P2-S12-AC-202]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_recheck/050-block.sqlinc',
            title:
              'a repeated run finds no live review: the invalidated review is skipped [P2-S12-AC-202]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_recheck/040-recheck.sqlinc',
            title:
              'a repeated run, a run naming the superseded version of the lineage and a duplicate continuation all find no live review: already invalidated reviews are skipped [P2-S12-AC-203]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_recheck_pattern/010-pattern.sqlinc',
            title:
              "a recheck of kind pattern over the successor's identity reaches the nested review through the pattern lineage and invalidates it dependency_changed [P2-S12-AC-203]",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_recheck/020-contract.sqlinc',
            title:
              'a request outside { eventId, kind in block|pattern|content_type|canonical_domain, refId, cursor, batch 1..500 } is INVALID_REQUEST, a run never exceeds 500 reviews [P2-S12-AC-203]',
          },
        ],
      },
      {
        text: '`canonical_domain`.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_governed/070-canonical-recheck.sqlinc',
            title:
              'fixture: tc1 is approved with a frozen canonical_domain dependency on the current role registry row, tc2 has none [P2-S12-AC-202]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_governed/070-canonical-recheck.sqlinc',
            title:
              'while the role registry row is current the canonical_domain recheck examines the one review through its dependency and leaves it approved [P2-S12-AC-202]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_governed/070-canonical-recheck.sqlinc',
            title:
              'after the provider registry row changes the canonical_domain recheck invalidates exactly the one review dependency_changed [P2-S12-AC-202]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_governed/070-canonical-recheck.sqlinc',
            title:
              'the invalidated review is at version 3 with its subject back to draft and the review that declared no domain is untouched [P2-S12-AC-202]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_governed/070-canonical-recheck.sqlinc',
            title:
              'a repeated run finds no live review: the invalidated review is skipped [P2-S12-AC-202]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-203',
    text: 'Governed review recheck: the job `cms.governed_review.recheck` (`cms_recheck_governed_reviews(p_request jsonb)`, request `{ eventId, kind, refId, cursor, batch? }`) handles at most 500 reviews per run with a continuation cursor, is idempotent (an already `invalidated` review is skipped), rebuilds the hash, policy basis and identities of each live review and invalidates on any difference with the closed reason `dependency_changed` or `reviewer_authority_changed`, returning the subject to `draft` and, while the subject is `scheduled`, cancelling its schedule (`cancelled`, `approval_invalidated`) in the invalidating transaction; governed review state changes emit no event in Phase 2.',
    clauses: [
      {
        text: 'Governed review recheck: the job `cms.governed_review.recheck` (`cms_recheck_governed_reviews(p_request jsonb)`, request `{ eventId, kind, refId, cursor, batch? }`) handles at most 500 reviews per run with a continuation cursor, is idempotent (an already `invalidated` review is skipped), rebuilds the hash, policy basis and identities of each live review and invalidates on any difference with the closed reason `dependency_changed` or `reviewer_authority_changed`, returning the subject to `draft` and, while the subject is `scheduled`, cancelling its schedule (`cancelled`, `approval_invalidated`) in the invalidating transaction; governed review state changes emit no event in Phase 2.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_recheck/020-contract.sqlinc',
            title:
              'the recheck job has a named platform API RPC cms_recheck_governed_reviews(request) (BE03c "Internal RPCs": the closed RPC list) [P2-S12-AC-203]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_recheck/020-contract.sqlinc',
            title:
              'a request outside { eventId, kind in block|pattern|content_type|canonical_domain, refId, cursor, batch 1..500 } is INVALID_REQUEST, a run never exceeds 500 reviews [P2-S12-AC-203]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_recheck/040-recheck.sqlinc',
            title:
              'a run of batch 3 handles the three lowest review ids, invalidates all three and returns the id of the last one as the continuation cursor [P2-S12-AC-203]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_recheck/040-recheck.sqlinc',
            title:
              'the continuation from the cursor handles the next three reviews, and returns the next cursor [P2-S12-AC-203]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_recheck/040-recheck.sqlinc',
            title:
              'the last run examines the one remaining review and returns no cursor: a cursor is returned only while a further live review remains [P2-S12-AC-203]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_recheck/040-recheck.sqlinc',
            title:
              'a repeated run, a run naming the superseded version of the lineage and a duplicate continuation all find no live review: already invalidated reviews are skipped [P2-S12-AC-203]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_recheck/040-recheck.sqlinc',
            title:
              'the replays wrote no second audit record, emitted no event and did not touch the invalidated reviews again [P2-S12-AC-203]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_recheck/040-recheck.sqlinc',
            title:
              'the recheck rebuilds the live approvals of each approved review and invalidates the one that fell short [P2-S12-AC-203]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_recheck/040-recheck.sqlinc',
            title:
              'dlag is invalidated reviewer_authority_changed (version + 1, subject back to draft) and no other review changes [P2-S12-AC-203]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_recheck/040-recheck.sqlinc',
            title:
              'all seven live reviews are invalidated dependency_changed: version + 1, decidedAt cleared, each subject back to draft one lifecycle step later (open reviews included) [P2-S12-AC-203]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_recheck/040-recheck.sqlinc',
            title:
              'the schedule of the scheduled subject is cancelled (cancelled, approval_invalidated) in the invalidating transaction and the subject is back to draft [P2-S12-AC-203]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_recheck/040-recheck.sqlinc',
            title:
              'a review not bound to the changed type (dctl) is untouched and the already-invalidated dlag is skipped, not touched again [P2-S12-AC-203]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_recheck/040-recheck.sqlinc',
            title:
              'the three runs emitted no event: governed review state changes emit none in Phase 2 [P2-S12-AC-203]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_recheck/040-recheck.sqlinc',
            title:
              'a recheck over the current typeA version examines its eight live reviews and invalidates none: every one still holds [P2-S12-AC-203]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_recheck/050-block.sqlinc',
            title:
              'after the withdrawal the recheck invalidates the review dependency_changed (version + 1, subject back to draft) [P2-S12-AC-202]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-recheck/contract.test.ts',
            title:
              '[P2-S12-AC-203] the run request and result rejects more than 500 examined',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-recheck/contract.test.ts',
            title:
              '[P2-S12-AC-203] the run request and result accepts a consistent result and a continuation only after a full run',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-recheck/job.test.ts',
            title:
              '[P2-S12-AC-203] the cms.governed_review.recheck job continues from the cursor the previous run handed back',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-recheck/job.test.ts',
            title:
              '[P2-S12-AC-203] the cms.governed_review.recheck job enqueues the continuation message with the new cursor before it acknowledges',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-recheck/job.test.ts',
            title:
              '[P2-S12-AC-203] the cms.governed_review.recheck job runs { eventId, kind, refId } from the start with a null cursor and acknowledges a finished walk',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-204',
    text: "Reviewer authority invalidation: the closed reason `reviewer_authority_changed` is produced, under the 03b Review invalidation rules applied unchanged, when a counted approver's standing capability is revoked (the revoking transaction calls `cms_invalidate_governed_reviews_for_person(person_id, capability)`, a definer function not scoped to the revoker's party that invalidates, in that transaction, every `open` or `approved` review the person counted on under that capability, with the subject returning to `draft`) and when a counted approver's assignment is revoked while the review is `open`.",
    clauses: [
      {
        text: "Reviewer authority invalidation: the closed reason `reviewer_authority_changed` is produced, under the 03b Review invalidation rules applied unchanged, when a counted approver's standing capability is revoked (the revoking transaction calls `cms_invalidate_governed_reviews_for_person(person_id, capability)`, a definer function not scoped to the revoker's party that invalidates, in that transaction, every `open` or `approved` review the person counted on under that capability, with the subject returning to `draft`) and when a counted approver's assignment is revoked while the review is `open`.",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_recheck/020-contract.sqlinc',
            title:
              'cms_invalidate_governed_reviews_for_person(person_id, capability) exists (BE03c "Reviewer-authority invalidation on revocation" G6) [P2-S12-AC-204]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_recheck/030-person.sqlinc',
            title:
              'an AFTER UPDATE OR DELETE row trigger on the actor-grant projection (the table the CMS-03A-17 revocation writes) runs the person invalidation in the revoking transaction [P2-S12-AC-204]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_recheck/030-person.sqlinc',
            title:
              'in the revoking transaction both approved reviews x01 counted on are invalidated reviewer_authority_changed (version + 1), decidedAt cleared, each subject back to draft [P2-S12-AC-204]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_recheck/030-person.sqlinc',
            title:
              'an OPEN review in which the person counted is invalidated too, the recorded decision rows are untouched [P2-S12-AC-204]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_recheck/030-person.sqlinc',
            title:
              'the protected review whose specialist slot x04 satisfied under the revoked capability is invalidated reviewer_authority_changed [P2-S12-AC-204]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_recheck/030-person.sqlinc',
            title:
              'a capability under which the person counted nothing invalidates nothing [P2-S12-AC-204]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_recheck/030-person.sqlinc',
            title:
              'reviews x01 never counted on (other approvers, an open review of another reviewer, the dependency group) are untouched [P2-S12-AC-204]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_recheck/030-person.sqlinc',
            title:
              'called from a stranger acting party, the definer function still reaches the owner party review whose counted approver lost the capability [P2-S12-AC-204]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_recheck/030-person.sqlinc',
            title:
              'the pending schedule of the scheduled subject is cancelled (cancelled, approval_invalidated, version 2) in the same transaction [P2-S12-AC-204]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_recheck/030-person.sqlinc',
            title:
              'one invalidation audit record per review and one schedule cancellation audit record are written [P2-S12-AC-204]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_recheck/030-person.sqlinc',
            title:
              'a governed review state change emits no event (BE03c "Invalidation": CMS-03C-11 is the canonical queue) [P2-S12-AC-204]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_assignment.sql',
            title:
              'the same transaction invalidates the review reviewer_authority_changed at version 3, returns the subject to draft (lifecycle 3, definition version 1) and writes its own audit record [P2-S12-AC-078]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-205',
    text: "Immediate activation: `activate` requires the subject `approved` or `blocked` (else 409 `subject_not_activatable`) and in one transaction makes it `active` (`version` + 1, `activated_at`), makes the lineage's previous `active` version `superseded` (`version` + 1), records `activated_at` on the review and advances its `version`, and commits the audit record and exactly one activation event; an activation that loses a race on the lineage is 409 `activation_conflict` and nothing commits.",
    clauses: [
      {
        text: "Immediate activation: `activate` requires the subject `approved` or `blocked` (else 409 `subject_not_activatable`) and in one transaction makes it `active` (`version` + 1, `activated_at`), makes the lineage's previous `active` version `superseded` (`version` + 1), records `activated_at` on the review and advances its `version`, and commits the audit record and exactly one activation event",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation/030-activate.sqlinc',
            title:
              'activation moves the subject approved -> active (lifecycle 3 -> 4, definition version 1) and records activated_at on the review whose version advances to 3 [P2-S12-AC-082]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation/040-supersession.sqlinc',
            title:
              'the previous active version becomes superseded (lifecycle +1, activated_at kept, never retired) in the same transaction and exactly one version of the lineage is active [P2-S12-AC-083]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation/040-supersession.sqlinc',
            title:
              'the supersession emits nothing: the whole command added exactly one event (the new version at its lifecycle counter) and one audit record [P2-S12-AC-083]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation/030-activate.sqlinc',
            title:
              'a second activation or schedule of an already active subject, with the current review version, is 409 subject_not_activatable [P2-S12-AC-085]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation/020-gates.sqlinc',
            title:
              'a review that is still open (the subject in review) cannot be activated or scheduled: 409 subject_not_activatable [P2-S12-AC-085]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation/040-supersession.sqlinc',
            title:
              'a superseded version cannot be activated again, with its stale or its current review version [P2-S12-AC-085]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_schedule/030-execute.sqlinc',
            title:
              'a blocked subject whose review is still approved and current activates through a new CMS-03C-09 command (lifecycle 6, one event); the blocked schedule row is evidence and stays [P2-S12-AC-146]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation/050-schedule-accept.sqlinc',
            title:
              'a second live schedule of the subject is 409 schedule_exists; an immediate activation of a scheduled subject is 409 subject_not_activatable [P2-S12-AC-143]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation/095-retire.sqlinc',
            title:
              'a retired version can be neither activated nor scheduled again: retired is terminal [P2-S12-AC-083]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation/060-invalidation.sqlinc',
            title:
              'the committed refusal replays identically, and a later activation of the invalidated review is subject_not_activatable [P2-S12-AC-086]',
          },
        ],
      },
      {
        text: 'an activation that loses a race on the lineage is 409 `activation_conflict` and nothing commits.',
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven (uncited clauses): "an activation that loses a race on the lineage is 409 `activation_conflict` and nothing commits.": missing test: a two-session race schedule (supabase/tests/phase_02_slice_12_governed_authority.race.mjs, new schedule beside the CMS-03C-06 ones, using the same kit) in which two activators of one lineage run concurrently and the loser is refused 409 activation_conflict with every covered store (subject, review, superseded row, audit, outbox, idempotency) byte-identical to before it; 090-lineage-lock.sqlinc states the lost-race branch is unreachable in a single pgTAP session and only the lock and the Worker token mapping are proven; spec BE03c "an activation that loses a race on the lineage is 409 activation_conflict and nothing commits"',
  },
  {
    criterion: 'P2-S12-AC-206',
    text: 'Scheduled activation acceptance: `schedule` resolves `activateAt` through the 03b Time authority (E8: pinned tz database, DST rules, 60 s to 366 d horizon), runs the same kind-specific preflight, makes the subject `scheduled`, inserts one `pending` row in `cms_governed_activation_schedules` (a second live schedule for the subject is 409 `schedule_exists`), answers 202 and emits no event.',
    clauses: [
      {
        text: 'Scheduled activation acceptance: `schedule` resolves `activateAt` through the 03b Time authority (E8: pinned tz database, DST rules, 60 s to 366 d horizon), runs the same kind-specific preflight, makes the subject `scheduled`, inserts one `pending` row in `cms_governed_activation_schedules` (a second live schedule for the subject is 409 `schedule_exists`), answers 202 and emits no event.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation/050-schedule-accept.sqlinc',
            title:
              'the pinned tzdb, the local/UTC offset window (-12 h .. +14 h), the 60 s .. 366 d horizon and the activator grant day are enforced with the 03b time tokens [P2-S12-AC-144]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation/050-schedule-accept.sqlinc',
            title:
              'tzdb_version_mismatch names the pinned version; schedule_out_of_horizon names the minUtc and maxUtc of the horizon [P2-S12-AC-144]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation/050-schedule-accept.sqlinc',
            title:
              'scheduling moves the subject approved -> scheduled (lifecycle 3 -> 4), emits NO event, writes one audit record and stores status 202 [P2-S12-AC-142]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation/050-schedule-accept.sqlinc',
            title:
              'exactly one pending schedule (version 1) exists with the approved review version, the time evidence as submitted, the creator and no lease [P2-S12-AC-142]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation/050-schedule-accept.sqlinc',
            title:
              'a second live schedule of the subject is 409 schedule_exists; an immediate activation of a scheduled subject is 409 subject_not_activatable [P2-S12-AC-143]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation/050-schedule-accept.sqlinc',
            title:
              'every time-rule and authority refusal commits nothing: no schedule, no state change, no event, no reservation [P2-S12-AC-144]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation/050-schedule-accept.sqlinc',
            title:
              'a local time 15 h after (13 h before) the resolved UTC is resolved_utc_mismatch whose DETAIL expectedUtc is the nearest instant inside the -12 h .. +14 h window [P2-S12-AC-144]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation/060-invalidation.sqlinc',
            title:
              'a changed frozen dependency commits the invalidation and answers the dependency_changed refusal envelope for activate and for schedule [P2-S12-AC-084]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-activation-time.test.ts',
            title:
              'CMS-03C-09 schedule: the Worker Time authority (BE03b E8, BE03c 1326 step 6) refuses a local time inside the spring-forward gap with 422 and the typed time refusal before any RPC',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-activation-time.test.ts',
            title:
              'CMS-03C-09 schedule: the Worker Time authority (BE03b E8, BE03c 1326 step 6) refuses a repeated local time without a disambiguation with 422 and the typed time refusal before any RPC',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-activation-time.test.ts',
            title:
              'CMS-03C-09 schedule: the Worker Time authority (BE03b E8, BE03c 1326 step 6) accepts the earlier and the later instant of a repeated local time when named',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-activation-time.test.ts',
            title:
              'CMS-03C-09 schedule: the Worker Time authority (BE03b E8, BE03c 1326 step 6) refuses an instant beyond 366 days with 422 and the typed time refusal before any RPC',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-activation-time.test.ts',
            title:
              'CMS-03C-09 schedule: the Worker Time authority (BE03b E8, BE03c 1326 step 6) refuses an instant under the 60 second lead with 422 and the typed time refusal before any RPC',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-activation-time.test.ts',
            title:
              'CMS-03C-09 schedule: the Worker Time authority (BE03b E8, BE03c 1326 step 6) refuses another tz database version with 422 and the typed time refusal before any RPC',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-activation-time.test.ts',
            title:
              'CMS-03C-09 schedule: the Worker Time authority (BE03b E8, BE03c 1326 step 6) never consults the authority for an activation or a retirement',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-activation.test.ts',
            title:
              'CMS-03C-09 schedule (202, no event) answers 202 with the unchanged review version as ETag and the review Location',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-207',
    text: "Retirement: `retire` requires the subject `active` (else 409 `subject_not_retirable`) and needs no new approval or review decision and no dependency, policy, provider or preflight validity (DEC-190) while keeping the `reviewId` addressing, the review-`version` `If-Match`, the unconditional recent MFA and the subject kind's owner capability, makes it `retired`, emits the same event type naming the retired version, and a retired version fails the 03b `template` preflight and the 03a compatibility resolver as `WITHDRAWN`.",
    clauses: [
      {
        text: "Retirement: `retire` requires the subject `active` (else 409 `subject_not_retirable`) and needs no new approval or review decision and no dependency, policy, provider or preflight validity (DEC-190) while keeping the `reviewId` addressing, the review-`version` `If-Match`, the unconditional recent MFA and the subject kind's owner capability, makes it `retired`, emits the same event type naming the retired version, and",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation/020-gates.sqlinc',
            title:
              'retire of an approved or in-review subject is 409 subject_not_retirable, with or without a reason [P2-S12-AC-087]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation/095-retire.sqlinc',
            title:
              'a scheduled, draft (invalidated review), superseded or approved subject is 409 subject_not_retirable: retirement is for an active version only [P2-S12-AC-087]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation/095-retire.sqlinc',
            title:
              'the owner retires an active version whose frozen dependency evidence is stale: no fresh approval, dependency, policy, provider or preflight validity is required [P2-S12-AC-087]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation/095-retire.sqlinc',
            title:
              'the same loss of authority does not stop RETIRING the active gq1: retirement needs no live approval and no fresh decision [P2-S12-AC-087]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation/095-retire.sqlinc',
            title:
              'the same unavailable policy evidence does not stop a retirement: retire consults no workflow policy [P2-S12-AC-087]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation/095-retire.sqlinc',
            title:
              'a protected two-approval review retires without a reason and without a further decision: review version advances 4 -> 5, one event, one audit record [P2-S12-AC-087]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation/095-retire.sqlinc',
            title:
              'retirement moves the subject active -> retired (lifecycle 4 -> 5, retired_at stamped) with definition version, activated_at and every definition column untouched; the review row differs only in version 3 -> 4 and updated_at [P2-S12-AC-087]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation/095-retire.sqlinc',
            title:
              'exactly one more cms.template.activated.v1 commits (aggregate = the retired subject row at lifecycle counter 5, payload { templateId, templateVersionId }) with one retirement audit record [P2-S12-AC-087]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation/095-retire.sqlinc',
            title:
              'retiring a taxonomy version answers the taxonomy event type, its lineage id and the advanced review version 4 [P2-S12-AC-087]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation/095-retire.sqlinc',
            title:
              'a second retirement with the pre-retirement review version is VERSION_MISMATCH (current 4): the retirement advanced the review version, so a client holding the old ETag is refused before the state check and nothing is reserved [P2-S12-AC-087]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation.sql',
            title:
              'a retire reason of 1 and of 256 code points (256 two-byte characters included) passes the structure step, 257 code points is VALIDATION_FAILED at /reason, an activateAt is INVALID_REQUEST and the step-up comes first [P2-S12-AC-083]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation.sql',
            title:
              'retire keeps every control: a missing, stale or future step-up is STEP_UP_REQUIRED, a cross-owner caller meets the concealed NOT_FOUND, an assigned reviewer without the owner capability is 403 capability_missing, a stale or future review version is VERSION_MISMATCH, an empty, 257-character, non-string or non-NFC reason is VALIDATION_FAILED at /reason and an activateAt is INVALID_REQUEST [P2-S12-AC-083]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation/095-retire.sqlinc',
            title:
              'every retire refusal on the active ga1 leaves the subject, review, idempotency, audit and outbox stores identical [P2-S12-AC-086]',
          },
        ],
      },
      {
        text: 'a retired version fails the 03b `template` preflight and the 03a compatibility resolver as `WITHDRAWN`.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_09_dec108_resolver.sql',
            title:
              'a withdrawn template definition is the typed failure WITHDRAWN [P2-S09-AC-705]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_preflight.sql',
            title:
              'a template that is no longer active fails template_not_active (before any compatibility or digest reason) [P2-S11-AC-095]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-208',
    text: 'Activating or scheduling a `template_version` runs the compatibility resolver for every `compatibleTypeIds` member and recomputes the block digest before the switch.',
    clauses: [
      {
        text: 'Activating or scheduling a `template_version` runs the compatibility resolver for every `compatibleTypeIds` member',
        citations: [],
      },
      {
        text: 'and recomputes the block digest before the switch.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_governed/090-template-activation-recheck.sqlinc',
            title:
              'activation after the reachable block changed answers the committed refusal dependency_changed [P2-S12-AC-208] [P2-S12-AC-193]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_governed/090-template-activation-recheck.sqlinc',
            title:
              'scheduling after the reachable block changed answers the committed refusal dependency_changed [P2-S12-AC-208] [P2-S12-AC-193]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_governed/090-template-activation-recheck.sqlinc',
            title:
              'the activation refusal invalidated the review (dependency_changed, version + 1), returned the subject to draft and emitted no event [P2-S12-AC-208]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_governed/090-template-activation-recheck.sqlinc',
            title:
              'the schedule refusal invalidated the review, returned the subject to draft and inserted no schedule row [P2-S12-AC-208]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_governed/090-template-activation-recheck.sqlinc',
            title:
              'control: the template over the still-supported block activates, so the refusals above are the changed block [P2-S12-AC-208]',
          },
        ],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven (uncited clause): "Activating or scheduling a `template_version` runs the compatibility resolver for every `compatibleTypeIds` member": BOUNDARY (lane gaps-db2): the compatibility-resolver conjunct -- a bound type whose compiler falls outside the block range after approval -- is not constructible at activation by honest producers (registry rows and type compiler versions are immutable); a wave-1 candidate (governed_fix3 compat-flow.sql) exercises the pattern recompute at submit, not template activation or scheduling.',
  },
  {
    criterion: 'P2-S12-AC-209',
    text: 'Activating or scheduling a `pattern_version` checks the state of every nested pattern and recomputes the block digest before the switch.',
    clauses: [
      {
        text: 'Activating or scheduling a `pattern_version` checks the state of every nested pattern and recomputes the block digest before the switch.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_pattern/040-activation-recheck.sqlinc',
            title:
              'activating a pattern whose pinned nested pattern is no longer active answers the committed refusal dependency_changed, invalidates the review and returns the pattern to draft [P2-S12-AC-209]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_pattern/040-activation-recheck.sqlinc',
            title:
              'scheduling a pattern whose pinned nested pattern is no longer active answers dependency_changed, invalidates the review and inserts no schedule [P2-S12-AC-209]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_pattern/040-activation-recheck.sqlinc',
            title:
              'the refused pattern activations emitted no event [P2-S12-AC-209]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_pattern/040-activation-recheck.sqlinc',
            title:
              'after a reachable block is deprecated, activating an approved pattern_version answers dependency_changed and invalidates the review [P2-S12-AC-193]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_pattern/040-activation-recheck.sqlinc',
            title:
              'after a reachable block is deprecated, scheduling an approved pattern_version answers dependency_changed and invalidates the review [P2-S12-AC-193]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_pattern/040-activation-recheck.sqlinc',
            title:
              'all four refusals are the identical committed refusal body (activate and schedule, nested state and block digest) [P2-S12-AC-209]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-210',
    text: 'Activating or scheduling a `taxonomy_version` requires a registered provider for every declared canonical domain, else 422 `canonical_source_unavailable` with `details.domain`.',
    clauses: [
      {
        text: 'Activating or scheduling a `taxonomy_version` requires a registered provider for every declared canonical domain, else 422 `canonical_source_unavailable` with `details.domain`.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db4_taxonomy_activation.sql',
            title:
              'scheduling an approved taxonomy version whose declared role domain has lost its provider is refused canonical_source_unavailable with details.domain = role [P2-S12-AC-210]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db4_taxonomy_activation.sql',
            title:
              'a vocabulary that declares no canonical domain activates while role is unbuilt: only the declared domains are checked [P2-S12-AC-210]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db4_taxonomy_activation.sql',
            title:
              'activating a vocabulary that declares role and instrument is refused canonical_source_unavailable naming instrument, the unbuilt one, although role is built [P2-S12-AC-210]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db4_taxonomy_activation.sql',
            title:
              'scheduling a vocabulary that declares role and instrument is refused canonical_source_unavailable naming instrument, the unbuilt one, although role is built [P2-S12-AC-210]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db4_taxonomy_activation.sql',
            title:
              'activating an approved taxonomy version whose declared role domain has lost its provider is refused canonical_source_unavailable with details.domain = role [P2-S12-AC-223]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-refusals.test.ts',
            title:
              "'CMS-03C-09' SQL refusal transport maps canonical_source_unavailable {domain}",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-activation-refusals.test.ts',
            title:
              'CMS-03C-09 SQL refusals are mapped by token, whatever the action schedule maps canonical_source_unavailable {domain}',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-211',
    text: "Pattern graph: a pattern tree is a bounded forest of depth at most 8 and at most 512 nodes after expanding nested pattern references, with unique sibling node `key`s, no cycle through a nested lineage (the visited set is the lineage `pattern_id`) and every nested pattern `active` and listing every `compatibleTypeIds` member of the new pattern; a violation is typed (422 `pattern_depth_exceeded`, `pattern_nodes_exceeded` and `nested_pattern_not_active`; 409 `pattern_cycle`), is refused before save and again before publish, and `node_count` stores the expanded count. For entry publication, the live nested-pin active/compatibility recheck is the pattern provider's `nested_pattern_not_active` failed reason (DEC-199), not a new transport status; nonnull canonical detached snapshots do not reopen provenance pins. Every block node of an expanded tree also satisfies its pinned block version's `allowedChildren` and `slotRules` (DEC-210): a violation at CMS-03C-12 save, CMS-03C-02 placement or CMS-03C-15 accept or detach is 422 `COMPOSITION_VALIDATION_FAILED` with `details.reasonCode` `block_rules_violated` and nothing written, and at publication the pattern provider fails `pattern_block_rules_violated`.",
    clauses: [
      {
        text: 'Pattern graph: a pattern tree is a bounded forest of depth at most 8 and at most 512 nodes after expanding nested pattern references, with unique sibling node `key`s, no cycle through a nested lineage (the visited set is the lineage `pattern_id`) and every nested pattern `active` and listing every `compatibleTypeIds` member of the new pattern; a violation is typed (422 `pattern_depth_exceeded`, `pattern_nodes_exceeded` and `nested_pattern_not_active`; 409 `pattern_cycle`), is refused before save',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition/040-graph.sqlinc',
            title: 'depth-8 chain stores all eight nodes [P2-S12-AC-211]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title: 'depth-nine: exact SQL message token [P2-S12-AC-104]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition/040-graph.sqlinc',
            title: 'node count stores the exact maximum [P2-S12-AC-211]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title: 'nodes-513: exact SQL message token [P2-S12-AC-104]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition/050-nested.sqlinc',
            title:
              'one reference expands to sixteen block nodes [P2-S12-AC-211]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition/050-nested.sqlinc',
            title:
              '32 references times 16 blocks store 512 expanded nodes [P2-S12-AC-211]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title: 'expanded-513: exact SQL message token [P2-S12-AC-104]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title: 'duplicate-sibling: exact SQL message token [P2-S12-AC-104]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title: 'nested-draft: exact SQL message token [P2-S12-AC-104]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title:
              'nested-incompatible: exact SQL message token [P2-S12-AC-104]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title:
              'self-lineage-cycle: exact SQL message token [P2-S12-AC-104]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title:
              'indirect-lineage-cycle: exact SQL message token [P2-S12-AC-104]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition/050-nested.sqlinc',
            title:
              '32 references on distinct paths may share one lineage without a cycle [P2-S12-AC-211]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-production.test.ts',
            title:
              'CMS-03C-12 typed SQL refusal transport (synthetic replies) projects only the known pattern_depth_exceeded reason',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-production.test.ts',
            title:
              'CMS-03C-12 typed SQL refusal transport (synthetic replies) projects only the known pattern_nodes_exceeded reason',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-production.test.ts',
            title:
              'CMS-03C-12 typed SQL refusal transport (synthetic replies) projects only the known nested_pattern_not_active reason',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-production.test.ts',
            title:
              'CMS-03C-12 typed SQL refusal transport (synthetic replies) projects only the known pattern_cycle reason',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement/065-defensive.sqlinc',
            title:
              'a nested reference to a lineage already on the chain is refused pattern_cycle at /patternId (409) [BE03c 1612]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement/065-defensive.sqlinc',
            title:
              'a forest of 513 block roots is refused pattern_nodes_exceeded at /patternId (422) [BE03c 1612, DEC-175]',
          },
        ],
      },
      {
        text: 'again before publish',
        citations: [],
      },
      {
        text: '`node_count` stores the expanded count.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition/040-graph.sqlinc',
            title: 'node count stores the exact maximum [P2-S12-AC-211]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition/050-nested.sqlinc',
            title:
              'one reference expands to sixteen block nodes [P2-S12-AC-211]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition/050-nested.sqlinc',
            title:
              '32 references times 16 blocks store 512 expanded nodes [P2-S12-AC-211]',
          },
        ],
      },
      {
        text: "For entry publication, the live nested-pin active/compatibility recheck is the pattern provider's `nested_pattern_not_active` failed reason (DEC-199), not a new transport status;",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_pattern_currentness.sql',
            title:
              'PC-N03-live-publish: exact actual pattern provider outcome/reason/single-offender count',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_pattern_currentness.sql',
            title:
              'PC-N03-live-submit: exact actual pattern provider outcome/reason/single-offender count',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_pattern_currentness.sql',
            title:
              'PC-N05-transitive: exact actual pattern provider outcome/reason/single-offender count',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_pattern_currentness.sql',
            title:
              'PC-N06-mixed-same-pin: exact actual pattern provider outcome/reason/single-offender count',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_api5_pattern_compat.sql',
            title:
              'A238-direct-publish [P2-S12-AC-238]: exact actual pattern provider outcome/reason/single-offender count',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_api5_pattern_compat.sql',
            title:
              'A238-recursive-publish [P2-S12-AC-238]: exact actual pattern provider outcome/reason/single-offender count',
          },
        ],
      },
      {
        text: 'nonnull canonical detached snapshots do not reopen provenance pins.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_pattern_currentness.sql',
            title:
              'PC-P01-publish: exact actual pattern provider outcome/reason/single-offender count',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_pattern_currentness.sql',
            title:
              'PC-P04-retired: exact actual pattern provider outcome/reason/single-offender count',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_pattern_currentness.sql',
            title:
              'PC-P05-target-snapshot: exact actual pattern provider outcome/reason/single-offender count',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_pattern_currentness.sql',
            title:
              'PC-N08-canonical-target: exact actual pattern provider outcome/reason/single-offender count',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_pattern_currentness.sql',
            title:
              'PC-N09-retired-provenance: exact actual pattern provider outcome/reason/single-offender count',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_pattern_currentness.sql',
            title:
              'PC-N07-only-provenance: exact actual pattern provider outcome/reason/single-offender count',
          },
        ],
      },
      {
        text: "Every block node of an expanded tree also satisfies its pinned block version's `allowedChildren` and `slotRules` (DEC-210): a violation at CMS-03C-12 save, CMS-03C-02 placement or CMS-03C-15 accept or detach is 422 `COMPOSITION_VALIDATION_FAILED` with `details.reasonCode` `block_rules_violated` and nothing written, and at publication the pattern provider fails `pattern_block_rules_violated`.",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_block_rules.sql',
            title: 'S05: exact SQL message token [P2-S12-AC-104]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_block_rules.sql',
            title: "S07: DETAIL is the offending node's request pointer",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_block_rules.sql',
            title: "S08: DETAIL is the offending node's request pointer",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_block_rules/020-save.sqlinc',
            title: 'S14: no refused save left a pattern version row',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_block_rules_legacy.sql',
            title: 'P01: exact SQL message token block_rules_violated',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_block_rules_legacy.sql',
            title: 'P03: exact SQL message token block_rules_violated',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_block_rules_legacy.sql',
            title:
              'P01: the refusal preserves every captured full row of every store',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_block_rules_legacy.sql',
            title: 'U01: exact SQL message token block_rules_violated',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_block_rules_legacy.sql',
            title: 'U02: exact SQL message token block_rules_violated',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_block_rules_legacy.sql',
            title:
              'U02: the refusal preserves every captured full row of every store',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_block_rules/070-provider.sqlinc',
            title:
              'BR-V05: the provider function itself answers failed with exactly one unit for the offending pin',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-production.test.ts',
            title:
              'CMS-03C-12 DEC-210 block_rules_violated transport (synthetic replies) names itself and relays the offending node pointer /blockTree/0 as a bounded violation',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-pattern-reasons.test.ts',
            title:
              'CMS-03C-02 production adapter Slice 12 reason tokens DEC-210 maps block_rules_violated to the typed 422 naming itself and its /roots pointer',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-pattern-update-failure.test.ts',
            title:
              'CMS-03C-15 specifics DEC-210 block_rules_violated (accept) is a 422 naming itself and relaying only its operation pointer /instances/0/choices',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-pattern-update-failure.test.ts',
            title:
              'CMS-03C-15 specifics DEC-210 block_rules_violated (detach) is a 422 naming itself and relaying only its operation pointer /instances/0',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_block_rules.sql',
            title: 'N04: exact SQL message token [P2-S12-AC-104]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_block_rules.sql',
            title: 'N05: exact SQL message token [P2-S12-AC-104]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_block_rules_legacy.sql',
            title:
              'U01: the refusal preserves every captured full row of every store',
          },
        ],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven (uncited clauses): "again before publish": missing tests for "and again before publish": (1) the publication path (pattern provider / CMS-03C-02 placement as used by 03b publication) re-validating the depth-8 / 512-node bounds and the lineage cycle rule on the stored forest: add a pgTAP case in supabase/tests/phase_02_slice_12_dec193_pattern_currentness/020-active-digest-provider.sqlinc (or pattern_placement/) that places/publishes a hand-built over-bound or cyclic stored forest (a legacy row, as the PC-N04 case builds one) and asserts the provider/placement refuses it with pattern_depth_exceeded / pattern_nodes_exceeded / pattern_cycle; only nested_pattern_not_active (clause 1) is re-checked at publication in the tests today; (2) a placement-side (CMS-03C-02) cycle/depth refusal case beside the existing expanded-bound ones',
  },
  {
    criterion: 'P2-S12-AC-212',
    text: 'Linked-update scan: when a pattern version is activated, the idempotent consumer job `cms.pattern.linked_update_scan` (a typed platform-queue message with payload `{ patternId, patternVersionId }`, DEC-166) appends a `pending_diff` row, pinned to the unchanged version and carrying `pending_pattern_version`, for each `linked` instance on a draft revision whose pinned version is older and whose entry type is compatible with the new version, and leaves instances on reviewed or published revisions on their pin as history.',
    clauses: [
      {
        text: 'Linked-update scan: when a pattern version is activated, the idempotent consumer job `cms.pattern.linked_update_scan` (a typed platform-queue message with payload `{ patternId, patternVersionId }`, DEC-166) appends a `pending_diff` row, pinned to the unchanged version and carrying `pending_pattern_version`, for each `linked` instance on a draft revision whose pinned version is older and whose entry type is compatible with the new version, and leaves instances on reviewed or published revisions on their pin as history.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/linked-scan/source-consumer.test.ts',
            title:
              '[P2-S12-AC-212] the producer of the linked-update scan rereads the committed event and enqueues the typed job with { patternId, patternVersionId } and a null cursor',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/linked-scan/source-consumer.test.ts',
            title:
              '[P2-S12-AC-212] the producer of the linked-update scan consumes exactly cms.pattern.activated.v1 and names its consumer',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/linked-scan/contract.test.ts',
            title:
              '[P2-S12-AC-212] the typed cms.pattern.linked_update_scan message rejects a caller-named instance',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/linked-scan/job.test.ts',
            title:
              '[P2-S12-AC-212] the cms.pattern.linked_update_scan job runs { patternId, patternVersionId } from the start with a null cursor and acknowledges a finished walk',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/linked-scan/job.test.ts',
            title:
              '[P2-S12-AC-212] the cms.pattern.linked_update_scan job counts a re-delivery that appended nothing as zero, so an idempotent repeat adds nothing',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_linked_scan/030-scan.sqlinc',
            title:
              'all 11 follow the contract: next version of the head, state pending_diff, pin unchanged, pending_pattern_version 2, every other member copied [AC-212]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_linked_scan/030-scan.sqlinc',
            title:
              'a linked instance on a draft revision gets a pending_diff row; the standalone block row beside it (no pattern) gets none',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_linked_scan/030-scan.sqlinc',
            title:
              'a DETACHED instance (provenance only) is never offered an update',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_linked_scan/030-scan.sqlinc',
            title:
              'an instance on a revision with a live review (effective state submitted) keeps its pin as history',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_linked_scan/030-scan.sqlinc',
            title:
              'a type-2 entry is not offered v2: the new version is compatible with type 1 only',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_linked_scan/030-scan.sqlinc',
            title:
              'the type-2 entry is offered v3, which is compatible with type 2 (the other direction of the compatibility predicate)',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_linked_scan/030-scan.sqlinc',
            title: 'an instance already pinned to v2 is not offered v2',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_linked_scan/030-scan.sqlinc',
            title:
              'a row already waiting for v2 gets a newer pending row for v3, still pinned to v1',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_linked_scan/030-scan.sqlinc',
            title:
              "an instance on a revision that is no longer the entry's current draft is history and gets nothing",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_linked_scan/040-bounds.sqlinc',
            title:
              'a re-delivery from the start of the list appends nothing, though 546 instances are linked and older [AC-213]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_linked_scan/050-resolver.sqlinc',
            title: 'the activation event publishes the lineage id as patternId',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_linked_scan/020-contract.sqlinc',
            title:
              'a revision is draft exactly when the one derived EntryRevisionState function (BE03b E2) says draft, in the candidate query and again under the entry lock (a predicate on any other state fails here)',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-213',
    text: 'Linked-update scan bounds: `cms.pattern.linked_update_scan` processes at most 500 instances per run with a continuation cursor and is idempotent, so a re-delivered `cms.pattern.activated.v1` appends no duplicate `pending_diff` row and a long instance list continues from the cursor.',
    clauses: [
      {
        text: 'Linked-update scan bounds: `cms.pattern.linked_update_scan` processes at most 500 instances per run with a continuation cursor and is idempotent, so a re-delivered `cms.pattern.activated.v1` appends no duplicate `pending_diff` row and a long instance list continues from the cursor.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_linked_scan/040-bounds.sqlinc',
            title:
              'the first run takes exactly 500 instances and appends 500 rows: the bound of AC-213',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_linked_scan/040-bounds.sqlinc',
            title:
              'the run hands back an opaque continuation cursor (entry id and hex-encoded path)',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_linked_scan/040-bounds.sqlinc',
            title:
              'the 500 rows are the first 500 candidates in ascending entry id then bytewise path order',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_linked_scan/040-bounds.sqlinc',
            title: 'and none of the remaining 46 was touched',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_linked_scan/040-bounds.sqlinc',
            title:
              'every candidate of the lineage, in the order the spec fixes, ended up with its pending row',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_linked_scan/040-bounds.sqlinc',
            title:
              'a re-delivery from the start of the list appends nothing, though 546 instances are linked and older [AC-213]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_linked_scan/030-scan.sqlinc',
            title:
              'the scan of v3 examines and appends 15: a newer pending row over each of the 11 rows already waiting for v2 (lk1-3, st1-3, iv1) and the first one for ty2 and same1 (4) [AC-212]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/linked-scan/contract.test.ts',
            title:
              '[P2-S12-AC-213] the run request and result accepts a consistent result and a continuation only after a full run of 500',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/linked-scan/contract.test.ts',
            title:
              '[P2-S12-AC-213] the run request and result rejects more than 500 examined',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/linked-scan/job.test.ts',
            title:
              '[P2-S12-AC-212] the cms.pattern.linked_update_scan job continues from the cursor the previous run handed back',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/linked-scan/job.test.ts',
            title:
              '[P2-S12-AC-212] the cms.pattern.linked_update_scan job enqueues the continuation message with the new cursor before it acknowledges [AC-213]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/linked-scan/job.test.ts',
            title:
              '[P2-S12-AC-212] the cms.pattern.linked_update_scan job does not continue on a full run that ends the list: a run of exactly 500 with no cursor is finished (no extra empty run)',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/linked-scan/job.test.ts',
            title:
              '[P2-S12-AC-212] the cms.pattern.linked_update_scan job counts a re-delivery that appended nothing as zero, so an idempotent repeat adds nothing',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
];
