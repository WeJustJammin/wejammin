import { describe, expect, it, vi } from 'vitest';

import {
  act,
  json,
  portInput,
  resource,
} from './cms-composition-production-related.test-support';

describe('CMS-03C-05 production related-content adapter identifiers', () => {
  it('lower-cases every identifier before dispatch (the database accepts lower-case UUIDs only)', async () => {
    const lowerEntry = 'abcdef01-0000-4000-8000-00000000000a';
    const lowerPin = 'abcdef02-0000-4000-8000-00000000000b';
    const lowerExcluded = 'abcdef03-0000-4000-8000-00000000000c';
    const fetchImpl = vi.fn(async () =>
      json({
        ...resource,
        id: lowerEntry,
        sourceEntryId: lowerEntry,
        pins: [lowerPin],
        exclusions: [lowerExcluded],
      }),
    );
    const base = portInput();
    const result = await act(fetchImpl as typeof fetch, {
      path: { entryId: lowerEntry.toUpperCase() },
      body: {
        ...base.body,
        entryId: lowerEntry.toUpperCase(),
        pins: [lowerPin.toUpperCase()],
        exclusions: [lowerExcluded.toUpperCase()],
      },
    });
    expect(result).toMatchObject({ ok: true });
    const sent = JSON.parse(
      String(
        (fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body,
      ),
    ) as { p_request: Record<string, unknown> };
    expect(sent.p_request).toMatchObject({
      entryId: lowerEntry,
      pins: [lowerPin],
      exclusions: [lowerExcluded],
    });
  });
});
