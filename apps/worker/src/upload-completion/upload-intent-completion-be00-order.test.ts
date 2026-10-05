import { afterEach, describe, expect, it, vi } from 'vitest';

import type { UploadCompletionPorts } from '@wejammin/application';
import {
  createHarness,
  makeRouteDependencies,
  requestBody,
  requestFor,
} from './upload-intent-completion.test-support';

afterEach(() => {
  vi.restoreAllMocks();
});

const readBody = async (response: Response): Promise<{ code?: string }> =>
  (await response.json()) as { code?: string };

describe('upload completion BE00 order: body read (step 2) and header validation (step 8)', () => {
  it('answers a body that is not JSON with 400 INVALID_REQUEST before the session is resolved', async () => {
    const route = makeRouteDependencies();
    const request = new Request(requestFor().url, {
      body: '{not json',
      headers: requestFor().headers,
      method: 'POST',
    });

    const response = await createHarness(route).request(request);

    expect(response.status).toBe(400);
    expect((await readBody(response)).code).toBe('INVALID_REQUEST');
    expect(route.resolveSession).not.toHaveBeenCalled();
    expect(route.rateLimit).not.toHaveBeenCalled();
  });

  it('refuses a missing If-Match only after quota, with 400 INVALID_REQUEST and no port call', async () => {
    const route = makeRouteDependencies();

    const response = await createHarness(route).request(
      requestFor(requestBody, { 'if-match': '' }),
    );

    expect(response.status).toBe(400);
    expect((await readBody(response)).code).toBe('INVALID_REQUEST');
    expect(route.rateLimit).toHaveBeenCalledTimes(1);
    expect(
      (route.ports as UploadCompletionPorts).persistence.readIntent,
    ).not.toHaveBeenCalled();
  });
});
