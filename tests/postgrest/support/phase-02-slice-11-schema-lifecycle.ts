/** Genuine local CMS03A producers. Commands and migration RPCs use production
 * transport; SQL here reads evidence only. No raw activation rows. */
import { randomUUID } from 'node:crypto';

import { ContentSchemaRegistryDetailSchema } from '@wejammin/contracts';
import { expect } from 'vitest';

import { createProductionSchemaMigrationWorker } from '../../../apps/worker/src/production-worker-runtime-cms';
import { type CmsApp, draftTypeBody } from './cms-app';
import type { EditorialWorld } from './cms-editorial-world';
import { createS11MigrationDiagnostics } from './phase-02-slice-11-migration-diagnostics';
import { type CmsOwner, psql } from './stack';
import {
  createS11SchemaReviewer,
  createS11Session,
  s11Environment,
  s11String,
  type S11BoundSession,
} from './phase-02-slice-11-session';

export type S11SchemaCandidate = Readonly<{
  owner: CmsOwner;
  designer: S11BoundSession;
  reviewer: S11BoundSession;
  contentTypeId: string;
  contentTypeVersionId: string;
  titleFieldId: string;
  dryRunId: string;
  migrationPlanId: string;
  reviewId: string;
  assignmentId: string;
  decisionId: string;
  workerCalls: readonly string[];
}>;

const versionPath = (typeId: string, versionId: string): string =>
  `/api/v1/cms/content-types/${typeId}/versions/${versionId}`;

const read = async (
  app: CmsApp,
  path: string,
): Promise<Record<string, unknown>> => {
  const result = await app.send('GET', path);
  expect(result.status, 'lifecycle read').toBe(200);
  return result.body;
};

const post = async (
  app: CmsApp,
  path: string,
  body: Record<string, unknown>,
  status: number,
) => {
  const result = await app.send('POST', path, {
    body,
    ...(typeof body.expectedVersion === 'string'
      ? { ifMatch: body.expectedVersion }
      : {}),
  });
  expect(result.status, `lifecycle command ${path.split('/').at(-1)}`).toBe(
    status,
  );
  return result.body;
};

/** Only grantable editorial capabilities, issued by the receipt owner command. */
const grantAuthoring = async (owner: CmsOwner, app: CmsApp): Promise<void> => {
  for (const capability of ['cms.author', 'cms.editor']) {
    const current = psql(`select platform_private.cms_person_holds_capability(
      '${owner.organizationId}', '${owner.personId}', '${capability}')`);
    if (current === 't') continue;
    await post(
      app,
      '/api/v1/cms/capability-grants',
      {
        subjectPersonId: owner.personId,
        capability,
        validThrough: psql('select (current_date + 30)::text'),
        reason: 'Local Slice 11 authoring fixture',
      },
      201,
    );
  }
};

/** Real worker reads/scans source rows and submits its own bounded row evidence. */
const sealDryRun = async (schemaVersionId: string, migrationPlanId: string) => {
  const diagnostics = createS11MigrationDiagnostics();
  const calls: string[] = [];
  const failures: Readonly<{ rpc: string; status: number }>[] = [];
  const transport: typeof fetch = async (input, init) => {
    const response = await fetch(input, init);
    const url = String(input instanceof Request ? input.url : input);
    const rpc = /\/rpc\/([a-z0-9_]+)$/u.exec(url)?.[1];
    if (rpc !== undefined) calls.push(rpc);
    if (rpc !== undefined && !response.ok)
      failures.push({ rpc, status: response.status });
    await diagnostics.observe(rpc, response);
    return response;
  };
  const worker = createProductionSchemaMigrationWorker(
    s11Environment(),
    transport,
  );
  const result = await worker.process({
    schemaVersionId,
    migrationPlanId,
    expectedVersion:
      psql(`select version::text from platform_private.cms_schema_migration_plans
      where id = '${migrationPlanId}'`),
    correlationId: randomUUID(),
    causationId: null,
  });
  const diagnostic = diagnostics.describe(result);
  expect(calls, diagnostic).toContain(
    'cms_process_schema_migration_dry_run_batch',
  );
  expect(calls, diagnostic).toContain('cms_finalize_schema_migration_dry_run');
  expect(
    failures,
    'production migration transport must complete without refused RPCs',
  ).toEqual([]);
  expect(
    result.activationSwitched,
    'dry-run cannot activate before review',
  ).toBe(false);
  expect(
    psql(`select state from platform_private.cms_content_type_versions
    where id = '${schemaVersionId}'`),
  ).toBe('draft');
  expect(
    psql(`select result from platform_private.cms_schema_dry_run_reports
    where target_version_id = '${schemaVersionId}'`),
  ).toBe('pass');
  return calls;
};

