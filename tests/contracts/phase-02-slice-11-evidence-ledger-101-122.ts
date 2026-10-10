import type { EvidenceLedgerEntry } from './phase-02-evidence-ledger';

// Slice 11 evidence ledger fragment P2-S11-AC-101..122. Rules: see
// tests/contracts/phase-02-slice-11-evidence-ledger.ts and the guard tests/contracts/phase-02-slice-11-evidence-guard.test.ts.
export const S11_EVIDENCE_LEDGER_101_122: readonly EvidenceLedgerEntry[] = [
  {
    criterion: 'P2-S11-AC-101',
    text: "Accessibility checker (D25): the in-process `quality_gate_evaluate` gate call runs the current checker version fresh at review submission, schedule acceptance, schedule execution and publication and never reuses a stored run, persists nothing until Slice 16, hands its outcome to the BE03b command as `PreflightEvidence`, stores in the command's audit record only `{ checkerKey, checkerVersion, outcome, blockingCount, inputHash }`, evaluates within 2,000 ms immediately before the RPC, and maps the run state to the category result (`healthy` to `passed`; `blocked` to `failed` with `blocking_finding`; `failed` to `unavailable` with `checker_failed`; DEC-150).",
    clauses: [
      {
        text: 'Accessibility checker (D25): the in-process `quality_gate_evaluate` gate call runs the current checker version fresh at review submission, schedule acceptance, schedule execution and publication and never reuses a stored run',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-operations.test.ts',
            title:
              'accessibility proof (CMS-03B-05, -07, -09) runs the submit-phase gate for the named entry and revision and hands the proof to the port',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-operations.test.ts',
            title:
              'accessibility proof (CMS-03B-05, -07, -09) names only the revision at schedule acceptance and the entry at publication',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-publication-schedule-sweep.test.ts',
            title:
              'executing claims runs the checker then executes each claim in order with the bound proof',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/a11y-structural/gate.test.ts',
            title:
              'evaluateAccessibilityGate: outcomes runs fresh on every call and keeps no state between calls',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_preflight.sql',
            title:
              'evidence of another provider version is stale: the Worker must run the current checker [P2-S11-AC-102]',
          },
        ],
      },
      {
        text: 'persists nothing until Slice 16',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_gate.sql',
            title:
              'the load writes nothing: no audit record, event, reservation, review, schedule or publication is created or changed [P2-S11-AC-101]',
          },
        ],
      },
      {
        text: 'hands its outcome to the BE03b command as `PreflightEvidence`',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-workflow.test.ts',
            title:
              'accessibility proof reaches the command RPC CMS-03B-05 loads the revision then sends the verified evidence',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-workflow.test.ts',
            title:
              'accessibility proof reaches the command RPC CMS-03B-07 loads the revision then sends the verified evidence',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-workflow.test.ts',
            title:
              'accessibility proof reaches the command RPC CMS-03B-09 loads the revision then sends the verified evidence',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-publication-schedule-sweep.test.ts',
            title:
              'executing claims runs the checker then executes each claim in order with the bound proof',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/a11y-structural/evidence.test.ts',
            title:
              'toPreflightEvidence builds healthy evidence bound to the revision and the dependency set',
          },
        ],
      },
      {
        text: "stores in the command's audit record only `{ checkerKey, checkerVersion, outcome, blockingCount, inputHash }`",
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/a11y-structural/evidence.test.ts',
            title:
              'auditRecordOf stores exactly the checker key and version, outcome, blocking count and input hash',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_evidence_audit.sql',
            title:
              'the row stores the command, the review, the revision, the owner and exactly {checkerKey, checkerVersion, outcome, blockingCount, inputHash} [P2-S11-AC-101]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_evidence_audit.sql',
            title:
              'the columns are the envelope, the command reference and exactly the five summary members (no finding text, no binding hash) [P2-S11-AC-101]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_evidence_audit.sql',
            title:
              'the schedule wrote exactly one summary row: operation, outcome, blocking count, checker key and version [P2-S11-AC-101]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_evidence_audit.sql',
            title:
              'the publication wrote exactly one summary row against the lineage row [P2-S11-AC-101]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_evidence_audit.sql',
            title:
              'a verified proof is summarized whether the execution completes, blocks or retries: healthy, healthy, failed and blocked (two findings) [P2-S11-AC-101]',
          },
        ],
      },
      {
        text: 'evaluates within 2,000 ms immediately before the RPC',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/a11y-structural/gate-timeout.test.ts',
            title:
              'timer deadline abandons a load that ignores its signal at 2,000 ms by default',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-operations.test.ts',
            title:
              'accessibility proof (CMS-03B-05, -07, -09) runs the submit-phase gate for the named entry and revision and hands the proof to the port',
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
        text: 'maps the run state to the category result (`healthy` to `passed`; `blocked` to `failed` with `blocking_finding`; `failed` to `unavailable` with `checker_failed`; DEC-150).',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/preflight.test.ts',
            title:
              '[P2-S11-AC-101][P2-S11-AC-102] accessibility PreflightEvidence (DEC-150) maps the run state to the category result (healthy passes; blocked fails; failed is unavailable)',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/a11y-structural/evidence.test.ts',
            title:
              'toPreflightEvidence maps healthy evidence to a passed result (DEC-150)',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/a11y-structural/evidence.test.ts',
            title:
              'toPreflightEvidence builds blocked evidence and maps it to a failed blocking_finding result',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_preflight.sql',
            title:
              'a blocked run is a failed result with blocking_finding [P2-S11-AC-101]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_preflight.sql',
            title:
              'a failed run (timeout, dependency failure) is an unavailable result with checker_failed [P2-S11-AC-101]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_preflight.sql',
            title:
              'a clean revision with healthy evidence passes every category [P2-S11-AC-097]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S11-AC-102',
    text: 'Accessibility checker (D25): the BE03b RPC accepts accessibility `PreflightEvidence` only from the Worker role and only when `providerKey` and `providerVersion` equal the current registry row, `outcome` is `healthy` to yield a pass, `evaluatedAt` is within 60 seconds of the RPC instant (else 409 `CONFLICT` `preflight_evidence_stale`) and `bindingHash` equals the SHA-256 of the JCS `{ checkerKey, checkerVersion, revisionId, revisionContentHash, dependencyHash }` the RPC recomputes from canonical rows (else 409 `CONFLICT` `dependency_changed`); the evidence member is never a browser or PostgREST input.',
    clauses: [
      {
        text: 'Accessibility checker (D25): the BE03b RPC accepts accessibility `PreflightEvidence` only from the Worker role',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_submit.sql',
            title:
              'the platform_api wrapper is a SECURITY DEFINER of the CMS definer, executable by service_role only, not by PUBLIC, anon or authenticated [P2-S11-AC-010]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_schedule.sql',
            title:
              'the platform_api wrapper is a SECURITY DEFINER of the CMS definer, executable by service_role only, not by PUBLIC, anon or authenticated [P2-S11-AC-022]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_publish.sql',
            title:
              'the platform_api wrapper is a SECURITY DEFINER of the CMS definer, executable by service_role only, not by PUBLIC, anon or authenticated [P2-S11-AC-034]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_execute.sql',
            title:
              'the platform_api wrapper is executable by service_role only, not by PUBLIC, anon or authenticated [P2-S11-AC-081]',
          },
        ],
      },
      {
        text: 'only when `providerKey` and `providerVersion` equal the current registry row',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_preflight.sql',
            title:
              'evidence of another provider version is stale: the Worker must run the current checker [P2-S11-AC-102]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_preflight.sql',
            title:
              'evidence of another provider key is malformed (the contract fixes the key) [P2-S11-AC-102]',
          },
        ],
      },
      {
        text: '`outcome` is `healthy` to yield a pass',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_preflight.sql',
            title:
              'a clean revision with healthy evidence passes every category [P2-S11-AC-097]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_preflight.sql',
            title:
              'a blocked run is a failed result with blocking_finding [P2-S11-AC-101]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_preflight.sql',
            title:
              'a failed run (timeout, dependency failure) is an unavailable result with checker_failed [P2-S11-AC-101]',
          },
        ],
      },
      {
        text: '`evaluatedAt` is within 60 seconds of the RPC instant (else 409 `CONFLICT` `preflight_evidence_stale`)',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_preflight.sql',
            title:
              'evidence evaluated 61 s ago is stale (409 preflight_evidence_stale) [P2-S11-AC-102]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_preflight.sql',
            title:
              'evidence stamped 61 s in the future is stale as well (the window is symmetric) [P2-S11-AC-102]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_preflight.sql',
            title: 'evidence 55 s old is accepted and passes [P2-S11-AC-102]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_submit_refusals.sql',
            title:
              'evidence older than 60 s or from another provider version is 409 preflight_evidence_stale; evidence bound to other rows is 409 dependency_changed with the current hash [P2-S11-AC-102]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_schedule_refusals.sql',
            title:
              'evidence older than 60 s or from another provider version is 409 preflight_evidence_stale; evidence bound to other rows is 409 dependency_changed with the current hash [P2-S11-AC-102]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_publish_refusals.sql',
            title:
              'evidence older than 60 s or from another provider version is 409 preflight_evidence_stale; evidence bound to other rows is 409 dependency_changed with the current hash [P2-S11-AC-102]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_preflight.sql',
            title:
              'at execution stale or mis-bound evidence is preflight_evidence_stale (DEC-158c) [P2-S11-AC-102]',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/preflight.test.ts',
            title:
              '[P2-S11-AC-101][P2-S11-AC-102] accessibility PreflightEvidence (DEC-150) accepts evidence only within 60 seconds of the RPC instant',
          },
        ],
      },
      {
        text: '`bindingHash` equals the SHA-256 of the JCS `{ checkerKey, checkerVersion, revisionId, revisionContentHash, dependencyHash }` the RPC recomputes from canonical rows (else 409 `CONFLICT` `dependency_changed`)',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_preflight.sql',
            title:
              'the binding hash is the SHA-256 of the JCS { checkerKey, checkerVersion, dependencyHash, revisionContentHash, revisionId } [P2-S11-AC-102]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_preflight.sql',
            title:
              'evidence bound to other canonical rows is 409 dependency_changed (BE03b) in the submit phase [P2-S11-AC-102]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_preflight.sql',
            title: '... and in the schedule phase [P2-S11-AC-102]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_preflight.sql',
            title: '... and in the publish phase [P2-S11-AC-102]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_preflight.sql',
            title:
              'DEC-158c: the binding is verified for EVERY outcome, a blocked run included [P2-S11-AC-102]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_submit_refusals.sql',
            title:
              'evidence older than 60 s or from another provider version is 409 preflight_evidence_stale; evidence bound to other rows is 409 dependency_changed with the current hash [P2-S11-AC-102]',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/jobs-observability.test.ts',
            title:
              '[P2-S11-AC-102] accessibility evidence binding input names exactly the five members the RPC recomputes from canonical rows',
          },
        ],
      },
      {
        text: 'the evidence member is never a browser or PostgREST input.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-publish-preflight.apispec.ts',
            title:
              'CMS-03B-09 publication admission and preflight composition [CMS-03B-09] caller evidence is rejected before RPC with a closed field violation',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-submit-contracts.apispec.ts',
            title:
              'CMS-03B-05 frozen submission and admission contracts [CMS-03B-05] forged-evidence is refused before RPC and before every durable effect',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S11-AC-103',
    text: 'Time authority (E8): schedule time rules are owned by the Worker over one pinned, content-addressed IANA tz snapshot generated by a pinned script from one release tarball, exported as `CMS_TZDB_VERSION` (`^[A-Za-z0-9._-]{1,32}$`) and `CMS_TZDB_SHA256`, verified at module load (a mismatch answers every schedule command 503 `DEPENDENCY_UNAVAILABLE`), mirrored by `platform_private.cms_tzdb_version()` with a CI parity test, advanced only by code plus a forward migration, with stored schedules keeping the version and instant they were accepted with and recording the tag only; per DEC-153 the Slice 11 contract lane pins the newest stable IANA release available when it starts and records the tag, the snapshot SHA-256 and the generation command in DEC-153.',
    clauses: [
      {
        text: 'Time authority (E8): schedule time rules are owned by the Worker over one pinned, content-addressed IANA tz snapshot generated by a pinned script from one release tarball, exported as `CMS_TZDB_VERSION` (`^[A-Za-z0-9._-]{1,32}$`) and `CMS_TZDB_SHA256`',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-11-tzdb-pin.test.ts',
            title:
              '[P2-S11-AC-103] the Slice 11 tz pin (DEC-153) pins the newest stable IANA release to two content-addressed tarballs',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-11-tzdb-pin.test.ts',
            title:
              '[P2-S11-AC-103] the Slice 11 tz pin (DEC-153) commits exactly the module the generator renders from the pinned snapshot text',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-11-tzdb-pin.test.ts',
            title:
              '[P2-S11-AC-103] the Slice 11 tz pin (DEC-153) binds the exported constants to the exact DEC-153 release and digests',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/time-authority/tzdb-snapshot.test.ts',
            title:
              '[P2-S11-AC-103] snapshot parsing and integrity pins the release tag and a lowercase SHA-256 of the exact snapshot text',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-11-sql-parity.test.ts',
            title:
              '[P2-S11-AC-103][P2-S11-AC-105] cms_tzdb_version() returns CMS_TZDB_VERSION returns, in the last migration that defines it, the literal tag the contracts constant pins',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-time-authority.test.ts',
            title:
              'pinned snapshot verification serves the committed snapshot of the pinned release',
          },
        ],
      },
      {
        text: 'verified at module load (a mismatch answers every schedule command 503 `DEPENDENCY_UNAVAILABLE`)',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/time-authority/time-authority.test.ts',
            title:
              '[P2-S11-AC-103] the pinned time authority verifies the snapshot hash at load and exposes the pinned release',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/time-authority/time-authority.test.ts',
            title:
              '[P2-S11-AC-103] the pinned time authority refuses a snapshot whose hash differs from the pin, so every schedule command can answer 503',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-time-authority.test.ts',
            title:
              'pinned snapshot verification yields no authority when the snapshot fails its integrity check',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-schedule-time.test.ts',
            title:
              'integrity of the pinned snapshot answers every schedule command 503 when the snapshot failed its hash check',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-errors-typed.test.ts',
            title:
              'transport statuses publishes ordinary dependency unavailability for the generic dependency',
          },
        ],
      },
      {
        text: 'mirrored by `platform_private.cms_tzdb_version()` with a CI parity test',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_tzdb.sql',
            title:
              'it returns the pinned IANA release tag (DEC-153: 2026e) [P2-S11-AC-103]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_tzdb.sql',
            title:
              'the function comment names the TypeScript constant it mirrors, for the parity test [P2-S11-AC-103]',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-11-sql-parity.test.ts',
            title:
              '[P2-S11-AC-103][P2-S11-AC-105] cms_tzdb_version() returns CMS_TZDB_VERSION returns, in the last migration that defines it, the literal tag the contracts constant pins',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-11-sql-parity.test.ts',
            title:
              '[P2-S11-AC-103][P2-S11-AC-105] cms_tzdb_version() returns CMS_TZDB_VERSION documents the same snapshot digest as the pin',
          },
        ],
      },
      {
        text: 'advanced only by code plus a forward migration',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-11-sql-parity.test.ts',
            title:
              '[P2-S11-AC-103][P2-S11-AC-105] cms_tzdb_version() returns CMS_TZDB_VERSION is defined by the 20261005017595 forward migration',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-11-sql-parity.test.ts',
            title:
              '[P2-S11-AC-103][P2-S11-AC-105] cms_tzdb_version() returns CMS_TZDB_VERSION returns, in the last migration that defines it, the literal tag the contracts constant pins',
          },
        ],
      },
      {
        text: 'with stored schedules keeping the version and instant they were accepted with and recording the tag only',
        citations: [],
      },
      {
        text: 'per DEC-153 the Slice 11 contract lane pins the newest stable IANA release available when it starts and records the tag, the snapshot SHA-256 and the generation command in DEC-153.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-11-tzdb-pin.test.ts',
            title:
              '[P2-S11-AC-103] the Slice 11 tz pin (DEC-153) is the pin the decision record states, digest for digest',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-11-tzdb-pin.test.ts',
            title:
              '[P2-S11-AC-103] the Slice 11 tz pin (DEC-153) pins the newest stable IANA release to two content-addressed tarballs',
          },
        ],
      },
    ],
    status: 'partial',
    limitation:
      'Clause "with stored schedules keeping the version and instant they were accepted with and recording the tag only" is uncited. The accepted instant is proven immutable (phase_02_slice_11_schedules_schema.sql "the resolved instant is verified time authority and never moves") and the RPC stores tzdb_version = cms_tzdb_version() at acceptance (phase_02_slice_11_rpc_publication_schedule.sql "the schedule row stores ... the verified time fields"), but no test updates tzdb_version after acceptance and expects IMMUTABLE_RECORD, none proves a schedule accepted under an older tag keeps that tag (and still executes) after the pin advances, and none asserts the column stores the tag only (the cms_publication_schedules_tzdb_version_check constraint is never exercised). Clause "advanced only by code plus a forward migration" is cited through the parity tests only (a pin change without a new migration fails parity); there is no test that forbids another way of advancing.',
  },
  {
    criterion: 'P2-S11-AC-104',
    text: 'Time authority (E8): resolution classifies the local time against the pinned snapshot: a name outside it is 422 `unknown_timezone`, a `tzdbVersion` other than `CMS_TZDB_VERSION` is 422 `tzdb_version_mismatch` with `details.pinnedVersion`, a gap (no instant) is 422 `nonexistent_local_time` with two alternatives shifted earlier and later by the gap length, a single instant with a `disambiguation` other than `none` is 422 `disambiguation_not_applicable`, and a fold (two instants) with `none` is 422 `ambiguous_local_time` with `earlier` and `later` alternatives, `earlier` selecting the smaller instant.',
    clauses: [
      {
        text: 'Time authority (E8): resolution classifies the local time against the pinned snapshot:',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/time-authority/tzdb-zone.test.ts',
            title:
              '[P2-S11-AC-104] resolving a local time to the set of instants finds exactly one instant outside any change',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/time-authority/tzdb-zone.test.ts',
            title:
              '[P2-S11-AC-104] resolving a local time to the set of instants reports a spring-forward gap with the transition and both offsets',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/time-authority/tzdb-zone.test.ts',
            title:
              '[P2-S11-AC-104] resolving a local time to the set of instants reports a fall-back fold with the earlier and later instants',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/time-authority/schedule-time.test.ts',
            title:
              '[P2-S11-AC-104] Time authority steps 1-2: zone name and pinned version accepts canonical, link, three-segment and fixed-offset zone names',
          },
        ],
      },
      {
        text: 'a name outside it is 422 `unknown_timezone`',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/time-authority/schedule-time.test.ts',
            title:
              '[P2-S11-AC-104] Time authority steps 1-2: zone name and pinned version refuses a name outside the snapshot as unknown_timezone at /timezone',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-schedule-time.test.ts',
            title:
              'E8 refusals, in order 1: a zone outside the snapshot is unknown_timezone at /timezone',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-schedule-time.apispec.ts',
            title:
              'CMS-03B-07 pinned time authority through the real stack [CMS-03B-07] unknown zone returns exact safe time details and no effects',
          },
        ],
      },
      {
        text: 'a `tzdbVersion` other than `CMS_TZDB_VERSION` is 422 `tzdb_version_mismatch` with `details.pinnedVersion`',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/time-authority/schedule-time.test.ts',
            title:
              '[P2-S11-AC-104] Time authority steps 1-2: zone name and pinned version refuses another tz release with the pinned one, after the zone check',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-schedule-time.test.ts',
            title:
              'E8 refusals, in order 2: another tzdb release is tzdb_version_mismatch with the pinned release',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_schedule_refusals.sql',
            title:
              'a tzdbVersion other than the pinned one is 422 tzdb_version_mismatch carrying the pinned value [P2-S11-AC-104]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-schedule-time.apispec.ts',
            title:
              'CMS-03B-07 pinned time authority through the real stack [CMS-03B-07] pinned tzdb mismatch returns exact safe time details and no effects',
          },
        ],
      },
      {
        text: 'a gap (no instant) is 422 `nonexistent_local_time` with two alternatives shifted earlier and later by the gap length',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/time-authority/schedule-time.test.ts',
            title:
              '[P2-S11-AC-104] Time authority steps 3-6: gaps, folds and disambiguation refuses a nonexistent local time with the earlier and later alternatives',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/time-authority/schedule-time.test.ts',
            title:
              '[P2-S11-AC-104] Time authority steps 3-6: gaps, folds and disambiguation measures the alternatives by the length of the gap (30 minutes at Lord Howe)',
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
              'CMS-03B-07 pinned time authority through the real stack [CMS-03B-07] spring gap and unresolved fold expose exactly both pinned alternatives',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-schedule-time.apispec.ts',
            title:
              'CMS-03B-07 pinned time authority through the real stack [CMS-03B-07] a nonexistent local time is the Worker 422 with its two alternatives and reaches no RPC',
          },
        ],
      },
      {
        text: 'a single instant with a `disambiguation` other than `none` is 422 `disambiguation_not_applicable`',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/time-authority/schedule-time.test.ts',
            title:
              '[P2-S11-AC-104] Time authority steps 3-6: gaps, folds and disambiguation refuses a disambiguation other than none for a single instant',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-schedule-time.test.ts',
            title:
              'E8 refusals, in order 5: a unique time rejects any disambiguation',
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
        ],
      },
      {
        text: 'a fold (two instants) with `none` is 422 `ambiguous_local_time` with `earlier` and `later` alternatives, `earlier` selecting the smaller instant.',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/time-authority/schedule-time.test.ts',
            title:
              '[P2-S11-AC-104] Time authority steps 3-6: gaps, folds and disambiguation refuses an ambiguous local time without a disambiguation, listing both instants',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/time-authority/schedule-time.test.ts',
            title:
              '[P2-S11-AC-104] Time authority steps 3-6: gaps, folds and disambiguation selects the smaller instant for earlier and the larger for later',
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
    criterion: 'P2-S11-AC-105',
    text: 'Time authority (E8): `resolvedUtc` must equal the selected instant (422 `resolved_utc_mismatch` with `details.expectedUtc`) and lie at least 60 seconds and at most 366 days after acceptance (422 `schedule_out_of_horizon` with `details.minUtc` and `details.maxUtc`); the Worker passes only the verified time members to the RPC, which rechecks `tzdbVersion = cms_tzdb_version()`, the horizon and that `localDateTime` read as UTC minus `resolvedUtc` lies within -12 and +14 hours (else 422 `resolved_utc_mismatch`), so caller input is never stored as verified time authority.',
    clauses: [
      {
        text: 'Time authority (E8): `resolvedUtc` must equal the selected instant (422 `resolved_utc_mismatch` with `details.expectedUtc`)',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/time-authority/schedule-time.test.ts',
            title:
              '[P2-S11-AC-105] Time authority steps 7-8: the resolved instant and the horizon requires resolvedUtc to equal the selected instant, with the expected value in the refusal',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-schedule-time.test.ts',
            title:
              'E8 refusals, in order 7: a resolvedUtc that is not the selected instant carries the expected one',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-schedule-time.apispec.ts',
            title:
              'CMS-03B-07 pinned time authority through the real stack [CMS-03B-07] one nanosecond UTC mismatch is refused before any RPC',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/time-authority/schedule-nanoseconds.test.ts',
            title:
              '[P2-S11-AC-105] exact nanosecond horizon with integer acceptance clock a one-nanosecond local/resolved mismatch returns only the exact mismatch refusal',
          },
        ],
      },
      {
        text: 'and lie at least 60 seconds and at most 366 days after acceptance (422 `schedule_out_of_horizon` with `details.minUtc` and `details.maxUtc`)',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/time-authority/schedule-time.test.ts',
            title:
              '[P2-S11-AC-105] Time authority steps 7-8: the resolved instant and the horizon requires at least 60 seconds and at most 366 days of lead, both bounds inclusive',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/time-authority/schedule-time.test.ts',
            title:
              '[P2-S11-AC-105] Time authority steps 7-8: the resolved instant and the horizon measures the bounds from the acceptance instant to the millisecond',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-schedule-time.test.ts',
            title:
              'E8 refusals, in order 8: an instant under 60 seconds or over 366 days away is out of horizon',
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
              'CMS-03B-07 pinned time authority through the real stack [CMS-03B-07] below minimum reports exact 60-second and 366-day live-clock bounds',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-schedule-time.apispec.ts',
            title:
              'CMS-03B-07 pinned time authority through the real stack [CMS-03B-07] above maximum reports exact 60-second and 366-day live-clock bounds',
          },
        ],
      },
      {
        text: 'the Worker passes only the verified time members to the RPC',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-operations.test.ts',
            title:
              'response invariants bind the resource to the request CMS-03B-07 refuses a schedule that differs from the request in any time member',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-schedule-time.apispec.ts',
            title:
              'CMS-03B-07 pinned time authority through the real stack [CMS-03B-07] one nanosecond UTC mismatch is refused before any RPC',
          },
        ],
      },
      {
        text: 'which rechecks `tzdbVersion = cms_tzdb_version()`',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_schedule_refusals.sql',
            title:
              'a tzdbVersion other than the pinned one is 422 tzdb_version_mismatch carrying the pinned value [P2-S11-AC-104]',
          },
        ],
      },
      {
        text: 'the horizon',
        citations: [
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
              'the bounds are inclusive: 90 s ahead, just under 366 days ahead, a local time exactly 14 h after and exactly 12 h before the resolved UTC are accepted [P2-S11-AC-105]',
          },
        ],
      },
      {
        text: 'that `localDateTime` read as UTC minus `resolvedUtc` lies within -12 and +14 hours (else 422 `resolved_utc_mismatch`)',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_schedule_refusals.sql',
            title:
              'a local time more than 14 h after or 12 h before the resolved UTC (no real zone offset) is 422 resolved_utc_mismatch [P2-S11-AC-105]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_schedule_refusals.sql',
            title:
              'the bounds are inclusive: 90 s ahead, just under 366 days ahead, a local time exactly 14 h after and exactly 12 h before the resolved UTC are accepted [P2-S11-AC-105]',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/time-authority/schedule-time.test.ts',
            title:
              '[P2-S11-AC-105] the RPC offset sanity bound accepts local-as-UTC minus resolvedUtc within -12 hours and +14 hours inclusive',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_schedules_schema.sql',
            title:
              'schedule: a local time more than 14 hours ahead of its UTC instant is not a real offset (E8) [P2-S11-AC-122]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_schedules_schema.sql',
            title:
              'schedule: a local time more than 12 hours behind its UTC instant is not a real offset (E8) [P2-S11-AC-122]',
          },
        ],
      },
      {
        text: 'so caller input is never stored as verified time authority.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_schedule_refusals.sql',
            title: 'the refused time rules scheduled nothing [P2-S11-AC-105]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_schedule.sql',
            title:
              'the resource echoes the accepted time fields exactly as submitted (the Worker compares them verbatim) [P2-S11-AC-103]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_schedules_schema.sql',
            title:
              'schedule: the resolved instant is verified time authority and never moves [P2-S11-AC-122]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-schedule-time.apispec.ts',
            title:
              'CMS-03B-07 pinned time authority through the real stack [CMS-03B-07] one nanosecond UTC mismatch is refused before any RPC',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S11-AC-106',
    text: 'Time authority (E8): the schedule form obtains `resolvedUtc`, `tzdbVersion` and `disambiguation` from the shared Time authority module, which is the same pinned snapshot and resolver the Worker uses, is lazy-loaded when the form opens and stays within the bundle-budget thresholds, shows the resolved instant, an earlier/later choice for an ambiguous time and the two alternatives for a nonexistent time, never offers a time outside the 60 s to 366 d window, and reproduces the spring-forward gap, fall-back fold, `UTC` and three-segment zone cases while the server re-resolves and stays authoritative.',
    clauses: [
      {
        text: 'Time authority (E8): the schedule form obtains `resolvedUtc`, `tzdbVersion` and `disambiguation` from the shared Time authority module, which is the same pinned snapshot and resolver the Worker uses',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialScheduleForm.test.tsx',
            title:
              'schedule (CMS-03B-07) sends the resolved request and states Scheduled, not published',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialScheduleForm.test.tsx',
            title:
              'schedule (CMS-03B-07) sends the chosen earlier/later disambiguation for an ambiguous time',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/cms-workflow-schedule-resolution.test.ts',
            title:
              'resolveScheduleInput resolves an ordinary local time to one UTC instant with its offset',
          },
        ],
      },
      {
        text: 'is lazy-loaded when the form opens',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialScheduleForm.test.tsx',
            title:
              'lazy Time authority does not load the tz snapshot until the form is opened, then loads it once',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialScheduleForm.test.tsx',
            title:
              'lazy Time authority says so and blocks sending when the snapshot cannot be loaded',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/client-chunk-time-authority.test.ts',
            title:
              'time authority lazy chunk is exactly the closure only the time-authority subpath reaches',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/client-chunk-time-authority.test.ts',
            title:
              'time authority lazy chunk names a chunk of its own for those modules and keeps the rest of contracts eager',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/client-chunk-time-authority.test.ts',
            title:
              'time authority lazy chunk keeps the snapshot data out of the zod-free eager groups',
          },
        ],
      },
      {
        text: 'stays within the bundle-budget thresholds',
        citations: [],
      },
      {
        text: 'shows the resolved instant, an earlier/later choice for an ambiguous time and the two alternatives for a nonexistent time',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialScheduleForm.test.tsx',
            title:
              'resolution shown beside the inputs shows the resolved instant and offset in a polite region',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialScheduleForm.test.tsx',
            title:
              'resolution shown beside the inputs offers earlier and later for an ambiguous time with both instants',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialScheduleForm.test.tsx',
            title:
              'resolution shown beside the inputs offers the two alternatives of a nonexistent time and applies the chosen one',
          },
        ],
      },
      {
        text: 'never offers a time outside the 60 s to 366 d window',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialScheduleForm.test.tsx',
            title:
              'resolution shown beside the inputs refuses an unknown zone and a time outside the window with the stated bounds',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialScheduleForm.test.tsx',
            title:
              'schedule (CMS-03B-07) refuses to send a nonexistent time or one outside the window',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/cms-workflow-schedule-resolution.test.ts',
            title:
              'resolveScheduleInput refuses an unknown zone and a time outside the 60 second to 366 day window',
          },
        ],
      },
      {
        text: 'reproduces the spring-forward gap, fall-back fold, `UTC` and three-segment zone cases',
        citations: [],
      },
      {
        text: 'while the server re-resolves and stays authoritative.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-schedule-time.test.ts',
            title:
              'E8 refusals, in order 7: a resolvedUtc that is not the selected instant carries the expected one',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-schedule-time.apispec.ts',
            title:
              'CMS-03B-07 pinned time authority through the real stack [CMS-03B-07] one nanosecond UTC mismatch is refused before any RPC',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialScheduleForm.test.tsx',
            title:
              'schedule (CMS-03B-07) names the server time refusals at the field',
          },
        ],
      },
    ],
    status: 'partial',
    limitation:
      'Two clauses are uncited. (1) "stays within the bundle-budget thresholds": the only budget gate is the build script scripts/verify-bundle-budget.mjs (pnpm bundle:check), which is not a vitest, pgTAP, Playwright or race test, never names the contracts-time-authority chunk, and so cannot be cited; apps/web/src/client-chunk-time-authority.test.ts proves the snapshot is split into its own lazy chunk but asserts no size. (2) "reproduces the spring-forward gap, fall-back fold, UTC and three-segment zone cases": the web tests (cms-workflow-schedule-resolution.test.ts, CmsEditorialScheduleForm.test.tsx) cover the gap, the fold and UTC, but no apps/web test resolves a three-segment zone such as America/Argentina/Buenos_Aires (only the Worker and contracts tests do).',
  },
  {
    criterion: 'P2-S11-AC-107',
    text: "Publisher authority and separation of duties (E11): CMS-03B-07 and CMS-03B-09 require the caller's current unrevoked owner-party `cms.publisher` grant (CMS-03B-07 also ending no earlier than `resolvedUtc`, else 422 `authority_ends_before_schedule`), and the human who publishes, or who schedules a `publish`, is never the revision's `author_person_id` (403 `FORBIDDEN` `separation_of_duties`), unconditionally in Phase 2, so an organization whose only human holds every capability needs a second human with `cms.publisher`.",
    clauses: [
      {
        text: "Publisher authority and separation of duties (E11): CMS-03B-07 and CMS-03B-09 require the caller's current unrevoked owner-party `cms.publisher` grant",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_publish_refusals.sql',
            title:
              'a visible target without the owner-party cms.publisher grant is 403 capability_missing: the entry assignee, the assigned reviewer and the owner [P2-S11-AC-031]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_schedule_refusals.sql',
            title:
              'a visible target without the owner-party cms.publisher grant is 403 capability_missing: the entry assignee, the assigned reviewer and the owner [P2-S11-AC-019]',
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
              'a revoked publisher grant fails publisher_authority_ended [P2-S11-AC-096]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_preflight.sql',
            title:
              'a grant that has not started is no current authority [P2-S11-AC-096]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_preflight.sql',
            title:
              'an ended tenure ends the publisher authority even with the grant row intact [P2-S11-AC-096]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-publish.apispec.ts',
            title:
              'CMS-03B-09 publish through the real stack [CMS-03B-09] a session without cms.publisher is 403 at the Worker; a session claiming it without the database grant is capability_missing from the database',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-schedule.apispec.ts',
            title:
              'CMS-03B-07 schedule through the real stack [CMS-03B-07] readable nonpublisher is exactly 403 and hidden and absent revisions are identical safe 404s',
          },
        ],
      },
      {
        text: '(CMS-03B-07 also ending no earlier than `resolvedUtc`, else 422 `authority_ends_before_schedule`)',
        citations: [
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
              'a grant that still covers the resolved UTC day (here: tomorrow) schedules [P2-S11-AC-107]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-schedule.apispec.ts',
            title:
              'CMS-03B-07 schedule through the real stack [CMS-03B-07] a publisher whose grant ends before the schedule is 422 authority_ends_before_schedule',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-schedule-precision-authority.apispec.ts',
            title:
              'CMS schedule nanoseconds at actual publisher grant UTC-day boundary [CMS-03B-07] midnight after actual shortPublisher valid_through is exact authority_ends_before_schedule with all fourteen groups unchanged',
          },
        ],
      },
      {
        text: "the human who publishes, or who schedules a `publish`, is never the revision's `author_person_id` (403 `FORBIDDEN` `separation_of_duties`), unconditionally in Phase 2",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_publish_refusals.sql',
            title:
              'the human who authored the revision cannot publish it (E11) [P2-S11-AC-107]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_schedule_refusals.sql',
            title:
              'the human who authored the revision cannot schedule its publish (E11) [P2-S11-AC-107]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_schedules_schema.sql',
            title:
              'schedule: the author of the revision never schedules its publication (E11) [P2-S11-AC-107]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_publication_lineage_schema.sql',
            title:
              'lineage: the author of the revision never publishes it (E11) [P2-S11-AC-107]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_schedule.sql',
            title:
              'the revision author may schedule an expire: separation of duties (E11) binds only a publish [P2-S11-AC-107]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-publish.apispec.ts',
            title:
              'CMS-03B-09 publish through the real stack [CMS-03B-09] the author of the revision may not publish it even with a standing publisher grant: 403 separation_of_duties and no effects',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-workflow-refusals.test.ts',
            title:
              'typed refusals the database raises 403 capability_missing and separation_of_duties',
          },
        ],
      },
      {
        text: 'so an organization whose only human holds every capability needs a second human with `cms.publisher`.',
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
              'CMS-03B-09 publish through the real stack [CMS-03B-09] a counted approver who is not the revision author publishes normally (202 active)',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_schedules_schema.sql',
            title:
              'schedule: a second human schedules the approved revision for one audience [P2-S11-AC-122]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S11-AC-108',
    text: 'Reviewer decision (CMS-03B-06): the evaluation runs in one transaction holding the review row lock and in this order: the step-up proof; concealment per scope (404 hidden or absent, 403 without an effective assignment or capability); `open` state (409 `review_not_open`) and `If-Match` equal to the review `version` (409 `VERSION_MISMATCH`); the dependency rebuild, where a mismatch commits the invalidation and answers 409 `dependency_changed` without recording the decision; separation (403 `separation_of_duties`, 409 `duplicate_decision`); and the active `cms.reviewer` grant (403 `capability_missing`).',
    clauses: [
      {
        text: 'Reviewer decision (CMS-03B-06): the evaluation runs in one transaction holding the review row lock',
        citations: [
          {
            tool: 'race',
            file: 'supabase/tests/phase_02_slice_11_races/011-review-decision-race.mjs',
            title:
              'B5: a decision BLOCKS behind a session holding the review row FOR UPDATE (the command takes the review lock)',
          },
        ],
      },
      {
        text: 'in this order:',
        citations: [],
      },
      {
        text: 'the step-up proof',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_decision_refusals.sql',
            title:
              'a stale, future, unverified or absent proof is STEP_UP_REQUIRED, ahead of concealment [P2-S11-AC-108]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_decision_refusals.sql',
            title: 'control: a proof 590 s old is accepted [P2-S11-AC-108]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-decision-refusals.apispec.ts',
            title:
              'CMS-03B-06 refusals through the real stack [CMS-03B-06] step-up, the Worker gate, the assignment gate, a stale version and a decided review',
          },
        ],
      },
      {
        text: 'concealment per scope (404 hidden or absent, 403 without an effective assignment or capability)',
        citations: [
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
              'a readable review without an EFFECTIVE assignment (window over, not started, submitter, publisher, owner) is 403 capability_missing [P2-S11-AC-013]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-decision-policy.apispec.ts',
            title:
              'CMS-03B-06 ordinary decision policy and persistence [CMS-03B-06] revoked assignment loses decision authority and concealed review matches absence',
          },
        ],
      },
      {
        text: '`open` state (409 `review_not_open`) and `If-Match` equal to the review `version` (409 `VERSION_MISMATCH`)',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_decision_refusals.sql',
            title:
              'an approved, rejected or invalidated review is review_not_open, and the state is evaluated before the CAS operand [P2-S11-AC-108]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_decision_refusals.sql',
            title:
              'a stale review version is VERSION_MISMATCH with the expected and current versions [P2-S11-AC-014]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_decision.sql',
            title:
              'a second attempt on the approved review is review_not_open [P2-S11-AC-108]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-decision-contracts.apispec.ts',
            title:
              'CMS-03B-06 exact decision contracts [CMS-03B-06] matching stale operands reach the RPC and return exact authorized CAS versions without effects',
          },
        ],
      },
      {
        text: 'the dependency rebuild, where a mismatch commits the invalidation and answers 409 `dependency_changed` without recording the decision',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_decision_invalidation.sql',
            title:
              'a stale frozen manifest returns the committed-refusal envelope {kind, reasonCode, details} instead of raising (so the invalidation commits) [P2-S11-AC-108]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_decision_invalidation.sql',
            title:
              'the details carry only the CURRENT dependencyHash (the rebuilt manifest), not the frozen one [P2-S11-AC-108]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_decision_invalidation.sql',
            title:
              'no decision row was recorded for the refused decision [P2-S11-AC-108]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_decision_invalidation.sql',
            title:
              'a decision on a rejected or approved review is review_not_open: the state check precedes the dependency rebuild, so a refused decision invalidates nothing [P2-S11-AC-108]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-decision-refusals.apispec.ts',
            title:
              'CMS-03B-06 refusals through the real stack [CMS-03B-06] a stale frozen manifest is the COMMITTED refusal: 200 kind refusal on the wire, 409 dependency_changed for the browser, the review stays invalidated and no decision is recorded',
          },
        ],
      },
      {
        text: 'separation (403 `separation_of_duties`, 409 `duplicate_decision`)',
        citations: [
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
              'a second decision by the same human is 409 duplicate_decision [P2-S11-AC-108]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-workflow-refusals.test.ts',
            title:
              'typed refusals the database raises 403 capability_missing and separation_of_duties',
          },
        ],
      },
      {
        text: 'the active `cms.reviewer` grant (403 `capability_missing`).',
        citations: [
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
              'control: with the grants restored the same decision succeeds [P2-S11-AC-108]',
          },
        ],
      },
    ],
    status: 'partial',
    limitation:
      'Clause "in this order" (the evaluation order of the seven steps) is uncited. Only three order facts are asserted: the step-up proof precedes concealment (rpc_review_decision_refusals.sql "ahead of concealment"), the open-state check precedes the If-Match CAS operand ("the state is evaluated before the CAS operand"), and the open-state check precedes the dependency rebuild (rpc_review_decision_invalidation.sql "the state check precedes the dependency rebuild"). No test fixes concealment before the open-state check, the CAS before the rebuild, the rebuild before separation, separation before the active cms.reviewer grant, or duplicate_decision against capability_missing for one caller who fails two steps at once.',
  },
  {
    criterion: 'P2-S11-AC-109',
    text: "Reviewer decision (CMS-03B-06): an `approve` derives the satisfied slot (the first unfilled specialist slot, in `requiredCapabilities` order, whose capability the reviewer holds, otherwise the base slot `cms.reviewer`) and is refused 409 `specialist_slot_unsatisfiable` when the approvals still possible are fewer than the specialist slots no counted approver holds (a `reject` never is); the append-only decision row stores the server-derived reviewer, `capability`, `step_up_at`, `reviewed_hash`, `reason` and `comment_hash` (SHA-256 of the reason's UTF-8 bytes); a `reject` sets `rejected` terminally and an `approve` sets `approved` exactly when the distinct qualifying approvers equal `requiredDecisionCount` and every specialist slot is held; and the audit record and one `cms.entry.review-changed.v1` commit with the CAS (`version` + 1).",
    clauses: [
      {
        text: 'Reviewer decision (CMS-03B-06): an `approve` derives the satisfied slot',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_decision.sql',
            title:
              'a base-only reviewer approves first: the base slot, the review stays open (one approval still possible for the specialist slot) [P2-S11-AC-109]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_decision.sql',
            title:
              'the specialist approves: the first unfilled specialist slot they hold is satisfied and the review is approved [P2-S11-AC-109]',
          },
        ],
      },
      {
        text: '(the first unfilled specialist slot, in `requiredCapabilities` order, whose capability the reviewer holds, otherwise the base slot `cms.reviewer`)',
        citations: [
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
              'when the specialist slot is already filled by a counted approver a second specialist fills the base slot [P2-S11-AC-109]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_decision.sql',
            title:
              'a base-only reviewer approves first: the base slot, the review stays open (one approval still possible for the specialist slot) [P2-S11-AC-109]',
          },
        ],
      },
      {
        text: 'and is refused 409 `specialist_slot_unsatisfiable` when the approvals still possible are fewer than the specialist slots no counted approver holds (a `reject` never is)',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_decision.sql',
            title:
              'a second base-only approve is refused specialist_slot_unsatisfiable (no approval left for the unfilled specialist slot) and changes nothing [P2-S11-AC-109]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_decision.sql',
            title:
              'a reject is never refused on the specialist-slot ground [P2-S11-AC-109]',
          },
        ],
      },
      {
        text: "the append-only decision row stores the server-derived reviewer, `capability`, `step_up_at`, `reviewed_hash`, `reason` and `comment_hash` (SHA-256 of the reason's UTF-8 bytes)",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_decision.sql',
            title:
              'the decision row stores the server-derived reviewer, slot, assignment, MFA instant, frozen reviewed hash, reason and its SHA-256 comment hash [P2-S11-AC-109]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_review_decisions_schema.sql',
            title:
              "decision: the comment hash is the SHA-256 of the reason's UTF-8 bytes [P2-S11-AC-109]",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_review_decisions_schema.sql',
            title:
              'decision: decision evidence is append-only and is never edited [P2-S11-AC-121]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_review_decisions_schema.sql',
            title:
              'decision: decision evidence is never deleted [P2-S11-AC-121]',
          },
        ],
      },
      {
        text: 'a `reject` sets `rejected` terminally',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_decision.sql',
            title:
              'a reject sets the review rejected immediately and terminally at version 2 [P2-S11-AC-109]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_decision.sql',
            title:
              'a rejected review accepts no further decision [P2-S11-AC-108]',
          },
        ],
      },
      {
        text: 'an `approve` sets `approved` exactly when the distinct qualifying approvers equal `requiredDecisionCount` and every specialist slot is held',
        citations: [
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
              'the first of two approvals leaves the review open at version 2 with no decidedAt [P2-S11-AC-109]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_decision.sql',
            title:
              'the second distinct approver reaches the required count: approved at version 3 with two distinct qualifying approvers [P2-S11-AC-109]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_decision.sql',
            title:
              'a base-only reviewer approves first: the base slot, the review stays open (one approval still possible for the specialist slot) [P2-S11-AC-109]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_reviews_guard.sql',
            title:
              'review: two qualifying approvers with every specialist slot held approve the protected review [P2-S11-AC-120]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_reviews_guard.sql',
            title:
              'review: two distinct approvers do not approve while the cms.reviewer.policy slot is held by no qualifying decision [P2-S11-AC-120]',
          },
        ],
      },
      {
        text: 'the audit record and one `cms.entry.review-changed.v1` commit with the CAS (`version` + 1).',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_decision.sql',
            title:
              'exactly one audit record and one identifier-only cms.entry.review-changed.v1 at the new review version commit with the decision [P2-S11-AC-016]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_decision.sql',
            title:
              'the single required approve reaches approved at version 2 with decidedAt set and the frozen policy evidence [P2-S11-AC-109]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S11-AC-110',
    text: "Qualifying approvers (CMS-03B-06): a recorded approve counts while its human holds the standing capability of the slot the decision satisfied and the human's assignment is not revoked; assignment expiry after the decision does not unwind it, while lapse of the standing grant (its `valid_through` day passing) or its revocation does; `distinctApprovalCount` is the live recount, and `recordedDecisionCount` is the number of decision rows and never exceeds `requiredDecisionCount` because the review leaves `open` at the decision that reaches it.",
    clauses: [
      {
        text: "Qualifying approvers (CMS-03B-06): a recorded approve counts while its human holds the standing capability of the slot the decision satisfied and the human's assignment is not revoked",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_approvers.sql',
            title:
              'one recorded approve by a holder of the slot capability counts [P2-S11-AC-110]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_approvers.sql',
            title:
              'an approve recorded for a slot capability the reviewer does not hold does not count [P2-S11-AC-110]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_approvers.sql',
            title:
              'a revoked assignment unwinds its approve at the next recount [P2-S11-AC-110]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_approvers.sql',
            title:
              'only the reviewer with the live assignment remains in the qualifying set [P2-S11-AC-110]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_approvers.sql',
            title:
              'a reject decision is never a qualifying approver [P2-S11-AC-110]',
          },
        ],
      },
      {
        text: 'assignment expiry after the decision does not unwind it',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_approvers.sql',
            title:
              'control: the assignment window already ended and the approve still counts (expiry does not unwind a decision) [P2-S11-AC-110]',
          },
        ],
      },
      {
        text: 'while lapse of the standing grant (its `valid_through` day passing) or its revocation does',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_approvers.sql',
            title:
              'a lapsed standing grant (valid_through passed) unwinds the approve [P2-S11-AC-110]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_approvers.sql',
            title:
              'losing the specialist slot capability unwinds that approve [P2-S11-AC-110]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_approvers.sql',
            title:
              'control: the capability back restores the count (the decision row never moved) [P2-S11-AC-110]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_approvers.sql',
            title:
              'an ended tenure unwinds the approve even though the grant row is intact [P2-S11-AC-110]',
          },
        ],
      },
      {
        text: '`distinctApprovalCount` is the live recount',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_approvers.sql',
            title:
              'the specialist approve brings the live recount to two [P2-S11-AC-110]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_review.sql',
            title:
              "distinctApprovalCount is the LIVE recount: after the approver's standing grant lapsed it is 0 while the recorded decision and the stored state are unchanged [P2-S11-AC-055]",
          },
        ],
      },
      {
        text: '`recordedDecisionCount` is the number of decision rows',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_reviews_guard.sql',
            title:
              'review: the recorded count must equal the number of decision rows [P2-S11-AC-120]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_review.sql',
            title:
              "distinctApprovalCount is the LIVE recount: after the approver's standing grant lapsed it is 0 while the recorded decision and the stored state are unchanged [P2-S11-AC-055]",
          },
        ],
      },
      {
        text: 'never exceeds `requiredDecisionCount` because the review leaves `open` at the decision that reaches it.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_reviews_guard.sql',
            title:
              'review: the recorded count never exceeds the required count [P2-S11-AC-120]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_reviews_guard.sql',
            title:
              'review: a review whose qualifying approvals reach the required count cannot stay open [P2-S11-AC-120]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_reviews_guard.sql',
            title:
              'review: the first rejection ends the review, it cannot stay open [P2-S11-AC-120]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_decision.sql',
            title:
              'the second distinct approver reaches the required count: approved at version 3 with two distinct qualifying approvers [P2-S11-AC-109]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S11-AC-111',
    text: "Review invalidation: a live review (`open` or `approved`) moves to `invalidated` with exactly one closed reason (`revision_superseded`, `dependency_changed`, `reviewer_authority_changed`, `entry_unavailable`) under CAS (`version` + 1), and the same transaction cancels the review's `pending` and `failed_retryable` schedules (`state` `cancelled`, `reasonCode` `approval_invalidated`, or `entry_unavailable` when that is the reason) and, for `entry_unavailable`, revokes the entry's unexpired preview tokens.",
    clauses: [
      {
        text: 'Review invalidation: a live review (`open` or `approved`) moves to `invalidated` with exactly one closed reason (`revision_superseded`, `dependency_changed`, `reviewer_authority_changed`, `entry_unavailable`) under CAS (`version` + 1)',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_invalidation.sql',
            title:
              'an open review is invalidated and the result names the review, the transition and the cascade counts [P2-S11-AC-111]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_invalidation.sql',
            title:
              'state invalidated, the reason recorded, version + 1 [P2-S11-AC-111]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_invalidation.sql',
            title: 'an approved review is invalidated as well [P2-S11-AC-111]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_invalidation.sql',
            title:
              'all four closed reasons are accepted and recorded [P2-S11-AC-111]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_invalidation.sql',
            title:
              'a reason outside the closed four is INVALID_REQUEST [P2-S11-AC-111]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_reviews_schema.sql',
            title:
              'review: the invalidation reason is the closed four-token union [P2-S11-AC-111]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_reviews_guard.sql',
            title:
              'review: an approved review is invalidated with one closed reason and CAS version + 1 [P2-S11-AC-111]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_reviews_guard.sql',
            title: 'review: an invalidated review is terminal [P2-S11-AC-111]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_invalidation.sql',
            title:
              'a rejected review is terminal and is never invalidated [P2-S11-AC-111]',
          },
        ],
      },
      {
        text: "the same transaction cancels the review's `pending` and `failed_retryable` schedules (`state` `cancelled`, `reasonCode` `approval_invalidated`, or `entry_unavailable` when that is the reason)",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_invalidation.sql',
            title:
              "the review's pending and failed_retryable schedules are cancelled in the same transaction [P2-S11-AC-111]",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_invalidation.sql',
            title:
              'a cancelled schedule records approval_invalidated and advances its version [P2-S11-AC-111]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_invalidation.sql',
            title:
              'a failed_retryable schedule is cancelled too [P2-S11-AC-111]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_invalidation.sql',
            title:
              'entry_unavailable cancels the schedule as well [P2-S11-AC-111]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_invalidation.sql',
            title:
              'with the schedule reason entry_unavailable, not approval_invalidated [P2-S11-AC-111]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_schedules_schema.sql',
            title:
              'schedule: approval invalidation cancels a pending schedule [P2-S11-AC-111]',
          },
          {
            tool: 'race',
            file: 'supabase/tests/phase_02_slice_11_races/015-schedule-accept-race.mjs',
            title:
              'S3: the append then invalidated the review and cancelled the pending schedule (approval_invalidated)',
          },
        ],
      },
      {
        text: "for `entry_unavailable`, revokes the entry's unexpired preview tokens.",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_invalidation.sql',
            title:
              "entry_unavailable revokes the entry's unexpired active tokens (all minters) [P2-S11-AC-118]",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_invalidation.sql',
            title:
              'a revoked token is state revoked, revoked_at set, version + 1 (CAS) [P2-S11-AC-118]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_invalidation.sql',
            title:
              'an already expired token is left alone (expiry is derived) [P2-S11-AC-118]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_invalidation.sql',
            title:
              "and revokes the entry's unexpired preview token [P2-S11-AC-118]",
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S11-AC-112',
    text: "Review invalidation producers: CMS-03B-01, CMS-03B-02 and CMS-03B-04 invalidate every live review of an older revision of the entry (`revision_superseded`) in the same transaction as the append; the revocation of a counted approver's standing capability calls `platform_private.cms_invalidate_reviews_for_person(person_id, capability)` in the revoking transaction, a lapsed grant is found lazily by the `revocation` preflight, and a counted approver's assignment revoked while the review is `open` also yields `reviewer_authority_changed`; the entry lifecycle leaving `active` (`archived`, `deletion_pending`, `held`) yields `entry_unavailable`.",
    clauses: [
      {
        text: 'Review invalidation producers: CMS-03B-01, CMS-03B-02 and CMS-03B-04 invalidate every live review of an older revision of the entry (`revision_superseded`) in the same transaction as the append',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_invalidation.sql',
            title:
              'appending a newer revision of the same locale invalidates the older live review revision_superseded [P2-S11-AC-112]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_invalidation.sql',
            title:
              'a revision of another locale does not supersede the review (the chain is per locale) [P2-S11-AC-112]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_invalidation.sql',
            title:
              'the newest review is superseded by the next append in turn [P2-S11-AC-112]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_invalidation.sql',
            title:
              'a review of the newest revision stays live until a newer one lands [P2-S11-AC-112]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_invalidation.sql',
            title:
              'the invalidation emitted its review-changed event [P2-S11-AC-112]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_invalidation.sql',
            title:
              'the producer triggers exist on the entry, the revision, the tenure and the actor grant [P2-S11-AC-112]',
          },
          {
            tool: 'race',
            file: 'supabase/tests/phase_02_slice_11_races/015-schedule-accept-race.mjs',
            title:
              'S3: the append then invalidated the review and cancelled the pending schedule (approval_invalidated)',
          },
        ],
      },
      {
        text: "the revocation of a counted approver's standing capability calls `platform_private.cms_invalidate_reviews_for_person(person_id, capability)` in the revoking transaction",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_invalidation.sql',
            title:
              'revoking the standing capability of the satisfied slot invalidates the approved review in the revoking transaction [P2-S11-AC-112]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_invalidation.sql',
            title:
              'every live review the approver counted in is invalidated [P2-S11-AC-112]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_invalidation.sql',
            title:
              'a review counted by another approver is untouched [P2-S11-AC-112]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_invalidation.sql',
            title:
              'losing a capability the approver did not rely on (the policy slot) leaves the review approved [P2-S11-AC-112]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_invalidation.sql',
            title:
              "ending the approver's tenure invalidates the reviews they counted in [P2-S11-AC-112]",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_invalidation.sql',
            title:
              'the capability argument filters by the slot a decision satisfied: a policy-slot call ignores a base-slot approve [P2-S11-AC-112]',
          },
        ],
      },
      {
        text: 'a lapsed grant is found lazily by the `revocation` preflight',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_preflight.sql',
            title:
              'schedule: a counted approver whose standing grant lapsed is found lazily: reviewer_authority_changed [P2-S11-AC-110]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_preflight.sql',
            title:
              'publish: the same lapse fails the publish phase [P2-S11-AC-110]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_publish_refusals.sql',
            title:
              'a counted approver whose standing cms.reviewer grant lapsed fails the revocation category: 422 preflight_failed (reviewer_authority_changed) [P2-S11-AC-096]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_schedule_refusals.sql',
            title:
              'a counted approver whose standing cms.reviewer grant lapsed fails the revocation category: 422 preflight_failed (reviewer_authority_changed) [P2-S11-AC-096]',
          },
        ],
      },
      {
        text: "a counted approver's assignment revoked while the review is `open` also yields `reviewer_authority_changed`",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_assign_authority.sql',
            title:
              'the open review is invalidated reviewer_authority_changed (version + 1, the recorded decision count kept) [P2-S11-AC-112]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_assign_authority.sql',
            title:
              'the two events carry strictly increasing aggregate versions [P2-S11-AC-112]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_decision_invalidation.sql',
            title:
              'a revoked assignment of a counted approver also leaves the review unable to be approved: reviewer_authority_changed [P2-S11-AC-112]',
          },
        ],
      },
      {
        text: 'the entry lifecycle leaving `active` (`archived`, `deletion_pending`, `held`) yields `entry_unavailable`.',
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Clause "the entry lifecycle leaving `active` (`archived`, `deletion_pending`, `held`) yields `entry_unavailable`" is uncited. phase_02_slice_11_helpers_invalidation.sql proves the transition only for lifecycle = archived (the live review becomes invalidated/entry_unavailable, the schedule is cancelled entry_unavailable, the token is revoked) and, for lifecycle = held, only that preview tokens are revoked when the entry has no live review; no test moves an entry to deletion_pending or to held while a live review exists and asserts entry_unavailable. The three-state set named in the clause is therefore not proven. (deletion_pending is only exercised by the separate preflight revocation check in helpers_preflight.sql.)',
  },
  {
    criterion: 'P2-S11-AC-113',
    text: 'Dependency recheck: `cms_editorial_review_dependencies (review_id, kind, ref_id)` is written only by `cms_submit_review` from the frozen manifest (kinds `schema`, `template`, `block`, `pattern`, `term`, `taxonomy_version`, `locale_source`, `relation_target`, `settings`), immutable, retained after invalidation and `UNIQUE(review_id, kind, ref_id)`; the consumers of `cms.schema.activated.v1`, `cms.template.activated.v1`, `cms.pattern.activated.v1`, `cms.taxonomy.changed.v1`, `cms.localization.changed.v1` and `cms.block.lifecycle.changed.v1` enqueue the job `cms.review.dependency_recheck` with `{ eventId, kind, refId }`, which selects live reviews through the index, rebuilds each manifest, invalidates on inequality or a non-current identity, is idempotent (an `invalidated` review is skipped) and handles at most 500 reviews per run with a continuation cursor.',
    clauses: [
      {
        text: 'Dependency recheck: `cms_editorial_review_dependencies (review_id, kind, ref_id)` is written only by `cms_submit_review` from the frozen manifest (kinds `schema`, `template`, `block`, `pattern`, `term`, `taxonomy_version`, `locale_source`, `relation_target`, `settings`)',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_manifest.sql',
            title:
              'dependency rows: schema, template, block (instances and template slots), pattern and the settings snapshot row id, one row per identity [P2-S11-AC-113]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_manifest.sql',
            title:
              "dependency rows: term, taxonomy_version (the revision's ids) and relation_target (distinct targets) kinds [P2-S11-AC-113]",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_manifest.sql',
            title:
              'dependency rows: the locale_source kind names the source revision [P2-S11-AC-113]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_submit.sql',
            title:
              'the ReviewDependency rows are exactly the (kind, ref_id) identities of the frozen manifest, written with the review [P2-S11-AC-113]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_review_dependencies_schema.sql',
            title:
              'dependency: kind is the closed nine-member union of the frozen manifest identities [P2-S11-AC-113]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_review_dependencies_schema.sql',
            title:
              'dependency: the submission writes a manifest identity of a review at its submission version [P2-S11-AC-113]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_review_dependencies_schema.sql',
            title:
              'dependency: every remaining manifest kind is accepted [P2-S11-AC-113]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_review_dependencies_schema.sql',
            title:
              'dependency: a review that has advanced past submission takes no further dependency rows [P2-S11-AC-113]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_submit_refusals.sql',
            title:
              'every refusal above left no review, dependency row, reservation, audit record or outbox event behind [P2-S11-AC-009]',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/jobs-observability.test.ts',
            title:
              '[P2-S11-AC-113] review dependency index and recheck job indexes the nine frozen dependency kinds',
          },
        ],
      },
      {
        text: 'immutable, retained after invalidation and `UNIQUE(review_id, kind, ref_id)`',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_review_dependencies_schema.sql',
            title: 'dependency: the row is version 1 forever [P2-S11-AC-113]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_review_dependencies_schema.sql',
            title:
              'dependency: updated_at equals created_at on immutable evidence [P2-S11-AC-113]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_review_dependencies_schema.sql',
            title:
              'dependency: the frozen manifest index is never edited [P2-S11-AC-113]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_review_dependencies_schema.sql',
            title:
              'dependency: the frozen manifest index is never deleted [P2-S11-AC-113]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_review_dependencies_schema.sql',
            title:
              'dependency: the rows persist after invalidation as history [P2-S11-AC-113]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_review_dependencies_schema.sql',
            title:
              'dependency: an identity is indexed once per review and kind [P2-S11-AC-113]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_review_dependencies_schema.sql',
            title:
              "dependency: one row per (review, kind, identity), a real review owner, and the recheck job's (kind, ref) index [P2-S11-AC-113]",
          },
        ],
      },
      {
        text: 'the consumers of `cms.schema.activated.v1`, `cms.template.activated.v1`, `cms.pattern.activated.v1`, `cms.taxonomy.changed.v1`, `cms.localization.changed.v1` and `cms.block.lifecycle.changed.v1` enqueue the job `cms.review.dependency_recheck` with `{ eventId, kind, refId }`',
        citations: [],
      },
      {
        text: 'which selects live reviews through the index, rebuilds each manifest, invalidates on inequality or a non-current identity',
        citations: [],
      },
      {
        text: 'is idempotent (an `invalidated` review is skipped)',
        citations: [],
      },
      {
        text: 'handles at most 500 reviews per run with a continuation cursor.',
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'The recheck job and its event consumers have no implementation, so four clauses are uncited: (1) "the consumers of cms.schema.activated.v1, cms.template.activated.v1, cms.pattern.activated.v1, cms.taxonomy.changed.v1, cms.localization.changed.v1 and cms.block.lifecycle.changed.v1 enqueue the job cms.review.dependency_recheck with { eventId, kind, refId }", (2) "selects live reviews through the index, rebuilds each manifest, invalidates on inequality or a non-current identity", (3) "is idempotent (an invalidated review is skipped)" and (4) "handles at most 500 reviews per run with a continuation cursor". Only the payload contract exists (packages/contracts/src/cms-editorial/jobs.ts, asserted by jobs-observability.test.ts at the schema level: the nine kinds, the strict { eventId, kind, refId } shape, the 500 constant and the job-type token); no Worker consumer, queue handler, SQL function or migration selects reviews by dependency or enqueues the job. The per-review invalidation primitive is idempotent (helpers_invalidation.sql "invalidating an already invalidated review is an idempotent no-op") but that is not the job.',
  },
  {
    criterion: 'P2-S11-AC-114',
    text: "Publication lineage (E3): `cms_publication_versions` rows are append-only (UPDATE and DELETE rejected, `updated_at = created_at`); a lineage is the sequence of rows for one `(entry_id, locale, audience)` with a stable `publication_id` (the first row's id) and `version` 1 then +1 per successor; `publish` rows are `active` and carry the full evidence while `unpublish`, `expire` and `archive` rows are `revoked` tombstones copying the ended row's revision and evidence; and a BEFORE INSERT trigger verifies lineage consistency (same `publication_id`, `entry_id`, `locale` and `audience` as `supersedes_id`, `version` previous + 1, `revoked` only after an `active` head, `publish` after `active` or `revoked`).",
    clauses: [
      {
        text: 'Publication lineage (E3): `cms_publication_versions` rows are append-only (UPDATE and DELETE rejected, `updated_at = created_at`)',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_lineage_append_only.sql',
            title:
              'appending a publish and a tombstone changes or removes no earlier lineage row [P2-S11-AC-114]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_lineage_append_only.sql',
            title:
              "the helper's role cannot UPDATE a lineage row (no privilege) [P2-S11-AC-114]",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_lineage_append_only.sql',
            title:
              "the helper's role cannot DELETE a lineage row (no privilege) [P2-S11-AC-114]",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_lineage_append_only.sql',
            title:
              "even the table owner's UPDATE of a lineage row is refused by the append-only guard [P2-S11-AC-114]",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_lineage_append_only.sql',
            title:
              "even the table owner's DELETE of a lineage row is refused by the append-only guard [P2-S11-AC-114]",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_publication_lineage_schema.sql',
            title:
              'lineage: a prior row is never updated, supersession is derived [P2-S11-AC-114]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_publication_lineage_schema.sql',
            title: 'lineage: a prior row is never deleted [P2-S11-AC-114]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_lineage.sql',
            title:
              'the row carries the entry owner, the publisher, the lineage keys and an activation instant; updated_at = created_at [P2-S11-AC-114]',
          },
        ],
      },
      {
        text: "a lineage is the sequence of rows for one `(entry_id, locale, audience)` with a stable `publication_id` (the first row's id) and `version` 1 then +1 per successor",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_lineage.sql',
            title:
              "for the first row the lineage id is the row id (the stable publication_id is the first row's id) [P2-S11-AC-114]",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_lineage.sql',
            title:
              "the lineage id is stable across rows (the first row's id) [P2-S11-AC-114]",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_lineage.sql',
            title:
              'two audiences of one entry are two lineages with two stable ids [P2-S11-AC-114]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_publication_lineage_schema.sql',
            title:
              'lineage: the lineage id of a first row is its own id [P2-S11-AC-114]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_publication_lineage_schema.sql',
            title:
              'lineage: the first publish row opens the lineage at version 1 [P2-S11-AC-114]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_publication_lineage_schema.sql',
            title:
              'lineage: a successor continues the sequence with the previous version + 1 [P2-S11-AC-114]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_publication_lineage_schema.sql',
            title:
              'lineage: a successor stays in the lineage of its predecessor [P2-S11-AC-114]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_publication_lineage_schema.sql',
            title:
              'lineage: physical rows stay active/revoked; the sequence is 1, 2, 3 with no gap [P2-S11-AC-115]',
          },
        ],
      },
      {
        text: '`publish` rows are `active` and carry the full evidence',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_publication_lineage_schema.sql',
            title:
              'lineage: a publish row is active, never revoked [P2-S11-AC-114]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_publication_lineage_schema.sql',
            title:
              'lineage: an active row records when it was activated [P2-S11-AC-114]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_lineage.sql',
            title:
              'exactly one append-only row exists: version 1, publish, active, no predecessor [P2-S11-AC-114]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_lineage.sql',
            title:
              'the evidence columns are projected from the version set and the request evidence [P2-S11-AC-114]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_publish.sql',
            title:
              "the lineage row stores the server-derived publisher, the review's dependency hash and activation evidence hash, the frozen version set and the publication hash [P2-S11-AC-114]",
          },
        ],
      },
      {
        text: "while `unpublish`, `expire` and `archive` rows are `revoked` tombstones copying the ended row's revision and evidence",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_publication_lineage_schema.sql',
            title:
              'lineage: a tombstone action is revoked, never active [P2-S11-AC-114]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_publication_lineage_schema.sql',
            title:
              "lineage: a tombstone copies the ended row's revision and evidence [P2-S11-AC-114]",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_publication_lineage_schema.sql',
            title:
              'lineage: a tombstone copies the settings ordinal too [P2-S11-AC-114]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_lineage.sql',
            title:
              "the tombstone copies the ended head's revision and evidence; revoked_at set, activated_at null [P2-S11-AC-114]",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_lineage.sql',
            title: 'expire appends a tombstone [P2-S11-AC-115]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_lineage.sql',
            title: 'archive appends a revoked tombstone [P2-S11-AC-115]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_execute.sql',
            title:
              'each tombstone is a revoked successor row at version 2 that names the ended head and the schedule and copies its revision and evidence, with revoked_at set and no activation [P2-S11-AC-114]',
          },
        ],
      },
      {
        text: 'a BEFORE INSERT trigger verifies lineage consistency (same `publication_id`, `entry_id`, `locale` and `audience` as `supersedes_id`, `version` previous + 1, `revoked` only after an `active` head, `publish` after `active` or `revoked`).',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_publication_lineage_schema.sql',
            title:
              'lineage: a successor continues the sequence with the previous version + 1 [P2-S11-AC-114]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_publication_lineage_schema.sql',
            title:
              'lineage: a successor stays in the lineage of its predecessor [P2-S11-AC-114]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_publication_lineage_schema.sql',
            title:
              'lineage: a lineage cannot begin with a tombstone [P2-S11-AC-114]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_publication_lineage_schema.sql',
            title:
              'lineage: expiry, archive and unpublish need an active head [P2-S11-AC-115]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_publication_lineage_schema.sql',
            title:
              'lineage: a revoked lineage is published again with a new head row [P2-S11-AC-115]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_publication_lineage_schema.sql',
            title: 'lineage: a row never supersedes itself [P2-S11-AC-114]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_publication_lineage_schema.sql',
            title:
              'lineage: a revision of another entry cannot be published under this entry [P2-S11-AC-114]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_publication_lineage_schema.sql',
            title:
              'lineage: the lineage locale is the revision locale [P2-S11-AC-114]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S11-AC-115',
    text: "Publication lineage (E3): the head of a lineage is its row with the greatest `version`, and a row's browser `state` is derived (`revoked` for a tombstone, `active` for the head `publish` row, `superseded` for a non-head `publish` row); two commands racing on one lineage collide on `UNIQUE (entry_id, locale, audience, version)` plus the lineage advisory lock and the loser is 409 `CONFLICT` `publication_conflict` with nothing committed; an unpublish, expiry or archive requires an `active` head (else 409 `publication_not_active`); and a revoked lineage may be published again.",
    clauses: [
      {
        text: "Publication lineage (E3): the head of a lineage is its row with the greatest `version`, and a row's browser `state` is derived (`revoked` for a tombstone, `active` for the head `publish` row, `superseded` for a non-head `publish` row)",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_lineage.sql',
            title: 'the head publish row is derived active [P2-S11-AC-115]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_lineage.sql',
            title: 'the previous head is derived superseded [P2-S11-AC-115]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_lineage.sql',
            title: 'the new head is derived active [P2-S11-AC-115]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_lineage.sql',
            title: 'a tombstone is derived revoked [P2-S11-AC-115]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_lineage.sql',
            title: 'the earlier publish row stays superseded [P2-S11-AC-115]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_publication_lineage_schema.sql',
            title:
              'lineage: superseded is derived and never stored [P2-S11-AC-115]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_publication_lineage_schema.sql',
            title:
              'lineage: a publish after an active head appends the next head row; the earlier row is superseded by derivation [P2-S11-AC-115]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_publish.sql',
            title:
              'the prior head is superseded by derivation (no row changed) and the successor names it [P2-S11-AC-115]',
          },
        ],
      },
      {
        text: 'two commands racing on one lineage collide on `UNIQUE (entry_id, locale, audience, version)` plus the lineage advisory lock and the loser is 409 `CONFLICT` `publication_conflict` with nothing committed',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_lineage_append_only.sql',
            title:
              'an append whose version a competing writer took first is refused as 409 publication_conflict, not a raw unique violation [P2-S11-AC-115]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_lineage_append_only.sql',
            title:
              "the refused append leaves no row behind: neither its own nor the competitor's [P2-S11-AC-115]",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_publication_lineage_schema.sql',
            title:
              'lineage: a successor of a row that is no longer the head loses with publication_conflict [P2-S11-AC-115]',
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
              'lineage: one row per lineage version replaces the one-active-row partial index [P2-S11-AC-115]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_lineage.sql',
            title:
              'the lineage advisory transaction lock (position 7) is held after the append [P2-S11-AC-115]',
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
      {
        text: 'an unpublish, expiry or archive requires an `active` head (else 409 `publication_not_active`)',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_lineage.sql',
            title:
              'a second tombstone on a revoked head is 409 publication_not_active [P2-S11-AC-115]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_lineage.sql',
            title:
              'archive on a revoked head is publication_not_active as well [P2-S11-AC-115]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_lineage.sql',
            title:
              'a lineage with no head at all (another audience) is publication_not_active [P2-S11-AC-115]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_lineage.sql',
            title: 'the refused appends wrote nothing [P2-S11-AC-115]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_publication_lineage_schema.sql',
            title:
              'lineage: expiry, archive and unpublish need an active head [P2-S11-AC-115]',
          },
        ],
      },
      {
        text: 'a revoked lineage may be published again.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_lineage.sql',
            title:
              'publish may follow a revoked head: version 4, the same lineage id [P2-S11-AC-115]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_publication_lineage_schema.sql',
            title:
              'lineage: a revoked lineage is published again with a new head row [P2-S11-AC-115]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S11-AC-116',
    text: "Publication lineage (E3): every appended row writes exactly one `cms.publication.changed.v1` with that row's id as `publicationVersionId`, the audit record and the idempotency record in one transaction; `publication_hash` is the lowercase SHA-256 of the JCS `{ action, audience, dependencyHash, entryId, locale, publicationId, revisionId, supersedesId, version, versionSet }`; and `projectionState` is read from Shard 04 `projection_consumer_state` for the row id (`pending` while no consumer has reported, `converged` when every registered consumer reports the row, `degraded` when a consumer failed terminally) without ever rolling back canonical state.",
    clauses: [
      {
        text: "Publication lineage (E3): every appended row writes exactly one `cms.publication.changed.v1` with that row's id as `publicationVersionId`, the audit record and the idempotency record in one transaction",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_lineage.sql',
            title:
              'exactly one cms.publication.changed.v1 is emitted for the appended row [P2-S11-AC-116]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_lineage.sql',
            title:
              'the payload is identifiers only: { entryId, publicationVersionId = the appended row id } [P2-S11-AC-116]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_lineage.sql',
            title: 'one audit row records the append [P2-S11-AC-116]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_lineage.sql',
            title: 'one event per appended row [P2-S11-AC-116]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_lineage.sql',
            title: 'the tombstone emitted its own event [P2-S11-AC-116]',
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
              'the idempotency reservation is completed with the 202 acceptance [P2-S11-AC-032]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_publish.sql',
            title:
              'each appended row emitted exactly one cms.publication.changed.v1 (three rows, three events) [P2-S11-AC-116]',
          },
        ],
      },
      {
        text: '`publication_hash` is the lowercase SHA-256 of the JCS `{ action, audience, dependencyHash, entryId, locale, publicationId, revisionId, supersedesId, version, versionSet }`',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_lineage.sql',
            title:
              'publication_hash is the SHA-256 of the literal JCS { action, audience, dependencyHash, entryId, locale, publicationId, revisionId, supersedesId, version, versionSet } [P2-S11-AC-116]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_lineage.sql',
            title:
              'the resource names the stored publication hash [P2-S11-AC-116]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_publication_lineage_schema.sql',
            title:
              'lineage: control - the fixture hash equals the SHA-256 of the hand-written canonical JSON (sorted keys, null predecessor) [P2-S11-AC-116]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_publication_lineage_schema.sql',
            title:
              'lineage: the stored publication hash is recomputed from the row [P2-S11-AC-116]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-publish-lineage.apispec.ts',
            title:
              'CMS-03B-09 append-only publication lineage [CMS-03B-09] first and successor publications independently match JCS hashes and exact fourteen-group append effects',
          },
        ],
      },
      {
        text: '`projectionState` is read from Shard 04 `projection_consumer_state` for the row id (`pending` while no consumer has reported, `converged` when every registered consumer reports the row, `degraded` when a consumer failed terminally) without ever rolling back canonical state.',
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Clause "`projectionState` is read from Shard 04 `projection_consumer_state` for the row id (`pending` while no consumer has reported, `converged` when every registered consumer reports the row, `degraded` when a consumer failed terminally) without ever rolling back canonical state" is uncited and its implementation is absent by decision: DEC-158(e) fixes projectionState at `pending` until a Shard 04 consumer reports (Slice 15). No migration references projection_consumer_state; supabase/migrations/20261005017590_cms_publication_lineage_append.sql and 20261005017900_cms_get_entry_workflow.sql emit the literal `pending`. Only the pending value is asserted (phase_02_slice_11_helpers_lineage.sql "the first publish is active, version 1, projectionState pending"); there is no read of consumer state, no converged or degraded branch and no test that a degraded consumer leaves canonical rows intact.',
  },
  {
    criterion: 'P2-S11-AC-117',
    text: 'Preview token (CMS-03B-08): the token is derived and never stored, `base64url(HMAC-SHA-256(key, "cms.preview.token.v1" followed by the JCS of { tokenId, nonce, entryId, revisionId }))` without padding (43 characters) under the Vault-held history-signing key; the table stores only `token_hash` (the lowercase SHA-256 of the token string, `UNIQUE`) and the binding evidence; `expiresAt` is exactly 900 seconds after creation (`CHECK expires_at = created_at + interval \'15 minutes\'`); an exact replay re-derives the identical token while it is unexpired and unrevoked; and a replay after expiry or revocation is 409 `CONFLICT` `preview_expired`, a new key minting a new token.',
    clauses: [
      {
        text: 'Preview token (CMS-03B-08): the token is derived and never stored, `base64url(HMAC-SHA-256(key, "cms.preview.token.v1" followed by the JCS of { tokenId, nonce, entryId, revisionId }))` without padding (43 characters) under the Vault-held history-signing key',
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
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_mint.sql',
            title:
              'the plaintext token is persisted nowhere: not in the token table, the idempotency record, the audit trail or the outbox [P2-S11-AC-117]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_mint.sql',
            title:
              'the stored idempotent response is the resource WITHOUT the token (the token is re-derived on replay) [P2-S11-AC-117]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_mint.sql',
            title:
              'after a key rotation an exact replay still re-derives the same token under the freshly retired key [P2-S11-AC-117]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_mint.sql',
            title:
              'a fresh mint after the rotation derives under the NEW active key [P2-S11-AC-117]',
          },
        ],
      },
      {
        text: 'the table stores only `token_hash` (the lowercase SHA-256 of the token string, `UNIQUE`) and the binding evidence',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_mint.sql',
            title:
              'the row holds the server-derived person, user and acting context, the capability snapshot (BE04c actingContextVersion), the exact binding, state active at version 1 and only the token SHA-256 [P2-S11-AC-118]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_preview_tokens_schema.sql',
            title:
              'token: only the lowercase SHA-256 of the token is stored, never the plaintext [P2-S11-AC-117]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_preview_tokens_schema.sql',
            title:
              'token: an active token is minted with its binding evidence and only the token hash [P2-S11-AC-117]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_preview_tokens_schema.sql',
            title:
              'token: a token hash identifies exactly one token [P2-S11-AC-117]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_preview_tokens_schema.sql',
            title:
              'token: entry owner and revision-of-entry keys, the unique token hash and the person, entry-state and live-expiry indexes [P2-S11-AC-117]',
          },
        ],
      },
      {
        text: "`expiresAt` is exactly 900 seconds after creation (`CHECK expires_at = created_at + interval '15 minutes'`)",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_preview_tokens_schema.sql',
            title:
              'token: the expiry is not earlier than exactly 900 seconds after creation [P2-S11-AC-117]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_preview_tokens_schema.sql',
            title:
              'token: the expiry is not later than exactly 900 seconds after creation [P2-S11-AC-117]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_preview_tokens_schema.sql',
            title:
              'token: the physical state is active|revoked (expired is derived), expiry is exactly 15 minutes and revoked_at tracks the state [P2-S11-AC-117]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_mint.sql',
            title:
              'the token expires exactly 900 seconds after it was created and the resource reports that instant [P2-S11-AC-117]',
          },
        ],
      },
      {
        text: 'an exact replay re-derives the identical token while it is unexpired and unrevoked',
        citations: [
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
              'the replay is marked with the x-cms-idempotent-replay response header [P2-S11-AC-026]',
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
        text: 'a replay after expiry or revocation is 409 `CONFLICT` `preview_expired`, a new key minting a new token.',
        citations: [
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
              'when no current key reproduces the stored hash the replay is preview_expired, never a different token [P2-S11-AC-117]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S11-AC-118',
    text: 'Preview token binding and revocation: `capability_snapshot_hash` is the SHA-256 of the JCS `{ actingPartyId, capabilities, personId }` (the sorted active `cms.*` capability keys of the person in the acting context) computed by `platform_private.cms_acting_context_version(person, acting_party)` and equal to the BE04c `actingContextVersion`; a token is revoked by CAS (`revoked_at`, state `revoked`, `version` + 1) when the minting person loses the capability or membership that granted preview scope, when the entry leaves `active` and through the service-role takedown RPC; and a version-set movement does not revoke it.',
    clauses: [
      {
        text: 'Preview token binding and revocation: `capability_snapshot_hash` is the SHA-256 of the JCS `{ actingPartyId, capabilities, personId }` (the sorted active `cms.*` capability keys of the person in the acting context)',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_acting_context.sql',
            title:
              'the creator hash is the SHA-256 of the literal JCS with the three sorted cms.* keys [P2-S11-AC-118]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_acting_context.sql',
            title: 'the editor hash covers exactly cms.editor [P2-S11-AC-118]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_acting_context.sql',
            title:
              'a confirmed member with no CMS grant hashes the empty capability list [P2-S11-AC-118]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_acting_context.sql',
            title:
              'a null acting party hashes actingPartyId null with no capabilities [P2-S11-AC-118]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_acting_context.sql',
            title:
              'grants outside the cms.* namespace (billing.admin, cmsx.editor, cms-editor) are never part of the snapshot [P2-S11-AC-118]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_acting_context.sql',
            title:
              'capabilities sort bytewise ascending (- before . before _) [P2-S11-AC-118]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_acting_context.sql',
            title:
              'negative control: the oracle is order-sensitive, so a wrongly ordered capability list would not match [P2-S11-AC-118]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_mint.sql',
            title:
              "each token is bound to its own minting person and that person's capability snapshot [P2-S11-AC-118]",
          },
        ],
      },
      {
        text: 'computed by `platform_private.cms_acting_context_version(person, acting_party)` and equal to the BE04c `actingContextVersion`',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_acting_context.sql',
            title:
              'cms_acting_context_version is a private SECURITY DEFINER function of the CMS definer with an empty search_path and no API-role execute [P2-S11-AC-118]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_acting_context.sql',
            title:
              'the value is lowercase 64-hex and deterministic [P2-S11-AC-118]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_acting_context.sql',
            title:
              'different persons, capability sets and acting parties yield different versions [P2-S11-AC-118]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_mint.sql',
            title:
              'the row holds the server-derived person, user and acting context, the capability snapshot (BE04c actingContextVersion), the exact binding, state active at version 1 and only the token SHA-256 [P2-S11-AC-118]',
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
              'a granted capability changes the context version: the token verifies only against the version it was minted under (and scope now holds as a publisher) [P2-S11-AC-118]',
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
        text: 'a token is revoked by CAS (`revoked_at`, state `revoked`, `version` + 1) when the minting person loses the capability or membership that granted preview scope, when the entry leaves `active`',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_preview_tokens_schema.sql',
            title:
              'token: authority loss revokes by CAS (state revoked, revoked_at, version + 1) [P2-S11-AC-118]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_preview_tokens_schema.sql',
            title:
              'token: the only transition is active to revoked [P2-S11-AC-118]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_preview_tokens_schema.sql',
            title:
              'token: a revoked token is never reactivated [P2-S11-AC-118]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_invalidation.sql',
            title:
              "revoking the creator's assignment revokes the creator's token on that entry [P2-S11-AC-118]",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_invalidation.sql',
            title:
              "ending the publisher's tenure revokes the publisher's token [P2-S11-AC-118]",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_invalidation.sql',
            title:
              "deactivating the editor's standing grant (which also revokes the assignment, DEC-143) revokes the editor's token [P2-S11-AC-118]",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_invalidation.sql',
            title:
              "and revokes the entry's unexpired preview token [P2-S11-AC-118]",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_invalidation.sql',
            title:
              "entry_unavailable revokes the entry's unexpired active tokens (all minters) [P2-S11-AC-118]",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_invalidation.sql',
            title:
              'a revoked token is state revoked, revoked_at set, version + 1 (CAS) [P2-S11-AC-118]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_invalidation.sql',
            title:
              'an entry with no live review still has its tokens revoked when it leaves active (held) [P2-S11-AC-118]',
          },
          {
            tool: 'race',
            file: 'supabase/tests/phase_02_slice_11_races/020-preview-mint-race.mjs',
            title: 'M3: the verifier reports the token revoked for its owner',
          },
          {
            tool: 'race',
            file: 'supabase/tests/phase_02_slice_11_races/020-preview-mint-race.mjs',
            title:
              'M5: the mint commits, then the archive revokes the token of the entry that left `active`',
          },
        ],
      },
      {
        text: 'through the service-role takedown RPC',
        citations: [],
      },
      {
        text: 'a version-set movement does not revoke it.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_invalidation.sql',
            title:
              'a dependency change revokes no preview token (a version-set movement does not revoke it) [P2-S11-AC-118]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_invalidation.sql',
            title: 'the live token is still active [P2-S11-AC-118]',
          },
        ],
      },
    ],
    status: 'partial',
    limitation:
      'Clause "through the service-role takedown RPC" is uncited. platform_private.cms_revoke_preview_tokens (accepts reasonCode takedown) is a database-internal seam with no platform_api wrapper and no API grant (phase_02_slice_11_rpc_preview_revoke.sql "nobody can execute and has no platform_api wrapper"); the service-role takedown RPC that calls it is the Shard 16 takedown RPC and does not exist in Slice 11. The seam is exercised with the takedown reason by entry target (rpc_preview_revoke.sql lines 77-86: count, CAS, idempotence) but never as a service_role caller, because nothing service-role callable exists.',
  },
  {
    criterion: 'P2-S11-AC-119',
    text: "Persistence `cms_editorial_review_assignments`: rows are created only by `cms_assign_editorial_reviewer` (create) and moved `active` to `revoked` only by its revoke action (advancing `version` and `updated_at`), with `capability_key` fixed to `cms.editorial_review`, `actions` fixed to `read` and `decide`, `ends_at` after `starts_at` and at most seven days later, `UNIQUE(review_id, reviewer_person_id) WHERE state = 'active'`, decide authority only while `starts_at <= now < ends_at` on a non-revoked row and read authority on any non-revoked row, no stored acting context, owner authority or delegation, UPDATE and DELETE and direct grants revoked, and forced RLS.",
    clauses: [
      {
        text: 'Persistence `cms_editorial_review_assignments`: rows are created only by `cms_assign_editorial_reviewer` (create) and moved `active` to `revoked` only by its revoke action',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_schema_posture.sql',
            title:
              'posture: a write outside the CMS RPC context is refused before any constraint on every Slice 11 table [P2-S11-AC-119]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_assign.sql',
            title:
              'the row stores the server-resolved reviewer and grantor, the fixed capability and actions, and the requested window [P2-S11-AC-119]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_assign.sql',
            title:
              'revoking returns the same assignment, revoked, at version 2 [P2-S11-AC-067]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_assign.sql',
            title:
              'the revoke moves only the assignment (active -> revoked, version + 1); the review is untouched [P2-S11-AC-070]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_review_assignments_guard.sql',
            title:
              'assignment: revocation moves active to revoked with version + 1 [P2-S11-AC-119]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_review_assignments_guard.sql',
            title:
              'assignment: the only transition is active to revoked [P2-S11-AC-119]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_review_assignments_guard.sql',
            title:
              'assignment: a revoked assignment is never re-activated [P2-S11-AC-119]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_review_assignments_guard.sql',
            title:
              'assignment: the window never moves after creation [P2-S11-AC-119]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_review_assignments_guard.sql',
            title: 'assignment: the reviewer never changes [P2-S11-AC-119]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_review_assignments_guard.sql',
            title:
              'assignment: the stored reason never changes [P2-S11-AC-119]',
          },
        ],
      },
      {
        text: '(advancing `version` and `updated_at`)',
        citations: [],
      },
      {
        text: 'with `capability_key` fixed to `cms.editorial_review`, `actions` fixed to `read` and `decide`',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_review_assignments_schema.sql',
            title:
              'assignment: the assignment capability is fixed to cms.editorial_review [P2-S11-AC-119]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_review_assignments_schema.sql',
            title:
              'assignment: the actions are exactly read and decide, never edit, publish, assign or admin [P2-S11-AC-119]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_review_assignments_schema.sql',
            title:
              'assignment: an assignment cannot be broadened with another action [P2-S11-AC-119]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_assign.sql',
            title:
              'a created assignment is active at version 1, confers exactly read and decide on this review and carries a null reason when none was given [P2-S11-AC-067]',
          },
        ],
      },
      {
        text: '`ends_at` after `starts_at` and at most seven days later',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_review_assignments_schema.sql',
            title:
              'assignment: the window must end after it starts [P2-S11-AC-119]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_review_assignments_schema.sql',
            title:
              'assignment: the window is at most seven days [P2-S11-AC-119]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_review_assignments_schema.sql',
            title:
              'assignment: control - a window of exactly seven days is accepted [P2-S11-AC-119]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_assign.sql',
            title:
              'the window ends at the requested expiry, after it starts and within seven days [P2-S11-AC-068]',
          },
        ],
      },
      {
        text: "`UNIQUE(review_id, reviewer_person_id) WHERE state = 'active'`",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_review_assignments_schema.sql',
            title:
              'assignment: one active assignment per reviewer and review plus the three locked indexes [P2-S11-AC-119]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_review_assignments_guard.sql',
            title:
              'assignment: a reviewer holds at most one active assignment per review [P2-S11-AC-119]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_assign.sql',
            title:
              'after a revoke the same reviewer can be assigned again (only an active row occupies the unique slot) [P2-S11-AC-119]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_assign_refusals.sql',
            title:
              'a second assignment of a reviewer who holds an active row is assignment_exists, even when that row is expired but not revoked [P2-S11-AC-071]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_review_assignments_guard.sql',
            title:
              'assignment: a revocation frees a slot and the revoked reviewer is assigned again only as a new row [P2-S11-AC-119]',
          },
        ],
      },
      {
        text: 'decide authority only while `starts_at <= now < ends_at` on a non-revoked row and read authority on any non-revoked row',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_decision_refusals.sql',
            title:
              'a readable review without an EFFECTIVE assignment (window over, not started, submitter, publisher, owner) is 403 capability_missing [P2-S11-AC-013]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_review_decisions_schema.sql',
            title:
              'decision: a revoked assignment authorizes no decision [P2-S11-AC-121]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_review_decisions_schema.sql',
            title:
              'decision: an assignment whose window has ended authorizes no decision [P2-S11-AC-121]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_review_decisions_schema.sql',
            title:
              'decision: a decision before the assignment window opens is refused [P2-S11-AC-121]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_scopes.sql',
            title:
              'a reviewer with a non-revoked assignment (an expired window still reads) holds reviewer [P2-S11-AC-069]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_scopes.sql',
            title: 'a revoked assignment grants no read scope [P2-S11-AC-069]',
          },
        ],
      },
      {
        text: 'no stored acting context, owner authority or delegation',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_review_assignments_schema.sql',
            title:
              'assignment: the locked column set, nullability and defaults exist [P2-S11-AC-119]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_review_assignments_schema.sql',
            title:
              'assignment: the owner is the review owner, never another party [P2-S11-AC-119]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_assign.sql',
            title:
              'the response names no reviewer, grantor, owner, party or account identifier [P2-S11-AC-069]',
          },
        ],
      },
      {
        text: 'UPDATE and DELETE and direct grants revoked',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_schema_posture.sql',
            title:
              'posture: anon, authenticated and service_role hold no privilege on any Slice 11 table [P2-S11-AC-119]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_review_assignments_guard.sql',
            title:
              'assignment: an assignment is history and is never deleted [P2-S11-AC-119]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_schema_posture.sql',
            title:
              'posture: a write outside the CMS RPC context is refused before any constraint on every Slice 11 table [P2-S11-AC-119]',
          },
        ],
      },
      {
        text: 'forced RLS.',
        citations: [
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
              'posture: each Slice 11 table has exactly one policy, the CMS RPC-context gate [P2-S11-AC-119]',
          },
        ],
      },
    ],
    status: 'partial',
    limitation:
      'Clause "(advancing `version` and `updated_at`)" is uncited: the revoke advancing `version` by exactly one is proven (review_assignments_guard.sql "a revoke advances the CAS version by exactly one"), but no test asserts that `updated_at` advances on revoke. The guard only rejects an updated_at that moves backwards and every guard test supplies its own fresh updated_at, so a revoke that left updated_at unchanged would pass.',
  },
  {
    criterion: 'P2-S11-AC-120',
    text: "Persistence `cms_editorial_reviews`: the frozen revision, dependency, activation and workflow-policy evidence is immutable and only the named review CAS RPCs advance `state`, the recorded count, `version` and `updated_at`; `UNIQUE(revision_id) WHERE state IN ('open','approved')` allows one live review per revision; and the CHECKs tie `state = invalidated` to `invalidated_reason`, `approved` and `rejected` to `decided_at`, `recorded_decision_count` to at most `required_decision_count` (1 to 8), and a `protected` review to at least 2 decisions and a non-empty `required_capabilities`, with `submitted_by` and the policy evidence server-derived.",
    clauses: [
      {
        text: 'Persistence `cms_editorial_reviews`: the frozen revision, dependency, activation and workflow-policy evidence is immutable',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_reviews_guard.sql',
            title:
              'review: the frozen hash is immutable evidence [P2-S11-AC-120]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_reviews_guard.sql',
            title:
              'review: the frozen dependency manifest is immutable evidence [P2-S11-AC-120]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_reviews_guard.sql',
            title:
              'review: the frozen workflow policy evidence is immutable [P2-S11-AC-120]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_reviews_guard.sql',
            title: 'review: the submitter is immutable [P2-S11-AC-120]',
          },
        ],
      },
      {
        text: 'and only the named review CAS RPCs advance `state`, the recorded count, `version` and `updated_at`',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_schema_posture.sql',
            title:
              'posture: a write outside the CMS RPC context is refused before any constraint on every Slice 11 table [P2-S11-AC-119]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_reviews_guard.sql',
            title:
              'review: a transition must advance the version by exactly one [P2-S11-AC-120]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_reviews_guard.sql',
            title:
              'review: an update that records no decision and no invalidation is refused [P2-S11-AC-120]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_reviews_guard.sql',
            title:
              'review: approval is only reachable with the decision count advanced by one [P2-S11-AC-120]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_reviews_guard.sql',
            title: 'review: updated_at never moves backwards [P2-S11-AC-120]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_reviews_guard.sql',
            title:
              'review: the recorded count must equal the number of decision rows [P2-S11-AC-120]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_reviews_guard.sql',
            title: 'review: an approved review never reopens [P2-S11-AC-120]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_reviews_guard.sql',
            title: 'review: a rejected review is terminal [P2-S11-AC-120]',
          },
        ],
      },
      {
        text: "`UNIQUE(revision_id) WHERE state IN ('open','approved')` allows one live review per revision",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_reviews_guard.sql',
            title:
              'review: a second live review of the same revision is refused [P2-S11-AC-120]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_reviews_guard.sql',
            title:
              'review: after an invalidation the same revision can be resubmitted as a new open review [P2-S11-AC-111]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_reviews_schema.sql',
            title:
              'review: the latest-review, entry-state and submitter indexes of the locked schema exist [P2-S11-AC-120]',
          },
          {
            tool: 'race',
            file: 'supabase/tests/phase_02_slice_11_races/012-review-submit-race.mjs',
            title: 'C1: one open review, its dependency rows and one event',
          },
        ],
      },
      {
        text: 'the CHECKs tie `state = invalidated` to `invalidated_reason`, `approved` and `rejected` to `decided_at`',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_reviews_schema.sql',
            title:
              'review: state invalidated holds exactly when a reason is stored, and approved/rejected exactly when decided_at is stored [P2-S11-AC-120]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_reviews_schema.sql',
            title:
              'review: an invalidated review must carry its reason [P2-S11-AC-111]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_reviews_schema.sql',
            title:
              'review: a reason on a review that is not invalidated is refused [P2-S11-AC-111]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_reviews_schema.sql',
            title:
              'review: an approved review must carry decided_at [P2-S11-AC-120]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_reviews_schema.sql',
            title:
              'review: an open review cannot carry decided_at [P2-S11-AC-120]',
          },
        ],
      },
      {
        text: '`recorded_decision_count` to at most `required_decision_count`',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_reviews_guard.sql',
            title:
              'review: the recorded count never exceeds the required count [P2-S11-AC-120]',
          },
        ],
      },
      {
        text: '(1 to 8)',
        citations: [],
      },
      {
        text: 'a `protected` review to at least 2 decisions',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_reviews_schema.sql',
            title:
              'review: a protected review needs at least two decisions [P2-S11-AC-120]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_reviews_guard.sql',
            title:
              'review: a protected review with two decisions and a specialist slot is created [P2-S11-AC-120]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_reviews_guard.sql',
            title:
              'review: one approval of two required does not approve a protected review [P2-S11-AC-120]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_submit.sql',
            title:
              'a protected policy freezes riskClass protected, two required decisions and the specialist slot from the manifest evidence [P2-S11-AC-120]',
          },
        ],
      },
      {
        text: 'a non-empty `required_capabilities`',
        citations: [],
      },
      {
        text: 'with `submitted_by` and the policy evidence server-derived.',
        citations: [
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
              'the review is open at version 1 and freezes the revision hash, the dependency hash, the activation evidence and the strictest-of workflow policy evidence of the manifest [P2-S11-AC-005]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_reviews_guard.sql',
            title: 'review: the submitter is immutable [P2-S11-AC-120]',
          },
        ],
      },
    ],
    status: 'partial',
    limitation:
      'Two clauses are uncited. (1) "(1 to 8)": no test inserts a review with required_decision_count 0, 9 or negative, or accepts 1 and 8 as the boundary values; phase_02_slice_11_reviews_schema.sql and phase_02_slice_11_reviews_guard.sql only exercise 1 and 2 (the recorded-count ceiling is proven, the 1..8 range of the required count is not). (2) "a non-empty `required_capabilities`": no test creates a review (protected or ordinary) with an empty or missing required_capabilities list and expects refusal; the row builder always supplies ["cms.reviewer"], and the only protected-review refusal (reviews_schema.sql "a protected review needs at least two decisions") fires the count rule alone.',
  },
  {
    criterion: 'P2-S11-AC-121',
    text: "Persistence `cms_editorial_decisions`: rows are append-only (UPDATE and DELETE rejected, `updated_at = created_at`) with `UNIQUE(review_id, reviewer_person_id)`, `step_up_at` NOT NULL (E10), `assignment_id` and `assignment_version` recorded, `capability` the satisfied slot (the base slot `cms.reviewer` for a reject), the reviewer, slot capability and MFA instant server-derived, a caller `capability` or `stepUpAt` an unknown key, and a BEFORE INSERT trigger forbidding a `reviewer_person_id` equal to the review's `submitted_by` or the revision's `author_person_id`.",
    clauses: [
      {
        text: 'Persistence `cms_editorial_decisions`: rows are append-only (UPDATE and DELETE rejected',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_review_decisions_schema.sql',
            title:
              'decision: decision evidence is append-only and is never edited [P2-S11-AC-121]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_review_decisions_schema.sql',
            title:
              'decision: decision evidence is never deleted [P2-S11-AC-121]',
          },
        ],
      },
      {
        text: '`updated_at = created_at`)',
        citations: [],
      },
      {
        text: 'with `UNIQUE(review_id, reviewer_person_id)`',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_review_decisions_schema.sql',
            title:
              'decision: one decision per reviewer per review [P2-S11-AC-121]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_decision.sql',
            title:
              'one human records at most one decision per review [P2-S11-AC-108]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_decision_refusals.sql',
            title:
              'a second decision by the same human is 409 duplicate_decision [P2-S11-AC-108]',
          },
        ],
      },
      {
        text: '`step_up_at` NOT NULL (E10)',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_review_decisions_schema.sql',
            title:
              'decision: the authorizing assignment is recorded and the binding MFA instant is NOT NULL (E10) [P2-S11-AC-121]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_review_decisions_schema.sql',
            title:
              'decision: a decision without the binding MFA instant is refused [P2-S11-AC-121]',
          },
        ],
      },
      {
        text: '`assignment_id` and `assignment_version` recorded',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_review_decisions_schema.sql',
            title:
              'decision: the authorizing assignment is recorded and the binding MFA instant is NOT NULL (E10) [P2-S11-AC-121]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_review_decisions_schema.sql',
            title:
              'decision: the recorded assignment version is positive [P2-S11-AC-121]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_review_decisions_schema.sql',
            title:
              "decision: the recorded assignment version must be the assignment's current version [P2-S11-AC-121]",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_review_decisions_schema.sql',
            title:
              "decision: another reviewer's assignment cannot authorize this reviewer [P2-S11-AC-121]",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_review_decisions_schema.sql',
            title:
              'decision: an assignment of another review cannot authorize this review [P2-S11-AC-121]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_decision.sql',
            title:
              'the decision row stores the server-derived reviewer, slot, assignment, MFA instant, frozen reviewed hash, reason and its SHA-256 comment hash [P2-S11-AC-109]',
          },
        ],
      },
      {
        text: '`capability` the satisfied slot (the base slot `cms.reviewer` for a reject)',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_review_decisions_schema.sql',
            title:
              'decision: a reject always carries the base slot cms.reviewer [P2-S11-AC-109]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_review_decisions_schema.sql',
            title:
              'decision: the satisfied slot is a slot of the frozen workflow policy [P2-S11-AC-109]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_decision.sql',
            title:
              'the reject row carries the base slot capability cms.reviewer [P2-S11-AC-121]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_decision.sql',
            title:
              'the specialist approves: the first unfilled specialist slot they hold is satisfied and the review is approved [P2-S11-AC-109]',
          },
        ],
      },
      {
        text: 'the reviewer, slot capability and MFA instant server-derived',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_decision.sql',
            title:
              'the decision row stores the server-derived reviewer, slot, assignment, MFA instant, frozen reviewed hash, reason and its SHA-256 comment hash [P2-S11-AC-109]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-decision-policy.apispec.ts',
            title:
              'CMS-03B-06 ordinary decision policy and persistence [CMS-03B-06] approve appends one assignment-bound decision with exact policy, count, privacy and atomic effects; replay is inert',
          },
        ],
      },
      {
        text: 'a caller `capability` or `stepUpAt` an unknown key',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_decision_refusals.sql',
            title:
              'a caller capability or stepUpAt is an unknown key, and a missing reason or malformed review id is INVALID_REQUEST [P2-S11-AC-012]',
          },
        ],
      },
      {
        text: "a BEFORE INSERT trigger forbidding a `reviewer_person_id` equal to the review's `submitted_by` or the revision's `author_person_id`.",
        citations: [
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
            file: 'supabase/tests/phase_02_slice_11_rpc_review_decision_refusals.sql',
            title:
              'the review submitter and the revision author are 403 separation_of_duties even with an effective assignment [P2-S11-AC-108]',
          },
        ],
      },
    ],
    status: 'partial',
    limitation:
      'Clause "`updated_at = created_at`" (the second append-only member) is uncited: review_decisions_schema.sql proves that UPDATE and DELETE of a decision are refused ("decision evidence is append-only and is never edited" / "never deleted") but no test inserts a decision whose updated_at differs from created_at and expects refusal, and none asserts the stored equality. (phase_02_slice_11_review_dependencies_schema.sql asserts the same rule for dependency rows, not decisions.)',
  },
  {
    criterion: 'P2-S11-AC-122',
    text: "Persistence `cms_publication_schedules`: `state` is one of `pending`, `executing`, `completed`, `failed_retryable`, `blocked`, `cancelled`; `reason_code` is non-null exactly for `blocked` and `cancelled` and one of the six closed tokens; `attempt_count` is 0 to 3; `audience` follows `^[a-z0-9_-]{1,48}$`; `expected_version` is the approved review's version at acceptance; `UNIQUE(entry_id, revision_id, action, local_datetime, timezone, audience)` prevents a duplicate schedule; the lease, retry and `actual_at_utc`/`deviation_seconds` columns exist; and `owner_id` and `created_by` are server-derived with worker and command CAS on `state` and `version`.",
    clauses: [
      {
        text: 'Persistence `cms_publication_schedules`: `state` is one of `pending`, `executing`, `completed`, `failed_retryable`, `blocked`, `cancelled`',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_remaining_schema/002-decisions-schedules-publications.sqlinc',
            title:
              'schedule state, action and DST disambiguation are closed unions',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_schedules_schema.sql',
            title: 'schedule: a schedule is created pending [P2-S11-AC-122]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_schedules_schema.sql',
            title:
              'schedule: the claim moves pending to executing with a lease and version + 1 [P2-S11-AC-122]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_schedules_schema.sql',
            title:
              'schedule: execution completes the schedule with its actual instant and deviation [P2-S11-AC-122]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_schedules_schema.sql',
            title:
              'schedule: approval invalidation cancels a pending schedule [P2-S11-AC-111]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_schedules_schema.sql',
            title: 'schedule: a completed schedule is terminal [P2-S11-AC-122]',
          },
        ],
      },
      {
        text: '`reason_code` is non-null exactly for `blocked` and `cancelled` and one of the six closed tokens',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_schedules_schema.sql',
            title:
              'schedule: reason_code is the closed six-token catalog and is stored exactly when blocked or cancelled [P2-S11-AC-122]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_schedules_schema.sql',
            title:
              'schedule: a reason outside the closed catalog is refused [P2-S11-AC-122]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_schedules_schema.sql',
            title:
              'schedule: a blocked schedule must carry its reason [P2-S11-AC-122]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_schedules_schema.sql',
            title:
              'schedule: a pending schedule carries no reason [P2-S11-AC-122]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_schedules_schema.sql',
            title:
              'schedule: control - a blocked schedule with a closed reason is accepted [P2-S11-AC-122]',
          },
        ],
      },
      {
        text: '`attempt_count` is 0 to 3',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_schedules_schema.sql',
            title: 'schedule: attempt_count is 0 to 3 [P2-S11-AC-122]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_schedules_schema.sql',
            title:
              'schedule: a fourth retryable failure is not representable (attempt_count is 0 to 3) [P2-S11-AC-122]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_schedules_schema.sql',
            title:
              'schedule: three retryable failures count attempts 1, 2 and 3 and each is claimed again [P2-S11-AC-122]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_schedules_schema.sql',
            title:
              'schedule: retries_exhausted is recorded only after three failed attempts, not two [P2-S11-AC-122]',
          },
        ],
      },
      {
        text: '`audience` follows `^[a-z0-9_-]{1,48}$`',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_schedules_schema.sql',
            title:
              'schedule: the audience follows ^[a-z0-9_-]{1,48}$ (no upper case) [P2-S11-AC-122]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_schedules_schema.sql',
            title:
              'schedule: the audience is at most 48 characters [P2-S11-AC-122]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_schedules_schema.sql',
            title:
              'schedule: control - a 48-character audience is accepted [P2-S11-AC-122]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_schedules_schema.sql',
            title:
              'schedule: the audience is fixed at acceptance [P2-S11-AC-122]',
          },
        ],
      },
      {
        text: "`expected_version` is the approved review's version at acceptance",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_schedules_schema.sql',
            title:
              "schedule: expected_version is the approved review's version at acceptance [P2-S11-AC-122]",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_schedules_schema.sql',
            title:
              'schedule: the approved-review version is fixed at acceptance [P2-S11-AC-122]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_schedules_schema.sql',
            title:
              'schedule: only an approved review can be scheduled [P2-S11-AC-122]',
          },
        ],
      },
      {
        text: '`UNIQUE(entry_id, revision_id, action, local_datetime, timezone, audience)` prevents a duplicate schedule',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_schedules_schema.sql',
            title:
              'schedule: duplicates are keyed by audience too, and entry owner, revision-of-entry and review-of-revision are keys [P2-S11-AC-122]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_schedules_schema.sql',
            title:
              'schedule: the same revision, action, local time, zone and audience is not scheduled twice [P2-S11-AC-122]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_schedules_schema.sql',
            title:
              'schedule: the same local time for another audience is a different schedule [P2-S11-AC-122]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_schedule.sql',
            title:
              'a second schedule of the same action, local time, timezone and audience under another key is a CONFLICT and changes nothing [P2-S11-AC-020]',
          },
        ],
      },
      {
        text: 'the lease, retry and `actual_at_utc`/`deviation_seconds` columns exist',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_schedules_schema.sql',
            title:
              'schedule: the review, audience, attempt, retry, lease and reason columns exist [P2-S11-AC-122]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_schedules_schema.sql',
            title:
              'schedule: a completed schedule records when it ran [P2-S11-AC-122]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_schedules_schema.sql',
            title:
              'schedule: the run time and its deviation are recorded together [P2-S11-AC-122]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_schedules_schema.sql',
            title:
              'schedule: only a completed schedule records its run [P2-S11-AC-122]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_schedules_schema.sql',
            title:
              'schedule: an executing schedule holds a lease [P2-S11-AC-122]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_schedules_schema.sql',
            title:
              'schedule: only an executing schedule holds a lease [P2-S11-AC-122]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_schedules_schema.sql',
            title:
              'schedule: a retryable failure names its next attempt [P2-S11-AC-122]',
          },
        ],
      },
      {
        text: '`owner_id` and `created_by` are server-derived with worker and command CAS on `state` and `version`.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_schedules_schema.sql',
            title:
              'schedule: the owner is the entry owner, never another party [P2-S11-AC-122]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_schedules_schema.sql',
            title:
              'schedule: the creator is server-derived and never changes [P2-S11-AC-122]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_schedule.sql',
            title:
              'the schedule row stores the server-derived owner, publisher, review and its version, dependency and activation hashes and the verified time fields [P2-S11-AC-122]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_schedules_schema.sql',
            title:
              'schedule: a transition advances the CAS version by exactly one [P2-S11-AC-122]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_schedules_schema.sql',
            title:
              'schedule: an executing schedule is never cancelled, an invalidated approval blocks it (DEC-158 d) [P2-S11-AC-122]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_execute.sql',
            title:
              'a stale lease, a stale version and a schedule that was never claimed are refused (CONFLICT / VERSION_MISMATCH) with no effect [P2-S11-AC-080]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_invalidation.sql',
            title:
              'a cancelled schedule records approval_invalidated and advances its version [P2-S11-AC-111]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
];
