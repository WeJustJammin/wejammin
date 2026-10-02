import { describe, expect, it, vi } from 'vitest';
import {
  REVISION_RESTORE_SEAMS,
  type EntryCreateResource,
  type EntryRevisionResource,
} from '@wejammin/contracts';

import { createCmsEditorialApp, type CmsEditorialDependencies } from './index';

/*
 * BE03b registers `querySchema` only on the two safe reads; every command row
 * carries a request schema and a headers schema instead. The four CMS
 * editorial writes therefore admit no URL query member, so a query string is
 * unparsed caller input that must be refused as 400 INVALID_REQUEST before any
 * session, rate, or persistence side effect (`route-policy-contract.ts`).
 */

const origin = 'https://cms-console.example.test';
const requestId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const userId = '10000000-0000-4000-8000-000000000001';
const partyId = '20000000-0000-4000-8000-000000000002';
const entryId = '30000000-0000-4000-8000-000000000003';
const conflictId = '31000000-0000-4000-8000-000000000003';
const baseRevisionId = '40000000-0000-4000-8000-000000000004';
const theirsRevisionId = '41000000-0000-4000-8000-000000000004';
const resolvedRevisionId = '42000000-0000-4000-8000-000000000004';
const appendedRevisionId = '43000000-0000-4000-8000-000000000004';
const schemaVersionId = '50000000-0000-4000-8000-000000000005';
const fieldId = '60000000-0000-4000-8000-000000000006';
const contentHash = 'a'.repeat(64);
const idempotencyKey = 'idempotency-key-0001';
const instant = '2026-09-26T12:00:00.000Z';

