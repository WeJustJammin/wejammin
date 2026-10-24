import type { createPatternUpdateHarness } from './pattern-update-routes.test-support';
import { acceptBody, PU_UPDATE_PATH } from './pattern-update.test-support';

export type Harness = ReturnType<typeof createPatternUpdateHarness>;

export const KEY = 'pattern-update-0001';
export const post = (
  harness: Harness,
  options: {
    body?: unknown;
    headers?: Record<string, string>;
    path?: string;
    raw?: string;
  } = {},
) =>
  harness.request(options.path ?? PU_UPDATE_PATH, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'idempotency-key': KEY,
      'if-match': '"7"',
      ...options.headers,
    },
    body: options.raw ?? JSON.stringify(options.body ?? acceptBody(1)),
  });
