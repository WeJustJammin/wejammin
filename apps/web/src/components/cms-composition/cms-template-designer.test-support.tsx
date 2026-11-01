import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { vi } from 'vitest';

import CmsTemplateDesigner from './CmsTemplateDesigner';
import CmsTemplateEditDesigner from './CmsTemplateEditDesigner';

/** Shared fixtures and DOM helpers of the CMS-11 designer suites (create and successor). */
export const TYPE_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132da';
export const VERSION_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132db';
export const TEMPLATE_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132dc';
export const HASH = 'a'.repeat(64);
export const context = {
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
export const detail = {
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
export const created = (version: string) => ({
  id: TEMPLATE_ID,
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
export const refusal = (status: number, code: string) =>
  Response.json(
    {
      code,
      message: 'refused',
      requestId: '50000000-0000-4000-8000-000000000005',
      details: {},
    },
    { status },
  );

export const setInput = (input: HTMLInputElement, value: string): void => {
  Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )?.set?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
};
export const unloadPrevented = (): boolean => {
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
};
/**
 * Clicks `link` and reports whether the page's own handlers (the leave guard) already prevented
 * the navigation; the default action is then cancelled so jsdom never attempts it.
 */
export const clickPrevented = (link: Element): boolean => {
  let prevented = false;
  const record = (event: Event): void => {
    prevented = event.defaultPrevented;
    event.preventDefault();
  };
  document.addEventListener('click', record, { once: true });
  link.dispatchEvent(
    new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }),
  );
  document.removeEventListener('click', record);
  return prevented;
};
export const submit = async (container: HTMLElement): Promise<void> => {
  await act(async () => {
    container
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
};
export const buttonNamed = (
  container: HTMLElement,
  name: string,
): HTMLElement => {
  const found = Array.from(container.querySelectorAll('button')).find(
    (button) => button.textContent === name,
  );
  if (found === undefined) throw new Error(`no button named ${name}`);
  return found;
};
export const press = async (element: HTMLElement): Promise<void> => {
  await act(async () => {
    element.click();
  });
};

let root: Root | null = null;

/** Unmounts what `mount` rendered; call from `afterEach`. */
export const unmount = async (): Promise<void> => {
  if (root !== null)
    await act(async () => {
      root!.unmount();
    });
  root = null;
};
export const mount = async (
  element: React.ReactElement,
): Promise<HTMLElement> => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(element);
  });
  return container;
};

export type Surface = Readonly<{
  name: string;
  render: (navigate: (href: string) => void) => React.ReactElement;
  /** Make the form hold work the server has not confirmed. */
  dirty: (container: HTMLElement) => Promise<void>;
  /** Undo that change by hand: the form is clean again. */
  clean: (container: HTMLElement) => Promise<void>;
  success: () => Response;
  /** An edit typed while the save is still pending. */
  late: (container: HTMLElement) => Promise<void>;
  value: (container: HTMLElement) => string;
  audience: (container: HTMLElement) => string;
}>;

export const surfaces: readonly Surface[] = [
  {
    name: 'create designer',
    render: (navigate) => (
      <CmsTemplateDesigner
        context={context}
        csrfToken="csrf-token"
        navigate={navigate}
      />
    ),
    dirty: async (container) => {
      await act(async () => {
        setInput(container.querySelector('#cms-template-key')!, 'release-note');
        setInput(container.querySelector('#cms-template-audience')!, 'public');
        const box = container.querySelector<HTMLInputElement>(
          'input[type="checkbox"]',
        )!;
        if (!box.checked) box.click();
      });
    },
    clean: async (container) => {
      await act(async () => {
        setInput(container.querySelector('#cms-template-key')!, '');
        setInput(container.querySelector('#cms-template-audience')!, '');
        const box = container.querySelector<HTMLInputElement>(
          'input[type="checkbox"]',
        )!;
        if (box.checked) box.click();
      });
    },
    late: async (container) => {
      await act(async () => {
        setInput(
          container.querySelector('#cms-template-audience')!,
          'LATE-EDIT',
        );
      });
    },
    success: () =>
      Response.json(created('1'), { status: 201, headers: { etag: '"1"' } }),
    value: (container) =>
      container.querySelector<HTMLInputElement>('#cms-template-key')!.value,
    audience: (container) =>
      container.querySelector<HTMLInputElement>('#cms-template-audience')!
        .value,
  },
  {
    name: 'successor (edit) designer',
    render: (navigate) => (
      <CmsTemplateEditDesigner
        context={context}
        detail={detail}
        csrfToken="csrf-token"
        navigate={navigate}
      />
    ),
    dirty: async (container) => {
      await act(async () => {
        setInput(container.querySelector('#cms-template-audience')!, 'changed');
      });
    },
    clean: async (container) => {
      await act(async () => {
        setInput(container.querySelector('#cms-template-audience')!, 'public');
      });
    },
    late: async (container) => {
      await act(async () => {
        setInput(
          container.querySelector('#cms-template-audience')!,
          'LATE-EDIT',
        );
      });
    },
    success: () =>
      Response.json(created('3'), { status: 201, headers: { etag: '"3"' } }),
    value: (container) =>
      container.querySelector<HTMLInputElement>('#cms-template-audience')!
        .value,
    audience: (container) =>
      container.querySelector<HTMLInputElement>('#cms-template-audience')!
        .value,
  },
];
