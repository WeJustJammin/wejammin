import { describe, expect, it, vi } from 'vitest';

import {
  BODY,
  compose,
  input,
  json,
} from './cms-composition-production.test-support';

/**
 * [P2-S12-AC-005] [P2-S12-AC-189] [P2-S12-AC-192] The database refuses a reserved template key with
 * the typed token key_reserved (BE03c E13) and an invalid audience with VALIDATION_FAILED whose DETAIL
 * is the bounded pointer /audience (E4). The production adapter turns both into the one 422
 * TEMPLATE_VALIDATION_FAILED shape of the route, naming nothing the database did not name.
 */
const rpcError = (message: string, details: string | null, status = 400) =>
  json(
    {
      code: 'P0001',
      message,
      details,
      hint: null,
    },
    status,
  );

const define = async (response: Response) => {
  const fetchImpl = vi.fn(async () => response);
  return compose(fetchImpl as typeof fetch).defineTemplate(
    input({ body: { ...BODY, templateKey: 'profile-header' } }),
    new AbortController().signal,
  );
};

describe('CMS-03C-01 production template adapter typed refusals', () => {
  it('maps key_reserved to a 422 whose reasonCode and violation name /templateKey', async () => {
    const result = await define(rpcError('key_reserved', '["/templateKey"]'));
    expect(result).toEqual({
      ok: false,
      status: 422,
      code: 'VALIDATION_FAILED',
      message: expect.any(String),
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

  it('never trusts the token from a SQLSTATE other than the platform raise', async () => {
    const result = await define(
      json({ code: '23514', message: 'key_reserved', details: null }, 400),
    );
    expect(result).toMatchObject({ ok: false });
    expect(result.ok ? null : result.details).not.toHaveProperty('reasonCode');
  });

  it('does not let DETAIL prose or a foreign pointer change the key_reserved answer', async () => {
    const result = await define(
      rpcError('key_reserved', 'secret owner row /fields/abc'),
    );
    expect(result).toMatchObject({
      ok: false,
      status: 422,
      details: {
        reasonCode: 'key_reserved',
        violations: [{ path: '/templateKey', code: 'key_reserved' }],
      },
    });
    expect(JSON.stringify(result)).not.toContain('secret');
  });

  it('maps VALIDATION_FAILED with the /audience pointer to one bounded violation', async () => {
    const result = await define(rpcError('VALIDATION_FAILED', '["/audience"]'));
    expect(result).toMatchObject({
      ok: false,
      status: 422,
      code: 'VALIDATION_FAILED',
      details: {
        violations: [
          {
            path: '/audience',
            code: 'invalid',
            message: 'The value is invalid.',
          },
        ],
      },
    });
  });

  it('maps the exact P0001 block_registry_digest_mismatch pair to the 409 conflict with its reasonCode', async () => {
    const result = await define(
      rpcError(
        'block_registry_digest_mismatch',
        '["/blockRegistryDigest"]',
        400,
      ),
    );
    expect(result).toEqual({
      ok: false,
      status: 409,
      code: 'VERSION_CONFLICT',
      message: expect.any(String),
      details: { reasonCode: 'block_registry_digest_mismatch' },
    });
  });

  it('answers the digest token whatever the 4xx status PostgREST used', async () => {
    for (const status of [400, 409, 422])
      expect(
        await define(rpcError('block_registry_digest_mismatch', null, status)),
      ).toMatchObject({
        ok: false,
        status: 409,
        details: { reasonCode: 'block_registry_digest_mismatch' },
      });
  });

  it('does not let DETAIL prose or a foreign pointer change the digest answer', async () => {
    const result = await define(
      rpcError(
        'block_registry_digest_mismatch',
        'secret owner row /fields/abc',
      ),
    );
    expect(result).toMatchObject({
      ok: false,
      status: 409,
      details: { reasonCode: 'block_registry_digest_mismatch' },
    });
    expect(JSON.stringify(result)).not.toContain('secret');
    expect(JSON.stringify(result)).not.toContain('/fields/abc');
  });

  it('never trusts the digest token from another SQLSTATE, a 5xx, a structured code or other casing', async () => {
    for (const response of [
      json(
        {
          code: '23514',
          message: 'block_registry_digest_mismatch',
          details: null,
        },
        400,
      ),
      json(
        {
          code: 'P0001',
          message: 'block_registry_digest_mismatch',
          details: null,
        },
        500,
      ),
      json(
        { code: 'block_registry_digest_mismatch', message: 'x', details: null },
        400,
      ),
      json({ code: 'P0001', message: 'BLOCK_REGISTRY_DIGEST_MISMATCH' }, 400),
      json({ code: 'P0001', message: 'block_registry_digest_mismatch ' }, 400),
    ]) {
      const result = await define(response);
      expect(result.ok ? null : result.details).not.toHaveProperty(
        'reasonCode',
        'block_registry_digest_mismatch',
      );
    }
  });

  it('keeps the generic CONFLICT free of any reasonCode', async () => {
    const result = await define(rpcError('CONFLICT', null, 409));
    expect(result).toMatchObject({ ok: false, status: 409 });
    expect(result.ok ? null : result.details).not.toHaveProperty('reasonCode');
  });

  it('keeps every other token on the shared editorial mapping', async () => {
    expect(await define(rpcError('NOT_FOUND', null))).toMatchObject({
      ok: false,
      status: 404,
    });
    expect(await define(rpcError('CONFLICT', null, 409))).toMatchObject({
      ok: false,
      status: 409,
    });
    expect(await define(rpcError('an_unregistered_token', null))).toMatchObject(
      { ok: false, status: 500 },
    );
  });
});
