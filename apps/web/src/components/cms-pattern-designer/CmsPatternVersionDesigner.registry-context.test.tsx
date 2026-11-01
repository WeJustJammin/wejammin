// @vitest-environment jsdom
import * as React from 'react';
import { act } from 'react';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  buttonNamed,
  click,
  disableReactAct,
  enableReactAct,
  flush,
  mountElement,
  typeInto,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import CmsPatternVersionDesigner from './CmsPatternVersionDesigner';
import {
  CSRF_TOKEN,
  designerContext,
  latestDetail,
  submitStub,
} from './pattern-designer.test-support';

/**
 * FE03 1048 `commandState` error, 409 `block_registry_digest_mismatch` (CMS-03C-12; review V19 M2): the designer reads
 * the context again by itself (`cmsTemplateContextRead`), keeps the unsent tree, replaces the block choices and names
 * the selectors that changed.
 */
beforeAll(async () => {
  enableReactAct();
  await import('../cms-composition/cms-registry-read');
});
afterAll(disableReactAct);
afterEach(() => vi.unstubAllGlobals());

const TYPE = designerContext.contentTypes[0]!;
const NEW_BLOCKS = [
  { blockKey: 'profile.header', blockVersion: 1 },
  { blockKey: 'profile.text', blockVersion: 4 },
];
const body = (blocks = NEW_BLOCKS) =>
  Response.json(
    {
      contentTypes: [
        {
          id: TYPE.id,
          typeKey: TYPE.typeKey,
          activeVersionId: '018f0c45-73fe-7dc2-9c09-68f7ecf132db',
          activeVersion: 2,
          sourceLocale: 'en-US',
        },
      ],
      registeredBlocks: blocks,
    },
    { status: 200 },
  );
const fail = () =>
  Response.json(
    {
      code: 'DEPENDENCY_UNAVAILABLE',
      message: 'x',
      requestId: '50000000-0000-4000-8000-000000000005',
      details: {},
    },
    { status: 503 },
  );
const mount = (...reads: Array<Response | Promise<Response>>) => {
  const queue = [...reads];
  // Only the context URL is scripted: the nested-pattern picker reads its own URL on mount.
  const fetcher = vi
    .fn<typeof fetch>()
    .mockImplementation((url) =>
      Promise.resolve(
        String(url) === '/api/v1/cms/templates/context'
          ? (queue.shift() ?? fail())
          : fail(),
      ),
    );
  vi.stubGlobal('fetch', fetcher);
  const submit = submitStub(
    { kind: 'refused', status: 409, reason: 'block_registry_digest_mismatch' },
    { kind: 'refused', status: 409, reason: 'block_registry_digest_mismatch' },
  );
  const mounted = mountElement(
    <CmsPatternVersionDesigner
      context={designerContext}
      latest={latestDetail()}
      csrfToken={CSRF_TOKEN}
      submit={submit}
    />,
  );
  return { ...mounted, fetcher, submit };
};
const nodeKey = (container: HTMLElement): HTMLInputElement =>
  container.querySelector<HTMLInputElement>(
    'input[id^="cms-pattern-node-"][id$="-key"]',
  )!;
const contextReads = (fetcher: ReturnType<typeof vi.fn<typeof fetch>>) =>
  fetcher.mock.calls.filter(
    ([url]) => String(url) === '/api/v1/cms/templates/context',
  );
const save = async (container: HTMLElement): Promise<void> => {
  await typeInto(nodeKey(container), 'kept-edit');
  await click(buttonNamed(container, 'Save successor draft'));
  await flush();
};

describe('pattern designer: 409 block_registry_digest_mismatch', () => {
  it('[P2-S12-AC-271] commandState error: reads the designer context by itself, keeps the unsent tree, replaces the block choices and names the selectors that changed', async () => {
    const { container, fetcher } = mount(body());
    await save(container);
    expect(contextReads(fetcher)).toHaveLength(1);
    expect(contextReads(fetcher)[0]![1]).toMatchObject({
      method: 'GET',
      cache: 'no-store',
    });
    expect(container.textContent).toContain('Added: profile.text@4');
    expect(container.textContent).toContain('Removed: profile.text@3');
    expect(nodeKey(container).value).toBe('kept-edit');
    // The block chooser now offers the new selector.
    expect(container.innerHTML).toContain('value="profile.text@4"');
  });

  it('[P2-S12-AC-271] commandState error: an unchanged registry is said to be unchanged', async () => {
    const { container, fetcher } = mount(
      body(designerContext.registeredBlocks as never),
    );
    await save(container);
    expect(contextReads(fetcher)).toHaveLength(1);
    expect(container.textContent).toContain('The block choices are unchanged.');
    expect(container.textContent).not.toContain('Added:');
  });

  it('[P2-S12-AC-271] commandState error: while the read runs or after it failed no new send is possible, and the control repeats the read', async () => {
    let release: (response: Response) => void = () => undefined;
    const held = new Promise<Response>((resolve) => {
      release = resolve;
    });
    const { container, fetcher, submit } = mount(held, body());
    await save(container);
    expect(buttonNamed(container, 'Save successor draft').disabled).toBe(true);
    await click(buttonNamed(container, 'Save successor draft'));
    expect(submit).toHaveBeenCalledTimes(1);
    await act(async () => {
      release(fail());
    });
    await flush();
    expect(container.textContent).toContain(
      'The block choices could not be read.',
    );
    expect(buttonNamed(container, 'Save successor draft').disabled).toBe(true);
    await click(buttonNamed(container, 'Read the block choices again'));
    await flush();
    expect(contextReads(fetcher)).toHaveLength(2);
    expect(container.textContent).toContain('Added: profile.text@4');
    expect(nodeKey(container).value).toBe('kept-edit');
  });
});
