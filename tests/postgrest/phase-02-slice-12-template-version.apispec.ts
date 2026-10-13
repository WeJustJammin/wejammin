/**
 * Slice 12 real composition for CMS-03C-01 (`POST /api/v1/cms/templates/versions`): browser request
 * -> first-party web proxy -> private binding -> production Hono Worker -> production RPC adapter ->
 * Kong -> PostgREST -> the newest SQL. No port is faked: the only supplied seams are the verified
 * session and an always-allow rate limiter, so every status below is what the database decided.
 *
 * Commits fixtures (two isolated owners with a template-designer grant and an active content type
 * each): run right after `pnpm db:reset`, and reset again afterwards.
 */
import { createHash, randomUUID } from 'node:crypto';

import { TemplateVersionResourceSchema } from '@wejammin/contracts';
import { beforeAll, describe, expect, it } from 'vitest';

import {
  type EditorialWorld,
  prepareEditorialWorld,
} from './support/cms-editorial-world';
import {
  type CompositionStack,
  type StackResponse,
  createCompositionStack,
  createDesignerOwner,
  designerSession,
} from './support/phase-02-slice-12-composition-stack';
import { type CmsOwner, psql } from './support/stack';

const EMPTY_DIGEST = createHash('sha256').update('[]').digest('hex');
const REGIONS = ['header', 'now', 'record', 'detail', 'provenance'];

let ownerA: CmsOwner;
let ownerB: CmsOwner;
let worldA: EditorialWorld;
let worldB: EditorialWorld;
let stack: CompositionStack;
const keyOf = (label: string): string =>
  `s12-${label}-${randomUUID().slice(0, 8)}`;

beforeAll(async () => {
  ownerA = createDesignerOwner();
  ownerB = createDesignerOwner();
  worldA = await prepareEditorialWorld(ownerA);
  worldB = await prepareEditorialWorld(ownerB);
  stack = createCompositionStack(designerSession(ownerA));
});

const bodyFor = (
  world: EditorialWorld,
  templateKey: string,
  extra: Readonly<Record<string, unknown>> = {},
) => ({
  templateKey,
  compatibleTypeIds: [world.contentTypeId],
  slots: [],
  reservedRegions: REGIONS,
  bindings: {},
  locale: 'en-US',
  audience: 'public',
  expectedVersion: null,
  ...extra,
});

const rows = (owner: CmsOwner, templateKey: string): number =>
  Number(
    psql(`select count(*) from platform_private.cms_template_versions
           where owner_id = '${owner.organizationId}' and template_key = '${templateKey}'`),
  );
const effects = (id: string) => ({
  audit: Number(
    psql(
      `select count(*) from audit_private.audit_events where target_id = '${id}'`,
    ),
  ),
  outbox: Number(
    psql(
      `select count(*) from platform_private.outbox_events where aggregate_id = '${id}'`,
    ),
  ),
});
const created = (response: StackResponse) => {
  expect(response.status, response.text).toBe(201);
  return TemplateVersionResourceSchema.parse(response.body);
};
/** A refusal's observable shape without the per-request id. */
const refusal = (response: StackResponse) => ({
  status: response.status,
  cache: response.headers.get('cache-control'),
  body: { ...response.body, requestId: 'request-id' },
});

