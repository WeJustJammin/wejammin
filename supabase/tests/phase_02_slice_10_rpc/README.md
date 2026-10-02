# Slice 10 RPC pgTAP fragments

The executable `../phase_02_slice_10_rpc.sql` is the single Supabase
discovery entrypoint. It opens one transaction, establishes the pgTAP plan,
then includes these fragments in numeric order with psql `\ir` directives.
The final fragment returns control to the entrypoint for `finish()` and
`rollback()`, so fixtures and assertion state remain shared across the suite.
Fragment `004b-revision-write.sqlinc` also chains
`004c-conflict-resolve.sqlinc` through an inline `\ir` inside a savepoint.

Keep fragments ordered and below the repository's 400-line test cap. The
fragments are includes, not independently discovered Supabase test files.

| Fragment                          | Coverage                                                                                                                                   |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `000-helpers.sqlinc`              | pg_catalog/OID inspectors for functions, grants, SQLSTATE and error-message capture that yield false instead of raising on missing objects |
| `001-fixtures.sqlinc`             | Rolled-back actor, entry, schema and assignment fixtures for creator, editor and outsider, with the organization as acting party           |
| `002-create.sqlinc`               | CMS-03B-10 `cms_create_entry`: existence, worker-only grants, closed registry widening, fail-closed workflow-policy dependency             |
| `003-detail.sqlinc`               | CMS-03B-11 `cms_get_entry_draft`: authorized draft read plus the write-free contract (no audit or outbox rows)                             |
| `004-schema-seams.sqlinc`         | Fail-closed draft-envelope guards: schema-version resolution, declared fields, byte/depth/key/array ceilings, frozen hash preimages        |
| `004b-revision-write.sqlinc`      | CMS-03B-01 protected `cms_create_revision`: typed immutable revision and one durable open conflict inside the same rolled-back fixture     |
| `004c-conflict-resolve.sqlinc`    | CMS-03B-02 `cms_resolve_conflict`: service-role wrapper, resolver grants, and conflict resolution contract                                 |
| `005-history.sqlinc`              | CMS-03B-03 protected revision-history read: cursor and hash-drift checks against the candidate migration                                   |
| `006-field-value-calendar.sqlinc` | Semantic calendar field-kind behavior proven on a separate draft schema so fixture definitions stay immutable                              |

## Adding tests

Append a new numbered fragment, then register it in the entrypoint's `\ir`
list in numeric order. Reuse `000-helpers.sqlinc` inspectors and the
`001-fixtures.sqlinc` actors instead of seeding production authority. When a
fragment must commit intermediate state (for example the durable conflict
consumed by the resolver), wrap it in a savepoint and roll back to that
savepoint so the shared fixtures stay pristine for later fragments.

## Conventions

- One BE03b CMS-03B contract (or one deliberate boundary) per fragment;
  assert absence as evidence-backed RED, never as a silent pass.
- Pair custom `P0001` contract tokens with
  `pg_temp.s10_last_error_message()` and the SQLSTATE helper instead of
  matching free-form error text.
- Everything runs inside the entrypoint's rolled-back transaction; no grant,
  binding, or identity row may survive the run.

## Related paths

- `../phase_02_slice_10_rpc.sql` — executable entrypoint
- `../phase_02_slice_10_schema/` — Slice 10 table foundation suite
- `../phase_02_slice_10_conflict_schema/` — DEC-107 conflict-record suite
- `../phase_02_slice_10_remaining_schema/` — editorial support-table suite
- `.memory/wiki/specs/be/03b-editorial-workflow-publication.md` — CMS-03B
  contracts these fragments mirror

## Local run

```sh
node_modules/.bin/supabase test db --local supabase/tests/phase_02_slice_10_rpc.sql
```

This suite is local-only evidence. It makes no hosted or acceptance claims.
