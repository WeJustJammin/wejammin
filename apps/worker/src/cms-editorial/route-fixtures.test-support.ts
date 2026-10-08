import { vi } from 'vitest';
import {
  REVISION_RESTORE_SEAMS,
  type EntryCreateResource,
  type EntryRevisionResource,
} from '@wejammin/contracts';

import { createCmsEditorialApp, type CmsEditorialDependencies } from './index';

/**
 * Shared fixtures for the CMS editorial command route tests: one app over fake
 * ports, plus the four mutation paths, bodies and headers.
 */

export const origin = 'https://cms-console.example.test';
export const requestId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export const userId = '10000000-0000-4000-8000-000000000001';
export const partyId = '20000000-0000-4000-8000-000000000002';
export const entryId = '30000000-0000-4000-8000-000000000003';
export const conflictId = '31000000-0000-4000-8000-000000000003';
export const baseRevisionId = '40000000-0000-4000-8000-000000000004';
export const theirsRevisionId = '41000000-0000-4000-8000-000000000004';
export const resolvedRevisionId = '42000000-0000-4000-8000-000000000004';
export const appendedRevisionId = '43000000-0000-4000-8000-000000000004';
export const schemaVersionId = '50000000-0000-4000-8000-000000000005';
export const fieldId = '60000000-0000-4000-8000-000000000006';
export const contentHash = 'a'.repeat(64);
export const idempotencyKey = 'idempotency-key-0001';
export const instant = '2026-09-26T12:00:00.000Z';

export const resource = (
  id: string,
  revisionNumber: string,
  entryVersion = '2',
): EntryRevisionResource => ({
  id,
  version: '1',
  entryVersion,
  createdAt: instant,
  updatedAt: instant,
  state: 'draft',
  entryId,
  revisionNumber,
  schemaVersionId,
  templateVersionId: null,
  taxonomyVersionIds: [],
  locale: 'en-US',
  contentHash,
  parentRevisionIds: [],
  validationState: 'valid',
  conflictId: null,
});

export const revisionPath = `/api/v1/cms/entries/${entryId}/revisions`;
export const conflictPath = `/api/v1/cms/entries/${entryId}/conflicts/${conflictId}/resolve`;
export const createPath = '/api/v1/cms/entries';
export const restorePath = `/api/v1/cms/entries/${entryId}/revisions/${baseRevisionId}/restore`;

export const revisionBody = {
  entryId,
  baseRevision: '1',
  changedPaths: [`/fields/${fieldId}`],
  values: { [fieldId]: 'Hello' },
  locale: 'en-US',
  expectedVersion: '1',
};

export const conflictBody = {
  entryId,
  conflictId,
  baseRevision: '1',
  choices: [{ path: `/fields/${fieldId}`, choice: 'theirs' }],
  expectedVersion: '2',
};

export const restoreBody = {
  entryId,
  revisionId: baseRevisionId,
  migrationChainId: schemaVersionId,
  expectedVersion: '2',
};

export const evidence = {
  key: 'editorial.standard',
  version: '1',
  policyHash: contentHash,
  riskClass: 'ordinary',
  requiredDecisionCount: 1,
  requiredCapabilities: [],
  approvalEvidenceHash: contentHash,
} as const;

export const createBody = {
  contentTypeId: entryId,
  contentTypeVersionId: schemaVersionId,
  locale: 'en-US',
  changedPaths: [`/fields/${fieldId}`],
  values: { [fieldId]: 'Hello' },
  schemaArtifact: {
    id: appendedRevisionId,
    contentTypeVersionId: schemaVersionId,
    artifactHash: contentHash,
    compilerVersion: '1.0.0',
    zodContractRef: '03a.content-type-version.v1',
  },
  validatorRefs: [],
  workflowPolicy: evidence,
  activationEvidence: evidence,
};

export const createResource: EntryCreateResource = {
  entry: { id: entryId, version: '1', createdAt: instant, updatedAt: instant },
  revision: {
    id: appendedRevisionId,
    version: '1',
    createdAt: instant,
    updatedAt: instant,
  },
  revisionNumber: '1',
  lifecycle: 'active',
  state: 'draft',
  locale: 'en-US',
  contentHash,
  validationState: 'valid',
};

