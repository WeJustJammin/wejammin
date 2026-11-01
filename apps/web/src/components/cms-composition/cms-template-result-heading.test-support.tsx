import * as React from 'react';
import { act } from 'react';

import CmsTemplateDesigner from './CmsTemplateDesigner';
import CmsTemplateEditDesigner from './CmsTemplateEditDesigner';

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

/** The body of a 201 from CMS-03C-01 at the given version. */
export const createdBody = (version: string) => ({
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

export const setInput = (input: HTMLInputElement, value: string): void => {
  Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )?.set?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
};

export interface TemplateSurface {
  readonly name: string;
  readonly element: React.ReactElement;
  /** Makes the form valid and changed. */
  readonly prepare: (container: HTMLElement) => Promise<void>;
  readonly success: string;
  readonly response: () => Response;
}

/** The two template designers: create (CMS-03C-01 for a new key) and successor (CMS-03C-01 with `If-Match`). */
export const templateSurfaces: readonly TemplateSurface[] = [
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
    success: 'Draft created.',
    response: () =>
      Response.json(createdBody('1'), {
        status: 201,
        headers: { etag: '"1"' },
      }),
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
    success: 'Draft version saved.',
    response: () =>
      Response.json(createdBody('3'), {
        status: 201,
        headers: { etag: '"3"' },
      }),
  },
];
