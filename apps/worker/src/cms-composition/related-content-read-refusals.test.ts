import { ApiErrorSchema } from '@wejammin/contracts';
import { describe, expect, it, vi } from 'vitest';

import {
  ENTRY_ID,
  readRequest,
  ruleRead,
  storedRule,
} from './related-content-read.test-support';
import {
  createCmsRelatedContentApp,
  type CmsRelatedContentError,
  type CmsRelatedContentReadInput,
} from './related-content-routes';
import { dependencies } from './related-content-routes.test-support';

type Port = (
  input: CmsRelatedContentReadInput,
  signal: AbortSignal,
) => Promise<never>;

const failing = (
  status: CmsRelatedContentError['status'],
  details?: Record<string, unknown>,
): Port =>
  (async () => ({
    ok: false,
    status,
    code: 'ANY',
    message: 'private provider text',
    ...(details === undefined ? {} : { details }),
  })) as unknown as Port;

describe('cmsRelatedContentRead port refusals (BE03c error matrix and catalog)', () => {
  const mapped: ReadonlyArray<
    [
      number,
      string,
      Record<string, unknown> | undefined,
      Record<string, unknown>,
    ]
  > = [
    [400, 'INVALID_REQUEST', undefined, {}],
    [401, 'UNAUTHENTICATED', undefined, { recoveryAction: 'reauthenticate' }],
    [
      403,
      'RELATED_CONTENT_FORBIDDEN',
      { reasonCode: 'capability_missing' },
      { reasonCode: 'capability_missing' },
    ],
    [404, 'RELATED_CONTENT_NOT_FOUND', { leaked: 'private entry title' }, {}],
    [500, 'INTERNAL_ERROR', { cause: 'sql' }, {}],
  ];
  for (const [status, code, source, details] of mapped)
    it(`relays ${status} as ${code} with bounded details`, async () => {
      const response = await createCmsRelatedContentApp(
        dependencies({ readRelatedContent: failing(status as never, source) }),
      ).request(readRequest());
      expect(response.status).toBe(status);
      const error = ApiErrorSchema.parse(await response.json());
      expect(error.code).toBe(code);
      expect(error.message).toBe(
        `${code}: related-content operation rejected or unavailable.`,
      );
      expect(error.details).toEqual(details);
    });

  it('drops a 403 token the read may not publish, and any other member', async () => {
    for (const source of [
      { reasonCode: 'related_target_ineligible' },
      { reasonCode: 'CAPABILITY_REQUIRED' },
      { reasonCode: 'capability_missing', policy: 'secret' },
      undefined,
    ]) {
      const response = await createCmsRelatedContentApp(
        dependencies({ readRelatedContent: failing(403, source) }),
      ).request(readRequest());
      const details = ApiErrorSchema.parse(await response.json()).details;
      expect(JSON.stringify(details), JSON.stringify(source)).toBe(
        source?.reasonCode === 'capability_missing'
          ? '{"reasonCode":"capability_missing"}'
          : '{}',
      );
    }
  });

  it('folds a 409 or 422 from the port (not declared for a bounded read) into a scrubbed 500', async () => {
    for (const status of [409, 422] as const) {
      const response = await createCmsRelatedContentApp(
        dependencies({
          readRelatedContent: failing(status, {
            currentVersion: '9',
            violations: [{ path: '/entryId', code: 'x' }],
            reasonCode: 'related_target_ineligible',
          }),
        }),
      ).request(readRequest());
      expect(response.status, String(status)).toBe(500);
      const error = ApiErrorSchema.parse(await response.json());
      expect(error.code).toBe('INTERNAL_ERROR');
      expect(error.details).toEqual({});
    }
  });

  it('relays dependency statuses with the retry hint and Retry-After', async () => {
    for (const status of [502, 503, 504] as const) {
      const response = await createCmsRelatedContentApp(
        dependencies({ readRelatedContent: failing(status) }),
      ).request(readRequest());
      expect(response.status).toBe(status);
      expect(ApiErrorSchema.parse(await response.json()).details).toEqual({
        dependencyClass: 'cms_composition',
        retryable: true,
      });
    }
    const response = await createCmsRelatedContentApp(
      dependencies({
        readRelatedContent: (async () => ({
          ok: false,
          status: 503,
          code: 'X',
          message: 'm',
          retryAfterSeconds: 15,
        })) as unknown as Port,
      }),
    ).request(readRequest());
    expect(response.headers.get('retry-after')).toBe('15');
  });

  it('is 503 when the port throws and 502 when it breaks the envelope', async () => {
    const thrown = await createCmsRelatedContentApp(
      dependencies({
        readRelatedContent: async () => {
          throw new Error('socket');
        },
      }),
    ).request(readRequest());
    expect(thrown.status).toBe(503);
    expect(thrown.headers.get('retry-after')).toBe('15');
    const broken = await createCmsRelatedContentApp(
      dependencies({
        readRelatedContent: (async () => ({ ok: true })) as unknown as Port,
      }),
    ).request(readRequest());
    expect(broken.status).toBe(502);
  });
});

describe('cmsRelatedContentRead response contract', () => {
  const answers: ReadonlyArray<[string, unknown]> = [
    ['a bare resource instead of the read', storedRule()],
    ['a read without the rule member', {}],
    ['an extra member beside rule', { ...ruleRead(), etag: '"2"' }],
    [
      'a rule for another source entry',
      ruleRead(
        storedRule({ sourceEntryId: '20000000-0000-4000-8000-000000000002' }),
      ),
    ],
    [
      'a revoked rule (a read answers null instead)',
      ruleRead(storedRule({ state: 'revoked' })),
    ],
    [
      'a rule with private members',
      { rule: { ...storedRule(), ownerId: ENTRY_ID } },
    ],
    [
      'a rule with duplicate pins',
      ruleRead(storedRule({ pins: [ENTRY_ID, ENTRY_ID] })),
    ],
    [
      'a rule with a pin that is also an exclusion',
      ruleRead(
        storedRule({
          pins: ['20000000-0000-4000-8000-000000000002'],
          exclusions: ['20000000-0000-4000-8000-000000000002'],
        }),
      ),
    ],
  ];
  for (const [name, value] of answers)
    it(`is 502 for ${name}`, async () => {
      const response = await createCmsRelatedContentApp(
        dependencies({
          readRelatedContent: (async () => ({
            ok: true,
            value,
          })) as unknown as Port,
        }),
      ).request(readRequest());
      expect(response.status).toBe(502);
      expect(ApiErrorSchema.parse(await response.json()).code).toBe(
        'DEPENDENCY_UNAVAILABLE',
      );
    });
});

describe('cmsRelatedContentRead deadline', () => {
  it('aborts the port and answers 504 at 8,000 ms (the Tier 1 read ceiling)', async () => {
    vi.useFakeTimers();
    try {
      let aborted = false;
      const response = createCmsRelatedContentApp(
        dependencies({
          readRelatedContent: (_input, signal) =>
            new Promise(() =>
              signal.addEventListener('abort', () => {
                aborted = true;
              }),
            ),
        }),
      ).request(readRequest());
      await vi.advanceTimersByTimeAsync(7_999);
      expect(aborted).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      expect((await response).status).toBe(504);
      expect(aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
