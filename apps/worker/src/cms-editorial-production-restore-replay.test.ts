import { describe, expect, it, vi } from 'vitest';

import {
  baseRevisionId,
  resolvedRevisionId,
  restoreVerification,
  resource,
} from './cms-editorial/route-fixtures.test-support';
import { json } from './cms-editorial-production.test-support';
import {
  restoreRequest,
  wiredApp,
} from './cms-editorial-production-app.test-support';

/**
 * A restore answered from an exact-key replay (the database marks it with
 * `x-cms-idempotent-replay: true`) is the same 201 restore: the marker is never
 * forwarded and no second revision is counted. Only the exact value `true`
 * marks a replay.
 */

const envelope = () => ({
  resource: {
    ...resource(resolvedRevisionId, '3', '3'),
    parentRevisionIds: [baseRevisionId],
  },
  restoreVerification,
});

describe('restore idempotent replay', () => {
  it('answers an exact-key replay as the same 201 restore, never forwarding the marker, and counts no second revision', async () => {
    const events: Array<{ metrics?: Record<string, number> }> = [];
    const fetchImpl = vi.fn(async () =>
      json(envelope(), 200, { 'x-cms-idempotent-replay': 'true' }),
    );
    const response = await restoreRequest(
      wiredApp(fetchImpl as unknown as typeof fetch, {
        telemetry: async (event: { metrics?: Record<string, number> }) => {
          events.push(event);
        },
      }),
    );
    expect(response.status).toBe(201);
    expect(response.headers.get('x-cms-idempotent-replay')).toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(events[0]?.metrics).not.toHaveProperty('cms_revision_created_total');
  });

  it('only the exact value true marks a replay: a restore is otherwise a new revision', async () => {
    const events: Array<{ metrics?: Record<string, number> }> = [];
    const fetchImpl = vi.fn(async () =>
      json(envelope(), 200, { 'x-cms-idempotent-replay': 'TRUE' }),
    );
    await restoreRequest(
      wiredApp(fetchImpl as unknown as typeof fetch, {
        telemetry: async (event: { metrics?: Record<string, number> }) => {
          events.push(event);
        },
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(events[0]?.metrics).toHaveProperty('cms_revision_created_total');
  });
});
