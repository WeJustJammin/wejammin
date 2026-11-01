# Taxonomy definition RED authoring

`../phase_02_slice_12_taxonomy_definition.sql` includes this suite in order.
This is unrun test authoring for CMS-03C-16, not RED/GREEN execution evidence.
Root controls database release and serialized runtime verification.

| File                          | Responsibility                                                                                         |
| ----------------------------- | ------------------------------------------------------------------------------------------------------ |
| `000-harness.sqlinc`          | Real role execution, separate SQLSTATE/message captures, complete ordered snapshots                    |
| `010-identities.sqlinc`       | Ordinary identities, two real organizations, narrowly scoped fixture authority and setup controls      |
| `020-oracles.sqlinc`          | Public/persisted success, refusal and replay assertions                                                |
| `030-create.sqlinc`           | First versions, bounds, six domains, independent owners, duplicate keys and idempotency                |
| `040-validation.sqlinc`       | Required fields, strict keys, scalar/member types, counts, grammar, duplicates and operands            |
| `050-authority.sqlinc`        | Readable denial, concealment, anonymous, expired/revoked authority and database roles                  |
| `060-review-successor.sqlinc` | Unbuilt-domain submission refusal, actual lifecycle transition, immutable successor operands           |
| `070-versions-read.sqlinc`    | `cmsTaxonomyVersionsRead` witness: lineage page, bound of 50, concealment, strict request, authority   |
| `080-schema-guards.sqlinc`    | E14 uniqueness, stable lineage, immutable definition fields, closed domains, definer closure           |
| `090-registry-read.sqlinc`    | Create consults the canonical domain registry (rolled-back reader replacement), unbuilt still accepted |
| `populated-lineage.sql`       | Standalone witness: replays the lineage migration on a populated table; refuses ambiguous legacy data  |

`populated-lineage.sql` is a standalone pgTAP file, not an include: it embeds the text between the
`BEGIN/END TAXONOMY-LINEAGE-DDL` markers of `20261014030000_cms_taxonomy_lineage_columns.sql` verbatim, and the
two copies must stay byte-identical.

Keep additions below 300 lines per file. Add a case to the relevant matrix and
assert the exact output plus persisted effects. Refusals must use the complete
snapshot oracle; counts alone cannot prove unchanged rows. A missing producer
must fail a positive prerequisite and cannot satisfy no-effect proof.

The proposed private adapter is
`platform_api.cms_create_taxonomy_version(p_request jsonb) returns jsonb`,
delegating atomically to the equally named private function. The name is in
BE03c; the signature and low-level refusal bindings are derived from neighboring
CMS commands, not a locked SQL contract. `ifMatch` is the decoded decimal
operand at this private boundary. Strong quoted HTTP ETags need Worker tests.

No active taxonomy or content-type version is fabricated. Bootstrap uses the
real identity and organization commands; only synthetic auth-provider users,
one membership and two finite curator projections are raw fixture facts.
Taxonomy allowlists need valid keys at creation; BE03c specifies default review
policy when no bound type resolves. The suite uses that documented path.

Unbuilt canonical declarations succeed at creation and fail later submission.
Activation and term-action refusal require their own real authorized producers
and reachable lifecycle preconditions; this suite does not claim those checks.
Term stores are initially empty: their complete snapshots guard against stray
effects but do not prove stable existing term identities across activation.

Related sources: [locked BE03c](../../../.memory/wiki/specs/be/03c-composition-taxonomy-localization.md),
[taxonomy contract](../../../packages/contracts/src/cms-composition/taxonomy-version.ts),
[lane report](../../../docs/handoffs/2026-10-12-claude-s12/lane-native-taxonomy-definition-report.md).
