# Slice 12 governed-a: CMS-03C-08 reviewer assignment (and the shared governed-a world)

Entry point: `../phase_02_slice_12_governed_assignment.sql` (plan 68 = 9 producer controls of the governed-submit chain + 59 own).
It drives the real `platform_api.cms_assign_governed_reviewer` under the real `service_role` over real fixtures only: the S09
owner initialization receipt, real CMS-03A-15/16/17 grants, real active content types (`../phase_02_slice_12_governed_submit/005`),
real CMS-03C-01 templates and real CMS-03C-06 submissions. The only labelled provisioning forgery is the S09 membership tenure.

| Fragment                            | Content                                                                                                                                                                                                                                                                                       |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `000-world.sqlinc`                  | the shared governed-a world, also included by the decision and reads suites: `s12ga_rpc` (a command under `set local role service_role`, SQLSTATE/message/DETAIL captured), request builders, `s12ga_open` (mint + submit), scoped no-effect snapshots, the pool bootstrap, role-denial probe |
| `010-setup.sqlinc`                  | real grants and six real open reviews (R1..R6) and the fixture controls                                                                                                                                                                                                                       |
| `020-create.sqlinc`                 | happy path, exact replay, changed-body mismatch, step-up first                                                                                                                                                                                                                                |
| `030-refusals.sqlinc`               | structure, concealment, 403, review CAS, uniform eligibility, duplicate                                                                                                                                                                                                                       |
| `040-bounds-revoke.sqlinc`          | seven-day / reviewer-grant / grantor-grant bounds, submitter rule, revoke, counted-approval invalidation                                                                                                                                                                                      |
| `050-limit-closed-authority.sqlinc` | sixteen-assignment limit, closed review, lapsed owner grant, never-grantable, privileges                                                                                                                                                                                                      |

Adding a test: use `pg_temp.s12ga_assign`/`s12ga_revoke`/`s12ga_decide`/`s12ga_get`/`s12ga_list`, label every call uniquely, assert the
whole refusal with `s12ga_out(label)` (`ok` or `<sqlstate>:<message>`), take `s12ga_mark` before and assert `s12ga_same` after every refusal.
Keep every file under 400 lines. Related: `../phase_02_slice_12_governed_decision/`, `../phase_02_slice_12_governed_reads/`,
`supabase/migrations/20261014010100_cms_assign_governed_reviewer.sql`.
