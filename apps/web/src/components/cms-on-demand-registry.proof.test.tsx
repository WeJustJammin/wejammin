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

import { loadCmsValidators } from '../lib/cms-contract-validators';
import { registryReadImporters } from './cms-composition/registry-read-on-demand';
import CmsTemplateDesigner from './cms-composition/CmsTemplateDesigner';
import CmsTemplateEditDesigner from './cms-composition/CmsTemplateEditDesigner';
import {
  buttonNamed,
  context,
  detail,
  mount,
  setInput,
  submit,
  unmount,
} from './cms-composition/cms-template-designer.test-support';
import {
  buttonNamed as patternButton,
  click,
  disableReactAct,
  enableReactAct,
  flush,
  mountElement,
  typeInto,
} from './cms-editorial-fields/cms-editor-dom.test-support';
import CmsPatternVersionDesigner from './cms-pattern-designer/CmsPatternVersionDesigner';
import {
  CSRF_TOKEN,
  designerContext,
  latestDetail,
  submitStub,
} from './cms-pattern-designer/pattern-designer.test-support';

/*
 * The `cms-registry-read` stem of the exemption list of the bundle gate (`CMS_ON_DEMAND_CHUNKS`): the re-read of the
 * designer context after a 409 `block_registry_digest_mismatch` (FE03 1048, review V19 M2) is never part of the first
 * paint, so its module (`cms-registry-read.ts`: the context reader and the change diff) loads when the refusal comes, not
 * with the route (P2-S11-AC-106, the initial-route budget). The real designers are mounted; nothing is requested by the
 * mount, a scroll or the passing of time; the refusal requests it; a chunk that cannot be fetched leaves the 409 state
 * with its retry path. No test support that preloads the module is imported, so a request is a request.
 */
const real = { read: registryReadImporters.read };
const asked: string[] = [];
const wrapped = (): void => {
  registryReadImporters.read = (() => {
    asked.push('registry.read');
    return real.read();
  }) as typeof real.read;
};

beforeAll(async () => {
  enableReactAct();
  await loadCmsValidators();
});
afterAll(disableReactAct);
beforeEach(() => {
  asked.length = 0;
  wrapped();
});
afterEach(async () => {
  registryReadImporters.read = real.read;
  await unmount();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

const digest409 = (): Response =>
  Response.json(
    {
      code: 'TEMPLATE_VERSION_CONFLICT',
      message: 'refused',
      requestId: '50000000-0000-4000-8000-000000000005',
      details: { reasonCode: 'block_registry_digest_mismatch' },
    },
    { status: 409 },
  );
const contextBody = (): Response =>
  Response.json({
    ...context,
    registeredBlocks: [{ blockKey: 'profile.text', blockVersion: 3 }],
  });
const stubFetch = (): void => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn<typeof fetch>()
      .mockImplementation((url, init) =>
        Promise.resolve(
          init?.method === 'POST'
            ? digest409()
            : String(url) === '/api/v1/cms/templates/context'
              ? contextBody()
              : new Response('{}', { status: 503 }),
        ),
      ),
  );
};
const idle = async (): Promise<void> => {
  vi.useFakeTimers();
  document.dispatchEvent(new Event('scroll'));
  await vi.advanceTimersByTimeAsync(120_000);
  vi.useRealTimers();
  await flush();
};

describe('the block registry read', () => {
  it('cms-registry-read: not requested by the mount, a scroll, the passing of time or filling the form; requested when a registry-digest 409 refuses the create designer', async () => {
    stubFetch();
    const container = await mount(
      <CmsTemplateDesigner context={context} csrfToken="csrf-token" />,
    );
    await act(async () => {
      setInput(container.querySelector('#cms-template-key')!, 'release-note');
      setInput(container.querySelector('#cms-template-audience')!, 'public');
      container
        .querySelector<HTMLInputElement>('input[type="checkbox"]')!
        .click();
    });
    await idle();
    expect(asked).toEqual([]);
    await submit(container);
    await vi.waitFor(() => expect(asked).toContain('registry.read'), {
      timeout: 15_000,
    });
  });

  it('cms-registry-read: the successor designer asks for it only when a registry-digest 409 refuses the save', async () => {
    stubFetch();
    const container = await mount(
      <CmsTemplateEditDesigner
        context={context}
        detail={detail}
        csrfToken="csrf-token"
      />,
    );
    await act(async () => {
      setInput(container.querySelector('#cms-template-audience')!, 'changed');
    });
    await idle();
    expect(asked).toEqual([]);
    await submit(container);
    await vi.waitFor(() => expect(asked).toContain('registry.read'), {
      timeout: 15_000,
    });
  });

  it('cms-registry-read: the pattern designer asks for it only when a registry-digest 409 refuses the save', async () => {
    stubFetch();
    const { container } = mountElement(
      <CmsPatternVersionDesigner
        context={designerContext}
        latest={latestDetail()}
        csrfToken={CSRF_TOKEN}
        submit={submitStub({
          kind: 'refused',
          status: 409,
          reason: 'block_registry_digest_mismatch',
        })}
      />,
    );
    await idle();
    expect(asked).toEqual([]);
    await typeInto(
      container.querySelector<HTMLInputElement>(
        'input[id^="cms-pattern-node-"][id$="-key"]',
      )!,
      'kept-edit',
    );
    await click(patternButton(container, 'Save successor draft'));
    await vi.waitFor(() => expect(asked).toContain('registry.read'), {
      timeout: 15_000,
    });
  });

  it('cms-registry-read: a chunk that cannot be fetched leaves the 409 state, holds the send and offers the read again', async () => {
    stubFetch();
    let fail = true;
    registryReadImporters.read = (() => {
      asked.push('registry.read');
      return fail ? Promise.reject(new Error('chunk')) : real.read();
    }) as typeof real.read;
    const container = await mount(
      <CmsTemplateDesigner context={context} csrfToken="csrf-token" />,
    );
    await act(async () => {
      setInput(container.querySelector('#cms-template-key')!, 'release-note');
      setInput(container.querySelector('#cms-template-audience')!, 'public');
      container
        .querySelector<HTMLInputElement>('input[type="checkbox"]')!
        .click();
    });
    await submit(container);
    await vi.waitFor(
      () =>
        expect(container.textContent).toContain(
          'The block choices could not be read.',
        ),
      { timeout: 15_000 },
    );
    expect(
      container.querySelector<HTMLButtonElement>('form button[type="submit"]')!
        .disabled,
    ).toBe(true);
    expect(container.textContent).toContain('The block registry changed');
    fail = false;
    await act(async () => {
      buttonNamed(container, 'Read the block choices again').click();
    });
    await vi.waitFor(
      () => expect(container.textContent).toContain('Added: profile.text@3'),
      { timeout: 15_000 },
    );
    expect(asked).toEqual(['registry.read', 'registry.read']);
  });
});
