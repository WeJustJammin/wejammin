/**
 * Slice 12 real composition for the two protected template reads, `GET /api/v1/cms/templates/context`
 * (cmsTemplateContextRead) and `GET /api/v1/cms/templates/{templateKey}` (cmsTemplateLatestRead):
 * browser request -> first-party web proxy -> private binding -> production Hono Worker -> production
 * RPC adapter -> Kong -> PostgREST -> the newest SQL. Only the verified session and an always-allow
 * rate limiter are supplied, so 200, 403 and 404 are what the database decided.
 *
 * Commits fixtures (two isolated owners with a template-designer grant and an active content type
 * each): run right after `pnpm db:reset`, and reset again afterwards.
 */
import { randomUUID } from 'node:crypto';

import {
  TemplateDesignerContextSchema,
  TemplateVersionDetailSchema,
} from '@wejammin/contracts';
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

const define = async (
  world: EditorialWorld,
  templateKey: string,
  extra: Readonly<Record<string, unknown>> = {},
  ifMatch?: string,
) => {
  const response = await stack.defineTemplate(
    {
      templateKey,
      compatibleTypeIds: [world.contentTypeId],
      slots: [],
      reservedRegions: REGIONS,
      bindings: {},
      locale: 'en-US',
      audience: 'public',
      expectedVersion: null,
      ...extra,
    },
    ifMatch === undefined ? {} : { ifMatch },
  );
  expect(response.status, response.text).toBe(201);
  return response;
};
const refusal = (response: StackResponse) => ({
  status: response.status,
  cache: response.headers.get('cache-control'),
  body: { ...response.body, requestId: 'request-id' },
});

describe('cmsTemplateContextRead through the real stack', () => {
  it("[P2-S12-AC-159] [P2-S12-AC-161] returns only the caller owner's active content types, strictly, with no-store", async () => {
    stack.as(designerSession(ownerA));
    const response = await stack.templateContext();
    expect(response.status, response.text).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const context = TemplateDesignerContextSchema.parse(response.body);
    expect(context.contentTypes.map((type) => type.id)).toEqual([
      worldA.contentTypeId,
    ]);
    expect(context.contentTypes[0]).toMatchObject({
      activeVersionId: worldA.contentTypeVersionId,
      sourceLocale: 'en-US',
    });
    expect(JSON.stringify(response.body)).not.toContain(worldB.contentTypeId);
    expect(JSON.stringify(response.body)).not.toContain(ownerA.organizationId);
    stack.as(designerSession(ownerB));
    const other = await stack.templateContext();
    expect(
      TemplateDesignerContextSchema.parse(other.body).contentTypes.map(
        (type) => type.id,
      ),
    ).toEqual([worldB.contentTypeId]);
    stack.as(designerSession(ownerA));
  });

  it('[P2-S12-AC-161] no session is 401, no designer capability is 403, and a revoked database grant is 403 from the database', async () => {
    stack.as(null);
    expect((await stack.templateContext()).status).toBe(401);
    stack.as(designerSession(ownerA, []));
    stack.clearObserved();
    const noCapability = await stack.templateContext();
    expect(noCapability.status, noCapability.text).toBe(403);
    expect(noCapability.body.code).toBe('TEMPLATE_FORBIDDEN');
    expect(stack.observed()).toEqual([]);
    const revoked = createDesignerOwner();
    await prepareEditorialWorld(revoked);
    psql(`update identity_private.organization_actor_grant set active = false
           where organization_id = '${revoked.organizationId}'
             and capability_code = 'cms.template_designer'`);
    stack.as(designerSession(revoked));
    stack.clearObserved();
    const denied = await stack.templateContext();
    expect(denied.status, denied.text).toBe(403);
    expect(denied.body).toMatchObject({
      code: 'TEMPLATE_FORBIDDEN',
      details: {},
    });
    expect(
      stack
        .observed()
        .filter((rpc) => rpc.rpc === 'cms_template_context')
        .map((rpc) => rpc.message),
    ).toEqual(['FORBIDDEN']);
    stack.as(designerSession(ownerA));
  });
});

