import { describe, expect, it, vi } from 'vitest';

import { AuthMfaFactorPathSchema } from '@wejammin/contracts';

import { bindings, createMfaApp, mfaRequest } from './mfa-route-test-support';
import {
  factorsResource,
  FACTOR_ID,
  OTHER_FACTOR_ID,
} from './mfa-test-support';
import { parsePathId } from './route-support-mfa';

const LIST = '/api/v1/account/mfa/factors';

describe('MFA routes: absent slice dependencies fail closed', () => {
  it('AUTH-API-18 answers 503 when verifyTotpEnrollment is not composed', async () => {
    const { app } = createMfaApp({}, ['verifyTotpEnrollment']);
    const response = await app.request(
      mfaRequest('POST', `${LIST}/${OTHER_FACTOR_ID}/verify`, {
        body: { code: '123456' },
        headers: { 'if-match': '"5"' },
      }),
      undefined,
      bindings,
    );
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      code: 'DEPENDENCY_UNAVAILABLE',
    });
  });

  it('AUTH-API-19 answers 503 when removeMfaFactor is not composed', async () => {
    const { app } = createMfaApp({}, ['removeMfaFactor']);
    const response = await app.request(
      mfaRequest('DELETE', `${LIST}/${FACTOR_ID}`, {
        body: { reason: 'user_request' },
        headers: {
          'if-match': '"3"',
          'idempotency-key': 'remove-factor-0001',
        },
      }),
      undefined,
      bindings,
    );
    expect(response.status).toBe(503);
  });
});

describe('parsePathId', () => {
  const context = {} as Parameters<typeof parsePathId>[0];

  it('accepts a valid identifier and rejects an invalid or absent one with 400', () => {
    const schema = AuthMfaFactorPathSchema.shape.factorId;
    expect(parsePathId(context, schema, FACTOR_ID)).toEqual({
      ok: true,
      value: FACTOR_ID,
    });
    for (const value of ['not-a-uuid', '', undefined]) {
      expect(parsePathId(context, schema, value)).toMatchObject({
        ok: false,
        status: 400,
        code: 'INVALID_REQUEST',
      });
    }
  });

  it('never consults the schema when the identifier is absent', () => {
    const safeParse = vi.fn(() => ({ success: true }));
    expect(parsePathId(context, { safeParse }, undefined)).toMatchObject({
      ok: false,
      status: 400,
    });
    expect(safeParse).not.toHaveBeenCalled();
  });
});

describe('MFA test support defaults', () => {
  it('builds a stale step-up projection and an empty POST body by default', async () => {
    expect(factorsResource([], '1', null).stepUp).toEqual({
      fresh: false,
      freshUntil: null,
    });
    await expect(mfaRequest('POST', LIST).json()).resolves.toEqual({});
  });
});