/** Fresh type each call; an optional source uses the public successor command. */
export const prepareS11SchemaCandidate = async (
  owner: CmsOwner,
  source?: Pick<EditorialWorld, 'contentTypeId' | 'contentTypeVersionId'>,
): Promise<S11SchemaCandidate> => {
  const designer = await createS11Session({
    ...owner,
    actingPartyId: owner.organizationId,
  });
  const reviewer = await createS11Session(await createS11SchemaReviewer());
  await grantAuthoring(owner, designer.app);
  let draft: Record<string, unknown>;
  if (source === undefined) {
    draft = await post(
      designer.app,
      '/api/v1/cms/content-types',
      draftTypeBody(`s11_${randomUUID().replaceAll('-', '')}`),
      201,
    );
  } else {
    const path = versionPath(source.contentTypeId, source.contentTypeVersionId);
    const previous = ContentSchemaRegistryDetailSchema.parse(
      await read(designer.app, path),
    ).resource;
    draft = await post(
      designer.app,
      `${path}/successors`,
      {
        expectedVersion: s11String(previous, 'version'),
        supportedLocales: null,
        fallbackChains: null,
        defaultTemplateVersionId: null,
        templateBindings: null,
      },
      201,
    );
  }
  const contentTypeId = s11String(draft, 'contentTypeId');
  const contentTypeVersionId = s11String(draft, 'id');
  const path = versionPath(contentTypeId, contentTypeVersionId);
  const dryRun = await post(
    designer.app,
    `${path}/dry-runs`,
    {
      expectedVersion: s11String(draft, 'version'),
      transformKey: null,
      transformVersion: null,
    },
    202,
  );
  const dryRunId = s11String(dryRun, 'id');
  const migrationPlanId = s11String(dryRun, 'migrationPlanId');
  const workerCalls = await sealDryRun(contentTypeVersionId, migrationPlanId);
  const afterDryRun = ContentSchemaRegistryDetailSchema.parse(
    await read(designer.app, path),
  ).resource;
  const review = await post(
    designer.app,
    `${path}/reviews`,
    {
      expectedVersion: s11String(afterDryRun, 'version'),
      dryRunId,
    },
    201,
  );
  const reviewId = s11String(review, 'id');
  const reviewPath = `/api/v1/cms/schema-reviews/${reviewId}`;
  const assignment = await post(
    designer.app,
    `${reviewPath}/assignments`,
    {
      action: 'create',
      expectedVersion: s11String(review, 'version'),
      reviewerPersonId: reviewer.actor.personId,
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      reason: 'Local independent schema review',
    },
    201,
  );
  const assignedReview = await read(reviewer.app, reviewPath);
  const decision = await post(
    reviewer.app,
    `${reviewPath}/decisions`,
    {
      expectedVersion: s11String(assignedReview, 'version'),
      decision: 'approve',
    },
    201,
  );
  const titleFieldId =
    psql(`select stable_field_id from platform_private.cms_field_definition_versions
    where content_type_version_id = '${contentTypeVersionId}' and field_key = 'title'`);
  expect(titleFieldId).toMatch(/^[0-9a-f-]{36}$/u);
  return {
    owner,
    designer,
    reviewer,
    contentTypeId,
    contentTypeVersionId,
    titleFieldId,
    dryRunId,
    migrationPlanId,
    reviewId,
    assignmentId: s11String(assignment, 'id'),
    decisionId: s11String(decision, 'id'),
    workerCalls,
  };
};

/** Body operands are returned by real producers, never invented or repaired. */
export const s11ActivationRequest = async (candidate: S11SchemaCandidate) => {
  const path = versionPath(
    candidate.contentTypeId,
    candidate.contentTypeVersionId,
  );
  const version = ContentSchemaRegistryDetailSchema.parse(
    await read(candidate.designer.app, path),
  ).resource;
  return {
    path: `${path}/activate`,
    body: {
      expectedVersion: s11String(version, 'version'),
      dryRunId: candidate.dryRunId,
      approvalIds: [candidate.decisionId],
      migrationPlanId: candidate.migrationPlanId,
    },
  };
};

export const activateS11SchemaCandidate = async (
  candidate: S11SchemaCandidate,
): Promise<EditorialWorld> => {
  const request = await s11ActivationRequest(candidate);
  await post(candidate.designer.app, request.path, request.body, 200);
  expect(
    psql(`select state from platform_private.cms_content_type_versions
    where id = '${candidate.contentTypeVersionId}'`),
  ).toBe('active');
  return {
    owner: candidate.owner,
    contentTypeId: candidate.contentTypeId,
    contentTypeVersionId: candidate.contentTypeVersionId,
    titleFieldId: candidate.titleFieldId,
  };
};

/** Frozen evidence only: supersession may change state/version, never this tuple. */
export const s11FrozenActivationEvidence = (versionId: string): string =>
  psql(`select jsonb_build_object(
    'workflowKey', activation_workflow_policy_key,
    'workflowVersion', activation_workflow_policy_version,
    'policyHash', activation_workflow_policy_hash,
    'requiredCount', activation_required_decision_count,
    'requiredCapabilities', activation_required_capabilities,
    'approvalEvidenceHash', activation_approval_evidence_hash,
    'definitionHash', definition_hash, 'schemaArtifactId', schema_artifact_id
  )::text from platform_private.cms_content_type_versions where id = '${versionId}'`);
