import { describe, expect, it, vi } from 'vitest';

import {
  createReviewRecheckRpcPorts,
  ReviewRecheckResponseError,
  type ReviewRecheckRpc,
} from './rpc';
import { CMS_REVIEW_RECHECK_RPC } from './rpc-names';
import { CURSOR, IDS, REF } from './review-recheck.test-support';

const portsFor = (reply: unknown) => {
  const rpc = vi.fn(async () => reply);
  return {
    rpc,
    ports: createReviewRecheckRpcPorts(rpc as unknown as ReviewRecheckRpc),
  };
};
const signal = new AbortController().signal;

describe('[P2-S11-AC-113] the review recheck RPC ports', () => {
  it('names the two protected platform_api operations', () => {
    expect(CMS_REVIEW_RECHECK_RPC).toEqual({
      resolveEvent: 'cms_dependency_recheck_resolve_event',
      run: 'cms_dependency_recheck_run',
    });
  });

  it('resolves an event by id and returns the validated lookup', async () => {
    const { rpc, ports } = portsFor({ found: true, kind: 'block', refId: REF });
    await expect(ports.resolveEvent(IDS.event, signal)).resolves.toEqual({
      found: true,
      kind: 'block',
      refId: REF,
    });
    expect(rpc).toHaveBeenCalledWith(
      'cms_dependency_recheck_resolve_event',
      { p_event_id: IDS.event },
      signal,
    );
  });

  it('accepts a not-found answer', async () => {
    const { ports } = portsFor({ found: false });
    await expect(ports.resolveEvent(IDS.event, signal)).resolves.toEqual({
      found: false,
    });
  });

  it.each([
    ['a missing identity', { found: true, kind: 'block' }],
    ['an unknown kind', { found: true, kind: 'media', refId: REF }],
    ['an extra member', { found: false, refId: REF }],
    ['a non-object', 'found'],
    ['null', null],
  ])('refuses a resolver reply with %s', async (_name, reply) => {
    const { ports } = portsFor(reply);
    await expect(ports.resolveEvent(IDS.event, signal)).rejects.toBeInstanceOf(
      ReviewRecheckResponseError,
    );
  });

  it('runs the job through one request and returns the validated result', async () => {
    const { rpc, ports } = portsFor({
      examined: 500,
      invalidated: 2,
      nextCursor: CURSOR,
    });
    const request = {
      eventId: IDS.event,
      kind: 'schema',
      refId: REF,
      cursor: null,
    } as const;
    await expect(ports.run(request, signal)).resolves.toEqual({
      examined: 500,
      invalidated: 2,
      nextCursor: CURSOR,
    });
    expect(rpc).toHaveBeenCalledWith(
      'cms_dependency_recheck_run',
      { p_request: request },
      signal,
    );
  });

  it.each([
    [
      'more than 500 reviews',
      { examined: 501, invalidated: 0, nextCursor: null },
    ],
    [
      'a cursor after a short run',
      { examined: 3, invalidated: 0, nextCursor: CURSOR },
    ],
    [
      'more invalidated than examined',
      { examined: 1, invalidated: 2, nextCursor: null },
    ],
    [
      'an extra member',
      { examined: 1, invalidated: 0, nextCursor: null, ids: [] },
    ],
    ['a non-object', 3],
  ])('refuses a run reply with %s', async (_name, reply) => {
    const { ports } = portsFor(reply);
    await expect(
      ports.run(
        { eventId: IDS.event, kind: 'schema', refId: REF, cursor: null },
        signal,
      ),
    ).rejects.toBeInstanceOf(ReviewRecheckResponseError);
  });

  it('carries no payload in its response error', () => {
    const error = new ReviewRecheckResponseError();
    expect(error.name).toBe('ReviewRecheckResponseError');
    expect(error.message).toBe(
      'The review recheck RPC returned an invalid response.',
    );
  });
});
