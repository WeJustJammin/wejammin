# Slice 09 pre-amendment (p240) pgTAP fragments

Shared includes for the `../phase_02_slice_09_p240_*.sql` suites, the database
half of the 240 pre-amendment Slice 09 criteria (AC001 to AC283) that were
checked before the DEC-108 amendment and had no executable evidence. They are
psql `\ir` includes, not Supabase-discovered test files.

| Fragment        | Purpose                                                                                                                                                                                                                                                                                                  |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `00-a01.sqlinc` | CMS-03A-01 request builders (`p_base`, `p_field`, `p_key`), the row-count fingerprint of every table a refused create must leave untouched (`p_rows`), and `p_run`, which runs the named RPC as the owner designer and reports `ok` only for the expected token and, for a refusal, no committed effect. |

## Rules

- Every refusal case is paired with an accepted control built from the same
  base request, so a rejection is attributable to the one varied clause. Type
  keys of table-driven cases come from `p_key`, never from the case label.
- No producer row (version, field, relation, binding, artifact, review, plan,
  report, block, event) is ever inserted by hand; rows come from the named RPCs.
- Add the include after the four DEC-108 fragments and keep each file under 400
  lines.

Related: `../phase_02_slice_09_dec108/README.md`.
