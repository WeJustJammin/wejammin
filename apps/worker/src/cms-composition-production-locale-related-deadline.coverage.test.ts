import { afterEach, describe, expect, it, vi } from 'vitest';

import { createProductionCmsLocaleDependencies } from './cms-composition-production-locale';
import { readAs as relatedReadAs } from './cms-composition-production-related-read.test-support';
import {
  act as relatedAct,
  json as relatedJson,
  portInput as relatedPortInput,
  resource as relatedResource,
} from './cms-composition-production-related.test-support';
import { createProductionCmsRelatedContentDependencies } from './cms-composition-production-related';
import {
  localeReadInput,
  signal,
} from './cms-composition-production-locale-related.coverage.test-support';
import { READ_PATH } from './cms-composition/locale-read.test-support';
import { environment } from './cms-editorial-production.test-support';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/*
 * One total deadline covers the headers and the body (BE03b transport): a body that stalls past it is a 504 with
 * `Retry-After: 15`, whether the stalled body was the RPC's error payload or its answer.
 */
describe('the deadline covers a stalled response body', () => {
  const DEADLINE_MS = 50;
  const stalled = (status: number): Response =>
    new Response(
      new ReadableStream({ pull: () => new Promise<void>(() => undefined) }),
      { status, headers: { 'content-type': 'application/json' } },
    );
  const stalledFetch = (status: number) =>
    (async () => stalled(status)) as typeof fetch;
  const runs = async <T>(start: () => Promise<T>): Promise<T> => {
    vi.useFakeTimers();
    const pending = start();
    await vi.advanceTimersByTimeAsync(DEADLINE_MS + 1);
    return pending;
  };
  const localeRead = (fetchImpl: typeof fetch) =>
    createProductionCmsLocaleDependencies({
      environment,
      fetchImpl,
      deadlineMs: DEADLINE_MS,
      resolveSession: async () => ({
        ok: true,
        value: localeReadInput(new Request('https://api.example.test/'))
          .session,
      }),
    }).readLocaleVariant(
      localeReadInput(new Request(`https://api.example.test${READ_PATH}`)),
      signal(),
    );

  it.each([
    ['an error payload', 400],
    ['an answer', 200],
  ])(
    'cmsLocaleVariantRead answers 504 DEADLINE when %s stalls',
    async (_label, status) => {
      expect(await runs(() => localeRead(stalledFetch(status)))).toMatchObject({
        ok: false,
        status: 504,
        code: 'DEADLINE',
        retryAfterSeconds: 15,
      });
    },
  );

  it.each([
    ['an error payload', 400],
    ['an answer', 200],
  ])(
    'cmsRelatedContentRead answers 504 with Retry-After 15 when %s stalls',
    async (_label, status) => {
      expect(
        await runs(() =>
          relatedReadAs(stalledFetch(status), {}, { deadlineMs: DEADLINE_MS }),
        ),
      ).toMatchObject({ ok: false, status: 504, retryAfterSeconds: 15 });
    },
  );

  it.each([
    ['an error payload', 400],
    ['an answer', 200],
  ])(
    'CMS-03C-05 answers 504 with Retry-After 15 when %s stalls',
    async (_label, status) => {
      expect(
        await runs(() =>
          createProductionCmsRelatedContentDependencies({
            environment,
            fetchImpl: stalledFetch(status),
            deadlineMs: DEADLINE_MS,
            resolveSession: async () => ({
              ok: true,
              value: relatedPortInput().session,
            }),
          }).actRelatedContent(relatedPortInput(), signal()),
        ),
      ).toMatchObject({ ok: false, status: 504, retryAfterSeconds: 15 });
    },
  );
});

describe('CMS-03C-05 transport edges', () => {
  it('answers 502 for a 200 that is not JSON, without reading it as a resource', async () => {
    const result = await relatedAct(
      (async () =>
        new Response('<html>', {
          status: 200,
          headers: { 'content-type': 'text/html' },
        })) as typeof fetch,
    );
    expect(result).toMatchObject({
      ok: false,
      status: 502,
      code: 'DEPENDENCY_UNAVAILABLE',
    });
  });

  it('uses the platform fetch when no transport is injected', async () => {
    const platform = vi.fn(async () => relatedJson(relatedResource));
    vi.stubGlobal('fetch', platform);
    const dependencies = createProductionCmsRelatedContentDependencies({
      environment,
      resolveSession: async () => ({
        ok: true,
        value: relatedPortInput().session,
      }),
    });
    const result = await dependencies.actRelatedContent(
      relatedPortInput(),
      signal(),
    );
    expect(result).toMatchObject({ ok: true });
    expect(platform).toHaveBeenCalledTimes(1);
  });
});
