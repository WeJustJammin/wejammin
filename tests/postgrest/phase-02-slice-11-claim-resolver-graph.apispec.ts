/** Genuine public graph edit; no compile, replacement attempt, or cache writes. */
import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { expectSafeEqual } from './support/phase-02-slice-11-assert';
import {
  candidateVersion,
  claimAttempt,
  originalEvent,
  prepareClaimAttempt,
  resolveClaim,
  selectJson,
  selectText,
  storedVersion,
  type ClaimAttempt,
} from './support/phase-02-slice-11-claimed-dry-run-fixture';
import {
  attemptState,
  refusal,
  storedProjection,
} from './support/phase-02-slice-11-claimed-dry-run-oracles';

// Reconstruct the complete persisted definition directly: the scoped getter's
// forced-RLS RPC gate is absent here. Pure hashes never compile or change caches.
const graphState = (attempt: ClaimAttempt) =>
  selectJson(`select jsonb_build_object(
    'candidateVersion', c.version::text, 'candidateState', c.state,
    'definitionHash', c.definition_hash, 'artifactHash', a.artifact_hash,
    'currentGraphHash', platform_private.cms_jcs_sha256(
      definition.request),
    'currentArtifactHash', platform_private.cms_definition_artifact_hash(
      definition.request, c.version_no),
    'unchangedRows', jsonb_build_object(
      'candidate', to_jsonb(c) - 'version' - 'updated_at',
      'artifact', to_jsonb(a), 'plan', to_jsonb(p),
      'report', to_jsonb(r), 'job', to_jsonb(j), 'event', to_jsonb(e)))::text
    from platform_private.cms_content_type_versions c
    join platform_private.cms_content_types t on t.id = c.content_type_id
    join platform_private.cms_schema_artifacts a on a.id = c.schema_artifact_id
    join platform_private.cms_schema_dry_run_reports r on r.id = c.dry_run_id
    join platform_private.cms_schema_migration_plans p on p.id = r.plan_id
    join platform_private.jobs j on j.id = r.job_id
    join platform_private.outbox_events e on e.id = j.originating_event_id
    cross join lateral (
      select pg_catalog.jsonb_build_object(
        'typeKey', t.type_key,
        'label', c.labels->>'label',
        'ownerCapability', t.owner_capability,
        'sourceLocale', c.source_locale,
        'defaultLocale', c.default_locale,
        'supportedLocales', c.supported_locales,
        'fallbackChains', c.fallback_chains,
        'workflowKey', c.workflow_key,
        'workflowVersion', c.workflow_version::text,
        'defaultTemplateVersionId', coalesce(
          pg_catalog.to_jsonb(c.default_template_version_id), 'null'::jsonb),
        'fields', (
          select coalesce(pg_catalog.jsonb_agg(entry.value order by
            entry.value->>'stableFieldId', entry.value->>'key'), '[]'::jsonb)
          from (
            select pg_catalog.jsonb_build_object(
              'stableFieldId', field.stable_field_id,
              'key', field.field_key,
              'kind', field.kind,
              'constraints', field.constraints,
              'required', field.required,
              'validatorKey', field.validator_key,
              'validatorVersion', field.validator_version::text,
              'defaultMode', field.default_mode,
              'localizationMode', field.localization_mode,
              'editorConfig', field.editor_config,
              'lifecycle', field.state
            ) || case when field.default_value is not null
              then pg_catalog.jsonb_build_object('defaultValue', field.default_value)
              else '{}'::jsonb end as value
            from platform_private.cms_field_definition_versions field
            where field.content_type_version_id = c.id
          ) entry
        ),
        'relations', (
          select coalesce(pg_catalog.jsonb_agg(entry.value order by
            entry.value->>'fieldId', entry.value->>'projectionKey'), '[]'::jsonb)
          from (
            select pg_catalog.jsonb_build_object(
              'fieldId', relation.field_definition_id,
              'targetKind', relation.target_kind,
              'targetType', relation.target_type,
              'projectionKey', relation.projection_key,
              'cardinality', relation.cardinality,
              'min', relation.min_count,
              'max', relation.max_count,
              'ordered', relation.ordered,
              'onUnavailable', relation.on_unavailable
            ) as value
            from platform_private.cms_relation_definitions relation
            join platform_private.cms_field_definition_versions field
              on field.id = relation.field_definition_id
            where field.content_type_version_id = c.id
          ) entry
        ),
        'templateBindings', (
          select coalesce(pg_catalog.jsonb_agg(entry.value order by
            entry.value->>'templateVersionId'), '[]'::jsonb)
          from (
            select pg_catalog.jsonb_build_object(
              'templateVersionId', binding.template_version_id) as value
            from platform_private.cms_content_type_template_bindings binding
            where binding.content_type_version_id = c.id
          ) entry
        ),
        'capabilityBindings', (
          select coalesce(pg_catalog.jsonb_agg(entry.value order by
            entry.value->>'capabilityKey', entry.value->>'capabilityVersion'), '[]'::jsonb)
          from (
            select pg_catalog.jsonb_build_object(
              'capabilityKey', binding.capability_key,
              'capabilityVersion', binding.capability_version::text) as value
            from platform_private.cms_content_type_capability_bindings binding
            where binding.content_type_version_id = c.id
          ) entry
        )
      ) as request
    ) definition
    where c.id = '${attempt.versionId}' and r.id = '${attempt.report.id}'`);

