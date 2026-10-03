import { afterEach, describe, expect, it, vi } from 'vitest';

import { createContentSchemaRegistryPortRunner } from './runtime-port';
import type {
  ContentSchemaRegistryDependencies,
  ContentSchemaRegistryPortInput,
} from './types';

const input = (
  operationId: ContentSchemaRegistryPortInput['operationId'] = 'CMS-03A-01',
): ContentSchemaRegistryPortInput => ({
  operationId,
  requestId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  request: new Request('https://api.example.test/api/v1/cms/test'),
});

const unavailable = {
  ok: false as const,
  status: 503 as const,
  code: 'DEPENDENCY_UNAVAILABLE',
  message: 'unavailable',
  details: {},
};

const dependencies = (
  ports: Partial<ContentSchemaRegistryDependencies['ports']>,
  deadlineMs = 15_000,
): ContentSchemaRegistryDependencies =>
  ({
    ports: ports as ContentSchemaRegistryDependencies['ports'],
    resolveSession: vi.fn(),
    verifyRelease: vi.fn(),
    rateLimit: vi.fn(),
    humanOrigins: [],
    releaseOrigins: [],
    deadlineMs,
  }) as ContentSchemaRegistryDependencies;

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('content schema registry port runner defensive coverage', () => {
  it('returns unavailable when an operation has no configured port', async () => {
    const result = await createContentSchemaRegistryPortRunner(
      dependencies({}),
    ).run(input());
    expect(result).toMatchObject({
      ok: false,
      status: 503,
      code: 'DEPENDENCY_UNAVAILABLE',
    });
  });

  it('returns a deadline error and aborts a slow port', async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    const slow = vi.fn(
      (_input: ContentSchemaRegistryPortInput, received: AbortSignal) => {
        signal = received;
        return new Promise<never>(() => undefined);
      },
    );
    const pending = createContentSchemaRegistryPortRunner(
      dependencies({ createTypeDraft: slow }, 20),
    ).run(input());
    await vi.advanceTimersByTimeAsync(20);
    await expect(pending).resolves.toMatchObject({
      ok: false,
      status: 504,
      code: 'DEPENDENCY_DEADLINE_EXCEEDED',
    });
    expect(signal?.aborted).toBe(true);
  });

  it('maps an unexpected thrown port to a scrubbed 500, an abort to 504, and cleans up an absent timer', async () => {
    const thrown = vi.fn(async () => {
      throw new Error('persistence unavailable');
    });
    await expect(
      createContentSchemaRegistryPortRunner(
        dependencies({ createTypeDraft: thrown }),
      ).run(input()),
    ).resolves.toEqual({
      ok: false,
      status: 500,
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred.',
      details: {},
    });
    const aborted = vi.fn(async () => {
      throw new DOMException('aborted', 'AbortError');
    });
    await expect(
      createContentSchemaRegistryPortRunner(
        dependencies({ createTypeDraft: aborted }),
      ).run(input()),
    ).resolves.toMatchObject({
      ok: false,
      status: 504,
      code: 'DEPENDENCY_DEADLINE_EXCEEDED',
    });

    vi.stubGlobal('setTimeout', () => undefined);
    await expect(
      createContentSchemaRegistryPortRunner(
        dependencies({ createTypeDraft: vi.fn(async () => unavailable) }),
      ).run(input()),
    ).resolves.toMatchObject(unavailable);
  });
});
