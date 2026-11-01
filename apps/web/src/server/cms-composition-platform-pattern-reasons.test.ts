import { CmsCompositionRefusalDetailsSchema } from '@wejammin/contracts';
import { describe, expect, it } from 'vitest';

import { forwardCmsPatternInstanceMutation } from './cms-composition-platform-pattern';
import {
  binding,
  error,
  request,
} from './cms-composition-platform-pattern.test-support';

/**
 * CMS-03C-02 first-party relay of the Worker's typed refusals (BE03c 1304, FE03 1112): the browser form
 * must tell `revision_not_editable` (409), `pattern_version_not_active` and `pattern_incompatible` (422)
 * apart, so exactly one `reasonCode` of the operation's own list survives, on the one status the token keeps.
 */
const relay = async (
  status: number,
  code: string,
  details: Record<string, unknown>,
) => {
  const response = await forwardCmsPatternInstanceMutation(
    request(),
    binding(error(status, code, details)),
  );
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

describe('CMS-03C-02 relay of typed Slice 12 refusals', () => {
  it.each(TYPED)(
    'relays %s as %i %s with exactly its reasonCode',
    async (token, status, code) => {
      const { status: got, body } = await relay(status, code, {
        reasonCode: token,
        expectedVersion: '1',
        currentVersion: '2',
        secret: 'private',
      });
      expect(got).toBe(status);
      expect(body.details).toEqual({ reasonCode: token });
      expect(
        CmsCompositionRefusalDetailsSchema.safeParse(body.details).success,
      ).toBe(true);
    },
  );

  it.each(['/roots', '/patternVersion'])(
    'DEC-210 relays block_rules_violated with its one bounded violation %s and nothing else',
    async (path) => {
      const { status, body } = await relay(
        422,
        'COMPOSITION_VALIDATION_FAILED',
        {
          reasonCode: 'block_rules_violated',
          violations: [
            { path, code: 'block_rules_violated', message: 'private text' },
            { path: '/secret-pointer', code: 'x', message: 'x' },
          ],
          secret: 'private',
        },
      );
      expect(status).toBe(422);
      expect(body.details).toEqual({
        reasonCode: 'block_rules_violated',
        violations: [
          {
            path,
            code: 'block_rules_violated',
            message: 'The value is invalid.',
          },
        ],
      });
      expect(
        CmsCompositionRefusalDetailsSchema.safeParse(body.details).success,
      ).toBe(true);
    },
  );

  it('drops a token on another status, one this operation does not publish, and the pre-contract CAPABILITY_REQUIRED', async () => {
    for (const [status, code, token] of [
      [422, 'COMPOSITION_VALIDATION_FAILED', 'revision_not_editable'],
      [409, 'COMPOSITION_VERSION_CONFLICT', 'pattern_version_not_active'],
      [403, 'COMPOSITION_FORBIDDEN', 'revision_not_editable'],
      [409, 'COMPOSITION_VERSION_CONFLICT', 'review_not_open'],
      [422, 'COMPOSITION_VALIDATION_FAILED', 'pattern_depth_exceeded'],
      [422, 'COMPOSITION_VALIDATION_FAILED', 'pattern_nodes_exceeded'],
      [403, 'COMPOSITION_FORBIDDEN', 'CAPABILITY_REQUIRED'],
      [403, 'COMPOSITION_FORBIDDEN', 'Capability_Missing'],
      [409, 'COMPOSITION_VERSION_CONFLICT', 'not_a_token'],
    ] as const) {
      const { body } = await relay(status, code, { reasonCode: token });
      expect(body.details).not.toHaveProperty('reasonCode');
    }
  });

  it('keeps the untyped stale-CAS 409 as its version pair only', async () => {
    const { body } = await relay(409, 'COMPOSITION_VERSION_CONFLICT', {
      expectedVersion: '1',
      currentVersion: '4',
      secret: 'x',
    });
    expect(body.details).toEqual({ expectedVersion: '1', currentVersion: '4' });
  });

  it('relays the bounded RFC 6901 violations of a 422 and nothing else (DEC-186 /slotPath, depth/nodes /patternId)', async () => {
    const { status, body } = await relay(422, 'COMPOSITION_VALIDATION_FAILED', {
      secret: 'private',
      violations: [
        { path: '/slotPath', code: 'invalid', message: 'private text' },
        { path: '/patternId', code: 'invalid', message: 'x' },
        { path: 'not-a-pointer', code: 'invalid', message: 'x' },
        { path: '/overrides', code: 'Bad Code', message: 'x' },
        'junk',
      ],
    });
    expect(status).toBe(422);
    expect(body.details).toEqual({
      violations: [
        {
          path: '/slotPath',
          code: 'invalid',
          message: 'The value is invalid.',
        },
        {
          path: '/patternId',
          code: 'invalid',
          message: 'The value is invalid.',
        },
      ],
    });
  });

  it('caps relayed violations at 50', async () => {
    const { body } = await relay(422, 'COMPOSITION_VALIDATION_FAILED', {
      violations: Array.from({ length: 60 }, (_, index) => ({
        path: `/overrides/k${index}`,
        code: 'invalid',
        message: 'x',
      })),
    });
    expect((body.details.violations as unknown[]).length).toBe(50);
  });
});
