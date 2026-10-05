import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createContentSchemaRegistryDomain,
  type ContentSchemaRegistryPortInput,
  type ContentSchemaRegistryResult,
} from './index';

import {
  expectError,
  makeHarness,
  jsonRequest,
  readRequest,
} from './phase-02-slice-09-adversarial-test-support';
import {
  CMS_ORIGIN,
  BLOCK_ID,
  REQUEST_ID,
  session,
  resource,
  validDraft,
  validActivation,
  ok,
  error,
} from './phase-02-slice-09-test-values';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('S09 adversarial worker recovery', () => {
  it('[P2-S09-AC-217] keeps no Worker replay cache: concurrent same-key commands each reach the RPC and a failed command is retried through it', async () => {
    const harness = makeHarness();
    const dependencies = harness.dependencies;
    let resolveFirst:
      ((value: ContentSchemaRegistryResult<unknown>) => void) | undefined;
    const firstResponse = new Promise<ContentSchemaRegistryResult<unknown>>(
      (resolve) => {
        resolveFirst = resolve;
      },
    );
    const createTypeDraft = vi
      .fn()
      .mockImplementationOnce(() => firstResponse)
      .mockResolvedValueOnce(ok(resource));
    harness.ports.createTypeDraft = createTypeDraft;
    const domain = createContentSchemaRegistryDomain(dependencies);
    const input: ContentSchemaRegistryPortInput = {
      operationId: 'CMS-03A-01',
      requestId: REQUEST_ID,
      request: readRequest(),
      session,
      body: { ...validDraft },
      idempotencyKey: 'same-command-001',
    };
    const first = domain.execute(input);
    const second = domain.execute({ ...input, request: readRequest() });
    await Promise.resolve();
    // BE00: (actor, operation, key) is serialized by PostgreSQL, which waits
    // on the unique row and replays; the Worker coalesces nothing itself.
    expect(createTypeDraft).toHaveBeenCalledTimes(2);
    resolveFirst?.(ok(resource));
    const [firstResult, secondResult] = await Promise.all([first, second]);
    expect(firstResult).toEqual({ ok: true, value: resource });
    expect(secondResult).toEqual(firstResult);

    const retryPort = vi
      .fn()
      .mockResolvedValueOnce(error(503, 'DEPENDENCY_UNAVAILABLE'))
      .mockResolvedValueOnce(ok(resource));
    harness.ports.createTypeDraft = retryPort;
    const retryDomain = createContentSchemaRegistryDomain(dependencies);
    await expect(retryDomain.execute(input)).resolves.toMatchObject({
      ok: false,
      status: 503,
    });
    await expect(retryDomain.execute(input)).resolves.toEqual({
      ok: true,
      value: resource,
    });
    expect(retryPort).toHaveBeenCalledTimes(2);
  });

  it('[P2-S09-AC-217] keeps the release lifecycle route worker-only even when a browser session is otherwise valid', async () => {
    const harness = makeHarness();
    const response = await harness.app.request(
      jsonRequest(
        `/api/v1/cms/blocks/versions/${BLOCK_ID}/lifecycle`,
        validActivation,
        { origin: CMS_ORIGIN },
      ),
    );
    await expectError(response, 403, 'FORBIDDEN');
    expect(harness.verifyRelease).not.toHaveBeenCalled();
    expect(harness.ports.advanceBlockLifecycle).not.toHaveBeenCalled();
  });
});
