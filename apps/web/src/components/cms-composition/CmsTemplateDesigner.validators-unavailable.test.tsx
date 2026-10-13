// @vitest-environment jsdom

import * as validators from '@wejammin/contracts/cms-editorial/validators';
import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  resetCmsValidatorsForTest,
  settleCmsValidatorsForTest,
  type CmsValidators,
} from '../../lib/cms-contract-validators';
import CmsTemplateDesigner from './CmsTemplateDesigner';
import CmsTemplateEditDesigner from './CmsTemplateEditDesigner';
import { CMS_TEMPLATE_CHECK_UNAVAILABLE_MESSAGE } from './use-cms-template-validators';

/**
 * FE03 performance budgets (AC261): the template islands ship no zod, so a
 * submit loads the schemas lazily. When they cannot be fetched the draft was
 * not checked: nothing is sent, the values stay, and a later submit works.
 */

const TYPE_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132da';
const VERSION_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132db';
const TEMPLATE_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132dc';
const HASH = 'a'.repeat(64);
const context = {
  contentTypes: [
    {
      id: TYPE_ID,
      typeKey: 'release_note',
      activeVersionId: VERSION_ID,
      activeVersion: 2,
      sourceLocale: 'en-US',
    },
  ],
  registeredBlocks: [],
};
const detail = {
  id: TEMPLATE_ID,
  version: '2',
  templateVersion: 2,
  contentHash: HASH,
  createdAt: '2026-09-27T12:00:00.000Z',
  updatedAt: '2026-09-27T13:00:00.000Z',
  state: 'draft' as const,
  templateId: '90000000-0000-4000-8000-000000000009',
  templateKey: 'release-note',
  compatibleTypeIds: [TYPE_ID],
  reservedRegions: ['header', 'now', 'record', 'detail', 'provenance'],
  blockRegistryDigest: HASH,
  slots: [],
  bindings: {},
  locale: 'en-US',
  audience: 'public',
};
const created = (version: number) =>
  Response.json(
    {
      id: TEMPLATE_ID,
      version: String(version),
      templateVersion: version,
      contentHash: HASH,
      createdAt: detail.createdAt,
      updatedAt: detail.updatedAt,
      state: 'draft',
      templateId: '90000000-0000-4000-8000-000000000009',
      templateKey: 'release-note',
      compatibleTypeIds: [TYPE_ID],
      reservedRegions: detail.reservedRegions,
      blockRegistryDigest: HASH,
    },
    { status: 201, headers: { etag: `"${version}"` } },
  );

const offline = () => Promise.reject(new Error('offline'));
const setInput = (input: HTMLInputElement, value: string): void => {
  Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )?.set?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
};
const submitForm = (container: HTMLElement): void => {
  container
    .querySelector('form')!
    .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
};

let container: HTMLDivElement;
let root: Root;
const render = async (element: React.ReactElement): Promise<void> => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(element);
  });
};

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('crypto', { randomUUID: () => 'draft-attempt-001' });
  resetCmsValidatorsForTest(offline);
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  vi.unstubAllGlobals();
  document.body.replaceChildren();
  resetCmsValidatorsForTest();
});

describe('template create island without validators', () => {
  const fill = async (): Promise<void> => {
    await render(
      <CmsTemplateDesigner context={context} csrfToken="csrf-token" />,
    );
    await act(async () => {
      setInput(container.querySelector('#cms-template-key')!, 'release-note');
      setInput(container.querySelector('#cms-template-audience')!, 'public');
      container
        .querySelector<HTMLInputElement>('input[type="checkbox"]')!
        .click();
    });
  };

  it('sends nothing, says so, keeps the values and sends once the connection returns', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(created(1));
    vi.stubGlobal('fetch', fetcher);
    await fill();
    await act(async () => submitForm(container));
    expect(fetcher).not.toHaveBeenCalled();
    const status = container.querySelector('.cms-template-designer-status')!;
    expect(status.getAttribute('role')).toBe('alert');
    expect(status.textContent).toBe(CMS_TEMPLATE_CHECK_UNAVAILABLE_MESSAGE);
    expect(
      container.querySelector<HTMLInputElement>('#cms-template-key')?.value,
    ).toBe('release-note');

    resetCmsValidatorsForTest();
    await act(async () => {
      submitForm(container);
      await settleCmsValidatorsForTest();
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('Draft created.');
  });

  it('refuses a second submit while the first still waits for the schemas', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(created(1));
    vi.stubGlobal('fetch', fetcher);
    let release: () => void = () => undefined;
    resetCmsValidatorsForTest(
      () =>
        new Promise<CmsValidators>((resolve) => {
          release = () => resolve(validators);
        }),
    );
    await fill();
    await act(async () => {
      submitForm(container);
      submitForm(container);
    });
    expect(fetcher).not.toHaveBeenCalled();
    await act(async () => release());
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

describe('template edit island without validators', () => {
  it('sends nothing, says so, and keeps the unsent values', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(created(3));
    vi.stubGlobal('fetch', fetcher);
    await render(
      <CmsTemplateEditDesigner
        context={context}
        detail={detail}
        csrfToken="csrf-token"
      />,
    );
    await act(async () => {
      setInput(container.querySelector('#cms-template-audience')!, 'changed');
      submitForm(container);
    });
    expect(fetcher).not.toHaveBeenCalled();
    const status = container.querySelector('.cms-template-designer-status')!;
    expect(status.getAttribute('role')).toBe('alert');
    expect(status.textContent).toBe(CMS_TEMPLATE_CHECK_UNAVAILABLE_MESSAGE);
    expect(
      container.querySelector<HTMLInputElement>('#cms-template-audience')
        ?.value,
    ).toBe('changed');
  });

  it('reports the latest version unavailable when the schemas cannot check the read', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new Error('connection lost'));
    vi.stubGlobal('fetch', fetcher);
    resetCmsValidatorsForTest();
    await render(
      <CmsTemplateEditDesigner
        context={context}
        detail={detail}
        csrfToken="csrf-token"
      />,
    );
    await act(async () => {
      submitForm(container);
      await settleCmsValidatorsForTest();
    });
    expect(container.textContent).toContain('The result is unknown');
    expect(fetcher).toHaveBeenCalledTimes(1);

    resetCmsValidatorsForTest(offline);
    await act(async () => {
      Array.from(container.querySelectorAll('button'))
        .find((button) => button.textContent === 'Check latest version')
        ?.click();
    });
    expect(container.textContent).toContain(
      'The latest version is unavailable. Wait and try again.',
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
