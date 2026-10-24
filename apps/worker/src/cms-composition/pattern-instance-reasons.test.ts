import { CmsCompositionRefusalDetailsSchema } from '@wejammin/contracts';
import { describe, expect, it } from 'vitest';

import { failure } from './pattern-instance-contracts';
import { createCmsPatternInstanceApp } from './pattern-instance-routes';
import {
  httpPlacementDependencies,
  httpPlacementRequest,
} from './pattern-placement-dependencies.test-support';

/**
 * CMS-03C-02 wire answer to a typed port refusal (BE03c 1304): exactly one lowercase `reasonCode` of the
 * operation's own list, on the one status the token keeps, and no other member (DEC-186 for the digest).
 */
const answer = async (port: unknown) => {
  const response = await createCmsPatternInstanceApp(
    httpPlacementDependencies(async () => port),
  ).request(httpPlacementRequest());
  return {
    status: response.status,
    body: (await response.json()) as {
      code: string;
      details: Record<string, unknown>;
    },
  };
};

const TYPED = [
  ['capability_missing', 403, 'COMPOSITION_FORBIDDEN'],
  ['revision_not_editable', 409, 'COMPOSITION_VERSION_CONFLICT'],
  ['pattern_cycle', 409, 'COMPOSITION_VERSION_CONFLICT'],
  ['block_registry_digest_mismatch', 409, 'COMPOSITION_VERSION_CONFLICT'],
  ['pattern_version_not_active', 422, 'COMPOSITION_VALIDATION_FAILED'],
  ['pattern_incompatible', 422, 'COMPOSITION_VALIDATION_FAILED'],
  ['nested_pattern_not_active', 422, 'COMPOSITION_VALIDATION_FAILED'],
] as const;

describe('CMS-03C-02 route typed Slice 12 refusals', () => {
  it.each(TYPED)(
    'publishes %s as %i %s with exactly its reasonCode',
    async (token, status, code) => {
      const { status: got, body } = await answer(
        failure(status, {
          reasonCode: token,
          expectedVersion: '1',
          currentVersion: '2',
          secret: 'private',
        }),
      );
      expect(got).toBe(status);
      expect(body.code).toBe(code);
      expect(body.details).toEqual({ reasonCode: token });
      expect(
        CmsCompositionRefusalDetailsSchema.safeParse(body.details).success,
      ).toBe(true);
    },
  );

  it.each(['/roots', '/patternVersion'])(
    'DEC-210 publishes block_rules_violated as 422 with its reasonCode and the one bounded violation %s',
    async (pointer) => {
      const violation = {
        path: pointer,
        code: 'block_rules_violated',
        message: 'The value is invalid.',
      };
      const { status, body } = await answer(
        failure(422, {
          reasonCode: 'block_rules_violated',
          violations: [violation, { ...violation, path: '/secret-pointer' }],
          secret: 'private',
        }),
      );
      expect(status).toBe(422);
      expect(body.code).toBe('COMPOSITION_VALIDATION_FAILED');
      expect(body.details).toEqual({
        reasonCode: 'block_rules_violated',
        violations: [violation],
      });
      expect(
        CmsCompositionRefusalDetailsSchema.safeParse(body.details).success,
      ).toBe(true);
    },
  );

  it('drops a token on a status other than its own, and a token this operation does not publish', async () => {
    for (const [status, token] of [
      [422, 'revision_not_editable'],
      [409, 'pattern_version_not_active'],
      [403, 'revision_not_editable'],
      [409, 'review_not_open'],
      [409, 'pattern_depth_exceeded'],
      [422, 'pattern_nodes_exceeded'],
      [409, 'not_a_token'],
    ] as const) {
      const { body } = await answer(failure(status, { reasonCode: token }));
      expect(body.details).not.toHaveProperty('reasonCode');
    }
  });

  it('answers its own capability refusal with the 03c token capability_missing (BE03c 1304), not CAPABILITY_REQUIRED', async () => {
    const response = await createCmsPatternInstanceApp(
      httpPlacementDependencies(
        async () => {
          throw new Error('the port must not run without a capability');
        },
        {
          resolveSession: async () => ({
            ok: true,
            value: {
              userId: 'd2000000-0000-4000-8000-000000000001',
              actingPartyId: 'd2000000-0000-4000-8000-000000000002',
              capabilities: [],
              mfaFresh: true,
            },
          }),
        },
      ),
    ).request(httpPlacementRequest());
    const body = (await response.json()) as {
      code: string;
      details: Record<string, unknown>;
    };
    expect(response.status).toBe(403);
    expect(body.code).toBe('COMPOSITION_FORBIDDEN');
    expect(body.details).toEqual({ reasonCode: 'capability_missing' });
    expect(
      CmsCompositionRefusalDetailsSchema.safeParse(body.details).success,
    ).toBe(true);
  });

  it.each([
    ['the pre-contract upper-case token', 'CAPABILITY_REQUIRED'],
    ['a 403 token this operation does not publish', 'separation_of_duties'],
    ['no reason', undefined],
  ])(
    'relays {} for a 403 from the session port carrying %s (review-hardening-3 finding 2)',
    async (_label, reasonCode) => {
      const response = await createCmsPatternInstanceApp(
        httpPlacementDependencies(
          async () => {
            throw new Error('the port must not run without a session');
          },
          {
            resolveSession: async () => ({
              ok: false,
              status: 403,
              code: 'PORT_CODE',
              message: 'private provider text must not escape',
              details: {
                ...(reasonCode === undefined ? {} : { reasonCode }),
                secret: 'private',
              },
            }),
          },
        ),
      ).request(httpPlacementRequest());
      const body = (await response.json()) as {
        details: Record<string, unknown>;
      };
      expect(response.status).toBe(403);
      expect(body.details).toEqual({});
    },
  );

  it('relays the depth/nodes 422 violations and nothing else', async () => {
    const { status, body } = await answer(
      failure(422, {
        violations: [
          { path: '/patternId', code: 'invalid', message: 'private' },
        ],
        secret: 'private',
      }),
    );
    expect(status).toBe(422);
    expect(body.details).toEqual({
      violations: [
        {
          path: '/patternId',
          code: 'invalid',
          message: 'The value is invalid.',
        },
      ],
    });
  });

  it('keeps the untyped stale-CAS 409 as its version pair', async () => {
    const { status, body } = await answer(
      failure(409, { expectedVersion: '1', currentVersion: '4', secret: 'x' }),
    );
    expect(status).toBe(409);
    expect(body.details).toEqual({ expectedVersion: '1', currentVersion: '4' });
  });
});
