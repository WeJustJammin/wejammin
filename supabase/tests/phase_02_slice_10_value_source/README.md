# phase_02_slice_10_value_source

Shared fixture for the Slice 10 value-source refusal suites (BE03b "Value encodings by
field kind": a non-empty taxonomy or media value fails closed with a typed reason until
its producer exists).

| File                         | Purpose                                                                                                                                                                                                                       |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `000-gallery-fixture.sqlinc` | One active content type with title, taxonomy, media, rich_text, object and list fields plus request builders. Include after `../phase_02_slice_10_rpc/000-helpers.sqlinc` and `../phase_02_slice_10_rpc/001-fixtures.sqlinc`. |

Suites that include it:

- `../phase_02_slice_10_value_source_refusal.sql` - cms_create_entry and cms_create_revision.
- `../phase_02_slice_10_value_source_resolve.sql` - cms_resolve_conflict.

To add another suite, include the three fragments in that order, then build requests with the
`pg_temp.s10g_*` helpers. Everything rolls back with the suite transaction.
