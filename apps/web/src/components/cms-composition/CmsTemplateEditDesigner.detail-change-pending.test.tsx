// @vitest-environment jsdom
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type {
  TemplateDesignerContext,
  TemplateVersionDetail,
} from '@wejammin/contracts';
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { loadCmsValidators } from '../../lib/cms-contract-validators';
import CmsTemplateEditDesigner from './CmsTemplateEditDesigner';

const TYPE_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132da';
const HASH = 'a'.repeat(64);
const context: TemplateDesignerContext = {
  contentTypes: [
    {
      id: TYPE_ID,
      typeKey: 'release_note',
      activeVersionId: '018f0c45-73fe-7dc2-9c09-68f7ecf132db',
      activeVersion: 2,
      sourceLocale: 'en-US',
    },
  ],
  registeredBlocks: [],
};
const detail: TemplateVersionDetail = {
  id: '018f0c45-73fe-7dc2-9c09-68f7ecf132dc',
  version: '2',
  templateVersion: 2,
  contentHash: HASH,
  createdAt: '2026-09-27T12:00:00.000Z',
  updatedAt: '2026-09-27T13:00:00.000Z',
  state: 'draft',
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
// A coherent newer canonical version: same key and template id, version and
// templateVersion agree, and a distinct content hash for the newer content.
const newerDetail: TemplateVersionDetail = {
  ...detail,
  id: '018f0c45-73fe-7dc2-9c09-68f7ecf132dd',
  version: '3',
  templateVersion: 3,
  contentHash: 'b'.repeat(64),
  updatedAt: '2026-09-27T14:00:00.000Z',
};
const current = (value: TemplateVersionDetail): Response =>
  Response.json(value, {
    status: 200,
    headers: { etag: `"${value.version}"` },
  });
const created = (templateVersion = 3): Response => {
  const resource = {
    id: newerDetail.id,
    version: String(templateVersion),
    templateVersion,
    contentHash: newerDetail.contentHash,
    createdAt: detail.createdAt,
    updatedAt: detail.updatedAt,
    state: detail.state,
    templateId: detail.templateId,
    templateKey: detail.templateKey,
    compatibleTypeIds: detail.compatibleTypeIds,
    reservedRegions: detail.reservedRegions,
    blockRegistryDigest: detail.blockRegistryDigest,
  };
  return Response.json(resource, {
    status: 201,
    headers: { etag: `"${templateVersion}"` },
  });
};

// A promise resolved or rejected exactly once, so a test always settles every
// held fetch in `finally`: a failed assertion in the RED run still terminates
// cleanly, and a stale completion stays deterministic.
const deferred = <T,>() => {
  let resolve: (value: T) => void = () => undefined;
  let reject: (reason: unknown) => void = () => undefined;
  let settled = false;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return {
    promise,
    resolve: (value: T): void => {
      if (settled) return;
      settled = true;
      resolve(value);
    },
    reject: (reason: unknown): void => {
      if (settled) return;
      settled = true;
      reject(reason);
    },
  };
};

const roots: ReturnType<typeof createRoot>[] = [];

beforeAll(async () => {
  await loadCmsValidators();
});
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('crypto', {
    randomUUID: vi
      .fn()
      .mockReturnValueOnce('original-attempt')
      .mockReturnValue('later-attempt'),
  });
});
afterEach(async () => {
  for (const root of roots.splice(0)) await act(async () => root.unmount());
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

const render = async (
  root: ReturnType<typeof createRoot>,
  detailValue: TemplateVersionDetail,
): Promise<void> => {
  await act(async () =>
    root.render(
      <CmsTemplateEditDesigner
        context={context}
        detail={detailValue}
        csrfToken="csrf"
      />,
    ),
  );
};
const mount = async (
  fetcher: typeof fetch,
): Promise<{
  container: HTMLDivElement;
  root: ReturnType<typeof createRoot>;
}> => {
  vi.stubGlobal('fetch', fetcher);
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  roots.push(root);
  await render(root, detail);
  return { container, root };
};
const audience = (container: HTMLElement): HTMLInputElement =>
  container.querySelector<HTMLInputElement>('#cms-template-audience')!;
const commit = (container: HTMLElement): HTMLButtonElement =>
  container.querySelector<HTMLButtonElement>('button[type="submit"]')!;
const buttonWithText = (
  container: HTMLElement,
  text: string,
): HTMLButtonElement | null =>
  Array.from(container.querySelectorAll('button')).find(
    (button) => button.textContent === text,
  ) ?? null;
const getCalls = (fetcher: ReturnType<typeof vi.fn<typeof fetch>>) =>
  fetcher.mock.calls.filter(([, init]) => init?.method === 'GET');
const postCalls = (fetcher: ReturnType<typeof vi.fn<typeof fetch>>) =>
  fetcher.mock.calls.filter(([, init]) => init?.method === 'POST');
const editAudience = async (
  container: HTMLElement,
  value: string,
): Promise<void> => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )?.set?.call(audience(container), value);
    audience(container).dispatchEvent(new Event('input', { bubbles: true }));
  });
};
// Deliberately bypass disabled-button activation: the form handler enforces admission.
const nativeSubmit = async (container: HTMLElement): Promise<void> => {
  await act(async () => {
    container
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
};

describe('CMS-11 detail change while a successor write is held', () => {
  it.each(['created', 'lost'] as const)(
    'B-TPL-010 surfaces a possibly-sent attempt as unknown and reads the latest version by itself (%s)',
    async (lateKind) => {
      const write = deferred<Response>();
      const read = deferred<Response>();
      const fetcher = vi
        .fn<typeof fetch>()
        .mockImplementation((_input, init) =>
          init?.method === 'POST' ? write.promise : read.promise,
        );
      const { container, root } = await mount(fetcher);
      try {
        // Deterministic: the first POST is held and never auto-resolved.
        await editAudience(container, 'unsent-change');
        await nativeSubmit(container);
        expect(postCalls(fetcher)).toHaveLength(1);
        expect(commit(container).disabled).toBe(true);
        expect(commit(container).textContent).toMatch(
          /Saving successor draft/u,
        );
        expect(container.textContent).toContain('Saving successor draft');

        // The same component rerenders with a coherent newer parent while the
        // write is still held (the detail prop advances, the island keeps state).
        await render(root, newerDetail);

        // Progress stops, but the commit stays blocked and the unsent value is kept.
        expect(commit(container).disabled).toBe(true);
        expect(commit(container).textContent).toBe('Save successor draft');
        expect(audience(container).value).toBe('unsent-change');

        // The possibly-sent attempt must be surfaced as an unknown outcome ...
        expect(container.textContent).toContain('The result is unknown.');
        // ... with the recovery control, and the canonical read started by itself (FE03 1048, DEC-242 item 3).
        const checkButton = buttonWithText(
          container,
          'Checking latest version…',
        );
        expect(checkButton).not.toBeNull();
        expect(checkButton!.disabled).toBe(true);
        expect(getCalls(fetcher)).toHaveLength(1);
        await act(async () => read.resolve(current(newerDetail)));
        expect(container.textContent).toContain('Latest version 3');

        // A verified newer parent still needs an explicit rebase: no POST retry.
        await nativeSubmit(container);
        expect(postCalls(fetcher)).toHaveLength(1);

        // The late completion cannot announce success, re-enable the write or
        // send a duplicate.
        await act(async () => {
          if (lateKind === 'created') write.resolve(created());
          else write.reject(new Error('response lost after send'));
        });
        expect(container.textContent).not.toContain('Draft version saved.');
        expect(commit(container).disabled).toBe(true);
        expect(postCalls(fetcher)).toHaveLength(1);
        expect(audience(container).value).toBe('unsent-change');
      } finally {
        // Settle every held fetch even when an assertion above failed.
        await act(async () => {
          write.resolve(new Response(null, { status: 500 }));
          read.resolve(new Response(null, { status: 500 }));
        });
      }
    },
  );
});