describe('CMS-03C-01 define a template version through the real stack', () => {
  it('[P2-S12-AC-004] [P2-S12-AC-009] a first version is a strict 201 draft with a strong ETag, one audit event and no outbox event', async () => {
    const key = keyOf('first');
    const response = await stack.defineTemplate(bodyFor(worldA, key));
    const resource = created(response);
    expect(resource).toMatchObject({
      state: 'draft',
      templateKey: key,
      templateVersion: 1,
      version: '1',
      compatibleTypeIds: [worldA.contentTypeId],
      reservedRegions: REGIONS,
      blockRegistryDigest: EMPTY_DIGEST,
    });
    // BE03c lineage: a first version is its own lineage.
    expect(resource.templateId).toBe(resource.id);
    expect(response.headers.get('etag')).toBe('"1"');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(rows(ownerA, key)).toBe(1);
    expect(effects(resource.id)).toEqual({ audit: 1, outbox: 0 });
    expect(
      stack.observed().filter((rpc) => rpc.rpc === 'cms_define_template'),
    ).not.toHaveLength(0);
  });

  it('[P2-S12-AC-004] [P2-S12-AC-007] a successor with the strong If-Match is version 2 in the same lineage and names its parent', async () => {
    const key = keyOf('chain');
    const first = created(await stack.defineTemplate(bodyFor(worldA, key)));
    const second = created(
      await stack.defineTemplate(
        bodyFor(worldA, key, { expectedVersion: '1', audience: 'members' }),
        { ifMatch: '1' },
      ),
    );
    expect(second).toMatchObject({ version: '2', templateVersion: 2 });
    expect(second.templateId).toBe(first.templateId);
    expect(
      psql(`select supersedes_id from platform_private.cms_template_versions
             where id = '${second.id}'`),
    ).toBe(first.id);
    expect(rows(ownerA, key)).toBe(2);
    expect(effects(second.id)).toEqual({ audit: 1, outbox: 0 });
  });

  it('[P2-S12-AC-007] [P2-S12-AC-009] an exact replay, also after a lost response, returns the stored 201 and adds no row and no effect', async () => {
    const key = keyOf('replay');
    const idempotencyKey = `replay-${randomUUID()}`;
    const request = bodyFor(worldA, key);
    stack.loseNextResponse();
    const lost = await stack.defineTemplate(request, { idempotencyKey });
    // The proxy never fabricates a success for a response it did not receive.
    expect(lost.status).toBe(503);
    expect(lost.body.code).toBe('DEPENDENCY_UNAVAILABLE');
    expect(rows(ownerA, key)).toBe(1);
    const replay = created(
      await stack.defineTemplate(request, { idempotencyKey }),
    );
    expect(replay.templateKey).toBe(key);
    const again = created(
      await stack.defineTemplate(request, { idempotencyKey }),
    );
    expect(again).toEqual(replay);
    expect(rows(ownerA, key)).toBe(1);
    expect(effects(replay.id)).toEqual({ audit: 1, outbox: 0 });
  });

  it('[P2-S12-AC-007] the same key with a changed body is a 409 and writes nothing', async () => {
    const key = keyOf('mismatch');
    const idempotencyKey = `mismatch-${randomUUID()}`;
    created(
      await stack.defineTemplate(bodyFor(worldA, key), { idempotencyKey }),
    );
    const changed = await stack.defineTemplate(
      bodyFor(worldA, key, { audience: 'members' }),
      { idempotencyKey },
    );
    expect(changed.status, changed.text).toBe(409);
    expect(changed.body.code).toBe('TEMPLATE_VERSION_CONFLICT');
    expect(rows(ownerA, key)).toBe(1);
  });

  it('[P2-S12-AC-007] a stale If-Match, a repeated first version and a successor of an absent key are 409, 409 and 404 with no row', async () => {
    const key = keyOf('cas');
    created(await stack.defineTemplate(bodyFor(worldA, key)));
    created(
      await stack.defineTemplate(
        bodyFor(worldA, key, { expectedVersion: '1' }),
        { ifMatch: '1' },
      ),
    );
    const stale = await stack.defineTemplate(
      bodyFor(worldA, key, { expectedVersion: '1' }),
      { ifMatch: '1' },
    );
    expect(stale.status, stale.text).toBe(409);
    expect(stale.body).toMatchObject({ code: 'TEMPLATE_VERSION_CONFLICT' });
    const repeated = await stack.defineTemplate(bodyFor(worldA, key));
    expect(repeated.status, repeated.text).toBe(409);
    expect(repeated.body.code).toBe('TEMPLATE_VERSION_CONFLICT');
    const absent = await stack.defineTemplate(
      bodyFor(worldA, keyOf('absent'), { expectedVersion: '1' }),
      { ifMatch: '1' },
    );
    expect(absent.status, absent.text).toBe(404);
    expect(absent.body).toMatchObject({
      code: 'TEMPLATE_NOT_FOUND',
      details: {},
    });
    expect(rows(ownerA, key)).toBe(2);
  });

  it('[P2-S12-AC-005] [P2-S12-AC-189] a reserved key is a 422 whose reasonCode and pointer name /templateKey, and writes nothing', async () => {
    for (const reserved of ['context', 'versions', 'new']) {
      const response = await stack.defineTemplate(bodyFor(worldA, reserved));
      expect(response.status, response.text).toBe(422);
      expect(response.body).toMatchObject({
        code: 'TEMPLATE_VALIDATION_FAILED',
        message:
          'TEMPLATE_VALIDATION_FAILED: template operation rejected or unavailable.',
        details: {
          reasonCode: 'key_reserved',
          violations: [
            {
              path: '/templateKey',
              code: 'key_reserved',
              message: 'The value is invalid.',
            },
          ],
        },
      });
      expect(rows(ownerA, reserved)).toBe(0);
    }
  });

  it('[P2-S12-AC-005] [P2-S12-AC-025] [P2-S12-AC-192] an audience outside ^[a-z0-9_-]{1,48}$ is a 422 at /audience and writes nothing', async () => {
    for (const audience of [
      'Public',
      ' public',
      'public ',
      'a'.repeat(49),
      'a b',
    ]) {
      const key = keyOf('aud');
      const response = await stack.defineTemplate(
        bodyFor(worldA, key, { audience }),
      );
      expect(response.status, `${audience}: ${response.text}`).toBe(422);
      expect(response.body).toMatchObject({
        code: 'TEMPLATE_VALIDATION_FAILED',
        details: {
          violations: [{ path: '/audience', code: 'audience_invalid' }],
        },
      });
      expect(rows(ownerA, key)).toBe(0);
    }
    const key = keyOf('aud-ok');
    const accepted = created(
      await stack.defineTemplate(
        bodyFor(worldA, key, { audience: 'a'.repeat(48) }),
      ),
    );
    expect(accepted.templateKey).toBe(key);
  });

  it("[P2-S12-AC-005] a value the contract accepts and the database refuses (a compatible type that is not the caller's active type, a reserved concept key) is a 422 with no row", async () => {
    const foreignType = await stack.defineTemplate(
      bodyFor(worldA, keyOf('foreign'), {
        compatibleTypeIds: [worldB.contentTypeId],
      }),
    );
    expect(foreignType.status, foreignType.text).toBe(422);
    expect(foreignType.body).toMatchObject({
      code: 'TEMPLATE_VALIDATION_FAILED',
    });
    const concept = await stack.defineTemplate(bodyFor(worldA, 'payments'));
    expect(concept.status, concept.text).toBe(422);
    expect(concept.body).toMatchObject({ code: 'TEMPLATE_VALIDATION_FAILED' });
    expect(rows(ownerA, 'payments')).toBe(0);
    expect(
      stack.observed().some((rpc) => rpc.message === 'VALIDATION_FAILED'),
    ).toBe(true);
  });

  it('[P2-S12-AC-005] an unknown member and a body that is not JSON are refused before any write', async () => {
    const unknown = await stack.defineTemplate({
      ...bodyFor(worldA, keyOf('unknown')),
      ownerId: ownerA.organizationId,
    });
    expect(unknown.status, unknown.text).toBe(422);
    const malformed = await stack.defineTemplate(undefined, {
      raw: '{"templateKey":',
    });
    expect(malformed.status, malformed.text).toBe(400);
    expect(malformed.body.code).toBe('INVALID_REQUEST');
  });
});

