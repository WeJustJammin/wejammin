# Slice 12 governed-a: CMS-03C-10 detail and CMS-03C-11 queue

Entry point: `../phase_02_slice_12_governed_reads.sql` (plan 56 = 9 producer controls + 47 own). It includes the shared world from
`../phase_02_slice_12_governed_assignment/000-world.sqlinc` and drives `platform_api.cms_get_governed_review` and
`platform_api.cms_list_governed_reviews` under the real `service_role` over seven reviews driven by the real submit, assignment and
decision commands into approved, rejected, open, invalidated and untouched states.

| Fragment                       | Content                                                                                   |
| ------------------------------ | ----------------------------------------------------------------------------------------- |
| `010-setup.sqlinc`             | real grants, seven reviews, the independent queue oracle                                  |
| `020-detail.sqlinc`            | per-reader redaction, exact resource, next actions, concealment/403, no-write             |
| `030-queue.sqlinc`             | fail-closed signing key, three scopes, exact items, filters, keyset walk, validation      |
| `040-cursor-privileges.sqlinc` | cursor binding to query and actor, tamper/expiry/malformed, privileges, evidence emission |

The queue cursor is signed with a pgTAP-transaction-only Vault key created in `030-queue.sqlinc`; it is never an operational value.
Related: `../phase_02_slice_12_governed_assignment/`, `../phase_02_slice_12_governed_decision/`.
