import { describe, expect, it, vi } from 'vitest';

import { forwardCmsTemplateDefineMutation } from './cms-composition-platform-mutation';
import {
  BODY,
  REQUEST_ID,
  failure,
  request,
} from './cms-composition-platform-mutation-test-support';

/**
 * [P2-S12-AC-189] BE03c E13: the first-party relay of CMS-03C-01 passes the typed
 * `reasonCode: key_reserved` and its /templateKey violation through, and nothing else a dependency
 * names: an unregistered reason is dropped, as is any violation code outside the closed list.
 */
describe('CMS-11 first-party template mutation boundary, E13 reserved key', () => {
  it('relays the typed key_reserved refusal with its bounded pointer', async () => {
    const response = await forwardCmsTemplateDefineMutation(request(), {
      fetch: vi.fn(async () =>
        failure(422, 'TEMPLATE_VALIDATION_FAILED', {
          reasonCode: 'key_reserved',
          violations: [
            { path: '/templateKey', code: 'key_reserved', privateValue: 'x' },
          ],
        }),
      ),
    });
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      code: 'TEMPLATE_VALIDATION_FAILED',
      message:
        'TEMPLATE_VALIDATION_FAILED: template operation rejected or unavailable.',
      requestId: REQUEST_ID,
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
  });

  it('drops a reason the relay does not register and a violation code it does not list', async () => {
    const response = await forwardCmsTemplateDefineMutation(request(), {
      fetch: vi.fn(async () =>
        failure(422, 'TEMPLATE_VALIDATION_FAILED', {
          reasonCode: 'owner_row_exists',
          violations: [{ path: '/templateKey', code: 'owner_row_exists' }],
        }),
      ),
    });
    expect(response.status).toBe(422);
    expect(((await response.json()) as { details: unknown }).details).toEqual({
      violations: [
        {
          path: '/templateKey',
          code: 'invalid',
          message: 'The value is invalid.',
        },
      ],
    });
  });
});

/**
 * [P2-S12-AC-005] The relay answers a body the contract refuses itself, before any upstream call,
 * with the same bounded JSON-pointer violations the Worker route would report: the exact stable
 * field violation, the safe message, and the typed reasonCode for a reserved key.
 */
describe('CMS-11 first-party template mutation boundary, local 422 pointers', () => {
  const refused = async (value: unknown) => {
    const fetch = vi.fn(async () => failure(500, 'INTERNAL_ERROR', {}));
    const response = await forwardCmsTemplateDefineMutation(request(value), {
      fetch,
    });
    expect(fetch).not.toHaveBeenCalled();
    expect(response.status).toBe(422);
    return (await response.json()) as {
      code: string;
      message: string;
      requestId: string;
      details: unknown;
    };
  };

  it.each(['context', 'versions', 'new'])(
    'refuses the reserved key %s at /templateKey with the typed reason',
    async (templateKey) => {
      expect(await refused({ ...BODY, templateKey })).toEqual({
        code: 'TEMPLATE_VALIDATION_FAILED',
        message:
          'TEMPLATE_VALIDATION_FAILED: template operation rejected or unavailable.',
        requestId: REQUEST_ID,
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
    },
  );

  it('refuses an audience outside the grammar at /audience', async () => {
    expect((await refused({ ...BODY, audience: 'Public' })).details).toEqual({
      violations: [
        {
          path: '/audience',
          code: 'audience_invalid',
          message: 'The value is invalid.',
        },
      ],
    });
  });

  it('names an unknown member by pointer without echoing its value', async () => {
    const response = await refused({ ...BODY, ownerId: 'private-owner' });
    expect(response.details).toEqual({
      violations: [
        { path: '/ownerId', code: 'invalid', message: 'The value is invalid.' },
      ],
    });
    expect(JSON.stringify(response)).not.toContain('private-owner');
  });

  it('bounds the pointers and keeps nested paths as JSON pointers', async () => {
    const response = await refused({
      ...BODY,
      slots: [
        { key: 'Bad Key', required: true, allowedBlocks: [], maxCount: 1 },
      ],
    });
    expect(response.details).toEqual({
      violations: [
        {
          path: '/slots/0/key',
          code: 'slot_key_invalid',
          message: 'The value is invalid.',
        },
      ],
    });
  });
});
