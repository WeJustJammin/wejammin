# Slice 12 governed-a: CMS-03C-07 reviewer decision

Entry point: `../phase_02_slice_12_governed_decision.sql` (plan 57 = 9 producer controls + 48 own). It includes the shared world
from `../phase_02_slice_12_governed_assignment/000-world.sqlinc` and drives the real `platform_api.cms_record_governed_decision`
under the real `service_role` against nine real governed reviews (ordinary and protected policy bases, real assignments).

| Fragment                        | Content                                                                                                                                         |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `010-setup.sqlinc`              | real grants, nine reviews R1..R9 and thirteen real assignments                                                                                  |
| `020-gates.sqlinc`              | step-up first, structure, concealment, 403, review CAS, no effect                                                                               |
| `030-happy.sqlinc`              | the approval, exact resource, stored decision, subject move, audit, replay, mismatch                                                            |
| `040-flows.sqlinc`              | first rejection, policy slot then base slot, unsatisfiable base approve, duplicate then rejection                                               |
| `050-invalidation-gates.sqlinc` | expired/revoked assignments, the dead review, the committed `dependency_changed` invalidation (a real DEC-108 successor activation), privileges |

`separation_of_duties` is defense in depth: an assignment of the submitter or the subject creator is refused `reviewer_not_eligible`, so
no public path reaches it. Related: `../phase_02_slice_12_governed_assignment/`, `../phase_02_slice_12_governed_reads/`.