describe('cmsTemplateLatestRead through the real stack', () => {
  it("[P2-S12-AC-165] returns the caller owner's LATEST version as a strict detail with a strong ETag and no-store", async () => {
    const key = keyOf('latest');
    const first = await define(worldA, key);
    await define(
      worldA,
      key,
      { expectedVersion: '1', audience: 'members', locale: 'fr-FR' },
      '1',
    );
    stack.as(designerSession(ownerA));
    const response = await stack.templateLatest(key);
    expect(response.status, response.text).toBe(200);
    expect(response.headers.get('etag')).toBe('"2"');
    expect(response.headers.get('cache-control')).toBe('no-store');
    const detail = TemplateVersionDetailSchema.parse(response.body);
    expect(detail).toMatchObject({
      state: 'draft',
      templateKey: key,
      templateVersion: 2,
      version: '2',
      audience: 'members',
      locale: 'fr-FR',
      slots: [],
      bindings: {},
      reservedRegions: REGIONS,
      compatibleTypeIds: [worldA.contentTypeId],
    });
    expect(detail.templateId).toBe(first.body.templateId);
    expect(JSON.stringify(response.body)).not.toContain(ownerA.organizationId);
    expect(Object.keys(response.body)).not.toContain('ownerId');
  });

  it('[P2-S12-AC-166] [P2-S12-AC-167] a key only another owner holds is the same 404 as an unused key, and each owner reads its own definition of a shared key', async () => {
    const heldKey = keyOf('held');
    const sharedKey = keyOf('shared');
    stack.as(designerSession(ownerA));
    await define(worldA, heldKey);
    const sharedA = await define(worldA, sharedKey);
    stack.as(designerSession(ownerB));
    stack.clearObserved();
    const held = await stack.templateLatest(heldKey);
    const unused = await stack.templateLatest(keyOf('unused'));
    expect(held.status, held.text).toBe(404);
    expect(refusal(held)).toEqual(refusal(unused));
    expect(held.body).toMatchObject({
      code: 'TEMPLATE_NOT_FOUND',
      message:
        'TEMPLATE_NOT_FOUND: template operation rejected or unavailable.',
      details: {},
    });
    expect(
      stack
        .observed()
        .filter((rpc) => rpc.rpc === 'cms_template_latest')
        .map((rpc) => `${rpc.status}:${rpc.message}`),
    ).toEqual(['400:NOT_FOUND', '400:NOT_FOUND']);
    // Owner B defines the key owner A holds; each reads only its own lineage.
    const sharedB = await define(worldB, sharedKey);
    const readB = await stack.templateLatest(sharedKey);
    expect(readB.status, readB.text).toBe(200);
    expect(TemplateVersionDetailSchema.parse(readB.body).templateId).toBe(
      sharedB.body.templateId,
    );
    stack.as(designerSession(ownerA));
    const readA = await stack.templateLatest(sharedKey);
    expect(TemplateVersionDetailSchema.parse(readA.body).templateId).toBe(
      sharedA.body.templateId,
    );
    expect(sharedA.body.templateId).not.toBe(sharedB.body.templateId);
  });

  it('[P2-S12-AC-166] a malformed key and the reserved keys are 400 and never reach the database', async () => {
    stack.as(designerSession(ownerA));
    stack.clearObserved();
    for (const key of ['Bad_Key', 'x', 'versions', 'new']) {
      const viaProxy = await stack.templateLatest(key);
      expect(viaProxy.status, `${key}: ${viaProxy.text}`).toBe(400);
      expect(viaProxy.body.code).toBe('INVALID_REQUEST');
    }
    // Straight at the Worker: `versions` is the POST route's segment, never a template key.
    for (const key of ['versions', 'new', 'Bad_Key']) {
      const direct = await stack.worker('GET', `/api/v1/cms/templates/${key}`);
      expect(direct.status, `${key}: ${direct.text}`).toBe(400);
      expect(direct.body.code).toBe('INVALID_REQUEST');
    }
    expect(stack.observed()).toEqual([]);
  });

  it('[P2-S12-AC-167] no session is 401, no designer capability is 403, and a revoked database grant is 403 from the database', async () => {
    const key = keyOf('authority');
    stack.as(designerSession(ownerA));
    await define(worldA, key);
    stack.as(null);
    expect((await stack.templateLatest(key)).status).toBe(401);
    stack.as(designerSession(ownerA, []));
    stack.clearObserved();
    const noCapability = await stack.templateLatest(key);
    expect(noCapability.status, noCapability.text).toBe(403);
    expect(noCapability.body.code).toBe('TEMPLATE_FORBIDDEN');
    expect(stack.observed()).toEqual([]);
    psql(`update identity_private.organization_actor_grant set active = false
           where organization_id = '${ownerA.organizationId}'
             and capability_code = 'cms.template_designer'`);
    try {
      stack.as(designerSession(ownerA));
      stack.clearObserved();
      const denied = await stack.templateLatest(key);
      expect(denied.status, denied.text).toBe(403);
      expect(denied.body).toMatchObject({
        code: 'TEMPLATE_FORBIDDEN',
        details: {},
      });
      expect(
        stack
          .observed()
          .filter((rpc) => rpc.rpc === 'cms_template_latest')
          .map((rpc) => rpc.message),
      ).toEqual(['FORBIDDEN']);
    } finally {
      psql(`update identity_private.organization_actor_grant set active = true
             where organization_id = '${ownerA.organizationId}'
               and capability_code = 'cms.template_designer'`);
    }
  });

  it('[P2-S12-AC-169] a dependency that never answers is 503 DEPENDENCY_UNAVAILABLE', async () => {
    stack.as(designerSession(ownerA));
    stack.failNextRpc();
    const response = await stack.templateLatest(keyOf('outage'));
    expect(response.status, response.text).toBe(503);
    expect(response.body).toMatchObject({
      code: 'DEPENDENCY_UNAVAILABLE',
      message:
        'DEPENDENCY_UNAVAILABLE: template operation rejected or unavailable.',
    });
  });
});
