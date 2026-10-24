# Slice 12 governed-b: CMS-03C-09 activation and scheduling

Entry point: `../phase_02_slice_12_governed_activation.sql` (plan 123 = 9 producer controls + 114 own). It includes the governed-a
world (`../phase_02_slice_12_governed_assignment/000-world.sqlinc`) and this directory's `000-world.sqlinc`, and drives the real
`platform_api.cms_activate_governed_subject` under the real `service_role` against real APPROVED governed reviews (mint, submit,
assign, approve through the named producers). No governed row is inserted by hand and no trigger is disabled.

| Fragment                     | Content                                                                                                                                                               |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `000-world.sqlinc`           | helpers: `s12gb_act`, approved-review builders, snapshots, system calls (CMS-03C-19), the labelled negative fault                                                     |
| `005-lineage-helpers.sqlinc` | lineage advisory lock and function-body helpers shared with the schedule suite (a row lock is invisible from one session)                                             |
| `010-setup.sqlinc`           | grants, twelve approved reviews, one open review, fixture controls                                                                                                    |
| `020-gates.sqlinc`           | step-up first, structure, `retire` on a non-active subject and its reason bounds, the `activateAt` shape, concealment, 403, CAS                                       |
| `030-activate.sqlinc`        | the immediate activation: resource, lifecycle +1, one event, one audit, replay, mismatch                                                                              |
| `040-supersession.sqlinc`    | lineage v1 -> v2 supersession; a protected (two-approval) review                                                                                                      |
| `050-schedule-accept.sqlinc` | `schedule` acceptance (202, no event), the schedule row, Time authority rules, authority end                                                                          |
| `060-invalidation.sqlinc`    | non-owner capability holder, lost capability, dead approval, schedule cancellation, changed dependency                                                                |
| `080-taxonomy.sqlinc`        | a real taxonomy subject (built `role` domain): create, submit, approve, activate, `cms.taxonomy.changed.v1`                                                           |
| `090-lineage-lock.sqlinc`    | the lineage advisory lock of `activate`, proven from `pg_locks`; the re-read under it takes no row lock (helper and call-site body oracles, one key helper)           |
| `095-retire.sqlinc`          | `retire` (DEC-190): active-only, no fresh approval or dependency/policy validity, review version advances by one (like an activation), one event, three subject kinds |
| `070-privileges.sqlinc`      | privilege boundary, role control, evidence rows                                                                                                                       |

`retire` (DEC-190) is proven in `095`: every control of the route stays (step-up, concealment, owner capability, review CAS, idempotency), the retirement needs only an
`active` subject (else `subject_not_retirable`), and it commits `retired`, lifecycle +1, `retired_at`, one audit record and one subject-kind event.
Related: `../phase_02_slice_12_governed_schedule/` (CMS-03C-19), `../phase_02_slice_12_governed_assignment/`.
