// @vitest-environment jsdom
import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { TemplateDesignerContext } from '@wejammin/contracts';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { useRegistryContext } from './use-registry-context';

let root: Root | null = null;
beforeAll(async () => {
  await import('./cms-registry-read');
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
});
afterEach(async () => {
  if (root !== null) await act(async () => root!.unmount());
  root = null;
  vi.unstubAllGlobals();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
});

const TYPE = {
  id: '018f0c45-73fe-7dc2-9c09-68f7ecf132da',
  typeKey: 'release_note',
  activeVersionId: '018f0c45-73fe-7dc2-9c09-68f7ecf132db',
  activeVersion: 2,
  sourceLocale: 'en-US',
};
const initial: TemplateDesignerContext = {
  contentTypes: [TYPE],
  registeredBlocks: [{ blockKey: 'a', blockVersion: 1 }],
};
const next = (version: number) =>
  Response.json({
    contentTypes: [TYPE],
    registeredBlocks: [{ blockKey: 'a', blockVersion: version }],
  });
const keep = (context: TemplateDesignerContext) => context;

type Api = ReturnType<typeof useRegistryContext<TemplateDesignerContext>>;
let api: Api | null = null;
const Probe = ({ refused }: { refused: boolean }): null => {
  const value = useRegistryContext(initial, keep, refused);
  React.useEffect(() => {
    api = value;
  });
  return null;
};
const mount = async (strict = false): Promise<void> => {
  root = createRoot(document.body.appendChild(document.createElement('div')));
  const element = <Probe refused={false} />;
  await act(async () =>
    root!.render(
      strict ? <React.StrictMode>{element}</React.StrictMode> : element,
    ),
  );
};
const refuse = async (refused: boolean, strict = false): Promise<void> => {
  const element = <Probe refused={refused} />;
  await act(async () =>
    root!.render(
      strict ? <React.StrictMode>{element}</React.StrictMode> : element,
    ),
  );
};

describe('useRegistryContext', () => {
  it('reads once when the digest refusal appears, replaces the choices and names the change', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(next(2));
    vi.stubGlobal('fetch', fetcher);
    await mount();
    await refuse(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(api!.context.registeredBlocks).toEqual([
      { blockKey: 'a', blockVersion: 2 },
    ]);
    expect(api!.state).toMatchObject({
      kind: 'read',
      lines: expect.arrayContaining(['Added: a@2', 'Removed: a@1']),
    });
    expect(api!.holding).toBe(false);
  });

  it('still settles under React.StrictMode (the mount is re-armed)', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(next(1)));
    await mount(true);
    await refuse(true, true);
    expect(api!.state.kind).toBe('read');
  });

  it.each([
    [401, 'Your session expired. Sign in again.'],
    [403, 'Template designer access is required for this acting context.'],
    [500, 'The block choices could not be read.'],
  ])(
    'holds the send and says why when the read answers %i',
    async (status, message) => {
      vi.stubGlobal(
        'fetch',
        vi
          .fn<typeof fetch>()
          .mockResolvedValue(Response.json({ code: 'X' }, { status })),
      );
      await mount();
      await refuse(true);
      expect(api!.state).toMatchObject({
        kind: 'failed',
        message,
        rateLimited: false,
      });
      expect(api!.holding).toBe(true);
    },
  );

  it('announces a 429 as a wait, holds the repeat for it, and allows the repeat afterwards', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          Response.json(
            { code: 'RATE_LIMITED', details: { retryAfterSeconds: 3 } },
            { status: 429, headers: { 'retry-after': '3' } },
          ),
        ),
    );
    await mount();
    await refuse(true);
    expect(api!.state).toMatchObject({ kind: 'failed', rateLimited: true });
    expect(api!.waiting).toBe(true);
  });

  it('asks for a moment when a 429 states no wait', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          Response.json({ code: 'RATE_LIMITED' }, { status: 429 }),
        ),
    );
    await mount();
    await refuse(true);
    expect(api!.state).toMatchObject({ kind: 'failed', rateLimited: true });
    expect(api!.waiting).toBe(false);
  });

  it('drops an answer that a later read superseded or that arrives after unmount', async () => {
    const answers: Array<(response: Response) => void> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockImplementation(
        () =>
          new Promise<Response>((resolve) => {
            answers.push(resolve);
          }),
      ),
    );
    await mount();
    await refuse(true);
    await act(async () => api!.check());
    await act(async () => {
      answers[0]!(next(5));
      answers[1]!(next(2));
    });
    expect(api!.context.registeredBlocks).toEqual([
      { blockKey: 'a', blockVersion: 2 },
    ]);
    await act(async () => api!.check());
    await act(async () => root!.unmount());
    root = null;
    await act(async () => answers[2]!(next(9)));
    expect(api!.context.registeredBlocks).toEqual([
      { blockKey: 'a', blockVersion: 2 },
    ]);
  });
});
