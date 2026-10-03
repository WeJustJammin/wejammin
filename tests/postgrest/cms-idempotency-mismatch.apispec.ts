/**
 * D-IDEM (audit SEC-4): a key reused with a changed body reaches the wire as the
 * BE00 idempotency mismatch, produced end to end by the real stack.
 *
 * The CMS-03A-10 dry-run command reserves its key through
 * platform_private.cms_reserve_conflict, the reservation the nine review and
 * grant commands share. The request goes browser -> production Hono app ->
 * production RPC adapter -> Kong -> PostgREST -> database, and the answer is read
 * back at the wire. Before migration 20261003130000 the database rewrote the
 * mismatch into a bare CONFLICT and the wire said { conflict: 'INVALID_TRANSITION',
 * recoveryAction: 'refresh' }; BE00 (Error codes, CONFLICT) requires
 * { conflict: 'IDEMPOTENCY_MISMATCH', recoveryAction } so the client mints a new
 * key instead of retrying with the same one.
 *
 * Commits fixtures (the owner's content type): run right after `pnpm db:reset`.
 */
import { randomUUID } from 'node:crypto';

import { beforeAll, describe, expect, it } from 'vitest';

import {
  type CmsApp,
  createCmsApp,
  draftTypeBody,
  ownerSession,
} from './support/cms-app';
import { type CmsOwner, ensureCmsOwner } from './support/stack';

let owner: CmsOwner;
let app: CmsApp;
let versionPath = '';

beforeAll(async () => {
  owner = ensureCmsOwner();
  app = createCmsApp(
    ownerSession(owner.authUserId, owner.organizationId, [
      'cms.schema_designer',
    ]),
  );
  const created = await app.send('POST', '/api/v1/cms/content-types', {
    body: draftTypeBody(`idem_${randomUUID().slice(0, 8).replaceAll('-', '')}`),
  });
  expect(created.status).toBe(201);
  versionPath = `/api/v1/cms/content-types/${String(created.body.contentTypeId)}/versions/${String(created.body.id)}/dry-runs`;
});

const dryRunBody = {
  expectedVersion: '1',
  transformKey: null,
  transformVersion: null,
};

describe('D-IDEM CMS-03A-10 through the production Worker against the real database', () => {
  it('[P2-S09-AC-354] a same-key retry replays the first response, and a changed body answers 409 CONFLICT { conflict: IDEMPOTENCY_MISMATCH, recoveryAction: use_new_idempotency_key }', async () => {
    const key = `d-idem-${randomUUID()}`;
    app.clearObserved();
    const first = await app.send('POST', versionPath, {
      body: dryRunBody,
      idempotencyKey: key,
      ifMatch: '1',
    });
    expect(first.status).toBe(202);

    const replay = await app.send('POST', versionPath, {
      body: dryRunBody,
      idempotencyKey: key,
      ifMatch: '1',
    });
    expect(replay.status).toBe(202);
    expect(replay.body).toEqual(first.body);

    app.clearObserved();
    const changed = await app.send('POST', versionPath, {
      body: { ...dryRunBody, expectedVersion: '999' },
      idempotencyKey: key,
      ifMatch: '999',
    });
    // The database's own refusal, unrewritten ...
    expect(app.observed()).toEqual([
      {
        rpc: 'cms_start_schema_dry_run',
        status: 400,
        message: 'IDEMPOTENCY_MISMATCH',
      },
    ]);
    // ... and the BE00 wire shape the Worker derives from it.
    expect(changed.status).toBe(409);
    expect(changed.body).toMatchObject({
      code: 'CONFLICT',
      details: {
        conflict: 'IDEMPOTENCY_MISMATCH',
        recoveryAction: 'use_new_idempotency_key',
      },
    });
    expect(changed.body.details).not.toMatchObject({
      conflict: 'INVALID_TRANSITION',
    });
  });

  it('[P2-S09-AC-354] control: a different key carrying the same changed body is judged on its own merits (stale version, not a mismatch)', async () => {
    const stale = await app.send('POST', versionPath, {
      body: { ...dryRunBody, expectedVersion: '999' },
      idempotencyKey: `d-idem-${randomUUID()}`,
      ifMatch: '999',
    });
    expect(stale.status).toBe(409);
    expect(stale.body).toMatchObject({
      code: 'CONFLICT',
      details: { conflict: 'VERSION_MISMATCH' },
    });
  });
});
