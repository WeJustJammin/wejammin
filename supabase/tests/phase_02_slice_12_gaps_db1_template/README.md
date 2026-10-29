# Slice 12 gap lane `claude_s12_gaps_db1`: template fixtures

Shared fixture fragment of two pgTAP entrypoints that prove clauses the earlier template suites left uncited:

| Entrypoint                                           | Proves                                                                                              |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `../phase_02_slice_12_gaps_db1_template.sql`         | P2-S12-AC-023 (inactive or versionless compatible types refused), P2-S12-AC-159 (context selectors) |
| `../phase_02_slice_12_gaps_db1_template_context.sql` | P2-S12-AC-161 (membership, tenure, grant and actor rechecks; a context read reserves nothing)       |

`000-fixtures.sqlinc` adds the designer grant, the request builders and four content types on top of the Slice 10 rolled-back world
(`../phase_02_slice_10_rpc/`, which each entrypoint includes first: an `\ir` is relative to the including file). To add a case, put it in
the entrypoint of its area, carry the criterion marker `[P2-S12-AC-NNN]` in the description and keep both files under 300 lines.
Run through the staged ALT runner (lane `none`): the cases need no unpromoted migration.
