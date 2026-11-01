# Lane claude_s12_db9b shared test support

| File | Contents |
| ---- | -------- |
| `010-consumer-bootstrap.sqlinc` | the publication-settings lookup prerequisite and the consumer-only guarded entry bootstrap (copied from `phase_02_slice_12_dec193_consumers/000-fixture.sqlinc` lines 2-72), needed by the real dependency-manifest builder |
| `020-provider.sqlinc` | `pg_temp.d9l_provider(tag, phase)`: manifest, frozen status and the pattern category of the real preflight evaluator for a placement tag's revision |

Used by `../phase_02_slice_12_gaps_db9b_legacy_forest/` and `../phase_02_slice_12_gaps_db9b_deletion.sql`. Include after the pattern-placement fixtures and
`phase_02_slice_12_pattern_updates_common/000-helpers.sqlinc`.
