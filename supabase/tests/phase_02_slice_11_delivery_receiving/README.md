# DEC-197 receiving SQL witnesses

These are RED witnesses for sealed manifest storage, complete publication
projection receivers and their consumer foreign keys. They implement no delivery
writer, endpoint, pointer activation, provider, or acceptance promotion.

The two entry suites are `../phase_02_slice_11_delivery_receiving.sql` and
`../phase_02_slice_11_delivery_receiving_security.sql`. Both use `no_plan()` because
labelled matrices expand into individual TAP assertions. Each suite ends with
`finish()` and `ROLLBACK`; run only through the root-released isolated ALT lane.
Authoring this directory does not authorize a database run.

| File                    | Responsibility                                                                                                                                                           |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `010-helpers.sqlinc`    | Dynamic SQL builders, subtransaction outcomes, role probes, ordered catalog inspectors                                                                                   |
| `000-world.sqlinc`      | Existing guarded revision/review/lineage fixture seams; labelled real publications A/B/C; complete frozen-set JCS hash; admin-positive receivers                         |
| `020-catalog.sqlinc`    | Exact six/thirteen columns, identity, unique keys, indexes, closed states, validated checks, five ordered restrictive FKs and field rejection matrices                   |
| `030-references.sqlinc` | Positive complete chain, missing parents, true A-to-valid-B rejection, referenced-parent restrictions, projection revoke/purge freedom, unchanged convergence derivation |
| `040-lifecycle.sqlinc`  | Sealed manifest lifecycle, immutable fields, write-once activation, one-active, injected atomic replacement failure and complete row-image preservation                  |
| `050-security.sqlinc`   | New-only ACL/RLS default-deny, real roles and forged GUCs, diagnostic grants that reach RLS, sequence/guard restrictions, retained existing consumer posture             |

Sources: [BE04a manifest registry](../../../.memory/wiki/specs/be/04a-navigation-routes-discovery.md),
[BE04c projection registry](../../../.memory/wiki/specs/be/04c-public-delivery-cache.md),
[locked receiving brief](../../../docs/handoffs/2026-10-14-claude-s12/briefs/codex-dec197-receiving-contracts.md),
and [private JSON-safe contracts](../../../packages/contracts/src/cms-delivery/storage.ts).
The physical tables are `platform_private.route_manifest_version` and
`platform_private.publication_projection`. Publication IDs are existing
`cms_publication_versions.id` VERSION-row IDs, not lineage IDs.

To extend a case, add a unique `DR-*` label in its owning fragment and use the
builders plus `dr_result`/`dr_diag`. Never statically reference an absent receiving
table in executable SQL: a pre-DDL run must report attributable TAP failures,
including `42P01`, rather than aborting or skipping. Keep each file within 400
physical lines. Add any new path to the coordinator's claim before writing it.

Negative catalog/reference probes compare the intended SQLSTATE and actual
constraint identity resolved from the ordered catalog relationship. NOT NULL
probes also compare `column_name`; varchar overflow has SQLSTATE `22001` and no
constraint identity. Direct consumer projection FK creation precedes composite
FK creation so missing-projection/delete failures identify the direct FK. The
cross-publication case isolates only the composite FK: A and B are real rows and
B's projection is independently verified before A reports through it.

Manifest guards use internal refusal diagnostics, selected here as implementation
identities rather than public API errors: SQLSTATE `23514`, with `CONSTRAINT`
`route_manifest_version_transition_check`, `route_manifest_version_immutable_check`,
`route_manifest_version_activation_immutable_check` or
`route_manifest_version_delete_check`. Transition refusals take precedence on
reverse/skip/reactivation; a state-preserving activation rewrite identifies the
activation guard. Ordinary malformed state/hash/time inputs still reach their
table CHECK. Exact no-op updates are allowed and affect the existing row once.

RLS proof first inserts complete receivers as the administrator, verifies the
real `authenticated` role has neither superuser nor BYPASSRLS, temporarily grants
schema/table access, verifies each table privilege, and then requires active RLS,
hidden rows, actual RLS INSERT diagnostics, and zero-row UPDATE/DELETE results
despite a forged CMS GUC. Explicit ordinals avoid an earlier sequence ACL error.
Diagnostic table grants are explicitly revoked; final ROLLBACK also undoes every
diagnostic grant and fixture. No policy/principal is created, and no guard is
disabled. These assertions do not re-deny the existing consumer table.

The frozen hash is derived from actual immutable `publication_hash` values using
the specified complete-set shape and canonical UUID ordering. It is fixture
consistency proof, not proof of a future compiler's complete-set behavior.

Upgrade/parity witnesses must later replay the actual forward migration body;
there is no embedded invented migration here. Existing state/read fixtures,
missing-FK sentinel, closeout scanner and acceptance evidence are separate claims.
