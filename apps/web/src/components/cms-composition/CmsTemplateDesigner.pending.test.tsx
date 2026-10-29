// @vitest-environment jsdom

import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { loadCmsValidators } from '../../lib/cms-contract-validators';
import CmsTemplateDesigner from './CmsTemplateDesigner';
import CmsTemplateEditDesigner from './CmsTemplateEditDesigner';

/**
 * [P2-S12-AC-271] FE03 1048 (Slice 12 `commandState`, CMS-03C-01, `loading`): "Stable pending
 * label; only the commit control disabled", and `success`: "The operation's named resource". The
 * pending command shows its label at once (no 250 ms delay: that is the read skeleton), keeps
 * every field editable, withholds only the commit control, and claims no success until the server
 * answered with a verified 201.
 */
const TYPE_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132da';
const HASH = 'a'.repeat(64);
const context = {
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
  compatibleTypeIds: [TYPE_ID],
  reservedRegions: ['header', 'now', 'record', 'detail', 'provenance'],
  blockRegistryDigest: HASH,
  slots: [],
  bindings: {},
  locale: 'en-US',
  audience: 'public',
};
const created = (version: string) => ({
  id: detail.id,
  version,
  templateVersion: Number(version),
  contentHash: HASH,
  createdAt: detail.createdAt,
  updatedAt: detail.updatedAt,
  state: 'draft',
  templateId: detail.templateId,
  templateKey: detail.templateKey,
  compatibleTypeIds: [TYPE_ID],
  reservedRegions: detail.reservedRegions,
  blockRegistryDigest: HASH,
});

const setInput = (input: HTMLInputElement, value: string): void => {
  Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )?.set?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
};

let root: Root | null = null;
beforeAll(async () => {
  await loadCmsValidators();
});
afterEach(async () => {
  if (root !== null)
    await act(async () => {
      root!.unmount();
    });
  root = null;
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

type Surface = Readonly<{
  name: string;
  element: React.ReactElement;
  prepare: (container: HTMLElement) => Promise<void>;
  commit: string;
  pending: string;
  success: RegExp;
  response: () => Response;
}>;
const surfaces: readonly Surface[] = [
  {
    name: 'create designer',
    element: <CmsTemplateDesigner context={context} csrfToken="csrf-token" />,
    prepare: async (container) => {
      await act(async () => {
        setInput(container.querySelector('#cms-template-key')!, 'release-note');
        setInput(container.querySelector('#cms-template-audience')!, 'public');
        container
          .querySelector<HTMLInputElement>('input[type="checkbox"]')!
          .click();
      });
    },
    commit: 'Create draft',
    pending: 'Creating the draft',
    success: /Draft created/u,
    response: () =>
      Response.json(created('1'), { status: 201, headers: { etag: '"1"' } }),
  },
  {
    name: 'successor (edit) designer',
    element: (
      <CmsTemplateEditDesigner
        context={context}
        detail={detail}
        csrfToken="csrf-token"
      />
    ),
    prepare: async (container) => {
      await act(async () => {
        setInput(container.querySelector('#cms-template-audience')!, 'changed');
      });
    },
    commit: 'Save successor draft',
    pending: 'Saving successor draft',
    success: /Draft version saved/u,
    response: () =>
      Response.json(created('3'), { status: 201, headers: { etag: '"3"' } }),
  },
];

describe.each(surfaces)(
  'CMS-03C-01 command loading state: $name',
  (surface) => {
    it('[P2-S12-AC-271] shows the pending label at once, disables only the commit control, claims no success, then names the resource', async () => {
      vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
      let answer: (response: Response) => void = () => undefined;
      vi.stubGlobal(
        'fetch',
        vi.fn(
          () =>
            new Promise<Response>((resolve) => {
              answer = resolve;
            }),
        ),
      );
      const container = document.createElement('div');
      document.body.appendChild(container);
      root = createRoot(container);
      await act(async () => {
        root!.render(surface.element);
      });
      await surface.prepare(container);
      const form = container.querySelector('form')!;
      await act(async () => {
        form.dispatchEvent(
          new Event('submit', { bubbles: true, cancelable: true }),
        );
      });
      // Pending: the label is there with no delay, and nothing claims success yet.
      expect(container.textContent).toContain(surface.pending);
      expect(container.textContent).not.toMatch(surface.success);
      const controls = Array.from(
        form.querySelectorAll<HTMLElement>('input, select, textarea, button'),
      );
      const disabled = controls.filter((control) =>
        control.matches(':disabled'),
      );
      expect(
        disabled.map(
          (control) =>
            control.getAttribute('aria-label') ??
            (control.textContent || control.id || control.tagName),
        ),
      ).toEqual([surface.commit]);
      await act(async () => {
        answer(surface.response());
      });
      expect(container.textContent).toMatch(surface.success);
    });
  },
);
