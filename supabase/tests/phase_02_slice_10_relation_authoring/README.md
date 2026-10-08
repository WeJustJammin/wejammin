# phase_02_slice_10_relation_authoring

Shared fixture for the Slice 10 relation-authoring suites (BE03b "Value encodings by field
kind", relation: `{ targets: [{ targetId, expectedTargetVersion | null }] }`, ordered, bounded by
the immutable 03a RelationDefinition).

| File                          | Purpose                                                                                                                                                                                                                                                                                                                                                                                  |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `000-relation-fixture.sqlinc` | One active content type with title, an ordered many content relation (0..3), a one content relation (0..1) and an ordered many domain relation (0..2), four article targets (assigned, second assigned, unassigned, archived) and the request builders `pg_temp.s10r_*`. Include after `../phase_02_slice_10_rpc/000-helpers.sqlinc` and `../phase_02_slice_10_rpc/001-fixtures.sqlinc`. |

Suites that include it:

- `../phase_02_slice_10_relation_authoring.sql` - cms_create_entry, cms_create_revision, the
  conflict flow (`cms_resolve_conflict`, `cms_get_conflict_detail`).

To add another suite, include the three fragments in that order, then build requests with the
`pg_temp.s10r_*` helpers. Everything rolls back with the suite transaction.
