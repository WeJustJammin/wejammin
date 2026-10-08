/** Valid requests for the `cms_*` functions whose caller is resolved by `cfg_actor` (cms_actor). */
import {
  FUTURE,
  HEX64,
  IDEMPOTENCY_KEY,
  id,
  type FixtureTable,
} from './claim-gate-fixtures-types';

const PERSON_NOT_FOUND = '400:PERSON_NOT_FOUND';

export const CMS_ACTOR_FIXTURES: FixtureTable = {
  cms_activate_schema: {
    request: {
      contentTypeId: id(1),
      versionId: id(2),
      expectedVersion: '1',
      dryRunId: id(3),
      approvalIds: [id(4)],
      migrationPlanId: null,
    },
    real: PERSON_NOT_FOUND,
  },
  cms_add_field_definition: {
    request: {
      contentTypeId: id(1),
      versionId: id(2),
      field: { key: 'subtitle', kind: 'short_text' },
      migrationPlanId: null,
      expectedVersion: '1',
    },
    real: PERSON_NOT_FOUND,
  },
  cms_assign_schema_review: {
    request: {
      reviewId: id(5),
      action: 'assign',
      expectedVersion: '1',
      reviewerPersonId: id(6),
      expiresAt: FUTURE,
    },
    real: '400:INVALID_REQUEST',
  },
  cms_author_locale_variant: {
    request: {
      entryId: id(7),
      locale: 'fr',
      sourceRevisionId: id(8),
      fields: {},
      fallbackChain: [],
      noFallbackFieldIds: [],
      sourceHash: HEX64,
      expectedVersion: '1',
      ifMatch: '1',
      idempotencyKey: IDEMPOTENCY_KEY,
    },
    real: PERSON_NOT_FOUND,
  },
  cms_get_entry_authoring_context: {
    // contentTypeVersionId is optional; a present JSON null is a structural
    // INVALID_REQUEST (BE03b CMS-03B-14 row), so the valid probe omits it.
    request: {},
    real: PERSON_NOT_FOUND,
    svcReal: '400:FORBIDDEN',
  },
  cms_bind_relation: {
    request: {
      contentTypeId: id(1),
      versionId: id(2),
      fieldId: id(9),
      targetKind: 'content_type',
      targetType: 'article',
      projectionKey: 'summary',
      cardinality: 'one',
      min: 0,
      max: 1,
      ordered: false,
      onUnavailable: 'omit',
      expectedVersion: '1',
    },
    real: PERSON_NOT_FOUND,
  },
  cms_create_entry: {
    request: {
      contentTypeId: id(1),
      contentTypeVersionId: id(2),
      locale: 'en',
      changedPaths: [],
      values: {},
      schemaArtifact: {},
      validatorRefs: [],
      workflowPolicy: {},
      activationEvidence: {},
    },
    real: '400:FORBIDDEN',
  },
  cms_create_revision: {
    request: {
      entryId: id(7),
      baseRevision: id(8),
      changedPaths: [],
      values: {},
      locale: 'en',
      expectedVersion: '1',
      ifMatch: '1',
      idempotencyKey: IDEMPOTENCY_KEY,
    },
    real: PERSON_NOT_FOUND,
  },
  cms_create_schema_successor: {
    request: { contentTypeId: id(1), versionId: id(2), expectedVersion: '1' },
    real: PERSON_NOT_FOUND,
  },
  cms_create_type_draft: {
    request: {
      typeKey: 'gate_probe',
      label: 'Gate probe',
      ownerCapability: 'cms.schema_designer',
      sourceLocale: 'en',
      defaultLocale: 'en',
      supportedLocales: ['en'],
      fallbackChains: {},
      workflowKey: 'editorial',
      workflowVersion: '1',
      defaultTemplateVersionId: null,
      fields: [],
      relations: [],
      templateBindings: [],
      capabilityBindings: [],
    },
    real: PERSON_NOT_FOUND,
  },
  cms_decide_schema_review: {
    request: { reviewId: id(5), expectedVersion: '1', decision: 'approve' },
    real: '400:INVALID_REQUEST',
  },
  cms_define_template: {
    request: {
      templateKey: 'gate-probe',
      compatibleTypeIds: [id(1)],
      slots: [],
      reservedRegions: [],
      bindings: [],
      locale: 'en',
      audience: 'public',
      expectedVersion: '1',
      idempotencyKey: IDEMPOTENCY_KEY,
    },
    real: '400:FORBIDDEN',
  },
  cms_get_content_type_version: {
    request: { contentTypeId: id(1), versionId: id(2) },
    real: PERSON_NOT_FOUND,
  },
  cms_get_entry_draft: {
    request: { entryId: id(7) },
    real: '400:NOT_FOUND',
  },
  cms_get_conflict_detail: {
    request: { entryId: id(7), conflictId: id(11) },
    real: '400:NOT_FOUND',
  },
  cms_get_schema_review: {
    request: { reviewId: id(5) },
    real: PERSON_NOT_FOUND,
  },
  cms_grant_capability: {
    request: {
      subjectPersonId: id(6),
      capability: 'cms.author',
      validThrough: FUTURE,
    },
    real: '400:INVALID_REQUEST',
  },
  cms_list_capability_grants: { request: {}, real: PERSON_NOT_FOUND },
  cms_list_content_types: { request: {}, real: PERSON_NOT_FOUND },
  cms_list_entries: {
    request: {},
    real: PERSON_NOT_FOUND,
    // The list conceals every row the caller has no proven grant over, so a
    // real service-role caller with no person gets an empty page, not a refusal.
    svcReal: '200:',
  },
  cms_list_revisions: {
    request: { entryId: id(7) },
    real: '400:NOT_FOUND',
  },
  cms_renew_capability_grant: {
    request: { grantId: id(10), expectedVersion: '1', validThrough: FUTURE },
    real: '400:INVALID_REQUEST',
  },
  cms_resolve_conflict: {
    request: {
      entryId: id(7),
      conflictId: id(11),
      baseRevision: id(8),
      choices: [],
      expectedVersion: '1',
      ifMatch: '1',
      idempotencyKey: IDEMPOTENCY_KEY,
    },
    real: PERSON_NOT_FOUND,
  },
  cms_resolve_template_compatibility: {
    request: {
      templateVersionId: id(12),
      contentTypeId: id(1),
      contentTypeVersionId: id(2),
    },
    real: '403:permission denied for function cms_resolve_template_compatibility',
  },
  cms_revoke_capability_grant: {
    request: { grantId: id(10), expectedVersion: '1' },
    real: '400:INVALID_REQUEST',
  },
  cms_restore_revision: {
    request: {
      entryId: id(7),
      revisionId: id(8),
      migrationChainId: id(20),
      expectedVersion: '1',
      idempotencyKey: IDEMPOTENCY_KEY,
    },
    real: PERSON_NOT_FOUND,
  },
  cms_start_schema_dry_run: {
    request: {
      contentTypeId: id(1),
      versionId: id(2),
      expectedVersion: '1',
      transformKey: 'identity',
      transformVersion: '1',
    },
    real: PERSON_NOT_FOUND,
  },
  cms_submit_schema_review: {
    request: {
      contentTypeId: id(1),
      versionId: id(2),
      expectedVersion: '1',
      dryRunId: id(3),
    },
    real: PERSON_NOT_FOUND,
  },
  cms_template_context: { request: {}, real: '400:FORBIDDEN' },
  cms_template_latest: {
    request: { templateKey: 'gate-probe' },
    real: '400:FORBIDDEN',
  },
};