describe('CMS-03C-01 per-owner keys and concealment through the real stack', () => {
  it('[P2-S12-AC-022] [P2-S12-AC-190] a second owner defines the key another owner holds without a conflict, in its own lineage', async () => {
    const key = keyOf('shared');
    stack.as(designerSession(ownerA));
    const a = created(await stack.defineTemplate(bodyFor(worldA, key)));
    stack.as(designerSession(ownerB));
    const b = created(await stack.defineTemplate(bodyFor(worldB, key)));
    expect(b.version).toBe('1');
    expect(b.templateId).toBe(b.id);
    expect(b.templateId).not.toBe(a.templateId);
    expect(rows(ownerA, key)).toBe(1);
    expect(rows(ownerB, key)).toBe(1);
    // Each owner advances its own lineage on its own.
    const b2 = created(
      await stack.defineTemplate(
        bodyFor(worldB, key, { expectedVersion: '1' }),
        { ifMatch: '1' },
      ),
    );
    expect(b2).toMatchObject({ version: '2', templateId: b.templateId });
    stack.as(designerSession(ownerA));
    const stale = await stack.defineTemplate(
      bodyFor(worldA, key, { expectedVersion: '2' }),
      { ifMatch: '2' },
    );
    expect(stale.status, stale.text).toBe(409);
    expect(stale.body.details).toEqual({});
  });

  it('[P2-S12-AC-006] [P2-S12-AC-190] a successor of a key only another owner holds is the same 404 as an unused key, and the database said NOT_FOUND for both', async () => {
    const heldKey = keyOf('held');
    stack.as(designerSession(ownerA));
    created(await stack.defineTemplate(bodyFor(worldA, heldKey)));
    stack.as(designerSession(ownerB));
    stack.clearObserved();
    const held = await stack.defineTemplate(
      bodyFor(worldB, heldKey, { expectedVersion: '1' }),
      { ifMatch: '1' },
    );
    const unused = await stack.defineTemplate(
      bodyFor(worldB, keyOf('unused'), { expectedVersion: '1' }),
      { ifMatch: '1' },
    );
    expect(held.status, held.text).toBe(404);
    expect(refusal(held)).toEqual(refusal(unused));
    expect(held.body).toMatchObject({
      code: 'TEMPLATE_NOT_FOUND',
      details: {},
    });
    expect(
      stack
        .observed()
        .filter((rpc) => rpc.rpc === 'cms_define_template')
        .map((rpc) => `${rpc.status}:${rpc.message}`),
    ).toEqual(['400:NOT_FOUND', '400:NOT_FOUND']);
    expect(rows(ownerB, heldKey)).toBe(0);
    stack.as(designerSession(ownerA));
  });
});

