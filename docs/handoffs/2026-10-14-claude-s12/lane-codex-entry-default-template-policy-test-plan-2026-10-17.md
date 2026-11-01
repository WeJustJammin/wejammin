# DEC-202 entry-default policy QA extension plan

Status: DESIGN ONLY / author UNRUN, 2026-10-17. Only this report is released.
No SQL, tests, fixtures, production definitions, tracker, or existing reports changed.
No parser, formatter, tests, database, Docker, Git, network, or project runtime run.
Paths below are relative to `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`.

## Authority and frozen baseline

- DEC-202: `.memory/wiki/decisions.md:5324–5336`; approved propagation retains all eleven receiving checks OPEN.
- Initial-create contract: `.memory/wiki/specs/be/03b-editorial-workflow-publication.md:1721–1729,1731–1751,2085`.
- Receiving checks: `.memory/pipeline/progress/slices/phase-02-slice-12.md:3314–3324` (AC286–296).
- Frozen driver: `supabase/tests/phase_02_slice_12_entry_default_template.sql`, 297 lines, 76 checks,
  SHA256 `ca782111c89abd51930c03e018828b16654f031ab99d349821296ca41b9df938`.
- Read companion reports `lane-codex-entry-default-template-design-2026-10-17.md:7–99` and
  `lane-codex-entry-default-template-red-2026-10-17.md:1–270` in this handoff directory.
- Root reports actual public-create baseline **76 / 70 PASS / 6 FAIL**, default-pin/slot failures only;
  all least-privilege premises pass. This author did not execute or independently reproduce that receipt.
  The older 40-check receipt in the RED report is a different test identity, not the 76-check receipt.

Eligible superseded defaults must retain the exact old pin, not select a newer active template.
Retired/blocked defaults map to `P0001 / CONFLICT`; missing/concealed to `P0001 / NOT_FOUND`
without details; incompatible to `P0001 / VALIDATION_FAILED`, DETAIL exactly `["/contentTypeVersionId"]`.
These are SQL-boundary oracles for the existing 409/404/422 mappings, not new HTTP/UI evidence.
Completed exact replay precedes dependency validation; ordinary authority checks still precede replay.
Unexpected faults must propagate, not be rewritten as a template refusal (BE03b:1724–1729).

## Smallest bounded future file claim

Do not create a second driver which includes the frozen driver: its own `plan`, `finish`, and `rollback`
would finish and discard the shared fixture before extension cases run (frozen driver:6–14,296–297).
Request exactly these FOUR future test paths; none is authorized for writing by this report:

1. Existing `supabase/tests/phase_02_slice_12_entry_default_template.sql`: change `plan(76)` to
   `plan(132)` and add the three includes immediately before `finish`; retain all 76 bodies/oracles.
2. NEW `supabase/tests/phase_02_slice_12_entry_default_template/000-policy-helpers.sqlinc` (≤300 lines):
   saved-request call capture, complete store images, and a non-invoking success-oracle adapter.
3. NEW `supabase/tests/phase_02_slice_12_entry_default_template/010-policy-lifecycle.sqlinc` (≤400 lines):
   retired/replay first, independent superseded lineage next, real scheduled/blocked lineage last.
4. NEW `supabase/tests/phase_02_slice_12_entry_default_template/020-policy-fault.sqlinc` (≤300 lines):
   guarded negative late-leaf substitution, exact restoration, rollback, same-key retry and replay.

Removing only the new includes and reversing the plan literal must reproduce the frozen driver hash.
No extraction/rewrite of its fixtures, 12-check helper, requests, or least-privilege cases is needed.
If normal formatting exceeds a bound, request an exact additional extraction path before writing.

## Capture and image rules

Reuse the real Auth/membership/context actors and both live grant stores already proved by
the frozen driver:233–295; governed lifecycle calls retain the existing owner/designer and independent
reviewer producers, not a new entry-create privilege. No added registry-read or designer grant for authors.
Use actual `service_role`, capture invoked/restored role, SQLSTATE, message, DETAIL, JSONB response,
and `response.headers`; clear stale headers before each call and restore session/request settings on
success and exception. Preserve the exact saved JSONB request on replay/retry, including authority context.
Do not call `s12edt_run` for replay: it rebuilds request/context and cannot capture DETAIL (driver:147–170).

The new non-invoking adapter may copy the existing twelve comparisons verbatim (driver:174–227),
reading a captured result instead of executing its line181 producer. Keep expected pin/slots/title literal
or independently captured fixture IDs, never read them back from the created revision to form expectations.
This permits exact saved-request retry while leaving the original checker and all its calls unchanged.

