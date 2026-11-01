import {
  CMS_SLICE_11_CONFLICT_REASONS,
  CMS_SLICE_11_FORBIDDEN_REASONS,
  CMS_SLICE_11_VALIDATION_REASONS,
  CMS_SLICE_12_OPERATION_REASONS,
  CmsSlice12ReasonCodeSchema,
  cmsSlice12ReasonStatus,
} from '@wejammin/contracts';
import { describe, expect, it } from 'vitest';

import {
  TYPED_CONFLICT_REASONS,
  TYPED_VALIDATION_REASONS,
} from '../cms-editorial/error-vocabulary';
import {
  expectError,
  governedHarness,
  jsonReply,
  sqlRefusal,
  submitRequest,
} from './governed-review-submit.test-support';

const CODES = {
  403: 'GOVERNED_REVIEW_FORBIDDEN',
  409: 'GOVERNED_REVIEW_VERSION_CONFLICT',
  422: 'GOVERNED_REVIEW_VALIDATION_FAILED',
} as const;
const SUBMIT_REASONS: readonly string[] =
  CMS_SLICE_12_OPERATION_REASONS['CMS-03C-06'];

describe('CMS-03C-06 SQL refusal transport (tokens of 20261013300820)', () => {
  it.each([
    ['INVALID_REQUEST', 400, 'INVALID_REQUEST'],
    ['NOT_FOUND', 404, 'GOVERNED_REVIEW_NOT_FOUND'],
    ['IDEMPOTENCY_MISMATCH', 409, CODES[409]],
    ['CONFLICT', 409, CODES[409]],
  ] as const)(
    'maps the producer token %s to %i',
    async (token, status, code) => {
      const harness = governedHarness({ reply: () => sqlRefusal(token) });
      const error = await expectError(
        await harness.send(submitRequest()),
        status,
        code,
      );
      expect(error.details).toEqual({});
    },
  );

  it('answers a hidden and an absent subject identically (404 concealment)', async () => {
    const bodies: string[] = [];
    for (const detail of ['hidden', 'absent']) {
      const harness = governedHarness({
        reply: () => sqlRefusal('NOT_FOUND', detail),
      });
      const response = await harness.send(submitRequest());
      await expectError(response.clone(), 404, 'GOVERNED_REVIEW_NOT_FOUND');
      bodies.push(await response.text());
    }
    expect(bodies[0]).toBe(bodies[1]);
  });

  it('keeps a visible subject without the capability a 403, not a 404', async () => {
    const harness = governedHarness({
      reply: () => sqlRefusal('capability_missing'),
    });
    const error = await expectError(
      await harness.send(submitRequest()),
      403,
      CODES[403],
    );
    expect(error.details).toEqual({ reasonCode: 'capability_missing' });
  });

  it.each(CmsSlice12ReasonCodeSchema.options)(
    'handles reason token %s by the CMS-03C-06 contract list',
    async (token) => {
      // canonical_source_unavailable always names its domain (BE03c 1375).
      const detail =
        token === 'canonical_source_unavailable'
          ? '{"domain":"gear"}'
          : undefined;
      const harness = governedHarness({
        reply: () => sqlRefusal(token, detail),
      });
      const response = await harness.send(submitRequest());
      if (!SUBMIT_REASONS.includes(token)) {
        // A token another operation owns never crosses this boundary.
        await expectError(response, 500, 'INTERNAL_ERROR');
        return;
      }
      const status = cmsSlice12ReasonStatus(token);
      const error = await expectError(response, status, CODES[status]);
      expect(error.details).toMatchObject({ reasonCode: token });
      expect(JSON.stringify(error)).not.toContain('private provider');
    },
  );

  it('carries the canonical domain of canonical_source_unavailable (BE03c 1375, DEC-180 G11)', async () => {
    const withDomain = governedHarness({
      reply: () =>
        sqlRefusal('canonical_source_unavailable', '{"domain":"gear"}'),
    });
    const refusal = await expectError(
      await withDomain.send(submitRequest()),
      422,
      CODES[422],
    );
    expect(refusal.details).toEqual({
      reasonCode: 'canonical_source_unavailable',
      domain: 'gear',
    });
  });

  // BE00 592: a contacted dependency's invalid answer is 502. The contract
  // (refusals.ts) makes `domain` mandatory, so a domain-less refusal is invalid.
  it.each([
    ['prose DETAIL', undefined],
    ['a non-canonical domain', '{"domain":"private SQL"}'],
    ['an empty object', '{}'],
    ['non-JSON text', 'domain: gear'],
    ['a JSON array', '["gear"]'],
    ['a numeric domain', '{"domain":7}'],
  ] as const)(
    'answers canonical_source_unavailable with %s as a local 502',
    async (_name, detail) => {
      const harness = governedHarness({
        reply: () => sqlRefusal('canonical_source_unavailable', detail),
      });
      const error = await expectError(
        await harness.send(submitRequest()),
        502,
        'DEPENDENCY_UNAVAILABLE',
      );
      expect(error.details).not.toHaveProperty('reasonCode');
      expect(error.details).not.toHaveProperty('domain');
    },
  );

  it('answers canonical_source_unavailable with no DETAIL at all as a local 502', async () => {
    const harness = governedHarness({
      reply: () =>
        jsonReply(
          { code: 'P0001', message: 'canonical_source_unavailable' },
          400,
        ),
    });
    await expectError(
      await harness.send(submitRequest()),
      502,
      'DEPENDENCY_UNAVAILABLE',
    );
  });

  it.each(
    [
      ...CMS_SLICE_11_FORBIDDEN_REASONS,
      ...CMS_SLICE_11_CONFLICT_REASONS,
      ...CMS_SLICE_11_VALIDATION_REASONS,
      ...TYPED_CONFLICT_REASONS,
      ...TYPED_VALIDATION_REASONS,
    ].filter((reason) => !SUBMIT_REASONS.includes(reason)),
  )(
    'refuses the foreign editorial reason %s as a scrubbed 500',
    async (token) => {
      const harness = governedHarness({ reply: () => sqlRefusal(token) });
      await expectError(
        await harness.send(submitRequest()),
        500,
        'INTERNAL_ERROR',
      );
    },
  );

  it.each([
    'INTERNAL_ERROR',
    'an unregistered raise',
    'NOT_FOUND because private provider',
    'review_not_found',
    'GOVERNED_REVIEW_NOT_FOUND',
  ])('scrubs the unrecognized or internal token %j', async (token) => {
    const harness = governedHarness({ reply: () => sqlRefusal(token) });
    await expectError(
      await harness.send(submitRequest()),
      500,
      'INTERNAL_ERROR',
    );
  });

  it('adopts a token only from message, never from prose in details', async () => {
    const harness = governedHarness({
      reply: () =>
        jsonReply(
          {
            code: 'P0001',
            message: 'an unregistered raise',
            details: 'capability_missing NOT_FOUND',
          },
          400,
        ),
    });
    await expectError(
      await harness.send(submitRequest()),
      500,
      'INTERNAL_ERROR',
    );
  });

  it('maps a serialization-class CAS refusal to the catalog conflict', async () => {
    const harness = governedHarness({
      reply: () =>
        jsonReply({ code: '40001', message: 'VERSION_MISMATCH' }, 409),
    });
    await expectError(await harness.send(submitRequest()), 409, CODES[409]);
  });
});