const appendOptionalField = async (attempt: ClaimAttempt) => {
  const version = await candidateVersion(attempt.designer, attempt.path);
  const key = `graph_${randomUUID().replaceAll('-', '')}`;
  const response = await attempt.designer.app.send(
    'POST',
    `${attempt.path}/fields`,
    {
      ifMatch: version,
      idempotencyKey: randomUUID(),
      body: {
        key,
        kind: 'short_text',
        constraints: {},
        required: false,
        validatorKey: null,
        validatorVersion: null,
        defaultMode: 'none',
        localizationMode: 'none',
        editorConfig: { label: key, order: 1 },
        lifecycle: 'active',
        migrationPlanId: null,
      },
    },
  );
  expect(response.status, 'public optional graph field POST status').toBe(201);
  expect(
    selectText(`select count(*) from platform_private.cms_field_definition_versions
      where content_type_version_id = '${attempt.versionId}'
        and field_key = '${key}' and kind = 'short_text'
        and required = false and state = 'active'
        and default_mode = 'none' and localization_mode = 'none'
        and validator_key is null and validator_version is null`) === '1',
    'public optional field exists in the stored graph',
  ).toBe(true);
  return version;
};

describe('S11 claimed resolver precompile definition graph', () => {
  it('refuses a public field graph edit with unchanged cached fingerprints and the same live attempt', async () => {
    const attempt = await prepareClaimAttempt();
    const request = await claimAttempt(attempt);
    const projection = storedProjection(attempt);
    const state = attemptState(attempt);
    const event = originalEvent(attempt.report.jobId);
    const before = graphState(attempt);
    expectSafeEqual(event, request.requestedEvent, 'original event baseline');
    expectSafeEqual(
      [before.candidateState, state.superseded, state.reportState],
      ['draft', false, 'queued'],
      'unsealed current draft attempt baseline',
    );
    expectSafeEqual(
      state.finalEvidence,
      Array(11).fill(null),
      'graph probe has no sealed report evidence',
    );
    expect(
      typeof before.currentGraphHash === 'string' &&
        /^[a-f0-9]{64}$/u.test(before.currentGraphHash) &&
        typeof before.currentArtifactHash === 'string' &&
        /^[a-f0-9]{64}$/u.test(before.currentArtifactHash),
      'baseline graph recomputation returns SHA-256 fingerprints',
    ).toBe(true);
    expectSafeEqual(
      [before.currentArtifactHash, before.definitionHash],
      [before.artifactHash, before.artifactHash],
      'baseline current graph and both cached fingerprints agree',
    );

    const editedVersion = await appendOptionalField(attempt);
    const after = graphState(attempt);
    expectSafeEqual(
      editedVersion,
      storedVersion(before, 'candidateVersion'),
      'field producer uses the actual candidate CAS version',
    );
    expect(
      BigInt(storedVersion(after, 'candidateVersion')) > BigInt(editedVersion),
      'public field edit advances the candidate version',
    ).toBe(true);
    expect(
      typeof after.currentGraphHash === 'string' &&
        /^[a-f0-9]{64}$/u.test(after.currentGraphHash) &&
        after.currentGraphHash !== before.currentGraphHash &&
        typeof after.currentArtifactHash === 'string' &&
        /^[a-f0-9]{64}$/u.test(after.currentArtifactHash) &&
        after.currentArtifactHash !== before.currentArtifactHash &&
        after.currentArtifactHash !== after.artifactHash,
      'stored graph changed and its recomputed artifact differs from the cache',
    ).toBe(true);
    expectSafeEqual(
      [after.definitionHash, after.artifactHash],
      [before.definitionHash, before.artifactHash],
      'field edit preserves both coherent cached fingerprints',
    );
    expectSafeEqual(
      after.unchangedRows,
      before.unchangedRows,
      'artifact plan report job event and non-CAS candidate columns unchanged',
    );
    expectSafeEqual(
      storedProjection(attempt),
      projection,
      'same complete cached resolver projection after graph-only edit',
    );
    expectSafeEqual(
      attemptState(attempt),
      state,
      'same unsuperseded unsealed attempt and original BE00 claim',
    );
    expectSafeEqual(
      originalEvent(attempt.report.jobId),
      event,
      'all original event fields remain unchanged',
    );
    expect(
      selectText(`select state = 'running'
        and version::text = '${request.claimedJob.version}'
        and lease_token = '${request.claimedJob.leaseToken}'::uuid
        and lease_until > clock_timestamp()
        from platform_private.jobs where id = '${request.claimedJob.jobId}'`) ===
        't',
      'same actual job version and lease token remain live before resolution',
    ).toBe(true);

    // resolveClaim brackets the real RPC with both the old fourteen-table and
    // new thirteen-table full-row observers, including this field graph.
    refusal(await resolveClaim(request), 'CONFLICT');
  }, 120_000);
});
