// @vitest-environment jsdom

import {
  AuthoringContextTypeSchema,
  EntryCreateRequestSchema,
} from '@wejammin/contracts';
import * as React from 'react';
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

import {
  buttonNamed,
  byLabel,
  choose,
  click,
  disableReactAct,
  enableReactAct,
  flush,
  mountElement,
  selectBy,
  typeInto,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import { describeCmsAuthoringFields } from '../cms-editorial-fields/cms-field-descriptor-decode';
import {
  authoringField,
  fieldUuid,
  selectedType,
} from '../cms-editorial-fields/cms-field-fixtures.test-support';
import CmsEditorialEntryCreateIsland from './CmsEditorialEntryCreateIsland';
import { preloadCmsEditorialTransports } from './cms-editorial-lazy-transports.test-support';
import {
  ENTRY_ID,
  createResource,
  jsonResponse,
} from './cms-editorial-entry-create-transport.test-support';

beforeAll(enableReactAct);
beforeAll(preloadCmsEditorialTransports);
afterAll(disableReactAct);
beforeEach(() => {
  document.cookie = 'wj_csrf=csrf-token';
});
afterEach(() => {
  document.body.replaceChildren();
  document.cookie = 'wj_csrf=; max-age=0';
  window.sessionStorage.clear();
});

const changedType = () => {
  const original = selectedType();
  const version = fieldUuid(0x7002);
  return AuthoringContextTypeSchema.parse({
    ...original,
    contentTypeId: fieldUuid(0x7001),
    contentTypeVersionId: version,
    schemaArtifact: {
      ...original.schemaArtifact,
      id: fieldUuid(0x7003),
      contentTypeVersionId: version,
      artifactHash: 'b'.repeat(64),
    },
    validatorRefs: [{ key: 'sanitize.rich_text', version: '3' }],
    workflowPolicy: { ...original.workflowPolicy, policyHash: 'c'.repeat(64) },
    activationEvidence: {
      ...original.activationEvidence,
      approvalEvidenceHash: 'd'.repeat(64),
    },
  });
};

describe('DEC-202 immutable unknown entry-create attempts', () => {
  it.each([
    { label: 'unchanged valid schema evidence', change: false },
    { label: 'changed valid type and evidence props', change: true },
  ])(
    '$label retains the exact original body and key until explicit retry settles',
    async ({ change }) => {
      const original = selectedType();
      const replacement = changedType();
      expect(replacement.contentTypeId).not.toBe(original.contentTypeId);
      expect(replacement.contentTypeVersionId).not.toBe(
        original.contentTypeVersionId,
      );
      expect(replacement.schemaArtifact).not.toEqual(original.schemaArtifact);
      expect(replacement.workflowPolicy).not.toEqual(original.workflowPolicy);
      expect(replacement.activationEvidence).not.toEqual(
        original.activationEvidence,
      );
      const fields = [
        authoringField({
          n: 1,
          key: 'title',
          kind: 'short_text',
          label: 'Title',
          required: true,
          constraints: { minLength: 2, maxLength: 40 },
        }),
      ];
      const calls: Array<{
        body: string;
        key: string | null;
        method: string | undefined;
      }> = [];
      const fetcher = vi.fn(
        async (_input: RequestInfo | URL, init?: RequestInit) => {
          calls.push({
            body: String(init?.body),
            key: new Headers(init?.headers).get('idempotency-key'),
            method: init?.method,
          });
          if (calls.length === 1)
            throw new TypeError('Lost response after dispatch');
          return jsonResponse(
            201,
            { ...createResource(), locale: 'fr-FR' },
            {
              location: `/api/v1/cms/entries/${ENTRY_ID}`,
            },
          );
        },
      );
      const navigate = vi.fn();
      const render = (type: typeof original) => (
        <CmsEditorialEntryCreateIsland
          type={type}
          fields={fields}
          descriptors={describeCmsAuthoringFields(fields)}
          fetcher={fetcher}
          navigate={navigate}
        />
      );
      const mounted = mountElement(render(original));
      const title = byLabel<HTMLInputElement>(
        mounted.container,
        'Title (required)',
      );
      const locale = selectBy(mounted.container, '#entry-locale');
      await typeInto(title, 'Unsettled work');
      await choose(locale, 'fr-FR');
      await click(buttonNamed(mounted.container, 'Create entry'));
      await flush();
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(calls[0]?.method).toBe('POST');
      expect(calls[0]?.key).toEqual(expect.any(String));
      expect(calls[0]?.key?.length).toBeGreaterThanOrEqual(8);
      const first = EntryCreateRequestSchema.parse(
        JSON.parse(calls[0]?.body ?? 'null'),
      );
      expect(first).toMatchObject({
        contentTypeId: original.contentTypeId,
        contentTypeVersionId: original.contentTypeVersionId,
        schemaArtifact: original.schemaArtifact,
        workflowPolicy: original.workflowPolicy,
        activationEvidence: original.activationEvidence,
        locale: 'fr-FR',
        values: { [fieldUuid(1)]: 'Unsettled work' },
      });
      expect(title.matches(':disabled')).toBe(true);
      expect(locale.disabled).toBe(true);
      expect(navigate).not.toHaveBeenCalled();

      mounted.rerender(render(change ? replacement : original));
      await flush();
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(title.value).toBe('Unsettled work');
      expect(locale.value).toBe('fr-FR');
      expect(title.matches(':disabled')).toBe(true);
      expect(
        mounted.container.querySelector('[role="status"]')?.textContent,
      ).toContain('could not be confirmed');
      const retry = buttonNamed(mounted.container, 'Retry create');
      expect(document.activeElement).toBe(retry);
      await click(retry);
      await flush();

      expect(fetcher).toHaveBeenCalledTimes(2);
      expect(calls[1]?.key).toBe(calls[0]?.key);
      expect(calls[1]?.body).toBe(calls[0]?.body);
      expect(
        EntryCreateRequestSchema.safeParse(JSON.parse(calls[1]?.body ?? 'null'))
          .success,
      ).toBe(true);
      expect(navigate).toHaveBeenCalledTimes(1);
      expect(navigate).toHaveBeenCalledWith(
        `/app/cms-content-modeling/entries/${ENTRY_ID}`,
      );
      await flush();
      expect(fetcher).toHaveBeenCalledTimes(2);
    },
  );
});
