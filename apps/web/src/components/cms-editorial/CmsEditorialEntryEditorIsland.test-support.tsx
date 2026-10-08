import { act } from 'react';
import * as React from 'react';

import { mountElement } from '../cms-editorial-fields/cms-editor-dom.test-support';
import CmsEditorialEntryEditorIsland, {
  type CmsEditorialEntryEditorProps,
} from './CmsEditorialEntryEditorIsland';
import { editorInit } from './cms-editorial-editor-fixtures.test-support';
import { createFakeClock } from './cms-editorial-fake-clock.test-support';

export type Step = Response | Error | (() => Promise<Response>);

const mountedViews: Array<() => void> = [];

/** Unmounts every island this file mounted, so no window listener outlives its test. */
export const unmountAll = (): void => {
  for (const unmount of mountedViews.splice(0)) unmount();
};

/**
 * Mounts the draft-editing island over a scripted fetcher and a fake clock, so
 * a test drives real native controls and sees exactly which requests were made.
 * `extra` carries the island's other test seams (for example `navigate`).
 */
export const setup = (
  steps: readonly Step[],
  init = editorInit(),
  extra: Partial<CmsEditorialEntryEditorProps> = {},
) => {
  const queue = [...steps];
  const calls: Array<{
    url: string;
    method: string;
    headers: Headers;
    body: string | null;
  }> = [];
  const clock = createFakeClock();
  const mounted = mountElement(
    <CmsEditorialEntryEditorIsland
      init={init}
      clock={clock}
      fetcher={async (input, requestInit) => {
        calls.push({
          url: String(input),
          method: requestInit?.method ?? 'GET',
          headers: new Headers(requestInit?.headers),
          body: typeof requestInit?.body === 'string' ? requestInit.body : null,
        });
        const step = queue.shift();
        if (step === undefined)
          throw new Error(`unexpected request ${String(input)}`);
        if (step instanceof Error) throw step;
        return typeof step === 'function' ? step() : step;
      }}
      {...extra}
    />,
  );
  mountedViews.push(mounted.unmount);
  const advance = async (ms: number): Promise<void> => {
    await act(async () => {
      await clock.advance(ms);
    });
  };
  const status = (): string =>
    mounted.container.querySelector('[data-cms-editorial-status]')
      ?.textContent ?? '';
  return { ...mounted, calls, clock, advance, status };
};

export const posts = <T extends { readonly method: string }>(
  calls: readonly T[],
): T[] => calls.filter((call) => call.method === 'POST');
