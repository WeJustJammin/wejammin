// @vitest-environment jsdom

import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { loadCmsValidators } from '../../lib/cms-contract-validators';
import CmsTemplateEditDesigner from './CmsTemplateEditDesigner';

const TYPE_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132da';
/** A content type the read version names but the selector context no longer offers. */
const RETIRED_TYPE = '018f0c45-73fe-7dc2-9c09-68f7ecf132ee';
const VERSION_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132db';
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
  id: '018f0c45-73fe-7dc2-9c09-68f7ecf132dc',
  version: '2',
  templateVersion: 2,
  contentHash: HASH,
  createdAt: '2026-09-27T12:00:00.000Z',
  updatedAt: '2026-09-27T13:00:00.000Z',
  state: 'draft' as const,
  templateId: '90000000-0000-4000-8000-000000000009',
  templateKey: 'release-note',
  compatibleTypeIds: [TYPE_ID, RETIRED_TYPE],
  reservedRegions: ['header', 'now', 'record', 'detail', 'provenance'],
  blockRegistryDigest: HASH,
  slots: [],
  bindings: {},
  locale: 'en-US',
  audience: 'public',
};
const resource = {
  id: detail.id,
  version: '3',
  templateVersion: 3,
  contentHash: HASH,
  createdAt: detail.createdAt,
  updatedAt: detail.updatedAt,
  state: detail.state,
  templateId: detail.templateId,
  templateKey: detail.templateKey,
  compatibleTypeIds: [TYPE_ID],
  reservedRegions: detail.reservedRegions,
  blockRegistryDigest: HASH,
};

beforeAll(async () => {
  await loadCmsValidators();
});
afterEach(() => {
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

const mount = async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
    Response.json(resource, {
      status: 201,
      headers: { etag: '"3"' },
    }),
  );
  vi.stubGlobal('fetch', fetcher);
  const container = document.createElement('div');
  document.body.appendChild(container);
  await act(async () => {
    createRoot(container).render(
      <CmsTemplateEditDesigner
        context={context}
        detail={detail}
        csrfToken="csrf-token"
      />,
    );
  });
  return { container, fetcher };
};
const boxes = (container: HTMLElement): HTMLInputElement[] =>
  Array.from(
    container.querySelectorAll<HTMLInputElement>(
      'fieldset input[type="checkbox"]',
    ),
  );
const staleBox = (container: HTMLElement): HTMLInputElement | undefined =>
  boxes(container).find((box) =>
    box.closest('label')?.textContent?.includes('no longer available'),
  );
const submit = async (container: HTMLElement): Promise<void> => {
  await act(async () => {
    container
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
};

describe('CmsTemplateEditDesigner: a content type that is no longer active', () => {
  it('renders the stale type checked and labelled so it can be removed', async () => {
    const { container } = await mount();
    const stale = staleBox(container);
    expect(stale?.checked).toBe(true);
    expect(container.textContent).toContain('no longer active');
    expect(container.textContent).toContain('Clear it to save');
  });

  it('refuses to send while the stale type is checked and says how to fix it', async () => {
    const { container, fetcher } = await mount();
    await submit(container);
    expect(fetcher).not.toHaveBeenCalled();
    expect(container.textContent).toContain('no longer active');
    expect(container.textContent).toContain('Clear the box marked');
  });

  it('saves the successor once the stale type is unchecked', async () => {
    const { container, fetcher } = await mount();
    await act(async () => {
      staleBox(container)!.click();
    });
    expect(staleBox(container)?.checked).toBe(false);
    await submit(container);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const body = JSON.parse(String(fetcher.mock.calls[0]![1]?.body)) as {
      compatibleTypeIds: string[];
      expectedVersion: string;
    };
    expect(body.compatibleTypeIds).toEqual([TYPE_ID]);
    expect(body.expectedVersion).toBe('2');
    expect(container.textContent).toContain('Draft version saved');
  });
});
