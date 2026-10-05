import { describe, expect, it } from 'vitest';

import {
  appendedRevisionId,
  conflictBody,
  conflictPath,
  createBody,
  createPath,
  entryId,
  harness,
  post,
  requestId,
  restoreBody,
  restorePath,
  revisionBody,
  revisionPath,
  writeHeaders,
} from './route-fixtures.test-support';

/*
 * BE03b registers `querySchema` only on the two safe reads; every command row
 * carries a request schema and a headers schema instead. The four CMS
 * editorial writes therefore admit no URL query member, so a query string is
 * unparsed caller input that must be refused as 400 INVALID_REQUEST (BE00
 * step 6) before any authorization, rate, or persistence side effect (`route-policy-contract.ts`).
 */

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
  // BE00 step 6 (strict query) follows authentication (step 4) and precedes
  // authorization and the quota (step 7).
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