export const restoreVerification = {
  request: {
    entryId,
    revisionId: baseRevisionId,
    migrationChainId: schemaVersionId,
    expectedVersion: '2',
  },
  registry: {
    revisionId: baseRevisionId,
    migrationChainId: schemaVersionId,
    sourceSchemaVersionId: schemaVersionId,
    activeSchemaVersionId: schemaVersionId,
    chainSchemaVersionIds: [schemaVersionId],
    entryVersion: '2',
  },
  seams: [...REVISION_RESTORE_SEAMS],
} as const;

export type HarnessOverrides = Readonly<{
  capabilities?: readonly string[];
  unauthenticated?: boolean;
  rateAllowed?: boolean;
  /** A failure the revision port answers instead of its success value. */
  appendRevisionFailure?: Readonly<{
    status: number;
    code: string;
    message: string;
  }>;
}>;

export const harness = (overrides: HarnessOverrides = {}) => {
  const session = {
    userId,
    actingPartyId: partyId,
    capabilities: overrides.capabilities ?? ['cms.author'],
    mfaFresh: true,
  };
  const resolveSession = vi.fn(async () =>
    overrides.unauthenticated === true
      ? {
          ok: false as const,
          status: 401 as const,
          code: 'UNAUTHENTICATED',
          message: 'No session.',
        }
      : { ok: true as const, value: session },
  );
  const rateLimit = vi.fn(async () => ({
    ok: true as const,
    value: {
      allowed: overrides.rateAllowed ?? true,
      limit: 120,
      remaining: 119,
      resetAt: 60_000,
    },
  }));
  const appendRevision = vi.fn(async () =>
    overrides.appendRevisionFailure === undefined
      ? {
          ok: true as const,
          value: resource(appendedRevisionId, '2'),
        }
      : { ok: false as const, ...overrides.appendRevisionFailure },
  );
  const resolveConflict = vi.fn(async () => ({
    ok: true as const,
    value: {
      ...resource(resolvedRevisionId, '3', '3'),
      parentRevisionIds: [baseRevisionId, theirsRevisionId],
      conflictId,
    },
  }));
  const createEntry = vi.fn(async () => ({
    ok: true as const,
    value: createResource,
  }));
  const restoreRevision = vi.fn(async () => ({
    ok: true as const,
    value: {
      resource: {
        ...resource(resolvedRevisionId, '3', '3'),
        parentRevisionIds: [baseRevisionId],
      },
      restoreVerification,
    },
  }));
  const listRevisions = vi.fn(async () => ({
    ok: false as const,
    status: 503 as const,
    code: 'DEPENDENCY_UNAVAILABLE',
    message: 'Unavailable.',
  }));
  const getEntryDraft = vi.fn(async () => ({
    ok: false as const,
    status: 503 as const,
    code: 'DEPENDENCY_UNAVAILABLE',
    message: 'Unavailable.',
  }));
  const telemetry = vi.fn();
  const dependencies = {
    ports: {
      appendRevision,
      resolveConflict,
      createEntry,
      restoreRevision,
      listRevisions,
      getEntryDraft,
    },
    resolveSession,
    rateLimit,
    humanOrigins: [origin],
    now: () => 0,
    telemetry,
  } as unknown as CmsEditorialDependencies;
  return {
    app: createCmsEditorialApp(dependencies),
    appendRevision,
    resolveConflict,
    createEntry,
    restoreRevision,
    resolveSession,
    rateLimit,
  };
};

export const post = (
  app: ReturnType<typeof createCmsEditorialApp>,
  path: string,
  body: unknown,
  headers: Record<string, string>,
): Promise<Response> =>
  Promise.resolve(
    app.request(path, {
      method: 'POST',
      headers: {
        origin,
        'content-type': 'application/json',
        'idempotency-key': idempotencyKey,
        'x-request-id': requestId,
        ...headers,
      },
      body: JSON.stringify(body),
    }),
  );

export const writeHeaders = (extra: Record<string, string> = {}) => ({
  'if-match': '"1"',
  ...extra,
});