Capture full rows, not counts/hashes alone: stable table-name keys and all `to_jsonb(row)` members,
ordered by complete row text with C collation; empty tables are explicit `[]`. Freeze the table inventory
before cases and compare it afterward. Include every `platform_private.cms_*` ordinary table, plus
`platform_private.idempotency_records`, `platform_private.outbox_events`, `platform_private.jobs`,
and `audit_private.audit_events`; include any additional actual create-trigger write store discovered
in the staged catalog before release. Do not filter merely by returned IDs, truncate timestamps, or strip
refcounts, evidence, safeHeaders, reservations, or old history. Diagnostic temp receipt tables are excluded.
Scope read-only diagnostics correctly; never disable FORCE RLS or manufacture actor/party authority.

Take negative/replay baselines AFTER legitimate lifecycle setup, not before its expected audit/events.
For success, preserve every prior row and check the exact allowed appended rows: entry, first revision,
literal field value, creator-capability assignment, one audit, one exact outbox event, completed receipt;
check full payload/actor/party/correlation/version identities, not only totals. Include settings snapshots
and any legitimate registry-derived writes in the explicit allowed delta; an existing snapshot may add zero.
`cms_emit_event` delegates audit/outbox atomically (20260902080000:2417–2441;
`20260901071500_platform_configuration_runtime_commands.sql:3–37`); completion stores canonical response
in `idempotency_records` (`20260902080000_content_schema_registry_authority.sql:2364–2388`).

## Exact cases and count derivation: 76 + 56 = 132

Run R before S so the original active EDT T1 can be retired legally. Use fresh independent families for
S and B; no SAVEPOINT rollback of TAP bookkeeping, history UPDATE, template deletion, or forged state.
Each listed fixture-control assertion combines exact producer receipts with persisted facts, never just a title.

| Group | Added checks | Independent oracles |
| --- | ---: | --- |
| R: retired + replay | 11 | 2 lifecycle/premise controls; 3 fresh-refusal checks; 4 exact-replay checks; 2 changed-payload checks |
| S: superseded eligible | 16 | 3 real-chain/default/supersession controls; unchanged 12 success comparisons; 1 complete allowed delta |
| B: actual blocked | 9 | 6 real producer/clock/fence/state controls; 3 fresh-refusal checks |
| F: reached late fault | 20 | 2 guarded-leaf/direct-probe controls; reached RPC fault; full rollback; exact catalog restoration; 12 retry comparisons; allowed delta; 2 replay checks |

R (AC291/292): save the original successful owner `edt-bound` request, complete response and receipt
from `s12edt_out` while they are still available. Retire its exact T1 using
`s12gb_act(..., 'retire')` with the actual current review CAS; confirm retired timestamp/lifecycle increment,
review increment, exact retirement audit/event, and still-active same schema/default with caller authority intact.
Public retirement is ACTIVE-only (`20261014160200_cms_governed_retire_branch.sql:36–52`;
`20261014160100_cms_governed_retire_apply.sql:39–66,88–116`), hence no attempt to retire an already-superseded T1.
Fresh valid create, different key: require exact `P0001/CONFLICT`, empty DETAIL/no resource/replay header,
and complete image equality. Exact original request/key: require success under real role, byte-preserved
canonical JSONB resource plus replay header, identical completed receipt, and complete image/history equality.
Change one business title value while keeping key/scope: `P0001/IDEMPOTENCY_MISMATCH`, images/receipt unchanged.
Existing request/party/context hash and BE00 scope are not widened
(`20260930150000_cms_idempotency_business_hash.sql:27–101`;
`20260901030000_party_identity_aliases.sql:348–379`; create replay `20261005018040:57–78`).

S (AC288): real empty initial schema C0; real compatible template S1 with literal `main` slot; real
successor schema C1 with exact default S1 and explicit `templateBindings:[]`; real zero-population worker,
review and activation. Mint S2 with the SAME templateKey, expected definition version1 and a different
literal slot; real submit/assign/approve/activate makes S1 superseded, S2 active, while C1 still defaults S1.
All schema/template producer receipts and compiled artifacts must pass before testing create.
Use the existing public workflow patterns (frozen driver:20–104), then the twelve success oracles with
expected S1 and S1's `main` slot, NOT S2's slot. Old EDT rows and C1's default remain unchanged.
Do not blindly call `s12gb_successor` with `edt-template`: it constructs `s12ga-<parentTag>`, not
`s12edt-template` (`phase_02_slice_12_governed_activation/000-world.sqlinc:83–108`).
Supersession is real and silent for the old row, not a new activation of S1
(`20261014070200_cms_governed_activation_core.sql:117–138`).