const resource = (
  id: string,
  revisionNumber: string,
): EntryRevisionResource => ({
  id,
  version: '2',
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

const revisionPath = `/api/v1/cms/entries/${entryId}/revisions`;
const conflictPath = `/api/v1/cms/entries/${entryId}/conflicts/${conflictId}/resolve`;
const createPath = '/api/v1/cms/entries';
const restorePath = `/api/v1/cms/entries/${entryId}/revisions/${baseRevisionId}/restore`;

const revisionBody = {
  entryId,
  baseRevision: '1',
  changedPaths: [`/fields/${fieldId}/value`],
  values: { [fieldId]: 'Hello' },
  locale: 'en-US',
  expectedVersion: '1',
};

const conflictBody = {
  entryId,
  conflictId,
  baseRevision: '1',
  choices: [{ path: `/fields/${fieldId}`, choice: 'theirs' }],
  expectedVersion: '2',
};

const restoreBody = {
  entryId,
  revisionId: baseRevisionId,
  migrationChainId: schemaVersionId,
  expectedVersion: '2',
};

const evidence = {
  key: 'editorial.standard',
  version: '1',
  policyHash: contentHash,
  riskClass: 'ordinary',
  requiredDecisionCount: 1,
  requiredCapabilities: [],
  approvalEvidenceHash: contentHash,
} as const;

const createBody = {
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

const createResource: EntryCreateResource = {
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

const restoreVerification = {
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

const harness = () => {
  const session = {
    userId,
    actingPartyId: partyId,
    capabilities: ['cms.author'],
    mfaFresh: true,
  };
  const resolveSession = vi.fn(async () => ({
    ok: true as const,
    value: session,
  }));
  const rateLimit = vi.fn(async () => ({
    ok: true as const,
    value: { allowed: true, limit: 120, remaining: 119, resetAt: 60_000 },
  }));
  const appendRevision = vi.fn(async () => ({
    ok: true as const,
    value: resource(appendedRevisionId, '2'),
  }));
  const resolveConflict = vi.fn(async () => ({
    ok: true as const,
    value: {
      ...resource(resolvedRevisionId, '3'),
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
        ...resource(resolvedRevisionId, '3'),
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

const post = (
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

const writeHeaders = (extra: Record<string, string> = {}) => ({
  'if-match': '"1"',
  ...extra,
});

const expectRefusedBeforeAdmission = async (
  response: Response,
  app: ReturnType<typeof harness>,
): Promise<void> => {
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({
    code: 'INVALID_REQUEST',
    message: 'The command route does not accept query parameters.',
    details: {},
    requestId,
  });
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(response.headers.get('x-request-id')).toBe(requestId);
  expect(app.appendRevision).not.toHaveBeenCalled();
  expect(app.resolveConflict).not.toHaveBeenCalled();
  expect(app.createEntry).not.toHaveBeenCalled();
  expect(app.restoreRevision).not.toHaveBeenCalled();
  expect(app.resolveSession).not.toHaveBeenCalled();
  expect(app.rateLimit).not.toHaveBeenCalled();
};

describe('CMS-03B-01 revision command query admission', () => {
  it('refuses an undeclared query before any admission or port side effect', async () => {
    const app = harness();
    await expectRefusedBeforeAdmission(
      await post(
        app.app,
        `${revisionPath}?limit=25&state=draft`,
        revisionBody,
        writeHeaders(),
      ),
      app,
    );
    await expectRefusedBeforeAdmission(
      await post(
        app.app,
        `${revisionPath}?ownerId=${entryId}`,
        revisionBody,
        writeHeaders(),
      ),
      app,
    );
    await expectRefusedBeforeAdmission(
      await post(
        app.app,
        `${revisionPath}?locale=en-US&locale=fr`,
        revisionBody,
        writeHeaders(),
      ),
      app,
    );
  });

  it('still admits the declared command with no query', async () => {
    const app = harness();
    const response = await post(
      app.app,
      revisionPath,
      revisionBody,
      writeHeaders(),
    );
    expect(response.status).toBe(201);
    expect(app.appendRevision).toHaveBeenCalledTimes(1);
    const body = (await response.json()) as { id: string };
    expect(body.id).toBe(appendedRevisionId);
  });
});

describe('CMS-03B-02 conflict-resolution command query admission', () => {
  it('refuses an undeclared query before any admission or port side effect', async () => {
    const app = harness();
    await expectRefusedBeforeAdmission(
      await post(
        app.app,
        `${conflictPath}?ownerId=${entryId}`,
        conflictBody,
        writeHeaders({ 'if-match': '"2"' }),
      ),
      app,
    );
  });

  it('still admits the declared command with no query', async () => {
    const app = harness();
    const response = await post(
      app.app,
      conflictPath,
      conflictBody,
      writeHeaders({ 'if-match': '"2"' }),
    );
    expect(response.status).toBe(201);
    expect(app.resolveConflict).toHaveBeenCalledTimes(1);
  });
});

describe('CMS-03B-10 entry-create command query admission', () => {
  it('refuses an undeclared query before any admission or port side effect', async () => {
    const app = harness();
    await expectRefusedBeforeAdmission(
      await post(app.app, `${createPath}?ownerId=${entryId}`, createBody, {}),
      app,
    );
  });

  it('still admits the declared create with no query', async () => {
    const app = harness();
    const response = await post(app.app, createPath, createBody, {});
    expect(response.status).toBe(201);
    expect(app.createEntry).toHaveBeenCalledTimes(1);
  });
});

describe('CMS-03B-04 restore command query admission', () => {
  it('refuses an undeclared query before any admission or port side effect', async () => {
    const app = harness();
    await expectRefusedBeforeAdmission(
      await post(
        app.app,
        `${restorePath}?ownerId=${entryId}`,
        restoreBody,
        writeHeaders({ 'if-match': '"2"' }),
      ),
      app,
    );
  });

  it('still admits the declared restore with no query', async () => {
    const app = harness();
    const response = await post(
      app.app,
      restorePath,
      restoreBody,
      writeHeaders({ 'if-match': '"2"' }),
    );
    expect(response.status).toBe(201);
    expect(app.restoreRevision).toHaveBeenCalledTimes(1);
  });
});

describe('cms-editorial command query admission scope', () => {
  it('keeps an empty query string admissible on the create command', async () => {
    const app = harness();
    const response = await post(app.app, `${createPath}?`, createBody, {});
    expect(response.status).toBe(201);
    expect(app.createEntry).toHaveBeenCalledTimes(1);
  });
});
