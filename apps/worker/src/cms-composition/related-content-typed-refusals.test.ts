import { describe, expect, it, vi } from 'vitest';

import { createCmsRelatedContentApp } from './related-content-routes';
import {
  dependencies,
  request,
  validResource,
  type CmsRelatedContentPortResult,
} from './related-content-routes.test-support';
import { PARTY_ID, USER_ID } from '../cms-editorial-production.test-support';

const refusal = (
  status: 403 | 409 | 422,
  details: Record<string, unknown>,
): CmsRelatedContentPortResult => ({
  ok: false,
  status,
  code: 'PORT_CODE',
  message: 'port message',
  details,
});

const answer = async (port: CmsRelatedContentPortResult) => {
  const response = await createCmsRelatedContentApp(
    dependencies({ actRelatedContent: async () => port }),
  ).request(request());
  return {
    status: response.status,
    body: (await response.json()) as {
      code: string;
      details: Record<string, unknown>;
    },
  };
};

describe('CMS-03C-05 typed refusals (BE03c 1304, 1380-1383)', () => {
  it('admits a session holding only cms.editor: author or editor edits related content', async () => {
    const actRelatedContent = vi.fn(
      async (): Promise<CmsRelatedContentPortResult> => ({
        ok: true,
        value: validResource(),
      }),
    );
    const response = await createCmsRelatedContentApp(
      dependencies({
        actRelatedContent,
        resolveSession: async () => ({
          ok: true,
          value: {
            userId: USER_ID,
            actingPartyId: PARTY_ID,
            capabilities: ['cms.editor'],
            mfaFresh: true,
          },
        }),
      }),
    ).request(request());
    expect(response.status).toBe(201);
    expect(actRelatedContent).toHaveBeenCalledTimes(1);
  });

  it('publishes related_target_ineligible with the offending row pointers as one uniform 422', async () => {
    const { status, body } = await answer(
      refusal(422, {
        reasonCode: 'related_target_ineligible',
        violations: [
          { path: '/pins/1', code: 'related_target_ineligible' },
          { path: '/exclusions/0', code: 'related_target_ineligible' },
        ],
      }),
    );
    expect(status).toBe(422);
    expect(body.code).toBe('RELATED_CONTENT_VALIDATION_FAILED');
    expect(body.details).toEqual({
      reasonCode: 'related_target_ineligible',
      violations: [
        {
          path: '/pins/1',
          code: 'related_target_ineligible',
          message: 'The value is invalid.',
        },
        {
          path: '/exclusions/0',
          code: 'related_target_ineligible',
          message: 'The value is invalid.',
        },
      ],
    });
  });

  it('publishes derived_rule_unknown at its member pointer', async () => {
    const { status, body } = await answer(
      refusal(422, {
        reasonCode: 'derived_rule_unknown',
        violations: [
          { path: '/derivedRule/key', code: 'derived_rule_unknown' },
        ],
      }),
    );
    expect(status).toBe(422);
    expect(body.details).toMatchObject({
      reasonCode: 'derived_rule_unknown',
      violations: [{ path: '/derivedRule/key' }],
    });
  });

  it('publishes capability_missing on the 403 of a visible source without edit', async () => {
    const { status, body } = await answer(
      refusal(403, { reasonCode: 'capability_missing' }),
    );
    expect(status).toBe(403);
    expect(body.code).toBe('RELATED_CONTENT_FORBIDDEN');
    expect(body.details).toEqual({ reasonCode: 'capability_missing' });
  });

  it('keeps each token on its one status and drops tokens of other operations', async () => {
    const cases: Array<[403 | 409 | 422, string]> = [
      [409, 'related_target_ineligible'],
      [403, 'related_target_ineligible'],
      [422, 'capability_missing'],
      [422, 'pattern_cycle'],
      [409, 'locale_limit_reached'],
      [422, 'not_a_registered_token'],
      [422, 'RELATED_TARGET_INELIGIBLE'],
    ];
    for (const [status, reasonCode] of cases) {
      const { body } = await answer(refusal(status, { reasonCode }));
      expect(body.details, `${status} ${reasonCode}`).not.toHaveProperty(
        'reasonCode',
      );
    }
  });

  it('carries only the reason and pointers: nothing else of a refusal payload reaches the browser', async () => {
    const { body } = await answer(
      refusal(422, {
        reasonCode: 'related_target_ineligible',
        violations: [{ path: '/pins/0', code: 'related_target_ineligible' }],
        targetEntryId: '20000000-0000-4000-8000-000000000002',
        reason: 'archived',
        owner: PARTY_ID,
      }),
    );
    expect(Object.keys(body.details).sort()).toEqual([
      'reasonCode',
      'violations',
    ]);
    expect(JSON.stringify(body)).not.toContain('archived');
    expect(JSON.stringify(body)).not.toContain('20000000');
  });

  it('keeps stale-version details on the 409 and no reason', async () => {
    const { status, body } = await answer(
      refusal(409, { expectedVersion: '1', currentVersion: '3' }),
    );
    expect(status).toBe(409);
    expect(body.code).toBe('RELATED_CONTENT_VERSION_CONFLICT');
    expect(body.details).toEqual({ expectedVersion: '1', currentVersion: '3' });
  });
});
