# Slice 12 taxonomy-terms reads: cmsTaxonomyTermsRead and CMS-03C-17

Entry point: `../phase_02_slice_12_taxonomy_terms_reads.sql` (`no_plan`). It includes the term-action world
(`../phase_02_slice_12_taxonomy_terms/000-world.sqlinc` and `010-setup.sqlinc`), then builds more real vocabularies and writes every
term through the real `platform_api.cms_act_taxonomy_term`. The signed-cursor environment is a pgTAP-transaction-only Vault key,
provisioned after the first assertion (which needs it missing).

| Fragment                              | Content                                                                                                                                                |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `000-world.sqlinc`                    | read helpers, page/key extractors, the independent item, label, selector and page-version oracles, the cursor forger                                   |
| `010-fixtures.sqlinc`                 | vocabularies `vr`, `vq`, `vs`/`vs2` and the terms (deprecated, merged, renamed, aliased)                                                               |
| `020-terms-read.sqlinc`               | surface, key environment, exact page against the oracle, lifecycle filter, page version                                                                |
| `030-terms-read-pages.sqlinc`         | keyset paging, cursor binding and fault classes, query grammar (a lifecycle or limit outside its grammar is the 400 INVALID_REQUEST of BE03c 407)      |
| `040-terms-read-authority.sqlinc`     | curator-only, 403/404 split, concealment                                                                                                               |
| `050-selector.sqlinc`                 | selector surface, items against the oracle, labels without fallback (the requested locale matched in canonical case), allowlist keys, follows the data |
| `060-selector-pages-authority.sqlinc` | selector paging, cursor binding, query grammar, author/editor authority                                                                                |

Related: `../phase_02_slice_12_taxonomy_terms/` (the action suite) and `../phase_02_slice_12_governed_reads/` (the same cursor machinery).
