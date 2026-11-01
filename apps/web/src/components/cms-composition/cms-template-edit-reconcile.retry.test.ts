import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { loadCmsValidators } from '../../lib/cms-contract-validators';
import { readLatestCmsTemplateVersion } from './cms-template-edit-reconcile';

/**
 * FE03 "Network and retry contract" (:1172-1173) for the template reconcile read (the latest
 * version after a conflict or an unknown outcome): a declared-retryable 502/503/504 is retried
 * twice (250 ms, 750 ms) before the read is unavailable; a 429 reports the wait the server stated.
 */
const TYPE_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132da';
const detail = {
  id: '018f0c45-73fe-7dc2-9c09-68f7ecf132db',
  version: '3',
  templateVersion: 3,
  contentHash: 'a'.repeat(64),
  createdAt: '2026-09-27T12:00:00.000Z',
  updatedAt: '2026-09-27T13:00:00.000Z',
  state: 'draft',
  templateId: '90000000-0000-4000-8000-000000000009',
  templateKey: 'release-note',
  compatibleTypeIds: [TYPE_ID],
  reservedRegions: ['header', 'now', 'record', 'detail', 'provenance'],
  blockRegistryDigest: 'a'.repeat(64),
  slots: [],
  bindings: {},
  locale: 'en-US',
  audience: 'public',
};

const failure = (
  status: number,
  details: Record<string, unknown>,
  headers: Record<string, string> = {},
): Response =>
  Response.json(
    {
      code: status === 429 ? 'RATE_LIMITED' : 'DEPENDENCY_UNAVAILABLE',
      message: 'Safe message',
      requestId: '0195b6f0-0000-7000-8000-000000000001',
      details,
    },
    { status, headers },
  );
const declared = (status: number): Response =>
  failure(status, { dependencyClass: 'cms_composition', retryable: true });
const served = (): Response =>
  Response.json(detail, { status: 200, headers: { etag: '"3"' } });

beforeAll(async () => {
  await loadCmsValidators();
});
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('readLatestCmsTemplateVersion retry (FE03 :1173)', () => {
  it.each([502, 503, 504])(
    'retries a declared-retryable %i after 250 ms, then 750 ms, and uses the version that answers',
    async (status) => {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(declared(status))
        .mockResolvedValueOnce(declared(status))
        .mockResolvedValueOnce(served());
      const pending = readLatestCmsTemplateVersion('release-note', fetcher);
      await vi.advanceTimersByTimeAsync(249);
      expect(fetcher).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      expect(fetcher).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(749);
      expect(fetcher).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(1);
      expect((await pending).kind).toBe('loaded');
      expect(fetcher).toHaveBeenCalledTimes(3);
    },
  );

  it('is unavailable after the second retry still answers a declared 503', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => declared(503));
    const pending = readLatestCmsTemplateVersion('release-note', fetcher);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await pending).toEqual({ kind: 'unavailable' });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it.each([
    ['a 500', failure(500, { retryable: true })],
    ['a 503 that does not declare a retry safe', failure(503, {})],
    ['a 502 that declares retryable false', failure(502, { retryable: false })],
    ['a 504 with no ApiError body', new Response('down', { status: 504 })],
  ])('does not retry %s', async (_case, response) => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => response.clone());
    const pending = readLatestCmsTemplateVersion('release-note', fetcher);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await pending).toEqual({ kind: 'unavailable' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('does not retry a transport loss', async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new Error('x'));
    const pending = readLatestCmsTemplateVersion('release-note', fetcher);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await pending).toEqual({ kind: 'unavailable' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

describe('readLatestCmsTemplateVersion 429 (FE03 :1172)', () => {
  it('reports the stated wait and does not retry', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async () =>
        failure(429, { retryAfterSeconds: 7 }, { 'retry-after': '7' }),
      );
    const pending = readLatestCmsTemplateVersion('release-note', fetcher);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await pending).toEqual({
      kind: 'rejected',
      status: 429,
      retryAfterSeconds: 7,
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('reads the wait from the body when the header is absent', async () => {
    const result = await readLatestCmsTemplateVersion(
      'release-note',
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(failure(429, { retryAfterSeconds: 12 })),
    );
    expect(result).toEqual({
      kind: 'rejected',
      status: 429,
      retryAfterSeconds: 12,
    });
  });

  it('states no wait when none is usable', async () => {
    const result = await readLatestCmsTemplateVersion(
      'release-note',
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(failure(429, {}, { 'retry-after': '0' })),
    );
    expect(result).toEqual({ kind: 'rejected', status: 429 });
  });

  it('adds no wait member to another refusal', async () => {
    const result = await readLatestCmsTemplateVersion(
      'release-note',
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          failure(403, { retryAfterSeconds: 9 }, { 'retry-after': '9' }),
        ),
    );
    expect(result).toEqual({ kind: 'rejected', status: 403 });
  });
});
