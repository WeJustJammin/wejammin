# Slice 12 governed-recheck, pattern kind: AC-202 / AC-203

Entry point: `../phase_02_slice_12_governed_recheck_pattern.sql` (no_plan). It includes the S09 DEC-108 fragments and the pattern-definition
fixtures (`../phase_02_slice_12_pattern_definition/000-fixtures.sqlinc`, `010-oracles.sqlinc`, two content types), then this directory.

| Fragment             | Content                                                                                                                                                                                                                                                                                          |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `010-pattern.sqlinc` | a nested pattern review approved but not activated, the activated successor of the child pattern it pins, the resolver over the real `cms.pattern.activated.v1` event, and the `pattern` recheck called with that event id (invalidation, correlation id of the audit record, idempotent repeat) |

Why a separate suite: the template world of `../phase_02_slice_12_governed_recheck.sql` has no pattern subject. Every governed row here is written by a
named producer under the real `service_role`; no trigger is disabled.

To add a case: build the pattern versions with `pg_temp.s12pd_run` and `pg_temp.s12v4p_step(label, 'approve' | 'activate')`, call a platform_api RPC with
`pg_temp.s12v4p_call(label, sql)`, and assert on `s12v4p_call`.

Related: `../phase_02_slice_12_governed_recheck/README.md` (the template-world suite), `../phase_02_slice_12_governed_retire_pattern/README.md`.
