import { describe, expect, it, vi } from 'vitest';

import {
  CURSOR,
  governedRunResult,
  IDS,
  REF,
} from './governed-recheck.test-support';
import { CMS_GOVERNED_RECHECK_RPC } from './rpc-names';
import {
  createGovernedRecheckRpcPorts,
  GovernedRecheckResponseError,
} from './rpc';

const request = {
  eventId: IDS.event,
  kind: 'pattern',
  refId: REF,
  cursor: CURSOR,
} as const;

describe('[P2-S12-AC-203] the governed recheck RPC port', () => {
  it('names the one protected platform_api operation', () => {
    expect(CMS_GOVERNED_RECHECK_RPC).toEqual({
      resolveEvent: 'cms_governed_recheck_resolve_event',
      run: 'cms_recheck_governed_reviews',
    });
  });

  it('sends the strict request as p_request and returns the validated answer', async () => {
    const rpc = vi.fn(async () => governedRunResult());
    const signal = new AbortController().signal;
    await expect(
      createGovernedRecheckRpcPorts(rpc as never).run(request, signal),
    ).resolves.toEqual(governedRunResult());
    expect(rpc).toHaveBeenCalledWith(
      'cms_recheck_governed_reviews',
      { p_request: request },
      signal,
    );
  });

  it('rereads a committed event as a governed dependency lookup, validating the reply', async () => {
    const rpc = vi.fn(async () => ({ found: true, kind: 'block', refId: REF }));
    const signal = new AbortController().signal;
    await expect(
      createGovernedRecheckRpcPorts(rpc as never).resolveEvent(
        IDS.event,
        signal,
      ),
    ).resolves.toEqual({
      found: true,
      kind: 'block',
      refId: REF,
    });
    expect(rpc).toHaveBeenCalledWith(
      'cms_governed_recheck_resolve_event',
      { p_event_id: IDS.event },
      signal,
    );
    for (const reply of [
      { found: true, kind: 'schema', refId: REF },
      { found: false, refId: REF },
      'no',
    ]) {
      await expect(
        createGovernedRecheckRpcPorts(
          (async () => reply) as never,
        ).resolveEvent(IDS.event, signal),
      ).rejects.toBeInstanceOf(GovernedRecheckResponseError);
    }
    await expect(
      createGovernedRecheckRpcPorts((async () => ({
        found: false,
      })) as never).resolveEvent(IDS.event, signal),
    ).resolves.toEqual({ found: false });
  });

  it.each([
    ['a stray member', { ...governedRunResult(), reviewIds: [REF] }],
    ['an inconsistent count', governedRunResult({ invalidated: 9 })],
    ['a missing member', { examined: 1 }],
    ['not an object', 'ok'],
  ])('rejects %s without carrying the reply', async (_name, reply) => {
    const rpc = vi.fn(async () => reply);
    const attempt = createGovernedRecheckRpcPorts(rpc as never).run(
      request,
      new AbortController().signal,
    );
    await expect(attempt).rejects.toBeInstanceOf(GovernedRecheckResponseError);
    await expect(attempt).rejects.toThrow(
      'The governed review recheck RPC returned an invalid response.',
    );
  });
});
