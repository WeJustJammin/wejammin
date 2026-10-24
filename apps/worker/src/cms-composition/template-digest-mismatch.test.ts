import { describe, expect, it } from 'vitest';
import { CmsCompositionRefusalDetailsSchema } from '@wejammin/contracts';

import {
  createCmsTemplateApp,
  errorResponse,
  failure,
  type CmsTemplateDependencies,
} from './template-routes';
import type { CapabilityOperationId } from './capability-details';

/**
 * CMS-03C-01 `block_registry_digest_mismatch` relay (BE03c 323-327, 373, 1273, 1323; DEC-186 item 2): a 409 that
 * names the token on an operation whose `CMS_SLICE_12_OPERATION_REASONS` row carries it keeps the token as the one
 * `details.reasonCode` member. Every other 409 member, the token on any other status and the token on an operation
 * without it relay nothing beyond the version pair.
 */
const ORIGIN = 'https://cms-console.example.test';
const REQUEST_ID = '50000000-0000-4000-8000-000000000005';
const TOKEN = 'block_registry_digest_mismatch';

const dependencies = {
  humanOrigins: [ORIGIN],
} as unknown as CmsTemplateDependencies;

const relay = async (
  error: ReturnType<typeof failure>,
  operationId?: CapabilityOperationId,
) => {
  const response = errorResponse(
    new Request('https://api.example.test/x'),
    dependencies,
    REQUEST_ID,
    error,
    undefined,
    operationId,
  );
  return {
    status: response.status,
    body: (await response.json()) as {
      code: string;
      details: Record<string, unknown>;
    },
  };
};

describe('CMS-03C-01 digest mismatch relay (errorResponse)', () => {
  it('relays the token as the only member of a 409 on CMS-03C-01', async () => {
    const { status, body } = await relay(failure(409, { reasonCode: TOKEN }));
    expect(status).toBe(409);
    expect(body.code).toBe('TEMPLATE_VERSION_CONFLICT');
    expect(body.details).toEqual({ reasonCode: TOKEN });
    expect(
      CmsCompositionRefusalDetailsSchema.safeParse(body.details).success,
    ).toBe(true);
  });

  it('drops every other member, the version pair included, when the token is named', async () => {
    const { body } = await relay(
      failure(409, {
        reasonCode: TOKEN,
        expectedVersion: '1',
        currentVersion: '2',
        violations: [{ path: '/blockRegistryDigest', code: 'x', message: 'y' }],
        secret: 'private',
        conflict: 'INVALID_TRANSITION',
      }),
    );
    expect(body.details).toEqual({ reasonCode: TOKEN });
  });

  it('keeps the version pair for a plain 409', async () => {
    const { body } = await relay(
      failure(409, { expectedVersion: '1', currentVersion: '2' }),
    );
    expect(body.details).toEqual({ expectedVersion: '1', currentVersion: '2' });
  });

  it.each([
    ['another operation token', 'pattern_cycle'],
    ['a 403 token', 'capability_missing'],
    ['a 422 token', 'key_reserved'],
    ['an unknown token', 'totally_unknown'],
    ['the pre-contract upper-case spelling', TOKEN.toUpperCase()],
    ['a padded token', ` ${TOKEN}`],
    ['a non-string', 5],
    ['null', null],
  ] as const)('relays nothing for %s on a 409', async (_label, value) => {
    const { body } = await relay(failure(409, { reasonCode: value }));
    expect(body.details).toEqual({});
  });

  it.each([400, 403, 404, 422, 429, 500, 503] as const)(
    'never relays the token on a %s',
    async (status) => {
      const { body } = await relay(failure(status, { reasonCode: TOKEN }));
      expect(body.details).not.toHaveProperty('reasonCode');
    },
  );

  it('relays nothing on an operation whose row does not carry the token', async () => {
    const { body } = await relay(
      failure(409, { reasonCode: TOKEN }),
      'cmsTemplateLatestRead',
    );
    expect(body.details).toEqual({});
  });

  it('is the contract list that decides, not the route', async () => {
    // CMS-03C-02 and -12 carry the token too; the template relay is list-driven and would relay it for them.
    const { body } = await relay(
      failure(409, { reasonCode: TOKEN }),
      'CMS-03C-02',
    );
    expect(body.details).toEqual({ reasonCode: TOKEN });
  });
});

describe('CMS-03C-01 digest mismatch relay (define route)', () => {
  const session = {
    userId: '10000000-0000-4000-8000-000000000001',
    actingPartyId: '20000000-0000-4000-8000-000000000002',
    capabilities: ['cms.template_designer'],
    mfaFresh: false,
  };
  const body = {
    templateKey: 'profile-header',
    compatibleTypeIds: ['30000000-0000-4000-8000-000000000003'],
    slots: [],
    reservedRegions: ['header', 'now', 'record', 'detail', 'provenance'],
    bindings: {},
    locale: 'en-US',
    audience: 'public',
    blockRegistryDigest: 'f'.repeat(64),
    expectedVersion: null,
  };

  it('answers 409 TEMPLATE_VERSION_CONFLICT with the closed reasonCode from the port', async () => {
    const app = createCmsTemplateApp({
      humanOrigins: [ORIGIN],
      now: () => 0,
      resolveSession: async () => ({ ok: true as const, value: session }),
      rateLimit: async (input: { limit: number }) => ({
        ok: true as const,
        value: {
          allowed: true,
          limit: input.limit,
          remaining: input.limit - 1,
          resetAt: 60_000,
        },
      }),
      defineTemplate: async () => failure(409, { reasonCode: TOKEN }),
      telemetry: () => undefined,
    } as unknown as CmsTemplateDependencies);
    const response = await app.request('/api/v1/cms/templates/versions', {
      method: 'POST',
      headers: {
        origin: ORIGIN,
        'content-type': 'application/json',
        'idempotency-key': 'template-digest-0001',
        'x-request-id': REQUEST_ID,
      },
      body: JSON.stringify(body),
    });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      code: 'TEMPLATE_VERSION_CONFLICT',
      requestId: REQUEST_ID,
      details: { reasonCode: TOKEN },
    });
  });
});