B (AC291): real independent empty active family B0; mint/approve compatible template BT, freezing B0's
active version as review dependency. Public schedule BT at least62s ahead, then produce/worker-seal/review/
activate B1, whose exact default is BT and bindings are empty, WHILE BT remains scheduled.
The resolver permits scheduled definitions (rejects only retired/blocked), successor replacement uses that
resolver, and schema existence/compatibility guards do not impose active-only template state
(`20261002132000_cms_template_compatibility_resolver.sql:38–57`;
`20261002216000_cms_successor_template_binding.sql:296–322`;
`20260930160000_cms_template_binding_compat_guard.sql:75–102`;
`20261005012000_cms_protected_validator_registry.sql:294–298,411–425`;
`20260902080000_content_schema_registry_authority.sql:615–638`).
B1 activation changes BT's frozen active-type dependency: bound versions select the current active version
(`20261013300300_cms_governed_subject_helpers.sql:212–243`). After the REAL scheduled instant is due,
claim through `platform_api.cms_claim_due_governed_activations`; prove exact BT schedule, actual lease and
review version. Execute the actual claim via `platform_api.cms_execute_governed_activation`; require
`blocked/dependency_changed`, BT blocked, released lease, unchanged approved review and no activation event.
Reference real producers: `phase_02_slice_12_governed_activation/000-world.sqlinc:24–44,176–216`;
`phase_02_slice_12_governed_schedule/010-setup.sqlinc:26–53,020-claim.sqlinc:31–61,050-blocked.sqlinc:1–23`;
executor `20261014070600_cms_execute_governed_activation.sql:130–175`.
Bounded clock polling is only due-time passage, never concurrency proof; do not backdate schedule/lease rows.
The combined B1-with-scheduled-default fixture is SOURCE-FEASIBLE, NOT runtime-proven. Any refused producer,
changed approval, cancelled schedule or absent exact lease is a failed premise, not the requested policy RED.
Only after all six controls pass call fresh public create against still-active B1: exact CONFLICT, empty
DETAIL/no resource/identity leak, and complete before/after image equality (three checks).

F (AC296): use the now-proven eligible S1/C1 fixture and a fresh key; construct/save the entire valid request
BEFORE fault installation. Guard the existing private
`cms_publication_settings_effective_values(uuid,timestamptz)` identity, definition, complete `pg_proc`, ACL,
comment and owner. Install a transaction-scoped, argument-dependent TEST fault only for this owner:
raise `22P02` with a unique private TEST sentinel; all other arguments retain the exact original body.
Direct target probe must fault and non-target control must match its pre-install result. No new production
hook, trigger, policy/constraint bypass, authority grant, synthetic receipt or storage-pin seam.
Source placement: E7 calls this leaf AFTER `cms_complete(...,201,response)` and before return
(`20261010130000_cms_settings_write_tail_lookup.sql:52–93,168–184`), following entry/revision/value/
assignment/audit/outbox writes (`20261005018040_cms_create_entry_derived_state.sql:319–431`).
Verify the staged create still has that unique late call before installing the fault; changed source fails setup.
The actual public call must expose this exact unexpected state/sentinel, proving the leaf was reached,
not a missing-helper error or blanket CONFLICT/VALIDATION_FAILED. Catch only that RPC in a subtransaction;
then assert complete row-image rollback including completed/reserved receipt absence for this fresh key.
Restore exact definition/OID/full metadata/ACL/comment on BOTH normal and exceptional cleanup, before TAP
and before retry. Require exact restoration; never mask a restoration error as a policy failure.
Retry the same saved request/key, reuse the twelve comparisons via the non-invoking adapter, and require
one complete allowed delta; exact replay afterward must preserve response/header and the complete image.
No API call is mocked. Catalog substitution is a labelled negative fault, not live-provider proof.

## Honest conditional gaps and release gates

Missing/hidden and incompatible (AC289/290) are NOT counted in132 as real producer cases. Current successor
gating rejects missing/foreign/incompatible bindings before activation; immutable owner/type compatibility
and saved schema defaults prevent later reparenting/deletion/rebinding through legal producers
(`20261002216000:300–322`; `20261013100000_cms_template_per_owner_keys_lineage.sql:175–189`;
`20260902080000_content_schema_registry_authority.sql:1671–1705`). The default UUID column itself is not
evidence of a foreign-key guarantee (`20260902080000:1002`); do not invent one to explain reachability.
Conditional follow-up requires either a newly identified legal lifecycle producer or separately released
integrity/mapping fault tests with truthful labels. If guarded resolver substitution is selected later,
exercise the actual create mapper, assert NOT_FOUND empty DETAIL versus exact incompatible pointer,
full-store equality and catalog restoration; it proves mapping under injected resolver failure, not a lawful
persisted bad default. Missing versus concealed equivalence still needs distinguishable resolver premises.
Do not corrupt an immutable row, disable a guard, or count a skipped/unreachable case as coverage.

Root must first approve exact paths/counts, independently read fixtures, then execute frozen original76 and
the complete extension under the owned ALT gate. A failed producer/control is setup failure; meaningful
policy RED requires valid premises plus wrong refusal/replay/pin/atomicity outcome. Stop at unexpected aborts.
These tests do not establish real HTTP/UI handling, hosted Auth/RLS, nonempty relation/refcount rollback,
all historical append/resolve/restore/locale carry (AC295), or lock ordering. Full empty-store comparisons
are useful regression checks, not evidence of a positively reached composition/refcount write.
The real initial-create relation2 → exact-template3 → schema4 dual-order race (AC294), visibility lever and
post-wait rechecks need a separately claimed deterministic harness; no serial test or clock delay substitutes.
