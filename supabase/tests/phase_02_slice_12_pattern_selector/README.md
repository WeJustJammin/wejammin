# Slice 12 pattern selector (CMS-03C-13) pgTAP support

Fragments of `supabase/tests/phase_02_slice_12_pattern_selector.sql`: `GET /api/v1/cms/patterns/selector` ->
`platform_api.cms_list_pattern_selector` -> `cms_list_pattern_selector_signed` -> `cms_list_pattern_selector` (BE03c 175, 398, 1266,
1363, 1474; tracker P2-S12-AC-106 .. AC-111).

| File                    | Contents                                                                                                     |
| ----------------------- | ------------------------------------------------------------------------------------------------------------ |
| `000-selector.sqlinc`   | catalog and grants, the signing-key environment, the full list, the other type, the follow-the-data case     |
| `010-paging.sqlinc`     | pages, the signed cursor bound to the query and actor, tampered/expired/malformed cursors, the query grammar |
| `020-authority.sqlinc`  | author/editor capability, concealment, privileges, revocation                                                |
| `030-retirement.sqlinc` | a retirement alone (no new version row) removes the item and moves `pageVersion`                             |

The shared world is in `../phase_02_slice_12_pattern_updates_common/`. Add a case by building the request with `pg_temp.s12ps_sel` and
asserting the exact outcome with `pg_temp.s12pu_oc`; every read also proves it changed no store.
