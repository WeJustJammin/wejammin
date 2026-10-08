import { createCmsEditorialEntryEditorController } from './cms-editorial-entry-editor-controller';
import { editorInit } from './cms-editorial-editor-fixtures.test-support';
import { createFakeClock } from './cms-editorial-fake-clock.test-support';

export type Step = Response | Error | (() => Promise<Response>);

export interface Call {
  readonly url: string;
  readonly method: string;
  readonly headers: Headers;
  readonly body: string | null;
}

export const setup = (
  steps: readonly Step[],
  init = editorInit(),
  csrf: string | null = 'csrf-token',
) => {
  const calls: Call[] = [];
  const queue = [...steps];
  const clock = createFakeClock();
  const controller = createCmsEditorialEntryEditorController({
    init,
    clock,
    csrfToken: () => csrf,
    newKey: (() => {
      let n = 0;
      return () => `key-${++n}`;
    })(),
    fetcher: async (input, requestInit) => {
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
    },
  });
  return { controller, calls, clock, queue };
};

export const writes = (calls: readonly Call[]): Call[] =>
  calls.filter((call) => call.method === 'POST');

export const bodyOf = (call: Call | undefined): Record<string, unknown> =>
  JSON.parse(call?.body ?? '{}') as Record<string, unknown>;
