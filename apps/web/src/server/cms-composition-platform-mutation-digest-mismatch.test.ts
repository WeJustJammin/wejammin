import { describe, expect, it, vi } from 'vitest';
import { CmsCompositionRefusalDetailsSchema } from '@wejammin/contracts';

import {
  forwardCmsTemplateDefineMutation,
  forwardedError,
} from './cms-composition-platform-mutation';
import {
  REQUEST_ID,
  failure,
  request,
} from './cms-composition-platform-mutation-test-support';

/**
 * CMS-03C-01 `block_registry_digest_mismatch` (BE03c 323-327, 373, 1273, 1323; DEC-186 item 2): the first-party relay
 * keeps the closed token as the one `details.reasonCode` of a 409 on CMS-03C-01, and drops every other 409 member,
 * the token on any other status and the token on an operation whose contract row does not carry it.
 */
const TOKEN = 'block_registry_digest_mismatch';
const TEMPLATE_409 = 'TEMPLATE_VERSION_CONFLICT';

const define = async (details: Record<string, unknown>) => {
  const response = await forwardCmsTemplateDefineMutation(request(), {
    fetch: vi.fn(async () => failure(409, TEMPLATE_409, details)),
  });
  return {
    status: response.status,
    body: (await response.json()) as {
      code: string;
      requestId: string;
      details: Record<string, unknown>;
    },
  };
};

describe('CMS-03C-01 first-party relay, digest mismatch', () => {
  it('relays the token as the only member of the 409', async () => {
    const { status, body } = await define({ reasonCode: TOKEN });
    expect(status).toBe(409);
    expect(body).toMatchObject({ code: TEMPLATE_409, requestId: REQUEST_ID });
    expect(body.details).toEqual({ reasonCode: TOKEN });
    expect(
      CmsCompositionRefusalDetailsSchema.safeParse(body.details).success,
    ).toBe(true);
  });

  it('drops the version pair and every other member when the token is named', async () => {
    const { body } = await define({
      reasonCode: TOKEN,
      expectedVersion: '1',
      currentVersion: '2',
      violations: [{ path: '/blockRegistryDigest', code: 'x', message: 'y' }],
      secret: 'private',
    });
    expect(body.details).toEqual({ reasonCode: TOKEN });
  });

  it('keeps the version pair of a plain 409', async () => {
    const { body } = await define({
      expectedVersion: '1',
      currentVersion: '2',
    });
    expect(body.details).toEqual({ expectedVersion: '1', currentVersion: '2' });
  });

  it.each([
    ['another operation token', 'pattern_cycle'],
    ['a 403 token', 'capability_missing'],
    ['a 422 token', 'key_reserved'],
    ['an unknown token', 'totally_unknown'],
    ['the upper-case spelling', TOKEN.toUpperCase()],
    ['a padded token', ` ${TOKEN}`],
    ['a non-string', 5],
    ['null', null],
  ] as const)('relays nothing for %s on a 409', async (_label, value) => {
    const { body } = await define({ reasonCode: value });
    expect(body.details).toEqual({});
  });

  it.each([400, 403, 404, 422, 429, 500, 503] as const)(
    'never relays the token on a %s',
    async (status) => {
      const codes: Record<number, string> = {
        400: 'INVALID_REQUEST',
        403: 'TEMPLATE_FORBIDDEN',
        404: 'TEMPLATE_NOT_FOUND',
        422: 'TEMPLATE_VALIDATION_FAILED',
        429: 'RATE_LIMITED',
        500: 'INTERNAL_ERROR',
        503: 'DEPENDENCY_UNAVAILABLE',
      };
      const response = await forwardedError(
        request(),
        failure(status, codes[status] as string, { reasonCode: TOKEN }),
      );
      expect(
        ((await response.json()) as { details: Record<string, unknown> })
          .details,
      ).not.toHaveProperty('reasonCode', TOKEN);
    },
  );

  it('relays nothing on an operation whose row does not carry the token', async () => {
    const response = await forwardedError(
      request(),
      failure(409, TEMPLATE_409, { reasonCode: TOKEN }),
      'cmsTemplateLatestRead',
    );
    expect(((await response.json()) as { details: unknown }).details).toEqual(
      {},
    );
  });
});