describe('CMS-03C-01 authority through the real stack', () => {
  it('[P2-S12-AC-006] no session is 401, no designer capability is 403 before the database, a missing database grant is 403 from the database, and none writes', async () => {
    const key = keyOf('authority');
    stack.as(null);
    const anonymous = await stack.defineTemplate(bodyFor(worldA, key));
    expect(anonymous.status, anonymous.text).toBe(401);
    expect(anonymous.body).toMatchObject({
      code: 'UNAUTHENTICATED',
      details: { recoveryAction: 'reauthenticate' },
    });
    stack.as(designerSession(ownerA, []));
    stack.clearObserved();
    const noCapability = await stack.defineTemplate(bodyFor(worldA, key));
    expect(noCapability.status, noCapability.text).toBe(403);
    expect(noCapability.body).toMatchObject({
      code: 'TEMPLATE_FORBIDDEN',
      details: { reasonCode: 'CAPABILITY_REQUIRED' },
    });
    expect(stack.observed()).toEqual([]);
    // The session claims the capability, but the database holds no grant for this owner.
    const ungranted = createDesignerOwner();
    psql(`update identity_private.organization_actor_grant
             set active = false
           where organization_id = '${ungranted.organizationId}'
             and capability_code = 'cms.template_designer'`);
    const ungrantedWorld = await prepareEditorialWorld(ungranted);
    stack.as(designerSession(ungranted));
    stack.clearObserved();
    const denied = await stack.defineTemplate(
      bodyFor(ungrantedWorld, keyOf('denied')),
    );
    expect(denied.status, denied.text).toBe(403);
    expect(denied.body).toMatchObject({
      code: 'TEMPLATE_FORBIDDEN',
      details: {},
    });
    expect(
      stack
        .observed()
        .filter((rpc) => rpc.rpc === 'cms_define_template')
        .map((rpc) => rpc.message),
    ).toEqual(['FORBIDDEN']);
    expect(
      Number(
        psql(`select count(*) from platform_private.cms_template_versions
               where owner_id = '${ungranted.organizationId}'`),
      ),
    ).toBe(0);
    stack.as(designerSession(ownerA));
  });

  it('[P2-S12-AC-008] a dependency that never answers is 503 DEPENDENCY_UNAVAILABLE and writes nothing', async () => {
    const key = keyOf('outage');
    stack.failNextRpc();
    const response = await stack.defineTemplate(bodyFor(worldA, key));
    expect(response.status, response.text).toBe(503);
    expect(response.body).toMatchObject({
      code: 'DEPENDENCY_UNAVAILABLE',
      message:
        'DEPENDENCY_UNAVAILABLE: template operation rejected or unavailable.',
    });
    expect(rows(ownerA, key)).toBe(0);
  });
});
