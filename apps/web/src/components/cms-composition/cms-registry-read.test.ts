import { afterEach, describe, expect, it, vi } from 'vitest';

import { readRegistry } from './cms-registry-read';

const TYPE = {
  id: '018f0c45-73fe-7dc2-9c09-68f7ecf132da',
  typeKey: 'release_note',
  activeVersionId: '018f0c45-73fe-7dc2-9c09-68f7ecf132db',
  activeVersion: 2,
  sourceLocale: 'en-US',
};
const A1 = { blockKey: 'a', blockVersion: 1 };
const A2 = { blockKey: 'a', blockVersion: 2 };
const answer = (blocks: unknown[], init: ResponseInit = { status: 200 }) =>
  vi.stubGlobal(
    'fetch',
    vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json({ contentTypes: [TYPE], registeredBlocks: blocks }, init),
      ),
  );
afterEach(() => vi.unstubAllGlobals());

describe('readRegistry (the on-demand registry read)', () => {
  it('says what was only added, only removed, both, or that nothing changed', async () => {
    answer([A1, A2]);
    expect((await readRegistry([A1])).state).toMatchObject({
      kind: 'read',
      lines: [expect.stringContaining('changed'), 'Added: a@2'],
    });
    answer([A1]);
    expect((await readRegistry([A1, A2])).state).toMatchObject({
      lines: [expect.stringContaining('changed'), 'Removed: a@2'],
    });
    answer([A2]);
    expect((await readRegistry([A1])).state).toMatchObject({
      lines: [expect.stringContaining('changed'), 'Added: a@2', 'Removed: a@1'],
    });
    answer([A1]);
    const unchanged = await readRegistry([A1]);
    expect(unchanged.state).toMatchObject({
      lines: [
        expect.stringContaining('changed'),
        'The block choices are unchanged.',
      ],
    });
    expect(unchanged.context?.registeredBlocks).toEqual([A1]);
  });

  it('adopts no context when the read failed, and names why', async () => {
    answer([], { status: 401 });
    expect(await readRegistry([A1])).toEqual({
      state: {
        kind: 'failed',
        rateLimited: false,
        message: 'Your session expired. Sign in again.',
      },
      context: null,
    });
    answer([], { status: 403 });
    expect((await readRegistry([A1])).state).toMatchObject({
      message: 'Template designer access is required for this acting context.',
    });
    answer([], { status: 500 });
    expect((await readRegistry([A1])).state).toMatchObject({
      message: 'The block choices could not be read.',
    });
  });

  it('carries a 429 as a polite wait with its stated seconds, or without one', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          Response.json(
            { code: 'RATE_LIMITED', details: { retryAfterSeconds: 4 } },
            { status: 429, headers: { 'retry-after': '4' } },
          ),
        ),
    );
    const timed = await readRegistry([A1]);
    expect(timed.waitSeconds).toBe(4);
    expect(timed.state).toMatchObject({ kind: 'failed', rateLimited: true });
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(Response.json({ code: 'X' }, { status: 429 })),
    );
    const untimed = await readRegistry([A1]);
    expect(untimed.waitSeconds).toBeUndefined();
    expect(untimed.state).toMatchObject({ rateLimited: true });
  });
});
