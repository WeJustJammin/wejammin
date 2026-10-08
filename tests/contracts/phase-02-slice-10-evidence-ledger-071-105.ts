import type { EvidenceLedgerEntry } from './phase-02-evidence-ledger';

// Slice 10 evidence ledger fragment P2-S10-AC-071..105 (evidence lane C). Rules: see
// tests/contracts/phase-02-slice-10-evidence-ledger.ts and the guard tests/contracts/phase-02-slice-10-evidence-guard.test.ts.
export const S10_EVIDENCE_LEDGER_071_105: readonly EvidenceLedgerEntry[] = [
  {
    criterion: 'P2-S10-AC-071',
    text: 'CMS-03B-11: map authentication, concealment, rate, dependency, timeout, and internal failures to BE00 ApiError with safe recovery; never disclose hidden values, ownership, or authority.',
    clauses: [
      {
        text: 'CMS-03B-11: map authentication',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/detail-routes.test.ts',
            title:
              'CMS-03B-11 protected draft-detail route answers an anonymous caller 401 before it validates the query',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/cms-editorial-composition-flows.apispec.ts',
            title:
              '401, 403 and 404 are the database decision, not a stub [P2-S10-AC-006] no session is a 401 with a reauthenticate hint on every operation and writes nothing',
          },
        ],
      },
      {
        text: 'concealment',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/detail-routes.test.ts',
            title:
              'CMS-03B-11 protected draft-detail route conceals absent entries and scrubs dependency errors',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/cms-editorial-composition-flows.apispec.ts',
            title:
              '401, 403 and 404 are the database decision, not a stub [P2-S10-AC-068] [P2-S10-AC-089] an entry the caller cannot see is the same empty 404 as an absent one',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/cms-editorial-composition-flows.apispec.ts',
            title:
              '403 and concealment decided by the database for other principals [P2-S10-AC-068] [P2-S10-AC-089] a person outside the owning organization cannot tell the entry exists',
          },
        ],
      },
      {
        text: 'rate',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/detail-routes.test.ts',
            title:
              'CMS-03B-11 protected draft-detail route enforces independent user and party read buckets before persistence',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/detail-routes.test.ts',
            title:
              'CMS-03B-11 protected draft-detail route maps a failed limiter without inventing a 429 decision',
          },
        ],
      },
      {
        text: 'dependency',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/detail-routes.test.ts',
            title:
              'Codex s10-ts-2 M1: CMS-03B-11 publishes the read-specific error projection publishes a 503 with only the route dependency class and retryability',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/detail-routes.test.ts',
            title:
              'CMS-03B-11 protected draft-detail route rejects an untyped or widened dependency resource without relaying values',
          },
        ],
      },
      {
        text: 'timeout',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/detail-routes.test.ts',
            title:
              'CMS-03B-11 protected draft-detail route bounds a stalled draft dependency and scrubs unexpected failures',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/detail-routes.test.ts',
            title:
              'CMS-03B-11 protected draft-detail route bounds a stalled session within the shared route deadline',
          },
        ],
      },
      {
        text: 'internal failures to BE00 ApiError with safe recovery',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/detail-routes.test.ts',
            title:
              'CMS-03B-11 protected draft-detail route fails closed if a response-bound ETag cannot be computed',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/detail-routes.test.ts',
            title:
              'Codex s10-ts-2 M1: CMS-03B-11 publishes the read-specific error projection fails closed as a scrubbed 500 on a 409, which the bounded read does not declare',
          },
        ],
      },
      {
        text: 'never disclose hidden values, ownership, or authority.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/detail-routes.test.ts',
            title:
              'CMS-03B-11 protected draft-detail route preserves visible 403 denial without exposing assignment evidence',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/detail-routes.test.ts',
            title:
              'Codex s10-ts-2 M1: CMS-03B-11 publishes the read-specific error projection keeps only a registered read reasonCode on a visible 403 and drops every write-path member',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_draft_detail_identity.sql',
            title:
              'CMS-03B-11 identity envelope exposes no resolver or ownership identifier',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S10-AC-072',
    text: 'CMS-03B-11: perform a read-only canonical fetch with no audit/outbox mutation, safe redacted telemetry, and bounded data so the CMS-05 editor loads a truthful draft before autosave.',
    clauses: [
      {
        text: 'CMS-03B-11: perform a read-only canonical fetch with no audit/outbox mutation',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_draft_detail_identity.sql',
            title:
              'the draft-detail identity read emits no audit or outbox evidence',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/detail-routes.test.ts',
            title:
              'CMS-03B-11 protected draft-detail route rejects mutation headers, media, and a foreign origin',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-reads.apispec.ts',
            title:
              'EC reads are read-only, no-store and redacted [EC-072][EC-093][EC-099][EC-105] draft, conflict, list, preparation and history reads leave every durable fingerprint unchanged and answer no-store with an ETag',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-safe-reads.test.ts',
            title:
              "production port-input admission for the safe reads refuses a write header, body, or non-GET method on 'CMS-03B-11'",
          },
        ],
      },
      {
        text: 'safe redacted telemetry',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/detail-routes.test.ts',
            title:
              'CMS-03B-11 protected draft-detail route emits only redacted operation telemetry after a successful read',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-telemetry-reads.test.ts',
            title:
              'read operations [P2-S10-AC-069] a served draft counts the detail read and its safe field and relation counts, not its values',
          },
        ],
      },
      {
        text: 'bounded data',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/entry-draft-detail.test.ts',
            title:
              'cms draft detail resource exposes the closed envelope with 128-field and 512-relation bounds',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/004-schema-seams.sqlinc',
            title:
              'CMS-03B-11 refuses INTERNAL_ERROR above the 512-relation envelope ceiling',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/004-schema-seams.sqlinc',
            title:
              'CMS-03B-11 refuses INTERNAL_ERROR when a stored value exceeds the byte ceiling',
          },
        ],
      },
      {
        text: 'so the CMS-05 editor loads a truthful draft before autosave.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-pages/load-entry-edit-page.test.ts',
            title:
              'loadEntryEditPage builds the editor from the verified draft and the author-safe definitions of its schema version',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-entry-draft-detail-transport.test.ts',
            title:
              'executeCmsEditorialEntryDraftDetailRead verification rejects a 200 whose resource belongs to a different entry',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-entry-editor-controller.test.ts',
            title:
              'editor controller: autosave cadence and request shape saves 3 s after the last edit against the explicit base revision with If-Match and a key',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/cms-editorial-composition.apispec.ts',
            title:
              'CMS-03B-14 -> CMS-03B-10 -> CMS-03B-11 -> CMS-03B-13 through the real stack [P2-S10-AC-068] [P2-S10-AC-069] the draft read serves the committed value with the entry and revision in its strong ETag',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S10-AC-073',
    text: 'CMS-03B-10 field validation: contentTypeId/contentTypeVersionId must be UUIDs resolving to the same active compiled schema with non-null activation evidence, exact SchemaArtifact and protected validator refs; reject stale or off-registry identity before mutation. Object values satisfy the frozen typed depth-1 property structure and rich-text values satisfy `rich_text.v1`; unknown/mismatched content is refused.',
    clauses: [
      {
        text: 'CMS-03B-10 field validation: contentTypeId/contentTypeVersionId must be UUIDs',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_validation_pointers.sql',
            title:
              'create: a malformed contentTypeId is pointed at /contentTypeId',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_validation_pointers.sql',
            title:
              'create: a malformed contentTypeVersionId is pointed at /contentTypeVersionId',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/entry-create.test.ts',
            title:
              'cms entry create body (CMS-03B-10) requires two UUID schema identities and a locale',
          },
        ],
      },
      {
        text: 'resolving to the same active compiled schema with non-null activation evidence',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ec_create_draft.sql',
            title:
              'EC-073 control: a create naming the active compiled schema pair, artifact and evidence is accepted',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ec_create_draft.sql',
            title:
              'EC-073 a version paired with a content type it does not belong to is concealed as NOT_FOUND with no detail',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ec_create_draft.sql',
            title:
              'EC-073 a version that is no longer the active one is a stale identity refused at /contentTypeVersionId',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/cms-editorial-composition.apispec.ts',
            title:
              'CMS-03B-14 -> CMS-03B-10 -> CMS-03B-11 -> CMS-03B-13 through the real stack [P2-S10-AC-061] [P2-S10-AC-066] the projection round-trips into a create that commits the entry, first revision, audit and outbox exactly once',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ec_create_draft.sql',
            title:
              'EC-073 a null activationEvidence is refused at /activationEvidence',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ec_create_draft.sql',
            title:
              'EC-073 activation evidence that differs from the stored envelope by one hash is refused at /activationEvidence',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ec_create_draft.sql',
            title:
              'EC-073 an active content-type version cannot carry null activation evidence (check_violation)',
          },
        ],
      },
      {
        text: 'exact SchemaArtifact',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ec_create_draft.sql',
            title:
              'EC-073 the SchemaArtifact of another schema version is refused at /schemaArtifact',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ec_create_draft.sql',
            title:
              'EC-073 a stale SchemaArtifact compiler version is refused at /schemaArtifact',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ec_create_draft.sql',
            title:
              'EC-073 a stale SchemaArtifact contract reference is refused at /schemaArtifact',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_validation_pointers.sql',
            title:
              'create: a mismatching schema artifact is pointed at /schemaArtifact',
          },
        ],
      },
      {
        text: 'protected validator refs',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ec_create_draft.sql',
            title:
              'EC-073 a validator ref naming an unregistered key is refused at /validatorRefs',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ec_create_draft.sql',
            title:
              'EC-073 the protected rich_text.v1 ref at an unregistered version is refused at /validatorRefs',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_protected_validator_freeze.sql',
            title:
              'a type that declares the rich_text.v1 pair is refused when the request names no validator ref',
          },
        ],
      },
      {
        text: 'reject stale or off-registry identity before mutation',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ec_create_draft.sql',
            title:
              'EC-073 the stale-version refusal committed no entry, revision, value, reservation, outbox or audit row',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ec_create_draft.sql',
            title:
              'EC-073 an off-registry version id is concealed as NOT_FOUND with no detail',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ec_create_draft.sql',
            title: 'EC-073 the off-registry version refusal committed nothing',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_protected_validator_freeze.sql',
            title:
              'a refused transition committed no entry, revision, value, conflict, reservation, outbox or audit row',
          },
        ],
      },
      {
        text: 'Object values satisfy the frozen typed depth-1 property structure',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ec_create_draft.sql',
            title:
              'EC-073 an object value satisfying the frozen depth-1 property structure is accepted',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ec_create_draft.sql',
            title:
              'EC-073 an object value with a property the frozen structure does not declare is object_property_invalid at its field',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_typed_reasons.sql',
            title:
              'cms_create_entry: object_missing_required is object_property_invalid [BE03b, AC-005]',
          },
        ],
      },
      {
        text: 'rich-text values satisfy `rich_text.v1`',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ec_create_draft.sql',
            title: 'EC-073 a canonical rich_text.v1 document is accepted',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ec_create_draft.sql',
            title:
              'EC-073 a rich_text value with an unsafe link scheme is rich_text_not_canonical at its field',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_typed_reasons.sql',
            title:
              'cms_create_entry: richtext_unmerged_spans is rich_text_not_canonical [BE03b, AC-005]',
          },
        ],
      },
      {
        text: 'unknown/mismatched content is refused.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_validation_pointers.sql',
            title:
              'create: a value keyed by a UUID that is no field of the version is pointed at that field pointer',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_typed_reasons.sql',
            title:
              'cms_create_entry: short_text_number is VALIDATION_FAILED [BE03b, AC-005]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ec_create_draft.sql',
            title: 'EC-073 the object refusal committed nothing',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/cms-editorial-composition.apispec.ts',
            title:
              'CMS-03B-14 -> CMS-03B-10 -> CMS-03B-11 -> CMS-03B-13 through the real stack [P2-S10-AC-062] an unknown field is refused with a bounded pointer and nothing is written, at the proxy and at the Worker',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S10-AC-074',
    text: 'CMS-03B-10 field validation: locale is bounded BCP 47; changedPaths are 1-128 unique stable JSON Pointers; values are strict stable-field-ID structured JSON within 128 keys, depth 8, and 256 KiB; no caller owner, assignee, authority, or executable content. Returned object and rich-text values are validated against the same compiled artifact and protected validator versions used at write time.',
    clauses: [
      {
        text: 'CMS-03B-10 field validation: locale is bounded BCP 47',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_validation_pointers.sql',
            title: 'create: a malformed locale is pointed at /locale',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_validation_pointers.sql',
            title:
              'create: a locale outside the active schema locale set is pointed at /locale',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ec_create_draft.sql',
            title: 'EC-074 a locale that is not BCP 47 is refused at /locale',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ec_create_draft.sql',
            title:
              'EC-074 a locale longer than the 35-character BCP 47 bound is refused at /locale (it can belong to no active schema locale set)',
          },
        ],
      },
      {
        text: 'changedPaths are 1-128 unique stable JSON Pointers',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_validation_pointers.sql',
            title: 'create: an empty changedPaths is pointed at /changedPaths',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_validation_pointers.sql',
            title:
              'create: duplicate changed paths are pointed at /changedPaths',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_validation_pointers.sql',
            title:
              'create: a changed path outside the pointer grammar is pointed at its own index',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ec_create_draft.sql',
            title: 'EC-074 129 changedPaths are refused at /changedPaths',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ec_create_draft.sql',
            title:
              'EC-074 128 changedPaths pass the count bound and are refused only because the first names no field',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-entry-create-form.test.ts',
            title:
              '[P2-S10] CMS-03B-10 create form projection [P2-S10-AC-074][P2-S10-AC-105] validates the create form request with frozen members',
          },
        ],
      },
      {
        text: 'values are strict stable-field-ID structured JSON within 128 keys, depth 8, and 256 KiB',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_validation_pointers.sql',
            title:
              'create: a value key that is not a UUID is pointed at /values and never echoed',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ec_create_draft.sql',
            title: 'EC-074 129 value keys are refused at /values',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ec_create_draft.sql',
            title:
              'EC-074 a values object nested to depth 9 is refused at /values',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ec_create_draft.sql',
            title: 'EC-074 a values object over 256 KiB is refused at /values',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/entry-create.test.ts',
            title:
              'cms entry create body (CMS-03B-10) bounds changedPaths and values exactly as the revision route does',
          },
        ],
      },
      {
        text: 'no caller owner, assignee, authority, or executable content',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ec_create_draft.sql',
            title:
              'EC-074 a caller-supplied ownerId is an unknown request key refused as INVALID_REQUEST',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ec_create_draft.sql',
            title:
              'EC-074 a caller-supplied assigneeId is refused as INVALID_REQUEST',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ec_create_draft.sql',
            title:
              'EC-074 a caller-supplied authority member is refused as INVALID_REQUEST',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rich_text_admission.sql',
            title: 'executable HTML cannot enter a rich-text draft as a string',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_typed_reasons.sql',
            title:
              'cms_create_entry: richtext_unsafe_link is rich_text_not_canonical [BE03b, AC-005]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/cms-editorial-composition.apispec.ts',
            title:
              'CMS-03B-14 -> CMS-03B-10 -> CMS-03B-11 -> CMS-03B-13 through the real stack [P2-S10-AC-062] an unknown field is refused with a bounded pointer and nothing is written, at the proxy and at the Worker',
          },
        ],
      },
      {
        text: 'Returned object and rich-text values are validated against the same compiled artifact and protected validator versions used at write time.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ec_create_draft.sql',
            title:
              'EC-074 a stored rich_text value with adjacent merge-equivalent spans is a scrubbed INTERNAL_ERROR, never served',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ec_create_draft.sql',
            title:
              'EC-074 a stored rich_text value with an unsafe link scheme is a scrubbed INTERNAL_ERROR, never served',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ec_create_draft.sql',
            title:
              'EC-074 a stored object value with an undeclared property is a scrubbed INTERNAL_ERROR, never served',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ec_create_draft.sql',
            title:
              'EC-074 a stored object value missing its required property is a scrubbed INTERNAL_ERROR, never served',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ec_create_draft.sql',
            title:
              'EC-074 control: a consistently rewritten but still canonical rich_text value reads, so the next refusals are the value gate and not the hashes',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_draft_detail_schema_lineage.sql',
            title:
              'CMS-03B-11 refuses a schema version whose compiled artifact hash disagrees',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S10-AC-075',
    text: 'CMS-03B-11 field validation: entryId is UUID and the authorized current draft must resolve to a readable immutable revision; response values/provenance are schema-valid and bounded, with absent or concealed targets returning 404 and no fabricated empty draft. The response includes server-derived `revisionNumber`, `schemaVersionId`, and bounded `openConflict`; it never fabricates a draft or authority metadata.',
    clauses: [
      {
        text: 'CMS-03B-11 field validation: entryId is UUID',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/detail-routes.test.ts',
            title:
              'CMS-03B-11 protected draft-detail route rejects malformed paths and syntactically invalid locales as 400',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/entry-draft-detail.test.ts',
            title:
              'cms draft detail addressing (CMS-03B-11) binds exactly one UUID path parameter',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-pages/load-entry-edit-page.test.ts',
            title:
              'loadEntryEditPage answers a malformed entry id as an invalid request without any upstream call',
          },
        ],
      },
      {
        text: 'the authorized current draft must resolve to a readable immutable revision',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_draft_detail_identity.sql',
            title:
              'CMS-03B-11 revisionNumber is the stored current draft revision number',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/detail-routes.test.ts',
            title:
              'CMS-03B-11 protected draft-detail route refuses archived entries and non-draft revision states',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/detail-routes.test.ts',
            title:
              'CMS-03B-11 protected draft-detail route rejects a dependency draft for another entry or requested locale',
          },
        ],
      },
      {
        text: 'response values/provenance are schema-valid and bounded',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/entry-draft-detail.test.ts',
            title:
              'cms draft detail field values carries bounded JSON plus a nullable safe hash and nothing more',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/entry-draft-detail.test.ts',
            title:
              'cms draft detail field values locks the closed provenance vocabulary',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rpc/004-schema-seams.sqlinc',
            title:
              'CMS-03B-11 refuses a stored value that violates its active field kind',
          },
        ],
      },
      {
        text: 'with absent or concealed targets returning 404 and no fabricated empty draft',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/cms-editorial-composition-flows.apispec.ts',
            title:
              '401, 403 and 404 are the database decision, not a stub [P2-S10-AC-068] [P2-S10-AC-089] an entry the caller cannot see is the same empty 404 as an absent one',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/cms-editorial-composition-flows.apispec.ts',
            title:
              '403 and concealment decided by the database for other principals [P2-S10-AC-068] [P2-S10-AC-089] a person outside the owning organization cannot tell the entry exists',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_draft_detail_identity.sql',
            title:
              'CMS-03B-11 non-member read still conceals the entry as NOT_FOUND',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-pages/load-entry-edit-page.test.ts',
            title:
              'loadEntryEditPage renders a 404 from the draft read as one closed state',
          },
        ],
      },
      {
        text: 'The response includes server-derived `revisionNumber`, `schemaVersionId`, and bounded `openConflict`',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_draft_detail_identity.sql',
            title:
              'CMS-03B-11 returns revisionNumber, schemaVersionId and openConflict',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_draft_detail_identity.sql',
            title:
              'CMS-03B-11 openConflict carries exactly conflictId, version and conflictHash',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/entry-draft-detail.test.ts',
            title:
              'cms draft detail resource requires the revision number, active schema version, and a strict nullable open conflict',
          },
        ],
      },
      {
        text: 'it never fabricates a draft or authority metadata.',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/entry-draft-detail.test.ts',
            title:
              'cms draft detail resource rejects private ownership identifiers anywhere in the envelope',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_draft_detail_identity.sql',
            title:
              'CMS-03B-11 identity envelope exposes no resolver or ownership identifier',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-pages/load-entry-edit-page.test.ts',
            title:
              'loadEntryEditPage serialises no owner, assignee or authority identifier into the island data',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S10-AC-076',
    text: 'DEC-133 object structure accepts exactly one typed depth-1 `properties[]` declaration with 0–32 properties and rejects nested object/list property kinds.',
    clauses: [
      {
        text: 'DEC-133 object structure accepts exactly one typed depth-1 `properties[]` declaration with 0–32 properties',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/content-schema-registry/structured-values.test.ts',
            title:
              '[P2-S10] ObjectStructureSchema accepts zero to 32 unique properties',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/content-schema-registry/structured-values.test.ts',
            title:
              '[P2-S10] ObjectStructureSchema rejects more than 32 properties',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/content-schema-registry/structured-values.test.ts',
            title:
              '[P2-S10] ObjectStructureSchema is strict about unknown structure keys',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_object_structure.sql',
            title:
              'a structure with exactly 32 properties is accepted [P2-S10-AC-076]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_object_structure.sql',
            title: 'a structure with 33 properties is refused [P2-S10-AC-076]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_object_structure.sql',
            title:
              'a structure with zero properties is accepted [P2-S10-AC-076]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_object_structure.sql',
            title:
              'a structure with an extra top-level member is refused [P2-S10-AC-076]',
          },
        ],
      },
      {
        text: 'rejects nested object/list property kinds.',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/content-schema-registry/structured-values.test.ts',
            title:
              '[P2-S10] ObjectPropertyKindSchema exposes exactly scalar, enum, rich_text has no nested/object property kind',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_object_structure.sql',
            title: 'a nested object property kind is refused [P2-S10-AC-076]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_object_structure.sql',
            title: 'a nested list property kind is refused [P2-S10-AC-076]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_object_structure_rpc.sql',
            title:
              'a nested_kind object structure is the typed VALIDATION_FAILED refusal [P2-S10-AC-078]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S10-AC-077',
    text: 'DEC-133 object properties use unique stable keys and only `scalar`, `enum`, or `rich_text` child kinds, each with an explicit required flag.',
    clauses: [
      {
        text: 'DEC-133 object properties use unique stable keys',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/content-schema-registry/structured-values.test.ts',
            title:
              '[P2-S10] ObjectStructureSchema rejects duplicate property keys',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/content-schema-registry/structured-values.test.ts',
            title:
              '[P2-S10] ObjectPropertySchema enforces the key grammar /^[a-z][a-z0-9_]{1,63}$/',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_object_structure.sql',
            title:
              'two properties sharing one key are refused whatever their kinds [P2-S10-AC-077]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_object_structure.sql',
            title: 'a 65-character key is refused [P2-S10-AC-077]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_object_structure_rpc.sql',
            title:
              'a duplicate_key object structure is the typed VALIDATION_FAILED refusal [P2-S10-AC-078]',
          },
        ],
      },
      {
        text: 'only `scalar`, `enum`, or `rich_text` child kinds',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/content-schema-registry/structured-values.test.ts',
            title:
              '[P2-S10] ObjectPropertyKindSchema exposes exactly scalar, enum, rich_text accepts the three scalar kinds',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_object_structure.sql',
            title: 'the date kind is refused as a child kind [P2-S10-AC-077]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_object_structure.sql',
            title:
              'the relation kind is refused as a child kind [P2-S10-AC-077]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_object_structure.sql',
            title:
              'distinct stable keys across the three child kinds are accepted [P2-S10-AC-077]',
          },
        ],
      },
      {
        text: 'each with an explicit required flag.',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/content-schema-registry/structured-values.test.ts',
            title:
              '[P2-S10] ObjectPropertySchema requires a boolean required flag',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_object_structure.sql',
            title: 'a missing required flag is refused [P2-S10-AC-077]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_object_structure.sql',
            title: 'a string required flag is refused [P2-S10-AC-077]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_object_structure_rpc.sql',
            title:
              'a missing_required_flag object structure is the typed VALIDATION_FAILED refusal [P2-S10-AC-078]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S10-AC-078',
    text: 'DEC-133 object property constraints are strict and kind-specific; unknown keys, missing required keys, incompatible constraints, and mismatched values return typed 422 errors without mutation.',
    clauses: [
      {
        text: 'DEC-133 object property constraints are strict and kind-specific',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/content-schema-registry/structured-values.test.ts',
            title:
              '[P2-S10] ObjectPropertySchema closes the constraint vocabulary per property kind (DEC-144, not an open record)',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/content-schema-registry/object-property-constraints-parity.test.ts',
            title:
              '[P2-S10-AC-078] DEC-144 object-property constraints: shared corpus parity with PostgreSQL structure: scalar unknown member',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_object_property_constraints.sql',
            title:
              'PG constraints (structure): enum without choices [DEC-144, AC-078]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_object_property_constraints.sql',
            title:
              'a value is refused under a structure with an unknown constraint member [DEC-144]',
          },
        ],
      },
      {
        text: 'unknown keys, missing required keys, incompatible constraints, and mismatched values return typed 422 errors without mutation.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-r1-typed-values.apispec.ts',
            title:
              'EC-078/EC-080 object values: TypeScript verdict equals the typed 422 of every write path TypeScript refuses an undeclared key and create and append answer a typed 422 that changes nothing',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-r1-typed-values.apispec.ts',
            title:
              'EC-078/EC-080 object values: TypeScript verdict equals the typed 422 of every write path TypeScript refuses a missing required key and create and append answer a typed 422 that changes nothing',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-r1-typed-values.apispec.ts',
            title:
              'EC-078/EC-080 object values: TypeScript verdict equals the typed 422 of every write path TypeScript refuses an enum outside the declared choices and create and append answer a typed 422 that changes nothing',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-r1-typed-values.apispec.ts',
            title:
              'EC-078/EC-080 object values: TypeScript verdict equals the typed 422 of every write path TypeScript refuses a label over its maximum length and create and append answer a typed 422 that changes nothing',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-r1-typed-values.apispec.ts',
            title:
              'EC-078/EC-080 object values: TypeScript verdict equals the typed 422 of every write path TypeScript refuses a count above its maximum and create and append answer a typed 422 that changes nothing',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-r1-typed-values.apispec.ts',
            title:
              'EC-078/EC-080 object values: TypeScript verdict equals the typed 422 of every write path TypeScript refuses a nested value for a scalar property and create and append answer a typed 422 that changes nothing',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-r1-typed-values.apispec.ts',
            title:
              'EC-078/EC-080 object values: TypeScript verdict equals the typed 422 of every write path TypeScript refuses a JSON null for a scalar property and create and append answer a typed 422 that changes nothing',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-r1-typed-values.apispec.ts',
            title:
              'EC-078/EC-080 object values: TypeScript verdict equals the typed 422 of every write path TypeScript refuses a raw string for the rich_text property and create and append answer a typed 422 that changes nothing',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-r1-typed-values.apispec.ts',
            title:
              'EC-078/EC-080 object values: TypeScript verdict equals the typed 422 of every write path TypeScript refuses a non-canonical rich_text property and create and append answer a typed 422 that changes nothing',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-r1-typed-values.apispec.ts',
            title:
              'EC-078/EC-080 object values: TypeScript verdict equals the typed 422 of every write path explicit conflict resolution refuses an invalid object choice with the same typed 422 and leaves the conflict open, then accepts a valid one',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_object_structure_rpc.sql',
            title:
              'a enum_without_choices object structure is the typed VALIDATION_FAILED refusal [P2-S10-AC-078]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_object_structure_rpc.sql',
            title:
              'the refused structures committed no type, version, field or artifact row [P2-S10-AC-078]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_typed_reasons.sql',
            title:
              'cms_create_entry: every typed refusal committed no entry, revision, value, conflict, reservation, outbox or audit row',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-error-tokens.test.ts',
            title:
              'typed 422 reason tokens (BE03b:1049-1054, :1211) [P2-S10-AC-005] [P2-S10-AC-008] maps object_property_invalid on a write to 422 VALIDATION_FAILED with reasonCode',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S10-AC-079',
    text: 'DEC-133 object structure is normalized into the immutable SchemaArtifact and definition hash so review, activation, write, restore, preview, and publication bind the same bytes.',
    clauses: [
      {
        text: 'DEC-133 object structure is normalized into the immutable SchemaArtifact and definition hash',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_object_structure_rpc.sql',
            title:
              'the compiled SchemaArtifact editor manifest carries the same structure bytes [P2-S10-AC-079]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_object_structure_rpc.sql',
            title:
              'the compiled schema definition inside the manifest carries the same structure bytes [P2-S10-AC-079]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_object_structure_rpc.sql',
            title:
              'flipping one required flag inside the structure changes the frozen definition hash [P2-S10-AC-079]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_object_structure_rpc.sql',
            title:
              'changing one enum choice inside the structure changes the frozen definition hash [P2-S10-AC-079]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-r1-typed-values.apispec.ts',
            title:
              'EC-081 the projection that feeds the object editor carries the compiled structure serves the DEC-133 structure in the CMS-03B-14 field and the browser descriptor declares one property per entry',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-r1-typed-values.apispec.ts',
            title:
              'EC-085 the compiled artifact of a type that uses rich_text freezes the TypeScript registry entry carries exactly the entry the TypeScript registry returns, inside the artifact hash that equals the definition hash',
          },
        ],
      },
      {
        text: 'so review',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ec_r1b_review_binding.sql',
            title:
              'EC-079 review: a type with a DEC-133 object field is created through CMS-03A-01',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ec_r1b_review_binding.sql',
            title:
              'EC-079 review: CMS-03A-11 freezes the sealed dry-run of an object-structure type into a review',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ec_r1b_review_binding.sql',
            title:
              'EC-079 review: the review of an object-structure type freezes the definition hash, which is the compiled artifact hash of the same version',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ec_r1b_review_binding.sql',
            title:
              'EC-079 review: the artifact the review froze carries the object structure bytes in its editor manifest',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ec_r1b_review_binding.sql',
            title:
              'EC-079 review: the frozen review hash equals the definition hash recomputed from the request that carries the structure',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ec_r1b_review_binding.sql',
            title:
              'EC-079 review: the same request with one structure flag flipped hashes differently, so the review binds the structure bytes',
          },
        ],
      },
      {
        text: 'activation',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ec_r1_artifact_binding.sql',
            title:
              'EC-079 control: the activation reference check accepts the compiled object/rich_text artifact',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ec_r1_artifact_binding.sql',
            title:
              'EC-079 activation refuses an artifact whose hash differs from the version definition hash',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_protected_validator_freeze.sql',
            title:
              'the definition hash equals the artifact hash that freezes the validator',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ec_r1_gaps.sql',
            title:
              'EC-079-b activation refuses a stored object structure that differs from the structure frozen in the artifact',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_activation_structure_binding.sql',
            title:
              '079-b control: the untouched gallery type passes the activation reference check',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_activation_structure_binding.sql',
            title:
              '079-b: a stored property whose required flag differs from the frozen structure is refused',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_activation_structure_binding.sql',
            title:
              '079-b: a stored property key that differs from the frozen structure is refused',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_activation_structure_binding.sql',
            title:
              '079-b: a stored property kind that differs from the frozen structure is refused',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_activation_structure_binding.sql',
            title:
              '079-b: a stored property constraint that differs from the frozen structure is refused',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_activation_structure_binding.sql',
            title:
              '079-b: a stored structure with an added property is refused',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_activation_structure_binding.sql',
            title:
              '079-b: a stored field whose object structure was removed is refused',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_activation_structure_binding.sql',
            title:
              '079-b: a stored field-level flag that differs from the frozen field is refused',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_activation_structure_binding.sql',
            title:
              '079-b: a frozen structure that differs from the stored field definition is refused (the same bytes are required on both sides)',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_activation_structure_binding.sql',
            title:
              '079: an artifact hash that is not the version definition hash is not activatable',
          },
        ],
      },
      {
        text: 'write',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ec_r1_artifact_binding.sql',
            title:
              'EC-079 an append against an artifact whose hash differs from the definition hash is refused',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_validation_pointers.sql',
            title:
              'create: a mismatching schema artifact is pointed at /schemaArtifact',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ec_r1_gaps.sql',
            title:
              'EC-079-a a create that echoes a drifted artifact hash is refused: the stored binding, not the request, decides',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_activation_structure_binding.sql',
            title:
              '079-a control: a create over the untouched artifact commits',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_activation_structure_binding.sql',
            title:
              '079-a: a create that echoes a drifted artifact hash is refused DEPENDENCY_UNAVAILABLE: the stored binding, not the request, decides',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_activation_structure_binding.sql',
            title:
              '079-a: the refused create wrote nothing (the probe is rolled back; the fingerprint is unchanged)',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_activation_structure_binding.sql',
            title:
              '079-a: a create that names the real hash against a drifted stored artifact is refused VALIDATION_FAILED at /schemaArtifact',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ec_r1b_restore_binding.sql',
            title:
              'EC-079 conflict resolution refuses an artifact whose hash differs from the version definition hash',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ec_r1b_restore_binding.sql',
            title:
              'EC-079 the refused conflict resolution committed no entry, revision, value, conflict, reservation, outbox or audit row',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ec_r1b_restore_binding.sql',
            title:
              'EC-079 control: conflict resolution proceeds over the untouched artifact',
          },
        ],
      },
      {
        text: 'restore',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ec_r1b_restore_binding.sql',
            title:
              'EC-079 restore refuses an artifact whose hash differs from the version definition hash',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ec_r1b_restore_binding.sql',
            title:
              'EC-079 the refused restore committed no entry, revision, value, conflict, reservation, outbox or audit row',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ec_r1b_restore_binding.sql',
            title:
              'EC-079 control: restore proceeds over the untouched artifact',
          },
        ],
      },
      {
        text: 'preview',
        citations: [],
      },
      {
        text: 'publication bind the same bytes.',
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'pending DEC-147 forward-scope ruling. Unproven clauses are the forward ones only: "preview" and "publication bind the same bytes" have no passing test because no preview or publication runtime exists in Slice 10 (CMS-03B-07..09 are contract-only; runtime is Slice 11). Review, activation, write (create, append, conflict resolution), restore and the reads are each proven against the same artifact and definition-hash bytes, including the DEC-133 object structure (EC R1 079-a was fixed by migration 20261005015000; EC R1 079-b was a probe defect, every real structure drift is refused by the existing activation check).',
  },
  {
    criterion: 'P2-S10-AC-080',
    text: 'TypeScript and PostgreSQL validators enforce the same DEC-133 object structure and value semantics across create, append, conflict resolution, restore, draft read, preview, and publication.',
    clauses: [
      {
        text: 'TypeScript and PostgreSQL validators enforce the same DEC-133 object structure and value semantics across create',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/content-schema-registry/object-property-constraints-parity.test.ts',
            title:
              '[P2-S10-AC-078] DEC-144 object-property constraints: shared corpus parity with PostgreSQL value: scalar string above the maximum length',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/content-schema-registry/object-property-constraints-parity.test.ts',
            title:
              '[P2-S10-AC-078] DEC-144 object-property constraints: shared corpus parity with PostgreSQL structure: scalar minimum above maximum',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_object_property_constraints.sql',
            title:
              'PG constraints (value): scalar string above the maximum length [DEC-144, AC-080]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-r1-typed-values.apispec.ts',
            title:
              'EC-078/EC-080 object values: TypeScript verdict equals the typed 422 of every write path TypeScript admits the required properties only and create, append and resolve accept it',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-r1-typed-values.apispec.ts',
            title:
              'EC-078/EC-080 object values: TypeScript verdict equals the typed 422 of every write path TypeScript admits every property and create, append and resolve accept it',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-r1-typed-values.apispec.ts',
            title:
              'EC-078/EC-080 object values: TypeScript verdict equals the typed 422 of every write path TypeScript refuses an undeclared key and create and append answer a typed 422 that changes nothing',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-r1-typed-values.apispec.ts',
            title:
              'EC-078/EC-080 object values: TypeScript verdict equals the typed 422 of every write path TypeScript refuses a count above its maximum and create and append answer a typed 422 that changes nothing',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-r1-typed-values.apispec.ts',
            title:
              'EC-078/EC-080 object values: TypeScript verdict equals the typed 422 of every write path TypeScript refuses an enum outside the declared choices and create and append answer a typed 422 that changes nothing',
          },
        ],
      },
      {
        text: 'append',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-r1-typed-values.apispec.ts',
            title:
              'EC-078/EC-080 object values: TypeScript verdict equals the typed 422 of every write path TypeScript admits a count at the maximum and create, append and resolve accept it',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-r1-typed-values.apispec.ts',
            title:
              'EC-078/EC-080 object values: TypeScript verdict equals the typed 422 of every write path TypeScript refuses a missing required key and create and append answer a typed 422 that changes nothing',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-r1-typed-values.apispec.ts',
            title:
              'EC-078/EC-080 object values: TypeScript verdict equals the typed 422 of every write path TypeScript refuses a nested value for a scalar property and create and append answer a typed 422 that changes nothing',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_typed_reasons.sql',
            title:
              'cms_create_revision: object_unknown_key is object_property_invalid [BE03b, AC-005]',
          },
        ],
      },
      {
        text: 'conflict resolution',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-r1-typed-values.apispec.ts',
            title:
              'EC-078/EC-080 object values: TypeScript verdict equals the typed 422 of every write path explicit conflict resolution refuses an invalid object choice with the same typed 422 and leaves the conflict open, then accepts a valid one',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_typed_reasons.sql',
            title:
              'cms_resolve_conflict: an object choice with an undeclared key is object_property_invalid [BE03b:1053]',
          },
        ],
      },
      {
        text: 'restore',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_restore_transform/001-seams-and-validators.sqlinc',
            title:
              'object revalidates against its DEC-133 structure: closed keys, required properties, scalar depth and declared enum choices',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_restore_transform/002-typed-refusals.sqlinc',
            title:
              'a source object value outside its DEC-133 structure refuses the restore as migration_chain_incomplete',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-r2-real-stack.apispec.ts',
            title:
              'EC-080 restore applies the same object validator as TypeScript to the restored source value a restore of a source holding the required properties only follows the TypeScript verdict',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-r2-real-stack.apispec.ts',
            title:
              'EC-080 restore applies the same object validator as TypeScript to the restored source value a restore of a source holding every property follows the TypeScript verdict',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-r2-real-stack.apispec.ts',
            title:
              'EC-080 restore applies the same object validator as TypeScript to the restored source value a restore of a source holding a count at the maximum follows the TypeScript verdict',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-r2-real-stack.apispec.ts',
            title:
              'EC-080 restore applies the same object validator as TypeScript to the restored source value a restore of a source holding an undeclared key follows the TypeScript verdict',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-r2-real-stack.apispec.ts',
            title:
              'EC-080 restore applies the same object validator as TypeScript to the restored source value a restore of a source holding a missing required key follows the TypeScript verdict',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-r2-real-stack.apispec.ts',
            title:
              'EC-080 restore applies the same object validator as TypeScript to the restored source value a restore of a source holding an enum outside the declared choices follows the TypeScript verdict',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-r2-real-stack.apispec.ts',
            title:
              'EC-080 restore applies the same object validator as TypeScript to the restored source value a restore of a source holding a nested value for a scalar property follows the TypeScript verdict',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-r2-real-stack.apispec.ts',
            title:
              'EC-080 restore applies the same object validator as TypeScript to the restored source value a restore of a source holding a JSON null for a scalar property follows the TypeScript verdict',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-r2-real-stack.apispec.ts',
            title:
              'EC-080 restore applies the same object validator as TypeScript to the restored source value a restore of a source holding a label over its maximum length follows the TypeScript verdict',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-r2-real-stack.apispec.ts',
            title:
              'EC-080 restore applies the same object validator as TypeScript to the restored source value a restore of a source holding a count above its maximum follows the TypeScript verdict',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-r2-real-stack.apispec.ts',
            title:
              'EC-080 restore applies the same object validator as TypeScript to the restored source value a restore of a source holding an array instead of an object follows the TypeScript verdict',
          },
        ],
      },
      {
        text: 'draft read',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-r1-typed-values.apispec.ts',
            title:
              'EC-078/EC-080 the draft read applies the same object validator to a stored value a stored an undeclared key is served exactly when the TypeScript validator admits it',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-r1-typed-values.apispec.ts',
            title:
              'EC-078/EC-080 the draft read applies the same object validator to a stored value a stored a JSON null for a scalar property is served exactly when the TypeScript validator admits it',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-r1-typed-values.apispec.ts',
            title:
              'EC-078/EC-080 the draft read applies the same object validator to a stored value a stored the required properties only is served exactly when the TypeScript validator admits it',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-r1-typed-values.apispec.ts',
            title:
              'EC-078/EC-080 the draft read applies the same object validator to a stored value a stored every property is served exactly when the TypeScript validator admits it',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ec_create_draft.sql',
            title:
              'EC-074 a stored object value with an undeclared property is a scrubbed INTERNAL_ERROR, never served',
          },
        ],
      },
      {
        text: 'preview',
        citations: [],
      },
      {
        text: 'publication.',
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'pending DEC-147 forward-scope ruling. Unproven clauses are the forward ones only: "preview" and "publication" have no passing test because no preview or publication runtime exists in Slice 10 (CMS-03B-07..09 are contract-only; runtime is Slice 11). Create, append, conflict resolution, restore and draft read are each compared with the TypeScript verdict over the DEC-133 object corpus through the real Worker/PostgREST boundary (restore: a corrupt source revision is fed the same 11 values and restores exactly when TypeScript admits them, refusing the rest with a typed 4xx that changes nothing).',
  },
  {
    criterion: 'P2-S10-AC-081',
    text: 'The native object editor renders property controls from the preparation projection, preserves values and focus across typed failures/conflicts, exposes labels and descriptions, and never asks the user to edit JSON.',
    clauses: [
      {
        text: 'The native object editor renders property controls from the preparation projection',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-fields/CmsFieldEditor.test.tsx',
            title:
              'CmsFieldEditor: object (DEC-133, never raw JSON) renders one labelled native control per declared property',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-fields/cms-field-descriptor.test.ts',
            title:
              'describeCmsAuthoringFields exposes the DEC-133 object structure as one typed descriptor per property',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-pages/load-entry-create-page.test.ts',
            title:
              'loadEntryCreatePage carries the selected type and its author-safe fields into the view',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-pages/phase-02-slice-10-ev-ec-r1-object-editor-wiring.test.tsx',
            title:
              'EC-081 the object editor renders every declared property from the loaded projection shows one labelled group per declared property with its required mark, description and native control',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-r1-typed-values.apispec.ts',
            title:
              'EC-081 the projection that feeds the object editor carries the compiled structure serves the DEC-133 structure in the CMS-03B-14 field and the browser descriptor declares one property per entry',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/phase-02-slice-10-ev-ec-source-guards.test.ts',
            title:
              'EC-081 the Astro create route hands the loaded projection to the island unchanged passes the loader view (types, selected type, fields) to the create form',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/phase-02-slice-10-ev-ec-source-guards.test.ts',
            title:
              'EC-081 the Astro create route hands the loaded projection to the island unchanged passes the selected type and the projected fields to the island, with no field of its own',
          },
        ],
      },
      {
        text: 'preserves values and focus across typed failures/conflicts',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/phase-02-slice-10-ev-ec-object-recovery.test.tsx',
            title:
              'EC-081 the object editor after a typed refusal on create keeps every typed property, announces the refusal on the object, and reaches its first control from the summary link',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/phase-02-slice-10-ev-ec-object-recovery.test.tsx',
            title:
              'EC-081 the object editor on the edit surface keeps the typed property and the focus on it when the response is lost, and replays the identical object',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/phase-02-slice-10-ev-ec-object-recovery.test.tsx',
            title:
              'EC-081 the object editor on the edit surface keeps every unsent object property when a conflict is reported, and puts focus on the conflict announcement',
          },
        ],
      },
      {
        text: 'exposes labels and descriptions',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-fields/CmsFieldEditor.test.tsx',
            title:
              'CmsFieldEditor: object (DEC-133, never raw JSON) describes each property from its declared constraints and marks required ones',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-fields/CmsFieldEditor.test.tsx',
            title:
              'CmsFieldEditor: object (DEC-133, never raw JSON) renders one labelled native control per declared property',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-pages/phase-02-slice-10-ev-ec-r1-object-editor-wiring.test.tsx',
            title:
              'EC-081 the object editor renders every declared property from the loaded projection shows one labelled group per declared property with its required mark, description and native control',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-pages/phase-02-slice-10-ev-ec-r1-object-editor-wiring.test.tsx',
            title:
              'EC-081 the object editor renders every declared property from the loaded projection declares no property the structure does not declare, and never a JSON box',
          },
        ],
      },
      {
        text: 'never asks the user to edit JSON.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/phase-02-slice-10-ev-ec-object-recovery.test.tsx',
            title:
              'EC-081 the object editor after a typed refusal on create never offers a JSON or raw-object box, before or after the refusal',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/CmsEditorialEntryCreateIsland.test.tsx',
            title:
              'CmsEditorialEntryCreateIsland: rendering renders a native control per kind and a typed unavailable state where nothing can be authored',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-fields/CmsFieldEditor.test.tsx',
            title:
              'CmsFieldEditor: object (DEC-133, never raw JSON) submits a strict property-keyed object and drops a cleared optional property',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-pages/phase-02-slice-10-ev-ec-r1-object-editor-wiring.test.tsx',
            title:
              'EC-081 the object editor renders every declared property from the loaded projection fails closed on a projection whose object field has no usable structure instead of rendering a JSON editor',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S10-AC-082',
    text: '`rich_text.v1` admits only paragraph, heading levels 2–4, bulleted/numbered list with list items, and quote blocks with the locked recursive bounds.',
    clauses: [
      {
        text: '`rich_text.v1` admits only paragraph, heading levels 2–4, bulleted/numbered list with list items',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/content-schema-registry/structured-values.test.ts',
            title:
              '[P2-S10] RichTextV1Schema blocks accepts paragraph, heading, quote and list_item blocks',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/content-schema-registry/structured-values.test.ts',
            title:
              '[P2-S10] RichTextV1Schema blocks rejects unsupported heading levels and list kinds',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rich_text_v1.sql',
            title: '[P2-S10-AC-082] a level-2 heading is admitted',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rich_text_v1.sql',
            title: '[P2-S10-AC-082] a level-1 heading is refused',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rich_text_v1.sql',
            title: '[P2-S10-AC-082] a level-5 heading is refused',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rich_text_v1.sql',
            title: '[P2-S10-AC-082] an unknown block type is refused',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rich_text_v1.sql',
            title:
              '[P2-S10-AC-082] a list run rising one level per item is admitted',
          },
        ],
      },
      {
        text: 'quote blocks with the locked recursive bounds.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-rich-text-parity.apispec.ts',
            title:
              'EC-084 rich_text.v1 verdicts and bounds: TypeScript equals PostgreSQL both validators refuse a quote with no spans',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-rich-text-parity.apispec.ts',
            title:
              'EC-084 rich_text.v1 verdicts and bounds: TypeScript equals PostgreSQL both validators refuse a heading with no spans',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-rich-text-parity.apispec.ts',
            title:
              'EC-084 rich_text.v1 verdicts and bounds: TypeScript equals PostgreSQL both validators admit the 128-block bound',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-rich-text-parity.apispec.ts',
            title:
              'EC-084 rich_text.v1 verdicts and bounds: TypeScript equals PostgreSQL both validators refuse 129 blocks',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-rich-text-parity.apispec.ts',
            title:
              'EC-084 rich_text.v1 verdicts and bounds: TypeScript equals PostgreSQL both validators admit the 128-span bound in one paragraph',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-rich-text-parity.apispec.ts',
            title:
              'EC-084 rich_text.v1 verdicts and bounds: TypeScript equals PostgreSQL both validators refuse 129 spans in one paragraph',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-rich-text-parity.apispec.ts',
            title:
              'EC-084 rich_text.v1 verdicts and bounds: TypeScript equals PostgreSQL both validators admit a 10000-character span',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-rich-text-parity.apispec.ts',
            title:
              'EC-084 rich_text.v1 verdicts and bounds: TypeScript equals PostgreSQL both validators refuse a span of 10001 characters',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-rich-text-parity.apispec.ts',
            title:
              'EC-084 rich_text.v1 verdicts and bounds: TypeScript equals PostgreSQL both validators admit list depth 1, 2 and 3 in one run, then a restart',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-rich-text-parity.apispec.ts',
            title:
              'EC-084 rich_text.v1 verdicts and bounds: TypeScript equals PostgreSQL both validators refuse list depth 4 after depth 3',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-rich-text-parity.apispec.ts',
            title:
              'EC-084 rich_text.v1 verdicts and bounds: TypeScript equals PostgreSQL both validators refuse list depth 0',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-rich-text-parity.apispec.ts',
            title:
              'EC-084 rich_text.v1 verdicts and bounds: TypeScript equals PostgreSQL both validators refuse a list depth jump of two',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-rich-text-parity.apispec.ts',
            title:
              'EC-084 rich_text.v1 verdicts and bounds: TypeScript equals PostgreSQL both validators refuse a numbered item at depth 2 right after a bulleted depth 1',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-rich-text-parity.apispec.ts',
            title:
              'EC-085 the protected rich_text.v1@1 descriptor is identical in TypeScript and PostgreSQL pins the very bounds the grammar enforces: the descriptor bounds equal the verdicts of both validators',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rich_text_v1.sql',
            title: '[P2-S10-AC-082] 129 blocks is refused',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/content-schema-registry/structured-values.test.ts',
            title:
              '[P2-S10] RichTextV1Schema list nesting forbids a list depth increase greater than one within a run',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S10-AC-083',
    text: '`rich_text.v1` admits only bold/italic/code marks and https/mailto/safe internal-route links, rejects inline embeds and unsafe schemes, and never accepts raw HTML.',
    clauses: [
      {
        text: '`rich_text.v1` admits only bold/italic/code marks',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rich_text_v1.sql',
            title:
              '[P2-S10-AC-083] canonical bold/italic/code marks are admitted',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rich_text_v1.sql',
            title: '[P2-S10-AC-083] an unknown mark is refused',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/content-schema-registry/structured-values.test.ts',
            title:
              '[P2-S10] RichTextV1Schema spans keeps marks unique and in canonical enum order',
          },
        ],
      },
      {
        text: 'https/mailto/safe internal-route links',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rich_text_v1.sql',
            title: '[P2-S10-AC-083] an absolute https link is admitted',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rich_text_v1.sql',
            title: '[P2-S10-AC-083] a mailto link is admitted',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rich_text_v1.sql',
            title: '[P2-S10-AC-083] an internal absolute route is admitted',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/content-schema-registry/structured-values.test.ts',
            title:
              '[P2-S10] RichTextV1Schema links accepts an internal route and rejects unsafe routes',
          },
        ],
      },
      {
        text: 'rejects inline embeds',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-rich-text-parity.apispec.ts',
            title:
              'EC-084 rich_text.v1 verdicts and bounds: TypeScript equals PostgreSQL both validators refuse an inline embed member on a span',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-rich-text-parity.apispec.ts',
            title:
              'EC-084 rich_text.v1 verdicts and bounds: TypeScript equals PostgreSQL both validators refuse an html member on a span',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-rich-text-parity.apispec.ts',
            title:
              'EC-084 rich_text.v1 verdicts and bounds: TypeScript equals PostgreSQL both validators refuse an embed link kind',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-rich-text-parity.apispec.ts',
            title:
              'EC-084 rich_text.v1 verdicts and bounds: TypeScript equals PostgreSQL both validators refuse an image block',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-r1-typed-values.apispec.ts',
            title:
              'EC-073/EC-083/EC-084 rich_text values: TypeScript verdict equals the typed 422 an inline embed span is refused by TypeScript and by create with reasonCode rich_text_not_canonical, changing nothing',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-r1-typed-values.apispec.ts',
            title:
              'EC-073/EC-083/EC-084 rich_text values: TypeScript verdict equals the typed 422 an embed link kind is refused by TypeScript and by create with reasonCode rich_text_not_canonical, changing nothing',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/content-schema-registry/structured-values.test.ts',
            title:
              '[P2-S10] RichTextV1Schema links no longer recognises the entry link kind',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rich_text_v1.sql',
            title: '[P2-S10-AC-083] an unknown link kind is refused',
          },
        ],
      },
      {
        text: 'unsafe schemes',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rich_text_v1.sql',
            title: '[P2-S10-AC-083] a javascript: link is refused',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rich_text_v1.sql',
            title: '[P2-S10-AC-083] a data: link is refused',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rich_text_v1.sql',
            title: '[P2-S10-AC-083] a plain-http link is refused',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/content-schema-registry/structured-values.test.ts',
            title:
              '[P2-S10] RichTextV1Schema links accepts an https link and rejects unsafe or protocol-relative links',
          },
        ],
      },
      {
        text: 'never accepts raw HTML.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-rich-text-parity.apispec.ts',
            title:
              'EC-084 rich_text.v1 verdicts and bounds: TypeScript equals PostgreSQL both validators refuse a raw HTML string',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-rich-text-parity.apispec.ts',
            title:
              'EC-084 rich_text.v1 verdicts and bounds: TypeScript equals PostgreSQL both validators refuse a typed raw-HTML block',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-rich-text-parity.apispec.ts',
            title:
              'EC-084 rich_text.v1 verdicts and bounds: TypeScript equals PostgreSQL both validators refuse an attrs member on a block',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-r1-typed-values.apispec.ts',
            title:
              'EC-073/EC-083/EC-084 rich_text values: TypeScript verdict equals the typed 422 a raw HTML string is refused by TypeScript and by create with reasonCode rich_text_not_canonical, changing nothing',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-r1-typed-values.apispec.ts',
            title:
              'EC-073/EC-083/EC-084 rich_text values: TypeScript verdict equals the typed 422 a typed raw-HTML block is refused by TypeScript and by create with reasonCode rich_text_not_canonical, changing nothing',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-rich-text-parity.apispec.ts',
            title:
              'EC-084 rich_text.v1 verdicts and bounds: TypeScript equals PostgreSQL both validators admit HTML-looking text, which is plain text and never markup',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-rich-text/phase-02-slice-10-ev-ec-rich-text-ui.test.tsx',
            title:
              'EC-087 the typed renderer maps only validated nodes to native elements renders HTML-looking text as inert text, never as markup',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rich_text_admission.sql',
            title: 'executable HTML cannot enter a rich-text draft as a string',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S10-AC-084',
    text: '`rich_text.v1` normalizes to RFC 8785/JCS bytes and the TypeScript and PostgreSQL validators produce parity for canonical hashes, bounds, and typed errors.',
    clauses: [
      {
        text: '`rich_text.v1` normalizes to RFC 8785/JCS bytes',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-rich-text-parity.apispec.ts',
            title:
              'EC-084 rich_text.v1 canonical bytes: TypeScript equals PostgreSQL the JCS text and SHA-256 of characters JCS must escape or keep verbatim are identical in TypeScript and PostgreSQL',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-rich-text-parity.apispec.ts',
            title:
              'EC-084 rich_text.v1 canonical bytes: TypeScript equals PostgreSQL the JCS text and SHA-256 of astral and CJK text are identical in TypeScript and PostgreSQL',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-rich-text-parity.apispec.ts',
            title:
              'EC-084 rich_text.v1 canonical bytes: TypeScript equals PostgreSQL is compact key-sorted JSON: no whitespace, members in code-unit order, unicode kept as characters',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/content-schema-registry/protected-validator-descriptor.test.ts',
            title:
              '[P2-S10-AC-085] canonical rich_text.v1@1 grammar descriptor is the compact key-sorted JSON the SQL registry hashes',
          },
        ],
      },
      {
        text: 'the TypeScript and PostgreSQL validators produce parity for canonical hashes',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-rich-text-parity.apispec.ts',
            title:
              'EC-084 rich_text.v1 canonical bytes: TypeScript equals PostgreSQL the JCS text and SHA-256 of headings 2 to 4 and a quote are identical in TypeScript and PostgreSQL',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-rich-text-parity.apispec.ts',
            title:
              'EC-084 rich_text.v1 canonical bytes: TypeScript equals PostgreSQL the canonical hash of https, mailto and internal links does not depend on the order the keys arrive in',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/content-schema-registry/protected-validator-descriptor.test.ts',
            title:
              '[P2-S10-AC-085] TypeScript and SQL registries hold the same descriptor the SQL registry migration carries the artifact reference, key and every descriptor value',
          },
        ],
      },
      {
        text: 'bounds',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/content-schema-registry/rich-text-link-parity.test.ts',
            title:
              '[P2-S10-AC-084] rich_text.v1 bounds count Unicode characters like PostgreSQL accepts a span of exactly 10000 astral characters and refuses 10001',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_rich_text_link_parity.sql',
            title: 'PG units: a span of 10001 astral characters is refused',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-rich-text-parity.apispec.ts',
            title:
              'EC-084 rich_text.v1 verdicts and bounds: TypeScript equals PostgreSQL both validators refuse 129 blocks',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-rich-text-parity.apispec.ts',
            title:
              'EC-084 rich_text.v1 verdicts and bounds: TypeScript equals PostgreSQL both validators admit the 128-block bound',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-rich-text-parity.apispec.ts',
            title:
              'EC-084 rich_text.v1 verdicts and bounds: TypeScript equals PostgreSQL both validators admit the 128-span bound in one paragraph',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-rich-text-parity.apispec.ts',
            title:
              'EC-084 rich_text.v1 verdicts and bounds: TypeScript equals PostgreSQL both validators refuse 129 spans in one paragraph',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-rich-text-parity.apispec.ts',
            title:
              'EC-084 rich_text.v1 verdicts and bounds: TypeScript equals PostgreSQL both validators refuse a span of 10001 characters',
          },
        ],
      },
      {
        text: 'typed errors.',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/content-schema-registry/structured-values-rich-text-reason.test.ts',
            title:
              'AC-084: the TypeScript validator answers the PostgreSQL reason token exports the token PostgreSQL emits',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/content-schema-registry/structured-values-rich-text-reason.test.ts',
            title:
              'AC-084: the TypeScript validator answers the PostgreSQL reason token a raw HTML string is refused with rich_text_not_canonical (the verdict of the schema and of SQL)',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/content-schema-registry/structured-values-rich-text-reason.test.ts',
            title:
              'AC-084: the TypeScript validator answers the PostgreSQL reason token a typed raw-HTML block is refused with rich_text_not_canonical (the verdict of the schema and of SQL)',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/content-schema-registry/structured-values-rich-text-reason.test.ts',
            title:
              'AC-084: the TypeScript validator answers the PostgreSQL reason token an inline embed span is refused with rich_text_not_canonical (the verdict of the schema and of SQL)',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/content-schema-registry/structured-values-rich-text-reason.test.ts',
            title:
              'AC-084: the TypeScript validator answers the PostgreSQL reason token an unknown mark is refused with rich_text_not_canonical (the verdict of the schema and of SQL)',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/content-schema-registry/structured-values-rich-text-reason.test.ts',
            title:
              'AC-084: the TypeScript validator answers the PostgreSQL reason token heading level 1 is refused with rich_text_not_canonical (the verdict of the schema and of SQL)',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/content-schema-registry/structured-values-rich-text-reason.test.ts',
            title:
              'AC-084: the TypeScript validator answers the PostgreSQL reason token a javascript: link is refused with rich_text_not_canonical (the verdict of the schema and of SQL)',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/content-schema-registry/structured-values-rich-text-reason.test.ts',
            title:
              'AC-084: the TypeScript validator answers the PostgreSQL reason token adjacent spans with equal marks is refused with rich_text_not_canonical (the verdict of the schema and of SQL)',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/content-schema-registry/structured-values-rich-text-reason.test.ts',
            title:
              'AC-084: the TypeScript validator answers the PostgreSQL reason token points at the first offending location without echoing text',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-fields/cms-field-value.test.ts',
            title:
              'AC-084: the field validation names a refused rich text with the PostgreSQL reason token and the one fixed copy returns rich_text_not_canonical with the same copy the server reason maps to',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-r1-typed-values.apispec.ts',
            title:
              'EC-073/EC-083/EC-084 rich_text values: TypeScript verdict equals the typed 422 a raw HTML string is refused by TypeScript and by create with reasonCode rich_text_not_canonical, changing nothing',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-r1-typed-values.apispec.ts',
            title:
              'EC-073/EC-083/EC-084 rich_text values: TypeScript verdict equals the typed 422 a typed raw-HTML block is refused by TypeScript and by create with reasonCode rich_text_not_canonical, changing nothing',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-r1-typed-values.apispec.ts',
            title:
              'EC-073/EC-083/EC-084 rich_text values: TypeScript verdict equals the typed 422 an inline embed span is refused by TypeScript and by create with reasonCode rich_text_not_canonical, changing nothing',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-r1-typed-values.apispec.ts',
            title:
              'EC-073/EC-083/EC-084 rich_text values: TypeScript verdict equals the typed 422 an unknown mark is refused by TypeScript and by create with reasonCode rich_text_not_canonical, changing nothing',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-r1-typed-values.apispec.ts',
            title:
              'EC-073/EC-083/EC-084 rich_text values: TypeScript verdict equals the typed 422 heading level 1 is refused by TypeScript and by create with reasonCode rich_text_not_canonical, changing nothing',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-r1-typed-values.apispec.ts',
            title:
              'EC-073/EC-083/EC-084 rich_text values: TypeScript verdict equals the typed 422 a javascript: link is refused by TypeScript and by create with reasonCode rich_text_not_canonical, changing nothing',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-r1-typed-values.apispec.ts',
            title:
              'EC-073/EC-083/EC-084 rich_text values: TypeScript verdict equals the typed 422 keeps the browser reason copy for the one token PostgreSQL emits, and admits a canonical document everywhere',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S10-AC-085',
    text: '`rich_text.v1` is a protected immutable validator key/version whose artifact reference and hash are frozen into the schema artifact and revalidated before every editorial transition.',
    clauses: [
      {
        text: '`rich_text.v1` is a protected immutable validator key/version whose artifact reference and hash are frozen into the schema artifact',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/content-schema-registry/protected-validators.test.ts',
            title:
              '[P2-S10-AC-085] protected validator registry has rich_text.v1 version 1 as its only member, paired with rich_text only',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_validator_registry_gate.sql',
            title:
              '[P2-S10-AC-085] the member version is immutable: an unregistered version is refused',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_protected_validator_freeze.sql',
            title:
              'a rich_text field freezes the rich_text.v1 artifact reference and hash into the editor manifest [DEC-146, AC-085]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_protected_validator_freeze.sql',
            title:
              'the frozen validator entry is inside the artifact hash [DEC-146]',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/content-schema-registry/protected-validator-descriptor.test.ts',
            title:
              '[P2-S10-AC-085] canonical rich_text.v1@1 grammar descriptor hashes to the pinned JCS SHA-256 and carries the pinned artifact reference',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-rich-text-parity.apispec.ts',
            title:
              'EC-085 the protected rich_text.v1@1 descriptor is identical in TypeScript and PostgreSQL holds the same descriptor body, member for member',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-rich-text-parity.apispec.ts',
            title:
              'EC-085 the protected rich_text.v1@1 descriptor is identical in TypeScript and PostgreSQL hashes it to the same JCS SHA-256 in TypeScript, in PostgreSQL and in the pinned constant',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-rich-text-parity.apispec.ts',
            title:
              'EC-085 the protected rich_text.v1@1 descriptor is identical in TypeScript and PostgreSQL returns the same registry entry (key, version, artifact reference, hash) and nothing for any other member',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/content-schema-registry/protected-validator-descriptor.test.ts',
            title:
              '[P2-S10-AC-085] TypeScript and SQL registries hold the same descriptor the SQL registry migration carries the artifact reference, key and every descriptor value',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-r1-typed-values.apispec.ts',
            title:
              'EC-085 the compiled artifact of a type that uses rich_text freezes the TypeScript registry entry carries exactly the entry the TypeScript registry returns, inside the artifact hash that equals the definition hash',
          },
        ],
      },
      {
        text: 'revalidated before every editorial transition.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_protected_validator_freeze.sql',
            title:
              'when the registry no longer matches the frozen descriptor every editorial transition is DEPENDENCY_UNAVAILABLE [DEC-146, AC-085]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_protected_validator_freeze.sql',
            title:
              'when the artifact froze no validator although its definition uses the grammar every editorial transition is DEPENDENCY_UNAVAILABLE [DEC-146, AC-085]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_protected_validator_freeze.sql',
            title:
              'a refused transition committed no entry, revision, value, conflict, reservation, outbox or audit row',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S10-AC-086',
    text: 'The constrained native rich-text editor exposes semantic block, list, mark, and link controls with keyboard/focus/error behavior and never exposes a raw JSON or HTML editor.',
    clauses: [
      {
        text: 'The constrained native rich-text editor exposes semantic block, list',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-rich-text/phase-02-slice-10-ev-ec-rich-text-ui.test.tsx',
            title:
              'EC-086 the constrained rich-text editor exposes semantic native controls offers block-type, heading-level, list-style and list-depth selects with the closed choices only',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-rich-text/phase-02-slice-10-ev-ec-rich-text-ui.test.tsx',
            title:
              'EC-086 the constrained rich-text editor exposes semantic native controls is native controls in document order, with no positive tabindex and no custom widget',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-rich-text/phase-02-slice-10-ev-ec-rich-text-ui.test.tsx',
            title:
              'EC-086 the constrained rich-text editor exposes semantic native controls reorders and removes blocks from the keyboard buttons, and disables a move that cannot happen',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-rich-text/phase-02-slice-10-ev-ec-rich-text-ui.test.tsx',
            title:
              'EC-086 the constrained rich-text editor exposes semantic native controls changes the document when a block, heading-level, list-style or list-depth select is chosen',
          },
        ],
      },
      {
        text: 'mark, and link controls with keyboard/focus/error behavior',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-rich-text/CmsRichTextEditor.controls.test.tsx',
            title:
              'mark controls offers Bold, Italic and Code toggles and a Link control in a labelled toolbar for every block',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-rich-text/CmsRichTextEditor.controls.test.tsx',
            title:
              'mark controls applies Bold to the selected text, updates the textarea and emits the canonical AST',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-rich-text/CmsRichTextEditor.controls.test.tsx',
            title:
              'mark controls toggles it off again, and reports the pressed state for the selection',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-rich-text/CmsRichTextEditor.controls.test.tsx',
            title:
              'mark controls says what to do, politely, when nothing is selected, and changes nothing',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-rich-text/CmsRichTextEditor.controls.test.tsx',
            title:
              'link controls opens an inline address field with focus, applies a https link on Enter and returns focus to the text',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-rich-text/CmsRichTextEditor.controls.test.tsx',
            title:
              'link controls Escape closes the field before anything changes and returns focus to the Link control',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-rich-text/CmsRichTextEditor.controls.test.tsx',
            title:
              'link controls refuses javascript:alert(1) inline, names it, marks the field invalid, keeps focus and changes nothing',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-rich-text/CmsRichTextEditor.controls.test.tsx',
            title: 'link controls asks for an address when it is empty',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-rich-text/CmsRichTextEditor.controls.test.tsx',
            title: 'link controls removes a link and keeps its text',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-rich-text/CmsRichTextEditor.controls.test.tsx',
            title:
              'the controls expose no raw JSON or HTML shows labelled controls and text only',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-rich-text/cms-rich-text-selection.test.ts',
            title:
              'toggleMarkInMarkup turns a mark on for exactly the selected text, and the selection follows the text',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-rich-text/cms-rich-text-selection.test.ts',
            title:
              'the controls never change the text and always leave canonical markup holds for 300 seeded random blocks, selections and operations',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-rich-text/phase-02-slice-10-ev-ec-rich-text-ui.test.tsx',
            title:
              'EC-086 the constrained rich-text editor exposes semantic native controls keeps focus and the typed text on an inline error and clears it when the text is fixed',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-rich-text/phase-02-slice-10-ev-ec-rich-text-ui.test.tsx',
            title:
              'EC-086 the constrained rich-text editor exposes semantic native controls refuses an unsafe link inline, names the destination and submits nothing',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-rich-text/CmsRichTextEditor.test.tsx',
            title:
              '[P2-S10] CmsRichTextEditor [P2-S10-AC-086] refuses non-canonical markup inline before submit',
          },
        ],
      },
      {
        text: 'never exposes a raw JSON or HTML editor.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-rich-text/phase-02-slice-10-ev-ec-rich-text-ui.test.tsx',
            title:
              'EC-086 the constrained rich-text editor exposes semantic native controls authors marks and links as constrained markup, never as JSON or HTML',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-fields/CmsFieldEditor.test.tsx',
            title:
              'CmsFieldEditor: kinds without a producer, and rich text uses the constrained rich text editor, labelled once',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-rich-text/CmsRichTextEditor.test.tsx',
            title:
              '[P2-S10] CmsRichTextEditor [P2-S10-AC-086] refuses an invalid initial document without editing it',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S10-AC-087',
    text: 'The typed rich-text renderer maps only validated AST nodes to native elements without `dangerouslySetInnerHTML`, and fails closed with a safe recoverable state for unknown or invalid nodes.',
    clauses: [
      {
        text: 'The typed rich-text renderer maps only validated AST nodes to native elements',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-rich-text/phase-02-slice-10-ev-ec-rich-text-ui.test.tsx',
            title:
              'EC-087 the typed renderer maps only validated nodes to native elements renders every block, mark and link variant as its native element',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-rich-text/phase-02-slice-10-ev-ec-rich-text-ui.test.tsx',
            title:
              'EC-087 the typed renderer maps only validated nodes to native elements fails closed with an inert, accessible notice for an unknown block type',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-rich-text/phase-02-slice-10-ev-ec-rich-text-ui.test.tsx',
            title:
              'EC-087 the typed renderer maps only validated nodes to native elements fails closed with an inert, accessible notice for an unknown mark',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-rich-text/CmsRichTextRenderer.test.tsx',
            title:
              '[P2-S10] CmsRichTextRenderer [P2-S10-AC-087] renders typed elements without dangerouslySetInnerHTML',
          },
        ],
      },
      {
        text: 'without `dangerouslySetInnerHTML`',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/phase-02-slice-10-ev-ec-source-guards.test.ts',
            title:
              'EC-087 the typed rich-text renderer has no raw-HTML escape hatch never sets inner HTML in any form',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-rich-text/phase-02-slice-10-ev-ec-rich-text-ui.test.tsx',
            title:
              'EC-087 the typed renderer maps only validated nodes to native elements renders HTML-looking text as inert text, never as markup',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/phase-02-slice-10-ev-ec-source-guards.test.ts',
            title:
              'EC-087 the typed rich-text renderer has no raw-HTML escape hatch only parses a document through the shared canonical schema before it builds an element',
          },
        ],
      },
      {
        text: 'fails closed with a safe recoverable state for unknown or invalid nodes.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-rich-text/CmsRichTextRenderer.test.tsx',
            title:
              '[P2-S10] CmsRichTextRenderer [P2-S10-AC-087] fails closed for an invalid span instead of repairing marks',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-rich-text/phase-02-slice-10-ev-ec-rich-text-ui.test.tsx',
            title:
              'EC-087 the typed renderer maps only validated nodes to native elements fails closed with an inert, accessible notice for a javascript: https href',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-rich-text/phase-02-slice-10-ev-ec-rich-text-ui.test.tsx',
            title:
              'EC-087 the typed renderer maps only validated nodes to native elements fails closed with an inert, accessible notice for a raw html block',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-rich-text/phase-02-slice-10-ev-ec-rich-text-ui.test.tsx',
            title:
              'EC-087 the typed renderer maps only validated nodes to native elements stays recoverable: the notice never throws, siblings keep working, and a valid value renders again',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S10-AC-088',
    text: 'CMS-03B-12 registers a strict protected GET conflict-detail contract and returns one readable open conflict with bounded base/theirs/yours typed preimages, provenance, and a strong ETag.',
    clauses: [
      {
        text: 'CMS-03B-12 registers a strict protected GET conflict-detail contract',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/supplemental-routes.test.ts',
            title:
              'supplemental cms editorial route registry binds CMS-03B-12 to the conflict-detail read contracts',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/supplemental-routes.test.ts',
            title:
              'supplemental cms editorial route registry gives all three reads the exact locked read policy fields',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-10-editorial-registry-openapi.test.ts',
            title:
              'Slice 10 CMS-03B-12/13/14 supplemental read authority documents CMS-03B-12 with two path UUIDs, no query, and no body',
          },
        ],
      },
      {
        text: 'returns one readable open conflict with bounded base/theirs/yours typed preimages, provenance',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_conflict_detail.sql',
            title:
              'CMS-03B-12 open conflict carries bounded per-path three-way preimages',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/conflict-detail-routes.test.ts',
            title:
              'CMS-03B-12 protected conflict-detail route [P2-S10-AC-088] serves the strict three-way conflict detail with a strong no-store ETag',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/conflict-detail.test.ts',
            title:
              'conflict detail side accepts a nullable value, the closed provenance, and a nullable hash',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/cms-editorial-composition-flows.apispec.ts',
            title:
              'CMS-03B-01 conflict, CMS-03B-12 detail and CMS-03B-02 resolve through the real stack [P2-S10-AC-088] [P2-S10-AC-090] the draft names the open conflict and CMS-03B-12 serves its three sides',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-reads.apispec.ts',
            title:
              'EC CMS-03B-12 conflict detail through the real stack [EC-088][EC-092] serves the open conflict with typed preimages, a strong ETag and no ownership identifier',
          },
        ],
      },
      {
        text: 'a strong ETag.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/conflict-detail-routes.test.ts',
            title:
              'CMS-03B-12 protected conflict-detail route [P2-S10-AC-088] changes the strong ETag whenever a bound conflict or entry version changes',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/server/cms-editorial-platform-reads-app.test.ts',
            title:
              'cms-editorial conflict-detail read proxy (CMS-03B-12) collapses a cross-addressed or weak-ETag upstream success to 502',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-reads.apispec.ts',
            title:
              'EC CMS-03B-12 conflict detail through the real stack [EC-088][EC-092] serves the open conflict with typed preimages, a strong ETag and no ownership identifier',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S10-AC-089',
    text: 'CMS-03B-12 rejects malformed entry/conflict UUIDs, undeclared queries or bodies, and out-of-bound preimages before any existence or dependency work.',
    clauses: [
      {
        text: 'CMS-03B-12 rejects malformed entry/conflict UUIDs',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/conflict-detail-routes.test.ts',
            title:
              'CMS-03B-12 protected conflict-detail route [P2-S10-AC-089] rejects a malformed entry or conflict UUID as 400 before any dependency work',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/server/cms-editorial-platform-reads-app.test.ts',
            title:
              'cms-editorial conflict-detail read proxy (CMS-03B-12) answers malformed addressing as 400 INVALID_REQUEST without an upstream call (DEC-145)',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-pages/load-conflict-page.test.ts',
            title:
              'loadConflictPage answers a malformed conflict id as an invalid request without an upstream call',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-reads.apispec.ts',
            title:
              'EC CMS-03B-12 conflict detail through the real stack [EC-089] never reaches the database for malformed addressing or an undeclared query',
          },
        ],
      },
      {
        text: 'undeclared queries or bodies',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/conflict-detail-routes.test.ts',
            title:
              'CMS-03B-12 protected conflict-detail route [P2-S10-AC-089] rejects undeclared queries, request bodies, and mutation headers on the read',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/conflict-detail.test.ts',
            title:
              'conflict detail addressing accepts an empty query and rejects every unknown query key',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/server/cms-editorial-platform-reads-app.test.ts',
            title:
              'cms-editorial conflict-detail read proxy (CMS-03B-12) refuses a query string and read mutation headers',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-reads.apispec.ts',
            title:
              'EC CMS-03B-12 conflict detail through the real stack [EC-089] never reaches the database for malformed addressing or an undeclared query',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ec-r1-read-boundary.test.ts',
            title:
              'EC-095 the safe reads refuse a body and mutation headers before any database call CMS-03B-12 refuses a declared request body (Content-Length) without calling the database',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ec-r1-read-boundary.test.ts',
            title:
              'EC-095 the safe reads refuse a body and mutation headers before any database call CMS-03B-12 refuses a chunked request body (Transfer-Encoding) without calling the database',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ec-r1-read-boundary.test.ts',
            title:
              'EC-095 the safe reads refuse a body and mutation headers before any database call CMS-03B-12 refuses a request media type (Content-Type) without calling the database',
          },
        ],
      },
      {
        text: 'out-of-bound preimages before any existence or dependency work.',
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Clause "out-of-bound preimages before any existence or dependency work" is not satisfiable as worded: a preimage exists only in the dependency response, so its bound (128 paths, 256 KiB per side) is enforced as a response-contract check AFTER the read (Worker 502 on an out-of-bound or invalid resource, contract cap of 128 paths, SQL INTERNAL_ERROR on an over-bound stored side, and a bounded write-time `proposed_values` CHECK), never before it. Malformed UUIDs, undeclared queries and bodies ARE refused before any database call (EC R1 read-boundary suite). Needs a wording ruling: amend AC-089 so the "before any existence or dependency work" clause governs only addressing/queries/bodies. EVIDENCE GAP EC R1 089-a. R1b: no production change landed for this clause, and it is not a DEC-147 forward-scope item (preview/publication): the gap is the criterion wording itself, so it stays partial until the wording ruling.',
  },
  {
    criterion: 'P2-S10-AC-090',
    text: 'CMS-03B-12 derives session and acting context, requires current editorial read authority, and makes hidden, wrong-scope, closed, or absent conflicts indistinguishable 404 responses.',
    clauses: [
      {
        text: 'CMS-03B-12 derives session and acting context',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_conflict_detail.sql',
            title:
              'CMS-03B-12 rejects a caller-supplied owner field as INVALID_REQUEST',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_conflict_detail.sql',
            title:
              'CMS-03B-12 read without an authenticated actor returns UNAUTHENTICATED',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/conflict-detail-routes.test.ts',
            title:
              'CMS-03B-12 protected conflict-detail route [P2-S10-AC-090] answers an anonymous caller 401 and a reviewer-only session 403 before persistence',
          },
        ],
      },
      {
        text: 'requires current editorial read authority',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_conflict_detail.sql',
            title:
              'CMS-03B-12 visible entry without read scope returns FORBIDDEN',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/conflict-detail-routes.test.ts',
            title:
              'CMS-03B-12 protected conflict-detail route [P2-S10-AC-090] distinguishes a visible-but-unassigned conflict as 403 without disclosing values',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-reads.apispec.ts',
            title:
              'EC CMS-03B-12 conflict detail through the real stack [EC-090] conceals an absent, foreign or outsider-read conflict as one empty 404 and tells a visible but unassigned member 403',
          },
        ],
      },
      {
        text: 'makes hidden, wrong-scope, closed, or absent conflicts indistinguishable 404 responses.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/conflict-detail-routes.test.ts',
            title:
              'CMS-03B-12 protected conflict-detail route [P2-S10-AC-090] conceals a hidden or absent conflict as an indistinguishable 404 with empty details',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_conflict_detail.sql',
            title:
              'CMS-03B-12 conceals a resolved conflict as NOT_FOUND, identical to an absent one [DEC-139, AC-090]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_conflict_detail.sql',
            title: 'CMS-03B-12 conceals an absent or foreign conflict identity',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/cms-editorial-composition-flows.apispec.ts',
            title:
              'CMS-03B-01 conflict, CMS-03B-12 detail and CMS-03B-02 resolve through the real stack [P2-S10-AC-090] a closed conflict is the same 404 as an absent one, and resolving it again is a 409 transition',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-reads.apispec.ts',
            title:
              'EC CMS-03B-12 conflict detail through the real stack [EC-090] conceals an absent, foreign or outsider-read conflict as one empty 404 and tells a visible but unassigned member 403',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S10-AC-091',
    text: 'CMS-03B-12 is no-store, uses the conflict ETag, and enforces the declared read rate, deadline, cancellation, and bounded response limits.',
    clauses: [
      {
        text: 'CMS-03B-12 is no-store',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/conflict-detail-routes.test.ts',
            title:
              'CMS-03B-12 protected conflict-detail route [P2-S10-AC-088] serves the strict three-way conflict detail with a strong no-store ETag',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-ports-coverage.test.ts',
            title:
              'cms editorial production ports [P2-S10-AC-091] [P2-S10-AC-097] [P2-S10-AC-103] declares the S10 reads as strong no-store ETag reads over the shared read class',
          },
        ],
      },
      {
        text: 'uses the conflict ETag',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/conflict-detail-routes.test.ts',
            title:
              'CMS-03B-12 protected conflict-detail route [P2-S10-AC-088] changes the strong ETag whenever a bound conflict or entry version changes',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/server/cms-editorial-platform-reads-app.test.ts',
            title:
              'cms-editorial conflict-detail read proxy (CMS-03B-12) relays a bounded strict resource with its exact ETag',
          },
        ],
      },
      {
        text: 'enforces the declared read rate',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/conflict-detail-routes.test.ts',
            title:
              'CMS-03B-12 protected conflict-detail route [P2-S10-AC-091] enforces the declared read rate and publishes the read limit',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-rate-scope.test.ts',
            title:
              'route registry rate limits (BE03b:152-165) CMS-03B-12 asks the limiter for 300/min per actor and 600/min per acting party, never mixed',
          },
        ],
      },
      {
        text: 'deadline',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/conflict-detail-routes.test.ts',
            title:
              'CMS-03B-12 protected conflict-detail route [P2-S10-AC-092] maps a dependency timeout to 504 and an invalid response to 502',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/safe-read-routes-admission.test.ts',
            title:
              "'CMS-03B-12 conflict detail' admission answers 504 without calling the session resolver once the deadline is spent",
          },
        ],
      },
      {
        text: 'cancellation',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/conflict-detail-routes.test.ts',
            title:
              'CMS-03B-12 protected conflict-detail route [P1-S10-API] composes request cancellation with the bounded dependency signal',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-cancellation.test.ts',
            title:
              'client cancellation reaches the RPC [P2-S10-AC-007] [P2-S10-AC-091] CMS-03B-12 (conflict detail) aborts the in-flight PostgREST call when the client disconnects',
          },
        ],
      },
      {
        text: 'bounded response limits.',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/conflict-detail.test.ts',
            title:
              'conflict detail resource envelope caps paths at 128 entries',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-transport-coverage.test.ts',
            title:
              'cms editorial production transport bounds rejects a declared content length beyond the response budget',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S10-AC-092',
    text: 'CMS-03B-12 maps only its declared safe typed errors, omits unreadable values and all owner/resolver/authority identifiers, and never relays upstream text.',
    clauses: [
      {
        text: 'CMS-03B-12 maps only its declared safe typed errors',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/conflict-detail-routes.test.ts',
            title:
              'CMS-03B-12 protected conflict-detail route [P1-S10-API] normalizes undeclared dependency errors (409 is not declared for CMS-03B-12) to a scrubbed 500 and drops private details',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/route-errors.test.ts',
            title:
              'safe-read error projection refuses a 409 on a read whose matrix row declares none (CMS-03B-12) as a scrubbed 500',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/supplemental-routes.test.ts',
            title:
              'supplemental cms editorial route registry uses bounded safe read errors with no CONFLICT on the conflict-detail and authoring-context rows',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ec-r3-read-errors.test.ts',
            title:
              'EC-092/EC-098 CMS-03B-12 answers a database refusal with its declared safe typed error CMS-03B-12 maps the UNAUTHENTICATED token to 401 with the fixed message and details',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ec-r3-read-errors.test.ts',
            title:
              'EC-092/EC-098 CMS-03B-12 answers a database refusal with its declared safe typed error CMS-03B-12 maps the FORBIDDEN token to 403 with the fixed message and details',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ec-r3-read-errors.test.ts',
            title:
              'EC-092/EC-098 CMS-03B-12 answers a database refusal with its declared safe typed error CMS-03B-12 maps the NOT_FOUND token to 404 with the fixed message and details',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ec-r3-read-errors.test.ts',
            title:
              'EC-092/EC-098 CMS-03B-12 answers a database refusal with its declared safe typed error CMS-03B-12 maps the INVALID_REQUEST token to 400 with the fixed message and details',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ec-r3-read-errors.test.ts',
            title:
              'EC-092/EC-098 CMS-03B-12 answers a database refusal with its declared safe typed error CMS-03B-12 maps the INTERNAL_ERROR token to 500 with the fixed message and details',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ec-r3-read-errors.test.ts',
            title:
              'EC-092 CMS-03B-12 maps ONLY its declared errors a CONFLICT token (not declared for the conflict detail read) is a scrubbed 500, never a 409',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ec-r3-read-errors.test.ts',
            title:
              'EC-092 CMS-03B-12 maps ONLY its declared errors a INVALID_TRANSITION token (not declared for the conflict detail read) is a scrubbed 500, never a 409',
          },
        ],
      },
      {
        text: 'omits unreadable values',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ec_conflict_relation_sides.sql',
            title:
              'EC-092 the theirs side omits the target the caller can no longer read',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ec_conflict_relation_sides.sql',
            title: 'EC-092 the yours side keeps only the readable target [T1]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ec_conflict_relation_sides.sql',
            title:
              'EC-092 the unreadable target identity appears nowhere in the response',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ec_conflict_relation_sides.sql',
            title:
              'EC-092 the theirs valueHash is still the digest of the full canonical value, so equal sides keep equal hashes',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ec_conflict_relation_sides.sql',
            title:
              'EC-092 control: the theirs side shows [T2] while T2 is readable',
          },
        ],
      },
      {
        text: 'all owner/resolver/authority identifiers',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_conflict_detail.sql',
            title:
              'CMS-03B-12 exposes no ownership, acting-party, or resolver identifier',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/conflict-detail-routes.test.ts',
            title:
              'CMS-03B-12 protected conflict-detail route [P2-S10-AC-092] refuses any payload that serializes an ownership or resolver identifier',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/conflict-detail.test.ts',
            title:
              'conflict detail privacy rejects each private identity or ownership key at every level',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-pages/load-conflict-page.test.ts',
            title:
              'loadConflictPage serialises no owner, resolver or authority identifier',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-reads.apispec.ts',
            title:
              'EC CMS-03B-12 conflict detail through the real stack [EC-088][EC-092] serves the open conflict with typed preimages, a strong ETag and no ownership identifier',
          },
        ],
      },
      {
        text: 'never relays upstream text.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/route-errors.test.ts',
            title:
              'safe-read error projection replaces dependency text with the canonical message for the status',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/conflict-detail-routes.test.ts',
            title:
              'CMS-03B-12 protected conflict-detail route [P1-S10-API] normalizes undeclared dependency errors (409 is not declared for CMS-03B-12) to a scrubbed 500 and drops private details',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ec-r3-read-errors.test.ts',
            title:
              'EC-092/EC-098 CMS-03B-12 answers a database refusal with its declared safe typed error CMS-03B-12 never relays a database message: an unrecognised token is a scrubbed 500 INTERNAL_ERROR',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ec-r3-read-errors.test.ts',
            title:
              'EC-092/EC-098 CMS-03B-12 answers a database refusal with its declared safe typed error CMS-03B-12 answers an unreachable database as the retryable 503 DEPENDENCY_UNAVAILABLE, naming no upstream text',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S10-AC-093',
    text: 'CMS-03B-12 is read-only with no audit/outbox mutation; telemetry is redacted to operation, outcome, latency, safe counts, and request ID.',
    clauses: [
      {
        text: 'CMS-03B-12 is read-only with no audit/outbox mutation',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_conflict_detail.sql',
            title: 'CMS-03B-12 detail read emits no audit or outbox evidence',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/conflict-detail-routes.test.ts',
            title:
              'CMS-03B-12 protected conflict-detail route [P2-S10-AC-089] rejects undeclared queries, request bodies, and mutation headers on the read',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-safe-reads.test.ts',
            title:
              "production port-input admission for the safe reads refuses a write header, body, or non-GET method on 'CMS-03B-12'",
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-reads.apispec.ts',
            title:
              'EC reads are read-only, no-store and redacted [EC-072][EC-093][EC-099][EC-105] draft, conflict, list, preparation and history reads leave every durable fingerprint unchanged and answer no-store with an ETag',
          },
        ],
      },
      {
        text: 'telemetry is redacted to operation, outcome, latency, safe counts, and request ID.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/conflict-detail-routes.test.ts',
            title:
              'CMS-03B-12 protected conflict-detail route [P2-S10-AC-093] emits redacted telemetry carrying only the CMS-03B-12 operation id',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ec-read-telemetry.test.ts',
            title:
              "EC-093 safe-read telemetry through the real route and production adapter a served 'CMS-03B-12' read emits one event with operation, outcome, latency, request id and a safe 'paths_returned' count",
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ec-read-telemetry.test.ts',
            title:
              "EC-093 safe-read telemetry through the real route and production adapter a served 'CMS-03B-12' event carries no party, user, entry, conflict or value",
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ec-read-telemetry.test.ts',
            title:
              "EC-093 safe-read telemetry through the real route and production adapter a concealed 'CMS-03B-12' read counts a denied outcome and still carries the request id",
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S10-AC-094',
    text: 'CMS-03B-13 registers a strict protected assigned-entry list GET and returns a bounded keyset page of RevisionSummary rows plus an optional signed next cursor.',
    clauses: [
      {
        text: 'CMS-03B-13 registers a strict protected assigned-entry list GET',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/supplemental-routes.test.ts',
            title:
              'supplemental cms editorial route registry binds CMS-03B-13 to the entry-list read contracts without path params',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/supplemental-routes.test.ts',
            title:
              'supplemental platformRegistrySet rows registers the CMS-03B-13 platform row with editorial read defaults',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-10-editorial-registry-openapi.test.ts',
            title:
              'Slice 10 CMS-03B-12/13/14 supplemental read authority documents CMS-03B-13 with only the allowlisted query keys',
          },
        ],
      },
      {
        text: 'returns a bounded keyset page of RevisionSummary rows plus an optional signed next cursor.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/list-routes.test.ts',
            title:
              'CMS-03B-13 protected assigned-entry list route [P2-S10-AC-094] serves the bounded keyset page with a no-store page ETag',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/entry-list.test.ts',
            title:
              'CMS-03B-02 entry list page never returns more than 50 summaries while accepting the exact bound',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_entry_list_authorized_keyset.sql',
            title: 'page one holds the two newest authorized entries',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/cms-editorial-composition.apispec.ts',
            title:
              'CMS-03B-14 -> CMS-03B-10 -> CMS-03B-11 -> CMS-03B-13 through the real stack [P2-S10-AC-094] the entry list returns the entry with its lifecycle and a page ETag',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-reads.apispec.ts',
            title:
              'EC CMS-03B-13 entry list through the real stack [EC-094] pages every assigned entry exactly once with a signed next cursor that ends the walk',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_cursor_signature.sql',
            title:
              'CMS-03B-13 nextCursor is a seven-key signed envelope (keyId+signature present, collection epoch included)',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_entry_list_authorized_keyset.sql',
            title: 'the last authorized page carries no cursor',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/entry-list.test.ts',
            title:
              'CMS-03B-02 entry list page bounds the next cursor at 512 characters and requires the member',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S10-AC-095',
    text: 'CMS-03B-13 validates the closed filter/sort/cursor grammar and page bounds and rejects bodies, mutation headers, and undeclared query keys before reads.',
    clauses: [
      {
        text: 'CMS-03B-13 validates the closed filter/sort/cursor grammar',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/list-routes.test.ts',
            title:
              'CMS-03B-13 protected assigned-entry list route [P2-S10-AC-095] accepts only the closed state/contentTypeId/limit/cursor filters',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/entry-list.test.ts',
            title:
              'CMS-03B-02 entry list query refuses unknown keys and any caller-supplied ownership identifier',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/entry-list.test.ts',
            title:
              'CMS-03B-02 entry list query accepts only the closed revision states and a UUID content type',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_entry_list.sql',
            title:
              'an undeclared list filter key is a typed refusal, never an authority claim',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_entry_list.sql',
            title: 'an unsigned or malformed cursor is refused',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-reads.apispec.ts',
            title:
              'EC CMS-03B-13 entry list through the real stack [EC-095] rejects a closed-grammar violation before any database read',
          },
        ],
      },
      {
        text: 'page bounds',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/list-routes.test.ts',
            title:
              'CMS-03B-13 protected assigned-entry list route [P2-S10-AC-095] binds the port to CMS-03B-13 and applies the 25-row default window',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/entry-list.test.ts',
            title:
              'CMS-03B-02 entry list query bounds the window to 1..50 and refuses non-integers',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_entry_list.sql',
            title: 'a list limit above 50 is a typed refusal',
          },
        ],
      },
      {
        text: 'rejects bodies, mutation headers, and undeclared query keys before reads.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-safe-reads.test.ts',
            title:
              "production port-input admission for the safe reads refuses a write header, body, or non-GET method on 'CMS-03B-13'",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/safe-read-routes-admission.test.ts',
            title:
              'CMS-03B-13 closed query refuses a repeated filter instead of choosing one of its values',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-reads.apispec.ts',
            title:
              'EC CMS-03B-13 entry list through the real stack [EC-095] rejects a closed-grammar violation before any database read',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ec-r1-read-boundary.test.ts',
            title:
              'EC-095 the safe reads refuse a body and mutation headers before any database call CMS-03B-13 refuses a declared request body (Content-Length) without calling the database',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ec-r1-read-boundary.test.ts',
            title:
              'EC-095 the safe reads refuse a body and mutation headers before any database call CMS-03B-13 refuses a chunked request body (Transfer-Encoding) without calling the database',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ec-r1-read-boundary.test.ts',
            title:
              'EC-095 the safe reads refuse a body and mutation headers before any database call CMS-03B-13 refuses a request media type (Content-Type) without calling the database',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ec-r1-read-boundary.test.ts',
            title:
              'EC-095 the safe reads refuse a body and mutation headers before any database call CMS-03B-13 refuses an Idempotency-Key without calling the database',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ec-r1-read-boundary.test.ts',
            title:
              'EC-095 the safe reads refuse a body and mutation headers before any database call CMS-03B-13 refuses an If-Match without calling the database',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ec-r1-read-boundary.test.ts',
            title:
              'EC-095 the safe reads refuse a body and mutation headers before any database call CMS-03B-13 refuses an undeclared query key, a bad limit and a repeated filter without calling the database',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S10-AC-096',
    text: 'CMS-03B-13 derives session/acting context, returns only currently readable assigned entries, and reveals no hidden owner, assignment, capability, or authority identifier.',
    clauses: [
      {
        text: 'CMS-03B-13 derives session/acting context',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/list-routes.test.ts',
            title:
              'CMS-03B-13 protected assigned-entry list route [P2-S10-AC-096] answers an anonymous caller 401 and a reviewer-only session 403 before reads',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ec-r1-read-boundary.test.ts',
            title:
              'EC-096 the database receives the verified session as actor and acting party CMS-03B-13 sends exactly the declared query members plus the server-derived context',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ec-r1-read-boundary.test.ts',
            title:
              'EC-096 the database receives the verified session as actor and acting party a different verified session changes the actor and party the database receives',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ec-r1-read-boundary.test.ts',
            title:
              'EC-096 the database receives the verified session as actor and acting party a caller-supplied identity header or query has no effect on the context sent',
          },
        ],
      },
      {
        text: 'returns only currently readable assigned entries',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_entry_list_authorized_keyset.sql',
            title:
              'the creator lists exactly the active entries they hold an active assignment on, newest first (revoked assignment and archived entry omitted)',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_entry_list_authorized_keyset.sql',
            title:
              'the editor lists the one entry they are assigned (cms.editor) and nothing else',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_entry_list_authorized_keyset.sql',
            title: 'a member with no capability grant lists nothing',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_entry_list.sql',
            title:
              'a caller without an assignment lists no entries and learns no existence',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-reads.apispec.ts',
            title:
              'EC CMS-03B-13 entry list through the real stack [EC-096] lists only the entries the caller is assigned and never an owner or assignee identifier',
          },
        ],
      },
      {
        text: 'reveals no hidden owner, assignment, capability, or authority identifier.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/list-routes.test.ts',
            title:
              'CMS-03B-13 protected assigned-entry list route [P2-S10-AC-096] returns only authorized rows and never a hidden ownership identifier',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_response_contracts.sql',
            title: 'no list item carries an owner or assignee identifier',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_entry_list_authorized_keyset.sql',
            title: 'the hidden population changes nothing the creator sees',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/entry-list.test.ts',
            title:
              'CMS-03B-02 entry list page rejects unknown keys and ownership identifiers on the summary and page',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-reads.apispec.ts',
            title:
              'EC CMS-03B-13 entry list through the real stack [EC-096] lists only the entries the caller is assigned and never an owner or assignee identifier',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S10-AC-097',
    text: 'CMS-03B-13 signs and binds cursors to actor/context/filter/sort, is no-store, and enforces declared read rate, deadline, cancellation, and page limits.',
    clauses: [
      {
        text: 'CMS-03B-13 signs and binds cursors to actor/context/filter/sort',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_cursor_signature.sql',
            title:
              'CMS-03B-13 nextCursor is a seven-key signed envelope (keyId+signature present, collection epoch included)',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_cursor_signature.sql',
            title:
              'CMS-03B-13 binds a valid cursor to its original query scope',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_cursor_signature.sql',
            title:
              'CMS-03B-13 a signed cursor replayed by a different principal is the conflict token',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_cursor_signature.sql',
            title: 'CMS-03B-13 tampered cursor is the typed conflict refusal',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-reads.apispec.ts',
            title:
              'EC CMS-03B-13 entry list through the real stack [EC-097][EC-098] binds a cursor to its actor and filter, and maps a malformed, tampered or foreign cursor to the declared 400 or 409 with a safe restart',
          },
        ],
      },
      {
        text: 'is no-store',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/list-routes.test.ts',
            title:
              'CMS-03B-13 protected assigned-entry list route [P2-S10-AC-094] serves the bounded keyset page with a no-store page ETag',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-ports-coverage.test.ts',
            title:
              'cms editorial production ports [P2-S10-AC-091] [P2-S10-AC-097] [P2-S10-AC-103] declares the S10 reads as strong no-store ETag reads over the shared read class',
          },
        ],
      },
      {
        text: 'enforces declared read rate',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/list-routes.test.ts',
            title:
              'CMS-03B-13 protected assigned-entry list route [P2-S10-AC-097] enforces the declared read rate with the read limit',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-rate-scope.test.ts',
            title:
              'route registry rate limits (BE03b:152-165) CMS-03B-13 asks the limiter for 300/min per actor and 600/min per acting party, never mixed',
          },
        ],
      },
      {
        text: 'deadline',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/list-routes.test.ts',
            title:
              'CMS-03B-13 protected assigned-entry list route [P2-S10-AC-098] maps a dependency timeout to 504 and an invalid page to 502',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/safe-read-routes-admission.test.ts',
            title:
              "'CMS-03B-13 entry list' admission answers 504 without calling the session resolver once the deadline is spent",
          },
        ],
      },
      {
        text: 'cancellation',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-cancellation.test.ts',
            title:
              'client cancellation reaches the RPC [P2-S10-AC-007] [P2-S10-AC-091] CMS-03B-13 (entry list) aborts the in-flight PostgREST call when the client disconnects',
          },
        ],
      },
      {
        text: 'page limits.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/list-routes.test.ts',
            title:
              'CMS-03B-13 protected assigned-entry list route [P2-S10-AC-095] rejects undeclared query keys, bodies, and mutation headers before reads',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_entry_list.sql',
            title: 'a list limit above 50 is a typed refusal',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_cursor_signature.sql',
            title: 'CMS-03B-13 a zero page limit is the typed bounds refusal',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S10-AC-098',
    text: 'CMS-03B-13 maps malformed/expired cursor, auth, rate, dependency, and internal failures to declared safe errors with truthful retry/degraded behavior and no upstream-text relay.',
    clauses: [
      {
        text: 'CMS-03B-13 maps malformed/expired cursor, auth, rate, dependency, and internal failures to declared safe errors',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/list-routes.test.ts',
            title:
              'CMS-03B-13 protected assigned-entry list route [P2-S10-AC-098] keeps a structurally malformed cursor a 400 INVALID_REQUEST',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/list-routes.test.ts',
            title:
              'CMS-03B-13 protected assigned-entry list route [P2-S10-AC-098] publishes a well-formed expired or foreign cursor as the declared 409 with a safe restart and no upstream text',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_cursor_signature.sql',
            title:
              'CMS-03B-13 a malformed signed envelope is INVALID_REQUEST, never CONFLICT',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_cursor_signature.sql',
            title:
              'CMS-03B-13 an expired well-formed payload is CONFLICT [DEC-140]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-reads.apispec.ts',
            title:
              'EC CMS-03B-13 entry list through the real stack [EC-097][EC-098] binds a cursor to its actor and filter, and maps a malformed, tampered or foreign cursor to the declared 400 or 409 with a safe restart',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/list-routes.test.ts',
            title:
              'CMS-03B-13 protected assigned-entry list route [P2-S10-AC-096] answers an anonymous caller 401 and a reviewer-only session 403 before reads',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/route-errors.test.ts',
            title:
              'safe-read error projection reauthenticates on a 401 and states the dependency class on 502/503/504',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/list-routes.test.ts',
            title:
              'CMS-03B-13 protected assigned-entry list route [P2-S10-AC-097] enforces the declared read rate with the read limit',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/route-errors.test.ts',
            title:
              'safe-read error projection projects a bounded 429 envelope from the limit, reset and retry hints',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/list-routes.test.ts',
            title:
              'CMS-03B-13 protected assigned-entry list route [P2-S10-AC-098] maps a dependency timeout to 504 and an invalid page to 502',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/list-routes.test.ts',
            title:
              'CMS-03B-13 protected assigned-entry list route [P2-S10-AC-097] fails closed when the entry-list port is not wired',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/route-errors.test.ts',
            title:
              'safe-read error projection refuses an undeclared status by reporting an internal error',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/route-errors.test.ts',
            title:
              'editorial error response marks a 5xx retryable only when the dependency may recover',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ec-r3-read-errors.test.ts',
            title:
              'EC-092/EC-098 CMS-03B-13 answers a database refusal with its declared safe typed error CMS-03B-13 maps the UNAUTHENTICATED token to 401 with the fixed message and details',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ec-r3-read-errors.test.ts',
            title:
              'EC-092/EC-098 CMS-03B-13 answers a database refusal with its declared safe typed error CMS-03B-13 maps the FORBIDDEN token to 403 with the fixed message and details',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ec-r3-read-errors.test.ts',
            title:
              'EC-092/EC-098 CMS-03B-13 answers a database refusal with its declared safe typed error CMS-03B-13 maps the NOT_FOUND token to 404 with the fixed message and details',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ec-r3-read-errors.test.ts',
            title:
              'EC-092/EC-098 CMS-03B-13 answers a database refusal with its declared safe typed error CMS-03B-13 maps the INVALID_REQUEST token to 400 with the fixed message and details',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ec-r3-read-errors.test.ts',
            title:
              'EC-092/EC-098 CMS-03B-13 answers a database refusal with its declared safe typed error CMS-03B-13 maps the INTERNAL_ERROR token to 500 with the fixed message and details',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ec-r3-read-errors.test.ts',
            title:
              'EC-098 CMS-03B-13 publishes the cursor refusal as its declared 409 with a safe restart a CONFLICT token is the declared 409 CONFLICT with the refresh recovery action and no database text',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ec-r3-read-errors.test.ts',
            title:
              'EC-098 CMS-03B-13 publishes the cursor refusal as its declared 409 with a safe restart a INVALID_TRANSITION token is the declared 409 CONFLICT with the refresh recovery action and no database text',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ec-r3-read-errors.test.ts',
            title:
              'EC-092/EC-098 CMS-03B-13 answers a database refusal with its declared safe typed error CMS-03B-13 answers a database that reports itself unavailable as the same retryable 503',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ec-r3-read-errors.test.ts',
            title:
              'EC-092/EC-098 CMS-03B-13 answers a database refusal with its declared safe typed error CMS-03B-13 states the retry window of a rate limit and marks nothing else retryable',
          },
        ],
      },
      {
        text: 'with truthful retry/degraded behavior',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-pages/phase-02-slice-10-ev-ec-r1-list-restart.test.ts',
            title:
              'AC-098: a cursor 409 restarts from the first page and keeps the filters redirects to the same list without the cursor, keeping state, type and limit',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-pages/phase-02-slice-10-ev-ec-r1-list-restart.test.ts',
            title:
              'AC-098: a cursor 409 restarts from the first page and keeps the filters loads the first page on the restarted request with a polite announcement, and never forwards the marker',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-pages/phase-02-slice-10-ev-ec-r1-list-restart.test.ts',
            title:
              'AC-098: a cursor 409 restarts from the first page and keeps the filters announces nothing on an ordinary load',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-pages/phase-02-slice-10-ev-ec-r1-list-restart.test.ts',
            title:
              'AC-098: a cursor 409 restarts from the first page and keeps the filters a 409 with no cursor to drop is the closed state, retrying the same position',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-pages/phase-02-slice-10-ev-ec-r1-list-restart.test.ts',
            title:
              'AC-098: a cursor 409 restarts from the first page and keeps the filters does not loop: a restarted request that is refused again shows the closed state',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-pages/phase-02-slice-10-ev-ec-r1-list-restart.test.ts',
            title:
              'AC-098: a cursor 409 restarts from the first page and keeps the filters keeps the position for a transient failure',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-pages/load-entry-list-page.test.ts',
            title:
              'loadEntryListPage retries a transient failure at the same list position',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-pages/load-entry-list-page.test.ts',
            title: 'loadEntryListPage renders a 429 as one closed state',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-pages/load-entry-list-page.test.ts',
            title: 'loadEntryListPage renders a 503 as one closed state',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/CmsEditorialEntryList.test.tsx',
            title:
              'CmsEditorialEntryList (FE03 CmsEditorialEntryList, DEC-145) puts a restart announcement in the same polite status region as the count (FE03:574)',
          },
        ],
      },
      {
        text: 'no upstream-text relay.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/list-routes.test.ts',
            title:
              'CMS-03B-13 protected assigned-entry list route [P2-S10-AC-098] publishes a well-formed expired or foreign cursor as the declared 409 with a safe restart and no upstream text',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/route-errors.test.ts',
            title:
              'safe-read error projection replaces dependency text with the canonical message for the status',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ec-read-telemetry.test.ts',
            title:
              "EC-093 safe-read telemetry through the real route and production adapter a 'CMS-03B-13' dependency outage counts a failed outcome without any upstream text",
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ec-r3-read-errors.test.ts',
            title:
              'EC-092/EC-098 CMS-03B-13 answers a database refusal with its declared safe typed error CMS-03B-13 never relays a database message: an unrecognised token is a scrubbed 500 INTERNAL_ERROR',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ec-r3-read-errors.test.ts',
            title:
              'EC-092/EC-098 CMS-03B-13 answers a database refusal with its declared safe typed error CMS-03B-13 answers an unreachable database as the retryable 503 DEPENDENCY_UNAVAILABLE, naming no upstream text',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S10-AC-099',
    text: 'CMS-03B-13 is read-only and is consumed by an accessible server-first entry list with native links, announced result/empty/filter states, keyboard order, and no optimistic rows.',
    clauses: [
      {
        text: 'CMS-03B-13 is read-only',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_entry_list.sql',
            title: 'the bounded entry list emits no audit or outbox evidence',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/list-routes.test.ts',
            title:
              'CMS-03B-13 protected assigned-entry list route [P2-S10-AC-095] rejects undeclared query keys, bodies, and mutation headers before reads',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-safe-reads.test.ts',
            title:
              "production port-input admission for the safe reads refuses a write header, body, or non-GET method on 'CMS-03B-13'",
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-reads.apispec.ts',
            title:
              'EC reads are read-only, no-store and redacted [EC-072][EC-093][EC-099][EC-105] draft, conflict, list, preparation and history reads leave every durable fingerprint unchanged and answer no-store with an ETag',
          },
        ],
      },
      {
        text: 'is consumed by an accessible server-first entry list with native links',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/pages/app/cms-content-modeling/entries/entry-list-route.test.tsx',
            title:
              'entries/index.astro response invariants is never prerendered or cached, uses the one shared shell and bundles no script of its own',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/pages/app/cms-content-modeling/entries/entry-list-route.test.tsx',
            title:
              'CMS-03B-13 protected entry-list page, composed lists the assigned entries as native links with a signed, URL-owned continuation',
          },
          {
            tool: 'vitest',
            file: 'tests/accessibility/phase-02-slice-10-editorial-axe.test.ts',
            title:
              'Slice 10 editorial surfaces: axe entry list, empty states and a closed notice',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/CmsEditorialEntryList.test.tsx',
            title:
              'CmsEditorialEntryList (FE03 CmsEditorialEntryList, DEC-145) lists each entry as a native link to its edit page with lifecycle, revision, state and updated time as text',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/CmsEditorialEntryList.test.tsx',
            title:
              'CmsEditorialEntryList (FE03 CmsEditorialEntryList, DEC-145) offers Create entry once above a non-empty list so the create page is reachable',
          },
        ],
      },
      {
        text: 'announced result/empty/filter states',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/CmsEditorialEntryList.test.tsx',
            title:
              'CmsEditorialEntryList (FE03 CmsEditorialEntryList, DEC-145) announces the loaded count politely',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/CmsEditorialEntryList.test.tsx',
            title:
              'CmsEditorialEntryList (FE03 CmsEditorialEntryList, DEC-145) states filter-miss apart from no-records, with exactly one action: reset',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/CmsEditorialEntryList.test.tsx',
            title:
              'CmsEditorialEntryList (FE03 CmsEditorialEntryList, DEC-145) states no-records with exactly one action: create',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/pages/app/cms-content-modeling/entries/entry-list-route.test.tsx',
            title:
              'CMS-03B-13 protected entry-list page, composed shows no-records and filter-miss as different states with one action each',
          },
        ],
      },
      {
        text: 'keyboard order',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/phase-02-slice-10-ev-ec-entry-list.test.tsx',
            title:
              'EC-099 entry list keyboard order tabs through the filter controls, then the create link, then each entry in server order, then the next page',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/phase-02-slice-10-ev-ec-entry-list.test.tsx',
            title:
              'EC-099 entry list keyboard order keeps a single action after the filter controls when the list is empty',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/phase-02-slice-10-ev-ec-entry-list.test.tsx',
            title:
              'EC-099 entry list keyboard order never reorders the tab sequence with a positive tabindex and offers only native controls',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/phase-02-slice-10-ev-ec-entry-list.test.tsx',
            title:
              'EC-099 entry list keyboard order makes the heading the programmatic focus target that both the filter and the next link return to',
          },
        ],
      },
      {
        text: 'and no optimistic rows.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/phase-02-slice-10-ev-ec-entry-list.test.tsx',
            title:
              'EC-099 entry list shows no optimistic row renders exactly the rows the server page holds, in the order it holds them',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/phase-02-slice-10-ev-ec-entry-list.test.tsx',
            title:
              'EC-099 entry list shows no optimistic row is a pure function of the server page: the same page is byte-identical and a new row appears only when the page carries it',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/phase-02-slice-10-ev-ec-entry-list.test.tsx',
            title:
              'EC-099 entry list shows no optimistic row carries no pending, busy or placeholder state and no script',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/phase-02-slice-10-ev-ec-source-guards.test.ts',
            title:
              'EC-099 the server-first entry list holds no client behaviour has no state, effect, optimistic hook, request or storage',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S10-AC-100',
    text: 'CMS-03B-14 registers the literal authoring-context GET and returns a strict server-derived preparation projection for visible active types, schema artifacts, validator references, workflow policy, and activation evidence.',
    clauses: [
      {
        text: 'CMS-03B-14 registers the literal authoring-context GET',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/supplemental-routes.test.ts',
            title:
              'supplemental cms editorial route registry binds CMS-03B-14 to the authoring-context read without path params',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/supplemental-routes.test.ts',
            title:
              'supplemental platformRegistrySet rows registers the CMS-03B-14 platform row with editorial read defaults',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-10-editorial-registry-openapi.test.ts',
            title:
              'Slice 10 CMS-03B-12/13/14 supplemental read authority documents CMS-03B-14 with only the version selector and no body',
          },
        ],
      },
      {
        text: 'returns a strict server-derived preparation projection for visible active types',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/authoring-context-routes.test.ts',
            title:
              'CMS-03B-14 protected authoring-context route [P2-S10-AC-100] serves the strict creatable-type projection with a no-store ETag',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_authoring_context.sql',
            title:
              'without a query version the read returns creatable types and no selection',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_authoring_context.sql',
            title:
              'authoring context binds artifact identity and projects active fields only',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/cms-editorial-composition.apispec.ts',
            title:
              'CMS-03B-14 -> CMS-03B-10 -> CMS-03B-11 -> CMS-03B-13 through the real stack [P2-S10-AC-100] the authoring-context read lists the creatable active type with its frozen evidence and a strong no-store ETag',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ec_r1_authoring_visibility.sql',
            title:
              'EC-100 the creatable types are exactly the two active compiled types of the acting party',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ec_r1_authoring_visibility.sql',
            title:
              'EC-100 an active version that was superseded is no longer creatable',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ec_r1_authoring_visibility.sql',
            title:
              'EC-100 an active version whose compiled artifact no longer matches its definition hash is not creatable',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ec_r1_authoring_visibility.sql',
            title:
              'EC-100 an active version owned by another party is not creatable',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ec_r1_authoring_visibility.sql',
            title:
              'EC-100 the never-activated draft type is not in the creatable list',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-r1-typed-values.apispec.ts',
            title:
              'EC-100/EC-102 an existing type that was never activated is neither offered nor distinguishable from an absent one lists only active compiled types and answers the same empty 404 for the draft type as for a random id',
          },
        ],
      },
      {
        text: 'schema artifacts, validator references, workflow policy, and activation evidence.',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/authoring-context.test.ts',
            title:
              'CMS-03B-14 authoring-context type validates the exact schema artifact and workflow-policy evidence',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/authoring-context.test.ts',
            title:
              'CMS-03B-14 authoring-context type bounds validator refs to at most 128 exact validator evidence rows',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_authoring_context.sql',
            title:
              'the selected type carries create evidence and no registry-private authority',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/cms-editorial-composition.apispec.ts',
            title:
              'CMS-03B-14 -> CMS-03B-10 -> CMS-03B-11 -> CMS-03B-13 through the real stack [P2-S10-AC-061] [P2-S10-AC-066] the projection round-trips into a create that commits the entry, first revision, audit and outbox exactly once',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S10-AC-101',
    text: 'CMS-03B-14 accepts only its closed bounded query grammar, never accepts caller-supplied schema/artifact/policy/approval authority, and rejects body or mutation headers.',
    clauses: [
      {
        text: 'CMS-03B-14 accepts only its closed bounded query grammar',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/authoring-context.test.ts',
            title:
              'CMS-03B-14 authoring-context query binds an optional content type version id and nothing else',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/authoring-context.test.ts',
            title:
              'CMS-03B-14 authoring-context query requires a UUID when the version id is present',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/authoring-context-routes.test.ts',
            title:
              'CMS-03B-14 protected authoring-context route [P1-S10-API] rejects malformed query before session resolution',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_authoring_context.sql',
            title:
              'a non-UUID authoring-context selector is a structural refusal, never an entry id',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_authoring_context.sql',
            title:
              'an explicit JSON null selector is a structural refusal, not an omitted query',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-reads.apispec.ts',
            title:
              'EC CMS-03B-14 authoring context through the real stack [EC-101] rejects a closed-grammar violation before any database read',
          },
        ],
      },
      {
        text: 'never accepts caller-supplied schema/artifact/policy/approval authority',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/authoring-context.test.ts',
            title:
              'CMS-03B-14 authoring-context query refuses unknown keys and every ownership or registry-private selector',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/authoring-context-routes.test.ts',
            title:
              'CMS-03B-14 protected authoring-context route [P2-S10-AC-101] rejects undeclared query keys and any caller-supplied schema authority',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_authoring_context.sql',
            title:
              'a caller-supplied schema identity beside the query version is refused',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-reads.apispec.ts',
            title:
              'EC CMS-03B-14 authoring context through the real stack [EC-101] rejects a closed-grammar violation before any database read',
          },
        ],
      },
      {
        text: 'rejects body or mutation headers.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-safe-reads.test.ts',
            title:
              "production port-input admission for the safe reads refuses a write header, body, or non-GET method on 'CMS-03B-14'",
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ec-r1-read-boundary.test.ts',
            title:
              'EC-095 the safe reads refuse a body and mutation headers before any database call CMS-03B-14 refuses a declared request body (Content-Length) without calling the database',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ec-r1-read-boundary.test.ts',
            title:
              'EC-095 the safe reads refuse a body and mutation headers before any database call CMS-03B-14 refuses a chunked request body (Transfer-Encoding) without calling the database',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ec-r1-read-boundary.test.ts',
            title:
              'EC-095 the safe reads refuse a body and mutation headers before any database call CMS-03B-14 refuses a request media type (Content-Type) without calling the database',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ec-r1-read-boundary.test.ts',
            title:
              'EC-095 the safe reads refuse a body and mutation headers before any database call CMS-03B-14 refuses an Idempotency-Key without calling the database',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ec-r1-read-boundary.test.ts',
            title:
              'EC-095 the safe reads refuse a body and mutation headers before any database call CMS-03B-14 refuses an If-Match without calling the database',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ec-r2-authoring-boundary.test.ts',
            title:
              'EC-101 CMS-03B-14 is the declared GET read and nothing that carries a body a POST with a JSON body is not served and never reaches the database',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ec-r2-authoring-boundary.test.ts',
            title:
              'EC-101 CMS-03B-14 is the declared GET read and nothing that carries a body a PUT with a JSON body is not served and never reaches the database',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ec-r2-authoring-boundary.test.ts',
            title:
              'EC-101 CMS-03B-14 is the declared GET read and nothing that carries a body a PATCH with a JSON body is not served and never reaches the database',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ec-r2-authoring-boundary.test.ts',
            title:
              'EC-101 CMS-03B-14 is the declared GET read and nothing that carries a body a DELETE with a JSON body is not served and never reaches the database',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ec-r2-authoring-boundary.test.ts',
            title:
              'EC-101 CMS-03B-14 is the declared GET read and nothing that carries a body the same literal read is served as a plain GET, so the refusals above are the method and body alone',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S10-AC-102',
    text: 'CMS-03B-14 derives session and acting context, requires author/editor scope, conceals inaccessible types, and never grants or implies `cms.schema_registry.read`.',
    clauses: [
      {
        text: 'CMS-03B-14 derives session and acting context',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_authoring_context.sql',
            title: 'a selection without an acting context is refused',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/authoring-context-routes.test.ts',
            title:
              'CMS-03B-14 protected authoring-context route [P2-S10-AC-102] answers an anonymous caller 401 and a reviewer-only session 403 before reads',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-reads.apispec.ts',
            title:
              'EC CMS-03B-14 authoring context through the real stack [EC-102] refuses a caller holding no author or editor grant before it reveals a type',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ec-r1-read-boundary.test.ts',
            title:
              'EC-096 the database receives the verified session as actor and acting party CMS-03B-14 sends the same server-derived context',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ec-r2-authoring-boundary.test.ts',
            title:
              'EC-102 CMS-03B-14 sends the verified session as actor and acting party a different verified session changes the actor and party the database receives',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ec-r2-authoring-boundary.test.ts',
            title:
              'EC-102 CMS-03B-14 sends the verified session as actor and acting party a caller-supplied identity header or query has no effect on the context sent',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ec-r2-authoring-boundary.test.ts',
            title:
              'EC-102 CMS-03B-14 sends the verified session as actor and acting party an undeclared identity query key is refused before the session is used or the database is called',
          },
        ],
      },
      {
        text: 'requires author/editor scope',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_authoring_context.sql',
            title:
              'the authoring-context read requires the author/editor scope',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/authoring-context-routes.test.ts',
            title:
              'CMS-03B-14 protected authoring-context route [P2-S10-AC-102] answers an anonymous caller 401 and a reviewer-only session 403 before reads',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-reads.apispec.ts',
            title:
              'EC CMS-03B-14 authoring context through the real stack [EC-102] refuses a caller holding no author or editor grant before it reveals a type',
          },
        ],
      },
      {
        text: 'conceals inaccessible types',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_authoring_context.sql',
            title: 'an off-registry version is concealed, never substituted',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/authoring-context-routes.test.ts',
            title:
              'CMS-03B-14 protected authoring-context route [P2-S10-AC-102] conceals an inaccessible or absent target schema as 404',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-errors-coverage.test.ts',
            title:
              'cms editorial error mapping [P2-S10-AC-090] [P2-S10-AC-102] keeps a concealed read target an empty-detail 404 while 403 stays distinct',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-reads.apispec.ts',
            title:
              'EC CMS-03B-14 authoring context through the real stack [EC-102] conceals an off-registry version as one empty 404',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ec_r1_authoring_visibility.sql',
            title:
              'EC-102 an existing draft version is concealed exactly like an absent one',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ec_r1_authoring_visibility.sql',
            title:
              'EC-102 an existing superseded version is concealed exactly like an absent one',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ec_r1_authoring_visibility.sql',
            title:
              'EC-102 an existing active version of another party is concealed exactly like an absent one',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ec_r1_authoring_visibility.sql',
            title:
              'EC-102 an existing version with a drifted artifact is concealed exactly like an absent one',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-r1-typed-values.apispec.ts',
            title:
              'EC-100/EC-102 an existing type that was never activated is neither offered nor distinguishable from an absent one lists only active compiled types and answers the same empty 404 for the draft type as for a random id',
          },
        ],
      },
      {
        text: 'never grants or implies `cms.schema_registry.read`.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/authoring-context-routes.test.ts',
            title:
              'CMS-03B-14 protected authoring-context route [P2-S10-AC-102] never grants or implies cms.schema_registry.read',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/authoring-context-routes.test.ts',
            title:
              'CMS-03B-14 protected authoring-context route [P1-S10-API] binds selectedType to the creatable type projection and refuses registry-read authority',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_authoring_context.sql',
            title:
              'the selected type carries create evidence and no registry-private authority',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-reads.apispec.ts',
            title:
              'EC CMS-03B-14 authoring context through the real stack [EC-102] serves an author/editor the creatable types, and the same person is refused by the schema registry read',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S10-AC-103',
    text: 'CMS-03B-14 is matched before the entry UUID route, returns an ETag-bound no-store projection, and enforces declared read rate, deadline, cancellation, and response bounds.',
    clauses: [
      {
        text: 'CMS-03B-14 is matched before the entry UUID route',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/authoring-context-routes.test.ts',
            title:
              'CMS-03B-14 protected authoring-context route [P2-S10-AC-103] matches the literal authoring-context segment before the entry UUID route',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/cms-editorial-composition.apispec.ts',
            title:
              'CMS-03B-14 -> CMS-03B-10 -> CMS-03B-11 -> CMS-03B-13 through the real stack [P2-S10-AC-100] the authoring-context read lists the creatable active type with its frozen evidence and a strong no-store ETag',
          },
        ],
      },
      {
        text: 'returns an ETag-bound no-store projection',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/authoring-context-routes.test.ts',
            title:
              'CMS-03B-14 protected authoring-context route [P2-S10-AC-100] serves the strict creatable-type projection with a no-store ETag',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/authoring-context-routes.test.ts',
            title:
              'CMS-03B-14 protected authoring-context route [P1-S10-API] hashes the complete authoring representation in the strong ETag',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-ports-coverage.test.ts',
            title:
              'cms editorial production ports [P2-S10-AC-091] [P2-S10-AC-097] [P2-S10-AC-103] declares the S10 reads as strong no-store ETag reads over the shared read class',
          },
        ],
      },
      {
        text: 'enforces declared read rate',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/authoring-context-routes.test.ts',
            title:
              'CMS-03B-14 protected authoring-context route [P2-S10-AC-103] enforces the declared read rate with the read limit',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-rate-scope.test.ts',
            title:
              'route registry rate limits (BE03b:152-165) CMS-03B-14 asks the limiter for 300/min per actor and 600/min per acting party, never mixed',
          },
        ],
      },
      {
        text: 'deadline',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/authoring-context-routes.test.ts',
            title:
              'CMS-03B-14 protected authoring-context route [P2-S10-AC-104] maps a dependency timeout to 504 and an invalid projection to 502',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/safe-read-routes-admission.test.ts',
            title:
              "'CMS-03B-14 authoring context' admission answers 504 without calling the session resolver once the deadline is spent",
          },
        ],
      },
      {
        text: 'cancellation',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-cancellation.test.ts',
            title:
              'client cancellation reaches the RPC [P2-S10-AC-007] [P2-S10-AC-091] CMS-03B-14 (authoring context) aborts the in-flight PostgREST call when the client disconnects',
          },
        ],
      },
      {
        text: 'response bounds.',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/authoring-context.test.ts',
            title:
              'CMS-03B-14 authoring-context resource bounds creatable types to at most 32',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/authoring-context.test.ts',
            title:
              'CMS-03B-14 authoring-context resource bounds projected fields to at most 128',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ec_r2_authoring_bounds.sql',
            title: 'EC-103 exactly 32 creatable types are served',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ec_r2_authoring_bounds.sql',
            title:
              'EC-103 all 32 creatable types are in the projection, none dropped',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ec_r2_authoring_bounds.sql',
            title:
              'EC-103 33 creatable types are refused as INTERNAL_ERROR with no detail',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ec_r2_authoring_bounds.sql',
            title:
              'EC-103 the overflow refusal carries no partial projection: the list is never truncated to 32',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ec_r2_authoring_bounds.sql',
            title: 'EC-103 exactly 128 projected fields are served',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ec_r2_authoring_bounds.sql',
            title: 'EC-103 all 128 fields are in the projection, none dropped',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ec_r2_authoring_bounds.sql',
            title:
              'EC-103 129 projected fields are refused as INTERNAL_ERROR with no detail',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_ec_r2_authoring_bounds.sql',
            title:
              'EC-103 the field overflow refusal carries no partial projection: the fields are never truncated to 128',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S10-AC-104',
    text: 'CMS-03B-14 maps validation, auth, rate, dependency, and internal failures to declared safe typed errors and preserves the user form without fabricating preparation evidence.',
    clauses: [
      {
        text: 'CMS-03B-14 maps validation',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/authoring-context-routes.test.ts',
            title:
              'CMS-03B-14 protected authoring-context route [P1-S10-API] rejects malformed query before session resolution',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/authoring-context-routes.test.ts',
            title:
              'CMS-03B-14 protected authoring-context route [P2-S10-AC-101] rejects undeclared query keys and any caller-supplied schema authority',
          },
        ],
      },
      {
        text: 'auth',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/authoring-context-routes.test.ts',
            title:
              'CMS-03B-14 protected authoring-context route [P2-S10-AC-102] answers an anonymous caller 401 and a reviewer-only session 403 before reads',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/route-errors.test.ts',
            title:
              'safe-read error projection reauthenticates on a 401 and states the dependency class on 502/503/504',
          },
        ],
      },
      {
        text: 'rate',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/authoring-context-routes.test.ts',
            title:
              'CMS-03B-14 protected authoring-context route [P2-S10-AC-103] enforces the declared read rate with the read limit',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/route-errors.test.ts',
            title:
              'safe-read error projection projects a bounded 429 envelope from the limit, reset and retry hints',
          },
        ],
      },
      {
        text: 'dependency',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/authoring-context-routes.test.ts',
            title:
              'CMS-03B-14 protected authoring-context route [P2-S10-AC-104] maps a dependency timeout to 504 and an invalid projection to 502',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/authoring-context-routes.test.ts',
            title:
              'CMS-03B-14 protected authoring-context route [P2-S10-AC-103] fails closed when the authoring-context port is not wired',
          },
        ],
      },
      {
        text: 'internal failures to declared safe typed errors',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/safe-read-routes-admission.test.ts',
            title:
              'CMS-03B-14 projection cross-checks answers a typed 500 when the response digest cannot be computed',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/route-errors.test.ts',
            title:
              'safe-read error projection refuses an undeclared status by reporting an internal error',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ec-r2-authoring-boundary.test.ts',
            title:
              'EC-104 CMS-03B-14 answers failures with the declared safe typed envelope an internal database failure is a 500 INTERNAL_ERROR with the fixed message and no database words',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ec-r2-authoring-boundary.test.ts',
            title:
              'EC-104 CMS-03B-14 answers failures with the declared safe typed envelope a database that raises an unrecognised failure is a retryable 503 DEPENDENCY_UNAVAILABLE that names no upstream text',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ec-r2-authoring-boundary.test.ts',
            title:
              'EC-104 CMS-03B-14 answers failures with the declared safe typed envelope an unreachable database is a retryable 503 DEPENDENCY_UNAVAILABLE that names no upstream text',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ec-r2-authoring-boundary.test.ts',
            title:
              'EC-104 CMS-03B-14 answers failures with the declared safe typed envelope a 200 that is not the strict projection is refused rather than fabricated into preparation evidence',
          },
        ],
      },
      {
        text: 'preserves the user form without fabricating preparation evidence.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/CmsEditorialEntryCreateIsland.test.tsx',
            title:
              'CmsEditorialEntryCreateIsland: failures keep the work maps a typed server refusal to its field, keeps values and never shows the server message',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-pages/load-entry-create-page.test.ts',
            title:
              'loadEntryCreatePage refuses a 200 that is not the strict contract instead of rendering from it',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/authoring-context-routes.test.ts',
            title:
              'CMS-03B-14 protected authoring-context route [P2-S10-AC-104] refuses a dependency projection that omits required preparation evidence',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-entry-create-submit.test.ts',
            title:
              'submitCmsEditorialEntryCreate refuses tampered prefill evidence before any network call',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S10-AC-105',
    text: 'CMS-03B-14 is read-only and the create/editor surfaces consume its projection to render accessible native controls, revalidate on submit, and preserve server authority.',
    clauses: [
      {
        text: 'CMS-03B-14 is read-only',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_authoring_context.sql',
            title: 'the preparation read emits no audit or outbox evidence',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-safe-reads.test.ts',
            title:
              "production port-input admission for the safe reads refuses a write header, body, or non-GET method on 'CMS-03B-14'",
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-reads.apispec.ts',
            title:
              'EC reads are read-only, no-store and redacted [EC-072][EC-093][EC-099][EC-105] draft, conflict, list, preparation and history reads leave every durable fingerprint unchanged and answer no-store with an ETag',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ec-r1-read-boundary.test.ts',
            title:
              'EC-095 the safe reads refuse a body and mutation headers before any database call CMS-03B-14 refuses a declared request body (Content-Length) without calling the database',
          },
          {
            tool: 'vitest',
            file: 'tests/integration/phase-02-slice-10-ev-ec-r1-read-boundary.test.ts',
            title:
              'EC-095 the safe reads refuse a body and mutation headers before any database call CMS-03B-14 refuses an Idempotency-Key without calling the database',
          },
        ],
      },
      {
        text: 'the create/editor surfaces consume its projection to render accessible native controls',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-pages/load-entry-create-page.test.ts',
            title:
              'loadEntryCreatePage carries the selected type and its author-safe fields into the view',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/CmsEditorialEntryCreateIsland.test.tsx',
            title:
              'CmsEditorialEntryCreateIsland: rendering renders a native control per kind and a typed unavailable state where nothing can be authored',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-pages/load-entry-edit-page.test.ts',
            title:
              'loadEntryEditPage builds the editor from the verified draft and the author-safe definitions of its schema version',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/CmsEditorialEntryEditorIsland.test.tsx',
            title:
              'CmsEditorialEntryEditorIsland: the edit surface renders the stored values in native labelled controls and the entry facts as text',
          },
          {
            tool: 'vitest',
            file: 'tests/accessibility/phase-02-slice-10-ev-ec-r2-create-controls.test.ts',
            title:
              'EC-105 the create surface renders the projected fields as accessible native controls uses no ARIA-only widget, no contenteditable and no positive tabindex',
          },
          {
            tool: 'vitest',
            file: 'tests/accessibility/phase-02-slice-10-ev-ec-r2-create-controls.test.ts',
            title:
              'EC-105 the create surface renders the projected fields as accessible native controls drops exactly the group of a field the projection no longer carries',
          },
          {
            tool: 'vitest',
            file: 'tests/accessibility/phase-02-slice-10-ev-ec-r2-create-controls.test.ts',
            title:
              'EC-105 the create surface renders the projected fields as accessible native controls has no axe finding on the populated form',
          },
          {
            tool: 'vitest',
            file: 'tests/accessibility/phase-02-slice-10-ev-ec-r2-create-controls.test.ts',
            title:
              'EC-105 the create surface renders the projected fields as accessible native controls renders one named group per projected field, in the projection order, named by the projected label',
          },
          {
            tool: 'vitest',
            file: 'tests/accessibility/phase-02-slice-10-ev-ec-r2-create-controls.test.ts',
            title:
              'EC-105 the create surface renders the projected fields as accessible native controls gives every authorable kind a native control and every kind without a source a typed unavailable state with no control',
          },
        ],
      },
      {
        text: 'revalidate on submit',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/CmsEditorialEntryCreateIsland.test.tsx',
            title:
              'CmsEditorialEntryCreateIsland: local validation refuses an invalid form without a request, links the summary to the field and focuses it',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-entry-editor-controller.test.ts',
            title:
              'editor controller: local validation sends nothing while a changed field is invalid, then saves once it is fixed',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-entry-create-submit.test.ts',
            title:
              'submitCmsEditorialEntryCreate refuses tampered prefill evidence before any network call',
          },
        ],
      },
      {
        text: 'preserve server authority.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-entry-create-transport.test.ts',
            title:
              'executeCmsEditorialEntryCreate request shape refuses a caller-supplied authority field before any network call',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-entry-create-submit.test.ts',
            title:
              'submitCmsEditorialEntryCreate sends the real JSON command with CSRF and Idempotency-Key, no If-Match, and /fields/ pointers',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-r2-real-stack.apispec.ts',
            title:
              "EC-105 a create preserves server authority: the projection is the server's, never the caller's the unmodified projection commits (control)",
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-r2-real-stack.apispec.ts',
            title:
              "EC-105 a create preserves server authority: the projection is the server's, never the caller's a caller-supplied createdBy member is refused and changes nothing",
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-r2-real-stack.apispec.ts',
            title:
              "EC-105 a create preserves server authority: the projection is the server's, never the caller's a caller-supplied ownerId member is refused and changes nothing",
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-r2-real-stack.apispec.ts',
            title:
              "EC-105 a create preserves server authority: the projection is the server's, never the caller's a caller-supplied actingPartyId member is refused and changes nothing",
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-r2-real-stack.apispec.ts',
            title:
              "EC-105 a create preserves server authority: the projection is the server's, never the caller's a caller-supplied entryId member is refused and changes nothing",
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-r2-real-stack.apispec.ts',
            title:
              "EC-105 a create preserves server authority: the projection is the server's, never the caller's a caller-supplied state member is refused and changes nothing",
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-r2-real-stack.apispec.ts',
            title:
              "EC-105 a create preserves server authority: the projection is the server's, never the caller's a schemaArtifact that is not the one the server served is refused and changes nothing",
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-r2-real-stack.apispec.ts',
            title:
              "EC-105 a create preserves server authority: the projection is the server's, never the caller's a workflowPolicy that is not the one the server served is refused and changes nothing",
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-10-ev-ec-r2-real-stack.apispec.ts',
            title:
              "EC-105 a create preserves server authority: the projection is the server's, never the caller's a activationEvidence that is not the one the server served is refused and changes nothing",
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
];
