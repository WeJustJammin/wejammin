import { describe, expect, it, vi } from 'vitest';

import {
  CURSOR,
  IDS,
  PATTERN,
  scanRunResult,
  VERSION,
} from './linked-scan.test-support';
import { createLinkedScanRpcPorts, LinkedScanResponseError } from './rpc';
import { CMS_LINKED_SCAN_RPC } from './rpc-names';

const request = {
  patternId: PATTERN,
  patternVersionId: VERSION,
  cursor: CURSOR,
  correlationId: IDS.correlation,
} as const;

describe('[P2-S12-AC-213] the linked-update scan RPC port', () => {
  it('names the two protected platform_api operations', () => {
    expect(CMS_LINKED_SCAN_RPC).toEqual({
      resolveEvent: 'cms_linked_scan_resolve_event',
      run: 'cms_scan_linked_pattern_updates',
    });
  });

  it('sends the strict request as p_request and returns the validated answer', async () => {
    const rpc = vi.fn(async () => scanRunResult());
    const signal = new AbortController().signal;
    await expect(
      createLinkedScanRpcPorts(rpc as never).run(request, signal),
    ).resolves.toEqual(scanRunResult());
    expect(rpc).toHaveBeenCalledWith(
      'cms_scan_linked_pattern_updates',
      { p_request: request },
      signal,
    );
  });

  it('rereads a committed event as the job payload it names, validating the reply', async () => {
    const rpc = vi.fn(async () => ({
      found: true,
      patternId: PATTERN,
      patternVersionId: VERSION,
    }));
    const signal = new AbortController().signal;
    await expect(
      createLinkedScanRpcPorts(rpc as never).resolveEvent(IDS.event, signal),
    ).resolves.toEqual({
      found: true,
      patternId: PATTERN,
      patternVersionId: VERSION,
    });
    expect(rpc).toHaveBeenCalledWith(
      'cms_linked_scan_resolve_event',
      { p_event_id: IDS.event },
      signal,
    );
    for (const reply of [
      { found: true, kind: 'pattern', refId: PATTERN },
      { found: false, patternId: PATTERN },
      'no',
    ]) {
      await expect(
        createLinkedScanRpcPorts((async () => reply) as never).resolveEvent(
          IDS.event,
          signal,
        ),
      ).rejects.toBeInstanceOf(LinkedScanResponseError);
    }
    await expect(
      createLinkedScanRpcPorts((async () => ({
        found: false,
      })) as never).resolveEvent(IDS.event, signal),
    ).resolves.toEqual({ found: false });
  });

  it.each([
    ['a stray member', { ...scanRunResult(), instanceIds: [PATTERN] }],
    ['an inconsistent count', scanRunResult({ examined: 1, appended: 2 })],
    ['a missing member', { examined: 1 }],
    ['not an object', 'ok'],
  ])('rejects %s without carrying the reply', async (_name, reply) => {
    const rpc = vi.fn(async () => reply);
    const attempt = createLinkedScanRpcPorts(rpc as never).run(
      request,
      new AbortController().signal,
    );
    await expect(attempt).rejects.toBeInstanceOf(LinkedScanResponseError);
    await expect(attempt).rejects.toThrow(
      'The linked-update scan RPC returned an invalid response.',
    );
  });
});
