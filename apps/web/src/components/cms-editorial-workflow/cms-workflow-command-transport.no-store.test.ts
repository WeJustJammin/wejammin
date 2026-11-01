// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';

import {
  COMMAND_CASES,
  CSRF,
  KEY,
  upstreamSuccess,
} from '../../server/cms-workflow-platform-command.test-support';
import {
  WORKFLOW_COMMAND_SPECS,
  type CmsWorkflowCommandOperationId,
} from './cms-workflow-command-specs';
import { sendWorkflowCommand } from './cms-workflow-command-transport';

/*
 * Every protected CMS command is `no-store` (FE03 state tables: "server-authoritative, no-store and never optimistic";
 * DEC-246): the browser never answers one from, or stores one in, its HTTP cache, like every Slice 12 command transport.
 */
const OPERATIONS = Object.keys(
  COMMAND_CASES,
) as CmsWorkflowCommandOperationId[];

describe('workflow command transport cache mode', () => {
  it.each(OPERATIONS)('%s posts with cache no-store', async (id) => {
    const testCase = COMMAND_CASES[id];
    const fetcher = vi.fn<
      (path: string, init: RequestInit) => Promise<Response>
    >(() => Promise.resolve(upstreamSuccess(testCase)));
    await sendWorkflowCommand(
      WORKFLOW_COMMAND_SPECS[id] as never,
      {
        ids: testCase.params,
        body: testCase.body,
        ifMatch: testCase.ifMatch,
        idempotencyKey: KEY,
      },
      {
        fetcher: fetcher as unknown as typeof fetch,
        documentRef: { cookie: `wj_csrf=${CSRF}` },
      },
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({
      method: 'POST',
      cache: 'no-store',
    });
  });
});
