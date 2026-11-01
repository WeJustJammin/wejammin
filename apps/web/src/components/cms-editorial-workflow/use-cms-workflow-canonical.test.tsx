// @vitest-environment jsdom
import * as React from 'react';
import { act } from 'react';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  disableReactAct,
  enableReactAct,
  mountElement,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import type { CanonicalReadResult } from './cms-workflow-canonical-read';
import { useCanonicalResource } from './use-cms-workflow-canonical';

beforeAll(enableReactAct);
afterAll(disableReactAct);
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

/**
 * FE03 "Network and retry contract" (:1172): a 429 waits for `Retry-After`. The surface keeps its
 * last verified resource, commands stay off, and one read is made once the stated wait has
 * elapsed (five seconds when the server stated none).
 */
type Read = () => Promise<CanonicalReadResult<string>>;

const limited = (
  retryAfterSeconds: number | null,
): CanonicalReadResult<string> => ({
  kind: 'degraded',
  requestId: 'req-1',
  rateLimit: { retryAfterSeconds },
});

const Host = ({ read }: { readonly read: Read }): React.ReactElement => {
  const canonical = useCanonicalResource('first', '2026-01-01T00:00:00Z', read);
  return (
    <div>
      <button type="button" onClick={() => void canonical.refetch()}>
        read
      </button>
      <output data-testid="data">{canonical.data}</output>
      <output data-testid="status">{canonical.status}</output>
      <output data-testid="wait">
        {canonical.rateLimit === null
          ? 'none'
          : String(canonical.rateLimit.retryAfterSeconds)}
      </output>
    </div>
  );
};

const mount = (read: Read) => {
  const mounted = mountElement(<Host read={read} />);
  const text = (id: string): string | null =>
    mounted.container.querySelector(`[data-testid="${id}"]`)?.textContent ??
    null;
  const press = async (): Promise<void> => {
    await act(async () => {
      mounted.container.querySelector('button')?.click();
      await vi.advanceTimersByTimeAsync(0);
    });
  };
  const advance = async (ms: number): Promise<void> => {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ms);
    });
  };
  return { ...mounted, text, press, advance };
};

describe('useCanonicalResource after a 429 read', () => {
  it('keeps the last verified resource, degrades with the stated wait and reads again once it elapsed', async () => {
    const read = vi
      .fn<Read>()
      .mockResolvedValueOnce(limited(7))
      .mockResolvedValueOnce({ kind: 'ok', resource: 'second' });
    const view = mount(read);
    await view.press();
    expect(view.text('status')).toBe('degraded');
    expect(view.text('data')).toBe('first');
    expect(view.text('wait')).toBe('7');
    await view.advance(6_999);
    expect(read).toHaveBeenCalledTimes(1);
    await view.advance(1);
    expect(read).toHaveBeenCalledTimes(2);
    expect(view.text('status')).toBe('ready');
    expect(view.text('data')).toBe('second');
    expect(view.text('wait')).toBe('none');
  });

  it('waits five seconds when the server stated none', async () => {
    const read = vi
      .fn<Read>()
      .mockResolvedValueOnce(limited(null))
      .mockResolvedValueOnce({ kind: 'ok', resource: 'second' });
    const view = mount(read);
    await view.press();
    expect(view.text('wait')).toBe('null');
    await view.advance(4_999);
    expect(read).toHaveBeenCalledTimes(1);
    await view.advance(1);
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('waits again when the next read is also rate limited', async () => {
    const read = vi
      .fn<Read>()
      .mockResolvedValueOnce(limited(2))
      .mockResolvedValueOnce(limited(3))
      .mockResolvedValueOnce({ kind: 'ok', resource: 'third' });
    const view = mount(read);
    await view.press();
    await view.advance(2_000);
    expect(read).toHaveBeenCalledTimes(2);
    expect(view.text('wait')).toBe('3');
    await view.advance(2_999);
    expect(read).toHaveBeenCalledTimes(2);
    await view.advance(1);
    expect(read).toHaveBeenCalledTimes(3);
    expect(view.text('data')).toBe('third');
  });

  it('does not read again while the person reads by hand before the wait ends, and the wait restarts from that read', async () => {
    const read = vi
      .fn<Read>()
      .mockResolvedValueOnce(limited(10))
      .mockResolvedValueOnce({ kind: 'ok', resource: 'second' });
    const view = mount(read);
    await view.press();
    await view.advance(4_000);
    await view.press();
    expect(read).toHaveBeenCalledTimes(2);
    expect(view.text('data')).toBe('second');
    await view.advance(60_000);
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('stops waiting when the surface unmounts', async () => {
    const read = vi.fn<Read>().mockResolvedValueOnce(limited(5));
    const view = mount(read);
    await view.press();
    view.unmount();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('arms no wait for a 429 that answers after the surface unmounted', async () => {
    let answer: (result: CanonicalReadResult<string>) => void = () => undefined;
    const read = vi
      .fn<Read>()
      .mockImplementationOnce(
        () => new Promise((resolve) => (answer = resolve)),
      );
    const view = mount(read);
    await view.press();
    view.unmount();
    await act(async () => {
      answer(limited(5));
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(read).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not schedule a read for any other degraded answer', async () => {
    const read = vi
      .fn<Read>()
      .mockResolvedValue({ kind: 'degraded', requestId: null });
    const view = mount(read);
    await view.press();
    expect(view.text('status')).toBe('degraded');
    expect(view.text('wait')).toBe('none');
    await view.advance(60_000);
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('removes the data and the wait when the record is gone', async () => {
    const read = vi
      .fn<Read>()
      .mockResolvedValueOnce(limited(2))
      .mockResolvedValueOnce({ kind: 'gone' });
    const view = mount(read);
    await view.press();
    await view.advance(2_000);
    expect(view.text('status')).toBe('gone');
    expect(view.text('data')).toBe('');
    expect(view.text('wait')).toBe('none');
  });
});
